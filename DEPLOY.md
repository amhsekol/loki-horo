# Deploying LOKI HORO to your Hostinger VPS

This guide takes you from zero to a live, HTTPS site at
**https://predict.lokeshmani.com**, running in Docker behind Nginx, with a
persistent SQLite database and optional Google sign-in.

Everything you need is in this project:

```
Dockerfile              # multi-stage production image
docker-compose.yml      # app + nginx services, persistent volume
.env.example            # copy to .env and fill in secrets
.dockerignore
nginx/conf.d/lokihoro.conf   # reverse proxy (HTTP now, HTTPS after cert)
```

Total time: ~15 minutes.

---

## 0. Prerequisites

- A Hostinger VPS with **Docker** and the **Docker Compose plugin** installed.
  Check: `docker --version` and `docker compose version`.
  If missing: `curl -fsSL https://get.docker.com | sh`
- SSH access to the VPS.
- Control of the `lokeshmani.com` DNS zone (to add the subdomain record).
- Ports **80** and **443** open on the VPS firewall.

---

## 1. Point the subdomain at your VPS (DNS)

In your DNS provider for `lokeshmani.com`, add an **A record**:

| Type | Name      | Value         | TTL  |
| ---- | --------- | ------------- | ---- |
| A    | `predict` | `YOUR_VPS_IP` | 3600 |

(If your VPS has IPv6, also add an `AAAA` record for `predict`.)

Verify it resolves before continuing (may take a few minutes):

```bash
dig +short predict.lokeshmani.com
```

It should print your VPS IP.

---

## 2. Clone the repo onto the VPS

The project lives at **https://github.com/amhsekol/loki-horo** (private). SSH
into the VPS and clone it once:

```bash
ssh user@YOUR_VPS_IP
cd /opt

# Private repo — authenticate with a GitHub token or deploy key. Easiest:
# create a fine-grained Personal Access Token (repo: Contents = Read) at
# https://github.com/settings/tokens and use it as the password when prompted.
git clone https://github.com/amhsekol/loki-horo.git lokihoro
cd lokihoro
```

> Tip: to avoid typing the token every pull, use a deploy key (SSH) or run
> `git config credential.helper store` once after the first authenticated pull.

From now on, shipping an update is just: **push from your dev environment →
`git pull` here → rebuild** (see "Day-2 operations" below).

---

## 3. Create your `.env`

```bash
cp .env.example .env
nano .env
```

Fill in **at minimum**:

```env
PUBLIC_URL=https://predict.lokeshmani.com
SESSION_SECRET=<paste output of: openssl rand -hex 32>
ADMIN_DEFAULT_PASSWORD=<a strong password you choose>
```

Generate the session secret:

```bash
openssl rand -hex 32
```

Leave `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` blank for now — you can add
Google sign-in later in **Step 7** (email + password works immediately).

`DB_PATH`, `PORT`, and `NODE_ENV` are already correct — don't change them.

---

## 4. First boot — HTTP only, to issue the certificate

