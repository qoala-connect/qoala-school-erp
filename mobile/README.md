# St. Joseph's School, Barhalganj — Mobile App

Android app (Expo, React Native) for admin, teacher, and student roles. Talks
directly to the same Supabase project as the [web app](../src) — same auth,
same tables, same Row Level Security. A few privileged operations (fee
collection) call the web app's existing Express API instead of duplicating
that server-side logic.

This is an independent project (own `package.json`/`node_modules`), not part
of the root npm workspace. See `../PROJECT.md` for the overall school system
and `../src/context/AuthContext.tsx` / `../src/services/*.ts` for the web
patterns this app's `src/context/AuthContext.tsx` / `src/services/*.ts` are
ported from.

## Setup

```
cd mobile
npm install
cp .env.example .env   # fill in Supabase URL/anon key (see root .env) and
                        # the production API base URL for fee collection
npm start
```

Scan the QR code with Expo Go, or press `a` for an Android emulator.

## Known tradeoff: service files are duplicated, not shared

`src/services/*.ts` here are ports of the equivalent files in `../src/services/`
— same table/column/RPC names, same business-rule comments — not shared
imports (the web app is a Vite project; this is a separate RN/Metro project,
and the repo isn't a monorepo). **A fix to a query on web (e.g. a change to
how `save_attendance()` is called) should prompt a check of the matching
mobile service file, and vice versa.**

## Build

```
npx eas-cli build:configure         # first time only
eas build --platform android --profile preview      # side-loadable APK for testers
eas build --platform android --profile production   # AAB, for Play Store
```

`eas.json`'s `preview`/`production` profiles need `EXPO_PUBLIC_API_BASE_URL`
set to the **stable production Vercel domain**, not a per-commit preview URL.

## Status

- [x] Phase 0 — scaffold, Supabase auth, role-based routing (student/parent →
      Student navigator, teacher/class_teacher → Teacher navigator,
      admin/super_admin/principal/vice_principal/accountant → Admin
      navigator, everyone else → "not supported yet" screen)
- [x] Phase 1 — Student portal (home, attendance, homework, results, fees, timetable).
      Adds `src/context/StudentContext.tsx` and `src/services/studentService.ts`
      (resolving the signed-in student/parent's student record once, shared
      across every tab) — not in the original service-file table since the web
      app does this resolution inline in `StudentPortal.tsx` rather than as a
      separate service.
- [x] Phase 2 — Teacher workspace (today, attendance entry, marks entry, homework
      create + submission review). Adds `src/context/TeacherContext.tsx` (same
      pattern as StudentContext — resolves the signed-in teacher, current
      academic year, and class/section/subject scope once). Marks entry is
      school-wide for every teacher by design (see
      `supabase_open_marks_entry_to_any_teacher_37.sql` — no evaluator/timetable
      restriction), so the mobile Marks tab mirrors that: any teacher sees and
      can enter every exam subject's marks board, not just their own classes.
