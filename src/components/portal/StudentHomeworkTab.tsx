import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { PencilRuler, Check, Clock, AlertTriangle, ExternalLink, Send } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import {
  AsyncBlock, EmptyBlock, Field, GhostButton, Modal, PrimaryButton, StatusPill,
  inputClass, selectClass,
} from '@/components/academics/shared';

/**
 * Homework for a student (kind = 'homework'), with the submit flow.
 * A linked parent sees the same list read only — no submit control, and
 * row level security blocks a submission written on a child's behalf.
 *
 * `kind` decides which list this is: 'homework' here, 'assignment' when
 * reused for the Assignments tab.
 */

interface Row {
  id: string;
  title: string;
  description: string | null;
  kind: string;
  status: string;
  assigned_date: string;
  due_date: string | null;
  max_marks: number | null;
  attachment_url: string | null;
  subject: string | null;
  submission: {
    id: string;
    status: string;
    submitted_at: string | null;
    marks_obtained: number | null;
    feedback: string | null;
  } | null;
}

export default function StudentHomeworkTab({
  studentId, canSubmit, kind = 'homework',
}: {
  studentId: string;
  canSubmit: boolean;
  kind?: 'homework' | 'assignment';
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'submitted' | 'reviewed'>('all');

  const [open, setOpen] = useState<Row | null>(null);
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [{ data: asg, error: aErr }, { data: subs, error: sErr }] = await Promise.all([
        supabase
          .from('assignments')
          .select('id, title, description, kind, status, assigned_date, due_date, max_marks, attachment_url, subjects (subject_name)')
          .eq('kind', kind)
          .order('due_date', { ascending: true }),
        supabase
          .from('student_assignment_submissions')
          .select('id, assignment_id, status, submitted_at, marks_obtained, feedback')
          .eq('student_id', studentId),
      ]);
      if (aErr) throw aErr;
      if (sErr) throw sErr;
      const subMap = new Map((subs ?? []).map((s: any) => [s.assignment_id, s]));
      setRows((asg ?? []).map((a: any) => ({
        id: a.id,
        title: a.title,
        description: a.description,
        kind: a.kind,
        status: a.status,
        assigned_date: a.assigned_date,
        due_date: a.due_date,
        max_marks: a.max_marks,
        attachment_url: a.attachment_url,
        subject: a.subjects?.subject_name ?? null,
        submission: subMap.get(a.id) ?? null,
      })));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [studentId, kind]);

  useEffect(() => { load(); }, [load]);

  const stateOf = (r: Row): { label: string; tone: 'good' | 'warn' | 'bad' | 'muted' | 'info' } => {
    if (r.submission) {
      if (r.submission.status === 'reviewed' || r.submission.status === 'returned') return { label: 'Reviewed', tone: 'good' };
      if (r.submission.status === 'late') return { label: 'Submitted late', tone: 'warn' };
      return { label: 'Submitted', tone: 'info' };
    }
    if (r.due_date && r.due_date < new Date().toISOString().slice(0, 10)) return { label: 'Overdue', tone: 'bad' };
    return { label: 'Pending', tone: 'warn' };
  };

  const filtered = useMemo(() => rows.filter(r => {
    const st = stateOf(r);
    if (filter === 'pending') return !r.submission;
    if (filter === 'submitted') return !!r.submission && r.submission.status !== 'reviewed' && r.submission.status !== 'returned';
    if (filter === 'reviewed') return r.submission?.status === 'reviewed' || r.submission?.status === 'returned';
    return true;
  }), [rows, filter]);

  const openSubmit = (r: Row) => {
    setOpen(r);
    setText('');
    setUrl('');
  };

  const submit = async () => {
    if (!open) return;
    if (!text.trim() && !url.trim()) { toast.error('Enter your answer or an attachment link.'); return; }
    setBusy(true);
    try {
      const late = !!open.due_date && open.due_date < new Date().toISOString().slice(0, 10);
      const { error } = await supabase.from('student_assignment_submissions').upsert({
        assignment_id: open.id,
        student_id: studentId,
        submission_text: text.trim() || null,
        submission_url: url.trim() || null,
        submitted_at: new Date().toISOString(),
        status: late ? 'late' : 'submitted',
      }, { onConflict: 'assignment_id,student_id' });
      if (error) throw error;
      toast.success('Submitted.');
      setOpen(null);
      await load();
    } catch (err: any) {
      toast.error(err.message || 'Could not submit.');
    } finally {
      setBusy(false);
    }
  };

  const noun = kind === 'homework' ? 'homework' : 'assignment';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(['all', 'pending', 'submitted', 'reviewed'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={cn('px-3 py-1.5 rounded-lg text-xs font-bold capitalize border',
              filter === f ? 'bg-[#1a73e8] text-white border-[#1a73e8]' : 'bg-white text-slate-600 border-slate-200')}>
            {f}
          </button>
        ))}
      </div>

      <AsyncBlock
        isLoading={isLoading} error={error} isEmpty={filtered.length === 0} onRetry={load}
        loadingLabel={`Loading ${noun}`}
        empty={<EmptyBlock icon={PencilRuler} title={`No ${noun} ${filter === 'all' ? 'yet' : `that is ${filter}`}`} description={`When a teacher sets ${noun} for your class it appears here.`} />}
      >
        <ul className="space-y-2">
          {filtered.map(r => {
            const st = stateOf(r);
            return (
              <li key={r.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-extrabold text-slate-900">{r.title}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {r.subject ? `${r.subject} · ` : ''}Assigned {r.assigned_date}{r.due_date ? ` · Due ${r.due_date}` : ''}
                    </p>
                  </div>
                  <StatusPill tone={st.tone}>{st.label}</StatusPill>
                </div>
                {r.description && <p className="text-[12.5px] text-slate-600 mt-2 whitespace-pre-wrap">{r.description}</p>}
                {r.attachment_url && (
                  <a href={r.attachment_url} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[12px] font-bold text-indigo-600 hover:text-indigo-800 mt-2">
                    <ExternalLink size={12} /> Attachment
                  </a>
                )}

                {r.submission && (
                  <div className="mt-2.5 rounded-lg bg-slate-50 border border-slate-100 px-3 py-2 text-[12px] text-slate-600">
                    {r.submission.submitted_at && <span>Submitted {new Date(r.submission.submitted_at).toLocaleDateString()}. </span>}
                    {r.submission.marks_obtained != null && r.max_marks != null && (
                      <span className="font-bold text-slate-800">Score {r.submission.marks_obtained}/{r.max_marks}. </span>
                    )}
                    {r.submission.feedback && <span className="block mt-1"><span className="font-bold">Feedback:</span> {r.submission.feedback}</span>}
                  </div>
                )}

                {canSubmit && r.status !== 'closed' && (r.submission?.status !== 'reviewed') && (
                  <div className="mt-3">
                    <GhostButton onClick={() => openSubmit(r)}>
                      <Send size={13} /> {r.submission ? 'Resubmit' : 'Submit'}
                    </GhostButton>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </AsyncBlock>

      {open && (
        <Modal
          title={`Submit: ${open.title}`}
          description={open.due_date ? `Due ${open.due_date}` : undefined}
          onClose={() => setOpen(null)}
          footer={
            <>
              <GhostButton onClick={() => setOpen(null)} disabled={busy}>Cancel</GhostButton>
              <PrimaryButton onClick={submit} disabled={busy}>{busy ? 'Submitting…' : 'Submit'}</PrimaryButton>
            </>
          }
        >
          <div className="space-y-3">
            <Field label="Your answer" htmlFor="hw-text">
              <textarea id="hw-text" className={inputClass + ' h-28 py-2'} value={text}
                onChange={e => setText(e.target.value)} placeholder="Type your answer, or describe your attached work." />
            </Field>
            <Field label="Attachment link" htmlFor="hw-url" hint="Optional — a link to a shared doc or photo of your work.">
              <input id="hw-url" className={inputClass} value={url} onChange={e => setUrl(e.target.value)}
                placeholder="https://…" />
            </Field>
          </div>
        </Modal>
      )}
    </div>
  );
}
