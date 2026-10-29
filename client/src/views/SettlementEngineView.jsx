import React, { useState } from 'react';
import {
  Scale,
  ArrowRight,
  CheckCircle2,
  Clock,
  RotateCcw,
  AlertCircle,
  HelpCircle,
  Calendar,
  CreditCard,
  Hash,
  X,
  FileText,
  Copy,
  Check,
  QrCode,
  Info,
  ChevronRight,
  ExternalLink,
  History,
  Receipt,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { api } from '../services/api';
import { formatCurrency, formatDateIN, getCurrentDateISO, getMonthName } from '../utils/formatters';

export function SettlementEngineView({
  settlementSummary,
  selectedMonth,
  members = [],
  onRefresh,
  showToast,
  onRequestPin
}) {
  const summary = settlementSummary || {};
  const pendingRecommendations = summary.pendingRecommendations || [];
  const completedSettlements = summary.completedSettlements || [];
  const memberSummary = summary.memberSummary || [];

  const [settlingTransfer, setSettlingTransfer] = useState(null);
  const [viewingTransferDetails, setViewingTransferDetails] = useState(null);
  const [showOffsetBills, setShowOffsetBills] = useState(false);
  const [paymentDate, setPaymentDate] = useState(getCurrentDateISO());
  const [referenceNote, setReferenceNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);

  // Handle Mark as Paid
  const handleOpenSettleModal = (transfer) => {
    setSettlingTransfer(transfer);
    setPaymentDate(getCurrentDateISO());
    setReferenceNote(transfer.receiver_upi_id ? `UPI to ${transfer.receiver_upi_id}` : 'Settled via UPI / Cash');
  };

  const handleConfirmSettle = async (e) => {
    e.preventDefault();
    if (!settlingTransfer) return;

    onRequestPin({
      title: 'Authorize Settlement Transfer',
      message: `Please enter member PIN / password to record payment of ₹${settlingTransfer.amount} from ${settlingTransfer.payer_name} to ${settlingTransfer.receiver_name}.`,
      onConfirm: async ({ memberId, pin }) => {
        setIsSubmitting(true);
        try {
          await api.completeSettlement({
            month: selectedMonth,
            payer_member_id: settlingTransfer.payer_id,
            receiver_member_id: settlingTransfer.receiver_id,
            amount: settlingTransfer.amount,
            payment_date: paymentDate,
            reference_note: referenceNote,
            authorizing_member_id: memberId,
            pin
          });

          showToast({
            type: 'success',
            message: `Marked ₹${settlingTransfer.amount} transfer from ${settlingTransfer.payer_name} to ${settlingTransfer.receiver_name} as paid!`
          });
          setSettlingTransfer(null);
          setViewingTransferDetails(null);
          onRefresh();
        } catch (err) {
          showToast({ type: 'error', message: err.message || 'Failed to complete settlement' });
        } finally {
          setIsSubmitting(false);
        }
      }
    });
  };

  // Handle Reverse Settlement
  const handleReverse = (settlementId) => {
    onRequestPin({
      title: 'Reverse Settlement',
      message: 'Reversing this transfer will restore the outstanding balance. Please enter PIN to confirm.',
      onConfirm: async ({ memberId, pin }) => {
        try {
          await api.reverseSettlement(settlementId, {
            month: selectedMonth,
            authorizing_member_id: memberId,
            pin
          });
          showToast({ type: 'success', message: 'Settlement transfer reversed successfully!' });
          onRefresh();
        } catch (err) {
          showToast({ type: 'error', message: err.message || 'Failed to reverse settlement' });
        }
      }
    });
  };

  const handleCopyUpi = (upi) => {
    if (!upi) return;
    navigator.clipboard.writeText(upi);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
    showToast({ type: 'success', message: 'UPI ID copied to clipboard!' });
  };

  return (
    <div className="space-y-6">
      {/* Top Engine Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-800">Monthly Settlement Engine</h2>
            <span
              className={`px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                summary.isMonthSettled
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}
            >
              {summary.settlementStatus}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Minimum Cash Flow debt simplification algorithm for {getMonthName(selectedMonth)}.
          </p>
        </div>

        <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-xl border border-slate-200/60 text-xs">
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Unsettled Balance</span>
            <span className="font-bold text-slate-800 text-sm">
              {formatCurrency(summary.totalOutstandingToSettle || 0)}
            </span>
          </div>
          <div className="border-l border-slate-200 pl-4">
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Pending Transfers</span>
            <span className="font-bold text-slate-800 text-sm">
              {pendingRecommendations.length}
            </span>
          </div>
        </div>
      </div>

      {/* Accounting Principle Info Callout */}
      <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 flex items-start gap-3">
        <HelpCircle className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-indigo-950 space-y-1">
          <p className="font-bold text-indigo-900">How the Settlement Engine Works:</p>
          <p className="text-indigo-800/80 leading-relaxed">
            1. Calculates each member's net expense position: <strong>Paid Amount − Actual Beneficiary Share</strong>.
            <br />
            2. The <strong>Minimum Cash Flow Algorithm</strong> finds the fewest direct transfers between debtors and creditors to completely zero out all debts.
            <br />
            3. Click <strong>"View Details & History"</strong> on any transfer to inspect the itemized bills and payment destination!
          </p>
        </div>
      </div>

      {/* Recommended Transfers (Pending) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-base">Recommended Settlement Transfers</h3>
              <p className="text-xs text-slate-500">
                Transfers required to bring everyone's balance to exactly ₹0.00
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            {pendingRecommendations.length} pending
          </span>
        </div>

        {pendingRecommendations.length === 0 ? (
          <div className="p-10 text-center">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-2">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-slate-800 text-sm">All Balances Settled!</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              There are no pending transfers required for this month. All member balances are balanced.
            </p>
          </div>
        ) : (
          <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingRecommendations.map((t, idx) => (
              <div
                key={idx}
                className="p-4 bg-gradient-to-br from-white to-slate-50/60 rounded-2xl border border-slate-200 shadow-xs hover:border-indigo-300 transition flex flex-col justify-between gap-4"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                    Recommended Transfer #{idx + 1}
                  </span>
                  <span className="text-lg font-bold text-slate-900">
                    {formatCurrency(t.amount)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 p-3 bg-white rounded-xl border border-slate-100 shadow-2xs">
                  <div className="text-left">
                    <span className="text-[10px] font-medium text-slate-400 block">Payer (Owes)</span>
                    <span className="font-bold text-xs sm:text-sm text-rose-700">{t.payer_name}</span>
                  </div>

                  <div className="flex flex-col items-center px-2">
                    <span className="text-[10px] font-bold text-indigo-600">PAYS</span>
                    <ArrowRight className="w-5 h-5 text-indigo-500 animate-pulse" />
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] font-medium text-slate-400 block">Receiver (Owed)</span>
                    <span className="font-bold text-xs sm:text-sm text-emerald-700">{t.receiver_name}</span>
                  </div>
                </div>

                {/* Where to pay indicator */}
                <div className="text-[11px] bg-slate-50 p-2 rounded-lg border border-slate-100 flex items-center justify-between">
                  <span className="text-slate-500">Destination:</span>
                  <span className="font-semibold text-slate-700">
                    {t.receiver_upi_id ? `UPI: ${t.receiver_upi_id}` : `Direct to ${t.receiver_name}`}
                  </span>
                </div>

                {/* Action Buttons: View Details & Mark as Paid */}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setViewingTransferDetails(t);
                      setShowOffsetBills(false);
                    }}
                    className="flex-1 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition flex items-center justify-center gap-1.5"
                  >
                    <History className="w-3.5 h-3.5 text-slate-500" />
                    <span>View Details & History</span>
                  </button>

                  <button
                    onClick={() => handleOpenSettleModal(t)}
                    className="flex-1 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Mark as Paid</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Completed Transfers Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-base">Completed Settlement Transfers</h3>
              <p className="text-xs text-slate-500">
                Verified payment transfers recorded for {getMonthName(selectedMonth)}
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            {completedSettlements.length} completed
          </span>
        </div>

        {completedSettlements.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No transfers have been completed for this month yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50/75 text-slate-500 uppercase text-[11px] font-semibold border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4 sm:px-6">Payment Date</th>
                  <th className="py-3 px-4">Payer</th>
                  <th className="py-3 px-4">Receiver</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4">Reference / Note</th>
                  <th className="py-3 px-4 sm:px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {completedSettlements.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/50 transition">
                    <td className="py-3.5 px-4 sm:px-6 font-medium text-slate-600 whitespace-nowrap">
                      {formatDateIN(s.payment_date || s.created_at)}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-800">
                      {s.payer_name}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-emerald-700">
                      {s.receiver_name}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                      {formatCurrency(s.amount)}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-500">
                      {s.reference_note || '—'}
                    </td>
                    <td className="py-3.5 px-4 sm:px-6 text-right">
                      <button
                        onClick={() => handleReverse(s.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition"
                        title="Reverse this settlement"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Reverse</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* HOW THIS TRANSFER IS CALCULATED MODAL */}
      {viewingTransferDetails && (() => {
        const t = viewingTransferDetails;
        const breakdown = t.breakdown || {
          summaryExplanation:
            "This amount is calculated from the difference between the amount you paid and your share of the expenses, after accounting for the other participants' balances.",
          contributingBills: (t.sharedExpenses || []).map((e) => ({
            id: e.id,
            date: e.date,
            title: e.title,
            category: e.category,
            total_bill: e.total_bill,
            paid_by_name: t.receiver_name,
            payer_share: e.allocated_share,
            explanation: `${t.payer_name} owes this share because ${t.receiver_name} paid the bill.`
          })),
          contributingBillsTotal: t.amount,
          stepCalculation: {
            payerTotalPaid: t.payer_total_paid || 0,
            payerActualShare: t.payer_actual_share || 0,
            payerNetBalance: -(t.payer_net_debt || t.amount),
            payerStatusText: `${t.payer_name} owes an overall net balance of ${formatCurrency(t.payer_net_debt || t.amount)} across all expenses.`,
            initialAmountOwed: t.payer_net_debt || t.amount,
            initialAmountOwedLabel: 'Initial amount owed',
            directOffsetBills: [],
            directOffsetAmount: 0,
            directNetDebt: t.amount,
            thirdPartyAdjustments: [],
            totalAdjustmentsAmount: 0,
            finalRecommendedTransfer: t.amount
          }
        };

        const stepCalc = breakdown.stepCalculation || {};
        const contributingBills = breakdown.contributingBills || [];
        const isBillsTotalDifferent = Math.abs((breakdown.contributingBillsTotal || 0) - t.amount) > 0.01;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in no-print">
            <div className="bg-white rounded-2xl sm:rounded-3xl max-w-3xl w-full shadow-2xl border border-slate-200/80 max-h-[92vh] flex flex-col overflow-hidden">
              {/* Header */}
              <div className="p-4 sm:p-5 border-b border-slate-100 flex items-start justify-between gap-4 bg-slate-50/50">
                <div>
                  <h3 className="font-bold text-slate-800 text-lg sm:text-xl">
                    How This Transfer Is Calculated
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    A transparent breakdown of the amount you need to pay.
                  </p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
                      Payer: {t.payer_name}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                      Receiver: {t.receiver_name}
                    </span>
                    <span className="text-xs font-black text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200 ml-1">
                      Transfer: {formatCurrency(t.amount)}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setViewingTransferDetails(null)}
                  className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-xl transition"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Modal Content */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                {/* SECTION A — Transfer Summary */}
                <div className="p-4 sm:p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Section A — Transfer Summary
                    </span>
                    <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-lg border border-indigo-100">
                      Settlement Recommendation
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/60">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                        Payer
                      </span>
                      <span className="font-bold text-slate-800 text-sm sm:text-base">
                        {t.payer_name}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/60">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                        Receiver
                      </span>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800 text-sm sm:text-base">
                          {t.receiver_name}
                        </span>
                        {t.receiver_upi_id && (
                          <button
                            onClick={() => handleCopyUpi(t.receiver_upi_id)}
                            className="inline-flex items-center gap-1 text-[11px] font-mono font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-200 transition"
                            title="Copy UPI ID"
                          >
                            <span>{t.receiver_upi_id}</span>
                            {copiedUpi ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 block mb-1">
                        Amount to Transfer
                      </span>
                      <span className="font-black text-indigo-700 text-lg sm:text-xl">
                        {formatCurrency(t.amount)}
                      </span>
                    </div>
                  </div>

                  {/* Short Explanation Box */}
                  <div className="p-3 bg-indigo-50/40 border border-indigo-100 rounded-xl flex items-start gap-2.5">
                    <Info className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-indigo-950 leading-relaxed">
                      {breakdown.summaryExplanation ||
                        "This amount is calculated from the difference between the amount you paid and your share of the expenses, after accounting for the other participants' balances."}
                    </p>
                  </div>
                </div>

                {/* SECTION B — Bill-wise Breakdown */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                  <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <Receipt className="w-4 h-4 text-indigo-600" />
                        <h4 className="font-bold text-slate-800 text-sm sm:text-base">
                          Section B — Bill-wise Breakdown
                        </h4>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Relevant expenses that contribute to this transfer calculation.
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-slate-500">
                      {contributingBills.length} contributing {contributingBills.length === 1 ? 'bill' : 'bills'}
                    </span>
                  </div>

                  {contributingBills.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400">
                      No specific shared bills found for this transfer.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50/80 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-100 tracking-wider">
                          <tr>
                            <th className="py-2.5 px-3 sm:px-4">Date</th>
                            <th className="py-2.5 px-3">Expense Description</th>
                            <th className="py-2.5 px-3 text-right">Total Bill Amount</th>
                            <th className="py-2.5 px-3">Paid By</th>
                            <th className="py-2.5 px-3 text-right">{t.payer_name}'s Share</th>
                            <th className="py-2.5 px-3 sm:px-4">Explanation</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {contributingBills.map((b, idx) => (
                            <tr key={b.id || idx} className="hover:bg-slate-50/60 transition">
                              <td className="py-2.5 px-3 sm:px-4 text-slate-500 whitespace-nowrap font-medium">
                                {formatDateIN(b.date)}
                              </td>
                              <td className="py-2.5 px-3 font-semibold text-slate-800">
                                <div>{b.title}</div>
                                {b.category && (
                                  <span className="text-[10px] font-normal text-slate-400 block">
                                    {b.category}
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right text-slate-600 whitespace-nowrap">
                                {formatCurrency(b.total_bill)}
                              </td>
                              <td className="py-2.5 px-3 font-medium whitespace-nowrap">
                                <span
                                  className={
                                    b.paid_by_name === t.receiver_name
                                      ? 'text-emerald-700 font-semibold'
                                      : 'text-indigo-600 font-semibold'
                                  }
                                >
                                  {b.paid_by_name}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold text-rose-600 whitespace-nowrap">
                                {formatCurrency(b.payer_share)}
                              </td>
                              <td className="py-2.5 px-3 sm:px-4 text-slate-600 text-[11px] leading-tight min-w-[180px]">
                                {b.explanation}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-slate-50/90 font-bold border-t border-slate-200">
                          <tr>
                            <td colSpan="4" className="py-2.5 px-3 sm:px-4 text-slate-700 uppercase text-[10px]">
                              Total Contributing Expense Shares:
                            </td>
                            <td className="py-2.5 px-3 text-right text-rose-700 font-black">
                              {formatCurrency(breakdown.contributingBillsTotal)}
                            </td>
                            <td className="py-2.5 px-3 sm:px-4 text-xs font-semibold text-slate-500">
                              {isBillsTotalDifferent ? (
                                <span className="text-amber-700 font-medium text-[11px]">
                                  Adjusted to {formatCurrency(t.amount)} via Section C below
                                </span>
                              ) : (
                                <span className="text-emerald-700 font-medium text-[11px]">
                                  Matches transfer amount exactly
                                </span>
                              )}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}

                  {isBillsTotalDifferent && (
                    <div className="p-3 bg-amber-50/70 border-t border-amber-100 text-xs text-amber-900 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <p>
                        <strong>Distinction Note:</strong> The total of contributing bills above is{' '}
                        <strong>{formatCurrency(breakdown.contributingBillsTotal)}</strong>. The final transfer amount is{' '}
                        <strong>{formatCurrency(t.amount)}</strong> because {t.payer_name} also paid for shared expenses
                        and third-party balances were consolidated in the settlement. See the full calculation in Section C below.
                      </p>
                    </div>
                  )}
                </div>

                {/* SECTION C — How the Final Amount Is Calculated */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-4 sm:p-5 space-y-5">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <Scale className="w-4 h-4 text-indigo-600" />
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm sm:text-base">
                          Section C — How the Final Amount Is Calculated
                        </h4>
                        <p className="text-xs text-slate-500">
                          Step-by-step settlement calculation using actual application data.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Step 1: Individual Balance Breakdown */}
                  <div className="space-y-2">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Step 1: {t.payer_name}'s Overall Balance Position
                    </h5>
                    <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/70 space-y-2 text-xs">
                      <div className="flex justify-between items-center py-1 border-b border-slate-200/50">
                        <span className="text-slate-600">
                          1. Total amount paid by {t.payer_name}:
                        </span>
                        <span className="font-bold text-slate-800">
                          {formatCurrency(stepCalc.payerTotalPaid || 0)}
                        </span>
                      </div>

                      <div className="flex justify-between items-center py-1 border-b border-slate-200/50">
                        <span className="text-slate-600">
                          2. Total personal share of expenses:
                        </span>
                        <span className="font-bold text-rose-700">
                          {formatCurrency(stepCalc.payerActualShare || 0)}
                        </span>
                      </div>

                      <div className="flex justify-between items-center py-1 border-b border-slate-200/50">
                        <span className="text-slate-700 font-semibold">
                          3. Net balance = Amount Paid − Personal Share:
                        </span>
                        <span
                          className={`font-mono font-bold ${
                            stepCalc.payerNetBalance < 0 ? 'text-rose-700' : 'text-emerald-700'
                          }`}
                        >
                          {formatCurrency(stepCalc.payerTotalPaid || 0)} − {formatCurrency(stepCalc.payerActualShare || 0)} = {formatCurrency(stepCalc.payerNetBalance || 0)}
                        </span>
                      </div>

                      <div className="flex justify-between items-center pt-1">
                        <span className="text-slate-600">
                          4. Balance status:
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            stepCalc.payerNetBalance < 0
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {stepCalc.payerStatusText ||
                            (stepCalc.payerNetBalance < 0
                              ? `${t.payer_name} owes ${formatCurrency(Math.abs(stepCalc.payerNetBalance))}`
                              : `${t.payer_name} receives ${formatCurrency(stepCalc.payerNetBalance)}`)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Step 2: Settlement & Third-Party Adjustments Breakdown */}
                  <div className="space-y-2">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Step 2: Settlement Adjustments & Optimized Transfer
                    </h5>

                    <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/70 space-y-2.5 text-xs">
                      {/* Initial Amount Owed */}
                      <div className="flex justify-between items-center py-1 border-b border-slate-200/60 font-semibold text-slate-800">
                        <span>{stepCalc.initialAmountOwedLabel || 'Initial amount owed'}:</span>
                        <span>{formatCurrency(stepCalc.initialAmountOwed || 0)}</span>
                      </div>

                      {/* Offset for bills payer paid for receiver */}
                      {stepCalc.directOffsetAmount > 0 && (
                        <div className="space-y-1.5 py-1 border-b border-slate-200/60">
                          <div className="flex justify-between items-center text-emerald-800 font-medium">
                            <span>
                              Less: Offset for bills paid by {t.payer_name} shared by {t.receiver_name}:
                            </span>
                            <span className="font-bold text-emerald-700">
                              −{formatCurrency(stepCalc.directOffsetAmount)}
                            </span>
                          </div>

                          {/* Toggle to inspect offset bills */}
                          {stepCalc.directOffsetBills?.length > 0 && (
                            <div>
                              <button
                                onClick={() => setShowOffsetBills((prev) => !prev)}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 transition"
                              >
                                {showOffsetBills ? (
                                  <>
                                    <ChevronUp className="w-3.5 h-3.5" />
                                    <span>Hide {stepCalc.directOffsetBills.length} offsetting bills paid by {t.payer_name}</span>
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown className="w-3.5 h-3.5" />
                                    <span>View {stepCalc.directOffsetBills.length} offsetting bills paid by {t.payer_name} (−{formatCurrency(stepCalc.directOffsetAmount)})</span>
                                  </>
                                )}
                              </button>

                              {showOffsetBills && (
                                <div className="mt-2 border border-slate-200 rounded-lg overflow-hidden bg-white">
                                  <table className="w-full text-left text-[11px]">
                                    <thead className="bg-slate-100/70 text-slate-500 uppercase text-[9px] font-bold">
                                      <tr>
                                        <th className="py-1.5 px-2.5">Date</th>
                                        <th className="py-1.5 px-2">Expense</th>
                                        <th className="py-1.5 px-2 text-right">Total Bill</th>
                                        <th className="py-1.5 px-2.5 text-right">{t.receiver_name}'s Share</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {stepCalc.directOffsetBills.map((ob, idx) => (
                                        <tr key={ob.id || idx}>
                                          <td className="py-1.5 px-2.5 text-slate-500">{formatDateIN(ob.date)}</td>
                                          <td className="py-1.5 px-2 font-medium text-slate-800">{ob.title}</td>
                                          <td className="py-1.5 px-2 text-right text-slate-600">{formatCurrency(ob.total_bill)}</td>
                                          <td className="py-1.5 px-2.5 text-right font-bold text-emerald-700">
                                            {formatCurrency(ob.receiver_share)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          )}

                          <div className="flex justify-between items-center text-slate-600 text-[11px] pt-0.5">
                            <span>Direct pairwise net balance ({t.payer_name} ↔ {t.receiver_name}):</span>
                            <span className="font-semibold text-slate-800">
                              {formatCurrency(stepCalc.directNetDebt || 0)}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Third Party Adjustments */}
                      {stepCalc.thirdPartyAdjustments?.map((adj, idx) => (
                        <div
                          key={adj.member_id || idx}
                          className="p-2.5 bg-white rounded-lg border border-slate-200/80 space-y-1"
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-semibold text-slate-800">
                              {adj.type === 'less' ? 'Less: ' : 'Add: '}
                              {adj.label}
                            </span>
                            <span
                              className={`font-bold ${
                                adj.type === 'less' ? 'text-emerald-700' : 'text-rose-700'
                              }`}
                            >
                              {adj.type === 'less' ? '−' : '+'}
                              {formatCurrency(adj.amount)}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 leading-normal">
                            {adj.description}
                          </p>
                        </div>
                      ))}

                      {/* Final Transfer Summary Box */}
                      <div className="p-4 bg-gradient-to-r from-indigo-50 via-purple-50 to-indigo-50/60 rounded-xl border border-indigo-200 mt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 block">
                            Final Recommended Transfer
                          </span>
                          <span className="font-bold text-slate-900 text-sm">
                            {t.payer_name} transfers to {t.receiver_name}
                          </span>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Fully settles {t.payer_name}'s balance and accounts for all participants' shares.
                          </p>
                        </div>

                        <div className="text-right">
                          <span className="text-2xl font-black text-indigo-700">
                            {formatCurrency(t.amount)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="p-4 sm:p-5 border-t border-slate-100 flex items-center justify-between gap-3 bg-slate-50/50">
                <button
                  onClick={() => setViewingTransferDetails(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition"
                >
                  Close
                </button>

                <button
                  onClick={() => {
                    handleOpenSettleModal(viewingTransferDetails);
                  }}
                  className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Proceed to Mark as Paid</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Mark Transfer as Paid Modal */}
      {settlingTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in no-print">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                  <CreditCard className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-slate-800">Confirm Payment Transfer</h3>
              </div>
              <button
                onClick={() => setSettlingTransfer(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmSettle} className="mt-4 space-y-4">
              <div className="p-3.5 bg-indigo-50/60 rounded-xl border border-indigo-100 text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Payer:</span>
                  <span className="font-bold text-slate-800">{settlingTransfer.payer_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Receiver:</span>
                  <span className="font-bold text-slate-800">
                    {settlingTransfer.receiver_name} {settlingTransfer.receiver_upi_id ? `(${settlingTransfer.receiver_upi_id})` : ''}
                  </span>
                </div>
                <div className="flex justify-between text-sm pt-1 border-t border-indigo-100">
                  <span className="font-bold text-slate-700">Amount:</span>
                  <span className="font-bold text-indigo-700">
                    {formatCurrency(settlingTransfer.amount)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Payment Date (DD-MM-YYYY)
                </label>
                <input
                  type="date"
                  required
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reference Note / UPI ID / Payment Mode
                </label>
                <input
                  type="text"
                  value={referenceNote}
                  onChange={(e) => setReferenceNote(e.target.value)}
                  placeholder="e.g. UPI Ref 382910, GPay, Cash"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSettlingTransfer(null)}
                  className="flex-1 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Recording...' : 'Mark as Paid'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
