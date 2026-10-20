import { neon } from '@neondatabase/serverless';
import { hashPassword, generateSalt, encryptSecret, decryptSecret } from '../utils/crypto';

export interface ObsiUser {
  id: number;
  username: string;
  email: string;
  role: 'owner' | 'admin' | 'operator';
  createdAt: string;
  lastLogin?: string;
}

export interface AuditLogEntry {
  id?: number;
  username: string;
  action: string;
  details: string;
  timestamp: string;
}

export interface OciGuiConfig {
  tenancyOcid: string;
  userOcid: string;
  compartmentOcid: string;
  fingerprint: string;
  region: string;
  privateKeyPem: string;
  instanceIp: string;
  instancePort: number;
  tunnelAddress?: string; // e.g. survival-node.a8f2.obsiforge.ply.gg or mc.mydomain.com
  securityListOcid?: string;
  cloudTier?: string;
  allocatedRamGb?: number;
  allocatedCpus?: number;
}

/**
 * Strips http/https and trailing slashes so the address can be directly pasted into Minecraft Java
 * e.g. "https://survival-node.a8f2.obsiforge.ply.gg/" -> "survival-node.a8f2.obsiforge.ply.gg"
 */
export function cleanMinecraftAddress(input?: string | null): string {
  if (!input) return '';
  let cleaned = input.trim();
  cleaned = cleaned.replace(/^https?:\/\//i, '');
  cleaned = cleaned.replace(/\/.*$/, '');
  return cleaned.trim();
}

/**
 * Generates Minecraft joining address formatted as:
 * {SERVER_NAME}.{RANDOM_CODE}.obsiforge.ply.gg
 */
export function generateObsiForgeAddress(serverName?: string, baseDomain: string = 'obsiforge.ply.gg'): string {
  const clean = (serverName || 'server')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'node';
  const randCode = Math.random().toString(36).substring(2, 6);
  return `${clean}.${randCode}.${baseDomain}`;
}

const STORAGE_KEYS = {
  NEON_URL: 'obsiforge_neon_db_url',
  AUTH_SESSION: 'obsiforge_auth_session',
  FAILED_ATTEMPTS: 'obsiforge_failed_attempts',
  LOCAL_OCI_CONFIG: 'obsiforge_oci_gui_config'
};

class NeonAuthService {
  private sessionMasterKey: string | null = null;

  public setSessionMasterKey(key: string) {
    this.sessionMasterKey = key;
  }

  public getSessionMasterKey(): string | null {
    return this.sessionMasterKey;
  }

  private getDbUrl(): string {
    return (
      localStorage.getItem(STORAGE_KEYS.NEON_URL) ||
      (import.meta as any).env?.VITE_NEON_DATABASE_URL ||
      (import.meta as any).env?.DATABASE_URL ||
      ''
    );
  }

  public setDbUrl(url: string) {
    localStorage.setItem(STORAGE_KEYS.NEON_URL, url.trim());
  }

  public isNeonConfigured(): boolean {
    return Boolean(this.getDbUrl());
  }

  private getClient() {
    const url = this.getDbUrl();
    if (!url) throw new Error('Neon Database connection string is not configured.');
    return neon(url);
  }

  /**
   * Tests connection to Neon DB
   */
  public async testConnection(): Promise<{ success: boolean; message: string; version?: string }> {
    try {
      const sql = this.getClient();
      const res = await sql`SELECT version(), current_database() as db_name`;
      if (res && res.length > 0) {
        return {
          success: true,
          message: `Connected successfully to Neon DB [${res[0].db_name}]`,
          version: res[0].version
        };
      }
      return { success: false, message: 'No response from database' };
    } catch (err: any) {
      return { success: false, message: err.message || 'Connection failed' };
    }
  }

  /**
   * 1-Click Schema Initializer for Neon DB
   */
  public async initializeSchema(): Promise<{ success: boolean; message: string }> {
    try {
      const sql = this.getClient();

      // Create users table
      await sql`
        CREATE TABLE IF NOT EXISTS obsiforge_users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(64) UNIQUE NOT NULL,
          email VARCHAR(128) UNIQUE NOT NULL,
          password_hash VARCHAR(128) NOT NULL,
          salt VARCHAR(64) NOT NULL,
          role VARCHAR(32) DEFAULT 'operator',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          last_login TIMESTAMP,
          is_active BOOLEAN DEFAULT TRUE
        );
      `;

      // Create audit logs table
      await sql`
        CREATE TABLE IF NOT EXISTS obsiforge_audit_logs (
          id SERIAL PRIMARY KEY,
          username VARCHAR(64) NOT NULL,
          action VARCHAR(64) NOT NULL,
          details TEXT,
          ip_address VARCHAR(45),
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `;

      // Create cloud configs table
      await sql`
        CREATE TABLE IF NOT EXISTS obsiforge_cloud_configs (
          id SERIAL PRIMARY KEY,
          username VARCHAR(64) NOT NULL,
          config_name VARCHAR(64) DEFAULT 'oracle_cloud',
          encrypted_payload TEXT NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(username, config_name)
        );
      `;

      return { success: true, message: 'ObsiForge tables initialized successfully in Neon DB!' };
    } catch (err: any) {
      return { success: false, message: 'Schema init error: ' + err.message };
    }
  }

  /**
   * Brute force check: locks out user if too many failed attempts in last 15 min
   */
  private checkBruteForceLockout(): { locked: boolean; remainingMinutes?: number } {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.FAILED_ATTEMPTS);
      if (!raw) return { locked: false };
      const data = JSON.parse(raw);
      if (data.count >= 5) {
        const timeDiffMs = Date.now() - data.lastFailed;
        const lockDurationMs = 15 * 60 * 1000;
        if (timeDiffMs < lockDurationMs) {
          const remainingMinutes = Math.ceil((lockDurationMs - timeDiffMs) / 60000);
          return { locked: true, remainingMinutes };
        } else {
          // Lockout expired
          localStorage.removeItem(STORAGE_KEYS.FAILED_ATTEMPTS);
        }
      }
    } catch (e) {}
    return { locked: false };
  }

  private recordFailedAttempt() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.FAILED_ATTEMPTS);
      const data = raw ? JSON.parse(raw) : { count: 0, lastFailed: 0 };
      data.count += 1;
      data.lastFailed = Date.now();
      localStorage.setItem(STORAGE_KEYS.FAILED_ATTEMPTS, JSON.stringify(data));
    } catch (e) {}
  }

  private clearFailedAttempts() {
    localStorage.removeItem(STORAGE_KEYS.FAILED_ATTEMPTS);
  }

  /**
   * Register a new user in Neon DB
   */
  public async registerUser(username: string, email: string, password: string): Promise<{ success: boolean; user?: ObsiUser; message?: string }> {
    if (!username || !email || !password) {
      return { success: false, message: 'All registration fields are required.' };
    }
    if (password.length < 8) {
      return { success: false, message: 'Password must be at least 8 characters long.' };
    }

    try {
      const sql = this.getClient();
      const salt = generateSalt();
      const passHash = await hashPassword(password, salt);

      // Check if first user - grant owner role if table is empty
      const countRes = await sql`SELECT count(*) as total FROM obsiforge_users`;
      const isFirst = parseInt(countRes[0]?.total || '0', 10) === 0;
      const role = isFirst ? 'owner' : 'operator';

      const insertRes = await sql`
        INSERT INTO obsiforge_users (username, email, password_hash, salt, role)
        VALUES (${username.trim()}, ${email.trim().toLowerCase()}, ${passHash}, ${salt}, ${role})
        RETURNING id, username, email, role, created_at;
      `;

      if (insertRes && insertRes.length > 0) {
        const row = insertRes[0];
        const user: ObsiUser = {
          id: row.id,
          username: row.username,
          email: row.email,
          role: row.role,
          createdAt: row.created_at
        };

        this.setSession(user);
        this.sessionMasterKey = password;
        await this.logAuditEvent(user.username, 'USER_REGISTER', `Account created with role [${role}]`);
        return { success: true, user };
      }
      return { success: false, message: 'Registration failed.' };
    } catch (err: any) {
      if (err.message?.includes('duplicate key') || err.message?.includes('unique constraint')) {
        return { success: false, message: 'Username or email already exists in ObsiForge database.' };
      }
      return { success: false, message: err.message };
    }
  }

  /**
   * Log in user
   */
  public async loginUser(usernameOrEmail: string, password: string): Promise<{ success: boolean; user?: ObsiUser; message?: string }> {
    const lockout = this.checkBruteForceLockout();
    if (lockout.locked) {
      return {
        success: false,
        message: `SECURITY ALERT: Account locked due to 5 failed attempts. Please retry in ${lockout.remainingMinutes} minutes.`
      };
    }

    try {
      const sql = this.getClient();
      const identifier = usernameOrEmail.trim();

      const users = await sql`
        SELECT id, username, email, password_hash, salt, role, is_active, created_at
        FROM obsiforge_users
        WHERE LOWER(username) = LOWER(${identifier}) OR LOWER(email) = LOWER(${identifier})
        LIMIT 1;
      `;

      if (!users || users.length === 0) {
        this.recordFailedAttempt();
        return { success: false, message: 'Invalid credentials entered.' };
      }

      const userRow = users[0];
      if (!userRow.is_active) {
        return { success: false, message: 'Account is deactivated. Contact server owner.' };
      }

      const calculatedHash = await hashPassword(password, userRow.salt);
      if (calculatedHash !== userRow.password_hash) {
        this.recordFailedAttempt();
        return { success: false, message: 'Invalid credentials entered.' };
      }

      // Password matches! Clear lockout
      this.clearFailedAttempts();

      // Update last login
      await sql`UPDATE obsiforge_users SET last_login = CURRENT_TIMESTAMP WHERE id = ${userRow.id}`;

      const user: ObsiUser = {
        id: userRow.id,
        username: userRow.username,
        email: userRow.email,
        role: userRow.role,
        createdAt: userRow.created_at,
        lastLogin: new Date().toISOString()
      };

      this.setSession(user);
      this.sessionMasterKey = password;
      await this.logAuditEvent(user.username, 'USER_LOGIN', 'Successful authentication via Neon DB');
      return { success: true, user };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  /**
   * Local session handling
   */
  public setSession(user: ObsiUser) {
    localStorage.setItem(STORAGE_KEYS.AUTH_SESSION, JSON.stringify(user));
  }

  public getCurrentUser(): ObsiUser | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.AUTH_SESSION);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  public logoutUser() {
    const user = this.getCurrentUser();
    if (user) {
      this.logAuditEvent(user.username, 'USER_LOGOUT', 'User logged out of session');
    }
    this.sessionMasterKey = null;
    localStorage.removeItem(STORAGE_KEYS.AUTH_SESSION);
  }

  /**
   * Audit logging to Neon DB
   */
  public async logAuditEvent(username: string, action: string, details: string) {
    if (!this.isNeonConfigured()) return;
    try {
      const sql = this.getClient();
      await sql`
        INSERT INTO obsiforge_audit_logs (username, action, details)
        VALUES (${username}, ${action}, ${details});
      `;
    } catch (e) {
      console.warn('Audit log write failed:', e);
    }
  }

  public async fetchAuditLogs(limit: number = 25): Promise<AuditLogEntry[]> {
    if (!this.isNeonConfigured()) return [];
    try {
      const sql = this.getClient();
      const rows = await sql`
        SELECT id, username, action, details,
               to_char(timestamp at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as iso_time,
               timestamp
        FROM obsiforge_audit_logs
        ORDER BY id DESC
        LIMIT ${limit};
      `;
      return rows.map(r => ({
        id: r.id,
        username: r.username,
        action: r.action,
        details: r.details,
        timestamp: r.iso_time || (r.timestamp ? new Date(r.timestamp).toISOString() : new Date().toISOString())
      }));
    } catch (e) {
      console.error('Failed fetching audit logs:', e);
      return [];
    }
  }

  /**
   * Change current user's password
   */
  public async changePassword(oldPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    const user = this.getCurrentUser();
    if (!user) return { success: false, message: 'No active session.' };
    try {
      const sql = this.getClient();
      const rows = await sql`
        SELECT password_hash, salt FROM obsiforge_users WHERE id = ${user.id} LIMIT 1;
      `;
      if (!rows || rows.length === 0) return { success: false, message: 'User not found.' };
      const { password_hash, salt } = rows[0];
      const check = await hashPassword(oldPassword, salt);
      if (check !== password_hash) {
        return { success: false, message: 'Current password does not match.' };
      }
      const newSalt = generateSalt();
      const newHash = await hashPassword(newPassword, newSalt);
      await sql`
        UPDATE obsiforge_users SET password_hash = ${newHash}, salt = ${newSalt} WHERE id = ${user.id};
      `;
      this.sessionMasterKey = newPassword;
      await this.logAuditEvent(user.username, 'PASSWORD_CHANGE', 'Password was successfully updated');
      return { success: true, message: 'Password updated successfully!' };
    } catch (err: any) {
      return { success: false, message: err.message || 'Error updating password.' };
    }
  }

  /**
   * Update profile details (e.g. email)
   */
  public async updateProfile(email: string): Promise<{ success: boolean; message: string; user?: ObsiUser }> {
    const user = this.getCurrentUser();
    if (!user) return { success: false, message: 'No active session.' };
    try {
      const sql = this.getClient();
      await sql`
        UPDATE obsiforge_users SET email = ${email.trim().toLowerCase()} WHERE id = ${user.id};
      `;
      const updatedUser: ObsiUser = { ...user, email: email.trim().toLowerCase() };
      this.setSession(updatedUser);
      await this.logAuditEvent(user.username, 'PROFILE_UPDATE', `Email updated to ${email}`);
      return { success: true, message: 'Profile details saved!', user: updatedUser };
    } catch (err: any) {
      return { success: false, message: err.message || 'Error saving profile.' };
    }
  }

  /**
   * Oracle Cloud GUI Configuration Management
   * Stores encrypted OCI credentials in Neon DB or local encrypted store
   */
  public async saveOciConfig(config: OciGuiConfig, masterPass?: string): Promise<boolean> {
    try {
      const key = masterPass || this.sessionMasterKey || 'obsiforge_secure_session_key';
      const serialized = JSON.stringify(config);
      const encrypted = await encryptSecret(serialized, key);

      // Save locally
      localStorage.setItem(STORAGE_KEYS.LOCAL_OCI_CONFIG, encrypted);

      // If Neon is configured and user is logged in, sync encrypted config to Neon DB
      const user = this.getCurrentUser();
      if (this.isNeonConfigured() && user) {
        const sql = this.getClient();
        await sql`
          INSERT INTO obsiforge_cloud_configs (username, config_name, encrypted_payload, updated_at)
          VALUES (${user.username}, 'oracle_cloud', ${encrypted}, CURRENT_TIMESTAMP)
          ON CONFLICT (username, config_name)
          DO UPDATE SET encrypted_payload = ${encrypted}, updated_at = CURRENT_TIMESTAMP;
        `;
        await this.logAuditEvent(user.username, 'OCI_CONFIG_SAVE', 'Oracle Cloud parameters updated & encrypted');
      }

      return true;
    } catch (err) {
      console.error('Failed saving OCI config:', err);
      return false;
    }
  }

  public async loadOciConfig(masterPass?: string): Promise<OciGuiConfig | null> {
    try {
      const key = masterPass || this.sessionMasterKey || 'obsiforge_secure_session_key';
      let encrypted = localStorage.getItem(STORAGE_KEYS.LOCAL_OCI_CONFIG);

      // Attempt loading from Neon DB if logged in
      const user = this.getCurrentUser();
      if (this.isNeonConfigured() && user) {
        try {
          const sql = this.getClient();
          const rows = await sql`
            SELECT encrypted_payload FROM obsiforge_cloud_configs
            WHERE username = ${user.username} AND config_name = 'oracle_cloud'
            LIMIT 1;
          `;
          if (rows && rows.length > 0) {
            encrypted = rows[0].encrypted_payload;
          }
        } catch (e) {}
      }

      if (!encrypted) return null;
      try {
        const decryptedJson = await decryptSecret(encrypted, key);
        return JSON.parse(decryptedJson);
      } catch (e) {
        // Mismatched session key or legacy ciphertext; fallback cleanly
        return null;
      }
    } catch (err) {
      return null;
    }
  }

  /**
   * Syncs the user's servers registry to Neon Cloud Database
   */
  public async syncServersToCloud(servers: any[]): Promise<boolean> {
    try {
      const user = this.getCurrentUser();
      if (!user) return false;
      const sql = this.getClient();
      const payload = JSON.stringify(servers);
      await sql`
        INSERT INTO obsiforge_cloud_configs (username, config_name, encrypted_payload, updated_at)
        VALUES (${user.username}, 'servers_registry', ${payload}, CURRENT_TIMESTAMP)
        ON CONFLICT (username, config_name)
        DO UPDATE SET encrypted_payload = ${payload}, updated_at = CURRENT_TIMESTAMP
      `;
      return true;
    } catch (e) {
      console.warn('Could not sync servers registry to Neon Cloud DB:', e);
      return false;
    }
  }

  /**
   * Loads the user's servers registry from Neon Cloud Database
   */
  public async loadServersFromCloud(): Promise<any[] | null> {
    try {
      const user = this.getCurrentUser();
      if (!user) return null;
      const sql = this.getClient();
      const rows = await sql`
        SELECT encrypted_payload FROM obsiforge_cloud_configs
        WHERE username = ${user.username} AND config_name = 'servers_registry'
        LIMIT 1
      `;
      if (rows.length > 0 && rows[0].encrypted_payload) {
        return JSON.parse(rows[0].encrypted_payload);
      }
      return null;
    } catch (e) {
      return null;
    }
  }
}

export const neonAuth = new NeonAuthService();
