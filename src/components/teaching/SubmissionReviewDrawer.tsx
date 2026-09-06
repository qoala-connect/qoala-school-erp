import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ExternalLink } from 'lucide-react';
import {
  fetchAssignmentSubmissions, reviewSubmission,
  type Assignment, type AssignmentSubmission,
} from '@/services/teachingService';
import {
  AsyncBlock, EmptyBlock, Field, GhostButton, Modal, PrimaryButton, StatusPill, inputClass,
} from '@/components/academics/shared';

/**
 * Review the submissions for one assignment: read what a student sent,
 * give marks and feedback, mark it reviewed or return it. Scoped by RLS
 * to assignments the signed-in teacher owns.
 */
export default function SubmissionReviewDrawer({
  assignment, teacherId, rosterCount, onClose, onReviewed,
}: {
  assignment: Assignment;
  teacherId: string;
  rosterCount?: number;
  onClose: () => void;
  onReviewed: () => void;
}) {
  const [subs, setSubs] = useState<AssignmentSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ marks: string; feedback: string }>({ marks: '', feedback: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setSubs(await fetchAssignmentSubmissions(assignment.id));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [assignment.id]);

  useEffect(() => { load(); }, [load]);

  const startReview = (s: AssignmentSubmission) => {
    setOpen(s.id);
    setDraft({
      marks: s.marks_obtained != null ? String(s.marks_obtained) : '',
      feedback: s.feedback ?? '',
    });
  };

  const submit = async (s: AssignmentSubmission, status: 'reviewed' | 'returned') => {
    setBusy(true);
    try {
      await reviewSubmission({
        id: s.id,
        teacher_id: teacherId,
        marks_obtained: draft.marks !== '' ? Number(draft.marks) : null,
        feedback: draft.feedback,
        status,
      });
      toast.success(status === 'returned' ? 'Returned to student.' : 'Marked reviewed.');
      setOpen(null);
      await load();
      onReviewed();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const reviewed = subs.filter(s => s.status === 'reviewed' || s.status === 'returned').length;

  return (
    <Modal
      title={assignment.title}
      description={`${assignment.kind === 'homework' ? 'Homework' : 'Assignment'} · ${subs.length} submission${subs.length === 1 ? '' : 's'}${rosterCount ? ` of ${rosterCount}` : ''} · ${reviewed} reviewed`}
      onClose={onClose}
      wide
      footer={<GhostButton onClick={onClose}>Close</GhostButton>}
    >
      <AsyncBlock
        isLoading={isLoading} error={error} isEmpty={subs.length === 0} onRetry={load}
        loadingLabel="Loading submissions"
        empty={<EmptyBlock title="No submissions yet" description="Nothing has been submitted for this item." />}
      >
        <ul className="space-y-2">
          {subs.map(s => {
            const isOpen = open === s.id;
            return (
              <li key={s.id} className="rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center gap-3 px-3.5 py-2.5">
                  <span className="w-8 text-[11px] font-black text-slate-400 tabular-nums">{s.roll_number}</span>
                  <span className="text-[13px] font-bold text-slate-800 flex-1 min-w-0 truncate">{s.student_name}</span>
                  <StatusPill tone={
                    s.status === 'reviewed' ? 'good' : s.status === 'returned' ? 'info' : s.status === 'late' ? 'warn' : 'muted'
                  }>{s.status}</StatusPill>
                  {s.marks_obtained != null && assignment.max_marks != null && (
                    <span className="text-[11px] font-bold text-slate-600 tabular-nums">{s.marks_obtained}/{assignment.max_marks}</span>
                  )}
                  <GhostButton onClick={() => (isOpen ? setOpen(null) : startReview(s))}>
                    {isOpen ? 'Close' : 'Review'}
                  </GhostButton>
                </div>

                {isOpen && (
                  <div className="border-t border-slate-100 px-3.5 py-3 space-y-3 bg-slate-50/50">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Submitted work</p>
                      {s.submission_text && <p className="text-[13px] text-slate-700 whitespace-pre-wrap">{s.submission_text}</p>}
                      {s.submission_url && (
                        <a href={s.submission_url} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[12px] font-bold text-indigo-600 hover:text-indigo-800 mt-1">
                          <ExternalLink size={12} /> Open attachment
                        </a>
                      )}
                      {!s.submission_text && !s.submission_url && <p className="text-[12px] text-slate-400">No content.</p>}
                      {s.submitted_at && (
                        <p className="text-[10px] text-slate-400 mt-1">
                          Submitted {new Date(s.submitted_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-3">
                      {assignment.kind === 'assignment' && (
                        <Field label={`Marks${assignment.max_marks ? ` / ${assignment.max_marks}` : ''}`} htmlFor={`m-${s.id}`}>
                          <input id={`m-${s.id}`} type="number" min={0} max={assignment.max_marks ?? undefined}
                            className={inputClass} value={draft.marks}
                            onChange={e => setDraft(d => ({ ...d, marks: e.target.value }))} />
                        </Field>
                      )}
                      <Field label="Feedback" htmlFor={`f-${s.id}`}>
                        <textarea id={`f-${s.id}`} className={inputClass + ' h-16 py-2'} value={draft.feedback}
                          onChange={e => setDraft(d => ({ ...d, feedback: e.target.value }))}
                          placeholder="What was good, what to fix." />
                      </Field>
                    </div>
                    <div className="flex justify-end gap-2">
                      <GhostButton onClick={() => submit(s, 'returned')} disabled={busy}>Return for redo</GhostButton>
                      <PrimaryButton onClick={() => submit(s, 'reviewed')} disabled={busy}>
                        {busy ? 'Saving…' : 'Save review'}
                      </PrimaryButton>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </AsyncBlock>
    </Modal>
  );
}
