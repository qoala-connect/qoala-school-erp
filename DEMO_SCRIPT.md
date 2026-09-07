# 🎬 LIVE DEMO SCRIPT — AI School ERP

**Total runtime:** ~30 min (Core) · ~45 min (Extended)
**Format:** Each Act = *What you click* → *What you say* → *One Gemini question to run live*
**The rule:** Never demo a screen without following it with its AI question. The screen shows the data; the bot shows the differentiator.

---

## ⚙️ ACT 0 — PRE-DEMO CHECKLIST (15 min before, off-screen)

| # | Check | Why |
|---|---|---|
| 1 | `npm run dev` running, `/api/health` returns OK | Server + Vite up |
| 2 | `GEMINI_API_KEY` set in `.env` | Bot silently falls back to canned data without it — do NOT demo blind |
| 3 | Log in once as each role, then log out | Warms sessions, avoids cold-start lag on stage |
| 4 | Pick ONE hero student (has fees due + attendance + marks) — write the name on a sticky | You reuse this student in Acts 4, 5, 14 |
| 5 | Mark 2–3 students absent for today | Makes the "SMS to absent parents" action card fire real results |
| 6 | Mark 1 teacher absent today | Makes the Substitution Planner produce a real plan |
| 7 | Browser zoom 90%, close other tabs, notifications off | Screen real-estate |
| 8 | Keep a medical certificate / marksheet image on the desktop | For the Vision OCR moment in Act 15 |

**Demo accounts** (verify against your seeded data before stage — source: `create_users.mjs`):

- Admin: `admin@school.com` / `Password@123`
- Teacher: `teacher@school.com` / `Password@123`
- Student: `student@school.com` / `Password@123`
- Parent: `parent@school.com` / `Password@123`

**Opening line (30 sec, before you touch anything):**

> "Every school ERP on the market gives you forms and reports. Ours gives you an answer. Today I'll walk you through the entire school lifecycle — admission to report card — and at every single step I'll ask our built-in AI a question that no other ERP can answer, because it's reading your live database with your permissions, not a chatbot bolted on top."

---

# 🌐 PART A — THE OUTSIDE WORLD (No login)

## ACT 1 — Public Website & Online Admission Enquiry

**Route:** `/` → `/about` → `/admissions` · **Time:** 2 min

**Click path:**

1. Land on `/` — school homepage, branding, navbar identity.
2. `/about` — About Us page.
3. `/admissions` — the **public admission application form**. Fill 3–4 fields live (name, class, guardian, phone). Submit it.
4. Say: *"That application just hit the database. Watch — in ninety seconds I'll approve it as the Principal and this child becomes an enrolled student with a fee ledger generated automatically."*

**Talk track:**
> "Parents never call the office to ask 'is admission open'. They land here, apply online, and upload documents. Zero front-desk load."

### 🤖 GEMINI QUESTION #1 — *as a Guest / not logged in*

```
What are the school timings, the CBSE grading scale, and what documents
are required for a Class 6 admission?
```

**Point out:** *"Notice I'm not logged in. The bot answered the policy question — and only the policy question. It cannot see a single student record right now. Permission isn't a UI filter here, it's enforced on the server before Gemini ever sees the data."*
*(Backing tool: `get_school_policies_and_faqs`)*

---

# 🏛️ PART B — THE PRINCIPAL / ADMIN JOURNEY

## ACT 2 — Login & Executive Command Centre

**Route:** `/login` → `/dashboard` · **Time:** 3 min

**Click path:**

1. Log in as **Admin**. Land on the Executive Dashboard.
2. Sweep the KPI cards: total strength, staff, today's attendance %, today's collection, admissions.
3. Scroll the live charts — monthly fee trend, class-wise strength, attendance by class, admissions funnel.
4. **Click one chart segment** (a month on the fee chart, or a grade bar) — it deep-links into the filtered ledger. Come back.
5. Show the **collapsible sidebar** — the module groups: Admissions, Students, Academics, Attendance, CBSE Examination, Financials, Faculty & Staff, Library, Transport, Inventory, Operations, Communication, Certificates & ID, Reports, System.
6. Show the **global search bar** — type 3 letters of your hero student's name; students, staff and exams appear together.

**Talk track:**
> "This is not a static dashboard. Every number on this screen is clickable, and every click carries context into the next module — no re-searching, no re-filtering."

### 🤖 GEMINI QUESTION #2 — *Executive Daily Brief*

