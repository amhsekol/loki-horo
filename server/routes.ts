import type { Express } from "express";
import type { Server } from "node:http";
import { storage } from "./storage";
import { computeChart, computePanchangam } from "@shared/astro/engine";
import { computeChartSchema, panchangamSchema, insertChartSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Compute a birth chart (jathagam) — sidereal, Lahiri ayanamsa.
  app.post("/api/chart", async (req, res) => {
    const parsed = computeChartSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    try {
      const result = computeChart(parsed.data);
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e?.message ?? "Calculation failed" });
    }
  });

  // Compute daily panchangam.
  app.post("/api/panchangam", async (req, res) => {
    const parsed = panchangamSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    try {
      const result = computePanchangam(parsed.data);
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e?.message ?? "Calculation failed" });
    }
  });

  // Saved charts CRUD
  app.get("/api/charts", async (_req, res) => {
    res.json(await storage.listCharts());
  });

  app.post("/api/charts", async (req, res) => {
    const parsed = insertChartSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    res.json(await storage.createChart(parsed.data));
  });

  app.delete("/api/charts/:id", async (req, res) => {
    const id = z.coerce.number().parse(req.params.id);
    res.json(await storage.deleteChart(id));
  });

  // Geocoding proxy (Open-Meteo — free, no key). Returns city matches with lat/lon/timezone.
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
