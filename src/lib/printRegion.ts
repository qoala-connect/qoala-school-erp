/**
 * Print one region of the current page.
 *
 * The global print stylesheet used to hide `#root` — the element the whole app
 * mounts into — and reveal a `#print-receipt-portal-root` that exists nowhere
 * in the DOM, so every print button in the app produced a blank sheet. Scoping
 * is now done with `visibility` (inheritable and reversible on descendants,
 * unlike `display: none`) against the `[data-print-region]` attribute.
 *
 * Returns false when the region is not on screen, so callers can report a
 * failure instead of claiming a print that never happened.
 */
export function printRegion(regionId: string, documentTitle?: string): boolean {
  const region = document.getElementById(regionId);
  if (!region) {
    console.warn(`[printRegion] no element with id "${regionId}" to print`);
    return false;
  }

  region.setAttribute('data-print-region', '');
  document.body.classList.add('print-region-active');

  const previousTitle = document.title;
  if (documentTitle) document.title = documentTitle;

  const cleanup = () => {
    document.body.classList.remove('print-region-active');
    region.removeAttribute('data-print-region');
    document.title = previousTitle;
    window.removeEventListener('afterprint', cleanup);
  };

  window.addEventListener('afterprint', cleanup);

  try {
    window.print();
  } finally {
    // Safari never fires afterprint reliably; the listener above is the normal
    // path and this is the belt-and-braces one. Both are idempotent.
    setTimeout(cleanup, 1000);
  }

  return true;
}
