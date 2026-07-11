import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Clock, 
  Coffee, 
  Home, 
  Car, 
  TrendingUp, 
  HelpCircle,
  FileText,
  Scan
} from 'lucide-react';
import { api } from '../utils/api';
import { t } from '../utils/translations';
import ExpenseModal from '../components/ExpenseModal';

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

export default function SelfTracker({ triggerRefresh, refreshTrigger }) {
  const [allExpenses, setAllExpenses] = useState([]);
  
  // Modals state
  const [isExpenseOpen, setIsExpenseOpen] = useState(false);
  const [expenseFriendId, setExpenseFriendId] = useState(null);

  // Quick self-expense state
  const [selfDescription, setSelfDescription] = useState('');
  const [selfAmount, setSelfAmount] = useState('');
  const [selfCategory, setSelfCategory] = useState('General');
  const [selfSaving, setSelfSaving] = useState(false);
  const [selfError, setSelfError] = useState('');
  const [selfSuccess, setSelfSuccess] = useState(false);

  const currentUser = api.auth.getUser();

  useEffect(() => {
    loadSelfExpenses();
  }, [refreshTrigger]);

  const loadSelfExpenses = async () => {
    const expenses = await api.expenses.list();
    if (expenses && !expenses.error) {
      setAllExpenses(expenses);
    }
  };

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

  const handleCloseExpenseModal = () => {
    setIsExpenseOpen(false);
    setExpenseFriendId(null);
  };

  const handleQuickSelfSubmit = async (e) => {
    e.preventDefault();
    setSelfError('');
    setSelfSuccess(false);

    const amt = parseFloat(selfAmount);
    if (!selfDescription.trim()) {
      setSelfError('Please enter a description');
      return;
    }
    if (isNaN(amt) || amt <= 0) {
      setSelfError('Please enter a valid amount greater than 0');
      return;
    }

    setSelfSaving(true);
    const expenseData = {
      description: selfDescription.trim(),
      amount: amt,
      currency: 'USD',
      paidBy: currentUser.id,
      groupId: null,
      category: selfCategory,
      date: new Date().toISOString().split('T')[0],
      splits: [{ userId: currentUser.id, amount: amt }]
    };

    const res = await api.expenses.create(expenseData);
    setSelfSaving(false);

    if (res.error) {
      setSelfError(res.message || 'Failed to save expense');
    } else {
      setSelfDescription('');
      setSelfAmount('');
      setSelfCategory('General');
      setSelfSuccess(true);
      triggerRefresh();
      setTimeout(() => setSelfSuccess(false), 3000);
    }
  };

  // Gather and calculate personal/self tracker expenses
  const personalExpenses = allExpenses
    .filter(e => e.groupId === null && e.splits && e.splits.length === 1 && e.splits[0].userId == currentUser?.id)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  
  const totalSelfExpenses = personalExpenses.reduce((sum, exp) => sum + exp.amount, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontFamily: 'var(--font-display)', fontWeight: 800 }}>{t('selfTracker')}</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '4px' }}>
            Track and manage your individual personal expenses.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Balance summary card */}
        <div className="glass-panel" style={{
          padding: '24px',
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(16, 185, 129, 0.05) 100%)',
          border: '1px solid var(--border-color-glow)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500 }}>
            {t('totalSelfExpenses')}
          </div>
          <div style={{
            fontSize: '2.5rem',
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            color: 'var(--text-primary)',
            textShadow: '0 0 20px rgba(99, 102, 241, 0.2)'
          }}>
            ${totalSelfExpenses.toFixed(2)}
          </div>
        </div>

        {/* Quick Entry Form Card */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Log Daily Expense</h3>
            <button
              type="button"
              id="self-ocr-button"
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              onClick={() => {
                setExpenseFriendId('personal');
                setIsExpenseOpen(true);
              }}
            >
              <Scan size={14} style={{ marginRight: '6px' }} />
              <span>Use OCR / Receipt Scanner</span>
            </button>
          </div>

          {selfError && (
            <div style={{
              padding: '10px 14px',
              background: 'var(--color-danger-bg)',
              border: '1px solid var(--color-danger-border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-danger)',
              fontSize: '0.85rem',
              marginBottom: '14px'
            }}>
              {selfError}
            </div>
          )}

          {selfSuccess && (
            <div style={{
              padding: '10px 14px',
              background: 'var(--color-success-bg)',
              border: '1px solid var(--color-success-border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-success)',
              fontSize: '0.85rem',
              marginBottom: '14px'
            }}>
              Expense logged successfully!
            </div>
          )}

          <form onSubmit={handleQuickSelfSubmit} style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '16px',
            alignItems: 'flex-end'
          }}>
            <div className="form-group" style={{ marginBottom: 0, flex: '2 1 200px' }}>
              <label className="form-label" style={{ fontSize: '0.75rem' }}>{t('description')}</label>
              <input
                type="text"
                id="self-desc-input"
                className="form-control"
                placeholder="e.g. Coffee, Lunch"
                value={selfDescription}
                onChange={e => setSelfDescription(e.target.value)}
                style={{ padding: '10px 14px', fontSize: '0.85rem' }}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0, flex: '1 1 100px' }}>
              <label className="form-label" style={{ fontSize: '0.75rem' }}>{t('amount')} ($)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                id="self-amount-input"
                className="form-control"
                placeholder="0.00"
                value={selfAmount}
                onChange={e => setSelfAmount(e.target.value)}
                style={{ padding: '10px 14px', fontSize: '0.85rem' }}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0, flex: '1 1 150px' }}>
              <label className="form-label" style={{ fontSize: '0.75rem' }}>Category</label>
              <select
                id="self-category-select"
                className="form-control"
                value={selfCategory}
                onChange={e => setSelfCategory(e.target.value)}
                style={{ padding: '10px 14px', fontSize: '0.85rem' }}
              >
                <option value="General">General</option>
                <option value="Food">Food / Dining</option>
                <option value="Lodging">Lodging / Rent</option>
                <option value="Taxi">Taxi / Travel</option>
                <option value="Utilities">Utilities / Bills</option>
                <option value="Entertainment">Entertainment</option>
              </select>
            </div>

            <button
              type="submit"
              id="self-submit-button"
              className="btn btn-primary"
              style={{ padding: '11px 20px', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
              disabled={selfSaving}
            >
              {selfSaving ? 'Saving...' : 'Add Expense'}
            </button>
          </form>
        </div>

        {/* Personal Spending Feed */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={20} style={{ color: 'var(--color-primary)' }} />
            <span>Personal Spending Feed</span>
          </h3>

          {personalExpenses.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              <FileText size={40} style={{ opacity: 0.2, marginBottom: '12px' }} />
              <p style={{ fontSize: '0.95rem' }}>No personal expenses tracked yet.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {personalExpenses.map(exp => (
                <div key={exp.id} style={{
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
                      {getCategoryIcon(exp.category)}
                    </div>
                    
                    {/* Desc & Info */}
                    <div>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 600 }}>{exp.description}</h4>
                      <div style={{ display: 'flex', gap: '12px', marginTop: '4px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        <span>{exp.date}</span>
                        <span style={{ color: 'var(--color-primary)', fontWeight: 500 }}>Personal Expense</span>
                      </div>
                    </div>
                  </div>

                  {/* Cost & Delete */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                    <div style={{ fontSize: '1.05rem', fontWeight: 600 }}>
                      ${exp.amount.toFixed(2)}
                    </div>
                    
                    <button 
                      onClick={() => handleDeleteExpense(exp.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '6px',
                        borderRadius: '6px',
                        transition: 'var(--transition-smooth)'
                      }}
                      title="Delete personal expense"
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--color-danger)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ExpenseModal 
        isOpen={isExpenseOpen} 
        onClose={handleCloseExpenseModal} 
        onSuccess={triggerRefresh} 
        initialFriendId={expenseFriendId}
      />
    </div>
  );
}
