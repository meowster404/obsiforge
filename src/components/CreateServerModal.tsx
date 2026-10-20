import React, { useState, useEffect } from 'react';
import { ServerConfig } from '../types/electron';
import { Plus, X, Download, AlertTriangle, ShieldCheck, RefreshCw } from 'lucide-react';
import { ENDPOINTS } from '../config/endpoints';

interface CreateServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (config: any) => Promise<void>;
  maxCloudRam?: number;
}

export const CreateServerModal: React.FC<CreateServerModalProps> = ({
  isOpen,
  onClose,
  onCreate,
  maxCloudRam = 24
}) => {
  const [name, setName] = useState('NODE_SURVIVAL_01');
  const [engine, setEngine] = useState<'paper' | 'purpur' | 'fabric' | 'vanilla' | 'forge'>('paper');
  const [mcVersion, setMcVersion] = useState('Latest Release (Auto-Detect: 26.3)');
  const [versions, setVersions] = useState<string[]>([
    'Latest Release (Auto-Detect: 26.3)',
    '26.3',
    '26.2',
    '26.1',
    '26.0',
    '1.21.4',
    '1.21.3',
    '1.21.1',
    '1.21',
    '1.20.6',
    '1.20.4',
    '1.20.1',
    '1.19.4',
    '1.18.2',
    '1.16.5',
    '1.12.2'
  ]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [port, setPort] = useState(25565);
  const [minRam, setMinRam] = useState(2);
  const [maxRam, setMaxRam] = useState(Math.min(8, maxCloudRam));
  const [onlineMode, setOnlineMode] = useState(false);
  const [downloadEngine, setDownloadEngine] = useState(true);
  const [seed, setSeed] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleGenerateRandomSeed = () => {
    const sign = Math.random() > 0.5 ? '' : '-';
    const randPart = Math.floor(Math.random() * 8999999999999999 + 1000000000000000).toString();
    setSeed(`${sign}${randPart}`);
  };

  // Fetch live versions dynamically from official APIs whenever the engine changes
  useEffect(() => {
    let isCancelled = false;

    async function fetchLiveVersions() {
      setLoadingVersions(true);
      try {
        if (engine === 'paper') {
          const res = await fetch(ENDPOINTS.PAPER_API);
          const data = await res.json();
          if (!isCancelled && data.versions && Array.isArray(data.versions)) {
            const list = [...data.versions].reverse();
            setVersions([`Latest Release (Auto-Detect: ${list[0]})`, ...list]);
          }
        } else if (engine === 'purpur') {
          const res = await fetch(ENDPOINTS.PURPUR_API);
          const data = await res.json();
          if (!isCancelled && data.versions && Array.isArray(data.versions)) {
            const list = [...data.versions].reverse();
            setVersions([`Latest Release (Auto-Detect: ${list[0]})`, ...list]);
          }
        } else if (engine === 'fabric') {
          const res = await fetch(`${ENDPOINTS.FABRIC_META}/game`);
          const data = await res.json();
          if (!isCancelled && Array.isArray(data)) {
            const stable = data.filter((v: any) => v.stable).map((v: any) => v.version);
            setVersions([`Latest Release (Auto-Detect: ${stable[0]})`, ...stable]);
          }
        } else {
          // Vanilla / Mojang manifest
          const res = await fetch(ENDPOINTS.MOJANG_MANIFEST);
          const data = await res.json();
          if (!isCancelled && data.versions) {
            const releases = data.versions
              .filter((v: any) => v.type === 'release')
              .map((v: any) => v.id);
            setVersions([`Latest Release (Auto-Detect: ${data.latest?.release || releases[0]})`, ...releases.slice(0, 35)]);
          }
        }
      } catch (e) {
        console.warn('Failed fetching live versions from engine API, using fallback cache:', e);
      } finally {
        if (!isCancelled) setLoadingVersions(false);
      }
    }

    fetchLiveVersions();
    return () => {
      isCancelled = true;
    };
  }, [engine]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onCreate({
        name,
        engine,
        mcVersion,
        port,
        minRam,
        maxRam,
        onlineMode,
        downloadEngine,
        seed: seed.trim(),
        autoRestart: true,
        useAikarFlags: true
      });
      onClose();
    } catch (err: any) {
      alert('Error creating server: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(0, 0, 0, 0.85)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000
    }}>
      <div className="cli-pane" style={{ width: '600px', maxWidth: '95vw', border: '1px solid var(--primary)' }}>
        <div className="cli-pane-header">
          <span className="header-allcaps" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <img src="./logo.png" alt="ObsiForge" style={{ width: '18px', height: '18px', objectFit: 'contain', filter: 'drop-shadow(0 0 4px #00e5ff)' }} />
            <span>+--- INITIATE NEW MINECRAFT NODE ---+</span>
          </span>
          <button className="cli-btn cli-btn-muted" style={{ padding: '1px 6px' }} onClick={onClose}>
            <X size={12} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Node Name & Port */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                SERVER NODE NAME:
              </label>
              <input
                type="text"
                className="cli-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <span className="text-muted" style={{ fontSize: '10px', marginTop: '4px', display: 'block' }}>
                Join Address: <strong className="text-cyan">{(name || 'node').toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'node'}.[code].obsiforge.ply.gg</strong>
              </span>
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                PORT:
              </label>
              <input
                type="number"
                className="cli-input"
                value={port}
                onChange={(e) => setPort(parseInt(e.target.value, 10))}
                required
              />
            </div>
          </div>

          {/* Engine & MC Version */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                SERVER ENGINE:
              </label>
              <select
                className="cli-select"
                style={{ width: '100%' }}
                value={engine}
                onChange={(e) => setEngine(e.target.value as any)}
              >
                <option value="paper">Paper (Fast, Plugin Support) [Recommended]</option>
                <option value="purpur">Purpur (High Performance, Custom Tweaks)</option>
                <option value="fabric">Fabric (Modern Mod Support)</option>
                <option value="vanilla">Vanilla (Official Mojang)</option>
                <option value="forge">Forge (Classic Modpacks)</option>
              </select>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700 }}>
                  MINECRAFT VERSION:
                </label>
                <span className="text-cyan" style={{ fontSize: '10px', fontWeight: 600 }}>
                  {loadingVersions ? '▲ [FETCHING LIVE API...]' : '● [OFFICIAL API SYNCED]'}
                </span>
              </div>
              <select
                className="cli-select"
                style={{ width: '100%' }}
                value={mcVersion}
                onChange={(e) => setMcVersion(e.target.value)}
              >
                {versions.map(v => (
                  <option key={v} value={v}>Minecraft {v}</option>
                ))}
              </select>
            </div>
          </div>

          {/* World Seed (Auto-random if blank) */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700 }}>
                WORLD SEED: <span className="text-muted" style={{ fontWeight: 400 }}>(Auto-generates random seed if left blank)</span>
              </label>
              <button
                type="button"
                className="cli-btn cli-btn-secondary"
                style={{ fontSize: '10px', padding: '2px 8px' }}
                onClick={handleGenerateRandomSeed}
              >
                🎲 [ RANDOM SEED ]
              </button>
            </div>
            <input
              type="text"
              className="cli-input"
              style={{ fontSize: '12px', fontFamily: 'monospace' }}
              placeholder="e.g. -4829104810294821 or leave blank for auto-random..."
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
            />
          </div>

          {/* RAM Allocation based on Cloud Tier */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700 }}>MIN RAM (-Xms):</label>
                <span className="text-amber" style={{ fontSize: '11px', fontWeight: 800 }}>{minRam} GB</span>
              </div>
              <input
                type="range"
                min="1"
                max={Math.max(2, Math.floor(maxCloudRam / 2))}
                value={minRam}
                onChange={(e) => setMinRam(parseInt(e.target.value, 10))}
                style={{ width: '100%', accentColor: 'var(--primary)' }}
              />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700 }}>MAX RAM (-Xmx):</label>
                <span className="text-primary" style={{ fontSize: '11px', fontWeight: 800 }}>{maxRam} GB / {maxCloudRam} GB</span>
              </div>
              <input
                type="range"
                min="1"
                max={maxCloudRam}
                value={maxRam}
                onChange={(e) => setMaxRam(parseInt(e.target.value, 10))}
                style={{ width: '100%', accentColor: 'var(--primary)' }}
              />
            </div>
          </div>

          {/* Cracked Client Support Toggle */}
          <div style={{
            background: !onlineMode ? '#1c1203' : '#050a05',
            border: `1px solid ${!onlineMode ? 'var(--secondary)' : 'var(--border)'}`,
            padding: '10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '12px', color: !onlineMode ? 'var(--secondary)' : 'var(--primary)' }}>
                  ENABLE CRACKED / OFFLINE CLIENTS (online-mode=false)
                </div>
                <div className="text-muted" style={{ fontSize: '10px' }}>
                  Allows friends with cracked/non-premium launchers to join your server.
                </div>
              </div>
              <input
                type="checkbox"
                checked={!onlineMode}
                onChange={(e) => setOnlineMode(!e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: 'var(--secondary)', cursor: 'pointer' }}
              />
            </div>
          </div>

          {/* Auto Download Engine Checkbox */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              id="autoDownload"
              checked={downloadEngine}
              onChange={(e) => setDownloadEngine(e.target.checked)}
              style={{ accentColor: 'var(--primary)' }}
            />
            <label htmlFor="autoDownload" style={{ fontSize: '11px', cursor: 'pointer' }}>
              Automatically download official {engine.toUpperCase()} server jar from API
            </label>
          </div>

          {/* Footer Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <button type="button" className="cli-btn cli-btn-muted" onClick={onClose} disabled={isSubmitting}>
              [ CANCEL ]
            </button>
            <button type="submit" className="cli-btn" style={{ fontWeight: 800 }} disabled={isSubmitting}>
              <Download size={13} /> [{isSubmitting ? 'PROVISIONING...' : 'INITIALIZE SERVER'}]
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
