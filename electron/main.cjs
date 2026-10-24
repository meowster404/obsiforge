const { app, BrowserWindow, ipcMain, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, execSync, spawnSync } = require('child_process');
const os = require('os');
const axios = require('axios');
const AdmZip = require('adm-zip');
const pidusage = require('pidusage');

let mainWindow = null;

// Paths
const DATA_DIR = path.join(app.getPath('userData'), 'obsiforge-data');
const SERVERS_DIR = path.join(DATA_DIR, 'servers');
const CONFIG_FILE = path.join(DATA_DIR, 'servers.json');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(SERVERS_DIR)) fs.mkdirSync(SERVERS_DIR, { recursive: true });
if (!fs.existsSync(CONFIG_FILE)) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify({ servers: [] }, null, 2));
}

// Active Server Sessions
// serverId -> { process, logs: [], status: 'stopped' | 'starting' | 'running' | 'stopping', statsTimer, watchdogRetries: 0 }
const activeSessions = new Map();
let playitProcess = null;

// =========================================================================
// SECURITY & INPUT SANITIZATION HELPERS
// =========================================================================

function sanitizeId(id) {
  if (typeof id !== 'string') throw new Error('Invalid identifier type');
  const clean = id.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!clean || clean !== id) {
    throw new Error('Access denied: Malicious or illegal identifier');
  }
  return clean;
}

function resolveSafePath(baseDir, ...userSegments) {
  const resolvedBase = path.resolve(baseDir);
  const resolvedTarget = path.resolve(baseDir, ...userSegments);
  if (!resolvedTarget.startsWith(resolvedBase + path.sep) && resolvedTarget !== resolvedBase) {
    throw new Error('Access denied: Path traversal attempt detected');
  }
  return resolvedTarget;
}

function sanitizeStdinCommand(input) {
  if (typeof input !== 'string') return '';
  return input.replace(/[\r\n]+/g, ' ').trim();
}

function loadServersConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error loading servers.json:', err);
    return { servers: [] };
  }
}

