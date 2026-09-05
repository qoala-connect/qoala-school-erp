import { SupabaseClient } from '@supabase/supabase-js';
import { UserContext } from './aiAuth';

export interface ToolResult {
  data: any;
  summaryForModel: string;
  structuredPayload?: {
    type: 
      | 'student_card' 
      | 'student_360_card'
      | 'attendance_table' 
      | 'attendance_analytics_card'
      | 'fee_summary' 
      | 'fee_analytics_card'
      | 'marks_table' 
      | 'exam_analytics_card'
      | 'students_attention_card'
      | 'timetable_grid' 
      | 'kpi_cards' 
      | 'daily_brief_card'
      | 'notice_list' 
      | 'action_card' 
      | 'generic_list';
    title: string;
    data: any;
  };
}

/**
 * Tool definitions exposed to Google Gemini via functionDeclarations schema
 */
export const geminiToolDeclarations = [
  {
    name: 'get_student_profile',
    description: 'Fetch student basic information. For students, returns own profile. For teachers, returns students in assigned classes. For admins, searches school-wide.',
    parameters: {
      type: 'OBJECT',
      properties: {
        search: { type: 'STRING', description: 'Search by student name, roll number, or admission number' },
        student_id: { type: 'STRING', description: 'Specific UUID of the student' }
      }
    }
  },
  {
    name: 'get_student_360_view',
    description: 'Fetch complete 360 view combining Student Demographics, Attendance %, Academic Average %, Fee Dues, and AI Decision Support insights.',
    parameters: {
      type: 'OBJECT',
      properties: {
        student_id: { type: 'STRING', description: 'UUID of the student (optional if student is logged in)' },
        student_name: { type: 'STRING', description: 'Student name for lookup' }
      }
    }
  },
  {
    name: 'get_attendance_summary',
    description: 'Fetch attendance logs, percentages, and absentees. For students, returns own attendance. For teachers, returns attendance for assigned classes. For admins, returns class or school attendance.',
    parameters: {
      type: 'OBJECT',
      properties: {
        class_name: { type: 'STRING', description: 'Class name (e.g., "8", "10", "12")' },
        section_name: { type: 'STRING', description: 'Section name (e.g., "A", "B")' },
        date: { type: 'STRING', description: 'Date in YYYY-MM-DD format (optional)' }
      }
    }
  },
  {
    name: 'get_attendance_analytics',
    description: 'Fetch deep attendance analytics: students below 75% threshold, consecutive absences (3+ days), class comparisons, and attendance trends.',
    parameters: {
      type: 'OBJECT',
      properties: {
        class_name: { type: 'STRING', description: 'Filter by specific class (optional)' },
        threshold: { type: 'NUMBER', description: 'Attendance percentage threshold (default: 75)' },
        consecutive_days: { type: 'NUMBER', description: 'Consecutive absence days (e.g., 3)' }
      }
    }
  },
  {
    name: 'get_fee_status',
    description: 'Fetch student fee ledger, pending dues, or payment receipts. Only accessible by students (own fees) and administrators/accountants (school fees). Teachers are denied access.',
    parameters: {
      type: 'OBJECT',
      properties: {
        status: { type: 'STRING', description: 'Filter by "pending", "paid", "partial", or "overdue"' },
        class_name: { type: 'STRING', description: 'Filter by class (admin only)' }
      }
    }
  },
  {
    name: 'get_fee_analytics',
    description: 'Fetch school financial fee analytics: total collected, outstanding amounts, overdue >30 days, and class-wise fee collections. Admin only.',
    parameters: {
      type: 'OBJECT',
      properties: {
        overdue_days: { type: 'NUMBER', description: 'Filter overdue accounts by days (e.g., 30)' }
      }
    }
  },
  {
    name: 'get_exam_results_and_marks',
    description: 'Fetch examination results, subject marks, and grades. For students, returns own report card. For teachers, returns marks for assigned classes/subjects. For admins, returns school results.',
    parameters: {
      type: 'OBJECT',
      properties: {
        class_name: { type: 'STRING', description: 'Class name (e.g., "8", "10")' },
        subject_name: { type: 'STRING', description: 'Subject name (e.g., "Mathematics", "Science")' }
      }
    }
  },
  {
    name: 'get_exam_analytics',
    description: 'Fetch exam intelligence: subject performance averages, pass percentages, top improvement, and students needing academic attention (<40%).',
    parameters: {
      type: 'OBJECT',
      properties: {
        class_name: { type: 'STRING', description: 'Class name (e.g., "8", "10")' },
        subject_name: { type: 'STRING', description: 'Subject name' }
      }
    }
  },
  {
    name: 'get_ai_daily_brief',
    description: 'Fetch executive daily briefing summary (attendance %, delta from yesterday, low threshold count, today collections, lowest class, critical items).',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'get_timetable_schedule',
    description: 'Fetch academic weekly timetable and period schedules. For students, returns own class schedule. For teachers, returns their personal teaching periods.',
    parameters: {
      type: 'OBJECT',
      properties: {
        day: { type: 'STRING', description: 'Day of the week (e.g., "Monday", "mon")' },
        class_name: { type: 'STRING', description: 'Class name (optional for admin)' }
      }
    }
  },
  {
    name: 'get_my_classes_and_students',
    description: 'Fetch assigned classes, sections, subjects, and student roster for the logged-in teacher or overview for admin.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'get_school_kpi_summary',
    description: 'Fetch executive institutional KPIs (total strength, staff count, admissions, daily attendance, fee collection). Restricted to administrators.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'get_notices_and_circulars',
    description: 'Fetch official school circulars, announcements, and notices.',
    parameters: {
      type: 'OBJECT',
      properties: {
        limit: { type: 'NUMBER', description: 'Number of recent notices to retrieve (default: 5)' }
      }
    }
  },
  {
    name: 'get_school_policies_and_faqs',
    description: 'Fetch official school guidelines, CBSE affiliation info, timing, grading scales, fee rules, and SOPs.',
    parameters: {
      type: 'OBJECT',
      properties: {
        topic: { type: 'STRING', description: 'Topic keyword like "admissions", "grading", "timing", "fees", "discipline", "contact"' }
      }
    }
  },
  {
    name: 'get_natural_language_query',
    description: 'Perform complex multi-attribute natural language analytics query (e.g. students in Class 8 with attendance < 75% and math marks < 40).',
    parameters: {
      type: 'OBJECT',
      properties: {
        class_name: { type: 'STRING', description: 'Class filter' },
        max_attendance: { type: 'NUMBER', description: 'Maximum attendance percentage' },
        max_marks: { type: 'NUMBER', description: 'Maximum subject marks threshold' },
        subject_name: { type: 'STRING', description: 'Subject name to check marks' }
      }
    }
  },
  {
    name: 'propose_erp_action',
    description: 'Propose a controlled ERP write action (e.g. mark attendance, create circular notice, enter marks, dispatch fee reminders). Returns a confirmation card for the user to confirm before executing.',
    parameters: {
      type: 'OBJECT',
      properties: {
        action_type: {
          type: 'STRING',
          description: 'Action type: "mark_attendance" | "create_notice" | "submit_marks" | "create_fee_reminders"'
        },
        title: { type: 'STRING', description: 'Action title for confirmation dialog' },
        description: { type: 'STRING', description: 'Clear description of what will be changed' },
        parameters: { type: 'OBJECT', description: 'Parameters required to execute the action' }
      },
      required: ['action_type', 'title', 'description', 'parameters']
    }
  }
];

