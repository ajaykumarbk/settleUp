import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Coins, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { api } from '../utils/api';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('loading'); // 'loading' | 'success' | 'error'
  const [message, setMessage] = useState('Verifying your Gmail address...');
  const navigate = useNavigate();

  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Verification token is missing. Please check your verification link.');
      return;
    }

    const verify = async () => {
      try {
        const res = await api.auth.verifyEmail(token);
        if (res.error) {
          setStatus('error');
          setMessage(res.message || 'Invalid or expired verification token.');
        } else {
          setStatus('success');
          setMessage('Your @gmail.com account has been successfully verified! You can now log in.');
        }
      } catch (err) {
        setStatus('error');
        setMessage('Network error. Failed to reach the authentication server.');
      }
    };

    // Minor delay to show premium smooth transition
    const timer = setTimeout(verify, 1500);
    return () => clearTimeout(timer);
  }, [token]);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      width: '100vw',
      background: 'radial-gradient(circle at 50% 50%, rgba(99, 102, 241, 0.15) 0%, #0b0f19 80%)',
      padding: '20px'
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '440px',
        padding: '40px',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
        textAlign: 'center'
      }}>
        {/* Brand Header */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '36px'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, var(--color-primary), #3b82f6)',
            borderRadius: '12px',
            width: '48px',
            height: '48px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 16px var(--color-primary-glow)'
          }}>
            <Coins size={24} color="#fff" />
          </div>
          <h1 style={{
            fontSize: '1.75rem',
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            letterSpacing: '-0.02em',
            background: 'linear-gradient(to right, #fff, #a5b4fc)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            Email Verification
          </h1>
        </div>

        {/* State Display */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', marginBottom: '32px' }}>
          {status === 'loading' && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(99, 102, 241, 0.08)',
              border: '1px solid rgba(99, 102, 241, 0.15)',
              color: 'var(--color-primary)'
            }}>
              <RefreshCw size={32} className="spin-anim" />
            </div>
          )}

          {status === 'success' && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'var(--color-success-bg)',
              border: '1px solid var(--color-success-border)',
              color: 'var(--color-success)',
              animation: 'successBounce 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
            }}>
              <CheckCircle size={36} />
            </div>
          )}

          {status === 'error' && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'var(--color-danger-bg)',
              border: '1px solid var(--color-danger-border)',
              color: 'var(--color-danger)',
              animation: 'successBounce 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
            }}>
              <XCircle size={36} />
            </div>
          )}

          <p style={{
            color: status === 'error' ? 'var(--color-danger)' : 'var(--text-primary)',
            fontSize: '1rem',
            lineHeight: '1.6',
            maxWidth: '320px',
            margin: '0 auto'
          }}>
            {message}
          </p>
        </div>

        {/* Call to Actions */}
        <button
          className="btn btn-primary"
          style={{ width: '100%', padding: '12px' }}
          onClick={() => navigate('/login')}
          disabled={status === 'loading'}
        >
          {status === 'loading' ? 'Verifying...' : 'Go to Login'}
        </button>
      </div>
    </div>
  );
}
