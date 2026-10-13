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
  Receipt
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
  const [detailsTab, setDetailsTab] = useState('shared'); // 'shared', 'payer_participated', 'payer_paid'
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
                      setDetailsTab('shared');
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

      {/* VIEW DETAILS & EXPENSE HISTORY MODAL */}
      {viewingTransferDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in no-print">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                  Transfer Breakdown & Expense History
                </span>
                <h3 className="font-bold text-slate-800 text-lg">
                  {viewingTransferDetails.payer_name} pays {viewingTransferDetails.receiver_name}
                </h3>
              </div>
              <button
                onClick={() => setViewingTransferDetails(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto py-4 space-y-4">
              {/* Payment Destination Card */}
              <div className="p-4 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-white rounded-2xl border border-emerald-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                      Where to Pay:
                    </span>
                    <h4 className="text-sm font-bold text-slate-800">
                      Pay directly to {viewingTransferDetails.receiver_name}
                    </h4>
                    {viewingTransferDetails.receiver_upi_id ? (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-mono text-xs font-bold text-emerald-900 bg-white px-2 py-0.5 rounded border border-emerald-200">
                          {viewingTransferDetails.receiver_upi_id}
                        </span>
                        <button
                          onClick={() => handleCopyUpi(viewingTransferDetails.receiver_upi_id)}
                          className="p-1 text-emerald-700 hover:bg-emerald-100 rounded transition"
                          title="Copy UPI ID"
                        >
                          {copiedUpi ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 mt-0.5">
                        UPI / Cash / Bank Transfer (UPI ID can be set in Settings)
                      </p>
                    )}
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Transfer Amount</span>
                    <span className="text-xl font-bold text-emerald-700">
                      {formatCurrency(viewingTransferDetails.amount)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Math & Balance Summary Cards */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-rose-50/60 rounded-xl border border-rose-100">
                  <span className="font-bold text-rose-900 block mb-1">
                    {viewingTransferDetails.payer_name} (Payer)
                  </span>
                  <div className="space-y-0.5 text-slate-600">
                    <div>Paid: <strong>{formatCurrency(viewingTransferDetails.payer_total_paid)}</strong></div>
                    <div>Fair Share: <strong>{formatCurrency(viewingTransferDetails.payer_actual_share)}</strong></div>
                    <div className="text-rose-700 font-bold pt-1 border-t border-rose-200">
                      Net Debt: {formatCurrency(viewingTransferDetails.payer_net_debt)}
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100">
                  <span className="font-bold text-emerald-900 block mb-1">
                    {viewingTransferDetails.receiver_name} (Receiver)
                  </span>
                  <div className="space-y-0.5 text-slate-600">
                    <div>Paid: <strong>{formatCurrency(viewingTransferDetails.receiver_total_paid)}</strong></div>
                    <div>Fair Share: <strong>{formatCurrency(viewingTransferDetails.receiver_actual_share)}</strong></div>
                    <div className="text-emerald-700 font-bold pt-1 border-t border-emerald-200">
                      Net Credit: {formatCurrency(viewingTransferDetails.receiver_net_credit)}
                    </div>
                  </div>
                </div>
              </div>

              {/* History Sub-tabs */}
              <div className="border-b border-slate-200 pb-2">
                <div className="flex gap-2">
                  <button
                    onClick={() => setDetailsTab('shared')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                      detailsTab === 'shared'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Shared Bills with {viewingTransferDetails.receiver_name} ({viewingTransferDetails.sharedExpenses?.length || 0})
                  </button>
                  <button
                    onClick={() => setDetailsTab('payer_participated')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                      detailsTab === 'payer_participated'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    All {viewingTransferDetails.payer_name}'s Shared Bills ({viewingTransferDetails.allPayerParticipatedExpenses?.length || 0})
                  </button>
                  <button
                    onClick={() => setDetailsTab('payer_paid')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                      detailsTab === 'payer_paid'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Bills Paid by {viewingTransferDetails.payer_name} ({viewingTransferDetails.allPayerPaidExpenses?.length || 0})
                  </button>
                </div>
              </div>

              {/* Table of Bills for selected tab */}
              {detailsTab === 'shared' && (
                <div className="space-y-2">
                  <p className="text-[11px] text-slate-500">
                    These are all the expenses paid by <strong>{viewingTransferDetails.receiver_name}</strong> that <strong>{viewingTransferDetails.payer_name}</strong> benefited from:
                  </p>
                  {viewingTransferDetails.sharedExpenses?.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl">
                      No direct shared bills. This transfer was assigned by the Minimum Cash Flow algorithm to balance multi-party debts in the fewest transactions.
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-[10px]">
                          <tr>
                            <th className="py-2.5 px-3">Date</th>
                            <th className="py-2.5 px-3">Expense Title</th>
                            <th className="py-2.5 px-3 text-right">Total Bill</th>
                            <th className="py-2.5 px-3 text-right">{viewingTransferDetails.payer_name}'s Share</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {viewingTransferDetails.sharedExpenses.map((exp) => (
                            <tr key={exp.id} className="hover:bg-slate-50/50">
                              <td className="py-2 px-3 text-slate-500 whitespace-nowrap">{formatDateIN(exp.date)}</td>
                              <td className="py-2 px-3 font-semibold text-slate-800">{exp.title}</td>
                              <td className="py-2 px-3 text-right text-slate-600">{formatCurrency(exp.total_bill)}</td>
                              <td className="py-2 px-3 text-right font-bold text-rose-600">{formatCurrency(exp.allocated_share)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {detailsTab === 'payer_participated' && (
                <div className="space-y-2">
                  <p className="text-[11px] text-slate-500">
                    Complete list of all shared expenses <strong>{viewingTransferDetails.payer_name}</strong> participated in this month:
                  </p>
                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-[10px] sticky top-0">
                        <tr>
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">Expense</th>
                          <th className="py-2.5 px-3">Paid By</th>
                          <th className="py-2.5 px-3 text-right">Total</th>
                          <th className="py-2.5 px-3 text-right">My Share</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {viewingTransferDetails.allPayerParticipatedExpenses?.map((exp) => (
                          <tr key={exp.id} className="hover:bg-slate-50/50">
                            <td className="py-2 px-3 text-slate-500 whitespace-nowrap">{formatDateIN(exp.date)}</td>
                            <td className="py-2 px-3 font-medium text-slate-800">{exp.title}</td>
                            <td className="py-2 px-3 text-indigo-600 font-medium">{exp.payer_name}</td>
                            <td className="py-2 px-3 text-right text-slate-600">{formatCurrency(exp.total_bill)}</td>
                            <td className="py-2 px-3 text-right font-bold text-rose-600">{formatCurrency(exp.allocated_share)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {detailsTab === 'payer_paid' && (
                <div className="space-y-2">
                  <p className="text-[11px] text-slate-500">
                    Expenses paid by <strong>{viewingTransferDetails.payer_name}</strong> this month (which lowered their debt):
                  </p>
                  {viewingTransferDetails.allPayerPaidExpenses?.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl">
                      {viewingTransferDetails.payer_name} did not pay for any shared expenses this month.
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-[10px]">
                          <tr>
                            <th className="py-2.5 px-3">Date</th>
                            <th className="py-2.5 px-3">Expense Title</th>
                            <th className="py-2.5 px-3">Category</th>
                            <th className="py-2.5 px-3 text-right">Amount Paid</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {viewingTransferDetails.allPayerPaidExpenses.map((exp) => (
                            <tr key={exp.id} className="hover:bg-slate-50/50">
                              <td className="py-2 px-3 text-slate-500 whitespace-nowrap">{formatDateIN(exp.date)}</td>
                              <td className="py-2 px-3 font-medium text-slate-800">{exp.title}</td>
                              <td className="py-2 px-3 text-slate-500">{exp.category}</td>
                              <td className="py-2 px-3 text-right font-bold text-emerald-600">{formatCurrency(exp.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
              <button
                onClick={() => setViewingTransferDetails(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
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
      )}

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
