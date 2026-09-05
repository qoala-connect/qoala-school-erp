import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

import { resolveUserContext } from "./src/server/aiAuth";
import { processAIChat } from "./src/server/aiService";
import { executeTool } from "./src/server/aiTools";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Supabase Clients
  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://cqylpqrharentkjmrymr.supabase.co';
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
  const adminClient = supabaseUrl && (serviceRoleKey || supabaseKey)
    ? createClient(supabaseUrl, serviceRoleKey || supabaseKey, { auth: { autoRefreshToken: false, persistSession: false } })
    : null;

  /* ------------------------------------------------------------------ *
   * Health probe — cheap liveness check for uptime monitoring/deploys
   * ------------------------------------------------------------------ */
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  /* ------------------------------------------------------------------ *
   * Enterprise AI Chat Route (Role-Aware & Tool-Augmented)
   * ------------------------------------------------------------------ */
  app.post("/api/ai/chat", async (req, res) => {
    try {
      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "GEMINI_API_KEY is not configured" });
      }

      const { message, history } = req.body;

      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: "Message string is required" });
      }

      // 1. Authenticate user from Bearer token
      const authHeader = req.headers.authorization;
      const { context, error: authError, statusCode } = await resolveUserContext(authHeader, adminClient);

      if (authError || !context) {
        return res.status(statusCode || 401).json({ error: authError || "Authentication required" });
      }

      // Admissions pipeline aggregation helper with fallback:
      // (a: any) => { const st = a.status || 'Pending'; return st; }

      // 2. Process query with Gemini function calling and role-gated tools
      const result = await processAIChat(
        { message, history },
        context,
        adminClient || supabase!
      );

      return res.json(result);
    } catch (err: any) {
      console.error("[AI Chat API Error]:", err);
      return res.status(500).json({ 
        error: "Failed to generate AI response", 
        details: err?.message || "An unexpected error occurred" 
      });
    }
  });

  /* ------------------------------------------------------------------ *
   * Controlled AI Action Execution Route (2-Step Write Confirmation)
   * ------------------------------------------------------------------ */
  app.post("/api/ai/action/execute", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const { context, error: authError, statusCode } = await resolveUserContext(authHeader, adminClient);

      if (authError || !context) {
        return res.status(statusCode || 401).json({ error: authError || "Authentication required" });
      }

      const { actionType, parameters } = req.body || {};
      if (!actionType || !parameters) {
        return res.status(400).json({ error: "actionType and parameters are required" });
      }

      const db = adminClient || supabase!;

      switch (actionType) {
        case 'mark_attendance': {
          const { student_id, attendance_date, status, class_name, section_name, remarks } = parameters;
          
          if (!student_id || !status) {
            return res.status(400).json({ error: "student_id and status are required for attendance" });
          }

          if (!context.isAdmin && !(context.isTeacher && context.assignedClasses.includes(class_name))) {
            return res.status(403).json({ error: "Permission Denied: You cannot mark attendance for this class" });
          }

          const targetDate = attendance_date || new Date().toISOString().split('T')[0];

          // Check if attendance already exists for this student on this date
          const { data: existing } = await db
            .from('attendance')
            .select('id')
            .eq('student_id', student_id)
            .eq('attendance_date', targetDate)
            .maybeSingle();

          const payload = {
            student_id,
            attendance_date: targetDate,
            status: status.toLowerCase(),
            class: class_name || null,
            section: section_name || null,
            marked_by: context.userId,
            remarks: remarks || 'Marked via AI Assistant',
            updated_at: new Date().toISOString()
          };

          if (existing?.id) {
            const { error: updErr } = await db.from('attendance').update(payload).eq('id', existing.id);
            if (updErr) throw updErr;
          } else {
            const { error: insErr } = await db.from('attendance').insert([{ ...payload, created_at: new Date().toISOString() }]);
            if (insErr) throw insErr;
          }

          return res.json({ 
            ok: true, 
            message: `Attendance marked as "${status}" on ${targetDate}.` 
          });
        }

        case 'create_notice': {
          if (!context.isAdmin) {
            return res.status(403).json({ error: "Permission Denied: Only administrators can publish notices" });
          }

          const { title, description } = parameters;
          if (!title || !description) {
            return res.status(400).json({ error: "title and description are required for notices" });
          }

          const { data: notice, error: noticeErr } = await db
            .from('notices')
            .insert([{
              title,
              description,
              created_at: new Date().toISOString()
            }])
            .select()
            .single();

          if (noticeErr) throw noticeErr;

          return res.json({ 
            ok: true, 
            message: `Official circular "${title}" published successfully.`,
            notice 
          });
        }

        case 'submit_marks': {
          const { exam_id, student_id, subject_id, obtained_marks, max_marks, class_name } = parameters;
          
          if (!exam_id || !student_id || !subject_id || obtained_marks === undefined) {
            return res.status(400).json({ error: "exam_id, student_id, subject_id and obtained_marks are required" });
          }

          if (!context.isAdmin && !(context.isTeacher && context.assignedClasses.includes(class_name))) {
            return res.status(403).json({ error: "Permission Denied: You cannot submit marks for this class" });
          }

          // Check for existing marks record
          const { data: existingMark } = await db
            .from('marks')
            .select('id')
            .eq('exam_id', exam_id)
            .eq('student_id', student_id)
            .eq('subject_id', subject_id)
            .maybeSingle();

          const markPayload = {
            exam_id,
            student_id,
            subject_id,
            obtained_marks: Number(obtained_marks),
            max_marks: Number(max_marks || 100),
            entered_by: context.userId,
            updated_at: new Date().toISOString()
          };

          if (existingMark?.id) {
            const { error: updMarkErr } = await db.from('marks').update(markPayload).eq('id', existingMark.id);
            if (updMarkErr) throw updMarkErr;
          } else {
            const { error: insMarkErr } = await db.from('marks').insert([{ ...markPayload, created_at: new Date().toISOString() }]);
            if (insMarkErr) throw insMarkErr;
          }

          return res.json({ 
            ok: true, 
            message: `Marks (${obtained_marks}/${max_marks || 100}) recorded successfully.` 
          });
        }

        default:
          return res.status(400).json({ error: `Unsupported action type: ${actionType}` });
      }
    } catch (err: any) {
      console.error("[AI Action Execution Error]:", err);
      return res.status(500).json({ 
        error: "Action execution failed", 
        details: err?.message || "An unexpected error occurred" 
      });
    }
  });

  /* ------------------------------------------------------------------ *
   * AI Daily Brief Endpoint (Dashboard Executive Summary)
   * ------------------------------------------------------------------ */
  app.get("/api/ai/daily-brief", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const { context, error: authError, statusCode } = await resolveUserContext(authHeader, adminClient);

      if (authError || !context) {
        return res.status(statusCode || 401).json({ error: authError || "Authentication required" });
      }

      const db = adminClient || supabase;
      if (!db) {
        return res.status(500).json({ error: "Database client unavailable" });
      }

      const briefResult = await executeTool('get_ai_daily_brief', {}, context, db);
      return res.json({
        ok: true,
        data: briefResult.data,
        summary: briefResult.summaryForModel,
        structuredPayload: briefResult.structuredPayload
      });
    } catch (err: any) {
      console.error("[AI Daily Brief Error]:", err);
      return res.status(500).json({ error: "Failed to load daily brief", details: err?.message });
    }
  });

  /* ------------------------------------------------------------------ *
   * Admin account management (create / delete / reset password).
   * These need the service-role key, which must never reach the browser,
   * so they run here and are gated on the caller being an admin.
   * ------------------------------------------------------------------ */
  const requireAdmin = async (req: any, res: any) => {
    if (!adminClient) {
      res.status(503).json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not configured on the server.' });
      return null;
    }
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) {
      res.status(401).json({ error: 'Missing access token.' });
      return null;
    }
    const { data: userData, error } = await adminClient.auth.getUser(token);
    if (error || !userData?.user) {
      res.status(401).json({ error: 'Invalid or expired session.' });
      return null;
    }
    const { data: profile } = await adminClient
      .from('profiles').select('role').eq('id', userData.user.id).maybeSingle();
    if (!profile || !['admin', 'super_admin', 'principal'].includes(profile.role)) {
      res.status(403).json({ error: 'Administrator role required.' });
      return null;
    }
    return userData.user;
  };

  app.post('/api/admin/users', async (req, res) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const { email, password, role, full_name } = req.body || {};
    if (!email || !password || !role) {
      return res.status(400).json({ error: 'email, password and role are required.' });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }
    const { data, error } = await adminClient!.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { full_name: full_name || '' },
    });
    if (error) return res.status(400).json({ error: error.message });

    const { error: profileError } = await adminClient!
      .from('profiles').upsert({ id: data.user.id, email, role });
    if (profileError) return res.status(400).json({ error: 'Account created but role not set: ' + profileError.message });

    return res.json({ id: data.user.id, email, role });
  });

  app.post('/api/admin/users/:id/password', async (req, res) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const { password } = req.body || {};
    if (!password || String(password).length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }
    const { error } = await adminClient!.auth.admin.updateUserById(req.params.id, { password });
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ ok: true });
  });

  app.delete('/api/admin/users/:id', async (req, res) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    if (req.params.id === admin.id) {
      return res.status(400).json({ error: 'You cannot delete the account you are signed in with.' });
    }
    const { error } = await adminClient!.auth.admin.deleteUser(req.params.id);
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ ok: true });
  });

  /* ------------------------------------------------------------------ *
   * Admission Management API (Server fallback for resilient operations)
   * ------------------------------------------------------------------ */
  const requireStaff = async (req: any, res: any) => {
    if (!adminClient) {
      res.status(503).json({ error: 'Database service is not configured on the server.' });
      return null;
    }
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) {
      res.status(401).json({ error: 'Missing access token.' });
      return null;
    }
    const { data: userData, error } = await adminClient.auth.getUser(token);
    if (error || !userData?.user) {
      res.status(401).json({ error: 'Invalid or expired session.' });
      return null;
    }
    return userData.user;
  };

  app.post('/api/admissions/:id/verify-document', async (req, res) => {
    const user = await requireStaff(req, res);
    if (!user) return;
    const { id } = req.params;
    const { document_id, status, remarks } = req.body || {};
    if (!document_id || !status) {
      return res.status(400).json({ error: 'document_id and status are required' });
    }

    try {
      const { data, error } = await adminClient!.rpc('verify_admission_document', {
        _admission_id: id,
        _document_id: document_id,
        _status: status,
        _remarks: remarks || null
      });

      if (error) {
        // Fallback to direct JSON document update via service role
        const { data: adm, error: fetchErr } = await adminClient!.from('admissions').select('documents').eq('id', id).single();
        if (fetchErr || !adm) return res.status(404).json({ error: 'Admission not found' });
        const curDocs = (adm.documents || []) as any[];
        let found = false;
        const updatedDocs = curDocs.map(d => {
          if (d.id === document_id) {
            found = true;
            return { ...d, status, remarks: remarks || d.remarks, verified_at: new Date().toISOString(), verified_by: 'Admissions Office' };
          }
          return d;
        });
        if (!found) {
          updatedDocs.push({ id: document_id, status, remarks, verified_at: new Date().toISOString(), verified_by: 'Admissions Office' });
        }
        const { data: updated, error: updErr } = await adminClient!.from('admissions').update({ documents: updatedDocs, updated_at: new Date().toISOString() }).eq('id', id).select().single();
        if (updErr) return res.status(500).json({ error: updErr.message });
        return res.json(updated);
      }

      return res.json(data);
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Verification failed' });
    }
  });

  app.post('/api/admissions/:id/approve', async (req, res) => {
    const user = await requireStaff(req, res);
    if (!user) return;
    const { id } = req.params;
    const { section_name, roll_number } = req.body || {};

    try {
      const { data, error } = await adminClient!.rpc('approve_admission', {
        _admission_id: id,
        _section_name: section_name || 'A',
        _roll_number: rollNumberClean(roll_number)
      });
      if (error) return res.status(400).json({ error: error.message });
      return res.json(Array.isArray(data) ? data[0] : data);
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Approval failed' });
    }
  });

  app.post('/api/admissions/:id/update', async (req, res) => {
    const user = await requireStaff(req, res);
    if (!user) return;
    const { id } = req.params;
    const updates = req.body || {};

    try {
      const { data, error } = await adminClient!
        .from('admissions')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();
      if (error) return res.status(400).json({ error: error.message });
      return res.json(data);
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Update failed' });
    }
  });

  app.post('/api/timetable/save', async (req, res) => {
    const user = await requireStaff(req, res);
    if (!user) return;
    const { id, academic_year_id, class_id, section_id, subject_id, teacher_id, day, period_number, start_time, end_time } = req.body || {};

    if (!academic_year_id || !class_id || !day || !period_number) {
      return res.status(400).json({ error: 'academic_year_id, class_id, day, and period_number are required.' });
    }

    try {
      const { data: clsData } = await adminClient!.from('classes').select('class_name').eq('id', class_id).maybeSingle();
      const className = clsData?.class_name || 'Class';

      const cleanStartTime = (start_time || '09:00').trim().slice(0, 8);
      const cleanEndTime = (end_time || '09:40').trim().slice(0, 8);

      let targetId = id;

      // Check for existing slot to auto-upsert if no ID was provided
      if (!targetId) {
        const { data: existing } = await adminClient!
          .from('timetable')
          .select('id')
          .eq('academic_year_id', academic_year_id)
          .eq('class_id', class_id)
          .eq('day', day)
          .eq('period_number', Number(period_number))
          .maybeSingle();

        if (existing?.id) {
          targetId = existing.id;
        }
      }

      const payload = {
        academic_year_id,
        class_id,
        class: className,
        section_id: section_id || null,
        subject_id: subject_id || null,
        teacher_id: teacher_id || null,
        day,
        period_number: Number(period_number),
        start_time: cleanStartTime,
        end_time: cleanEndTime,
      };

      const { data, error } = targetId
        ? await adminClient!.from('timetable').update(payload).eq('id', targetId).select().single()
        : await adminClient!.from('timetable').insert([payload]).select().single();

      if (error) return res.status(400).json({ error: error.message });
      return res.json({ ok: true, data });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Timetable save failed' });
    }
  });

  app.delete('/api/timetable/:id', async (req, res) => {
    const user = await requireStaff(req, res);
    if (!user) return;
    const { id } = req.params;
    try {
      const { error } = await adminClient!.from('timetable').delete().eq('id', id);
      if (error) return res.status(400).json({ error: error.message });
      return res.json({ ok: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Timetable delete failed' });
    }
  });

  app.post('/api/fees/collect', async (req, res) => {
    const user = await requireStaff(req, res);
    if (!user) return;
    const {
      student_fee_id,
      student_id,
      fee_category_id,
      amount,
      payment_mode,
      academic_year_id,
      total_amount,
      discount_amount,
      fine_amount,
      due_date,
      payment_date,
      transaction_id,
      remarks
    } = req.body || {};

    if (!student_id || !amount || Number(amount) <= 0) {
      return res.status(400).json({ error: 'student_id and positive amount are required.' });
    }

    try {
      const payingAmt = Math.round(Number(amount) * 100) / 100;
      let targetFee: any = null;

      // 1. If explicit student_fee_id provided, fetch that exact ledger
      if (student_fee_id) {
        const { data: sf } = await adminClient!
          .from('student_fees')
          .select('*')
          .eq('id', student_fee_id)
          .maybeSingle();
        targetFee = sf;
      }

      // 2. If no student_fee_id, search for existing pending/partial ledger for this student & category
      if (!targetFee && fee_category_id) {
        const { data: existing } = await adminClient!
          .from('student_fees')
          .select('*')
          .eq('student_id', student_id)
          .eq('fee_category_id', fee_category_id)
          .in('status', ['pending', 'partial', 'overdue'])
          .order('due_date', { ascending: true })
          .limit(1)
          .maybeSingle();

        targetFee = existing;
      }

      // 3. Fallback: search for any pending/partial ledger for this student
      if (!targetFee) {
        const { data: anyPending } = await adminClient!
          .from('student_fees')
          .select('*')
          .eq('student_id', student_id)
          .in('status', ['pending', 'partial', 'overdue'])
          .order('due_date', { ascending: true })
          .limit(1)
          .maybeSingle();

        targetFee = anyPending;
      }

      const yearId = academic_year_id || targetFee?.academic_year_id || (await adminClient!.from('academic_years').select('id').eq('is_current', true).maybeSingle()).data?.id;

      if (!targetFee) {
        // Create new student fee ledger
        const catId = fee_category_id || (await adminClient!.from('fee_categories').select('id').limit(1).single()).data?.id;
        const totAmt = Number(total_amount || amount);
        const discAmt = Number(discount_amount || 0);
        const finAmt = Number(fine_amount || 0);
        const netAmt = Math.max(0, totAmt + finAmt - discAmt);
        const st = payingAmt >= netAmt ? 'paid' : 'partial';

        const { data: createdFee, error: createErr } = await adminClient!
          .from('student_fees')
          .insert([{
            student_id,
            fee_category_id: catId,
            academic_year_id: yearId,
            total_amount: totAmt,
            discount_amount: discAmt,
            fine_amount: finAmt,
            amount_paid: payingAmt,
            due_date: due_date || new Date().toISOString().split('T')[0],
            status: st,
            created_by: user.id
          }])
          .select()
          .single();

        if (createErr) return res.status(400).json({ error: createErr.message });
        targetFee = createdFee;
      } else {
        // Settle against existing fee ledger
        const currentPaid = Number(targetFee.amount_paid || 0);
        const newPaid = Math.round((currentPaid + payingAmt) * 100) / 100;
        const net = Number(targetFee.net_amount || targetFee.total_amount || 0);
        const st = newPaid >= net ? 'paid' : 'partial';

        const { data: updatedFee, error: updateErr } = await adminClient!
          .from('student_fees')
          .update({
            amount_paid: newPaid,
            status: st,
            updated_at: new Date().toISOString()
          })
          .eq('id', targetFee.id)
          .select()
          .single();

        if (updateErr) return res.status(400).json({ error: updateErr.message });
        targetFee = updatedFee;
      }

      // Generate receipt number
      let receiptNo = `REC-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
      try {
        const { data: rpcReceipt } = await adminClient!.rpc('next_receipt_number', { _academic_year_id: yearId });
        if (rpcReceipt) receiptNo = rpcReceipt;
      } catch (e) {
        // Ignore fallback to formatted receipt
      }

      // Insert fee_payment
      const { data: payment, error: payErr } = await adminClient!
        .from('fee_payments')
        .insert([{
          student_fee_id: targetFee.id,
          payment_date: payment_date || new Date().toISOString().split('T')[0],
          amount_paid: payingAmt,
          payment_mode: payment_mode || 'cash',
          transaction_id: transaction_id || null,
          receipt_number: receiptNo,
          remarks: remarks || null,
          created_by: user.id
        }])
        .select()
        .single();

      if (payErr) return res.status(400).json({ error: payErr.message });

      const netAmt = Number(targetFee.net_amount || targetFee.total_amount || 0);
      const totPaid = Number(targetFee.amount_paid || 0);
      const balance = Math.max(0, netAmt - totPaid);

      return res.json({
        ok: true,
        paymentId: payment.id,
        studentFeeId: targetFee.id,
        receiptNumber: receiptNo,
        amountPaid: payingAmt,
        netAmount: netAmt,
        totalPaid: totPaid,
        balance,
        status: targetFee.status
      });
    } catch (err: any) {
      console.error('[API Fee Collect] Error:', err);
      return res.status(500).json({ error: err.message || 'Payment collection failed' });
    }
  });

  app.post('/api/fees/void', async (req, res) => {
    const user = await requireStaff(req, res);
    if (!user) return;
    const { payment_id, reason } = req.body || {};
    if (!payment_id) return res.status(400).json({ error: 'payment_id is required' });

    try {
      const { data: payment } = await adminClient!
        .from('fee_payments')
        .select('*, student_fees(*)')
        .eq('id', payment_id)
        .single();

      if (!payment) return res.status(404).json({ error: 'Payment record not found' });
      if (payment.voided_at) return res.status(400).json({ error: 'Payment is already voided' });

      // Mark payment voided
      await adminClient!
        .from('fee_payments')
        .update({
          voided_at: new Date().toISOString(),
          voided_by: user.id,
          void_reason: reason || 'Voided by cashier'
        })
        .eq('id', payment_id);

      // Recalculate student_fees amount_paid
      const feeId = payment.student_fee_id;
      const { data: remainingPayments } = await adminClient!
        .from('fee_payments')
        .select('amount_paid')
        .eq('student_fee_id', feeId)
        .is('voided_at', null);

      const totalPaid = (remainingPayments || []).reduce((sum: number, p: any) => sum + Number(p.amount_paid || 0), 0);
      const net = Number(payment.student_fees?.net_amount || payment.student_fees?.total_amount || 0);
      const newStatus = totalPaid >= net && net > 0 ? 'paid' : totalPaid > 0 ? 'partial' : 'pending';

      await adminClient!
        .from('student_fees')
        .update({
          amount_paid: totalPaid,
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', feeId);

      return res.json({ ok: true, student_fee_id: feeId, total_paid: totalPaid, status: newStatus });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Payment void failed' });
    }
  });

  function rollNumberClean(val: any) {
    if (!val || typeof val !== 'string') return null;
    return val.trim() || null;
  }

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
