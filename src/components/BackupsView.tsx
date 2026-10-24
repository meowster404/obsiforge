import React, { useState, useEffect, useCallback } from 'react';
import { ServerConfig, BackupItem } from '../types/electron';
import { Archive, Plus, RotateCcw, Trash2, RefreshCw } from 'lucide-react';

interface BackupsViewProps {
  server: ServerConfig | null;
}

export const BackupsView: React.FC<BackupsViewProps> = ({ server }) => {
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [snapshotName, setSnapshotName] = useState('');
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [autoSchedule, setAutoSchedule] = useState<'off' | '2h' | '6h' | '24h'>('off');

  const refreshBackups = useCallback(async () => {
    if (!server) return;
    try {
      const list = await window.mcServerAPI.listBackups(server.id);
      setBackups(list);
    } catch (e) {
      console.error('Failed listing backups:', e);
    }
  }, [server]);

  useEffect(() => {
    if (!server) return;
    let isCancelled = false;
    window.mcServerAPI.listBackups(server.id)
      .then(list => {
        if (!isCancelled) setBackups(list);
      })
      .catch(e => {
        console.error('Failed listing backups:', e);
      });
    return () => {
      isCancelled = true;
    };
  }, [server]);

  const handleCreateSnapshot = async () => {
    if (!server) return;
    setCreating(true);
    setStatusMsg('[COMPRESSING] Creating world snapshot archive...');
    try {
      const res = await window.mcServerAPI.createBackup(server.id, snapshotName || 'manual');
      setStatusMsg(`[SUCCESS] Snapshot created: ${res.fileName}`);
      setSnapshotName('');
      refreshBackups();
    } catch (e: any) {
      setStatusMsg(`[ERROR] Failed creating backup: ${e.message}`);
    } finally {
      setCreating(false);
    }
  };

  const handleRestoreBackup = async (fileName: string) => {
    if (!server) return;
    if (server.status === 'running') {
      alert('CANNOT RESTORE WHILE SERVER IS RUNNING. Please stop the server first.');
      return;
    }
    if (!confirm(`CRITICAL WARNING: Restoring "${fileName}" will overwrite current world data. Proceed?`)) {
      return;
    }

    setRestoring(true);
    setStatusMsg(`[EXTRACTING] Restoring archive ${fileName}...`);
    try {
      await window.mcServerAPI.restoreBackup(server.id, fileName);
      setStatusMsg(`[SUCCESS] Successfully restored world snapshot from ${fileName}!`);
    } catch (e: any) {
      setStatusMsg(`[ERROR] Restore failed: ${e.message}`);
    } finally {
      setRestoring(false);
    }
  };

  const handleDeleteBackup = async (fileName: string) => {
    if (!server) return;
    if (confirm(`CONFIRM: Delete backup archive "${fileName}"?`)) {
      await window.mcServerAPI.deleteBackup(server.id, fileName);
      refreshBackups();
    }
  };

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', height: '100%', flex: 1, background: '#0a0a0a', gap: '14px', overflowY: 'auto' }}>
      {/* Top Banner & Trigger */}
      <div className="cli-pane" style={{ padding: '14px' }}>
        <div className="cli-pane-header" style={{ margin: '-14px -14px 14px -14px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Archive size={14} color="var(--primary)" /> CREATE SNAPSHOT // WORLD ARCHIVE
          </span>
          <span className="text-muted">ZIP COMPRESSION ENGINE</span>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            className="cli-input"
            style={{ maxWidth: '320px' }}
            placeholder="Snapshot tag (e.g. before_ender_dragon)..."
            value={snapshotName}
            onChange={(e) => setSnapshotName(e.target.value)}
          />

          <button
            className="cli-btn"
            style={{ fontWeight: 800 }}
            onClick={handleCreateSnapshot}
            disabled={creating}
          >
            <Plus size={13} /> [{creating ? 'COMPRESSING...' : 'CREATE SNAPSHOT NOW'}]
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
            <span className="text-muted" style={{ fontSize: '11px' }}>AUTO-BACKUP:</span>
            <select
              className="cli-select"
              value={autoSchedule}
              onChange={(e) => setAutoSchedule(e.target.value as any)}
            >
              <option value="off">DISABLED</option>
              <option value="2h">EVERY 2 HOURS</option>
              <option value="6h">EVERY 6 HOURS</option>
              <option value="24h">DAILY (24H)</option>
            </select>
          </div>
        </div>
      </div>

      {statusMsg && (
        <div style={{
          padding: '8px 12px',
          background: 'rgba(51, 255, 0, 0.08)',
          border: '1px solid var(--border)',
          color: 'var(--primary)',
          fontSize: '11px'
        }}>
          &gt; {statusMsg}
        </div>
      )}

      {/* Backups List Pane */}
      <div className="cli-pane" style={{ flex: 1 }}>
        <div className="cli-pane-header">
          <span>&gt; AVAILABLE WORLD SNAPSHOT ARCHIVES</span>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span className="text-muted">TOTAL: {backups.length}</span>
            <button className="cli-btn cli-btn-muted" style={{ padding: '2px 6px', fontSize: '10px' }} onClick={refreshBackups}>
              <RefreshCw size={10} /> [ REFRESH ]
            </button>
          </div>
        </div>

        <div style={{ padding: '10px', overflowX: 'auto' }}>
          <table className="cli-table">
            <thead>
              <tr>
                <th>ARCHIVE NAME</th>
                <th>SIZE</th>
                <th>TIMESTAMP</th>
                <th style={{ textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {backups.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '30px', color: 'var(--muted-text)' }}>
                    NO WORLD SNAPSHOTS FOUND. CLICK [CREATE SNAPSHOT NOW] TO ARCHIVE YOUR MINECRAFT WORLD.
                  </td>
                </tr>
              ) : (
                backups.map((b, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 700 }}>{b.fileName}</td>
                    <td className="text-cyan">{b.sizeMb} MB</td>
                    <td className="text-muted">{new Date(b.createdAt).toLocaleString()}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="cli-btn cli-btn-secondary"
                        style={{ padding: '2px 8px', fontSize: '11px', marginRight: '6px' }}
                        onClick={() => handleRestoreBackup(b.fileName)}
                        disabled={restoring}
                        title="Restore this snapshot over current world"
                      >
                        <RotateCcw size={11} /> [ RESTORE ]
                      </button>
                      <button
                        className="cli-btn cli-btn-danger"
                        style={{ padding: '2px 8px', fontSize: '11px' }}
                        onClick={() => handleDeleteBackup(b.fileName)}
                        title="Delete archive file"
                      >
                        <Trash2 size={11} /> [ DELETE ]
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
