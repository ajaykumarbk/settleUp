import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  Plus, 
  HandCoins, 
  Trash2, 
  ArrowRight,
  TrendingDown,
  User,
  Clock,
  ArrowUpRight,
  ArrowDownLeft
} from 'lucide-react';
import { api } from '../utils/api';
import { t } from '../utils/translations';
import { getCategoryIcon } from './Dashboard';
import ExpenseModal from '../components/ExpenseModal';
import SettleModal from '../components/SettleModal';

export default function FriendDetails({ triggerRefresh, refreshTrigger }) {
  const { id } = useParams();
  const friendId = parseInt(id);

  const [friend, setFriend] = useState(null);
  const [netBalance, setNetBalance] = useState(0);
  const [expenses, setExpenses] = useState([]);
  const [settlements, setSettlements] = useState([]);
  
  // Modals state
  const [isExpenseOpen, setIsExpenseOpen] = useState(false);
  const [isSettleOpen, setIsSettleOpen] = useState(false);

  const currentUser = api.auth.getUser();

  useEffect(() => {
    loadFriendData();
  }, [friendId, refreshTrigger]);

  const loadFriendData = async () => {
    // 1. Fetch friend detail and balance
    const balances = await api.friends.balances();
    if (balances && !balances.error) {
      const match = balances.find(b => b.friend.id === friendId);
      if (match) {
        setFriend(match.friend);
        setNetBalance(match.netBalance);
      } else {
        // Fallback: If no balance record, load raw friend details
        const friendsList = await api.friends.list();
        const rawFriend = friendsList.find(f => f.id === friendId);
        if (rawFriend) {
          setFriend(rawFriend);
        }
        setNetBalance(0);
      }
    }

    // 2. Fetch direct expenses between current user and friend
    const directExpenses = await api.expenses.list({ friendId });
    if (directExpenses && !directExpenses.error) {
      setExpenses(directExpenses);
    }

    // 3. Fetch direct settlements
    const directSettlements = await api.settlements.list({ friendId });
    if (directSettlements && !directSettlements.error) {
      setSettlements(directSettlements);
    }
  };

  const handleDeleteExpense = async (expenseId) => {
    if (window.confirm('Delete this direct expense?')) {
      const res = await api.expenses.delete(expenseId);
      if (res.error) {
        alert(res.message);
      } else {
        triggerRefresh();
      }
    }
  };

  const handleDeleteSettlement = async (settlementId) => {
    if (window.confirm('Delete this settlement record?')) {
      const res = await api.settlements.delete(settlementId);
      if (res.error) {
        alert(res.message);
      } else {
        triggerRefresh();
      }
    }
  };

  // Combine expenses and settlements into single timeline
  const activities = [
    ...expenses.map(e => ({ ...e, type: 'expense' })),
    ...settlements.map(s => ({ ...s, type: 'settlement' }))
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  if (!friend) {
    return <div style={{ color: 'var(--text-secondary)' }}>Loading friend details...</div>;
  }

  const isOwed = netBalance > 0;
  const isSettled = netBalance === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Friend Profile Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <img src={friend.avatarUrl} alt={friend.username} className="avatar avatar-lg" />
          <div>
            <h1 style={{ fontSize: '2rem', fontFamily: 'var(--font-display)', fontWeight: 800 }}>{friend.username}</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '2px' }}>
              Direct connection • {friend.email}
            </p>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '12px' }}>
          {!isSettled && (
            <button className="btn btn-success" onClick={() => setIsSettleOpen(true)}>
              <HandCoins size={18} />
              <span>{t('settleUp')}</span>
            </button>
          )}
          <button className="btn btn-primary" onClick={() => setIsExpenseOpen(true)}>
            <Plus size={18} />
            <span>{t('addExpense')}</span>
          </button>
        </div>
      </div>

      {/* Localized Balance Status banner */}
      <div className="glass-panel" style={{
        padding: '24px',
        display: 'flex',
        alignItems: 'center',
        gap: '18px',
        borderLeft: `4px solid ${isSettled ? 'var(--text-muted)' : isOwed ? 'var(--color-success)' : 'var(--color-danger)'}`
      }}>
        <div style={{
          padding: '12px',
          borderRadius: '12px',
          background: isSettled ? 'rgba(255,255,255,0.03)' : isOwed ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
          color: isSettled ? 'var(--text-muted)' : isOwed ? 'var(--color-success)' : 'var(--color-danger)'
        }}>
          {isSettled ? <User size={24} /> : isOwed ? <ArrowUpRight size={24} /> : <ArrowDownLeft size={24} />}
        </div>
        <div>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
            Standing with {friend.username}
          </span>
          <h3 className={isOwed ? 'amt-positive' : isSettled ? 'amt-neutral' : 'amt-negative'} style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', marginTop: '2px' }}>
            {isSettled ? 'You are settled up' : isOwed ? `${friend.username} ${t('owedYou').toLowerCase()} $${netBalance.toFixed(2)}` : `${t('youOwe')} ${friend.username} $${Math.abs(netBalance).toFixed(2)}`}
          </h3>
        </div>
      </div>

      {/* Timeline Feed */}
      <div className="glass-panel" style={{ padding: '28px' }}>
        <h3 style={{ fontSize: '1.2rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Clock size={20} style={{ color: 'var(--color-primary)' }} />
          <span>Direct History</span>
        </h3>

        {activities.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            <p style={{ fontSize: '0.95rem' }}>No direct expenses split outside groups with {friend.username} yet.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {activities.map(act => {
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', color: 'var(--text-secondary)' }}>
                        {getCategoryIcon(act.category)}
                      </div>
                      <div>
                        <h4 style={{ fontSize: '0.95rem', fontWeight: 600 }}>{act.description}</h4>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {act.date} • Paid by: {youPaid ? 'You' : friend.username}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>${act.amount.toFixed(2)}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {act.splits && act.splits.length === 1 && act.splits[0].userId === act.paidBy ? (
                            <span className="amt-neutral">personal expense</span>
                          ) : youPaid ? (
                            <span className="amt-positive">{t('owedYou').toLowerCase()} ${(act.amount - yourShare).toFixed(2)}</span>
                          ) : (
                            <span className="amt-negative">{t('youOwe').toLowerCase()} ${yourShare.toFixed(2)}</span>
                          )}
                        </div>
                      </div>

                      <button 
                        onClick={() => handleDeleteExpense(act.id)}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '6px' }}
                        title="Delete expense"
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
                    border: '1px solid rgba(16,185,129,0.1)'
                  }} className="glass-panel-interactive">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ padding: '10px', background: 'rgba(16,185,129,0.1)', borderRadius: '10px', color: 'var(--color-success)' }}>
                        <HandCoins size={18} />
                      </div>
                      <div>
                        <img src="" alt="" style={{ display: 'none' }} />
                        <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-success)' }}>
                          {youPaid ? `${t('youPaid')} ${friend.username}` : `${friend.username} paid You`}
                        </h4>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {act.date} • Settlement Logged
                        </span>
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

      {/* Floating Modals */}
      <ExpenseModal 
        isOpen={isExpenseOpen} 
        onClose={() => setIsExpenseOpen(false)} 
        onSuccess={triggerRefresh}
        initialFriendId={friendId}
      />
      
      <SettleModal 
        isOpen={isSettleOpen} 
        onClose={() => setIsSettleOpen(false)} 
        onSuccess={triggerRefresh}
        initialFriendId={friendId}
        initialAmount={netBalance}
        initialIsOwed={isOwed}
      />
    </div>
  );
}
