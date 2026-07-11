import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  UserPlus, 
  Plus, 
  LogOut, 
  Activity, 
  ServerCrash,
  Sparkles,
  ArrowUpRight,
  ArrowDownLeft,
  Coins,
  Settings,
  Download,
  Cloud,
  X,
  Check,
  FileText
} from 'lucide-react';
import { api } from './utils/api';
import { t } from './utils/translations';
import { syncManager } from './utils/sync';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import SelfTracker from './pages/SelfTracker';
import GroupDetails from './pages/GroupDetails';
import FriendDetails from './pages/FriendDetails';
import VerifyEmail from './pages/VerifyEmail';

function NavigationSidebar({ refreshTrigger, triggerRefresh, lang, handleLanguageChange }) {
  const [groups, setGroups] = useState([]);
  const [friends, setFriends] = useState([]);
  const [user, setUser] = useState(null);
  
  // Modals & Options
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [showProSettings, setShowProSettings] = useState(false);
  
  const [friendInput, setFriendInput] = useState('');
  const [groupNameInput, setGroupNameInput] = useState('');
  const [groupDescInput, setGroupDescInput] = useState('');
  
  // Pro Toggles
  const [adFree, setAdFree] = useState(true);
  const [betaFeatures, setBetaFeatures] = useState(false);
  const [exporting, setExporting] = useState(false);
  
  // System Health
  const [dbHealthy, setDbHealthy] = useState(true);
  const [dbError, setDbError] = useState(null);

  // Network & Sync States
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queueCount, setQueueCount] = useState(0);
  const [syncStatus, setSyncStatus] = useState('synced'); // 'synced' | 'syncing' | 'success' | 'failed'

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const currentUser = api.auth.getUser();
    setUser(currentUser);
    if (currentUser) {
      loadSidebarData();
    }
  }, [refreshTrigger]);

  useEffect(() => {
    const updateOnlineStatus = () => {
      setIsOnline(navigator.onLine);
      if (navigator.onLine) {
        syncManager.processQueue();
      }
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    // Initial queue count
    setQueueCount(syncManager.getQueue().length);

    const handleQueueChange = (e) => {
      setQueueCount(e.detail.count);
    };

    const handleSyncStatus = (e) => {
      setSyncStatus(e.detail.status);
      if (e.detail.status === 'success') {
        triggerRefresh();
        setTimeout(() => setSyncStatus('synced'), 3000);
      }
    };

    const handleSyncCompleted = () => {
      triggerRefresh();
    };

    window.addEventListener('offline-queue-changed', handleQueueChange);
    window.addEventListener('sync-status-changed', handleSyncStatus);
    window.addEventListener('sync-completed', handleSyncCompleted);

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
      window.removeEventListener('offline-queue-changed', handleQueueChange);
      window.removeEventListener('sync-status-changed', handleSyncStatus);
      window.removeEventListener('sync-completed', handleSyncCompleted);
    };
  }, [triggerRefresh]);

  const loadSidebarData = async () => {
    // Check DB Status
    const statusData = await api.status.check();
    if (statusData && statusData.status === 'degraded') {
      setDbHealthy(false);
      setDbError(statusData.error);
    } else {
      setDbHealthy(true);
      setDbError(null);
    }

    const groupsData = await api.groups.list();
    if (groupsData && !groupsData.error) {
      setGroups(groupsData);
    }

    const friendsData = await api.friends.balances();
    if (friendsData && !friendsData.error) {
      setFriends(friendsData);
    }
  };

  const handleAddFriendSubmit = async (e) => {
    e.preventDefault();
    if (!friendInput.trim()) return;

    const res = await api.friends.add(friendInput);
    if (res.error) {
      alert(res.message);
    } else {
      setFriendInput('');
      setShowAddFriend(false);
      triggerRefresh();
      if (res.friend && res.friend.id) {
        navigate(`/friends/${res.friend.id}`);
      }
    }
  };

  const handleAddGroupSubmit = async (e) => {
    e.preventDefault();
    if (!groupNameInput.trim()) return;

    const res = await api.groups.create(groupNameInput, groupDescInput, []);
    if (res.error) {
      alert(res.message);
    } else {
      setGroupNameInput('');
      setGroupDescInput('');
      setShowAddGroup(false);
      triggerRefresh();
      if (res.groupId) {
        navigate(`/groups/${res.groupId}`);
      }
    }
  };

  const handleExportBackup = async () => {
    setExporting(true);
    const res = await api.auth.exportData();
    setExporting(false);
    if (res && res.error) {
      alert(res.message);
    }
  };

  const handleLogout = () => {
    api.auth.logout();
  };

  if (!user) return null;

  return (
    <aside className="sidebar">
      {/* Brand Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
        <div style={{
          background: 'linear-gradient(135deg, var(--color-primary), #3b82f6)',
          borderRadius: '10px',
          width: '38px',
          height: '38px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px var(--color-primary-glow)'
        }}>
          <Coins size={20} color="#fff" />
        </div>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '-0.02em', background: 'linear-gradient(to right, #fff, #a5b4fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            SPLITWISE
          </h2>
          <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', tracking: '0.1em', color: 'var(--color-primary)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span>Replica Pro</span>
            <Sparkles size={8} style={{ fill: 'var(--color-primary)' }} />
          </span>
        </div>
      </div>

      {/* User Profile Summary */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.03)', marginBottom: '16px' }}>
        <img src={user.avatarUrl} alt={user.username} className="avatar avatar-sm" />
        <div style={{ overflow: 'hidden', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <h4 style={{ fontSize: '0.9rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{user.username}</h4>
            <span style={{ background: 'var(--color-primary-glow)', color: '#fff', fontSize: '0.6rem', padding: '1px 4px', borderRadius: '4px', fontWeight: 600 }}>PRO</span>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{user.email}</span>
        </div>
      </div>

      {/* Connection / Sync Status Banner */}
      <div style={{ marginBottom: '16px' }}>
        {!isOnline ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-danger-bg)',
            border: '1px solid var(--color-danger-border)',
            color: 'var(--color-danger)',
            fontSize: '0.8rem',
            animation: 'paymentPulse 2s infinite ease-in-out'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-danger)', display: 'inline-block' }}></span>
              <span>{t('offlineMode')}</span>
            </div>
            {queueCount > 0 && (
              <span style={{ background: 'var(--color-danger)', color: '#fff', fontSize: '0.65rem', padding: '1px 5px', borderRadius: '8px', fontWeight: 600 }}>
                {queueCount} queued
              </span>
            )}
          </div>
        ) : syncStatus === 'syncing' ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 12px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(99, 102, 241, 0.12)',
            border: '1px solid rgba(99, 102, 241, 0.2)',
            color: 'var(--color-primary)',
            fontSize: '0.8rem'
          }}>
            <div style={{
              width: '10px',
              height: '10px',
              border: '2px solid rgba(255,255,255,0.1)',
              borderTop: '2px solid var(--color-primary)',
              borderRadius: '50%',
              animation: 'paymentSpin 0.8s infinite linear',
              display: 'inline-block'
            }}></div>
            <span>{t('syncing')} ({queueCount})</span>
          </div>
        ) : syncStatus === 'success' ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 12px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-success-bg)',
            border: '1px solid var(--color-success-border)',
            color: 'var(--color-success)',
            fontSize: '0.8rem',
            animation: 'successBounce 0.4s ease-out'
          }}>
            <Check size={12} />
            <span>{t('cloudSynced')}</span>
          </div>
        ) : (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 12px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(16, 185, 129, 0.04)',
            border: '1px solid rgba(16, 185, 129, 0.08)',
            color: 'var(--color-success)',
            fontSize: '0.8rem',
            opacity: 0.8
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-success)', display: 'inline-block' }}></span>
            <span>{t('cloudSynced')}</span>
          </div>
        )}
      </div>

      {/* Navigation Section */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, overflowY: 'auto' }}>
        <Link 
          to="/" 
          className="btn btn-secondary" 
          style={{ 
            justifyContent: 'flex-start', 
            background: location.pathname === '/' ? 'var(--color-primary)' : 'rgba(255,255,255,0.02)',
            borderColor: location.pathname === '/' ? 'var(--color-primary)' : 'rgba(255,255,255,0.04)',
            color: '#fff',
            padding: '12px 16px'
          }}
        >
          <LayoutDashboard size={18} />
          <span>{t('dashboard')}</span>
        </Link>

        <Link 
          to="/self-tracker" 
          className="btn btn-secondary" 
          style={{ 
            justifyContent: 'flex-start', 
            background: location.pathname === '/self-tracker' ? 'var(--color-primary)' : 'rgba(255,255,255,0.02)',
            borderColor: location.pathname === '/self-tracker' ? 'var(--color-primary)' : 'rgba(255,255,255,0.04)',
            color: '#fff',
            padding: '12px 16px'
          }}
        >
          <FileText size={18} />
          <span>{t('selfTracker')}</span>
        </Link>

        {/* Groups List */}
        <div style={{ marginTop: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', padding: '0 4px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {t('groups')}
            </span>
            <button 
              onClick={() => setShowAddGroup(true)}
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              title={t('createGroup')}
            >
              <Plus size={16} />
            </button>
          </div>

          {groups.map(g => (
            <Link 
              key={g.id} 
              to={`/groups/${g.id}`} 
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                borderRadius: 'var(--radius-sm)',
                marginBottom: '4px',
                background: location.pathname === `/groups/${g.id}` ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                borderLeft: location.pathname === `/groups/${g.id}` ? '3px solid var(--color-primary)' : '3px solid transparent',
                color: location.pathname === `/groups/${g.id}` ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontSize: '0.9rem',
                transition: 'var(--transition-smooth)'
              }}
            >
              <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{g.name}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.04)', padding: '2px 6px', borderRadius: '10px' }}>
                {g.membersCount}
              </span>
            </Link>
          ))}
        </div>

        {/* Friends List */}
        <div style={{ marginTop: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', padding: '0 4px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {t('friends')}
            </span>
            <button 
              onClick={() => setShowAddFriend(true)}
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              title={t('addFriend')}
            >
              <UserPlus size={16} />
            </button>
          </div>

          {friends.map(f => (
            <Link 
              key={f.friend.id} 
              to={`/friends/${f.friend.id}`} 
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                borderRadius: 'var(--radius-sm)',
                marginBottom: '4px',
                background: location.pathname === `/friends/${f.friend.id}` ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                borderLeft: location.pathname === `/friends/${f.friend.id}` ? '3px solid var(--color-primary)' : '3px solid transparent',
                color: location.pathname === `/friends/${f.friend.id}` ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontSize: '0.9rem',
                transition: 'var(--transition-smooth)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                <img src={f.friend.avatarUrl} alt={f.friend.username} className="avatar avatar-sm" style={{ width: '22px', height: '22px' }} />
                <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{f.friend.username}</span>
              </div>
              
              {f.netBalance !== 0 && (
                <span style={{ fontSize: '0.75rem', fontWeight: 600 }} className={f.netBalance > 0 ? 'amt-positive' : 'amt-negative'}>
                  {f.netBalance > 0 ? `+$${f.netBalance}` : `-$${Math.abs(f.netBalance)}`}
                </span>
              )}
            </Link>
          ))}
        </div>
      </nav>

      {/* Database offline Warning Badge */}
      {!dbHealthy && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px',
          borderRadius: 'var(--radius-md)',
          background: 'var(--color-danger-bg)',
          border: '1px solid var(--color-danger-border)',
          color: 'var(--color-danger)',
          fontSize: '0.8rem',
          marginBottom: '12px'
        }}>
          <ServerCrash size={16} />
          <div>
            <div style={{ fontWeight: 600 }}>Database Offline</div>
            <div style={{ fontSize: '0.7rem', opacity: 0.8 }}>Check credentials in .env</div>
          </div>
        </div>
      )}

      {/* Splitwise Pro settings trigger */}
      <button 
        onClick={() => setShowProSettings(true)} 
        className="btn btn-secondary" 
        style={{ 
          justifyContent: 'flex-start', 
          marginBottom: '8px', 
          background: 'rgba(99,102,241,0.04)', 
          color: 'var(--color-primary)', 
          borderColor: 'rgba(99,102,241,0.08)',
          boxShadow: '0 0 10px rgba(99, 102, 241, 0.05)'
        }}
      >
        <Sparkles size={16} />
        <span>Splitwise Pro Features</span>
      </button>

      {/* Logout button */}
      <button 
        onClick={handleLogout} 
        className="btn btn-secondary" 
        style={{ justifyContent: 'flex-start', background: 'rgba(244,63,94,0.05)', color: 'var(--color-danger)', borderColor: 'rgba(244,63,94,0.1)' }}
      >
        <LogOut size={16} />
        <span>{t('logout')}</span>
      </button>

      {/* Add Friend Modal */}
      {showAddFriend && (
        <div className="modal-overlay" onClick={() => setShowAddFriend(false)}>
          <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: '18px' }}>{t('addFriend')}</h3>
            <form onSubmit={handleAddFriendSubmit}>
              <div className="form-group">
                <label className="form-label">Username or Email</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={friendInput}
                  onChange={e => setFriendInput(e.target.value)}
                  placeholder="Enter friend's email or username"
                  autoFocus
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddFriend(false)}>{t('cancel')}</button>
                <button type="submit" className="btn btn-primary">{t('addFriend')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Group Modal */}
      {showAddGroup && (
        <div className="modal-overlay" onClick={() => setShowAddGroup(false)}>
          <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: '18px' }}>{t('createGroup')}</h3>
            <form onSubmit={handleAddGroupSubmit}>
              <div className="form-group">
                <label className="form-label">{t('groupName')}</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={groupNameInput}
                  onChange={e => setGroupNameInput(e.target.value)}
                  placeholder="e.g. Apartment, Road Trip"
                  autoFocus
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">{t('groupDesc')}</label>
                <textarea 
                  className="form-control" 
                  value={groupDescInput}
                  onChange={e => setGroupDescInput(e.target.value)}
                  placeholder="What is this group for?"
                  rows="3"
                />
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddGroup(false)}>{t('cancel')}</button>
                <button type="submit" className="btn btn-primary">{t('createGroup')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pro Features Settings Modal */}
      {showProSettings && (
        <div className="modal-overlay" onClick={() => setShowProSettings(false)}>
          <div className="modal-content glass-panel" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={18} style={{ color: 'var(--color-primary)' }} />
                <h3 style={{ fontSize: '1.25rem' }}>Splitwise Pro Configuration</h3>
              </div>
              <button onClick={() => setShowProSettings(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Language Selection */}
              <div className="form-group" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                <label className="form-label">🌐 {t('language')}</label>
                <select
                  className="form-control"
                  value={lang}
                  onChange={e => handleLanguageChange(e.target.value)}
                >
                  <option value="en">English</option>
                  <option value="es">Español (Spanish)</option>
                  <option value="fr">Français (French)</option>
                  <option value="de">Deutsch (German)</option>
                  <option value="zh">中文 (Chinese)</option>
                  <option value="ja">日本語 (Japanese)</option>
                  <option value="hi">हिन्दी (Hindi)</option>
                </select>
              </div>

              {/* Account Quota */}
              <div className="glass-panel" style={{ padding: '16px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Cloud size={14} style={{ color: 'var(--color-primary)' }} />
                    <strong>Receipt Storage Quota</strong>
                  </span>
                  <span>4.2% used</span>
                </div>
                <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden', marginBottom: '8px' }}>
                  <div style={{ height: '100%', width: '4.2%', background: 'var(--color-primary)', borderRadius: '3px' }} />
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  0.42 GB used of 10.00 GB cloud limit (High Resolution Receipts enabled).
                </span>
              </div>

              {/* Toggles */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Ad free */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 600 }}>Ad-Free Experience</h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>Remove all advertisements from dashboards</p>
                  </div>
                  <button 
                    onClick={() => setAdFree(!adFree)}
                    className="btn"
                    style={{
                      background: adFree ? 'var(--color-success-bg)' : 'rgba(255,255,255,0.03)',
                      color: adFree ? 'var(--color-success)' : 'var(--text-muted)',
                      border: `1px solid ${adFree ? 'var(--color-success-border)' : 'var(--border-color)'}`,
                      padding: '4px 10px',
                      fontSize: '0.75rem'
                    }}
                  >
                    {adFree ? 'Active' : 'Disabled'}
                  </button>
                </div>

                {/* Beta access */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 600 }}>Early Access Beta Features</h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>Try out experimental split models and redesigns</p>
                  </div>
                  <button 
                    onClick={() => setBetaFeatures(!betaFeatures)}
                    className="btn"
                    style={{
                      background: betaFeatures ? 'var(--color-primary-glow)' : 'rgba(255,255,255,0.03)',
                      color: betaFeatures ? '#fff' : 'var(--text-muted)',
                      border: `1px solid ${betaFeatures ? 'rgba(99,102,241,0.3)' : 'var(--border-color)'}`,
                      padding: '4px 10px',
                      fontSize: '0.75rem'
                    }}
                  >
                    {betaFeatures ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
              </div>

              {/* Data Backup */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 600 }}>Data Backup & Export</h4>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Download a JSON file containing all your groups, friends, settlements, and expense logs.
                </p>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '10px', marginTop: '6px', gap: '8px' }}
                  onClick={handleExportBackup}
                  disabled={exporting}
                >
                  <Download size={16} />
                  <span>{exporting ? 'Generating JSON Backup...' : 'Download JSON Backup'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

function MainApp({ lang, handleLanguageChange }) {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [dbStatus, setDbStatus] = useState({ healthy: true, error: null });

  const triggerRefresh = () => setRefreshTrigger(prev => prev + 1);

  useEffect(() => {
    checkHealth();
  }, [refreshTrigger]);

  const checkHealth = async () => {
    const statusData = await api.status.check();
    if (statusData && statusData.status === 'degraded') {
      setDbStatus({ healthy: false, error: statusData.error });
    } else {
      setDbStatus({ healthy: true, error: null });
    }
  };

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <NavigationSidebar 
        refreshTrigger={refreshTrigger} 
        triggerRefresh={triggerRefresh} 
        lang={lang} 
        handleLanguageChange={handleLanguageChange} 
      />

      {/* Main Pages */}
      <main className="main-content">
        {/* Full-width offline dashboard warning */}
        {!dbStatus.healthy && (
          <div className="glass-panel" style={{ padding: '24px', borderLeft: '4px solid var(--color-danger)', marginBottom: '32px', background: 'rgba(244,63,94,0.03)' }}>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
              <div style={{ padding: '10px', background: 'var(--color-danger-bg)', borderRadius: '10px', color: 'var(--color-danger)' }}>
                <ServerCrash size={28} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '4px', color: 'var(--text-primary)' }}>MySQL Connection is Unavailable</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.5' }}>
                  The backend server failed to connect to your Oracle Cloud MySQL database (Error: <code>{dbStatus.error}</code>).
                </p>
                <div style={{ marginTop: '16px', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}>
                  <strong style={{ color: 'var(--color-warning)' }}>Ubuntu VM Troubleshooting Steps:</strong>
                  <ul style={{ paddingLeft: '20px', marginTop: '8px', color: 'var(--text-secondary)' }}>
                    <li>Confirm host IP in <code>backend/.env</code> matches your VM's public IP.</li>
                    <li>Ensure MySQL is running on your VM: <code>sudo systemctl status mysql</code>.</li>
                    <li>Allow ports: <code>sudo ufw allow 3306/tcp</code>.</li>
                    <li>Configure Oracle Cloud: Add an Ingress Rule allowing TCP on port 3306 in your VCN Security List.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        <Routes>
          <Route path="/" element={<Dashboard triggerRefresh={triggerRefresh} refreshTrigger={refreshTrigger} />} />
          <Route path="/self-tracker" element={<SelfTracker triggerRefresh={triggerRefresh} refreshTrigger={refreshTrigger} />} />
          <Route path="/groups/:id" element={<GroupDetails triggerRefresh={triggerRefresh} refreshTrigger={refreshTrigger} />} />
          <Route path="/friends/:id" element={<FriendDetails triggerRefresh={triggerRefresh} refreshTrigger={refreshTrigger} />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  const token = localStorage.getItem('splitwise_token');
  const [lang, setLang] = useState(localStorage.getItem('splitwise_language') || 'en');

  const handleLanguageChange = (newLang) => {
    localStorage.setItem('splitwise_language', newLang);
    setLang(newLang);
  };

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Login isSignup={true} />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        
        {/* Guarded App Routes */}
        <Route 
          path="/*" 
          element={
            token ? <MainApp lang={lang} handleLanguageChange={handleLanguageChange} /> : <NavigateToLogin />
          } 
        />
      </Routes>
    </Router>
  );
}

function NavigateToLogin() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/login');
  }, []);
  return null;
}