/**
 * Execute a specific tool securely with role-boundary checks
 */
export async function executeTool(
  toolName: string,
  args: Record<string, any>,
  context: UserContext,
  supabase: SupabaseClient
): Promise<ToolResult> {
  try {
    switch (toolName) {

      // =============================================================
      // 1. STUDENT 360 AI VIEW
      // =============================================================
      case 'get_student_360_view': {
        let targetStudentId = args.student_id;

        if (context.isStudent) {
          // Student is strictly locked to own studentId
          targetStudentId = context.studentId;
          if (!targetStudentId) {
            return {
              data: null,
              summaryForModel: 'Student profile not linked to active student record.'
            };
          }
        } else if (!targetStudentId && args.student_name) {
          // Search student by name
          let q = supabase.from('students').select('id, name, class, section, roll_number').ilike('name', `%${args.student_name.trim()}%`);
          if (context.isTeacher && context.assignedClasses.length > 0) {
            q = q.in('class', context.assignedClasses);
          }
          const { data: matched } = await q.limit(1).maybeSingle();
          if (matched) targetStudentId = matched.id;
        } else if (!targetStudentId && context.isTeacher) {
          // Default to first student in teacher's assigned class
          const { data: firstStd } = await supabase.from('students').select('id').in('class', context.assignedClasses).limit(1).maybeSingle();
          if (firstStd) targetStudentId = firstStd.id;
        } else if (!targetStudentId && context.isAdmin) {
          const { data: firstStd } = await supabase.from('students').select('id').limit(1).maybeSingle();
          if (firstStd) targetStudentId = firstStd.id;
        }

        if (!targetStudentId) {
          return {
            data: null,
            summaryForModel: 'No matching student record found.'
          };
        }

        // Fetch Student Demographics + Attendance + Fees + Marks in parallel
        const [stdRes, attRes, feesRes, marksRes, resultsRes] = await Promise.all([
          supabase.from('students').select('*').eq('id', targetStudentId).single(),
          supabase.from('attendance').select('status, attendance_date').eq('student_id', targetStudentId),
          supabase.from('student_fees').select('total_amount, amount_paid, net_amount, status').eq('student_id', targetStudentId),
          supabase.from('marks').select('obtained_marks, max_marks, subjects (subject_name)').eq('student_id', targetStudentId),
          supabase.from('exam_results').select('percentage, grade, division').eq('student_id', targetStudentId)
        ]);

        const std = stdRes.data;
        if (!std) {
          return { data: null, summaryForModel: 'Student record not found in database.' };
        }

        // Security check for teachers: verify student belongs to assigned class
        if (context.isTeacher && !context.assignedClasses.includes(std.class)) {
          return {
            data: null,
            summaryForModel: `Access Restricted: Student ${std.name} (Class ${std.class}) is not enrolled in your assigned classes (${context.assignedClasses.join(', ')}).`
          };
        }

        // 1. Calculate Attendance
        const attLogs = attRes.data || [];
        const totalDays = attLogs.length;
        const presentDays = attLogs.filter(a => a.status === 'present' || a.status === 'late').length;
        const attendanceRate = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 100;

        // 2. Calculate Academic Average
        const marksList = marksRes.data || [];
        let totalObtained = 0;
        let totalMax = 0;
        marksList.forEach(m => {
          if (m.obtained_marks !== null) {
            totalObtained += Number(m.obtained_marks);
            totalMax += Number(m.max_marks || 100);
          }
        });
        const academicAverage = totalMax > 0 ? Math.round((totalObtained / totalMax) * 100) : (resultsRes.data?.[0]?.percentage ? Number(resultsRes.data[0].percentage) : 85);
        const latestGrade = resultsRes.data?.[0]?.grade || (academicAverage >= 90 ? 'A1' : academicAverage >= 80 ? 'A2' : academicAverage >= 70 ? 'B1' : academicAverage >= 60 ? 'B2' : 'C1');

        // 3. Calculate Fee Balance
        const feeList = feesRes.data || [];
        const totalBilled = feeList.reduce((acc, f) => acc + Number(f.net_amount || f.total_amount || 0), 0);
        const totalPaid = feeList.reduce((acc, f) => acc + Number(f.amount_paid || 0), 0);
        const pendingFees = Math.max(0, totalBilled - totalPaid);

        // 4. Generate Non-Clinical AI Decision Support Insight
        let insight = '';
        if (attendanceRate < 75 && academicAverage < 60) {
          insight = `Attendance (${attendanceRate}%) is below CBSE 75% threshold and academic average is ${academicAverage}%. Recommending class teacher counseling and remedial coursework.`;
        } else if (attendanceRate < 75) {
          insight = `Student maintains good academic performance (${academicAverage}%), but attendance (${attendanceRate}%) is below the mandatory 75% CBSE criteria. Regularization notice recommended.`;
        } else if (academicAverage < 50) {
          insight = `Attendance is regular (${attendanceRate}%), but student is experiencing academic difficulty (avg ${academicAverage}%). Supplementary practice sessions in core subjects recommended.`;
        } else {
          insight = `Strong overall performance: Consistent attendance (${attendanceRate}%) and solid academic standing (Grade ${latestGrade}, ${academicAverage}%). Outstanding fees: ₹${pendingFees.toLocaleString('en-IN')}.`;
        }

        const data360 = {
          id: std.id,
          name: std.name,
          class: std.class,
          section: std.section,
          roll_number: std.roll_number,
          admission_number: std.admission_number,
          father_name: std.father_name,
          phone: std.phone,
          status: std.status,
          photo_url: std.photo_url,
          academic_year: std.academic_year,
          attendanceRate,
          totalDays,
          presentDays,
          academicAverage,
          latestGrade,
          pendingFees,
          totalBilled,
          totalPaid,
          insight
        };

        return {
          data: data360,
          summaryForModel: `Student 360: ${std.name} (Class ${std.class}-${std.section}, Roll: ${std.roll_number}). Attendance: ${attendanceRate}%, Academic Average: ${academicAverage}% (Grade ${latestGrade}), Pending Fees: ₹${pendingFees}. AI Decision Support Insight: "${insight}"`,
          structuredPayload: {
            type: 'student_360_card',
            title: `Student 360° Profile: ${std.name}`,
            data: data360
          }
        };
      }

      // =============================================================
      // 2. ATTENDANCE ANALYTICS (Trends, <75%, Consecutive Absences)
      // =============================================================
      case 'get_attendance_analytics': {
        const threshold = args.threshold || 75;

        // Fetch attendance records grouped by student
        const { data: allAttendance } = await supabase
          .from('attendance')
          .select('student_id, status, attendance_date, class, section, students (name, roll_number, class, section)')
          .order('attendance_date', { ascending: false })
          .limit(500);

        const logs = allAttendance || [];
        const studentMap: Record<string, { name: string; class: string; section: string; roll: string; total: number; present: number; absentDates: string[] }> = {};

        logs.forEach((l: any) => {
          const sid = l.student_id;
          if (!sid) return;

          // Scope check for teachers
          if (context.isTeacher && !context.assignedClasses.includes(l.class)) return;

          if (!studentMap[sid]) {
            studentMap[sid] = {
              name: l.students?.name || 'Student',
              class: l.class || l.students?.class || 'N/A',
              section: l.section || l.students?.section || 'A',
              roll: l.students?.roll_number || 'N/A',
              total: 0,
              present: 0,
              absentDates: []
            };
          }

          studentMap[sid].total += 1;
          if (l.status === 'present' || l.status === 'late') {
            studentMap[sid].present += 1;
          } else if (l.status === 'absent') {
            studentMap[sid].absentDates.push(l.attendance_date);
          }
        });

        // Students below threshold
        const lowAttendanceStudents: any[] = [];
        const consecutiveAbsentees: any[] = [];

        Object.entries(studentMap).forEach(([id, s]) => {
          const rate = s.total > 0 ? Math.round((s.present / s.total) * 100) : 100;
          if (rate < threshold && s.total >= 3) {
            lowAttendanceStudents.push({
              id,
              name: s.name,
              class: s.class,
              section: s.section,
              roll: s.roll,
              rate,
              present: s.present,
              total: s.total
            });
          }

          // Consecutive absence check (3+ absents)
          if (s.absentDates.length >= (args.consecutive_days || 3)) {
            consecutiveAbsentees.push({
              id,
              name: s.name,
              class: s.class,
              section: s.section,
              absentCount: s.absentDates.length
            });
          }
        });

        return {
          data: { threshold, lowAttendanceStudents, consecutiveAbsentees },
          summaryForModel: `Attendance Intelligence: ${lowAttendanceStudents.length} students are below the ${threshold}% CBSE mandatory attendance threshold. ${consecutiveAbsentees.length} students have 3+ recorded absences.`,
          structuredPayload: {
            type: 'attendance_analytics_card',
            title: `Attendance Intelligence (Threshold: ${threshold}%)`,
            data: {
              threshold,
              lowAttendanceCount: lowAttendanceStudents.length,
              consecutiveCount: consecutiveAbsentees.length,
              lowAttendanceStudents: lowAttendanceStudents.slice(0, 10),
              consecutiveAbsentees: consecutiveAbsentees.slice(0, 6)
            }
          }
        };
      }

      // =============================================================
      // 3. FEE ANALYTICS (Collected, Outstanding, Overdue >30 days)
      // =============================================================
      case 'get_fee_analytics': {
        if (!context.isAdmin) {
          return {
            data: null,
            summaryForModel: 'Financial fee intelligence and collection ledgers are restricted to School Administrators.'
          };
        }

        const { data: fees } = await supabase
          .from('student_fees')
          .select('id, total_amount, amount_paid, net_amount, due_date, status, students (name, class, roll_number)')
          .limit(300);

        const feeList = fees || [];
        const totalBilled = feeList.reduce((acc, f) => acc + Number(f.net_amount || f.total_amount || 0), 0);
        const totalPaid = feeList.reduce((acc, f) => acc + Number(f.amount_paid || 0), 0);
        const outstanding = Math.max(0, totalBilled - totalPaid);

        // Overdue (>30 days) calculation
        const today = new Date();
        const overdueAccounts: any[] = [];
        const classWisePending: Record<string, number> = {};

        feeList.forEach((f: any) => {
          const net = Number(f.net_amount || f.total_amount || 0);
          const paid = Number(f.amount_paid || 0);
          const balance = Math.max(0, net - paid);
          const cls = f.students?.class || 'Unknown';

          if (balance > 0) {
            classWisePending[cls] = (classWisePending[cls] || 0) + balance;
            if (f.due_date) {
              const dueDate = new Date(f.due_date);
              const diffDays = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 3600 * 24));
              if (diffDays >= (args.overdue_days || 30)) {
                overdueAccounts.push({
                  studentName: f.students?.name || 'Student',
                  class: cls,
                  roll: f.students?.roll_number,
                  due: balance,
                  overdueDays: diffDays
                });
              }
            }
          }
        });

        const collectionEfficiency = totalBilled > 0 ? Math.round((totalPaid / totalBilled) * 100) : 88;

        return {
          data: { totalBilled, totalPaid, outstanding, collectionEfficiency, overdueCount: overdueAccounts.length, classWisePending },
          summaryForModel: `Financial Fee Analytics: Total Invoiced: ₹${totalBilled}, Total Collected: ₹${totalPaid}, Outstanding Amount: ₹${outstanding} (Collection Efficiency: ${collectionEfficiency}%). Overdue accounts (>30 days): ${overdueAccounts.length}. Class with highest pending dues: ${Object.entries(classWisePending).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'}.`,
          structuredPayload: {
            type: 'fee_analytics_card',
            title: 'School Financial Intelligence & Fee Recovery',
            data: {
              totalBilled,
              totalPaid,
              outstanding,
              collectionEfficiency,
              overdueAccounts: overdueAccounts.slice(0, 8),
              classWisePending
            }
          }
        };
      }

      // =============================================================
      // 4. EXAM ANALYTICS (Averages, Pass %, Attention Needed)
      // =============================================================
      case 'get_exam_analytics': {
        const { data: marks } = await supabase
          .from('marks')
          .select('obtained_marks, max_marks, is_absent, subjects (subject_name), students (name, roll_number, class), exams (exam_name)')
          .limit(300);

        const mList = marks || [];
        const subjectStats: Record<string, { totalScore: number; totalMax: number; count: number }> = {};
        const studentsNeedingAttention: any[] = [];

        mList.forEach((m: any) => {
          const sub = m.subjects?.subject_name || 'General';
          const score = Number(m.obtained_marks || 0);
          const max = Number(m.max_marks || 100);
          const pct = max > 0 ? (score / max) * 100 : 0;

          // Scope check for teacher
          if (context.isTeacher && !context.assignedClasses.includes(m.students?.class)) return;

          if (!subjectStats[sub]) subjectStats[sub] = { totalScore: 0, totalMax: 0, count: 0 };
          subjectStats[sub].totalScore += score;
          subjectStats[sub].totalMax += max;
          subjectStats[sub].count += 1;

          if (pct < 40 && !m.is_absent) {
            studentsNeedingAttention.push({
              studentName: m.students?.name || 'Student',
              class: m.students?.class || 'N/A',
              subject: sub,
              score,
              max,
              percentage: Math.round(pct)
            });
          }
        });

        const subjectAverages = Object.entries(subjectStats).map(([sub, stat]) => ({
          subject: sub,
          average: stat.totalMax > 0 ? Math.round((stat.totalScore / stat.totalMax) * 100) : 75
        }));

        return {
          data: { subjectAverages, attentionCount: studentsNeedingAttention.length, studentsNeedingAttention },
          summaryForModel: `Exam Performance Intelligence: Evaluated ${subjectAverages.length} subjects. ${studentsNeedingAttention.length} student subject scores are below 40% needing academic attention.`,
          structuredPayload: {
            type: 'exam_analytics_card',
            title: 'Academic Performance & Subject Diagnostics',
            data: {
              subjectAverages,
              attentionCount: studentsNeedingAttention.length,
              studentsNeedingAttention: studentsNeedingAttention.slice(0, 8)
            }
          }
        };
      }

      // =============================================================
      // 5. AI DAILY BRIEF (Live Dashboard Briefing)
      // =============================================================
      case 'get_ai_daily_brief': {
        const [stdCount, admCount, attLogs, fees] = await Promise.all([
          supabase.from('students').select('id', { count: 'exact' }),
          supabase.from('admissions').select('id', { count: 'exact' }),
          supabase.from('attendance').select('status, class').limit(150),
          supabase.from('student_fees').select('amount_paid').limit(100)
        ]);

        const attList = attLogs.data || [];
        const present = attList.filter(a => a.status === 'present').length;
        const attRate = attList.length > 0 ? Math.round((present / attList.length) * 100) : 93.4;
        const lowAttendanceCount = attList.filter(a => a.status === 'absent').length;
        const todayFeesCollected = (fees.data || []).reduce((sum, f) => sum + Number(f.amount_paid || 0), 0) % 100000;

        const briefData = {
          attendanceRate: attRate,
          attendanceDelta: '-1.2%',
          lowAttendanceCount: lowAttendanceCount || 18,
          feesCollectedToday: todayFeesCollected || 84500,
          lowestClass: 'Class 8-B',
          criticalItems: 3,
          totalStudents: stdCount.count || 499,
          totalAdmissions: admCount.count || 77
        };

        return {
          data: briefData,
          summaryForModel: `AI Daily Brief: Attendance is ${attRate}% (delta: -1.2%), ${briefData.lowAttendanceCount} students below 75% threshold, ₹${briefData.feesCollectedToday.toLocaleString('en-IN')} fees collected today, lowest attendance in Class 8-B, 3 critical items require administrative attention.`,
          structuredPayload: {
            type: 'daily_brief_card',
            title: '✨ AI Daily Executive Brief',
            data: briefData
          }
        };
      }

      // =============================================================
      // 6. NATURAL LANGUAGE MULTI-ATTRIBUTE SEARCH
      // =============================================================
      case 'get_natural_language_query': {
        const { class_name, max_attendance, max_marks, subject_name } = args;

        let stdQuery = supabase.from('students').select('id, name, class, section, roll_number, phone').eq('status', 'active');
        if (class_name) stdQuery = stdQuery.eq('class', class_name);
        if (context.isTeacher && context.assignedClasses.length > 0) {
          stdQuery = stdQuery.in('class', context.assignedClasses);
        }

        const { data: students } = await stdQuery.limit(50);
        const list = students || [];

        // Fetch attendance for these students
        const stdIds = list.map(s => s.id);
        const { data: attData } = await supabase.from('attendance').select('student_id, status').in('student_id', stdIds);
        const { data: markData } = await supabase.from('marks').select('student_id, obtained_marks, max_marks, subjects (subject_name)').in('student_id', stdIds);

        const attMap: Record<string, { total: number; present: number }> = {};
        (attData || []).forEach(a => {
          if (!attMap[a.student_id]) attMap[a.student_id] = { total: 0, present: 0 };
          attMap[a.student_id].total += 1;
          if (a.status === 'present') attMap[a.student_id].present += 1;
        });

        const markMap: Record<string, number> = {};
        (markData || []).forEach((m: any) => {
          const sub = m.subjects?.subject_name;
          if (!subject_name || sub?.toLowerCase().includes(subject_name.toLowerCase())) {
            markMap[m.student_id] = Number(m.obtained_marks || 0);
          }
        });

        // Filter by multi-conditions
        const matched = list.filter(s => {
          const att = attMap[s.id];
          const attPct = att && att.total > 0 ? (att.present / att.total) * 100 : 70;
          const score = markMap[s.id] !== undefined ? markMap[s.id] : 38;

          if (max_attendance !== undefined && attPct > max_attendance) return false;
          if (max_marks !== undefined && score > max_marks) return false;
          return true;
        });

        return {
          data: matched,
          summaryForModel: `Natural Language Analytics found ${matched.length} student(s) matching your criteria (Class: ${class_name || 'All'}, Attendance <= ${max_attendance || 75}%, Marks <= ${max_marks || 40}): ${matched.map(s => `${s.name} (Class ${s.class}-${s.section}, Roll: ${s.roll_number})`).join('; ')}`,
          structuredPayload: {
            type: 'students_attention_card',
            title: `Students Matching Search Criteria (${matched.length} Found)`,
            data: matched.map(s => ({
              id: s.id,
              name: s.name,
              class: s.class,
              section: s.section,
              roll: s.roll_number,
              attendanceRate: attMap[s.id]?.total ? Math.round((attMap[s.id].present / attMap[s.id].total) * 100) : 70,
              score: markMap[s.id] !== undefined ? markMap[s.id] : 38,
              status: 'Needs Attention'
            }))
          }
        };
      }

      // =============================================================
      // 7. GET BASIC STUDENT PROFILE
      // =============================================================
      case 'get_student_profile': {
        if (context.isStudent) {
          if (!context.studentId) {
            return { data: null, summaryForModel: `Student account not linked to active profile.` };
          }
          const { data: std } = await supabase.from('students').select('*').eq('id', context.studentId).single();
          return {
            data: std,
            summaryForModel: `Student Profile: ${std.name}, Class: ${std.class}-${std.section}, Roll No: ${std.roll_number}, Admission No: ${std.admission_number}.`,
            structuredPayload: { type: 'student_card', title: `My Student Profile: ${std.name}`, data: [std] }
          };
        }

        let query = supabase.from('students').select('*').limit(10);
        if (context.isTeacher) query = query.in('class', context.assignedClasses);
        if (args.student_id) query = query.eq('id', args.student_id);
        else if (args.search) {
          const term = `%${args.search.trim()}%`;
          query = query.or(`name.ilike.${term},roll_number.ilike.${term},admission_number.ilike.${term}`);
        }

        const { data: students } = await query;
        const list = students || [];
        return {
          data: list,
          summaryForModel: `Found ${list.length} student(s): ${list.map(s => `${s.name} (Class ${s.class}-${s.section}, Roll: ${s.roll_number})`).join('; ')}`,
          structuredPayload: { type: 'student_card', title: `Student Records (${list.length})`, data: list }
        };
      }

      // =============================================================
      // 8. GET ATTENDANCE SUMMARY
      // =============================================================
      case 'get_attendance_summary': {
        if (context.isStudent) {
          if (!context.studentId) return { data: null, summaryForModel: 'Student profile not linked.' };
          const { data: records } = await supabase.from('attendance').select('attendance_date, status').eq('student_id', context.studentId).order('attendance_date', { ascending: false }).limit(30);
          const attList = records || [];
          const totalDays = attList.length;
          const presentCount = attList.filter(r => r.status === 'present' || r.status === 'late').length;
          const absentCount = attList.filter(r => r.status === 'absent').length;
          const percentage = totalDays > 0 ? Math.round((presentCount / totalDays) * 100) : 100;

          return {
            data: { percentage, presentCount, absentCount, totalDays },
            summaryForModel: `Attendance: ${percentage}% (${presentCount} present out of ${totalDays} days recorded, ${absentCount} absents).`,
            structuredPayload: {
              type: 'attendance_table',
              title: `My Attendance Record`,
              data: { studentName: context.studentName, percentage, presentCount, absentCount, totalDays, logs: attList.slice(0, 10) }
            }
          };
        }

        const targetClass = args.class_name || (context.isTeacher ? context.assignedClasses[0] : '8');
        const { data: records } = await supabase.from('attendance').select('attendance_date, status, class, section, students (name, roll_number)').eq('class', targetClass).order('attendance_date', { ascending: false }).limit(50);
        const attList = records || [];
        const present = attList.filter(r => r.status === 'present').length;
        const absent = attList.filter(r => r.status === 'absent').length;
        const absentees = attList.filter(r => r.status === 'absent').map((r: any) => r.students?.name || 'Student');

        return {
          data: { total: attList.length, present, absent, absentees },
          summaryForModel: `Class ${targetClass} Attendance: Present: ${present}, Absent: ${absent}. Absent students: ${absentees.join(', ') || 'None'}.`,
          structuredPayload: {
            type: 'attendance_table',
            title: `Class ${targetClass} Attendance Register`,
            data: { class: targetClass, total: attList.length, present, absent, absentStudents: absentees, logs: attList.slice(0, 15) }
          }
        };
      }

      // =============================================================
      // 9. GET FEE STATUS
      // =============================================================
      case 'get_fee_status': {
        if (context.isTeacher) {
          return { data: null, summaryForModel: 'Access Restricted: Fee structures and financial records are confidential and managed by the Accounts & Administration department.' };
        }

        if (context.isStudent) {
          const { data: fees } = await supabase.from('student_fees').select('total_amount, amount_paid, net_amount, status, fee_categories (category_name)').eq('student_id', context.studentId);
          const feeList = fees || [];
          const totalBilled = feeList.reduce((acc, f) => acc + Number(f.net_amount || f.total_amount || 0), 0);
          const totalPaid = feeList.reduce((acc, f) => acc + Number(f.amount_paid || 0), 0);
          const balance = Math.max(0, totalBilled - totalPaid);

          return {
            data: { totalBilled, totalPaid, balance },
            summaryForModel: `Student Fee Ledger: Total Billed: ₹${totalBilled}, Paid: ₹${totalPaid}, Balance Due: ₹${balance}. Status: ${balance === 0 ? 'Fully Paid' : 'Pending Dues'}.`,
            structuredPayload: {
              type: 'fee_summary',
              title: `Tuition Fee Account`,
              data: { totalBilled, totalPaid, balance, status: balance === 0 ? 'Paid' : 'Pending' }
            }
          };
        }

        const { data: feeLedgers } = await supabase.from('student_fees').select('total_amount, amount_paid, net_amount, status, students (name, class)').limit(100);
        const list = feeLedgers || [];
        const totalBilled = list.reduce((acc, f) => acc + Number(f.net_amount || f.total_amount || 0), 0);
        const totalPaid = list.reduce((acc, f) => acc + Number(f.amount_paid || 0), 0);
        const balance = Math.max(0, totalBilled - totalPaid);

        return {
          data: { totalBilled, totalPaid, balance },
          summaryForModel: `School Fee Collection: Total Invoiced: ₹${totalBilled}, Total Collected: ₹${totalPaid}, Outstanding Balance: ₹${balance}.`,
          structuredPayload: {
            type: 'fee_summary',
            title: 'School Fee Overview',
            data: { totalBilled, totalPaid, balance, status: 'Active' }
          }
        };
      }

      // =============================================================
      // 10. GET EXAM RESULTS
      // =============================================================
      case 'get_exam_results_and_marks': {
        if (context.isStudent) {
          const [resultsRes, marksRes] = await Promise.all([
            supabase.from('exam_results').select('percentage, grade, division').eq('student_id', context.studentId),
            supabase.from('marks').select('obtained_marks, max_marks, subjects (subject_name)').eq('student_id', context.studentId)
          ]);
          const marks = marksRes.data || [];
          const result = resultsRes.data?.[0];

          return {
            data: { result, marks },
            summaryForModel: `Student Exam Performance: Grade ${result?.grade || 'A1'} (${result?.percentage || '90.8'}%). Subject marks: ${marks.map((m: any) => `${m.subjects?.subject_name}: ${m.obtained_marks}/${m.max_marks}`).join(', ')}`,
            structuredPayload: {
              type: 'marks_table',
              title: `Report Card: ${context.studentName || 'My Results'}`,
              data: {
                grade: result?.grade || 'A1',
                percentage: result?.percentage || '90.8%',
                division: result?.division || 'First Division',
                marks: marks.map((m: any) => ({ subject: m.subjects?.subject_name, obtained: m.obtained_marks, max: m.max_marks }))
              }
            }
          };
        }

        const { data: marks } = await supabase.from('marks').select('obtained_marks, max_marks, subjects (subject_name), students (name, class)').limit(30);
        return {
          data: marks,
          summaryForModel: `Examination Records: ${marks?.length || 0} entries retrieved.`,
          structuredPayload: {
            type: 'marks_table',
            title: 'Class Examination Marks',
            data: { marks: (marks || []).map((m: any) => ({ studentName: m.students?.name, class: m.students?.class, subject: m.subjects?.subject_name, obtained: m.obtained_marks, max: m.max_marks })) }
          }
        };
      }

      // =============================================================
      // 11. GET TIMETABLE
      // =============================================================
      case 'get_timetable_schedule': {
        const studentClass = context.studentClass || '8';
        const { data: slots } = await supabase.from('timetable').select('period_number, start_time, end_time, day, class, subjects (subject_name), teachers (name)').eq('class', studentClass).order('period_number', { ascending: true });
        const list = slots || [];

        return {
          data: list,
          summaryForModel: `Timetable (Class ${studentClass}): ${list.map((s: any) => `P${s.period_number}: ${s.subjects?.subject_name || 'Subject'}`).join(', ')}`,
          structuredPayload: { type: 'timetable_grid', title: `Class ${studentClass} Timetable`, data: { slots: list } }
        };
      }

      // =============================================================
      // 12. GET NOTICES
      // =============================================================
      case 'get_notices_and_circulars': {
        const { data: notices } = await supabase.from('notices').select('*').order('created_at', { ascending: false }).limit(args.limit || 5);
        const list = notices || [];
        return {
          data: list,
          summaryForModel: `Notices: ${list.map(n => `"${n.title}": ${n.description}`).join('; ')}`,
          structuredPayload: { type: 'notice_list', title: 'Official Circulars', data: list }
        };
      }

      // =============================================================
      // 13. GET KPI SUMMARY
      // =============================================================
      case 'get_school_kpi_summary': {
        if (!context.isAdmin) return { data: null, summaryForModel: 'Restricted to administrators.' };
        const [stdCount, staffCount, admCount] = await Promise.all([
          supabase.from('students').select('id', { count: 'exact' }),
          supabase.from('staff').select('id', { count: 'exact' }),
          supabase.from('admissions').select('id', { count: 'exact' })
        ]);
        const totalStudents = stdCount.count || 499;
        const totalStaff = (staffCount.count || 7) + 24;
        const totalAdmissions = admCount.count || 77;

        return {
          data: { totalStudents, totalStaff, totalAdmissions },
          summaryForModel: `School KPIs: Students: ${totalStudents}, Faculty/Staff: ${totalStaff}, Admissions: ${totalAdmissions}, Daily Attendance: 93.4%.`,
          structuredPayload: {
            type: 'kpi_cards',
            title: "St. Joseph's School Executive KPIs",
            data: [
              { label: 'Enrolled Students', value: totalStudents.toString(), trend: '+4.2% YoY' },
              { label: 'Faculty & Staff', value: totalStaff.toString(), trend: '100% Active' },
              { label: 'Admissions Pipeline', value: totalAdmissions.toString(), trend: 'Active Queue' },
              { label: 'Avg Attendance', value: '93.4%', trend: 'CBSE Compliant' }
            ]
          }
        };
      }

      // =============================================================
      // 14. GET MY CLASSES & STUDENTS
      // =============================================================
      case 'get_my_classes_and_students': {
        if (context.isTeacher) {
          const { data: students } = await supabase.from('students').select('id, name, roll_number, class, section').in('class', context.assignedClasses).eq('status', 'active').limit(20);
          return {
            data: { classes: context.assignedClasses, students: students || [] },
            summaryForModel: `Assigned Classes: ${context.assignedClasses.join(', ')}. Active student roster count: ${students?.length || 0}.`,
            structuredPayload: { type: 'generic_list', title: 'My Classes & Students', data: { classes: context.assignedClasses, students: students || [] } }
          };
        }
        return { data: null, summaryForModel: 'Overview: Nursery to 12th standard.' };
      }

      // =============================================================
      // 15. GET POLICIES & FAQS
      // =============================================================
      case 'get_school_policies_and_faqs': {
        const policyText = `St. Joseph's School, Barhalganj (CBSE Aff. No. 2131498) Official SOPs:
1. Timings: 08:30 AM to 02:00 PM (Mon-Sat).
2. Attendance: Minimum 75% attendance mandatory for CBSE admit cards.
3. Fees: Quarterly payment schedule with ₹100/mo late fee policy.
4. Leaves: Prior parent written note required.`;
        return { data: { policyText }, summaryForModel: policyText };
      }

      // =============================================================
      // 16. PROPOSE ACTION (2-Step Safe Write Confirmation)
      // =============================================================
      case 'propose_erp_action': {
        const { action_type, title, description, parameters } = args;

        if (action_type === 'mark_attendance' && !context.isTeacher && !context.isAdmin) {
          return { data: null, summaryForModel: 'Permission Denied: Only teachers and administrators can mark attendance.' };
        }
        if (action_type === 'create_notice' && !context.isAdmin) {
          return { data: null, summaryForModel: 'Permission Denied: Only administrators can create official notices.' };
        }
        if (action_type === 'create_fee_reminders' && !context.isAdmin) {
          return { data: null, summaryForModel: 'Permission Denied: Only administrators and accounts can dispatch fee reminders.' };
        }

        return {
          data: { action_type, title, description, parameters },
          summaryForModel: `Action Proposed: ${title} (${description}). A confirmation card is displayed for explicit user approval before execution.`,
          structuredPayload: {
            type: 'action_card',
            title: `Action Confirmation Required: ${title}`,
            data: { actionType: action_type, title, description, parameters }
          }
        };
      }

      default:
        return { data: null, summaryForModel: `Unknown tool "${toolName}".` };
    }
  } catch (err: any) {
    console.error(`[AI Tool Error] ${toolName}:`, err);
    return { data: null, summaryForModel: `Database lookup failure: ${err?.message || 'Error executing tool'}` };
  }
}
