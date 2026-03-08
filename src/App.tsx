import { Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { BetProvider } from "./context/BetContext";
import { UserProvider } from "./context/UserContext";
import { MatchProvider } from "./context/MatchContext";
import { OddsProvider } from "./context/OddsContext";
import { UserManagementProvider } from "./context/UserManagementContext";
import { TransactionProvider } from "./context/TransactionContext";
import { BalanceSyncProvider } from "./components/BalanceSyncProvider";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminProtectedRoute } from "./components/AdminProtectedRoute";
import Index from "./pages/Index";
import AdminPortal from "./pages/AdminPortal";
import Finance from "./pages/Finance";
import MyBets from "./pages/MyBets";
import History from "./pages/History";
import Profile from "./pages/Profile";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Loading fallback component
const LoadingPage = () => (
  <div className="flex items-center justify-center min-h-screen bg-background">
    <div className="text-center">
      <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <p className="text-foreground text-lg">Loading...</p>
    </div>
  </div>
);

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <UserManagementProvider>
          <TransactionProvider>
            <UserProvider>
              <BetProvider>
                <MatchProvider>
                  <OddsProvider>
                    <BalanceSyncProvider>
                      <Toaster />
                      <Sonner />
                      <BrowserRouter>
                        <Suspense fallback={<LoadingPage />}>
                          <Routes>
                            <Route path="/login" element={<Login />} />
                            <Route path="/signup" element={<Signup />} />
                            <Route path="/" element={<ProtectedRoute element={<Index />} />} />
                            <Route path="/finance" element={<ProtectedRoute element={<Finance />} />} />
                            <Route path="/my-bets" element={<ProtectedRoute element={<MyBets />} />} />
                            <Route path="/history" element={<ProtectedRoute element={<History />} />} />
                            <Route path="/profile" element={<ProtectedRoute element={<Profile />} />} />
                            <Route path="/muleiadmin" element={<AdminProtectedRoute element={<AdminPortal />} />} />
                            <Route path="*" element={<NotFound />} />
                          </Routes>
                        </Suspense>
                      </BrowserRouter>
                    </BalanceSyncProvider>
                  </OddsProvider>
                </MatchProvider>
              </BetProvider>
            </UserProvider>
          </TransactionProvider>
        </UserManagementProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
