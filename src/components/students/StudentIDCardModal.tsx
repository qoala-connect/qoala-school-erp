import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Printer, Download, GraduationCap, Loader2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Student, StudentMedicalRecord, StudentTransportInfo } from '@/types/student';
import html2canvasSafe from '@/lib/html2canvasSafe';
import { jsPDF } from 'jspdf';
import { toast } from 'sonner';
import sjsLogoIcon from '@/assets/sjs_logo_icon.jpg';

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

// ISO/IEC 7810 ID-1 — the physical size of every real ID card, credit card
// and driving license. Both faces are built to this exact size (in real
// millimetres, not scaled screen pixels), so what prints is the actual card,
// ready to laminate and put on a lanyard — no cropping, no guessing a scale.
const CARD_W_MM = 85.6;
const CARD_H_MM = 53.98;

// Shared brand gradient (matches the navy/gold of the school crest) so front
// and back read as two faces of one card rather than two different designs.
const BRAND_GRADIENT = 'linear-gradient(135deg,#061f3d 0%,#0a2a52 45%,#061f3d 100%)';
const GOLD           = '#f5b301';

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
    // The page is sized to the two true-size (85.6 x 53.98mm) cards plus a
    // cutting margin, not a generic paper size — anything bigger just wastes
    // the sheet and anything smaller would clip a card, exactly as the old
    // A6 page did to the PDF export below.
    s.innerHTML = `
      @media print {
        body * { visibility: hidden !important; }
        #__id-print-wrap, #__id-print-wrap * { visibility: visible !important; }
        #__id-print-wrap {
          position: fixed !important;
          inset: 0 !important;
          display: flex !important;
          flex-wrap: nowrap !important;
          gap: 10mm;
          padding: 0 !important;
          align-items: center;
          justify-content: center;
          overflow: visible !important;
          max-height: none !important;
          background: #fff !important;
        }
        @page { size: 200mm 90mm; margin: 6mm; }
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
      // scale: 3 on an 85.6mm-wide card renders at print resolution
      // (roughly 300dpi) rather than screen resolution — text and the QR
      // code stay crisp once laminated, not just on a monitor.
      const opts = { scale: 3, useCORS: true, backgroundColor: '#ffffff' };
      const [fc, bc] = await Promise.all([
        html2canvasSafe(frontRef.current, opts),
        html2canvasSafe(backRef.current, opts),
      ]);
      // Custom page sized to the two real-world card dimensions plus a
      // 9.4mm margin on every edge — not a generic A6. The previous A6
      // landscape page (148mm wide) placed the back card's image from
      // 92mm to 178mm: 30mm past the page's right edge, so it was silently
      // clipped off every exported PDF. This page is built to actually fit
      // both true-size cards with room to spare.
      const pageW = 196;
      const pageH = 66;
      const marginX = (pageW - CARD_W_MM * 2 - 6) / 2;
      const y = (pageH - CARD_H_MM) / 2;
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [pageW, pageH] });
      pdf.addImage(fc.toDataURL('image/png'), 'PNG', marginX, y, CARD_W_MM, CARD_H_MM);
      pdf.addImage(bc.toDataURL('image/png'), 'PNG', marginX + CARD_W_MM + 6, y, CARD_W_MM, CARD_H_MM);
      pdf.save(`ID_Card_${student.name.replace(/ /g, '_')}_${student.admission_number}.pdf`);
      toast.success('ID card PDF downloaded!', { id: 'id-pdf' });
    } catch (e) {
      console.error(e);
      toast.error('PDF generation failed', { id: 'id-pdf' });
    } finally {
      setBusy(false);
    }
  };

  // Both faces share this exact shell: fixed real-world size, flex column so
  // header/body/footer share the height evenly regardless of which side has
  // more to say, same corner radius and shadow. This is what makes front and
  // back the same size — previously each was only as tall as its own
  // content, so the front (photo + a 3x2 detail grid) ended up visibly
  // taller than the back (a shorter info list), even though they're the two
  // faces of one physical card and must be identical.
  const cardShell: React.CSSProperties = {
    width: `${CARD_W_MM}mm`,
    height: `${CARD_H_MM}mm`,
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    border: '1px solid #cbd5e1',
    borderRadius: 10,
    overflow: 'hidden',
    background: '#fff',
    boxShadow: '0 6px 20px rgba(6,31,61,0.18)',
  };

  /* ── FRONT FACE ─────────────────────────────────────────── */
  const CardFront = () => (
    <div ref={frontRef} style={cardShell}>
      {/* School header — logo + name lockup, with a clear band above the
          text reserved for a lanyard slot punch so laminating doesn't cut
          through the crest or the school name. */}
      <div style={{ background: BRAND_GRADIENT, color: '#fff', padding: '2.6mm 3mm 2mm', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2mm', justifyContent: 'center' }}>
          <img
            src={sjsLogoIcon}
            alt=""
            style={{ width: '6mm', height: '6mm', borderRadius: '50%', objectFit: 'cover', border: `0.5px solid ${GOLD}`, flexShrink: 0 }}
          />
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 10.5, fontWeight: 900, letterSpacing: '-0.01em', lineHeight: 1.05 }}>
              {SCHOOL_NAME.toUpperCase()}
            </div>
            <div style={{ fontSize: 6.3, color: GOLD, fontWeight: 800, letterSpacing: '0.09em', textTransform: 'uppercase', marginTop: 0.5 }}>
              CBSE Affiliated • {CBSE_AFF_NO}
            </div>
          </div>
        </div>
        <div style={{
          fontSize: 7.5, fontWeight: 800, marginTop: '1.4mm', background: 'rgba(255,255,255,0.14)',
          border: `0.5px solid ${GOLD}55`, borderRadius: 99, display: 'inline-block', padding: '0.6mm 3mm', letterSpacing: '0.08em',
        }}>
          STUDENT IDENTITY CARD
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', gap: '2.6mm', padding: '2.4mm 3mm', minHeight: 0 }}>
        {/* Photo */}
        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{
            width: '17mm', height: '20mm', borderRadius: 6, border: '1px solid #061f3d', overflow: 'hidden',
            background: 'linear-gradient(135deg,#eff6ff,#dbeafe)', boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
          }}>
            {student.photo_url
              ? <img src={student.photo_url} alt="" crossOrigin="anonymous" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 900, color: '#1a73e8' }}>{student.name.charAt(0)}</div>
            }
          </div>
          <div style={{ marginTop: '1mm', fontSize: 6, fontWeight: 800, color: '#1a73e8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {student.gender || 'Student'}
          </div>
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 900, color: '#0f172a', lineHeight: 1.15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{student.name}</div>
          <div style={{ fontSize: 7, color: '#64748b', fontWeight: 700, marginTop: 1 }}>S/D/O: {student.father_name}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.6mm 2.2mm', marginTop: '1.8mm' }}>
            {[
              ['Class', `${student.class} — ${student.section}`],
              ['Roll No', student.roll_number || 'N/A'],
              ['Adm. No', student.admission_number],
              ['DOB', student.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString('en-IN') : 'N/A'],
              ['Blood Grp', bloodGroup],
              ['Session', student.academic_year],
            ].map(([lbl, val]) => (
              <div key={lbl}>
                <div style={{ fontSize: 5.6, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{lbl}</div>
                <div style={{ fontSize: 7.6, fontWeight: 700, color: '#1e293b', fontFamily: 'monospace' }}>{val}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ background: '#f8fafc', borderTop: '1px solid #e2e8f0', padding: '1.6mm 3mm', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 5.6, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Valid Period</div>
          <div style={{ fontSize: 7.2, fontWeight: 800, color: '#334155' }}>{validFrom} — {validUpto}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 5.6, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>House</div>
          <div style={{ fontSize: 7.2, fontWeight: 800, color: '#334155' }}>{student.house_name || '—'}</div>
        </div>
      </div>
    </div>
  );

  /* ── BACK FACE ──────────────────────────────────────────── */
  const CardBack = () => (
    <div ref={backRef} style={cardShell}>
      <div style={{ background: BRAND_GRADIENT, color: '#fff', padding: '1.8mm 3mm', textAlign: 'center' }}>
        <div style={{ fontSize: 7.8, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          {SCHOOL_NAME}
        </div>
        <div style={{ fontSize: 6, color: GOLD, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 0.5 }}>
          Contact &amp; Verification
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', gap: '2.6mm', padding: '2.2mm 3mm', minHeight: 0 }}>
        {/* Info */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '1.6mm' }}>
          {[
            ['Emergency Contact', student.phone || 'N/A'],
            ['Bus / Route', busRoute],
            ["Mother's Name", student.mother_name || 'N/A'],
          ].map(([lbl, val]) => (
            <div key={lbl}>
              <div style={{ fontSize: 5.6, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{lbl}</div>
              <div style={{ fontSize: 7.4, fontWeight: 700, color: '#1e293b', fontFamily: 'monospace' }}>{val}</div>
            </div>
          ))}
          <div>
            <div style={{ fontSize: 5.6, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Address</div>
            <div style={{ fontSize: 7, fontWeight: 600, color: '#334155', lineHeight: 1.3 }}>{student.address || 'N/A'}</div>
          </div>
        </div>

        {/* QR */}
        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1mm' }}>
          <div style={{ padding: '1mm', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 5 }}>
            <QRCodeSVG value={qrPayload} size={44} level="M" />
          </div>
          <div style={{ fontSize: 5, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Scan to Verify</div>
        </div>
      </div>

      {/* Signatory */}
      <div style={{ borderTop: '1px dashed #cbd5e1', padding: '1.6mm 3mm', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ width: '15mm', height: 0.5, background: '#94a3b8', marginBottom: 1 }} />
          <div style={{ fontSize: 6.4, fontWeight: 900, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{PRINCIPAL}</div>
          <div style={{ fontSize: 5.6, color: '#94a3b8' }}>Authorized Signatory</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 6, color: '#64748b' }}>Ph: {SCHOOL_PHONE}</div>
          <div style={{ fontSize: 6, fontWeight: 700, color: '#475569', marginTop: 0.5 }}>If found, return to school.</div>
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
          /* max-w-3xl fits both true-size (~324px on screen) cards on one row;
             max-h caps the dialog to the viewport so nothing is clipped. */
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
                <p className="text-[11px] text-slate-500">ISO ID-1 card size (85.6 × 54mm) • Print &amp; laminate for lanyard use</p>
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
