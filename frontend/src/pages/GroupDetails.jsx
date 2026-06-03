import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Plus, 
  UserPlus, 
  Trash2, 
  HandCoins, 
  Sparkles, 
  ArrowRight,
  Settings,
  X,
  Check
} from 'lucide-react';
import { api } from '../utils/api';
import { getCategoryIcon } from './Dashboard';
import ExpenseModal from '../components/ExpenseModal';
import SettleModal from '../components/SettleModal';

export default function GroupDetails({ triggerRefresh, refreshTrigger }) {
  const { id } = useParams();
  const groupId = parseInt(id);

  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [balances, setBalances] = useState([]);
  const [simplifiedDebts, setSimplifiedDebts] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [settlements, setSettlements] = useState([]);
  
  // Modals & Settings State
  const [isExpenseOpen, setIsExpenseOpen] = useState(false);
  const [isSettleOpen, setIsSettleOpen] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  // Form fields
  const [memberEmail, setMemberEmail] = useState('');
  const [memberError, setMemberError] = useState('');
  const [defaultSplitType, setDefaultSplitType] = useState('equal');
  const [defaultSplitShares, setDefaultSplitShares] = useState({});
  const [settingsError, setSettingsError] = useState('');

  // Prefill configuration for SettleModal
  const [settlePrefill, setSettlePrefill] = useState({
    friendId: null,
    amount: '',
    isOwed: false
  });

  const currentUser = api.auth.getUser();

  useEffect(() => {
    loadGroupData();
  }, [groupId, refreshTrigger]);

  const loadGroupData = async () => {
    // 1. Group details, members, balances, simplified debts
    const details = await api.groups.getDetails(groupId);
    if (details && !details.error) {
      setGroup(details.group);
      setMembers(details.members);
      setBalances(details.balances);
      setSimplifiedDebts(details.simplifiedDebts);
      
      // Load preset ratios
      setDefaultSplitType(details.group.defaultSplitType || 'equal');
      setDefaultSplitShares(details.group.defaultSplitShares || {});
    }

    // 2. Group expenses
    const groupExpenses = await api.expenses.list({ groupId });
    if (groupExpenses && !groupExpenses.error) {
      setExpenses(groupExpenses);
    }

    // 3. Group settlements
    const groupSettlements = await api.settlements.list({ groupId });
    if (groupSettlements && !groupSettlements.error) {
      setSettlements(groupSettlements);
    }
  };

  const handleAddMemberSubmit = async (e) => {
    e.preventDefault();
    setMemberError('');
    if (!memberEmail.trim()) return;

    const res = await api.groups.addMember(groupId, memberEmail);
    if (res.error) {
      setMemberError(res.message);
    } else {
      setMemberEmail('');
      setShowAddMember(false);
      triggerRefresh();
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSettingsError('');

    if (defaultSplitType === 'unequal') {
      // Validate percentage splits sum to 100%
      const totalPct = members.reduce((sum, m) => sum + (parseFloat(defaultSplitShares[m.id]) || 0), 0);
      if (Math.abs(totalPct - 100) > 0.05) {
        setSettingsError(`Total percentages must sum to exactly 100%. Currently: ${totalPct}%`);
        return;
      }
    }

    const res = await api.groups.updateDefaultSplit(groupId, defaultSplitType, defaultSplitShares);
    if (res.error) {
      setSettingsError(res.message);
    } else {
      setShowSettings(false);
      triggerRefresh();
    }
  };

  const handlePctChange = (memberId, value) => {
    setDefaultSplitShares(prev => ({
      ...prev,
      [memberId]: value
    }));
  };

  const handleDeleteExpense = async (expenseId) => {
    if (window.confirm('Delete this group expense?')) {
      const res = await api.expenses.delete(expenseId);
      if (res.error) {
        alert(res.message);
      } else {
        triggerRefresh();
      }
    }
  };

  const triggerSettleShortcut = (debt) => {
    const currentUserId = currentUser?.id;
    const isPayerMe = debt.from === currentUserId;
    const isPayeeMe = debt.to === currentUserId;

    if (isPayerMe) {
      setSettlePrefill({
        friendId: debt.to,
        amount: debt.amount.toString(),
        isOwed: false
      });
    } else if (isPayeeMe) {
      setSettlePrefill({
        friendId: debt.from,
        amount: debt.amount.toString(),
        isOwed: true
      });
    } else {
      setSettlePrefill({
        friendId: debt.from,
        amount: debt.amount.toString(),
        isOwed: true
      });
    }
    setIsSettleOpen(true);
  };

  // Combine expenses and settlements into single timeline
  const activities = [
    ...expenses.map(e => ({ ...e, type: 'expense' })),
    ...settlements.map(s => ({ ...s, type: 'settlement' }))
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  if (!group) {
    return <div style={{ color: 'var(--text-secondary)' }}>Loading group details...</div>;
  }

  const myBalanceObj = balances.find(b => b.userId === currentUser?.id);
  const myGroupBalance = myBalanceObj ? myBalanceObj.netBalance : 0;
  const isCreatorMe = group.createdBy === currentUser?.id;

  const totalSettingsPct = members.reduce((sum, m) => sum + (parseFloat(defaultSplitShares[m.id]) || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontFamily: 'var(--font-display)', fontWeight: 800 }}>{group.name}</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '4px' }}>
            {group.description || 'Group bills and split logs.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          {isCreatorMe && (
            <button className="btn btn-secondary" onClick={() => setShowSettings(true)} title="Group Settings">
              <Settings size={18} />
              <span>Settings Presets</span>
            </button>
          )}
          <button className="btn btn-secondary" onClick={() => setShowAddMember(true)}>
            <UserPlus size={18} />
            <span>Add Member</span>
          </button>
          <button className="btn btn-primary" onClick={() => setIsExpenseOpen(true)}>
            <Plus size={18} />
            <span>Add Expense</span>
          </button>
        </div>
      </div>

      {/* Group Net Balance Info strip */}
      <div className="glass-panel" style={{
        padding: '16px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderLeft: `4px solid ${myGroupBalance > 0 ? 'var(--color-success)' : myGroupBalance < 0 ? 'var(--color-danger)' : 'var(--text-muted)'}`
      }}>
        <span style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
          Your standing in this group:
        </span>
        <h3 className={myGroupBalance > 0 ? 'amt-positive' : myGroupBalance < 0 ? 'amt-negative' : 'amt-neutral'} style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem' }}>
          {myGroupBalance > 0 ? `You are owed $${myGroupBalance.toFixed(2)}` : myGroupBalance < 0 ? `You owe $${Math.abs(myGroupBalance).toFixed(2)}` : 'You are settled up'}
        </h3>
      </div>

      {/* Two Columns */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 2fr',
        gap: '24px',
        alignItems: 'start'
      }}>
        {/* Left Column: Sidebar Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Members Balances */}
          <div className="glass-panel" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '0.75rem', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
              Group Members ({members.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {balances.map(b => (
                <div key={b.userId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <img src={b.avatarUrl} alt={b.username} className="avatar avatar-sm" style={{ width: '26px', height: '26px' }} />
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{b.username}</span>
                  </div>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }} className={b.netBalance > 0 ? 'amt-positive' : b.netBalance < 0 ? 'amt-negative' : 'amt-neutral'}>
                    {b.netBalance > 0 ? `+${b.netBalance.toFixed(2)}` : b.netBalance < 0 ? `${b.netBalance.toFixed(2)}` : 'settled'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Simplified Debts Engine */}
          <div className="glass-panel" style={{ padding: '20px', border: '1px solid var(--border-color-glow)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Sparkles size={16} style={{ color: 'var(--color-primary)' }} />
              <h3 style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
                Simplified Balances
              </h3>
            </div>

            {simplifiedDebts.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Everyone in this group is fully settled up! No transactions needed. 🌟
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {simplifiedDebts.map((debt, idx) => {
                  const involved = debt.from === currentUser?.id || debt.to === currentUser?.id;
                  
                  return (
                    <div key={`debt-${idx}`} style={{ 
                      display: 'flex', 
                      flexDirection: 'column',
                      padding: '10px', 
                      borderRadius: 'var(--radius-sm)', 
                      background: involved ? 'rgba(99,102,241,0.04)' : 'rgba(255,255,255,0.01)', 
                      border: involved ? '1px solid rgba(99,102,241,0.1)' : '1px solid var(--border-color)',
                      gap: '8px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                          <span style={{ fontWeight: 600, color: debt.from === currentUser?.id ? 'var(--color-danger)' : 'var(--text-primary)' }}>
                            {debt.fromUsername}
                          </span>
                          <ArrowRight size={12} style={{ color: 'var(--text-muted)' }} />
                          <span style={{ fontWeight: 600, color: debt.to === currentUser?.id ? 'var(--color-success)' : 'var(--text-primary)' }}>
                            {debt.toUsername}
                          </span>
                        </div>
                        <span style={{ fontWeight: 700, color: involved ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                          ${debt.amount.toFixed(2)}
                        </span>
                      </div>

                      {involved && (
                        <button
                          onClick={() => triggerSettleShortcut(debt)}
                          className="btn btn-secondary"
                          style={{
                            width: '100%',
                            padding: '4px',
                            fontSize: '0.75rem',
                            display: 'flex',
                            gap: '4px',
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid var(--border-color)'
                          }}
                        >
                          <HandCoins size={12} />
                          <span>Record Settle up</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Activities Feed */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.05rem', marginBottom: '18px' }}>Bills & Settlements</h3>

          {activities.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
              <p style={{ fontSize: '0.9rem' }}>No bills logged in this group yet.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
                      padding: '12px 16px',
                      borderRadius: 'var(--radius-md)',
                      background: 'rgba(255,255,255,0.01)',
                      border: '1px solid var(--border-color)'
                    }} className="glass-panel-interactive">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden' }}>
                        <div style={{ padding: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', color: 'var(--text-secondary)' }}>
                          {getCategoryIcon(act.category)}
                        </div>
                        <div>
                          <h4 style={{ fontSize: '0.9rem', fontWeight: 600 }}>{act.description}</h4>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {act.date} • Paid by: {youPaid ? 'You' : act.paidByName}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>${act.amount.toFixed(2)}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {youPaid ? (
                              <span className="amt-positive">you lent ${(act.amount - yourShare).toFixed(2)}</span>
                            ) : (
                              <span className="amt-negative">you owe ${yourShare.toFixed(2)}</span>
                            )}
                          </div>
                        </div>

                        <button 
                          onClick={() => handleDeleteExpense(act.id)}
                          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                          title="Delete expense"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                } else {
                  // Settlement Log
                  const youPaid = act.payerId === currentUser?.id;
                  
                  return (
                    <div key={`settle-${act.id}`} style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      borderRadius: 'var(--radius-md)',
                      background: 'rgba(16,185,129,0.02)',
                      border: '1px solid rgba(16,185,129,0.08)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ padding: '8px', background: 'rgba(16,185,129,0.1)', borderRadius: '8px', color: 'var(--color-success)' }}>
                          <HandCoins size={16} />
                        </div>
                        <div>
                          <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-success)' }}>
                            {youPaid ? `You settled up with ${act.payeeName}` : `${act.payerName} paid You`}
                          </h4>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {act.date} • Settlement Recorded
                          </span>
                        </div>
                      </div>

                      <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-success)', marginRight: '30px' }}>
                        ${act.amount.toFixed(2)}
                      </div>
                    </div>
                  );
                }
              })}
            </div>
          )}
        </div>
      </div>

      {/* Add Member Modal Overlay */}
      {showAddMember && (
        <div className="modal-overlay" onClick={() => setShowAddMember(false)}>
          <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: '16px' }}>Add Group Member</h3>
            {memberError && (
              <div style={{ padding: '10px', color: 'var(--color-danger)', background: 'var(--color-danger-bg)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', marginBottom: '12px' }}>
                {memberError}
              </div>
            )}
            <form onSubmit={handleAddMemberSubmit}>
              <div className="form-group">
                <label className="form-label">Member Email Address</label>
                <input 
                  type="email" 
                  className="form-control" 
                  placeholder="friend@email.com"
                  value={memberEmail}
                  onChange={e => setMemberEmail(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddMember(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Add Member</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Default Split Ratio Settings Modal */}
      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.25rem' }}>Default Group Split Presets</h3>
              <button onClick={() => setShowSettings(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            {settingsError && (
              <div style={{ padding: '10px', color: 'var(--color-danger)', background: 'var(--color-danger-bg)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', marginBottom: '12px' }}>
                {settingsError}
              </div>
            )}

            <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Default Splitting Strategy</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    className={`btn ${defaultSplitType === 'equal' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1, padding: '8px' }}
                    onClick={() => setDefaultSplitType('equal')}
                  >
                    Split Equally
                  </button>
                  <button
                    type="button"
                    className={`btn ${defaultSplitType === 'unequal' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1, padding: '8px' }}
                    onClick={() => setDefaultSplitType('unequal')}
                  >
                    Custom Ratios (%)
                  </button>
                </div>
              </div>

              {defaultSplitType === 'unequal' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(255,255,255,0.01)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Allocate Percentages
                  </span>

                  {members.map(m => (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.9rem' }}>{m.id === currentUser?.id ? 'You' : m.username}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          className="form-control"
                          placeholder="0"
                          value={defaultSplitShares[m.id] || ''}
                          onChange={e => handlePctChange(m.id, e.target.value)}
                          style={{ width: '70px', padding: '6px', textAlign: 'right' }}
                          required
                        />
                        <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>%</span>
                      </div>
                    </div>
                  ))}

                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'flex-end', 
                    fontSize: '0.85rem', 
                    fontWeight: 600, 
                    color: Math.abs(totalSettingsPct - 100) < 0.05 ? 'var(--color-success)' : 'var(--color-danger)',
                    marginTop: '4px' 
                  }}>
                    {Math.abs(totalSettingsPct - 100) < 0.05 ? (
                      <span>✓ Sums to 100%!</span>
                    ) : (
                      <span>Total: {totalSettingsPct}% (must equal 100%)</span>
                    )}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowSettings(false)}>Cancel</button>
                <button type="submit" className="btn btn-success">
                  <Check size={16} />
                  <span>Save Preset</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Modals */}
      <ExpenseModal 
        isOpen={isExpenseOpen} 
        onClose={() => setIsExpenseOpen(false)} 
        onSuccess={triggerRefresh}
        initialGroupId={groupId}
      />
      
      <SettleModal 
        isOpen={isSettleOpen} 
        onClose={() => {
          setIsSettleOpen(false);
          setSettlePrefill({ friendId: null, amount: '', isOwed: false }); // clear prefills
        }} 
        onSuccess={triggerRefresh}
        initialFriendId={settlePrefill.friendId}
        initialAmount={settlePrefill.amount}
        initialIsOwed={settlePrefill.isOwed}
      />
    </div>
  );
}
