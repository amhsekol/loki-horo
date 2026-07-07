// ---------------------------------------------------------------------------
// Authentication module (abstracted).
//
// This is intentionally the ONLY place that knows how a user proves identity.
// Today it is email + password (scrypt). To add Google (Gmail) OAuth on the
// VPS later, add a passport-google-oauth20 strategy that, on callback, calls
// `storage.upsertGoogleUser(profile)` and then `establishSession(req, user)` —
// nothing else in the app needs to change, because routes only depend on
// `req.session.userId` and the `requireAuth` / `requireAdmin` middleware here.
// ---------------------------------------------------------------------------
import type { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import createMemoryStore from "memorystore";
import SqliteStoreFactory from "better-sqlite3-session-store";
import Database from "better-sqlite3";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { dirname } from "node:path";
import { storage } from "./storage";
import type { PublicUser, User } from "@shared/schema";

const MemoryStore = createMemoryStore(session);
const SqliteStore = SqliteStoreFactory(session);

// The admin account. Seeded on first boot with a default password the user can
// change. Email matches the user's Gmail so Google OAuth maps onto the same row
// on the VPS.
export const ADMIN_EMAIL = "amlokesheit@gmail.com";
// The admin account can see every member's data, so on a real deployment its
// password MUST come from the environment (ADMIN_DEFAULT_PASSWORD) — never rely
// on the prototype fallback below in production. The fallback exists only so the
// hosted pplx.app prototype (where we can't inject env vars) remains usable with
// a known bootstrap password; the admin should change it after first login.
const ADMIN_DEFAULT_PASSWORD =
  process.env.ADMIN_DEFAULT_PASSWORD || "lokihoro-admin";
const ADMIN_DISPLAY_NAME = "Lokesh (Admin)";

// --- Password hashing (scrypt, salt:hash hex) ------------------------------
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored) return false;
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const hashBuf = Buffer.from(hash, "hex");
  const testBuf = scryptSync(password, salt, 64);
  return hashBuf.length === testBuf.length && timingSafeEqual(hashBuf, testBuf);
}

// --- Session shape ---------------------------------------------------------
declare module "express-session" {
  interface SessionData {
    userId?: number;
  }
}

export function toPublicUser(u: User): PublicUser {
  return { id: u.id, email: u.email, displayName: u.displayName, role: u.role, provider: u.provider };
}

export function establishSession(req: Request, user: User) {
  req.session.userId = user.id;
}

// --- Middleware ------------------------------------------------------------
// Loads the current user (if any) onto res.locals for every request.
export async function attachUser(req: Request, res: Response, next: NextFunction) {
  const id = req.session.userId;
  if (id != null) {
    const u = await storage.getUserById(id);
    if (u) res.locals.user = u;
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!res.locals.user) return res.status(401).json({ error: "Not authenticated" });
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const u = res.locals.user as User | undefined;
  if (!u) return res.status(401).json({ error: "Not authenticated" });
  if (u.role !== "admin") return res.status(403).json({ error: "Admin only" });
  next();
}

