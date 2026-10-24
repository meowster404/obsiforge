import React, { useEffect } from 'react';
import { CheckCircle, AlertTriangle, Cpu, X } from 'lucide-react';

export interface DownloadProgressState {
  isOpen: boolean;
  status: 'idle' | 'resolving' | 'downloading' | 'completed' | 'error';
  engine: string;
  mcVersion: string;
  jarName?: string;
  downloadedBytes?: number;
  totalBytes?: number;
  percent: number;
  error?: string;
}

interface DownloadProgressModalProps {
  state: DownloadProgressState;
  onClose: () => void;
}

export const DownloadProgressModal: React.FC<DownloadProgressModalProps> = ({
  state,
  onClose
}) => {
  const { isOpen, status, engine, mcVersion, jarName, downloadedBytes = 0, totalBytes = 0, percent, error } = state;

  useEffect(() => {
    if (status === 'completed') {
      const timer = setTimeout(() => {
        onClose();
      }, 2200);
      return () => clearTimeout(timer);
    }
  }, [status, onClose]);

  if (!isOpen) return null;

  const formatMb = (bytes: number) => {
    return (bytes / (1024 * 1024)).toFixed(1);
  };

  const displayPercent = Math.max(0, Math.min(100, percent >= 0 ? percent : 50));

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.88)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10005,
      padding: '20px'
    }}>
      <div className="crt-overlay" />

      <div className="cli-pane" style={{
        width: '540px',
        maxWidth: '95vw',
        border: status === 'error' ? '1px solid var(--error)' : status === 'completed' ? '1px solid var(--primary)' : '1px solid var(--cyan)',
        background: '#07120a',
        boxShadow: status === 'completed' ? '0 0 25px rgba(51, 255, 0, 0.25)' : '0 0 25px rgba(0, 229, 255, 0.2)'
      }}>
        {/* Header */}
        <div className="cli-pane-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: status === 'completed' ? 'var(--primary)' : 'var(--cyan)' }}>
            <Cpu size={14} />
            <span style={{ fontWeight: 800 }}>OBSIFORGE // ENGINE BINARY DOWNLOAD STREAM</span>
          </span>
          {(status === 'completed' || status === 'error') && (
            <button className="cli-btn cli-btn-muted" style={{ padding: '1px 6px' }} onClick={onClose}>
              <X size={12} />
            </button>
          )}
        </div>

        {/* Content Body */}
        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Target Metadata Card */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#050a06', border: '1px solid var(--border)', padding: '10px 14px' }}>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--muted-text)', fontWeight: 700 }}>TARGET ENGINE PAYLOAD:</div>
              <div style={{ fontSize: '14px', fontWeight: 900, color: 'var(--primary)', marginTop: '2px' }}>
                {engine.toUpperCase()} {mcVersion}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '10px', color: 'var(--muted-text)', fontWeight: 700 }}>DESTINATION:</div>
              <code style={{ fontSize: '11px', color: 'var(--cyan)' }}>{jarName || 'server.jar'}</code>
            </div>
          </div>

          {/* Progress Bar Container */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', fontSize: '11px' }}>
              <span className="text-muted" style={{ fontWeight: 700 }}>
                {status === 'resolving' && '> RESOLVING OFFICIAL API METADATA...'}
                {status === 'downloading' && '> STREAMING JAR ARTIFACT...'}
                {status === 'completed' && '✓ DOWNLOAD VERIFIED & PERSISTED'}
                {status === 'error' && '✗ STREAM INTERRUPTED'}
              </span>
              <span style={{
                fontWeight: 900,
                color: status === 'completed' ? 'var(--primary)' : status === 'error' ? 'var(--error)' : 'var(--cyan)',
                fontFamily: 'monospace',
                fontSize: '13px'
              }}>
                {status === 'completed' ? '100%' : `${displayPercent}%`}
              </span>
            </div>

            {/* Neon Bar Track */}
            <div style={{
              width: '100%',
              height: '14px',
              background: '#040805',
              border: '1px solid var(--border)',
              padding: '2px',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{
                height: '100%',
                width: `${displayPercent}%`,
                background: status === 'error' 
                  ? 'var(--error)' 
                  : status === 'completed' 
                    ? 'linear-gradient(90deg, #1f7a1f 0%, #33ff00 100%)' 
                    : 'linear-gradient(90deg, #0088aa 0%, #00e5ff 100%)',
                boxShadow: status === 'completed' ? '0 0 10px #33ff00' : '0 0 10px #00e5ff',
                transition: 'width 0.25s ease-out'
              }} />
            </div>

            {/* Bytes Transferred readout */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', fontSize: '10px', color: 'var(--muted-text)' }}>
              <span>
                {totalBytes > 0 
                  ? `${formatMb(downloadedBytes)} MB / ${formatMb(totalBytes)} MB` 
                  : downloadedBytes > 0 
                    ? `${formatMb(downloadedBytes)} MB transferred` 
                    : 'Awaiting first chunk...'}
              </span>
              <span>
                {status === 'downloading' && 'LIVE HTTP/2 STREAM'}
                {status === 'completed' && 'READY TO INITIATE'}
              </span>
            </div>
          </div>

          {/* Status Message or Error */}
          {status === 'error' && (
            <div style={{ padding: '8px 12px', background: 'rgba(255, 51, 51, 0.12)', border: '1px solid var(--error)', color: 'var(--error)', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={14} />
              <span>{error || 'An error occurred during binary acquisition.'}</span>
            </div>
          )}

          {status === 'completed' && (
            <div style={{ padding: '8px 12px', background: 'rgba(51, 255, 0, 0.1)', border: '1px solid var(--primary)', color: 'var(--primary)', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle size={14} />
              <span>Official server jar download successful. Closing popup...</span>
            </div>
          )}

          {/* Footer Control */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
            {status === 'completed' ? (
              <button className="cli-btn" style={{ fontWeight: 800, padding: '6px 16px' }} onClick={onClose}>
                [ CLOSE // READY ]
              </button>
            ) : status === 'error' ? (
              <button className="cli-btn cli-btn-danger" style={{ fontWeight: 800, padding: '6px 16px' }} onClick={onClose}>
                [ DISMISS ERROR ]
              </button>
            ) : (
              <span className="text-muted" style={{ fontSize: '11px', fontStyle: 'italic' }}>
                Please wait while the server binary is provisioned...
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
