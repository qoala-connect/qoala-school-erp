import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Layers, Users, BookOpen, ArrowUpRight, Network } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAcademicYear } from '@/context/AcademicYearContext';
import {
  fetchClassDirectory, fetchSectionDirectory, fetchClassSubjects,
  type ClassDirectoryRow, type SectionDirectoryRow, type ClassSubjectRow,
} from '@/services/academicsService';
import { AsyncBlock, EmptyBlock, Panel, StatusPill } from './shared';

/**
 * The academic hierarchy, top to bottom, for one year.
 *
 *   Academic year -> classes -> sections -> subjects -> teachers -> students
 *
 * Sections and subjects load only when a class is opened. Rendering the
 * whole tree eagerly is two requests per class before the administrator
 * has looked at any of them, and a school with forty classes would pay
 * that on every visit.
 */
export default function AcademicStructureView() {
  const navigate = useNavigate();
  const { selectedYearId, selectedYear } = useAcademicYear();

  const [classes, setClasses] = useState<ClassDirectoryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, { sections: SectionDirectoryRow[]; subjects: ClassSubjectRow[] }>>({});
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    if (!selectedYearId) return;
    setIsLoading(true);
    setError(null);
    try {
      setClasses(await fetchClassDirectory(selectedYearId));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [selectedYearId]);

  useEffect(() => { load(); }, [load]);

  // Clear cached branches when the year changes, or the tree would show
  // the previous year's sections under the new year's heading.
  useEffect(() => { setDetail({}); setOpenId(null); }, [selectedYearId]);

  const toggle = async (row: ClassDirectoryRow) => {
    if (openId === row.class_id) { setOpenId(null); return; }
    setOpenId(row.class_id);
    if (detail[row.class_id] || !selectedYearId) return;

    setDetailLoading(true);
    try {
      const [sections, subjects] = await Promise.all([
        fetchSectionDirectory(selectedYearId, row.class_id),
        fetchClassSubjects(selectedYearId, row.class_id),
      ]);
      setDetail(prev => ({ ...prev, [row.class_id]: { sections, subjects } }));
    } catch {
      setDetail(prev => ({ ...prev, [row.class_id]: { sections: [], subjects: [] } }));
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <Panel
      title="Academic structure"
      description={selectedYear
        ? `${selectedYear.name}: classes, the sections they run, and the subjects they are taught.`
        : undefined}
    >
      <AsyncBlock
        isLoading={isLoading}
        error={error}
        isEmpty={classes.length === 0}
        onRetry={load}
        loadingLabel="Building the structure"
        empty={
          <EmptyBlock
            icon={Network}
            title="Nothing to show yet"
            description="The structure fills in as classes, sections and subjects are configured."
          />
        }
      >
        <ol className="divide-y divide-slate-100">
          {classes.map(row => {
            const isOpen = openId === row.class_id;
            const branch = detail[row.class_id];
            return (
              <li key={row.class_id}>
                <button
                  onClick={() => toggle(row)}
                  aria-expanded={isOpen}
                  className="w-full flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-violet-600"
                >
                  <ChevronRight
                    className={cn('w-4 h-4 text-slate-400 shrink-0 transition-transform', isOpen && 'rotate-90')}
                    aria-hidden="true"
                  />
                  <Layers className="w-4 h-4 text-violet-500 shrink-0" aria-hidden="true" />
                  <span className="text-xs font-extrabold text-slate-900 shrink-0">Class {row.class_name}</span>
                  {!row.is_active && <StatusPill tone="muted">Inactive</StatusPill>}
                  <span className="text-[11px] text-slate-400 font-semibold ml-auto shrink-0 tabular-nums">
                    {row.sections_count} section{row.sections_count === 1 ? '' : 's'} ·{' '}
                    {row.subjects_count} subject{row.subjects_count === 1 ? '' : 's'} ·{' '}
                    {row.students_count} student{row.students_count === 1 ? '' : 's'}
                  </span>
                </button>

                {isOpen && (
                  <div className="pl-12 pr-5 pb-4 bg-slate-50/40">
                    {!branch && detailLoading ? (
                      <p className="text-[11px] text-slate-400 py-3">Loading…</p>
                    ) : !branch ? null : (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
                        <div>
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                            Sections and class teachers
                          </h4>
                          {branch.sections.length === 0 ? (
                            <p className="text-[11px] text-slate-400">No sections configured.</p>
                          ) : (
                            <ul className="space-y-1.5">
                              {branch.sections.map(s => (
                                <li key={s.class_section_id} className="flex items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl px-3 py-2">
                                  <span className="text-xs font-bold text-slate-800 shrink-0">
                                    {row.class_name}-{s.section_name}
                                  </span>
                                  <span className="text-[11px] text-slate-500 truncate">
                                    {s.class_teacher_name ?? 'No class teacher'}
                                  </span>
                                  <button
                                    onClick={() => navigate('/dashboard/students', {
                                      state: { classFilter: row.class_id, sectionFilter: s.section_id },
                                    })}
                                    className="text-[11px] font-bold text-violet-600 hover:text-violet-800 shrink-0 inline-flex items-center gap-0.5"
                                  >
                                    <Users size={11} aria-hidden="true" />
                                    {s.students_count}
                                    <ArrowUpRight size={10} aria-hidden="true" />
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>

                        <div>
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                            Subjects and subject teachers
                          </h4>
                          {branch.subjects.length === 0 ? (
                            <p className="text-[11px] text-slate-400">
                              No subjects mapped for {selectedYear?.name}.
                            </p>
                          ) : (
                            <ul className="space-y-1.5">
                              {branch.subjects.map(s => (
                                <li key={s.mapping_id} className="flex items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl px-3 py-2">
                                  <span className="text-xs font-bold text-slate-800 truncate flex items-center gap-1.5">
                                    <BookOpen size={11} className="text-indigo-400 shrink-0" aria-hidden="true" />
                                    {s.subject_name}
                                  </span>
                                  <span className="text-[11px] text-slate-500 truncate shrink-0">
                                    {s.teacher_names ?? 'Unassigned'}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </AsyncBlock>
    </Panel>
  );
}