function saveServersConfig(data) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function scanJavaRuntimes() {
  const found = [];
  const checkedPaths = new Set();

  function testJava(binPath, label = '') {
    if (!binPath || checkedPaths.has(binPath)) return;
    checkedPaths.add(binPath);
    try {
      if (fs.existsSync(binPath)) {
        const res = spawnSync(binPath, ['-version'], { encoding: 'utf-8', timeout: 3000 });
        const out = (res.stdout || '') + (res.stderr || '');
        const versionMatch = out.match(/(?:version|openjdk version)\s+"?([0-9._]+)/i);
        const versionStr = versionMatch ? versionMatch[1] : 'Unknown';
        let major = 8;
        if (versionStr.startsWith('1.')) {
          major = parseInt(versionStr.split('.')[1], 10);
        } else {
          major = parseInt(versionStr.split('.')[0], 10);
        }
        found.push({
          path: binPath,
          version: versionStr,
          majorVersion: major,
          label: label || `Java ${major} (${versionStr})`
        });
      }
    } catch {
      // Ignored
    }
  }

  // Check system PATH java
  try {
    const sysJava = execSync('where java', { encoding: 'utf-8', timeout: 2000 })
      .split(/\r?\n/)
      .map(s => s.trim())
      .filter(Boolean);
    sysJava.forEach(p => testJava(p, 'System PATH Java'));
  } catch {}

  // Check standard Program Files locations on Windows
  const searchDirs = [
    'C:\\Program Files\\Java',
    'C:\\Program Files\\Eclipse Adoptium',
    'C:\\Program Files\\Zulu',
    'C:\\Program Files\\BellSoft',
    'C:\\Program Files\\Amazon Corretto',
    'C:\\Program Files\\Microsoft\\jdk',
    'C:\\Program Files (x86)\\Java'
  ];

  for (const sDir of searchDirs) {
    if (fs.existsSync(sDir)) {
      try {
        const subdirs = fs.readdirSync(sDir);
        for (const sub of subdirs) {
          const candidate = path.join(sDir, sub, 'bin', 'java.exe');
          testJava(candidate, `${sub}`);
        }
      } catch {}
    }
  }

  // Fallback default placeholder if none found
  if (found.length === 0) {
    found.push({
      path: 'java',
      version: 'Not Found / System Command',
      majorVersion: 17,
      label: 'java (Global PATH command)'
    });
  }

  return found;
}

function createWindow() {
  Menu.setApplicationMenu(null);

  mainWindow = new BrowserWindow({
    width: 1380,
    height: 880,
    minWidth: 1080,
    minHeight: 700,
    backgroundColor: '#0a0a0a',
    title: 'OBSIFORGE',
    icon: path.join(__dirname, '../public/logo.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  });

  const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged;

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[RENDERER_CONSOLE L${level}] ${message} (${sourceId}:${line})`);
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error(`[DID_FAIL_LOAD] (${errorCode}) ${errorDescription} - ${validatedURL}`);
  });

  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('[RENDER_PROCESS_GONE]', details);
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  // Cloud Daemon Mode: Do NOT kill running servers when the desktop application window closes.
  // The Minecraft server continues running 24/7 in the cloud / background daemon.
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// =========================================================================
// IPC HANDLERS
// =========================================================================

// System
ipcMain.handle('system:get-info', async () => {
  return {
    platform: process.platform,
    arch: process.arch,
    totalMem: Math.round(os.totalmem() / (1024 * 1024 * 1024)),
    freeMem: Math.round(os.freemem() / (1024 * 1024 * 1024)),
    cpus: os.cpus().length,
    hostname: os.hostname(),
    dataDir: DATA_DIR
  };
});

ipcMain.handle('system:detect-java', async () => {
  return scanJavaRuntimes();
});

ipcMain.handle('system:open-url', async (_e, url) => {
  shell.openExternal(url);
  return true;
});

ipcMain.handle('system:open-folder', async (_e, folderPath) => {
  shell.openPath(folderPath);
  return true;
});

ipcMain.handle('system:download-and-install-update', async (_e, downloadUrl) => {
  try {
    const tempDir = app.getPath('temp');
    const installerFileName = `ObsiForge-Setup-${Date.now()}.exe`;
    const targetPath = path.join(tempDir, installerFileName);

    const writer = fs.createWriteStream(targetPath);
    const response = await axios({
      url: downloadUrl,
      method: 'GET',
      responseType: 'stream',
      headers: {
        'User-Agent': 'ObsiForge-Updater'
      }
    });

    const totalLength = parseInt(response.headers['content-length'] || '0', 10);
    let downloadedLength = 0;

    response.data.on('data', (chunk) => {
      downloadedLength += chunk.length;
      if (mainWindow && !mainWindow.isDestroyed()) {
        const percent = totalLength > 0 ? Math.round((downloadedLength / totalLength) * 100) : 0;
        mainWindow.webContents.send('update:download-progress', {
          percent,
          transferredMb: (downloadedLength / (1024 * 1024)).toFixed(1),
          totalMb: totalLength > 0 ? (totalLength / (1024 * 1024)).toFixed(1) : 'Unknown',
          status: 'downloading'
        });
      }
    });

    await new Promise((resolve, reject) => {
      response.data.pipe(writer);
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update:download-progress', {
        percent: 100,
        transferredMb: (downloadedLength / (1024 * 1024)).toFixed(1),
        totalMb: (downloadedLength / (1024 * 1024)).toFixed(1),
        status: 'installing'
      });
    }

    const child = spawn(targetPath, [], {
      detached: true,
      stdio: 'ignore'
    });
    child.unref();

    setTimeout(() => {
      app.isQuitting = true;
      app.quit();
    }, 1500);

    return { success: true };
  } catch (err) {
    console.error('Update download/install error:', err);
    return { success: false, error: err.message || String(err) };
  }
});

function generateObsiForgeAddress(serverName) {
  const clean = (serverName || 'server')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'node';
  const randCode = Math.random().toString(36).substring(2, 6);
  const baseDomain = process.env.VITE_BASE_TUNNEL_DOMAIN || 'obsiforge.ply.gg';
  return `${clean}.${randCode}.${baseDomain}`;
}

// Servers List & CRUD
ipcMain.handle('servers:get-all', async () => {
  const cfg = loadServersConfig();
  let updated = false;
  const enriched = cfg.servers.map(s => {
    const session = activeSessions.get(s.id);
    let tunnelAddress = s.tunnelAddress;
    if (!tunnelAddress) {
      tunnelAddress = generateObsiForgeAddress(s.name);
      s.tunnelAddress = tunnelAddress;
      updated = true;
    }
    return {
      ...s,
      tunnelAddress,
      status: session ? session.status : 'stopped',
      serverDir: path.join(SERVERS_DIR, s.id)
    };
  });
  if (updated) {
    saveServersConfig(cfg);
  }
  return enriched;
});

function generateRandomSeed() {
  const sign = Math.random() > 0.5 ? '' : '-';
  const randPart = Math.floor(Math.random() * 8999999999999999 + 1000000000000000).toString();
  return `${sign}${randPart}`;
}

function applyAntiCheatAndHardening(serverDir, engine) {
  // 1. Enforce anti-cheat & exploit mitigations in server.properties
  const propFile = path.join(serverDir, 'server.properties');
  if (fs.existsSync(propFile)) {
    let raw = fs.readFileSync(propFile, 'utf-8');
    const hardenRules = [
      ['prevent-proxy-connections', 'true'],
      ['allow-flight', 'false'],
      ['rate-limit', '100'],
      ['network-compression-threshold', '256'],
      ['sync-chunk-writes', 'true'],
      ['spawn-protection', '16']
    ];
    for (const [key, val] of hardenRules) {
      const reg = new RegExp(`^${key}\\s*=.*$`, 'm');
      if (reg.test(raw)) {
        raw = raw.replace(reg, `${key}=${val}`);
      } else {
        raw += `\n${key}=${val}\n`;
      }
    }
    fs.writeFileSync(propFile, raw, 'utf-8');
  }

  // 2. Paper / Purpur native Engine Anti-Xray Mode 2 (Ore Obfuscator)
  // Obfuscates hidden ores, diamond ore, deepslate diamond ore, ancient debris, lapis, chests, spawners
  // from hacked client Xray texture packs, Freecam, and chest ESP
  if (['paper', 'purpur'].includes(engine)) {
    const configDir = path.join(serverDir, 'config');
    if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });

    const paperWorldConfig = path.join(configDir, 'paper-world-defaults.yml');
    const antiXrayYaml = [
      '# Paper World Defaults - Hardened Anti-Cheat & Anti-Xray generated by ObsiForge',
      'anticheat:',
      '  anti-xray:',
      '    enabled: true',
      '    engine-mode: 2',
      '    max-block-height: 64',
      '    update-radius: 2',
      '    use-permission: false',
      '    hidden-blocks:',
      '      - copper_ore',
      '      - deepslate_copper_ore',
      '      - raw_copper_block',
      '      - diamond_ore',
      '      - deepslate_diamond_ore',
      '      - emerald_ore',
      '      - deepslate_emerald_ore',
      '      - gold_ore',
      '      - deepslate_gold_ore',
      '      - iron_ore',
      '      - deepslate_iron_ore',
      '      - raw_iron_block',
      '      - lapis_ore',
      '      - deepslate_lapis_ore',
      '      - redstone_ore',
      '      - deepslate_redstone_ore',
      '      - ancient_debris',
      '      - chest',
      '      - trapped_chest',
      '      - spawner',
      '    replacement-blocks:',
      '      - stone',
      '      - deepslate',
      '      - netherrack',
      '      - dirt'
    ].join('\n');
    fs.writeFileSync(paperWorldConfig, antiXrayYaml, 'utf-8');
  }
}

ipcMain.handle('servers:create', async (_e, serverData) => {
  const cfg = loadServersConfig();
  const serverId = 'srv_' + Date.now();
  const serverDir = path.join(SERVERS_DIR, serverId);
  fs.mkdirSync(serverDir, { recursive: true });

  // Auto-accept EULA
  fs.writeFileSync(path.join(serverDir, 'eula.txt'), 'eula=true\n');

  // Random high-entropy seed if not provided
  const chosenSeed = serverData.seed && serverData.seed.trim() !== '' 
    ? serverData.seed.trim() 
    : generateRandomSeed();

  // Initial server.properties
  const defaultProps = [
    '# Minecraft server properties - Generated by ObsiForge Engine',
    `motd=${serverData.motd || 'OBSIFORGE // Cloud Minecraft Node'}`,
    `server-port=${serverData.port || 25565}`,
    `level-seed=${chosenSeed}`,
    `gamemode=${serverData.gamemode || 'survival'}`,
    `difficulty=${serverData.difficulty || 'normal'}`,
    `max-players=${serverData.maxPlayers || 20}`,
    `online-mode=${serverData.onlineMode !== undefined ? serverData.onlineMode : true}`,
    'pvp=true',
    'enable-command-block=true',
    'spawn-protection=16',
    'view-distance=10',
    'simulation-distance=8',
    'white-list=false',
    'allow-flight=false',
    'prevent-proxy-connections=true',
    'rate-limit=100',
    'network-compression-threshold=256',
    'sync-chunk-writes=true',
    'level-name=world'
  ].join('\n');
  fs.writeFileSync(path.join(serverDir, 'server.properties'), defaultProps);

  // Subfolders
  fs.mkdirSync(path.join(serverDir, 'mods'), { recursive: true });
  fs.mkdirSync(path.join(serverDir, 'plugins'), { recursive: true });
  fs.mkdirSync(path.join(serverDir, 'backups'), { recursive: true });
  fs.mkdirSync(path.join(serverDir, 'crash-reports'), { recursive: true });

  const jarName = 'server.jar';
  const assignedTunnel = serverData.tunnelAddress || generateObsiForgeAddress(serverData.name);
  const newServer = {
    id: serverId,
    name: serverData.name || 'TERMINAL_NODE_01',
    engine: serverData.engine || 'paper',
    mcVersion: serverData.mcVersion || '1.21.1',
    port: serverData.port || 25565,
    minRam: serverData.minRam || 2,
    maxRam: serverData.maxRam || 4,
    javaPath: serverData.javaPath || 'java',
    jarFile: jarName,
    tunnelAddress: assignedTunnel,
    onlineMode: serverData.onlineMode !== undefined ? serverData.onlineMode : true,
    autoRestart: serverData.autoRestart || false,
    useAikarFlags: serverData.useAikarFlags !== undefined ? serverData.useAikarFlags : true,
    created: Date.now()
  };

  // Automatically apply anti-cheat & anti-xray defenses
  applyAntiCheatAndHardening(serverDir, newServer.engine);

  // Download engine jar asynchronously
  if (serverData.downloadEngine) {
    downloadEngineJar(serverDir, jarName, newServer.engine, newServer.mcVersion);
  }

  cfg.servers.push(newServer);
  saveServersConfig(cfg);
  return { ...newServer, status: 'stopped', serverDir };
});

ipcMain.handle('server:apply-anticheat-shield', async (_e, serverId) => {
  try {
    const safeId = sanitizeId(serverId);
    const serverDir = resolveSafePath(SERVERS_DIR, safeId);
    const cfg = loadServersConfig();
    const target = cfg.servers.find(s => s.id === safeId);
    applyAntiCheatAndHardening(serverDir, target?.engine || 'paper');
    return { success: true, message: 'Anti-cheat shield & Anti-Xray Mode 2 successfully injected.' };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

async function downloadEngineJar(serverDir, jarName, engine, mcVersion) {
  const targetPath = path.join(serverDir, jarName);
  try {
    mainWindow?.webContents.send('download:progress', { status: 'resolving', engine, mcVersion, percent: 5 });

    const mojangManifestUrl = process.env.VITE_MOJANG_MANIFEST_URL || 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json';
    const paperApiUrl = process.env.VITE_PAPER_API_URL || 'https://api.papermc.io/v2/projects/paper';
    const purpurApiUrl = process.env.VITE_PURPUR_API_URL || 'https://api.purpurmc.org/v2/purpur';
    const fabricMetaUrl = process.env.VITE_FABRIC_META_URL || 'https://meta.fabricmc.net/v2/versions';

    let resolvedVersion = mcVersion;
    if (!resolvedVersion || resolvedVersion.toLowerCase().includes('latest')) {
      try {
        const manifestRes = await axios.get(mojangManifestUrl);
        resolvedVersion = manifestRes.data?.latest?.release || '26.3';
      } catch {
        resolvedVersion = '26.3';
      }
    }

    let downloadUrl = null;

    if (engine === 'paper') {
      let paperVersion = resolvedVersion;
      try {
        const projRes = await axios.get(paperApiUrl);
        if (!projRes.data.versions.includes(paperVersion)) {
          paperVersion = projRes.data.versions[projRes.data.versions.length - 1];
        }
      } catch {}
      const buildsRes = await axios.get(`${paperApiUrl}/versions/${paperVersion}`);
      const latestBuild = buildsRes.data.builds[buildsRes.data.builds.length - 1];
      downloadUrl = `${paperApiUrl}/versions/${paperVersion}/builds/${latestBuild}/downloads/paper-${paperVersion}-${latestBuild}.jar`;
    } else if (engine === 'purpur') {
      downloadUrl = `${purpurApiUrl}/${resolvedVersion}/latest/download`;
    } else if (engine === 'fabric') {
      // Fetch latest loader & installer
      const loaderRes = await axios.get(`${fabricMetaUrl}/loader`);
      const latestLoader = loaderRes.data[0]?.version || '0.16.9';
      const installerRes = await axios.get(`${fabricMetaUrl}/installer`);
      const latestInstaller = installerRes.data[0]?.version || '1.0.1';
      downloadUrl = `${fabricMetaUrl}/loader/${resolvedVersion}/${latestLoader}/${latestInstaller}/server/jar`;
    } else if (engine === 'vanilla') {
      const manifestRes = await axios.get(mojangManifestUrl);
      const versionObj = manifestRes.data.versions.find(v => v.id === resolvedVersion) || manifestRes.data.versions[0];
      if (versionObj) {
        const detailRes = await axios.get(versionObj.url);
        downloadUrl = detailRes.data.downloads?.server?.url;
      }
    }

    if (!downloadUrl) {
      // Fallback to Paper latest 1.21.1
      downloadUrl = 'https://api.papermc.io/v2/projects/paper/versions/1.21.1/builds/118/downloads/paper-1.21.1-118.jar';
    }

    mainWindow?.webContents.send('download:progress', {
      status: 'downloading',
      engine,
      mcVersion: resolvedVersion,
      jarName,
      url: downloadUrl,
      downloadedBytes: 0,
      totalBytes: 0,
      percent: 10
    });

    const response = await axios({
      method: 'GET',
      url: downloadUrl,
      responseType: 'stream'
    });

    const totalBytes = parseInt(response.headers['content-length'] || '0', 10);
    let downloadedBytes = 0;
    let lastPercent = 10;

    const writer = fs.createWriteStream(targetPath);
    response.data.on('data', (chunk) => {
      downloadedBytes += chunk.length;
      if (totalBytes > 0) {
        const percent = Math.min(99, Math.max(10, Math.round((downloadedBytes / totalBytes) * 100)));
        if (percent !== lastPercent) {
          lastPercent = percent;
          mainWindow?.webContents.send('download:progress', {
            status: 'downloading',
            engine,
            mcVersion: resolvedVersion,
            jarName,
            downloadedBytes,
            totalBytes,
            percent
          });
        }
      } else {
        mainWindow?.webContents.send('download:progress', {
          status: 'downloading',
          engine,
          mcVersion: resolvedVersion,
          jarName,
          downloadedBytes,
          totalBytes: 0,
          percent: -1
        });
      }
    });

    response.data.pipe(writer);

    writer.on('finish', () => {
      mainWindow?.webContents.send('download:progress', {
        status: 'completed',
        engine,
        mcVersion: resolvedVersion,
        jarName,
        downloadedBytes,
        totalBytes: downloadedBytes,
        percent: 100
      });
    });
    writer.on('error', (err) => {
      mainWindow?.webContents.send('download:progress', { status: 'error', engine, error: err.message });
    });
  } catch (err) {
    console.error('Engine download failed:', err);
    mainWindow?.webContents.send('download:progress', { status: 'error', engine, error: err.message });
  }
}

ipcMain.handle('servers:update', async (_e, serverId, data) => {
  const safeId = sanitizeId(serverId);
  const cfg = loadServersConfig();
  const idx = cfg.servers.findIndex(s => s.id === safeId);
  if (idx !== -1) {
    cfg.servers[idx] = { ...cfg.servers[idx], ...data };
    saveServersConfig(cfg);
    return cfg.servers[idx];
  }
  return null;
});

ipcMain.handle('servers:delete', async (_e, serverId) => {
  try {
    const safeId = sanitizeId(serverId);
    // 1. Force kill active process if running
    const session = activeSessions.get(safeId);
    if (session && session.process) {
      try { session.process.kill('SIGKILL'); } catch {}
      activeSessions.delete(safeId);
    }

    // 2. Remove from servers config immediately
    const cfg = loadServersConfig();
    cfg.servers = cfg.servers.filter(s => s.id !== safeId);
    saveServersConfig(cfg);

    // 3. Clean directory safely with error handling and retry so OS locks never break deletion
    const serverDir = resolveSafePath(SERVERS_DIR, safeId);
    if (fs.existsSync(serverDir)) {
      try {
        fs.rmSync(serverDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
      } catch (err) {
        console.warn(`Could not completely clean serverDir ${serverDir} immediately (file locked by Windows):`, err.message);
        setTimeout(() => {
          try { fs.rmSync(serverDir, { recursive: true, force: true }); } catch {}
        }, 2000);
      }
    }
    return true;
  } catch (err) {
    console.error('servers:delete exception:', err);
    return true; // Still return true so UI removes the server
  }
});

// =========================================================================
// SERVER PROCESS CONTROL
// =========================================================================

function buildJvmArgs(server) {
  const args = [
    `-Xms${server.minRam || 2}G`,
    `-Xmx${server.maxRam || 4}G`
  ];

  if (server.useAikarFlags) {
    // Aikar's optimized G1GC flags for high-performance Minecraft servers
    args.push(
      '-XX:+UseG1GC',
      '-XX:+ParallelRefProcEnabled',
      '-XX:MaxGCPauseMillis=200',
      '-XX:+UnlockExperimentalVMOptions',
      '-XX:+DisableExplicitGC',
      '-XX:+AlwaysPreTouch',
      '-XX:G1NewSizePercent=30',
      '-XX:G1MaxNewSizePercent=40',
      '-XX:G1ReservePercent=20',
      '-XX:G1HeapWastePercent=5',
      '-XX:G1MixedGCCountTarget=4',
      '-XX:InitiatingHeapOccupancyPercent=15',
      '-XX:G1MixedGCLiveThresholdPercent=90',
      '-XX:G1RSetUpdatingPauseTimePercent=5',
      '-XX:SurvivorRatio=32',
      '-XX:+PerfDisableSharedMem',
      '-XX:MaxTenuringThreshold=1'
    );
  }

  args.push('-jar', path.basename(server.jarFile || 'server.jar'), 'nogui');
  return args;
}

function sendLog(serverId, line) {
  const payload = { serverId, line, timestamp: Date.now() };
  mainWindow?.webContents.send('server:log', payload);
}

function notifyStatus(serverId, status) {
  mainWindow?.webContents.send('server:status-changed', { serverId, status });
}

async function startServerProcess(serverId) {
  const safeId = sanitizeId(serverId);
  const cfg = loadServersConfig();
  const server = cfg.servers.find(s => s.id === safeId);
  if (!server) throw new Error('Server not found');

  if (activeSessions.has(safeId) && activeSessions.get(safeId).status === 'running') {
    return { success: false, message: 'Server is already running' };
  }

  const serverDir = resolveSafePath(SERVERS_DIR, safeId);
  const safeJarName = path.basename(server.jarFile || 'server.jar');
  const jarPath = resolveSafePath(serverDir, safeJarName);

  if (!fs.existsSync(jarPath)) {
    return { success: false, message: `Server JAR "${safeJarName}" not found. Please wait for download or place jar file.` };
  }

  // Ensure EULA is accepted
  fs.writeFileSync(path.join(serverDir, 'eula.txt'), 'eula=true\n');

  const jvmArgs = buildJvmArgs(server);
  const javaExec = server.javaPath || 'java';

  const session = {
    status: 'starting',
    process: null,
    logs: [],
    statsTimer: null,
    watchdogRetries: (activeSessions.get(safeId)?.watchdogRetries) || 0
  };
  activeSessions.set(safeId, session);
  notifyStatus(safeId, 'starting');

  try {
    const child = spawn(javaExec, jvmArgs, {
      cwd: serverDir,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    session.process = child;

    // Push initial status log
    const startMsg = `[SYSTEM] Spawning Minecraft Server Process [PID: ${child.pid}] with ${jvmArgs.slice(0, 2).join(' ')}...`;
    sendLog(safeId, startMsg);

    child.stdout.on('data', (data) => {
      const text = data.toString('utf-8');
      const lines = text.split(/\r?\n/).filter(Boolean);
      lines.forEach(line => {
        sendLog(safeId, line);
        if (line.includes('Done (') && line.includes(')! For help, type "help"')) {
          session.status = 'running';
          notifyStatus(safeId, 'running');
        }
      });
    });

    child.stderr.on('data', (data) => {
      const text = data.toString('utf-8');
      const lines = text.split(/\r?\n/).filter(Boolean);
      lines.forEach(line => {
        sendLog(safeId, `[STDERR] ${line}`);
      });
    });

    child.on('close', (code) => {
      sendLog(safeId, `[SYSTEM] Server process exited with code ${code}.`);
      if (session.statsTimer) clearInterval(session.statsTimer);
      session.status = 'stopped';
      session.process = null;
      notifyStatus(safeId, 'stopped');

      // Watchdog Auto-Restart check
      if (code !== 0 && server.autoRestart && session.watchdogRetries < 3) {
        session.watchdogRetries++;
        sendLog(safeId, `[WATCHDOG] Abnormal crash detected! Automatic restart scheduled in 5 seconds (Attempt ${session.watchdogRetries}/3)...`);
        setTimeout(() => {
          startServerProcess(safeId).catch(err => {
            sendLog(safeId, `[WATCHDOG ERROR] Auto-restart failed: ${err.message}`);
          });
        }, 5000);
      }
    });

    child.on('error', (err) => {
      sendLog(safeId, `[SYSTEM ERROR] Failed to start server process: ${err.message}`);
      session.status = 'stopped';
      notifyStatus(safeId, 'stopped');
    });

    // Start resource monitoring timer
    session.statsTimer = setInterval(async () => {
      if (child.pid && session.status === 'running') {
        try {
          const stats = await pidusage(child.pid);
          mainWindow?.webContents.send('server:resource-stats', {
            serverId: safeId,
            cpu: Math.min(100, Math.round(stats.cpu)),
            memoryMb: Math.round(stats.memory / (1024 * 1024)),
            uptime: Math.round(stats.elapsed / 1000)
          });
        } catch {
          // Process might have terminated
        }
      }
    }, 1500);

    return { success: true, pid: child.pid };
  } catch (err) {
    session.status = 'stopped';
    notifyStatus(safeId, 'stopped');
    return { success: false, message: err.message };
  }
}

async function stopServerProcess(serverId) {
  const safeId = sanitizeId(serverId);
  const session = activeSessions.get(safeId);
  if (!session || !session.process) {
    return { success: true, message: 'Server is already stopped' };
  }

  session.status = 'stopping';
  notifyStatus(safeId, 'stopping');
  sendLog(safeId, '[SYSTEM] Sending /stop command to Minecraft server...');

  try {
    session.process.stdin.write('stop\n');
  } catch {}

  // Force kill fallback if not closed within 12 seconds
  setTimeout(() => {
    if (session.process && session.status === 'stopping') {
      sendLog(safeId, '[WATCHDOG] Graceful shutdown timeout reached. Terminating process...');
      try {
        session.process.kill('SIGKILL');
      } catch {}
    }
  }, 12000);

  return { success: true };
}

ipcMain.handle('server:start', async (_e, serverId) => {
  return await startServerProcess(serverId);
});

ipcMain.handle('server:stop', async (_e, serverId) => {
  return await stopServerProcess(serverId);
});

ipcMain.handle('server:restart', async (_e, serverId) => {
  await stopServerProcess(serverId);
  setTimeout(async () => {
    await startServerProcess(serverId);
  }, 4000);
  return { success: true };
});

ipcMain.handle('server:kill', async (_e, serverId) => {
  const safeId = sanitizeId(serverId);
  const session = activeSessions.get(safeId);
  if (session && session.process) {
    try {
      session.process.kill('SIGKILL');
      session.status = 'stopped';
      notifyStatus(safeId, 'stopped');
      sendLog(safeId, '[SYSTEM] Process terminated with SIGKILL.');
    } catch {}
  }
  return { success: true };
});

ipcMain.handle('server:send-command', async (_e, serverId, command) => {
  const safeId = sanitizeId(serverId);
  const session = activeSessions.get(safeId);
  if (!session || !session.process || session.status !== 'running') {
    return { success: false, message: 'Server is not running' };
  }
  const cleanCmd = sanitizeStdinCommand(command.startsWith('/') ? command.slice(1) : command);
  if (!cleanCmd) return { success: false, message: 'Command is empty' };
  session.process.stdin.write(cleanCmd + '\n');
  sendLog(safeId, `> ${cleanCmd}`);
  return { success: true };
});

ipcMain.handle('server:get-status', async (_e, serverId) => {
  const safeId = sanitizeId(serverId);
  const session = activeSessions.get(safeId);
  return {
    serverId: safeId,
    status: session ? session.status : 'stopped',
    pid: session && session.process ? session.process.pid : null
  };
});

// =========================================================================
// PROPERTIES & CONFIGURATION
// =========================================================================

ipcMain.handle('server:get-properties', async (_e, serverId) => {
  const safeId = sanitizeId(serverId);
  const serverDir = resolveSafePath(SERVERS_DIR, safeId);
  const propFile = resolveSafePath(serverDir, 'server.properties');
  if (!fs.existsSync(propFile)) return {};
  const content = fs.readFileSync(propFile, 'utf-8');
  const props = {};
  content.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        props[key] = val;
      }
    }
  });
  return props;
});

ipcMain.handle('server:save-properties', async (_e, serverId, newProps) => {
  const safeId = sanitizeId(serverId);
  const serverDir = resolveSafePath(SERVERS_DIR, safeId);
  const propFile = resolveSafePath(serverDir, 'server.properties');
  const lines = [
    '# Minecraft server properties - Saved by Terminal CLI GUI',
    `# Updated: ${new Date().toISOString()}`
  ];
  for (const [key, value] of Object.entries(newProps || {})) {
    const safeKey = sanitizeStdinCommand(key);
    const safeValue = sanitizeStdinCommand(String(value));
    if (safeKey) {
      lines.push(`${safeKey}=${safeValue}`);
    }
  }
  fs.writeFileSync(propFile, lines.join('\n'), 'utf-8');
  return true;
});

// World & Map Management
ipcMain.handle('server:get-world-info', async (_e, serverId) => {
  const safeId = sanitizeId(serverId);
  const serverDir = resolveSafePath(SERVERS_DIR, safeId);
  const propFile = resolveSafePath(serverDir, 'server.properties');
  let levelName = 'world';
  let levelSeed = '';
  let levelType = 'minecraft:normal';

  if (fs.existsSync(propFile)) {
    const raw = fs.readFileSync(propFile, 'utf-8');
    const nameMatch = raw.match(/^level-name\s*=\s*(.+)$/m);
    if (nameMatch) levelName = nameMatch[1].trim();
    const seedMatch = raw.match(/^level-seed\s*=\s*(.*)$/m);
    if (seedMatch) levelSeed = seedMatch[1].trim();
    const typeMatch = raw.match(/^level-type\s*=\s*(.+)$/m);
    if (typeMatch) levelType = typeMatch[1].trim();
  }

  const worldCandidates = [levelName, `${levelName}_nether`, `${levelName}_the_end`, 'world', 'world_nether', 'world_the_end'];
  const dimensions = [];
  let totalSizeBytes = 0;

  for (const candidate of Array.from(new Set(worldCandidates))) {
    const safeCandidate = path.basename(candidate);
    const wPath = resolveSafePath(serverDir, safeCandidate);
    if (fs.existsSync(wPath) && fs.statSync(wPath).isDirectory()) {
      let dirSize = 0;
      try {
        function calcSize(d) {
          const entries = fs.readdirSync(d, { withFileTypes: true });
          for (const entry of entries) {
            const fullP = path.join(d, entry.name);
            if (entry.isDirectory()) {
              calcSize(fullP);
            } else if (entry.isFile()) {
              dirSize += fs.statSync(fullP).size;
            }
          }
        }
        calcSize(wPath);
      } catch {}
      totalSizeBytes += dirSize;
      dimensions.push({
        folderName: safeCandidate,
        sizeMb: (dirSize / (1024 * 1024)).toFixed(2),
        hasLevelDat: fs.existsSync(path.join(wPath, 'level.dat')),
        hasRegion: fs.existsSync(path.join(wPath, 'region'))
      });
    }
  }

  return {
    levelName,
    levelSeed,
    levelType,
    totalSizeMb: (totalSizeBytes / (1024 * 1024)).toFixed(2),
    dimensions
  };
});

ipcMain.handle('server:reset-world', async (_e, serverId, newSeed) => {
  const safeId = sanitizeId(serverId);
  const serverDir = resolveSafePath(SERVERS_DIR, safeId);
  const propFile = resolveSafePath(serverDir, 'server.properties');
  let levelName = 'world';

  // If newSeed is empty or not provided, generate a random high-entropy seed
  const seedToUse = (newSeed && String(newSeed).trim() !== '') 
    ? sanitizeStdinCommand(String(newSeed)) 
    : generateRandomSeed();

  if (fs.existsSync(propFile)) {
    let raw = fs.readFileSync(propFile, 'utf-8');
    const nameMatch = raw.match(/^level-name\s*=\s*(.+)$/m);
    if (nameMatch) levelName = nameMatch[1].trim();

    if (raw.includes('level-seed=')) {
      raw = raw.replace(/^level-seed=.*$/m, `level-seed=${seedToUse}`);
    } else {
      raw += `\nlevel-seed=${seedToUse}\n`;
    }
    fs.writeFileSync(propFile, raw, 'utf-8');
  }

  const worldCandidates = [levelName, `${levelName}_nether`, `${levelName}_the_end`, 'world', 'world_nether', 'world_the_end'];
  for (const candidate of Array.from(new Set(worldCandidates))) {
    const safeCandidate = path.basename(candidate);
    const wPath = resolveSafePath(serverDir, safeCandidate);
    if (fs.existsSync(wPath)) {
      try {
        fs.rmSync(wPath, { recursive: true, force: true });
      } catch {}
    }
  }
  return { success: true, newSeed: seedToUse };
});

ipcMain.handle('server:get-raw-file', async (_e, serverId, fileName) => {
  const safeId = sanitizeId(serverId);
  const serverDir = resolveSafePath(SERVERS_DIR, safeId);
  const safeFile = path.basename(fileName);
  const target = resolveSafePath(serverDir, safeFile);
  if (fs.existsSync(target)) {
    return fs.readFileSync(target, 'utf-8');
  }
  return '';
});

ipcMain.handle('server:save-raw-file', async (_e, serverId, fileName, content) => {
  const safeId = sanitizeId(serverId);
  const serverDir = resolveSafePath(SERVERS_DIR, safeId);
  const safeFile = path.basename(fileName);
  const target = resolveSafePath(serverDir, safeFile);
  fs.writeFileSync(target, content, 'utf-8');
  return true;
});

// =========================================================================
// PLAYERS & ACCESS CONTROL
// =========================================================================

ipcMain.handle('server:get-players-data', async (_e, serverId) => {
  const safeId = sanitizeId(serverId);
  const serverDir = resolveSafePath(SERVERS_DIR, safeId);
  function readJson(file) {
    const safeFile = path.basename(file);
    const p = resolveSafePath(serverDir, safeFile);
    if (!fs.existsSync(p)) return [];
    try {
      return JSON.parse(fs.readFileSync(p, 'utf-8'));
    } catch {
      return [];
    }
  }

  return {
    ops: readJson('ops.json'),
    whitelist: readJson('whitelist.json'),
    bannedPlayers: readJson('banned-players.json'),
    bannedIps: readJson('banned-ips.json')
  };
});

ipcMain.handle('server:save-players-data', async (_e, serverId, type, data) => {
  const safeId = sanitizeId(serverId);
  const serverDir = resolveSafePath(SERVERS_DIR, safeId);
  const fileMap = {
    ops: 'ops.json',
    whitelist: 'whitelist.json',
    bannedPlayers: 'banned-players.json',
    bannedIps: 'banned-ips.json'
  };
  const fileName = fileMap[type];
  if (fileName) {
    const p = resolveSafePath(serverDir, fileName);
    fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  }
  return false;
});

ipcMain.handle('server:player-action', async (_e, serverId, action, payload) => {
  const safeId = sanitizeId(serverId);
  const session = activeSessions.get(safeId);
  const isOnline = session && session.process && session.status === 'running';

  const safeName = sanitizeStdinCommand(payload?.name || '');
  const safeReason = sanitizeStdinCommand(payload?.reason || '');
  const safeIp = sanitizeStdinCommand(payload?.ip || safeName);

  if (!safeName && action !== 'ban_ip') return { success: false, message: 'Player name required' };

  // If server is online, execute via command line
  if (isOnline) {
    switch (action) {
      case 'op':
        session.process.stdin.write(`op ${safeName}\n`);
        break;
      case 'deop':
        session.process.stdin.write(`deop ${safeName}\n`);
        break;
      case 'whitelist_add':
        session.process.stdin.write(`whitelist add ${safeName}\n`);
        break;
      case 'whitelist_remove':
        session.process.stdin.write(`whitelist remove ${safeName}\n`);
        break;
      case 'kick':
        session.process.stdin.write(`kick ${safeName} ${safeReason || 'Kicked by Terminal Console'}\n`);
        break;
      case 'ban':
        session.process.stdin.write(`ban ${safeName} ${safeReason || 'Banned by Terminal Admin'}\n`);
        break;
      case 'pardon':
        session.process.stdin.write(`pardon ${safeName}\n`);
        break;
      case 'ban_ip':
        session.process.stdin.write(`ban-ip ${safeIp}\n`);
        break;
    }
  }
  return { success: true };
});

// =========================================================================
// MODS & PLUGINS MANAGER
// =========================================================================

ipcMain.handle('server:list-addons', async (_e, serverId) => {
  const safeId = sanitizeId(serverId);
  const serverDir = resolveSafePath(SERVERS_DIR, safeId);
  const addons = [];

  const dirs = [
    { type: 'mod', path: resolveSafePath(serverDir, 'mods') },
    { type: 'plugin', path: resolveSafePath(serverDir, 'plugins') }
  ];

  for (const d of dirs) {
    if (fs.existsSync(d.path)) {
      const files = fs.readdirSync(d.path);
      for (const f of files) {
        if (f.endsWith('.jar') || f.endsWith('.jar.disabled')) {
          const safeF = path.basename(f);
          const fullPath = resolveSafePath(d.path, safeF);
          const stat = fs.statSync(fullPath);
          addons.push({
            name: safeF.replace('.disabled', ''),
            fileName: safeF,
            type: d.type,
            enabled: !safeF.endsWith('.disabled'),
            sizeKb: Math.round(stat.size / 1024),
            modified: stat.mtimeMs
          });
        }
      }
    }
  }

  return addons;
});

ipcMain.handle('server:toggle-addon', async (_e, serverId, fileName, enable) => {
  const safeId = sanitizeId(serverId);
  const serverDir = resolveSafePath(SERVERS_DIR, safeId);
  const safeFileName = path.basename(fileName);
  const paths = [
    resolveSafePath(serverDir, 'mods', safeFileName),
    resolveSafePath(serverDir, 'plugins', safeFileName)
  ];

  for (const src of paths) {
    if (fs.existsSync(src)) {
      let target;
      if (enable && src.endsWith('.disabled')) {
        target = src.replace(/\.disabled$/, '');
      } else if (!enable && !src.endsWith('.disabled')) {
        target = src + '.disabled';
      }
      if (target) {
        fs.renameSync(src, target);
        return true;
      }
    }
  }
  return false;
});

ipcMain.handle('server:delete-addon', async (_e, serverId, fileName) => {
  const safeId = sanitizeId(serverId);
  const serverDir = resolveSafePath(SERVERS_DIR, safeId);
  const safeFileName = path.basename(fileName);
  const paths = [
    resolveSafePath(serverDir, 'mods', safeFileName),
    resolveSafePath(serverDir, 'plugins', safeFileName)
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) {
      fs.unlinkSync(p);
      return true;
    }
  }
  return false;
});

ipcMain.handle('server:install-addon-url', async (_e, serverId, downloadUrl, fileName) => {
  const safeId = sanitizeId(serverId);
  const cfg = loadServersConfig();
  const server = cfg.servers.find(s => s.id === safeId);
  const isPluginEngine = ['paper', 'purpur', 'spigot'].includes(server?.engine || '');
  const serverDir = resolveSafePath(SERVERS_DIR, safeId);
  const targetDir = resolveSafePath(serverDir, isPluginEngine ? 'plugins' : 'mods');

  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

  const safeFileName = path.basename(fileName);
  const targetPath = resolveSafePath(targetDir, safeFileName);
  const response = await axios({
    method: 'GET',
    url: downloadUrl,
    responseType: 'stream'
  });

  const writer = fs.createWriteStream(targetPath);
  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', () => resolve({ success: true, fileName: safeFileName }));
    writer.on('error', (err) => reject(err));
  });
});

