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
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 lg:px-8 py-3.5 no-print">
      <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
        {/* Left: Mobile hamburger & app title */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleMobileMenu}
            className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-xl"
            aria-label="Toggle Navigation"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-100">
              <IndianRupee className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-slate-900 leading-tight text-base sm:text-lg">
                Monthly Expense Manager
              </h1>
              <p className="text-[11px] text-slate-500 font-medium hidden sm:block">
                Internal 4-Member Shared Accounting Engine
              </p>
            </div>
          </div>
        </div>

        {/* Center: Month & Year Selector */}
        <div className="flex items-center bg-slate-100/90 p-1 rounded-2xl border border-slate-200/80 shadow-sm">
          <button
            onClick={handlePrevMonth}
            className="p-1.5 hover:bg-white text-slate-600 hover:text-slate-900 rounded-xl transition shadow-none hover:shadow-xs"
            title="Previous Month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1.5 px-3">
            <Calendar className="w-4 h-4 text-indigo-600 hidden xs:block" />
            <span className="font-semibold text-xs sm:text-sm text-slate-800 tracking-tight whitespace-nowrap">
              {getMonthName(selectedMonth)}
            </span>
          </div>

          <button
            onClick={handleNextMonth}
            className="p-1.5 hover:bg-white text-slate-600 hover:text-slate-900 rounded-xl transition shadow-none hover:shadow-xs"
            title="Next Month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Quick jump dropdown */}
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
            <span>Port {systemInfo?.port || 3002} (LAN)</span>
          </div>
          <div className="hidden lg:flex items-center gap-1 px-2.5 py-1 bg-slate-100 border border-slate-200 text-slate-600 rounded-full text-xs font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
            <span>{systemInfo?.database?.type || 'SQLite'}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
