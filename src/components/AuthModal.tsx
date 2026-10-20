import React, { useState, useEffect } from 'react';
import { neonAuth, ObsiUser, AuditLogEntry } from '../services/neonAuth';
import { UserCheck, Key, Shield, AlertTriangle, CheckCircle, RefreshCw, X, ShieldAlert, Lock, Mail, User, LogOut } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: ObsiUser | null;
  onUserChanged: (user: ObsiUser | null) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUserChanged
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'audit'>('profile');
  const [emailInput, setEmailInput] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  const loadAuditLogs = async () => {
    setLoading(true);
    try {
      const logs = await neonAuth.fetchAuditLogs(25);
      setAuditLogs(logs);
    } catch (e) {
      console.error('Error fetching logs:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setStatusMsg(null);
    if (currentUser) {
      setEmailInput(currentUser.email || '');
      loadAuditLogs();
    }
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;
    setLoading(true);
    setStatusMsg(null);
    const res = await neonAuth.updateProfile(emailInput.trim());
    setLoading(false);
    if (res.success && res.user) {
      onUserChanged(res.user);
      setStatusMsg({ type: 'success', text: 'Contact email updated successfully!' });
    } else {
      setStatusMsg({ type: 'error', text: res.message || 'Failed updating profile.' });
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      setStatusMsg({ type: 'error', text: 'New password must be at least 8 characters long.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setStatusMsg({ type: 'error', text: 'New passwords do not match.' });
      return;
    }
    setLoading(true);
    setStatusMsg(null);
    const res = await neonAuth.changePassword(currentPassword, newPassword);
    setLoading(false);
    if (res.success) {
      setStatusMsg({ type: 'success', text: 'Password updated successfully!' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } else {
      setStatusMsg({ type: 'error', text: res.message || 'Failed updating password.' });
    }
  };

  const handleLogout = () => {
    neonAuth.logoutUser();
    onUserChanged(null);
    onClose();
  };

  const formatLogTime = (ts: string) => {
    try {
      const d = new Date(ts);
      if (isNaN(d.getTime())) return ts;
      return d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
    } catch (e) {
      return ts;
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(0, 0, 0, 0.88)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10001
    }}>
      <div className="cli-pane" style={{ width: '680px', maxWidth: '95vw', border: '1px solid var(--primary)', maxHeight: '90vh', overflowY: 'auto' }}>
        {/* Header */}
        <div className="cli-pane-header">
          <span className="header-allcaps" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <img src="./logo.png" alt="ObsiForge" style={{ width: '18px', height: '18px', objectFit: 'contain', filter: 'drop-shadow(0 0 4px #00e5ff)' }} />
            <span>OBSIFORGE // USER PROFILE &amp; SECURITY SETTINGS</span>
          </span>
          <button className="cli-btn cli-btn-muted" style={{ padding: '1px 6px' }} onClick={onClose}>
            <X size={12} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: '#050a05' }}>
          <button
            className={`cli-btn ${activeTab === 'profile' ? '' : 'cli-btn-muted'}`}
            style={{ flex: 1, padding: '10px', border: 'none', borderBottom: activeTab === 'profile' ? '2px solid var(--primary)' : 'none', fontWeight: 700 }}
            onClick={() => { setActiveTab('profile'); setStatusMsg(null); }}
          >
            <Shield size={13} /> [ PROFILE &amp; SECURITY ]
          </button>
          <button
            className={`cli-btn ${activeTab === 'audit' ? 'cli-btn-secondary' : 'cli-btn-muted'}`}
            style={{ flex: 1, padding: '10px', border: 'none', borderBottom: activeTab === 'audit' ? '2px solid var(--secondary)' : 'none', fontWeight: 700 }}
            onClick={() => { setActiveTab('audit'); setStatusMsg(null); loadAuditLogs(); }}
          >
            <ShieldAlert size={13} /> [ ACTIVITY &amp; AUDIT LOGS ]
          </button>
        </div>

        {/* Status Msg */}
        {statusMsg && (
          <div style={{
            margin: '12px 16px 0 16px',
            padding: '8px 12px',
            background: statusMsg.type === 'error' ? 'rgba(255, 51, 51, 0.12)' : statusMsg.type === 'success' ? 'rgba(51, 255, 0, 0.1)' : 'rgba(255, 176, 0, 0.1)',
            border: '1px solid var(--border)',
            color: statusMsg.type === 'error' ? 'var(--error)' : statusMsg.type === 'success' ? 'var(--primary)' : 'var(--secondary)',
            fontSize: '11px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            {statusMsg.type === 'error' ? <AlertTriangle size={13} /> : <CheckCircle size={13} />}
            <span>{statusMsg.text}</span>
          </div>
        )}

        <div style={{ padding: '16px' }}>
          {/* ========================================================================= */}
          {/* TAB 1: PROFILE INFO & CHANGE PASSWORD                                     */}
          {/* ========================================================================= */}
          {activeTab === 'profile' && currentUser && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Account Summary Banner */}
              <div className="cli-pane" style={{ padding: '14px', background: '#071507' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '38px', height: '38px', background: '#0c260c', border: '1px solid var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '16px' }}>
                      {currentUser.username.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--primary)' }}>
                        {currentUser.username.toUpperCase()}
                      </div>
                      <div className="text-muted" style={{ fontSize: '11px', marginTop: '2px' }}>
                        ROLE: <span className="status-badge status-online">[{currentUser.role.toUpperCase()}]</span>
                        <span style={{ marginLeft: '10px' }}>ID: #{currentUser.id}</span>
                      </div>
                    </div>
                  </div>

                  <button className="cli-btn cli-btn-danger" onClick={handleLogout} title="Sign out of current desktop session">
                    <LogOut size={13} /> [ SIGN OUT ]
                  </button>
                </div>
              </div>

              {/* Edit Details Form */}
              <form onSubmit={handleUpdateProfile} className="cli-pane" style={{ padding: '14px' }}>
                <div className="cli-pane-header" style={{ margin: '-14px -14px 12px -14px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <User size={13} color="var(--primary)" /> ACCOUNT DETAILS
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                      CONTACT / RECOVERY EMAIL:
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="email"
                        className="cli-input"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        placeholder="admin@obsiforge.net..."
                        required
                        style={{ flex: 1 }}
                      />
                      <button type="submit" className="cli-btn" disabled={loading}>
                        [ UPDATE EMAIL ]
                      </button>
                    </div>
                  </div>
                </div>
              </form>

              {/* Change Password Form */}
              <form onSubmit={handleChangePassword} className="cli-pane" style={{ padding: '14px' }}>
                <div className="cli-pane-header" style={{ margin: '-14px -14px 12px -14px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Lock size={13} color="var(--primary)" /> CHANGE MASTER PASSWORD
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                      CURRENT PASSWORD:
                    </label>
                    <input
                      type="password"
                      className="cli-input"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter current password..."
                      required
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                        NEW PASSWORD (MIN 8 CHARACTERS):
                      </label>
                      <input
                        type="password"
                        className="cli-input"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="New password..."
                        minLength={8}
                        required
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                        CONFIRM NEW PASSWORD:
                      </label>
                      <input
                        type="password"
                        className="cli-input"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password..."
                        minLength={8}
                        required
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                    <button type="submit" className="cli-btn cli-btn-secondary" style={{ fontWeight: 800 }} disabled={loading}>
                      <Key size={13} /> [{loading ? 'UPDATING...' : 'UPDATE PASSWORD'}]
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: AUDIT & ACTIVITY LOGS (DEDICATED PAGE)                             */}
          {/* ========================================================================= */}
          {activeTab === 'audit' && (
            <div className="cli-pane">
              <div className="cli-pane-header">
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ShieldAlert size={14} color="var(--primary)" /> CLUSTER AUDIT LOGS &amp; SECURITY TIMELINE
                </span>
                <button className="cli-btn cli-btn-muted" style={{ padding: '2px 8px', fontSize: '11px' }} onClick={loadAuditLogs} disabled={loading}>
                  <RefreshCw size={11} className={loading ? 'animate-spin' : ''} /> [ REFRESH ]
                </button>
              </div>

              <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
                <table className="cli-table">
                  <thead>
                    <tr>
                      <th>USER</th>
                      <th>ACTION</th>
                      <th>DETAILS</th>
                      <th>DATE &amp; TIME</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', color: 'var(--muted-text)', padding: '24px' }}>
                          NO RECENT AUDIT ENTRIES LOGGED.
                        </td>
                      </tr>
                    ) : (
                      auditLogs.map((log, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: 700 }}>{log.username}</td>
                          <td><span className="status-badge status-online">{log.action}</span></td>
                          <td className="text-muted" style={{ fontSize: '11px' }}>{log.details}</td>
                          <td className="text-cyan" style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>
                            {formatLogTime(log.timestamp)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
