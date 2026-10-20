import React, { useState, useEffect } from 'react';
import { ServerConfig, PlayersData } from '../types/electron';
import { Users, Shield, UserX, AlertTriangle, UserCheck, ShieldAlert, Plus, Trash2, Ban } from 'lucide-react';

import { ObsiUser } from '../services/neonAuth';

interface PlayersViewProps {
  server: ServerConfig | null;
  currentUser?: ObsiUser | null;
  onSendCommand: (cmd: string) => void;
}

export const PlayersView: React.FC<PlayersViewProps> = ({ server, currentUser, onSendCommand }) => {
  const [subTab, setSubTab] = useState<'online' | 'ops' | 'whitelist' | 'bans' | 'security'>('online');
  const [playersData, setPlayersData] = useState<PlayersData>({
    ops: [],
    whitelist: [],
    bannedPlayers: [],
    bannedIps: []
  });

  // Dynamic online players populated via server logs & queries
  const [onlinePlayers, setOnlinePlayers] = useState<Array<{ name: string; ip: string; ping: number; isOp: boolean; warnings: number }>>([]);

  const [inputName, setInputName] = useState('');
  const [banReason, setBanReason] = useState('Violating server rules');

  const loadData = async () => {
    if (!server) return;
    try {
      const data = await window.mcServerAPI.getPlayersData(server.id);
      setPlayersData(data);
    } catch (e) {
      console.error('Failed reading players data:', e);
    }
  };

  useEffect(() => {
    loadData();
    if (window.mcServerAPI) {
      const unsub = window.mcServerAPI.onServerLog((logData) => {
        const line = logData.line;
        // Match player join
        const joinMatch = line.match(/(?:INFO\]:\s+|^)([a-zA-Z0-9_]{2,16})(?:\[\/([^\]:]+)(?::\d+)?\])?\s+(?:joined the game|logged in with entity id)/i);
        if (joinMatch) {
          const pName = joinMatch[1];
          const pIp = joinMatch[2] || 'Connected';
          setOnlinePlayers(prev => {
            if (prev.some(p => p.name.toLowerCase() === pName.toLowerCase())) return prev;
            return [...prev, { name: pName, ip: pIp, ping: 15, isOp: false, warnings: 0 }];
          });
        }
        // Match player leave
        const leaveMatch = line.match(/(?:INFO\]:\s+|^)([a-zA-Z0-9_]{2,16})\s+(?:left the game|lost connection:)/i);
        if (leaveMatch) {
          const pName = leaveMatch[1];
          setOnlinePlayers(prev => prev.filter(p => p.name.toLowerCase() !== pName.toLowerCase()));
        }
      });
      return () => unsub();
    }
  }, [server]);

  // Actions
  const handleOpPlayer = async (name: string) => {
    if (!server) return;
    await window.mcServerAPI.executePlayerAction(server.id, 'op', { name });
    onSendCommand(`op ${name}`);
    setTimeout(loadData, 1000);
  };

  const handleDeopPlayer = async (name: string) => {
    if (!server) return;
    await window.mcServerAPI.executePlayerAction(server.id, 'deop', { name });
    onSendCommand(`deop ${name}`);
    setTimeout(loadData, 1000);
  };

  const handleWhitelistAdd = async (name: string) => {
    if (!server || !name) return;
    await window.mcServerAPI.executePlayerAction(server.id, 'whitelist_add', { name });
    onSendCommand(`whitelist add ${name}`);
    setInputName('');
    setTimeout(loadData, 1000);
  };

  const handleWhitelistRemove = async (name: string) => {
    if (!server) return;
    await window.mcServerAPI.executePlayerAction(server.id, 'whitelist_remove', { name });
    onSendCommand(`whitelist remove ${name}`);
    setTimeout(loadData, 1000);
  };

  const handleKickPlayer = (name: string) => {
    onSendCommand(`kick ${name} Kicked by console operator`);
    setOnlinePlayers(prev => prev.filter(p => p.name !== name));
  };

  const handleBanPlayer = (name: string) => {
    onSendCommand(`ban ${name} ${banReason}`);
    setOnlinePlayers(prev => prev.filter(p => p.name !== name));
    setTimeout(loadData, 1000);
  };

  const handlePardonPlayer = (name: string) => {
    onSendCommand(`pardon ${name}`);
    setTimeout(loadData, 1000);
  };

  const handleWarnPlayer = (name: string) => {
    setOnlinePlayers(prev => prev.map(p => {
      if (p.name === name) {
        const nextWarnings = p.warnings + 1;
        onSendCommand(`say [WARN] ${p.name} has received warning ${nextWarnings}/3: ${banReason}`);
        if (nextWarnings >= 3) {
          onSendCommand(`kick ${p.name} Maximum warning limit reached (3/3)`);
        }
        return { ...p, warnings: nextWarnings };
      }
      return p;
    }));
  };

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', height: '100%', flex: 1, background: '#0a0a0a', gap: '14px', overflowY: 'auto' }}>
      {/* Subtabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '10px', overflowX: 'auto' }}>
        <button className={`cli-btn ${subTab === 'online' ? '' : 'cli-btn-muted'}`} onClick={() => setSubTab('online')}>
          <Users size={13} /> [ ONLINE ({onlinePlayers.length}) ]
        </button>
        <button className={`cli-btn ${subTab === 'ops' ? '' : 'cli-btn-muted'}`} onClick={() => setSubTab('ops')}>
          <Shield size={13} /> [ OPS ({playersData.ops.length}) ]
        </button>
        <button className={`cli-btn ${subTab === 'whitelist' ? '' : 'cli-btn-muted'}`} onClick={() => setSubTab('whitelist')}>
          <UserCheck size={13} /> [ WHITELIST ({playersData.whitelist.length}) ]
        </button>
        <button className={`cli-btn ${subTab === 'bans' ? 'cli-btn-danger' : 'cli-btn-muted'}`} onClick={() => setSubTab('bans')}>
          <UserX size={13} /> [ BANS ({playersData.bannedPlayers.length}) ]
        </button>
        <button className={`cli-btn ${subTab === 'security' ? 'cli-btn-secondary' : 'cli-btn-muted'}`} onClick={() => setSubTab('security')}>
          <ShieldAlert size={13} /> [ IP GUARDIAN &amp; CRACKED SECURITY ]
        </button>
      </div>

      {/* ========================================================================= */}
      {/* ONLINE PLAYERS                                                            */}
      {/* ========================================================================= */}
      {subTab === 'online' && (
        <div className="cli-pane">
          <div className="cli-pane-header">
            <span>&gt; CURRENTLY CONNECTED SESSIONS</span>
            <span className="text-muted">COUNT: {onlinePlayers.length}</span>
          </div>
          <div style={{ padding: '10px' }}>
            <table className="cli-table">
              <thead>
                <tr>
                  <th>AVATAR</th>
                  <th>USERNAME</th>
                  <th>IP ADDRESS</th>
                  <th>PING</th>
                  <th>ROLE</th>
                  <th>WARNS</th>
                  <th style={{ textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {onlinePlayers.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted-text)', padding: '24px' }}>
                      NO PLAYERS CONNECTED AT THIS TIME.
                    </td>
                  </tr>
                ) : (
                  onlinePlayers.map((player, idx) => (
                    <tr key={idx}>
                      <td style={{ width: '40px' }}>
                        <div style={{ width: '28px', height: '28px', background: '#091c09', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800 }}>
                          {player.name.slice(0, 2).toUpperCase()}
                        </div>
                      </td>
                      <td style={{ fontWeight: 700 }}>{player.name}</td>
                      <td className="text-muted">{player.ip}</td>
                      <td className="text-cyan">{player.ping}ms</td>
                      <td>
                        {player.isOp ? (
                          <span className="status-badge status-online">OP</span>
                        ) : (
                          <span className="status-badge status-stopped">PLAYER</span>
                        )}
                      </td>
                      <td style={{ color: player.warnings > 0 ? 'var(--secondary)' : 'var(--muted-text)' }}>
                        {player.warnings}/3
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="cli-btn cli-btn-muted"
                          style={{ padding: '2px 6px', fontSize: '10px', marginRight: '4px' }}
                          onClick={() => player.isOp ? handleDeopPlayer(player.name) : handleOpPlayer(player.name)}
                        >
                          {player.isOp ? '[DE-OP]' : '[OP]'}
                        </button>
                        <button
                          className="cli-btn cli-btn-secondary"
                          style={{ padding: '2px 6px', fontSize: '10px', marginRight: '4px' }}
                          onClick={() => handleWarnPlayer(player.name)}
                        >
                          [WARN]
                        </button>
                        <button
                          className="cli-btn cli-btn-danger"
                          style={{ padding: '2px 6px', fontSize: '10px', marginRight: '4px' }}
                          onClick={() => handleKickPlayer(player.name)}
                        >
                          [KICK]
                        </button>
                        <button
                          className="cli-btn cli-btn-danger"
                          style={{ padding: '2px 6px', fontSize: '10px' }}
                          onClick={() => handleBanPlayer(player.name)}
                        >
                          [BAN]
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* OPERATORS                                                                 */}
      {/* ========================================================================= */}
      {subTab === 'ops' && (
        <div className="cli-pane">
          <div className="cli-pane-header">
            <span>&gt; SERVER OPERATORS // OPS.JSON</span>
            <span className="text-muted">TOTAL: {playersData.ops.length}</span>
          </div>
          <div style={{ padding: '12px' }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
              <input
                type="text"
                className="cli-input"
                placeholder="Minecraft username to OP..."
                value={inputName}
                onChange={(e) => setInputName(e.target.value)}
              />
              <button className="cli-btn" onClick={() => { handleOpPlayer(inputName); setInputName(''); }}>
                <Plus size={13} /> [ GRANT OP ]
              </button>
            </div>

            <table className="cli-table">
              <thead>
                <tr>
                  <th>USERNAME</th>
                  <th>UUID</th>
                  <th>LEVEL</th>
                  <th>BYPASS LIMIT</th>
                  <th style={{ textAlign: 'right' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {currentUser && (
                  <tr style={{ background: 'rgba(51, 255, 0, 0.05)', borderLeft: '3px solid var(--primary)' }}>
                    <td style={{ fontWeight: 800, color: 'var(--primary)' }}>
                      {currentUser.username} <span className="status-badge status-online" style={{ marginLeft: '6px' }}>[CLUSTER ADMIN / OWNER]</span>
                    </td>
                    <td className="text-muted" style={{ fontSize: '11px' }}>SYSTEM_ROOT_ADMIN</td>
                    <td className="text-amber">LVL 4</td>
                    <td className="text-primary">YES</td>
                    <td style={{ textAlign: 'right', color: 'var(--muted-text)', fontSize: '11px' }}>
                      [PERMANENT OWNER]
                    </td>
                  </tr>
                )}
                {playersData.ops.length === 0 && !currentUser ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted-text)', padding: '20px' }}>
                      NO OPS REGISTERED YET. GRANT OP USING THE INPUT ABOVE OR VIA CONSOLE.
                    </td>
                  </tr>
                ) : (
                  playersData.ops.filter(op => !currentUser || op.name.toLowerCase() !== currentUser.username.toLowerCase()).map((op, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 700 }}>{op.name}</td>
                      <td className="text-muted" style={{ fontSize: '11px' }}>{op.uuid || 'N/A'}</td>
                      <td className="text-amber">LVL {op.level || 4}</td>
                      <td>{op.bypassesPlayerLimit ? 'YES' : 'NO'}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="cli-btn cli-btn-danger" style={{ padding: '2px 6px', fontSize: '10px' }} onClick={() => handleDeopPlayer(op.name)}>
                          <Trash2 size={10} /> [ REVOKE ]
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* WHITELIST                                                                 */}
      {/* ========================================================================= */}
      {subTab === 'whitelist' && (
        <div className="cli-pane">
          <div className="cli-pane-header">
            <span>&gt; ACCESS CONTROL // WHITELIST.JSON</span>
            <span className="text-muted">TOTAL: {playersData.whitelist.length}</span>
          </div>
          <div style={{ padding: '12px' }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
              <input
                type="text"
                className="cli-input"
                placeholder="Minecraft username to whitelist..."
                value={inputName}
                onChange={(e) => setInputName(e.target.value)}
              />
              <button className="cli-btn" onClick={() => handleWhitelistAdd(inputName)}>
                <Plus size={13} /> [ ADD TO WHITELIST ]
              </button>
              <button className="cli-btn cli-btn-secondary" onClick={() => onSendCommand('whitelist reload')}>
                [ RELOAD WHITELIST ]
              </button>
            </div>

            <table className="cli-table">
              <thead>
                <tr>
                  <th>USERNAME</th>
                  <th>UUID</th>
                  <th style={{ textAlign: 'right' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {playersData.whitelist.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', color: 'var(--muted-text)', padding: '20px' }}>
                      WHITELIST IS EMPTY. ANYONE CAN JOIN UNLESS WHITELIST IS ENFORCED.
                    </td>
                  </tr>
                ) : (
                  playersData.whitelist.map((w, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 700 }}>{w.name}</td>
                      <td className="text-muted" style={{ fontSize: '11px' }}>{w.uuid || 'N/A'}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="cli-btn cli-btn-danger" style={{ padding: '2px 6px', fontSize: '10px' }} onClick={() => handleWhitelistRemove(w.name)}>
                          <Trash2 size={10} /> [ REMOVE ]
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* BANS                                                                      */}
      {/* ========================================================================= */}
      {subTab === 'bans' && (
        <div className="cli-pane">
          <div className="cli-pane-header" style={{ borderBottomColor: 'var(--error)' }}>
            <span className="text-red">&gt; SECURITY EXCLUSION LIST // BANNED PLAYERS &amp; IPS</span>
            <span className="text-muted">COUNT: {playersData.bannedPlayers.length}</span>
          </div>
          <div style={{ padding: '12px' }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
              <input
                type="text"
                className="cli-input"
                placeholder="Username or IP to ban..."
                value={inputName}
                onChange={(e) => setInputName(e.target.value)}
              />
              <input
                type="text"
                className="cli-input"
                placeholder="Reason..."
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
              />
              <button className="cli-btn cli-btn-danger" onClick={() => { handleBanPlayer(inputName); setInputName(''); }}>
                <Ban size={13} /> [ BAN TARGET ]
              </button>
            </div>

            <table className="cli-table">
              <thead>
                <tr>
                  <th>NAME / IP</th>
                  <th>REASON</th>
                  <th>SOURCE</th>
                  <th>DATE</th>
                  <th style={{ textAlign: 'right' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {playersData.bannedPlayers.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted-text)', padding: '20px' }}>
                      NO BANNED PLAYERS ON RECORD.
                    </td>
                  </tr>
                ) : (
                  playersData.bannedPlayers.map((b, i) => (
                    <tr key={i}>
                      <td className="text-red" style={{ fontWeight: 700 }}>{b.name}</td>
                      <td>{b.reason || 'None specified'}</td>
                      <td className="text-muted">{b.source || 'Console'}</td>
                      <td className="text-muted">{b.created || 'N/A'}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="cli-btn cli-btn-muted" style={{ padding: '2px 6px', fontSize: '10px' }} onClick={() => handlePardonPlayer(b.name)}>
                          [ PARDON ]
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECURITY GUARDIAN & CRACKED CLIENT MONITOR                                */}
      {/* ========================================================================= */}
      {subTab === 'security' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Cracked Warning Card */}
          {server && !server.onlineMode && (
            <div className="cli-pane" style={{ border: '1px solid var(--secondary)', background: '#140d02' }}>
              <div className="cli-pane-header" style={{ background: '#241604', borderBottom: '1px solid var(--secondary)' }}>
                <span className="text-amber" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertTriangle size={15} /> [CRITICAL SECURITY NOTICE] OFFLINE / CRACKED MODE DETECTED
                </span>
                <span className="text-muted">ONLINE-MODE = FALSE</span>
              </div>
              <div style={{ padding: '14px', fontSize: '12px', lineHeight: '1.6' }}>
                <p style={{ color: 'var(--secondary)', marginBottom: '8px', fontWeight: 700 }}>
                  WARNING: In offline mode, the server does not authenticate with Mojang servers. Any player can enter the game under ANY username (including server administrators and OPs)!
                </p>
                <div style={{ background: '#0a0a0a', padding: '10px', border: '1px solid var(--border)', marginBottom: '10px' }}>
                  <div style={{ fontWeight: 700, color: 'var(--primary)', marginBottom: '4px' }}>
                    RECOMMENDED MITIGATION MEASURES:
                  </div>
                  <ol style={{ paddingLeft: '20px', color: '#ccc' }}>
                    <li>Install an in-game password authentication plugin (e.g., <strong>AuthMeReloaded</strong> or <strong>LoginSecurity</strong>).</li>
                    <li>Install <strong>SkinRestorer</strong> so offline/cracked players can load custom skins.</li>
                    <li>Never leave OP accounts without login passwords or allow port forwarding without a whitelist.</li>
                  </ol>
                </div>
              </div>
            </div>
          )}

          {/* IP Guardian Monitor */}
          <div className="cli-pane">
            <div className="cli-pane-header">
              <span>&gt; IP CONNECTION GUARDIAN // RATE LIMITS &amp; ANOMALY DETECTION</span>
              <span className="text-cyan">[STATUS: MONITORING]</span>
            </div>
            <div style={{ padding: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '14px' }}>
                <div style={{ border: '1px solid var(--border)', padding: '10px', background: '#070f07' }}>
                  <div className="text-muted" style={{ fontSize: '11px' }}>PING FLOOD PROTECTION</div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--primary)', marginTop: '4px' }}>ENABLED (20/s max)</div>
                </div>
                <div style={{ border: '1px solid var(--border)', padding: '10px', background: '#070f07' }}>
                  <div className="text-muted" style={{ fontSize: '11px' }}>RCON PASSWORD STRENGTH</div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--cyan)', marginTop: '4px' }}>ISOLATED / LOCAL</div>
                </div>
                <div style={{ border: '1px solid var(--border)', padding: '10px', background: '#070f07' }}>
                  <div className="text-muted" style={{ fontSize: '11px' }}>SPAWN PROTECTION RADIUS</div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--secondary)', marginTop: '4px' }}>16 BLOCKS</div>
                </div>
              </div>

              <div className="text-muted" style={{ fontSize: '11px' }}>
                The IP Guardian checks inbound sockets for port scanning and high-frequency join/leave bot spam. Suspicious IPs can be permanently blacklisted with one click from the console.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
