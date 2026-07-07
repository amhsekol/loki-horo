# Auto-Deploy Pipeline (GitHub Actions → Hostinger VPS)

Every push to **`master`** runs a build gate, and if it passes, GitHub Actions
SSHes into your Hostinger VPS, pulls the new code, and rebuilds the Docker
containers. Your site at **https://predict.lokeshmani.com** updates within a few
minutes — no manual `ssh` + `git pull` needed.

Workflow file: [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)

---

## How it works

```
git push master
      │
      ▼
┌─────────────────────┐   fails ──► deploy is skipped, site stays up
│  build job          │
│  npm ci             │
│  npm run check (tsc)│
│  npm run build      │
└─────────┬───────────┘
          │ passes
          ▼
┌─────────────────────┐
│  deploy job (SSH)   │
│  git reset --hard   │
│  docker compose      │
│    up -d --build    │
└─────────────────────┘
      │
      ▼
  Live on VPS
```

The build must pass before anything touches the server, so a broken commit can
never take the live site down.

---

## Why secrets — and why a PUBLIC repo is still safe

The repository is public, so **anything committed to it is visible to the whole
world**. The pipeline needs sensitive values (an SSH key to your server), so
those are **never** put in the code. Instead they live in **GitHub Actions
Secrets** — encrypted, injected only at workflow run time, and masked in logs.

Two categories of secrets, kept in two different places:

| Secret type | Where it lives | Ever in the repo? |
|-------------|----------------|-------------------|
| SSH deploy key, VPS host/user | GitHub → repo **Settings → Secrets** | No — encrypted vault |
| App secrets (`SESSION_SECRET`, admin & Google creds) | The VPS `.env` file only | No — `.env` is git-ignored |

Your `.env` never leaves the server, and `.gitignore` already excludes it, so
`git pull` on the VPS will never overwrite it.

---

## One-time setup

### Step 1 — Create a dedicated deploy SSH key

Do this **on your VPS** (or any machine). Use a key made just for this pipeline
so you can revoke it without affecting your personal keys.

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/gh_deploy -N ""
```

This makes two files:
- `~/.ssh/gh_deploy`      → **private** key (goes into GitHub secrets)
- `~/.ssh/gh_deploy.pub`  → **public** key (goes onto the VPS)

### Step 2 — Authorize the public key on the VPS

```bash
cat ~/.ssh/gh_deploy.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

Now the holder of the private key can SSH in as `root`.

### Step 3 — Add the secrets to GitHub

Go to your repo → **Settings → Secrets and variables → Actions →
New repository secret**, and add these four:

| Secret name    | Value |
|----------------|-------|
| `VPS_HOST`     | `187.77.21.138` |
| `VPS_USER`     | `root` |
| `VPS_PORT`     | `22` |
| `VPS_SSH_KEY`  | the **entire** contents of `~/.ssh/gh_deploy` (the private key) |

To copy the private key to paste in:

```bash
cat ~/.ssh/gh_deploy
```

Copy everything **including** the `-----BEGIN OPENSSH PRIVATE KEY-----` and
`-----END OPENSSH PRIVATE KEY-----` lines.

> The `VPS_SSH_KEY` is the only truly sensitive one — treat it like a password.

### Step 4 — Push and watch it run

```bash
git push origin master
```

Open the repo's **Actions** tab. You'll see the run: **build** first, then
**deploy**. Green check = your site is updated live.

You can also trigger a deploy manually anytime from **Actions → CI & Deploy →
Run workflow** (that's the `workflow_dispatch` trigger).

---

## Safe secret-management rules

1. **Never** `git add` a private key, `.env`, or any credential. `.env` is
   already git-ignored — keep it that way.
2. **One key, one purpose.** The `gh_deploy` key is only for CI. If it leaks,
   revoke just it (see below) — nothing else is affected.
3. **Rotate on suspicion.** If you ever think the key leaked, regenerate it
   (repeat Steps 1–3) and remove the old public key from the VPS.
4. **Least privilege where practical.** For a single-app VPS, deploying as
   `root` is common. To harden further, create a dedicated `deploy` user that
   owns `/opt/lokihoro` and can run `docker compose`, and set `VPS_USER=deploy`.
5. **Secrets are write-only in the UI.** GitHub never shows a secret's value
   again after you save it. To change one, overwrite it.
6. **Logs are masked.** Actions automatically redacts secret values from build
   logs, but never `echo` a secret on purpose.

---

## Revoke / rotate the deploy key

**Remove the old public key from the VPS** (edit the file and delete the line
ending in `github-actions-deploy`):

```bash
nano ~/.ssh/authorized_keys
```

**Then** regenerate and re-add per Steps 1–3, and update the `VPS_SSH_KEY`
secret in GitHub.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `Permission denied (publickey)` in the deploy log | The public key isn't in the VPS `~/.ssh/authorized_keys`, or `VPS_SSH_KEY` is incomplete. Re-do Steps 2–3. |
| Build job fails on `npm run check` | A TypeScript error — fix it locally (`npm run check`) before pushing. Deploy is correctly skipped. |
| Deploy runs but site unchanged | SSH into the VPS and check `docker compose ps` and `docker compose logs app`. |
| `git reset --hard` warning about local changes | The workflow force-resets to `origin/master` on purpose so the VPS always matches the repo. Never edit code directly on the VPS — push instead. |
| Want to pause auto-deploy | Disable the workflow in the **Actions** tab, or comment out the `on: push:` block. |
