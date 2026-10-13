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
  X
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
  const [paymentDate, setPaymentDate] = useState(getCurrentDateISO());
  const [referenceNote, setReferenceNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reversingId, setReversingId] = useState(null);

  // Handle Mark as Paid
  const handleOpenSettleModal = (transfer) => {
    setSettlingTransfer(transfer);
    setPaymentDate(getCurrentDateISO());
    setReferenceNote('Settled via UPI / Cash');
  };

  const handleConfirmSettle = async (e) => {
    e.preventDefault();
    if (!settlingTransfer) return;

    setIsSubmitting(true);
    try {
      await api.completeSettlement({
        month: selectedMonth,
        payer_member_id: settlingTransfer.payer_id,
        receiver_member_id: settlingTransfer.receiver_id,
        amount: settlingTransfer.amount,
        payment_date: paymentDate,
        reference_note: referenceNote
      });

      showToast({
        type: 'success',
        message: `Marked ₹${settlingTransfer.amount} transfer from ${settlingTransfer.payer_name} to ${settlingTransfer.receiver_name} as paid!`
      });
      setSettlingTransfer(null);
      onRefresh();
    } catch (err) {
      showToast({ type: 'error', message: err.message || 'Failed to complete settlement' });
    } finally {
      setIsSubmitting(false);
    }
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
            3. Marking a transfer as paid records the transaction and offsets outstanding balances <em>without creating a new shared expense</em> or double counting.
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

                <button
                  onClick={() => handleOpenSettleModal(t)}
                  className="w-full py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Mark Transfer as Paid</span>
                </button>
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
                  <span className="font-bold text-slate-800">{settlingTransfer.receiver_name}</span>
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
                  Reference Note / Payment ID
                </label>
                <input
                  type="text"
                  value={referenceNote}
                  onChange={(e) => setReferenceNote(e.target.value)}
                  placeholder="e.g. UPI Ref 382910, Cash, GPay"
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