The Nginx config ships with the HTTPS block commented out (it can't start
without a certificate that doesn't exist yet). Bring the stack up on HTTP first:

```bash
docker compose up -d --build
```

This builds the image (a few minutes the first time) and starts `app` +
`nginx`. Check both are healthy:

```bash
docker compose ps
docker compose logs -f app     # Ctrl-C to stop tailing
```

You should see `serving on port 5000` and `Seeded admin amlokesheit@gmail.com`.

---

## 5. Issue the Let's Encrypt certificate

Run certbot in a one-off container that shares the same challenge folder Nginx
serves. It writes the cert into `./certbot/conf`, which Nginx already mounts.

```bash
docker run --rm \
  -v "$(pwd)/certbot/conf:/etc/letsencrypt" \
  -v "$(pwd)/certbot/www:/var/www/certbot" \
  certbot/certbot certonly --webroot \
  -w /var/www/certbot \
  -d predict.lokeshmani.com \
  --email amlokesheit@gmail.com \
  --agree-tos --no-eff-email
```

Success looks like: `Successfully received certificate ... /etc/letsencrypt/live/predict.lokeshmani.com/fullchain.pem`.

---

## 6. Turn on HTTPS

Edit the Nginx config and **uncomment the entire `server { listen 443 ssl; ... }`
block** at the bottom:

```bash
nano nginx/conf.d/lokihoro.conf
```

Remove the leading `# ` from each line of that second server block (the HTTP
block up top stays as-is — it redirects to HTTPS and keeps serving ACME
renewals). Then reload Nginx:

```bash
docker compose restart nginx
```

Visit **https://predict.lokeshmani.com** — you should see the LOKI HORO welcome
screen with a valid padlock.

**Log in as admin:** `amlokesheit@gmail.com` + the `ADMIN_DEFAULT_PASSWORD` you
set. Change your password in-app after first login.

---

## 7. (Optional) Enable Google sign-in

1. Go to **Google Cloud Console → APIs & Services → Credentials**.
2. **Create Credentials → OAuth client ID → Web application.**
3. Under **Authorized redirect URIs**, add exactly:
   ```
   https://predict.lokeshmani.com/api/auth/google/callback
   ```
4. Copy the **Client ID** and **Client secret** into `.env`:
   ```env
   GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=xxxxxxxx
   ```
5. Recreate the app container so it picks up the new env:
   ```bash
   docker compose up -d
   ```

The "Continue with Google" button now appears on the sign-in screen. A Google
login using **amlokesheit@gmail.com** maps onto the existing admin account
(same email = same row), so you keep admin access either way.

---

## 8. Certificate auto-renewal

Let's Encrypt certs last 90 days. Add a cron job on the VPS to renew and reload:

```bash
crontab -e
```

Add this line (runs daily at 3:30am; certbot only renews when near expiry):

```cron
30 3 * * * cd /opt/lokihoro && docker run --rm -v "$(pwd)/certbot/conf:/etc/letsencrypt" -v "$(pwd)/certbot/www:/var/www/certbot" certbot/certbot renew --webroot -w /var/www/certbot --quiet && docker compose restart nginx
```

---

## Day-2 operations

**Update the app after code changes** (rebuild + restart, data is preserved):

```bash
cd /opt/lokihoro
git pull
docker compose up -d --build
```

That's the whole loop: I push new features to `main`/`master` on GitHub from
here, you run those two commands on the VPS, and the new version is live. The
`lokihoro_data` volume (members + saved horoscopes) is untouched by rebuilds.
Your `.env` also stays put — it's git-ignored, so `git pull` never overwrites it.

**View logs:**

```bash
docker compose logs -f app
```

**Back up your data** (the SQLite DB lives in the `lokihoro_data` volume):

```bash
docker run --rm -v lokihoro_data:/data -v "$(pwd)":/backup alpine \
  tar czf /backup/lokihoro-backup-$(date +%F).tar.gz -C /data .
```

**Restore a backup:**

```bash
docker run --rm -v lokihoro_data:/data -v "$(pwd)":/backup alpine \
  sh -c "cd /data && tar xzf /backup/lokihoro-backup-YYYY-MM-DD.tar.gz"
docker compose restart app
```

**Stop / start:**

```bash
docker compose down     # stops containers, KEEPS the data volume
docker compose up -d     # start again
```

> `docker compose down` does **not** delete the `lokihoro_data` volume, so your
> members and saved horoscopes survive. Only `docker compose down -v` would wipe
> data — avoid that unless you intend to reset.

---

## How it fits together

- **app** (Node/Express) runs on port 5000 inside the Docker network. It serves
  the built React client and the `/api/*` routes, and stores everything in
  `/data/data.db` (+ `/data/sessions.db`) on the persistent volume.
- **nginx** terminates TLS for `predict.lokeshmani.com` and proxies to `app:5000`,
  forwarding `X-Forwarded-Proto: https` so the secure `__Host-` session cookie
  is honored.
- Secrets (session secret, admin password, Google creds) come only from `.env`
  — nothing sensitive is baked into the image.

---

## Troubleshooting

- **Nginx won't start after uncommenting HTTPS** → the cert isn't there. Re-run
  Step 5; confirm `certbot/conf/live/predict.lokeshmani.com/fullchain.pem` exists.
- **Can log in but get logged out immediately** → you're on `http://`, not
  `https://`. The session cookie is Secure-only. Use the HTTPS URL.
- **Google button doesn't appear** → both `GOOGLE_CLIENT_ID` and
  `GOOGLE_CLIENT_SECRET` must be set, then `docker compose up -d` to reload.
- **`redirect_uri_mismatch` from Google** → the URI in Google Cloud must be
  exactly `https://predict.lokeshmani.com/api/auth/google/callback`.
- **Port 80/443 already in use** → another web server (e.g. host Nginx/Apache)
  is running. Stop it, or change the published ports in `docker-compose.yml`.
