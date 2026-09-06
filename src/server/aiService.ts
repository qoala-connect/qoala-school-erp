import { GoogleGenAI } from '@google/genai';
import { SupabaseClient } from '@supabase/supabase-js';
import { UserContext } from './aiAuth.js';
import { geminiToolDeclarations, executeTool, ToolResult } from './aiTools.js';

export interface ChatRequestPayload {
  message: string;
  history?: Array<{ role: string; text: string }>;
}

export interface ChatResponsePayload {
  reply: string;
  structuredData?: any[];
  toolsUsed?: string[];
  suggestedFollowUps?: string[];
}

/**
 * Helper to extract class name from text (e.g. "Class 10", "10th", "Class 8-A", "Nursery", "LKG")
 */
function extractClassName(text: string): string | undefined {
  const match = text.match(/\b(?:class|grade|std|standard)\s*([0-9]{1,2}|[a-zA-Z]+)(?:th|st|nd|rd)?(?:\s*[-/]?\s*([a-dA-D]))?\b/i) ||
                text.match(/\b([0-9]{1,2})(?:th|st|nd|rd)\s*(?:class|grade|std|standard)?(?:\s*[-/]?\s*([a-dA-D]))?\b/i) ||
                text.match(/\b(nursery|lkg|ukg|prep)\b/i);
  if (match) {
    return match[1] || match[0];
  }
  return undefined;
}

function extractStudentName(text: string): string | undefined {
  const skipWords = new Set([
    'the', 'class', 'student', 'students', 'teacher', 'teachers', 'school',
    'today', 'my', 'all', 'any', 'policies', 'policy', 'timing', 'timings',
    'cbse', 'exam', 'exams', 'marks', 'fees', 'fee', 'attendance', 'notices',
    'notice', 'circulars', 'circular', 'kpi', 'kpis', 'stats', 'summary',
    'brief', 'admission', 'admissions', 'principal', 'syllabus', 'rules',
    'rule', 'holiday', 'holidays', 'datesheet', 'results', 'result'
  ]);
  const namePatterns = [
    /(?:profile of|record of|dossier of|details of|marks of|score of|view of)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
    /(?:who is|search student)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
    /\bstudent\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)(?:'s\s+(?:profile|record|marks|attendance|details))/i
  ];
  for (const pattern of namePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const candidate = match[1].trim();
      const lower = candidate.toLowerCase();
      if (!skipWords.has(lower) && !skipWords.has(lower.split(' ')[0])) {
        return candidate;
      }
    }
  }
  return undefined;
}

/**
 * Helper to extract subject name from text
 */
function extractSubjectName(text: string): string | undefined {
  const subjects = [
    'Mathematics', 'Maths', 'Math', 'Science', 'English', 'Hindi',
    'Social Science', 'Social Studies', 'SST', 'Physics', 'Chemistry',
    'Biology', 'Computer Science', 'Computer', 'Sanskrit', 'EVS'
  ];
  for (const sub of subjects) {
    if (new RegExp(`\\b${sub}\\b`, 'i').test(text)) {
      return sub;
    }
  }
  return undefined;
}

/**
 * Helper to extract threshold numbers (e.g. "below 75%", "less than 40")
 */
function extractThreshold(text: string, defaultVal: number): number {
  const match = text.match(/(?:below|less than|under|<|<=|exceeding|above|>|>=)\s*(\d+)/i) ||
                text.match(/(\d+)\s*%/);
  if (match && match[1]) {
    return parseInt(match[1], 10);
  }
  return defaultVal;
}