```
Give me today's executive daily brief — attendance percentage and how it moved
versus yesterday, how many students are below the attendance threshold,
today's fee collections, the weakest-performing class, and anything critical
I need to act on.
```

**Point out:** *"That is the Principal's entire morning meeting, answered in one sentence. It pulled attendance, compared it to yesterday, cross-checked finance, and ranked the classes — four modules, one question."*
*(Backing tool: `get_ai_daily_brief` → renders a `daily_brief_card`)*

---

## ACT 3 — Admissions Pipeline → Auto-Enrollment

**Route:** `Sidebar → Admissions → Pending Approvals` (`/dashboard/admissions`) · **Time:** 3 min

**Click path:**

1. Open **Pending Approvals** — the status filter arrives pre-applied from the sidebar (Pending / Under Review / Documents Verification / Interview Scheduled / Approved / Rejected).
2. Find the application **you submitted in Act 1**. 🎯 *This is the payoff moment.*
3. Open the applicant dossier. Show **document verification progress** — verify a document.
4. Show the **configurable column presets** (applicant, class, session, guardian, documents, status, applied-on).
5. **Approve** the application.
6. Say: *"Watch what just happened automatically."* → Students: the student now exists. → Fees: **a fee ledger was auto-generated on enrollment.**
7. Also show **Bulk Approve** on a multi-select — enroll a batch in one action.

**Talk track:**
> "Enquiry → verification → approval → student record → fee ledger. Four systems in most schools. One click here."

### 🤖 GEMINI QUESTION #3 — *Knowledge base / CBSE compliance*

```
What is our official SOP for issuing a Transfer Certificate, and what does the
CBSE bye-law say about it? Also explain our sibling discount rule.
```

**Point out:** *"This is a vector knowledge base of your own bye-laws, fee rules and SOPs. New office staff stop interrupting senior staff — they ask the bot."*
*(Backing tool: `query_school_knowledge_base`)*

---

## ACT 4 — Student Directory & Student 360

**Route:** `Sidebar → Students → Student Directory & SIS` (`/dashboard/students`) · **Time:** 3 min

**Click path:**

1. Open the directory. Show filters: class, section, status, academic year. Show the **Alumni & Transferred** view.
2. Open your **hero student** → the **Student 360 drawer** opens.
3. Walk the 360: demographics & photo · guardian/family · attendance % · academic average · fee dues · medical log · discipline record · document vault.
4. **Demonstrate context hand-off** (the detail most ERPs fail):
   - From 360 click **Collect Fee** → lands on Fees with *that student already selected and the collection modal open*.
   - Back to 360 → click **Certificates** → the generator opens *pre-filled with name, admission number, class, roll number*.
5. Show **Student ID Card** generation (`Certificates & ID → Student ID Cards`) — QR-coded card.

**Talk track:**
> "One screen, entire child. And notice the ID never gets dropped when I jump modules — that context preservation is what separates a real ERP from a collection of pages."

### 🤖 GEMINI QUESTION #4 — *Student 360 in one line*

```
Give me the complete 360 view for [HERO STUDENT NAME] — attendance percentage,
academic average, fee dues, and your assessment of whether this child needs
intervention.
```

**Point out:** *"The last part is the difference. It didn't just fetch — it judged. That's decision support, not reporting."*
*(Backing tool: `get_student_360_view` → renders a `student_360_card`)*

---

## ACT 5 — Smart Fee Engine ⭐ *highest-value act for management*

**Route:** `Sidebar → Financials` (`/dashboard/fees`) · **Time:** 4 min

**Click path — walk all five tabs in order:**

1. **Fee Overview & Hub** — collection KPIs, paid/pending/partial/overdue split.
2. **Fee Structure Master** — class-wise and category-wise fee heads; frequency (monthly/quarterly/annual); installment plans.
3. **Fee Collection & Ledgers** — search your hero student → open the **collection modal**:
   - Show heads, concession/discount, previous balance, net payable.
   - Pick payment mode (Cash / UPI / Cheque / Online), enter amount, **Collect**.
   - **Generate the PDF receipt live.** Open it. Show the sequential receipt number. ⏱️ *Time this out loud — under 15 seconds.*
4. **Recent Transactions** — your payment sits at the top. Show **Void** with reason capture. Say: *"Voids are logged, not deleted. Full audit trail — that's your anti-fraud control."*
5. **Fee Reports & Overdues** — defaulter list, class-wise outstanding, exportable.

