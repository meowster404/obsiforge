import React, { useState, useEffect } from 'react';
import { ServerConfig, SystemInfo, ResourceStats, ServerLog } from './types/electron';
import { Header } from './components/Header';
import { Navigation, NavTab } from './components/Navigation';
import { ConsoleView } from './components/ConsoleView';
import { MetricsView } from './components/MetricsView';
import { AddonsView } from './components/AddonsView';
import { PlayersView } from './components/PlayersView';
import { ConfigView } from './components/ConfigView';
import { BackupsView } from './components/BackupsView';
import { CloudNetworkView } from './components/CloudNetworkView';
import { WatchdogView } from './components/WatchdogView';
import { CreateServerModal } from './components/CreateServerModal';
import { AuthModal } from './components/AuthModal';
import { AuthGate } from './components/AuthGate';
import { ServersHubView } from './components/ServersHubView';
import { CloudServerDirModal } from './components/CloudServerDirModal';
import { DownloadProgressModal, DownloadProgressState } from './components/DownloadProgressModal';
import { UpdateModal } from './components/UpdateModal';
import { gitHubUpdater, UpdateInfo } from './services/updater';
import { neonAuth, ObsiUser, OciGuiConfig } from './services/neonAuth';

export const App: React.FC = () => {
  const [servers, setServers] = useState<ServerConfig[]>([]);
  const [currentServer, setCurrentServer] = useState<ServerConfig | null>(null);
  const [isManagingServer, setIsManagingServer] = useState(false);
  const [activeTab, setActiveTab] = useState<NavTab>('console');
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [stats, setStats] = useState<ResourceStats | null>(null);
  const [logs, setLogs] = useState<ServerLog[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isCloudDirModalOpen, setIsCloudDirModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<ObsiUser | null>(neonAuth.getCurrentUser());
  const [ociConfig, setOciConfig] = useState<OciGuiConfig | null>(null);
  const [isOciRequired, setIsOciRequired] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [downloadState, setDownloadState] = useState<DownloadProgressState>({
    isOpen: false,
    status: 'idle',
    engine: 'paper',
    mcVersion: '',
    percent: 0
  });

  // Initial Load
  useEffect(() => {
    loadServers();

    // Auto check for software updates from GitHub Releases on application boot
    gitHubUpdater.checkForUpdates().then(info => {
      setUpdateInfo(info);
    });

    neonAuth.loadOciConfig().then(cfg => {
      if (cfg && cfg.instanceIp && cfg.tenancyOcid) {
        setOciConfig(cfg);
        setIsOciRequired(false);
      } else if (currentUser) {
        setIsOciRequired(true);
      }
    });

    if (window.mcServerAPI) {
      window.mcServerAPI.getSystemInfo().then(setSystemInfo);

      // Event Listeners
      const unsubLog = window.mcServerAPI.onServerLog((logData) => {
        setLogs(prev => [...prev.slice(-800), logData]);
      });

      const unsubStatus = window.mcServerAPI.onServerStatusChanged(({ serverId, status }) => {
        setServers(prev => prev.map(s => s.id === serverId ? { ...s, status: status as any } : s));
        setCurrentServer(prev => prev && prev.id === serverId ? { ...prev, status: status as any } : prev);
      });

      const unsubStats = window.mcServerAPI.onResourceStats((s) => {
        setStats(s);
      });

      const unsubDownload = window.mcServerAPI.onDownloadProgress((data) => {
        setDownloadState({
          isOpen: true,
          status: data.status || 'downloading',
          engine: data.engine || 'Engine',
          mcVersion: data.mcVersion || '',
          jarName: data.jarName || 'server.jar',
          downloadedBytes: data.downloadedBytes || 0,
          totalBytes: data.totalBytes || 0,
          percent: data.percent !== undefined ? data.percent : (data.status === 'completed' ? 100 : 50),
          error: data.error
        });
      });

      return () => {
        unsubLog();
        unsubStatus();
        unsubStats();
        unsubDownload();
      };
    }
  }, [currentUser]);

  // Keyboard shortcut listener for tabs (1 to 8)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const tabMap: Record<string, NavTab> = {
        '1': 'console',
        '2': 'metrics',
        '3': 'addons',
        '4': 'players',
        '5': 'config',
        '6': 'backups',
        '7': 'cloud',
        '8': 'watchdog'
      };
      if (tabMap[e.key]) {
        setActiveTab(tabMap[e.key]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const loadServers = async () => {
    if (!window.mcServerAPI) return;
    try {
      const list = await window.mcServerAPI.getServers();
      setServers(list);
      // Background sync server registry with Neon Cloud DB
      neonAuth.syncServersToCloud(list).catch(() => {});
    } catch (e) {
      console.error('Error fetching servers:', e);
    }
  };

  // Actions
  const handleStartServer = async () => {
    if (!currentServer) return;
    const res = await window.mcServerAPI.startServer(currentServer.id);
    if (!res.success && res.message) {
      alert(res.message);
    }
  };

  const handleStopServer = async () => {
    if (!currentServer) return;
    await window.mcServerAPI.stopServer(currentServer.id);
  };

  const handleRestartServer = async () => {
    if (!currentServer) return;
    await window.mcServerAPI.restartServer(currentServer.id);
  };

  const handleKillServer = async () => {
    if (!currentServer) return;
    if (confirm('FORCE KILL: This may corrupt unsaved world chunks. Are you sure?')) {
      await window.mcServerAPI.killServer(currentServer.id);
    }
  };

  const handleSendCommand = async (command: string) => {
    if (!currentServer) return;
    await window.mcServerAPI.sendCommand(currentServer.id, command);
  };

  const handleCreateServer = async (config: any) => {
    const created = await window.mcServerAPI.createServer(config);
    setServers(prev => {
      const updated = [...prev, created];
      neonAuth.syncServersToCloud(updated).catch(() => {});
      return updated;
    });
    setCurrentServer(created);
    setIsManagingServer(true);
  };

  const handleDeleteServer = async (serverId: string) => {
    const target = servers.find(s => s.id === serverId);
    if (!confirm(`Are you sure you want to delete server "${target?.name || serverId}"? This will permanently delete the server directory and worlds.`)) {
      return;
    }
    try {
      await window.mcServerAPI.deleteServer(serverId);
    } catch (err) {
      console.warn('Delete server warning (force updating local state):', err);
    }
    setServers(prev => {
      const updated = prev.filter(s => s.id !== serverId);
      neonAuth.syncServersToCloud(updated).catch(() => {});
      return updated;
    });
    if (currentServer?.id === serverId) {
      setCurrentServer(null);
      setIsManagingServer(false);
    }
  };

  const handleUpdateServerConfig = async (updated: Partial<ServerConfig>) => {
    if (!currentServer) return;
    const res = await window.mcServerAPI.updateServer(currentServer.id, updated);
    if (res) {
      setCurrentServer(res);
      setServers(prev => {
        const next = prev.map(s => s.id === res.id ? res : s);
        neonAuth.syncServersToCloud(next).catch(() => {});
        return next;
      });
    }
  };

  const handleOpenFolder = () => {
    setIsCloudDirModalOpen(true);
  };

  // If user is not authenticated or lacks mandatory Oracle Cloud keys, render full-screen AuthGate
  if (!currentUser || isOciRequired) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden', background: '#0a0a0a' }}>
        <div className="crt-overlay" />
        <AuthGate
          initialMode={isOciRequired ? 'oci_onboarding' : undefined}
          onAuthenticated={(user) => {
            setCurrentUser(user);
            setIsOciRequired(false);
            neonAuth.loadOciConfig().then(cfg => { if (cfg) setOciConfig(cfg); });
          }}
        />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden', background: '#0a0a0a' }}>
      {/* CRT Scanline Overlay Effect */}
      <div className="crt-overlay" />

      {/* Header Bar */}
      <Header
        servers={servers}
        currentServer={currentServer}
        systemInfo={systemInfo}
        currentUser={currentUser}
        ociConfig={ociConfig}
        isManagingServer={isManagingServer}
        onBackToHub={() => setIsManagingServer(false)}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onSelectServer={(s) => {
          setCurrentServer(s);
          setIsManagingServer(true);
          setLogs([]);
        }}
        onOpenCreateModal={() => setIsCreateModalOpen(true)}
        onStartServer={handleStartServer}
        onStopServer={handleStopServer}
        onRestartServer={handleRestartServer}
        onKillServer={handleKillServer}
        onOpenFolder={handleOpenFolder}
        onOpenUpdateModal={() => setIsUpdateModalOpen(true)}
        hasUpdate={updateInfo?.hasUpdate}
      />

      {/* Navigation Tab Bar - Only active when managing a selected server */}
      {isManagingServer && (
        <Navigation activeTab={activeTab} onSelectTab={setActiveTab} />
      )}

      {/* Main Content Workspace Panes */}
      <main style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {!isManagingServer ? (
          <ServersHubView
            servers={servers}
            ociConfig={ociConfig}
            onSelectServer={(s) => {
              setCurrentServer(s);
              setIsManagingServer(true);
              setLogs([]);
            }}
            onOpenCreateModal={() => setIsCreateModalOpen(true)}
            onStartServer={async (id) => {
              const res = await window.mcServerAPI.startServer(id);
              if (!res.success && res.message) alert(res.message);
            }}
            onStopServer={async (id) => {
              await window.mcServerAPI.stopServer(id);
            }}
            onDeleteServer={handleDeleteServer}
          />
        ) : (
          <>
            {activeTab === 'console' && (
              <ConsoleView
                server={currentServer}
                logs={logs}
                onSendCommand={handleSendCommand}
                onClearLogs={() => setLogs([])}
              />
            )}

            {activeTab === 'metrics' && (
              <MetricsView
                server={currentServer}
                stats={stats}
                systemInfo={systemInfo}
              />
            )}

            {activeTab === 'addons' && (
              <AddonsView server={currentServer} />
            )}

            {activeTab === 'players' && (
              <PlayersView
                server={currentServer}
                currentUser={currentUser}
                onSendCommand={handleSendCommand}
              />
            )}

            {activeTab === 'config' && (
              <ConfigView
                server={currentServer}
                onUpdateServerConfig={handleUpdateServerConfig}
                onDeleteServer={handleDeleteServer}
              />
            )}

            {activeTab === 'backups' && (
              <BackupsView server={currentServer} />
            )}

            {activeTab === 'cloud' && (
              <CloudNetworkView
                server={currentServer}
                onConfigUpdated={(cfg) => setOciConfig(cfg)}
              />
            )}

            {activeTab === 'watchdog' && (
              <WatchdogView
                server={currentServer}
                onUpdateServerConfig={handleUpdateServerConfig}
              />
            )}
          </>
        )}
      </main>

      {/* Server Creation Modal */}
      <CreateServerModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={handleCreateServer}
        maxCloudRam={ociConfig?.allocatedRamGb || 24}
      />

      {/* Neon DB & User Authentication Modal / Settings */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        currentUser={currentUser}
        onUserChanged={setCurrentUser}
      />

      {/* Oracle Cloud Remote Server Directory Explorer Modal */}
      <CloudServerDirModal
        isOpen={isCloudDirModalOpen}
        onClose={() => setIsCloudDirModalOpen(false)}
        server={currentServer}
        ociConfig={ociConfig}
      />

      {/* Engine Jar Download Progress Modal */}
      <DownloadProgressModal
        state={downloadState}
        onClose={() => setDownloadState(prev => ({ ...prev, isOpen: false }))}
      />

      {/* GitHub Releases & Software Update Modal */}
      <UpdateModal
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
        updateInfo={updateInfo}
        onRefreshCheck={async () => {
          const info = await gitHubUpdater.checkForUpdates();
          setUpdateInfo(info);
        }}
      />
    </div>
  );
};

export default App;
