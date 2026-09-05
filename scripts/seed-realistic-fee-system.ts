import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Realistic CBSE Fee Categories
const FEE_CATEGORIES = [
  {
    name: 'Composite Annual Fee',
    frequency: 'Annual',
    amount: 12000,
    description: 'Comprehensive annual tuition, library, smart classroom, sports and institutional development fee'
  },
  {
    name: 'Tuition Fee',
    frequency: 'Monthly',
    amount: 3200,
    description: 'Monthly classroom academic instruction and curriculum delivery'
  },
  {
    name: 'Examination & Assessment Fee',
    frequency: 'Term-wise',
    amount: 2000,
    description: 'CBSE terminal assessments, periodic tests, and progress report card issuance'
  },
  {
    name: 'Computer & Science Lab Fee',
    frequency: 'Annual',
    amount: 2500,
    description: 'Hands-on practicals in Science (Physics, Chem, Bio) and Computer Robotics labs'
  },
  {
    name: 'School Transport Fee',
    frequency: 'Monthly',
    amount: 1500,
    description: 'Safe GPS-enabled school bus transit conveyance'
  },
  {
    name: 'Annual Activity & Sports Fee',
    frequency: 'Annual',
    amount: 1800,
    description: 'Sports equipment, annual function, athletic meet, and co-curricular programs'
  }
];

// Class-specific annual base fee amounts (graduated realistically by academic level)
function getClassRates(className: string) {
  switch (className) {
    case 'LKG':
      return { tuition: 1800, composite: 5000, exam: 1000, lab: 0, activity: 1500, transport: 1200 };
    case '1':
      return { tuition: 2200, composite: 6000, exam: 1200, lab: 1000, activity: 1800, transport: 1500 };
    case '2':
      return { tuition: 2300, composite: 6200, exam: 1200, lab: 1000, activity: 1800, transport: 1500 };
    case '3':
      return { tuition: 2400, composite: 6500, exam: 1400, lab: 1200, activity: 1800, transport: 1500 };
    case '4':
      return { tuition: 2500, composite: 6800, exam: 1400, lab: 1200, activity: 1800, transport: 1500 };
    case '5':
      return { tuition: 2600, composite: 7000, exam: 1500, lab: 1500, activity: 1800, transport: 1500 };
    case '6':
      return { tuition: 2900, composite: 7800, exam: 1800, lab: 1800, activity: 2000, transport: 1500 };
    case '7':
      return { tuition: 3100, composite: 8200, exam: 1800, lab: 2000, activity: 2000, transport: 1500 };
    case '8':
      return { tuition: 3300, composite: 8500, exam: 2000, lab: 2200, activity: 2000, transport: 1500 };
    case '9':
      return { tuition: 3700, composite: 9500, exam: 2500, lab: 2500, activity: 2200, transport: 1500 };
    case '10':
      return { tuition: 4000, composite: 10000, exam: 3000, lab: 3000, activity: 2200, transport: 1500 };
    case '11':
      return { tuition: 4500, composite: 12000, exam: 3500, lab: 3800, activity: 2500, transport: 1500 };
    case '12':
      return { tuition: 4800, composite: 12500, exam: 4000, lab: 4200, activity: 2500, transport: 1500 };
    default:
      return { tuition: 3000, composite: 8000, exam: 2000, lab: 2000, activity: 2000, transport: 1500 };
  }
}

