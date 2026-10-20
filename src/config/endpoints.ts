/**
 * Upstream Minecraft Engine & Mod API Endpoints
 * All endpoints can be customized or overridden via .env variables
 */

const env = (import.meta as any).env || {};

export const ENDPOINTS = {
  // Base domain for auto-generated joining addresses: {SERVER_NAME}.{RANDOM_CODE}.obsiforge.ply.gg
  BASE_TUNNEL_DOMAIN: env.VITE_BASE_TUNNEL_DOMAIN || 'obsiforge.ply.gg',

  // Mojang Official Version Manifest
  MOJANG_MANIFEST: env.VITE_MOJANG_MANIFEST_URL || 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json',

  // PaperMC v2 API
  PAPER_API: env.VITE_PAPER_API_URL || 'https://api.papermc.io/v2/projects/paper',

  // PurpurMC API
  PURPUR_API: env.VITE_PURPUR_API_URL || 'https://api.purpurmc.org/v2/purpur',

  // FabricMC Meta API
  FABRIC_META: env.VITE_FABRIC_META_URL || 'https://meta.fabricmc.net/v2/versions',

  // Modrinth v2 API
  MODRINTH_API: env.VITE_MODRINTH_API_URL || 'https://api.modrinth.com/v2',

  // Default Port
  DEFAULT_MC_PORT: parseInt(env.VITE_DEFAULT_MC_PORT || '25565', 10)
};
