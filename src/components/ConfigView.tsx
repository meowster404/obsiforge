import React, { useState, useEffect } from 'react';
import { ServerConfig, JavaRuntime, WorldInfo } from '../types/electron';
import { generateObsiForgeAddress } from '../services/neonAuth';
import { Settings, Globe, Cpu, Save, RefreshCw, Check, Folder, AlertTriangle, Flame, Moon, Compass, Trash2 } from 'lucide-react';

interface ConfigViewProps {
  server: ServerConfig | null;
  onUpdateServerConfig: (updated: Partial<ServerConfig>) => void;
  onDeleteServer?: (serverId: string) => void;
}

export const ConfigView: React.FC<ConfigViewProps> = ({ server, onUpdateServerConfig, onDeleteServer }) => {
  const [activeTab, setActiveTab] = useState<'visual' | 'world' | 'java'>('visual');
  const [properties, setProperties] = useState<Record<string, string>>({});
  const [javaRuntimes, setJavaRuntimes] = useState<JavaRuntime[]>([]);
  const [worldInfo, setWorldInfo] = useState<WorldInfo | null>(null);
  const [worldLoading, setWorldLoading] = useState(false);
  const [resettingWorld, setResettingWorld] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetConfirmInput, setResetConfirmInput] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const loadJavaRuntimes = async () => {
    try {
      const list = await window.mcServerAPI.detectJavaRuntimes();
      setJavaRuntimes(list);
    } catch (e) {
      console.error('Error detecting java runtimes:', e);
    }
  };

  const loadWorldInfo = async () => {
    if (!server || !window.mcServerAPI?.getWorldInfo) return;
    setWorldLoading(true);
    try {
      const info = await window.mcServerAPI.getWorldInfo(server.id);
      setWorldInfo(info);
    } catch (e) {
      console.error('Error reading world info:', e);
    } finally {
      setWorldLoading(false);
    }
  };

  // Load properties and detected java runtimes
  useEffect(() => {
    if (!server) return;
    let isCancelled = false;

    window.mcServerAPI.getProperties(server.id)
      .then(p => { if (!isCancelled) setProperties(p); })
      .catch(e => console.error('Error reading properties:', e));

    window.mcServerAPI.detectJavaRuntimes()
      .then(list => { if (!isCancelled) setJavaRuntimes(list); })
      .catch(e => console.error('Error detecting java runtimes:', e));

    if (window.mcServerAPI?.getWorldInfo) {
      window.mcServerAPI.getWorldInfo(server.id)
        .then(info => { if (!isCancelled) setWorldInfo(info); })
        .catch(e => console.error('Error reading world info:', e));
    }

    return () => {
      isCancelled = true;
    };
  }, [server]);

  const handlePropertyChange = (key: string, value: string) => {
    setProperties(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveProperties = async () => {
    if (!server) return;
    try {
      await window.mcServerAPI.saveProperties(server.id, properties);
      // also sync onlineMode to server object if changed
      if (properties['online-mode'] !== undefined) {
        const isOnline = properties['online-mode'] === 'true';
        onUpdateServerConfig({ onlineMode: isOnline });
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
      await loadWorldInfo();
    } catch (e) {
      alert('Error saving properties: ' + e);
    }
  };

  const handleOpenWorldFolder = () => {
    if (server?.serverDir) {
      const worldFolder = properties['level-name'] || 'world';
      window.mcServerAPI.openFolder(`${server.serverDir}/${worldFolder}`);
    }
  };

  const handleResetWorld = async () => {
    if (!server) return;
    if (resetConfirmInput.trim().toUpperCase() !== 'RESET') {
      alert('Please type "RESET" to confirm world deletion.');
      return;
    }
    setResettingWorld(true);
    try {
      // Automatically generate a new random seed for the fresh world instance
      const sign = Math.random() > 0.5 ? '' : '-';
      const randPart = Math.floor(Math.random() * 8999999999999999 + 1000000000000000).toString();
      const freshRandomSeed = `${sign}${randPart}`;

      const res = await window.mcServerAPI.resetWorld(server.id, freshRandomSeed);
      if (res && res.success) {
        const assignedSeed = res.newSeed || freshRandomSeed;
        setShowResetDialog(false);
        setResetConfirmInput('');
        setProperties(prev => ({ ...prev, 'level-seed': assignedSeed }));
        await loadWorldInfo();
        alert(`World reset complete! A new random terrain seed (${assignedSeed}) has been generated and configured. When the server boots, a brand-new world will generate.`);
      } else {
        alert('Failed resetting world.');
      }
    } catch (e: any) {
      alert('Error resetting world: ' + (e.message || e));
    } finally {
      setResettingWorld(false);
    }
  };

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', height: '100%', flex: 1, background: '#0a0a0a', gap: '14px', overflowY: 'auto' }}>
      {/* Subtabs & Save Status */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className={`cli-btn ${activeTab === 'visual' ? '' : 'cli-btn-muted'}`} onClick={() => setActiveTab('visual')}>
            <Settings size={13} /> [ SERVER PROPERTIES ]
          </button>
          <button className={`cli-btn ${activeTab === 'world' ? 'cli-btn-secondary' : 'cli-btn-muted'}`} onClick={() => setActiveTab('world')}>
            <Globe size={13} /> [ WORLD &amp; MAP MANAGER ]
          </button>
          <button className={`cli-btn ${activeTab === 'java' ? 'cli-btn-secondary' : 'cli-btn-muted'}`} onClick={() => setActiveTab('java')}>
            <Cpu size={13} /> [ JAVA &amp; RAM ALLOCATION ]
          </button>
        </div>

        {saveSuccess && (
          <div style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
            <Check size={14} /> [ CONFIGURATION PERSISTED SUCCESSFULLY ]
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: VISUAL PROPERTIES EDITOR                                           */}
      {/* ========================================================================= */}
      {activeTab === 'visual' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Cracked / Offline Mode Toggle Alert Banner */}
          <div className="cli-pane" style={{ padding: '12px', background: properties['online-mode'] === 'false' ? '#170f03' : '#071007', border: properties['online-mode'] === 'false' ? '1px solid var(--secondary)' : '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: '13px', color: properties['online-mode'] === 'false' ? 'var(--secondary)' : 'var(--primary)' }}>
                  CRACKED / OFFLINE CLIENT ACCESS (ONLINE-MODE)
                </div>
                <div className="text-muted" style={{ fontSize: '11px', marginTop: '2px' }}>
                  Set to FALSE if you or your friends use non-premium (cracked) Minecraft launchers (e.g., TLauncher, Prism cracked, Legacy).
                </div>
              </div>
              <button
                className={`cli-btn ${properties['online-mode'] === 'false' ? 'cli-btn-secondary' : 'cli-btn-muted'}`}
                style={{ fontWeight: 800, padding: '6px 14px' }}
                onClick={() => handlePropertyChange('online-mode', properties['online-mode'] === 'true' ? 'false' : 'true')}
              >
                {properties['online-mode'] === 'false' ? '[CRACKED ENABLED]' : '[PREMIUM ONLY]'}
              </button>
            </div>
          </div>

          {/* Minecraft Joining Address Banner */}
          <div className="cli-pane" style={{ padding: '12px', background: '#07151a', border: '1px solid var(--cyan)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: '12px', color: 'var(--cyan)', letterSpacing: '0.06em' }}>
                  MINECRAFT PUBLIC JOINING IP (MULTIPLAYER DIRECT CONNECT)
                </div>
                <div style={{ fontSize: '15px', fontWeight: 900, color: '#fff', fontFamily: "'JetBrains Mono', Consolas, monospace", marginTop: '3px' }}>
                  {server?.tunnelAddress || (server?.name ? generateObsiForgeAddress(server.name) : 'node.xxxx.obsiforge.ply.gg')}
                </div>
                <div className="text-muted" style={{ fontSize: '10px', marginTop: '2px' }}>
                  Format: <code>{'{SERVER_NAME}.{RANDOM_CODE}.obsiforge.ply.gg'}</code>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="cli-btn"
                  style={{ borderColor: 'var(--cyan)', color: 'var(--cyan)', fontSize: '11px', padding: '4px 10px' }}
                  onClick={() => {
                    const newAddr = generateObsiForgeAddress(server?.name);
                    onUpdateServerConfig({ tunnelAddress: newAddr });
                  }}
                  title="Generate a new random code for this server"
                >
                  <RefreshCw size={12} /> [ REGENERATE ADDRESS ]
                </button>
              </div>
            </div>
          </div>

          {/* Core Properties Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '14px' }}>
            {/* Gamemode */}
            <div className="cli-pane" style={{ padding: '12px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--primary)', display: 'block', marginBottom: '6px' }}>
                DEFAULT GAMEMODE (gamemode)
              </label>
              <select
                className="cli-select"
                style={{ width: '100%' }}
                value={properties['gamemode'] || 'survival'}
                onChange={(e) => handlePropertyChange('gamemode', e.target.value)}
              >
                <option value="survival">survival</option>
                <option value="creative">creative</option>
                <option value="adventure">adventure</option>
                <option value="spectator">spectator</option>
              </select>
            </div>

            {/* Difficulty */}
            <div className="cli-pane" style={{ padding: '12px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--primary)', display: 'block', marginBottom: '6px' }}>
                DIFFICULTY (difficulty)
              </label>
              <select
                className="cli-select"
                style={{ width: '100%' }}
                value={properties['difficulty'] || 'easy'}
                onChange={(e) => handlePropertyChange('difficulty', e.target.value)}
              >
                <option value="peaceful">peaceful</option>
                <option value="easy">easy</option>
                <option value="normal">normal</option>
                <option value="hard">hard</option>
              </select>
            </div>

            {/* Max Players */}
            <div className="cli-pane" style={{ padding: '12px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--primary)', display: 'block', marginBottom: '6px' }}>
                MAX CONCURRENT PLAYERS (max-players)
              </label>
              <input
                type="number"
                className="cli-input"
                value={properties['max-players'] || '20'}
                onChange={(e) => handlePropertyChange('max-players', e.target.value)}
              />
            </div>

            {/* Server Port */}
            <div className="cli-pane" style={{ padding: '12px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--primary)', display: 'block', marginBottom: '6px' }}>
                NETWORK PORT (server-port)
              </label>
              <input
                type="number"
                className="cli-input"
                value={properties['server-port'] || '25565'}
                onChange={(e) => handlePropertyChange('server-port', e.target.value)}
              />
            </div>

            {/* PVP */}
            <div className="cli-pane" style={{ padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--primary)' }}>PLAYER VS PLAYER (pvp)</div>
                <div className="text-muted" style={{ fontSize: '10px' }}>Enable or disable combat between players</div>
              </div>
              <button
                className={`cli-btn ${properties['pvp'] === 'true' ? '' : 'cli-btn-muted'}`}
                onClick={() => handlePropertyChange('pvp', properties['pvp'] === 'true' ? 'false' : 'true')}
              >
                [{properties['pvp'] === 'true' ? 'PVP ON' : 'PVP OFF'}]
              </button>
            </div>

            {/* Whitelist */}
            <div className="cli-pane" style={{ padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--primary)' }}>ENFORCE WHITELIST (white-list)</div>
                <div className="text-muted" style={{ fontSize: '10px' }}>Only allow players on the whitelist.json</div>
              </div>
              <button
                className={`cli-btn ${properties['white-list'] === 'true' ? '' : 'cli-btn-muted'}`}
                onClick={() => handlePropertyChange('white-list', properties['white-list'] === 'true' ? 'false' : 'true')}
              >
                [{properties['white-list'] === 'true' ? 'WHITELIST ON' : 'PUBLIC ACCESS'}]
              </button>
            </div>

            {/* Spawn Protection */}
            <div className="cli-pane" style={{ padding: '12px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--primary)', display: 'block', marginBottom: '6px' }}>
                SPAWN PROTECTION RADIUS (spawn-protection)
              </label>
              <input
                type="number"
                className="cli-input"
                value={properties['spawn-protection'] || '16'}
                onChange={(e) => handlePropertyChange('spawn-protection', e.target.value)}
              />
            </div>

            {/* View Distance */}
            <div className="cli-pane" style={{ padding: '12px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--primary)', display: 'block', marginBottom: '6px' }}>
                SIMULATION &amp; VIEW DISTANCE (view-distance: {properties['view-distance'] || '10'} chunks)
              </label>
              <input
                type="range"
                min="4"
                max="32"
                value={properties['view-distance'] || '10'}
                onChange={(e) => handlePropertyChange('view-distance', e.target.value)}
                style={{ width: '100%', accentColor: 'var(--primary)' }}
              />
            </div>
          </div>

          {/* MOTD Input */}
          <div className="cli-pane" style={{ padding: '12px' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--primary)', display: 'block', marginBottom: '6px' }}>
              MESSAGE OF THE DAY (motd)
            </label>
            <input
              type="text"
              className="cli-input"
              value={properties['motd'] || ''}
              onChange={(e) => handlePropertyChange('motd', e.target.value)}
              placeholder="Minecraft Server MOTD shown in multiplayer list..."
            />
          </div>

          <button className="cli-btn" style={{ padding: '10px 20px', fontWeight: 800, alignSelf: 'flex-start' }} onClick={handleSaveProperties}>
            <Save size={14} /> [ PERSIST SERVER PROPERTIES ]
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: WORLD & MAP MANAGER                                                */}
      {/* ========================================================================= */}
      {activeTab === 'world' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Header Card with Dimension Statistics */}
          <div className="cli-pane" style={{ padding: '14px' }}>
            <div className="cli-pane-header" style={{ margin: '-14px -14px 14px -14px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Globe size={14} color="var(--primary)" />
                <span>&gt; MINECRAFT WORLD SPECIFICATIONS &amp; DISK ALLOCATION</span>
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="cli-btn cli-btn-muted" style={{ padding: '2px 8px', fontSize: '11px' }} onClick={loadWorldInfo}>
                  <RefreshCw size={11} className={worldLoading ? 'spin' : ''} /> [ REFRESH ]
                </button>
                <button className="cli-btn" style={{ padding: '2px 8px', fontSize: '11px' }} onClick={handleOpenWorldFolder}>
                  <Folder size={11} /> [ OPEN WORLD DIRECTORY ]
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', fontSize: '12px' }}>
              <div>
                <span className="text-muted">LEVEL / WORLD NAME:</span>
                <div style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '14px', marginTop: '2px' }}>
                  {properties['level-name'] || worldInfo?.levelName || 'world'}
                </div>
              </div>
              <div>
                <span className="text-muted">TOTAL WORLD DISK USAGE:</span>
                <div style={{ fontWeight: 800, color: 'var(--cyan)', fontSize: '14px', marginTop: '2px' }}>
                  {worldInfo?.totalSizeMb || '0.00'} MB
                </div>
              </div>
              <div>
                <span className="text-muted">WORLD GENERATOR TYPE:</span>
                <div style={{ fontWeight: 800, color: 'var(--secondary)', fontSize: '14px', marginTop: '2px' }}>
                  {properties['level-type'] || 'minecraft:normal'}
                </div>
              </div>
              <div>
                <span className="text-muted">ALLOW NETHER:</span>
                <div style={{ fontWeight: 800, color: properties['allow-nether'] !== 'false' ? 'var(--primary)' : 'var(--muted-text)', fontSize: '14px', marginTop: '2px' }}>
                  {properties['allow-nether'] !== 'false' ? 'YES (DIM-1 ACTIVE)' : 'DISABLED'}
                </div>
              </div>
            </div>
          </div>

          {/* World Seed & Generation Parameters */}
          <div className="cli-pane" style={{ padding: '14px' }}>
            <div className="cli-pane-header" style={{ margin: '-14px -14px 14px -14px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Compass size={14} color="var(--primary)" />
                <span>&gt; WORLD SEED &amp; BIOME CONFIGURATION</span>
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)' }}>
                    ACTIVE WORLD SEED (level-seed):
                  </label>
                  <span className="text-muted" style={{ fontSize: '10px', letterSpacing: '0.06em' }}>
                    [ LOCKED TO CURRENT WORLD ]
                  </span>
                </div>
                <input
                  type="text"
                  className="cli-input"
                  style={{ fontSize: '13px', letterSpacing: '0.08em', fontWeight: 600, opacity: 0.9, background: '#0b130b', cursor: 'default' }}
                  value={properties['level-seed'] || ''}
                  readOnly
                  title="World seed is immutable once the server is created. Resetting the world will automatically generate a new random seed."
                />
                <div className="text-muted" style={{ fontSize: '11px', marginTop: '6px', lineHeight: '1.4' }}>
                  * The world seed is locked to this generated world. Custom seed selection is configured during initial server instance creation. To regenerate a fresh world with a new seed, click <strong>[ RESET &amp; REGENERATE WORLD ]</strong> below—ObsiForge will automatically roll a new random seed.
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--primary)', display: 'block', marginBottom: '6px' }}>
                    LEVEL TYPE / WORLD PRESET (level-type):
                  </label>
                  <select
                    className="cli-select"
                    style={{ width: '100%' }}
                    value={properties['level-type'] || 'minecraft:normal'}
                    onChange={(e) => handlePropertyChange('level-type', e.target.value)}
                  >
                    <option value="minecraft:normal">minecraft:normal (Default Biomes &amp; Terrain)</option>
                    <option value="minecraft:flat">minecraft:flat (Superflat World)</option>
                    <option value="minecraft:large_biomes">minecraft:large_biomes (4x Biome Size)</option>
                    <option value="minecraft:amplified">minecraft:amplified (Extreme Mountain Cliffs)</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--primary)', display: 'block', marginBottom: '6px' }}>
                    GENERATE STRUCTURES (generate-structures):
                  </label>
                  <select
                    className="cli-select"
                    style={{ width: '100%' }}
                    value={properties['generate-structures'] || 'true'}
                    onChange={(e) => handlePropertyChange('generate-structures', e.target.value)}
                  >
                    <option value="true">ENABLED (Villages, Temples, Strongholds)</option>
                    <option value="false">DISABLED (Natural Wilderness Only)</option>
                  </select>
                </div>
              </div>

              <button className="cli-btn" style={{ padding: '8px 18px', fontWeight: 800, alignSelf: 'flex-start' }} onClick={handleSaveProperties}>
                <Save size={14} /> [ PERSIST WORLD CONFIGURATION ]
              </button>
            </div>
          </div>

          {/* Dimension Directories / Chunks Breakdown */}
          <div className="cli-pane" style={{ padding: '14px' }}>
            <div className="cli-pane-header" style={{ margin: '-14px -14px 14px -14px' }}>
              <span>&gt; DIMENSION DATA DIRECTORIES &amp; CHUNKS</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
              {/* Overworld */}
              <div className="cli-pane" style={{ background: '#071507', border: '1px solid #143314', padding: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <Globe size={16} color="var(--primary)" />
                  <strong style={{ fontSize: '13px', color: 'var(--primary)' }}>OVERWORLD (Surface)</strong>
                </div>
                <div style={{ fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div><span className="text-muted">FOLDER: </span><code>/{properties['level-name'] || 'world'}</code></div>
                  <div><span className="text-muted">DATA CHUNKS: </span><code>/region/*.mca</code></div>
                  <div><span className="text-muted">LEVEL METADATA: </span><code>level.dat</code></div>
                  <div><span className="text-muted">DISK SIZE: </span><span className="text-cyan">
                    {worldInfo?.dimensions?.find(d => d.folderName === (properties['level-name'] || 'world'))?.sizeMb || '0.00'} MB
                  </span></div>
                </div>
              </div>

              {/* The Nether */}
              <div className="cli-pane" style={{ background: '#170808', border: '1px solid #4a1414', padding: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <Flame size={16} color="#ff4444" />
                  <strong style={{ fontSize: '13px', color: '#ff4444' }}>THE NETHER (DIM-1)</strong>
                </div>
                <div style={{ fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div><span className="text-muted">FOLDER: </span><code>/{properties['level-name'] || 'world'}_nether (or DIM-1)</code></div>
                  <div><span className="text-muted">DATA CHUNKS: </span><code>/DIM-1/region/*.mca</code></div>
                  <div><span className="text-muted">STATUS: </span><span className="text-amber">Fortresses &amp; Basalt Deltas</span></div>
                  <div><span className="text-muted">DISK SIZE: </span><span className="text-cyan">
                    {worldInfo?.dimensions?.find(d => d.folderName.includes('nether') || d.folderName.includes('DIM-1'))?.sizeMb || '0.00'} MB
                  </span></div>
                </div>
              </div>

              {/* The End */}
              <div className="cli-pane" style={{ background: '#110a17', border: '1px solid #3d144a', padding: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <Moon size={16} color="#bb86fc" />
                  <strong style={{ fontSize: '13px', color: '#bb86fc' }}>THE END (DIM1)</strong>
                </div>
                <div style={{ fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div><span className="text-muted">FOLDER: </span><code>/{properties['level-name'] || 'world'}_the_end (or DIM1)</code></div>
                  <div><span className="text-muted">DATA CHUNKS: </span><code>/DIM1/region/*.mca</code></div>
                  <div><span className="text-muted">STATUS: </span><span className="text-amber">Ender Dragon Island &amp; Cities</span></div>
                  <div><span className="text-muted">DISK SIZE: </span><span className="text-cyan">
                    {worldInfo?.dimensions?.find(d => d.folderName.includes('end') || d.folderName.includes('DIM1'))?.sizeMb || '0.00'} MB
                  </span></div>
                </div>
              </div>
            </div>
          </div>

          {/* Danger Zone: Regenerate / Reset World */}
          <div className="cli-pane" style={{ padding: '14px', border: '1px solid #ff4444', background: '#140505' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ff4444', fontWeight: 800, fontSize: '13px' }}>
                  <AlertTriangle size={16} /> [ DANGER ZONE: REGENERATE &amp; RESET WORLD ]
                </div>
                <div className="text-muted" style={{ fontSize: '11px', marginTop: '4px', maxWidth: '650px', lineHeight: '1.4' }}>
                  Permanently deletes existing terrain chunks, buildings, player inventories, and structures in <code>/{properties['level-name'] || 'world'}</code>.
                  A fresh high-entropy random world seed will be automatically generated and assigned, producing clean uncorrupted terrain on next server boot.
                </div>
              </div>

              <button
                className="cli-btn"
                style={{ borderColor: '#ff4444', color: '#ff4444', fontWeight: 800, padding: '8px 16px' }}
                onClick={() => setShowResetDialog(true)}
              >
                [ ⚠ RESET &amp; REGENERATE WORLD ]
              </button>
            </div>

            {/* Confirmation Dialog */}
            {showResetDialog && (
              <div style={{ marginTop: '14px', borderTop: '1px dashed #ff4444', paddingTop: '12px', background: '#200707', padding: '12px' }}>
                <div style={{ fontSize: '12px', color: '#ff7777', fontWeight: 700, marginBottom: '8px' }}>
                  CONFIRMATION REQUIRED: Type <strong style={{ color: '#fff' }}>RESET</strong> below to confirm permanent deletion of existing world files:
                </div>
                <div style={{ display: 'flex', gap: '8px', maxWidth: '400px' }}>
                  <input
                    type="text"
                    className="cli-input"
                    value={resetConfirmInput}
                    onChange={(e) => setResetConfirmInput(e.target.value)}
                    placeholder="Type RESET here..."
                    style={{ borderColor: '#ff4444' }}
                  />
                  <button
                    className="cli-btn"
                    style={{ borderColor: '#ff4444', color: '#ff4444', fontWeight: 800 }}
                    onClick={handleResetWorld}
                    disabled={resettingWorld}
                  >
                    {resettingWorld ? '[ RESETTING... ]' : '[ CONFIRM RESET ]'}
                  </button>
                  <button
                    className="cli-btn cli-btn-muted"
                    onClick={() => {
                      setShowResetDialog(false);
                      setResetConfirmInput('');
                    }}
                  >
                    [ CANCEL ]
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Danger Zone: Delete Server Node */}
          {onDeleteServer && server && (
            <div className="cli-pane" style={{ padding: '14px', border: '1px solid #ff4444', background: '#1c0707' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ff4444', fontWeight: 800, fontSize: '13px' }}>
                    <Trash2 size={16} /> [ DANGER ZONE: PERMANENTLY DELETE SERVER NODE ]
                  </div>
                  <div className="text-muted" style={{ fontSize: '11px', marginTop: '4px', maxWidth: '650px', lineHeight: '1.4' }}>
                    Permanently terminates process and deletes server node <strong>{server.name}</strong> ({server.engine.toUpperCase()}), including worlds, plugins, mods, and configuration.
                  </div>
                </div>

                <button
                  className="cli-btn cli-btn-danger"
                  style={{ fontWeight: 800, padding: '8px 18px' }}
                  onClick={() => onDeleteServer(server.id)}
                >
                  <Trash2 size={13} /> [ 🗑 DELETE SERVER INSTANCE ]
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: JAVA RUNTIME & RAM ALLOCATION                                      */}
      {/* ========================================================================= */}
      {activeTab === 'java' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="cli-pane" style={{ padding: '14px' }}>
            <div className="cli-pane-header" style={{ margin: '-14px -14px 14px -14px' }}>
              <span>&gt; DETECTED JAVA RUNTIMES ON HOST MACHINE</span>
              <button className="cli-btn cli-btn-muted" style={{ padding: '2px 6px', fontSize: '10px' }} onClick={loadJavaRuntimes}>
                <RefreshCw size={11} /> [ RESCAN ]
              </button>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label className="text-muted" style={{ fontSize: '11px', display: 'block', marginBottom: '6px' }}>
                SELECT JAVA EXECUTABLE FOR THIS SERVER:
              </label>
              <select
                className="cli-select"
                style={{ width: '100%' }}
                value={server?.javaPath || 'java'}
                onChange={(e) => onUpdateServerConfig({ javaPath: e.target.value })}
              >
                {javaRuntimes.map((j, i) => (
                  <option key={i} value={j.path}>
                    {j.label} &gt; {j.path}
                  </option>
                ))}
              </select>
            </div>

            <div className="text-muted" style={{ fontSize: '11px', lineHeight: '1.5' }}>
              * Minecraft 1.20.5+ requires Java 21.<br />
              * Minecraft 1.17 to 1.20.4 requires Java 17.<br />
              * Minecraft 1.16.5 and below runs on Java 8 or Java 11.
            </div>
          </div>

          {/* RAM Sliders */}
          <div className="cli-pane" style={{ padding: '14px' }}>
            <div className="cli-pane-header" style={{ margin: '-14px -14px 14px -14px' }}>
              <span>&gt; HEAP MEMORY LIMITS (-Xms / -Xmx)</span>
              <span className="text-amber">[{server?.minRam || 2}GB MIN / {server?.maxRam || 4}GB MAX]</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '16px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
                  MINIMUM RAM (-Xms): {server?.minRam || 2} GB
                </label>
                <input
                  type="range"
                  min="1"
                  max="24"
                  value={server?.minRam || 2}
                  onChange={(e) => onUpdateServerConfig({ minRam: parseInt(e.target.value, 10) })}
                  style={{ width: '100%', accentColor: 'var(--primary)' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
                  MAXIMUM RAM (-Xmx): {server?.maxRam || 4} GB
                </label>
                <input
                  type="range"
                  min="2"
                  max="24"
                  value={server?.maxRam || 4}
                  onChange={(e) => onUpdateServerConfig({ maxRam: parseInt(e.target.value, 10) })}
                  style={{ width: '100%', accentColor: 'var(--primary)' }}
                />
              </div>
            </div>

            {/* Aikar's Flags Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px dashed #143314', paddingTop: '12px' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '12px', color: 'var(--primary)' }}>
                  AIKAR'S HIGH-PERFORMANCE G1GC FLAGS
                </div>
                <div className="text-muted" style={{ fontSize: '11px', marginTop: '2px' }}>
                  Advanced garbage collection flags to eliminate tick stutters and optimize Minecraft server performance.
                </div>
              </div>
              <button
                className={`cli-btn ${server?.useAikarFlags ? '' : 'cli-btn-muted'}`}
                onClick={() => onUpdateServerConfig({ useAikarFlags: !server?.useAikarFlags })}
              >
                [{server?.useAikarFlags ? 'AIKAR FLAGS: ENABLED' : 'STANDARD FLAGS'}]
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConfigView;
