import React, { useState, useEffect, useRef } from 'react';
import { ServerConfig, ServerLog } from '../types/electron';
import { getLineColor, getLogLevel } from '../utils/ansi';
import { Send, Download, Trash2, ArrowDownCircle } from 'lucide-react';

interface ConsoleViewProps {
  server: ServerConfig | null;
  logs: ServerLog[];
  onSendCommand: (command: string) => void;
  onClearLogs: () => void;
}

export const ConsoleView: React.FC<ConsoleViewProps> = ({
  server,
  logs,
  onSendCommand,
  onClearLogs
}) => {
  const [command, setCommand] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [filterLevel, setFilterLevel] = useState<'ALL' | 'INFO' | 'WARN' | 'ERROR'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);

  const consoleEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll) {
      consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = command.trim();
    if (!trimmed) return;
    onSendCommand(trimmed);
    setHistory(prev => [...prev, trimmed]);
    setHistoryIndex(-1);
    setCommand('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length === 0) return;
      const nextIndex = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(nextIndex);
      setCommand(history[nextIndex]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex === -1) return;
      const nextIndex = historyIndex + 1;
      if (nextIndex >= history.length) {
        setHistoryIndex(-1);
        setCommand('');
      } else {
        setHistoryIndex(nextIndex);
        setCommand(history[nextIndex]);
      }
    }
  };

  const handleExportLogs = () => {
    const text = logs.map(l => `[${new Date(l.timestamp).toLocaleTimeString()}] ${l.line}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${server?.name || 'server'}_console_${Date.now()}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredLogs = logs.filter(item => {
    if (filterLevel !== 'ALL') {
      const lvl = getLogLevel(item.line);
      if (lvl !== filterLevel) return false;
    }
    if (searchTerm) {
      if (!item.line.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    }
    return true;
  });

  const quickCommands = ['save-all', 'list', 'tps', 'reload', 'whitelist list', 'difficulty'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', flex: 1, background: '#0a0a0a' }}>
      {/* Console Toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 12px',
        borderBottom: '1px solid var(--border)',
        background: '#0d130d',
        gap: '10px',
        flexWrap: 'wrap'
      }}>
        {/* Left: Filter Level */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span className="text-muted" style={{ fontSize: '11px' }}>FILTER:</span>
          {(['ALL', 'INFO', 'WARN', 'ERROR'] as const).map(lvl => (
            <button
              key={lvl}
              onClick={() => setFilterLevel(lvl)}
              style={{
                background: filterLevel === lvl ? 'var(--primary)' : 'transparent',
                color: filterLevel === lvl ? '#000' : 'var(--primary)',
                border: '1px solid var(--border)',
                padding: '2px 8px',
                fontSize: '11px',
                cursor: 'pointer',
                fontWeight: filterLevel === lvl ? 800 : 400
              }}
            >
              [{lvl}]
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, maxWidth: '280px' }}>
          <span className="text-muted" style={{ fontSize: '11px' }}>GREP:</span>
          <input
            type="text"
            className="cli-input"
            style={{ padding: '3px 8px', fontSize: '11px' }}
            placeholder="Search console logs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Right: Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className="cli-btn cli-btn-muted"
            style={{ padding: '3px 8px', fontSize: '11px' }}
            title="Toggle autoscroll"
          >
            <ArrowDownCircle size={12} /> [{autoScroll ? 'AUTOSCROLL: ON' : 'AUTOSCROLL: OFF'}]
          </button>
          <button
            onClick={handleExportLogs}
            className="cli-btn cli-btn-muted"
            style={{ padding: '3px 8px', fontSize: '11px' }}
            title="Export logs to file"
          >
            <Download size={12} /> [EXPORT]
          </button>
          <button
            onClick={onClearLogs}
            className="cli-btn cli-btn-muted"
            style={{ padding: '3px 8px', fontSize: '11px' }}
            title="Clear display buffer"
          >
            <Trash2 size={12} /> [CLEAR]
          </button>
        </div>
      </div>

      {/* Log Output Area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px',
          background: '#070a07',
          fontFamily: "'JetBrains Mono', Consolas, monospace",
          fontSize: '12px',
          lineHeight: '1.45',
          borderBottom: '1px solid var(--border)'
        }}
      >
        {filteredLogs.length === 0 ? (
          <div className="text-muted" style={{ padding: '20px', textAlign: 'center' }}>
            &gt; SYSTEM CONSOLE BUFFER READY. WAITING FOR SERVER PROCESS OUTPUT...
          </div>
        ) : (
          filteredLogs.map((log, index) => {
            const timeStr = new Date(log.timestamp).toLocaleTimeString();
            const color = getLineColor(log.line);
            return (
              <div key={index} style={{ color, wordBreak: 'break-all', marginBottom: '2px' }}>
                <span className="text-muted" style={{ marginRight: '8px', opacity: 0.6 }}>[{timeStr}]</span>
                <span>{log.line}</span>
              </div>
            );
          })
        )}
        <div ref={consoleEndRef} />
      </div>

      {/* Quick Command Chips */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 12px',
        background: '#0b0f0b',
        borderBottom: '1px dashed #143314',
        overflowX: 'auto'
      }}>
        <span className="text-muted" style={{ fontSize: '10px' }}>SHORTCUTS:</span>
        {quickCommands.map(cmd => (
          <button
            key={cmd}
            onClick={() => onSendCommand(cmd)}
            style={{
              background: 'transparent',
              color: 'var(--muted-text)',
              border: '1px solid #143314',
              padding: '1px 6px',
              fontSize: '10px',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.borderColor = 'var(--primary)';
              (e.target as HTMLElement).style.color = 'var(--primary)';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.borderColor = '#143314';
              (e.target as HTMLElement).style.color = 'var(--muted-text)';
            }}
          >
            /{cmd}
          </button>
        ))}
      </div>

      {/* Interactive Command Input Form */}
      <form
        onSubmit={handleSend}
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '8px 12px',
          background: '#050805',
          gap: '8px'
        }}
      >
        <span style={{ color: 'var(--primary)', fontWeight: 700, fontSize: '12px', whiteSpace: 'nowrap' }}>
          mc-admin@{server?.name?.toLowerCase().replace(/\s+/g, '_') || 'node'}:~$
        </span>
        <input
          type="text"
          className="cli-input"
          style={{ flex: 1, padding: '7px 10px', fontSize: '12px' }}
          placeholder="Type Minecraft command (e.g. op Steve, say Server rebooting, save-all, stop)..."
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
        />
        <button
          type="submit"
          className="cli-btn"
          style={{ fontWeight: 700 }}
          disabled={!server || server.status !== 'running'}
        >
          <Send size={13} /> [ EXECUTE ]
        </button>
      </form>
    </div>
  );
};
