import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { executeTool } from '../src/server/aiTools.ts';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://cqylpqrharentkjmrymr.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

async function runTests() {
  console.log('=== RUNNING ENTERPRISE SCHOOL ERP AI TEST SUITE ===\n');

  // Test 1: Resolve Student Context (kuldip@school.com)
  console.log('1. Testing Student Role Boundary (kuldip@school.com)...');
  const studentContext = {
    user: { id: '7abb37b3-c74b-42f6-915d-a55070234b99', email: 'kuldip@school.com' },
    userId: '7abb37b3-c74b-42f6-915d-a55070234b99',
    email: 'kuldip@school.com',
    name: 'Kuldeep Shah',
    role: 'student',
    roleCategory: 'student',
    isAdmin: false,
    isTeacher: false,
    isStudent: true,
    studentId: '4eb94614-8d04-4798-9b51-9c91f4e1ff3e', // Kuldeep Shah
    studentName: 'Kuldeep Shah',
    studentClass: '8',
    studentSection: 'A',
    studentRollNumber: '07',
    assignedClasses: [],
    assignedSections: [],
    assignedSubjectIds: []
  };

  // Student Queries Attendance
  const attRes = await executeTool('get_attendance_summary', {}, studentContext, supabase);
  console.log(' - Student Own Attendance:', attRes.summaryForModel);
  if (!attRes.structuredPayload || attRes.structuredPayload.type !== 'attendance_table') {
    throw new Error('Expected attendance_table structured payload for student');
  }

  // Student Queries Fees
  const feeRes = await executeTool('get_fee_status', {}, studentContext, supabase);
  console.log(' - Student Own Fees:', feeRes.summaryForModel);
  if (!feeRes.structuredPayload || feeRes.structuredPayload.type !== 'fee_summary') {
    throw new Error('Expected fee_summary structured payload for student');
  }

  // Student Queries Exam Marks
  const marksRes = await executeTool('get_exam_results_and_marks', {}, studentContext, supabase);
  console.log(' - Student Own Marks:', marksRes.summaryForModel);

  // Student attempts to query other student's profile by ID manipulation
  const crossStudentRes = await executeTool('get_student_profile', { search: 'Rahul', student_id: 'random-uuid' }, studentContext, supabase);
  console.log(' - Student ID Manipulation Attempt (Should only return Kuldeep):', crossStudentRes.summaryForModel);
  if (!crossStudentRes.summaryForModel.includes('Kuldeep')) {
    throw new Error('Security Failure: Student queried data outside their own identity!');
  }
  console.log(' ✔ Student role isolation verified.\n');

  // Test 2: Teacher Role Boundary (priyanka@school.com)
  console.log('2. Testing Teacher Role Boundary (priyanka@school.com)...');
  const teacherContext = {
    user: { id: '45076118-749b-4be2-8cb1-5b4196d83cdb', email: 'priyanka@school.com' },
    userId: '45076118-749b-4be2-8cb1-5b4196d83cdb',
    email: 'priyanka@school.com',
    name: 'Smt. Priyanka Chaurasia',
    role: 'teacher',
    roleCategory: 'teacher',
    isAdmin: false,
    isTeacher: true,
    isStudent: false,
    teacherId: '26defd66-64da-472d-b05b-7f80b469ced8',
    teacherName: 'Smt. Priyanka Chaurasia',
    assignedClasses: ['8', '10'],
    assignedSections: ['8-A', '10-B'],
    assignedSubjectIds: []
  };

  // Teacher Queries Assigned Students
  const teacherStudentsRes = await executeTool('get_student_profile', { search: '' }, teacherContext, supabase);
  console.log(' - Teacher Assigned Students:', teacherStudentsRes.summaryForModel.slice(0, 120) + '...');

  // Teacher attempts to access confidential School Fees
  const teacherFeeRes = await executeTool('get_fee_status', {}, teacherContext, supabase);
  console.log(' - Teacher Fee Access Attempt:', teacherFeeRes.summaryForModel);
  if (!teacherFeeRes.summaryForModel.includes('Access Restricted')) {
    throw new Error('Security Failure: Teacher was not blocked from viewing confidential fee ledgers!');
  }
  console.log(' ✔ Teacher role boundaries & fee isolation verified.\n');

  // Test 3: Administrator Role (admin@school.com)
  console.log('3. Testing Administrator Role (admin@school.com)...');
  const adminContext = {
    user: { id: '6f89d507-76dd-4e28-8803-75eaf8d8a62d', email: 'admin@school.com' },
    userId: '6f89d507-76dd-4e28-8803-75eaf8d8a62d',
    email: 'admin@school.com',
    name: 'Principal Admin',
    role: 'admin',
    roleCategory: 'admin',
    isAdmin: true,
    isTeacher: false,
    isStudent: false,
    assignedClasses: [],
    assignedSections: [],
    assignedSubjectIds: []
  };

  // Admin KPI Summary
  const kpiRes = await executeTool('get_school_kpi_summary', {}, adminContext, supabase);
  console.log(' - Admin KPI Summary:', kpiRes.summaryForModel);
  if (!kpiRes.structuredPayload || kpiRes.structuredPayload.type !== 'kpi_cards') {
    throw new Error('Expected kpi_cards structured payload for admin');
  }

  // Admin Fee Defaulters
  const adminFeeRes = await executeTool('get_fee_status', { status: 'pending' }, adminContext, supabase);
  console.log(' - Admin Defaulters:', adminFeeRes.summaryForModel.slice(0, 120) + '...');

  // Admin Proposes Action
  const actionRes = await executeTool('propose_erp_action', {
    action_type: 'create_notice',
    title: 'Parent-Teacher Meeting Notice',
    description: 'PTM scheduled for Saturday 10:00 AM in Senior Wing.',
    parameters: { title: 'PTM Notice', description: 'PTM scheduled for Saturday.' }
  }, adminContext, supabase);
  console.log(' - Action Proposal Output:', actionRes.summaryForModel);
  if (!actionRes.structuredPayload || actionRes.structuredPayload.type !== 'action_card') {
    throw new Error('Expected action_card structured payload');
  }
  console.log(' ✔ Admin capabilities & Action Proposal verified.\n');

  console.log('=== ALL AI SECURITY & ROLE TESTS PASSED (100% SUCCESS) ===');
}

runTests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
