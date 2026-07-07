import { charts, incidents, users, chartShares } from "@shared/schema";
import type {
  Chart, InsertChart, Incident, InsertIncident,
  User, ChartWithAccess, ShareRecipient,
} from "@shared/schema";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, desc, and, inArray } from "drizzle-orm";

// DB path is env-configurable so the VPS can mount a persistent volume at a
// fixed location (e.g. /data/data.db). Defaults to ./data.db for local/dev.
const DB_PATH = process.env.DB_PATH || "data.db";
const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");

// Ensure table exists (lightweight bootstrap; avoids requiring drizzle-kit migrations at runtime).
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS charts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    place_name TEXT NOT NULL,
    latitude TEXT NOT NULL,
    longitude TEXT NOT NULL,
    tz_offset TEXT NOT NULL,
    lagna_index INTEGER,
    rasi_index INTEGER,
    nakshatra_index INTEGER,
    created_at INTEGER NOT NULL
  );
`);

// Migration: add computed-value columns to pre-existing databases (ignore if present).
for (const col of ["lagna_index", "rasi_index", "nakshatra_index"]) {
  try { sqlite.exec(`ALTER TABLE charts ADD COLUMN ${col} INTEGER;`); } catch { /* already exists */ }
}

// Life incidents recorded against a chart.
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS incidents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chart_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    single_day INTEGER NOT NULL,
    kind TEXT NOT NULL,
    note TEXT,
    created_at INTEGER NOT NULL
  );
`);

// Users / accounts.
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    display_name TEXT NOT NULL,
    password_hash TEXT,
    provider TEXT NOT NULL DEFAULT 'password',
    role TEXT NOT NULL DEFAULT 'user',
    created_at INTEGER NOT NULL
  );
`);
sqlite.exec(`CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users(email);`);

// Add owner_id to charts for pre-existing databases (ignore if present).
try { sqlite.exec(`ALTER TABLE charts ADD COLUMN owner_id INTEGER;`); } catch { /* already exists */ }

// Chart shares.
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS chart_shares (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chart_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );
`);
sqlite.exec(`CREATE UNIQUE INDEX IF NOT EXISTS chart_shares_chart_user_idx ON chart_shares(chart_id, user_id);`);

export const db = drizzle(sqlite);

export interface IStorage {
  // Users
  getUserById(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(u: { email: string; displayName: string; passwordHash: string | null; provider: string; role: string }): Promise<User>;
  upsertGoogleUser(u: { email: string; displayName: string }): Promise<User>;
  setUserRole(id: number, role: string): Promise<void>;
  listUsers(): Promise<User[]>;

  // Charts (owner-scoped)
  listChartsForUser(userId: number): Promise<ChartWithAccess[]>;
  listAllCharts(): Promise<ChartWithAccess[]>;
  createChart(ownerId: number, chart: InsertChart): Promise<Chart>;
  getChart(id: number): Promise<Chart | undefined>;
  canAccessChart(userId: number, chartId: number, isAdmin: boolean): Promise<boolean>;
  updateChart(id: number, patch: Partial<InsertChart>): Promise<Chart | undefined>;
  deleteChart(id: number): Promise<{ changes: number }>;
  migrateOrphanCharts(toUserId: number): Promise<number>;

  // Sharing
  shareChart(chartId: number, recipientUserId: number): Promise<void>;
  unshareChart(chartId: number, recipientUserId: number): Promise<void>;
  listShareRecipients(chartId: number): Promise<ShareRecipient[]>;

  // Incidents
  getIncident(id: number): Promise<Incident | undefined>;
  listIncidents(chartId: number): Promise<Incident[]>;
  createIncident(incident: InsertIncident): Promise<Incident>;
  deleteIncident(id: number): Promise<{ changes: number }>;
}

export class DatabaseStorage implements IStorage {
  // --- Users ---------------------------------------------------------------
  async getUserById(id: number): Promise<User | undefined> {
    return db.select().from(users).where(eq(users.id, id)).get();
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return db.select().from(users).where(eq(users.email, email.toLowerCase())).get();
  }

  async createUser(u: { email: string; displayName: string; passwordHash: string | null; provider: string; role: string }): Promise<User> {
    return db
      .insert(users)
      .values({
        email: u.email.toLowerCase(),
        displayName: u.displayName,
        passwordHash: u.passwordHash,
        provider: u.provider,
        role: u.role,
        createdAt: Date.now(),
      })
      .returning()
      .get();
  }

  // Upsert a Google (Gmail) user. If an account with the same email already
  // exists (e.g. the admin seeded by email, or a prior password signup), we
  // reuse that row and mark it Google-linked instead of creating a duplicate.
  async upsertGoogleUser(u: { email: string; displayName: string }): Promise<User> {
    const email = u.email.toLowerCase();
    const existing = await this.getUserByEmail(email);
    if (existing) {
      // Link the existing account to Google without touching its role.
      db.update(users).set({ provider: "google" }).where(eq(users.id, existing.id)).run();
      return { ...existing, provider: "google" };
    }
    return db
      .insert(users)
      .values({
        email,
        displayName: u.displayName || email,
        passwordHash: null, // Google accounts have no local password
        provider: "google",
        role: "user", // OAuth self-signups are regular users
        createdAt: Date.now(),
      })
      .returning()
      .get();
  }

  async setUserRole(id: number, role: string): Promise<void> {
    db.update(users).set({ role }).where(eq(users.id, id)).run();
  }

