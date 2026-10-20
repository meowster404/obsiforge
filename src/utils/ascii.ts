/**
 * Generates an ASCII character progress bar: [||||||||||..........]
 * @param percentage 0 - 100
 * @param totalBlocks Total block characters width
 */
export function generateAsciiBar(percentage: number, totalBlocks: number = 20): string {
  const clamped = Math.max(0, Math.min(100, Math.round(percentage)));
  const filledBlocks = Math.round((clamped / 100) * totalBlocks);
  const emptyBlocks = Math.max(0, totalBlocks - filledBlocks);
  return '[' + '|'.repeat(filledBlocks) + '.'.repeat(emptyBlocks) + ']';
}

export const ASCII_LOGO = `
 ██████╗ ██████╗ ███████╗██╗███████╗ ██████╗ ██████╗  ██████╗ ███████╗
██╔═══██╗██╔══██╗██╔════╝██║██╔════╝██╔═══██╗██╔══██╗██╔════╝ ██╔════╝
██║   ██║██████╔╝███████╗██║█████╗  ██║   ██║██████╔╝██║  ███╗█████╗  
██║   ██║██╔══██╗╚════██║██║██╔══╝  ██║   ██║██╔══██╗██║   ██║██╔══╝  
╚██████╔╝██████╔╝███████║██║██║     ╚██████╔╝██║  ██║╚██████╔╝███████╗
 ╚═════╝ ╚═════╝ ╚══════╝╚═╝╚═╝      ╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚══════╝
`;

export const MINI_ASCII_BANNER = `+=============================================================================+
| OBSIFORGE // HIGH-PERFORMANCE MINECRAFT CLOUD & ENGINE MAINFRAME            |
| STATUS: OPERATIONAL | ARCH: x64/ARM | SECURITY: MONITORING ACTIVE           |
| NEON DB: SYNC READY | ORACLE CLOUD: GUI MANAGED                             |
+=============================================================================+`;
