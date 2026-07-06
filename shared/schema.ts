import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Saved birth charts (jathagam)
export const charts = sqliteTable("charts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
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

export const insertChartSchema = createInsertSchema(charts).omit({
  id: true,
  createdAt: true,
});

export type InsertChart = z.infer<typeof insertChartSchema>;
export type Chart = typeof charts.$inferSelect;

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