  async listUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(desc(users.createdAt)).all();
  }

  // --- Charts (owner-scoped) ----------------------------------------------
  // A user sees: their own charts + charts explicitly shared with them.
  async listChartsForUser(userId: number): Promise<ChartWithAccess[]> {
    const own = db.select().from(charts).where(eq(charts.ownerId, userId))
      .orderBy(desc(charts.createdAt)).all();

    const shareRows = db.select().from(chartShares).where(eq(chartShares.userId, userId)).all();
    const sharedIds = shareRows.map((s) => s.chartId);
    const shared = sharedIds.length
      ? db.select().from(charts).where(inArray(charts.id, sharedIds)).orderBy(desc(charts.createdAt)).all()
      : [];

    // Owner display names for shared charts.
    const ownerIds = Array.from(new Set(shared.map((c) => c.ownerId).filter((x): x is number => x != null)));
    const owners = ownerIds.length ? db.select().from(users).where(inArray(users.id, ownerIds)).all() : [];
    const ownerMap = new Map(owners.map((o) => [o.id, o]));

    const ownOut: ChartWithAccess[] = own.map((c) => ({ ...c, access: "own" as const }));
    const sharedOut: ChartWithAccess[] = shared.map((c) => {
      const o = c.ownerId != null ? ownerMap.get(c.ownerId) : undefined;
      return { ...c, access: "shared" as const, ownerName: o?.displayName ?? null, ownerEmail: o?.email ?? null };
    });
    return [...ownOut, ...sharedOut];
  }

  // Admin: every chart, annotated with owner info.
  async listAllCharts(): Promise<ChartWithAccess[]> {
    const all = db.select().from(charts).orderBy(desc(charts.createdAt)).all();
    const owners = db.select().from(users).all();
    const ownerMap = new Map(owners.map((o) => [o.id, o]));
    return all.map((c) => {
      const o = c.ownerId != null ? ownerMap.get(c.ownerId) : undefined;
      return { ...c, access: "admin" as const, ownerName: o?.displayName ?? null, ownerEmail: o?.email ?? null };
    });
  }

  async getChart(id: number): Promise<Chart | undefined> {
    return db.select().from(charts).where(eq(charts.id, id)).get();
  }

  async canAccessChart(userId: number, chartId: number, isAdmin: boolean): Promise<boolean> {
    if (isAdmin) return true;
    const c = await this.getChart(chartId);
    if (!c) return false;
    if (c.ownerId === userId) return true;
    const share = db.select().from(chartShares)
      .where(and(eq(chartShares.chartId, chartId), eq(chartShares.userId, userId))).get();
    return !!share;
  }

  // Assign every ownerless (legacy) chart to the given user (the admin), so
  // pre-accounts data never leaks and stays visible to the admin.
  async migrateOrphanCharts(toUserId: number): Promise<number> {
    const raw = sqlite.prepare(`UPDATE charts SET owner_id = ? WHERE owner_id IS NULL`).run(toUserId);
    return raw.changes ?? 0;
  }

  // --- Sharing -------------------------------------------------------------
  async shareChart(chartId: number, recipientUserId: number): Promise<void> {
    try {
      db.insert(chartShares).values({ chartId, userId: recipientUserId, createdAt: Date.now() }).run();
    } catch { /* already shared (unique index) */ }
  }

  async unshareChart(chartId: number, recipientUserId: number): Promise<void> {
    db.delete(chartShares)
      .where(and(eq(chartShares.chartId, chartId), eq(chartShares.userId, recipientUserId))).run();
  }

  async listShareRecipients(chartId: number): Promise<ShareRecipient[]> {
    const rows = db.select().from(chartShares).where(eq(chartShares.chartId, chartId)).all();
    const ids = rows.map((r) => r.userId);
    if (!ids.length) return [];
    const us = db.select().from(users).where(inArray(users.id, ids)).all();
    return us.map((u) => ({ userId: u.id, email: u.email, displayName: u.displayName }));
  }

  async createChart(ownerId: number, insert: InsertChart): Promise<Chart> {
    return db
      .insert(charts)
      .values({ ...insert, ownerId, createdAt: Date.now() })
      .returning()
      .get();
  }

  async updateChart(id: number, patch: Partial<InsertChart>): Promise<Chart | undefined> {
    db.update(charts).set(patch).where(eq(charts.id, id)).run();
    return db.select().from(charts).where(eq(charts.id, id)).get();
  }

  async deleteChart(id: number): Promise<{ changes: number }> {
    // Cascade: remove incidents and shares belonging to this chart too.
    db.delete(incidents).where(eq(incidents.chartId, id)).run();
    db.delete(chartShares).where(eq(chartShares.chartId, id)).run();
    return db.delete(charts).where(eq(charts.id, id)).run();
  }

  async getIncident(id: number): Promise<Incident | undefined> {
    return db.select().from(incidents).where(eq(incidents.id, id)).get();
  }

  async listIncidents(chartId: number): Promise<Incident[]> {
    return db.select().from(incidents)
      .where(eq(incidents.chartId, chartId))
      .orderBy(incidents.startDate)
      .all();
  }

  async createIncident(insert: InsertIncident): Promise<Incident> {
    return db
      .insert(incidents)
      .values({ ...insert, createdAt: Date.now() })
      .returning()
      .get();
  }

  async deleteIncident(id: number): Promise<{ changes: number }> {
    return db.delete(incidents).where(eq(incidents.id, id)).run();
  }
}

export const storage = new DatabaseStorage();
