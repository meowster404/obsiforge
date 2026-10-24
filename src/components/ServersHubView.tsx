import React, { useState } from 'react';
import { ServerConfig } from '../types/electron';
import { OciGuiConfig, cleanMinecraftAddress } from '../services/neonAuth';
import { Plus, Play, Square, Terminal, Server, Trash2, Globe, Copy, Check } from 'lucide-react';
import { MINI_ASCII_BANNER } from '../utils/ascii';

interface ServersHubViewProps {
  servers: ServerConfig[];
  ociConfig?: OciGuiConfig | null;
  onSelectServer: (server: ServerConfig) => void;
  onOpenCreateModal: () => void;
  onStartServer: (serverId: string) => void;
  onStopServer: (serverId: string) => void;
  onDeleteServer: (serverId: string) => void;
}

export const ServersHubView: React.FC<ServersHubViewProps> = ({
  servers,
  ociConfig,
  onSelectServer,
  onOpenCreateModal,
  onStartServer,
  onStopServer,
  onDeleteServer
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const getMinecraftAddress = (server: ServerConfig) => {
    if (server.tunnelAddress) {
      return cleanMinecraftAddress(server.tunnelAddress);
    }
    if (ociConfig?.tunnelAddress) {
      return cleanMinecraftAddress(ociConfig.tunnelAddress);
    }
    const rawIp = cleanMinecraftAddress(ociConfig?.instanceIp);
    const ip = rawIp && rawIp.length > 0 ? rawIp : '127.0.0.1';
    return server.port === 25565 ? ip : `${ip}:${server.port}`;
  };

  const handleCopy = (serverId: string, address: string) => {
    navigator.clipboard.writeText(address);
    setCopiedId(serverId);
    setTimeout(() => setCopiedId(null), 2000);
  };
  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', height: '100%', flex: 1, background: '#0a0a0a', gap: '16px', overflowY: 'auto' }}>
      {/* Banner */}
      <pre style={{ color: 'var(--muted-text)', fontSize: '11px', margin: 0, overflowX: 'auto', userSelect: 'none' }}>
        {MINI_ASCII_BANNER}
      </pre>

      {/* Top Action Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
        <div>
          <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--primary)', letterSpacing: '0.1em' }}>
            &gt; CLUSTER NODES &amp; SERVERS DIRECTORY
          </div>
          <div className="text-muted" style={{ fontSize: '11px', marginTop: '2px' }}>
            Select an existing Minecraft server to manage its console, mods, and telemetry, or initiate a new server instance.
          </div>
        </div>

        <button className="cli-btn" style={{ fontWeight: 800, padding: '8px 16px' }} onClick={onOpenCreateModal}>
          <Plus size={14} /> [ + CREATE NEW MINECRAFT SERVER ]
        </button>
      </div>

      {/* Server Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
        {servers.map((s) => {
          const isOnline = s.status === 'running';
          const isStarting = s.status === 'starting';

          return (
            <div
              key={s.id}
              className="cli-pane"
              style={{
                border: isOnline ? '1px solid var(--primary)' : '1px solid var(--border)',
                background: isOnline ? '#071507' : '#0a0f0a',
                transition: 'border-color 0.2s'
              }}
            >
              {/* Card Header */}
              <div className="cli-pane-header" style={{ background: isOnline ? '#0c220c' : '#081208' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Server size={14} color={isOnline ? 'var(--primary)' : 'var(--muted-text)'} />
                  <span style={{ fontWeight: 800, fontSize: '13px' }}>{s.name}</span>
                </span>

                {isOnline ? (
                  <span className="status-badge status-online">● ONLINE</span>
                ) : isStarting ? (
                  <span className="status-badge status-starting">▲ STARTING</span>
                ) : (
                  <span className="status-badge status-stopped">■ STOPPED</span>
                )}
              </div>

              {/* Card Content */}
              <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11px' }}>
                  <div>
                    <span className="text-muted">ENGINE: </span>
                    <strong className="text-primary">{s.engine.toUpperCase()}</strong>
                  </div>
                  <div>
                    <span className="text-muted">MC VERSION: </span>
                    <strong className="text-amber">{s.mcVersion}</strong>
                  </div>
                  <div>
                    <span className="text-muted">NETWORK PORT: </span>
                    <span className="text-cyan">:{s.port}</span>
                  </div>
                  <div>
                    <span className="text-muted">CLIENT ACCESS: </span>
                    <span style={{ color: !s.onlineMode ? 'var(--secondary)' : 'var(--primary)' }}>
                      {!s.onlineMode ? '[CRACKED OK]' : '[PREMIUM ONLY]'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted">MEMORY: </span>
                    <span>-Xms{s.minRam}G -Xmx{s.maxRam}G</span>
                  </div>
                  <div>
                    <span className="text-muted">WATCHDOG: </span>
                    <span style={{ color: s.autoRestart ? 'var(--primary)' : 'var(--muted-text)' }}>
                      {s.autoRestart ? '[ACTIVE]' : '[OFF]'}
                    </span>
                  </div>
                </div>

                {/* Minecraft Java Client Direct Connect Address */}
                <div style={{
                  background: 'rgba(0, 229, 255, 0.05)',
                  border: '1px solid rgba(0, 229, 255, 0.25)',
                  padding: '6px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderRadius: '2px',
                  marginTop: '4px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--cyan)' }}>
                    <Globe size={13} />
                    <span>JAVA IP: <strong>{getMinecraftAddress(s)}</strong></span>
                  </div>
                  <button
                    className="cli-btn"
                    style={{
                      padding: '2px 8px',
                      fontSize: '10px',
                      borderColor: copiedId === s.id ? 'var(--primary)' : 'var(--cyan)',
                      color: copiedId === s.id ? 'var(--primary)' : 'var(--cyan)',
                      fontWeight: 700
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopy(s.id, getMinecraftAddress(s));
                    }}
                    title="Copy Minecraft Java Direct Connect IP Address"
                  >
                    {copiedId === s.id ? <Check size={11} /> : <Copy size={11} />}
                    <span>{copiedId === s.id ? '[ COPIED ]' : '[ COPY IP ]'}</span>
                  </button>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '8px', borderTop: '1px dashed #143314', paddingTop: '10px', marginTop: '4px' }}>
                  <button
                    className="cli-btn"
                    style={{ flex: 1, justifyContent: 'center', fontWeight: 800 }}
                    onClick={() => onSelectServer(s)}
                  >
                    <Terminal size={13} /> [ MANAGE SERVER -&gt; ]
                  </button>

                  {!isOnline ? (
                    <button
                      className="cli-btn cli-btn-secondary"
                      style={{ padding: '4px 10px' }}
                      onClick={(e) => { e.stopPropagation(); onStartServer(s.id); }}
                      title="Quick Start"
                    >
                      <Play size={13} /> [ START ]
                    </button>
                  ) : (
                    <button
                      className="cli-btn cli-btn-danger"
                      style={{ padding: '4px 10px' }}
                      onClick={(e) => { e.stopPropagation(); onStopServer(s.id); }}
                      title="Quick Stop"
                    >
                      <Square size={13} /> [ STOP ]
                    </button>
                  )}

                  <button
                    className="cli-btn cli-btn-danger"
                    style={{ padding: '4px 8px' }}
                    onClick={(e) => { e.stopPropagation(); onDeleteServer(s.id); }}
                    title="Delete Node"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {/* Blank Create New Server Card */}
        <div
          onClick={onOpenCreateModal}
          style={{
            border: '2px dashed var(--border)',
            padding: '30px 20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            background: 'rgba(51, 255, 0, 0.02)',
            minHeight: '180px',
            transition: 'border-color 0.2s, background 0.2s'
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = 'var(--primary)';
            (e.currentTarget as HTMLElement).style.background = 'rgba(51, 255, 0, 0.06)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
            (e.currentTarget as HTMLElement).style.background = 'rgba(51, 255, 0, 0.02)';
          }}
        >
          <Plus size={28} color="var(--primary)" style={{ marginBottom: '8px' }} />
          <div style={{ fontWeight: 800, fontSize: '13px', color: 'var(--primary)' }}>
            [ + CREATE NEW MINECRAFT SERVER ]
          </div>
          <div className="text-muted" style={{ fontSize: '11px', marginTop: '4px', textAlign: 'center' }}>
            One-click installer for Paper, Fabric, Purpur, Vanilla &amp; Forge
          </div>
        </div>
      </div>
    </div>
  );
};