**Talk track:**
> "Receipt sequencing, void logging, and permission separation mean the accountant can collect but cannot rewrite history. That is the single most requested control from school management."

### 🤖 GEMINI QUESTION #5 — *Finance analytics*

```
Show me total fee collected versus total outstanding for this session, break it
down class-wise, and list every account overdue by more than 30 days.
```

**Point out:** *"Ask your current system that question. It takes an accountant two hours and an Excel export."*
*(Backing tool: `get_fee_analytics` → `fee_analytics_card` with charts)*

---

## ACT 6 — Academics: Structure, Curriculum & Timetable

**Route:** `Sidebar → Academics` (`/dashboard/academics/...`) · **Time:** 3 min

**Click path:**

1. **Academic Years** — session management, current-year switch.
2. **Classes & Sections** → **Subjects** → **Class Subjects** (subject-to-class mapping).
3. **Curriculum & Syllabus** — unit/chapter tracking.
4. **Timetable** — open the visual matrix. Assign a period. **Trigger a clash deliberately** → the system blocks the double-booked teacher. Say: *"Conflict-free by construction — the guard is in the database, not in the browser."*
5. **Academic Monitor** — syllabus completion across grades.
6. **School Calendar** — holidays and events.

### 🤖 GEMINI QUESTION #6 — *Timetable*

```
Show me the Monday timetable for Class 8 Section A, and tell me which periods
are free.
```

*(Backing tool: `get_timetable_schedule` → `timetable_grid`)*

---

## ACT 7 — Attendance

**Route:** `Sidebar → Attendance → Attendance Entry` (`/dashboard/attendance`) · **Time:** 2 min

**Click path:**

1. Select class + section + date. The roster loads.
2. **Mark All Present** → flip 2 students to Absent. Save. ⏱️ *"Under thirty seconds for a full class."*
3. Show the attendance summary / percentage view.

### 🤖 GEMINI QUESTION #7 — *Early warning on attendance*

```
Which students are below 75% attendance, and who has been absent for
3 or more consecutive days? Group them by class.
```

**Point out:** *"Consecutive absence is the number-one early signal of a dropout or a family problem. No paper register catches it. This does, every single day."*
*(Backing tool: `get_attendance_analytics` → `attendance_analytics_card`)*

---

## ACT 8 — CBSE Examination: The Full Lifecycle ⭐ *deepest module*

**Route:** `Sidebar → CBSE Examination` (`/dashboard/examination`) · **Time:** 5 min

**Click path — walk the lifecycle in the sidebar's own order:**

1. **Dashboard** — exam status overview.
2. **Exams & Assessments** — create/select an exam (term, weightage, max marks).
3. **Exam Schedule** — date-sheet with room allocation.
4. **Admit Cards** — generate + print a student admit card. Show the PDF.
5. **Seating Plan** — hall allocation.
6. **Invigilation** — invigilator assignment per hall/period.
7. **Exam Attendance** — mark exam-day presence.
8. **Marks Entry** — spreadsheet-style bulk entry with auto-validation against max marks.
9. **Marks Verification** — a second pair of eyes approves before results move. Say: *"Entry and approval are different permissions. A teacher cannot publish their own marks."*
10. **Result Processing** — compute grades, percentage, rank, merit list.
11. **Report Cards** — generate the branded printable CBSE report card. **Open it on screen.**
12. **Result Publishing** — publish → results become visible in the parent portal instantly.
13. **Performance Analytics** — subject trends, toppers, students needing support.
14. **Examination Settings** — exam types, grade rules.

**Talk track:**
> "Fourteen stages, one module, with lifecycle guards at every gate. Report card week goes from three weeks of manual calculation to an afternoon."

### 🤖 GEMINI QUESTION #8 — *Exam intelligence*

```
For Class 10, give me the subject-wise average and pass percentage, tell me
which subject is weakest, and list every student scoring below 40%.
```

**Point out:** *"That's your academic review meeting agenda — generated before the meeting."*
*(Backing tool: `get_exam_analytics` → `exam_analytics_card` + `students_attention_card`)*

---

## ACT 9 — Faculty, Staff & HR

**Route:** `Sidebar → Faculty & Staff` (`/dashboard/teachers`, `/dashboard/employees`) · **Time:** 2 min

**Click path:**

1. **Teacher Directory & 360** — open a teacher profile: qualifications, designation, documents, assigned load.
2. **Academic Assignments** tab — which classes/sections/subjects this teacher owns; show class-teacher handover.
3. **Non-Teaching Staff** — the employee directory.
4. Mention leave requests and role provisioning.

