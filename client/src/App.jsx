import React, { useState, useEffect } from 'react';
import { api } from './services/api';
import { getCurrentMonth } from './utils/formatters';

// Components
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { BottomNav } from './components/BottomNav';
import { Toast } from './components/Toast';
import { PinModal } from './components/PinModal';

// Views
import { DashboardView } from './views/DashboardView';
import { AddExpenseView } from './views/AddExpenseView';
import { ExpenseHistoryView } from './views/ExpenseHistoryView';
import { SettlementEngineView } from './views/SettlementEngineView';
import { ParticipationReportsView } from './views/ParticipationReportsView';
import { SettingsView } from './views/SettingsView';

export function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [members, setMembers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [settlementSummary, setSettlementSummary] = useState(null);
  const [monthlyReport, setMonthlyReport] = useState(null);
  const [systemInfo, setSystemInfo] = useState(null);
  const [editingExpense, setEditingExpense] = useState(null);

  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // PIN Modal state
  const [pinModalState, setPinModalState] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null
  });

  // Delete Expense Confirmation state
  const [expenseToDelete, setExpenseToDelete] = useState(null);

  const showToast = ({ type = 'info', message }) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const requestPin = ({ title, message, onConfirm }) => {
    setPinModalState({
      isOpen: true,
      title,
      message,
      onConfirm: (authData) => {
        setPinModalState((prev) => ({ ...prev, isOpen: false }));
        if (onConfirm) onConfirm(authData);
      }
    });
  };

  const closePinModal = () => {
    setPinModalState((prev) => ({ ...prev, isOpen: false, onConfirm: null }));
  };

  // Fetch initial & recurring data
  const loadData = async (month = selectedMonth) => {
    setIsLoading(true);
    try {
      const [membersData, expensesData, summaryData, reportData, sysInfoData] = await Promise.all([
        api.getMembers(),
        api.getExpenses({ month }),
        api.getSettlementSummary(month),
        api.getMonthlyReport(month),
        api.getSystemInfo()
      ]);

      setMembers(membersData);
      setExpenses(expensesData);
      setSettlementSummary(summaryData);
      setMonthlyReport(reportData);
      setSystemInfo(sysInfoData);
    } catch (err) {
      showToast({ type: 'error', message: err.message || 'Error connecting to server' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData(selectedMonth);
  }, [selectedMonth]);

  const handleMonthChange = (newMonth) => {
    setSelectedMonth(newMonth);
  };

  // Handle Edit Expense (PIN / Password protected)
  const handleEditExpense = (expense) => {
    requestPin({
      title: 'Edit Expense Authorization',
      message: `Please enter member PIN / password to edit "${expense.title}".`,
      onConfirm: ({ memberId, pin }) => {
        setEditingExpense({
          ...expense,
          authData: { memberId, pin }
        });
        setActiveTab('add-expense');
      }
    });
  };

  // Handle Delete Expense with PIN verification
  const handleRequestDelete = (expense) => {
    setExpenseToDelete(expense);
    requestPin({
      title: 'Delete Expense Authorization',
      message: `Are you sure you want to delete "${expense.title}" (₹${expense.amount})? Please authorize with member PIN.`,
      onConfirm: async ({ memberId, pin }) => {
        try {
          await api.deleteExpense(expense.id, { memberId, pin });
          showToast({ type: 'success', message: 'Expense deleted and balances updated!' });
          setExpenseToDelete(null);
          loadData();
        } catch (err) {
          showToast({ type: 'error', message: err.message || 'Failed to delete expense' });
        }
      }
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col antialiased">
      {/* Toast Notification */}
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* Global PIN Modal */}
      <PinModal
        isOpen={pinModalState.isOpen}
        title={pinModalState.title}
        message={pinModalState.message}
        members={members}
        onConfirm={pinModalState.onConfirm}
        onClose={closePinModal}
      />

      {/* Header */}
      <Header
        selectedMonth={selectedMonth}
        onMonthChange={handleMonthChange}
        systemInfo={systemInfo}
        onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      />

      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        {/* Sidebar */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={(tab) => {
            if (tab === 'add-expense' && activeTab !== 'add-expense') {
              setEditingExpense(null); // Clear editing if clicking Add Expense
            }
            setActiveTab(tab);
          }}
          members={members}
          isOpenMobile={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
        />

        {/* Main Content Area */}
        <main className="flex-1 p-3.5 sm:p-5 lg:p-8 pb-24 lg:pb-8 overflow-y-auto">
          {isLoading && !settlementSummary ? (
            <div className="flex items-center justify-center h-64">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-xs font-semibold text-slate-500">Loading Expense Engine...</span>
              </div>
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <DashboardView
                  settlementSummary={settlementSummary}
                  monthlyReport={monthlyReport}
                  selectedMonth={selectedMonth}
                  onNavigateTab={(tab) => {
                    if (tab === 'add-expense') setEditingExpense(null);
                    setActiveTab(tab);
                  }}
                />
              )}

              {activeTab === 'add-expense' && (
                <AddExpenseView
                  members={members}
                  selectedMonth={selectedMonth}
                  editingExpense={editingExpense}
                  onCancelEdit={() => {
                    setEditingExpense(null);
                    setActiveTab('history');
                  }}
                  onExpenseSaved={() => {
                    setEditingExpense(null);
                    loadData();
                    setActiveTab('dashboard');
                  }}
                  showToast={showToast}
                  onRequestPin={requestPin}
                />
              )}

              {activeTab === 'history' && (
                <ExpenseHistoryView
                  expenses={expenses}
                  members={members}
                  selectedMonth={selectedMonth}
                  onEditExpense={handleEditExpense}
                  onRequestDelete={handleRequestDelete}
                  onNavigateTab={setActiveTab}
                />
              )}

              {activeTab === 'settlements' && (
                <SettlementEngineView
                  settlementSummary={settlementSummary}
                  selectedMonth={selectedMonth}
                  members={members}
                  onRefresh={loadData}
                  showToast={showToast}
                  onRequestPin={requestPin}
                />
              )}

              {activeTab === 'reports' && (
                <ParticipationReportsView
                  monthlyReport={monthlyReport}
                  selectedMonth={selectedMonth}
                  showToast={showToast}
                />
              )}

              {activeTab === 'settings' && (
                <SettingsView
                  members={members}
                  systemInfo={systemInfo}
                  onRefreshMembers={loadData}
                  showToast={showToast}
                  onRequestPin={requestPin}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Mobile Floating Bottom Navigation */}
      <BottomNav
        activeTab={activeTab}
        setActiveTab={(tab) => {
          if (tab === 'add-expense' && activeTab !== 'add-expense') {
            setEditingExpense(null);
          }
          setActiveTab(tab);
        }}
        pendingCount={settlementSummary?.pendingSettlementCount || 0}
      />
    </div>
  );
}

export default App;
