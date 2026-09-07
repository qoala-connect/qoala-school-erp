import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BookOpen, Plus, Search, Filter, Download, Printer, Edit2, Trash2, 
  RefreshCw, Check, X, Bookmark, User, Tag, Calendar, AlertTriangle,
  Coins, Save, SlidersHorizontal, ArrowLeft, Trash, Library, Compass,
  BookMarked, HelpCircle, FileText, CheckCircle2, DollarSign
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { AdminHeader } from '@/components/common/AdminHeader';
import { AdminStatCard } from '@/components/common/AdminStatCard';

// Interfaces for our Library Entities
interface LibraryBook {
  id: string;
  title: string;
  author: string;
  category_id: string;
  isbn: string;
  shelf_location: string;
  total_copies: number;
  issued_copies: number;
}

interface BookCategory {
  id: string;
  name: string; // e.g. Mathematics, Fiction
  section_code: string; // e.g. SEC-A
}

interface BookIssue {
  id: string;
  book_id: string;
  student_id: string | null;
  borrower_name: string;
  borrower_role: 'Student' | 'Staff';
  issue_date: string;
  due_date: string;
  return_date?: string | null;
  fine_amount: number;
  fine_paid: boolean;
  status: 'Issued' | 'Returned' | 'Overdue';
}

interface LibraryFine {
  id: string;
  issue_id: string;
  borrower_name: string;
  book_title: string;
  days_overdue: number;
  fine_amount: number;
  status: 'Pending' | 'Collected';
}

interface StudentOption {
  id: string;
  name: string;
  class: string;
  section: string;
}

// Loans run 14 days by default and accrue ₹2 for every day past the due date.
const LOAN_DAYS = 14;
const FINE_PER_DAY = 2;

const toDateOnly = (value: string) => new Date(`${String(value).slice(0, 10)}T00:00:00`);

const daysOverdue = (dueDate: string, against?: string | null) => {
  if (!dueDate) return 0;
  const end = against ? toDateOnly(against) : toDateOnly(new Date().toISOString());
  const diff = Math.floor((end.getTime() - toDateOnly(dueDate).getTime()) / 86400000);
  return diff > 0 ? diff : 0;
};

type TabType = 'books' | 'categories' | 'issues' | 'fines';

