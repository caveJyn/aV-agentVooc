// /home/kaijin/projects/bots/venv/elizaOS_env/agentVooc-prod/client/src/App.tsx
import "./index.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./components/app-sidebar";
import NavSidebar from "./components/nav-sidebar";
import DocsSidebar from "./components/docs-sidebar"; // Add import
import { TooltipProvider } from "./components/ui/tooltip";
import { Toaster } from "./components/ui/toaster";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import Chat from "./routes/chat";
import Home from "./routes/home";
import Landing from "./routes/landing";
import { SignIn, SignUp } from "@clerk/clerk-react";
// remove: import Auth from "./routes/auth";
import SuccessPage from "./routes/success";
import CancelPage from "./routes/cancel";
import { ProtectedRoute } from "./components/protected-route";
import { BackgroundWrapper } from "./components/BackgroundWrapper";
import AgentRoute from "./routes/overview";
import Payment from "./routes/payment";
import KnowledgeVault from "./routes/knowledgeVault";
import CreateCharacter from "./components/create-character";
import EditCharacter from "./components/edit-character";
import Settings from "./routes/settings";
import EmailVault from "./routes/emailVault";
import { Helmet, HelmetProvider } from "react-helmet-async";
import LegalDocumentPage from "./routes/legal/[slug]";
import CompanyPage from "./routes/company/[slug]";
import BlogListPage from "./routes/blog/index";
import BlogPostPage from "./routes/blog/[slug]";
import DocsListPage from "./routes/docs/index";
import DocPage from "./routes/docs/[slug]";
import PressListPage from "./routes/press/index";
import PressPostPage from "./routes/press/[slug]";
import ProductListPage from "./routes/product";
import ProductPage from "./routes/product/[slug]";
import Demo from "./routes/demo";
import { useEffect } from "react";
import { Footer } from "./components/landing/footer";
import { FooterProvider } from "./context/footerContext";
import { ThemeToggle } from "./components/themeToggle";
import { Menu } from "lucide-react";
import { useIsMobile } from "./hooks/use-mobile";
import Navbar from "./components/navbar";
import InvoicesPage from "./routes/invoices";
import AboutPage from "./components/aboutPage";
import CookieConsent from 'react-cookie-consent';
import { ChipiProvider } from "@chipi-stack/chipi-react";


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Number.POSITIVE_INFINITY,
    },
  },
});

const APP_SIDEBAR_ROUTES = [
  "/home",
  "/chat",
  "/settings",
  "/create-character",
  "/edit-character",
  "/email-vault",
  "/knowledge",
];

const DOCS_ROUTES = ["/company/docs"];

