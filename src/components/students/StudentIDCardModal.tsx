import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Printer, Download, GraduationCap, Loader2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Student, StudentMedicalRecord, StudentTransportInfo } from '@/types/student';
import html2canvasSafe from '@/lib/html2canvasSafe';
import { jsPDF } from 'jspdf';
import { toast } from 'sonner';

interface StudentIDCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
  medical?: StudentMedicalRecord | null;
  transport?: StudentTransportInfo | null;
}

const SCHOOL_NAME   = "St. Joseph's School";
const SCHOOL_ADDR   = 'Barhalganj, Gorakhpur (U.P.) - 273402';
const SCHOOL_PHONE  = '+91-8853242676';
const CBSE_AFF_NO   = '2131498';
const PRINCIPAL     = 'Principal';

export default function StudentIDCardModal({ isOpen, onClose, student, medical, transport }: StudentIDCardModalProps) {
  const frontRef      = useRef<HTMLDivElement>(null);
  const backRef       = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  if (!isOpen || !student) return null;

  const now        = new Date();
  const validFrom  = `01 Apr ${now.getFullYear()}`;
  const validUpto  = `31 Mar ${now.getFullYear() + 1}`;
  const bloodGroup = medical?.blood_group || 'N/A';
  const busRoute   = transport?.route_name || transport?.boarding_point || '—';

  const qrPayload = JSON.stringify({
    school : SCHOOL_NAME,
    adm    : student.admission_number,
    name   : student.name,
    cls    : `${student.class}-${student.section}`,
    roll   : student.roll_number,
    dob    : student.date_of_birth,
    yr     : student.academic_year,
  });

  const handlePrint = () => {
    const id  = '__id_print_css';
    const old = document.getElementById(id);
    if (old) old.remove();
    const s   = document.createElement('style');
    s.id      = id;
    // The wrapper sits deep inside #root, so hiding body's direct children hid
    // its own ancestor and printed a blank page. Hide by visibility instead --
    // that leaves the element renderable -- then lift it onto the sheet.
    s.innerHTML = `
      @media print {
        body * { visibility: hidden !important; }
        #__id-print-wrap, #__id-print-wrap * { visibility: visible !important; }
        #__id-print-wrap {
          position: fixed !important;
          inset: 0 !important;
          display: flex !important;
          flex-wrap: nowrap !important;
          gap: 12px;
          padding: 0 !important;
          align-items: center;
          justify-content: center;
          overflow: visible !important;
          max-height: none !important;
          background: #fff !important;
        }
        @page { size: A6 landscape; margin: 8mm; }
      }
    `;
    document.head.appendChild(s);
    window.print();
    setTimeout(() => { const el = document.getElementById(id); if (el) el.remove(); }, 1500);
  };

  const handleDownloadPDF = async () => {
    if (!frontRef.current || !backRef.current) return;
    setBusy(true);
    toast.loading('Rendering high-res ID cards…', { id: 'id-pdf' });
    try {
      const opts = { scale: 3, useCORS: true, backgroundColor: '#ffffff' };
      const [fc, bc] = await Promise.all([
        html2canvasSafe(frontRef.current, opts),
        html2canvasSafe(backRef.current, opts),
      ]);
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a6' });
      const cW = 86;
      const cH = 54;
      pdf.addImage(fc.toDataURL('image/png'), 'PNG', 2,  4, cW, cH);
      pdf.addImage(bc.toDataURL('image/png'), 'PNG', 2 + cW + 4, 4, cW, cH);
      pdf.save(`ID_Card_${student.name.replace(/ /g, '_')}_${student.admission_number}.pdf`);
      toast.success('ID card PDF downloaded!', { id: 'id-pdf' });
    } catch (e) {
      console.error(e);
      toast.error('PDF generation failed', { id: 'id-pdf' });
    } finally {
      setBusy(false);
    }
  };

  /* ── FRONT FACE ─────────────────────────────────────────── */
  const CardFront = () => (
    <div ref={frontRef} style={{ width: 320, border: '1.5px solid #e2e8f0', borderRadius: 16, overflow: 'hidden', background: '#fff' }}>
      {/* School header */}
      <div style={{ background: 'linear-gradient(135deg,#061f3d,#1a73e8,#061f3d)', color: '#fff', padding: '10px 14px', textAlign: 'center' }}>
        <div style={{ fontSize: 8.5, fontWeight: 900, letterSpacing: '0.15em', color: '#ffd200', textTransform: 'uppercase' }}>
          CBSE Affiliated • Aff. No. {CBSE_AFF_NO}
        </div>
        <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: '-0.02em', marginTop: 2 }}>
          {SCHOOL_NAME.toUpperCase()}
        </div>
        <div style={{ fontSize: 8.5, color: '#e2e8f0', marginTop: 1 }}>{SCHOOL_ADDR}</div>
        <div style={{ fontSize: 9, fontWeight: 700, marginTop: 4, background: 'rgba(255,255,255,0.15)', borderRadius: 99, display: 'inline-block', padding: '1px 10px', color: '#fff' }}>
          STUDENT IDENTITY CARD
        </div>
      </div>

      {/* Content row */}
      <div style={{ display: 'flex', gap: 10, padding: '12px 14px 8px' }}>
        {/* Photo */}
        <div style={{ flexShrink: 0 }}>
          <div style={{ width: 72, height: 88, borderRadius: 10, border: '2px solid #1a73e8', overflow: 'hidden', background: 'linear-gradient(135deg,#eff6ff,#dbeafe)', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>
            {student.photo_url
              ? <img src={student.photo_url} alt="" crossOrigin="anonymous" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, fontWeight: 900, color: '#1a73e8' }}>{student.name.charAt(0)}</div>
            }
          </div>
          <div style={{ textAlign: 'center', marginTop: 4, fontSize: 8, fontWeight: 700, color: '#1a73e8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            {student.gender || 'Student'}
          </div>
        </div>

        {/* Info */}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: '#0f172a', lineHeight: 1.2 }}>{student.name}</div>
          <div style={{ fontSize: 9, color: '#64748b', fontWeight: 600, marginTop: 2 }}>S/D/O: {student.father_name}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px', marginTop: 8 }}>
            {[
              ['Class', `${student.class} — ${student.section}`],
              ['Roll No', student.roll_number || 'N/A'],
              ['Adm. No', student.admission_number],
              ['DOB', student.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString('en-IN') : 'N/A'],
              ['Blood Grp', bloodGroup],
              ['Session', student.academic_year],
            ].map(([lbl, val]) => (
              <div key={lbl}>
                <div style={{ fontSize: 7.5, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{lbl}</div>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: '#1e293b', fontFamily: 'monospace' }}>{val}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ background: '#f8fafc', borderTop: '1px solid #e2e8f0', padding: '6px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 7.5, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Valid Period</div>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#334155' }}>{validFrom} — {validUpto}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 7.5, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>House</div>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#334155' }}>{student.house_name || '—'}</div>
        </div>
      </div>
    </div>
  );

  /* ── BACK FACE ──────────────────────────────────────────── */
  const CardBack = () => (
    <div ref={backRef} style={{ width: 320, border: '1.5px solid #e2e8f0', borderRadius: 16, overflow: 'hidden', background: '#fff' }}>
      <div style={{ background: 'linear-gradient(135deg,#1e293b,#0f172a)', color: '#fff', padding: '8px 14px', textAlign: 'center' }}>
        <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.2em', color: '#94a3b8', textTransform: 'uppercase' }}>
          {SCHOOL_NAME} — Back
        </div>
      </div>

      <div style={{ padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        {/* Info */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            ['Emergency Contact', student.phone || 'N/A'],
            ['Bus / Route', busRoute],
            ['Mother\'s Name', student.mother_name || 'N/A'],
          ].map(([lbl, val]) => (
            <div key={lbl}>
              <div style={{ fontSize: 7.5, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{lbl}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#1e293b', fontFamily: 'monospace' }}>{val}</div>
            </div>
          ))}
          <div>
            <div style={{ fontSize: 7.5, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Address</div>
            <div style={{ fontSize: 9.5, fontWeight: 600, color: '#334155', lineHeight: 1.4 }}>{student.address || 'N/A'}</div>
          </div>
        </div>

        {/* QR */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{ padding: 4, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8 }}>
            <QRCodeSVG value={qrPayload} size={56} level="M" />
          </div>
          <div style={{ fontSize: 7, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Scan to Verify</div>
        </div>
      </div>

      {/* Signatory */}
      <div style={{ borderTop: '1px dashed #e2e8f0', padding: '8px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ width: 80, height: 1, background: '#94a3b8', marginBottom: 3 }} />
          <div style={{ fontSize: 8, fontWeight: 900, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{PRINCIPAL}</div>
          <div style={{ fontSize: 7.5, color: '#94a3b8' }}>Authorized Signatory</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 8, color: '#64748b' }}>Ph: {SCHOOL_PHONE}</div>
          <div style={{ fontSize: 8, fontWeight: 700, color: '#475569', marginTop: 2 }}>If found, return to school.</div>
        </div>
      </div>
    </div>
  );

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          /* max-w-3xl fits both 320px cards on one row (320+320+20 gap+48 padding
             = 708px); at 2xl they wrapped into a ~950px-tall stack. max-h caps
             the dialog to the viewport so nothing is clipped on a laptop screen. */
          className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-hidden border border-slate-200 flex flex-col"
        >
          {/* Header */}
          <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#1a73e8] text-white flex items-center justify-center">
                <GraduationCap size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Student Identity Card</h3>
                <p className="text-[11px] text-slate-500">CBSE-standard • Front &amp; Back</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors">
              <X size={16} />
            </button>
          </div>

          {/* Cards preview */}
          {/* Only this region scrolls, so Close / Print / Download stay reachable
              however short the viewport is. */}
          <div id="__id-print-wrap" className="flex-1 min-h-0 overflow-y-auto p-6 flex flex-wrap gap-5 items-start justify-center bg-slate-100/70">
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Front</span>
              <CardFront />
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Back</span>
              <CardBack />
            </div>
          </div>

          {/* Actions */}
          <div className="shrink-0 px-6 py-4 bg-white border-t border-slate-100 flex items-center justify-between">
            <button onClick={onClose} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700 transition-colors">
              Close
            </button>
            <div className="flex gap-2">
              <button onClick={handlePrint} className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5">
                <Printer size={14} /> Print
              </button>
              <button onClick={handleDownloadPDF} disabled={busy} className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md disabled:opacity-60">
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                {busy ? 'Generating…' : 'Download PDF'}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
