import React, { useState } from 'react';
import { UpdateInfo, gitHubUpdater, APP_CURRENT_VERSION } from '../services/updater';
import { RefreshCw, Download, ExternalLink, CheckCircle, AlertCircle, X, Shield, ArrowUpRight } from 'lucide-react';

interface UpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  updateInfo: UpdateInfo | null;
  onRefreshCheck: () => Promise<void>;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({
  isOpen,
  onClose,
  updateInfo,
  onRefreshCheck
}) => {
  const [checking, setChecking] = useState(false);

  if (!isOpen) return null;

  const handleManualCheck = async () => {
    setChecking(true);
    await onRefreshCheck();
    setChecking(false);
  };

  const handleDownload = () => {
    if (updateInfo?.downloadUrl) {
      if (window.mcServerAPI?.openExternalUrl) {
        window.mcServerAPI.openExternalUrl(updateInfo.downloadUrl);
      } else {
        window.open(updateInfo.downloadUrl, '_blank');
      }
    }
  };

  const hasUpdate = updateInfo?.hasUpdate || false;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.88)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10006,
      padding: '20px'
    }}>
      <div className="crt-overlay" />

      <div className="cli-pane" style={{
        width: '580px',
        maxWidth: '95vw',
        border: hasUpdate ? '1px solid var(--secondary)' : '1px solid var(--primary)',
        background: '#07120a',
        boxShadow: hasUpdate ? '0 0 25px rgba(255, 176, 0, 0.2)' : '0 0 25px rgba(51, 255, 0, 0.15)'
      }}>
        {/* Header */}
        <div className="cli-pane-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Shield size={14} color={hasUpdate ? 'var(--secondary)' : 'var(--primary)'} />
            <span style={{ fontWeight: 800 }}>OBSIFORGE // GITHUB RELEASES &amp; UPDATE ENGINE</span>
          </span>
          <button className="cli-btn cli-btn-muted" style={{ padding: '1px 6px' }} onClick={onClose}>
            <X size={12} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Status Banner */}
          <div style={{
            padding: '12px 16px',
            background: hasUpdate ? 'rgba(255, 176, 0, 0.08)' : 'rgba(51, 255, 0, 0.08)',
            border: `1px solid ${hasUpdate ? 'var(--secondary)' : 'var(--primary)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {hasUpdate ? (
                <AlertCircle size={22} color="var(--secondary)" />
              ) : (
                <CheckCircle size={22} color="var(--primary)" />
              )}
              <div>
                <div style={{ fontSize: '13px', fontWeight: 800, color: hasUpdate ? 'var(--secondary)' : 'var(--primary)' }}>
                  {hasUpdate ? `NEW RELEASE DETECTED: v${updateInfo?.latestVersion}` : 'OBSIFORGE IS UP TO DATE'}
                </div>
                <div className="text-muted" style={{ fontSize: '11px', marginTop: '2px' }}>
                  Installed Build: <strong className="text-primary">v{APP_CURRENT_VERSION}</strong> &bull; Channel: <strong className={APP_CURRENT_VERSION.endsWith('b') ? 'text-amber' : 'text-primary'}>{APP_CURRENT_VERSION.endsWith('b') ? 'Public Beta' : 'Official Release'}</strong>
                </div>
              </div>
            </div>

            <button
              className="cli-btn cli-btn-muted"
              style={{ fontSize: '11px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '6px' }}
              onClick={handleManualCheck}
              disabled={checking}
            >
              <RefreshCw size={11} className={checking ? 'animate-spin' : ''} />
              <span>{checking ? 'CHECKING...' : '[ CHECK AGAIN ]'}</span>
            </button>
          </div>

          {/* Release Details / Changelog */}
          {hasUpdate ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                <span className="text-muted">LATEST RELEASE: <strong>{updateInfo?.releaseName}</strong></span>
                <span className="text-cyan">
                  {updateInfo?.publishedAt ? new Date(updateInfo.publishedAt).toLocaleDateString() : ''}
                </span>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--secondary)', display: 'block', marginBottom: '4px' }}>
                  CHANGELOG &amp; RELEASE NOTES:
                </label>
                <div style={{
                  background: '#040805',
                  border: '1px solid var(--border)',
                  padding: '10px 12px',
                  maxHeight: '140px',
                  overflowY: 'auto',
                  fontSize: '11px',
                  color: '#ccc',
                  lineHeight: '1.5',
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap'
                }}>
                  {updateInfo?.releaseNotes || 'No notes available.'}
                </div>
              </div>

              {/* Direct .exe Download Action */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button
                  className="cli-btn"
                  style={{
                    flex: 1,
                    fontWeight: 800,
                    padding: '8px 14px',
                    borderColor: 'var(--secondary)',
                    color: 'var(--secondary)',
                    background: 'rgba(255, 176, 0, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                  onClick={handleDownload}
                >
                  <Download size={14} /> [ ⬇ DOWNLOAD WINDOWS .EXE INSTALLER ]
                </button>

                <button
                  className="cli-btn cli-btn-muted"
                  style={{ fontSize: '11px', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  onClick={() => {
                    const url = updateInfo?.htmlUrl || `https://github.com/${gitHubUpdater.getRepo()}/releases`;
                    if (window.mcServerAPI?.openExternalUrl) {
                      window.mcServerAPI.openExternalUrl(url);
                    } else {
                      window.open(url, '_blank');
                    }
                  }}
                >
                  <ArrowUpRight size={13} /> GitHub
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px', color: 'var(--muted-text)' }}>
              <div>
                ObsiForge automatically checks your GitHub repository releases on application boot.
              </div>
              <div>
                Target Repository: <code>https://github.com/{gitHubUpdater.getRepo()}</code>
              </div>
              <div style={{ marginTop: '4px', color: 'var(--primary)' }}>
                ✓ You have the latest software build. No new updates are required.
              </div>
            </div>
          )}

          {/* Footer */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #143314', paddingTop: '10px', marginTop: '4px' }}>
            <button className="cli-btn cli-btn-muted" style={{ padding: '6px 16px' }} onClick={onClose}>
              [ CLOSE ]
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
