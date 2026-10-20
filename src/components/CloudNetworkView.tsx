import React, { useState, useEffect } from 'react';
import { ServerConfig } from '../types/electron';
import { neonAuth, OciGuiConfig, cleanMinecraftAddress } from '../services/neonAuth';
import { Cloud, Copy, Check, Terminal, ExternalLink, ShieldCheck, Play, Square, Key, Save, Download, Server, RefreshCw, Eye, EyeOff, Cpu, HardDrive, Globe, Zap } from 'lucide-react';

interface CloudNetworkViewProps {
  server: ServerConfig | null;
  onConfigUpdated?: (config: OciGuiConfig) => void;
}

export const CloudNetworkView: React.FC<CloudNetworkViewProps> = ({ server, onConfigUpdated }) => {
  const [subTab, setSubTab] = useState<'oci_config' | 'scripts' | 'tunnels'>('oci_config');

  // Oracle Cloud GUI Configuration State
  const [ociConfig, setOciConfig] = useState<OciGuiConfig>({
    tenancyOcid: '',
    userOcid: '',
    compartmentOcid: '',
    fingerprint: '',
    region: 'us-ashburn-1',
    privateKeyPem: '',
    instanceIp: '',
    instancePort: 25565,
    tunnelAddress: '',
    securityListOcid: '',
    cloudTier: 'ampere_a1',
    allocatedRamGb: 24,
    allocatedCpus: 4
  });

  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Playit state
  const [playitLogs, setPlayitLogs] = useState<string[]>([]);
  const [playitRunning, setPlayitRunning] = useState(false);

  useEffect(() => {
    if (server) {
      setOciConfig(prev => ({ ...prev, instancePort: server.port || 25565 }));
    }

    if (window.mcServerAPI) {
      const unsub = window.mcServerAPI.onTunnelLog((log) => {
        setPlayitLogs(prev => [...prev.slice(-30), log]);

        // Auto-detect *.ply.gg or *.tun.ply.gg from playit CLI stdout
        const match = log.match(/([a-zA-Z0-9-]+\.(?:tun\.)?ply\.gg(?::\d+)?)/i);
        if (match && match[1]) {
          const detected = cleanMinecraftAddress(match[1]);
          setOciConfig(prev => {
            if (!prev.tunnelAddress) {
              return { ...prev, tunnelAddress: detected };
            }
            return prev;
          });
        }
      });
      return () => unsub();
    }
  }, [server]);

  useEffect(() => {
    neonAuth.loadOciConfig().then(loaded => {
      if (loaded) {
        setOciConfig(loaded);
        if (onConfigUpdated) onConfigUpdated(loaded);
      }
    });
  }, []);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSaveOciConfig = async () => {
    setStatusMsg({ type: 'info', text: 'Encrypting and persisting OCI configuration...' });
    const success = await neonAuth.saveOciConfig(ociConfig);
    if (success) {
      if (onConfigUpdated) onConfigUpdated(ociConfig);
      setStatusMsg({ type: 'success', text: 'Oracle Cloud configuration saved and encrypted successfully!' });
    } else {
      setStatusMsg({ type: 'error', text: 'Failed persisting OCI configuration.' });
    }
  };

  const handleStartPlayit = async () => {
    setPlayitRunning(true);
    const res = await window.mcServerAPI.startPlayitTunnel();
    if (!res.success) {
      alert(res.message);
      setPlayitRunning(false);
    }
  };

  const handleStopPlayit = async () => {
    await window.mcServerAPI.stopPlayitTunnel();
    setPlayitRunning(false);
  };

  const regions = [
    'us-ashburn-1', 'us-phoenix-1', 'us-sanjose-1', 'us-chicago-1',
    'eu-frankfurt-1', 'eu-amsterdam-1', 'uk-london-1',
    'ap-mumbai-1', 'ap-hyderabad-1', 'ap-tokyo-1', 'ap-seoul-1', 'ap-sydney-1',
    'sa-saopaulo-1', 'me-dubai-1'
  ];

  const currentPort = ociConfig.instancePort || server?.port || 25565;

  // Dynamically generated OCI OS Firewall script
  const generatedIptablesCommand = `sudo iptables -I INPUT 1 -p tcp --dport ${currentPort} -j ACCEPT && sudo iptables -I INPUT 1 -p udp --dport ${currentPort} -j ACCEPT && sudo netfilter-persistent save`;

  // Dynamically generated complete OCI cloud setup script
  const generatedFullBashScript = `#!/bin/bash
# ====================================================================
# OBSIFORGE // ORACLE CLOUD AUTOMATED MINECRAFT 24/7 SETUP SCRIPT
# Generated for: ${ociConfig.instanceIp || 'your-instance-ip'} | Port: ${currentPort}
# Region: ${ociConfig.region}
# ====================================================================

set -e
echo "[OBSIFORGE] Initiating OCI instance hardening & Minecraft environment..."

# 1. Update packages & install Adoptium Java 21 LTS
sudo apt update && sudo apt install -y wget curl gnupg software-properties-common iptables-persistent ufw

if ! command -v java &> /dev/null; then
  echo "[OBSIFORGE] Installing Java 21..."
  sudo mkdir -p /etc/apt/keyrings
  wget -O - https://packages.adoptium.net/artifactory/api/gpg/key/public | sudo tee /etc/apt/keyrings/adoptium.asc
  echo "deb [signed-by=/etc/apt/keyrings/adoptium.asc] https://packages.adoptium.net/artifactory/deb $(awk -F= '/^VERSION_CODENAME/{print$2}' /etc/os-release) main" | sudo tee /etc/apt/sources.list.d/adoptium.list
  sudo apt update && sudo apt install -y temurin-21-jdk
fi

# 2. Configure OS Firewall (iptables) for Port ${currentPort} (TCP & UDP)
echo "[OBSIFORGE] Unblocking port ${currentPort} in iptables..."
sudo iptables -I INPUT 1 -p tcp --dport ${currentPort} -j ACCEPT
sudo iptables -I INPUT 1 -p udp --dport ${currentPort} -j ACCEPT
sudo netfilter-persistent save

# 3. Kernel TCP BBR Congestion Control for Lag-Free Connection
echo "net.core.default_qdisc=fq" | sudo tee -a /etc/sysctl.conf
echo "net.ipv4.tcp_congestion_control=bbr" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# 4. Install 24/7 Systemd Daemon Service (Keeps Server Online When PC / App Closes)
echo "[OBSIFORGE] Configuring 24/7 Systemd Daemon Service..."
sudo mkdir -p /home/ubuntu/obsiforge/servers/active
sudo tee /etc/systemd/system/obsiforge-minecraft.service > /dev/null <<EOF
[Unit]
Description=ObsiForge 24/7 Dedicated Minecraft Cloud Node
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/obsiforge/servers/active
ExecStart=/usr/bin/java -Xms${ociConfig.allocatedRamGb && ociConfig.allocatedRamGb > 4 ? Math.floor(ociConfig.allocatedRamGb / 2) : 2}G -Xmx${ociConfig.allocatedRamGb || 20}G -XX:+UseG1GC -jar server.jar nogui
Restart=always
RestartSec=10
StandardInput=null
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable obsiforge-minecraft

echo "[OBSIFORGE] Configuration complete! 24/7 Systemd Service & Port ${currentPort} are ACTIVE."
echo "[OBSIFORGE] The Minecraft server will now stay running 24/7 in Oracle Cloud even if your desktop app or PC is shut down!"
echo "[OBSIFORGE] Public Join IP: ${ociConfig.instanceIp || 'YOUR_INSTANCE_IP'}:${currentPort}"
`;

  const handleDownloadSetupScript = () => {
    const blob = new Blob([generatedFullBashScript], { type: 'text/x-shellscript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `obsiforge_oci_setup_${currentPort}.sh`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getResolvedAddress = () => {
    if (ociConfig.tunnelAddress && ociConfig.tunnelAddress.trim()) {
      return cleanMinecraftAddress(ociConfig.tunnelAddress);
    }
    if (ociConfig.instanceIp && ociConfig.instanceIp.trim()) {
      const cleanIp = cleanMinecraftAddress(ociConfig.instanceIp);
      return currentPort === 25565 ? cleanIp : `${cleanIp}:${currentPort}`;
    }
    return `127.0.0.1:${currentPort}`;
  };

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', height: '100%', flex: 1, background: '#0a0a0a', gap: '14px', overflowY: 'auto' }}>
      {/* Minecraft Java Client Connection Address Banner */}
      <div className="cli-pane" style={{
        background: 'linear-gradient(90deg, #07181c 0%, #0a1f18 100%)',
        border: '1px solid var(--cyan)',
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              background: 'rgba(0, 229, 255, 0.12)',
              border: '1px solid var(--cyan)',
              padding: '10px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Globe size={26} color="var(--cyan)" />
            </div>

            <div>
              <div style={{ fontSize: '11px', color: 'var(--muted-text)', fontWeight: 700, letterSpacing: '0.08em' }}>
                MINECRAFT JAVA MULTIPLAYER SERVER ADDRESS:
              </div>
              <div style={{ fontSize: '22px', fontWeight: 900, color: 'var(--cyan)', fontFamily: "'JetBrains Mono', Consolas, monospace", letterSpacing: '0.06em', marginTop: '2px' }}>
                {getResolvedAddress()}
              </div>
              <div className="text-muted" style={{ fontSize: '11px', marginTop: '3px' }}>
                * In Minecraft Java: <strong>Multiplayer</strong> &gt; <strong>Direct Connection</strong> (or Add Server) &gt; Paste this address &gt; <strong>Join Server</strong>
              </div>
            </div>
          </div>

          <button
            className="cli-btn"
            style={{
              padding: '10px 20px',
              fontSize: '12px',
              fontWeight: 800,
              borderColor: copiedKey === 'server_ip' ? 'var(--primary)' : 'var(--cyan)',
              color: copiedKey === 'server_ip' ? 'var(--primary)' : 'var(--cyan)',
              background: 'rgba(0, 229, 255, 0.12)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer'
            }}
            onClick={() => copyToClipboard(getResolvedAddress(), 'server_ip')}
          >
            {copiedKey === 'server_ip' ? <Check size={16} /> : <Copy size={16} />}
            <span>{copiedKey === 'server_ip' ? '[ COPIED TO CLIPBOARD! ]' : '[ COPY MINECRAFT ADDRESS ]'}</span>
          </button>
        </div>

        {/* Quick Paste / Edit Address bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderTop: '1px dashed #143324', paddingTop: '10px', flexWrap: 'wrap' }}>
          <span className="text-muted" style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>
            CUSTOM TUNNEL / DOMAIN (e.g. Playit.gg):
          </span>
          <input
            type="text"
            className="cli-input"
            style={{ flex: 1, minWidth: '280px', fontSize: '12px', borderColor: 'var(--cyan)' }}
            placeholder="e.g. survival-node.a8f2.obsiforge.ply.gg or mc.mydomain.com"
            value={ociConfig.tunnelAddress || ''}
            onChange={(e) => {
              const cleaned = cleanMinecraftAddress(e.target.value);
              setOciConfig(prev => ({ ...prev, tunnelAddress: cleaned }));
            }}
          />
          <button
            className="cli-btn cli-btn-secondary"
            style={{ fontSize: '11px', padding: '6px 14px', fontWeight: 800 }}
            onClick={handleSaveOciConfig}
            title="Save custom server domain / tunnel address"
          >
            <Save size={12} /> [ SAVE ADDRESS ]
          </button>
        </div>
      </div>

      {/* Subtabs with generous vertical padding to prevent top border clipping */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '6px 4px 10px 4px', gap: '8px', overflowX: 'auto', alignItems: 'center' }}>
        <button
          className={`cli-btn ${subTab === 'oci_config' ? '' : 'cli-btn-muted'}`}
          style={subTab === 'oci_config' ? { borderColor: 'var(--primary)', color: 'var(--primary)', background: 'rgba(51, 255, 0, 0.12)', boxShadow: '0 0 8px rgba(51, 255, 0, 0.25)' } : {}}
          onClick={() => setSubTab('oci_config')}
        >
          <Cloud size={13} /> [ 1. ORACLE CLOUD GUI CONFIG ]
        </button>
        <button
          className={`cli-btn ${subTab === 'scripts' ? '' : 'cli-btn-muted'}`}
          style={subTab === 'scripts' ? { borderColor: 'var(--secondary)', color: 'var(--secondary)', background: 'rgba(255, 176, 0, 0.12)', boxShadow: '0 0 8px rgba(255, 176, 0, 0.25)' } : {}}
          onClick={() => setSubTab('scripts')}
        >
          <Terminal size={13} /> [ 2. DYNAMIC FIREWALL &amp; SCRIPTS ]
        </button>
        <button
          className={`cli-btn ${subTab === 'tunnels' ? '' : 'cli-btn-muted'}`}
          style={subTab === 'tunnels' ? { borderColor: 'var(--cyan)', color: 'var(--cyan)', background: 'rgba(0, 229, 255, 0.12)', boxShadow: '0 0 8px rgba(0, 229, 255, 0.25)' } : {}}
          onClick={() => setSubTab('tunnels')}
        >
          <ShieldCheck size={13} /> [ 3. PLAYIT &amp; PINGGY TUNNELS ]
        </button>
      </div>

      {statusMsg && (
        <div style={{
          padding: '8px 12px',
          background: statusMsg.type === 'error' ? 'rgba(255, 51, 51, 0.12)' : statusMsg.type === 'success' ? 'rgba(51, 255, 0, 0.1)' : 'rgba(255, 176, 0, 0.1)',
          border: '1px solid var(--border)',
          color: statusMsg.type === 'error' ? 'var(--error)' : statusMsg.type === 'success' ? 'var(--primary)' : 'var(--secondary)',
          fontSize: '11px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span>&gt;</span>
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: ORACLE CLOUD GUI CONFIGURATION                                     */}
      {/* ========================================================================= */}
      {subTab === 'oci_config' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Cloud Tier & Resources Allocation Card */}
          <div className="cli-pane">
            <div className="cli-pane-header">
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Cpu size={14} color="var(--primary)" /> ORACLE CLOUD COMPUTE SHAPE &amp; RESOURCE ALLOCATION
              </span>
              <span className="text-cyan">[HOST CONFIGURATION]</span>
            </div>

            <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                    ORACLE CLOUD INSTANCE TIER:
                  </label>
                  <select
                    className="cli-select"
                    style={{ width: '100%' }}
                    value={ociConfig.cloudTier || 'ampere_a1'}
                    onChange={(e) => {
                      const tier = e.target.value;
                      if (tier === 'ampere_a1') {
                        setOciConfig({ ...ociConfig, cloudTier: tier, allocatedRamGb: 24, allocatedCpus: 4 });
                      } else if (tier === 'amd_micro') {
                        setOciConfig({ ...ociConfig, cloudTier: tier, allocatedRamGb: 1, allocatedCpus: 1 });
                      } else {
                        setOciConfig({ ...ociConfig, cloudTier: tier });
                      }
                    }}
                  >
                    <option value="ampere_a1">Oracle Always Free Ampere A1 (Up to 4 OCPUs / 24 GB RAM)</option>
                    <option value="amd_micro">Oracle Always Free AMD E2.1.Micro (1 OCPU / 1 GB RAM)</option>
                    <option value="custom">Custom OCI Compute Instance</option>
                  </select>
                  <span className="text-muted" style={{ fontSize: '10px', marginTop: '2px', display: 'block' }}>
                    ObsiForge automatically calibrates Minecraft memory ceilings up to this allocation.
                  </span>
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                    ALLOCATED VM RAM (GB):
                  </label>
                  <input
                    type="number"
                    className="cli-input"
                    min={1}
                    max={64}
                    value={ociConfig.allocatedRamGb || 24}
                    onChange={(e) => setOciConfig({ ...ociConfig, allocatedRamGb: parseInt(e.target.value, 10) || 4 })}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                    ALLOCATED VM CORES (OCPUS):
                  </label>
                  <input
                    type="number"
                    className="cli-input"
                    min={1}
                    max={16}
                    value={ociConfig.allocatedCpus || 4}
                    onChange={(e) => setOciConfig({ ...ociConfig, allocatedCpus: parseInt(e.target.value, 10) || 1 })}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* OCI Credentials Form */}
          <div className="cli-pane">
            <div className="cli-pane-header">
              <span>&gt; ORACLE CLOUD INFRASTRUCTURE (OCI) CONFIGURATION PARAMETERS</span>
              <span className="text-cyan">[GUI CONTROLLED]</span>
            </div>

            <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {/* Tenancy OCID */}
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                    TENANCY OCID:
                  </label>
                  <input
                    type="text"
                    className="cli-input"
                    placeholder="ocid1.tenancy.oc1..aaaaaaaaxxxxxxxxx..."
                    value={ociConfig.tenancyOcid}
                    onChange={(e) => setOciConfig({ ...ociConfig, tenancyOcid: e.target.value })}
                  />
                </div>

                {/* User OCID */}
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                    USER OCID:
                  </label>
                  <input
                    type="text"
                    className="cli-input"
                    placeholder="ocid1.user.oc1..aaaaaaaaxxxxxxxxx..."
                    value={ociConfig.userOcid}
                    onChange={(e) => setOciConfig({ ...ociConfig, userOcid: e.target.value })}
                  />
                </div>

                {/* Compartment OCID */}
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                    COMPARTMENT OCID:
                  </label>
                  <input
                    type="text"
                    className="cli-input"
                    placeholder="ocid1.compartment.oc1..aaaaaaaaxxxxxxxxx..."
                    value={ociConfig.compartmentOcid}
                    onChange={(e) => setOciConfig({ ...ociConfig, compartmentOcid: e.target.value })}
                  />
                </div>

                {/* Region */}
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                    OCI REGION:
                  </label>
                  <select
                    className="cli-select"
                    style={{ width: '100%' }}
                    value={ociConfig.region}
                    onChange={(e) => setOciConfig({ ...ociConfig, region: e.target.value })}
                  >
                    {regions.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                {/* Key Fingerprint */}
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                    API KEY FINGERPRINT:
                  </label>
                  <input
                    type="text"
                    className="cli-input"
                    placeholder="20:3b:97:13:55:1c:xx:xx:xx:xx..."
                    value={ociConfig.fingerprint}
                    onChange={(e) => setOciConfig({ ...ociConfig, fingerprint: e.target.value })}
                  />
                </div>

                {/* Instance Public IP */}
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                    ORACLE INSTANCE PUBLIC IPV4:
                  </label>
                  <input
                    type="text"
                    className="cli-input"
                    placeholder="e.g., 129.153.44.12"
                    value={ociConfig.instanceIp}
                    onChange={(e) => setOciConfig({ ...ociConfig, instanceIp: e.target.value })}
                  />
                </div>

                {/* Tunnel Address or Custom Domain */}
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                    PUBLIC JOIN ADDRESS / TUNNEL (PLAYIT / PINGGY):
                  </label>
                  <input
                    type="text"
                    className="cli-input"
                    placeholder="e.g. survival-node.a8f2.obsiforge.ply.gg"
                    value={ociConfig.tunnelAddress || ''}
                    onChange={(e) => setOciConfig({ ...ociConfig, tunnelAddress: cleanMinecraftAddress(e.target.value) })}
                  />
                  <span className="text-muted" style={{ fontSize: '10px', marginTop: '2px', display: 'block' }}>
                    Paste your Playit/Pinggy address. ObsiForge cleans http/https and paths automatically.
                  </span>
                </div>
              </div>

              {/* Private Key PEM with Eye Toggle */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700 }}>
                    OCI PRIVATE KEY (PEM FORMAT):
                  </label>
                  <button
                    type="button"
                    className="cli-btn cli-btn-muted"
                    style={{ padding: '2px 8px', fontSize: '10px' }}
                    onClick={() => setShowPrivateKey(!showPrivateKey)}
                  >
                    {showPrivateKey ? <EyeOff size={12} /> : <Eye size={12} />}
                    <span>[{showPrivateKey ? 'HIDE PRIVATE KEY' : 'REVEAL PRIVATE KEY'}]</span>
                  </button>
                </div>

                {showPrivateKey ? (
                  <textarea
                    className="cli-input"
                    style={{ minHeight: '90px', resize: 'vertical', fontFamily: 'monospace', fontSize: '11px' }}
                    placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;MIIEowIBAAKCAQEA0...&#10;-----END RSA PRIVATE KEY-----"
                    value={ociConfig.privateKeyPem}
                    onChange={(e) => setOciConfig({ ...ociConfig, privateKeyPem: e.target.value })}
                  />
                ) : (
                  <div
                    onClick={() => setShowPrivateKey(true)}
                    className="cli-input"
                    style={{
                      minHeight: '40px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      color: 'var(--muted-text)',
                      fontSize: '11px'
                    }}
                  >
                    <span>
                      {ociConfig.privateKeyPem ? '●●●●●●●●●●●●●●●●●●●●●●●●●●●●●● [SECURE RSA PRIVATE KEY LOADED - CLICK REVEAL TO EDIT]' : '[NO PRIVATE KEY CONFIGURED - CLICK TO INPUT]'}
                    </span>
                    <span style={{ color: 'var(--primary)', fontSize: '10px' }}>[CLICK TO REVEAL / EDIT]</span>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                <span className="text-muted" style={{ fontSize: '11px' }}>
                  STORAGE: AES-GCM Encrypted &amp; Synced to Neon DB upon save.
                </span>
                <button className="cli-btn" style={{ fontWeight: 800 }} onClick={handleSaveOciConfig}>
                  <Save size={13} /> [ PERSIST OCI CONFIG ]
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: DYNAMIC FIREWALL & SCRIPTS (BASED ON GUI CONFIG)                     */}
      {/* ========================================================================= */}
      {subTab === 'scripts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Cloud Ingress Rule Specs */}
          <div className="cli-pane">
            <div className="cli-pane-header">
              <span>&gt; STEP 1: OCI CONSOLE VCN INGRESS RULE (DYNAMIC PARAMETERS)</span>
              <span className="text-amber">[REQUIRED]</span>
            </div>
            <div style={{ padding: '12px', fontSize: '12px' }}>
              <p className="text-muted" style={{ marginBottom: '8px' }}>
                In your Oracle Cloud Console &gt; <strong>Networking &gt; VCNs &gt; Default Security List</strong>, add the following Ingress Rule:
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', background: '#050a05', padding: '10px', border: '1px solid var(--border)' }}>
                <div><span className="text-muted">SOURCE CIDR:</span> <strong className="text-amber">0.0.0.0/0</strong></div>
                <div><span className="text-muted">IP PROTOCOL:</span> <strong className="text-cyan">TCP &amp; UDP</strong></div>
                <div><span className="text-muted">DESTINATION PORT:</span> <strong className="text-primary">{currentPort}</strong></div>
                <div><span className="text-muted">STATELESS:</span> <strong>NO (Unchecked)</strong></div>
              </div>
            </div>
          </div>

          {/* Quick OS Firewall Command */}
          <div className="cli-pane">
            <div className="cli-pane-header">
              <span>&gt; STEP 2: LINUX OS FIREWALL COMMAND (IPTABLES)</span>
              <span className="text-primary">[PORT: {currentPort}]</span>
            </div>
            <div style={{ padding: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', background: '#000', border: '1px solid var(--border)', padding: '8px', gap: '8px' }}>
                <code style={{ flex: 1, fontSize: '11px', color: 'var(--primary)', overflowX: 'auto', whiteSpace: 'nowrap' }}>
                  {generatedIptablesCommand}
                </code>
                <button
                  className="cli-btn"
                  style={{ padding: '3px 8px', fontSize: '11px' }}
                  onClick={() => copyToClipboard(generatedIptablesCommand, 'iptables_dyn')}
                >
                  {copiedKey === 'iptables_dyn' ? <Check size={12} /> : <Copy size={12} />} [COPY]
                </button>
              </div>
            </div>
          </div>

          {/* Complete Standalone Setup Bash Script */}
          <div className="cli-pane">
            <div className="cli-pane-header">
              <span>&gt; COMPLETE AUTOMATED OCI SETUP SCRIPT (BASH)</span>
              <button className="cli-btn cli-btn-secondary" style={{ padding: '2px 8px', fontSize: '11px' }} onClick={handleDownloadSetupScript}>
                <Download size={11} /> [ DOWNLOAD .SH SCRIPT ]
              </button>
            </div>
            <div style={{ padding: '12px' }}>
              <textarea
                className="cli-input"
                style={{ minHeight: '160px', fontFamily: 'monospace', fontSize: '11px', resize: 'vertical' }}
                readOnly
                value={generatedFullBashScript}
              />
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: PLAYIT & PINGGY TUNNELS                                            */}
      {/* ========================================================================= */}
      {subTab === 'tunnels' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          {/* Playit.gg */}
          <div className="cli-pane">
            <div className="cli-pane-header">
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShieldCheck size={14} color="var(--primary)" /> PLAYIT.GG CLI TUNNEL
              </span>
              <span className="text-cyan">{playitRunning ? '[ACTIVE]' : '[STANDBY]'}</span>
            </div>
            <div style={{ padding: '14px', fontSize: '12px' }}>
              <p className="text-muted" style={{ marginBottom: '10px' }}>
                Public encrypted tunnel to play with friends without port forwarding.
              </p>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                {!playitRunning ? (
                  <button className="cli-btn" onClick={handleStartPlayit}>
                    <Play size={12} /> [ START PLAYIT AGENT ]
                  </button>
                ) : (
                  <button className="cli-btn cli-btn-danger" onClick={handleStopPlayit}>
                    <Square size={12} /> [ STOP AGENT ]
                  </button>
                )}
                <a href="https://playit.gg/download" target="_blank" rel="noreferrer" className="cli-btn cli-btn-muted">
                  <ExternalLink size={12} /> [ DOWNLOAD CLI ]
                </a>
              </div>
              <div style={{ background: '#000', border: '1px solid var(--border)', padding: '8px', minHeight: '80px', maxHeight: '130px', overflowY: 'auto', fontSize: '11px', color: 'var(--muted-text)', marginBottom: '10px' }}>
                {playitLogs.length === 0 ? '> Standby. Click [START PLAYIT AGENT] to claim URL or paste tunnel address below.' : playitLogs.map((l, i) => <div key={i}>{l}</div>)}
              </div>

              {/* Paste / Bind Playit Address */}
              <div style={{ borderTop: '1px dashed #143324', paddingTop: '10px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--primary)', display: 'block', marginBottom: '4px' }}>
                  YOUR PLAYIT ADDRESS (e.g. survival-node.a8f2.obsiforge.ply.gg):
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    className="cli-input"
                    placeholder="Paste playit URL (e.g. https://tunnel-node.obsiforge.ply.gg/)"
                    value={ociConfig.tunnelAddress || ''}
                    onChange={(e) => setOciConfig({ ...ociConfig, tunnelAddress: cleanMinecraftAddress(e.target.value) })}
                    style={{ flex: 1, fontSize: '11px' }}
                  />
                  <button
                    className="cli-btn cli-btn-secondary"
                    style={{ fontSize: '11px', padding: '4px 10px', whiteSpace: 'nowrap', fontWeight: 800 }}
                    onClick={handleSaveOciConfig}
                  >
                    <Zap size={12} /> [ SET AS SERVER IP ]
                  </button>
                </div>
                <span className="text-muted" style={{ fontSize: '10px', marginTop: '3px', display: 'block' }}>
                  ObsiForge automatically strips "https://" and trailing "/" so Minecraft connects seamlessly.
                </span>
              </div>
            </div>
          </div>

          {/* Pinggy */}
          <div className="cli-pane">
            <div className="cli-pane-header">
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Terminal size={14} color="var(--primary)" /> PINGGY SSH TCP TUNNEL
              </span>
              <span className="text-amber">[ZERO INSTALL]</span>
            </div>
            <div style={{ padding: '14px', fontSize: '12px' }}>
              <p className="text-muted" style={{ marginBottom: '10px' }}>
                Instant TCP tunnel through an SSH reverse proxy:
              </p>
              <div style={{ display: 'flex', alignItems: 'center', background: '#000', border: '1px solid var(--border)', padding: '8px', gap: '8px', marginBottom: '12px' }}>
                <code style={{ flex: 1, fontSize: '11px', color: 'var(--primary)', overflowX: 'auto', whiteSpace: 'nowrap' }}>
                  ssh -p 443 -R0:localhost:{currentPort} a.pinggy.io tcp
                </code>
                <button
                  className="cli-btn"
                  style={{ padding: '3px 8px', fontSize: '11px' }}
                  onClick={() => copyToClipboard(`ssh -p 443 -R0:localhost:${currentPort} a.pinggy.io tcp`, 'pinggy_t')}
                >
                  {copiedKey === 'pinggy_t' ? <Check size={12} /> : <Copy size={12} />} [COPY]
                </button>
              </div>
              <p className="text-muted" style={{ fontSize: '11px' }}>
                Run this single command in terminal. Share the public URL assigned by Pinggy with your friends to play immediately.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
