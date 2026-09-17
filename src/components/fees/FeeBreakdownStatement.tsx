import React, { useRef, useState, useEffect, useMemo } from 'react';
import { jsPDF } from 'jspdf';
import html2canvasSafe from '@/lib/html2canvasSafe';
import { Printer, Download, X, Loader2, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import sjsLogoIcon from '@/assets/sjs_logo_icon.jpg';
import { fetchSystemSettings, SystemSettings } from '@/services/systemService';
import { feeService } from '@/services/feeService';
import { feePeriodLabel } from '@/lib/feeLabels';
import type { StudentFeeAccountSummary } from '@/types/fee';

interface FeeBreakdownStatementProps {
  studentId: string;
  /** Optional identity so the header renders before the ledger fetch resolves. */
  student?: {
    name?: string;
    class?: string;
    section?: string;
    admission_number?: string;
    roll_number?: string;
    father_name?: string;
  };
  academicYearId?: string;
  onClose: () => void;
}

const rupee = (n: number) =>
  '₹' + (Number.isFinite(n) ? n : 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });


/**
 * A per-student fee breakdown: every fee head assigned to the student with its
 * gross amount, concession, fine, net payable, amount paid and balance, plus a
 * totals row — printable and downloadable as a PDF. Used from the Fee
 * Collection & Ledgers tab and the Student 360 drawer.
 */
