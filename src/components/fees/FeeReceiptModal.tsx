import React, { useRef, useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import html2canvasSafe from '@/lib/html2canvasSafe';
import { Printer, Download, X, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import sjsLogoIcon from '@/assets/sjs_logo_icon.jpg';
import { formatFeeHeadName } from '@/lib/utils';
import { fetchSystemSettings, SystemSettings } from '@/services/systemService';
import { feeService } from '@/services/feeService';
import { useAuth } from '@/context/AuthContext';
import { FeeReceiptData } from '@/types/fee';

interface FeeReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  fee: FeeReceiptData | any;
}

// Convert number to Indian English words format
const numberToWords = (num: number): string => {
  if (!num || isNaN(num) || num === 0) return 'Zero';
  
  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const convert = (n: number): string => {
    let str = '';
    if (n >= 10000000) {
      str += convert(Math.floor(n / 10000000)) + ' Crore ';
      n %= 10000000;
    }
    if (n >= 100000) {
      str += convert(Math.floor(n / 100000)) + ' Lakh ';
      n %= 100000;
    }
    if (n >= 1000) {
      str += convert(Math.floor(n / 1000)) + ' Thousand ';
      n %= 1000;
    }
    if (n >= 100) {
      str += ones[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    if (n > 0) {
      if (str !== '') str += ' ';
      if (n < 20) {
        str += ones[n];
      } else {
        str += tens[Math.floor(n / 10)];
        if (n % 10 > 0) str += ' ' + ones[n % 10];
      }
    }
    return str.trim();
  };

  return convert(Math.round(num));
};

// Format date to DD/MM/YYYY
const formatDateDMY = (dateStr?: string): string => {
  if (!dateStr) {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }
  
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
};

export default function FeeReceiptModal({ isOpen, onClose, fee }: FeeReceiptModalProps) {
  const { user } = useAuth();
  const receiptContainerRef = useRef<HTMLDivElement>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [schoolSettings, setSchoolSettings] = useState<SystemSettings | null>(null);
  const [totalStudentDues, setTotalStudentDues] = useState<number | null>(null);

  // Fetch live school branding and system settings
  useEffect(() => {
    if (!isOpen) return;
    let isCancelled = false;

    fetchSystemSettings()
      .then(settings => {
        if (!isCancelled && settings) {
          setSchoolSettings(settings);
        }
      })
      .catch(err => {
        console.warn('[FeeReceiptModal] Error loading system settings:', err);
      });

    return () => { isCancelled = true; };
  }, [isOpen]);

  // Fetch total outstanding balance for this student across all fee ledgers
  useEffect(() => {
    if (!isOpen || !fee) return;
    let isCancelled = false;

    const studentId = fee.student_id || fee.students?.id || fee.students?.student_id;
    if (studentId) {
      feeService.getStudentTotalOutstanding(studentId)
        .then(dues => {
          if (!isCancelled) {
            setTotalStudentDues(dues);
          }
        })
        .catch(err => {
          console.warn('[FeeReceiptModal] Error computing student dues:', err);
        });
    } else if (fee.total_outstanding_dues !== undefined) {
      setTotalStudentDues(Number(fee.total_outstanding_dues));
    }

    return () => { isCancelled = true; };
  }, [isOpen, fee]);

  if (!isOpen || !fee) return null;

  // Extract financial data
  const paid = Number(fee.amount_paid ?? fee.paid_amount ?? fee.amount ?? 0);
  const fine = Number(fee.fine_amount ?? 0);
  const discount = Number(fee.discount_amount ?? 0);
  const installmentBalance = Number(fee.remaining_amount ?? fee.balance ?? 0);
  
  // Total outstanding dues calculation
  const totalDues = totalStudentDues !== null ? totalStudentDues : installmentBalance;

  // Format items breakdown — line item for the fee category actually received
  const items: { sNo: number; description: string; amount: number }[] = [
    { sNo: 1, description: formatFeeHeadName(fee.category_name) || 'Academic Tuition / Composite Fee', amount: paid }
  ];

  if (fine > 0) {
    items.push({ sNo: items.length + 1, description: 'Late Fine / Penalty', amount: fine });
  }
  if (discount > 0) {
    items.push({ sNo: items.length + 1, description: 'Concession / Discount Applied', amount: -discount });
  }

  const totalAmount = paid;
  const amountReceived = paid;
  const inWords = `${numberToWords(amountReceived)} Rupees Only`;

  // Student & receipt metadata
  const student = fee.students || {};
  const receiptNo = fee.receipt_number || fee.receipt_no || (fee.id ? `RCP/${String(fee.id).slice(-6).toUpperCase()}` : 'RCP-PENDING');
  const admissionNo = student.admission_number || student.enrollment_number || 'N/A';
  const rollNo = student.roll_number || 'N/A';
  const studentName = (student.name || fee.student_name || 'STUDENT NAME').toUpperCase();
  const parentName = (student.father_name || student.guardian_name || student.mother_name || 'PARENT NAME').toUpperCase();
  
  // Class formatting
  const rawClass = student.class || fee.class || 'N/A';
  const sectionStr = student.section ? ` - ${student.section}` : '';
  const classDisplay = `${rawClass.toUpperCase().replace(/^CLASS\s*/i, '')}${sectionStr}`;
  
  const paymentDate = formatDateDMY(fee.payment_date || fee.created_at || fee.updated_at);
  const payMode = (fee.payment_mode || 'Cash').toUpperCase();
  const instrumentNo = fee.transaction_id || fee.instrument_no || (payMode.toLowerCase() === 'cash' ? 'N/A' : 'Direct Entry');
  const bankName = payMode.toLowerCase() === 'cash' ? 'Cash Counter' : (fee.bank_name || (payMode === 'UPI' ? 'UPI Gateway' : 'Bank Transfer'));
  const remark = fee.remarks || (payMode.toLowerCase() === 'online' ? 'Online Portal Collection' : 'Cashier Counter Collection');
  
  const academicSession = fee.academic_year || (schoolSettings as any)?.academic_year || '2026-27';
  const installmentTitle = fee.installment_name 
    ? `FEE PARTICULARS FOR ${fee.installment_name.toUpperCase()} (${academicSession})`
    : `FEE PARTICULARS FOR ${(fee.category_name || 'Academic Fee').toUpperCase()} (${academicSession})`;

  // School metadata from DB with authoritative fallback
  const schoolName = (schoolSettings?.school_name || "ST. JOSEPH'S SCHOOL, BARHALGANJ").toUpperCase();
  const schoolAddress = schoolSettings?.school_address || "Korari, Barhalganj, Gorakhpur, Uttar Pradesh - 273402";
  const schoolPhone = schoolSettings?.school_phone || "915521358734";
  const schoolEmail = schoolSettings?.school_email || "sjsbarhalganj2007@gmail.com";
  const affiliationBoard = schoolSettings?.affiliation_board || "CBSE";
  const affiliationNo = schoolSettings?.affiliation_number || "2131498";
  const schoolCode = schoolSettings?.school_code || "70532";
  const logoUrl = schoolSettings?.logo_url || sjsLogoIcon;

  // Cashier / Accountant identity
  const cashierDisplay = fee.cashier_name || (user?.email ? user.email.split('@')[0].toUpperCase() : 'CASHIER DESK');

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (!receiptContainerRef.current) return;
    toast.loading('Generating Official School Fee Receipt PDF...', { id: 'receipt-pdf' });
    try {
      const canvas = await html2canvasSafe(receiptContainerRef.current, {
        scale: 2.5,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false
      });
      const imgData = canvas.toDataURL('image/png');
      // Standard A4 Landscape: 297mm width x 210mm height
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      pdf.addImage(imgData, 'PNG', 0, 0, 297, 210);
      pdf.save(`Fee-Receipt-${receiptNo.replace(/\//g, '_')}.pdf`);
      toast.success('Fee receipt downloaded successfully.', { id: 'receipt-pdf' });
    } catch (err) {
      console.error('PDF error:', err);
      toast.error('Failed to generate PDF. Please try printing directly.', { id: 'receipt-pdf' });
    }
  };

  const handleCopyReceiptNo = () => {
    navigator.clipboard.writeText(receiptNo);
    setIsCopied(true);
    toast.success('Receipt number copied to clipboard.');
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Sub-component for a single receipt slip (Side-by-Side Left and Right)
  const SingleReceiptSlip = ({ copyLabel }: { copyLabel: 'PARENT / STUDENT COPY' | 'SCHOOL COPY' }) => (
    <div className="flex-1 bg-white border border-black p-3.5 flex flex-col justify-between text-slate-900 font-sans text-[11px] leading-tight select-text">
      
      {/* 1. Header Section */}
      <div>
        <div className="flex items-center gap-2 pb-2">
          <div className="w-[52px] h-[52px] shrink-0 flex items-center justify-center">
            <img
              src={logoUrl}
              alt="School Crest"
              className="w-full h-full object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).src = sjsLogoIcon;
              }}
            />
          </div>
          <div className="flex-1 text-center pr-2">
            <h1 className="text-[13px] font-black text-black uppercase tracking-tight font-serif leading-none">
              {schoolName}
            </h1>
            <p className="text-[8.5px] font-medium text-slate-800 mt-0.5 tracking-tight">
              {schoolAddress}
            </p>
            <p className="text-[8.5px] font-medium text-slate-800 tracking-tight">
              Ph: {schoolPhone} {schoolEmail ? `• ${schoolEmail}` : ''}
              {affiliationNo ? ` • Affiliation No: ${affiliationNo}` : ''}
              {schoolCode ? ` • School Code: ${schoolCode}` : ''}
            </p>
          </div>
        </div>

        {/* 2. Shaded Title Banner */}
        <div className="bg-[#e4e4e4] border-y border-black py-0.5 text-center font-bold text-[10px] uppercase tracking-wider text-black">
          SCHOOL FEE RECEIPT ({copyLabel})
        </div>

        {/* 3. Student & Receipt Particulars (2 Columns) */}
        <div className="py-1.5 px-1 grid grid-cols-2 gap-x-2 text-[9.5px]">
          {/* Left Column */}
          <div className="space-y-0.5">
            <div className="flex">
              <span className="w-24 font-bold text-black">Receipt No</span>
              <span className="font-mono font-bold text-black">: {receiptNo}</span>
            </div>
            <div className="flex">
              <span className="w-24 font-bold text-black">Admission No</span>
              <span className="font-semibold text-black">: {admissionNo}</span>
            </div>
            <div className="flex">
              <span className="w-24 font-bold text-black">Student Name</span>
              <span className="font-semibold text-black truncate">: {studentName}</span>
            </div>
            <div className="flex">
              <span className="w-24 font-bold text-black">Parent's Name</span>
              <span className="font-semibold text-black truncate">: {parentName}</span>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-0.5">
            <div className="flex">
              <span className="w-20 font-bold text-black">Receipt Date</span>
              <span className="font-semibold text-black">: {paymentDate}</span>
            </div>
            <div className="flex">
              <span className="w-20 font-bold text-black">Class & Sec</span>
              <span className="font-semibold text-black">: {classDisplay}</span>
            </div>
            <div className="flex">
              <span className="w-20 font-bold text-black">Roll Number</span>
              <span className="font-semibold text-black">: {rollNo}</span>
            </div>
            <div className="flex">
              <span className="w-20 font-bold text-black">Session</span>
              <span className="font-semibold text-black">: {academicSession}</span>
            </div>
          </div>
        </div>

        {/* 4. Installment Subtitle Banner */}
        <div className="bg-[#e4e4e4] border-y border-black py-0.5 text-center font-bold text-[9px] text-black tracking-tight">
          {installmentTitle}
        </div>

        {/* 5. Fee Particulars Table */}
        <div className="mt-0.5">
          <table className="w-full border-collapse text-[9.5px]">
            <thead>
              <tr className="border-b border-black">
                <th className="py-0.5 px-1 text-center font-bold text-black w-10 border-r border-black">S.No</th>
                <th className="py-0.5 px-1.5 text-left font-bold text-black border-r border-black">Description</th>
                <th className="py-0.5 px-1.5 text-right font-bold text-black w-24">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.sNo} className="border-b border-slate-300">
                  <td className="py-0.5 px-1 text-center text-black border-r border-black">{item.sNo}</td>
                  <td className="py-0.5 px-1.5 text-black border-r border-black">{item.description}</td>
                  <td className="py-0.5 px-1.5 text-right text-black font-mono font-medium">{item.amount.toFixed(2)}</td>
                </tr>
              ))}
              {/* Extra spacing rows to preserve layout geometry if fewer items */}
              {items.length < 2 && (
                <tr className="border-b border-slate-300">
                  <td className="py-1 px-1 text-center border-r border-black">&nbsp;</td>
                  <td className="py-1 px-1.5 border-r border-black">&nbsp;</td>
                  <td className="py-1 px-1.5 text-right">&nbsp;</td>
                </tr>
              )}
              {/* Total Row */}
              <tr className="border-t border-b border-black font-bold text-black bg-slate-50/50">
                <td colSpan={2} className="py-0.5 px-1.5 text-center font-bold border-r border-black">
                  Total Fee Collected
                </td>
                <td className="py-0.5 px-1.5 text-right font-mono font-bold">
                  ₹{totalAmount.toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 6. Payment Detail Table */}
        <div className="mt-1.5">
          <div className="bg-[#e4e4e4] border-t border-b border-black py-0.5 text-center font-bold text-[9px] text-black">
            Transaction & Payment Details
          </div>
          <table className="w-full border-collapse text-[8.5px]">
            <thead>
              <tr className="border-b border-black font-bold text-black">
                <th className="py-0.5 px-1 text-left border-r border-black">Pay Mode</th>
                <th className="py-0.5 px-1 text-center border-r border-black">Date</th>
                <th className="py-0.5 px-1 text-center border-r border-black">Instrument / Txn ID</th>
                <th className="py-0.5 px-1 text-center border-r border-black">Bank / Channel</th>
                <th className="py-0.5 px-1 text-right">Amount Received</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-black text-black">
                <td className="py-0.5 px-1 text-left border-r border-black font-bold">{payMode}</td>
                <td className="py-0.5 px-1 text-center border-r border-black">{paymentDate}</td>
                <td className="py-0.5 px-1 text-center border-r border-black font-mono">{instrumentNo}</td>
                <td className="py-0.5 px-1 text-center border-r border-black">{bankName}</td>
                <td className="py-0.5 px-1 text-right font-mono font-bold">₹{amountReceived.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 7. Amount Received, In Words, Dues Breakdown */}
        <div className="mt-1 space-y-0.5 text-[9px] text-black">
          <div className="flex justify-between border-b border-slate-200 pb-0.5 font-bold">
            <span>Amount Received:</span>
            <span className="font-mono text-emerald-800 font-bold">₹{amountReceived.toFixed(2)}</span>
          </div>
          <div className="leading-tight">
            <span className="font-bold">In Words:</span>{' '}
            <span className="capitalize">{inWords}</span>
          </div>

          {/* Current Installment Balance & Total Outstanding Dues Separated */}
          <div className="grid grid-cols-2 gap-2 pt-0.5 pb-0.5 border-b border-slate-200 text-[8.5px]">
            <div>
              <span className="font-bold">Current Installment Balance:</span>{' '}
              <span className="font-mono font-bold">
                {installmentBalance === 0 ? '₹0.00 (Settled)' : `₹${installmentBalance.toFixed(2)} Remaining`}
              </span>
            </div>
            <div>
              <span className="font-bold">Total Outstanding Dues:</span>{' '}
              <span className="font-mono font-bold">
                {totalDues === 0 ? (
                  <span className="text-emerald-700 font-extrabold">₹0.00 (FULL SETTLEMENT - NO DUES)</span>
                ) : (
                  <span className="text-rose-700 font-extrabold">₹{totalDues.toFixed(2)} Remaining Due</span>
                )}
              </span>
            </div>
          </div>

          <div className="leading-tight pt-0.5">
            <span className="font-bold">Remarks:</span> {remark}
          </div>
        </div>
      </div>

      {/* 8. Dual Signatory Footer: Cashier/Accountant & Authorized Signatory */}
      <div className="pt-3">
        <div className="grid grid-cols-2 gap-4 text-[9px] text-slate-800">
          
          {/* Left: Cashier / Accountant */}
          <div className="flex flex-col items-center">
            <div className="border-b border-slate-800 w-36 h-6 flex items-end justify-center pb-0.5 text-[8.5px] font-mono text-slate-600">
              {cashierDisplay}
            </div>
            <span className="font-bold text-black mt-0.5 uppercase text-[8.5px]">
              Cashier / Accounts Officer
            </span>
          </div>

          {/* Right: Authorized Signatory */}
          <div className="flex flex-col items-center">
            <div className="border-b border-slate-800 w-36 h-6 flex items-end justify-center pb-0.5 text-[8.5px] text-slate-500 font-serif italic">
              [ Seal &amp; Signature ]
            </div>
            <span className="font-bold text-black mt-0.5 uppercase text-[8.5px]">
              Authorized Signatory
            </span>
          </div>

        </div>

        {/* Audit Note */}
        <div className="text-center text-[7.5px] text-slate-500 mt-2 border-t border-slate-200 pt-0.5 font-medium">
          * This is a computer-generated fee receipt. Fees once paid are non-refundable and non-transferable.
        </div>
      </div>

    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-2 sm:p-4 backdrop-blur-xs font-sans">
      
      {/* Print isolation rules: only print the landscape receipt container */}
      <style>{`
        @page {
          size: A4 landscape;
          margin: 6mm;
        }
        @media print {
          body * {
            visibility: hidden !important;
          }
          #official-school-fee-receipt, #official-school-fee-receipt * {
            visibility: visible !important;
          }
          #official-school-fee-receipt {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            background: #fff !important;
          }
        }
      `}</style>

      {/* Modal Dialog Card */}
      <div className="relative w-full max-w-6xl bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[96vh] overflow-hidden my-auto">
        
        {/* Modal Toolbar */}
        <header className="shrink-0 px-5 py-3 bg-slate-900 text-white flex items-center justify-between z-20">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 font-mono font-bold text-xs bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-lg border border-emerald-400/30">
              Receipt #{receiptNo}
              <button 
                onClick={handleCopyReceiptNo} 
                className="hover:text-white transition-colors cursor-pointer ml-1"
                title="Copy Receipt No"
              >
                {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </span>
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wide font-sans">
                School Fee Receipt (Dual Counterfoil)
              </h2>
              <p className="text-[11px] text-slate-400">
                {schoolName} • A4 Landscape Dual Copy
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Printer className="w-3.5 h-3.5 text-blue-400" /> Print Slips
            </button>
            <button
              onClick={handleDownloadPDF}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md shadow-blue-900/30 transition-all"
            >
              <Download className="w-3.5 h-3.5" /> Download PDF
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close Receipt"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Scrollable Receipt Area */}
        <div className="flex-1 overflow-y-auto overflow-x-auto p-4 sm:p-6 flex justify-center bg-slate-100">
          
          {/* Exact A4 Landscape Container (297mm x 210mm) */}
          <div
            id="official-school-fee-receipt"
            ref={receiptContainerRef}
            className="w-[285mm] min-h-[195mm] bg-white text-slate-900 p-[6mm] flex gap-3 font-sans relative shadow-xl rounded-sm shrink-0"
            style={{ boxSizing: 'border-box' }}
          >
            {/* Left Counterfoil: PARENT / STUDENT COPY */}
            <SingleReceiptSlip copyLabel="PARENT / STUDENT COPY" />

            {/* Right Counterfoil: SCHOOL COPY */}
            <SingleReceiptSlip copyLabel="SCHOOL COPY" />
          </div>

        </div>

      </div>
    </div>
  );
}

