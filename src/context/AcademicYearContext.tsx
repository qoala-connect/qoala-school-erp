import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { fetchAcademicYears, type AcademicYear } from '@/services/academicsService';

/**
 * The academic year the dashboard is looking at.
 *
 * Before this existed, eight screens each ran their own
 * `from('academic_years')` query and each decided independently what the
 * current year was, so Students, Fees and Examination could disagree
 * about which year they were showing. This is the one place that answers
 * the question.
 *
 * Two values, and they are not the same thing:
 *
 *   currentYear   the year the school is actually in, the single row with
 *                 is_current set. Changing it is an administrative act
 *                 that goes through set_current_academic_year().
 *   selectedYear  the year the user is looking at. Defaults to the
 *                 current year and may be moved to a past one to read
 *                 history. Selecting a past year never edits anything.
 *
 * The selection lives in memory for the session. It is not written to
 * localStorage: a stale year silently pinned in browser storage is
 * exactly how a user ends up marking attendance against the wrong year.
 */
interface AcademicYearContextValue {
  years: AcademicYear[];
  currentYear: AcademicYear | null;
  selectedYear: AcademicYear | null;
  selectedYearId: string | null;
  /** True when the user has moved off the school's current year. */
  isViewingHistory: boolean;
  isLoading: boolean;
  error: string | null;
  selectYear: (yearId: string) => void;
  refresh: () => Promise<void>;
}

const AcademicYearContext = createContext<AcademicYearContextValue | undefined>(undefined);

export function AcademicYearProvider({ children }: { children: React.ReactNode }) {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const rows = await fetchAcademicYears();
      setYears(rows);

      // Keep whatever the user had selected if it still exists, so a
      // refresh does not throw them back to the current year mid-task.
      setSelectedYearId(prev => {
        if (prev && rows.some(y => y.id === prev)) return prev;
        return rows.find(y => y.is_current)?.id ?? rows[0]?.id ?? null;
      });
    } catch (err: any) {
      setError(err.message || 'Could not load academic years.');
      setYears([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const value = useMemo<AcademicYearContextValue>(() => {
    const currentYear = years.find(y => y.is_current) ?? null;
    const selectedYear = years.find(y => y.id === selectedYearId) ?? null;
    return {
      years,
      currentYear,
      selectedYear,
      selectedYearId,
      isViewingHistory: !!selectedYear && !!currentYear && selectedYear.id !== currentYear.id,
      isLoading,
      error,
      selectYear: setSelectedYearId,
      refresh: load,
    };
  }, [years, selectedYearId, isLoading, error, load]);

  return (
    <AcademicYearContext.Provider value={value}>
      {children}
    </AcademicYearContext.Provider>
  );
}

export function useAcademicYear(): AcademicYearContextValue {
  const ctx = useContext(AcademicYearContext);
  if (ctx === undefined) {
    throw new Error('useAcademicYear must be used inside an AcademicYearProvider');
  }
  return ctx;
}
