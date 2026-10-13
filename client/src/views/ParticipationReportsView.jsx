import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Printer,
  Download,
  Users,
  Calendar,
  Sparkles,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  CheckCircle2,
  PieChart as PieIcon,
  HelpCircle
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { api } from '../services/api';
import { formatCurrency, formatDateIN, getMonthName } from '../utils/formatters';

export function ParticipationReportsView({
  monthlyReport,
  selectedMonth,
  showToast
}) {
  const [activeReportTab, setActiveReportTab] = useState('monthly'); // 'monthly', 'participation', 'yearly'
  const [participationData, setParticipationData] = useState(null);
  const [yearlyData, setYearlyData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const currentYear = selectedMonth.split('-')[0];

  useEffect(() => {
    fetchAuxReports();
  }, [selectedMonth, activeReportTab]);

  const fetchAuxReports = async () => {
    setIsLoading(true);
    try {
      if (activeReportTab === 'participation') {
        const res = await api.getParticipationReport(selectedMonth);
        setParticipationData(res);
      } else if (activeReportTab === 'yearly') {
        const res = await api.getYearlyReport(currentYear);
        setYearlyData(res);
      }
    } catch (err) {
      showToast({ type: 'error', message: err.message || 'Failed to load report data' });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Export Monthly Report CSV
  const handleExportMonthlyCSV = () => {
    if (!monthlyReport) return;
    const { currentSummary, categories, momComparison } = monthlyReport;

    const lines = [
      `MONTHLY EXPENSE REPORT - ${getMonthName(selectedMonth)}`,
      `Generated At: ${new Date().toLocaleString()}`,
      '',
      'SUMMARY METRICS',
      `Total Expenses,${currentSummary.totalExpenses}`,
      `Total Paid,${currentSummary.totalAmountPaid}`,
      `Recorded Expenses Count,${currentSummary.expenseCount}`,
      `Pending Settlements Count,${currentSummary.pendingSettlementCount}`,
      `Unsettled Balance,${currentSummary.totalOutstandingToSettle}`,
      `Status,${currentSummary.settlementStatus}`,
      '',
      'MEMBER-WISE BALANCES',
      'Member Name,Role,Total Paid,Actual Share,Net Balance,Settlement Offset,Outstanding Balance,Status',
      ...currentSummary.memberSummary.map(m =>
        `"${m.name}","${m.role}",${m.totalPaid},${m.actualShare},${m.netBalance},${m.settlementOffset},${m.outstandingBalance},"${m.status}"`
      ),
      '',
      'CATEGORY BREAKDOWN',
      'Category,Total (INR),Count,Percentage',
      ...categories.map(c => `"${c.category}",${c.total},${c.count},${c.percentage}%`),
      '',
      'MONTH-OVER-MONTH COMPARISON',
      `Previous Month,${momComparison.previousMonth}`,
      `Previous Total,${momComparison.previousTotal}`,
      `Difference Amount,${momComparison.differenceAmount}`,
      `Percentage Change,${momComparison.differencePercentage}%`,
      `Trend,${momComparison.trend}`
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Monthly_Report_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const currentSummary = monthlyReport?.currentSummary || {};
  const categories = monthlyReport?.categories || [];
  const mom = monthlyReport?.momComparison || {};
  const occasionalMember = participationData?.members?.find((m) => m.role === 'occasional');
  const occasionalName = occasionalMember?.name || 'Vatsa';

  return (
    <div className="space-y-6">
      {/* Sub Tabs Bar (no-print) */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3 no-print">
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveReportTab('monthly')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeReportTab === 'monthly'
                ? 'bg-white text-indigo-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Monthly Report
          </button>
          <button
            onClick={() => setActiveReportTab('participation')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeReportTab === 'participation'
                ? 'bg-white text-indigo-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {occasionalName} & Participation
          </button>
          <button
            onClick={() => setActiveReportTab('yearly')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeReportTab === 'yearly'
                ? 'bg-white text-indigo-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Yearly Summary ({currentYear})
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportMonthlyCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition shadow-xs"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* TAB 1: MONTHLY REPORT */}
      {activeReportTab === 'monthly' && (
        <div className="space-y-6">
          {/* Print Header (visible only on print) */}
          <div className="hidden print-only mb-6 text-center border-b pb-4">
            <h1 className="text-2xl font-bold">Monthly Shared Expense Statement</h1>
            <p className="text-sm text-gray-500">
              Period: {getMonthName(selectedMonth)} • Generated on {new Date().toLocaleDateString('en-IN')}
            </p>
          </div>

          {/* Month-over-Month Comparison Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs print-card">
            <h3 className="font-bold text-slate-800 text-sm sm:text-base mb-3">
              Month-over-Month Expense Comparison
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-[11px] text-slate-400 block font-medium">
                  {getMonthName(selectedMonth)}
                </span>
                <span className="text-lg font-bold text-slate-800">
                  {formatCurrency(currentSummary.totalExpenses || 0)}
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-[11px] text-slate-400 block font-medium">
                  {getMonthName(mom.previousMonth || '')} (Previous)
                </span>
                <span className="text-lg font-bold text-slate-800">
                  {formatCurrency(mom.previousTotal || 0)}
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-[11px] text-slate-400 block font-medium">Net Difference</span>
                <div className="flex items-center gap-1.5">
                  {mom.trend === 'increase' ? (
                    <TrendingUp className="w-4 h-4 text-rose-500" />
                  ) : mom.trend === 'decrease' ? (
                    <TrendingDown className="w-4 h-4 text-emerald-500" />
                  ) : null}
                  <span
                    className={`text-lg font-bold ${
                      mom.trend === 'increase'
                        ? 'text-rose-600'
                        : mom.trend === 'decrease'
                        ? 'text-emerald-600'
                        : 'text-slate-800'
                    }`}
                  >
                    {mom.differenceAmount > 0 ? '+' : ''}
                    {formatCurrency(mom.differenceAmount || 0)}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-[11px] text-slate-400 block font-medium">Percentage Variance</span>
                <span
                  className={`text-lg font-bold ${
                    mom.differencePercentage > 0
                      ? 'text-rose-600'
                      : mom.differencePercentage < 0
                      ? 'text-emerald-600'
                      : 'text-slate-800'
                  }`}
                >
                  {mom.differencePercentage > 0 ? '+' : ''}
                  {mom.differencePercentage || 0}%
                </span>
              </div>
            </div>
          </div>

          {/* Member Balance Breakdown */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden print-card">
            <div className="p-4 sm:p-5 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-base">Member Settlement Breakdown</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50/75 text-slate-500 uppercase text-[11px] font-semibold border-b border-slate-100">
                  <tr>
                    <th className="py-3 px-4 sm:px-6">Member</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4 text-right">Total Paid</th>
                    <th className="py-3 px-4 text-right">Fair Share</th>
                    <th className="py-3 px-4 text-right">Net Position</th>
                    <th className="py-3 px-4 text-right">Settled Offsets</th>
                    <th className="py-3 px-4 text-right">Outstanding</th>
                    <th className="py-3 px-4 text-center">Settlement Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentSummary.memberSummary?.map((m) => (
                    <tr key={m.id}>
                      <td className="py-3 px-4 sm:px-6 font-bold text-slate-800">{m.name}</td>
                      <td className="py-3 px-4 capitalize text-slate-500">{m.role}</td>
                      <td className="py-3 px-4 text-right font-medium">{formatCurrency(m.totalPaid)}</td>
                      <td className="py-3 px-4 text-right font-medium">{formatCurrency(m.actualShare)}</td>
                      <td className="py-3 px-4 text-right font-semibold">
                        {m.netBalance > 0 ? '+' : ''}{formatCurrency(m.netBalance)}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-500">
                        {m.settlementOffset !== 0 ? formatCurrency(m.settlementOffset) : '—'}
                      </td>
                      <td className={`py-3 px-4 text-right font-bold ${m.outstandingBalance > 0.01 ? 'text-emerald-700' : m.outstandingBalance < -0.01 ? 'text-rose-700' : 'text-slate-600'}`}>
                        {m.outstandingBalance > 0 ? '+' : ''}{formatCurrency(m.outstandingBalance)}
                      </td>
                      <td className="py-3 px-4 text-center capitalize font-semibold text-xs">
                        {m.status}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Category Breakdown Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden print-card">
            <div className="p-4 sm:p-5 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-base">Category-Wise Breakdown</h3>
            </div>
            <div className="p-4 sm:p-6 space-y-3">
              {categories.map((c) => (
                <div key={c.category} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold text-slate-700">
                    <span>{c.category} ({c.count} {c.count === 1 ? 'expense' : 'expenses'})</span>
                    <span>{formatCurrency(c.total)} ({c.percentage}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-indigo-600 h-full rounded-full"
                      style={{ width: `${c.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: OCCASIONAL MEMBER & PARTICIPATION REPORT */}
      {activeReportTab === 'participation' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-white p-5 rounded-2xl border border-amber-200 shadow-xs">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-amber-600" />
              <h3 className="font-bold text-slate-800 text-base">{occasionalName} Occasional Participation Analysis</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
              {occasionalName} is an occasional member who participates only when explicitly selected. Expenses are never automatically divided across all four members unless {occasionalName} joined in.
            </p>
          </div>

          {participationData?.members && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {participationData.members.map((m) => (
                <div
                  key={m.id}
                  className={`p-4 rounded-2xl border shadow-xs bg-white ${
                    m.role === 'occasional' ? 'border-amber-300 ring-2 ring-amber-100' : 'border-slate-200/80'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-slate-800 text-sm">{m.name}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md capitalize ${
                        m.role === 'occasional'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-indigo-50 text-indigo-700'
                      }`}
                    >
                      {m.role}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs pt-1">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Participated:</span>
                      <span className="font-bold text-slate-700">
                        {m.participatedCount} of {participationData.totalExpensesCount} ({m.participationRate}%)
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Skipped:</span>
                      <span className="font-bold text-slate-500">{m.skippedCount}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-slate-100">
                      <span className="text-slate-400">Total Allocated:</span>
                      <span className="font-bold text-indigo-600">{formatCurrency(m.totalAllocated)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Total Paid Out:</span>
                      <span className="font-bold text-emerald-600">{formatCurrency(m.totalPaid)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Occasional Member Participated Expenses List */}
          {occasionalMember && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-slate-100">
                <h4 className="font-bold text-slate-800 text-sm">
                  Expenses Shared with {occasionalName} in {getMonthName(selectedMonth)}
                </h4>
              </div>

              {occasionalMember.participatedExpenses?.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  {occasionalName} did not participate in any shared expenses during this period.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {occasionalMember.participatedExpenses?.map((e) => (
                    <div key={e.id} className="p-4 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-slate-800 block text-sm">{e.title}</span>
                        <span className="text-slate-400">{formatDateIN(e.date)} • Paid by {e.payerName}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-slate-900 text-sm block">{formatCurrency(e.amount)}</span>
                        <span className="text-[10px] text-emerald-600 font-semibold">{occasionalName} Included</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: YEARLY SUMMARY */}
      {activeReportTab === 'yearly' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex justify-between items-center">
            <div>
              <h3 className="font-bold text-slate-800 text-base">Annual Spending Summary for {currentYear}</h3>
              <p className="text-xs text-slate-500">12-month consolidated expense and settlement records</p>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400 block font-medium">Year Total</span>
              <span className="text-xl font-bold text-slate-900">
                {formatCurrency(yearlyData?.totalYearlyExpenses || 0)}
              </span>
            </div>
          </div>

          {/* Yearly Chart */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
            <h4 className="text-xs font-bold text-slate-700 mb-4">Monthly Spending Trend</h4>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={yearlyData?.monthlyTrends || []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(m) => m.slice(5)} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => `₹${v}`} />
                  <Tooltip
                    formatter={(val) => [formatCurrency(val)]}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }}
                  />
                  <Bar dataKey="totalExpenses" name="Total Expenses" fill="#6366f1" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 12-Month Detailed Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-[11px] border-b border-slate-100">
                  <tr>
                    <th className="py-3 px-4">Month</th>
                    <th className="py-3 px-4 text-right">Total Expenses</th>
                    <th className="py-3 px-4 text-center">Count</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {yearlyData?.monthlyTrends?.map((m) => (
                    <tr key={m.month} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-bold text-slate-700">{getMonthName(m.month)}</td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">{formatCurrency(m.totalExpenses)}</td>
                      <td className="py-3 px-4 text-center text-slate-500">{m.expenseCount}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${m.isSettled ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                          {m.isSettled ? 'Settled' : 'Unsettled'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
