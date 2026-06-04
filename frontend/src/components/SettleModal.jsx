import React, { useState, useEffect } from 'react';
import { X, ArrowRight, Check } from 'lucide-react';
import { api } from '../utils/api';
import { t } from '../utils/translations';

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
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentStatus, setPaymentStatus] = useState(null); // 'authorizing' | 'processing' | 'success'

  const currentUser = api.auth.getUser();

  useEffect(() => {
    if (isOpen) {
      loadFriends();
      setError('');
      setSelectedFriendId(initialFriendId ? initialFriendId.toString() : '');
      setAmount(initialAmount ? Math.abs(parseFloat(initialAmount)).toFixed(2) : '');
      setDate(new Date().toISOString().split('T')[0]);
      setPaymentMethod('cash');
      setPaymentStatus(null);
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

    const settleData = {
      payerId: parseInt(payerId),
      payeeId: parseInt(payeeId),
      amount: parsedAmount,
      date,
      groupId: null,
      paymentMethod
    };

    if (paymentMethod === 'cash') {
      setLoading(true);
      const res = await api.settlements.create(settleData);
      setLoading(false);

      if (res.error) {
        setError(res.message);
      } else {
        onSuccess();
        onClose();
      }
    } else {
      // Digital simulation flow
      setPaymentStatus('authorizing');
      
      // Stage 1: Authorization Connection
      await new Promise(r => setTimeout(r, 1200));
      setPaymentStatus('processing');
      
      // Stage 2: Processing Payment
      await new Promise(r => setTimeout(r, 1200));
      setPaymentStatus('success');
      
      // Stage 3: Success Checkmark Animation Display
      await new Promise(r => setTimeout(r, 1500));

      setLoading(true);
      const res = await api.settlements.create(settleData);
      setLoading(false);
      setPaymentStatus(null);

      if (res.error) {
        setError(res.message);
      } else {
        onSuccess();
        onClose();
      }
    }
  };

  if (!isOpen || !currentUser) return null;

  const activeFriend = friends.find(f => f.id === parseInt(selectedFriendId));
  const payerName = payerId === currentUser.id.toString() ? 'You' : (activeFriend?.username || 'Friend');
  const payeeName = payeeId === currentUser.id.toString() ? 'You' : (activeFriend?.username || 'Friend');

  const getBrandColor = (method) => {
    switch (method) {
      case 'paypal': return '#0070ba';
      case 'venmo': return '#008cff';
      case 'upi': return '#10b981';
      case 'stripe': return '#635bff';
      default: return 'var(--color-primary)';
    }
  };

  const getBrandEmoji = (method) => {
    switch (method) {
      case 'paypal': return '🅿️';
      case 'venmo': return '💙';
      case 'upi': return '⚡';
      case 'stripe': return '💳';
      default: return '💵';
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-panel" style={{ position: 'relative', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
        
        {/* Animated Payment Processing Screens */}
        {paymentStatus && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(11, 15, 25, 0.97)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '24px',
            textAlign: 'center'
          }}>
            {paymentStatus === 'authorizing' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', animation: 'fadeIn 0.3s ease-out' }}>
                <div style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  background: getBrandColor(paymentMethod),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: `0 0 25px ${getBrandColor(paymentMethod)}`,
                  animation: 'paymentPulse 1.2s infinite ease-in-out',
                  fontSize: '2rem'
                }}>
                  {getBrandEmoji(paymentMethod)}
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 600, fontFamily: 'var(--font-display)' }}>
                  {t('authorizing')}
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Establishing secure encrypted session handshake...
                </p>
              </div>
            )}

            {paymentStatus === 'processing' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', animation: 'fadeIn 0.3s ease-out' }}>
                <div style={{
                  width: '70px',
                  height: '70px',
                  border: '4px solid rgba(255, 255, 255, 0.1)',
                  borderTop: `4px solid ${getBrandColor(paymentMethod)}`,
                  borderRadius: '50%',
                  animation: 'paymentSpin 1s infinite linear'
                }}></div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 600, fontFamily: 'var(--font-display)' }}>
                  {t('processing')}
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  Transferring <strong style={{ color: '#fff' }}>${amount}</strong> to {payeeName}...
                </p>
              </div>
            )}

            {paymentStatus === 'success' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
                <div style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  background: 'var(--color-success)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 30px rgba(16, 185, 129, 0.4)',
                  animation: 'successBounce 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                }}>
                  <Check size={44} color="#fff" />
                </div>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-success)', fontFamily: 'var(--font-display)' }}>
                  {t('success')}
                </h3>
                <p style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                  Settled <strong style={{ color: '#fff' }}>${amount}</strong> using {paymentMethod.toUpperCase()}
                </p>
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '1.4rem' }}>{t('recordPayment')}</h2>
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
            <label className="form-label">{t('settleWith')}</label>
            <select
              className="form-control"
              value={selectedFriendId}
              onChange={e => setSelectedFriendId(e.target.value)}
              required
              disabled={!!initialFriendId}
            >
              <option value="">{t('chooseFriend')}</option>
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
            <label className="form-label">{t('paymentAmount')}</label>
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
            <label className="form-label">{t('dateOfPayment')}</label>
            <input
              type="date"
              className="form-control"
              value={date}
              onChange={e => setDate(e.target.value)}
              required
            />
          </div>

          {/* Payment Methods Grid */}
          <div className="form-group">
            <label className="form-label">{t('paymentMethod')}</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              <button
                type="button"
                className={`payment-method-btn ${paymentMethod === 'cash' ? 'active' : ''}`}
                onClick={() => setPaymentMethod('cash')}
                style={{
                  padding: '10px 6px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 'var(--radius-md)',
                  background: paymentMethod === 'cash' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.2)',
                  color: paymentMethod === 'cash' ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.75rem',
                  fontWeight: paymentMethod === 'cash' ? '600' : '400',
                  transition: 'var(--transition-smooth)'
                }}
              >
                <span style={{ fontSize: '1.1rem' }}>💵</span>
                <span>{t('cash')}</span>
              </button>

              <button
                type="button"
                className={`payment-method-btn ${paymentMethod === 'paypal' ? 'active' : ''}`}
                onClick={() => setPaymentMethod('paypal')}
                style={{
                  padding: '10px 6px',
                  border: paymentMethod === 'paypal' ? '1px solid #0070ba' : '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 'var(--radius-md)',
                  background: paymentMethod === 'paypal' ? 'rgba(0, 112, 186, 0.15)' : 'rgba(0,0,0,0.2)',
                  color: paymentMethod === 'paypal' ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.75rem',
                  fontWeight: paymentMethod === 'paypal' ? '600' : '400',
                  transition: 'var(--transition-smooth)'
                }}
              >
                <span style={{ fontSize: '1.1rem' }}>🅿️</span>
                <span>{t('paypal')}</span>
              </button>

              <button
                type="button"
                className={`payment-method-btn ${paymentMethod === 'venmo' ? 'active' : ''}`}
                onClick={() => setPaymentMethod('venmo')}
                style={{
                  padding: '10px 6px',
                  border: paymentMethod === 'venmo' ? '1px solid #008cff' : '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 'var(--radius-md)',
                  background: paymentMethod === 'venmo' ? 'rgba(0, 140, 255, 0.15)' : 'rgba(0,0,0,0.2)',
                  color: paymentMethod === 'venmo' ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.75rem',
                  fontWeight: paymentMethod === 'venmo' ? '600' : '400',
                  transition: 'var(--transition-smooth)'
                }}
              >
                <span style={{ fontSize: '1.1rem' }}>💙</span>
                <span>{t('venmo')}</span>
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginTop: '8px' }}>
              <button
                type="button"
                className={`payment-method-btn ${paymentMethod === 'upi' ? 'active' : ''}`}
                onClick={() => setPaymentMethod('upi')}
                style={{
                  padding: '10px 6px',
                  border: paymentMethod === 'upi' ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 'var(--radius-md)',
                  background: paymentMethod === 'upi' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(0,0,0,0.2)',
                  color: paymentMethod === 'upi' ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.75rem',
                  fontWeight: paymentMethod === 'upi' ? '600' : '400',
                  transition: 'var(--transition-smooth)'
                }}
              >
                <span style={{ fontSize: '1.1rem' }}>⚡</span>
                <span>{t('upi')}</span>
              </button>

              <button
                type="button"
                className={`payment-method-btn ${paymentMethod === 'stripe' ? 'active' : ''}`}
                onClick={() => setPaymentMethod('stripe')}
                style={{
                  padding: '10px 6px',
                  border: paymentMethod === 'stripe' ? '1px solid #635bff' : '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 'var(--radius-md)',
                  background: paymentMethod === 'stripe' ? 'rgba(99, 91, 255, 0.15)' : 'rgba(0,0,0,0.2)',
                  color: paymentMethod === 'stripe' ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.75rem',
                  fontWeight: paymentMethod === 'stripe' ? '600' : '400',
                  transition: 'var(--transition-smooth)'
                }}
              >
                <span style={{ fontSize: '1.1rem' }}>💳</span>
                <span>{t('stripe')}</span>
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '12px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>{t('cancel')}</button>
            <button type="submit" className="btn btn-success" disabled={loading}>
              <Check size={18} />
              <span>
                {loading ? 'Recording...' : (paymentMethod === 'cash' ? t('recordCash') : `Pay & Settle`)}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
