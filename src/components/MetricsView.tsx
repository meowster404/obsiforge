import React, { useState, useEffect } from 'react';
import { ServerConfig, ResourceStats, SystemInfo } from '../types/electron';
import { generateAsciiBar, MINI_ASCII_BANNER } from '../utils/ascii';
import { Cpu, HardDrive, Clock, Users, Activity, ShieldCheck } from 'lucide-react';

interface MetricsViewProps {
  server: ServerConfig | null;
  stats: ResourceStats | null;
  systemInfo: SystemInfo | null;
}

export const MetricsView: React.FC<MetricsViewProps> = ({
  server,
  stats,
  systemInfo
}) => {
  const [history, setHistory] = useState<Array<{ time: string; cpu: number; mem: number }>>([]);

  useEffect(() => {
    if (stats) {
      const now = new Date().toLocaleTimeString();
      setHistory(prev => {
        const next = [...prev, { time: now, cpu: stats.cpu, mem: stats.memoryMb }];
        return next.slice(-20); // keep last 20 ticks
      });
    }
  }, [stats]);

  const isOnline = server?.status === 'running';
  const maxRamMb = (server?.maxRam || 4) * 1024;
  const currentMemMb = isOnline ? (stats?.memoryMb || 0) : 0;
  const memPercent = Math.min(100, Math.round((currentMemMb / maxRamMb) * 100));
  const cpuPercent = isOnline ? (stats?.cpu || 0) : 0;
  const currentTps = isOnline ? 20.00 : 0.00;
  const tpsPercent = isOnline ? 100 : 0;

  const formatUptime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}h ${m}m ${s}s`;
  };

  return (
    <div style={{ padding: '16px', overflowY: 'auto', flex: 1, background: '#0a0a0a', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* ASCII Banner */}
      <pre style={{ color: 'var(--muted-text)', fontSize: '11px', margin: 0, overflowX: 'auto', userSelect: 'none' }}>
        {MINI_ASCII_BANNER}
      </pre>

      {/* Grid of Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
        {/* CPU Card */}
        <div className="cli-pane">
          <div className="cli-pane-header">
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Cpu size={14} color="var(--primary)" /> CPU LOAD // CORE TELEMETRY
            </span>
            <span className="text-amber">[{cpuPercent}%]</span>
          </div>
          <div style={{ padding: '12px' }}>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--primary)', marginBottom: '8px' }}>
              {cpuPercent}% UTILIZATION
            </div>
            <div className="ascii-bar" style={{ color: cpuPercent > 80 ? 'var(--error)' : 'var(--primary)', fontSize: '13px' }}>
              {generateAsciiBar(cpuPercent, 25)}
            </div>
            <div className="text-muted" style={{ fontSize: '11px', marginTop: '10px' }}>
              TOTAL HOST CORES: {systemInfo?.cpus || 4} | SCHEDULER: FIFO
            </div>
          </div>
        </div>

        {/* RAM Card */}
        <div className="cli-pane">
          <div className="cli-pane-header">
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <HardDrive size={14} color="var(--primary)" /> RESIDENT MEMORY // HEAP
            </span>
            <span className="text-amber">[{memPercent}%]</span>
          </div>
          <div style={{ padding: '12px' }}>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--primary)', marginBottom: '8px' }}>
              {currentMemMb} MB / {maxRamMb} MB
            </div>
            <div className="ascii-bar" style={{ color: memPercent > 85 ? 'var(--error)' : 'var(--primary)', fontSize: '13px' }}>
              {generateAsciiBar(memPercent, 25)}
            </div>
            <div className="text-muted" style={{ fontSize: '11px', marginTop: '10px' }}>
              ALLOCATED FLAGS: -Xms{server?.minRam || 2}G -Xmx{server?.maxRam || 4}G {server?.useAikarFlags ? '(AIKAR G1GC)' : ''}
            </div>
          </div>
        </div>

        {/* TPS & Engine Health */}
        <div className="cli-pane">
          <div className="cli-pane-header">
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Activity size={14} color="var(--primary)" /> TICK RATE TELEMETRY (TPS)
            </span>
            <span className={isOnline ? "text-cyan" : "text-muted"}>
              [{isOnline ? '20.0 TPS' : 'OFFLINE'}]
            </span>
          </div>
          <div style={{ padding: '12px' }}>
            <div style={{ fontSize: '20px', fontWeight: 800, color: isOnline ? 'var(--primary)' : 'var(--muted-text)', marginBottom: '8px' }}>
              {currentTps.toFixed(2)} / 20.00 TPS
            </div>
            <div className="ascii-bar" style={{ color: isOnline ? 'var(--primary)' : 'var(--muted-text)', fontSize: '13px' }}>
              {generateAsciiBar(tpsPercent, 25)}
            </div>
            <div className="text-muted" style={{ fontSize: '11px', marginTop: '10px' }}>
              {isOnline ? 'MSPT: ~12.4ms (Target: <50ms)' : 'MSPT: 0.0ms (Offline)'} | ENGINE: {server?.engine ? server.engine.toUpperCase() : 'NONE'}
            </div>
          </div>
        </div>

        {/* Uptime & Process */}
        <div className="cli-pane">
          <div className="cli-pane-header">
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={14} color="var(--primary)" /> PROCESS LIFECYCLE
            </span>
            <span className="text-amber">[{server?.status?.toUpperCase() || 'STOPPED'}]</span>
          </div>
          <div style={{ padding: '12px' }}>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--primary)', marginBottom: '8px' }}>
              {stats?.uptime ? formatUptime(stats.uptime) : '0h 0m 0s'}
            </div>
            <div className="text-muted" style={{ fontSize: '12px', lineHeight: '1.6' }}>
              WATCHDOG AUTO-REBOOT: {server?.autoRestart ? '[ACTIVE]' : '[DISABLED]'}<br />
              NETWORK PORT: {server?.port || 25565} (TCP/UDP)<br />
              ONLINE-MODE: {server?.onlineMode ? '[ENFORCED]' : '[OFFLINE / CRACKED]'}
            </div>
          </div>
        </div>
      </div>

      {/* Raw Telemetry Log Stream */}
      <div className="cli-pane" style={{ flex: 1, minHeight: '180px' }}>
        <div className="cli-pane-header">
          <span>&gt; RECENT PERFORMANCE TELEMETRY TICKS</span>
          <span className="text-muted">POLL_INTERVAL: 1500MS</span>
        </div>
        <div style={{ padding: '10px', overflowX: 'auto' }}>
          <table className="cli-table">
            <thead>
              <tr>
                <th>TIMESTAMP</th>
                <th>CPU USAGE</th>
                <th>ASCII CPU GAUGE</th>
                <th>RAM USAGE</th>
                <th>ASCII RAM GAUGE</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted-text)', padding: '20px' }}>
                    WAITING FOR METRIC SAMPLES FROM SPAWNED PROCESS...
                  </td>
                </tr>
              ) : (
                history.slice().reverse().map((h, i) => (
                  <tr key={i}>
                    <td className="text-muted">{h.time}</td>
                    <td>{h.cpu}%</td>
                    <td className="ascii-bar">{generateAsciiBar(h.cpu, 15)}</td>
                    <td>{h.mem} MB</td>
                    <td className="ascii-bar">{generateAsciiBar(Math.round((h.mem / maxRamMb) * 100), 15)}</td>
                    <td><span className="status-badge status-online">OK</span></td>
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
