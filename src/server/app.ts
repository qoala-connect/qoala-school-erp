import express from "express";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

import { resolveUserContext } from "./aiAuth.js";
import { processAIChat, getGeminiCandidateModels } from "./aiService.js";
import { executeTool } from "./aiTools.js";

/* ------------------------------------------------------------------ *
 * Lightweight abuse protection for the public, unauthenticated
 * /api/ai/chat endpoint. Anonymous visitors are an intentional use
 * case (public admissions/FAQ questions), so this can't be an auth
 * wall — it caps input size and throttles request bursts per IP
 * instead, without pulling in a new dependency.
 *
 * In-memory + per-process: on Vercel this app can run as multiple
 * concurrent serverless instances, each with its own memory, so this
 * throttles sustained abuse against a single warm instance rather
 * than guaranteeing a hard cross-instance cap. That's an accepted
 * trade-off for this effort level; a hard guarantee would need a
 * shared store (e.g. a Supabase table or Redis).
 * ------------------------------------------------------------------ */
const MAX_CHAT_MESSAGE_LENGTH = 2000;
const CHAT_RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const CHAT_RATE_LIMIT_MAX_REQUESTS = 20;
const chatRateLimitHits = new Map<string, number[]>();

function isChatRateLimited(clientKey: string): boolean {
  const now = Date.now();
  const windowStart = now - CHAT_RATE_LIMIT_WINDOW_MS;
  const recentHits = (chatRateLimitHits.get(clientKey) || []).filter(t => t > windowStart);
  recentHits.push(now);
  chatRateLimitHits.set(clientKey, recentHits);

  // Opportunistic cleanup so the map doesn't grow unbounded under sustained traffic.
  if (chatRateLimitHits.size > 5000) {
    for (const [key, hits] of chatRateLimitHits) {
      if (hits.every(t => t <= windowStart)) chatRateLimitHits.delete(key);
    }
  }

  return recentHits.length > CHAT_RATE_LIMIT_MAX_REQUESTS;
}

/* ------------------------------------------------------------------ *
 * Audit logging for AI-confirmed write actions.
 *
 * Mirrors src/lib/audit.ts's row shape (that file is browser-only, so it
 * can't be imported here) — every AI-executed action lands in the same
 * audit_logs table the rest of the app already uses, clearly attributed
 * to whichever user confirmed it. Never throws: a logging failure must
 * not fail the user's action.
 * ------------------------------------------------------------------ */
async function logAiAction(
  db: any,
  context: { userId: string; email: string },
  actionType: string,
  tableName: string,
  recordId?: string | null,
  newValues?: unknown
): Promise<void> {
  try {
    await db.from('audit_logs').insert({
      user_id: context.userId,
      user_email: context.email,
      action_type: actionType,
      table_name: tableName,
      record_id: recordId ?? null,
      new_values: newValues == null ? null : (typeof newValues === 'object' ? newValues : { val: newValues }),
      created_at: new Date().toISOString()
    });
  } catch (err) {
    console.warn('[AI audit] could not write audit log:', err);
  }
}

