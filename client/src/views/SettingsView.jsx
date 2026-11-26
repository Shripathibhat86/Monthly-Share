import React, { useState, useEffect } from 'react';
import {
  Users,
  Wifi,
  Database,
  Download,
  Upload,
  Copy,
  Check,
  ShieldAlert,
  Terminal,
  Edit2,
  KeyRound,
  UserPlus,
  Trash2,
  ShieldCheck,
  User,
  LogOut,
  Lock
} from 'lucide-react';
import { api } from '../services/api';

export function SettingsView({
  members = [],
  systemInfo,
  currentUser,
  onUserUpdated,
  onLogout,
  onRefreshMembers,
  showToast,
  onRequestPin
}) {
  const isAdmin = currentUser?.role === 'admin';

  const [copiedIp, setCopiedIp] = useState('');
  const [copiedCmd, setCopiedCmd] = useState(false);

  // Account Password Change state
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [accountName, setAccountName] = useState(currentUser?.name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isUpdatingAccount, setIsUpdatingAccount] = useState(false);

  // Add Member state
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [addMemberName, setAddMemberName] = useState('');
  const [addMemberRole, setAddMemberRole] = useState('regular');
  const [addMemberUpi, setAddMemberUpi] = useState('');
  const [addMemberPin, setAddMemberPin] = useState('1234');
  const [isAddingMember, setIsAddingMember] = useState(false);

  // Edit Member Name, Role & UPI ID state
  const [editingMember, setEditingMember] = useState(null);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('regular');
  const [newUpi, setNewUpi] = useState('');

  // Change PIN state
  const [pinMember, setPinMember] = useState(null);
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');

  // Admin: Registered Users list
  const [registeredUsers, setRegisteredUsers] = useState([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      loadUsers();
    }
  }, [isAdmin]);

  const loadUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const list = await api.getUsers();
      setRegisteredUsers(list);
    } catch (err) {
      console.error('Failed to load users list:', err);
    } finally {
      setIsLoadingUsers(false);
    }
  };

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

  // Update Account Name / Password
  const handleUpdateAccount = async (e) => {
    e.preventDefault();
    if (!accountName.trim()) {
      showToast({ type: 'error', message: 'Account name cannot be empty' });
      return;
    }
    if (newPassword && newPassword.length < 6) {
      showToast({ type: 'error', message: 'New password must be at least 6 characters' });
      return;
    }
    setIsUpdatingAccount(true);
    try {
      const res = await api.updateMe({
        name: accountName.trim(),
        currentPassword: currentPassword || undefined,
        newPassword: newPassword || undefined
      });
      showToast({ type: 'success', message: res.message || 'Account updated!' });
      if (onUserUpdated && res.user) {
        onUserUpdated(res.user);
      }
      setIsAccountModalOpen(false);
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      showToast({ type: 'error', message: err.message || 'Failed to update account' });
    } finally {
      setIsUpdatingAccount(false);
    }
  };

  // Add Member
  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!addMemberName.trim()) return;
    if (addMemberPin.trim() && addMemberPin.trim().length < 4) {
      showToast({ type: 'error', message: 'Member PIN must be at least 4 characters' });
      return;
    }

    setIsAddingMember(true);
    try {
      await api.createMember({
        name: addMemberName.trim(),
        role: addMemberRole,
        upi_id: addMemberUpi.trim() || null,
        pin: addMemberPin.trim() || '1234'
      });
      showToast({ type: 'success', message: `Member "${addMemberName.trim()}" added!` });
      setIsAddMemberOpen(false);
      setAddMemberName('');
      setAddMemberRole('regular');
      setAddMemberUpi('');
      setAddMemberPin('1234');
      onRefreshMembers();
    } catch (err) {
      showToast({ type: 'error', message: err.message || 'Failed to add member' });
    } finally {
      setIsAddingMember(false);
    }
  };

  // Delete Member
  const handleDeleteMember = async (member) => {
    try {
      await api.deleteMember(member.id);
      showToast({ type: 'success', message: `Member "${member.name}" removed.` });
      onRefreshMembers();
    } catch (err) {
      showToast({ type: 'error', message: err.message || 'Cannot delete member' });
    }
  };

  // Save Member Name, Role and UPI ID
  const handleSaveMemberName = async (e) => {
    e.preventDefault();
    if (!editingMember || !newName.trim()) return;

    onRequestPin({
      title: 'Authorize Profile Update',
      message: `Enter PIN or account password to authorize updating profile for ${editingMember.name}`,
      onConfirm: async ({ pin }) => {
        try {
          await api.updateMember(editingMember.id, {
            name: newName.trim(),
            role: newRole,
            upi_id: newUpi.trim() || null,
            pin
          });
          showToast({ type: 'success', message: 'Member profile updated successfully!' });
          setEditingMember(null);
          onRefreshMembers();
        } catch (err) {
          showToast({ type: 'error', message: err.message || 'Failed to update member' });
        }
      }
    });
  };

  // Change PIN
  const handleChangePin = async (e) => {
    e.preventDefault();
    if (!pinMember) return;
    if (newPin.length < 4) {
      showToast({ type: 'error', message: 'PIN must be at least 4 characters' });
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

  // Admin: Delete normal user account
  const handleDeleteUserAccount = async (targetUser) => {
    if (!window.confirm(`Delete account "${targetUser.name}" (${targetUser.email}) and all of its private expenses? This will NOT affect your Admin data.`)) {
      return;
    }
    try {
      await api.deleteUser(targetUser.id);
      showToast({ type: 'success', message: `Deleted account ${targetUser.email}` });
      loadUsers();
    } catch (err) {
      showToast({ type: 'error', message: err.message || 'Failed to delete user account' });
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
          title: 'Authorize Backup Restore',
          message: 'Restoring will replace your own account data with this backup snapshot. Other accounts are unaffected.',
          onConfirm: async ({ memberId, pin }) => {
            try {
              const res = await api.restoreBackup({
                backupData: backupJson,
                authorizing_member_id: memberId,
                pin
              });
              showToast({
                type: 'success',
                message: `Backup restored! (${res.restoredRecords?.expenses || 0} expenses loaded)`
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
        <h2 className="text-xl font-bold text-slate-800">
          {isAdmin ? 'Settings, Accounts & System Configuration' : 'Account, Members & Backup Settings'}
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          {isAdmin
            ? 'Manage your Admin account, members, user accounts, LAN access, and database backups.'
            : 'Manage your private account, group members, PINs, and personal data backups.'}
        </p>
      </div>

      {/* Section 0: Signed-in Account & Security */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg ${isAdmin ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>
              {isAdmin ? <ShieldCheck className="w-4 h-4" /> : <User className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm sm:text-base">Signed-In Account</h3>
              <p className="text-xs text-slate-500">Your data is strictly isolated to this account</p>
            </div>
          </div>

          <span
            className={`text-[11px] font-bold px-2.5 py-1 rounded-full uppercase ${
              isAdmin ? 'bg-indigo-600 text-white' : 'bg-emerald-100 text-emerald-800'
            }`}
          >
            {isAdmin ? 'Admin Account' : 'Normal Account'}
          </span>
        </div>

        <div className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1 text-xs">
            <div className="text-base font-bold text-slate-800">{currentUser?.name}</div>
            <div className="text-slate-500">
              Email: <span className="font-semibold text-slate-700">{currentUser?.email}</span>
              {currentUser?.username && (
                <> • Username: <span className="font-semibold text-slate-700">{currentUser.username}</span></>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setAccountName(currentUser?.name || '');
                setCurrentPassword('');
                setNewPassword('');
                setIsAccountModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 rounded-xl transition"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Edit / Change Password</span>
            </button>
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/80 rounded-xl transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>

      {/* Section 1: Member Settings */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm sm:text-base">Member Profiles & PIN Management</h3>
              <p className="text-xs text-slate-500">Add roommates/members, edit names or UPI IDs, and manage PINs</p>
            </div>
          </div>

          <button
            onClick={() => {
              setAddMemberName('');
              setAddMemberRole('regular');
              setAddMemberUpi('');
              setAddMemberPin('1234');
              setIsAddMemberOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition flex-shrink-0"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add Member</span>
          </button>
        </div>

        <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {members.map((m) => (
            <div
              key={m.id}
              className="p-4 bg-slate-50/70 rounded-xl border border-slate-200/80 flex items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-800 text-sm truncate">{m.name}</span>
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
                <div className="text-[11px] text-slate-500 mt-1 truncate">
                  {m.upi_id ? (
                    <span className="font-mono text-indigo-600 font-semibold">UPI: {m.upi_id}</span>
                  ) : (
                    <span className="text-slate-400">No UPI set (click edit to add)</span>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5 block">PIN protected (or use account password)</span>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => {
                    setEditingMember(m);
                    setNewName(m.name);
                    setNewRole(m.role || 'regular');
                    setNewUpi(m.upi_id || '');
                  }}
                  className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-lg transition border border-transparent hover:border-slate-200"
                  title="Edit Name, Role & UPI"
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
                {members.length > 1 && (
                  <button
                    onClick={() => handleDeleteMember(m)}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-white rounded-lg transition border border-transparent hover:border-slate-200"
                    title="Delete Member"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 2: Backup & Restore (Scoped to signed-in user) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm sm:text-base">Account Backup & Restore</h3>
              <p className="text-xs text-slate-500">Export or restore only your own account's financial records</p>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-3">
            <div>
              <h4 className="font-bold text-slate-800 text-xs">Download Backup Snapshot</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Export all of your expenses, member allocations, receipts, and settlement history.
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
                Upload a valid JSON backup. Replaces only your account data with the snapshot.
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

      {/* ADMIN-ONLY SECTIONS */}
      {isAdmin && (
        <>
          {/* Admin: Registered Accounts Management */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm sm:text-base">Admin: Registered Accounts</h3>
                  <p className="text-xs text-slate-500">
                    Each normal account is completely isolated and cannot view your Admin data
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold text-slate-500">
                {registeredUsers.length} account{registeredUsers.length === 1 ? '' : 's'}
              </span>
            </div>

            <div className="overflow-x-auto">
              {isLoadingUsers ? (
                <div className="p-6 text-center text-xs text-slate-400">Loading accounts...</div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-100">
                    <tr>
                      <th className="py-3 px-4">User</th>
                      <th className="py-3 px-4">Email / Username</th>
                      <th className="py-3 px-4">Role</th>
                      <th className="py-3 px-4 text-center">Members</th>
                      <th className="py-3 px-4 text-center">Expenses</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {registeredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-4 font-bold text-slate-800">{u.name}</td>
                        <td className="py-3 px-4 text-slate-600">
                          <div>{u.email}</div>
                          {u.username && <div className="text-[10px] text-slate-400">@{u.username}</div>}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                              u.role === 'admin'
                                ? 'bg-indigo-100 text-indigo-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-semibold text-slate-700">{u.member_count}</td>
                        <td className="py-3 px-4 text-center font-semibold text-slate-700">{u.expense_count}</td>
                        <td className="py-3 px-4 text-right">
                          {u.role !== 'admin' ? (
                            <button
                              onClick={() => handleDeleteUserAccount(u)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Delete</span>
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400 font-medium">Primary Admin</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Admin: Local Network (LAN) & Windows Firewall Guide */}
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
                  {!systemInfo?.lanAddresses || systemInfo.lanAddresses.length === 0 ? (
                    <div className="text-xs text-slate-400 p-3 bg-slate-50 rounded-xl">
                      No Wi-Fi/Ethernet IP found. Accessible locally via <code>http://localhost:{systemInfo?.port || 3002}</code>.
                    </div>
                  ) : (
                    systemInfo.lanAddresses.map((lan, idx) => (
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

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <Terminal className="w-4 h-4 text-indigo-600" />
                  <span>Windows Firewall Inbound Rule</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  If devices on the same Wi-Fi cannot open the URL, run this command in <strong>PowerShell as Administrator</strong>:
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

          {/* Admin: Database & Cloud Readiness */}
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
            </div>
          </div>
        </>
      )}

      {/* Account Edit / Change Password Modal */}
      {isAccountModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in no-print">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100">
            <h3 className="font-bold text-slate-800 text-base mb-1">Update Account & Password</h3>
            <p className="text-xs text-slate-500 mb-4">{currentUser?.email}</p>

            <form onSubmit={handleUpdateAccount} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Account Display Name *</label>
                <input
                  type="text"
                  required
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-bold"
                />
              </div>

              <div className="pt-2 border-t border-slate-100">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Current Password (only if changing password)</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Current password"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">New Password (Optional, min 6 chars)</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Leave blank to keep existing password"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAccountModalOpen(false)}
                  className="flex-1 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingAccount}
                  className="flex-1 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition disabled:opacity-50"
                >
                  {isUpdatingAccount ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {isAddMemberOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in no-print">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100">
            <h3 className="font-bold text-slate-800 text-base mb-1">Add Group Member</h3>
            <p className="text-xs text-slate-500 mb-4">
              Add a roommate or participant to your private expense group
            </p>

            <form onSubmit={handleAddMember} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Member Name *</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={addMemberName}
                  onChange={(e) => setAddMemberName(e.target.value)}
                  placeholder="e.g. Rahul"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Participation Role</label>
                <select
                  value={addMemberRole}
                  onChange={(e) => setAddMemberRole(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
                >
                  <option value="regular">Regular (Selected by default)</option>
                  <option value="occasional">Occasional (Selected only when joining)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">UPI ID (Optional)</label>
                <input
                  type="text"
                  value={addMemberUpi}
                  onChange={(e) => setAddMemberUpi(e.target.value)}
                  placeholder="e.g. name@okaxis"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Action PIN (Min 4 chars)</label>
                <input
                  type="password"
                  maxLength={16}
                  value={addMemberPin}
                  onChange={(e) => setAddMemberPin(e.target.value)}
                  placeholder="1234"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-center tracking-widest font-bold"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddMemberOpen(false)}
                  className="flex-1 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAddingMember}
                  className="flex-1 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition disabled:opacity-50"
                >
                  {isAddingMember ? 'Adding...' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Member Name, Role & UPI Modal */}
      {editingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in no-print">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100">
            <h3 className="font-bold text-slate-800 text-base mb-1">Edit Member Profile</h3>
            <p className="text-xs text-slate-500 mb-4">
              Updating details for {editingMember.name} ({editingMember.role})
            </p>

            <form onSubmit={handleSaveMemberName} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Member Name *</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Participation Role</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
                >
                  <option value="regular">Regular</option>
                  <option value="occasional">Occasional</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  UPI ID (Optional, for Receiving Settlements)
                </label>
                <input
                  type="text"
                  value={newUpi}
                  onChange={(e) => setNewUpi(e.target.value)}
                  placeholder="e.g. name@okhdfcbank or 9876543210@paytm"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono"
                />
              </div>

              <div className="flex gap-2 pt-1">
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
                  Save Profile
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">Current PIN (or Account Password)</label>
                <input
                  type="password"
                  value={oldPin}
                  onChange={(e) => setOldPin(e.target.value)}
                  placeholder="••••"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-center tracking-widest font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">New PIN (min 4 chars)</label>
                <input
                  type="password"
                  maxLength={16}
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
