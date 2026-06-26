import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Auction from "./pages/Auction";
import Admin from "./pages/Admin";
import Owner from "./pages/Owner";
import Players from "./pages/Players";
import Tournaments from "./pages/Tournaments";
import MatchScoring from "./pages/MatchScoring";
import AuctionAnalytics from "./pages/AuctionAnalytics";
import SuperAdmin from "./pages/SuperAdmin";
import RoleDebug from "./pages/RoleDebug";
import NotFound from "./pages/NotFound";
import { RequireRole } from "@/components/RequireRole";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/auction" element={<Auction />} />
            <Route path="/admin" element={<RequireRole roles={['admin', 'super_admin']} context="Admin page"><Admin /></RequireRole>} />
            <Route path="/owner" element={<RequireRole roles={['owner']} requireOwner context="My Team (Owner) page"><Owner /></RequireRole>} />
            <Route path="/players" element={<Players />} />
            <Route path="/tournaments" element={<RequireRole roles={['admin', 'super_admin']} context="Tournaments page"><Tournaments /></RequireRole>} />
            <Route path="/tournaments/match/:matchId/scoring" element={<RequireRole roles={['admin', 'super_admin']} context="Match Scoring page"><MatchScoring /></RequireRole>} />
            <Route path="/analytics" element={<AuctionAnalytics />} />
            <Route path="/super-admin" element={<RequireRole roles={['super_admin']} context="Super Admin page"><SuperAdmin /></RequireRole>} />

            <Route path="/debug/role" element={<RoleDebug />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
