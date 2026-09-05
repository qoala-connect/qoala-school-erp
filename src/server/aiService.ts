import { GoogleGenAI } from '@google/genai';
import { SupabaseClient } from '@supabase/supabase-js';
import { UserContext } from './aiAuth';
import { geminiToolDeclarations, executeTool, ToolResult } from './aiTools';

export interface ChatRequestPayload {
  message: string;
  history?: Array<{ role: string; text: string }>;
}

export interface ChatResponsePayload {
  reply: string;
  structuredData?: any[];
  toolsUsed?: string[];
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

  // Try Gemini Generative AI with Function Calling
  if (genAI) {
    try {
      const candidateModels = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-2.5-pro', 'gemini-3.7-flash'];
      
      // Build conversation contents (last 8 messages for context window optimization)
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
      let lastErr: any = null;

      for (const modelName of candidateModels) {
        try {
          const chatResponse = await genAI.models.generateContent({
            model: modelName,
            contents,
            config: {
              systemInstruction,
              temperature: 0.4,
              maxOutputTokens: 1500,
              tools: [{ functionDeclarations: geminiToolDeclarations as any }]
            }
          });

          // Check if model called functions/tools
          const candidates = chatResponse?.candidates || [];
          const firstCandidate = candidates[0];
          const functionCalls = firstCandidate?.content?.parts?.filter((p: any) => p.functionCall) || [];

          if (functionCalls.length > 0) {
            // Execute all requested tool calls
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

            // Second turn with tool results to generate final human response
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
                temperature: 0.4,
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
          lastErr = err;
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
      console.warn("[Gemini Generative Loop Error] Falling back to Direct Role Engine:", genError?.message);
    }
  }

  // -----------------------------------------------------------------
  // Intelligent Direct ERP Engine Fallback (Zero Downtime)
  // Automatically resolves the query and calls secure tools directly
  // -----------------------------------------------------------------
  const lowerMsg = message.toLowerCase();

  // 1. Attendance Queries
  if (lowerMsg.includes('attendance') || lowerMsg.includes('absent') || lowerMsg.includes('present')) {
    const classMatch = lowerMsg.match(/class\s+(\d+|[a-zA-Z]+)/i);
    const cls = classMatch ? classMatch[1] : undefined;
    const toolRes = await executeTool('get_attendance_summary', { class_name: cls }, context, supabase);
    toolsUsed.push('get_attendance_summary');
    if (toolRes.structuredPayload) structuredData.push(toolRes.structuredPayload);

    return {
      reply: `### Attendance Record\n\n${toolRes.summaryForModel}\n\n• For detailed registers and monthly reports, please refer to the table below or the Attendance module.`,
      structuredData,
      toolsUsed
    };
  }

  // 2. Fees & Receipts Queries
  if (lowerMsg.includes('fee') || lowerMsg.includes('due') || lowerMsg.includes('payment') || lowerMsg.includes('receipt') || lowerMsg.includes('defaulter')) {
    const toolRes = await executeTool('get_fee_status', {}, context, supabase);
    toolsUsed.push('get_fee_status');
    if (toolRes.structuredPayload) structuredData.push(toolRes.structuredPayload);

    return {
      reply: `### Fees & Financial Status\n\n${toolRes.summaryForModel}\n\n• All payments are secured with official CBSE-compliant receipt numbers.`,
      structuredData,
      toolsUsed
    };
  }

  // 3. Exam, Marks & Results Queries
  if (lowerMsg.includes('mark') || lowerMsg.includes('exam') || lowerMsg.includes('result') || lowerMsg.includes('grade') || lowerMsg.includes('report card') || lowerMsg.includes('score')) {
    const toolRes = await executeTool('get_exam_results_and_marks', {}, context, supabase);
    toolsUsed.push('get_exam_results_and_marks');
    if (toolRes.structuredPayload) structuredData.push(toolRes.structuredPayload);

    return {
      reply: `### Academic & Examination Performance\n\n${toolRes.summaryForModel}\n\n• Report cards follow the official 8-point CBSE grading schema.`,
      structuredData,
      toolsUsed
    };
  }

  // 4. Timetable & Schedule Queries
  if (lowerMsg.includes('timetable') || lowerMsg.includes('schedule') || lowerMsg.includes('period') || lowerMsg.includes('class time')) {
    const toolRes = await executeTool('get_timetable_schedule', {}, context, supabase);
    toolsUsed.push('get_timetable_schedule');
    if (toolRes.structuredPayload) structuredData.push(toolRes.structuredPayload);

    return {
      reply: `### Academic Schedule\n\n${toolRes.summaryForModel}\n\n• Timetables are coordinated to ensure continuous learning with zero period clashes.`,
      structuredData,
      toolsUsed
    };
  }

  // 5. Student Profile / Roster Queries
  if (lowerMsg.includes('student') || lowerMsg.includes('profile') || lowerMsg.includes('admission no') || lowerMsg.includes('roll')) {
    const toolRes = await executeTool('get_student_profile', { search: message }, context, supabase);
    toolsUsed.push('get_student_profile');
    if (toolRes.structuredPayload) structuredData.push(toolRes.structuredPayload);

    return {
      reply: `### Student Dossier\n\n${toolRes.summaryForModel}`,
      structuredData,
      toolsUsed
    };
  }

  // 6. Notices & Circulars
  if (lowerMsg.includes('notice') || lowerMsg.includes('circular') || lowerMsg.includes('announcement') || lowerMsg.includes('holiday')) {
    const toolRes = await executeTool('get_notices_and_circulars', { limit: 4 }, context, supabase);
    toolsUsed.push('get_notices_and_circulars');
    if (toolRes.structuredPayload) structuredData.push(toolRes.structuredPayload);

    return {
      reply: `### School Circulars & Announcements\n\n${toolRes.summaryForModel}`,
      structuredData,
      toolsUsed
    };
  }

  // 7. KPI / School Summary (Admin)
  if (context.isAdmin && (lowerMsg.includes('kpi') || lowerMsg.includes('summary') || lowerMsg.includes('stats') || lowerMsg.includes('strength') || lowerMsg.includes('total'))) {
    const toolRes = await executeTool('get_school_kpi_summary', {}, context, supabase);
    toolsUsed.push('get_school_kpi_summary');
    if (toolRes.structuredPayload) structuredData.push(toolRes.structuredPayload);

    return {
      reply: `### Executive Institutional KPIs\n\n${toolRes.summaryForModel}`,
      structuredData,
      toolsUsed
    };
  }

  // Default Institutional Guide
  return {
    reply: `Hello **${context.name}**! I am your **Google Gemini AI Enterprise Assistant** for **St. Joseph's School, Barhalganj** (CBSE Affiliation No. 2131498).

You are signed in as **${context.role}**. I can assist you with real-time ERP information:
${context.isStudent ? `• **My Attendance**: Check monthly percentage and leave logs
• **Tuition Fees**: View billed dues, payments, and download receipts
• **Report Cards**: View latest CBSE marks and exam results
• **Timetable**: View today's classes and subject periods` : ''}
${context.isTeacher ? `• **Assigned Classes**: [${context.assignedClasses.join(', ') || 'N/A'}] student rosters
• **Class Attendance**: Audit daily attendance for your sections
• **Marks Entry**: Review marks submission and exam datesheets
• **Timetable**: View weekly teaching periods and room allocations` : ''}
${context.isAdmin ? `• **Executive KPIs**: School-wide student strength, admissions, fee recovery
• **Defaulter Tracking**: Identify pending fees across classes
• **Teacher Workload**: Faculty allocations and timetable optimization
• **Circulars & Notices**: Publish announcements and view audit logs` : ''}

How can I help you today?`
  };
}
