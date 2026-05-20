import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppShell } from "./components/Layout";
import { Header } from "./components/Header";
import { TradeFlashProvider } from "./context/TradeFlashContext";
import { HomePage } from "./pages/HomePage";
import { TokenPage } from "./pages/TokenPage";
import { BotPage } from "./pages/BotPage";
import { PortfolioPage } from "./pages/PortfolioPage";
import { useNotificationBridge } from "./hooks/useNotificationBridge";

function AppRoutes() {
  useNotificationBridge();
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/bot" element={<BotPage />} />
      <Route path="/portfolio" element={<PortfolioPage />} />
      <Route path="/token/:address" element={<TokenPage />} />
    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <TradeFlashProvider>
        <AppShell>
          <Header />
          <AppRoutes />
        </AppShell>
      </TradeFlashProvider>
    </BrowserRouter>
  );
}
