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
  X,
  ExternalLink
} from 'lucide-react';
import { formatCurrency, formatDateIN } from '../utils/formatters';

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
  onNavigateTab
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [selectedPayer, setSelectedPayer] = useState('');
  const [selectedParticipant, setSelectedParticipant] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [viewingExpense, setViewingExpense] = useState(null);

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

  return (
    <div className="space-y-6">
      {/* Top action & filter bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Expense History</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Filtered {sortedExpenses.length} of {expenses.length} records in this period
            </p>
          </div>

          <button
            onClick={handleExportCSV}
            disabled={sortedExpenses.length === 0}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-xl transition self-start sm:self-auto"
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span>Export CSV</span>
          </button>
        </div>

        {/* Search & Filter Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-1">
          {/* Search */}
          <div className="relative lg:col-span-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search expenses..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          {/* Category */}
          <div>
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
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition"
              title="Toggle Sort Direction"
            >
              <ArrowUpDown className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Expenses Table / Cards */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {sortedExpenses.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <FileText className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-slate-700 text-sm">No Expenses Found</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
              There are no expense records matching your current filter criteria for this month.
            </p>
            <button
              onClick={() => onNavigateTab('add-expense')}
              className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 transition"
            >
              Add First Expense
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
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
    </div>
  );
}
