import React, { useState, useEffect } from 'react';
import { ServerConfig, CrashReport } from '../types/electron';
import { ShieldAlert, RotateCw, AlertTriangle, FileText, CheckCircle, RefreshCw } from 'lucide-react';

interface WatchdogViewProps {
  server: ServerConfig | null;
  onUpdateServerConfig: (updated: Partial<ServerConfig>) => void;
}

export const WatchdogView: React.FC<WatchdogViewProps> = ({ server, onUpdateServerConfig }) => {
  const [crashReports, setCrashReports] = useState<CrashReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<CrashReport | null>(null);
  const [loading, setLoading] = useState(false);

  const loadCrashReports = async () => {
    if (!server) return;
    setLoading(true);
    try {
      const reports = await window.mcServerAPI.getCrashReports(server.id);
      setCrashReports(reports);
      if (reports.length > 0 && !selectedReport) {
        setSelectedReport(reports[0]);
      }
    } catch (e) {
      console.error('Error loading crash reports:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCrashReports();
  }, [server]);

  // Automated Crash Root Cause Diagnoser
  const analyzeCrash = (content: string) => {
    if (content.includes('java.lang.OutOfMemoryError')) {
      return {
        cause: 'HEAP_MEMORY_EXHAUSTED (OutOfMemoryError)',
        recommendation: 'Increase maximum RAM allocation (-Xmx) in [CONFIG] -> [JAVA & RAM] from 4GB to 6GB or 8GB.',
        severity: 'HIGH'
      };
    }
    if (content.includes('java.net.BindException') || content.includes('Address already in use')) {
      return {
        cause: 'PORT_CONFLICT (BindException)',
        recommendation: 'Another server or application is already using port 25565. Change server-port in [CONFIG] or kill the conflicting process.',
        severity: 'CRITICAL'
      };
    }
    if (content.includes('UnsupportedClassVersionError')) {
      return {
        cause: 'JAVA_RUNTIME_MISMATCH',
        recommendation: 'This Minecraft version requires a newer Java runtime (e.g., Java 21 for MC 1.20.5+). Select Java 21 in [CONFIG] -> [JAVA & RAM].',
        severity: 'CRITICAL'
      };
    }
    if (content.includes('MixinApplyError') || content.includes('MixinException')) {
      const match = content.match(/([a-zA-Z0-9_-]+\.jar)/i);
      const modName = match ? match[1] : 'Unknown Mod';
      return {
        cause: `MOD_CONFLICT_OR_CORRUPTION (${modName})`,
        recommendation: `Mod "${modName}" failed to inject mixins. Try updating or disabling this mod in [ADDONS].`,
        severity: 'HIGH'
      };
    }
    return {
      cause: 'GENERAL_ENGINE_CRASH',
      recommendation: 'Review full stack trace below for the offending plugin, mod, or corrupted world chunk.',
      severity: 'MEDIUM'
    };
  };

  const diagnosis = selectedReport ? analyzeCrash(selectedReport.fullContent) : null;

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', height: '100%', flex: 1, background: '#0a0a0a', gap: '14px', overflowY: 'auto' }}>
      {/* Watchdog Status Card */}
      <div className="cli-pane" style={{ padding: '14px' }}>
        <div className="cli-pane-header" style={{ margin: '-14px -14px 14px -14px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RotateCw size={14} color="var(--primary)" /> AUTOMATIC WATCHDOG // PROCESS RESILIENCE
          </span>
          <span className="text-cyan">[DAEMON ACTIVE]</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: '13px', color: 'var(--primary)' }}>
              AUTOMATIC CRASH REBOOT WATCHDOG
            </div>
            <div className="text-muted" style={{ fontSize: '11px', marginTop: '2px' }}>
              Monitors server process exit codes. If an abnormal crash occurs, automatically reboots server within 5s (capped at 3 retries to prevent boot loops).
            </div>
          </div>

          <button
            className={`cli-btn ${server?.autoRestart ? '' : 'cli-btn-muted'}`}
            style={{ fontWeight: 800 }}
            onClick={() => onUpdateServerConfig({ autoRestart: !server?.autoRestart })}
          >
            [{server?.autoRestart ? 'WATCHDOG: ACTIVE (REBOOT ON CRASH)' : 'WATCHDOG: DISABLED'}]
          </button>
        </div>
      </div>

      {/* Crash Reports & Automated Diagnostics Pane */}
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '14px', flex: 1 }}>
        {/* Left: Reports List */}
        <div className="cli-pane">
          <div className="cli-pane-header">
            <span>&gt; CRASH REPORTS LOG</span>
            <button className="cli-btn cli-btn-muted" style={{ padding: '2px 6px', fontSize: '10px' }} onClick={loadCrashReports}>
              <RefreshCw size={10} /> [ RESCAN ]
            </button>
          </div>
          <div style={{ padding: '6px', overflowY: 'auto', maxHeight: '420px' }}>
            {crashReports.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--muted-text)', fontSize: '11px' }}>
                <CheckCircle size={20} color="var(--primary)" style={{ margin: '0 auto 6px auto', display: 'block' }} />
                NO CRASH REPORTS DETECTED. SERVER STABILITY IS NOMINAL.
              </div>
            ) : (
              crashReports.map((r, i) => (
                <div
                  key={i}
                  onClick={() => setSelectedReport(r)}
                  style={{
                    padding: '8px',
                    border: '1px solid',
                    borderColor: selectedReport?.fileName === r.fileName ? 'var(--primary)' : '#143314',
                    background: selectedReport?.fileName === r.fileName ? 'rgba(51, 255, 0, 0.05)' : 'transparent',
                    marginBottom: '6px',
                    cursor: 'pointer',
                    fontSize: '11px'
                  }}
                >
                  <div style={{ fontWeight: 700, color: 'var(--error)' }}>{r.fileName}</div>
                  <div className="text-muted">{new Date(r.date).toLocaleString()}</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Detailed Analysis & Stack Trace */}
        <div className="cli-pane">
          <div className="cli-pane-header">
            <span>&gt; AUTOMATED ROOT CAUSE DIAGNOSTIC ENGINE</span>
            {diagnosis && <span className="text-amber">[{diagnosis.severity}]</span>}
          </div>

          <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', flex: 1, gap: '12px', overflowY: 'auto' }}>
            {selectedReport && diagnosis ? (
              <>
                <div style={{ background: '#1c1005', border: '1px solid var(--secondary)', padding: '10px' }}>
                  <div style={{ fontWeight: 800, fontSize: '12px', color: 'var(--secondary)', marginBottom: '4px' }}>
                    DIAGNOSED ROOT CAUSE: {diagnosis.cause}
                  </div>
                  <div style={{ fontSize: '11px', color: '#fff' }}>
                    <strong>ACTIONABLE FIX:</strong> {diagnosis.recommendation}
                  </div>
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div className="text-muted" style={{ fontSize: '11px', marginBottom: '4px' }}>
                    RAW CRASH REPORT LOG ({selectedReport.fileName}):
                  </div>
                  <pre style={{
                    background: '#050705',
                    border: '1px solid var(--border)',
                    padding: '10px',
                    fontSize: '11px',
                    color: '#ccc',
                    overflowY: 'auto',
                    maxHeight: '320px',
                    margin: 0,
                    lineHeight: '1.4'
                  }}>
                    {selectedReport.fullContent}
                  </pre>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted-text)', fontSize: '12px' }}>
                SELECT A CRASH REPORT ON THE LEFT TO RUN AUTOMATED DIAGNOSTICS.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
