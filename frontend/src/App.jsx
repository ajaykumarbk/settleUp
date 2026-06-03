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
  Check
} from 'lucide-react';
import { api } from './utils/api';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import GroupDetails from './pages/GroupDetails';
import FriendDetails from './pages/FriendDetails';

function NavigationSidebar({ refreshTrigger, triggerRefresh }) {
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

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const currentUser = api.auth.getUser();
    setUser(currentUser);
    if (currentUser) {
      loadSidebarData();
    }
  }, [refreshTrigger]);

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
      navigate(`/friends/${res.friend.id}`);
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
      navigate(`/groups/${res.groupId}`);
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '32px' }}>
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.03)', marginBottom: '24px' }}>
        <img src={user.avatarUrl} alt={user.username} className="avatar avatar-sm" />
        <div style={{ overflow: 'hidden', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <h4 style={{ fontSize: '0.9rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{user.username}</h4>
            <span style={{ background: 'var(--color-primary-glow)', color: '#fff', fontSize: '0.6rem', padding: '1px 4px', borderRadius: '4px', fontWeight: 600 }}>PRO</span>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{user.email}</span>
        </div>
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
          <span>Dashboard</span>
        </Link>

        {/* Groups List */}
        <div style={{ marginTop: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', padding: '0 4px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Groups
            </span>
            <button 
              onClick={() => setShowAddGroup(true)}
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              title="Create Group"
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
        <div style={{ marginTop: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', padding: '0 4px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Friends
            </span>
            <button 
              onClick={() => setShowAddFriend(true)}
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              title="Add Friend"
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
        <span>Sign Out</span>
      </button>

      {/* Add Friend Modal */}
      {showAddFriend && (
        <div className="modal-overlay" onClick={() => setShowAddFriend(false)}>
          <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: '18px' }}>Add Friend</h3>
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
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddFriend(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Add Friend</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Group Modal */}
      {showAddGroup && (
        <div className="modal-overlay" onClick={() => setShowAddGroup(false)}>
          <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: '18px' }}>Create New Group</h3>
            <form onSubmit={handleAddGroupSubmit}>
              <div className="form-group">
                <label className="form-label">Group Name</label>
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
                <label className="form-label">Description (Optional)</label>
                <textarea 
                  className="form-control" 
                  value={groupDescInput}
                  onChange={e => setGroupDescInput(e.target.value)}
                  placeholder="What is this group for?"
                  rows="3"
                />
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddGroup(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Group</button>
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

function MainApp() {
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
      <NavigationSidebar refreshTrigger={refreshTrigger} triggerRefresh={triggerRefresh} />

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
          <Route path="/groups/:id" element={<GroupDetails triggerRefresh={triggerRefresh} refreshTrigger={refreshTrigger} />} />
          <Route path="/friends/:id" element={<FriendDetails triggerRefresh={triggerRefresh} refreshTrigger={refreshTrigger} />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  const token = localStorage.getItem('splitwise_token');

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Login isSignup={true} />} />
        
        {/* Guarded App Routes */}
        <Route 
          path="/*" 
          element={
            token ? <MainApp /> : <NavigateToLogin />
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
