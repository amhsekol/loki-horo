import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLang } from "@/lib/lang";
import { useAuth } from "@/lib/auth";
import { UI } from "@shared/astro/constants";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LogIn, UserPlus, ShieldCheck } from "lucide-react";
import { SiGoogle } from "react-icons/si";

function Logo() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-label="LOKI HORO" className="text-primary">
      <circle cx="24" cy="24" r="21" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
      <circle cx="24" cy="24" r="15" stroke="currentColor" strokeWidth="1.5" />
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i * 30 * Math.PI) / 180;
        const x1 = 24 + Math.cos(a) * 15;
        const y1 = 24 + Math.sin(a) * 15;
        const x2 = 24 + Math.cos(a) * 21;
        const y2 = 24 + Math.sin(a) * 21;
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />;
      })}
      <circle cx="24" cy="24" r="5.5" fill="currentColor" />
    </svg>
  );
}

export function AuthScreen() {
  const { t } = useLang();
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Whether the server has Google OAuth wired up (VPS only). On the pplx.app
  // prototype this is false, so the Google button stays hidden.
  const { data: authConfig } = useQuery<{ googleEnabled: boolean }>({
    queryKey: ["/api/auth/config"],
  });
  const googleEnabled = authConfig?.googleEnabled ?? false;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "login") {
        await login(email.trim(), password);
      } else {
        await register(email.trim(), name.trim(), password);
      }
    } catch (err: any) {
      // apiRequest throws "STATUS: {json}". Try to surface the server message.
      let msg = t(UI.authError);
      const m = /\{.*\}/.exec(err?.message ?? "");
      if (m) {
        try { const j = JSON.parse(m[0]); if (j.error && typeof j.error === "string") msg = j.error; } catch { /* keep default */ }
      }
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground relative flex items-center justify-center px-4 py-10">
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.5] dark:opacity-100"
        style={{
          backgroundImage:
            "radial-gradient(1px 1px at 20% 30%, hsl(var(--foreground)/0.18) 50%, transparent), radial-gradient(1px 1px at 70% 60%, hsl(var(--foreground)/0.14) 50%, transparent), radial-gradient(1.5px 1.5px at 85% 20%, hsl(var(--primary)/0.25) 50%, transparent), radial-gradient(1px 1px at 40% 80%, hsl(var(--foreground)/0.12) 50%, transparent)",
        }}
      />
      <Card className="relative w-full max-w-md p-6 md:p-8" data-testid="auth-screen">
        <div className="flex flex-col items-center text-center mb-6">
          <Logo />
          <h1 className="font-serif text-2xl mt-3">{t(UI.authWelcome)}</h1>
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-primary shrink-0" />
            {t(UI.authTagline)}
          </p>
        </div>

        {/* Mode toggle */}
        <div className="grid grid-cols-2 gap-2 mb-5">
          <button
            type="button"
            onClick={() => { setMode("login"); setError(null); }}
            data-testid="auth-tab-login"
            className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
              mode === "login"
                ? "border-primary bg-primary/10 text-foreground"
                : "border-card-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            {t(UI.signIn)}
          </button>
          <button
            type="button"
            onClick={() => { setMode("register"); setError(null); }}
            data-testid="auth-tab-register"
            className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
              mode === "register"
                ? "border-primary bg-primary/10 text-foreground"
                : "border-card-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            {t(UI.signUp)}
          </button>
        </div>

        <form onSubmit={submit} className="grid gap-3">
          {mode === "register" && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{t(UI.nameLabel)}</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                data-testid="input-auth-name"
                autoComplete="name"
              />
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">{t(UI.emailLabel)}</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              data-testid="input-auth-email"
              autoComplete="email"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">{t(UI.passwordLabel)}</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={mode === "register" ? 6 : 1}
              data-testid="input-auth-password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive" data-testid="text-auth-error">{error}</p>
          )}

          <Button type="submit" className="w-full gap-1.5 mt-1" disabled={busy} data-testid="button-auth-submit">
            {mode === "login" ? <LogIn className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
            {mode === "login" ? t(UI.signIn) : t(UI.signUp)}
          </Button>
        </form>

        {googleEnabled && (
          <>
            <div className="flex items-center gap-3 my-4" data-testid="auth-divider">
              <span className="h-px flex-1 bg-card-border" />
              <span className="text-xs text-muted-foreground">{t(UI.orLabel)}</span>
              <span className="h-px flex-1 bg-card-border" />
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2"
              onClick={() => { window.location.href = "/api/auth/google"; }}
              data-testid="button-auth-google"
            >
              <SiGoogle className="h-4 w-4" />
              {t(UI.continueWithGoogle)}
            </Button>
          </>
        )}

        <button
          type="button"
          onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(null); }}
          className="w-full text-center text-xs text-muted-foreground hover:text-foreground mt-4"
          data-testid="button-auth-switch"
        >
          {mode === "login" ? t(UI.noAccountYet) : t(UI.haveAccount)}
        </button>
      </Card>
    </div>
  );
}
