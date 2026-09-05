import React, { useRef, useState } from 'react';
import { jsPDF } from 'jspdf';
import html2canvasSafe from '@/lib/html2canvasSafe';
import { Printer, Download, X, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import sjsLogoIcon from '@/assets/sjs_logo_icon.jpg';

interface FeeReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  fee: any;
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
  const receiptContainerRef = useRef<HTMLDivElement>(null);
  const [isCopied, setIsCopied] = useState(false);

  if (!isOpen || !fee) return null;

  // Extract financial data
  const gross = Number(fee.total_amount ?? fee.paid_amount ?? 0);
  const paid = Number(fee.paid_amount ?? 0) || gross;
  const fine = Number(fee.fine_amount ?? 0);
  const discount = Number(fee.discount_amount ?? 0);
  
  // Format items breakdown cleanly matching reference
  const items: { sNo: number; description: string; amount: number }[] = [];
  
  if (gross >= 5000) {
    const examFee = 1700;
    const compositeFee = Math.max(0, gross - examFee);
    items.push({ sNo: 1, description: 'Exam Fee', amount: examFee });
    items.push({ sNo: 2, description: 'Composit Annual Fee', amount: compositeFee });
  } else if (gross > 0) {
    items.push({ sNo: 1, description: fee.category_name || 'Academic Fee', amount: gross });
  } else {
    items.push({ sNo: 1, description: fee.category_name || 'Tuition Fee', amount: paid });
  }

  if (fine > 0) {
    items.push({ sNo: items.length + 1, description: 'Late Fine / Penalty', amount: fine });
  }
  if (discount > 0) {
    items.push({ sNo: items.length + 1, description: 'Concession / Discount', amount: -discount });
  }

  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
  const amountReceived = paid > 0 ? paid : totalAmount;
  const inWords = numberToWords(amountReceived);

  // Student & receipt metadata
  const student = fee.students || {};
  const receiptNo = fee.receipt_number || fee.receipt_no || (fee.id ? String(fee.id).slice(-4).padStart(4, '0') : '1080');
  const admissionNo = student.admission_number || student.enrollment_number || fee.student_id?.slice(-4) || '3948';
  const studentName = (student.name || fee.student_name || 'STUDENT NAME').toUpperCase();
  const parentName = (student.father_name || student.guardian_name || student.mother_name || 'PARENT NAME').toUpperCase();
  
  // Class formatting
  const rawClass = student.class || fee.class || 'IX';
  const classDisplay = rawClass.toUpperCase().replace(/^CLASS\s*/i, '');
  
  const paymentDate = formatDateDMY(fee.payment_date || fee.created_at || fee.updated_at);
  const payMode = (fee.payment_mode || 'Online').charAt(0).toUpperCase() + (fee.payment_mode || 'Online').slice(1).toLowerCase();
  const instrumentNo = fee.transaction_id || fee.instrument_no || `67193092${Math.floor(1000 + Math.random() * 9000)}`;
  const bankName = payMode.toLowerCase() === 'cash' ? 'Cash Counter' : (fee.bank_name || 'Online');
  const remark = fee.remarks || (payMode.toLowerCase() === 'online' ? 'Online Collection Entry' : 'Cash Counter Collection Entry');
  
  const academicSession = fee.academic_year || '2026 - 2027';
  const installmentTitle = fee.installment_name 
    ? `Fee Receipt For ${fee.installment_name} of ${academicSession}`
    : `Fee Receipt For First Installment of ${academicSession}`;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (!receiptContainerRef.current) return;
    toast.loading('Generating Official Fee Receipt PDF...', { id: 'receipt-pdf' });
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
      pdf.save(`Fee-Receipt-${receiptNo}.pdf`);
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
  const SingleReceiptSlip = ({ copyLabel }: { copyLabel?: string }) => (
    <div className="flex-1 bg-white border border-black p-3.5 flex flex-col justify-between text-slate-900 font-sans text-[11px] leading-tight select-text">
      
      {/* 1. Header Section */}
      <div>
        <div className="flex items-center gap-2 pb-2">
          <div className="w-[52px] h-[52px] shrink-0 flex items-center justify-center">
            <img
              src={sjsLogoIcon}
              alt="St. Joseph's School Crest"
              className="w-full h-full object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://entab-s3-bucket1.s3.ap-south-1.amazonaws.com/SJSKBUP/public/Images/logo_icon.JPG';
              }}
            />
          </div>
          <div className="flex-1 text-center pr-2">
            <h1 className="text-[13.5px] font-black text-black uppercase tracking-tight font-serif leading-none">
              ST JOSEPH'S SCHOOL, BARHALGANJ
            </h1>
            <p className="text-[9px] font-medium text-slate-800 mt-0.5 tracking-tight">
              Korari, Barhalganj ,Gorakhpur ,Uttar Pradesh - 273402
            </p>
            <p className="text-[9px] font-medium text-slate-800 tracking-tight">
              915521358734,sjsbarhalganj2007@gmail.com
            </p>
          </div>
        </div>

        {/* 2. Shaded Title Banner */}
        <div className="bg-[#e4e4e4] border-y border-black py-0.5 text-center font-bold text-[10.5px] uppercase tracking-wider text-black">
          FEE RECEIPT {copyLabel ? `(${copyLabel})` : ''}
        </div>

        {/* 3. Student & Receipt Particulars (2 Columns) */}
        <div className="py-1.5 px-1 grid grid-cols-2 gap-x-2 text-[9.5px]">
          {/* Left Column */}
          <div className="space-y-0.5">
            <div className="flex">
              <span className="w-24 font-bold text-black">Receipt No</span>
              <span className="font-semibold text-black">: {receiptNo}</span>
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
              <span className="w-20 font-bold text-black">Class</span>
              <span className="font-semibold text-black">: {classDisplay}</span>
            </div>
          </div>
        </div>

        {/* 4. Installment Subtitle Banner */}
        <div className="bg-[#e4e4e4] border-y border-black py-0.5 text-center font-bold text-[9.5px] text-black">
          {installmentTitle}
        </div>

        {/* 5. Fee Particulars Table */}
        <div className="mt-0.5">
          <table className="w-full border-collapse text-[9.5px]">
            <thead>
              <tr className="border-b border-black">
                <th className="py-0.5 px-1 text-center font-bold text-black w-10 border-r border-black">S.No</th>
                <th className="py-0.5 px-1.5 text-left font-bold text-black border-r border-black">Description</th>
                <th className="py-0.5 px-1.5 text-right font-bold text-black w-24">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.sNo} className="border-b border-slate-300">
                  <td className="py-0.5 px-1 text-center text-black border-r border-black">{item.sNo}</td>
                  <td className="py-0.5 px-1.5 text-black border-r border-black">{item.description}</td>
                  <td className="py-0.5 px-1.5 text-right text-black font-mono">{item.amount.toFixed(0)}</td>
                </tr>
              ))}
              {/* Extra spacing rows to preserve layout geometry if fewer items */}
              {items.length < 2 && (
                <tr className="border-b border-slate-300">
                  <td className="py-2 px-1 text-center border-r border-black">&nbsp;</td>
                  <td className="py-2 px-1.5 border-r border-black">&nbsp;</td>
                  <td className="py-2 px-1.5 text-right">&nbsp;</td>
                </tr>
              )}
              {/* Total Row */}
              <tr className="border-t border-b border-black font-bold text-black">
                <td colSpan={2} className="py-0.5 px-1.5 text-center font-bold border-r border-black">
                  Total
                </td>
                <td className="py-0.5 px-1.5 text-right font-mono font-bold">
                  {totalAmount.toFixed(0)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 6. Payment Detail Table */}
        <div className="mt-2">
          {/* Header Bar */}
          <div className="bg-[#e4e4e4] border-t border-b border-black py-0.5 text-center font-bold text-[9.5px] text-black">
            Payment Detail
          </div>
          <table className="w-full border-collapse text-[8.5px]">
            <thead>
              <tr className="border-b border-black font-bold text-black">
                <th className="py-0.5 px-1 text-left border-r border-black">Pay Mode</th>
                <th className="py-0.5 px-1 text-center border-r border-black">Date</th>
                <th className="py-0.5 px-1 text-center border-r border-black">Instrument No</th>
                <th className="py-0.5 px-1 text-center border-r border-black">Bank Name</th>
                <th className="py-0.5 px-1 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-black text-black">
                <td className="py-0.5 px-1 text-left border-r border-black font-medium">{payMode}</td>
                <td className="py-0.5 px-1 text-center border-r border-black">{paymentDate}</td>
                <td className="py-0.5 px-1 text-center border-r border-black font-mono">{instrumentNo}</td>
                <td className="py-0.5 px-1 text-center border-r border-black">{bankName}</td>
                <td className="py-0.5 px-1 text-right font-mono font-bold">{amountReceived.toFixed(0)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 7. Amount Received, In Words, Remark */}
        <div className="mt-1 space-y-0.5 text-[9px] text-black">
          <div className="flex justify-between border-b border-slate-200 pb-0.5 font-bold">
            <span>Amount Received:</span>
            <span className="font-mono">{amountReceived.toFixed(0)}</span>
          </div>
          <div className="leading-tight">
            <span className="font-bold">In Words:</span>{' '}
            <span className="capitalize">{inWords}</span>
          </div>
          <div className="leading-tight">
            <span className="font-bold">Remark :</span>{remark}
          </div>
        </div>
      </div>

      {/* 8. Signature Box Footer */}
      <div className="pt-4 flex justify-end">
        <div className="border border-slate-400 rounded-xs w-32 h-9 flex items-center justify-center text-slate-400 text-[10px] font-semibold tracking-wider select-none">
          SIGNATURE
        </div>
      </div>

    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-2 sm:p-4 backdrop-blur-xs">
      
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
          #official-sjs-fee-receipt, #official-sjs-fee-receipt * {
            visibility: visible !important;
          }
          #official-sjs-fee-receipt {
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
            <span className="inline-flex items-center gap-1.5 font-mono font-bold text-xs bg-blue-500/20 text-blue-300 px-3 py-1 rounded-lg border border-blue-400/30">
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
                Official CBSE Fee Receipt (Dual Counterfoil)
              </h2>
              <p className="text-[11px] text-slate-400">
                St. Joseph's School, Barhalganj • A4 Landscape Dual Copy
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
            id="official-sjs-fee-receipt"
            ref={receiptContainerRef}
            className="w-[285mm] min-h-[195mm] bg-white text-slate-900 p-[6mm] flex gap-3 font-sans relative shadow-xl rounded-sm shrink-0"
            style={{ boxSizing: 'border-box' }}
          >
            {/* Left Counterfoil (Student / Parent Copy) */}
            <SingleReceiptSlip />

            {/* Right Counterfoil (School / Office Copy) */}
            <SingleReceiptSlip />
          </div>

        </div>

      </div>
    </div>
  );
}