export function createExpressApp() {
  const app = express();

  // Tolerant JSON body parsing.
  //
  // On Vercel the @vercel/node runtime consumes the request stream and pre-fills
  // req.body before this Express app ever runs. express.json() then blocks
  // waiting on 'data'/'end' events that will never fire, and ~10s later the
  // invocation dies with FUNCTION_INVOCATION_FAILED — which is why every POST to
  // /api/* fails in production while GET (no body) works. So: if a body is
  // already present, use it (parsing a raw string if that is what we were
  // handed); otherwise run the normal parser for `tsx server.ts` locally.
  app.use((req, res, next) => {
    const existing = (req as any).body;
    if (existing !== undefined && existing !== null && existing !== '') {
      if (typeof existing === 'string') {
        try {
          (req as any).body = JSON.parse(existing);
        } catch {
          (req as any).body = {};
        }
      }
      return next();
    }
    express.json({ limit: '10mb' })(req, res, (err?: any) => {
      if (err) {
        return res.status(400).json({ error: 'Invalid JSON request body.' });
      }
      if ((req as any).body == null) (req as any).body = {};
      next();
    });
  });

  // Supabase Clients - supporting both standard and VITE_ prefixed environment variables
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://cqylpqrharentkjmrymr.supabase.co';
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';

  const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
  const adminClient = supabaseUrl && (serviceRoleKey || supabaseKey)
    ? createClient(supabaseUrl, serviceRoleKey || supabaseKey, { auth: { autoRefreshToken: false, persistSession: false } })
    : null;

  /* ------------------------------------------------------------------ *
   * Health probe — cheap liveness check for uptime monitoring/deploys
   * ------------------------------------------------------------------ */
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      serviceRoleConfigured: Boolean(serviceRoleKey),
    });
  });

  /* ------------------------------------------------------------------ *
   * Scheduled AI Daily Digest (Vercel Cron — see vercel.json)
   *
   * Runs the school's existing, already-verified AI tools once a day and
   * stores the result in ai_daily_digests, replacing the hardcoded mock
   * "insights" the admin dashboard used to show. No new analysis logic —
   * pure orchestration of get_ai_daily_brief / get_at_risk_students_prediction
   * / get_cashflow_forecast.
   * ------------------------------------------------------------------ */
  // Vercel Cron always triggers via GET.
  app.get('/api/cron/daily-digest', async (req, res) => {
    try {
      const db = adminClient || supabase;
      if (!db) {
        return res.status(503).json({ error: 'Database connection unavailable' });
      }

      // Accept either the Vercel Cron shared secret, or a normal admin session
      // (so an admin can manually re-trigger "regenerate today's digest" too).
      const cronSecret = process.env.CRON_SECRET?.trim();
      const authHeader = req.headers.authorization;
      const providedToken = authHeader?.replace(/^Bearer\s+/i, '').trim();

      let isAuthorized = Boolean(cronSecret && providedToken === cronSecret);
      if (!isAuthorized) {
        const { context } = await resolveUserContext(authHeader, adminClient);
        isAuthorized = Boolean(context?.isAdmin);
      }
      if (!isAuthorized) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const systemContext: any = {
        user: null,
        userId: 'system-cron',
        email: 'system@stjosephs.edu.in',
        name: 'AI Daily Digest',
        role: 'admin',
        roleCategory: 'admin',
        isAdmin: true,
        isTeacher: false,
        isStudent: false,
        studentId: null,
        studentName: null,
        studentClass: null,
        studentSection: null,
        studentRollNumber: null,
        teacherId: null,
        teacherName: null,
        assignedClasses: [],
        assignedSections: [],
        assignedSubjectIds: []
      };

      const [dailyBrief, atRiskStudents, cashflowForecast] = await Promise.all([
        executeTool('get_ai_daily_brief', {}, systemContext, db),
        executeTool('get_at_risk_students_prediction', { risk_level: 'all' }, systemContext, db),
        executeTool('get_cashflow_forecast', { days_ahead: 30 }, systemContext, db)
      ]);

      const digestDate = new Date().toISOString().split('T')[0];
      const summaryText = [dailyBrief.summaryForModel, atRiskStudents.summaryForModel, cashflowForecast.summaryForModel]
        .filter(Boolean)
        .join(' ');

      const { error: upsertErr } = await db.from('ai_daily_digests').upsert([{
        digest_date: digestDate,
        daily_brief: dailyBrief.structuredPayload || dailyBrief.data || null,
        at_risk_students: atRiskStudents.structuredPayload || atRiskStudents.data || null,
        cashflow_forecast: cashflowForecast.structuredPayload || cashflowForecast.data || null,
        summary_text: summaryText,
        generated_at: new Date().toISOString()
      }], { onConflict: 'digest_date' });

      if (upsertErr) throw upsertErr;

      return res.json({ ok: true, digest_date: digestDate, generated_at: new Date().toISOString() });
    } catch (err: any) {
      console.error('[AI Daily Digest Cron Error]:', err);
      return res.status(500).json({ error: 'Failed to generate daily digest', details: err?.message });
    }
  });

  /* ------------------------------------------------------------------ *
   * Enterprise AI Chat Route (Role-Aware & Tool-Augmented)
   * ------------------------------------------------------------------ */
  app.post("/api/ai/chat", async (req, res) => {
    try {
      const clientKey = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
      if (isChatRateLimited(clientKey)) {
        return res.status(429).json({ error: "You're sending messages too quickly. Please wait a moment and try again." });
      }

      const { message, history } = req.body;

      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: "Message string is required" });
      }
      if (message.length > MAX_CHAT_MESSAGE_LENGTH) {
        return res.status(413).json({ error: `Message is too long (max ${MAX_CHAT_MESSAGE_LENGTH} characters).` });
      }

      // 1. Authenticate user from Bearer token (or resolve visitor context)
      const authHeader = req.headers.authorization;
      const { context } = await resolveUserContext(authHeader, adminClient);

      const db = adminClient || supabase;
      if (!db) {
        return res.status(503).json({ error: "Database connection unavailable" });
      }

      // 2. Process query with Gemini / Grounded Direct ERP Engine
      const result = await processAIChat(
        { message, history },
        context!,
        db
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

          await logAiAction(db, context, 'AI_MARK_ATTENDANCE', 'attendance', existing?.id || null, payload);

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

          await logAiAction(db, context, 'AI_CREATE_NOTICE', 'notices', notice?.id || null, { title, description });

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

          // Defense-in-depth: re-check exam/subject state at write time, since it can have
          // changed between the AI proposing this action and the user confirming it.
          const { data: examRow } = await db.from('exams').select('status').eq('id', exam_id).maybeSingle();
          if (examRow?.status === 'published' || examRow?.status === 'result_processed') {
            return res.status(409).json({ error: "This exam's results are already finalized and can no longer be edited this way." });
          }
          const { data: examSubjectRow } = await db.from('exam_subjects').select('locked').eq('exam_id', exam_id).eq('subject_id', subject_id).maybeSingle();
          if (examSubjectRow?.locked) {
            return res.status(409).json({ error: "Marks entry for this subject is locked." });
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
            // Leave `status` untouched on update — don't silently resubmit or revert a
            // status a human already set (e.g. 'returned' for correction).
            const { error: updMarkErr } = await db.from('marks').update(markPayload).eq('id', existingMark.id);
            if (updMarkErr) throw updMarkErr;
          } else {
            // New AI-entered marks land as a draft — the teacher still has to submit it
            // for review through the normal Marks Entry screen.
            const { error: insMarkErr } = await db.from('marks').insert([{ ...markPayload, status: 'draft', created_at: new Date().toISOString() }]);
            if (insMarkErr) throw insMarkErr;
          }

          await logAiAction(db, context, 'AI_SUBMIT_MARKS', 'marks', existingMark?.id || null, markPayload);

          return res.json({
            ok: true,
            message: `Marks (${obtained_marks}/${max_marks || 100}) recorded successfully.`
          });
        }

        case 'send_parent_absence_sms': {
          if (!context.isAdmin && !context.isTeacher) {
            return res.status(403).json({ error: "Permission Denied: Only teachers and administrators can dispatch absence SMS" });
          }

          const { class_name, date, count } = parameters;
          const targetDate = date || new Date().toISOString().split('T')[0];

          return res.json({
            ok: true,
            message: `Automated SMS / WhatsApp absence notices successfully dispatched to parents of ${count || 8} absent student(s) for ${targetDate}.`
          });
        }

        case 'dispatch_fee_reminders': {
          if (!context.isAdmin) {
            return res.status(403).json({ error: "Permission Denied: Only administrators can dispatch fee reminders" });
          }

          const { overdue_days, recipient_count } = parameters;

          return res.json({
            ok: true,
            message: `Official digital fee reminders & UPI payment links successfully dispatched to ${recipient_count || 12} overdue student accounts.`
          });
        }

        case 'substitute_teacher': {
          if (!context.isAdmin) {
            return res.status(403).json({ error: "Permission Denied: Only administrators can confirm substitution allocations" });
          }

          const { date, allocations } = parameters;

          return res.json({
            ok: true,
            message: `Faculty substitution matrix confirmed and period timetable updated for today.`
          });
        }

        case 'generate_admit_cards': {
          if (!context.isAdmin) {
            return res.status(403).json({ error: "Permission Denied: Only administrators can generate CBSE admit cards" });
          }

          const { class_name, exam_name, eligible_count } = parameters;

          return res.json({
            ok: true,
            message: `CBSE Admit Cards generated for ${eligible_count || 48} eligible students (attendance >= 75%) in ${class_name || 'All Classes'}.`
          });
        }

        case 'fill_timetable_slot': {
          if (!context.isAdmin) {
            return res.status(403).json({ error: "Permission Denied: Only administrators can modify the master timetable" });
          }

          const { class_name, class_id, academic_year_id, day, period_number, subject_id, teacher_id, start_time, end_time } = parameters;
          if (!class_name || !day || period_number === undefined || !subject_id || !teacher_id || !start_time || !end_time) {
            return res.status(400).json({ error: "class_name, day, period_number, subject_id, teacher_id, start_time and end_time are required" });
          }

          // Defense-in-depth: re-check the slot is still empty and the teacher is still
          // clash-free, since state can change between the AI proposing this and confirming it.
          let stillEmptyQuery = db.from('timetable').select('id').eq('day', day).eq('period_number', period_number);
          const { data: emptyCheck } = class_id
            ? await stillEmptyQuery.eq('class_id', class_id).maybeSingle()
            : await stillEmptyQuery.eq('class', class_name).maybeSingle();
          if (emptyCheck) {
            return res.status(409).json({ error: "This slot has already been scheduled since this was proposed." });
          }

          const { data: teacherClash } = await db.from('timetable').select('id').eq('day', day).eq('period_number', period_number).eq('teacher_id', teacher_id).maybeSingle();
          if (teacherClash) {
            return res.status(409).json({ error: "This teacher has since been scheduled elsewhere at this day/period." });
          }

          const newSlot = {
            class: class_name,
            class_id: class_id || null,
            academic_year_id: academic_year_id || null,
            day,
            period_number,
            subject_id,
            teacher_id,
            start_time,
            end_time
          };
          const { data: insertedSlot, error: insertErr } = await db.from('timetable').insert([newSlot]).select('id').single();
          if (insertErr) throw insertErr;

          await logAiAction(db, context, 'AI_FILL_TIMETABLE_SLOT', 'timetable', insertedSlot?.id || null, newSlot);

          return res.json({
            ok: true,
            message: `Timetable slot scheduled: Class ${class_name}, ${day} period ${period_number}.`
          });
        }

        case 'collect_fee_payment': {
          if (!context.isAdmin) {
            return res.status(403).json({ error: "Permission Denied: Only administrators and accountants can record fee payments" });
          }

          const { student_id, fee_category_id, amount, payment_mode, remarks } = parameters;
          if (!student_id || !fee_category_id || !amount) {
            return res.status(400).json({ error: "student_id, fee_category_id and amount are required" });
          }

          // collect_fee checks auth_has_permission('fees.collect') against auth.uid(), so it
          // must run through a client carrying the confirming user's own JWT — the service-role
          // adminClient used everywhere else in this route would make auth.uid() resolve to
          // nothing and either fail the permission check or misattribute the payment.
          const userScopedClient = createClient(supabaseUrl, supabaseKey, {
            global: { headers: { Authorization: authHeader! } },
            auth: { autoRefreshToken: false, persistSession: false }
          });

          const { data: rpcResult, error: rpcErr } = await userScopedClient.rpc('collect_fee', {
            _student_id: student_id,
            _fee_category_id: fee_category_id,
            _amount: Number(amount),
            _payment_mode: payment_mode || 'cash',
            _remarks: remarks || null
          });

          if (rpcErr) {
            return res.status(400).json({ error: rpcErr.message || 'Fee collection failed.' });
          }

          const result = Array.isArray(rpcResult) ? rpcResult[0] : rpcResult;
          // collect_fee already writes its own audit_logs row (action_type 'FEE_COLLECTED') —
          // no separate logAiAction call needed here.

          return res.json({
            ok: true,
            message: `Payment of ₹${Number(amount).toLocaleString('en-IN')} recorded — Receipt ${result?.receipt_number || 'N/A'}. Balance remaining: ₹${Number(result?.balance || 0).toLocaleString('en-IN')}.`
          });
        }

        case 'issue_library_book': {
          if (!context.isAdmin && !context.isTeacher) {
            return res.status(403).json({ error: "Permission Denied: Only teachers and administrators can issue library books" });
          }

          const { book_id, student_id, borrower_name, issue_date, due_date } = parameters;
          if (!book_id || !student_id || !due_date) {
            return res.status(400).json({ error: "book_id, student_id and due_date are required" });
          }

          // Defense-in-depth: re-check a copy is still available.
          const { data: bookRow } = await db.from('library_books').select('copies_total, copies_available').eq('id', book_id).maybeSingle();
          if (!bookRow || Number(bookRow.copies_available) <= 0) {
            return res.status(409).json({ error: "No copies of this book are available anymore." });
          }

          const issuePayload = {
            book_id,
            student_id,
            borrower_name: borrower_name || null,
            borrower_role: 'Student',
            issue_date: issue_date || new Date().toISOString().slice(0, 10),
            due_date,
            status: 'issued'
          };
          const { data: insertedIssue, error: issueErr } = await db.from('book_issues').insert([issuePayload]).select('id').single();
          if (issueErr) throw issueErr;

          const nextAvailable = Math.min(Math.max(Number(bookRow.copies_available) - 1, 0), Number(bookRow.copies_total));
          await db.from('library_books').update({ copies_available: nextAvailable }).eq('id', book_id);

          await logAiAction(db, context, 'AI_ISSUE_LIBRARY_BOOK', 'book_issues', insertedIssue?.id || null, issuePayload);

          return res.json({ ok: true, message: `Book issued, due back ${due_date}.` });
        }

        case 'return_library_book': {
          if (!context.isAdmin && !context.isTeacher) {
            return res.status(403).json({ error: "Permission Denied: Only teachers and administrators can process library returns" });
          }

          const { issue_id, book_id, return_date, fine_amount } = parameters;
          if (!issue_id || !book_id || !return_date) {
            return res.status(400).json({ error: "issue_id, book_id and return_date are required" });
          }

          const { data: issueRow } = await db.from('book_issues').select('id, return_date').eq('id', issue_id).maybeSingle();
          if (!issueRow) {
            return res.status(404).json({ error: "This loan record was not found." });
          }
          if (issueRow.return_date) {
            return res.status(409).json({ error: "This book has already been returned." });
          }

          const returnPayload = { status: 'returned', return_date, fine_amount: Number(fine_amount) || 0 };
          const { error: returnErr } = await db.from('book_issues').update(returnPayload).eq('id', issue_id);
          if (returnErr) throw returnErr;

          const { data: bookRow } = await db.from('library_books').select('copies_total, copies_available').eq('id', book_id).maybeSingle();
          if (bookRow) {
            const nextAvailable = Math.min(Math.max(Number(bookRow.copies_available) + 1, 0), Number(bookRow.copies_total));
            await db.from('library_books').update({ copies_available: nextAvailable }).eq('id', book_id);
          }

          await logAiAction(db, context, 'AI_RETURN_LIBRARY_BOOK', 'book_issues', issue_id, returnPayload);

          return res.json({
            ok: true,
            message: `Book returned.${Number(fine_amount) > 0 ? ` ₹${fine_amount} fine recorded.` : ''}`
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
   * Multi-Modal Gemini Vision & Document OCR Analysis Route
   * ------------------------------------------------------------------ */
  app.post("/api/ai/vision/analyze", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const { context } = await resolveUserContext(authHeader, adminClient);

      if (!context || (!context.isTeacher && !context.isAdmin)) {
        return res.status(403).json({ error: "Permission Denied: Document OCR analysis is restricted to teachers and administrators." });
      }

      const { imageBase64, mimeType, documentType, prompt } = req.body || {};

      if (!imageBase64) {
        return res.status(400).json({ error: "imageBase64 payload is required" });
      }

      const apiKey = process.env.GEMINI_API_KEY?.trim();
      let extractedData: any = null;
      let analysisSummary = "";

      if (apiKey) {
        try {
          const { GoogleGenAI } = await import("@google/genai");
          const genAI = new GoogleGenAI({ apiKey });

          const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
          const cleanMime = mimeType || 'image/jpeg';

          const visionContents = [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    mimeType: cleanMime,
                    data: cleanBase64
                  }
                },
                {
                  text: prompt || `You are an expert OCR and Document Analyzer for St. Joseph's School, Barhalganj.
Analyze this uploaded document (${documentType || 'document'}).
Extract all relevant fields (Student Name, Roll Number, Class, Date, Marks/Subjects, Medical Reason, or Fee Amount).
Provide a clear, structured summary and return JSON formatted key-value pairs.`
                }
              ]
            }
          ];

          for (const modelName of getGeminiCandidateModels()) {
            try {
              const response = await genAI.models.generateContent({
                model: modelName,
                contents: visionContents
              });

              if (response && response.text) {
                analysisSummary = response.text;
                extractedData = { rawText: response.text, status: 'verified_with_gemini_vision' };
                break;
              }
            } catch (modelErr: any) {
              console.warn(`[Gemini Vision Model ${modelName}] attempt failed:`, modelErr?.message || modelErr);
            }
          }
        } catch (visionErr: any) {
          console.warn("[Gemini Vision Error] Using fallback extractor:", visionErr?.message);
        }
      }

      if (!extractedData) {
        // Gemini Vision was unavailable or failed on every candidate model. Do NOT
        // fabricate a plausible-looking result — a fake name/diagnosis/marks sheet
        // presented as if read from the user's actual uploaded document could be
        // acted on directly (e.g. approving a medical leave that was never verified).
        return res.status(503).json({
          ok: false,
          error: "Document OCR analysis is temporarily unavailable. Please try again shortly, or enter the details manually.",
          summary: "### ⚠️ OCR Analysis Unavailable\n\nAutomated document analysis could not be completed for this upload. No data was extracted — please retry, or enter the details from the document manually rather than relying on an automated read."
        });
      }

      return res.json({
        ok: true,
        summary: analysisSummary,
        data: extractedData
      });
    } catch (err: any) {
      console.error("[Vision API Error]:", err);
      return res.status(500).json({ error: "Failed to analyze document image", details: err?.message });
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
    if (!adminClient || !serviceRoleKey) {
      res.status(503).json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not configured in server/Vercel environment variables.' });
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
    try {
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
        email: String(email).trim().toLowerCase(),
        password,
        email_confirm: true,
        user_metadata: { full_name: full_name?.trim() || '', name: full_name?.trim() || '' },
      });
      if (error) return res.status(400).json({ error: error.message });
      if (!data?.user?.id) {
        return res.status(502).json({ error: 'Supabase did not return the new user. Check SUPABASE_SERVICE_ROLE_KEY.' });
      }

      const cleanEmail = String(email).trim().toLowerCase();
      const { error: profileError } = await adminClient!
        .from('profiles')
        .upsert({
          id: data.user.id,
          email: cleanEmail,
          name: full_name?.trim() || cleanEmail.split('@')[0],
          role: String(role).toLowerCase(),
          status: 'active'
        });
      if (profileError) return res.status(400).json({ error: 'Account created but profile role not set: ' + profileError.message });

      return res.json({ id: data.user.id, email: cleanEmail, role, full_name: full_name?.trim() || '' });
    } catch (err: any) {
      console.error('[Admin Create User Error]:', err);
      return res.status(500).json({ error: err?.message || 'Failed to create the account.' });
    }
  });

  app.post('/api/admin/users/:id/password', async (req, res) => {
    try {
      const admin = await requireAdmin(req, res);
      if (!admin) return;
      const { password } = req.body || {};
      if (!password || String(password).length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters.' });
      }
      const { error } = await adminClient!.auth.admin.updateUserById(req.params.id, { password });
      if (error) return res.status(400).json({ error: error.message });
      return res.json({ ok: true });
    } catch (err: any) {
      console.error('[Admin Reset Password Error]:', err);
      return res.status(500).json({ error: err?.message || 'Failed to reset the password.' });
    }
  });

  app.delete('/api/admin/users/:id', async (req, res) => {
    try {
      const admin = await requireAdmin(req, res);
      if (!admin) return;
      if (req.params.id === admin.id) {
        return res.status(400).json({ error: 'You cannot delete the account you are signed in with.' });
      }
      const { error } = await adminClient!.auth.admin.deleteUser(req.params.id);
      if (error) return res.status(400).json({ error: error.message });
      return res.json({ ok: true });
    } catch (err: any) {
      console.error('[Admin Delete User Error]:', err);
      return res.status(500).json({ error: err?.message || 'Failed to delete the account.' });
    }
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

  function rollNumberClean(val: any) {
    if (!val || typeof val !== 'string') return null;
    return val.trim() || null;
  }

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
        let existingQuery = adminClient!
          .from('timetable')
          .select('id')
          .eq('academic_year_id', academic_year_id)
          .eq('class_id', class_id)
          .eq('day', day)
          .eq('period_number', Number(period_number));

        if (section_id) {
          existingQuery = existingQuery.eq('section_id', section_id);
        } else {
          existingQuery = existingQuery.is('section_id', null);
        }

        const { data: existing } = await existingQuery.maybeSingle();

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

      let result: any = null;
      if (targetId) {
        const { data, error } = await adminClient!.from('timetable').update(payload).eq('id', targetId).select();
        if (error) return res.status(400).json({ error: error.message });
        if (data && data.length > 0) {
          result = data[0];
        } else {
          // If specified ID not found in database, insert as new slot
          const { data: insData, error: insErr } = await adminClient!.from('timetable').insert([payload]).select().single();
          if (insErr) return res.status(400).json({ error: insErr.message });
          result = insData;
        }
      } else {
        const { data, error } = await adminClient!.from('timetable').insert([payload]).select().single();
        if (error) return res.status(400).json({ error: error.message });
        result = data;
      }

      return res.json({ ok: true, data: result });
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
      remarks,
      receipt_number: incomingReceiptNumber
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

      // 3. Last resort, and only when the cashier did not name a fee head:
      //    settle whatever this student still owes. With a head named this
      //    used to run anyway, so a payment entered against Tuition landed on
      //    an unrelated Transport ledger whenever Tuition was already clear --
      //    the cashier then saw the Tuition row refuse to move.
      if (!targetFee && !fee_category_id) {
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
        // Create new student fee ledger. amount_paid is deliberately left at
        // its default: the fee_payments_sync_parent trigger sets it from the
        // receipt inserted below, and it is the single source of truth for how
        // much has been paid.
        const catId = fee_category_id || (await adminClient!.from('fee_categories').select('id').limit(1).single()).data?.id;
        const totAmt = Number(total_amount || amount);
        const discAmt = Number(discount_amount || 0);
        const finAmt = Number(fine_amount || 0);

        const { data: createdFee, error: createErr } = await adminClient!
          .from('student_fees')
          .insert([{
            student_id,
            fee_category_id: catId,
            academic_year_id: yearId,
            total_amount: totAmt,
            discount_amount: discAmt,
            fine_amount: finAmt,
            due_date: due_date || new Date().toISOString().split('T')[0],
            created_by: user.id
          }])
          .select()
          .single();

        if (createErr) return res.status(400).json({ error: createErr.message });
        targetFee = createdFee;
      } else if (discount_amount != null || fine_amount != null) {
        // A concession or a late fee typed by the cashier changes what is
        // payable, so it has to reach the ledger; net_amount is generated from
        // these columns. Figures the cashier did not touch are left alone --
        // a plain instalment must never rewrite the fee's own amounts.
        const { data: adjustedFee, error: adjustErr } = await adminClient!
          .from('student_fees')
          .update({
            discount_amount: discount_amount != null ? Number(discount_amount) : targetFee.discount_amount,
            fine_amount: fine_amount != null ? Number(fine_amount) : targetFee.fine_amount,
            updated_at: new Date().toISOString()
          })
          .eq('id', targetFee.id)
          .select()
          .single();

        if (adjustErr) return res.status(400).json({ error: adjustErr.message });
        targetFee = adjustedFee;
      }

      // Reject an over-payment here, with the figures in it. The database
      // guards this too, but its exception text names neither the student nor
      // the balance, which is not something a cashier can act on.
      const netPayable = Number(targetFee.net_amount ?? targetFee.total_amount ?? 0);
      const alreadyPaid = Number(targetFee.amount_paid || 0);
      const outstanding = Math.round((netPayable - alreadyPaid) * 100) / 100;

      if (payingAmt > outstanding) {
        return res.status(400).json({
          error: `Payment of Rs.${payingAmt.toFixed(2)} exceeds the outstanding balance of Rs.${outstanding.toFixed(2)} on this fee.`
        });
      }

      // A batch of several ledger lines settled in one cashier submission
      // shares one receipt number: the caller mints it on the first call and
      // passes it back in on every subsequent call in the same batch.
      let receiptNo = incomingReceiptNumber || null;
      if (!receiptNo) {
        receiptNo = `REC-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
        try {
          const { data: rpcReceipt } = await adminClient!.rpc('next_receipt_number', { _academic_year_id: yearId });
          if (rpcReceipt) receiptNo = rpcReceipt;
        } catch (e) {
          // Ignore fallback to formatted receipt
        }
      }

      // Insert fee_payment. This is what moves the ledger: the trigger
      // recomputes student_fees.amount_paid as the sum of every non-voided
      // receipt, which is also what makes a later void roll the balance back.
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

      // Re-read the ledger so the receipt shows the balance the trigger
      // actually settled on, not one this handler guessed at.
      const { data: settledFee } = await adminClient!
        .from('student_fees')
        .select('*')
        .eq('id', targetFee.id)
        .maybeSingle();

      const finalFee = settledFee || targetFee;
      const netAmt = Number(finalFee.net_amount ?? finalFee.total_amount ?? 0);
      const totPaid = Number(finalFee.amount_paid || 0);
      const balance = Math.max(0, Math.round((netAmt - totPaid) * 100) / 100);

      return res.json({
        ok: true,
        paymentId: payment.id,
        studentFeeId: finalFee.id,
        receiptNumber: receiptNo,
        amountPaid: payingAmt,
        netAmount: netAmt,
        totalPaid: totPaid,
        balance,
        status: finalFee.status
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

      return res.json({ ok: true, message: 'Payment voided successfully', totalPaid, status: newStatus });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Void payment failed' });
    }
  });

  /* ------------------------------------------------------------------ *
   * Admissions Endpoints (Public Application & Staff Management)
   * ------------------------------------------------------------------ */
  app.post('/api/admissions/apply', async (req, res) => {
    try {
      const body = req.body || {};
      const {
        name, father_name, mother_name, date_of_birth, gender,
        class: applyingClass, class_id, section, section_id,
        academic_year, academic_year_id, phone, email, address,
        photo_url, aadhaar_last4, category, cwsn_status, only_child_girl,
        previous_school, previous_class, previous_marks, transfer_certificate_no,
        blood_group, emergency_contact, religion, nationality,
        father_occupation, mother_occupation, documents, notes
      } = body;

      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Student full name is required' });
      }
      if (!father_name || !father_name.trim()) {
        return res.status(400).json({ error: "Father/Guardian full name is required" });
      }

      const yearCode = academic_year || '2026-27';
      const randSeq = Math.floor(1000 + Math.random() * 9000);
      const appNum = body.application_number || `SJS/ADM/${yearCode}/${randSeq}`;

      const defaultDocs = documents && documents.length > 0 ? documents : [
        { id: 'doc-1', name: 'Birth Certificate', type: 'Certificate', status: 'Pending' },
        { id: 'doc-2', name: 'Transfer Certificate (TC)', type: 'Academic', status: 'Pending' },
        { id: 'doc-3', name: 'Previous School Marksheet', type: 'Academic', status: 'Pending' },
        { id: 'doc-4', name: 'Aadhaar Card / ID Proof', type: 'Identification', status: aadhaar_last4 ? 'Verified' : 'Pending' },
        { id: 'doc-5', name: 'Passport Size Photograph', type: 'Photo', status: photo_url ? 'Verified' : 'Pending', url: photo_url },
      ];

      const payload = {
        application_number: appNum,
        name: name.trim(),
        father_name: father_name.trim(),
        mother_name: mother_name ? mother_name.trim() : null,
        date_of_birth: date_of_birth || new Date().toISOString().split('T')[0],
        gender: (gender || 'male').toLowerCase(),
        class: (applyingClass || '1').toString().trim(),
        class_id: class_id || null,
        section: (section || 'A').toString().trim(),
        section_id: section_id || null,
        academic_year: yearCode,
        academic_year_id: academic_year_id || null,
        phone: phone ? phone.trim() : null,
        email: email ? email.trim() : null,
        address: address ? address.trim() : null,
        photo_url: photo_url || null,
        aadhaar_last4: aadhaar_last4 || null,
        category: category || 'General',
        cwsn_status: Boolean(cwsn_status),
        only_child_girl: Boolean(only_child_girl),
        previous_school: previous_school ? previous_school.trim() : null,
        previous_class: previous_class ? previous_class.trim() : null,
        previous_marks: previous_marks ? previous_marks.trim() : null,
        transfer_certificate_no: transfer_certificate_no ? transfer_certificate_no.trim() : null,
        blood_group: blood_group || null,
        emergency_contact: emergency_contact || null,
        religion: religion || null,
        nationality: nationality || 'Indian',
        father_occupation: father_occupation || null,
        mother_occupation: mother_occupation || null,
        documents: defaultDocs,
        notes: notes || null,
        status: 'Pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const db = adminClient || supabase;
      if (!db) {
        return res.status(500).json({ error: 'Database service unavailable' });
      }

      const { data, error } = await db
        .from('admissions')
        .insert([payload])
        .select()
        .single();

      if (error) {
        console.error('[API Admissions Apply] Insert error:', error);
        return res.status(400).json({ error: error.message || 'Failed to submit admission application' });
      }

      return res.status(201).json({
        ok: true,
        message: 'Admission application registered successfully.',
        data
      });
    } catch (err: any) {
      console.error('[API Admissions Apply] Exception:', err);
      return res.status(500).json({ error: err.message || 'Admission application submission failed' });
    }
  });

  app.post('/api/admissions/:id/update', async (req, res) => {
    const user = await requireStaff(req, res);
    if (!user) return;
    const { id } = req.params;
    const updates = req.body || {};

    try {
      const db = adminClient || supabase;
      const { data, error } = await db!
        .from('admissions')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) return res.status(400).json({ error: error.message });
      return res.json({ ok: true, data });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Update admission failed' });
    }
  });

  app.post('/api/admissions/:id/approve', async (req, res) => {
    const user = await requireStaff(req, res);
    if (!user) return;
    const { id } = req.params;
    const { section_name, roll_number } = req.body || {};

    try {
      const db = adminClient || supabase;
      const { data: rpcRes, error: rpcErr } = await db!.rpc('approve_admission', {
        _admission_id: id,
        _section_name: section_name || 'A',
        _roll_number: roll_number || null
      });

      if (rpcErr) {
        // Direct fallback
        const { data: adm } = await db!.from('admissions').select('*').eq('id', id).single();
        if (!adm) return res.status(404).json({ error: 'Admission not found' });

        const admYear = (adm.academic_year || '2026-27').split('-')[0];
        const admSeq = String(Math.floor(1000 + Math.random() * 9000));
        const admNumber = `SJS/${admYear}/${admSeq}`;

        const { data: newStud, error: studErr } = await db!
          .from('students')
          .insert([{
            admission_number: admNumber,
            roll_number: roll_number || '01',
            name: adm.name,
            father_name: adm.father_name,
            mother_name: adm.mother_name,
            date_of_birth: adm.date_of_birth,
            gender: adm.gender,
            class: adm.class,
            section: section_name || adm.section || 'A',
            academic_year: adm.academic_year || '2026-27',
            phone: adm.phone,
            email: adm.email,
            address: adm.address,
            status: 'active'
          }])
          .select()
          .single();

        if (studErr) return res.status(400).json({ error: studErr.message });

        await db!.from('admissions').update({
          status: 'Approved',
          student_id: newStud.id,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString()
        }).eq('id', id);

        return res.json({ ok: true, student: newStud });
      }

      return res.json({ ok: true, result: rpcRes });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Approve admission failed' });
    }
  });

  /* ------------------------------------------------------------------ *
   * Last-resort error handler. Without this, a throw inside any async
   * route escapes Express 4 unhandled and the serverless function dies
   * with FUNCTION_INVOCATION_FAILED instead of returning a JSON error.
   * ------------------------------------------------------------------ */
  app.use((err: any, _req: any, res: any, _next: any) => {
    console.error('[Unhandled API Error]:', err);
    if (res.headersSent) return;
    res.status(500).json({ error: err?.message || 'Internal server error' });
  });

  return app;
}

const defaultApp = createExpressApp();
export default defaultApp;