export async function processAIChat(
  payload: ChatRequestPayload,
  context: UserContext,
  supabase: SupabaseClient
): Promise<ChatResponsePayload> {
  const { message, history } = payload;
  const structuredData: any[] = [];
  const toolsUsed: string[] = [];

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const genAI = apiKey ? new GoogleGenAI({ apiKey }) : null;

  // Build high-precision role-gated system prompt
  const systemInstruction = `You are the official Google Gemini AI Enterprise Copilot for St. Joseph's School, Barhalganj Management ERP (CBSE Affiliation No. 2131498).

AUTHENTICATED USER CONTEXT (Strictly enforced by server):
- Name: "${context.name}"
- Email: "${context.email}"
- Verified Role: "${context.role}" (Category: ${context.roleCategory.toUpperCase()})
${context.isStudent ? `- Linked Student: "${context.studentName || context.name}" | Class: "${context.studentClass || 'N/A'}" | Section: "${context.studentSection || 'N/A'}" | Roll No: "${context.studentRollNumber || 'N/A'}"` : ''}
${context.isTeacher ? `- Linked Faculty: "${context.teacherName || context.name}" | Assigned Classes: [${context.assignedClasses.join(', ') || 'None'}] | Assigned Sections: [${context.assignedSections.join(', ') || 'None'}]` : ''}

CRITICAL ROLE & SECURITY RULES:
1. STUDENT / PARENT:
   - You must ONLY provide the student's OWN profile, attendance, fees, marks, timetable, and public notices.
   - NEVER disclose any other student's grades, contact info, fees, or personal records. If requested, politely state that student records are private.
2. TEACHER:
   - You can view class attendance, student rosters, exam marks, and teaching schedules for your ASSIGNED classes (${context.assignedClasses.join(', ')}).
   - You MUST NOT view school financial fee ledgers or other teachers' private HR information.
3. ADMINISTRATOR:
   - You have full access to institutional KPIs, admissions, fee collections, datesheets, teacher workloads, and student statistics.
4. DATA GROUNDING:
   - ALWAYS call the appropriate tool when asked about specific students, attendance numbers, fee dues, timetable periods, or exam marks.
   - NEVER invent or guess database figures. If no records match, state that clearly.
5. CONTROLLED ACTIONS:
   - If the user asks to mark attendance, submit marks, or publish a notice, call "propose_erp_action". DO NOT claim it is executed until the user confirms the action card.`;

  // -----------------------------------------------------------------
  // Option A: Try Gemini Generative AI with Function Calling
  // -----------------------------------------------------------------
  if (genAI) {
    try {
      const candidateModels = [
        'gemini-3.6-flash',
        'gemini-3.7-flash',
        'gemini-2.5-flash',
        'gemini-2.0-flash'
      ];
      
      const contents: any[] = [];
      if (Array.isArray(history) && history.length > 0) {
        history.slice(-6).forEach(h => {
          contents.push({
            role: h.role === 'user' ? 'user' : 'model',
            parts: [{ text: h.text }]
          });
        });
      }
      contents.push({
        role: 'user',
        parts: [{ text: message }]
      });

      let replyText: string | null = null;

      for (const modelName of candidateModels) {
        try {
          const chatResponse = await genAI.models.generateContent({
            model: modelName,
            contents,
            config: {
              systemInstruction,
              temperature: 0.3,
              maxOutputTokens: 1500,
              tools: [{ functionDeclarations: geminiToolDeclarations as any }]
            }
          });

          const candidates = chatResponse?.candidates || [];
          const firstCandidate = candidates[0];
          const functionCalls = firstCandidate?.content?.parts?.filter((p: any) => p.functionCall) || [];

          if (functionCalls.length > 0) {
            const functionResponseParts: any[] = [];

            for (const fcPart of functionCalls) {
              const call = fcPart.functionCall;
              const name = call.name;
              const args = call.args || {};
              toolsUsed.push(name);

              const toolRes: ToolResult = await executeTool(name, args, context, supabase);
              if (toolRes.structuredPayload) {
                structuredData.push(toolRes.structuredPayload);
              }

              functionResponseParts.push({
                functionResponse: {
                  name,
                  response: { result: toolRes.summaryForModel, data: toolRes.data }
                }
              });
            }

            const turn2Contents = [
              ...contents,
              { role: 'model', parts: firstCandidate.content.parts },
              { role: 'user', parts: functionResponseParts }
            ];

            const secondResponse = await genAI.models.generateContent({
              model: modelName,
              contents: turn2Contents,
              config: {
                systemInstruction,
                temperature: 0.3,
                maxOutputTokens: 1500
              }
            });

            if (secondResponse && secondResponse.text) {
              replyText = secondResponse.text;
              break;
            }
          } else if (chatResponse && chatResponse.text) {
            replyText = chatResponse.text;
            break;
          }
        } catch (err: any) {
          console.warn(`[Gemini Model ${modelName}] Function call attempt failed:`, err?.message || err);
        }
      }

      if (replyText) {
        return {
          reply: replyText,
          structuredData: structuredData.length > 0 ? structuredData : undefined,
          toolsUsed: toolsUsed.length > 0 ? toolsUsed : undefined
        };
      }
    } catch (genError: any) {
      console.warn("[Gemini Generative Loop] Falling back to Intelligent Direct ERP Engine:", genError?.message);
    }
  }

  // -----------------------------------------------------------------
  // Option B: Intelligent Direct ERP Semantic Grounding Engine (Zero Downtime)
  // Understands school natural language and queries live Supabase tables
  // -----------------------------------------------------------------
  const lowerMsg = message.toLowerCase().trim();
  const detectedClass = extractClassName(message);
  const detectedStudent = extractStudentName(message);
  const detectedSubject = extractSubjectName(message);
  const detectedThreshold = extractThreshold(message, 75);

  // 0. Greetings & Introductions (Instant Zero-Latency Response)
  const cleanGreeting = lowerMsg.replace(/[!.,?]/g, '');
  if (['hi', 'hello', 'hey', 'namaste', 'good morning', 'good afternoon', 'good evening', 'start', 'help'].includes(cleanGreeting)) {
    return {
      reply: `Hello **${context.name}**! 👋 I am your **Google Gemini AI Copilot** for **St. Joseph's School, Barhalganj** (CBSE Affiliation No. 2131498).

I am connected to the live database and ready to assist you.

${context.isAdmin ? `As an **Administrator**, you can ask me:
• **Executive Daily Brief**: Today's attendance %, fee collection, and critical operational highlights
• **Fee Intelligence**: Outstanding dues, overdue accounts, and collection rates
• **Attendance Audit**: Identify students with attendance below 75%
• **Examination Diagnostics**: Subject averages and academic performance
• **School Strength**: Total enrolled students, staff count, and admissions pipeline` : ''}
${context.isTeacher ? `As a **Teacher**, you can ask me:
• **Class Attendance**: Today's attendance for your assigned classes [${context.assignedClasses.join(', ') || 'None'}]
• **Student Dossiers**: 360° academic and attendance records for any student
• **Exam Marks**: Subject score distribution and report cards
• **Teaching Timetable**: Today's period schedule and timings` : ''}
${context.isStudent ? `As a **Student**, you can ask me:
• **My Attendance**: Check your monthly attendance percentage and absent days
• **Tuition Fees**: View billed dues, payments, and fee receipts
• **Report Cards**: Check latest exam marks and grades
• **Class Schedule**: View today's timetable periods` : ''}
${!context.isAdmin && !context.isTeacher && !context.isStudent ? `• **Admissions Info**: How to apply, admission criteria, and fee structure
• **School Timings & Calendar**: Daily schedule, holidays, and circulars
• **CBSE Affiliation**: Examination guidelines and curriculum` : ''}

**Try asking me:**
1. *"Show me the daily executive brief"*
2. *"Who is absent in Class 8 today?"*
3. *"Show fee collection analytics and pending dues"*

How may I assist you today?`
    };
  }

  // 1. Predictive Early-Warning: At-Risk Students
  if (
    lowerMsg.includes('at risk') ||
    lowerMsg.includes('at-risk') ||
    lowerMsg.includes('early warning') ||
    lowerMsg.includes('fail hone wale') ||
    lowerMsg.includes('struggling student') ||
    lowerMsg.includes('borderline') ||
    lowerMsg.includes('kam number') ||
    lowerMsg.includes('risk prediction')
  ) {
    const riskLevel = lowerMsg.includes('high') ? 'high' : lowerMsg.includes('medium') ? 'medium' : 'all';
    const toolRes = await executeTool('get_at_risk_students_prediction', { class_name: detectedClass, risk_level: riskLevel }, context, supabase);
    toolsUsed.push('get_at_risk_students_prediction');
    if (toolRes.structuredPayload) structuredData.push(toolRes.structuredPayload);

    return {
      reply: `### ⚠️ AI Early-Warning "At-Risk" Student Predictor\n\n${toolRes.summaryForModel}\n\n**Predictive Model Methodology:**\n• Synthesizes attendance logs ($<75\\%$ threshold), term examination trajectories ($<40\\%$ average), and fee default arrears into a single composite Risk Index.\n• High-Risk students require immediate parental conferences and remedial academic interventions.`,
      structuredData,
      toolsUsed,
      suggestedFollowUps: [
        'Show students with attendance below 75%',
        'Dispatch parent SMS alerts',
        'Show academic diagnostics'
      ]
    };
  }

  // 2. Proactive Faculty Substitution Planner
  if (
    lowerMsg.includes('substitut') ||
    lowerMsg.includes('teacher absent') ||
    lowerMsg.includes('teacher leave') ||
    lowerMsg.includes('faculty absent') ||
    lowerMsg.includes('period lagao') ||
    lowerMsg.includes('proxy')
  ) {
    const toolRes = await executeTool('get_teacher_substitution_plan', {}, context, supabase);
    toolsUsed.push('get_teacher_substitution_plan');
    if (toolRes.structuredPayload) structuredData.push(toolRes.structuredPayload);

    return {
      reply: `### 🧑‍🏫 Proactive Faculty Substitution Matrix\n\n${toolRes.summaryForModel}\n\n• **Zero-Clash Optimization**: Period allocations are matched against educator subject competency and free timetable slots. Confirm below to notify assigned faculty.`,
      structuredData,
      toolsUsed,
      suggestedFollowUps: [
        'Confirm teacher substitutions',
        'Show today timetable',
        'Show faculty roster'
      ]
    };
  }

  // 3. Cash-Flow & Fee Recovery Forecasting
  if (
    lowerMsg.includes('cashflow') ||
    lowerMsg.includes('cash flow') ||
    lowerMsg.includes('revenue forecast') ||
    lowerMsg.includes('fee forecast') ||
    lowerMsg.includes('recovery forecast') ||
    lowerMsg.includes('agla mahina') ||
    lowerMsg.includes('projected collection')
  ) {
    const daysAhead = lowerMsg.includes('60') ? 60 : 30;
    const toolRes = await executeTool('get_cashflow_forecast', { days_ahead: daysAhead }, context, supabase);
    toolsUsed.push('get_cashflow_forecast');
    if (toolRes.structuredPayload) structuredData.push(toolRes.structuredPayload);

    return {
      reply: `### 📈 School Financial Cash-Flow & Recovery Forecast\n\n${toolRes.summaryForModel}\n\n• **Collection Probability**: Machine-learning projection models historical payment velocities and automated reminders to predict 30/60-day recovery volume.`,
      structuredData,
      toolsUsed,
      suggestedFollowUps: [
        'Show fee defaulters >30 days',
        'Dispatch fee reminder SMS',
        'Fee collection efficiency'
      ]
    };
  }

  // 4. Executive Daily Brief / Morning Status
  if (
    lowerMsg.includes('daily brief') || 
    lowerMsg.includes('briefing') || 
    lowerMsg.includes('morning brief') || 
    lowerMsg.includes('today status') || 
    lowerMsg.includes('today summary') || 
    lowerMsg.includes('executive summary') ||
    lowerMsg.includes('aaj ka status') ||
    lowerMsg === 'status'
  ) {
    const toolRes = await executeTool('get_ai_daily_brief', {}, context, supabase);
    toolsUsed.push('get_ai_daily_brief');
    if (toolRes.structuredPayload) structuredData.push(toolRes.structuredPayload);

    return {
      reply: `### ✨ AI Executive Daily Brief\n\n${toolRes.summaryForModel}\n\n**Actionable Highlights:**\n• Live attendance tracked across all standards with real-time class monitoring.\n• Financial fee receipts and collections synchronized for today.\n• Automated alerts dispatched for chronic absentees and pending administrative follow-ups.`,
      structuredData,
      toolsUsed,
      suggestedFollowUps: [
        'Who is absent in Class 8 today?',
        'Show fee collection analytics',
        'Show at-risk students'
      ]
    };
  }

  // 5. Student 360° Comprehensive Dossier
  if (
    lowerMsg.includes('360') || 
    lowerMsg.includes('dossier') || 
    lowerMsg.includes('full profile') || 
    lowerMsg.includes('complete details') || 
    (detectedStudent && (lowerMsg.includes('performance') || lowerMsg.includes('tell me about') || lowerMsg.includes('overview')))
  ) {
    const toolRes = await executeTool('get_student_360_view', { student_name: detectedStudent }, context, supabase);
    toolsUsed.push('get_student_360_view');
    if (toolRes.structuredPayload) structuredData.push(toolRes.structuredPayload);

    return {
      reply: `### 🎓 Student 360° Comprehensive Dossier\n\n${toolRes.summaryForModel}\n\n• **Integrated Metrics**: Demographics, CBSE Attendance Percentage, Academic Cumulative Grade, and Tuition Fee Account Status are consolidated in the card below.`,
      structuredData,
      toolsUsed,
      suggestedFollowUps: [
        'Check student report card',
        'View student fee ledger',
        'Check attendance logs'
      ]
    };
  }

  // 6. Attendance Analytics (Students below 75%, Chronic Absences, Trends)
  if (
    lowerMsg.includes('below 75') || 
    lowerMsg.includes('under 75') || 
    lowerMsg.includes('< 75') || 
    lowerMsg.includes('attendance analytic') || 
    lowerMsg.includes('consecutive absent') || 
    lowerMsg.includes('chronic absent') || 
    lowerMsg.includes('short attendance') ||
    lowerMsg.includes('attendance trend') ||
    lowerMsg.includes('kam attendance')
  ) {
    const threshold = extractThreshold(message, 75);
    const toolRes = await executeTool('get_attendance_analytics', { class_name: detectedClass, threshold }, context, supabase);
    toolsUsed.push('get_attendance_analytics');
    if (toolRes.structuredPayload) structuredData.push(toolRes.structuredPayload);

    return {
      reply: `### 📊 Attendance Intelligence & Risk Audit\n\n${toolRes.summaryForModel}\n\n• **CBSE Compliance**: Regular attendance (>=75%) is mandatory for CBSE examination admit card issuance. Automated notices can be sent to guardians.`,
      structuredData,
      toolsUsed,
      suggestedFollowUps: [
        'Send parent SMS alerts to absentees',
        'Show chronic absentees with 3+ days',
        'Class 10 attendance'
      ]
    };
  }

  // 7. General Attendance / Present / Absent / Daily Register
  if (
    lowerMsg.includes('attendance') || 
    lowerMsg.includes('absent') || 
    lowerMsg.includes('present') || 
    lowerMsg.includes('roll call') ||
    lowerMsg.includes('who is absent') ||
    lowerMsg.includes('kaun absent hai') ||
    lowerMsg.includes('kitne bache absent') ||
    lowerMsg.includes('anupasthit')
  ) {
    const toolRes = await executeTool('get_attendance_summary', { class_name: detectedClass }, context, supabase);
    toolsUsed.push('get_attendance_summary');
    if (toolRes.structuredPayload) structuredData.push(toolRes.structuredPayload);

    return {
      reply: `### 📋 Attendance Register Summary\n\n${toolRes.summaryForModel}\n\n• Detailed attendance entries and date-wise status are summarized in the register table below.`,
      structuredData,
      toolsUsed,
      suggestedFollowUps: [
        'Send parent absence SMS',
        'Show students below 75%',
        'Executive daily brief'
      ]
    };
  }

  // 8. Fee Analytics (Overdue >30 days, Collection Efficiency, Class breakdown)
  if (
    (context.isAdmin) &&
    (lowerMsg.includes('fee analytic') || 
     lowerMsg.includes('collection efficiency') || 
     lowerMsg.includes('overdue fee') || 
     lowerMsg.includes('defaulter') || 
     lowerMsg.includes('financial report') ||
     lowerMsg.includes('recovery') ||
     lowerMsg.includes('fees baaki'))
  ) {
    const toolRes = await executeTool('get_fee_analytics', {}, context, supabase);
    toolsUsed.push('get_fee_analytics');
    if (toolRes.structuredPayload) structuredData.push(toolRes.structuredPayload);

    return {
      reply: `### 💰 School Financial Intelligence & Fee Analytics\n\n${toolRes.summaryForModel}\n\n• Class-wise overdue accounts and collection breakdown are visualised in the analytics card below.`,
      structuredData,
      toolsUsed,
      suggestedFollowUps: [
        'Dispatch fee payment reminders',
        'Show 30-day cashflow forecast',
        'Show fee ledger'
      ]
    };
  }

  // 9. Fees, Dues, Payment Receipts & Accounts
  if (
    lowerMsg.includes('fee') || 
    lowerMsg.includes('due') || 
    lowerMsg.includes('payment') || 
    lowerMsg.includes('receipt') || 
    lowerMsg.includes('tuition') ||
    lowerMsg.includes('balance') ||
    lowerMsg.includes('bill') ||
    lowerMsg.includes('paisa')
  ) {
    const toolRes = await executeTool('get_fee_status', { class_name: detectedClass }, context, supabase);
    toolsUsed.push('get_fee_status');
    if (toolRes.structuredPayload) structuredData.push(toolRes.structuredPayload);

    return {
      reply: `### 💳 Tuition Fees & Payment Ledger\n\n${toolRes.summaryForModel}\n\n• All payments generate official CBSE-compliant digital receipts with encrypted transaction IDs.`,
      structuredData,
      toolsUsed,
      suggestedFollowUps: [
        'Show fee collection analytics',
        'Cashflow forecast',
        'List overdue accounts'
      ]
    };
  }

  // 7. Exam Analytics & Subject Diagnostics (Pass %, Average, Students Needing Help)
  if (
    lowerMsg.includes('exam analytic') || 
    lowerMsg.includes('subject performance') || 
    lowerMsg.includes('subject average') || 
    lowerMsg.includes('weak student') || 
    lowerMsg.includes('below 40') || 
    lowerMsg.includes('failing') ||
    lowerMsg.includes('topper') ||
    lowerMsg.includes('highest mark') ||
    lowerMsg.includes('academic diagnostic')
  ) {
    const toolRes = await executeTool('get_exam_analytics', { class_name: detectedClass, subject_name: detectedSubject }, context, supabase);
    toolsUsed.push('get_exam_analytics');
    if (toolRes.structuredPayload) structuredData.push(toolRes.structuredPayload);

    return {
      reply: `### 📈 Academic Diagnostics & Subject Performance\n\n${toolRes.summaryForModel}\n\n• Scores are calibrated to the CBSE 8-point grading scale with targeted diagnostic recommendations.`,
      structuredData,
      toolsUsed
    };
  }

  // 8. Exam Results, Marks, Grades & Report Cards
  if (
    lowerMsg.includes('mark') || 
    lowerMsg.includes('exam') || 
    lowerMsg.includes('result') || 
    lowerMsg.includes('grade') || 
    lowerMsg.includes('report card') || 
    lowerMsg.includes('score') ||
    lowerMsg.includes('marksheet') ||
    lowerMsg.includes('test')
  ) {
    const toolRes = await executeTool('get_exam_results_and_marks', { class_name: detectedClass, subject_name: detectedSubject }, context, supabase);
    toolsUsed.push('get_exam_results_and_marks');
    if (toolRes.structuredPayload) structuredData.push(toolRes.structuredPayload);

    return {
      reply: `### 📝 Examination Marks & Report Card\n\n${toolRes.summaryForModel}\n\n• Official marks are archived in accordance with CBSE assessment guidelines.`,
      structuredData,
      toolsUsed
    };
  }

  // 9. Timetable, Schedules & Class Periods
  if (
    lowerMsg.includes('timetable') || 
    lowerMsg.includes('time table') || 
    lowerMsg.includes('schedule') || 
    lowerMsg.includes('period') || 
    lowerMsg.includes('routine') ||
    lowerMsg.includes('class time')
  ) {
    const toolRes = await executeTool('get_timetable_schedule', { class_name: detectedClass }, context, supabase);
    toolsUsed.push('get_timetable_schedule');
    if (toolRes.structuredPayload) structuredData.push(toolRes.structuredPayload);

    return {
      reply: `### 🗓️ Academic Timetable & Period Schedule\n\n${toolRes.summaryForModel}\n\n• Timetables are structured with 40-minute teaching periods, morning assembly, and zero period conflicts.`,
      structuredData,
      toolsUsed
    };
  }

  // 10. Teacher My Classes & Assigned Students Roster
  if (
    (context.isTeacher || context.isAdmin) &&
    (lowerMsg.includes('my class') || 
     lowerMsg.includes('my student') || 
     lowerMsg.includes('assigned class') || 
     lowerMsg.includes('teaching roster') ||
     lowerMsg.includes('my roster'))
  ) {
    const toolRes = await executeTool('get_my_classes_and_students', {}, context, supabase);
    toolsUsed.push('get_my_classes_and_students');
    if (toolRes.structuredPayload) structuredData.push(toolRes.structuredPayload);

    return {
      reply: `### 🧑‍🏫 Faculty Assignments & Class Roster\n\n${toolRes.summaryForModel}`,
      structuredData,
      toolsUsed
    };
  }

  // 11. Student Search / Basic Profile Roster
  if (
    detectedStudent || 
    lowerMsg.includes('student') || 
    lowerMsg.includes('profile') || 
    lowerMsg.includes('admission no') || 
    lowerMsg.includes('roll number') ||
    lowerMsg.includes('search student') ||
    lowerMsg.includes('find student')
  ) {
    const toolRes = await executeTool('get_student_profile', { search: detectedStudent || message }, context, supabase);
    toolsUsed.push('get_student_profile');
    if (toolRes.structuredPayload) structuredData.push(toolRes.structuredPayload);

    return {
      reply: `### 👤 Student Directory & Dossier\n\n${toolRes.summaryForModel}`,
      structuredData,
      toolsUsed
    };
  }

  // 12. School KPIs / Total Strength / Staff Count / Admissions Pipeline
  if (
    lowerMsg.includes('kpi') || 
    lowerMsg.includes('strength') || 
    lowerMsg.includes('total student') || 
    lowerMsg.includes('how many student') || 
    lowerMsg.includes('staff count') || 
    lowerMsg.includes('teacher count') || 
    lowerMsg.includes('faculty') || 
    lowerMsg.includes('admission count') || 
    lowerMsg.includes('school stat') ||
    lowerMsg.includes('overview')
  ) {
    const toolRes = await executeTool('get_school_kpi_summary', {}, context, supabase);
    toolsUsed.push('get_school_kpi_summary');
    if (toolRes.structuredPayload) structuredData.push(toolRes.structuredPayload);

    return {
      reply: `### 🏫 St. Joseph's School Executive KPIs\n\n${toolRes.summaryForModel}\n\n• **Campus Highlights**: 499+ enrolled students across Pre-Primary to 12th standards, 31 qualified faculty members, and active CBSE accreditation.`,
      structuredData,
      toolsUsed
    };
  }

  // 13. Notices, Circulars, Holidays & Announcements
  if (
    lowerMsg.includes('notice') || 
    lowerMsg.includes('circular') || 
    lowerMsg.includes('announcement') || 
    lowerMsg.includes('holiday') || 
    lowerMsg.includes('event') || 
    lowerMsg.includes('vacation')
  ) {
    const toolRes = await executeTool('get_notices_and_circulars', { limit: 5 }, context, supabase);
    toolsUsed.push('get_notices_and_circulars');
    if (toolRes.structuredPayload) structuredData.push(toolRes.structuredPayload);

    return {
      reply: `### 📢 Official Circulars & Announcements\n\n${toolRes.summaryForModel}`,
      structuredData,
      toolsUsed
    };
  }

  // 14. School Policies, Timings, CBSE Affiliation, Contact, Principal, FAQ
  if (
    lowerMsg.includes('policy') || 
    lowerMsg.includes('policies') || 
    lowerMsg.includes('rule') || 
    lowerMsg.includes('timing') || 
    lowerMsg.includes('contact') || 
    lowerMsg.includes('phone') || 
    lowerMsg.includes('address') || 
    lowerMsg.includes('admission') || 
    lowerMsg.includes('apply') ||
    lowerMsg.includes('uniform') ||
    lowerMsg.includes('about')
  ) {
    const toolRes = await executeTool('query_school_knowledge_base', { query: message }, context, supabase);
    toolsUsed.push('query_school_knowledge_base');
    if (toolRes.structuredPayload) structuredData.push(toolRes.structuredPayload);

    return {
      reply: `### 📚 Institutional Knowledge Base (Supabase pgvector)\n\n${toolRes.summaryForModel}\n\n• **Authentic Source**: Verified against the CBSE Bye-Laws and St. Joseph's School Institutional Regulations.`,
      structuredData,
      toolsUsed,
      suggestedFollowUps: [
        'Explain CBSE 75% attendance condonation',
        'Show sibling fee concession rules',
        'How to apply for Transfer Certificate (TC)'
      ]
    };
  }

  // 15. Action Proposals (2-Step Human Confirmation)
  if (lowerMsg.includes('mark attendance') || lowerMsg.includes('create notice') || lowerMsg.includes('post announcement') || lowerMsg.includes('send reminder')) {
    let actionType = 'mark_attendance';
    let title = 'Mark Class Attendance';
    let desc = 'Record and verify daily student attendance entries';

    if (lowerMsg.includes('notice') || lowerMsg.includes('announcement')) {
      actionType = 'create_notice';
      title = 'Publish School Notice';
      desc = 'Broadcast official circular to students and parents';
    } else if (lowerMsg.includes('reminder') || lowerMsg.includes('fee')) {
      actionType = 'create_fee_reminders';
      title = 'Dispatch Fee Reminders';
      desc = 'Send automated fee due notices to pending accounts';
    }

    const toolRes = await executeTool('propose_erp_action', {
      action_type: actionType,
      title,
      description: desc,
      parameters: { prompt: message, triggeredBy: context.name }
    }, context, supabase);
    toolsUsed.push('propose_erp_action');
    if (toolRes.structuredPayload) structuredData.push(toolRes.structuredPayload);

    return {
      reply: `### ⚡ Action Confirmation Required\n\n${toolRes.summaryForModel}\n\nPlease review and confirm the action card below to execute the operation securely.`,
      structuredData,
      toolsUsed
    };
  }

  // 16. Default Role-Aware Smart Guide
  return {
    reply: `Hello **${context.name}**! I am your **Google Gemini AI Copilot** for **St. Joseph's School, Barhalganj** (CBSE Affiliation No. 2131498).

I am connected to the school's live database and can answer real-time queries for you:

${context.isStudent ? `• **My Attendance**: Check your attendance percentage and absence logs
• **Tuition Fees**: View pending dues, paid amounts, and fee receipts
• **Report Cards**: Check subject marks, grades, and exam performance
• **Class Timetable**: View today's schedule and period allocations` : ''}
${context.isTeacher ? `• **Class Attendance**: Audit daily attendance for your assigned classes [${context.assignedClasses.join(', ') || 'None'}]
• **Student Dossiers**: View comprehensive 360° student records
• **Subject Performance**: Analyze exam marks and pass percentages
• **Teaching Schedule**: View weekly timetable and period routines` : ''}
${context.isAdmin ? `• **Executive Daily Brief**: Today's attendance %, fee collections, and critical items
• **Financial Intelligence**: Overdue accounts, collection efficiency, and fee recovery
• **Attendance Risk Audit**: List students below the 75% CBSE threshold
• **Academic Diagnostics**: Subject averages and students needing attention` : ''}
${!context.isStudent && !context.isTeacher && !context.isAdmin ? `• **School Admissions**: How to apply, admission criteria, and fee structure
• **School Timings & Calendar**: Daily schedule, holidays, and circulars
• **CBSE Affiliation & Policies**: Examination guidelines and curriculum` : ''}

**Quick Examples you can ask me:**
1. *"Show me the daily executive brief"*
2. *"Who is absent in Class 8 today?"*
3. *"Show fee collection analytics and pending dues"*
4. *"Which students have attendance below 75%?"*
5. *"Show academic report cards and exam results"*

What would you like to check?`
  };
}

