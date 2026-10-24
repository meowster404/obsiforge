export interface StyledSegment {
  text: string;
  color?: string;
  bold?: boolean;
}

export const MC_COLORS: Record<string, string> = {
  '0': '#000000', // Black
  '1': '#0000AA', // Dark Blue
  '2': '#00AA00', // Dark Green
  '3': '#00AAAA', // Dark Aqua
  '4': '#AA0000', // Dark Red
  '5': '#AA00AA', // Dark Purple
  '6': '#FFAA00', // Gold
  '7': '#AAAAAA', // Gray
  '8': '#555555', // Dark Gray
  '9': '#5555FF', // Blue
  'a': '#55FF55', // Bright Green
  'b': '#55FFFF', // Aqua
  'c': '#FF5555', // Red
  'd': '#FF55FF', // Light Purple
  'e': '#FFFF55', // Yellow
  'f': '#FFFFFF', // White
  'r': '#33FF00', // Reset to terminal green
};

/**
 * Strips ANSI codes and Minecraft section codes, or parses them into text.
 */
export function cleanMinecraftText(raw: string): string {
  return raw
    // eslint-disable-next-line no-control-regex
    .replace(/\x1b\[[0-9;]*m/g, '') // Strip ANSI
    .replace(/§[0-9a-fk-or]/gi, ''); // Strip section codes
}

/**
 * Categorizes a Minecraft log line by severity.
 */
export function getLogLevel(line: string): 'INFO' | 'WARN' | 'ERROR' | 'SYSTEM' {
  const upper = line.toUpperCase();
  if (upper.includes('/WARN') || upper.includes('[WARN]')) return 'WARN';
  if (upper.includes('/ERROR') || upper.includes('[ERROR]') || upper.includes('[STDERR]')) return 'ERROR';
  if (upper.includes('[SYSTEM') || upper.includes('[WATCHDOG]')) return 'SYSTEM';
  return 'INFO';
}

/**
 * Returns color style based on log level or content.
 */
export function getLineColor(line: string): string {
  const level = getLogLevel(line);
  switch (level) {
    case 'WARN': return 'var(--secondary)'; // Amber #ffb000
    case 'ERROR': return 'var(--error)'; // Red #ff3333
    case 'SYSTEM': return 'var(--cyan)'; // Cyan #00e5ff
    default: return 'var(--primary)'; // Green #33ff00
  }
}