async function main() {
  console.log('🚀 Starting Realistic Fee Structure & Outstanding Ledger Seeding...');

  // 1. Get Academic Year 2026-27
  const { data: years, error: yrErr } = await supabase
    .from('academic_years')
    .select('id, name, is_current');
  if (yrErr || !years || years.length === 0) {
    throw new Error('No academic years found: ' + yrErr?.message);
  }
  const currentYear = years.find(y => y.is_current) || years.find(y => y.name === '2026-27') || years[0];
  console.log(`📅 Active Academic Year: ${currentYear.name} (${currentYear.id})`);

  // 2. Fetch and Standardize Fee Categories
  const { data: existingCats } = await supabase.from('fee_categories').select('*');
  const catMap: Record<string, string> = {};

  for (const cat of existingCats || []) {
    catMap[cat.category_name.toLowerCase().trim()] = cat.id;
  }

  for (const fc of FEE_CATEGORIES) {
    const key = fc.name.toLowerCase().trim();
    if (!catMap[key]) {
      const { data: inserted, error: insErr } = await supabase
        .from('fee_categories')
        .insert([{
          category_name: fc.name,
          frequency: fc.frequency,
          amount: fc.amount,
          description: fc.description,
          is_active: true
        }])
        .select()
        .single();
      if (insErr) {
        console.error(`Error inserting category ${fc.name}:`, insErr);
      } else if (inserted) {
        catMap[key] = inserted.id;
        console.log(`Created new fee category: ${fc.name} (${inserted.id})`);
      }
    } else {
      await supabase
        .from('fee_categories')
        .update({
          frequency: fc.frequency,
          amount: fc.amount,
          description: fc.description,
          is_active: true
        })
        .eq('id', catMap[key]);
    }
  }

  // Refresh category map
  const { data: updatedCats } = await supabase.from('fee_categories').select('*');
  const finalCatMap: Record<string, string> = {};
  for (const c of updatedCats || []) {
    finalCatMap[c.category_name] = c.id;
  }

  // 3. Fetch Classes
  const { data: classes, error: clsErr } = await supabase
    .from('classes')
    .select('id, class_name, display_order')
    .order('display_order');
  if (clsErr || !classes) throw new Error('Failed to fetch classes: ' + clsErr?.message);

  console.log(`🏫 Processing Fee Structure Matrix for ${classes.length} classes...`);

  // 4. Upsert Fee Structure Matrix for All Classes
  const compositeCatId = finalCatMap['Composite Annual Fee'] || updatedCats?.[0]?.id;
  const tuitionCatId = finalCatMap['Tuition Fee'];
  const examCatId = finalCatMap['Examination & Assessment Fee'];
  const labCatId = finalCatMap['Computer & Science Lab Fee'];
  const activityCatId = finalCatMap['Annual Activity & Sports Fee'];
  const transportCatId = finalCatMap['School Transport Fee'];

  const structureRows: any[] = [];

  for (const cls of classes) {
    const rates = getClassRates(cls.class_name);
    
    if (compositeCatId) {
      structureRows.push({
        class_id: cls.id,
        fee_category_id: compositeCatId,
        academic_year_id: currentYear.id,
        amount: rates.composite
      });
    }
    if (tuitionCatId) {
      structureRows.push({
        class_id: cls.id,
        fee_category_id: tuitionCatId,
        academic_year_id: currentYear.id,
        amount: rates.tuition
      });
    }
    if (examCatId) {
      structureRows.push({
        class_id: cls.id,
        fee_category_id: examCatId,
        academic_year_id: currentYear.id,
        amount: rates.exam
      });
    }
    if (labCatId && rates.lab > 0) {
      structureRows.push({
        class_id: cls.id,
        fee_category_id: labCatId,
        academic_year_id: currentYear.id,
        amount: rates.lab
      });
    }
    if (activityCatId) {
      structureRows.push({
        class_id: cls.id,
        fee_category_id: activityCatId,
        academic_year_id: currentYear.id,
        amount: rates.activity
      });
    }
    if (transportCatId) {
      structureRows.push({
        class_id: cls.id,
        fee_category_id: transportCatId,
        academic_year_id: currentYear.id,
        amount: rates.transport
      });
    }
  }

  for (const row of structureRows) {
    await supabase.from('fee_structure').upsert(row, {
      onConflict: 'class_id,fee_category_id,academic_year_id'
    });
  }
  console.log(`✅ Upserted ${structureRows.length} fee structure matrix rules.`);

  // 5. Fetch all Active Students
  const { data: students, error: studErr } = await supabase
    .from('students')
    .select('id, name, admission_number, roll_number, class, section, phone, father_name, status')
    .order('class')
    .order('section')
    .order('roll_number');

  if (studErr || !students) throw new Error('Failed to fetch students: ' + studErr?.message);
  console.log(`👥 Found ${students.length} total students across all classes and sections.`);

  // 6. Clean Existing Fee Records and Re-seed with High-Fidelity Realistic Data
  console.log('🧹 Synchronizing student fee ledgers and payment receipts...');
  await supabase.from('fee_payments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('student_fees').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  // Allowed payment modes according to fee_payments_payment_mode_check: 'cash', 'upi', 'bank', 'online'
  const validPaymentModes = ['upi', 'cash', 'bank', 'online'];
  const months = ['2026-04-10', '2026-05-10', '2026-06-10', '2026-07-10', '2026-08-10', '2026-09-02'];

  let totalBilled = 0;
  let totalCollected = 0;
  let totalOutstanding = 0;
  let paidCount = 0;
  let partialCount = 0;
  let pendingCount = 0;

  for (let i = 0; i < students.length; i++) {
    const student = students[i];
    const rates = getClassRates(student.class);

    // Realistic annual bundle demand: Composite Fee + 4 Quarters Tuition + Exam + Lab
    const annualDemand = rates.composite + (rates.tuition * 4) + rates.exam + rates.lab;
    
    const rollNum = parseInt(student.roll_number || '0') || ((i % 14) + 1);
    let discountAmount = 0;
    let scholarshipAmount = 0;

    if (rollNum === 1) {
      scholarshipAmount = Math.round(annualDemand * 0.15); // 15% Academic Merit Scholarship
    } else if (rollNum === 7) {
      discountAmount = Math.round(annualDemand * 0.10); // 10% Sibling Concession
    }

    const netAmount = annualDemand - discountAmount - scholarshipAmount;

    // Systematic per-section scenario distribution:
    // Out of every ~14 students in a section:
    // - Roll 4, 11 -> Partial (2 students)
    // - Roll 9, 13 -> Pending/Defaulter (2 students)
    // - All other rolls (1, 2, 3, 5, 6, 7, 8, 10, 12, 14, 15, ...) -> Fully Paid (~70%)
    let scenario: 'paid' | 'partial' | 'pending' = 'paid';
    if (rollNum === 4 || rollNum === 11) {
      scenario = 'partial';
    } else if (rollNum === 9 || rollNum === 13) {
      scenario = 'pending';
    }

    const dueDate = '2026-06-15';
    const fineAmount = scenario === 'pending' ? 250 : 0;
    const finalTotalDemand = annualDemand;
    const adjustedNetAmount = netAmount + fineAmount;

    totalBilled += adjustedNetAmount;

    // Insert student_fee ledger
    const { data: feeLedger, error: ledgerErr } = await supabase
      .from('student_fees')
      .insert([{
        student_id: student.id,
        fee_category_id: compositeCatId,
        academic_year_id: currentYear.id,
        total_amount: finalTotalDemand,
        discount_amount: discountAmount,
        scholarship_amount: scholarshipAmount,
        fine_amount: fineAmount,
        due_date: dueDate,
        status: 'pending' // trigger automatically computes 'paid'/'partial'/'pending' on payment sync
      }])
      .select()
      .single();

    if (ledgerErr || !feeLedger) {
      console.error(`Error creating fee ledger for ${student.name}:`, ledgerErr);
      continue;
    }

    // Insert Payment Records
    if (scenario === 'paid') {
      const mode = validPaymentModes[i % validPaymentModes.length];
      const pDate = months[i % months.length];
      const receiptNo = `REC-2026-${String(10000 + i).padStart(5, '0')}`;

      const { error: payErr } = await supabase.from('fee_payments').insert([{
        student_fee_id: feeLedger.id,
        amount_paid: adjustedNetAmount,
        payment_mode: mode,
        payment_date: pDate,
        receipt_number: receiptNo,
        transaction_id: mode === 'upi' ? `UPI/${pDate.replace(/-/g, '')}/${100000 + i}` : mode === 'bank' ? `NEFT-${2026000 + i}` : null,
        remarks: 'Institutional annual fee cleared in full'
      }]);

      if (payErr) {
        console.error(`Payment insert error for ${student.name}:`, payErr);
      } else {
        totalCollected += adjustedNetAmount;
        paidCount++;
      }
    } else if (scenario === 'partial') {
      // Paid ~50% of total
      const installment1 = Math.round(adjustedNetAmount * (0.45 + (i % 3) * 0.08));
      const mode = validPaymentModes[(i + 1) % validPaymentModes.length];
      const pDate = months[i % 4];
      const receiptNo = `REC-2026-${String(10000 + i).padStart(5, '0')}`;

      const { error: payErr } = await supabase.from('fee_payments').insert([{
        student_fee_id: feeLedger.id,
        amount_paid: installment1,
        payment_mode: mode,
        payment_date: pDate,
        receipt_number: receiptNo,
        transaction_id: mode === 'upi' ? `UPI/${pDate.replace(/-/g, '')}/${100000 + i}` : null,
        remarks: 'Part-payment installment 1 received. Remaining balance pending.'
      }]);

      if (payErr) {
        console.error(`Partial payment insert error for ${student.name}:`, payErr);
      } else {
        totalCollected += installment1;
        totalOutstanding += (adjustedNetAmount - installment1);
        partialCount++;
      }
    } else {
      // Pending / Defaulter: 0 paid
      totalOutstanding += adjustedNetAmount;
      pendingCount++;
    }
  }

  console.log('\n=============================================================');
  console.log('🎉 REALISTIC FEE SYSTEM SEEDING COMPLETED SUCCESSFULLY!');
  console.log('=============================================================');
  console.log(`📊 Total Students Processed : ${students.length}`);
  console.log(`💰 Total Financial Demand   : ₹${totalBilled.toLocaleString()}`);
  console.log(`✅ Total Realized Collection : ₹${totalCollected.toLocaleString()} (${Math.round((totalCollected / totalBilled) * 100)}%)`);
  console.log(`⚠️  Total Outstanding Dues   : ₹${totalOutstanding.toLocaleString()}`);
  console.log(`📈 Settlement Distribution   : ${paidCount} Paid (${Math.round(paidCount/students.length*100)}%) | ${partialCount} Partial (${Math.round(partialCount/students.length*100)}%) | ${pendingCount} Pending (${Math.round(pendingCount/students.length*100)}%)`);
  console.log('=============================================================\n');
}

main().catch(err => {
  console.error('Fatal error seeding fee system:', err);
  process.exit(1);
});
