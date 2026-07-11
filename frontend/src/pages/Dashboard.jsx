import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  HandCoins, 
  Trash2, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Clock,
  Coffee, 
  Home, 
  Car, 
  TrendingUp, 
  HelpCircle,
  FileText,
  LayoutDashboard,
  PieChart,
  CreditCard as CreditCardIcon,
  Search,
  Scan
} from 'lucide-react';
import { api } from '../utils/api';
import { t } from '../utils/translations';
import BalancesBanner from '../components/BalancesBanner';
import ExpenseModal from '../components/ExpenseModal';
import SettleModal from '../components/SettleModal';
import ProAnalytics from '../components/ProAnalytics';
import BankSyncer from '../components/BankSyncer';

// Helper to render category icon
export function getCategoryIcon(category, size = 18) {
  switch (category) {
    case 'Food': return <Coffee size={size} />;
    case 'Lodging': return <Home size={size} />;
    case 'Taxi': return <Car size={size} />;
    case 'Utilities': return <TrendingUp size={size} />;
    default: return <HelpCircle size={size} />;
  }
}

export default function Dashboard({ triggerRefresh, refreshTrigger }) {
  const [friendBalances, setFriendBalances] = useState([]);
  const [recentExpenses, setRecentExpenses] = useState([]);
  const [recentSettlements, setRecentSettlements] = useState([]);
  const [allExpenses, setAllExpenses] = useState([]);
  
  // Tabs & Filters State
  const [activeSubTab, setActiveSubTab] = useState('overview'); // 'overview', 'analytics', 'import', 'self'
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Modals state
  const [isExpenseOpen, setIsExpenseOpen] = useState(false);
  const [isSettleOpen, setIsSettleOpen] = useState(false);
  const [bankPrefill, setBankPrefill] = useState(null);

  const currentUser = api.auth.getUser();

  useEffect(() => {
    loadDashboardData();
  }, [refreshTrigger]);

  const loadDashboardData = async () => {
    // 1. Friend balances
    const balances = await api.friends.balances();
    if (balances && !balances.error) {
      setFriendBalances(balances);
    }

    // 2. All and Recent Expenses
    const expenses = await api.expenses.list();
    if (expenses && !expenses.error) {
      setAllExpenses(expenses);
      setRecentExpenses(expenses.slice(0, 15)); // Take first 15 for chronological list
    }

    // 3. Recent Settlements
    const settlements = await api.settlements.list();
    if (settlements && !settlements.error) {
      setRecentSettlements(settlements.slice(0, 15));
    }
  };

  // Compute overall balances from the friendBalances list
  let totalBalance = 0;
  let totalYouOwe = 0;
  let totalYouAreOwed = 0;

  friendBalances.forEach(fb => {
    totalBalance += fb.netBalance;
    if (fb.netBalance < 0) {
      totalYouOwe += fb.netBalance;
    } else if (fb.netBalance > 0) {
      totalYouAreOwed += fb.netBalance;
    }
  });

  const handleDeleteExpense = async (expenseId) => {
    if (window.confirm('Are you sure you want to delete this expense?')) {
      const res = await api.expenses.delete(expenseId);
      if (res.error) {
        alert(res.message);
      } else {
        triggerRefresh();
      }
    }
  };

  const handleDeleteSettlement = async (settlementId) => {
    if (window.confirm('Are you sure you want to delete this payment record?')) {
      const res = await api.settlements.delete(settlementId);
      if (res.error) {
        alert(res.message);
      } else {
        triggerRefresh();
      }
    }
  };

  const handleBankImport = (txData) => {
    setBankPrefill(txData);
    setIsExpenseOpen(true);
  };

  const handleCloseExpenseModal = () => {
    setIsExpenseOpen(false);
    setBankPrefill(null);
  };

  // Separate debtors and creditors
  const peopleOwed = friendBalances.filter(fb => fb.netBalance < 0);
  const peopleOwes = friendBalances.filter(fb => fb.netBalance > 0);

  // Filter out personal expenses from the main shared Overview activity feed
  const sharedExpenses = allExpenses
    .filter(e => !(e.groupId === null && e.splits && e.splits.length === 1 && e.splits[0].userId == currentUser?.id))
    .slice(0, 15);

  // Combine expenses and settlements into a single chronological activities feed
  const activities = [
    ...sharedExpenses.map(e => ({ ...e, type: 'expense' })),
    ...recentSettlements.map(s => ({ ...s, type: 'settlement' }))
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  // Filter activities based on search query and category selector
  const filteredActivities = activities.filter(act => {
    const queryMatch = searchQuery.trim() === '' || 
      (act.description && act.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (act.paidByName && act.paidByName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (act.groupName && act.groupName.toLowerCase().includes(searchQuery.toLowerCase()));

    const categoryMatch = categoryFilter === '' || act.category === categoryFilter;

    return queryMatch && categoryMatch;
  });



  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Dashboard Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontFamily: 'var(--font-display)', fontWeight: 800 }}>{t('dashboard')}</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '4px' }}>
            Welcome back, {currentUser?.username}. Here is your balance summary.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-secondary" onClick={() => setIsSettleOpen(true)}>
            <HandCoins size={18} />
            <span>{t('settleUp')}</span>
          </button>
          <button className="btn btn-primary" onClick={() => setIsExpenseOpen(true)}>
            <Plus size={18} />
            <span>{t('addExpense')}</span>
          </button>
        </div>
      </div>


      {/* Pro Tabs Switcher */}
      <div style={{ 
        display: 'flex', 
        gap: '8px', 
        borderBottom: '1px solid var(--border-color)', 
        paddingBottom: '8px',
        overflowX: 'auto'
      }}>
        <button
          onClick={() => setActiveSubTab('overview')}
          className="btn"
          style={{
            background: activeSubTab === 'overview' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
            color: activeSubTab === 'overview' ? 'var(--color-primary)' : 'var(--text-secondary)',
            border: activeSubTab === 'overview' ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid transparent',
            padding: '8px 16px',
            fontSize: '0.85rem'
          }}
        >
          <LayoutDashboard size={16} />
          <span>{t('dashboard')}</span>
        </button>
        <button
          onClick={() => setActiveSubTab('analytics')}
          className="btn"
          style={{
            background: activeSubTab === 'analytics' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
            color: activeSubTab === 'analytics' ? 'var(--color-primary)' : 'var(--text-secondary)',
            border: activeSubTab === 'analytics' ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid transparent',
            padding: '8px 16px',
            fontSize: '0.85rem'
          }}
        >
          <PieChart size={16} />
          <span>{t('chartsGraphs')}</span>
        </button>
        <button
          onClick={() => setActiveSubTab('import')}
          className="btn"
          style={{
            background: activeSubTab === 'import' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
            color: activeSubTab === 'import' ? 'var(--color-primary)' : 'var(--text-secondary)',
            border: activeSubTab === 'import' ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid transparent',
            padding: '8px 16px',
            fontSize: '0.85rem'
          }}
        >
          <CreditCardIcon size={16} />
          <span>{t('importPurchases')}</span>
        </button>
      </div>

      {/* Conditionally Render Content */}
      {activeSubTab === 'overview' && (
        <>
          {/* 3-Card Balances Banner */}
          <BalancesBanner 
            total={totalBalance} 
            youOwe={totalYouOwe} 
            youAreOwed={totalYouAreOwed} 
          />

          {/* Grid: Owed / Owes lists */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
            gap: '24px'
          }}>
            {/* You Owe Section */}
            <div className="glass-panel" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '1.15rem', marginBottom: '16px', color: 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ArrowDownLeft size={20} />
                <span>{t('youOwe')}</span>
              </h3>
              
              {peopleOwed.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', padding: '12px 0' }}>
                  You do not owe anyone anything! Awesome. 🎉
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {peopleOwed.map(fb => (
                    <div key={fb.friend.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <img src={fb.friend.avatarUrl} alt={fb.friend.username} className="avatar avatar-sm" />
                        <div>
                          <h4 style={{ fontSize: '0.95rem' }}>{fb.friend.username}</h4>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('youOwe').toLowerCase()}</span>
                        </div>
                      </div>
                      <span style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--color-danger)' }}>
                        ${Math.abs(fb.netBalance).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* You Are Owed Section */}
            <div className="glass-panel" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '1.15rem', marginBottom: '16px', color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ArrowUpRight size={20} />
                <span>{t('youAreOwed')}</span>
              </h3>

              {peopleOwes.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', padding: '12px 0' }}>
                  No one owes you money right now.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {peopleOwes.map(fb => (
                    <div key={fb.friend.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <img src={fb.friend.avatarUrl} alt={fb.friend.username} className="avatar avatar-sm" />
                        <div>
                          <h4 style={{ fontSize: '0.95rem' }}>{fb.friend.username}</h4>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('owedYou').toLowerCase()}</span>
                        </div>
                      </div>
                      <span style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--color-success)' }}>
                        ${fb.netBalance.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent Activity Timeline Feed */}
          <div className="glass-panel" style={{ padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Clock size={20} style={{ color: 'var(--color-primary)' }} />
                <span>Recent Activity</span>
              </h3>
              
              {/* Search & Category Filter Controls */}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Search Bar */}
                <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: '10px', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    placeholder={t('expenseSearch')}
                    className="form-control"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{ padding: '6px 10px 6px 30px', fontSize: '0.85rem', width: '180px' }}
                  />
                </div>
                {/* Category Filter */}
                <select
                  className="form-control"
                  value={categoryFilter}
                  onChange={e => setCategoryFilter(e.target.value)}
                  style={{ padding: '6px 10px', fontSize: '0.85rem', width: '140px' }}
                >
                  <option value="">All Categories</option>
                  <option value="General">General</option>
                  <option value="Food">Food / Dining</option>
                  <option value="Lodging">Lodging / Rent</option>
                  <option value="Taxi">Taxi / Travel</option>
                  <option value="Utilities">Utilities / Bills</option>
                  <option value="Entertainment">Entertainment</option>
                </select>
              </div>
            </div>

            {filteredActivities.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                <FileText size={40} style={{ opacity: 0.2, marginBottom: '12px' }} />
                <p style={{ fontSize: '0.95rem' }}>No matching transactions found.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {filteredActivities.map(act => {
                  if (act.type === 'expense') {
                    const youPaid = act.paidBy === currentUser?.id;
                    const yourSplit = act.splits.find(s => s.userId === currentUser?.id);
                    const yourShare = yourSplit ? yourSplit.amount : 0;
                    
                    return (
                      <div key={`exp-${act.id}`} style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '14px 18px',
                        borderRadius: 'var(--radius-md)',
                        background: 'rgba(255,255,255,0.01)',
                        border: '1px solid var(--border-color)',
                        transition: 'var(--transition-smooth)'
                      }} className="glass-panel-interactive">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', overflow: 'hidden' }}>
                          {/* Icon */}
                          <div style={{
                            padding: '10px',
                            background: 'rgba(255,255,255,0.03)',
                            borderRadius: '10px',
                            color: 'var(--text-secondary)'
                          }}>
                            {getCategoryIcon(act.category)}
                          </div>
                          
                          {/* Desc & Info */}
                          <div>
                            <h4 style={{ fontSize: '0.95rem', fontWeight: 600 }}>{act.description}</h4>
                            <div style={{ display: 'flex', gap: '12px', marginTop: '4px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              <span>{act.date}</span>
                              {act.groupName && (
                                <span style={{ color: 'var(--color-primary)', fontWeight: 500 }}>{act.groupName}</span>
                              )}
                              <span>{t('youPaid')}: {youPaid ? 'You' : act.paidByName}</span>
                            </div>
                          </div>
                        </div>

                        {/* Cost splitting statement */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>${act.amount.toFixed(2)}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                              {act.splits && act.splits.length === 1 && act.splits[0].userId === act.paidBy ? (
                                <span className="amt-neutral">personal expense</span>
                              ) : youPaid ? (
                                <span className="amt-positive">{t('owedYou').toLowerCase()} ${(act.amount - yourShare).toFixed(2)}</span>
                              ) : (
                                <span className="amt-negative">{t('youOwe').toLowerCase()} ${yourShare.toFixed(2)}</span>
                              )}
                            </div>
                          </div>

                          {/* Delete Trigger */}
                          <button 
                            onClick={() => handleDeleteExpense(act.id)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--text-muted)',
                              cursor: 'pointer',
                              padding: '6px',
                              borderRadius: '6px',
                              transition: 'var(--transition-smooth)'
                            }}
                            title="Delete expense"
                            onMouseEnter={e => e.currentTarget.style.color = 'var(--color-danger)'}
                            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  } else {
                    // Settle Payment Activity
                    const youPaid = act.payerId === currentUser?.id;
                    
                    return (
                      <div key={`settle-${act.id}`} style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '14px 18px',
                        borderRadius: 'var(--radius-md)',
                        background: 'rgba(16,185,129,0.02)',
                        border: '1px solid rgba(16,185,129,0.1)',
                        transition: 'var(--transition-smooth)'
                      }} className="glass-panel-interactive">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                          {/* Icon */}
                          <div style={{
                            padding: '10px',
                            background: 'rgba(16,185,129,0.1)',
                            borderRadius: '10px',
                            color: 'var(--color-success)'
                          }}>
                            <HandCoins size={18} />
                          </div>
                          
                          {/* Details */}
                          <div>
                            <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-success)' }}>
                              {youPaid ? `You paid ${act.payeeName}` : `${act.payerName} paid You`}
                            </h4>
                            <div style={{ display: 'flex', gap: '12px', marginTop: '4px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              <span>{act.date}</span>
                              {act.groupName && (
                                <span style={{ color: 'var(--color-primary)' }}>{act.groupName}</span>
                              )}
                              <span>Record of Settlement</span>
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--color-success)' }}>
                              ${act.amount.toFixed(2)}
                            </div>
                          </div>

                          <button 
                            onClick={() => handleDeleteSettlement(act.id)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--text-muted)',
                              cursor: 'pointer',
                              padding: '6px',
                              borderRadius: '6px',
                              transition: 'var(--transition-smooth)'
                            }}
                            title="Delete settlement"
                            onMouseEnter={e => e.currentTarget.style.color = 'var(--color-danger)'}
                            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  }
                })}
              </div>
            )}
          </div>
        </>
      )}

      {activeSubTab === 'analytics' && (
        <ProAnalytics expenses={allExpenses} />
      )}

      {activeSubTab === 'import' && (
        <BankSyncer onImportClick={handleBankImport} />
      )}

      {/* Floating Modal Components */}
      <ExpenseModal 
        isOpen={isExpenseOpen} 
        onClose={handleCloseExpenseModal} 
        onSuccess={triggerRefresh} 
        prefilledData={bankPrefill}
      />
      <SettleModal 
        isOpen={isSettleOpen} 
        onClose={() => setIsSettleOpen(false)} 
        onSuccess={triggerRefresh} 
      />
    </div>
  );
}
