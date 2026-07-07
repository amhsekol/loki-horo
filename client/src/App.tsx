import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LangProvider, useLang } from "@/lib/lang";
import { AuthProvider, useAuth } from "@/lib/auth";
import { ThemeProvider } from "@/lib/theme";
import { NavProvider, useNav } from "@/lib/nav";
import { SetupScreen } from "@/components/SetupScreen";
import { AuthScreen } from "@/components/AuthScreen";
import { Layout } from "@/components/Layout";
import Jathagam from "@/pages/Jathagam";
import Panchangam from "@/pages/Panchangam";
import Saved from "@/pages/Saved";
import Members from "@/pages/Members";
import Settings from "@/pages/Settings";

// All four modules stay mounted; visibility toggles by the active nav item.
// This preserves each module's internal state (e.g. the generated Jathagam,
// the Kocharam almanac) as the user switches between them.
function Modules() {
  const { active } = useNav();
  const { isAdmin } = useAuth();
  return (
    <Layout>
      <div hidden={active !== "jathagam"} data-testid="pane-jathagam">
        <Jathagam />
      </div>
      <div hidden={active !== "kocharam"} data-testid="pane-kocharam">
        <Panchangam />
      </div>
      <div hidden={active !== "saved"} data-testid="pane-saved">
        <Saved />
      </div>
      {isAdmin && (
        <div hidden={active !== "members"} data-testid="pane-members">
          <Members />
        </div>
      )}
      <div hidden={active !== "settings"} data-testid="pane-settings">
        <Settings />
      </div>
    </Layout>
  );
}

// Gate order:
//   1. one-time setup (language + chart style)
//   2. authentication (sign in / sign up) so saved charts stay private
//   3. the app
function AppGate() {
  const { chosen } = useLang();
  const { user, isLoading } = useAuth();
  if (!chosen) return <SetupScreen />;
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!user) return <AuthScreen />;
  return (
    <NavProvider>
      <Modules />
    </NavProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <LangProvider>
          <AuthProvider>
            <TooltipProvider>
              <Toaster />
              <AppGate />
            </TooltipProvider>
          </AuthProvider>
        </LangProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