### 🤖 GEMINI QUESTION #9 — *The Substitution Planner* ⭐ *crowd-pleaser*

```
Which teachers are absent today? Generate a substitution plan that matches
free teachers to their periods by subject specialisation.
```

**Point out:** *"This is the single most painful 7:45 AM job in any school — done by the vice-principal on a whiteboard. The AI matched free teachers to empty periods by subject. That alone saves an hour every morning."*
*(Backing tool: `get_teacher_substitution_plan`)*

---

## ACT 10 — Campus Operations Suite (rapid fire)

**Time:** 3 min — *30–40 seconds each. Do not linger.*

| Module | Route | Show this one thing |
|---|---|---|
| **Library** | `/dashboard/library` | Book catalog → Borrowing ledger → auto-calculated **overdue fines** |
| **Transport** | `/dashboard/transport` | Transit routes → Fleet vehicles → Certified drivers → **student allotments** |
| **Inventory & Assets** | `/dashboard/inventory` | Fixed assets → consumable stock → vendors → **purchase orders** |
| **Hostel** | `/dashboard/hostel` | Room/bed occupancy and warden allocation |
| **Front Office** | `/dashboard/front-office` | Visitor log + **gate pass generation** |
| **Medical** | `/dashboard/medical` | Health incident linked to the student record |
| **Discipline** | `/dashboard/discipline` | Incident logged against Student 360 |

**Talk track:**
> "You don't buy five more subscriptions. Buses, books, beds, gate, clinic — all inside the same permission model and the same student record."

### 🤖 GEMINI QUESTION #10 — *Cross-module natural language query*

```
List the students in Class 8 who have attendance below 75% AND Mathematics
marks below 40.
```

**Point out:** *"Two different modules, one plain-English sentence — no report builder, no filters, no export. This query is effectively impossible in every ERP your team has evaluated."*
*(Backing tool: `get_natural_language_query`)*

---

## ACT 11 — Communication, Certificates & Reports

**Route:** `/dashboard/communication`, `/dashboard/certificates`, `/dashboard/reports` · **Time:** 2 min

**Click path:**

1. **Communication** → Official Notices (publish one live — it appears in the parent portal), SMS Campaigns, Email Broadcasts, App Push Alerts.
2. **Certificates & ID** → Issue Credentials: generate a **Transfer Certificate / Bonafide** — note it's pre-filled if you arrived from Student 360.
3. **Reports** → run and **download a real report**.

### 🤖 GEMINI QUESTION #11 — *AI that WRITES, not just reads* ⭐⭐ **THE MOMENT**

```
Send an SMS alert to the parents of every student who is absent today.
```

**Do this deliberately, slowly:**

1. The bot returns a **confirmation Action Card** — showing exactly which students, which parents, and the message body.
2. **Pause. Point at it.** Say: *"Look what it did NOT do. It did not execute. Every AI write action in this system returns a confirmation card first. The human approves."*
3. **Click Confirm.** The SMS dispatches.
4. Say: *"That is the difference between an AI toy and an AI you can put in front of a school office. It can act — attendance marking, fee reminders, notices, substitutions, admit cards — but never without a human hand on the trigger, and every action is audit-logged."*

*(Backing tool: `propose_erp_action` → `action_card` → `/api/ai/action/execute`)*
*Fallback if no absentees today:* `Dispatch fee payment reminders to all overdue accounts.`

---

## ACT 12 — System, RBAC & Security Governance

**Route:** `Sidebar → System` (`/dashboard/system/...`) · **Time:** 2 min

**Click path:**

1. **User Directory** — create a user, reset a password.
2. **Roles & Permissions** — the permission matrix; 16 roles, database-enforced.
3. **Audit Logs** — show the fee void from Act 5 and the AI action from Act 11 sitting in the log.
4. **Security & Governance** — say: *"76 tables, 100% row-level security at the database. If someone bypassed our UI entirely and hit the database directly with a teacher's credentials, they still could not read another class's data."*

### 🤖 GEMINI QUESTION #12 — *Institutional KPIs*

```
Give me the executive KPI summary — total strength, staff count, admissions
this session, today's attendance, and fee collection.
```

*(Backing tool: `get_school_kpi_summary` → `kpi_cards`. Administrator-restricted — remember this answer; you break it in the next act.)*

---

