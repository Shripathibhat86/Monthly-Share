import React, { useState, useEffect } from 'react';
import {
  Receipt,
  Upload,
  Calendar,
  Check,
  AlertCircle,
  FileText,
  DollarSign,
  Users,
  Percent,
  Divide,
  Scale,
  Sparkles,
  X,
  Save,
  ArrowLeft
} from 'lucide-react';
import { api } from '../services/api';
import {
  formatCurrency,
  toInputDate,
  getCurrentDateISO,
  formatDateIN
} from '../utils/formatters';

const CATEGORIES = [
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

export function AddExpenseView({
  members = [],
  selectedMonth,
  editingExpense = null,
  onCancelEdit,
  onExpenseSaved,
  showToast
}) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(getCurrentDateISO());
  const [category, setCategory] = useState('Groceries');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState(members[0]?.id || 1);
  const [splitMethod, setSplitMethod] = useState('equal'); // 'equal', 'custom', 'percentage', 'weighted'
  const [selectedParticipants, setSelectedParticipants] = useState([1, 2, 3]); // User1, 2, 3 by default, User4 excluded initially
  const [customShares, setCustomShares] = useState({}); // { [memberId]: amount }
  const [percentageShares, setPercentageShares] = useState({}); // { [memberId]: percentage }
  const [weightedShares, setWeightedShares] = useState({}); // { [memberId]: weight }
  const [notes, setNotes] = useState('');
  const [receiptData, setReceiptData] = useState(null);
  const [receiptFilename, setReceiptFilename] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Prepopulate if editing
  useEffect(() => {
    if (editingExpense) {
      setTitle(editingExpense.title || '');
      setDate(toInputDate(editingExpense.date));
      setCategory(editingExpense.category || 'Other');
      setAmount(editingExpense.amount?.toString() || '');
      setPaidBy(Number(editingExpense.paid_by_member_id));
      setSplitMethod(editingExpense.split_method || 'equal');
      setNotes(editingExpense.notes || '');
      setReceiptData(editingExpense.receipt_data || null);
      setReceiptFilename(editingExpense.receipt_filename || '');

      const partIds = editingExpense.participants?.map((p) => Number(p.member_id)) || [];
      setSelectedParticipants(partIds);

      // Prepopulate custom/percentage/weighted values
      if (editingExpense.split_method === 'custom') {
        const cMap = {};
        editingExpense.participants?.forEach((p) => {
          cMap[p.member_id] = p.allocated_amount;
        });
        setCustomShares(cMap);
      } else if (editingExpense.split_method === 'percentage') {
        const pMap = {};
        editingExpense.participants?.forEach((p) => {
          pMap[p.member_id] = p.split_value || 0;
        });
        setPercentageShares(pMap);
      } else if (editingExpense.split_method === 'weighted') {
        const wMap = {};
        editingExpense.participants?.forEach((p) => {
          wMap[p.member_id] = p.split_value || 1;
        });
        setWeightedShares(wMap);
      }
    } else {
      // Default new expense
      // Default date to current month's current date or 1st of selectedMonth
      const today = getCurrentDateISO();
      if (today.startsWith(selectedMonth)) {
        setDate(today);
      } else {
        setDate(`${selectedMonth}-01`);
      }
      // User1, User2, User3 selected by default. User4 not selected (occasional).
      const regMembers = members.filter(m => m.role !== 'occasional').map(m => m.id);
      setSelectedParticipants(regMembers.length > 0 ? regMembers : [1, 2, 3]);
    }
  }, [editingExpense, members, selectedMonth]);

  const numAmount = parseFloat(amount) || 0;

  // Toggle participant
  const toggleParticipant = (memberId) => {
    if (selectedParticipants.includes(memberId)) {
      if (selectedParticipants.length <= 1) {
        showToast({ type: 'error', message: 'At least one participant must be selected' });
        return;
      }
      setSelectedParticipants(selectedParticipants.filter((id) => id !== memberId));
    } else {
      setSelectedParticipants([...selectedParticipants, memberId]);
    }
  };

  // Select all / regular members helpers
  const selectAll = () => {
    setSelectedParticipants(members.map((m) => m.id));
  };
  const selectRegularOnly = () => {
    setSelectedParticipants(members.filter((m) => m.role !== 'occasional').map((m) => m.id));
  };

  // Calculate live allocations
  const calculateLiveShares = () => {
    if (selectedParticipants.length === 0 || numAmount <= 0) return [];

    if (splitMethod === 'equal') {
      const count = selectedParticipants.length;
      const totalPaise = Math.round(numAmount * 100);
      const basePaise = Math.floor(totalPaise / count);
      let remainder = totalPaise - basePaise * count;

      return selectedParticipants.map((mId) => {
        let p = basePaise;
        if (remainder > 0) {
          p += 1;
          remainder -= 1;
        }
        return {
          memberId: mId,
          share: p / 100
        };
      });
    }

    if (splitMethod === 'percentage') {
      const totalPaise = Math.round(numAmount * 100);
      let allocatedPaiseSum = 0;
      const shares = selectedParticipants.map((mId) => {
        const pct = parseFloat(percentageShares[mId]) || 0;
        const paise = Math.round((totalPaise * pct) / 100);
        allocatedPaiseSum += paise;
        return { memberId: mId, share: paise / 100, pct };
      });
      const discrepancy = totalPaise - allocatedPaiseSum;
      if (discrepancy !== 0 && shares.length > 0) {
        shares[0].share = (Math.round(shares[0].share * 100) + discrepancy) / 100;
      }
      return shares;
    }

    if (splitMethod === 'weighted') {
      const totalWeight = selectedParticipants.reduce(
        (sum, mId) => sum + (parseFloat(weightedShares[mId]) || 1),
        0
      );
      if (totalWeight <= 0) return [];
      const totalPaise = Math.round(numAmount * 100);
      let allocatedPaiseSum = 0;
      const shares = selectedParticipants.map((mId) => {
        const w = parseFloat(weightedShares[mId]) || 1;
        const paise = Math.round((totalPaise * w) / totalWeight);
        allocatedPaiseSum += paise;
        return { memberId: mId, share: paise / 100, weight: w };
      });
      const discrepancy = totalPaise - allocatedPaiseSum;
      if (discrepancy !== 0 && shares.length > 0) {
        shares[0].share = (Math.round(shares[0].share * 100) + discrepancy) / 100;
      }
      return shares;
    }

    if (splitMethod === 'custom') {
      return selectedParticipants.map((mId) => ({
        memberId: mId,
        share: parseFloat(customShares[mId]) || 0
      }));
    }

    return [];
  };

  const liveShares = calculateLiveShares();
  const totalAllocated = liveShares.reduce((sum, s) => sum + s.share, 0);
  const isMatch = Math.abs(totalAllocated - numAmount) < 0.01 && numAmount > 0;

  // Handle file upload (Base64)
  const handleReceiptFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showToast({ type: 'error', message: 'Receipt file must be under 5 MB' });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setReceiptData(reader.result);
      setReceiptFilename(file.name);
      showToast({ type: 'success', message: 'Receipt attached successfully' });
    };
    reader.readAsDataURL(file);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!title.trim()) {
      setErrorMessage('Please enter an expense title');
      return;
    }

    if (numAmount <= 0) {
      setErrorMessage('Please enter a valid expense amount greater than ₹0');
      return;
    }

    if (selectedParticipants.length === 0) {
      setErrorMessage('Please select at least one participating member');
      return;
    }

    if (!isMatch) {
      setErrorMessage(
        `Total allocated shares (₹${totalAllocated.toFixed(2)}) must equal the expense amount (₹${numAmount.toFixed(2)})`
      );
      return;
    }

    setIsSubmitting(true);

    try {
      // Build participants payload
      let participantsPayload = [];
      if (splitMethod === 'equal') {
        participantsPayload = selectedParticipants;
      } else if (splitMethod === 'custom') {
        participantsPayload = selectedParticipants.map((mId) => ({
          member_id: mId,
          amount: parseFloat(customShares[mId]) || 0
        }));
      } else if (splitMethod === 'percentage') {
        participantsPayload = selectedParticipants.map((mId) => ({
          member_id: mId,
          percentage: parseFloat(percentageShares[mId]) || 0
        }));
      } else if (splitMethod === 'weighted') {
        participantsPayload = selectedParticipants.map((mId) => ({
          member_id: mId,
          weight: parseFloat(weightedShares[mId]) || 1
        }));
      }

      const payload = {
        title: title.trim(),
        date,
        category,
        amount: numAmount,
        paid_by_member_id: Number(paidBy),
        split_method: splitMethod,
        participants: participantsPayload,
        notes: notes.trim(),
        receipt_data: receiptData,
        receipt_filename: receiptFilename
      };

      if (editingExpense) {
        await api.updateExpense(editingExpense.id, payload);
        showToast({ type: 'success', message: 'Expense updated and balances recalculated!' });
      } else {
        await api.createExpense(payload);
        showToast({ type: 'success', message: 'Expense recorded and balances recalculated!' });
      }

      onExpenseSaved();
    } catch (err) {
      setErrorMessage(err.message || 'Failed to save expense');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header card */}
      <div className="flex items-center justify-between bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-800">
            {editingExpense ? 'Edit Expense Record' : 'Record Shared Expense'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Allocate costs accurately only to the participating members.
          </p>
        </div>

        {editingExpense && (
          <button
            onClick={onCancelEdit}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Cancel Edit</span>
          </button>
        )}
      </div>

      {errorMessage && (
        <div className="flex items-center gap-2 p-4 text-xs font-medium text-rose-800 bg-rose-50 border border-rose-200 rounded-2xl">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleFormSubmit} className="space-y-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-6">
          {/* Row 1: Title, Category, Amount */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Expense Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Monthly Grocery at Supermarket"
                className="w-full px-3.5 py-2.5 text-base sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Total Amount (₹) *
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-slate-400 font-bold text-sm">₹</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-8 pr-3.5 py-2.5 text-base sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-bold text-slate-900"
                />
              </div>
            </div>
          </div>

          {/* Row 2: Date, Category, Paid By */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Date (DD-MM-YYYY) *
              </label>
              <div className="relative">
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-base sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium text-slate-800"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Formatted as: {formatDateIN(date)}</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Category *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 text-base sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium text-slate-800 cursor-pointer"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Paid By Member *
              </label>
              <select
                value={paidBy}
                onChange={(e) => setPaidBy(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 text-base sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold text-indigo-700 cursor-pointer"
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.role})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Row 3: Participating Members */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <label className="text-xs font-semibold text-slate-700">
                  Participating Members *
                </label>
                <p className="text-[11px] text-slate-500">
                  Only selected members will share this cost. User4 is optional.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={selectRegularOnly}
                  className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                >
                  Regular Only (User1-3)
                </button>
                <button
                  type="button"
                  onClick={selectAll}
                  className="px-2.5 py-1 text-[11px] font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition"
                >
                  All 4 Members
                </button>
              </div>
            </div>

            {/* Member Checkbox Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {members.map((member) => {
                const isSelected = selectedParticipants.includes(member.id);
                return (
                  <div
                    key={member.id}
                    onClick={() => toggleParticipant(member.id)}
                    className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                      isSelected
                        ? 'bg-indigo-50/70 border-indigo-300 shadow-xs'
                        : 'bg-slate-50/50 border-slate-200 hover:border-slate-300 opacity-60'
                    }`}
                  >
                    <div>
                      <span className="font-semibold text-xs text-slate-800 block">
                        {member.name}
                      </span>
                      <span className="text-[10px] text-slate-400 capitalize">
                        {member.role}
                      </span>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-lg flex items-center justify-center border transition ${
                        isSelected
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : 'border-slate-300 bg-white'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Row 4: Split Method Tabs */}
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-700">
                Split Method *
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                {[
                  { id: 'equal', label: 'Equal Split', desc: 'Divide equally', icon: Divide },
                  { id: 'custom', label: 'Custom Amount', desc: 'Exact ₹ per person', icon: DollarSign },
                  { id: 'percentage', label: 'Percentage Split', desc: 'Exact % totaling 100%', icon: Percent },
                  { id: 'weighted', label: 'Weighted Split', desc: 'Proportional ratio', icon: Scale },
                ].map((method) => {
                  const Icon = method.icon;
                  const isSelected = splitMethod === method.id;
                  return (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => setSplitMethod(method.id)}
                      className={`p-3 rounded-xl border text-left transition flex flex-col gap-1 ${
                        isSelected
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold">{method.label}</span>
                        <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                      </div>
                      <span className={`text-[10px] ${isSelected ? 'text-indigo-100' : 'text-slate-400'}`}>
                        {method.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Split Method Specific Inputs */}
            {splitMethod !== 'equal' && (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <span className="text-xs font-semibold text-slate-700">
                  Specify {splitMethod === 'custom' ? 'Custom Amounts (₹)' : splitMethod === 'percentage' ? 'Percentages (%)' : 'Weights / Ratios'}
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {selectedParticipants.map((mId) => {
                    const member = members.find((m) => m.id === mId);
                    return (
                      <div key={mId} className="flex items-center justify-between gap-3 bg-white p-2.5 rounded-xl border border-slate-200">
                        <span className="text-xs font-medium text-slate-700">
                          {member?.name}
                        </span>

                        {splitMethod === 'custom' && (
                          <div className="relative w-32">
                            <span className="absolute left-2.5 top-1.5 text-xs text-slate-400">₹</span>
                            <input
                              type="number"
                              step="0.01"
                              value={customShares[mId] || ''}
                              onChange={(e) =>
                                setCustomShares({ ...customShares, [mId]: e.target.value })
                              }
                              placeholder="0.00"
                              className="w-full pl-6 pr-2 py-1 text-xs font-bold border border-slate-200 rounded-lg text-right"
                            />
                          </div>
                        )}

                        {splitMethod === 'percentage' && (
                          <div className="relative w-28">
                            <input
                              type="number"
                              step="0.1"
                              value={percentageShares[mId] || ''}
                              onChange={(e) =>
                                setPercentageShares({ ...percentageShares, [mId]: e.target.value })
                              }
                              placeholder="0"
                              className="w-full pl-2 pr-6 py-1 text-xs font-bold border border-slate-200 rounded-lg text-right"
                            />
                            <span className="absolute right-2 top-1.5 text-xs text-slate-400">%</span>
                          </div>
                        )}

                        {splitMethod === 'weighted' && (
                          <div className="w-24">
                            <input
                              type="number"
                              step="0.5"
                              value={weightedShares[mId] || '1'}
                              onChange={(e) =>
                                setWeightedShares({ ...weightedShares, [mId]: e.target.value })
                              }
                              placeholder="1"
                              className="w-full px-2 py-1 text-xs font-bold border border-slate-200 rounded-lg text-right"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Live Split Calculation Preview Table */}
            <div className="p-4 bg-indigo-50/40 rounded-xl border border-indigo-100 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  <span>Calculated Allocations ({selectedParticipants.length} Participants)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-600">
                    Sum: {formatCurrency(totalAllocated)} / {formatCurrency(numAmount)}
                  </span>
                  {isMatch ? (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      <Check className="w-3 h-3" /> Exact
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                      Diff: {formatCurrency(Math.abs(numAmount - totalAllocated))}
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                {liveShares.map((s) => {
                  const m = members.find((x) => x.id === s.memberId);
                  return (
                    <div key={s.memberId} className="bg-white p-2 rounded-lg border border-slate-200/80 text-xs">
                      <div className="text-slate-500 font-medium truncate">{m?.name}</div>
                      <div className="font-bold text-indigo-600 mt-0.5">
                        {formatCurrency(s.share)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Row 5: Notes & Optional Receipt */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Notes / Description (Optional)
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add bill reference, details, or notes..."
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Receipt Attachment (Optional)
              </label>

              {receiptData ? (
                <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <FileText className="w-5 h-5 text-indigo-600 flex-shrink-0" />
                    <span className="text-xs font-medium text-slate-700 truncate">
                      {receiptFilename || 'Receipt Attached'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setReceiptData(null);
                      setReceiptFilename('');
                    }}
                    className="p-1 text-slate-400 hover:text-rose-600 rounded-lg transition"
                    title="Remove Receipt"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-200 hover:border-indigo-400 bg-slate-50/50 hover:bg-indigo-50/20 rounded-xl cursor-pointer transition">
                  <Upload className="w-5 h-5 text-slate-400 mb-1" />
                  <span className="text-xs font-semibold text-slate-600">
                    Click to upload bill / receipt
                  </span>
                  <span className="text-[10px] text-slate-400 mt-0.5">
                    PNG, JPG, or PDF (Max 5MB)
                  </span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleReceiptFile}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 sm:gap-3">
          {editingExpense && (
            <button
              type="button"
              onClick={onCancelEdit}
              className="w-full sm:w-auto px-5 py-3 sm:py-2.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 active:scale-95 rounded-xl transition touch-manipulation text-center"
            >
              Cancel
            </button>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !isMatch}
            className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 sm:py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 disabled:opacity-50 rounded-xl shadow-md shadow-indigo-100 transition touch-manipulation"
          >
            <Save className="w-4 h-4 stroke-[2.5]" />
            <span>{isSubmitting ? 'Saving...' : editingExpense ? 'Update Expense' : 'Save Expense'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