export default function FeeBreakdownStatement({
  studentId,
  student,
  academicYearId,
  onClose,
}: FeeBreakdownStatementProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [account, setAccount] = useState<StudentFeeAccountSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [settings, setSettings] = useState<SystemSettings | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setIsLoading(true);
      try {
        const [acct, sys] = await Promise.all([
          feeService.getStudentFeeAccount(studentId, academicYearId),
          fetchSystemSettings().catch(() => null),
        ]);
        if (!alive) return;
        setAccount(acct);
        setSettings(sys);
      } catch (err: any) {
        if (alive) toast.error(err?.message || 'Failed to load the fee breakdown.');
      } finally {
        if (alive) setIsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [studentId, academicYearId]);

  const schoolName = (settings?.school_name || "ST. JOSEPH'S SCHOOL, BARHALGANJ").toUpperCase();
  const schoolAddress =
    settings?.school_address || 'Korari, Barhalganj, Gorakhpur, Uttar Pradesh - 273402';
  const affiliationBoard = settings?.affiliation_board || 'CBSE';
  const affiliationNo = settings?.affiliation_number || '2131498';
  const logoUrl = settings?.logo_url || sjsLogoIcon;

  // Grouped by fee head, then chronologically within it -- so every "General
  // School Fee" instalment sits together instead of interleaving by date with
  // every other head, which is how the account API returns them.
  const rows = useMemo(() => {
    const list = account?.ledgers ?? [];
    return [...list].sort((a, b) =>
      a.category_name === b.category_name
        ? a.due_date.localeCompare(b.due_date)
        : a.category_name.localeCompare(b.category_name)
    );
  }, [account]);
  const identity: Record<string, any> = rows[0]?.students || {};
  const displayName = student?.name || identity.name || 'Student';
  const displayAdmission = student?.admission_number || identity.admission_number || '—';
  const displayClass = student?.class || identity.class || '';
  const displaySection = student?.section || identity.section || '';
  const displayFather = student?.father_name || identity.father_name || '—';
  const displayRoll = student?.roll_number || identity.roll_number || '—';
  const academicYear = rows[0]?.academic_year || '2026-27';

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        const concession = Number(r.discount_amount || 0) + Number(r.scholarship_amount || 0);
        acc.gross += Number(r.total_amount || 0);
        acc.concession += concession;
        acc.fine += Number(r.fine_amount || 0);
        acc.net += Number(r.net_amount || 0);
        acc.paid += Number(r.amount_paid || 0);
        acc.balance += Number(r.remaining_amount || 0);
        return acc;
      },
      { gross: 0, concession: 0, fine: 0, net: 0, paid: 0, balance: 0 }
    );
  }, [rows]);

  const generatedAt = new Date().toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const handlePrint = () => window.print();

  const handleDownloadPDF = async () => {
    if (!sheetRef.current) return;
    setIsExporting(true);
    toast.loading('Generating fee breakdown PDF…', { id: 'fee-breakdown-pdf' });
    try {
      const canvas = await html2canvasSafe(sheetRef.current, {
        scale: 2.5,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = 210;
      const margin = 8;
      const imgWidth = pageWidth - margin * 2;
      const imgHeight = (canvas.height / canvas.width) * imgWidth;
      const pageHeight = 297;

      if (imgHeight <= pageHeight - margin * 2) {
        pdf.addImage(imgData, 'PNG', margin, margin, imgWidth, imgHeight);
      } else {
        // Long ledgers span multiple pages.
        let remaining = imgHeight;
        let position = margin;
        while (remaining > 0) {
          pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
          remaining -= pageHeight - margin * 2;
          if (remaining > 0) {
            pdf.addPage();
            position = margin - (imgHeight - remaining);
          }
        }
      }

      const safeName = displayName.replace(/[^a-z0-9]+/gi, '_');
      pdf.save(`Fee-Breakdown-${safeName}-${academicYear}.pdf`);
      toast.success('Fee breakdown PDF downloaded.', { id: 'fee-breakdown-pdf' });
    } catch (err) {
      console.error('[FeeBreakdownStatement] PDF error:', err);
      toast.error('Could not generate the PDF. Try Print instead.', { id: 'fee-breakdown-pdf' });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/60 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center">
              <Wallet size={15} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Fee Breakdown Statement</h3>
              <p className="text-[11px] text-slate-500">{displayName} • {displayClass}{displaySection ? `-${displaySection}` : ''}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              disabled={isLoading || rows.length === 0}
              className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <Printer size={13} /> Print
            </button>
            <button
              onClick={handleDownloadPDF}
              disabled={isLoading || isExporting || rows.length === 0}
              className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-60 cursor-pointer"
            >
              {isExporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
              Download PDF
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-5">
          {isLoading ? (
            <div className="py-20 text-center text-slate-400">
              <Loader2 className="w-7 h-7 animate-spin mx-auto text-violet-600 mb-2" />
              <p className="text-xs font-bold text-slate-600">Loading fee ledgers…</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <Wallet className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <p className="font-bold text-slate-700 text-sm">No fee heads assigned</p>
              <p className="text-xs text-slate-400 mt-0.5">
                This student has no fee ledger for {academicYear}.
              </p>
            </div>
          ) : (
            /* Printable sheet */
            <div ref={sheetRef} className="bg-white text-slate-900 p-6 border border-slate-200 rounded-xl">
              {/* School header */}
              <div className="flex items-center gap-3 pb-3 border-b-2 border-slate-800">
                <img
                  src={logoUrl}
                  alt=""
                  className="w-14 h-14 object-contain shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).src = sjsLogoIcon; }}
                />
                <div className="flex-1 text-center">
                  <h1 className="text-base font-black uppercase tracking-tight font-serif leading-tight">
                    {schoolName}
                  </h1>
                  <p className="text-[10px] text-slate-600">{schoolAddress}</p>
                  <p className="text-[10px] text-slate-600">
                    Affiliated to {affiliationBoard} • Affiliation No. {affiliationNo}
                  </p>
                </div>
                <div className="w-14 shrink-0" />
              </div>

              <div className="text-center my-3">
                <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-700">
                  Fee Breakdown Statement
                </h2>
                <p className="text-[10px] text-slate-500">Academic Session {academicYear}</p>
              </div>

              {/* Student identity */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[11px] mb-3 px-1">
                <div className="flex justify-between border-b border-dashed border-slate-200 py-0.5">
                  <span className="font-bold text-slate-500 uppercase">Student</span>
                  <span className="font-bold text-slate-900">{displayName}</span>
                </div>
                <div className="flex justify-between border-b border-dashed border-slate-200 py-0.5">
                  <span className="font-bold text-slate-500 uppercase">Admission No.</span>
                  <span className="font-mono font-bold text-slate-900">{displayAdmission}</span>
                </div>
                <div className="flex justify-between border-b border-dashed border-slate-200 py-0.5">
                  <span className="font-bold text-slate-500 uppercase">Class / Section</span>
                  <span className="font-bold text-slate-900">
                    {displayClass || '—'}{displaySection ? ` - ${displaySection}` : ''}
                  </span>
                </div>
                <div className="flex justify-between border-b border-dashed border-slate-200 py-0.5">
                  <span className="font-bold text-slate-500 uppercase">Roll No.</span>
                  <span className="font-mono font-bold text-slate-900">{displayRoll}</span>
                </div>
                <div className="flex justify-between border-b border-dashed border-slate-200 py-0.5">
                  <span className="font-bold text-slate-500 uppercase">Father / Guardian</span>
                  <span className="font-bold text-slate-900">{displayFather}</span>
                </div>
                <div className="flex justify-between border-b border-dashed border-slate-200 py-0.5">
                  <span className="font-bold text-slate-500 uppercase">Generated</span>
                  <span className="font-bold text-slate-900">{generatedAt}</span>
                </div>
              </div>

              {/* Breakdown table */}
              <table className="w-full border-collapse text-[10.5px]">
                <thead>
                  <tr className="bg-slate-800 text-white uppercase tracking-wide text-[9px]">
                    <th className="border border-slate-700 px-2 py-1.5 text-left">#</th>
                    <th className="border border-slate-700 px-2 py-1.5 text-left">Fee Head</th>
                    <th className="border border-slate-700 px-2 py-1.5 text-left">Frequency</th>
                    <th className="border border-slate-700 px-2 py-1.5 text-right">Gross</th>
                    <th className="border border-slate-700 px-2 py-1.5 text-right">Discount / Concession</th>
                    <th className="border border-slate-700 px-2 py-1.5 text-right">Fine</th>
                    <th className="border border-slate-700 px-2 py-1.5 text-right">Net Payable</th>
                    <th className="border border-slate-700 px-2 py-1.5 text-right">Paid</th>
                    <th className="border border-slate-700 px-2 py-1.5 text-right">Balance</th>
                    <th className="border border-slate-700 px-2 py-1.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const concession =
                      Number(r.discount_amount || 0) + Number(r.scholarship_amount || 0);
                    return (
                      <tr key={r.id} className={i % 2 ? 'bg-slate-50' : 'bg-white'}>
                        <td className="border border-slate-200 px-2 py-1.5 text-slate-500">{i + 1}</td>
                        <td className="border border-slate-200 px-2 py-1.5 font-bold text-slate-800">
                          {feePeriodLabel(r)}
                        </td>
                        <td className="border border-slate-200 px-2 py-1.5 text-slate-600">
                          {r.frequency || '—'}
                        </td>
                        <td className="border border-slate-200 px-2 py-1.5 text-right font-mono">
                          {rupee(Number(r.total_amount || 0))}
                        </td>
                        <td className="border border-slate-200 px-2 py-1.5 text-right font-mono text-sky-700">
                          {concession > 0 ? `- ${rupee(concession)}` : rupee(0)}
                        </td>
                        <td className="border border-slate-200 px-2 py-1.5 text-right font-mono text-amber-700">
                          {Number(r.fine_amount || 0) > 0 ? `+ ${rupee(Number(r.fine_amount))}` : rupee(0)}
                        </td>
                        <td className="border border-slate-200 px-2 py-1.5 text-right font-mono font-bold">
                          {rupee(Number(r.net_amount || 0))}
                        </td>
                        <td className="border border-slate-200 px-2 py-1.5 text-right font-mono text-emerald-700 font-bold">
                          {rupee(Number(r.amount_paid || 0))}
                        </td>
                        <td className="border border-slate-200 px-2 py-1.5 text-right font-mono text-rose-700 font-bold">
                          {rupee(Number(r.remaining_amount || 0))}
                        </td>
                        <td className="border border-slate-200 px-2 py-1.5 text-center uppercase font-black text-[9px]">
                          {r.status}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-black text-slate-900">
                    <td className="border border-slate-300 px-2 py-2 text-right" colSpan={3}>
                      TOTAL
                    </td>
                    <td className="border border-slate-300 px-2 py-2 text-right font-mono">{rupee(totals.gross)}</td>
                    <td className="border border-slate-300 px-2 py-2 text-right font-mono text-sky-800">
                      {totals.concession > 0 ? `- ${rupee(totals.concession)}` : rupee(0)}
                    </td>
                    <td className="border border-slate-300 px-2 py-2 text-right font-mono text-amber-800">
                      {totals.fine > 0 ? `+ ${rupee(totals.fine)}` : rupee(0)}
                    </td>
                    <td className="border border-slate-300 px-2 py-2 text-right font-mono">{rupee(totals.net)}</td>
                    <td className="border border-slate-300 px-2 py-2 text-right font-mono text-emerald-800">
                      {rupee(totals.paid)}
                    </td>
                    <td className="border border-slate-300 px-2 py-2 text-right font-mono text-rose-800">
                      {rupee(totals.balance)}
                    </td>
                    <td className="border border-slate-300 px-2 py-2" />
                  </tr>
                </tfoot>
              </table>

              {/* Summary line */}
              <div className="mt-4 flex flex-wrap justify-end gap-x-6 gap-y-1 text-[11px]">
                <span className="text-slate-500">
                  Total Payable: <strong className="text-slate-900">{rupee(totals.net)}</strong>
                </span>
                <span className="text-slate-500">
                  Total Paid: <strong className="text-emerald-700">{rupee(totals.paid)}</strong>
                </span>
                <span className="text-slate-500">
                  Outstanding Balance:{' '}
                  <strong className="text-rose-700">{rupee(totals.balance)}</strong>
                </span>
              </div>

              <p className="mt-5 pt-3 border-t border-slate-200 text-[9px] text-slate-400 text-center">
                This is a computer-generated fee breakdown statement and does not require a signature.
                Generated on {generatedAt}. For discrepancies, contact the school accounts office.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
