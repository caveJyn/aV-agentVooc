import "./index.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./components/app-sidebar";
import { TooltipProvider } from "./components/ui/tooltip";
import { Toaster } from "./components/ui/toaster";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import Chat from "./routes/chat";
import Home from "./routes/home";
import Landing from "./routes/landing";
import Auth from "./routes/auth";
import SuccessPage from "./routes/success";
import CancelPage from "./routes/cancel";
import { ProtectedRoute } from "./components/protected-route";
import useVersion from "./hooks/use-version";
import { initSuperTokens } from "./lib/superTokens";
import { BackgroundWrapper } from "./components/BackgroundWrapper";
import AgentRoute from "./routes/overview";
import Payment from "./routes/payment";
import KnowledgeVault from "./routes/knowledgeVault";

// Initialize SuperTokens
initSuperTokens();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Number.POSITIVE_INFINITY,
    },
  },
});

// Routes where the sidebar should be displayed
const SIDEBAR_ROUTES = ["/home", "/chat", "/settings"];

function AppContent() {
  const location = useLocation();
  const showSidebar = SIDEBAR_ROUTES.some((route) =>
    location.pathname.startsWith(route)
  );

  // Debug log for AppContent rendering
  console.log("AppContent: Rendering, showSidebar:", showSidebar, "pathname:", location.pathname);

  // Debug log for route rendering
  console.log(showSidebar ? "Rendering sidebar routes" : "Rendering non-sidebar routes", "for pathname:", location.pathname);

  return (
    <TooltipProvider delayDuration={0}>
      {showSidebar ? (
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset className="">
            <div className="flex flex-1 flex-col gap-4 size-full w-full max-w-[90%] mx-auto px-4 md:px-6 bg-transparent">
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/auth/email" element={<Auth />} />
                <Route path="/auth/phantom" element={<Auth />} />
                <Route path="/payment" element={<Payment />} />
                <Route path="/success" element={<SuccessPage />} />
                <Route path="/cancel" element={<CancelPage />} />
                <Route path="/auth/callback/google" element={<Auth />} />
                <Route path="/knowledge/:agentId" element={<ProtectedRoute><KnowledgeVault/></ProtectedRoute>} />
                <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
                <Route path="/chat/:agentId" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
                <Route path="/settings/:agentId" element={<ProtectedRoute><AgentRoute /></ProtectedRoute>} />
              </Routes>
            </div>
          </SidebarInset>
        </SidebarProvider>
      ) : (
        <div className="flex flex-1 flex-col gap-4 size-full w-full max-w-[100%] bg-transparent">
  <Routes>
    <Route path="/" element={<Landing />} />
    <Route path="/auth" element={<Auth />} />
    <Route path="/auth/email" element={<Auth />} />
    <Route path="/auth/phantom" element={<Auth />} />
    <Route path="/payment" element={<Payment />} />
    <Route path="/success" element={<SuccessPage />} />
    <Route path="/cancel" element={<CancelPage />} />
    <Route path="/auth/callback/google" element={<Auth />} />
    <Route path="/knowledge/:agentId" element={<ProtectedRoute><KnowledgeVault /></ProtectedRoute>} />
    <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
    <Route path="/chat/:agentId" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
    <Route path="/settings/:agentId" element={<ProtectedRoute><AgentRoute /></ProtectedRoute>} />
    <Route path="*" element={<div>No route matched: {location.pathname}</div>} />
  </Routes>
</div>
      )}
      <Toaster />
    </TooltipProvider>
  );
}

function App() {
  useVersion();
  console.log("App: Rendering with KnowledgeVault route fix v2");
  return (
    <QueryClientProvider client={queryClient}>
      <BackgroundWrapper className="dark antialiased">
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </BackgroundWrapper>
    </QueryClientProvider>
  );
}

export default App;