function AppContent() {
  const location = useLocation();
  const isMobile = useIsMobile();
  const showAppSidebar = APP_SIDEBAR_ROUTES.some((route) =>
    location.pathname.startsWith(route)
  );
  const showDocsSidebar = DOCS_ROUTES.some((route) =>
    location.pathname.startsWith(route)
  );

  useEffect(() => {
    if (!window.twq) {
      window.twq = function (...args: any[]) {
        window.twq.exe ? window.twq.exe(...args) : window.twq.queue.push(args);
      } as any;
      window.twq.version = "1.1";
      window.twq.queue = [];
    }
    window.twq("config", "q5y7y");
    window.twq("event", "PageView");
  }, [location]);

  return (
    <TooltipProvider delayDuration={0}>
      <SidebarProvider>
        <Helmet>
          
          {/* Google AdSense */}
          {/* <script
            async
            src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9622114924468888"
            crossOrigin="anonymous"
          /> */}
          
                    
          {/* Twitter Ads */}
          {/* <script
            async
            src="https://static.ads-twitter.com/uwt.js"
            type="text/javascript"
          /> */}
        </Helmet>
        
        <CookieConsent
          location="bottom"
          buttonText="Accept All"
          declineButtonText="Decline"
          cookieName="agentVoocConsent"
          style={{ background: '#2B373B' }}
          buttonStyle={{ color: '#fff', background: '#4CAF50' }}
          declineButtonStyle={{ color: '#fff', background: '#f44336' }}
          expires={150}
          sameSite="Lax"
          enableDeclineButton
        >
          This website uses cookies and ads to enhance your experience. We use Google AdSense and Ezoic for advertisements.
        </CookieConsent>

        {showAppSidebar && <AppSidebar />}
        {showDocsSidebar && <DocsSidebar />}
        {!showAppSidebar && isMobile && <NavSidebar />}
        <div
          className={`flex flex-1 flex-col gap-4 size-full w-full ${
            showAppSidebar || showDocsSidebar ? "mx-auto" : "max-w-[100%]"
          } bg-transparent`}
        >
          {!showAppSidebar && !isMobile && <Navbar />}
          {showAppSidebar && (
            <div className="gap-2 mt-5 -mb-5">
              <SidebarTrigger className="text-agentvooc-primary hover:bg-agentvooc-secondary-accent hover:text-agentvooc-accent" />
              <ThemeToggle />
            </div>
          )}
          {!showAppSidebar && isMobile && (
            <div className="sticky top-0 z-50 flex items-center justify-between p-4 bg-agentvooc-secondary-bg shadow-agentvooc-glow">
              <div
                className="text-2xl font-semibold cursor-pointer hover:text-agentvooc-accent transition-all whitespace-nowrap"
                onClick={() => window.location.href = "/"}
              >
                agentVooc <span className="text-agentvooc-accent">.</span>
              </div>
              <div className="flex items-center gap-2">
                <ThemeToggle />
                <SidebarTrigger className="text-agentvooc-primary hover:bg-agentvooc-secondary-accent hover:text-agentvooc-accent">
                  <Menu className="h-6 w-6" />
                  <span className="sr-only">Toggle Navigation Sidebar</span>
                </SidebarTrigger>
              </div>
            </div>
          )}
          {(showAppSidebar || showDocsSidebar) && <SidebarInset />}
          <Routes>
            <Route path="/" element={<Landing />} />
           <Route path="/auth" element={<SignIn routing="path" path="/auth" />} />
<Route path="/sign-up" element={<SignUp routing="path" path="/sign-up" />} />

            {/* <Route path="/auth/email" element={<Auth />} />
            <Route path="/auth/phantom" element={<Auth />} /> */}
            <Route path="/payment" element={<Payment />} />
            <Route path="/success" element={<SuccessPage />} />
            <Route path="/cancel" element={<CancelPage />} />
            {/* <Route path="/auth/callback/google" element={<Auth />} /> */}
            <Route
              path="/knowledge/:agentId"
              element={
                <ProtectedRoute>
                  <KnowledgeVault />
                </ProtectedRoute>
              }
            />
            <Route
              path="/email-vault/:agentId"
              element={
                <ProtectedRoute>
                  <EmailVault />
                </ProtectedRoute>
              }
            />
            <Route
              path="/home"
              element={
                <ProtectedRoute>
                  <Home />
                </ProtectedRoute>
              }
            />
            <Route
              path="/chat/:agentId"
              element={
                <ProtectedRoute>
                  <Chat />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings/:agentId"
              element={
                <ProtectedRoute>
                  <AgentRoute />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/create-character"
              element={
                <ProtectedRoute>
                  <CreateCharacter setError={() => {}} />
                </ProtectedRoute>
              }
            />
            <Route
              path="/edit-character/:id"
              element={
                <ProtectedRoute>
                  <EditCharacter setError={() => {}} />
                </ProtectedRoute>
              }
            />
            <Route path="/legal/:slug" element={<LegalDocumentPage />} />
            <Route path="/company/about" element={<AboutPage />} />
            <Route path="/company/:slug" element={<CompanyPage />} />
            <Route path="/company/blog" element={<BlogListPage />} />
            <Route path="/company/blog/:slug" element={<BlogPostPage />} />
            <Route path="/company/docs" element={<DocsListPage />} />
            <Route path="/company/docs/:slug" element={<DocPage />} />
            <Route path="/company/press" element={<PressListPage />} />
            <Route path="/company/press/:slug" element={<PressPostPage />} />
            <Route path="/product" element={<ProductListPage />} />
            <Route path="/product/:slug" element={<ProductPage />} />
            <Route path="/invoices" element={<InvoicesPage />} />
            <Route path="/demo" element={<Demo />} />
            <Route
              path="*"
              element={<div>No route matched: {location.pathname}</div>}
            />
          </Routes>
          {!showAppSidebar && <Footer />}
        </div>
      </SidebarProvider>
      <Toaster />
    </TooltipProvider>
  );
}

function App() {

  // /client/src/App.tsx
useEffect(() => {
  console.log("[APP] Environment variables:", import.meta.env);
}, []);

  useEffect(() => {
    console.log("[APP] ChipiProvider config:", {
      apiPublicKey: import.meta.env.VITE_CHIPI_PUBLIC_API_KEY,
      nodeUrl: import.meta.env.VITE_STARKNET_NODE_URL,
    });
  }, []);

  const chipiConfig = {
    apiPublicKey: import.meta.env.VITE_CHIPI_PUBLIC_API_KEY,
    nodeUrl: import.meta.env.VITE_STARKNET_NODE_URL,
    // Add organization ID if required by your Chipi setup
    // orgId: userData?.user?.orgId || "your-org-id",
    // Use sandbox for development if needed
    // apiUrl: "https://sandbox.chipi-pay.com",
  };

  if (!chipiConfig.apiPublicKey) {
    console.error("[APP] Missing VITE_CHIPI_PUBLIC_API_KEY in environment variables");
  }

  return (
    <QueryClientProvider client={queryClient}>
      <HelmetProvider>
        <BackgroundWrapper>
          <BrowserRouter>
            <FooterProvider>
              <ChipiProvider config={chipiConfig}>
  <AppContent />
</ChipiProvider>

            </FooterProvider>
          </BrowserRouter>
        </BackgroundWrapper>
      </HelmetProvider>


    </QueryClientProvider>
  );
}

export default App;