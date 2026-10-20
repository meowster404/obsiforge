import React from 'react';
import { ServerConfig, SystemInfo } from '../types/electron';
import { ObsiUser, OciGuiConfig, cleanMinecraftAddress } from '../services/neonAuth';
import { Play, Square, RotateCw, Skull, Plus, Folder, Terminal, Shield, Key, Server, ChevronLeft, Cloud, Copy, Check, Globe } from 'lucide-react';

interface HeaderProps {
  servers: ServerConfig[];
  currentServer: ServerConfig | null;
  systemInfo: SystemInfo | null;
  currentUser: ObsiUser | null;
  ociConfig?: OciGuiConfig | null;
  isManagingServer: boolean;
  onBackToHub: () => void;
  onOpenAuthModal: () => void;
  onSelectServer: (server: ServerConfig) => void;
  onOpenCreateModal: () => void;
  onStartServer: () => void;
  onStopServer: () => void;
  onRestartServer: () => void;
  onKillServer: () => void;
  onOpenFolder: () => void;
  onOpenUpdateModal?: () => void;
  hasUpdate?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  servers,
  currentServer,
  systemInfo,
  currentUser,
  ociConfig,
  isManagingServer,
  onBackToHub,
  onOpenAuthModal,
  onSelectServer,
  onOpenCreateModal,
  onStartServer,
  onStopServer,
  onRestartServer,
  onKillServer,
  onOpenFolder,
  onOpenUpdateModal,
  hasUpdate
}) => {
  const [copiedIp, setCopiedIp] = React.useState(false);
  const status = currentServer?.status || 'stopped';

  const getMinecraftAddress = () => {
    if (currentServer?.tunnelAddress) {
      return cleanMinecraftAddress(currentServer.tunnelAddress);
    }
    if (ociConfig?.tunnelAddress) {
      return cleanMinecraftAddress(ociConfig.tunnelAddress);
    }
    const rawIp = cleanMinecraftAddress(ociConfig?.instanceIp);
    const ip = rawIp && rawIp.length > 0 ? rawIp : '127.0.0.1';
    const port = currentServer?.port || 25565;
    return port === 25565 ? ip : `${ip}:${port}`;
  };

  const handleCopyIp = () => {
    navigator.clipboard.writeText(getMinecraftAddress());
    setCopiedIp(true);
    setTimeout(() => setCopiedIp(false), 2000);
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'running':
        return <span className="status-badge status-online">● [ONLINE]</span>;
      case 'starting':
        return <span className="status-badge status-starting">▲ [STARTING...]</span>;
      case 'stopping':
        return <span className="status-badge status-starting">▼ [STOPPING...]</span>;
      default:
        return <span className="status-badge status-stopped">■ [OFFLINE]</span>;
    }
  };

  const getTierLabel = () => {
    if (!ociConfig?.cloudTier || ociConfig.cloudTier === 'ampere_a1') return 'AMPERE A1';
    if (ociConfig.cloudTier === 'amd_micro') return 'AMD MICRO';
    return 'CUSTOM VM';
  };

  return (
    <header className="cli-pane" style={{ borderBottom: '1px solid var(--border)', background: '#070f07' }}>
      {/* Top Banner Row */}
      <div style={{ padding: '6px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px dashed #143314', flexWrap: 'wrap', gap: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img
            src="./logo.png"
            alt="ObsiForge Logo"
            style={{ width: '24px', height: '24px', objectFit: 'contain', filter: 'drop-shadow(0 0 6px #00e5ff)' }}
          />
          <span className="header-allcaps" style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '0.12em' }}>
            OBSIFORGE
          </span>
          <span className="status-badge" style={{ fontSize: '10px', padding: '1px 5px', color: 'var(--secondary)', borderColor: 'var(--secondary)' }}>
            v1.0.0b [BETA]
          </span>
          <span className="text-muted" style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            | <Cloud size={11} color="var(--primary)" /> OCI VM: <strong className="text-primary">{getTierLabel()}</strong>
          </span>
          <span className="text-muted" style={{ fontSize: '11px' }}>
            | ALLOC: {ociConfig?.allocatedRamGb || 24}GB RAM / {ociConfig?.allocatedCpus || 4} OCPUs
          </span>
          <span className="text-muted" style={{ fontSize: '11px' }}>
            | REGION: <span className="text-cyan">{ociConfig?.region || 'ap-mumbai-1'}</span>
          </span>
          <span className="text-muted" style={{ fontSize: '11px' }}>
            | HOST: {ociConfig?.instanceIp ? ociConfig.instanceIp : '127.0.0.1 (LOCAL)'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isManagingServer && getStatusBadge()}
          {isManagingServer && (
            <span className="text-amber" style={{ fontSize: '11px' }}>
              ENGINE: {currentServer?.engine.toUpperCase() || 'NONE'} {currentServer?.mcVersion || ''}
            </span>
          )}
          {isManagingServer && currentServer && !currentServer.onlineMode && (
            <span className="status-badge" style={{ borderColor: 'var(--secondary)', color: 'var(--secondary)' }}>
              [CRACKED]
            </span>
          )}

          {/* Minecraft Java Client Connection IP Badge */}
          {isManagingServer && currentServer && (
            <button
              className="cli-btn"
              onClick={handleCopyIp}
              title="Click to copy Minecraft Java Multiplayer Server Address"
              style={{
                fontSize: '11px',
                padding: '2px 10px',
                borderColor: copiedIp ? 'var(--primary)' : 'var(--cyan)',
                color: copiedIp ? 'var(--primary)' : 'var(--cyan)',
                background: 'rgba(0, 229, 255, 0.08)',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                cursor: 'pointer'
              }}
            >
              {copiedIp ? <Check size={12} color="var(--primary)" /> : <Copy size={12} color="var(--cyan)" />}
              <span>{copiedIp ? '[ COPIED IP! ]' : `[ JAVA IP: ${getMinecraftAddress()} ]`}</span>
            </button>
          )}

          {/* Check for Updates Badge / Button */}
          <button
            className={`cli-btn ${hasUpdate ? '' : 'cli-btn-muted'}`}
            style={{
              fontSize: '11px',
              padding: '2px 8px',
              borderColor: hasUpdate ? 'var(--secondary)' : undefined,
              color: hasUpdate ? 'var(--secondary)' : undefined,
              background: hasUpdate ? 'rgba(255, 176, 0, 0.12)' : undefined,
              fontWeight: hasUpdate ? 800 : 500
            }}
            onClick={onOpenUpdateModal}
            title="Check for software updates from GitHub Releases"
          >
            <RotateCw size={11} className={hasUpdate ? 'animate-pulse' : ''} />
            <span>{hasUpdate ? '[ ▲ UPDATE AVAIL ]' : '[ UPDATES ]'}</span>
          </button>

          {/* User Account / Profile Badge */}
          <button
            className={`cli-btn ${currentUser ? 'cli-btn-secondary' : 'cli-btn-muted'}`}
            style={{ fontSize: '11px', padding: '2px 8px' }}
            onClick={onOpenAuthModal}
            title="User Profile & Audit Logs"
          >
            {currentUser ? (
              <>
                <Shield size={12} /> [{currentUser.username.toUpperCase()} // {currentUser.role.toUpperCase()}]
              </>
            ) : (
              <>
                <Key size={12} /> [ LOGIN / ACCOUNT ]
              </>
            )}
          </button>
        </div>
      </div>

      {/* Controls & Server Switcher Row */}
      <div style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        {/* Left: Server Switcher or Hub title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {isManagingServer ? (
            <>
              <button
                className="cli-btn cli-btn-secondary"
                onClick={onBackToHub}
                title="Return to Servers Directory Hub"
                style={{ fontWeight: 800, padding: '4px 10px' }}
              >
                <ChevronLeft size={14} /> [ &lt; ALL SERVERS ]
              </button>

              <span className="text-muted" style={{ fontSize: '12px' }}>TARGET_NODE:</span>
              <select
                className="cli-select"
                value={currentServer?.id || ''}
                onChange={(e) => {
                  const selected = servers.find(s => s.id === e.target.value);
                  if (selected) onSelectServer(selected);
                }}
              >
                {servers.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} [{s.engine.toUpperCase()} {s.mcVersion}] :{s.port}
                  </option>
                ))}
              </select>

              <button className="cli-btn cli-btn-secondary" onClick={onOpenCreateModal} title="Create new server instance">
                <Plus size={14} /> [ + NEW NODE ]
              </button>

              {currentServer && (
                <button className="cli-btn cli-btn-muted" onClick={onOpenFolder} title="Open Cloud Server Directory (Oracle VM Remote Filesystem)">
                  <Folder size={14} /> [ DIR ]
                </button>
              )}
            </>
          ) : (
            <>
              <span className="text-primary" style={{ fontSize: '13px', fontWeight: 800 }}>
                &gt; CLUSTER NODES HUB
              </span>
              <span className="text-muted" style={{ fontSize: '11px' }}>
                [{servers.length} configured instance{servers.length === 1 ? '' : 's'}]
              </span>
            </>
          )}
        </div>

        {/* Right: Master Process Controls (Only when managing active server) */}
        {isManagingServer && currentServer && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {status === 'stopped' ? (
              <button
                className="cli-btn"
                onClick={onStartServer}
                disabled={!currentServer}
                style={{ fontWeight: 700 }}
              >
                <Play size={14} /> [ INITIATE SERVER ]
              </button>
            ) : (
            <>
              <button
                className="cli-btn cli-btn-danger"
                onClick={onStopServer}
                disabled={status === 'stopping'}
                title="Graceful Stop (/stop)"
              >
                <Square size={14} /> [ STOP ]
              </button>
              <button
                className="cli-btn cli-btn-secondary"
                onClick={onRestartServer}
                disabled={status === 'stopping'}
                title="Graceful Restart"
              >
                <RotateCw size={14} /> [ RESTART ]
              </button>
              <button
                className="cli-btn cli-btn-danger"
                onClick={onKillServer}
                title="Force Kill Process (SIGKILL)"
                style={{ opacity: 0.8 }}
              >
                <Skull size={14} /> [ FORCE KILL ]
              </button>
            </>
          )}
        </div>
        )}
      </div>
    </header>
  );
};
