import { charts, incidents } from "@shared/schema";
import type { Chart, InsertChart, Incident, InsertIncident } from "@shared/schema";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, desc } from "drizzle-orm";

const sqlite = new Database("data.db");
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

export const db = drizzle(sqlite);

export interface IStorage {
  listCharts(): Promise<Chart[]>;
  createChart(chart: InsertChart): Promise<Chart>;
  updateChart(id: number, patch: Partial<InsertChart>): Promise<Chart | undefined>;
  deleteChart(id: number): Promise<{ changes: number }>;
  listIncidents(chartId: number): Promise<Incident[]>;
  createIncident(incident: InsertIncident): Promise<Incident>;
  deleteIncident(id: number): Promise<{ changes: number }>;
}

export class DatabaseStorage implements IStorage {
  async listCharts(): Promise<Chart[]> {
    return db.select().from(charts).orderBy(desc(charts.createdAt)).all();
  }

  async createChart(insert: InsertChart): Promise<Chart> {
    return db
      .insert(charts)
      .values({ ...insert, createdAt: Date.now() })
      .returning()
      .get();
  }

  async updateChart(id: number, patch: Partial<InsertChart>): Promise<Chart | undefined> {
    db.update(charts).set(patch).where(eq(charts.id, id)).run();
    return db.select().from(charts).where(eq(charts.id, id)).get();
  }

  async deleteChart(id: number): Promise<{ changes: number }> {
    // Cascade: remove incidents belonging to this chart too.
    db.delete(incidents).where(eq(incidents.chartId, id)).run();
    return db.delete(charts).where(eq(charts.id, id)).run();
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