export default function LibraryManagement() {
  const location = useLocation();
  const requestedTab = (location.state as any)?.activeTab as TabType | undefined;
  const [activeTab, setActiveTab] = useState<TabType>(requestedTab || 'books');

  useEffect(() => {
    if (requestedTab && ['books', 'categories', 'issues', 'fines'].includes(requestedTab)) {
      setActiveTab(requestedTab);
    }
  }, [requestedTab]);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const [errorState, setErrorState] = useState<string | null>(null);

  // States for Entities
  const [books, setBooks] = useState<LibraryBook[]>([]);
  const [categories, setCategories] = useState<BookCategory[]>([]);
  const [issues, setIssues] = useState<BookIssue[]>([]);
  const [fines, setFines] = useState<LibraryFine[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);

  // Bulk selection states
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  // Modals / Drawer Control
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);

  // Form Field States
  const [formData, setFormData] = useState<any>({});

  // Fetch initial data from real Supabase tables
  const loadData = async () => {
    setIsSyncing(true);
    setErrorState(null);
    try {
      const [booksRes, issuesRes, studentsRes] = await Promise.all([
        supabase.from('library_books').select('*').order('title'),
        supabase
          .from('book_issues')
          .select('*, library_books(title), students(name)')
          .order('issue_date', { ascending: false }),
        supabase.from('students').select('id, name, class, section').order('name')
      ]);

      // supabase-js resolves rather than throws, so a failed request shows up
      // as `.error` — unchecked, it silently left the ledger empty forever.
      if (booksRes.error) throw booksRes.error;
      if (issuesRes.error) throw issuesRes.error;

      const bookRows = booksRes.data || [];
      setBooks(bookRows.map((b: any) => ({
        id: b.id,
        title: b.title || 'Untitled Book',
        author: b.author || 'Unknown',
        // There is no book_categories table — a book's category IS the
        // category name, so the name doubles as the category id. Keying
        // synthetic `cat-N` ids here is what used to make every book render
        // as "General Course" and every category count as 0 books.
        category_id: b.category || 'General',
        isbn: b.isbn || 'N/A',
        shelf_location: b.rack_number || 'Unshelved',
        total_copies: Number(b.copies_total ?? 1),
        issued_copies: Number(b.copies_total ?? 1) - Number(b.copies_available ?? 1)
      })));

      const uniqueCats = Array.from(new Set(bookRows.map((b: any) => b.category || 'General'))).sort();
      setCategories(uniqueCats.map((cat: any, idx: number) => ({
        id: cat,
        name: cat,
        section_code: `SEC-${String.fromCharCode(65 + (idx % 26))}`
      })));

      const issueRows = issuesRes.data || [];
      setIssues(issueRows.map((i: any) => {
        const overdue = !i.return_date && daysOverdue(i.due_date) > 0;
        return {
          id: i.id,
          book_id: i.book_id || '',
          student_id: i.student_id || null,
          borrower_name: i.borrower_name || i.students?.name || 'Unnamed Borrower',
          borrower_role: (i.borrower_role === 'Staff' ? 'Staff' : 'Student') as 'Student' | 'Staff',
          issue_date: i.issue_date || '',
          due_date: i.due_date || '',
          return_date: i.return_date || null,
          fine_amount: Number(i.fine_amount || 0),
          fine_paid: Boolean(i.fine_paid),
          status: (i.return_date ? 'Returned' : overdue ? 'Overdue' : 'Issued') as BookIssue['status']
        };
      }));

      // Fines are a view over the issues that carry a penalty. Settlement is
      // tracked by fine_paid, not by return_date — a book can come back while
      // the fine on it is still owed.
      setFines(issueRows
        .filter((i: any) => Number(i.fine_amount || 0) > 0)
        .map((i: any) => ({
          id: i.id,
          issue_id: i.id,
          borrower_name: i.borrower_name || i.students?.name || 'Unnamed Borrower',
          book_title: i.library_books?.title || 'Withdrawn Volume',
          days_overdue: daysOverdue(i.due_date, i.return_date),
          fine_amount: Number(i.fine_amount || 0),
          status: (i.fine_paid ? 'Collected' : 'Pending') as 'Pending' | 'Collected'
        })));

      setStudents((studentsRes.data || []) as StudentOption[]);
    } catch (error: any) {
      console.error('Error fetching library tables:', error);
      setErrorState(error.message || 'Failed to load library data');
      toast.error('Could not load library records from database');
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // CRUD handlers
  const handleOpenAdd = () => {
    // Categories and fines are both derived views: a category exists because a
    // book sits in it, and a fine exists because a loan ran late. Neither can
    // be conjured on its own, so point the user at the tab that owns the record.
    if (activeTab === 'categories') {
      toast.info('Categories come from the catalog — add a book and give it a new category.');
      return;
    }
    if (activeTab === 'fines') {
      toast.info('Fines are raised against a loan — open the Borrowing Ledger to charge one.');
      return;
    }
    setEditingItem(null);
    setFormData(activeTab === 'issues'
      ? {
          borrower_role: 'Student',
          issue_date: new Date().toISOString().slice(0, 10),
          due_date: new Date(Date.now() + LOAN_DAYS * 86400000).toISOString().slice(0, 10)
        }
      : { total_copies: 1 });
    setShowAddModal(true);
  };

  const handleOpenEdit = (item: any) => {
    setEditingItem(item);
    setFormData({ ...item });
    setShowAddModal(true);
  };

  const handleDelete = async (id: string) => {
    const prompts: Record<TabType, string> = {
      books: 'Remove this title from the catalog? Its borrowing history goes with it.',
      categories: 'Delete this category? Every book in it moves to "General".',
      issues: 'Delete this loan record permanently?',
      fines: 'Waive this fine? The loan record itself is kept.'
    };
    if (!window.confirm(prompts[activeTab])) return;

    try {
      if (activeTab === 'books') {
        const { error } = await supabase.from('library_books').delete().eq('id', id);
        if (error) throw error;
      } else if (activeTab === 'issues') {
        const { error } = await supabase.from('book_issues').delete().eq('id', id);
        if (error) throw error;
      } else if (activeTab === 'categories') {
        // No categories table: a category is deleted by emptying it.
        const { error } = await supabase
          .from('library_books')
          .update({ category: 'General' })
          .eq('category', id);
        if (error) throw error;
      } else {
        // Waiving a fine clears the charge, it does not delete the loan.
        const { error } = await supabase
          .from('book_issues')
          .update({ fine_amount: 0, fine_paid: false })
          .eq('id', id);
        if (error) throw error;
      }

      toast.success(activeTab === 'fines' ? 'Fine waived.' : 'Library record deleted successfully!');
      setSelectedItems(prev => prev.filter(i => i !== id));
      await loadData();
    } catch (err: any) {
      toast.error('Deletion failed: ' + err.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (activeTab === 'books') {
        const total = Number(formData.total_copies || 1);
        // "New category…" in the picker reveals a free-text field; that is the
        // only place a category can be born, since categories live on books.
        const category = (formData.category_id === '__new__'
          ? formData.new_category
          : formData.category_id) || 'General';

        if (editingItem) {
          // Copies already out on loan must stay accounted for when the total
          // is adjusted, otherwise availability drifts away from reality.
          const onLoan = Math.min(editingItem.issued_copies, total);
          const { error } = await supabase.from('library_books').update({
            title: formData.title,
            author: formData.author,
            isbn: formData.isbn,
            category,
            rack_number: formData.shelf_location,
            copies_total: total,
            copies_available: Math.max(total - onLoan, 0)
          }).eq('id', editingItem.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('library_books').insert([{
            title: formData.title,
            author: formData.author,
            isbn: formData.isbn,
            category,
            rack_number: formData.shelf_location,
            copies_total: total,
            copies_available: total
          }]);
          if (error) throw error;
        }
      } else if (activeTab === 'issues') {
        const isStaff = formData.borrower_role === 'Staff';
        const student = students.find(s => s.id === formData.student_id);
        const dueDate = formData.due_date
          || new Date(Date.now() + LOAN_DAYS * 86400000).toISOString().slice(0, 10);

        const payload: Record<string, any> = {
          book_id: formData.book_id,
          student_id: isStaff ? null : (formData.student_id || null),
          borrower_name: isStaff ? formData.borrower_name : (student?.name || formData.borrower_name),
          borrower_role: isStaff ? 'Staff' : 'Student',
          issue_date: formData.issue_date || new Date().toISOString().slice(0, 10),
          due_date: dueDate,
          // book_issues.status is a lowercase vocabulary (issued/returned/overdue).
          status: daysOverdue(dueDate) > 0 ? 'overdue' : 'issued'
        };

        if (editingItem) {
          const { error } = await supabase.from('book_issues').update(payload).eq('id', editingItem.id);
          if (error) throw error;
          // Moving a loan to a different title has to move the copy with it.
          if (editingItem.book_id !== formData.book_id && !editingItem.return_date) {
            await adjustCopies(editingItem.book_id, +1);
            await adjustCopies(formData.book_id, -1);
          }
        } else {
          const { error } = await supabase.from('book_issues').insert([payload]);
          if (error) throw error;
          await adjustCopies(formData.book_id, -1);
        }
      } else if (activeTab === 'categories') {
        const nextName = String(formData.name || '').trim();
        if (!nextName) throw new Error('Category name cannot be empty');
        // Renaming a derived category means restamping every book in it.
        const { error } = await supabase
          .from('library_books')
          .update({ category: nextName })
          .eq('category', editingItem.id);
        if (error) throw error;
      } else if (activeTab === 'fines') {
        const { error } = await supabase
          .from('book_issues')
          .update({ fine_amount: Number(formData.fine_amount || 0) })
          .eq('id', editingItem.issue_id);
        if (error) throw error;
      }

      toast.success(editingItem ? 'Catalog revised successfully!' : 'New entity registered under Library registry!');
      setShowAddModal(false);
      await loadData();
    } catch (err: any) {
      toast.error('Sync failed: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Stock movement. copies_available is constrained to 0..copies_total, so the
  // delta is clamped rather than blindly written.
  const adjustCopies = async (bookId: string, delta: number) => {
    if (!bookId) return;
    const { data, error } = await supabase
      .from('library_books')
      .select('copies_total, copies_available')
      .eq('id', bookId)
      .maybeSingle();
    if (error || !data) return;

    const total = Number(data.copies_total ?? 1);
    const next = Math.min(Math.max(Number(data.copies_available ?? 0) + delta, 0), total);
    await supabase.from('library_books').update({ copies_available: next }).eq('id', bookId);
  };

  // Check a book back in: free the copy, stamp the return, and bill any lateness.
  const handleReturn = async (issue: BookIssue) => {
    const today = new Date().toISOString().slice(0, 10);
    const late = daysOverdue(issue.due_date, today);
    const fine = Math.max(issue.fine_amount, late * FINE_PER_DAY);

    const { error } = await supabase
      .from('book_issues')
      .update({ status: 'returned', return_date: today, fine_amount: fine })
      .eq('id', issue.id);

    if (error) {
      toast.error('Failed to update return: ' + error.message);
      return;
    }
    await adjustCopies(issue.book_id, +1);
    toast.success(late > 0
      ? `Returned ${late} day${late === 1 ? '' : 's'} late — ₹${fine} fine raised.`
      : 'Book returned successfully!');
    await loadData();
  };

  const handleCollectFine = async (fine: LibraryFine) => {
    const { error } = await supabase
      .from('book_issues')
      .update({ fine_paid: true })
      .eq('id', fine.issue_id);

    if (error) {
      toast.error('Failed to collect fine: ' + error.message);
      return;
    }
    toast.success(`₹${fine.fine_amount.toLocaleString()} collected from ${fine.borrower_name}.`);
    await loadData();
  };

  // Bulk actions
  const handleToggleSelectAll = (ids: string[]) => {
    if (selectedItems.length === ids.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(ids);
    }
  };

  const handleToggleSelectOne = (id: string) => {
    if (selectedItems.includes(id)) {
      setSelectedItems(selectedItems.filter(i => i !== id));
    } else {
      setSelectedItems([...selectedItems, id]);
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Are you sure you want to retire these ${selectedItems.length} selected library records?`)) return;

    try {
      let error = null;
      if (activeTab === 'books') {
        ({ error } = await supabase.from('library_books').delete().in('id', selectedItems));
      } else if (activeTab === 'issues') {
        ({ error } = await supabase.from('book_issues').delete().in('id', selectedItems));
      } else if (activeTab === 'categories') {
        ({ error } = await supabase
          .from('library_books')
          .update({ category: 'General' })
          .in('category', selectedItems));
      } else {
        ({ error } = await supabase
          .from('book_issues')
          .update({ fine_amount: 0, fine_paid: false })
          .in('id', selectedItems));
      }
      if (error) throw error;

      setSelectedItems([]);
      toast.success(activeTab === 'fines' ? 'Selected fines waived.' : 'Records deleted safely!');
      await loadData();
    } catch (err: any) {
      toast.error('Deletion failed: ' + err.message);
    }
  };

  // Export action — real CSV of whichever tab is active, built from the
  // same filtered data already on screen (previously this just ran a
  // 1-second fake spinner and showed a success toast with no file).
  const handleExport = () => {
    let header = '';
    let rows: string[] = [];
    let filename = '';

    if (activeTab === 'books') {
      header = 'Title,Author,ISBN,Shelf Location,Total Copies,Issued Copies\n';
      rows = filteredBooks.map(b => `"${b.title}","${b.author}","${b.isbn}","${b.shelf_location}","${b.total_copies}","${b.issued_copies}"`);
      filename = 'Book_Catalog';
    } else if (activeTab === 'categories') {
      header = 'Category,Section Code\n';
      rows = filteredCategories.map(c => `"${c.name}","${c.section_code}"`);
      filename = 'Book_Categories';
    } else if (activeTab === 'issues') {
      header = 'Borrower,Role,Issue Date,Due Date,Return Date,Status\n';
      rows = filteredIssues.map(i => `"${i.borrower_name}","${i.borrower_role}","${i.issue_date}","${i.due_date}","${i.return_date || ''}","${i.status}"`);
      filename = 'Borrowing_Ledger';
    } else {
      header = 'Borrower,Book,Days Overdue,Fine Amount,Status\n';
      rows = filteredFines.map(f => `"${f.borrower_name}","${f.book_title}","${f.days_overdue}","${f.fine_amount}","${f.status}"`);
      filename = 'Overdue_Fines';
    }

    const blob = new Blob([header + rows.join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    toast.success('Export downloaded.');
  };

  // Print Action
  const handlePrint = () => {
    window.print();
  };

  // Filtered lists for rendering
  const filteredBooks = useMemo(() => {
    return books.filter(b => 
      b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.isbn.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [books, searchQuery]);

  const filteredCategories = useMemo(() => {
    return categories.filter(c => 
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.section_code.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [categories, searchQuery]);

  const filteredIssues = useMemo(() => {
    return issues.filter(i => {
      const bTitle = books.find(b => b.id === i.book_id)?.title || '';
      return (i.borrower_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
              bTitle.toLowerCase().includes(searchQuery.toLowerCase())) &&
             (statusFilter === 'all' || i.status === statusFilter);
    });
  }, [issues, books, searchQuery, statusFilter]);

  const filteredFines = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return fines.filter(f =>
      (f.borrower_name.toLowerCase().includes(q) || f.book_title.toLowerCase().includes(q)) &&
      (statusFilter === 'all' || f.status === statusFilter)
    );
  }, [fines, searchQuery, statusFilter]);

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-16 text-slate-700 font-sans antialiased">
{/* 1. Header Toolbar */}
      <AdminHeader
        title="Library Catalog & Issues"
        subtitle="Configure literary works, manage shelf allocation corridors, log student/staff borrowing timelines, and audit overdue late fine receipts."
        badge={{
          icon: Library,
          text: 'Library Resource Center',
          variant: 'violet'
        }}
        sessionBadge="Session: 2026-27"
        actions={
          <>
            <button 
              onClick={loadData}
              className={cn(
                "p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200/80 rounded-xl transition-all cursor-pointer shadow-2xs",
                isSyncing && "animate-spin text-blue-600"
              )}
              title="Force reload schemas"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            
            <button 
              onClick={handleOpenAdd}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-xs shadow-blue-500/20 active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add Library Entry
            </button>
          </>
        }
      />

      {/* Load failure — previously recorded in state but never shown, so a
          broken query looked exactly like an empty library. */}
      {errorState && (
        <div className="flex items-start gap-3 bg-rose-50 border border-rose-100 text-rose-700 rounded-2xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-bold">Library records could not be loaded</p>
            <p className="text-[11px] font-medium text-rose-600/80 mt-0.5">{errorState}</p>
          </div>
          <button
            onClick={loadData}
            className="px-3 py-1 bg-white border border-rose-200 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-rose-600 hover:text-white transition-all"
          >
            Retry
          </button>
        </div>
      )}

      {/* 2. Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <AdminStatCard
          label="Books Available"
          value={books.reduce((acc, b) => acc + (b.total_copies - b.issued_copies), 0)}
          subtext="In-house physical volumes"
          icon={BookOpen}
          variant="emerald"
        />
        <AdminStatCard
          label="Offered Categories"
          value={categories.length}
          subtext="Corridor classifications"
          icon={Tag}
          variant="violet"
        />
        <AdminStatCard
          label="Active Issues"
          value={issues.filter(i => i.status === 'Issued' || i.status === 'Overdue').length}
          subtext="Borrowed volume logs"
          icon={BookMarked}
          variant="primary"
        />
        <AdminStatCard
          label="Overdue Penalties"
          value={`₹${fines.filter(f => f.status === 'Pending').reduce((acc, f) => acc + f.fine_amount, 0).toLocaleString()}`}
          subtext="Uncollected fines total"
          icon={Coins}
          variant="rose"
        />
      </div>

      {/* 3. Segmented Navigation Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-1.5 shadow-2xs overflow-x-auto">
        <nav className="flex items-center gap-1 min-w-max" aria-label="Library Navigation Sections">
          {[
            { id: 'books', label: 'Book Catalog', icon: BookOpen },
            { id: 'categories', label: 'Subject Categories', icon: Tag },
            { id: 'issues', label: 'Borrowing Ledger', icon: BookMarked },
            { id: 'fines', label: 'Overdue Fines', icon: Coins }
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as TabType);
                  setSelectedItems([]);
                  setSearchQuery('');
                  setStatusFilter('all');
                }}
                className={cn(
                  "inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer",
                  isActive
                    ? "bg-slate-900 text-white shadow-xs" 
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                )}
              >
                <tab.icon className={cn("w-4 h-4 shrink-0", isActive ? "text-violet-400" : "text-slate-400")} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Advanced Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/60 p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Dynamic Search */}
          <div className="relative flex-1 sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder={`Search ${activeTab === 'books' ? 'titles...' : activeTab === 'categories' ? 'categories...' : activeTab === 'issues' ? 'borrowers...' : 'borrowers...'}`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-violet-500/10 focus:border-violet-500 transition-all font-medium h-[38px]"
            />
          </div>

          {/* Conditional filter dropdowns */}
          {activeTab === 'issues' && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs font-semibold text-slate-600 outline-none h-[38px] cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="Issued">Issued</option>
              <option value="Returned">Returned</option>
              <option value="Overdue">Overdue</option>
            </select>
          )}

          {activeTab === 'fines' && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs font-semibold text-slate-600 outline-none h-[38px] cursor-pointer"
            >
              <option value="all">All Fines</option>
              <option value="Pending">Pending</option>
              <option value="Collected">Collected</option>
            </select>
          )}
        </div>

        {/* Action Button Set */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {selectedItems.length > 0 && (
            <button 
              onClick={handleBulkDelete}
              className="flex items-center gap-1.5 px-3.5 h-[38px] bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-600 hover:text-white rounded-xl text-xs font-bold transition-all"
            >
              <Trash className="w-3.5 h-3.5" />
              Retire Selected ({selectedItems.length})
            </button>
          )}

          <button 
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 h-[38px] border border-slate-200 text-slate-600 hover:text-slate-800 rounded-xl text-xs font-bold transition-all hover:bg-slate-50"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Ledger
          </button>

          <button 
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3.5 h-[38px] bg-violet-50 text-violet-600 border border-violet-100/40 rounded-xl text-xs font-bold hover:bg-violet-600 hover:text-white transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            Excel Ledger
          </button>
        </div>
      </div>

      {/* Main Workspace Table */}
      <div className="bg-white border border-slate-200/60 shadow-sm rounded-[24px] overflow-hidden">
        <div className="overflow-x-auto">
          <AnimatePresence mode="wait">
            {/* TAB 1: BOOKS CATALOG */}
            {activeTab === 'books' && (
              <motion.table 
                key="books"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-full text-left border-collapse min-w-[700px]"
              >
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="py-4 px-6 w-[50px]">
                      <input 
                        type="checkbox"
                        checked={filteredBooks.length > 0 && selectedItems.length === filteredBooks.length}
                        onChange={() => handleToggleSelectAll(filteredBooks.map(b => b.id))}
                        className="rounded text-violet-600 focus:ring-violet-500 w-4 h-4"
                      />
                    </th>
                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Book Title</th>
                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Author</th>
                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Subject Category</th>
                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">ISBN Code</th>
                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Shelf Location</th>
                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">In Stock Status</th>
                    <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/60 text-xs">
                  {filteredBooks.map((book) => {
                    const cat = categories.find(c => c.id === book.category_id);
                    const avCopies = book.total_copies - book.issued_copies;
                    return (
                      <tr key={book.id} className="hover:bg-slate-50/40 transition-colors">
                        <td className="py-4 px-6">
                          <input 
                            type="checkbox"
                            checked={selectedItems.includes(book.id)}
                            onChange={() => handleToggleSelectOne(book.id)}
                            className="rounded text-violet-600 focus:ring-violet-500 w-4 h-4"
                          />
                        </td>
                        <td className="py-4 px-4 font-bold text-slate-900 flex items-center gap-2">
                          <BookOpen className="w-4 h-4 text-violet-500 shrink-0" />
                          {book.title}
                        </td>
                        <td className="py-4 px-4 font-semibold text-slate-600">{book.author}</td>
                        <td className="py-4 px-4 font-semibold text-slate-500">{cat?.name || 'General Course'}</td>
                        <td className="py-4 px-4 text-center font-mono font-bold text-slate-500 bg-slate-50/50 px-2 py-0.5 rounded-lg">{book.isbn}</td>
                        <td className="py-4 px-4 text-center font-mono font-bold text-violet-600">{book.shelf_location}</td>
                        <td className="py-4 px-4 text-center font-bold">
                          <div className="flex flex-col items-center">
                            <span className={cn(
                              "px-2 py-0.5 rounded-full text-[9px] uppercase tracking-widest border font-black",
                              avCopies > 0 ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-rose-50 text-rose-600 border-rose-100"
                            )}>
                              {avCopies > 0 ? `${avCopies} In Shelf` : 'Stock Exhausted'}
                            </span>
                            <span className="text-[9px] text-slate-400 mt-1">Total: {book.total_copies}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-right space-x-1 whitespace-nowrap">
                          <button 
                            onClick={() => handleOpenEdit(book)}
                            className="p-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-500 hover:text-violet-600 rounded-lg transition-all"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => handleDelete(book.id)}
                            className="p-1.5 bg-white hover:bg-rose-50 border border-slate-200 text-slate-400 hover:text-rose-600 rounded-lg transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </motion.table>
            )}

            {/* TAB 2: SUBJECT CATEGORIES */}
            {activeTab === 'categories' && (
              <motion.table 
                key="categories"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-full text-left border-collapse min-w-[700px]"
              >
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="py-4 px-6 w-[50px]">
                      <input 
                        type="checkbox"
                        checked={filteredCategories.length > 0 && selectedItems.length === filteredCategories.length}
                        onChange={() => handleToggleSelectAll(filteredCategories.map(c => c.id))}
                        className="rounded text-violet-600 focus:ring-violet-500 w-4 h-4"
                      />
                    </th>
                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Category Name</th>
                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Library Section Code</th>
                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Mapped Books Count</th>
                    <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/60 text-xs">
                  {filteredCategories.map((cat) => {
                    const mappedCount = books.filter(b => b.category_id === cat.id).length;
                    return (
                      <tr key={cat.id} className="hover:bg-slate-50/40 transition-colors">
                        <td className="py-4 px-6">
                          <input 
                            type="checkbox"
                            checked={selectedItems.includes(cat.id)}
                            onChange={() => handleToggleSelectOne(cat.id)}
                            className="rounded text-violet-600 focus:ring-violet-500 w-4 h-4"
                          />
                        </td>
                        <td className="py-4 px-4 font-bold text-slate-900 flex items-center gap-2">
                          <Tag className="w-4 h-4 text-violet-500 shrink-0" />
                          {cat.name}
                        </td>
                        <td className="py-4 px-4 font-mono font-bold text-violet-600 bg-violet-50/20 px-2 py-0.5 rounded-lg w-fit">{cat.section_code}</td>
                        <td className="py-4 px-4 text-center font-bold text-slate-600">{mappedCount} Unique Volumes</td>
                        <td className="py-4 px-6 text-right space-x-1 whitespace-nowrap">
                          <button 
                            onClick={() => handleOpenEdit(cat)}
                            className="p-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-500 hover:text-violet-600 rounded-lg transition-all"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => handleDelete(cat.id)}
                            className="p-1.5 bg-white hover:bg-rose-50 border border-slate-200 text-slate-400 hover:text-rose-600 rounded-lg transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </motion.table>
            )}

            {/* TAB 3: BORROWING LEDGER */}
            {activeTab === 'issues' && (
              <motion.table 
                key="issues"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-full text-left border-collapse min-w-[700px]"
              >
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="py-4 px-6 w-[50px]">
                      <input 
                        type="checkbox"
                        checked={filteredIssues.length > 0 && selectedItems.length === filteredIssues.length}
                        onChange={() => handleToggleSelectAll(filteredIssues.map(i => i.id))}
                        className="rounded text-violet-600 focus:ring-violet-500 w-4 h-4"
                      />
                    </th>
                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Borrower Individual</th>
                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Institution Role</th>
                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Borrowed Volume</th>
                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Issue Date</th>
                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Due Return Date</th>
                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Ledger Status</th>
                    <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/60 text-xs">
                  {filteredIssues.map((issue) => {
                    const book = books.find(b => b.id === issue.book_id);
                    return (
                      <tr key={issue.id} className="hover:bg-slate-50/40 transition-colors">
                        <td className="py-4 px-6">
                          <input 
                            type="checkbox"
                            checked={selectedItems.includes(issue.id)}
                            onChange={() => handleToggleSelectOne(issue.id)}
                            className="rounded text-violet-600 focus:ring-violet-500 w-4 h-4"
                          />
                        </td>
                        <td className="py-4 px-4 font-bold text-slate-900 flex items-center gap-2">
                          <User className="w-4 h-4 text-slate-400 shrink-0" />
                          {issue.borrower_name}
                        </td>
                        <td className="py-4 px-4 text-center font-bold text-slate-500">{issue.borrower_role}</td>
                        <td className="py-4 px-4 font-bold text-slate-800">{book?.title || 'Literary Volume'}</td>
                        <td className="py-4 px-4 text-center font-mono font-medium text-slate-500">{issue.issue_date}</td>
                        <td className="py-4 px-4 text-center font-mono font-medium text-slate-500">{issue.due_date}</td>
                        <td className="py-4 px-4 text-center">
                          <span className={cn(
                            "px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border",
                            issue.status === 'Returned' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                            issue.status === 'Issued' ? "bg-blue-50 text-blue-600 border-blue-100" :
                            "bg-rose-50 text-rose-600 border-rose-100 animate-pulse"
                          )}>
                            {issue.status}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right space-x-1 whitespace-nowrap">
                          {issue.status !== 'Returned' && (
                            <button
                              onClick={() => handleReturn(issue)}
                              className="px-2 py-1 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-lg border border-emerald-200 text-[10px] font-black uppercase tracking-wider"
                              title="Confirm Return"
                            >
                              Return
                            </button>
                          )}
                          <button 
                            onClick={() => handleOpenEdit(issue)}
                            className="p-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-500 hover:text-violet-600 rounded-lg transition-all"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => handleDelete(issue.id)}
                            className="p-1.5 bg-white hover:bg-rose-50 border border-slate-200 text-slate-400 hover:text-rose-600 rounded-lg transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </motion.table>
            )}

            {/* TAB 4: OVERDUE FINES */}
            {activeTab === 'fines' && (
              <motion.table 
                key="fines"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-full text-left border-collapse min-w-[700px]"
              >
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="py-4 px-6 w-[50px]">
                      <input 
                        type="checkbox"
                        checked={filteredFines.length > 0 && selectedItems.length === filteredFines.length}
                        onChange={() => handleToggleSelectAll(filteredFines.map(f => f.id))}
                        className="rounded text-violet-600 focus:ring-violet-500 w-4 h-4"
                      />
                    </th>
                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Borrower Name</th>
                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Penalised Volume</th>
                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Days Overdue</th>
                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Fine Owed</th>
                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Fines Status</th>
                    <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/60 text-xs">
                  {filteredFines.map((fine) => (
                    <tr key={fine.id} className="hover:bg-slate-50/40 transition-colors">
                      <td className="py-4 px-6">
                        <input 
                          type="checkbox"
                          checked={selectedItems.includes(fine.id)}
                          onChange={() => handleToggleSelectOne(fine.id)}
                          className="rounded text-violet-600 focus:ring-violet-500 w-4 h-4"
                        />
                      </td>
                      <td className="py-4 px-4 font-bold text-slate-900 flex items-center gap-2">
                        <User className="w-4 h-4 text-slate-400 shrink-0" />
                        {fine.borrower_name}
                      </td>
                      <td className="py-4 px-4 font-bold text-slate-800">{fine.book_title}</td>
                      <td className="py-4 px-4 text-center font-mono font-bold text-slate-500">
                        {fine.days_overdue > 0 ? `${fine.days_overdue} days` : '—'}
                      </td>
                      <td className="py-4 px-4 text-right font-mono font-extrabold text-rose-600">₹{fine.fine_amount.toLocaleString()}</td>
                      <td className="py-4 px-4 text-center">
                        <span className={cn(
                          "px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border",
                          fine.status === 'Collected' 
                            ? "bg-emerald-50 text-emerald-600 border-emerald-100" 
                            : "bg-rose-50 text-rose-600 border-rose-100 animate-pulse"
                        )}>
                          {fine.status}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right space-x-1 whitespace-nowrap">
                        {fine.status === 'Pending' && (
                          <button
                            onClick={() => handleCollectFine(fine)}
                            className="px-2.5 h-[28px] bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-lg border border-emerald-200 text-[10px] font-black uppercase tracking-wider"
                            title="Collect Cash"
                          >
                            Collect
                          </button>
                        )}
                        <button 
                          onClick={() => handleOpenEdit(fine)}
                          className="p-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-500 hover:text-violet-600 rounded-lg transition-all"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => handleDelete(fine.id)}
                          className="p-1.5 bg-white hover:bg-rose-50 border border-slate-200 text-slate-400 hover:text-rose-600 rounded-lg transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </motion.table>
            )}
          </AnimatePresence>

          {/* Empty state */}
          {((activeTab === 'books' && filteredBooks.length === 0) ||
            (activeTab === 'categories' && filteredCategories.length === 0) ||
            (activeTab === 'issues' && filteredIssues.length === 0) ||
            (activeTab === 'fines' && filteredFines.length === 0)) && (
            <div className="text-center py-20 bg-slate-50/50">
              <Library className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Empty Library Registry</h3>
              <p className="text-slate-400/80 text-[11px] mt-1">No library catalog records found matching the filters.</p>
            </div>
          )}
        </div>
      </div>

      {/* COMPREHENSIVE DRAWER / MODAL FORM */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Overlay */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-xl overflow-hidden text-left border border-slate-100"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">
                    {editingItem ? 'Configure Catalog' : 'Initialize New Catalog Entry'}
                  </h3>
                  <p className="text-slate-400 text-[10px] font-semibold mt-0.5">
                    Modifying system parameters under {activeTab.toUpperCase()} context.
                  </p>
                </div>
                <button 
                  onClick={() => setShowAddModal(false)}
                  className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[450px] overflow-y-auto">
                {activeTab === 'books' && (
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1 font-semibold">Book Title</label>
                      <input 
                        type="text" 
                        required
                        placeholder="e.g. Higher Engineering Mathematics"
                        value={formData.title || ''}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs text-slate-800 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none transition-all h-[36px]"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1 font-semibold">Author</label>
                        <input 
                          type="text" 
                          required
                          placeholder="e.g. Arthur Beiser"
                          value={formData.author || ''}
                          onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs text-slate-800 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none transition-all h-[36px]"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1 font-semibold">Category Classification</label>
                        <select
                          value={formData.category_id || ''}
                          required
                          onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs text-slate-800 focus:ring-2 focus:ring-violet-500/20 h-[36px] outline-none"
                        >
                          <option value="">Select subject category...</option>
                          {categories.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                          <option value="__new__">+ New category...</option>
                        </select>
                      </div>
                    </div>
                    {formData.category_id === '__new__' && (
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1 font-semibold">New Category Name</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Competitive Exams"
                          value={formData.new_category || ''}
                          onChange={(e) => setFormData({ ...formData, new_category: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs text-slate-800 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none transition-all h-[36px]"
                        />
                      </div>
                    )}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1 font-semibold">ISBN Code</label>
                        <input 
                          type="text" 
                          required
                          placeholder="e.g. 978-0072"
                          value={formData.isbn || ''}
                          onChange={(e) => setFormData({ ...formData, isbn: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs text-slate-800 focus:ring-2 focus:ring-violet-500/20 h-[36px] outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1 font-semibold">Shelf Corridor</label>
                        <input 
                          type="text" 
                          required
                          placeholder="e.g. Shelf B-4"
                          value={formData.shelf_location || ''}
                          onChange={(e) => setFormData({ ...formData, shelf_location: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs text-slate-800 focus:ring-2 focus:ring-violet-500/20 h-[36px] outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1 font-semibold">Total Copies</label>
                        <input 
                          type="number" 
                          required
                          min={1}
                          value={formData.total_copies || 1}
                          onChange={(e) => setFormData({ ...formData, total_copies: parseInt(e.target.value) })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs text-slate-800 focus:ring-2 focus:ring-violet-500/20 h-[36px] outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'categories' && editingItem && (
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1 font-semibold">Category Name</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Mathematics & Calculus"
                        value={formData.name || ''}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs text-slate-800 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none transition-all h-[36px]"
                      />
                    </div>
                    <p className="text-[11px] font-semibold text-slate-500 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5">
                      Renaming restamps all{' '}
                      <span className="font-black text-slate-700">
                        {books.filter(b => b.category_id === editingItem.id).length}
                      </span>{' '}
                      book{books.filter(b => b.category_id === editingItem.id).length === 1 ? '' : 's'} filed under
                      <span className="font-black text-slate-700"> {editingItem.name}</span>. The section code is
                      assigned automatically from the shelf order.
                    </p>
                  </div>
                )}

                {activeTab === 'issues' && (
                  <div className="space-y-4">
                    {/* A student borrower is picked from the roll so the loan is
                        linked by student_id and shows up on their 360 drawer;
                        staff are typed free-hand since they have no roll entry. */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1 font-semibold">Borrower Individual</label>
                      {formData.borrower_role === 'Staff' ? (
                        <input
                          type="text"
                          required
                          placeholder="e.g. Shri Rajesh Dubey"
                          value={formData.borrower_name || ''}
                          onChange={(e) => setFormData({ ...formData, borrower_name: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs text-slate-800 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none transition-all h-[36px]"
                        />
                      ) : (
                        <select
                          value={formData.student_id || ''}
                          required
                          onChange={(e) => setFormData({ ...formData, student_id: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs text-slate-800 focus:ring-2 focus:ring-violet-500/20 h-[36px] outline-none"
                        >
                          <option value="">Select student from roll...</option>
                          {students.map(s => (
                            <option key={s.id} value={s.id}>
                              {s.name} — Class {s.class}-{s.section}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1 font-semibold">Borrower Role</label>
                        <select
                          value={formData.borrower_role || 'Student'}
                          onChange={(e) => setFormData({ ...formData, borrower_role: e.target.value, student_id: '', borrower_name: '' })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs text-slate-800 focus:ring-2 focus:ring-violet-500/20 h-[36px] outline-none"
                        >
                          <option value="Student">Student</option>
                          <option value="Staff">Staff</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1 font-semibold">Select Book</label>
                        <select 
                          value={formData.book_id || ''} 
                          required
                          onChange={(e) => setFormData({ ...formData, book_id: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs text-slate-800 focus:ring-2 focus:ring-violet-500/20 h-[36px] outline-none"
                        >
                          <option value="">Select literary work...</option>
                          {books.map(b => (
                            <option key={b.id} value={b.id} disabled={(b.total_copies - b.issued_copies) <= 0}>{b.title} ({(b.total_copies - b.issued_copies)} left)</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1 font-semibold">Issue Date</label>
                        <input 
                          type="date" 
                          required
                          value={formData.issue_date || ''}
                          onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs text-slate-800 focus:ring-2 focus:ring-violet-500/20 h-[36px] outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1 font-semibold">Due Return Date</label>
                        <input 
                          type="date" 
                          required
                          value={formData.due_date || ''}
                          onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs text-slate-800 focus:ring-2 focus:ring-violet-500/20 h-[36px] outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'fines' && editingItem && (
                  <div className="space-y-4">
                    {/* The borrower and the book come from the loan this fine
                        hangs off, so only the amount is editable here. */}
                    <div className="grid grid-cols-2 gap-3 bg-slate-50 border border-slate-100 rounded-xl p-3">
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Borrower</p>
                        <p className="text-xs font-bold text-slate-800 mt-0.5">{editingItem.borrower_name}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Penalised Volume</p>
                        <p className="text-xs font-bold text-slate-800 mt-0.5">{editingItem.book_title}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Days Overdue</p>
                        <p className="text-xs font-bold text-slate-800 mt-0.5">{editingItem.days_overdue || 0}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Accrued at ₹{FINE_PER_DAY}/day</p>
                        <p className="text-xs font-bold text-slate-800 mt-0.5">₹{(editingItem.days_overdue || 0) * FINE_PER_DAY}</p>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1 font-semibold">Fine Owed Amount (₹)</label>
                      <input
                        type="number"
                        required
                        min={0}
                        step="0.01"
                        value={formData.fine_amount ?? 0}
                        onChange={(e) => setFormData({ ...formData, fine_amount: parseFloat(e.target.value) })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs text-slate-800 focus:ring-2 focus:ring-violet-500/20 h-[36px] outline-none"
                      />
                      <p className="text-[10px] text-slate-400 font-medium pl-1">
                        Override the accrued amount to grant a concession, or set 0 to waive it.
                      </p>
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t border-slate-100 flex justify-end gap-2">
                  <button 
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 border border-slate-200 text-slate-500 hover:text-slate-800 rounded-xl text-xs font-bold transition-all hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="flex items-center gap-1.5 px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-violet-500/15"
                  >
                    {isSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Confirm Sync
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
