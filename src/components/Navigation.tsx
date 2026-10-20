import React from 'react';
import { Terminal, Activity, Package, Users, Settings, Archive, Cloud, ShieldAlert } from 'lucide-react';

export type NavTab = 'console' | 'metrics' | 'addons' | 'players' | 'config' | 'backups' | 'cloud' | 'watchdog';

interface NavigationProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  unresolvedCrashesCount?: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onSelectTab,
  unresolvedCrashesCount = 0
}) => {
  const tabs: Array<{ id: NavTab; label: string; icon: React.ReactNode; badge?: number }> = [
    { id: 'console', label: '[1] CONSOLE', icon: <Terminal size={14} /> },
    { id: 'metrics', label: '[2] METRICS', icon: <Activity size={14} /> },
    { id: 'addons', label: '[3] ADDONS', icon: <Package size={14} /> },
    { id: 'players', label: '[4] SECURITY & ACCESS', icon: <Users size={14} /> },
    { id: 'config', label: '[5] CONFIG', icon: <Settings size={14} /> },
    { id: 'backups', label: '[6] BACKUPS', icon: <Archive size={14} /> },
    { id: 'cloud', label: '[7] 24/7 CLOUD & TUNNELS', icon: <Cloud size={14} /> },
    { id: 'watchdog', label: '[8] WATCHDOG', icon: <ShieldAlert size={14} />, badge: unresolvedCrashesCount }
  ];

  return (
    <nav style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: '#0a0a0a', overflowX: 'auto' }}>
      {tabs.map(tab => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onSelectTab(tab.id)}
            style={{
              background: isActive ? 'var(--primary)' : 'transparent',
              color: isActive ? '#000' : 'var(--primary)',
              border: 'none',
              borderRight: '1px solid var(--border)',
              borderBottom: isActive ? 'none' : '1px solid var(--border)',
              padding: '10px 16px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              textShadow: isActive ? 'none' : '0 0 5px var(--primary-glow)',
              transition: 'background 0.15s, color 0.15s',
              whiteSpace: 'nowrap'
            }}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.badge && tab.badge > 0 ? (
              <span style={{
                background: isActive ? '#000' : 'var(--error)',
                color: isActive ? 'var(--error)' : '#000',
                fontSize: '10px',
                padding: '1px 5px',
                fontWeight: 800
              }}>
                !{tab.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
};
