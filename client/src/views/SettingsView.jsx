import React, { useState } from 'react';
import {
  Users,
  Lock,
  Wifi,
  Database,
  Download,
  Upload,
  Copy,
  Check,
  ShieldAlert,
  Terminal,
  ExternalLink,
  Edit2,
  KeyRound
} from 'lucide-react';
import { api } from '../services/api';

export function SettingsView({
  members = [],
  systemInfo,
  onRefreshMembers,
  showToast,
  onRequestPin
}) {
  const [copiedIp, setCopiedIp] = useState('');
  const [copiedCmd, setCopiedCmd] = useState(false);

  // Edit Member Name state
  const [editingMember, setEditingMember] = useState(null);
  const [newName, setNewName] = useState('');

  // Change PIN state
  const [pinMember, setPinMember] = useState(null);
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');

  // Copy helper
  const handleCopy = (text, label) => {
    navigator.clipboard.writeText(text);
    if (label === 'cmd') {
      setCopiedCmd(true);
      setTimeout(() => setCopiedCmd(false), 2000);
    } else {
      setCopiedIp(label);
      setTimeout(() => setCopiedIp(''), 2000);
    }
    showToast({ type: 'success', message: 'Copied to clipboard!' });
  };

  // Save Member Name
  const handleSaveMemberName = async (e) => {
    e.preventDefault();
    if (!editingMember || !newName.trim()) return;

    onRequestPin({
      title: 'Authorize Name Change',
      message: `Enter PIN to authorize renaming ${editingMember.name} to "${newName.trim()}"`,
      onConfirm: async ({ pin }) => {
        try {
          await api.updateMember(editingMember.id, { name: newName.trim(), pin });
          showToast({ type: 'success', message: 'Member name updated successfully!' });
          setEditingMember(null);
          onRefreshMembers();
        } catch (err) {
          showToast({ type: 'error', message: err.message || 'Failed to update member name' });
        }
      }
    });
  };

  // Change PIN
  const handleChangePin = async (e) => {
    e.preventDefault();
    if (!pinMember) return;
    if (newPin.length < 4) {
      showToast({ type: 'error', message: 'PIN must be at least 4 digits' });
      return;
    }

    try {
      await api.updateMemberPin(pinMember.id, { oldPin, newPin });
      showToast({ type: 'success', message: `PIN updated for ${pinMember.name}!` });
      setPinMember(null);
      setOldPin('');
      setNewPin('');
    } catch (err) {
      showToast({ type: 'error', message: err.message || 'Failed to update PIN' });
    }
  };

  // Database Backup Download
  const handleDownloadBackup = () => {
    window.location.href = api.exportBackupUrl;
  };

  // Database Restore File Upload
  const handleRestoreFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const backupJson = JSON.parse(reader.result);
        onRequestPin({
          title: 'Authorize Database Restore',
          message: 'Restoring will replace existing data with the backup file. Please authorize with member PIN.',
          onConfirm: async ({ memberId, pin }) => {
            try {
              const res = await api.restoreBackup({
                backupData: backupJson,
                authorizing_member_id: memberId,
                pin
              });
              showToast({
                type: 'success',
                message: `Database restored! (${res.restoredRecords?.expenses || 0} expenses loaded)`
              });
              onRefreshMembers();
            } catch (err) {
              showToast({ type: 'error', message: err.message || 'Restore failed' });
            }
          }
        });
      } catch (err) {
        showToast({ type: 'error', message: 'Invalid backup file format' });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Title */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <h2 className="text-xl font-bold text-slate-800">Settings & Local Network Configuration</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Manage member profiles, PIN security, LAN access on port 3002, and backup/restore.
        </p>
      </div>

      {/* Section 1: Member Settings */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm sm:text-base">Member Profiles & PIN Management</h3>
              <p className="text-xs text-slate-500">Edit member names and security PINs</p>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {members.map((m) => (
            <div
              key={m.id}
              className="p-4 bg-slate-50/70 rounded-xl border border-slate-200/80 flex items-center justify-between"
            >
              <div>
                <div className="flex items-center gap-2">
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
                <span className="text-[11px] text-slate-400 mt-1 block">PIN: •••• (Authorized)</span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    setEditingMember(m);
                    setNewName(m.name);
                  }}
                  className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-lg transition border border-transparent hover:border-slate-200"
                  title="Edit Name"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setPinMember(m);
                    setOldPin('');
                    setNewPin('');
                  }}
                  className="p-2 text-slate-500 hover:text-amber-600 hover:bg-white rounded-lg transition border border-transparent hover:border-slate-200"
                  title="Change PIN"
                >
                  <KeyRound className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 2: Local Network (LAN) & Windows Firewall Guide */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <Wifi className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm sm:text-base">Local Network (LAN) Access</h3>
              <p className="text-xs text-slate-500">
                Access the website on your phone, tablet, or another computer on the same Wi-Fi
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold rounded-full">
            Port {systemInfo?.port || 3002}
          </span>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          <div>
            <h4 className="text-xs font-bold text-slate-700 mb-2">Available LAN Access URLs:</h4>
            <div className="space-y-2">
              {systemInfo?.lanAddresses?.length === 0 ? (
                <div className="text-xs text-slate-400 p-3 bg-slate-50 rounded-xl">
                  No Wi-Fi/Ethernet IP found. Accessible locally via <code>http://localhost:{systemInfo?.port || 3002}</code>.
                </div>
              ) : (
                systemInfo?.lanAddresses?.map((lan, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 bg-emerald-50/50 rounded-xl border border-emerald-100"
                  >
                    <div>
                      <span className="font-bold text-slate-800 text-xs sm:text-sm font-mono block">
                        {lan.url}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Network Interface: {lan.interface} ({lan.ip})
                      </span>
                    </div>

                    <button
                      onClick={() => handleCopy(lan.url, lan.ip)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-emerald-100/60 text-emerald-700 text-xs font-bold rounded-lg border border-emerald-200 transition"
                    >
                      {copiedIp === lan.ip ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedIp === lan.ip ? 'Copied' : 'Copy URL'}</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Windows Firewall Instruction */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
              <Terminal className="w-4 h-4 text-indigo-600" />
              <span>Windows Firewall Inbound Rule (If other devices cannot connect)</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              If devices on the same Wi-Fi cannot open the URL, run this command in <strong>PowerShell as Administrator</strong> on this PC to permit port 3002:
            </p>
            <div className="flex items-center justify-between gap-2 p-2.5 bg-slate-900 text-emerald-400 font-mono text-[11px] rounded-lg overflow-x-auto">
              <span>{systemInfo?.firewallCommand}</span>
              <button
                onClick={() => handleCopy(systemInfo?.firewallCommand, 'cmd')}
                className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition flex-shrink-0"
                title="Copy Command"
              >
                {copiedCmd ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Section 3: Database & Cloud / Vercel Readiness */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-violet-50 text-violet-600 rounded-lg">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm sm:text-base">Database & Vercel Readiness</h3>
              <p className="text-xs text-slate-500">Local SQLite & Neon DB PostgreSQL backend</p>
            </div>
          </div>
          <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100">
            {systemInfo?.database?.type || 'Local SQLite'}
          </span>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <span className="text-slate-400 block font-medium">Storage Location</span>
              <span className="font-bold text-slate-800">{systemInfo?.database?.storageLocation}</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <span className="text-slate-400 block font-medium">Neon DB Configured</span>
              <span className="font-bold text-slate-800">
                {systemInfo?.database?.databaseUrlConfigured ? 'Yes (Connected)' : 'No (Using Local SQLite)'}
              </span>
            </div>
          </div>

          <div className="p-3.5 bg-violet-50/50 rounded-xl border border-violet-100 text-xs space-y-1">
            <span className="font-bold text-violet-900 block">Vercel Deployment Instructions:</span>
            <p className="text-violet-800/80 leading-relaxed">
              1. Push this repository to GitHub.<br />
              2. Import the repo in Vercel. <code>vercel.json</code> and <code>api/index.js</code> are already configured.<br />
              3. In Vercel Project Settings &gt; Environment Variables, set:
              <br />
              <code className="bg-white px-2 py-0.5 rounded border border-violet-200 font-mono text-[11px] text-violet-950 inline-block mt-1">
                DATABASE_URL=postgresql://neondb_owner:password@ep-xyz.neon.tech/neondb?sslmode=require
              </code>
            </p>
          </div>
        </div>
      </div>

      {/* Section 4: Backup & Restore */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm sm:text-base">Database Backup & Disaster Recovery</h3>
              <p className="text-xs text-slate-500">Download complete financial records or restore from JSON snapshot</p>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-3">
            <div>
              <h4 className="font-bold text-slate-800 text-xs">Download Backup Snapshot</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Export all expenses, member allocations, receipts, and settlement history.
              </p>
            </div>
            <button
              onClick={handleDownloadBackup}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs"
            >
              <Download className="w-4 h-4" />
              <span>Download Backup (.json)</span>
            </button>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-3">
            <div>
              <h4 className="font-bold text-slate-800 text-xs">Restore from Backup</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Upload a valid JSON backup. Replaces current database with snapshot (PIN required).
              </p>
            </div>
            <label className="inline-flex items-center gap-2 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer">
              <Upload className="w-4 h-4" />
              <span>Upload Backup File</span>
              <input
                type="file"
                accept=".json"
                onChange={handleRestoreFile}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Edit Member Name Modal */}
      {editingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in no-print">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100">
            <h3 className="font-bold text-slate-800 text-base mb-1">Rename Member</h3>
            <p className="text-xs text-slate-500 mb-4">
              Updating name for {editingMember.name} ({editingMember.role})
            </p>

            <form onSubmit={handleSaveMemberName} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">New Name</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-bold"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  className="flex-1 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition"
                >
                  Save Name
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change PIN Modal */}
      {pinMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in no-print">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100">
            <h3 className="font-bold text-slate-800 text-base mb-1">Change Security PIN</h3>
            <p className="text-xs text-slate-500 mb-4">
              Updating PIN for {pinMember.name}
            </p>

            <form onSubmit={handleChangePin} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Current PIN</label>
                <input
                  type="password"
                  value={oldPin}
                  onChange={(e) => setOldPin(e.target.value)}
                  placeholder="•••• (Default 1234)"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-center tracking-widest font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">New 4-Digit PIN</label>
                <input
                  type="password"
                  maxLength={8}
                  required
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  placeholder="••••"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-center tracking-widest font-bold"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPinMember(null)}
                  className="flex-1 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition"
                >
                  Update PIN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
