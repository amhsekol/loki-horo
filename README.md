# LOKI HORO

Trilingual (Tamil / English / Hindi) Vedic astrology app — Jathagam (birth
chart), Kocharam (transits), Ashtakavarga, KN Rao Rise/Surprise/Fall analysis,
and Guruji rules, with per-user accounts and chart sharing.

**Stack:** Express 5 · Vite 7 · React 18 · Tailwind v3 · shadcn/ui · Drizzle ORM
+ better-sqlite3.

---

## Local development

```bash
npm install
npm run dev        # http://localhost:5000 (client + API on one port)
```

Admin account is seeded on first boot: `amlokesheit@gmail.com`. Set
`ADMIN_DEFAULT_PASSWORD` in your environment or it falls back to a dev default.

## Production build

```bash
npm run build      # Vite client bundle + esbuild server -> dist/index.cjs
npm start          # NODE_ENV=production node dist/index.cjs
```

---

## Deploy to Hostinger VPS (Docker + HTTPS)

Full step-by-step: see **[DEPLOY.md](./DEPLOY.md)**.

Quick version, once set up on the VPS:

```bash
# first time
git clone https://github.com/amhsekol/loki-horo.git lokihoro && cd lokihoro
cp .env.example .env      # fill in SESSION_SECRET, ADMIN_DEFAULT_PASSWORD, PUBLIC_URL
docker compose up -d --build

# every update after that
git pull && docker compose up -d --build
```

Live target: **https://predict.lokeshmani.com** (Nginx reverse proxy + Let's Encrypt).

### Configuration (`.env`)

| Variable                 | Purpose                                              |
| ------------------------ | ---------------------------------------------------- |
| `PUBLIC_URL`             | External base URL (for the OAuth callback)           |
| `SESSION_SECRET`         | Signs session cookies (`openssl rand -hex 32`)       |
| `ADMIN_DEFAULT_PASSWORD` | Bootstrap admin password (change in-app after login) |
| `DB_PATH`                | SQLite location (defaults to `/data/data.db`)        |
| `GOOGLE_CLIENT_ID/SECRET`| Optional — enables "Continue with Google" sign-in    |

Secrets live only in `.env` (git-ignored). Data (members + saved horoscopes)
persists in the Docker volume `lokihoro_data` across rebuilds.

---

## Auth model

- Open self-signup via email/password **and** Google OAuth (when configured).
- New signups are regular users — they see and manage **only their own** charts.
- The admin (`amlokesheit@gmail.com`) sees all members and all horoscopes.