# 👩‍🏫 PART C — THE OTHER SIDE OF THE PLATFORM

## ACT 13 — The Teacher Workspace *(log out → log in as Teacher)*

**Route:** `/dashboard/teaching/...` · **Time:** 3 min

**Click path:**

1. **Say before you click:** *"Same application, same URL. Watch the sidebar."* → It's now a completely different, much shorter menu. No Financials. No System.
2. **Today's Classes** — the teacher's day.
3. **My Classes** — assigned sections and rosters only.
4. **Lesson Plans** · **Homework & Assignments** — post an assignment live.
5. **Marks Entry** — enter marks for an assigned subject only.
6. **Syllabus Progress** — update completion.

### 🤖 GEMINI QUESTION #13 — *Two questions back-to-back. This is your security proof.*

**First, what a teacher SHOULD see:**

```
Show me my assigned classes and student roster, and tell me who is absent
in my classes today.
```

✅ Answers fully.

**Then immediately, what a teacher must NOT see:**

```
Show me the school's total fee collection and the list of fee defaulters.
```

❌ **The bot refuses.**

**Deliver this line slowly:**
> "That refusal is the most important thing you'll see today. This isn't the AI being polite. The teacher's identity was resolved on the server, the fee tool was denied before Gemini was ever called, and the data never left the database. Most 'AI ERPs' pipe your whole database into a prompt and hope the model behaves. Ours cannot leak what it was never given."

---

## ACT 14 — Parent & Student Portal *(log out → log in as Student/Parent)*

**Route:** `/dashboard/portal` · **Time:** 3 min

**Click path — walk the tabs:**

1. **My Overview** — attendance %, dues, latest results at a glance.
2. **Homework** / **Assignments** — the assignment you posted in Act 13 is here. 🎯 *Call it out.*
3. **Syllabus & Progress**
4. **Attendance Ledger** — day-by-day record.
5. **Fee Invoices & Receipts** — **download the receipt you generated in Act 5.** 🎯 *Call it out.*
6. **Report Cards & Marks** — the result you published in Act 8. 🎯 *Call it out.*
7. **Class Timetable** · **Transport & Bus** (route + stop) · **Student & Family Profile**
8. Show the notice from Act 11 in the notification bell.

**Talk track:**
> "Three things I did as staff in this demo just appeared in the parent's hand with no one re-entering anything. That's the 70% drop in front-desk phone calls."

### 🤖 GEMINI QUESTION #14 — *AI Study Tutor, scoped to one child*

```
What is my attendance percentage, what is my pending fee balance, and how did
I do in my last exam? Where do I need to improve?
```

**Point out:** *"Same AI, same infrastructure, third personality. And it physically cannot see another child's record — a parent asking about someone else's marks gets nothing."*
*(Backing tools: `get_attendance_summary`, `get_fee_status`, `get_exam_results_and_marks` — all self-scoped)*

---

# 🧠 PART D — THE FINALE

## ACT 15 — The AI Command Centre *(log back in as Admin)* ⭐⭐⭐

**Route:** `Sidebar → AI` (`/dashboard/ai`) · **Time:** 5 min — *Slow down. This is what they'll remember.*

**Say first:**
> "Everything so far, some vendor can eventually build. This module is why you'd choose us."

### 15.1 — The Predictions tab

Open **Predictions**. Show the live charts built from real records: class-wise passing probability, average score, attendance average, and the **fee defaulter risk distribution** (Critical / Medium / Low / No Risk) computed from the actual `student_fees` ledger.

### 🤖 GEMINI QUESTION #15 — *Multi-factor Early Warning System* ⭐ **THE HEADLINE**

```
Predict which students are at risk. Combine low attendance, falling exam
performance, and fee delays into a risk score, and tell me who needs
intervention first and why.
```

**Deliver this:**
> "Three unrelated signals — attendance, marks, and fee delays — fused into one At-Risk Index. A child whose attendance slips, whose marks drop, and whose fees go late is not three separate problems in three separate departments. It's one child in trouble, and no school sees it until it's too late, because the data sits in three different registers. This screen fuses them."

*(Backing tool: `get_at_risk_students_prediction`)*

### 15.2 — Cashflow forecast

```
Forecast our fee collection cashflow and recovery for the next 30 and 60 days.
```

> "Your treasurer's projection, straight from the live ledger."
*(Backing tool: `get_cashflow_forecast`)*

### 15.3 — Vision / Document OCR

**Upload the medical certificate or marksheet image** from your desktop into the chat.

