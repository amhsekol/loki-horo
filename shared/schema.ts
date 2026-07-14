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

// ---------------------------------------------------------------------------
// Period outcomes: the "confirm what happened" feedback loop. For a PAST dasha
// period the user records what actually occurred and rates how well the
// prediction matched. This lets the app backtest its calls over time.
// ---------------------------------------------------------------------------
export const periodOutcomes = sqliteTable("period_outcomes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  chartId: integer("chart_id").notNull(),
  // Period identity (matches a TimelinePeriod from the engine).
  periodKey: text("period_key").notNull(), // stable id = `${level}:${start}:${end}`
  level: text("level").notNull(),          // "bhukti" | "antara"
  lordLabel: text("lord_label").notNull(), // e.g. "Rahu / Budha" (period label, en)
  periodStart: text("period_start").notNull(), // YYYY-MM-DD
  periodEnd: text("period_end").notNull(),     // YYYY-MM-DD
  // What the engine predicted (snapshot, so backtests stay meaningful even if
  // the engine logic later changes).
  predictedBand: text("predicted_band"),   // ProbBand at time of logging
  predictedPercent: integer("predicted_percent"),
  // The user's report.
  rating: text("rating").notNull(),        // "matched" | "partial" | "missed"
  actualOutcome: text("actual_outcome").notNull(), // free text of what happened
  notedAt: integer("noted_at").notNull(),
}, (t) => ({
  uniq: uniqueIndex("period_outcomes_chart_period_idx").on(t.chartId, t.periodKey),
}));

export const insertPeriodOutcomeSchema = createInsertSchema(periodOutcomes)
  .omit({ id: true, notedAt: true })
  .extend({
    level: z.enum(["bhukti", "antara"]),
    rating: z.enum(["matched", "partial", "missed"]),
    actualOutcome: z.string().min(1).max(2000),
    periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    predictedBand: z.string().nullish(),
    predictedPercent: z.number().int().nullish(),
  });

export type InsertPeriodOutcome = z.infer<typeof insertPeriodOutcomeSchema>;
export type PeriodOutcome = typeof periodOutcomes.$inferSelect;

// ---------------------------------------------------------------------------
// Astrology rules library. Reference principles from named astrologer systems
// (currently Aditya Guruji's Tamil framework). Auto-seeded on startup from a
// bundled dataset, then queryable/filterable in the Rules Database tab and
// auto-matched against a chart in the Aditya Guruji tab.
// `planets`/`houses` are JSON-encoded int arrays (SQLite has no array type).
// ---------------------------------------------------------------------------
export const rules = sqliteTable("rules", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ruleNo: integer("rule_no").notNull(),          // original number within the astrologer's book
  astrologer: text("astrologer").notNull(),      // "aditya_guruji" (extensible)
  categoryKey: text("category_key").notNull(),   // "pathaka" | "longevity" | ...
  categoryEn: text("category_en").notNull(),
  categoryTa: text("category_ta").notNull(),
  titleEn: text("title_en").notNull(),
  titleTa: text("title_ta").notNull(),
  titleHi: text("title_hi").notNull(),
  bodyEn: text("body_en").notNull(),
  bodyTa: text("body_ta").notNull(),
  bodyHi: text("body_hi").notNull(),
  planets: text("planets").notNull().default("[]"), // JSON int[] (0=Sun..8=Ketu)
  houses: text("houses").notNull().default("[]"),   // JSON int[] (1..12)
}, (t) => ({
  uniq: uniqueIndex("rules_astrologer_no_idx").on(t.astrologer, t.ruleNo),
}));

export type RuleRow = typeof rules.$inferSelect;

// Client-facing rule with parsed tag arrays.
export type Rule = Omit<RuleRow, "planets" | "houses"> & {
  planets: number[];
  houses: number[];
};

// ---------------------------------------------------------------------------
// Deep readings — LLM-generated Guruji-style prose, cached per chart.
// The deterministic composer output is always regenerated on read (cheap);
// the LLM prose is expensive so we store it and never re-generate for the
// same chart+version without an explicit refresh.
// ---------------------------------------------------------------------------
export const deepReadings = sqliteTable("deep_readings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  chartId: integer("chart_id").notNull(),        // FK -> charts.id
  requestedBy: integer("requested_by").notNull(),  // FK -> users.id
  composerVersion: text("composer_version").notNull(), // e.g. "1.0.0"
  model: text("model").notNull(),                // e.g. "sonar-reasoning-pro"
  status: text("status").notNull(),               // "pending" | "streaming" | "complete" | "failed"
  proseMarkdown: text("prose_markdown"),          // final assembled Markdown
  structuredJson: text("structured_json"),        // composer output (JSON)
  sectionsCompleted: integer("sections_completed").notNull().default(0),
  sectionsTotal: integer("sections_total").notNull().default(0),
  errorMessage: text("error_message"),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  costUsdMicros: integer("cost_usd_micros").notNull().default(0), // 1_000_000 = $1.00
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export type DeepReading = typeof deepReadings.$inferSelect;

// Rolling monthly cost budget for the Perplexity API. One row per YYYY-MM key.
export const apiBudget = sqliteTable("api_budget", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  monthKey: text("month_key").notNull(),         // "2026-07"
  spentUsdMicros: integer("spent_usd_micros").notNull().default(0),
  budgetUsdMicros: integer("budget_usd_micros").notNull().default(5_000_000), // $5 default
  updatedAt: integer("updated_at").notNull(),
}, (t) => ({
  monthIdx: uniqueIndex("api_budget_month_idx").on(t.monthKey),
}));

export type ApiBudget = typeof apiBudget.$inferSelect;

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
