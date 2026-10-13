import React from 'react';
import {
  LayoutDashboard,
  PlusCircle,
  ReceiptText,
  Scale,
  BarChart3,
  Settings,
  Users,
  Sparkles,
  X
} from 'lucide-react';

export function Sidebar({
  activeTab,
  setActiveTab,
  members = [],
  isOpenMobile,
  onCloseMobile
}) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'add-expense', label: 'Add Expense', icon: PlusCircle, highlight: true },
    { id: 'history', label: 'Expense History', icon: ReceiptText },
    { id: 'settlements', label: 'Settlement Engine', icon: Scale },
    { id: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
    { id: 'settings', label: 'Settings & LAN', icon: Settings },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden no-print"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-40 h-screen w-64 bg-white border-r border-slate-200/80 flex flex-col transition-transform duration-300 ease-in-out no-print ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Top Header inside Sidebar for mobile */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between lg:hidden">
          <span className="font-bold text-slate-800">Menu</span>
          <button
            onClick={onCloseMobile}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation list */}
        <div className="p-4 space-y-1.5 flex-1 overflow-y-auto">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 px-3 py-1">
            Navigation
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  onCloseMobile();
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all text-left ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                    : item.highlight
                    ? 'bg-indigo-50/80 text-indigo-700 hover:bg-indigo-100/80'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : item.highlight ? 'text-indigo-600' : 'text-slate-400'}`} />
                <span>{item.label}</span>
                {item.highlight && !isActive && (
                  <span className="ml-auto text-[10px] font-bold uppercase tracking-wider bg-indigo-200/60 text-indigo-800 px-1.5 py-0.5 rounded-md">
                    New
                  </span>
                )}
              </button>
            );
          })}

          {/* Members section */}
          <div className="pt-6">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 px-3 py-1 flex items-center justify-between">
              <span>Active Members</span>
              <Users className="w-3.5 h-3.5" />
            </div>

            <div className="mt-2 space-y-1 px-1">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between px-2.5 py-2 rounded-xl text-xs bg-slate-50 border border-slate-100"
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${member.role === 'occasional' ? 'bg-amber-400' : 'bg-indigo-500'}`} />
                    <span className="font-semibold text-slate-700">{member.name}</span>
                  </div>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium capitalize ${
                      member.role === 'occasional'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                    }`}
                  >
                    {member.role}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom card: Occasional Member reminder */}
        <div className="p-4 border-t border-slate-100">
          <div className="p-3 bg-gradient-to-br from-indigo-50 to-slate-50 rounded-xl border border-indigo-100/60 text-xs">
            <div className="flex items-center gap-1.5 font-semibold text-indigo-900 mb-1">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>Fair Split Rules</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Expenses are strictly shared among selected participants. User4 is included only when selected.
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
