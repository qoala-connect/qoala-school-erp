// Fees module — Fee Overview, Fee Collection & Ledgers, Fee Structure Master,
// Recent Transactions, Fee Reports & Overdues.
import { asAdmin, svc, ok, assert, check, module, refs, uniq, trashIt } from './_harness.mjs';

export default async function run() {
  module('Fees');
  const { sb } = await asAdmin();
  const r = await refs();
  const yr = r.currentYear;
  const cls = r.classes[0];
  const student = r.students[0];
  let categoryId = null, studentFeeId = null, paymentId = null;

  // --- Page: Fees > Fee Structure Master > categories
  await check('Fees/Structure', 'Load fee categories (select fee_categories)', async () => {
    const data = ok(await sb.from('fee_categories').select('*').order('category_name'), 'select fee_categories');
    assert(Array.isArray(data), 'not an array');
    return `${data.length} categories`;
  });

  await check('Fees/Structure', 'Create fee category (insert fee_categories)', async () => {
    const data = ok(await sb.from('fee_categories').insert({
      category_name: uniq('FeeCat').slice(0, 40), description: 'QA category',
      frequency: 'Monthly', amount: 1000, is_active: true,
    }).select().single(), 'insert fee_categories');
    categoryId = data.id; trashIt('fee_categories', categoryId);
    return 'ok';
  });

  await check('Fees/Structure', 'Edit fee category — every frequency option (update fee_categories)', async () => {
    assert(categoryId, 'no category');
    // Exactly the options in the "Billing Frequency" <select>.
    const freqs = ['Monthly', 'Quarterly', 'Term', 'Annual', 'One-time'];
    for (const f of freqs) {
      ok(await sb.from('fee_categories').update({ frequency: f }).eq('id', categoryId).select().single(), `frequency "${f}"`);
    }
    const data = ok(await sb.from('fee_categories').update({
      description: 'QA edited', amount: 1500,
    }).eq('id', categoryId).select().single(), 'update fee_categories');
    assert(Number(data.amount) === 1500, 'amount did not persist');
    return `${freqs.length} frequencies`;
  });

  // --- Page: Fees > Fee Structure Master > per-class amounts
  await check('Fees/Structure', 'Set class fee amount (upsert fee_structure)', async () => {
    assert(categoryId, 'no category');
    ok(await sb.from('fee_structure').upsert({
      class_id: cls.id, fee_category_id: categoryId, academic_year_id: yr.id, amount: 2500,
    }, { onConflict: 'class_id,fee_category_id,academic_year_id' }), 'upsert fee_structure');
    const row = ok(await sb.from('fee_structure').select('id,amount')
      .eq('class_id', cls.id).eq('fee_category_id', categoryId).eq('academic_year_id', yr.id).maybeSingle(), 'reread');
    assert(row && Number(row.amount) === 2500, 'fee_structure amount did not persist');
    trashIt('fee_structure', row.id);
    return 'ok';
  });

  await check('Fees/Structure', 'Batch save class fees (upsert fee_structure x N)', async () => {
    assert(categoryId, 'no category');
    const rows = r.classes.slice(0, 3).map((c, i) => ({
      class_id: c.id, fee_category_id: categoryId, academic_year_id: yr.id, amount: 1000 + i * 100,
    }));
    ok(await sb.from('fee_structure').upsert(rows, { onConflict: 'class_id,fee_category_id,academic_year_id' }), 'batch upsert');
    const saved = ok(await sb.from('fee_structure').select('id').eq('fee_category_id', categoryId), 'reread');
    for (const x of saved) trashIt('fee_structure', x.id);
    assert(saved.length >= rows.length, `saved ${saved.length} of ${rows.length}`);
    return `${saved.length} rows`;
  });

  // --- Page: Fees > Fee Collection & Ledgers > assign obligation
  await check('Fees/Ledgers', 'Assign fee to student (insert student_fees)', async () => {
    assert(categoryId && student, 'no category/student');
    const data = ok(await sb.from('student_fees').insert([{
      student_id: student.id, fee_category_id: categoryId, academic_year_id: yr.id,
      total_amount: 2000, discount_amount: 100, fine_amount: 0, due_date: '2030-06-30',
    }]).select().single(), 'insert student_fees');
    studentFeeId = data.id; trashIt('student_fees', studentFeeId);
    assert(data.net_amount != null, 'net_amount not computed by trigger');
    return `net=${data.net_amount}`;
  });

  await check('Fees/Ledgers', 'Load ledger rows (select student_fees join)', async () => {
    const data = ok(await sb.from('student_fees')
      .select('id, total_amount, discount_amount, net_amount, amount_paid, status, due_date, students:student_id(name, class, section), fee_categories:fee_category_id(category_name)')
      .limit(100), 'select student_fees');
    assert(Array.isArray(data), 'not an array');
    return `${data.length} rows`;
  });

  // --- Page: Fees > Fee Collection modal (rpc collect_fee)
  await check('Fees/Collection', 'Collect payment — every payment mode (rpc collect_fee)', async () => {
    assert(categoryId && student, 'no category/student');
    // Exactly the four buttons rendered by FeeCollectionModal.
    const modes = ['cash', 'upi', 'bank', 'online'];
    const receipts = new Set();
    for (const mode of modes) {
      const data = ok(await sb.rpc('collect_fee', {
        _student_id: student.id, _fee_category_id: categoryId, _amount: 100,
        _payment_mode: mode, _academic_year_id: yr.id, _total_amount: 2000,
        _discount_amount: 100, _fine_amount: 0, _due_date: '2030-06-30',
        _payment_date: new Date().toISOString().slice(0, 10),
        _transaction_id: null, _remarks: `QA collection ${mode}`,
      }), `rpc collect_fee "${mode}"`);
      const res = Array.isArray(data) ? data[0] : data;
      assert(res && res.payment_id, `collect_fee returned no payment_id: ${JSON.stringify(res)}`);
      assert(res.receipt_number, 'no receipt number generated');
      receipts.add(res.receipt_number);
      paymentId = res.payment_id;
      trashIt('fee_payments', res.payment_id);
    }
    assert(receipts.size === modes.length, `duplicate receipt numbers issued (${receipts.size} unique for ${modes.length} payments)`);
    return `${modes.length} modes, ${receipts.size} unique receipts`;
  });

  // --- Page: Fees > Recent Transactions
  await check('Fees/Transactions', 'Load transactions (select fee_payments join)', async () => {
    const data = ok(await sb.from('fee_payments')
      .select('id, receipt_number, amount_paid, payment_mode, payment_date, voided_at, student_fees:student_fee_id(student_id)')
      .order('payment_date', { ascending: false }).limit(100), 'select fee_payments');
    assert(Array.isArray(data), 'not an array');
    return `${data.length} rows`;
  });

  // --- Page: Fees > Void payment (rpc void_fee_payment)
  await check('Fees/Transactions', 'Void payment (rpc void_fee_payment)', async () => {
    assert(paymentId, 'no payment');
    ok(await sb.rpc('void_fee_payment', { _payment_id: paymentId, _reason: 'QA void' }), 'rpc void_fee_payment');
    const row = ok(await sb.from('fee_payments').select('voided_at,void_reason').eq('id', paymentId).single(), 'reread');
    assert(row.voided_at, 'void did not persist');
    return 'ok';
  });

  await check('Fees/Transactions', 'Void rolls the ledger back by exactly the voided amount', async () => {
    assert(categoryId && student, 'no category/student');
    // The ledger the collect_fee RPC actually settled against.
    const sf = ok(await sb.from('student_fees').select('id, amount_paid')
      .eq('student_id', student.id).eq('fee_category_id', categoryId)
      .eq('academic_year_id', yr.id).maybeSingle(), 'find settled ledger');
    assert(sf, 'collect_fee did not create/attach a student_fees ledger');

    const live = ok(await sb.from('fee_payments').select('id, amount_paid')
      .eq('student_fee_id', sf.id).is('voided_at', null), 'live payments');
    const liveTotal = live.reduce((a, x) => a + Number(x.amount_paid), 0);
    assert(Number(sf.amount_paid || 0) === liveTotal,
      `ledger amount_paid=${sf.amount_paid} but non-voided payments total ${liveTotal} — void did not roll the balance back`);
    return `amount_paid=${sf.amount_paid} matches ${live.length} live payments`;
  });

  // --- Page: Fees > Fee Reports & Overdues
  await check('Fees/Reports', 'Load collection summary (select student_fees aggregate)', async () => {
    const data = ok(await sb.from('student_fees')
      .select('net_amount, amount_paid, status, academic_year_id')
      .eq('academic_year_id', yr.id).limit(1000), 'select student_fees aggregate');
    assert(Array.isArray(data), 'not an array');
    const billed = data.reduce((a, x) => a + Number(x.net_amount || 0), 0);
    const collected = data.reduce((a, x) => a + Number(x.amount_paid || 0), 0);
    return `billed=${billed.toFixed(0)} collected=${collected.toFixed(0)} over ${data.length} ledgers`;
  });

  await check('Fees/Reports', 'Load overdue report (select student_fees filtered)', async () => {
    const data = ok(await sb.from('student_fees')
      .select('id, net_amount, amount_paid, due_date, status, students:student_id(name, class, section)')
      .neq('status', 'paid').lte('due_date', new Date().toISOString().slice(0, 10))
      .order('due_date').limit(200), 'select overdues');
    assert(Array.isArray(data), 'not an array');
    return `${data.length} overdue`;
  });

  // --- Page: Fees > discounts / scholarships masters
  await check('Fees/Discounts', 'Create discount (insert discounts)', async () => {
    const data = ok(await sb.from('discounts').insert({
      discount_name: uniq('Disc').slice(0, 40), discount_type: 'percentage',
      value: 10, eligibility: 'QA', is_active: true,
    }).select().single(), 'insert discounts');
    trashIt('discounts', data.id);
    ok(await sb.from('discounts').update({ value: 15 }).eq('id', data.id), 'update discounts');
    return 'ok';
  });

  await check('Fees/Scholarships', 'Create scholarship (insert scholarships)', async () => {
    const data = ok(await sb.from('scholarships').insert({
      scholarship_name: uniq('Schol').slice(0, 40), amount: 5000, eligibility: 'QA', is_active: true,
    }).select().single(), 'insert scholarships');
    trashIt('scholarships', data.id);
    ok(await sb.from('scholarships').update({ amount: 6000 }).eq('id', data.id), 'update scholarships');
    return 'ok';
  });

  // --- Page: Fees > delete structure/category paths
  await check('Fees/Structure', 'Delete fee structure item (delete fee_structure)', async () => {
    assert(categoryId, 'no category');
    ok(await sb.from('fee_structure').delete().eq('fee_category_id', categoryId), 'delete fee_structure');
    const left = ok(await sb.from('fee_structure').select('id').eq('fee_category_id', categoryId), 'reread');
    assert(left.length === 0, `${left.length} structure rows survived delete`);
    return 'ok';
  });

  await check('Fees/Structure', 'Deactivate category in use (update fee_categories.is_active)', async () => {
    assert(categoryId, 'no category');
    ok(await sb.from('fee_categories').update({ is_active: false }).eq('id', categoryId), 'deactivate');
    const row = ok(await sb.from('fee_categories').select('is_active').eq('id', categoryId).single(), 'reread');
    assert(row.is_active === false, 'deactivate did not persist');
    return 'ok';
  });
}
