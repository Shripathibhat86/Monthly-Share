import React, { useState, useEffect } from 'react';
import { Lock, X, AlertCircle, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { api } from '../services/api';

export function PinModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Authorization Required',
  message = 'Please enter member PIN / password to proceed.',
  members = []
}) {
  const [selectedMemberId, setSelectedMemberId] = useState(members[0]?.id || 'any');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setError('');
      if (members.length > 0 && selectedMemberId === 'any') {
        setSelectedMemberId(members[0].id);
      }
    }
  }, [isOpen, members]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanPin = pin.trim();
    if (!cleanPin) {
      setError('Please enter your authorization PIN / password');
      return;
    }

    setIsVerifying(true);
    setError('');

    try {
      const verifyRes = await api.verifyPin(selectedMemberId, cleanPin);
      onConfirm({
        memberId: verifyRes.memberId || selectedMemberId,
        pin: cleanPin,
        memberName: verifyRes.memberName
      });
      setPin('');
      setError('');
    } catch (err) {
      setError(err.message || 'Incorrect PIN / password entered.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in no-print">
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm sm:text-base leading-tight">{title}</h3>
              <p className="text-[11px] text-slate-400">Security Check</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-500 mt-3 leading-relaxed">{message}</p>

        {error && (
          <div className="flex items-center gap-2 mt-3 p-3 text-xs font-semibold text-rose-700 bg-rose-50 rounded-xl border border-rose-100 animate-shake">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Authorizing Member</label>
            <select
              value={selectedMemberId}
              onChange={(e) => setSelectedMemberId(e.target.value === 'any' ? 'any' : Number(e.target.value))}
              className="w-full px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-700"
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.role})
                </option>
              ))}
              <option value="any">Any Member Password</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Security PIN / Password</label>
            <div className="relative">
              <input
                type={showPin ? 'text' : 'password'}
                maxLength={32}
                autoFocus
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Enter PIN / password"
                className="w-full tracking-wider text-center text-lg font-bold px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 placeholder:text-slate-400 placeholder:text-xs placeholder:font-normal placeholder:tracking-normal"
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 p-0.5"
                title={showPin ? 'Hide PIN' : 'Show PIN'}
              >
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] text-slate-400 text-center mt-1.5 flex items-center justify-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-600" />
              <span>Public viewers cannot edit without member password</span>
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition active:scale-95"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isVerifying}
              className="flex-1 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition disabled:opacity-50 active:scale-95"
            >
              {isVerifying ? 'Verifying...' : 'Authorize Action'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
