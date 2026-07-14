# VPS Deploy Checklist — Deep Reading Feature

**Target host:** Hostinger VPS behind Traefik, `predict.lokeshmani.com`
**Repo:** `git@github.com:amhsekol/loki-horo.git`  (branch: `master`)
**App path on VPS:** wherever you currently pull to (same as previous deploys)

Follow these steps in order. The agent never SSHes — you drive each command.

---

## 1. Pull the latest master

```bash
cd /path/to/loki-horo   # your existing checkout
git fetch origin
git status              # should be clean; stash anything local
git pull origin master
```

Verify the new files landed:

```bash
ls -1 shared/astro/composer.ts \
       shared/astro/rule-loader.ts \
       shared/astro/rule-matcher.ts \
       shared/astro/chart-facts-adapter.ts \
       shared/astro/rules.bundled.json \
       server/perplexity.ts \
       server/deep-reading.ts \
       client/src/components/DeepReadingPanel.tsx \
       DEPLOY_VPS_CHECKLIST.md
```

All eight paths should print without error. `rules.bundled.json` is ~2.3 MB and contains all 2,298 rules — **it is committed on purpose**, do not regenerate on the VPS.

---

## 2. Set the Perplexity API key

Open your existing env file (whatever loads into the container/process):

```bash
sudo nano /etc/tamil-astro.env          # or wherever your existing PERPLEXITY-free env lives
```

Add this line (paste your **personal Perplexity Pro** API key):

```
PERPLEXITY_API_KEY=pplx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Save + close. **If `PERPLEXITY_API_KEY` is unset, the site keeps working** — the deep-reading feature falls back to a templated Markdown rendering (rule points listed, no prose). The API key only unlocks Guruji-style prose generation.

You can grab the key here: <https://www.perplexity.ai/settings/api>

Optional — override the monthly budget (default is $5.00 = 5,000,000 micros):
```
# nothing to set for now; the code defaults to $5/month in server/deep-reading.ts.
# If you want to change the ceiling later, edit MONTHLY_BUDGET_USD_MICROS there.
```

---

## 3. Install / build

Same as your existing deploy flow:

```bash
npm ci --omit=dev
npm run build
```

The build takes ~5-8 seconds and produces:
- `dist/public/` — static frontend
- `dist/index.cjs` — bundled Node server (~4.6 MB, includes the 2,298-rule bundle)

The build does **not** touch `rules.bundled.json` on the VPS — it consumes the version you pulled from git.

---

## 4. Restart the service

Whatever you did before to restart (Docker Compose / systemd / PM2 / etc.):

```bash
# example — replace with your actual restart command
sudo systemctl restart tamil-astro
# or
docker compose restart tamil-astro
```

Confirm the service is up:

```bash
curl -sSf https://predict.lokeshmani.com/api/health || echo "DOWN"
```

---

## 5. Smoke-test the Deep Reading feature

1. **Log in** at <https://predict.lokeshmani.com> as your admin account (the one whose `role = 'admin'` in `data.db`).
2. **Open your chart** (or Swetha's).
3. Click **Guruji Assessment** tab.
4. At the top you should see a **"Full Guruji Reading (Admin)"** panel with a **Generate** button.
   - Only accounts with `role='admin'` see this panel. Regular users see the tab exactly as before.
5. Click **Generate**. Expect:
   - Progress bar streaming through ~9 sections (executive summary + 8 topic sections)
   - ~2-3 minutes total for a full chart
   - Cost per full reading: **$0.05 – $0.15** (well inside the $5 monthly cap)
6. When it finishes, click **View reading** to expand the prose. **Download** saves a `.md` file.

If you re-open the tab, the cached reading loads instantly (no re-billing). Click **Regenerate** to force a fresh call.

**Budget indicator** appears under the panel: `Budget · $0.05 / $5.00 used · $4.95 remaining`.

---

## 6. Troubleshooting

**Panel doesn't appear** → Your session's `role` isn't `admin`. Fix with:
```sql
sqlite3 /path/to/data.db "UPDATE users SET role='admin' WHERE email='<your-email>';"
```

**"Perplexity API error (401)"** → API key is missing/wrong. Re-check `PERPLEXITY_API_KEY` in the env file and restart.

**"Perplexity API error (429)"** → You hit Perplexity's own rate limit or exhausted their monthly $5 credit. Wait, or top up at <https://www.perplexity.ai/settings/api>.

**"Monthly Perplexity budget exceeded"** → Our in-app cap (default $5/month). Edit `MONTHLY_BUDGET_USD_MICROS` in `server/deep-reading.ts` and rebuild.

**Reading finishes but the prose is off / too optimistic / missing gentle-tone wrappers** → Two levers:
- Edit `GURUJI_SYSTEM_PROMPT` in `server/perplexity.ts` (add stricter phrasing rules, temperature down, etc.)
- Edit the composer's verdict-scoring logic in `shared/astro/composer.ts` if it's mis-weighting fired rules

**"Chart X not found" (500)** → `chartId` in the URL doesn't match a row in `charts`. Should never happen from the UI; if it does, log the actual chartId being sent.

**Fallback mode**: If you deliberately leave `PERPLEXITY_API_KEY` unset, the endpoint still returns a valid Markdown reading — just no LLM prose. Useful for sanity-checking the composer output without spending credits.

---

## 7. What actually changed (short version)

| File | What it does |
|---|---|
| `shared/astro/rules.bundled.json` | 2,298 rules across 12 lagnas + overrides + exceptions, bundled |
| `shared/astro/rule-loader.ts` | Memoized per-lagna rule access |
| `shared/astro/rule-matcher.ts` | Parses rule conditions against ChartFacts |
| `shared/astro/composer.ts` | Deterministic composer: chart in → StructuredReading out |
| `shared/astro/chart-facts-adapter.ts` | Bridges existing engine.ts + guruji-analysis.ts → composer input |
| `server/perplexity.ts` | Perplexity Sonar API adapter (chunked section generation) |
| `server/deep-reading.ts` | Orchestrator: run composer → run LLM → cache in DB → track budget |
| `server/routes.ts` | New `/api/deep-reading/:chartId` (POST + GET) + `/api/admin/budget`, all `requireAdmin` |
| `shared/schema.ts` + `server/storage.ts` | Two new tables: `deep_readings` (per-chart cache), `api_budget` (monthly cap) |
| `client/src/components/DeepReadingPanel.tsx` | Admin-only UI panel |
| `client/src/components/GurujiTab.tsx` + `client/src/pages/Jathagam.tsx` | Wire the panel in |

**Not changed** (per your explicit request):
- `shared/astro/constants.ts` — validated planetary constants (824 lines)
- `shared/astro/guruji-analysis.ts` — validated Sootchuma Valu engine
- No `.db` schema deletions — the two new tables are additive; `CREATE TABLE IF NOT EXISTS` is idempotent

---

## 8. After deploy — security housekeeping (independent of this change)

These were flagged in an earlier pass but not fixed yet:
- Rotate the exposed Google Client Secret (`GOCSPX-...`)
- Rotate the SSH deploy private key
- Rotate the admin seed password before opening the site to new accounts

Do this when convenient — not blocking Deep Reading launch.
