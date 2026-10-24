import React, { useState, useEffect } from 'react';
import { neonAuth, ObsiUser, OciGuiConfig } from '../services/neonAuth';
import { ASCII_LOGO } from '../utils/ascii';
import { LogIn, UserPlus, Cloud, ArrowRight, CheckCircle, AlertTriangle } from 'lucide-react';

interface AuthGateProps {
  onAuthenticated: (user: ObsiUser) => void;
  initialMode?: 'register' | 'login' | 'oci_onboarding';
}

export const AuthGate: React.FC<AuthGateProps> = ({ onAuthenticated, initialMode = 'register' }) => {
  const [authMode, setAuthMode] = useState<'register' | 'login' | 'oci_onboarding'>(initialMode);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [authenticatedUser, setAuthenticatedUser] = useState<ObsiUser | null>(neonAuth.getCurrentUser());

  // Oracle Cloud initial onboarding state
  const [ociConfig, setOciConfig] = useState<OciGuiConfig>({
    tenancyOcid: '',
    userOcid: '',
    compartmentOcid: '',
    fingerprint: '',
    region: 'us-ashburn-1',
    privateKeyPem: '',
    instanceIp: '',
    instancePort: 25565
  });

  useEffect(() => {
    // Silently auto-initialize Neon DB schema in the background if configured
    if (neonAuth.isNeonConfigured()) {
      neonAuth.initializeSchema().catch(() => {});
    }
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatusMsg(null);
    try {
      const res = await neonAuth.registerUser(username, email, password);
      setLoading(false);
      if (res.success && res.user) {
        setAuthenticatedUser(res.user);
        setStatusMsg({ type: 'success', text: `Welcome Administrator ${res.user.username}! Setting up cluster session...` });
        // Proceed directly to dashboard (can configure Oracle Cloud anytime later in settings)
        setTimeout(() => {
          onAuthenticated(res.user!);
        }, 700);
      } else {
        setStatusMsg({ type: 'error', text: res.message || 'Registration failed.' });
      }
    } catch (err: any) {
      setLoading(false);
      setStatusMsg({ type: 'error', text: err.message || 'Error creating account.' });
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatusMsg(null);
    try {
      const res = await neonAuth.loginUser(username, password);
      setLoading(false);
      if (res.success && res.user) {
        setAuthenticatedUser(res.user);
        setStatusMsg({ type: 'success', text: `Identity verified: ${res.user.username} [${res.user.role.toUpperCase()}]` });
        setTimeout(() => {
          onAuthenticated(res.user!);
        }, 700);
      } else {
        setStatusMsg({ type: 'error', text: res.message || 'Invalid credentials.' });
      }
    } catch (err: any) {
      setLoading(false);
      setStatusMsg({ type: 'error', text: err.message || 'Login error.' });
    }
  };

  const handleSaveOciAndProceed = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!authenticatedUser) return;

    if (!ociConfig.tenancyOcid.trim()) {
      setStatusMsg({ type: 'error', text: 'TENANCY OCID is required (e.g. ocid1.tenancy.oc1..aaaa...)' });
      return;
    }
    if (!ociConfig.userOcid.trim()) {
      setStatusMsg({ type: 'error', text: 'USER OCID is required (e.g. ocid1.user.oc1..aaaa...)' });
      return;
    }
    if (!ociConfig.fingerprint.trim()) {
      setStatusMsg({ type: 'error', text: 'API KEY FINGERPRINT is required (e.g. 20:3b:97:...)' });
      return;
    }
    if (!ociConfig.instanceIp.trim()) {
      setStatusMsg({ type: 'error', text: 'INSTANCE PUBLIC IP is required (e.g. 129.153.xx.xx)' });
      return;
    }
    if (!ociConfig.privateKeyPem.trim()) {
      setStatusMsg({ type: 'error', text: 'OCI RSA PRIVATE KEY (PEM) is required.' });
      return;
    }

    setLoading(true);
    setStatusMsg({ type: 'info', text: 'Encrypting and securely storing Oracle Cloud credentials...' });
    try {
      const ok = await neonAuth.saveOciConfig(ociConfig, password || 'default_master_key');
      setLoading(false);
      if (ok) {
        setStatusMsg({ type: 'success', text: 'Oracle Cloud keys validated and encrypted! Launching dashboard...' });
        setTimeout(() => {
          onAuthenticated(authenticatedUser);
        }, 800);
      } else {
        setStatusMsg({ type: 'error', text: 'Failed to securely store Oracle Cloud keys. Please try again.' });
      }
    } catch (err: any) {
      setLoading(false);
      setStatusMsg({ type: 'error', text: err.message || 'Error saving OCI credentials.' });
    }
  };

  const regions = [
    'us-ashburn-1', 'us-phoenix-1', 'us-sanjose-1', 'us-chicago-1',
    'eu-frankfurt-1', 'eu-amsterdam-1', 'uk-london-1',
    'ap-mumbai-1', 'ap-hyderabad-1', 'ap-tokyo-1', 'ap-seoul-1', 'ap-sydney-1',
    'sa-saopaulo-1', 'me-dubai-1'
  ];

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: '#0a0a0a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      padding: '20px'
    }}>
      <div className="crt-overlay" />

      <div className="cli-pane" style={{ width: '680px', maxWidth: '96vw', border: '1px solid var(--primary)', maxHeight: '92vh', overflowY: 'auto' }}>
        {/* Top Header */}
        <div className="cli-pane-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <img src="./logo.png" alt="ObsiForge" style={{ width: '22px', height: '22px', objectFit: 'contain', filter: 'drop-shadow(0 0 6px #00e5ff)' }} />
            <span className="header-allcaps">OBSIFORGE // SYSTEM ACCESS &amp; AUTHENTICATION GATE</span>
          </div>
          <span className="text-secondary" style={{ fontSize: '10px', fontWeight: 700 }}>v1.0.2b [BETA]</span>
        </div>

        {/* ASCII Banner */}
        <div style={{ padding: '12px 16px 0 16px', textAlign: 'center' }}>
          <pre style={{ color: 'var(--primary)', fontSize: '10px', margin: 0, lineHeight: '1.2', overflowX: 'auto', userSelect: 'none' }}>
            {ASCII_LOGO}
          </pre>
          <div className="text-muted" style={{ fontSize: '11px', marginTop: '4px', letterSpacing: '0.1em' }}>
            [ CYBER-INDUSTRIAL MINECRAFT CLOUD &amp; LOCAL ENGINE CORE ]
          </div>
        </div>

        {/* Status Alert Banner */}
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

        {/* ========================================================================= */}
        {/* STEP 1: AUTHENTICATION TABS (REGISTER / LOGIN)                            */}
        {/* ========================================================================= */}
        {authMode !== 'oci_onboarding' ? (
          <div style={{ padding: '16px' }}>
            {/* Mode Switcher */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '16px' }}>
              <button
                className={`cli-btn ${authMode === 'register' ? '' : 'cli-btn-muted'}`}
                style={{ flex: 1, padding: '10px', border: 'none', borderBottom: authMode === 'register' ? '2px solid var(--primary)' : 'none', fontWeight: 700 }}
                onClick={() => { setAuthMode('register'); setStatusMsg(null); }}
              >
                <UserPlus size={13} /> [ CREATE ADMINISTRATOR ACCOUNT ]
              </button>
              <button
                className={`cli-btn ${authMode === 'login' ? 'cli-btn-secondary' : 'cli-btn-muted'}`}
                style={{ flex: 1, padding: '10px', border: 'none', borderBottom: authMode === 'login' ? '2px solid var(--secondary)' : 'none', fontWeight: 700 }}
                onClick={() => { setAuthMode('login'); setStatusMsg(null); }}
              >
                <LogIn size={13} /> [ ADMINISTRATOR LOGIN ]
              </button>
            </div>

            {/* Registration Form */}
            {authMode === 'register' ? (
              <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ background: '#071507', border: '1px solid var(--border)', padding: '10px', fontSize: '11px', color: 'var(--primary)' }}>
                  <strong>[!] INITIAL SETUP NOTICE:</strong> The account created here will be permanently designated as the cluster <strong>ADMINISTRATOR &amp; OWNER</strong>. When other players connect to your servers, you can grant them OP permissions from the Players tab.
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                    ADMINISTRATOR USERNAME:
                  </label>
                  <input
                    type="text"
                    className="cli-input"
                    placeholder="e.g. ServerAdmin, CyberMaster..."
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                    CONTACT / RECOVERY EMAIL:
                  </label>
                  <input
                    type="email"
                    className="cli-input"
                    placeholder="admin@obsiforge.net..."
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                    MASTER PASSWORD (MIN 8 CHARACTERS):
                  </label>
                  <input
                    type="password"
                    className="cli-input"
                    placeholder="Master password..."
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={8}
                    required
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                  <span className="text-muted" style={{ fontSize: '11px' }}>
                    ENCRYPTION: PBKDF2 + SHA-256 + NEON DB CLOUD BACKED
                  </span>
                  <button type="submit" className="cli-btn" style={{ fontWeight: 800, padding: '8px 16px' }} disabled={loading}>
                    <UserPlus size={13} /> [{loading ? 'PROVISIONING...' : 'INITIALIZE ADMIN ACCOUNT'}]
                  </button>
                </div>
              </form>
            ) : (
              /* Login Form */
              <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                    ADMINISTRATOR USERNAME OR EMAIL:
                  </label>
                  <input
                    type="text"
                    className="cli-input"
                    placeholder="Enter your username or email..."
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                    MASTER PASSWORD:
                  </label>
                  <input
                    type="password"
                    className="cli-input"
                    placeholder="Enter master password..."
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                  <span className="text-muted" style={{ fontSize: '11px' }}>
                    BRUTE-FORCE LOCKOUT: ACTIVE (5 RETRIES MAX)
                  </span>
                  <button type="submit" className="cli-btn cli-btn-secondary" style={{ fontWeight: 800, padding: '8px 16px' }} disabled={loading}>
                    <LogIn size={13} /> [{loading ? 'AUTHENTICATING...' : 'SIGN IN TO OBSIFORGE'}]
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : (
          /* ========================================================================= */
          /* ========================================================================= */
          /* STEP 2: ORACLE CLOUD 24/7 SETUP (OPTIONAL)                                */
          /* ========================================================================= */
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="cli-pane" style={{ background: '#0b1d0b', border: '1px solid var(--primary)', padding: '12px' }}>
              <div style={{ fontWeight: 800, fontSize: '13px', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Cloud size={16} /> ORACLE CLOUD 24/7 SETUP (OPTIONAL - CAN CONFIGURE LATER IN SETTINGS)
              </div>
              <p className="text-muted" style={{ fontSize: '11px', marginTop: '4px', lineHeight: '1.5' }}>
                ObsiForge can host and operate your 24/7 Minecraft server on your Oracle Cloud Infrastructure (OCI) instance (Always-Free ARM up to 24GB RAM). You can configure your keys now or enter the dashboard and add them anytime later from <strong>[7] 24/7 CLOUD &amp; TUNNELS</strong>.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, display: 'block', marginBottom: '3px' }}>
                  TENANCY OCID:
                </label>
                <input
                  type="text"
                  className="cli-input"
                  placeholder="ocid1.tenancy.oc1..aaaaaxxxx..."
                  value={ociConfig.tenancyOcid}
                  onChange={(e) => setOciConfig({ ...ociConfig, tenancyOcid: e.target.value })}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, display: 'block', marginBottom: '3px' }}>
                  USER OCID:
                </label>
                <input
                  type="text"
                  className="cli-input"
                  placeholder="ocid1.user.oc1..aaaaaxxxx..."
                  value={ociConfig.userOcid}
                  onChange={(e) => setOciConfig({ ...ociConfig, userOcid: e.target.value })}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, display: 'block', marginBottom: '3px' }}>
                  COMPARTMENT OCID:
                </label>
                <input
                  type="text"
                  className="cli-input"
                  placeholder="ocid1.compartment.oc1..aaaaaxxxx... (or tenancy OCID)"
                  value={ociConfig.compartmentOcid}
                  onChange={(e) => setOciConfig({ ...ociConfig, compartmentOcid: e.target.value })}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, display: 'block', marginBottom: '3px' }}>
                  API KEY FINGERPRINT:
                </label>
                <input
                  type="text"
                  className="cli-input"
                  placeholder="20:3b:97:13:55:1c:xx:xx..."
                  value={ociConfig.fingerprint}
                  onChange={(e) => setOciConfig({ ...ociConfig, fingerprint: e.target.value })}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, display: 'block', marginBottom: '3px' }}>
                  OCI REGION:
                </label>
                <select
                  className="cli-select"
                  style={{ width: '100%' }}
                  value={ociConfig.region}
                  onChange={(e) => setOciConfig({ ...ociConfig, region: e.target.value })}
                >
                  {regions.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, display: 'block', marginBottom: '3px' }}>
                  INSTANCE PUBLIC IPV4:
                </label>
                <input
                  type="text"
                  className="cli-input"
                  placeholder="e.g. 129.153.xx.xx"
                  value={ociConfig.instanceIp}
                  onChange={(e) => setOciConfig({ ...ociConfig, instanceIp: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, display: 'block', marginBottom: '3px' }}>
                PRIVATE KEY (PEM FORMAT):
              </label>
              <textarea
                className="cli-input"
                style={{ minHeight: '75px', fontSize: '10px', fontFamily: 'monospace' }}
                placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;MIIEowIBAAKCAQEA...&#10;-----END RSA PRIVATE KEY-----"
                value={ociConfig.privateKeyPem}
                onChange={(e) => setOciConfig({ ...ociConfig, privateKeyPem: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', flexWrap: 'wrap', gap: '8px' }}>
              <button
                type="button"
                className="cli-btn cli-btn-muted"
                style={{ fontSize: '11px', padding: '8px 16px' }}
                onClick={() => {
                  if (authenticatedUser) {
                    onAuthenticated(authenticatedUser);
                  }
                }}
              >
                [ SKIP FOR NOW // ENTER MAIN DASHBOARD ]
              </button>
              <button
                className="cli-btn"
                style={{ fontWeight: 800, padding: '8px 18px', background: 'rgba(51, 255, 0, 0.15)' }}
                onClick={handleSaveOciAndProceed}
                disabled={loading}
              >
                <ArrowRight size={13} /> [{loading ? 'ENCRYPTING & VERIFYING...' : 'SAVE OCI & ENTER DASHBOARD'}]
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
