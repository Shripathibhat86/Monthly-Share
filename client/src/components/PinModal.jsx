import React, { useState } from 'react';
import { Lock, X, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { api } from '../services/api';

export function PinModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Authorization Required',
  message = 'Please enter member PIN to proceed.',
  members = []
}) {
  const [selectedMemberId, setSelectedMemberId] = useState(members[0]?.id || 1);
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!pin || pin.length < 4) {
      setError('Please enter the 4-digit PIN (1234)');
      return;
    }

    setIsVerifying(true);
    setError('');

    try {
      await api.verifyPin(selectedMemberId, pin);
      onConfirm({ memberId: selectedMemberId, pin });
      setPin('');
      setError('');
    } catch (err) {
      setError(err.message || 'Incorrect PIN entered. Default PIN is 1234.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in no-print">
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-slate-800">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-slate-500 mt-3">{message}</p>

        {error && (
          <div className="flex items-center gap-2 mt-3 p-3 text-xs font-medium text-rose-700 bg-rose-50 rounded-xl border border-rose-100">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Authorizing Member</label>
            <select
              value={selectedMemberId}
              onChange={(e) => setSelectedMemberId(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.role})
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-slate-600">4-Digit Security PIN</label>
              <button
                type="button"
                onClick={() => setPin('1234')}
                className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800"
              >
                Auto-fill 1234
              </button>
            </div>
            <div className="relative">
              <input
                type={showPin ? 'text' : 'password'}
                maxLength={4}
                autoFocus
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="1234"
                className="w-full tracking-widest text-center text-xl font-bold px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                title={showPin ? 'Hide PIN' : 'Show PIN'}
              >
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-400 text-center mt-1 font-medium">
              The default PIN is <span className="font-bold text-slate-700">1234</span>
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isVerifying}
              className="flex-1 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition disabled:opacity-50"
            >
              {isVerifying ? 'Verifying...' : 'Authorize'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
