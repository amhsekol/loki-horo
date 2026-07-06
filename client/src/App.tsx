import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LangProvider, useLang } from "@/lib/lang";
import { ThemeProvider } from "@/lib/theme";
import { SetupScreen } from "@/components/SetupScreen";
import NotFound from "@/pages/not-found";
import Jathagam from "@/pages/Jathagam";
import Panchangam from "@/pages/Panchangam";

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={Jathagam} />
      <Route path="/panchangam" component={Panchangam} />
      <Route component={NotFound} />
    </Switch>
  );
}

// Gate the app behind the one-time setup screen (language + chart style).
function AppGate() {
  const { chosen } = useLang();
  if (!chosen) return <SetupScreen />;
  return (
    <Router hook={useHashLocation}>
      <AppRouter />
    </Router>
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
