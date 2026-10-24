export interface UpdateInfo {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseName: string;
  releaseNotes: string;
  publishedAt: string;
  downloadUrl: string;
  htmlUrl: string;
  checkedAt: number;
}

export const APP_CURRENT_VERSION = '1.0.1b';

export class GitHubUpdaterService {
  private repo: string;
  private lastCheckResult: UpdateInfo | null = null;

  constructor() {
    this.repo = (import.meta as any).env?.VITE_GITHUB_REPO || 'meowster404/obsiforge';
  }

  public setRepo(repo: string) {
    this.repo = repo;
  }

  public getRepo(): string {
    return this.repo;
  }

  public getLastCheckResult(): UpdateInfo | null {
    return this.lastCheckResult;
  }

  /**
   * Compares two semantic version strings (e.g. "1.0.0" > "1.0.0b", "1.1.0" > "1.0.0")
   */
  public isNewerVersion(latest: string, current: string): boolean {
    const cleanLatest = latest.replace(/^v/i, '').trim();
    const cleanCurrent = current.replace(/^v/i, '').trim();

    if (cleanLatest.toLowerCase() === cleanCurrent.toLowerCase()) {
      return false;
    }

    const parse = (v: string) => {
      const isBeta = /b$|-beta/i.test(v);
      const numeric = v.replace(/[^0-9.]/g, '');
      const parts = numeric.split('.').map(p => parseInt(p, 10) || 0);
      while (parts.length < 3) parts.push(0);
      return { parts, isBeta };
    };

    const l = parse(cleanLatest);
    const c = parse(cleanCurrent);

    for (let i = 0; i < 3; i++) {
      if (l.parts[i] > c.parts[i]) return true;
      if (l.parts[i] < c.parts[i]) return false;
    }

    // If numerical digits are identical (e.g. 1.0.0 vs 1.0.0b):
    // Official release (1.0.0) is newer than the beta build (1.0.0b)
    if (c.isBeta && !l.isBeta) {
      return true;
    }

    return false;
  }

  /**
   * Queries GitHub Releases API for latest release
   */
  public async checkForUpdates(): Promise<UpdateInfo> {
    try {
      const res = await fetch(`https://api.github.com/repos/${this.repo}/releases/latest`, {
        headers: {
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!res.ok) {
        if (res.status === 404) {
          // No releases published yet on repository
          const fallback: UpdateInfo = {
            hasUpdate: false,
            currentVersion: APP_CURRENT_VERSION,
            latestVersion: APP_CURRENT_VERSION,
            releaseName: 'Latest Build',
            releaseNotes: 'No releases published yet on GitHub. You are on the newest source build.',
            publishedAt: new Date().toISOString(),
            downloadUrl: `https://github.com/${this.repo}/releases`,
            htmlUrl: `https://github.com/${this.repo}`,
            checkedAt: Date.now()
          };
          this.lastCheckResult = fallback;
          return fallback;
        }
        throw new Error(`GitHub API returned status ${res.status}`);
      }

      const data = await res.json();
      const latestTag = data.tag_name || data.name || APP_CURRENT_VERSION;
      const hasUpdate = this.isNewerVersion(latestTag, APP_CURRENT_VERSION);

      // Find direct .exe asset if available in release assets
      let downloadUrl = data.html_url;
      if (Array.isArray(data.assets) && data.assets.length > 0) {
        const exeAsset = data.assets.find((a: any) => a.name?.toLowerCase().endsWith('.exe'));
        if (exeAsset && exeAsset.browser_download_url) {
          downloadUrl = exeAsset.browser_download_url;
        }
      }

      const result: UpdateInfo = {
        hasUpdate,
        currentVersion: APP_CURRENT_VERSION,
        latestVersion: latestTag.replace(/^v/i, ''),
        releaseName: data.name || latestTag,
        releaseNotes: data.body || 'No changelog description provided.',
        publishedAt: data.published_at || new Date().toISOString(),
        downloadUrl,
        htmlUrl: data.html_url || `https://github.com/${this.repo}/releases`,
        checkedAt: Date.now()
      };

      this.lastCheckResult = result;
      return result;
    } catch (err: any) {
      console.warn('GitHub update check notice:', err.message);
      const fallback: UpdateInfo = {
        hasUpdate: false,
        currentVersion: APP_CURRENT_VERSION,
        latestVersion: APP_CURRENT_VERSION,
        releaseName: 'Current Release',
        releaseNotes: 'Unable to reach GitHub API. Check your internet connection or verify repository visibility.',
        publishedAt: new Date().toISOString(),
        downloadUrl: `https://github.com/${this.repo}/releases`,
        htmlUrl: `https://github.com/${this.repo}`,
        checkedAt: Date.now()
      };
      this.lastCheckResult = fallback;
      return fallback;
    }
  }
}

export const gitHubUpdater = new GitHubUpdaterService();
