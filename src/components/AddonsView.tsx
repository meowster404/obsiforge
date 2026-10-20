import React, { useState, useEffect } from 'react';
import { ServerConfig, AddonItem } from '../types/electron';
import { Package, Search, Download, Trash2, Power, AlertTriangle, CheckCircle, ExternalLink, RefreshCw, Star, Layers, Check } from 'lucide-react';
import axios from 'axios';

interface AddonsViewProps {
  server: ServerConfig | null;
}

type ContentTypeFilter = 'all' | 'mod' | 'plugin' | 'modpack' | 'resourcepack' | 'datapack' | 'shader';
type SortFilter = 'downloads' | 'relevance' | 'updated' | 'follows';

interface ModrinthHit {
  project_id: string;
  slug: string;
  title: string;
  description: string;
  icon_url: string;
  downloads: number;
  follows: number;
  author: string;
  project_type: string;
  categories: string[];
  versions: string[];
  latest_version: string;
  date_modified: string;
}

interface DependencyItem {
  projectId?: string;
  versionId?: string;
  title: string;
  fileName: string;
  downloadUrl: string;
}

export const AddonsView: React.FC<AddonsViewProps> = ({ server }) => {
  const [activeSubTab, setActiveSubTab] = useState<'installed' | 'browser'>('browser');
  const [installedAddons, setInstalledAddons] = useState<AddonItem[]>([]);
  const [dragOver, setDragOver] = useState(false);

  // Search & Catalog Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [contentType, setContentType] = useState<ContentTypeFilter>('all');
  const [sortBy, setSortBy] = useState<SortFilter>('downloads');
  const [searchResults, setSearchResults] = useState<ModrinthHit[]>([]);
  const [searching, setSearching] = useState(false);

  // Dependency Resolution Modal State
  const [resolvingDependency, setResolvingDependency] = useState(false);
  const [dependencyModal, setDependencyModal] = useState<{
    targetMod: { title: string; fileName: string; downloadUrl: string };
    requiredDeps: DependencyItem[];
  } | null>(null);

  // Drag-and-drop dependency prompt modal state
  const [dragDepPrompt, setDragDepPrompt] = useState<{
    fileName: string;
    requiredDeps: string[];
  } | null>(null);

  const [installStatusMsg, setInstallStatusMsg] = useState<string>('');

  const isPluginEngine = ['paper', 'purpur', 'spigot'].includes(server?.engine || '');

  const loadInstalledAddons = async () => {
    if (!server) return;
    try {
      const list = await window.mcServerAPI.listAddons(server.id);
      setInstalledAddons(list);
    } catch (e) {
      console.error('Failed to list addons:', e);
    }
  };

  useEffect(() => {
    loadInstalledAddons();
    handleSearch();
  }, [server]);

  const handleToggleAddon = async (item: AddonItem) => {
    if (!server) return;
    await window.mcServerAPI.toggleAddon(server.id, item.fileName, !item.enabled);
    loadInstalledAddons();
  };

  const handleDeleteAddon = async (item: AddonItem) => {
    if (!server) return;
    if (confirm(`CONFIRM REMOVAL: Delete "${item.name}"?`)) {
      await window.mcServerAPI.deleteAddon(server.id, item.fileName);
      loadInstalledAddons();
    }
  };

  // Robust Modrinth Search Query
  const handleSearch = async (overrideType?: ContentTypeFilter, overrideSort?: SortFilter) => {
    setSearching(true);
    setInstallStatusMsg('');

    const targetType = overrideType !== undefined ? overrideType : contentType;
    const targetSort = overrideSort !== undefined ? overrideSort : sortBy;

    try {
      const facets: string[][] = [];

      // Project type facet
      if (targetType !== 'all') {
        facets.push([`project_type:${targetType}`]);
      }

      // Loader facet matching server engine if user is filtering mods or plugins
      if (server && ['mod', 'plugin', 'all'].includes(targetType)) {
        if (['paper', 'purpur', 'spigot'].includes(server.engine)) {
          facets.push(['categories:paper', 'categories:spigot', 'categories:purpur']);
        } else if (server.engine === 'fabric') {
          facets.push(['categories:fabric', 'categories:quilt']);
        } else if (server.engine === 'forge') {
          facets.push(['categories:forge']);
        } else if (server.engine === 'neoforge') {
          facets.push(['categories:neoforge']);
        }
      }

      const params: any = {
        query: searchQuery.trim(),
        index: targetSort,
        limit: 24
      };

      if (facets.length > 0) {
        params.facets = JSON.stringify(facets);
      }

      const res = await axios.get('https://api.modrinth.com/v2/search', {
        params,
        headers: { 'User-Agent': 'ObsiForge-Minecraft-Engine/1.0' }
      });

      const hits: ModrinthHit[] = res.data.hits.map((h: any) => ({
        project_id: h.project_id,
        slug: h.slug,
        title: h.title,
        description: h.description,
        icon_url: h.icon_url,
        downloads: h.downloads || 0,
        follows: h.follows || 0,
        author: h.author || 'Author',
        project_type: h.project_type,
        categories: h.categories || [],
        versions: h.versions || [],
        latest_version: h.latest_version || 'Latest',
        date_modified: h.date_modified
      }));

      setSearchResults(hits);
    } catch (err: any) {
      console.error('Modrinth search query error:', err);
      // Fallback simple query without facets if restricted
      try {
        const fallbackRes = await axios.get('https://api.modrinth.com/v2/search', {
          params: { query: searchQuery.trim() || 'optimization', limit: 20 }
        });
        setSearchResults(fallbackRes.data.hits);
      } catch (e) {
        setInstallStatusMsg('ERROR: Could not contact Modrinth API.');
      }
    } finally {
      setSearching(false);
    }
  };

  // 1-Click Install with Version & Dependency Resolution
  const handleInstallClick = async (project: ModrinthHit) => {
    if (!server) return;
    setResolvingDependency(true);
    setInstallStatusMsg(`[ANALYZING] Checking version & dependencies for "${project.title}"...`);

    try {
      const versionsRes = await axios.get(`https://api.modrinth.com/v2/project/${project.project_id}/version`);
      const versions = versionsRes.data;

      if (!versions || versions.length === 0) {
        setInstallStatusMsg(`WARNING: No release versions found for "${project.title}".`);
        setResolvingDependency(false);
        return;
      }

      // Find best version matching server engine and version
      let targetVersion = versions[0];
      const matchingVersion = versions.find((v: any) => {
        const hasLoader = server.engine === 'vanilla' || v.loaders.includes(server.engine) || (['paper', 'purpur'].includes(server.engine) && v.loaders.includes('spigot'));
        const hasVersion = v.game_versions.includes(server.mcVersion) || server.mcVersion.toLowerCase().includes('latest');
        return hasLoader && hasVersion;
      });

      if (matchingVersion) {
        targetVersion = matchingVersion;
      }

      const targetFile = targetVersion.files.find((f: any) => f.primary) || targetVersion.files[0];

      // Inspect dependencies
      const requiredDeps: DependencyItem[] = [];
      if (targetVersion.dependencies && targetVersion.dependencies.length > 0) {
        for (const dep of targetVersion.dependencies) {
          if (dep.dependency_type === 'required' && (dep.project_id || dep.version_id)) {
            try {
              let depProjectName = dep.file_name || 'Required Dependency';
              let depDownloadUrl = '';
              let depFileName = dep.file_name || '';

              if (dep.version_id) {
                const depVerRes = await axios.get(`https://api.modrinth.com/v2/version/${dep.version_id}`);
                const depFile = depVerRes.data.files.find((f: any) => f.primary) || depVerRes.data.files[0];
                depDownloadUrl = depFile.url;
                depFileName = depFile.filename;
                depProjectName = depVerRes.data.name || depFileName;
              } else if (dep.project_id) {
                const depProjRes = await axios.get(`https://api.modrinth.com/v2/project/${dep.project_id}`);
                depProjectName = depProjRes.data.title;

                const depVersionsRes = await axios.get(`https://api.modrinth.com/v2/project/${dep.project_id}/version`);
                if (depVersionsRes.data.length > 0) {
                  const depVer = depVersionsRes.data[0];
                  const depFile = depVer.files.find((f: any) => f.primary) || depVer.files[0];
                  depDownloadUrl = depFile.url;
                  depFileName = depFile.filename;
                }
              }

              if (depDownloadUrl && depFileName) {
                requiredDeps.push({
                  projectId: dep.project_id,
                  versionId: dep.version_id,
                  title: depProjectName,
                  fileName: depFileName,
                  downloadUrl: depDownloadUrl
                });
              }
            } catch (depErr) {}
          }
        }
      }

      setResolvingDependency(false);

      if (requiredDeps.length > 0) {
        setDependencyModal({
          targetMod: {
            title: project.title,
            fileName: targetFile.filename,
            downloadUrl: targetFile.url
          },
          requiredDeps
        });
      } else {
        await executeDownload(targetFile.url, targetFile.filename, project.title);
      }
    } catch (err: any) {
      console.error('Install error:', err);
      setInstallStatusMsg(`ERROR: Failed to resolve ${project.title}`);
      setResolvingDependency(false);
    }
  };

  const executeDownload = async (url: string, fileName: string, title: string) => {
    if (!server) return;
    setInstallStatusMsg(`[DOWNLOADING] ${fileName}...`);
    try {
      await window.mcServerAPI.installAddonFromUrl(server.id, url, fileName);
      setInstallStatusMsg(`[SUCCESS] Installed "${title}" into server!`);
      loadInstalledAddons();
    } catch (e: any) {
      setInstallStatusMsg(`[ERROR] Download failed: ${e.message}`);
    }
  };

  const handleConfirmDependencyInstall = async () => {
    if (!dependencyModal || !server) return;
    const { targetMod, requiredDeps } = dependencyModal;
    setDependencyModal(null);

    // Install primary mod
    await executeDownload(targetMod.downloadUrl, targetMod.fileName, targetMod.title);

    // Install required dependencies
    for (const dep of requiredDeps) {
      setInstallStatusMsg(`[DOWNLOADING DEPENDENCY] ${dep.title}...`);
      await executeDownload(dep.downloadUrl, dep.fileName, dep.title);
    }

    setInstallStatusMsg(`[SUCCESS] Installed "${targetMod.title}" + ${requiredDeps.length} required dependencies!`);
    loadInstalledAddons();
  };

  // Drag and Drop File Handler with Automated Dependency Check
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (!server) return;

    const files = Array.from(e.dataTransfer.files);
    const jarFiles = files.filter(f => f.name.endsWith('.jar'));

    if (jarFiles.length === 0) {
      alert('Only .jar files can be installed as mods/plugins!');
      return;
    }

    for (const file of jarFiles) {
      const filePath = (file as any).path || file.name;
      setInstallStatusMsg(`Installing file: ${file.name}...`);
      await window.mcServerAPI.installAddonFromFile(server.id, filePath);

      // Inspect jar for required dependencies
      if (window.mcServerAPI.inspectJar) {
        try {
          const info = await window.mcServerAPI.inspectJar(filePath);
          if (info && info.requiredDeps && info.requiredDeps.length > 0) {
            // Check if any required dep is missing from installedAddons
            const missing = info.requiredDeps.filter(dep =>
              !installedAddons.some(a => a.fileName.toLowerCase().includes(dep.toLowerCase()))
            );
            if (missing.length > 0) {
              setDragDepPrompt({
                fileName: file.name,
                requiredDeps: missing
              });
            }
          }
        } catch (e) {}
      }
    }

    loadInstalledAddons();
  };

  const handleAutoInstallMissingDragDeps = async () => {
    if (!dragDepPrompt || !server) return;
    const depsToInstall = dragDepPrompt.requiredDeps;
    setDragDepPrompt(null);

    for (const dep of depsToInstall) {
      setInstallStatusMsg(`[RESOLVING DEPENDENCY] Searching Modrinth for "${dep}"...`);
      try {
        const searchRes = await axios.get('https://api.modrinth.com/v2/search', {
          params: { query: dep, limit: 1 }
        });
        if (searchRes.data.hits.length > 0) {
          const hit = searchRes.data.hits[0];
          await handleInstallClick(hit);
        }
      } catch (e) {}
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', height: '100%', flex: 1, background: '#0a0a0a', gap: '14px', overflowY: 'auto' }}>
      {/* Top Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className={`cli-btn ${activeSubTab === 'browser' ? 'cli-btn-secondary' : 'cli-btn-muted'}`}
            onClick={() => setActiveSubTab('browser')}
          >
            <Download size={13} /> [ BROWSE REPO &amp; SEARCH ]
          </button>
          <button
            className={`cli-btn ${activeSubTab === 'installed' ? '' : 'cli-btn-muted'}`}
            onClick={() => setActiveSubTab('installed')}
          >
            <Package size={13} /> [ INSTALLED ADDONS ({installedAddons.length}) ]
          </button>
        </div>

        <button className="cli-btn cli-btn-muted" onClick={loadInstalledAddons} title="Refresh directory">
          <RefreshCw size={12} /> [ REFRESH ]
        </button>
      </div>

      {installStatusMsg && (
        <div style={{
          padding: '8px 12px',
          background: 'rgba(51, 255, 0, 0.08)',
          border: '1px solid var(--border)',
          color: 'var(--primary)',
          fontSize: '11px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span>&gt;</span>
          <span>{installStatusMsg}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: BROWSER & MODRINTH SEARCH                                          */}
      {/* ========================================================================= */}
      {activeSubTab === 'browser' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Search Row */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
              <span className="text-muted" style={{ fontSize: '11px', fontWeight: 700 }}>SEARCH:</span>
              <input
                type="text"
                className="cli-input"
                placeholder="Search mods, plugins, modpacks, resource packs, shaders (e.g. Sodium, Lithium, WorldEdit, Essentials)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>

            {/* Sort Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="text-muted" style={{ fontSize: '11px' }}>SORT:</span>
              <select
                className="cli-select"
                value={sortBy}
                onChange={(e) => {
                  const val = e.target.value as SortFilter;
                  setSortBy(val);
                  handleSearch(undefined, val);
                }}
              >
                <option value="downloads">Popularity (Most Downloads)</option>
                <option value="relevance">Relevance</option>
                <option value="updated">Recently Updated</option>
                <option value="follows">Most Followed</option>
              </select>
            </div>

            <button className="cli-btn cli-btn-secondary" onClick={() => handleSearch()} disabled={searching}>
              <Search size={13} /> [{searching ? 'SEARCHING...' : 'SEARCH'}]
            </button>
          </div>

          {/* Content Type Filter Chips */}
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
            {[
              { id: 'all', label: 'ALL' },
              { id: 'mod', label: 'MODS' },
              { id: 'plugin', label: 'PLUGINS' },
              { id: 'modpack', label: 'MODPACKS' },
              { id: 'resourcepack', label: 'TEXTURE PACKS' },
              { id: 'datapack', label: 'DATAPACKS' },
              { id: 'shader', label: 'SHADERS' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setContentType(tab.id as ContentTypeFilter);
                  handleSearch(tab.id as ContentTypeFilter);
                }}
                style={{
                  background: contentType === tab.id ? 'var(--primary)' : 'transparent',
                  color: contentType === tab.id ? '#000' : 'var(--primary)',
                  border: '1px solid var(--border)',
                  padding: '3px 10px',
                  fontSize: '11px',
                  cursor: 'pointer',
                  fontWeight: contentType === tab.id ? 800 : 400
                }}
              >
                [{tab.label}]
              </button>
            ))}
          </div>

          <div className="text-muted" style={{ fontSize: '11px' }}>
            ENGINE CONTEXT: [{server?.engine.toUpperCase()}] | TARGET MC: [{server?.mcVersion}] | AUTO-DEPENDENCY RESOLVER: [ACTIVE]
          </div>

          {/* Results Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px' }}>
            {searchResults.map((proj) => {
              const isCompatible = server ? (
                server.engine === 'vanilla' ||
                proj.categories.includes(server.engine) ||
                (['paper', 'purpur'].includes(server.engine) && proj.categories.includes('spigot'))
              ) : true;

              return (
                <div key={proj.project_id} className="cli-pane" style={{ padding: '12px', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    {proj.icon_url ? (
                      <img
                        src={proj.icon_url}
                        alt={proj.title}
                        style={{ width: '42px', height: '42px', objectFit: 'contain', border: '1px solid var(--border)' }}
                      />
                    ) : (
                      <div style={{ width: '42px', height: '42px', background: '#071707', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Package size={22} color="var(--primary)" />
                      </div>
                    )}

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: '13px', color: 'var(--primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {proj.title}
                      </div>
                      <div className="text-muted" style={{ fontSize: '10px', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                        <span>BY: {proj.author}</span>
                        <span>•</span>
                        <span className="text-cyan">{formatNumber(proj.downloads)} DLs</span>
                        <span>•</span>
                        <span className="text-amber"><Star size={10} style={{ verticalAlign: 'middle' }} /> {formatNumber(proj.follows)}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: '11px', color: '#aaa', margin: '8px 0', minHeight: '34px', lineHeight: '1.4', flex: 1 }}>
                    {proj.description.slice(0, 100)}...
                  </div>

                  {/* Badges */}
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '8px' }}>
                    <span className="status-badge" style={{ borderColor: '#333', fontSize: '9px' }}>
                      {proj.project_type.toUpperCase()}
                    </span>
                    {proj.categories.slice(0, 3).map(c => (
                      <span key={c} className="status-badge status-online" style={{ fontSize: '9px' }}>
                        {c.toUpperCase()}
                      </span>
                    ))}
                    {isCompatible ? (
                      <span className="status-badge status-online" style={{ fontSize: '9px', marginLeft: 'auto' }}>
                        ✓ COMPATIBLE
                      </span>
                    ) : (
                      <span className="status-badge status-starting" style={{ fontSize: '9px', marginLeft: 'auto' }}>
                        CHECK LOADER
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed #143314', paddingTop: '8px' }}>
                    <a
                      href={`https://modrinth.com/${proj.project_type}/${proj.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="cli-btn cli-btn-muted"
                      style={{ fontSize: '10px', padding: '2px 6px' }}
                    >
                      <ExternalLink size={10} /> [INFO]
                    </a>

                    <button
                      className="cli-btn"
                      style={{ fontSize: '11px', padding: '3px 10px', fontWeight: 800 }}
                      onClick={() => handleInstallClick(proj)}
                      disabled={resolvingDependency}
                    >
                      <Download size={11} /> [ 1-CLICK INSTALL ]
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: INSTALLED ADDONS & DRAG-AND-DROP                                    */}
      {/* ========================================================================= */}
      {activeSubTab === 'installed' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Drag & Drop Zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            style={{
              border: `2px dashed ${dragOver ? 'var(--primary)' : 'var(--border)'}`,
              padding: '22px',
              textAlign: 'center',
              background: dragOver ? 'rgba(51, 255, 0, 0.05)' : '#070c07',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <Package size={28} color="var(--primary)" style={{ margin: '0 auto 8px auto', display: 'block' }} />
            <div style={{ fontWeight: 800, fontSize: '13px', color: 'var(--primary)' }}>
              [ DRAG &amp; DROP .JAR FILES HERE TO INSTALL ]
            </div>
            <div className="text-muted" style={{ fontSize: '11px', marginTop: '4px' }}>
              Files are automatically inspected for missing required dependencies upon upload!
            </div>
          </div>

          {/* Addons Table */}
          <div className="cli-pane">
            <div className="cli-pane-header">
              <span>&gt; INSTALLED ADDONS &amp; ACTIVE TOGGLES ({installedAddons.length})</span>
              <span className="text-muted">LOCATION: /{isPluginEngine ? 'plugins' : 'mods'}</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="cli-table">
                <thead>
                  <tr>
                    <th>STATUS / ACTIVE</th>
                    <th>NAME / FILENAME</th>
                    <th>SIZE</th>
                    <th>TYPE</th>
                    <th style={{ textAlign: 'right' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {installedAddons.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '30px', color: 'var(--muted-text)' }}>
                        NO ADDONS INSTALLED YET. SWITCH TO [BROWSE REPO &amp; SEARCH] OR DRAG .JAR FILES ABOVE.
                      </td>
                    </tr>
                  ) : (
                    installedAddons.map((item, idx) => (
                      <tr key={idx}>
                        <td>
                          <button
                            onClick={() => handleToggleAddon(item)}
                            className={`cli-btn ${item.enabled ? '' : 'cli-btn-muted'}`}
                            style={{ padding: '2px 8px', fontSize: '10px', fontWeight: 800 }}
                            title="Toggle active status"
                          >
                            <Power size={11} /> {item.enabled ? '[ACTIVE]' : '[INACTIVE]'}
                          </button>
                        </td>
                        <td style={{ fontWeight: 700 }}>
                          <span style={{ color: item.enabled ? 'var(--primary)' : 'var(--muted-text)' }}>
                            {item.fileName}
                          </span>
                        </td>
                        <td className="text-muted">{item.sizeKb} KB</td>
                        <td>
                          <span style={{ fontSize: '10px', color: 'var(--cyan)' }}>[{item.type.toUpperCase()}]</span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="cli-btn cli-btn-danger"
                            style={{ padding: '2px 8px', fontSize: '11px' }}
                            onClick={() => handleDeleteAddon(item)}
                            title="Delete addon file permanently"
                          >
                            <Trash2 size={11} /> [DELETE]
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODRINTH DEPENDENCY RESOLVER MODAL                                        */}
      {/* ========================================================================= */}
      {dependencyModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0, 0, 0, 0.88)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }}>
          <div className="cli-pane" style={{ width: '540px', maxWidth: '90vw', padding: '0', border: '1px solid var(--secondary)' }}>
            <div className="cli-pane-header" style={{ background: '#1c1305', borderBottom: '1px solid var(--secondary)' }}>
              <span className="text-amber" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertTriangle size={15} /> [!] DEPENDENCY RESOLVER ALERT
              </span>
              <span className="text-muted">MODRINTH API</span>
            </div>

            <div style={{ padding: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary)', marginBottom: '8px' }}>
                "{dependencyModal.targetMod.title}" requires the following core dependencies:
              </div>

              <div style={{ background: '#050a05', border: '1px solid var(--border)', padding: '10px', marginBottom: '14px' }}>
                {dependencyModal.requiredDeps.map((dep, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', marginBottom: '4px' }}>
                    <CheckCircle size={13} color="var(--primary)" />
                    <span style={{ fontWeight: 700 }}>{dep.title}</span>
                    <span className="text-muted" style={{ fontSize: '11px' }}>({dep.fileName})</span>
                  </div>
                ))}
              </div>

              <div className="text-amber" style={{ fontSize: '11px', marginBottom: '16px' }}>
                * Would you like ObsiForge to automatically download and verify all dependencies?
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button className="cli-btn cli-btn-muted" onClick={() => setDependencyModal(null)}>
                  [ CANCEL ]
                </button>
                <button className="cli-btn cli-btn-secondary" style={{ fontWeight: 800 }} onClick={handleConfirmDependencyInstall}>
                  [ AUTO-INSTALL ALL DEPENDENCIES ]
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DRAG & DROP JAR DEPENDENCY PROMPT MODAL                                   */}
      {/* ========================================================================= */}
      {dragDepPrompt && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0, 0, 0, 0.88)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }}>
          <div className="cli-pane" style={{ width: '540px', maxWidth: '90vw', padding: '0', border: '1px solid var(--secondary)' }}>
            <div className="cli-pane-header" style={{ background: '#1c1305', borderBottom: '1px solid var(--secondary)' }}>
              <span className="text-amber" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertTriangle size={15} /> [!] MISSING DEPENDENCY DETECTED FROM JAR
              </span>
              <span className="text-muted">JAR METADATA ANALYZER</span>
            </div>

            <div style={{ padding: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary)', marginBottom: '8px' }}>
                The uploaded file "{dragDepPrompt.fileName}" declares dependencies that are not yet installed:
              </div>

              <div style={{ background: '#050a05', border: '1px solid var(--border)', padding: '10px', marginBottom: '14px' }}>
                {dragDepPrompt.requiredDeps.map((dep, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', marginBottom: '4px' }}>
                    <span className="text-amber">&gt;</span>
                    <strong className="text-cyan">{dep}</strong>
                  </div>
                ))}
              </div>

              <div className="text-amber" style={{ fontSize: '11px', marginBottom: '16px' }}>
                Would you like ObsiForge to automatically query Modrinth and install the missing dependencies for you?
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button className="cli-btn cli-btn-muted" onClick={() => setDragDepPrompt(null)}>
                  [ DISMISS ]
                </button>
                <button className="cli-btn cli-btn-secondary" style={{ fontWeight: 800 }} onClick={handleAutoInstallMissingDragDeps}>
                  [ AUTO-FETCH FROM MODRINTH ]
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
