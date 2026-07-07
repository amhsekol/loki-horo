import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Users / accounts.
// Keyed by email so a Google (Gmail) OAuth identity maps 1:1 onto the same row
// when auth is upgraded on the VPS. `provider` records how the account signs in
// ("password" now; "google" later). `passwordHash` is scrypt (salt:hash) and is
// null for OAuth-only accounts.
// ---------------------------------------------------------------------------
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash"),
  provider: text("provider").notNull().default("password"), // "password" | "google"
  role: text("role").notNull().default("user"),             // "user" | "admin"
  createdAt: integer("created_at").notNull(),
}, (t) => ({
  emailIdx: uniqueIndex("users_email_idx").on(t.email),
}));

export const registerSchema = z.object({
  email: z.string().email().max(200),
  displayName: z.string().trim().min(1).max(80),
  password: z.string().min(6).max(200),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(1).max(200),
});
export type LoginInput = z.infer<typeof loginSchema>;

export type User = typeof users.$inferSelect;
// User object safe to send to the client (never expose passwordHash).
export type PublicUser = Pick<User, "id" | "email" | "displayName" | "role" | "provider">;

// Saved birth charts (jathagam)
export const charts = sqliteTable("charts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ownerId: integer("owner_id"), // FK -> users.id; null only for legacy rows pre-migration
  name: text("name").notNull(),
  date: text("date").notNull(), // YYYY-MM-DD (local birth date)
  time: text("time").notNull(), // HH:MM (24h local birth time)
  placeName: text("place_name").notNull(),
  latitude: text("latitude").notNull(),
  longitude: text("longitude").notNull(),
  tzOffset: text("tz_offset").notNull(), // hours offset from UTC, e.g. "5.5"
  // Computed values (stored so saved charts can be filtered without recomputing)
  lagnaIndex: integer("lagna_index"),      // 0..11 sign index of the ascendant
  rasiIndex: integer("rasi_index"),        // 0..11 Moon-sign (Janma Rasi)
  nakshatraIndex: integer("nakshatra_index"), // 0..26 birth star (Janma Nakshatra)
  createdAt: integer("created_at").notNull(),
});

// ownerId is assigned server-side from the session, never trusted from the client.
export const insertChartSchema = createInsertSchema(charts).omit({
  id: true,
  ownerId: true,
  createdAt: true,
});

export type InsertChart = z.infer<typeof insertChartSchema>;
export type Chart = typeof charts.$inferSelect;

// A chart the current user can see, annotated with ownership/share context so
// the UI can label "shared with you" / "owned by X" (admin view).
export type ChartWithAccess = Chart & {
  ownerName?: string | null;
  ownerEmail?: string | null;
  access: "own" | "shared" | "admin";
};

// ---------------------------------------------------------------------------
// Chart shares: owner grants view access of one chart to another user.
// ---------------------------------------------------------------------------
export const chartShares = sqliteTable("chart_shares", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  chartId: integer("chart_id").notNull(),
  userId: integer("user_id").notNull(), // recipient
  createdAt: integer("created_at").notNull(),
}, (t) => ({
  uniq: uniqueIndex("chart_shares_chart_user_idx").on(t.chartId, t.userId),
}));

export const shareChartSchema = z.object({
  email: z.string().email().max(200), // recipient's email
});
export type ShareChartInput = z.infer<typeof shareChartSchema>;

export type ChartShare = typeof chartShares.$inferSelect;
export type ShareRecipient = { userId: number; email: string; displayName: string };

// Life incidents/events recorded against a specific chart (jathagam).
export const incidents = sqliteTable("incidents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  chartId: integer("chart_id").notNull(),
  name: text("name").notNull(),
  startDate: text("start_date").notNull(), // YYYY-MM-DD
  endDate: text("end_date").notNull(),     // YYYY-MM-DD (== startDate when single day)
  singleDay: integer("single_day").notNull(), // 1 = one-day event, 0 = range
  kind: text("kind").notNull(),            // "good" | "bad"
  note: text("note"),                      // optional free text
  createdAt: integer("created_at").notNull(),
});

export const insertIncidentSchema = createInsertSchema(incidents)
  .omit({ id: true, createdAt: true })
  .extend({
    kind: z.enum(["good", "bad"]),
    singleDay: z.union([z.literal(0), z.literal(1)]),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    note: z.string().nullish(),
  });

export type InsertIncident = z.infer<typeof insertIncidentSchema>;
export type Incident = typeof incidents.$inferSelect;

// Request schema for chart computation
export const computeChartSchema = z.object({
  name: z.string().default(""),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  tzOffset: z.number().min(-14).max(14),
});
export type ComputeChartInput = z.infer<typeof computeChartSchema>;

// Request schema for panchangam
export const panchangamSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  tzOffset: z.number().min(-14).max(14),
});
export type PanchangamInput = z.infer<typeof panchangamSchema>;