// --- Setup -----------------------------------------------------------------
export function setupSession(app: Express) {
  app.set("trust proxy", 1);
  const isProd = process.env.NODE_ENV === "production";
  // In production the pplx.app proxy REQUIRES the __Host- prefix (and that
  // prefix requires Secure + Path=/ + no Domain). Over plain-HTTP localhost a
  // __Host-/Secure cookie is silently rejected by browsers, which would break
  // local development and QA — so use a plain name without Secure in dev.
  const cookieName = isProd ? "__Host-lokihoro.sid" : "lokihoro.sid";
  // Session signing secret must come from the environment on a real deployment
  // (SESSION_SECRET) — a secret sitting in source would let anyone forge session
  // cookies. The hosted pplx.app prototype can't inject env vars, so it falls
  // back to a fixed dev/prototype value; this is acceptable for a prototype but
  // MUST be overridden with a real SESSION_SECRET on the VPS.
  const sessionSecret =
    process.env.SESSION_SECRET || "lokihoro-prototype-secret-set-SESSION_SECRET-in-prod";
  if (isProd && !process.env.SESSION_SECRET) {
    // eslint-disable-next-line no-console
    console.warn("[auth] SESSION_SECRET not set — using the prototype fallback. Set SESSION_SECRET in the environment for a real deployment.");
  }
  // Session store: in production, persist sessions in SQLite so logins survive
  // restarts and redeploys (the volume-mounted DB keeps them). In dev, an
  // in-memory store is fine. The sessions DB lives next to the main data.db.
  let store: session.Store;
  if (isProd) {
    const dbPath = process.env.DB_PATH || "data.db";
    const sessionsDbPath = `${dirname(dbPath)}/sessions.db`;
    const sessionsDb = new Database(sessionsDbPath);
    sessionsDb.pragma("journal_mode = WAL");
    store = new SqliteStore({
      client: sessionsDb,
      expired: { clear: true, intervalMs: 24 * 60 * 60 * 1000 },
    });
  } else {
    store = new MemoryStore({ checkPeriod: 24 * 60 * 60 * 1000 });
  }

  app.use(
    session({
      name: cookieName,
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      store,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        // __Host- requires secure + path=/ and no Domain attribute.
        secure: isProd,
        path: "/",
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      },
    }),
  );
}

// --- Google OAuth (VPS) ----------------------------------------------------
// Enabled only when GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are set in the
// environment. Safe to leave unset on the prototype — the app then simply
// doesn't expose the Google routes and email+password keeps working.
export function googleOAuthEnabled(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export async function setupGoogleOAuth(app: Express) {
  if (!googleOAuthEnabled()) {
    // eslint-disable-next-line no-console
    console.log("[auth] Google OAuth disabled (set GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET to enable).");
    return;
  }
  // Dynamic imports so the app runs even if these aren't installed in a minimal build.
  const passport = (await import("passport")).default;
  const { Strategy: GoogleStrategy } = await import("passport-google-oauth20");

  // PUBLIC_URL is the externally-reachable base, e.g. https://lokihoro.yourdomain.com
  const publicUrl = (process.env.PUBLIC_URL || "").replace(/\/$/, "");
  const callbackURL = `${publicUrl}/api/auth/google/callback`;

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        callbackURL,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) return done(new Error("Google account has no email"));
          const displayName = profile.displayName || email;
          const user = await storage.upsertGoogleUser({ email, displayName });
          done(null, user);
        } catch (e) {
          done(e as Error);
        }
      },
    ),
  );

  app.use(passport.initialize());

  // Kick off the OAuth dance.
  app.get(
    "/api/auth/google",
    passport.authenticate("google", { scope: ["profile", "email"], session: false }),
  );

  // Google redirects back here. On success we set our own session cookie
  // (the same one email+password uses) and bounce to the app.
  app.get(
    "/api/auth/google/callback",
    passport.authenticate("google", { session: false, failureRedirect: "/#/auth?error=google" }),
    (req: Request, res: Response) => {
      const user = req.user as User | undefined;
      if (user) establishSession(req, user);
      res.redirect("/#/");
    },
  );

  // eslint-disable-next-line no-console
  console.log(`[auth] Google OAuth enabled — callback ${callbackURL}`);
}

// Seed the admin account once, then adopt any ownerless (legacy) charts so
// pre-accounts data never leaks and stays visible to the admin. Idempotent.
export async function seedAdmin() {
  let admin = await storage.getUserByEmail(ADMIN_EMAIL);
  if (admin) {
    if (admin.role !== "admin") await storage.setUserRole(admin.id, "admin");
  } else {
    admin = await storage.createUser({
      email: ADMIN_EMAIL,
      displayName: ADMIN_DISPLAY_NAME,
      passwordHash: hashPassword(ADMIN_DEFAULT_PASSWORD),
      provider: "password",
      role: "admin",
    });
    // eslint-disable-next-line no-console
    console.log(`[auth] Seeded admin ${ADMIN_EMAIL} (default password: ${ADMIN_DEFAULT_PASSWORD})`);
  }
  const adopted = await storage.migrateOrphanCharts(admin.id);
  if (adopted > 0) console.log(`[auth] Adopted ${adopted} legacy chart(s) to admin`);
}
