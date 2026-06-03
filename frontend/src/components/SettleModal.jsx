import React, { useState, useEffect } from 'react';
import { X, ArrowRight, Check } from 'lucide-react';
import { api } from '../utils/api';

export default function SettleModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  initialFriendId = null, 
  initialAmount = '', 
  initialIsOwed = false 
}) {
  const [friends, setFriends] = useState([]);
  const [selectedFriendId, setSelectedFriendId] = useState('');
  const [amount, setAmount] = useState('');
  const [payerId, setPayerId] = useState(''); // Who is sending money
  const [payeeId, setPayeeId] = useState(''); // Who is receiving money
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const currentUser = api.auth.getUser();

  useEffect(() => {
    if (isOpen) {
      loadFriends();
      setError('');
      setSelectedFriendId(initialFriendId ? initialFriendId.toString() : '');
      setAmount(initialAmount ? Math.abs(parseFloat(initialAmount)).toFixed(2) : '');
      setDate(new Date().toISOString().split('T')[0]);
    }
  }, [isOpen, initialFriendId, initialAmount, initialIsOwed]);

  const loadFriends = async () => {
    const res = await api.friends.list();
    if (res && !res.error) {
      setFriends(res);
    }
  };

  // Adjust payer and payee whenever friend selection or initial setup runs
  useEffect(() => {
    if (!currentUser) return;
    
    if (selectedFriendId) {
      const friendIdNum = parseInt(selectedFriendId);
      
      // Determine payment direction
      if (initialFriendId && initialFriendId.toString() === selectedFriendId) {
        // Use initial direction preferences
        if (initialIsOwed) {
          // Friend owes user, so Friend pays User
          setPayerId(friendIdNum.toString());
          setPayeeId(currentUser.id.toString());
        } else {
          // User owes friend, so User pays Friend
          setPayerId(currentUser.id.toString());
          setPayeeId(friendIdNum.toString());
        }
      } else {
        // Default: User pays Friend
        setPayerId(currentUser.id.toString());
        setPayeeId(friendIdNum.toString());
      }
    } else {
      setPayerId('');
      setPayeeId('');
    }
  }, [selectedFriendId, currentUser, initialFriendId, initialIsOwed]);

  const handleDirectionToggle = () => {
    if (!selectedFriendId || !currentUser) return;
    const fId = selectedFriendId;
    const cId = currentUser.id.toString();

    if (payerId === cId) {
      // Switch to: Friend pays User
      setPayerId(fId);
      setPayeeId(cId);
    } else {
      // Switch to: User pays Friend
      setPayerId(cId);
      setPayeeId(fId);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid amount greater than $0.');
      return;
    }

    if (!payerId || !payeeId) {
      setError('Please select a friend to settle with.');
      return;
    }

    setLoading(true);

    const settleData = {
      payerId: parseInt(payerId),
      payeeId: parseInt(payeeId),
      amount: parsedAmount,
      date,
      groupId: null // Individual direct settlement (can be linked later if group support is needed, but individual works globally)
    };

    const res = await api.settlements.create(settleData);
    setLoading(false);

    if (res.error) {
      setError(res.message);
    } else {
      onSuccess();
      onClose();
    }
  };

  if (!isOpen || !currentUser) return null;

  const activeFriend = friends.find(f => f.id === parseInt(selectedFriendId));
  const payerName = payerId === currentUser.id.toString() ? 'You' : (activeFriend?.username || 'Friend');
  const payeeName = payeeId === currentUser.id.toString() ? 'You' : (activeFriend?.username || 'Friend');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '1.4rem' }}>Record a Payment</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {error && (
          <div style={{
            padding: '12px',
            background: 'var(--color-danger-bg)',
            border: '1px solid var(--color-danger-border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-danger)',
            fontSize: '0.85rem',
            marginBottom: '20px'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Friend Selection */}
          <div className="form-group">
            <label className="form-label">Settle with Friend</label>
            <select
              className="form-control"
              value={selectedFriendId}
              onChange={e => setSelectedFriendId(e.target.value)}
              required
              disabled={!!initialFriendId}
            >
              <option value="">-- Choose Friend --</option>
              {friends.map(f => (
                <option key={f.id} value={f.id}>{f.username}</option>
              ))}
            </select>
          </div>

          {selectedFriendId && (
            <div className="glass-panel" style={{ padding: '16px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)' }}>
              {/* Payment Flow Visualizer */}
              <div style={{ display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center', gap: '16px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                  <img 
                    src={payerId === currentUser.id.toString() ? currentUser.avatarUrl : activeFriend?.avatarUrl} 
                    alt={payerName} 
                    className="avatar avatar-md" 
                  />
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{payerName}</span>
                </div>
                
                <ArrowRight size={24} style={{ color: 'var(--color-primary)' }} />
                
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                  <img 
                    src={payeeId === currentUser.id.toString() ? currentUser.avatarUrl : activeFriend?.avatarUrl} 
                    alt={payeeName} 
                    className="avatar avatar-md" 
                  />
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{payeeName}</span>
                </div>
              </div>

              {/* Direction Toggle Button */}
              <button
                type="button"
                className="btn btn-secondary"
                style={{ width: '100%', padding: '6px', fontSize: '0.8rem' }}
                onClick={handleDirectionToggle}
                disabled={!!initialFriendId} // Lock toggle if opened from friend detail
              >
                Change Payment Direction
              </button>
            </div>
          )}

          {/* Amount */}
          <div className="form-group">
            <label className="form-label">Payment Amount ($)</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              className="form-control"
              placeholder="0.00"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              required
            />
          </div>

          {/* Date */}
          <div className="form-group">
            <label className="form-label">Date of Payment</label>
            <input
              type="date"
              className="form-control"
              value={date}
              onChange={e => setDate(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '12px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-success" disabled={loading}>
              <Check size={18} />
              <span>{loading ? 'Recording...' : 'Record Payment'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
