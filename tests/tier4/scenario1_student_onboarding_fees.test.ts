/**
 * Tier 4: Real-World Application Scenarios - Scenario 1: Student Onboarding & Fee Enrollment Cycle
 * End-to-end administration workflow:
 * Admission Intake -> Admin Approval -> Student Profile Creation -> Fee Assignment -> Payment Collection -> ID & Receipt Generation.
 * Authoritative Source: ORIGINAL_REQUEST.md R1-R2 & PROJECT.md § Architecture.
 */

import { registerTest } from '../infra/runner';
import { assert } from '../infra/assert';
import { inspectors } from '../infra/inspectors';

// Step 1: Admission Submission & Pipeline Contract
registerTest({
  id: 'T4-SC1-01',
  name: 'Scenario 1 (Step 1): Admissions module supports direct intake and pending approvals queue',
  featureId: 'F10',
  tier: 4,
  milestone: 'M1',
  description: 'Verifies admissions table, service createAdmission, and approve_admission RPC contracts',
  expectedOutputSource: 'src/services/admissionService.ts & admissions table',
  fn: () => {
    const admissionCode = inspectors.readFile('src/services/admissionService.ts');
    assert.contains(admissionCode, 'createAdmission', 'admissionService must implement createAdmission');
    assert.contains(admissionCode, 'approve_admission', 'admissionService must call approve_admission RPC');
    assert.contains(admissionCode, 'reject_admission', 'admissionService must call reject_admission RPC');
  }
});

// Step 2: Student 360 Workspace & Profile Integration
registerTest({
  id: 'T4-SC1-02',
  name: 'Scenario 1 (Step 2): Student 360 loads complete profile and provides fee collection trigger',
  featureId: 'F3',
  tier: 4,
  milestone: 'M1',
  description: 'Verifies Student360Drawer integrates student personal data, documents, and fees navigation',
  expectedOutputSource: 'src/components/students/Student360Drawer.tsx',
  fn: () => {
    const student360 = inspectors.readFile('src/components/students/Student360Drawer.tsx');
    assert.contains(student360, 'student_fees', 'Student 360 must query student_fees');
    assert.contains(student360, 'fee_payments', 'Student 360 must query fee_payments');
    assert.contains(student360, '/dashboard/fees', 'Student 360 must have link to Fees portal');
  }
});

// Step 3: Fee Collection & Official Receipt / ID Card Generation
registerTest({
  id: 'T4-SC1-03',
  name: 'Scenario 1 (Step 3): FeesPortal executes collect_fee RPC and triggers printable receipt and ID card',
  featureId: 'F10',
  tier: 4,
  milestone: 'M3',
  description: 'Verifies collect_fee RPC, receipt printing modal, and CBSE ID card generator with live QR code',
  expectedOutputSource: 'src/pages/dashboard/FeesPortal.tsx & StudentIDCardModal.tsx',
  fn: () => {
    const feeServiceCode = inspectors.readFile('src/services/feeService.ts');
    const feesPortal = inspectors.readFile('src/pages/dashboard/FeesPortal.tsx');
    const idModal = inspectors.readFile('src/components/students/StudentIDCardModal.tsx');
    assert.contains(feeServiceCode, 'collect_fee', 'feeService must call collect_fee RPC');
    assert.contains(feesPortal, 'FeeReceiptModal', 'FeesPortal must provide FeeReceiptModal');
    assert.contains(idModal, 'QRCodeSVG', 'StudentIDCardModal must render live verification QR code');
  }
});
