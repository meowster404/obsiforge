const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mcServerAPI', {
  // System
  getSystemInfo: () => ipcRenderer.invoke('system:get-info'),
  detectJavaRuntimes: () => ipcRenderer.invoke('system:detect-java'),
  openExternalUrl: (url) => ipcRenderer.invoke('system:open-url', url),
  openFolder: (path) => ipcRenderer.invoke('system:open-folder', path),

  // Servers Management
  getServers: () => ipcRenderer.invoke('servers:get-all'),
  createServer: (serverConfig) => ipcRenderer.invoke('servers:create', serverConfig),
  updateServer: (serverId, data) => ipcRenderer.invoke('servers:update', serverId, data),
  deleteServer: (serverId) => ipcRenderer.invoke('servers:delete', serverId),

  // Server Process Control
  startServer: (serverId) => ipcRenderer.invoke('server:start', serverId),
  stopServer: (serverId) => ipcRenderer.invoke('server:stop', serverId),
  restartServer: (serverId) => ipcRenderer.invoke('server:restart', serverId),
  killServer: (serverId) => ipcRenderer.invoke('server:kill', serverId),
  sendCommand: (serverId, command) => ipcRenderer.invoke('server:send-command', serverId, command),
  getServerStatus: (serverId) => ipcRenderer.invoke('server:get-status', serverId),

  // Properties & Config
  getProperties: (serverId) => ipcRenderer.invoke('server:get-properties', serverId),
  saveProperties: (serverId, properties) => ipcRenderer.invoke('server:save-properties', serverId, properties),
  getWorldInfo: (serverId) => ipcRenderer.invoke('server:get-world-info', serverId),
  resetWorld: (serverId, newSeed) => ipcRenderer.invoke('server:reset-world', serverId, newSeed),
  getRawFile: (serverId, fileName) => ipcRenderer.invoke('server:get-raw-file', serverId, fileName),
  saveRawFile: (serverId, fileName, content) => ipcRenderer.invoke('server:save-raw-file', serverId, fileName, content),

  // Players & Access
  getPlayersData: (serverId) => ipcRenderer.invoke('server:get-players-data', serverId),
  savePlayersData: (serverId, type, data) => ipcRenderer.invoke('server:save-players-data', serverId, type, data),
  executePlayerAction: (serverId, action, payload) => ipcRenderer.invoke('server:player-action', serverId, action, payload),
  applyAntiCheatShield: (serverId) => ipcRenderer.invoke('server:apply-anticheat-shield', serverId),

  // Mods & Plugins
  listAddons: (serverId) => ipcRenderer.invoke('server:list-addons', serverId),
  toggleAddon: (serverId, fileName, enable) => ipcRenderer.invoke('server:toggle-addon', serverId, fileName, enable),
  deleteAddon: (serverId, fileName) => ipcRenderer.invoke('server:delete-addon', serverId, fileName),
  installAddonFromUrl: (serverId, downloadUrl, fileName) => ipcRenderer.invoke('server:install-addon-url', serverId, downloadUrl, fileName),
  installAddonFromFile: (serverId, sourcePath) => ipcRenderer.invoke('server:install-addon-file', serverId, sourcePath),
  inspectJar: (filePath) => ipcRenderer.invoke('server:inspect-jar', filePath),

  // Backups
  listBackups: (serverId) => ipcRenderer.invoke('server:list-backups', serverId),
  createBackup: (serverId, name) => ipcRenderer.invoke('server:create-backup', serverId, name),
  restoreBackup: (serverId, fileName) => ipcRenderer.invoke('server:restore-backup', serverId, fileName),
  deleteBackup: (serverId, fileName) => ipcRenderer.invoke('server:delete-backup', serverId, fileName),

  // Crash diagnostics & Watchdog
  getCrashReports: (serverId) => ipcRenderer.invoke('server:get-crash-reports', serverId),

  // Tunneling & Networking
  getTunnelInfo: (serverId) => ipcRenderer.invoke('server:get-tunnel-info', serverId),
  startPlayitTunnel: () => ipcRenderer.invoke('tunnel:start-playit'),
  stopPlayitTunnel: () => ipcRenderer.invoke('tunnel:stop-playit'),

  // Event Listeners
  onServerLog: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('server:log', handler);
    return () => ipcRenderer.removeListener('server:log', handler);
  },
  onServerStatusChanged: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('server:status-changed', handler);
    return () => ipcRenderer.removeListener('server:status-changed', handler);
  },
  onResourceStats: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('server:resource-stats', handler);
    return () => ipcRenderer.removeListener('server:resource-stats', handler);
  },
  onTunnelLog: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('tunnel:log', handler);
    return () => ipcRenderer.removeListener('tunnel:log', handler);
  },
  onDownloadProgress: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('download:progress', handler);
    return () => ipcRenderer.removeListener('download:progress', handler);
  }
});
