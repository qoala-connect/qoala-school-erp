/**
 * Seeds the Library module with a demo catalog and borrowing ledger.
 *
 * Usage:  node scripts/seed_library.mjs           (insert / refresh)
 *         node scripts/seed_library.mjs --reset   (wipe seeded rows first)
 *
 * Books are keyed by ISBN so re-running is idempotent. Issues are derived from
 * the seeded books plus whatever students already exist, and are spread across
 * issued / returned / overdue so every tab, filter and KPI on
 * LibraryManagement.tsx has something to show.
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const day = 86400000;
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
const today = Date.now();

// title, author, publisher, category, rack, isbn, copies_total, copies_available
const BOOKS = [
  ['Mathematics Textbook for Class X', 'NCERT', 'NCERT', 'Mathematics', 'A-1', '978-81-7450-634-4', 40, 31],
  ['Higher Engineering Mathematics', 'B. S. Grewal', 'Khanna Publishers', 'Mathematics', 'A-2', '978-81-9331-421-1', 12, 9],
  ['Secondary School Mathematics IX', 'R. S. Aggarwal', 'Bharati Bhawan', 'Mathematics', 'A-2', '978-93-5027-617-2', 25, 22],
  ['Science Textbook for Class IX', 'NCERT', 'NCERT', 'Science', 'B-1', '978-81-7450-635-1', 45, 38],
  ['Concepts of Physics, Part 1', 'H. C. Verma', 'Bharati Bhawan', 'Science', 'B-2', '978-81-7709-187-8', 18, 14],
  ['Fundamentals of Physics', 'Halliday and Resnick', 'Wiley', 'Science', 'B-2', '978-11-1823-072-5', 10, 8],
  ['Chemistry for Class XI, Part 1', 'NCERT', 'NCERT', 'Science', 'B-3', '978-81-7450-641-2', 30, 27],
  ['Biology: Concepts and Connections', 'Neil A. Campbell', 'Pearson', 'Science', 'B-3', '978-03-2188-532-6', 8, 5],
  ['Honeydew: English Textbook Class VIII', 'NCERT', 'NCERT', 'English Literature', 'C-1', '978-81-7450-829-4', 50, 41],
  ['Wings of Fire: An Autobiography', 'A. P. J. Abdul Kalam', 'Universities Press', 'English Literature', 'C-2', '978-81-7371-146-6', 15, 10],
  ['The Adventures of Tom Sawyer', 'Mark Twain', 'Penguin Classics', 'English Literature', 'C-2', '978-01-4350-490-4', 12, 9],
  ['A Wrinkle in Time', 'Madeleine LEngle', 'Square Fish', 'English Literature', 'C-3', '978-03-1236-754-1', 10, 7],
  ['Oxford Advanced Learners Dictionary', 'A. S. Hornby', 'Oxford University Press', 'Reference', 'D-1', '978-01-9479-849-2', 6, 4],
  ['Encyclopaedia Britannica Junior', 'Editorial Board', 'Britannica', 'Reference', 'D-1', '978-08-5229-961-7', 4, 3],
  ['Bharat Ki Khoj', 'Jawaharlal Nehru', 'NCERT', 'Hindi Literature', 'E-1', '978-81-7450-644-3', 20, 16],
  ['Godaan', 'Munshi Premchand', 'Lokbharti Prakashan', 'Hindi Literature', 'E-1', '978-81-8031-289-1', 14, 11],
  ['Rashmirathi', 'Ramdhari Singh Dinkar', 'Lokbharti Prakashan', 'Hindi Literature', 'E-2', '978-81-8031-461-1', 10, 8],
  ['India and the Contemporary World II', 'NCERT', 'NCERT', 'Social Science', 'F-1', '978-81-7450-708-2', 35, 30],
  ['Contemporary India II: Geography', 'NCERT', 'NCERT', 'Social Science', 'F-1', '978-81-7450-709-9', 35, 32],
  ['A Brief History of Time', 'Stephen Hawking', 'Bantam', 'Social Science', 'F-2', '978-05-5338-016-3', 6, 4],
  ['Computer Science with Python, Class XI', 'Sumita Arora', 'Dhanpat Rai', 'Computer Science', 'G-1', '978-81-7700-231-8', 22, 17],
  ['Let Us C', 'Yashavant Kanetkar', 'BPB Publications', 'Computer Science', 'G-1', '978-93-8828-449-4', 12, 10],
  ['Introduction to Algorithms', 'Cormen et al.', 'MIT Press', 'Computer Science', 'G-2', '978-02-6204-630-5', 5, 3],
  ['Indian Art and Culture', 'Nitin Singhania', 'McGraw Hill', 'Arts and Culture', 'H-1', '978-93-5316-050-1', 8, 6],
  ['The Story of Art', 'E. H. Gombrich', 'Phaidon Press', 'Arts and Culture', 'H-1', '978-07-1483-355-2', 5, 4],
  ['Rules of the Game: Sports Handbook', 'Diagram Group', 'St Martins Press', 'Sports and Health', 'H-2', '978-03-1233-891-6', 6, 5],
];

const ISBNS = BOOKS.map((b) => b[5]);

async function reset() {
  const { data: seeded } = await sb.from('library_books').select('id').in('isbn', ISBNS);
  const ids = (seeded || []).map((b) => b.id);
  if (ids.length) {
    await sb.from('book_issues').delete().in('book_id', ids);
    await sb.from('library_books').delete().in('id', ids);
  }
  console.log(`reset: removed ${ids.length} seeded books and their issues`);
}

async function seedBooks() {
  const rows = BOOKS.map(([title, author, publisher, category, rack_number, isbn, copies_total, copies_available]) => ({
    title, author, publisher, category, rack_number, isbn, copies_total, copies_available, is_active: true,
  }));
  const { error } = await sb.from('library_books').upsert(rows, { onConflict: 'isbn' });
  if (error) throw new Error('books: ' + error.message);

  const { data } = await sb.from('library_books').select('*').in('isbn', ISBNS);
  console.log(`books: ${data.length} in catalog across ${new Set(data.map((b) => b.category)).size} categories`);
  return data;
}

async function seedIssues(books) {
  const { data: students } = await sb.from('students').select('id, name').order('name').limit(40);
  if (!students?.length) throw new Error('no students available to borrow books');

  const staff = ['Shri Rajesh Dubey', 'Smt. Meera Sen', 'Shri Anil Verma'];
  const byIsbn = Object.fromEntries(books.map((b) => [b.isbn, b]));

  // isbn, issuedDaysAgo, loanDays, returnedDaysAgo (null = still out), fine
  const plan = [
    ['978-81-7450-634-4', 20, 14, null, 60],
    ['978-81-9331-421-1', 30, 14, null, 160],
    ['978-81-7450-635-1', 5, 14, null, 0],
    ['978-81-7709-187-8', 9, 14, null, 0],
    ['978-81-7450-829-4', 40, 14, 28, 120],
    ['978-81-7371-146-6', 45, 21, 18, 90],
    ['978-01-4350-490-4', 3, 14, null, 0],
    ['978-81-7450-644-3', 26, 14, null, 120],
    ['978-81-8031-289-1', 60, 21, 55, 0],
    ['978-81-7450-708-2', 12, 21, null, 0],
    ['978-81-7700-231-8', 33, 14, null, 190],
    ['978-93-8828-449-4', 70, 14, 62, 40],
    ['978-02-6204-630-5', 7, 14, null, 0],
    ['978-03-2188-532-6', 2, 14, null, 0],
    ['978-93-5316-050-1', 50, 14, 44, 0],
    ['978-01-9479-849-2', 18, 7, null, 110],
    ['978-81-7450-641-2', 4, 14, null, 0],
    ['978-05-5338-016-3', 24, 14, null, 80],
  ];

  const rows = plan.map(([isbn, issuedAgo, loanDays, returnedAgo, fine], i) => {
    // Every fifth loan goes to a staff member, the rest to students.
    const asStaff = i % 5 === 4;
    const issue_date = iso(today - issuedAgo * day);
    const due_date = iso(today - (issuedAgo - loanDays) * day);
    const return_date = returnedAgo === null ? null : iso(today - returnedAgo * day);
    const overdue = return_date === null && new Date(due_date) < new Date(iso(today));
    return {
      book_id: byIsbn[isbn].id,
      student_id: asStaff ? null : students[i % students.length].id,
      borrower_name: asStaff ? staff[i % staff.length] : students[i % students.length].name,
      borrower_role: asStaff ? 'Staff' : 'Student',
      issue_date,
      due_date,
      return_date,
      status: return_date ? 'returned' : overdue ? 'overdue' : 'issued',
      fine_amount: fine,
      // A returned book that still owes a fine is the interesting case for the
      // Fines tab, so only the long-settled loans are marked paid.
      fine_paid: fine > 0 && returnedAgo !== null && returnedAgo > 60,
    };
  });

  const { error } = await sb.from('book_issues').insert(rows);
  if (error) throw new Error('issues: ' + error.message);

  const onLoan = rows.filter((r) => !r.return_date).length;
  const overdue = rows.filter((r) => r.status === 'overdue').length;
  const owed = rows.filter((r) => r.fine_amount > 0 && !r.fine_paid).reduce((a, r) => a + r.fine_amount, 0);
  console.log(`issues: ${rows.length} logged - ${onLoan} on loan (${overdue} overdue), Rs ${owed} in unpaid fines`);
}

if (process.argv.includes('--reset')) await reset();
const books = await seedBooks();
await seedIssues(books);
console.log('library seed complete');
