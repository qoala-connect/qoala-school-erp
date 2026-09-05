import React, { useEffect, useState, useCallback } from 'react';
import { 
  searchAuditLogs, 
  fetchAuditLogFacets, 
  AuditLogRow, 
  AuditLogFacets 
} from '@/services/systemService';
import { useAuth } from '@/context/AuthContext';
import { 
  PaginationBar, 
  SystemLoadingBlock, 
  SystemErrorBlock 
} from './shared';
import { toast } from 'sonner';
import { 
  Activity, 
  Search, 
  Filter, 
  Calendar, 
  User, 
  Database, 
  FileCode, 
  Eye, 
  X, 
  RefreshCw, 
  Clock, 
  Copy, 
  Check,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AuditLogsView() {
  const { can } = useAuth();
  const canViewAudit = can('audit.view') || can('settings.manage');

  // Query state
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [tableFilter, setTableFilter] = useState('all');
  const [actorFilter, setActorFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 25;

  // Data state
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [facets, setFacets] = useState<AuditLogFacets>({ actions: [], tables: [], actors: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Inspector modal state
  const [inspectLog, setInspectLog] = useState<AuditLogRow | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const loadFacets = useCallback(async () => {
    try {
      const data = await fetchAuditLogFacets();
      setFacets(data);
    } catch (err) {
      console.warn('[AuditLogs] fetchFacets error:', err);
    }
  }, []);

  const loadLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { logs: list, totalCount: count } = await searchAuditLogs({
        search: search.trim(),
        action: actionFilter,
        table: tableFilter,
        userId: actorFilter !== 'all' ? actorFilter : undefined,
        from: fromDate ? new Date(fromDate).toISOString() : undefined,
        to: toDate ? new Date(toDate + 'T23:59:59').toISOString() : undefined,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
      setLogs(list);
      setTotalCount(count);
    } catch (err: any) {
      console.error('[AuditLogs] search error:', err);
      setError(err?.message || 'Could not load audit trail');
    } finally {
      setIsLoading(false);
    }
  }, [search, actionFilter, tableFilter, actorFilter, fromDate, toDate, page]);

  useEffect(() => {
    loadFacets();
  }, [loadFacets]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const getActionBadgeClass = (action: string) => {
    if (action.includes('GRANT') || action.includes('CREATE') || action.includes('LINKED')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    if (action.includes('REVOKE') || action.includes('STATUS') || action.includes('ROLE')) {
      return 'bg-amber-50 text-amber-700 border-amber-200';
    }
    if (action.includes('DELETE') || action.includes('UNLINKED')) {
      return 'bg-rose-50 text-rose-700 border-rose-200';
    }
    return 'bg-violet-50 text-violet-700 border-violet-200';
  };

  return (
    <div className="space-y-4">
      {/* Top filter toolbar */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Immutable Audit Trail &amp; Security Logs</h2>
            <p className="text-[11px] text-slate-500">
              Append-only historical record of administrative mutations and authentication events.
            </p>
          </div>
          <button
            onClick={() => {
              loadFacets();
              loadLogs();
            }}
            disabled={isLoading}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-1.5 self-start disabled:opacity-50"
          >
            <RefreshCw size={12} className={cn(isLoading && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* Filter controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 pt-2 border-t border-slate-100">
          <div className="lg:col-span-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
            <input
              type="text"
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search user, action, table, record UUID…"
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
            />
          </div>

          <div className="lg:col-span-2">
            <select
              value={actionFilter}
              onChange={e => {
                setActionFilter(e.target.value);
                setPage(1);
              }}
              className="w-full py-1.5 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:border-violet-500"
            >
              <option value="all">All Actions ({facets.actions.length})</option>
              {facets.actions.map(act => (
                <option key={act} value={act}>{act}</option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <select
              value={tableFilter}
              onChange={e => {
                setTableFilter(e.target.value);
                setPage(1);
              }}
              className="w-full py-1.5 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:border-violet-500"
            >
              <option value="all">All Tables ({facets.tables.length})</option>
              {facets.tables.map(tbl => (
                <option key={tbl} value={tbl}>{tbl}</option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <select
              value={actorFilter}
              onChange={e => {
                setActorFilter(e.target.value);
                setPage(1);
              }}
              className="w-full py-1.5 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:border-violet-500"
            >
              <option value="all">All Actors</option>
              {facets.actors.map(ac => (
                <option key={ac.id} value={ac.id}>{ac.name || ac.email}</option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2 flex items-center gap-1.5">
            <input
              type="date"
              value={fromDate}
              onChange={e => {
                setFromDate(e.target.value);
                setPage(1);
              }}
              className="w-1/2 py-1.5 px-2 text-[11px] bg-slate-50 border border-slate-200 rounded-xl text-slate-700"
              title="From date"
            />
            <input
              type="date"
              value={toDate}
              onChange={e => {
                setToDate(e.target.value);
                setPage(1);
              }}
              className="w-1/2 py-1.5 px-2 text-[11px] bg-slate-50 border border-slate-200 rounded-xl text-slate-700"
              title="To date"
            />
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      {isLoading && logs.length === 0 ? (
        <SystemLoadingBlock message="Querying indexed audit logs…" />
      ) : error ? (
        <SystemErrorBlock message={error} onRetry={loadLogs} />
      ) : (
        <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs min-w-[850px]">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-3">Action Type</th>
                  <th className="py-3 px-3">Actor</th>
                  <th className="py-3 px-3">Resource / Table</th>
                  <th className="py-3 px-3">Record UUID</th>
                  <th className="py-3 px-4 text-right">State Diff</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <Activity className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p className="font-bold text-slate-600">No audit records found</p>
                      <p className="text-[11px] mt-0.5">Try widening your search filters or date range.</p>
                    </td>
                  </tr>
                ) : (
                  logs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                      {/* Timestamp */}
                      <td className="py-3 px-4 text-slate-600">
                        <div className="font-bold text-slate-800">
                          {new Date(log.created_at).toLocaleDateString()}
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="py-3 px-3">
                        <span className={cn('px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider border', getActionBadgeClass(log.action_type))}>
                          {log.action_type}
                        </span>
                      </td>

                      {/* Actor */}
                      <td className="py-3 px-3">
                        <div>
                          <div className="font-bold text-slate-800">{log.actor_name || 'System / Auth'}</div>
                          <span className="text-[10px] text-slate-400 font-mono">{log.user_email || 'automated'}</span>
                        </div>
                      </td>

                      {/* Table */}
                      <td className="py-3 px-3 font-mono text-[11px] text-slate-700">
                        {log.table_name}
                      </td>

                      {/* Record ID */}
                      <td className="py-3 px-3">
                        {log.record_id ? (
                          <div className="flex items-center gap-1">
                            <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                              {log.record_id.slice(0, 8)}…
                            </span>
                            <button
                              onClick={() => copyToClipboard(log.record_id!, log.id)}
                              className="text-slate-400 hover:text-slate-700 p-0.5"
                              title="Copy UUID"
                            >
                              {copiedKey === log.id ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      {/* Inspect Diff */}
                      <td className="py-3 px-4 text-right">
                        {(log.old_values || log.new_values) ? (
                          <button
                            onClick={() => setInspectLog(log)}
                            className="px-2.5 py-1 rounded-lg border border-slate-200 hover:border-violet-300 hover:bg-violet-50 text-slate-700 hover:text-violet-700 text-[11px] font-bold transition-colors inline-flex items-center gap-1"
                          >
                            <Eye size={11} /> View Diff
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-300 italic">No diff</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <PaginationBar
            totalCount={totalCount}
            pageSize={pageSize}
            currentPage={page}
            onPageChange={setPage}
            isLoading={isLoading}
          />
        </div>
      )}

      {/* Inspect State Diff Modal */}
      {inspectLog && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-2xl w-full p-5 space-y-4 animate-in fade-in zoom-in-95 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <FileCode size={16} className="text-violet-600" />
                Audit Event State Diff
              </div>
              <button
                onClick={() => setInspectLog(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 overflow-y-auto flex-1 pr-1">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3 bg-slate-50 rounded-xl text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Action</span>
                  <span className="font-bold text-slate-800">{inspectLog.action_type}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Target Table</span>
                  <span className="font-bold text-slate-800 font-mono">{inspectLog.table_name}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Actor</span>
                  <span className="font-bold text-slate-800">{inspectLog.actor_name || inspectLog.user_email || 'System'}</span>
                </div>
              </div>

              {/* Old vs New JSON diff boxes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Old Values */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider block">
                    Previous State (Old)
                  </span>
                  <div className="p-3 bg-slate-950 text-slate-200 rounded-xl font-mono text-[11px] overflow-x-auto max-h-60 border border-slate-800">
                    <pre className="whitespace-pre-wrap">
                      {inspectLog.old_values ? JSON.stringify(inspectLog.old_values, null, 2) : '(none / creation)'}
                    </pre>
                  </div>
                </div>

                {/* New Values */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">
                    Committed State (New)
                  </span>
                  <div className="p-3 bg-slate-950 text-slate-200 rounded-xl font-mono text-[11px] overflow-x-auto max-h-60 border border-slate-800">
                    <pre className="whitespace-pre-wrap">
                      {inspectLog.new_values ? JSON.stringify(inspectLog.new_values, null, 2) : '(none / deletion)'}
                    </pre>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={() => setInspectLog(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
