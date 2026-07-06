import { charts } from "@shared/schema";
import type { Chart, InsertChart } from "@shared/schema";
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
    created_at INTEGER NOT NULL
  );
`);

export const db = drizzle(sqlite);

export interface IStorage {
  listCharts(): Promise<Chart[]>;
  createChart(chart: InsertChart): Promise<Chart>;
  deleteChart(id: number): Promise<{ changes: number }>;
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

  async deleteChart(id: number): Promise<{ changes: number }> {
    return db.delete(charts).where(eq(charts.id, id)).run();
  }
}

export const storage = new DatabaseStorage();
