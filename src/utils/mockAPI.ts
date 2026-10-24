import { ServerConfig } from '../types/electron';

export function initializeMockAPIIfNeeded() {
  if (typeof window !== 'undefined' && !window.mcServerAPI) {
    console.warn('[MOCK_API] Running outside Electron shell. Initializing browser mock API.');

    let mockServers: ServerConfig[] = [
      {
        id: 'srv_demo_01',
        name: 'NODE_CYBER_SURVIVAL',
        engine: 'paper',
        mcVersion: '1.21.1',
        port: 25565,
        minRam: 2,
        maxRam: 4,
        javaPath: 'java',
        jarFile: 'paper-1.21.1.jar',
        onlineMode: false,
        autoRestart: true,
        useAikarFlags: true,
        created: Date.now() - 3600000,
        status: 'stopped',
        serverDir: 'C:\\minecraft_servers\\NODE_CYBER_SURVIVAL'
      }
    ];

    let currentStatus = 'stopped';
    let logListeners: ((log: any) => void)[] = [];
    let statusListeners: ((data: any) => void)[] = [];
    let statsListeners: ((data: any) => void)[] = [];

    const mockProps: Record<string, string> = {
      motd: 'TERMINAL_CLI // Cyber Mainframe MC 1.21.1',
      'server-port': '25565',
      gamemode: 'survival',
      difficulty: 'normal',
      'max-players': '20',
      'online-mode': 'false',
      pvp: 'true',
      'enable-command-block': 'true',
      'simulation-distance': '8',
      'view-distance': '10'
    };

    window.mcServerAPI = {
      getSystemInfo: async () => ({
        platform: 'win32',
        arch: 'x64',
        totalMem: 32,
        freeMem: 18,
        cpus: 12,
        hostname: 'MAINFRAME-NODE-01',
        dataDir: 'C:\\Users\\TerminalUser\\AppData\\Roaming\\terminal-mc-data'
      }),
      detectJavaRuntimes: async () => [
        { path: 'C:\\Program Files\\Eclipse Adoptium\\jdk-21.0.3.9-hotspot\\bin\\java.exe', version: '21.0.3', majorVersion: 21, label: 'Eclipse Adoptium Java 21' },
        { path: 'C:\\Program Files\\Java\\jdk-17.0.8\\bin\\java.exe', version: '17.0.8', majorVersion: 17, label: 'Oracle Java 17' },
        { path: 'java', version: 'System PATH', majorVersion: 21, label: 'System Default Java' }
      ],
      openExternalUrl: async (url) => { window.open(url, '_blank'); return true; },
      openFolder: async () => true,

      getServers: async () => mockServers,
      createServer: async (cfg) => {
        const cleanName = (cfg.name || 'node').toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'node';
        const randCode = Math.random().toString(36).substring(2, 6);
        const s: ServerConfig = {
          id: 'srv_' + Date.now(),
          name: cfg.name || 'NEW_NODE',
          engine: cfg.engine || 'paper',
          mcVersion: cfg.mcVersion || '1.21.1',
          port: cfg.port || 25565,
          minRam: cfg.minRam || 2,
          maxRam: cfg.maxRam || 4,
          javaPath: 'java',
          jarFile: 'server.jar',
          tunnelAddress: `${cleanName}.${randCode}.obsiforge.ply.gg`,
          onlineMode: cfg.onlineMode !== undefined ? cfg.onlineMode : false,
          autoRestart: true,
          useAikarFlags: true,
          created: Date.now(),
          status: 'stopped'
        };
        mockServers.push(s);
        return s;
      },
      updateServer: async (id, data) => {
        const idx = mockServers.findIndex(s => s.id === id);
        if (idx !== -1) {
          mockServers[idx] = { ...mockServers[idx], ...data };
          return mockServers[idx];
        }
        return null;
      },
      deleteServer: async (id) => {
        mockServers = mockServers.filter(s => s.id !== id);
        return true;
      },

      startServer: async (id) => {
        currentStatus = 'starting';
        statusListeners.forEach(cb => cb({ serverId: id, status: 'starting' }));

        logListeners.forEach(cb => cb({ serverId: id, line: '[SYSTEM] Spawning Minecraft Server Process [PID: 4892] with -Xms2G -Xmx4G...', timestamp: Date.now() }));

        setTimeout(() => {
          logListeners.forEach(cb => cb({ serverId: id, line: '[12:00:01 INFO]: Loading properties', timestamp: Date.now() }));
          logListeners.forEach(cb => cb({ serverId: id, line: '[12:00:02 INFO]: Starting Minecraft server on *:25565', timestamp: Date.now() }));
          logListeners.forEach(cb => cb({ serverId: id, line: '[12:00:03 INFO]: Preparing level "world"', timestamp: Date.now() }));
        }, 1000);

        setTimeout(() => {
          currentStatus = 'running';
          statusListeners.forEach(cb => cb({ serverId: id, status: 'running' }));
          logListeners.forEach(cb => cb({ serverId: id, line: '[12:00:06 INFO]: Done (4.120s)! For help, type "help"', timestamp: Date.now() }));

          // Start mock metrics stream
          setInterval(() => {
            if (currentStatus === 'running') {
              const cpu = Math.floor(15 + Math.random() * 35);
              const mem = Math.floor(1800 + Math.random() * 600);
              statsListeners.forEach(cb => cb({ serverId: id, cpu, memoryMb: mem, uptime: 120 }));
            }
          }, 2000);
        }, 3000);

        return { success: true, pid: 4892 };
      },

      stopServer: async (id) => {
        currentStatus = 'stopping';
        statusListeners.forEach(cb => cb({ serverId: id, status: 'stopping' }));
        logListeners.forEach(cb => cb({ serverId: id, line: '[12:01:00 INFO]: Stopping server...', timestamp: Date.now() }));
        logListeners.forEach(cb => cb({ serverId: id, line: '[12:01:02 INFO]: Saving worlds and chunks...', timestamp: Date.now() }));

        setTimeout(() => {
          currentStatus = 'stopped';
          statusListeners.forEach(cb => cb({ serverId: id, status: 'stopped' }));
          logListeners.forEach(cb => cb({ serverId: id, line: '[SYSTEM] Server process exited cleanly with code 0.', timestamp: Date.now() }));
        }, 2000);
        return { success: true };
      },

      restartServer: async (id) => {
        await window.mcServerAPI.stopServer(id);
        setTimeout(() => window.mcServerAPI.startServer(id), 2500);
        return { success: true };
      },

      killServer: async (id) => {
        currentStatus = 'stopped';
        statusListeners.forEach(cb => cb({ serverId: id, status: 'stopped' }));
        logListeners.forEach(cb => cb({ serverId: id, line: '[SYSTEM] Process terminated with SIGKILL.', timestamp: Date.now() }));
        return { success: true };
      },

      sendCommand: async (id, cmd) => {
        logListeners.forEach(cb => cb({ serverId: id, line: `> ${cmd}`, timestamp: Date.now() }));
        if (cmd === 'list') {
          logListeners.forEach(cb => cb({ serverId: id, line: '[12:05:00 INFO]: There are 1 of a max of 20 players online: Admin_Master', timestamp: Date.now() }));
        } else if (cmd === 'save-all') {
          logListeners.forEach(cb => cb({ serverId: id, line: '[12:05:01 INFO]: Saved the game', timestamp: Date.now() }));
        } else {
          logListeners.forEach(cb => cb({ serverId: id, line: `[12:05:02 INFO]: Command "${cmd}" executed successfully.`, timestamp: Date.now() }));
        }
        return { success: true };
      },

      getServerStatus: async (id) => ({ serverId: id, status: currentStatus, pid: 4892 }),

      getProperties: async () => mockProps,
      saveProperties: async (_id, p) => { Object.assign(mockProps, p); return true; },
      getWorldInfo: async () => ({
        levelName: mockProps['level-name'] || 'world',
        levelSeed: mockProps['level-seed'] || '492819401948194',
        levelType: mockProps['level-type'] || 'minecraft:normal',
        totalSizeMb: '48.65',
        dimensions: [
          { folderName: 'world', sizeMb: '36.40', hasLevelDat: true, hasRegion: true },
          { folderName: 'world_nether', sizeMb: '8.20', hasLevelDat: false, hasRegion: true },
          { folderName: 'world_the_end', sizeMb: '4.05', hasLevelDat: false, hasRegion: true }
        ]
      }),
      resetWorld: async (_id, newSeed) => {
        const seed = newSeed || `${Math.random() > 0.5 ? '' : '-'}${Math.floor(Math.random() * 8999999999999999 + 1000000000000000)}`;
        mockProps['level-seed'] = seed;
        return { success: true, newSeed: seed };
      },
      getRawFile: async () => Object.entries(mockProps).map(([k, v]) => `${k}=${v}`).join('\n'),
      saveRawFile: async () => true,

      getPlayersData: async () => ({
        ops: [{ uuid: '00000000-0000-0000-0000-000000000001', name: 'Admin_Master', level: 4, bypassesPlayerLimit: true }],
        whitelist: [{ uuid: '00000000-0000-0000-0000-000000000001', name: 'Admin_Master' }, { uuid: '00000000-0000-0000-0000-000000000002', name: 'Friend_Alex' }],
        bannedPlayers: [{ name: 'Griefer_99', uuid: 'none', created: '2026-10-18', source: 'Admin', expires: 'forever', reason: 'Using fly hacks' }],
        bannedIps: []
      }),
      savePlayersData: async () => true,
      executePlayerAction: async () => ({ success: true }),
      applyAntiCheatShield: async () => ({ success: true, message: 'Anti-cheat shield applied (Mock)' }),

      listAddons: async () => [
        { name: 'Lithium', fileName: 'lithium-fabric-0.12.7.jar', type: 'mod', enabled: true, sizeKb: 890, modified: Date.now() },
        { name: 'FerriteCore', fileName: 'ferritecore-6.0.1-fabric.jar', type: 'mod', enabled: true, sizeKb: 340, modified: Date.now() },
        { name: 'SkinRestorer', fileName: 'SkinRestorer-v15.0.3.jar', type: 'plugin', enabled: true, sizeKb: 1420, modified: Date.now() }
      ],
      toggleAddon: async () => true,
      deleteAddon: async () => true,
      installAddonFromUrl: async (_id, _u, fileName) => ({ success: true, fileName }),
      installAddonFromFile: async (_id, path) => ({ success: true, fileName: path }),
      inspectJar: async (filePath) => {
        if (filePath.toLowerCase().includes('fabric')) {
          return { type: 'fabric', id: 'sample-mod', name: 'Sample Fabric Mod', requiredDeps: ['fabric-api'] };
        }
        return { type: 'mod', id: 'sample-mod', name: 'Sample Mod', requiredDeps: [] };
      },

      listBackups: async () => [
        { fileName: 'backup_before_dragon_fight_2026-10-19.zip', sizeMb: '42.15', createdAt: Date.now() - 86400000 },
        { fileName: 'backup_initial_world_generation_2026-10-18.zip', sizeMb: '18.40', createdAt: Date.now() - 172800000 }
      ],
      createBackup: async (_id, name) => ({ success: true, fileName: `backup_${name || 'snap'}_${Date.now()}.zip` }),
      restoreBackup: async () => ({ success: true }),
      deleteBackup: async () => true,

      getCrashReports: async () => [
        {
          fileName: 'crash-2026-10-19_14.20.10-server.txt',
          date: Date.now() - 40000000,
          summary: '---- Minecraft Crash Report ----\n// Who set us up the TNT?\nTime: 2026-10-19 14:20:10\nDescription: Exception in server tick loop\njava.lang.OutOfMemoryError: Java heap space',
          fullContent: '---- Minecraft Crash Report ----\n// Who set us up the TNT?\nTime: 2026-10-19 14:20:10\nDescription: Exception in server tick loop\n\njava.lang.OutOfMemoryError: Java heap space\n\tat net.minecraft.world.level.chunk.LinearPalette.<init>(LinearPalette.java:24)\n\tat net.minecraft.server.MinecraftServer.tickChildren(MinecraftServer.java:872)\n\tat net.minecraft.server.dedicated.DedicatedServer.tickChildren(DedicatedServer.java:414)\n\tat net.minecraft.server.MinecraftServer.tickServer(MinecraftServer.java:818)\n\tat net.minecraft.server.MinecraftServer.runServer(MinecraftServer.java:664)'
        }
      ],

      getTunnelInfo: async () => ({
        port: 25565,
        pinggyCommand: 'ssh -p 443 -R0:localhost:25565 a.pinggy.io tcp',
        oracleIptablesCommand: 'sudo iptables -I INPUT 1 -p tcp --dport 25565 -j ACCEPT && sudo iptables -I INPUT 1 -p udp --dport 25565 -j ACCEPT && sudo netfilter-persistent save',
        oracleUfwCommand: 'sudo ufw allow 25565/tcp && sudo ufw allow 25565/udp',
        oracleFirewalldCommand: 'sudo firewall-cmd --permanent --zone=public --add-port=25565/tcp && sudo firewall-cmd --permanent --zone=public --add-port=25565/udp && sudo firewall-cmd --reload'
      }),
      startPlayitTunnel: async () => ({ success: true }),
      stopPlayitTunnel: async () => ({ success: true }),

      onServerLog: (cb) => { logListeners.push(cb); return () => { logListeners = logListeners.filter(l => l !== cb); }; },
      onServerStatusChanged: (cb) => { statusListeners.push(cb); return () => { statusListeners = statusListeners.filter(l => l !== cb); }; },
      onResourceStats: (cb) => { statsListeners.push(cb); return () => { statsListeners = statsListeners.filter(l => l !== cb); }; },
      onTunnelLog: () => () => {},
      onDownloadProgress: () => () => {}
    };
  }
}