> "Front office gets a doctor's certificate over WhatsApp. Instead of typing it into the medical log, they photograph it. Gemini Vision reads it and extracts the student, the condition, the leave dates and the doctor's registration as a structured record."
*(Backing endpoint: `/api/ai/vision/analyze`)*

### 15.4 — The Insights tab

Close on the Insights view — proactive institutional observations, and the **suggested follow-up chips** that keep the conversation going.

---

# 🎤 THE CLOSE (60 seconds — memorise this)

> "Let me leave you with one comparison.
>
> **Every ERP on your shortlist stores your data.** You log in, find the module, set the filters, export to Excel, and then a human finds the insight — if they have time, which they don't.
>
> **This one answers you.** Same login, same permissions, same audit trail — but the Principal asks for a morning brief and gets one; the vice-principal asks for a substitution plan at 7:45 AM and gets one; the accountant asks who's thirty days overdue and gets a list; the teacher asks who's absent and gets it — and the teacher who asks about school finances gets refused, at the database, not by a polite chatbot.
>
> And when it needs to *do* something — send SMS to absent parents, dispatch fee reminders, assign a substitute — it asks your permission first, every time, and logs it.
>
> **That's the difference between software that holds your school's data and software that helps you run your school.**"

---

# 📋 QUICK REFERENCE — ALL GEMINI QUESTIONS (print this page separately)

| # | Act | Role | Question |
|---|---|---|---|
| 1 | Public site | Guest | School timings, CBSE grading scale, documents for Class 6 admission? |
| 2 | Dashboard | Admin | Today's executive daily brief with attendance delta and critical items |
| 3 | Admissions | Admin | TC issuance SOP per CBSE bye-laws + sibling discount rule |
| 4 | Student 360 | Admin | Complete 360 for [HERO STUDENT] + intervention assessment |
| 5 | Fees | Admin | Collected vs outstanding, class-wise, and 30+ day overdue accounts |
| 6 | Academics | Admin | Monday timetable for Class 8-A and free periods |
| 7 | Attendance | Admin | Students below 75% and 3+ consecutive absences, by class |
| 8 | Examination | Admin | Class 10 subject-wise pass %, weakest subject, students below 40% |
| 9 | Faculty | Admin | Absent teachers today + substitution plan by specialisation |
| 10 | Operations | Admin | Class 8 students with attendance <75% AND Maths <40 |
| 11 | Communication | Admin | **Send SMS to parents of all students absent today** *(action card)* |
| 12 | System | Admin | Executive KPI summary |
| 13a | Teaching | **Teacher** | My assigned classes, roster, who's absent today ✅ |
| 13b | Teaching | **Teacher** | School's total fee collection and defaulters ❌ **REFUSED** |
| 14 | Portal | **Student** | My attendance, fee balance, last exam — where to improve |
| 15 | AI Centre | Admin | **Predict at-risk students** (attendance + marks + fees fused) |
| 15b | AI Centre | Admin | 30/60-day fee cashflow forecast |
| 15c | AI Centre | Admin | *(Upload image)* Read this medical certificate |

---

# ⏱️ TIMING VARIANTS

**⚡ 10-MINUTE VERSION** (investor / quick pitch)
Act 2 (dashboard + Q2) → Act 5 (fee collection + receipt + Q5) → Act 11 (Q11 action card) → Act 13 (Q13a + Q13b refusal) → Act 15 (Q15 at-risk) → Close.

**🎯 30-MINUTE VERSION** (school management — recommended)
All acts, but compress Acts 6, 10 and 12 to 60 seconds each.

**📚 45-MINUTE VERSION** (technical / IT committee)
Full script + expand Act 12 (RLS, 16-role matrix, audit logs) + open the Vision OCR and action-execute flow in detail.

---

# 🚨 IF SOMETHING BREAKS ON STAGE

| Problem | Say this, keep moving |
|---|---|
| Bot is slow | *"It's querying live production data, not a cached summary."* — keep talking about the screen |
| Bot returns no data | *"This is a demo dataset — in your school this table would have 800 rows."* Move to the next question |
| A module is empty | Go to **Fees** or **Students** — always populated |
| Login fails | Keep all four roles pre-logged-in in **four separate browser profiles/windows** — switch windows instead of logging in |
| Action card doesn't execute | *"I'll leave it un-confirmed — which is exactly the point: nothing happens without approval."* |

**Golden rule: never debug on stage. Narrate forward.**
