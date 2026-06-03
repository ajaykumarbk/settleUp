import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Coins, ShieldAlert } from 'lucide-react';
import { api } from '../utils/api';

export default function Login({ isSignup = false }) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  // Clear errors when toggling modes
  useEffect(() => {
    setError('');
  }, [isSignup]);

  // If already logged in, redirect to dashboard
  useEffect(() => {
    if (localStorage.getItem('splitwise_token')) {
      navigate('/');
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let res;
      if (isSignup) {
        res = await api.auth.signup(username, email, password);
      } else {
        res = await api.auth.login(email, password); // Accepts email or username in first argument
      }

      if (res.error) {
        setError(res.message || 'Authentication failed. Please check your inputs.');
      } else {
        // Redirect to dashboard
        navigate('/');
        // Force window reload to reinitialize App sidebar layout
        window.location.reload();
      }
    } catch (err) {
      setError('Connection failed. Please ensure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

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
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)'
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
            {isSignup ? 'Create Account' : 'Welcome Back'}
          </h1>
          <p style={{
            color: 'var(--text-secondary)',
            fontSize: '0.9rem',
            textAlign: 'center'
          }}>
            {isSignup ? 'Join Splitwise Replica and simplify your bill splits' : 'Access your dashboard, manage groups and settle balances'}
          </p>
        </div>

        {/* Error Callout */}
        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 16px',
            background: 'var(--color-danger-bg)',
            border: '1px solid var(--color-danger-border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-danger)',
            fontSize: '0.85rem',
            marginBottom: '24px'
          }}>
            <ShieldAlert size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {isSignup && (
            <div className="form-group">
              <label className="form-label">Username</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. john_doe"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">{isSignup ? 'Email Address' : 'Email or Username'}</label>
            <input
              type="text"
              className="form-control"
              placeholder={isSignup ? "e.g. john@example.com" : "Enter email or username"}
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-control"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '12px', marginTop: '10px' }}
            disabled={loading}
          >
            {loading ? 'Authenticating...' : isSignup ? 'Sign Up' : 'Log In'}
          </button>
        </form>

        {/* Form Toggle */}
        <div style={{
          marginTop: '32px',
          textAlign: 'center',
          fontSize: '0.9rem',
          color: 'var(--text-secondary)'
        }}>
          {isSignup ? (
            <span>
              Already have an account?{' '}
              <Link to="/login" style={{ fontWeight: 600 }}>Log In</Link>
            </span>
          ) : (
            <span>
              New to Splitwise Replica?{' '}
              <Link to="/signup" style={{ fontWeight: 600 }}>Create Account</Link>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