- [x] Phase 3 — Admin (dashboard stat cards from the same `dashboard_kpi_view`
      / `dashboard_fee_view` / `dashboard_attendance_view` the web dashboard
      reads from; students/teachers searchable directories with read-only
      detail; fee collection — student search → outstanding `student_fees` →
      `collectFee()`, which calls `POST {API_BASE_URL}/api/fees/collect` and
      falls back to the `collect_fee()` RPC exactly as web does. Adds
      `src/services/teacherService.ts` and `src/services/analyticsService.ts`
      — analyticsService is intentionally a small slice of the web
      equivalent (stat cards only, no charts/library/transport/hostel/
      inventory breakdowns — those are out of v1 scope).
- [x] Phase 4 — Polish + release build prep. Pull-to-refresh added to every
      list screen that was missing it (Teacher Marks board, Teacher Homework
      list + submissions view). App branding switched to the real school
      identity — icon/splash/adaptive-icon assets generated from
      `../public/favicon.png` (the same logo the web navbar uses), app name
      "St. Joseph's School", Android package `com.stjosephsschool.barhalganj`.
      **Known caveat:** the source logo is only 105×112px, so the generated
      icon looks soft when scaled up to the required 1024×1024 — swap in a
      higher-resolution version of the crest under `assets/` (same filenames)
      if/when one is available; nothing else needs to change.
      **Still outstanding, needs you:** `EXPO_PUBLIC_API_BASE_URL` in `.env`
      and `eas.json` is still a placeholder (needs the real production Vercel
      domain — only blocks the Admin Fees tab, everything else works without
      it); and the actual `eas build` run needs your own Expo account login
      (`eas login`), which isn't something that can be done for you.
- [x] Design pass — enterprise-grade visual system. Adds `src/theme.ts`
      (colors pulled from the web app's own brand palette — navy/blue/gold —
      so mobile reads as the same product, not a different one), plus shared
      components used everywhere: `Avatar` (initials), `StatTile` (icon stat
      cards), `EmptyState`, `DetailHeader` (for the in-tab list→detail
      pattern used across Students/Teachers/Marks/Homework/Fees),
      `SearchInput`. Installed `@expo/vector-icons` (Ionicons throughout —
      tab bar, buttons, status rows) and `expo-linear-gradient` (login hero).
      Every navigator now has a navy header + icon tab bar; the login screen
      has a gradient hero with the school crest. All Ionicons names were
      cross-checked against the installed font's glyph map (zero missing).
- [x] Admin → Admissions (new tab, beyond original v1 scope). Ported from
      `src/services/admissionService.ts` (web) — trimmed to the columns that
      actually exist on the `admissions` table (verified against the live
      schema; the web `AdmissionRecord` type includes some aspirational
      fields, e.g. `stream`, that aren't real columns). Search + status
      filter chips → tap an application for full detail, a per-document
      verify/reject checklist (`verify_admission_document` RPC), and
      Approve/Reject actions (`approve_admission` / `reject_admission`
      RPCs — approve creates the real student record, so it wasn't
      exercised in the live smoke test, only reject/verify were). A "+ New"
      form creates an application via `POST /api/admissions/apply` with a
      direct-insert fallback, exactly mirroring web's resilience pattern.
      Not ported: delete, and the richer enquiry/lead pipeline — web-only
      for now.
- [x] Bug fix — Admin → Fees showed a blank screen until you typed a search
      query (unlike Students/Teachers, which list immediately). Now shows
      the full student directory by default, with pull-to-refresh added.
- [x] Change password (new, all three roles). Adds
      `src/components/ChangePasswordModal.tsx` (calls
      `supabase.auth.updateUser({ password })` directly — no email/OTP round
      trip needed since the user is already signed in) and
      `src/components/AccountActions.tsx` (change password + sign out,
      replacing the old plain sign-out link on Home/Today/Dashboard).
      Verified live: signed in, changed the password, confirmed sign-in
      works with the new one, then reverted it back.
- [x] `EXPO_PUBLIC_API_BASE_URL` set to `https://school-qk6qwi73i-qoala.vercel.app`
      (verified live: `/api/health` → 200, `/api/fees/collect` → 401 without
      a token, confirming the route is really mounted). **Caveat:** this
      looks like a per-deployment Vercel preview URL, not a stable
      production alias — if fee collection breaks after a future deploy,
      get the current one from the Vercel dashboard's Domains tab.
- [x] Admin section made fully functional + Android-native polish pass:
    - **Fees, completed**: added `voidPayment()` to `feeService.ts`
      (`POST /api/fees/void` → falls back to the `void_fee_payment()` RPC,
      mirroring `collectFee()`'s resilience pattern) and a payment-history +
      void-with-reason UI on each fee card in `AdminFeesScreen.tsx` — admins
      can now see every past receipt for a fee and reverse a wrongly
      entered one, not just collect new payments. Verified live end-to-end
      against the real deployed endpoint: collected a real ₹1 payment
      (minted an actual receipt number), voided it via RPC, confirmed the
      student's balance reverted exactly to its original value.
    - **Hardware back button, fixed everywhere**: every "list → detail"
      screen in this app is a component-state swap, not a real navigation
      stack, so the Android back button/gesture used to fall through to the
      tab navigator instead of returning to the list — a real, easy-to-hit
      bug on any physical device. Added `src/hooks/useAndroidBackHandler.ts`
      and wired it into all six detail views: Admin Students/Teachers/
      Admissions/Fees, Teacher Marks roster editor, Teacher Homework
      submissions view. (Modals already worked correctly via RN's `Modal`
      `onRequestClose`, which Android's back button triggers automatically.)
    - **Material ripple feedback**: added `ripple`/`rippleOnDark` tokens to
      `theme.ts` and wired `android_ripple` onto every button, chip, and
      list row across the Admin screens and the shared account-actions/
      change-password components — previously Pressable only dimmed on
      press, which reads as a wrapped web page rather than a native
      Android app.
- [x] `EXPO_PUBLIC_API_BASE_URL` re-confirmed 2026-09-28: checked the Vercel
      dashboard's Domains tab — no stable alias or custom domain exists yet,
      so `https://school-qk6qwi73i-qoala.vercel.app` is confirmed as the
      correct URL to keep using in `.env` and both `eas.json` profiles (no
      file change needed, value was already current). Re-verified live:
      `/api/health` → 200, `/api/fees/collect` → 401 without a token.
      **Caveat unchanged:** this is still a per-deployment URL, not a true
      stable alias — if a future Vercel redeploy changes it, fee collection
      breaks until the URL is updated here again.
- [x] App icon regenerated 2026-09-28 from `src/assets/sjs_logo_icon.jpg`
      (121×118, a cleaner square crest crop than the previous source,
      `public/favicon.png` at 105×112) via a new one-off script,
      `scripts/gen-mobile-icons.py` (PIL/Pillow: chroma-keys the white
      background to transparency for the adaptive-icon/splash layers,
      despeckles JPEG ringing noise with a morphological open, then fits
      each layer to match the previous files' safe-zone proportions).
      Regenerated `icon.png`, `android-icon-foreground.png`,
      `android-icon-monochrome.png`, `favicon.png`, `splash-icon.png` — all
      confirmed at the exact pixel dimensions `app.json` expects (1024×1024
      icon/foreground/monochrome/splash, 256×256 favicon), with clean alpha
      (verified via pixel sampling, not just visual inspection).
      **Caveat not fully resolved:** the new source (121×112) is only
      marginally bigger than the old one (105×112) — it's the same crest
      artwork, not a genuinely high-resolution redraw, so the icon is still
      visibly soft at full 1024×1024 scale. A true fix needs a vector or
      1024×1024+ source of this crest, which doesn't exist anywhere in this
      repo. On-device/emulator visual confirmation hasn't been done from
      here — only pixel-dimension and alpha-channel checks.
- [x] Web parity — Phase 0 + Phase 1 of the full-parity roadmap (mobile is
      missing 14 web modules entirely; see the plan for the complete
      phase-by-phase breakdown). This pass:
    - **Nav foundation**: added a `More` tab to `AdminNavigator.tsx` whose
      screen is a `MoreNavigator.tsx` (`@react-navigation/native-stack`,
      installed but previously unused) — a tile grid (`MoreScreen.tsx`,
      reusing `AdminDashboardScreen.tsx`'s tap-through tile pattern, each
      tile gated by `<Can permission="...">`) that pushes to real stack
      screens instead of adding more bottom tabs (Admin was already at 9).
      New screens here use real `navigation.push`, not the component-state
      swap older screens use.
    - **Six new single-table admin modules**, each with a new
      `src/services/*.ts` mirroring the equivalent web page's own Supabase
      queries (none of these have a dedicated web service file) and a new
      screen under `src/screens/admin/` (list + search + modal create/edit
      + delete confirm, same shape as `AdminStudentsScreen.tsx`):
      **SchoolCalendar** (`calendarService.ts`, `holidays` table),
      **OnlineClasses** (`onlineClassesService.ts`, `online_classes`),
      **Notices** (`communicationService.ts`, `notices` — SMS/Email/Push
      tabs stay web-only), **FrontOffice** (`frontOfficeService.ts`,
      `front_office_logs`), **Discipline** (`disciplineService.ts`,
      `disciplinary_records`), **Medical** (`medicalService.ts`,
      `student_medical`). Discipline/Medical share a new
      `src/components/StudentPicker.tsx` (type-to-search against
      `fetchStudentDirectory()`) for attaching a record to an enrolled
      student.
    - **Cross-role Notices**: web's `DashboardLayout.tsx` shows the same
      notices to every signed-in role via its notification popover with no
      audience filter, so this is real parity, not scope creep. Added a
      read-only `NoticesModal.tsx` (shared component) opened from a new
      quick-link on `StudentHomeScreen.tsx` and a header button on
      `TeacherTodayScreen.tsx`.
      **Not ported this pass** (checked against web, intentionally
      out of scope for now — see the roadmap for when): SchoolCalendar and
      OnlineClasses stay Admin-only, matching web (grepped web source —
      it never surfaces `holidays`/`online_classes` to student/teacher
      portals either, so a mobile student/teacher calendar view would
      exceed web parity, not match it). SMS Campaigns/Email
      Broadcasts/Push Alerts tabs of Communication, and every module in
      Phases 2–6 of the roadmap (Library/Transport/Inventory/Hostel,
      Employees/Reports/Certificates, deeper Academics/Examination/
      Admissions, SystemManagement, AI Assistant, Google Classroom/Forms)
      remain to be built.
      `npx tsc --noEmit` passes clean. Not yet verified live against the
      Supabase project (no device/emulator run from here this pass) — do
      that before treating Phase 1 as fully done.
- [x] Web parity — Phase 2 of the roadmap: the three multi-tab "campus
      operations" modules, added as three more `More`-tab stack screens
      (`MoreNavigator.tsx`, `MoreScreen.tsx`'s new "Campus operations"
      section) with a new shared `src/components/SegmentedTabs.tsx` pill
      switcher for their sub-views:
    - **Library** (`libraryService.ts`, `LibraryScreen.tsx`) — Catalog
      (`library_books`: create/edit/delete) and Issues & Fines
      (`book_issues`: issue a book to a student or staff member via a
      type-to-search book picker + the shared `StudentPicker`, mark
      returned with automatic overdue-fine calculation, waive a fine).
      Web's Categories tab (derived from `books.category`, no real table)
      and Fines tab (a filtered view of issues with `fine_amount > 0`) are
      folded into these two real tables rather than built as separate
      screens — same data, no separate UI needed.
    - **Transport** (`transportService.ts`, `TransportScreen.tsx`) —
      Routes/Vehicles/Drivers/Allotments, all full CRUD, mirroring web's
      four tabs exactly (`transport_routes`, `vehicles`, `drivers`,
      `student_transport`). Preserves web's business rules: one driver per
      bus (assigning a driver to a vehicle clears any other driver already
      on it), an allotment's vehicle follows its route unless overridden,
      one allotment per student (duplicate-key error surfaced as a plain
      message instead of a raw Postgres error).
    - **Hostel** (`hostelService.ts`, `HostelScreen.tsx`) — Hostels and
      Rooms tabs only (`hostels`, `rooms`). **Not ported:** web's own
      Allocations and Visitors tabs — checked `HostelManagement.tsx`'s
      `loadData()` and confirmed it never queries `hostel_allocations` /
      `hostel_visitors`; the page shows a "run this migration" SQL
      snippet for those tables instead of live data. They aren't real on
      web either, so building them on mobile would exceed web parity, not
      match it.
      Discipline/Medical's inline student picker was factored out into
      `src/components/StudentPicker.tsx` during Phase 1 and is now reused
      by Library (issuing to a student) and Transport (allotments) too.
      `npx tsc --noEmit` passes clean. As with Phase 1, not yet verified
      live against the Supabase project from here — needs a device/
      emulator pass before being treated as fully done. Phases 3–6
      (Employees/Reports/Inventory/Certificates, deeper Academics/
      Examination/Admissions, SystemManagement, AI Assistant, Google
      Classroom/Forms) remain.
- [x] Web parity — Phase 3 of the roadmap: the "Back office" section of the
      `More` tab. New dependencies: `expo-print`, `expo-sharing`,
      `expo-file-system` (`npx expo install`, added to `app.json`'s
      `plugins` automatically) — mobile's first file-export/PDF tooling,
      via a new `src/lib/exportFile.ts` (share a CSV or an HTML-rendered
      PDF through the OS share sheet — mobile has no browser "download"
      to trigger, so this is the RN equivalent of web's Blob-download
      pattern) and `src/lib/csv.ts` (ported flattenRow/toCSV helpers).
    - **Employees** (`employeeService.ts`, `EmployeesScreen.tsx`) — `staff`
      table CRUD, structured closely on `AdminTeachersScreen.tsx`. Status
      changes go through the `set_staff_status` RPC (not a plain table
      update) via a separate small modal, matching web's separation of
      "edit details" from "change lifecycle status."
    - **Inventory** (`inventoryService.ts`, `InventoryScreen.tsx`) —
      Assets/Stock/Vendors/Orders, all full CRUD, mirroring web's four
      tabs and their derived-status logic exactly (stock status computed
      from quantity vs. reorder level; a purchase order's `vendor_id` is
      looked up from the selected vendor name, same as web).
    - **Reports** (`reportsService.ts`, `ReportsScreen.tsx`) — the 9
      curated named reports from web's `REPORT_EXPORTERS` registry
      (Class-wise Result Data, Subject Performance Index, Student Honor
      Roll, Revenue Collection Log, Overdue Fee Statements, Daily Cash
      Transaction, Teacher Workload Audit, Facility & Asset Register,
      Attendance Audit), each generating the exact same CSV web would and
      handing it to the share sheet instead of a browser download.
      **Not ported:** web's separate `CUSTOM_DATASETS` registry ('Fee
      Records', 'Exam Marks', 'Attendance') — raw table dumps that
      overlap with the curated reports above (e.g. 'Exam Marks' is the
      same query as 'Class-wise Result Data'), lower value, skipped
      rather than duplicating work.
    - **Certificates** (`certificateService.ts`, `CertificatesScreen.tsx`)
      — all 7 certificate types (Excellence, Transfer/TC, Bonafide,
      Character, Migration, Study Completion, Fee Clearance), with
      `composeBodyText()` ported field-for-field from web's
      `getAutoBodyText()` so the generated wording matches exactly.
      **Design decision, not a straight port:** web renders the
      certificate as styled DOM and rasterizes it with `html2canvas` +
      `jsPDF` — no DOM exists in React Native. Mobile instead renders a
      static HTML string through `expo-print` (`Print.printToFileAsync`)
      and shares the resulting real PDF. **Not ported:** web's multiple
      selectable border themes/color palettes — mobile uses one clean
      layout for every certificate; only the per-type body text and
      required fields were ported exactly, not the visual theme picker.
      The student picker autofills admission number and parent names from
      the selected student's own record (available on the `Student` type
      already fetched by `StudentPicker`) rather than requiring re-entry.
      `npx tsc --noEmit` passes clean. Not yet verified live — in
      particular the `expo-print` PDF output and CSV share-sheet flow
      need an actual on-device run before being treated as done, since
      neither can be meaningfully checked by type-checking alone. Phases
      4–6 (deeper Academics/Examination/Admissions, SystemManagement, AI
      Assistant, Google Classroom/Forms) remain.
- [x] APK made downloadable from the web app. Ran
      `eas build --platform android --profile preview` (already logged in as
      `suraj_nsd`) against the current `main`-branch commit
      (`f9bbfd8`) — finished build id `58967928-3b39-4ee6-a944-631f934a17d7`,
      artifact `https://expo.dev/artifacts/eas/yydTZOgQXrnbA51hwSI1xyH_yYKdUvhRYWNCfwSTdBM.apk`
      (83MB). Linked directly from that URL rather than committing the
      binary into the repo — added a "Download Android App (APK)" link to
      `../src/pages/Login.tsx`'s footer area (the real portal entry point,
      not `MarketingLanding.tsx`, which is a separate sales pitch page for
      other schools). **Caveat:** EAS internal-distribution build artifacts
      on the free plan expire ~30 days after the build finishes; once this
      one expires the link 404s and a fresh `eas build --platform android
      --profile preview` + updating the URL in `Login.tsx` is needed. For a
      link that never expires, self-host the APK instead (e.g. upload it as
      a GitHub Release asset or drop it in `public/` and serve it from the
      Vercel deployment) — not done here since 83MB is large to commit to
      git.
