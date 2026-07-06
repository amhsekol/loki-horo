import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LangProvider, useLang } from "@/lib/lang";
import { ThemeProvider } from "@/lib/theme";
import { NavProvider, useNav } from "@/lib/nav";
import { SetupScreen } from "@/components/SetupScreen";
import { Layout } from "@/components/Layout";
import Jathagam from "@/pages/Jathagam";
import Panchangam from "@/pages/Panchangam";
import Saved from "@/pages/Saved";
import Settings from "@/pages/Settings";

// All four modules stay mounted; visibility toggles by the active nav item.
// This preserves each module's internal state (e.g. the generated Jathagam,
// the Kocharam almanac) as the user switches between them.
function Modules() {
  const { active } = useNav();
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
      <div hidden={active !== "settings"} data-testid="pane-settings">
        <Settings />
      </div>
    </Layout>
  );
}

// Gate the app behind the one-time setup screen (language + chart style).
function AppGate() {
  const { chosen } = useLang();
  if (!chosen) return <SetupScreen />;
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
          <TooltipProvider>
            <Toaster />
            <AppGate />
          </TooltipProvider>
        </LangProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
