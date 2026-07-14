import type { Express, Request, Response } from "express";
import type { Server } from "node:http";
import { storage } from "./storage";
import { computeChart, computePanchangam } from "@shared/astro/engine";
import {
  computeChartSchema, panchangamSchema, insertChartSchema, insertIncidentSchema,
  registerSchema, loginSchema, shareChartSchema, insertPeriodOutcomeSchema,
} from "@shared/schema";
import type { User } from "@shared/schema";
import {
  requireAuth, requireAdmin, hashPassword, verifyPassword,
  establishSession, toPublicUser, googleOAuthEnabled,
} from "./auth";
import { z } from "zod";

function currentUser(res: Response): User {
  return res.locals.user as User;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // ==========================================================================
  // Auth
  // ==========================================================================
  app.post("/api/auth/register", async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const { email, displayName, password } = parsed.data;
    const existing = await storage.getUserByEmail(email);
    if (existing) return res.status(409).json({ error: "An account with this email already exists." });
    const user = await storage.createUser({
      email,
      displayName,
      passwordHash: hashPassword(password),
      provider: "password",
      role: "user", // self-signup accounts are always regular users
    });
    await establishSession(req, user);
    res.json(toPublicUser(user));
  });

  app.post("/api/auth/login", async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const { email, password } = parsed.data;
    const user = await storage.getUserByEmail(email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ error: "Invalid email or password." });
    }
    await establishSession(req, user);
    res.json(toPublicUser(user));
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
  });

  // Who am I — returns null (200) when logged out so the client can branch.
  app.get("/api/auth/me", (_req, res) => {
    const u = res.locals.user as User | undefined;
    res.json(u ? toPublicUser(u) : null);
  });

  // Public auth config — lets the client know whether to show "Sign in with
  // Google" (only enabled on the VPS when Google creds are set).
  app.get("/api/auth/config", (_req, res) => {
    res.json({ googleEnabled: googleOAuthEnabled() });
  });

  // ==========================================================================
  // Chart computation (open — no persistence, safe for anyone)
  // ==========================================================================
  app.post("/api/chart", async (req, res) => {
    const parsed = computeChartSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    try {
      res.json(computeChart(parsed.data));
    } catch (e: any) {
      res.status(500).json({ error: e?.message ?? "Calculation failed" });
    }
  });

  app.post("/api/panchangam", async (req, res) => {
    const parsed = panchangamSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    try {
      res.json(computePanchangam(parsed.data));
    } catch (e: any) {
      res.status(500).json({ error: e?.message ?? "Calculation failed" });
    }
  });

  // Astrology rules library (reference data — public, no auth). Optional
  // filters: ?astrologer=, ?category=, ?planet=<0-8>, ?house=<1-12>, ?q=<text>.
  app.get("/api/rules", async (req, res) => {
    try {
      let list = await storage.listRules();
      const { astrologer, category, planet, house, q } = req.query as Record<string, string>;
      if (astrologer) list = list.filter((r) => r.astrologer === astrologer);
      if (category) list = list.filter((r) => r.categoryKey === category);
      if (planet !== undefined && planet !== "") {
        const p = Number(planet);
        if (Number.isFinite(p)) list = list.filter((r) => r.planets.includes(p));
      }
      if (house !== undefined && house !== "") {
        const h = Number(house);
        if (Number.isFinite(h)) list = list.filter((r) => r.houses.includes(h));
      }
      if (q && q.trim()) {
        const needle = q.trim().toLowerCase();
        list = list.filter((r) =>
          [r.titleEn, r.titleTa, r.titleHi, r.bodyEn, r.bodyTa, r.bodyHi]
            .some((f) => (f || "").toLowerCase().includes(needle)));
      }
      res.json(list);
    } catch (e: any) {
      res.status(500).json({ error: e?.message ?? "Failed to load rules" });
    }
  });

  // ==========================================================================
  // Saved charts (owner-scoped). Admin sees all; users see own + shared.
  // ==========================================================================
  app.get("/api/charts", requireAuth, async (_req, res) => {
    const u = currentUser(res);
    const list = u.role === "admin"
      ? await storage.listAllCharts()
      : await storage.listChartsForUser(u.id);
    res.json(list);
  });

  app.post("/api/charts", requireAuth, async (req, res) => {
    const parsed = insertChartSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const u = currentUser(res);
    res.json(await storage.createChart(u.id, parsed.data));
  });

  app.patch("/api/charts/:id", requireAuth, async (req, res) => {
    const id = z.coerce.number().parse(req.params.id);
    const u = currentUser(res);
    // Only the owner (or admin) may modify a chart.
    const chart = await storage.getChart(id);
    if (!chart) return res.status(404).json({ error: "Chart not found" });
    if (u.role !== "admin" && chart.ownerId !== u.id) {
      return res.status(403).json({ error: "You can only edit your own charts." });
    }
    const parsed = insertChartSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    res.json(await storage.updateChart(id, parsed.data));
  });

  app.delete("/api/charts/:id", requireAuth, async (req, res) => {
    const id = z.coerce.number().parse(req.params.id);
    const u = currentUser(res);
    const chart = await storage.getChart(id);
    if (!chart) return res.status(404).json({ error: "Chart not found" });
    if (u.role !== "admin" && chart.ownerId !== u.id) {
      return res.status(403).json({ error: "You can only delete your own charts." });
    }
    res.json(await storage.deleteChart(id));
  });

  // --- Sharing --------------------------------------------------------------
  // List who a chart is shared with (owner or admin only).
  app.get("/api/charts/:id/shares", requireAuth, async (req, res) => {
    const id = z.coerce.number().parse(req.params.id);
    const u = currentUser(res);
    const chart = await storage.getChart(id);
    if (!chart) return res.status(404).json({ error: "Chart not found" });
    if (u.role !== "admin" && chart.ownerId !== u.id) {
      return res.status(403).json({ error: "Only the chart owner can manage sharing." });
    }
    res.json(await storage.listShareRecipients(id));
  });

  // Share a chart with another user by email (owner or admin only).
  app.post("/api/charts/:id/shares", requireAuth, async (req, res) => {
    const id = z.coerce.number().parse(req.params.id);
    const u = currentUser(res);
    const chart = await storage.getChart(id);
    if (!chart) return res.status(404).json({ error: "Chart not found" });
    if (u.role !== "admin" && chart.ownerId !== u.id) {
      return res.status(403).json({ error: "Only the chart owner can share it." });
    }
    const parsed = shareChartSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const recipient = await storage.getUserByEmail(parsed.data.email);
    if (!recipient) return res.status(404).json({ error: "No user with that email. Ask them to sign up first." });
    if (recipient.id === chart.ownerId) return res.status(400).json({ error: "That user already owns this chart." });
    await storage.shareChart(id, recipient.id);
    res.json(await storage.listShareRecipients(id));
  });

  // Revoke a share (owner or admin only).
  app.delete("/api/charts/:id/shares/:userId", requireAuth, async (req, res) => {
    const id = z.coerce.number().parse(req.params.id);
    const recipientId = z.coerce.number().parse(req.params.userId);
    const u = currentUser(res);
    const chart = await storage.getChart(id);
    if (!chart) return res.status(404).json({ error: "Chart not found" });
    if (u.role !== "admin" && chart.ownerId !== u.id) {
      return res.status(403).json({ error: "Only the chart owner can manage sharing." });
    }
    await storage.unshareChart(id, recipientId);
    res.json(await storage.listShareRecipients(id));
  });

  // ==========================================================================
  // Admin
  // ==========================================================================
  app.get("/api/admin/users", requireAdmin, async (_req, res) => {
    const users = await storage.listUsers();
    // Attach a saved-chart count per member for the admin members view.
    const all = await storage.listAllCharts();
    const counts = new Map<number, number>();
    for (const c of all) if (c.ownerId != null) counts.set(c.ownerId, (counts.get(c.ownerId) ?? 0) + 1);
    res.json(users.map((u) => ({
      id: u.id, email: u.email, displayName: u.displayName, role: u.role,
      provider: u.provider, createdAt: u.createdAt, chartCount: counts.get(u.id) ?? 0,
    })));
  });

  // ==========================================================================
  // Incidents (life events) — scoped to charts the user can access.
  // ==========================================================================
  app.get("/api/charts/:chartId/incidents", requireAuth, async (req, res) => {
    const chartId = z.coerce.number().parse(req.params.chartId);
    const u = currentUser(res);
    if (!(await storage.canAccessChart(u.id, chartId, u.role === "admin"))) {
      return res.status(403).json({ error: "No access to this chart." });
    }
    res.json(await storage.listIncidents(chartId));
  });

  app.post("/api/incidents", requireAuth, async (req, res) => {
    const parsed = insertIncidentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const u = currentUser(res);
    if (!(await storage.canAccessChart(u.id, parsed.data.chartId, u.role === "admin"))) {
      return res.status(403).json({ error: "No access to this chart." });
    }
    res.json(await storage.createIncident(parsed.data));
  });

  app.delete("/api/incidents/:id", requireAuth, async (req, res) => {
    const id = z.coerce.number().parse(req.params.id);
    const u = currentUser(res);
    const incident = await storage.getIncident(id);
    if (!incident) return res.status(404).json({ error: "Incident not found" });
    if (!(await storage.canAccessChart(u.id, incident.chartId, u.role === "admin"))) {
      return res.status(403).json({ error: "No access to this chart." });
    }
    res.json(await storage.deleteIncident(id));
  });

  // ==========================================================================
  // Period outcomes ("confirm what happened" feedback loop) — chart-scoped.
  // ==========================================================================
  app.get("/api/charts/:chartId/outcomes", requireAuth, async (req, res) => {
    const chartId = z.coerce.number().parse(req.params.chartId);
    const u = currentUser(res);
    if (!(await storage.canAccessChart(u.id, chartId, u.role === "admin"))) {
      return res.status(403).json({ error: "No access to this chart." });
    }
    res.json(await storage.listPeriodOutcomes(chartId));
  });

  // Upsert (create or edit) the recorded outcome for one past period.
  app.post("/api/outcomes", requireAuth, async (req, res) => {
    const parsed = insertPeriodOutcomeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const u = currentUser(res);
    if (!(await storage.canAccessChart(u.id, parsed.data.chartId, u.role === "admin"))) {
      return res.status(403).json({ error: "No access to this chart." });
    }
    res.json(await storage.upsertPeriodOutcome(parsed.data));
  });

  app.delete("/api/charts/:chartId/outcomes/:periodKey", requireAuth, async (req, res) => {
    const chartId = z.coerce.number().parse(req.params.chartId);
    const periodKey = String(req.params.periodKey);
    const u = currentUser(res);
    if (!(await storage.canAccessChart(u.id, chartId, u.role === "admin"))) {
      return res.status(403).json({ error: "No access to this chart." });
    }
    res.json(await storage.deletePeriodOutcome(chartId, periodKey));
  });

  // ==========================================================================
  // Deep Reading (admin-only) — Perplexity Sonar-generated Guruji prose.
  // ==========================================================================
  app.post("/api/deep-reading/:chartId", requireAdmin, async (req, res) => {
    try {
      const { runDeepReading } = await import("./deep-reading");
      const chartId = Number(req.params.chartId);
      if (!Number.isFinite(chartId)) return res.status(400).json({ error: "Invalid chartId" });
      const u = currentUser(res);
      const force = req.body?.force === true;
      const result = await runDeepReading({ chartId, requestedBy: u.id, force });
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e?.message ?? "Deep reading failed" });
    }
  });

  app.get("/api/deep-reading/:chartId", requireAdmin, async (req, res) => {
    try {
      const { getDeepReading } = await import("./deep-reading");
      const chartId = Number(req.params.chartId);
      if (!Number.isFinite(chartId)) return res.status(400).json({ error: "Invalid chartId" });
      const doc = await getDeepReading(chartId);
      if (!doc) return res.status(404).json({ error: "No reading generated yet" });
      res.json(doc);
    } catch (e: any) {
      res.status(500).json({ error: e?.message ?? "Failed to load deep reading" });
    }
  });

  app.get("/api/admin/budget", requireAdmin, async (_req, res) => {
    try {
      const { getCurrentBudget } = await import("./deep-reading");
      res.json(await getCurrentBudget());
    } catch (e: any) {
      res.status(500).json({ error: e?.message ?? "Failed to load budget" });
    }
  });

  // ==========================================================================
  // Geocoding proxy (Open-Meteo — free, no key).
  // ==========================================================================
  app.get("/api/geocode", async (req, res) => {
    const q = String(req.query.q ?? "").trim();
    if (q.length < 2) return res.json({ results: [] });
    try {
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=8&language=en&format=json`;
      const r = await fetch(url);
      const data: any = await r.json();
      const results = (data.results ?? []).map((x: any) => ({
        name: x.name,
        admin1: x.admin1 ?? "",
        country: x.country ?? "",
        latitude: x.latitude,
        longitude: x.longitude,
        timezone: x.timezone ?? "",
      }));
      res.json({ results });
    } catch (e: any) {
      res.status(500).json({ error: e?.message ?? "Geocoding failed", results: [] });
    }
  });

  return httpServer;
}
