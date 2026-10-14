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
  ExternalLink
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
                          onClick={() => setViewingExpense(exp)}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-[11px] font-semibold"
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
                        onClick={() => setViewingExpense(exp)}
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
                            onClick={() => setViewingExpense(exp)}
                            className="p-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition"
                            title="View Receipt"
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
                            onClick={() => setViewingExpense(exp)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                            title="View Details"
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
              {viewingExpense.receipt_data && (
                <div>
                  <h4 className="text-xs font-bold text-slate-700 mb-2">Receipt Attachment:</h4>
                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50 p-2">
                    {viewingExpense.receipt_data.startsWith('data:image/') ? (
                      <img
                        src={viewingExpense.receipt_data}
                        alt="Receipt"
                        className="max-h-64 mx-auto object-contain rounded-lg"
                      />
                    ) : (
                      <div className="p-4 text-center">
                        <FileText className="w-8 h-8 text-indigo-600 mx-auto mb-2" />
                        <span className="text-xs text-slate-600 font-medium block">
                          PDF Document Attached
                        </span>
                        <a
                          href={viewingExpense.receipt_data}
                          download={viewingExpense.receipt_filename || 'receipt.pdf'}
                          className="mt-2 inline-flex items-center gap-1 text-xs text-indigo-600 font-bold hover:underline"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download File</span>
                        </a>
                      </div>
                    )}
                  </div>
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
