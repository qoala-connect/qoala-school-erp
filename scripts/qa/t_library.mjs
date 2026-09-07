// Library module — catalog, categories, borrowing ledger and fines.
// Every query and payload below mirrors LibraryManagement.tsx, so a failure
// here is a failure of that page.
import { asAdmin, ok, assert, check, module, refs, uniq, trashIt } from './_harness.mjs';

const day = 86400000;
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);

export default async function run() {
  module('Library');
  const { sb } = await asAdmin();
  const r = await refs();
  const student = r.students[0];
  let bookId = null;
  let issueId = null;

  await check('Library', 'Page load reads catalog + ledger + roll', async () => {
    // LibraryManagement.tsx loadData(). The students embed on book_issues is
    // the one that used to fail outright and silently empty the ledger.
    const books = ok(await sb.from('library_books').select('*').order('title'), 'select library_books');
    const issues = ok(
      await sb.from('book_issues').select('*, library_books(title), students(name)').order('issue_date', { ascending: false }),
      'select book_issues + embeds'
    );
    assert(books.length > 0, 'catalog is empty — run scripts/seed_library.mjs');
    assert(issues.length > 0, 'ledger is empty — run scripts/seed_library.mjs');
    const cats = new Set(books.map((b) => b.category || 'General'));
    return `${books.length} books, ${cats.size} categories, ${issues.length} issues`;
  });

  await check('Library/Books', 'Add book with a brand new category', async () => {
    const payload = {
      title: uniq('QA Library Title'),
      author: 'QA Author',
      isbn: 'QA-' + Math.floor(Math.random() * 1e9),
      category: 'QA Category',
      rack_number: 'Z-9',
      copies_total: 4,
      copies_available: 4,
    };
    const data = ok(await sb.from('library_books').insert([payload]).select().single(), 'insert library_books');
    bookId = data.id;
    trashIt('library_books', bookId);
    assert(data.category === 'QA Category', 'category not persisted');
    return 'ok';
  });

  await check('Library/Issues', 'Issue book to a student decrements stock', async () => {
    assert(bookId, 'no book');
    const before = ok(await sb.from('library_books').select('copies_available').eq('id', bookId).single(), 'read stock');
    const payload = {
      book_id: bookId,
      student_id: student.id,
      borrower_name: student.name,
      borrower_role: 'Student',
      issue_date: iso(Date.now()),
      due_date: iso(Date.now() + 14 * day),
      status: 'issued',
    };
    const data = ok(await sb.from('book_issues').insert([payload]).select().single(), 'insert book_issues');
    issueId = data.id;
    trashIt('book_issues', issueId);

    ok(await sb.from('library_books').update({ copies_available: before.copies_available - 1 }).eq('id', bookId), 'decrement stock');
    const after = ok(await sb.from('library_books').select('copies_available').eq('id', bookId).single(), 'reread stock');
    assert(after.copies_available === before.copies_available - 1, 'stock not decremented');
    assert(data.student_id === student.id, 'student_id not persisted');
    return `${before.copies_available} -> ${after.copies_available} available`;
  });

  await check('Library/Issues', 'Ledger resolves the borrower and the title', async () => {
    assert(issueId, 'no issue');
    const row = ok(
      await sb.from('book_issues').select('*, library_books(title), students(name)').eq('id', issueId).single(),
      'select issue with embeds'
    );
    assert(row.borrower_name === student.name, 'borrower_name missing');
    assert(row.students?.name === student.name, 'students embed did not resolve');
    assert(row.library_books?.title, 'library_books embed did not resolve');
    return 'ok';
  });

  await check('Library/Issues', 'Overdue return raises a fine and restores stock', async () => {
    assert(bookId && issueId, 'no issue');
    // Backdate the loan so the return is genuinely late.
    ok(await sb.from('book_issues').update({ issue_date: iso(Date.now() - 30 * day), due_date: iso(Date.now() - 10 * day) }).eq('id', issueId), 'backdate loan');

    const before = ok(await sb.from('library_books').select('copies_available').eq('id', bookId).single(), 'read stock');
    const fine = 10 * 2; // 10 days late at the page's ₹2/day
    ok(await sb.from('book_issues').update({ status: 'returned', return_date: iso(Date.now()), fine_amount: fine }).eq('id', issueId), 'return book');
    ok(await sb.from('library_books').update({ copies_available: before.copies_available + 1 }).eq('id', bookId), 'restore stock');

    const row = ok(await sb.from('book_issues').select('status, return_date, fine_amount, fine_paid').eq('id', issueId).single(), 'reread issue');
    const after = ok(await sb.from('library_books').select('copies_available').eq('id', bookId).single(), 'reread stock');
    assert(row.status === 'returned' && row.return_date, 'return not recorded');
    assert(Number(row.fine_amount) === fine, 'fine not raised');
    assert(row.fine_paid === false, 'a returned book must not auto-settle its fine');
    assert(after.copies_available === before.copies_available + 1, 'stock not restored');
    return `₹${fine} fine, still unpaid`;
  });

  await check('Library/Fines', 'Collect settles the fine without touching the loan', async () => {
    assert(issueId, 'no issue');
    ok(await sb.from('book_issues').update({ fine_paid: true }).eq('id', issueId), 'collect fine');
    const row = ok(await sb.from('book_issues').select('fine_paid, fine_amount, return_date').eq('id', issueId).single(), 'reread issue');
    assert(row.fine_paid === true, 'fine not marked collected');
    assert(Number(row.fine_amount) > 0, 'collecting must not erase the amount');
    return 'ok';
  });

  await check('Library/Categories', 'Rename restamps every book in the category', async () => {
    assert(bookId, 'no book');
    ok(await sb.from('library_books').update({ category: 'QA Category Renamed' }).eq('category', 'QA Category'), 'rename category');
    const row = ok(await sb.from('library_books').select('category').eq('id', bookId).single(), 'reread book');
    assert(row.category === 'QA Category Renamed', 'rename did not apply');
    return 'ok';
  });

  await check('Library/Categories', 'Delete empties the category into General', async () => {
    assert(bookId, 'no book');
    ok(await sb.from('library_books').update({ category: 'General' }).eq('category', 'QA Category Renamed'), 'delete category');
    const row = ok(await sb.from('library_books').select('category').eq('id', bookId).single(), 'reread book');
    assert(row.category === 'General', 'books not reassigned');
    return 'ok';
  });

  await check('Library/Fines', 'Waive clears the charge but keeps the loan', async () => {
    assert(issueId, 'no issue');
    ok(await sb.from('book_issues').update({ fine_amount: 0, fine_paid: false }).eq('id', issueId), 'waive fine');
    const row = ok(await sb.from('book_issues').select('id, fine_amount').eq('id', issueId).maybeSingle(), 'reread issue');
    assert(row, 'waiving a fine must not delete the loan');
    assert(Number(row.fine_amount) === 0, 'fine not cleared');
    return 'ok';
  });

  await check('Library/Student360', 'Student drawer finds the loans by student_id', async () => {
    const rows = ok(
      await sb.from('book_issues').select('*, library_books(title, author, isbn)')
        .or(`student_id.eq.${student.id},borrower_name.ilike.%${student.name}%`)
        .order('issue_date', { ascending: false }),
      'drawer library query'
    );
    assert(Array.isArray(rows), 'drawer query failed');
    return `${rows.length} loans for ${student.name}`;
  });
}
