export interface ServerConfig {
  id: string;
  name: string;
  engine: 'paper' | 'purpur' | 'fabric' | 'vanilla' | 'forge' | 'neoforge';
  mcVersion: string;
  port: number;
  minRam: number;
  maxRam: number;
  javaPath: string;
  jarFile: string;
  onlineMode: boolean;
  autoRestart: boolean;
  useAikarFlags: boolean;
  created: number;
  status?: 'stopped' | 'starting' | 'running' | 'stopping';
  serverDir?: string;
  tunnelAddress?: string;
}

export interface JavaRuntime {
  path: string;
  version: string;
  majorVersion: number;
  label: string;
}

export interface SystemInfo {
  platform: string;
  arch: string;
  totalMem: number;
  freeMem: number;
  cpus: number;
  hostname: string;
  dataDir: string;
}

export interface ResourceStats {
  serverId: string;
  cpu: number;
  memoryMb: number;
  uptime: number;
}

export interface ServerLog {
  serverId: string;
  line: string;
  timestamp: number;
}

export interface AddonItem {
  name: string;
  fileName: string;
  type: 'mod' | 'plugin';
  enabled: boolean;
  sizeKb: number;
  modified: number;
}

export interface BackupItem {
  fileName: string;
  sizeMb: string;
  createdAt: number;
}

export interface PlayersData {
  ops: Array<{ uuid: string; name: string; level: number; bypassesPlayerLimit: boolean }>;
  whitelist: Array<{ uuid: string; name: string }>;
  bannedPlayers: Array<{ uuid: string; name: string; created: string; source: string; expires: string; reason: string }>;
  bannedIps: Array<{ ip: string; created: string; source: string; expires: string; reason: string }>;
}

export interface TunnelInfo {
  port: number;
  pinggyCommand: string;
  oracleIptablesCommand: string;
  oracleUfwCommand: string;
  oracleFirewalldCommand: string;
}

export interface CrashReport {
  fileName: string;
  date: number;
  summary: string;
  fullContent: string;
}

export interface WorldDimension {
  folderName: string;
  sizeMb: string;
  hasLevelDat: boolean;
  hasRegion: boolean;
}

export interface WorldInfo {
  levelName: string;
  levelSeed: string;
  levelType: string;
  totalSizeMb: string;
  dimensions: WorldDimension[];
}

export interface McServerAPI {
  getSystemInfo: () => Promise<SystemInfo>;
  detectJavaRuntimes: () => Promise<JavaRuntime[]>;
  openExternalUrl: (url: string) => Promise<boolean>;
  openFolder: (path: string) => Promise<boolean>;

  getServers: () => Promise<ServerConfig[]>;
  createServer: (config: Partial<ServerConfig> & { downloadEngine?: boolean; gamemode?: string; difficulty?: string; maxPlayers?: number; motd?: string }) => Promise<ServerConfig>;
  updateServer: (serverId: string, data: Partial<ServerConfig>) => Promise<ServerConfig | null>;
  deleteServer: (serverId: string) => Promise<boolean>;

  startServer: (serverId: string) => Promise<{ success: boolean; pid?: number; message?: string }>;
  stopServer: (serverId: string) => Promise<{ success: boolean; message?: string }>;
  restartServer: (serverId: string) => Promise<{ success: boolean }>;
  killServer: (serverId: string) => Promise<{ success: boolean }>;
  sendCommand: (serverId: string, command: string) => Promise<{ success: boolean; message?: string }>;
  getServerStatus: (serverId: string) => Promise<{ serverId: string; status: string; pid: number | null }>;

  getProperties: (serverId: string) => Promise<Record<string, string>>;
  saveProperties: (serverId: string, properties: Record<string, string>) => Promise<boolean>;
  getWorldInfo: (serverId: string) => Promise<WorldInfo>;
  resetWorld: (serverId: string, newSeed?: string) => Promise<{ success: boolean; newSeed?: string }>;
  getRawFile: (serverId: string, fileName: string) => Promise<string>;
  saveRawFile: (serverId: string, fileName: string, content: string) => Promise<boolean>;

  getPlayersData: (serverId: string) => Promise<PlayersData>;
  savePlayersData: (serverId: string, type: 'ops' | 'whitelist' | 'bannedPlayers' | 'bannedIps', data: any) => Promise<boolean>;
  executePlayerAction: (serverId: string, action: string, payload: any) => Promise<{ success: boolean }>;
  applyAntiCheatShield: (serverId: string) => Promise<{ success: boolean; message?: string }>;

  listAddons: (serverId: string) => Promise<AddonItem[]>;
  toggleAddon: (serverId: string, fileName: string, enable: boolean) => Promise<boolean>;
  deleteAddon: (serverId: string, fileName: string) => Promise<boolean>;
  installAddonFromUrl: (serverId: string, downloadUrl: string, fileName: string) => Promise<{ success: boolean; fileName: string }>;
  installAddonFromFile: (serverId: string, sourcePath: string) => Promise<{ success: boolean; fileName: string }>;
  inspectJar: (filePath: string) => Promise<{ type: string; id: string; name: string; version?: string; requiredDeps: string[] } | null>;

  listBackups: (serverId: string) => Promise<BackupItem[]>;
  createBackup: (serverId: string, name?: string) => Promise<{ success: boolean; fileName: string }>;
  restoreBackup: (serverId: string, fileName: string) => Promise<{ success: boolean }>;
  deleteBackup: (serverId: string, fileName: string) => Promise<boolean>;

  getCrashReports: (serverId: string) => Promise<CrashReport[]>;

  getTunnelInfo: (serverId: string) => Promise<TunnelInfo>;
  startPlayitTunnel: () => Promise<{ success: boolean; message?: string }>;
  stopPlayitTunnel: () => Promise<{ success: boolean }>;

  onServerLog: (callback: (data: ServerLog) => void) => () => void;
  onServerStatusChanged: (callback: (data: { serverId: string; status: string }) => void) => () => void;
  onResourceStats: (callback: (data: ResourceStats) => void) => () => void;
  onTunnelLog: (callback: (data: string) => void) => () => void;
  onDownloadProgress: (callback: (data: any) => void) => () => void;
}

declare global {
  interface Window {
    mcServerAPI: McServerAPI;
  }
}