ipcMain.handle('server:install-addon-file', async (_e, serverId, sourcePath) => {
  const safeId = sanitizeId(serverId);
  const cfg = loadServersConfig();
  const server = cfg.servers.find(s => s.id === safeId);
  const isPluginEngine = ['paper', 'purpur', 'spigot'].includes(server?.engine || '');
  const serverDir = resolveSafePath(SERVERS_DIR, safeId);
  const targetDir = resolveSafePath(serverDir, isPluginEngine ? 'plugins' : 'mods');

  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

  const safeFileName = path.basename(sourcePath);
  const dest = resolveSafePath(targetDir, safeFileName);
  fs.copyFileSync(sourcePath, dest);
  return { success: true, fileName: safeFileName };
});

ipcMain.handle('server:inspect-jar', async (_e, jarFilePath) => {
  try {
    if (!fs.existsSync(jarFilePath)) return null;
    const zip = new AdmZip(jarFilePath);

    // 1. Check Fabric mod (fabric.mod.json)
    const fabricEntry = zip.getEntry('fabric.mod.json');
    if (fabricEntry) {
      const data = JSON.parse(zip.readAsText(fabricEntry));
      const requiredDeps = [];
      if (data.depends && typeof data.depends === 'object') {
        for (const [dep] of Object.entries(data.depends)) {
          if (!['minecraft', 'java', 'fabricloader', 'fabric-language-kotlin'].includes(dep)) {
            requiredDeps.push(dep);
          }
        }
      }
      return {
        type: 'fabric',
        id: data.id,
        name: data.name || data.id,
        version: data.version,
        requiredDeps
      };
    }

    // 2. Check Forge / NeoForge (mods.toml)
    const forgeEntry = zip.getEntry('META-INF/mods.toml') || zip.getEntry('META-INF/neoforge.mods.toml');
    if (forgeEntry) {
      const text = zip.readAsText(forgeEntry);
      const requiredDeps = [];
      const matches = text.matchAll(/modId\s*=\s*["']([^"']+)["']/g);
      for (const m of matches) {
        const id = m[1];
        if (!['minecraft', 'forge', 'neoforge'].includes(id) && !requiredDeps.includes(id)) {
          requiredDeps.push(id);
        }
      }
      return {
        type: 'forge',
        id: path.basename(jarFilePath, '.jar'),
        name: path.basename(jarFilePath, '.jar'),
        requiredDeps
      };
    }

    // 3. Check Paper/Spigot plugin (plugin.yml)
    const pluginEntry = zip.getEntry('plugin.yml');
    if (pluginEntry) {
      const text = zip.readAsText(pluginEntry);
      const matchName = text.match(/name:\s*([^\r\n]+)/);
      const name = matchName ? matchName[1].trim() : path.basename(jarFilePath, '.jar');
      const dependMatch = text.match(/depend:\s*\[([^\]]+)\]/);
      const requiredDeps = dependMatch 
        ? dependMatch[1].split(',').map(s => s.trim().replace(/['"]/g, '')).filter(Boolean)
        : [];
      return {
        type: 'plugin',
        id: name,
        name,
        requiredDeps
      };
    }

    return {
      type: 'unknown',
      id: path.basename(jarFilePath, '.jar'),
      name: path.basename(jarFilePath, '.jar'),
      requiredDeps: []
    };
  } catch (err) {
    console.error('Error inspecting jar file:', err);
    return null;
  }
});

// =========================================================================
// BACKUPS & SNAPSHOTS
// =========================================================================

ipcMain.handle('server:list-backups', async (_e, serverId) => {
  const safeId = sanitizeId(serverId);
  const serverDir = resolveSafePath(SERVERS_DIR, safeId);
  const backupDir = resolveSafePath(serverDir, 'backups');
  if (!fs.existsSync(backupDir)) return [];
  const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.zip'));
  return files.map(f => {
    const safeF = path.basename(f);
    const stat = fs.statSync(resolveSafePath(backupDir, safeF));
    return {
      fileName: safeF,
      sizeMb: (stat.size / (1024 * 1024)).toFixed(2),
      createdAt: stat.birthtimeMs || stat.mtimeMs
    };
  }).sort((a, b) => b.createdAt - a.createdAt);
});

ipcMain.handle('server:create-backup', async (_e, serverId, name) => {
  const safeId = sanitizeId(serverId);
  const serverDir = resolveSafePath(SERVERS_DIR, safeId);
  const backupDir = resolveSafePath(serverDir, 'backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safeName = (name || 'snapshot').replace(/[^a-zA-Z0-9_-]/g, '_');
  const zipPath = resolveSafePath(backupDir, `backup_${safeName}_${timestamp}.zip`);

  const zip = new AdmZip();

  // Add world folder(s)
  const worldFolders = ['world', 'world_nether', 'world_the_end'];
  worldFolders.forEach(wf => {
    const full = resolveSafePath(serverDir, wf);
    if (fs.existsSync(full)) {
      zip.addLocalFolder(full, wf);
    }
  });

  // Add configuration files
  ['server.properties', 'ops.json', 'whitelist.json'].forEach(f => {
    const full = resolveSafePath(serverDir, f);
    if (fs.existsSync(full)) {
      zip.addLocalFile(full);
    }
  });

  zip.writeZip(zipPath);
  return { success: true, fileName: path.basename(zipPath) };
});

ipcMain.handle('server:restore-backup', async (_e, serverId, fileName) => {
  const safeId = sanitizeId(serverId);
  const serverDir = resolveSafePath(SERVERS_DIR, safeId);
  const safeFileName = path.basename(fileName);
  const zipPath = resolveSafePath(serverDir, 'backups', safeFileName);

  if (!fs.existsSync(zipPath)) throw new Error('Backup file does not exist');

  const zip = new AdmZip(zipPath);
  // Zip Slip vulnerability protection: verify every entry resolves within serverDir
  const zipEntries = zip.getEntries();
  for (const entry of zipEntries) {
    resolveSafePath(serverDir, entry.entryName);
  }

  zip.extractAllTo(serverDir, true);
  return { success: true };
});

ipcMain.handle('server:delete-backup', async (_e, serverId, fileName) => {
  const safeId = sanitizeId(serverId);
  const serverDir = resolveSafePath(SERVERS_DIR, safeId);
  const safeFileName = path.basename(fileName);
  const zipPath = resolveSafePath(serverDir, 'backups', safeFileName);
  if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
  }
  return true;
});

// =========================================================================
// CRASH DIAGNOSTICS & WATCHDOG
// =========================================================================

ipcMain.handle('server:get-crash-reports', async (_e, serverId) => {
  const safeId = sanitizeId(serverId);
  const serverDir = resolveSafePath(SERVERS_DIR, safeId);
  const crashDir = resolveSafePath(serverDir, 'crash-reports');
  if (!fs.existsSync(crashDir)) return [];

  const files = fs.readdirSync(crashDir).filter(f => f.endsWith('.txt'));
  return files.map(f => {
    const safeF = path.basename(f);
    const fullPath = resolveSafePath(crashDir, safeF);
    const content = fs.readFileSync(fullPath, 'utf-8');
    const firstLines = content.split('\n').slice(0, 15).join('\n');
    return {
      fileName: safeF,
      date: fs.statSync(fullPath).mtimeMs,
      summary: firstLines,
      fullContent: content
    };
  }).sort((a, b) => b.date - a.date);
});

// =========================================================================
// TUNNELING & ORACLE CLOUD ASSISTANT
// =========================================================================

ipcMain.handle('server:get-tunnel-info', async (_e, serverId) => {
  const cfg = loadServersConfig();
  const server = cfg.servers.find(s => s.id === serverId);
  const port = server?.port || 25565;

  return {
    port,
    pinggyCommand: `ssh -p 443 -R0:localhost:${port} a.pinggy.io tcp`,
    oracleIptablesCommand: `sudo iptables -I INPUT 1 -p tcp --dport ${port} -j ACCEPT && sudo iptables -I INPUT 1 -p udp --dport ${port} -j ACCEPT`,
    oracleUfwCommand: `sudo ufw allow ${port}/tcp && sudo ufw allow ${port}/udp`,
    oracleFirewalldCommand: `sudo firewall-cmd --permanent --zone=public --add-port=${port}/tcp && sudo firewall-cmd --permanent --zone=public --add-port=${port}/udp && sudo firewall-cmd --reload`
  };
});

ipcMain.handle('tunnel:start-playit', async () => {
  if (playitProcess) {
    return { success: true, message: 'Playit is already running' };
  }
  try {
    playitProcess = spawn('playit', [], { stdio: ['pipe', 'pipe', 'pipe'] });
    playitProcess.stdout.on('data', (data) => {
      mainWindow?.webContents.send('tunnel:log', data.toString());
    });
    playitProcess.stderr.on('data', (data) => {
      mainWindow?.webContents.send('tunnel:log', data.toString());
    });
    playitProcess.on('close', () => {
      playitProcess = null;
    });
    return { success: true };
  } catch {
    return { success: false, message: 'playit command not found on PATH. Please install playit.gg CLI.' };
  }
});

ipcMain.handle('tunnel:stop-playit', async () => {
  if (playitProcess) {
    try {
      playitProcess.kill();
      playitProcess = null;
    } catch {}
  }
  return { success: true };
});
