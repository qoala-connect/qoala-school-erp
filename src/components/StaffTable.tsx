import React, { useState, useMemo } from 'react';
import { 
  useReactTable, 
  getCoreRowModel, 
  getSortedRowModel, 
  getFilteredRowModel, 
  getPaginationRowModel,
  flexRender,
  ColumnDef,
  SortingState,
  ColumnFiltersState,
  VisibilityState
} from '@tanstack/react-table';
import { 
  Eye, Edit, Trash2, ArrowUpDown, Search, SlidersHorizontal, 
  Phone, Copy, Briefcase, LayoutList, LayoutGrid, X,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, AlertCircle, ShieldCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

import type { Employee, EmployeeLifecycleStatus } from '@/pages/dashboard/Employees';

interface StaffTableProps {
  employees: Employee[];
  selectedEmployeeIds: string[];
  onToggleSelectEmployee: (id: string) => void;
  onToggleSelectAll: () => void;
  onSelectEmployee: (employee: Employee) => void;
  onEditEmployee: (employee: Employee) => void;
  onDeleteEmployee: (id: string) => void;
  setIsWizardOpen: (open: boolean) => void;
}

export default function StaffTable({
  employees,
  selectedEmployeeIds,
  onToggleSelectEmployee,
  onToggleSelectAll,
  onSelectEmployee,
  onEditEmployee,
  onDeleteEmployee,
  setIsWizardOpen
}: StaffTableProps) {
  const [displayMode, setDisplayMode] = useState<'table' | 'grid'>('table');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'name', desc: false }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    select: true,
    name: true,
    contacts: true,
    role_dept: true,
    status_type: true,
    actions: true
  });

  const [showColumnDropdown, setShowColumnDropdown] = useState(false);
  const [showColumnSearch, setShowColumnSearch] = useState(false);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`Copied ${label}: ${text}`);
  };

  const tableRowsSelected = employees.length > 0 && employees.every(emp => selectedEmployeeIds.includes(emp.id));

  // Defined compact columns to guarantee no horizontal scroll
  const columns = useMemo<ColumnDef<Employee>[]>(() => [
    {
      id: 'select',
      header: () => (
        <div className="flex items-center justify-center">
          <input 
            type="checkbox" 
            checked={tableRowsSelected}
            onChange={onToggleSelectAll}
            className="rounded border-slate-300 text-violet-600 focus:ring-violet-500 w-3.5 h-3.5 cursor-pointer"
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex items-center justify-center">
          <input 
            type="checkbox" 
            checked={selectedEmployeeIds.includes(row.original.id)}
            onChange={(e) => { e.stopPropagation(); onToggleSelectEmployee(row.original.id); }}
            className="rounded border-slate-300 text-violet-600 focus:ring-violet-500 w-3.5 h-3.5 cursor-pointer"
          />
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
      size: 40
    },
    {
      id: 'name',
      accessorKey: 'name',
      header: ({ column }) => (
        <button 
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="flex items-center gap-1 font-black text-[10px] uppercase text-slate-500 hover:text-slate-900 cursor-pointer"
        >
          Staff Member
          <ArrowUpDown size={11} className="text-slate-400" />
        </button>
      ),
      cell: ({ row }) => {
        const emp = row.original;
        const initials = emp.name.split(' ').slice(0, 2).map(n => n[0]).join('');
        return (
          <div className="flex items-center gap-2.5 min-w-0">
            {emp.photo_url ? (
              <img src={emp.photo_url} alt={emp.name} className="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-violet-100 text-violet-700 border border-violet-200 flex items-center justify-center font-black text-[11px] uppercase shrink-0">
                {initials}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <span 
                onClick={() => onSelectEmployee(emp)}
                className="font-extrabold text-slate-900 text-xs hover:text-violet-600 cursor-pointer block truncate uppercase"
                title={emp.name}
              >
                {emp.name}
              </span>
              <span className="text-[9px] text-slate-400 font-semibold block truncate">
                {emp.qualification || 'M.A., B.Ed.'}
              </span>
            </div>
          </div>
        );
      },
      size: 180
    },
    {
      id: 'contacts',
      accessorKey: 'employee_id',
      header: ({ column }) => (
        <button 
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="flex items-center gap-1 font-black text-[10px] uppercase text-slate-500 hover:text-slate-900 cursor-pointer"
        >
          ID & Phone
          <ArrowUpDown size={11} className="text-slate-400" />
        </button>
      ),
      cell: ({ row }) => {
        const emp = row.original;
        return (
          <div className="min-w-0 space-y-0.5">
            <span 
              onClick={() => copyToClipboard(emp.employee_id, 'Employee ID')}
              className="font-mono font-black text-[11px] text-slate-900 hover:text-violet-600 cursor-pointer flex items-center gap-1 group/id"
            >
              <span>{emp.employee_id}</span>
              <Copy size={10} className="opacity-0 group-hover/id:opacity-100 text-violet-500 transition-opacity" />
            </span>
            <a href={`tel:${emp.phone}`} className="text-[10px] text-slate-500 hover:text-violet-600 font-medium flex items-center gap-1 truncate">
              <Phone size={9} className="text-slate-400 shrink-0" />
              <span>{emp.phone || 'N/A'}</span>
            </a>
          </div>
        );
      },
      size: 130
    },
    {
      id: 'role_dept',
      accessorFn: (row) => `${row.designation} ${row.department}`,
      header: 'Designation / Dept',
      cell: ({ row }) => {
        const emp = row.original;
        return (
          <div className="min-w-0">
            <span className="font-bold text-slate-900 text-[11px] block truncate">{emp.designation}</span>
            <span className="text-[9px] text-violet-600 font-extrabold uppercase block truncate">{emp.department} Dept</span>
          </div>
        );
      },
      size: 150
    },
    {
      id: 'status_type',
      accessorFn: (row) => `${row.status} ${row.employment_type}`,
      header: 'Status & Type',
      cell: ({ row }) => {
        const emp = row.original;
        return (
          <div className="space-y-0.5">
            <span className={cn(
              "px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border inline-block",
              emp.status === 'Active'
                ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                : emp.status === 'Probation' || emp.status === 'On Leave'
                  ? "bg-amber-50 text-amber-600 border-amber-200"
                  : "bg-rose-50 text-rose-600 border-rose-200"
            )}>
              {emp.status}
            </span>
            <span className="text-[9px] text-slate-400 font-bold block truncate">{emp.employment_type}</span>
          </div>
        );
      },
      size: 110
    },
    {
      id: 'actions',
      header: () => <div className="text-right pr-2">Actions</div>,
      cell: ({ row }) => {
        const emp = row.original;
        return (
          <div className="flex items-center justify-end gap-1">
            <button 
              onClick={() => onSelectEmployee(emp)}
              className="p-1 hover:bg-violet-100 text-slate-500 hover:text-violet-700 rounded-md transition-colors cursor-pointer border border-slate-200/80 bg-white shadow-2xs"
              title="View 360° Profile"
            >
              <Eye size={12} />
            </button>
            <button 
              onClick={() => onEditEmployee(emp)}
              className="p-1 hover:bg-indigo-100 text-slate-500 hover:text-indigo-700 rounded-md transition-colors cursor-pointer border border-slate-200/80 bg-white shadow-2xs"
              title="Edit Registry Entry"
            >
              <Edit size={12} />
            </button>
            <button 
              onClick={() => onDeleteEmployee(emp.id)}
              className="p-1 hover:bg-rose-100 text-slate-500 hover:text-rose-700 rounded-md transition-colors cursor-pointer border border-slate-200/80 bg-white shadow-2xs"
              title="Archive/Delete"
            >
              <Trash2 size={12} />
            </button>
          </div>
        );
      },
      enableSorting: false,
      size: 90
    }
  ], [selectedEmployeeIds, onSelectEmployee, onEditEmployee, onDeleteEmployee, onToggleSelectEmployee, onToggleSelectAll, tableRowsSelected]);

  const table = useReactTable({
    data: employees,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      columnVisibility
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 10
      }
    }
  });

  return (
    <div className="space-y-3.5">
      
      {/* Directory Control Hub Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 border border-slate-200/80 rounded-2xl shadow-3xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Page size selector */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 rounded-xl px-2.5 py-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Rows:</span>
            <select 
              value={table.getState().pagination.pageSize} 
              onChange={e => table.setPageSize(Number(e.target.value))}
              className="bg-transparent text-xs font-extrabold text-slate-800 outline-none cursor-pointer"
            >
              {[10, 20, 30, 50].map(pageSize => (
                <option key={pageSize} value={pageSize}>
                  {pageSize}
                </option>
              ))}
            </select>
          </div>

          <button 
            onClick={() => setShowColumnSearch(!showColumnSearch)}
            className={cn(
              "px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer",
              showColumnSearch 
                ? "bg-violet-50 text-violet-700 border-violet-200 shadow-3xs" 
                : "bg-white hover:bg-slate-50 border-slate-200 text-slate-600"
            )}
          >
            <Search className="w-3.5 h-3.5" /> Column Filters
          </button>

          {selectedEmployeeIds.length > 0 && (
            <span className="px-2.5 py-1 bg-violet-600 text-white rounded-xl text-xs font-black flex items-center gap-1">
              <span>{selectedEmployeeIds.length} Selected</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Layout Toggle */}
          <div className="flex items-center p-1 bg-slate-100 border border-slate-200/80 rounded-xl">
            <button
              onClick={() => setDisplayMode('table')}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer",
                displayMode === 'table' ? "bg-white text-violet-600 shadow-3xs" : "text-slate-500 hover:text-slate-900"
              )}
            >
              <LayoutList size={14} />
              <span className="hidden sm:inline">Compact Table</span>
            </button>
            <button
              onClick={() => setDisplayMode('grid')}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer",
                displayMode === 'grid' ? "bg-white text-violet-600 shadow-3xs" : "text-slate-500 hover:text-slate-900"
              )}
            >
              <LayoutGrid size={14} />
              <span className="hidden sm:inline">Grid Cards</span>
            </button>
          </div>

          {/* Column Visibility Dropdown */}
          <div className="relative">
            <button 
              onClick={() => setShowColumnDropdown(!showColumnDropdown)}
              className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-3xs"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Columns</span>
            </button>

            {showColumnDropdown && (
              <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl p-3 z-50 space-y-1.5">
                <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider pb-1 border-b border-slate-100 mb-1.5">Toggle Visibility</p>
                {table.getAllLeafColumns().map(column => {
                  if (column.id === 'select' || column.id === 'actions') return null;
                  return (
                    <label key={column.id} className="flex items-center gap-2 px-2 py-1 hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer capitalize">
                      <input 
                        type="checkbox" 
                        checked={column.getIsVisible()} 
                        onChange={column.getToggleVisibilityHandler()}
                        className="rounded border-slate-300 text-violet-600 focus:ring-violet-500 w-3.5 h-3.5 cursor-pointer"
                      />
                      <span>{column.id.replace('_', ' ')}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* COMPACT TABLE (NO HORIZONTAL SCROLL) */}
      {displayMode === 'table' ? (
        <div className="bg-white border border-slate-200/80 rounded-[20px] shadow-3xs overflow-hidden">
          <div className="w-full">
            <table className="w-full text-xs text-left border-collapse table-fixed">
              <thead className="bg-slate-900 text-white uppercase font-black text-[10px]">
                {table.getHeaderGroups().map(headerGroup => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map(header => (
                      <th 
                        key={header.id} 
                        style={{ width: header.getSize() ? `${header.getSize()}px` : 'auto' }}
                        className="py-3 px-2 font-black border-r border-slate-800 last:border-r-0 select-none"
                      >
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}

                {showColumnSearch && (
                  <tr className="bg-slate-800/90 border-b border-slate-700">
                    {table.getHeaderGroups()[0].headers.map(header => (
                      <td key={`filter-${header.id}`} className="p-1.5 border-r border-slate-700/50 last:border-r-0">
                        {header.column.getCanFilter() ? (
                          <input 
                            type="text" 
                            value={(header.column.getFilterValue() as string) ?? ''} 
                            onChange={e => header.column.setFilterValue(e.target.value)}
                            placeholder="Filter..." 
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1 text-[10px] font-bold text-white outline-none focus:ring-2 focus:ring-violet-500/20"
                          />
                        ) : null}
                      </td>
                    ))}
                  </tr>
                )}
              </thead>

              <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                {table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td colSpan={table.getAllColumns().length} className="py-12 text-center text-slate-400 text-xs">
                      <div className="max-w-xs mx-auto space-y-2">
                        <Briefcase className="w-8 h-8 text-slate-300 mx-auto" />
                        <p className="text-xs font-black text-slate-800">No staff entries found</p>
                        <p className="text-[10px] text-slate-400">Try adjusting search parameters.</p>
                        <button 
                          onClick={() => setIsWizardOpen(true)}
                          className="px-3.5 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-black transition-colors"
                        >
                          Add Employee
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map(row => {
                    const isSelected = selectedEmployeeIds.includes(row.original.id);
                    return (
                      <tr key={row.id} className={cn("hover:bg-slate-50/80 transition-colors", isSelected && "bg-violet-50/40")}>
                        {row.getVisibleCells().map(cell => (
                          <td 
                            key={cell.id} 
                            style={{ width: cell.column.getSize() ? `${cell.column.getSize()}px` : 'auto' }}
                            className="py-2.5 px-2 text-[11px] truncate align-middle border-r border-slate-50 last:border-r-0"
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* GRID CARDS VIEW */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {table.getRowModel().rows.map(row => {
            const emp = row.original;
            const isSelected = selectedEmployeeIds.includes(emp.id);
            return (
              <div 
                key={emp.id}
                className={cn(
                  "bg-white border rounded-2xl p-3.5 space-y-3 transition-all hover:shadow-md relative",
                  isSelected ? "border-violet-500 ring-2 ring-violet-500/10 bg-violet-50/20" : "border-slate-200/80"
                )}
              >
                <div className="flex items-center justify-between">
                  <input 
                    type="checkbox" 
                    checked={isSelected}
                    onChange={(e) => { e.stopPropagation(); onToggleSelectEmployee(emp.id); }}
                    className="rounded border-slate-300 text-violet-600 focus:ring-violet-500 w-3.5 h-3.5 cursor-pointer"
                  />
                  <span className={cn(
                    "px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border",
                    emp.status === 'Active' ? "bg-emerald-50 text-emerald-600 border-emerald-200" :
                    emp.status === 'Probation' || emp.status === 'On Leave' ? "bg-amber-50 text-amber-600 border-amber-200" :
                    "bg-rose-50 text-rose-600 border-rose-200"
                  )}>
                    {emp.status}
                  </span>
                </div>

                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-700 border border-violet-200 flex items-center justify-center font-black text-xs uppercase shrink-0">
                    {emp.name.split(' ').slice(0, 2).map(n => n[0]).join('')}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 onClick={() => onSelectEmployee(emp)} className="font-extrabold text-slate-900 text-xs hover:text-violet-600 cursor-pointer truncate">
                      {emp.name}
                    </h4>
                    <p className="text-[10px] text-slate-400 font-semibold truncate">{emp.designation} • {emp.department}</p>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-slate-100 text-[10px]">
                  <span className="font-mono font-bold text-slate-700">{emp.employee_id}</span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => onSelectEmployee(emp)} className="p-1 hover:bg-slate-100 text-slate-500 rounded border border-slate-200">
                      <Eye size={12} />
                    </button>
                    <button onClick={() => onEditEmployee(emp)} className="p-1 hover:bg-slate-100 text-slate-500 rounded border border-slate-200">
                      <Edit size={12} />
                    </button>
                    <button onClick={() => onDeleteEmployee(emp.id)} className="p-1 hover:bg-rose-50 text-rose-600 rounded border border-slate-200">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 border border-slate-200/80 rounded-2xl text-xs font-semibold text-slate-500 bg-white shadow-3xs">
        <p className="text-[11px]">
          Showing <span className="text-slate-900 font-extrabold">{table.getState().pagination.pageIndex * table.getState().pagination.pageSize + (table.getFilteredRowModel().rows.length > 0 ? 1 : 0)}</span> to <span className="text-slate-900 font-extrabold">{Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, table.getFilteredRowModel().rows.length)}</span> of <span className="text-slate-900 font-extrabold">{table.getFilteredRowModel().rows.length}</span> staff members
        </p>
        
        <div className="flex items-center gap-1">
          <button 
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
            className="p-1.5 border border-slate-200 rounded-lg bg-white text-slate-600 disabled:opacity-30 cursor-pointer"
          >
            <ChevronsLeft size={14} />
          </button>
          <button 
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-600 disabled:opacity-30 cursor-pointer text-[11px] font-bold flex items-center gap-1"
          >
            <ChevronLeft size={13} /> Prev
          </button>
          
          <span className="px-2 text-[11px] font-extrabold text-slate-700">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount() || 1}
          </span>

          <button 
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-600 disabled:opacity-30 cursor-pointer text-[11px] font-bold flex items-center gap-1"
          >
            Next <ChevronRight size={13} />
          </button>
          <button 
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
            className="p-1.5 border border-slate-200 rounded-lg bg-white text-slate-600 disabled:opacity-30 cursor-pointer"
          >
            <ChevronsRight size={14} />
          </button>
        </div>
      </div>

    </div>
  );
}
