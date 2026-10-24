import { Key, X, ShieldAlert, Settings } from 'lucide-react';

interface OciApiKeyRequiredModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigureKeys?: () => void;
  functionName?: string;
}

export const OciApiKeyRequiredModal: React.FC<OciApiKeyRequiredModalProps> = ({
  isOpen,
  onClose,
  onConfigureKeys,
  functionName = 'Oracle Cloud Infrastructure (OCI) 24/7 Deployment'
}) => {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.88)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      padding: '20px'
    }}>
      <div className="crt-overlay" />
      <div className="cli-pane" style={{
        width: '100%',
        maxWidth: '560px',
        background: '#090d09',
        border: '1px solid var(--secondary)',
        boxShadow: '0 0 35px rgba(255, 176, 0, 0.25)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div className="cli-pane-header" style={{
          background: 'rgba(255, 176, 0, 0.12)',
          borderBottom: '1px solid var(--secondary)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--secondary)' }}>
            <Key size={16} />
            <span style={{ fontWeight: 800, fontSize: '12px', letterSpacing: '0.08em' }}>
              SECURITY NOTICE // ORACLE CLOUD API KEY REQUIRED
            </span>
          </div>
          <button
            className="cli-btn cli-btn-muted"
            style={{ padding: '2px 6px', fontSize: '10px' }}
            onClick={onClose}
          >
            <X size={13} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            background: 'rgba(255, 176, 0, 0.08)',
            border: '1px solid rgba(255, 176, 0, 0.25)',
            padding: '12px'
          }}>
            <ShieldAlert size={28} color="var(--secondary)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontWeight: 800, fontSize: '13px', color: 'var(--secondary)', marginBottom: '4px' }}>
                API CREDENTIALS NEEDED TO PROCEED
              </div>
              <p style={{ margin: 0, fontSize: '11px', lineHeight: '1.5', color: '#ccc' }}>
                To use the <strong>{functionName}</strong> feature, you need to insert your Oracle Cloud API credentials (Tenancy OCID, User OCID, API Fingerprint, and RSA Private Key).
              </p>
            </div>
          </div>

          <div style={{ fontSize: '11px', color: 'var(--muted-text)', lineHeight: '1.6' }}>
            <p style={{ margin: '0 0 8px 0' }}>
              <strong>Where to add your API keys:</strong>
            </p>
            <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <li>Navigate to <strong>[7] 24/7 CLOUD &amp; TUNNELS</strong> in the main navigation.</li>
              <li>Or configure them anytime later in <strong>Settings</strong>.</li>
              <li>All keys are encrypted locally using AES-256 before persisting to your secure vault.</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
            <button
              className="cli-btn cli-btn-muted"
              style={{ padding: '8px 16px', fontSize: '11px' }}
              onClick={onClose}
            >
              [ DISMISS FOR NOW ]
            </button>

            {onConfigureKeys && (
              <button
                className="cli-btn cli-btn-secondary"
                style={{ padding: '8px 16px', fontSize: '11px', fontWeight: 800 }}
                onClick={() => {
                  onClose();
                  onConfigureKeys();
                }}
              >
                <Settings size={13} />
                <span>[ CONFIGURE API KEYS IN SETTINGS ]</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
