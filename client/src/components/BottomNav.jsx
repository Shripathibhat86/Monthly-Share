import React from 'react';
import {
  LayoutDashboard,
  Plus,
  ReceiptText,
  Scale,
  Settings,
  BarChart3
} from 'lucide-react';

export function BottomNav({
  activeTab,
  setActiveTab,
  pendingCount = 0
}) {
  const tabs = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { id: 'history', label: 'History', icon: ReceiptText },
    { id: 'add-expense', label: 'Add', icon: Plus, isAction: true },
    { id: 'settlements', label: 'Settle', icon: Scale, badge: pendingCount },
    { id: 'reports', label: 'Reports', icon: BarChart3 }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-lg border-t border-slate-200/90 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] lg:hidden no-print pb-[env(safe-area-inset-bottom,0px)]">
      <div className="flex items-center justify-around px-2 py-1.5 max-w-md mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          if (tab.isAction) {
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex flex-col items-center -mt-5 focus:outline-none touch-manipulation group"
                aria-label="Add Expense"
              >
                <div className="w-13 h-13 rounded-full bg-gradient-to-tr from-indigo-600 via-indigo-600 to-violet-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/35 border-4 border-white transition-transform active:scale-95 group-hover:scale-105">
                  <Plus className="w-6 h-6 stroke-[2.5]" />
                </div>
                <span className="text-[10px] font-bold text-indigo-700 mt-1">Add</span>
              </button>
            );
          }

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all relative focus:outline-none touch-manipulation ${
                isActive
                  ? 'text-indigo-600 font-bold'
                  : 'text-slate-400 hover:text-slate-600 font-medium'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110 stroke-[2.5]' : 'stroke-2'}`} />
                {Boolean(tab.badge && tab.badge > 0) && (
                  <span className="absolute -top-1 -right-2.5 min-w-4 h-4 px-1 rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center shadow-xs animate-pulse">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className={`text-[10px] mt-1 tracking-tight leading-none ${isActive ? 'font-bold text-indigo-600' : 'text-slate-500'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
