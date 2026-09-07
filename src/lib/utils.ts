import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Words a fee head keeps lower-case in the middle of the name.
const FEE_HEAD_MINOR_WORDS = new Set(['and', 'or', 'of', 'for', 'per', 'the', 'a', 'an', 'to', 'in', 'on']);

// Genuine acronyms, which must not be flattened to "Cbse".
const FEE_HEAD_ACRONYMS = new Set(['CBSE', 'PTA', 'ID', 'IT', 'ICT', 'AC', 'RTE', 'SMS', 'GST']);

/**
 * Fee heads are typed free-hand by the office, so the catalogue collected
 * "tuition fee", "TUITION FEE" and the common misspelling "tution fee" as three
 * different-looking heads. Every screen renders the name through this, and
 * feeService normalises it again on save, so a head always reads as
 * "Tuition Fee".
 */
export function formatFeeHeadName(raw?: string | null): string {
  const name = (raw || '').trim().replace(/\s+/g, ' ');
  if (!name) return '';

  return name
    .split(' ')
    .map((word, index) => {
      if (FEE_HEAD_ACRONYMS.has(word.toUpperCase())) return word.toUpperCase();
      // "tution" is the misspelling the office types most often.
      const raw = word.toLowerCase();
      const lower = raw === 'tution' ? 'tuition' : raw;
      if (index > 0 && FEE_HEAD_MINOR_WORDS.has(lower)) return lower;
      // Capitalise across separators too, so "term-wise" -> "Term-Wise".
      return lower.replace(/(^|[-/&(])([a-z])/g, (_m, sep, ch) => sep + ch.toUpperCase());
    })
    .join(' ');
}
