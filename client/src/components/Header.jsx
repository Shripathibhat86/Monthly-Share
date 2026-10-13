import React from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Wifi,
  Menu,
  IndianRupee,
  ShieldCheck
} from 'lucide-react';
import { getMonthName } from '../utils/formatters';

export function Header({
  selectedMonth,
  onMonthChange,
  systemInfo,
  onToggleMobileMenu
}) {
  // Parse year and month
  const [yearStr, monthStr] = selectedMonth.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  const handlePrevMonth = () => {
    let newYear = year;
    let newMonth = month - 1;
    if (newMonth < 1) {
      newMonth = 12;
      newYear -= 1;
    }
    const formatted = `${newYear}-${String(newMonth).padStart(2, '0')}`;
    onMonthChange(formatted);
  };

  const handleNextMonth = () => {
    let newYear = year;
    let newMonth = month + 1;
    if (newMonth > 12) {
      newMonth = 1;
      newYear += 1;
    }
    const formatted = `${newYear}-${String(newMonth).padStart(2, '0')}`;
    onMonthChange(formatted);
  };

  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1];
  const monthsList = [
    { num: '01', name: 'Jan' },
    { num: '02', name: 'Feb' },
    { num: '03', name: 'Mar' },
    { num: '04', name: 'Apr' },
    { num: '05', name: 'May' },
    { num: '06', name: 'Jun' },
    { num: '07', name: 'Jul' },
    { num: '08', name: 'Aug' },
    { num: '09', name: 'Sep' },
    { num: '10', name: 'Oct' },
    { num: '11', name: 'Nov' },
    { num: '12', name: 'Dec' }
  ];

  return (
    <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3.5 no-print shadow-xs">
      <div className="flex items-center justify-between gap-2 sm:gap-4 max-w-7xl mx-auto">
        {/* Left: Mobile menu toggle & app logo/title */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={onToggleMobileMenu}
            className="lg:hidden p-2 -ml-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl touch-manipulation active:scale-95 transition"
            aria-label="Toggle Navigation Menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-100 flex-shrink-0">
              <IndianRupee className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-slate-900 leading-tight text-sm sm:text-lg truncate">
                <span className="sm:hidden">Monthly Share</span>
                <span className="hidden sm:inline">Monthly Expense Manager</span>
              </h1>
              <p className="text-[11px] text-slate-500 font-medium hidden md:block">
                Internal 4-Member Shared Accounting Engine
              </p>
            </div>
          </div>
        </div>

        {/* Center/Right: Month & Year Selector */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex items-center bg-slate-100/90 p-0.5 sm:p-1 rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-xs">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 sm:p-2 hover:bg-white text-slate-600 hover:text-slate-900 rounded-lg sm:rounded-xl transition touch-manipulation active:scale-95 shadow-none hover:shadow-xs"
              title="Previous Month"
              aria-label="Previous Month"
            >
              <ChevronLeft className="w-4 h-4 sm:w-4 sm:h-4 stroke-[2.5]" />
            </button>

            <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3">
              <Calendar className="w-3.5 h-3.5 text-indigo-600 hidden xs:block" />
              <span className="font-bold text-xs sm:text-sm text-slate-800 tracking-tight whitespace-nowrap">
                {getMonthName(selectedMonth)}
              </span>
            </div>

            <button
              onClick={handleNextMonth}
              className="p-1.5 sm:p-2 hover:bg-white text-slate-600 hover:text-slate-900 rounded-lg sm:rounded-xl transition touch-manipulation active:scale-95 shadow-none hover:shadow-xs"
              title="Next Month"
              aria-label="Next Month"
            >
              <ChevronRight className="w-4 h-4 sm:w-4 sm:h-4 stroke-[2.5]" />
            </button>

            {/* Quick jump dropdown (desktop) */}
            <div className="border-l border-slate-200 pl-1.5 ml-1 hidden md:flex items-center gap-1">
              <select
                value={monthStr}
                onChange={(e) => onMonthChange(`${yearStr}-${e.target.value}`)}
                className="text-xs bg-transparent font-medium text-slate-600 py-1 px-1 focus:outline-none cursor-pointer"
              >
                {monthsList.map((m) => (
                  <option key={m.num} value={m.num}>
                    {m.name}
                  </option>
                ))}
              </select>
              <select
                value={yearStr}
                onChange={(e) => onMonthChange(`${e.target.value}-${monthStr}`)}
                className="text-xs bg-transparent font-medium text-slate-600 py-1 px-1 focus:outline-none cursor-pointer"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y.toString()}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Right: LAN & DB badge */}
          <div className="hidden sm:flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full text-xs font-medium shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <Wifi className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Port {systemInfo?.port || 3002} (LAN)</span>
              <span className="md:hidden">LAN</span>
            </div>
            <div className="hidden lg:flex items-center gap-1 px-2.5 py-1 bg-slate-100 border border-slate-200 text-slate-600 rounded-full text-xs font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
              <span>{systemInfo?.database?.type || 'SQLite'}</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
