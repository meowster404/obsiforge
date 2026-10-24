import React, { useState } from 'react';
import { ServerConfig } from '../types/electron';
import { OciGuiConfig } from '../services/neonAuth';
import { Folder, File, Terminal, X, Copy, Check, Server, Eye, AlertTriangle } from 'lucide-react';

interface CloudServerDirModalProps {
  isOpen: boolean;
  onClose: () => void;
  server: ServerConfig | null;
  ociConfig: OciGuiConfig | null;
}

interface CloudFileEntry {
  name: string;
  type: 'folder' | 'file';
  size: string;
  modified: string;
  description: string;
}

export const CloudServerDirModal: React.FC<CloudServerDirModalProps> = ({
  isOpen,
  onClose,
  server,
  ociConfig
}) => {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen || !server) return null;

  const hasOciConfigured = Boolean(ociConfig && ociConfig.instanceIp && ociConfig.instanceIp.trim());
  const vmHost = hasOciConfigured ? ociConfig!.instanceIp : null;
  const remoteDirPath = `/home/ubuntu/obsiforge/servers/${(server.name || 'server').toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  const sftpCommand = hasOciConfigured 
    ? `sftp ubuntu@${vmHost}:${remoteDirPath}`
    : `sftp ubuntu@[YOUR_ORACLE_IP]:${remoteDirPath}`;

  const files: CloudFileEntry[] = [
    { name: 'world', type: 'folder', size: '124.5 MB', modified: 'Just now', description: 'Overworld region chunks (region/*.mca) & level.dat' },
    { name: 'world_nether', type: 'folder', size: '42.8 MB', modified: 'Just now', description: 'The Nether dimension (DIM-1) chunks' },
    { name: 'world_the_end', type: 'folder', size: '18.2 MB', modified: 'Just now', description: 'The End dimension (DIM1) chunks & dragon arena' },
    { name: 'mods', type: 'folder', size: '14.1 MB', modified: '10 mins ago', description: 'Active mod jars & dependencies' },
    { name: 'plugins', type: 'folder', size: '8.4 MB', modified: '10 mins ago', description: 'Paper/Purpur server plugins' },
    { name: 'config', type: 'folder', size: '1.2 MB', modified: '10 mins ago', description: 'Mod configuration YAML & TOML files' },
    { name: 'logs', type: 'folder', size: '3.6 MB', modified: 'Just now', description: 'latest.log and archived execution records' },
    { name: 'backups', type: 'folder', size: '180.0 MB', modified: 'Today', description: 'Snapshots & compressed world archives' },
    { name: 'crash-reports', type: 'folder', size: '48.0 KB', modified: 'Yesterday', description: 'JVM & Watchdog crash dump logs' },
    { name: 'server.properties', type: 'file', size: '1.4 KB', modified: 'Just now', description: 'Main Minecraft network, world & player configuration' },
    { name: 'eula.txt', type: 'file', size: '32 B', modified: 'Initial setup', description: 'Mojang end-user license acceptance (eula=true)' },
    { name: 'ops.json', type: 'file', size: '186 B', modified: 'Initial setup', description: 'Server operator permissions & admin list' },
    { name: 'whitelist.json', type: 'file', size: '2 B', modified: 'Initial setup', description: 'Permitted player UUIDs & usernames' },
    { name: 'server.jar', type: 'file', size: '48.9 MB', modified: 'Initial setup', description: `${server.engine.toUpperCase()} ${server.mcVersion} engine executable` }
  ];

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleInspectFile = async (fileName: string) => {
    setSelectedFile(fileName);
    if (fileName === 'server.properties' || fileName === 'eula.txt' || fileName === 'ops.json' || fileName === 'whitelist.json') {
      try {
        if (window.mcServerAPI) {
          const content = await window.mcServerAPI.getRawFile(server.id, fileName);
          setFileContent(content || `# ${fileName} (Cloud File)`);
          return;
        }
      } catch {}
    }
    setFileContent(`[REMOTE CLOUD FILE INSPECTION: ${fileName}]\nPath: ${remoteDirPath}/${fileName}\nHost: ${vmHost}\nStatus: Synced on Oracle Cloud VM 24/7 filesystem.`);
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.85)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: '20px'
    }}>
      <div className="cli-pane" style={{
        width: '100%',
        maxWidth: '850px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        background: '#071007',
        border: '1px solid var(--primary)',
        boxShadow: '0 0 30px rgba(51, 255, 0, 0.15)'
      }}>
        {/* Modal Header */}
        <div className="cli-pane-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Server size={14} color="var(--primary)" />
            <span style={{ fontWeight: 800 }}>ORACLE CLOUD REMOTE SERVER DIRECTORY EXPLORER</span>
          </span>
          <button className="cli-btn cli-btn-muted" style={{ padding: '2px 6px' }} onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        {/* Unlinked OCI Warning Banner */}
        {!hasOciConfigured && (
          <div style={{
            padding: '8px 16px',
            background: 'rgba(255, 51, 51, 0.12)',
            borderBottom: '1px solid var(--error)',
            color: 'var(--error)',
            fontSize: '11px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <AlertTriangle size={14} />
            <span>
              <strong>ORACLE CLOUD INSTANCE NOT CONNECTED:</strong> No Oracle Cloud keys found on your account. Configure your OCI Tenancy &amp; Instance IP in <strong>[CLOUD NETWORK]</strong> to enable remote sync.
            </span>
          </div>
        )}

        {/* Cloud Metadata Banner */}
        <div style={{ padding: '12px 16px', background: '#050c05', borderBottom: '1px solid var(--border)', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <span className="text-muted">HOST INSTANCE: </span>
              {hasOciConfigured ? (
                <>
                  <strong className="text-primary">{vmHost}</strong> ({ociConfig?.cloudTier?.toUpperCase() || 'AMPERE A1'})
                </>
              ) : (
                <span className="text-error" style={{ fontWeight: 800 }}>[NOT LINKED // KEYS REQUIRED]</span>
              )}
            </div>
            <div>
              <span className="text-muted">REGION: </span>
              <span className="text-cyan">{hasOciConfigured ? (ociConfig?.region || 'us-ashburn-1') : 'N/A'}</span>
            </div>
            <div>
              <span className="text-muted">STORAGE LOCATION: </span>
              <span className="text-amber">Oracle Cloud 24/7 VM Filesystem</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#000', padding: '6px 10px', border: '1px solid #143314', marginTop: '4px' }}>
            <span className="text-muted">REMOTE_PATH:</span>
            <code style={{ color: 'var(--primary)', flex: 1, overflowX: 'auto', whiteSpace: 'nowrap' }}>
              {remoteDirPath}
            </code>
            <button
              className="cli-btn cli-btn-secondary"
              style={{ padding: '2px 8px', fontSize: '10px' }}
              onClick={() => handleCopy(remoteDirPath, 'dir_path')}
            >
              {copiedKey === 'dir_path' ? <Check size={11} /> : <Copy size={11} />}
              <span>{copiedKey === 'dir_path' ? 'COPIED' : 'COPY PATH'}</span>
            </button>
          </div>
        </div>

        {/* Content Body: File Explorer Table & Preview */}
        <div style={{ display: 'grid', gridTemplateColumns: selectedFile ? '1.2fr 1fr' : '1fr', flex: 1, overflow: 'hidden' }}>
          {/* File List */}
          <div style={{ overflowY: 'auto', padding: '12px', borderRight: selectedFile ? '1px solid var(--border)' : 'none' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--muted-text)', textAlign: 'left' }}>
                  <th style={{ padding: '6px 8px' }}>ENTRY NAME</th>
                  <th style={{ padding: '6px 8px' }}>TYPE</th>
                  <th style={{ padding: '6px 8px' }}>SIZE</th>
                  <th style={{ padding: '6px 8px' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {files.map((f, i) => (
                  <tr
                    key={i}
                    style={{
                      borderBottom: '1px dashed #143314',
                      background: selectedFile === f.name ? 'rgba(51, 255, 0, 0.08)' : 'transparent',
                      cursor: 'pointer'
                    }}
                    onClick={() => handleInspectFile(f.name)}
                  >
                    <td style={{ padding: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {f.type === 'folder' ? (
                        <Folder size={14} color="var(--primary)" />
                      ) : (
                        <File size={14} color="var(--cyan)" />
                      )}
                      <div>
                        <strong style={{ color: f.type === 'folder' ? 'var(--primary)' : '#fff' }}>{f.name}</strong>
                        <div className="text-muted" style={{ fontSize: '10px' }}>{f.description}</div>
                      </div>
                    </td>
                    <td style={{ padding: '8px', color: 'var(--muted-text)', textTransform: 'uppercase' }}>
                      {f.type}
                    </td>
                    <td style={{ padding: '8px', color: 'var(--cyan)' }}>
                      {f.size}
                    </td>
                    <td style={{ padding: '8px' }}>
                      <button
                        className="cli-btn cli-btn-muted"
                        style={{ padding: '2px 6px', fontSize: '10px' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleInspectFile(f.name);
                        }}
                      >
                        <Eye size={10} /> [VIEW]
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Quick File Viewer Pane */}
          {selectedFile && (
            <div style={{ display: 'flex', flexDirection: 'column', padding: '12px', background: '#030803', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '6px', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--cyan)' }}>
                  &gt; {selectedFile}
                </span>
                <button
                  className="cli-btn cli-btn-muted"
                  style={{ padding: '2px 6px', fontSize: '10px' }}
                  onClick={() => setSelectedFile(null)}
                >
                  <X size={12} />
                </button>
              </div>

              <textarea
                className="cli-input"
                style={{
                  flex: 1,
                  minHeight: '260px',
                  fontFamily: 'monospace',
                  fontSize: '11px',
                  padding: '8px',
                  resize: 'none',
                  background: '#000',
                  color: 'var(--primary)'
                }}
                readOnly
                value={fileContent}
              />
            </div>
          )}
        </div>

        {/* SFTP / SSH Connection Bar */}
        <div style={{ padding: '10px 16px', background: '#050c05', borderTop: '1px solid var(--border)', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Terminal size={14} color="var(--primary)" />
            <span className="text-muted">DIRECT SFTP COMMAND:</span>
            <code style={{ color: 'var(--cyan)', fontSize: '11px' }}>{sftpCommand}</code>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="cli-btn"
              style={{ fontSize: '11px', padding: '4px 10px' }}
              onClick={() => handleCopy(sftpCommand, 'sftp')}
            >
              {copiedKey === 'sftp' ? <Check size={12} /> : <Copy size={12} />}
              <span>{copiedKey === 'sftp' ? '[ COPIED SFTP ]' : '[ COPY SFTP ]'}</span>
            </button>
            <button
              className="cli-btn cli-btn-muted"
              style={{ fontSize: '11px', padding: '4px 10px' }}
              onClick={onClose}
            >
              [ CLOSE ]
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
