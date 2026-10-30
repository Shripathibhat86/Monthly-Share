import React, { useState } from 'react';
import {
  Search,
  Filter,
  ArrowUpDown,
  Download,
  Trash2,
  Edit2,
  Eye,
  FileText,
  Calendar,
  Users,
  AlertCircle,
  AlertTriangle,
  ShieldCheck,
  X,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCw,
  Loader2
} from 'lucide-react';
import { formatCurrency, formatDateIN, getMonthName } from '../utils/formatters';
import { api } from '../services/api';

const CATEGORIES = [
  'All Categories',
  'Groceries',
  'Rent',
  'Electricity',
  'Water',
  'Internet',
  'Food and Dining',
  'Travel',
  'Household Items',
  'Entertainment',
  'Other'
];

export function ExpenseHistoryView({
  expenses = [],
  members = [],
  selectedMonth,
  onEditExpense,
  onRequestDelete,
  onRequestDeleteAll,
  onRefresh,
  showToast,
  onNavigateTab
}) {
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [selectedPayer, setSelectedPayer] = useState('');
  const [selectedParticipant, setSelectedParticipant] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [viewingExpense, setViewingExpense] = useState(null);
  const [viewingReceipt, setViewingReceipt] = useState(null);
  const [isLoadingReceipt, setIsLoadingReceipt] = useState(false);
  const [receiptZoom, setReceiptZoom] = useState(1);
  const [receiptRotation, setReceiptRotation] = useState(0);

  const fetchFullExpenseIfNeeded = async (exp) => {
    if (!exp) return exp;
    if (exp.receipt_data || (!exp.has_receipt && !exp.receipt_filename)) {
      return exp;
    }
    try {
      setIsLoadingReceipt(true);
      const full = await api.getExpense(exp.id);
      exp.receipt_data = full.receipt_data;
      exp.receipt_filename = full.receipt_filename;
      return { ...exp, ...full };
    } catch (err) {
      console.error('Failed to load full expense with receipt:', err);
      return exp;
    } finally {
      setIsLoadingReceipt(false);
    }
  };

  const handleOpenExpenseDetails = async (exp) => {
    setViewingExpense(exp);
    const full = await fetchFullExpenseIfNeeded(exp);
    setViewingExpense(full);
  };

  const handleOpenReceipt = async (exp) => {
    setViewingReceipt(exp);
    setReceiptZoom(1);
    setReceiptRotation(0);
    const full = await fetchFullExpenseIfNeeded(exp);
    setViewingReceipt(full);
  };

  // Delete All state
  const [isDeleteAllOpen, setIsDeleteAllOpen] = useState(false);
  const [deleteAllScope, setDeleteAllScope] = useState('month'); // 'month', 'filtered', or 'all'
  const [deleteAuthorizingMemberId, setDeleteAuthorizingMemberId] = useState(members[0]?.id || 'any');
  const [deleteAllPin, setDeleteAllPin] = useState('');
  const [showDeleteAllPin, setShowDeleteAllPin] = useState(false);
  const [deleteAllError, setDeleteAllError] = useState('');
  const [isDeletingAll, setIsDeletingAll] = useState(false);

  const activeFilterCount = (selectedCategory !== 'All Categories' ? 1 : 0) +
    (selectedPayer ? 1 : 0) +
    (selectedParticipant ? 1 : 0);

  // Filter expenses
  const filteredExpenses = expenses.filter((e) => {
    // Search
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const matchTitle = e.title?.toLowerCase().includes(q);
      const matchNotes = e.notes?.toLowerCase().includes(q);
      if (!matchTitle && !matchNotes) return false;
    }

    // Category
    if (selectedCategory !== 'All Categories' && e.category !== selectedCategory) {
      return false;
    }

    // Payer
    if (selectedPayer && Number(e.paid_by_member_id) !== Number(selectedPayer)) {
      return false;
    }

    // Participant
    if (selectedParticipant) {
      const hasParticipant = e.participants?.some(
        (p) => Number(p.member_id) === Number(selectedParticipant)
      );
      if (!hasParticipant) return false;
    }

    return true;
  });

  // Sort
  const sortedExpenses = [...filteredExpenses].sort((a, b) => {
    if (sortBy === 'date') {
      const dA = new Date(a.date).getTime();
      const dB = new Date(b.date).getTime();
      return sortOrder === 'asc' ? dA - dB : dB - dA;
    }
    if (sortBy === 'amount') {
      return sortOrder === 'asc' ? a.amount - b.amount : b.amount - a.amount;
    }
    return 0;
  });

  // CSV Export
  const handleExportCSV = () => {
    if (sortedExpenses.length === 0) return;

    const headers = [
      'ID',
      'Date (DD-MM-YYYY)',
      'Title',
      'Category',
      'Amount (INR)',
      'Paid By',
      'Split Method',
      'Participants',
      'Notes'
    ];

    const rows = sortedExpenses.map((e) => [
      e.id,
      formatDateIN(e.date),
      `"${(e.title || '').replace(/"/g, '""')}"`,
      `"${e.category || ''}"`,
      e.amount.toFixed(2),
      `"${e.payer_name || ''}"`,
      e.split_method,
      `"${(e.participants || []).map((p) => `${p.member_name} (Rs.${p.allocated_amount})`).join('; ')}"`,
      `"${(e.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Expenses_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle Delete All Confirmation
  const handleDeleteAllConfirm = async (e) => {
    e.preventDefault();
    const cleanPin = deleteAllPin.trim();
    if (!cleanPin) {
      setDeleteAllError('Please enter member PIN / password');
      return;
    }

    setIsDeletingAll(true);
    setDeleteAllError('');

    try {
      let expenseIds = undefined;
      if (deleteAllScope === 'filtered') {
        expenseIds = filteredExpenses.map((exp) => exp.id);
      }

      if (onRequestDeleteAll) {
        await onRequestDeleteAll({
          scope: deleteAllScope,
          month: selectedMonth,
          expenseIds,
          memberId: deleteAuthorizingMemberId,
          pin: cleanPin
        });
      } else {
        const res = await api.deleteAllExpenses({
          scope: deleteAllScope,
          month: selectedMonth,
          expenseIds,
          memberId: deleteAuthorizingMemberId,
          pin: cleanPin
        });
        if (showToast) {
          showToast({ type: 'success', message: res.message || 'Expenses deleted successfully' });
        }
        if (onRefresh) {
          onRefresh();
        }
      }

      setIsDeleteAllOpen(false);
      setDeleteAllPin('');
      setDeleteAllError('');
    } catch (err) {
      setDeleteAllError(err.message || 'Failed to delete expenses. Please check your PIN.');
    } finally {
      setIsDeletingAll(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Top action & filter bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3 sm:space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-800">Expense History</h2>
            <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
              Filtered {sortedExpenses.length} of {expenses.length} records
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`sm:hidden flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl transition border touch-manipulation active:scale-95 ${
                showFilters || activeFilterCount > 0
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                  : 'bg-slate-100 border-slate-200 text-slate-700'
              }`}
              aria-label="Toggle filters"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[10px] flex items-center justify-center font-bold">
                  {activeFilterCount}
                </span>
              )}
            </button>

            <button
              onClick={handleExportCSV}
              disabled={sortedExpenses.length === 0}
              className="flex items-center gap-1.5 px-3 sm:px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-xl transition touch-manipulation"
            >
              <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-600" />
              <span className="hidden xs:inline">Export CSV</span>
              <span className="xs:hidden">CSV</span>
            </button>

            <button
              onClick={() => {
                setIsDeleteAllOpen(true);
                setDeleteAllPin('');
                setDeleteAllError('');
                if (members.length > 0 && deleteAuthorizingMemberId === 'any') {
                  setDeleteAuthorizingMemberId(members[0].id);
                }
              }}
              disabled={expenses.length === 0}
              className="flex items-center gap-1.5 px-3 sm:px-3.5 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 disabled:opacity-40 disabled:cursor-not-allowed border border-rose-200/80 rounded-xl transition touch-manipulation active:scale-95"
              title="Delete All Expenses"
            >
              <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-600" />
              <span className="hidden xs:inline">Delete All</span>
              <span className="xs:hidden">Delete</span>
            </button>
          </div>
        </div>

        {/* Search Bar (always visible) */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by title, notes, or keyword..."
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Dropdowns (collapsible on mobile, grid on desktop) */}
        <div className={`${showFilters ? 'grid' : 'hidden sm:grid'} grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1 animate-fade-in`}>
          {/* Category */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-400 mb-1 sm:hidden">Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-700"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Paid By */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-400 mb-1 sm:hidden">Paid By</label>
            <select
              value={selectedPayer}
              onChange={(e) => setSelectedPayer(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-700"
            >
              <option value="">All Payers</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  Paid by: {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Participant */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-400 mb-1 sm:hidden">Participant</label>
            <select
              value={selectedParticipant}
              onChange={(e) => setSelectedParticipant(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-700"
            >
              <option value="">All Participants</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  Shared by: {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Sort By */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-400 mb-1 sm:hidden">Sort By</label>
            <div className="flex gap-1.5">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-700"
              >
                <option value="date">Sort: Date</option>
                <option value="amount">Sort: Amount</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="p-2 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-600 rounded-xl transition touch-manipulation"
                title="Toggle Sort Direction"
              >
                <ArrowUpDown className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Expenses Content: Mobile Cards + Desktop Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {sortedExpenses.length === 0 ? (
          <div className="p-8 sm:p-12 text-center">
            <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <FileText className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-slate-700 text-sm">No Expenses Found</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
              There are no expense records matching your current filter criteria for this month.
            </p>
            <button
              onClick={() => onNavigateTab('add-expense')}
              className="mt-4 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition active:scale-95 touch-manipulation"
            >
              Add Expense
            </button>
          </div>
        ) : (
          <>
            {/* MOBILE CARD FEED (< sm) */}
            <div className="block sm:hidden divide-y divide-slate-100">
              {sortedExpenses.map((exp) => (
                <div key={exp.id} className="p-3.5 space-y-2.5">
                  {/* Top line: Date + Category + Amount */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-semibold text-slate-500">
                          {formatDateIN(exp.date)}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                          {exp.category}
                        </span>
                      </div>
                      <h4 className="font-bold text-slate-800 text-sm mt-1 leading-snug">
                        {exp.title}
                      </h4>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <span className="text-base font-bold text-slate-900 block">
                        {formatCurrency(exp.amount)}
                      </span>
                      <span className="text-[10px] font-semibold text-indigo-600 capitalize">
                        {exp.split_method} split
                      </span>
                    </div>
                  </div>

                  {/* Beneficiary tags & Paid By */}
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 text-[11px] font-semibold border border-emerald-100">
                      Paid: {exp.payer_name}
                    </span>

                    {exp.participants?.map((p) => (
                      <span
                        key={p.member_id}
                        className="text-[10px] bg-indigo-50/80 text-indigo-700 border border-indigo-100 px-1.5 py-0.5 rounded-md"
                      >
                        {p.member_name}: {formatCurrency(p.allocated_amount)}
                      </span>
                    ))}
                  </div>

                  {/* Actions line */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-50">
                    <div>
                      {exp.has_receipt || exp.receipt_data ? (
                        <button
                          onClick={() => handleOpenReceipt(exp)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 active:scale-95 rounded-lg text-xs font-semibold transition"
                          title="View Attached Receipt"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Receipt</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-300">No receipt</span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenExpenseDetails(exp)}
                        className="p-2 text-slate-500 hover:text-indigo-600 active:scale-95 bg-slate-50 rounded-lg transition"
                        title="View Details"
                        aria-label="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onEditExpense(exp)}
                        className="p-2 text-slate-500 hover:text-amber-600 active:scale-95 bg-slate-50 rounded-lg transition"
                        title="Edit Expense"
                        aria-label="Edit Expense"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onRequestDelete(exp)}
                        className="p-2 text-slate-500 hover:text-rose-600 active:scale-95 bg-slate-50 rounded-lg transition"
                        title="Delete Expense"
                        aria-label="Delete Expense"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* DESKTOP TABLE VIEW (>= sm) */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50/75 text-slate-500 uppercase text-[11px] font-semibold border-b border-slate-100">
                  <tr>
                    <th className="py-3 px-4 sm:px-6">Date</th>
                    <th className="py-3 px-4">Title & Category</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4">Paid By</th>
                    <th className="py-3 px-4">Split Method & Beneficiaries</th>
                    <th className="py-3 px-4 text-center">Receipt</th>
                    <th className="py-3 px-4 sm:px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedExpenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-slate-50/50 transition">
                      <td className="py-3.5 px-4 sm:px-6 font-medium text-slate-600 whitespace-nowrap">
                        {formatDateIN(exp.date)}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-800">{exp.title}</div>
                        <span className="inline-block mt-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                          {exp.category}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-slate-900 text-sm whitespace-nowrap">
                        {formatCurrency(exp.amount)}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-indigo-700 whitespace-nowrap">
                        {exp.payer_name}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-[11px] font-medium text-slate-500 capitalize">
                          {exp.split_method} split
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {exp.participants?.map((p) => (
                            <span
                              key={p.member_id}
                              className="text-[10px] bg-indigo-50/80 text-indigo-800 border border-indigo-100 px-1.5 py-0.5 rounded-md"
                            >
                              {p.member_name}: {formatCurrency(p.allocated_amount)}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {exp.has_receipt || exp.receipt_data ? (
                          <button
                            onClick={() => handleOpenReceipt(exp)}
                            className="p-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 hover:scale-105 rounded-lg transition"
                            title="View Attached Receipt"
                            aria-label="View Attached Receipt"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 sm:px-6 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenExpenseDetails(exp)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                            title="View Details"
                            aria-label="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onEditExpense(exp)}
                            className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
                            title="Edit Expense"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onRequestDelete(exp)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="Delete Expense"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Viewing Details & Receipt Modal */}
      {viewingExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in no-print">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                  {viewingExpense.category}
                </span>
                <h3 className="font-bold text-slate-800 text-lg">{viewingExpense.title}</h3>
              </div>
              <button
                onClick={() => setViewingExpense(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl">
                  <span className="text-slate-400 block">Total Amount</span>
                  <span className="text-base font-bold text-slate-800">
                    {formatCurrency(viewingExpense.amount)}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl">
                  <span className="text-slate-400 block">Date</span>
                  <span className="font-semibold text-slate-700">
                    {formatDateIN(viewingExpense.date)}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl">
                  <span className="text-slate-400 block">Paid By</span>
                  <span className="font-semibold text-indigo-700">
                    {viewingExpense.payer_name}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl">
                  <span className="text-slate-400 block">Split Method</span>
                  <span className="font-semibold text-slate-700 capitalize">
                    {viewingExpense.split_method} Split
                  </span>
                </div>
              </div>

              {/* Itemized Share breakdown */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 mb-2">
                  Itemized Beneficiary Allocations:
                </h4>
                <div className="space-y-1.5">
                  {viewingExpense.participants?.map((p) => (
                    <div
                      key={p.member_id}
                      className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl text-xs"
                    >
                      <span className="font-medium text-slate-700">{p.member_name}</span>
                      <span className="font-bold text-indigo-600">
                        {formatCurrency(p.allocated_amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {viewingExpense.notes && (
                <div>
                  <h4 className="text-xs font-bold text-slate-700 mb-1">Notes:</h4>
                  <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl">
                    {viewingExpense.notes}
                  </p>
                </div>
              )}

              {/* Receipt preview if available */}
              {(viewingExpense.has_receipt || viewingExpense.receipt_data || viewingExpense.receipt_filename) ? (
                <div className="pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-indigo-600" />
                      <h4 className="text-xs font-bold text-slate-800">Receipt Attachment</h4>
                    </div>
                    {viewingExpense.receipt_filename && (
                      <span className="text-[10px] text-slate-500 font-mono bg-slate-100 px-2 py-0.5 rounded-md truncate max-w-[200px]" title={viewingExpense.receipt_filename}>
                        {viewingExpense.receipt_filename}
                      </span>
                    )}
                  </div>

                  {isLoadingReceipt && !viewingExpense.receipt_data ? (
                    <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-xl">
                      <Loader2 className="w-6 h-6 text-indigo-600 animate-spin mx-auto mb-2" />
                      <span className="text-xs text-slate-500 font-medium">Loading receipt attachment...</span>
                    </div>
                  ) : viewingExpense.receipt_data || viewingExpense.has_receipt ? (
                    <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50 p-2.5 space-y-2">
                      {/* Check if image or pdf */}
                      {!(viewingExpense.receipt_filename?.toLowerCase().endsWith('.pdf')) && (viewingExpense.receipt_data?.startsWith('data:image/') || !viewingExpense.receipt_data) ? (
                        <div
                          className="relative group cursor-pointer"
                          onClick={() => handleOpenReceipt(viewingExpense)}
                          title="Click to view full size and zoom"
                        >
                          <div className="max-h-72 w-full overflow-hidden rounded-lg bg-slate-900/5 flex items-center justify-center p-1">
                            <img
                              src={viewingExpense.receipt_data || api.getReceiptUrl(viewingExpense.id)}
                              alt="Receipt"
                              className="max-h-72 w-auto max-w-full object-contain rounded-lg transition duration-200 group-hover:scale-[1.02]"
                            />
                          </div>
                          <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition rounded-lg flex items-center justify-center gap-2 text-white pointer-events-none">
                            <span className="text-xs font-bold px-3 py-1.5 bg-black/60 backdrop-blur-xs rounded-lg flex items-center gap-1.5 shadow-sm">
                              <Maximize2 className="w-3.5 h-3.5" />
                              Click to Enlarge / Zoom
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="p-6 text-center bg-white rounded-lg border border-slate-200">
                          <FileText className="w-10 h-10 text-indigo-600 mx-auto mb-2" />
                          <span className="text-xs text-slate-700 font-bold block mb-1">
                            PDF Document Attached
                          </span>
                          <span className="text-[11px] text-slate-400 block font-mono">
                            {viewingExpense.receipt_filename || 'receipt.pdf'}
                          </span>
                        </div>
                      )}

                      {/* Action buttons below preview */}
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/60">
                        <button
                          type="button"
                          onClick={() => handleOpenReceipt(viewingExpense)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold transition"
                        >
                          <Maximize2 className="w-3.5 h-3.5" />
                          <span>View Full Screen</span>
                        </button>

                        <div className="flex items-center gap-1.5">
                          <a
                            href={api.getReceiptUrl(viewingExpense.id)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition"
                            title="Open in New Tab"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                          <a
                            href={api.getReceiptUrl(viewingExpense.id, true)}
                            download={viewingExpense.receipt_filename || `receipt-${viewingExpense.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
                            title="Download Receipt"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download</span>
                          </a>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 rounded-xl">
                      Receipt attachment could not be loaded.
                    </div>
                  )}
                </div>
              ) : (
                <div className="pt-2 border-t border-slate-100 text-xs text-slate-400">
                  No receipt attached for this expense.
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setViewingExpense(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL-SCREEN / LIGHTBOX RECEIPT VIEWER MODAL (Desktop & Mobile) */}
      {viewingReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in no-print">
          <div className="bg-white rounded-2xl sm:rounded-3xl max-w-4xl w-full max-h-[96vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-3 sm:p-4 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50/70">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-slate-800 text-sm sm:text-base truncate">
                    {viewingReceipt.title}
                  </h3>
                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                    {formatCurrency(viewingReceipt.amount)}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                  {formatDateIN(viewingReceipt.date)} • Paid by <strong className="text-slate-700">{viewingReceipt.payer_name}</strong>
                  {viewingReceipt.receipt_filename && (
                    <span className="font-mono text-[10px] text-slate-400 ml-2 hidden sm:inline">
                      ({viewingReceipt.receipt_filename})
                    </span>
                  )}
                </p>
              </div>

              {/* Action Toolbar */}
              <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
                {/* Zoom Controls (Images only) */}
                {!(viewingReceipt.receipt_filename?.toLowerCase().endsWith('.pdf')) && (
                  <div className="flex items-center bg-slate-100 rounded-xl p-0.5 border border-slate-200">
                    <button
                      onClick={() => setReceiptZoom((z) => Math.max(0.5, Number((z - 0.25).toFixed(2))))}
                      className="p-1.5 text-slate-600 hover:text-indigo-600 rounded-lg transition"
                      title="Zoom Out"
                      aria-label="Zoom Out"
                    >
                      <ZoomOut className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setReceiptZoom(1)}
                      className="px-2 py-1 text-[10px] font-bold font-mono text-slate-700 hover:text-indigo-600 transition"
                      title="Reset Zoom to 100%"
                    >
                      {Math.round(receiptZoom * 100)}%
                    </button>
                    <button
                      onClick={() => setReceiptZoom((z) => Math.min(3, Number((z + 0.25).toFixed(2))))}
                      className="p-1.5 text-slate-600 hover:text-indigo-600 rounded-lg transition"
                      title="Zoom In"
                      aria-label="Zoom In"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setReceiptRotation((r) => (r + 90) % 360)}
                      className="p-1.5 text-slate-600 hover:text-indigo-600 border-l border-slate-200 rounded-r-lg transition"
                      title="Rotate 90°"
                      aria-label="Rotate"
                    >
                      <RotateCw className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Open in New Tab */}
                <a
                  href={api.getReceiptUrl(viewingReceipt.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-xl transition"
                  title="Open Full Image in New Tab"
                  aria-label="Open in New Tab"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>

                {/* Download Button */}
                <a
                  href={api.getReceiptUrl(viewingReceipt.id, true)}
                  download={viewingReceipt.receipt_filename || `receipt-${viewingReceipt.id}`}
                  className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-xl transition"
                  title="Download Original Receipt"
                  aria-label="Download"
                >
                  <Download className="w-4 h-4" />
                </a>

                {/* Close Button */}
                <button
                  onClick={() => setViewingReceipt(null)}
                  className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition ml-1"
                  aria-label="Close Receipt Viewer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Viewer Body */}
            <div className="flex-1 overflow-auto p-3 sm:p-6 bg-slate-900/5 flex items-center justify-center min-h-[50vh] sm:min-h-[60vh] relative">
              {isLoadingReceipt && !viewingReceipt.receipt_data ? (
                <div className="text-center p-8">
                  <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-3" />
                  <p className="text-sm font-semibold text-slate-700">Loading receipt attachment...</p>
                  <p className="text-xs text-slate-400 mt-1">Please wait while the image is retrieved</p>
                </div>
              ) : viewingReceipt.receipt_filename?.toLowerCase().endsWith('.pdf') ? (
                <div className="w-full h-full flex flex-col items-center justify-center p-4">
                  <iframe
                    src={api.getReceiptUrl(viewingReceipt.id)}
                    className="w-full h-[65vh] rounded-xl border border-slate-200 bg-white shadow-xs"
                    title="PDF Receipt"
                  />
                </div>
              ) : (
                <div
                  className="flex items-center justify-center w-full h-full overflow-auto cursor-zoom-in"
                  onClick={() => setReceiptZoom((z) => (z === 1 ? 1.75 : 1))}
                  title="Click to toggle zoom"
                >
                  <img
                    src={viewingReceipt.receipt_data || api.getReceiptUrl(viewingReceipt.id)}
                    alt={`Receipt for ${viewingReceipt.title}`}
                    style={{
                      transform: `scale(${receiptZoom}) rotate(${receiptRotation}deg)`,
                      transformOrigin: 'center center',
                      transition: 'transform 0.2s cubic-bezier(0.2, 0, 0, 1)'
                    }}
                    className="max-h-[70vh] sm:max-h-[75vh] w-auto max-w-full object-contain rounded-lg shadow-md select-none pointer-events-auto"
                  />
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-3 sm:p-4 border-t border-slate-100 flex items-center justify-between gap-3 bg-white">
              <button
                onClick={() => {
                  setViewingExpense(viewingReceipt);
                  setViewingReceipt(null);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:text-indigo-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>View Full Expense Details</span>
              </button>

              <button
                onClick={() => setViewingReceipt(null)}
                className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete All Expenses Modal (PIN Protected) */}
      {isDeleteAllOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in no-print">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm sm:text-base leading-tight">Delete All Expenses</h3>
                  <p className="text-[11px] text-rose-500 font-medium">Irreversible Security Action</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isDeletingAll) {
                    setIsDeleteAllOpen(false);
                    setDeleteAllPin('');
                    setDeleteAllError('');
                  }
                }}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Warning Banner */}
            <div className="flex items-start gap-2.5 mt-4 p-3 text-xs text-rose-800 bg-rose-50/90 rounded-xl border border-rose-200/80">
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-bold">Permanent Deletion Warning</p>
                <p className="text-[11px] text-rose-700 leading-relaxed">
                  Deleting expenses permanently clears receipt files, itemized splits, and recalculates monthly balances.
                </p>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleDeleteAllConfirm} className="mt-4 space-y-4">
              {/* Select Scope */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">Select Delete Scope</label>
                <div className="space-y-2">
                  <label
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                      deleteAllScope === 'month'
                        ? 'border-indigo-600 bg-indigo-50/40 text-slate-800 shadow-xs'
                        : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="deleteScope"
                      value="month"
                      checked={deleteAllScope === 'month'}
                      onChange={() => setDeleteAllScope('month')}
                      className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <span className="text-xs font-bold block text-slate-800">
                        Current Month ({getMonthName(selectedMonth)})
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Deletes all {expenses.length} expense{expenses.length === 1 ? '' : 's'} recorded for this month
                      </span>
                    </div>
                  </label>

                  {filteredExpenses.length !== expenses.length && (
                    <label
                      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                        deleteAllScope === 'filtered'
                          ? 'border-indigo-600 bg-indigo-50/40 text-slate-800 shadow-xs'
                          : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      <input
                        type="radio"
                        name="deleteScope"
                        value="filtered"
                        checked={deleteAllScope === 'filtered'}
                        onChange={() => setDeleteAllScope('filtered')}
                        className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <span className="text-xs font-bold block text-slate-800">
                          Filtered Results Only
                        </span>
                        <span className="text-[11px] text-slate-500">
                          Deletes only the {filteredExpenses.length} filtered expense{filteredExpenses.length === 1 ? '' : 's'} currently showing
                        </span>
                      </div>
                    </label>
                  )}

                  <label
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                      deleteAllScope === 'all'
                        ? 'border-rose-600 bg-rose-50/40 text-slate-800 shadow-xs'
                        : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="deleteScope"
                      value="all"
                      checked={deleteAllScope === 'all'}
                      onChange={() => setDeleteAllScope('all')}
                      className="mt-0.5 text-rose-600 focus:ring-rose-500"
                    />
                    <div>
                      <span className="text-xs font-bold block text-rose-700">
                        All Months (Entire History)
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Deletes every expense across all months in the entire database
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Authorizing Member Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Authorizing Member</label>
                <select
                  value={deleteAuthorizingMemberId}
                  onChange={(e) => setDeleteAuthorizingMemberId(e.target.value === 'any' ? 'any' : Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-slate-700"
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.role})
                    </option>
                  ))}
                  <option value="any">Any Member Password</option>
                </select>
              </div>

              {/* Security PIN input */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Security PIN / Password</label>
                <div className="relative">
                  <input
                    type={showDeleteAllPin ? 'text' : 'password'}
                    maxLength={32}
                    autoFocus
                    value={deleteAllPin}
                    onChange={(e) => setDeleteAllPin(e.target.value)}
                    placeholder="Enter PIN to authorize deletion"
                    className="w-full tracking-wider text-center text-lg font-bold px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-slate-800 placeholder:text-slate-400 placeholder:text-xs placeholder:font-normal placeholder:tracking-normal"
                  />
                  <button
                    type="button"
                    onClick={() => setShowDeleteAllPin(!showDeleteAllPin)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 p-0.5"
                    title={showDeleteAllPin ? 'Hide PIN' : 'Show PIN'}
                  >
                    {showDeleteAllPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 text-center mt-1.5 flex items-center justify-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  <span>Requires valid member PIN to execute deletion</span>
                </p>
              </div>

              {/* Error message */}
              {deleteAllError && (
                <div className="flex items-center gap-2 p-3 text-xs font-semibold text-rose-700 bg-rose-50 rounded-xl border border-rose-200 animate-shake">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{deleteAllError}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isDeletingAll}
                  onClick={() => {
                    setIsDeleteAllOpen(false);
                    setDeleteAllPin('');
                    setDeleteAllError('');
                  }}
                  className="flex-1 py-2.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition active:scale-95 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isDeletingAll || !deleteAllPin.trim()}
                  className="flex-1 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition disabled:opacity-50 active:scale-95 flex items-center justify-center gap-1.5"
                >
                  {isDeletingAll ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Confirm & Delete</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
