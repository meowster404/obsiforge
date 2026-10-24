import React, { useState, useEffect } from 'react';
import { UpdateInfo, gitHubUpdater, APP_CURRENT_VERSION } from '../services/updater';
import { RefreshCw, CheckCircle, AlertCircle, X, Shield, ArrowUpRight, Rocket, Loader, AlertTriangle } from 'lucide-react';

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
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<{
    percent: number;
    transferredMb: string;
    totalMb: string;
    status?: string;
  }>({ percent: 0, transferredMb: '0', totalMb: '0', status: 'idle' });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    if (window.mcServerAPI?.onUpdateDownloadProgress) {
      const unsub = window.mcServerAPI.onUpdateDownloadProgress((progress) => {
        setDownloadProgress(progress);
      });
      return () => unsub();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClose = () => {
    if (isDownloading) return;
    setIsDownloading(false);
    setErrorMsg(null);
    setDownloadProgress({ percent: 0, transferredMb: '0', totalMb: '0', status: 'idle' });
    onClose();
  };

  const handleManualCheck = async () => {
    setChecking(true);
    setErrorMsg(null);
    await onRefreshCheck();
    setChecking(false);
  };

  const handleInstallUpdate = async () => {
    if (!updateInfo?.downloadUrl) return;

    if (!confirm(`Are you sure you want to install ObsiForge v${updateInfo.latestVersion}?\n\nObsiForge will download the update package in the background and launch the installer to cleanly replace the old version without duplicates.`)) {
      return;
    }

    setIsDownloading(true);
    setErrorMsg(null);

    try {
      if (window.mcServerAPI?.downloadAndInstallUpdate) {
        const res = await window.mcServerAPI.downloadAndInstallUpdate(updateInfo.downloadUrl);
        if (!res.success) {
          setErrorMsg(res.error || 'Failed to download installer package.');
          setIsDownloading(false);
        }
      } else {
        // Fallback for non-electron environment
        window.open(updateInfo.downloadUrl, '_blank');
        setIsDownloading(false);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Unexpected error while starting installer update.');
      setIsDownloading(false);
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
        width: '600px',
        maxWidth: '95vw',
        border: hasUpdate ? '1px solid var(--secondary)' : '1px solid var(--primary)',
        background: '#07120a',
        boxShadow: hasUpdate ? '0 0 25px rgba(255, 176, 0, 0.2)' : '0 0 25px rgba(51, 255, 0, 0.15)'
      }}>
        {/* Header */}
        <div className="cli-pane-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Shield size={14} color={hasUpdate ? 'var(--secondary)' : 'var(--primary)'} />
            <span style={{ fontWeight: 800 }}>OBSIFORGE // IN-APP UPDATE ENGINE</span>
          </span>
          {!isDownloading && (
            <button className="cli-btn cli-btn-muted" style={{ padding: '1px 6px' }} onClick={handleClose}>
              <X size={12} />
            </button>
          )}
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
                  {hasUpdate ? `NEW UPDATE AVAILABLE: v${updateInfo?.latestVersion}` : 'OBSIFORGE IS UP TO DATE'}
                </div>
                <div className="text-muted" style={{ fontSize: '11px', marginTop: '2px' }}>
                  Current Version: <strong className="text-primary">v{APP_CURRENT_VERSION}</strong> &bull; Channel: <strong className={APP_CURRENT_VERSION.endsWith('b') ? 'text-amber' : 'text-primary'}>{APP_CURRENT_VERSION.endsWith('b') ? 'Public Beta' : 'Official Release'}</strong>
                </div>
              </div>
            </div>

            <button
              className="cli-btn cli-btn-muted"
              style={{ fontSize: '11px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '6px' }}
              onClick={handleManualCheck}
              disabled={checking || isDownloading}
            >
              <RefreshCw size={11} className={checking ? 'animate-spin' : ''} />
              <span>{checking ? 'CHECKING...' : '[ CHECK AGAIN ]'}</span>
            </button>
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div style={{
              padding: '10px 14px',
              background: 'rgba(255, 51, 51, 0.12)',
              border: '1px solid var(--error)',
              color: 'var(--error)',
              fontSize: '11px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <AlertTriangle size={14} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Release Details / Changelog */}
          {hasUpdate ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                <span className="text-muted">RELEASE: <strong>{updateInfo?.releaseName}</strong></span>
                <span className="text-cyan">
                  {updateInfo?.publishedAt ? new Date(updateInfo.publishedAt).toLocaleDateString() : ''}
                </span>
              </div>

              {/* Changelog Box */}
              <div>
                <div className="text-muted" style={{ fontSize: '10px', textTransform: 'uppercase', marginBottom: '4px' }}>
                  CHANGELOG &amp; RELEASE NOTES:
                </div>
                <div style={{
                  padding: '10px 12px',
                  background: '#040d04',
                  border: '1px solid var(--border)',
                  maxHeight: '130px',
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

              {/* In-App Download Progress Display */}
              {isDownloading ? (
                <div style={{
                  padding: '12px 14px',
                  background: '#040d04',
                  border: '1px solid var(--cyan)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
                    <span style={{ color: 'var(--cyan)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Loader size={12} className="animate-spin" />
                      {downloadProgress.status === 'installing'
                        ? 'INSTALLER DOWNLOADED! LAUNCHING & RESTARTING...'
                        : 'DOWNLOADING UPDATE PACKAGE (IN-APP)...'}
                    </span>
                    <strong className="text-primary">{downloadProgress.percent}%</strong>
                  </div>

                  {/* Terminal Progress Bar */}
                  <div style={{
                    width: '100%',
                    height: '14px',
                    background: '#000',
                    border: '1px solid #143314',
                    position: 'relative',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${downloadProgress.percent}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, #00e5ff, #33ff00)',
                      boxShadow: '0 0 10px rgba(51, 255, 0, 0.4)',
                      transition: 'width 0.2s ease'
                    }} />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--muted-text)' }}>
                    <span>Progress: {downloadProgress.transferredMb} MB / {downloadProgress.totalMb} MB</span>
                    <span>Direct In-App Upgrade (Overwrites old version cleanly)</span>
                  </div>
                </div>
              ) : (
                /* Direct In-App Install Action Buttons */
                <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                  <button
                    className="cli-btn"
                    style={{
                      flex: 1,
                      fontWeight: 800,
                      padding: '10px 16px',
                      borderColor: 'var(--primary)',
                      color: 'var(--primary)',
                      background: 'rgba(51, 255, 0, 0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      fontSize: '12px'
                    }}
                    onClick={handleInstallUpdate}
                  >
                    <Rocket size={15} /> [ 🚀 INSTALL UPDATE NOW (IN-APP) ]
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
                    title="View release notes on GitHub website"
                  >
                    <ArrowUpRight size={13} /> Notes
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px', color: 'var(--muted-text)' }}>
              <div>
                ObsiForge automatically checks for new software releases on launch.
              </div>
              <div>
                Repository: <code>https://github.com/{gitHubUpdater.getRepo()}</code>
              </div>
              <div style={{ marginTop: '4px', color: 'var(--primary)', fontWeight: 700 }}>
                ✓ You are on the newest build. No update required.
              </div>
            </div>
          )}

          {/* Footer */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #143314', paddingTop: '10px', marginTop: '4px' }}>
            <button
              className="cli-btn cli-btn-muted"
              style={{ padding: '6px 16px' }}
              onClick={handleClose}
              disabled={isDownloading}
            >
              [ {isDownloading ? 'UPDATING IN BACKGROUND...' : 'CLOSE'} ]
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
