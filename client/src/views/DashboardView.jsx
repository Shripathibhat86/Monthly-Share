import React from 'react';
import {
  CreditCard,
  Receipt,
  Scale,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  PieChart as PieIcon,
  Plus
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { formatCurrency, getMonthName } from '../utils/formatters';

const PIE_COLORS = [
  '#6366f1', '#3b82f6', '#10b981', '#f59e0b',
  '#ec4899', '#8b5cf6', '#14b8a6', '#f97316', '#64748b'
];

export function DashboardView({
  settlementSummary,
  monthlyReport,
  selectedMonth,
  onNavigateTab
}) {
  const summary = settlementSummary || {};
  const memberSummary = summary.memberSummary || [];
  const categories = monthlyReport?.categories || [];

  // Bar chart data: Member Contributions vs Actual Share
  const barData = memberSummary.map((m) => ({
    name: m.name,
    'Total Paid': m.totalPaid,
    'Fair Share': m.actualShare
  }));

  // Pie chart data
  const pieData = categories.map((c) => ({
    name: c.category,
    value: c.total
  }));

  return (
    <div className="space-y-6">
      {/* Top Welcome / Month Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-800">
            Overview for {getMonthName(selectedMonth)}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time balance breakdown and settlement status for all 4 members
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigateTab('add-expense')}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add Expense</span>
          </button>
          <button
            onClick={() => onNavigateTab('settlements')}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
          >
            <Scale className="w-4 h-4 text-indigo-600" />
            <span>Settlement Engine</span>
          </button>
        </div>
      </div>

      {/* 5 Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* 1. Total expenses */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Total Expenses</span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-slate-800">
            {formatCurrency(summary.totalExpenses || 0)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Recorded in {getMonthName(selectedMonth)}</p>
        </div>

        {/* 2. Total amount paid */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Total Paid by Members</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-slate-800">
            {formatCurrency(summary.totalAmountPaid || 0)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Actual cash outlay by members</p>
        </div>

        {/* 3. Number of expenses */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Expenses Recorded</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-slate-800">
            {summary.expenseCount || 0}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Transactions logged</p>
        </div>

        {/* 4. Number of pending settlements */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Pending Settlements</span>
            <div className={`p-2 rounded-xl ${summary.pendingSettlementCount > 0 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-slate-800">
            {summary.pendingSettlementCount || 0}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            {summary.pendingSettlementCount > 0 ? 'Transfers required' : 'All transfers completed'}
          </p>
        </div>

        {/* 5. Amount still to be settled */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Amount to Settle</span>
            <div className={`p-2 rounded-xl ${summary.totalOutstandingToSettle > 0 ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-600'}`}>
              <Scale className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-slate-800">
            {formatCurrency(summary.totalOutstandingToSettle || 0)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Net pending cash transfers</p>
        </div>
      </div>

      {/* Pending Settlement Recommendation Alert Banner */}
      {summary.pendingRecommendations && summary.pendingRecommendations.length > 0 && (
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-300/60 p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500 text-white rounded-xl shadow-xs">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-900">
                Action Required: {summary.pendingRecommendations.length} Pending Settlement {summary.pendingRecommendations.length === 1 ? 'Transfer' : 'Transfers'}
              </h4>
              <p className="text-xs text-amber-800/80">
                The minimum cash flow algorithm has determined the optimal transfers to balance this month.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigateTab('settlements')}
            className="flex items-center gap-1.5 self-start md:self-auto px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-xl shadow-xs transition"
          >
            <span>Resolve Now</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Member-wise summary table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-800 text-base">Member Financial Summary</h3>
            <p className="text-xs text-slate-500">
              Balance = Total Amount Paid - Total Allocated Expense Share. Positive = Receivable, Negative = Payable.
            </p>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
              summary.isMonthSettled
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}
          >
            {summary.settlementStatus}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50/75 text-slate-500 uppercase text-[11px] font-semibold border-b border-slate-100">
              <tr>
                <th className="py-3 px-4 sm:px-6">Member Name</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4 text-right">Total Paid</th>
                <th className="py-3 px-4 text-right">Actual Share</th>
                <th className="py-3 px-4 text-right">Net Expense Balance</th>
                <th className="py-3 px-4 text-right">Settlement Transfers</th>
                <th className="py-3 px-4 text-right">Outstanding Balance</th>
                <th className="py-3 px-4 sm:px-6 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {memberSummary.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No member records found.
                  </td>
                </tr>
              ) : (
                memberSummary.map((m) => {
                  const isReceivable = m.outstandingBalance > 0.01;
                  const isPayable = m.outstandingBalance < -0.01;
                  const isSettled = !isReceivable && !isPayable;

                  return (
                    <tr key={m.id} className="hover:bg-slate-50/50 transition">
                      <td className="py-3.5 px-4 sm:px-6 font-semibold text-slate-800">
                        {m.name}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`text-[11px] font-medium px-2 py-0.5 rounded-md capitalize ${
                            m.role === 'occasional'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-indigo-50 text-indigo-700'
                          }`}
                        >
                          {m.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-medium text-slate-700">
                        {formatCurrency(m.totalPaid)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-medium text-slate-700">
                        {formatCurrency(m.actualShare)}
                      </td>
                      <td
                        className={`py-3.5 px-4 text-right font-semibold ${
                          m.netBalance > 0.01
                            ? 'text-emerald-600'
                            : m.netBalance < -0.01
                            ? 'text-rose-600'
                            : 'text-slate-600'
                        }`}
                      >
                        {m.netBalance > 0.01 ? '+' : ''}
                        {formatCurrency(m.netBalance)}
                      </td>
                      <td className="py-3.5 px-4 text-right text-slate-500 font-medium text-xs">
                        {m.settlementPaid > 0 && <span className="text-emerald-600">Paid: {formatCurrency(m.settlementPaid)} </span>}
                        {m.settlementReceived > 0 && <span className="text-indigo-600">Recv: {formatCurrency(m.settlementReceived)}</span>}
                        {m.settlementPaid === 0 && m.settlementReceived === 0 && '—'}
                      </td>
                      <td
                        className={`py-3.5 px-4 text-right font-bold text-sm ${
                          isReceivable
                            ? 'text-emerald-700'
                            : isPayable
                            ? 'text-rose-700'
                            : 'text-slate-600'
                        }`}
                      >
                        {isReceivable ? '+' : ''}
                        {formatCurrency(m.outstandingBalance)}
                      </td>
                      <td className="py-3.5 px-4 sm:px-6 text-center">
                        {isReceivable && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            Receives {formatCurrency(m.outstandingBalance)}
                          </span>
                        )}
                        {isPayable && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                            Owes {formatCurrency(Math.abs(m.outstandingBalance))}
                          </span>
                        )}
                        {isSettled && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                            <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
                            Settled
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Visual Analytics / Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Member Paid vs Fair Share */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-800 text-sm sm:text-base">
                Member Contributions vs Actual Share
              </h3>
              <p className="text-xs text-slate-500">Total amount paid vs fair allocated share per member</p>
            </div>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>

          <div className="h-64 w-full">
            {summary.expenseCount > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v}`} />
                  <Tooltip
                    formatter={(value) => [formatCurrency(value)]}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  <Bar dataKey="Total Paid" fill="#6366f1" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="Fair Share" fill="#ec4899" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No expense data recorded for this month yet
              </div>
            )}
          </div>
        </div>

        {/* Chart 2: Category Breakdown */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-800 text-sm sm:text-base">
                Category-wise Expense Breakdown
              </h3>
              <p className="text-xs text-slate-500">Distribution across groceries, bills, dining, travel etc.</p>
            </div>
            <div className="p-2 bg-pink-50 text-pink-600 rounded-xl">
              <PieIcon className="w-4 h-4" />
            </div>
          </div>

          <div className="h-64 w-full flex items-center justify-center">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => [formatCurrency(value)]}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '5px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-slate-400">
                No categories logged for this month
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
