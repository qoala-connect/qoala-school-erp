import type { Components } from 'react-markdown';

/**
 * Shared react-markdown component overrides for AI chat surfaces.
 * Must be paired with `remarkPlugins={[remarkGfm]}` for table/strikethrough support.
 */
export const aiMarkdownComponents: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
  li: ({ children }) => <li className="leading-snug">{children}</li>,
  strong: ({ children }) => <strong className="font-extrabold">{children}</strong>,
  h1: ({ children }) => <h1 className="text-sm font-extrabold mb-1.5">{children}</h1>,
  h2: ({ children }) => <h2 className="text-xs font-extrabold mb-1">{children}</h2>,
  h3: ({ children }) => <h3 className="text-xs font-bold mb-1">{children}</h3>,
  code: ({ children }) => (
    <code className="px-1.5 py-0.5 bg-slate-100 text-blue-700 rounded text-[11px] font-mono border border-slate-200">
      {children}
    </code>
  ),
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full border-collapse text-[11px]">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-slate-100">{children}</thead>,
  tbody: ({ children }) => <tbody className="divide-y divide-slate-100">{children}</tbody>,
  tr: ({ children }) => <tr className="even:bg-slate-50/60">{children}</tr>,
  th: ({ children }) => (
    <th className="px-2 py-1.5 text-left font-bold text-slate-700 whitespace-nowrap">{children}</th>
  ),
  td: ({ children }) => <td className="px-2 py-1.5 text-slate-700 align-top">{children}</td>
};
