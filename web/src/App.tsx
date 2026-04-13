import { Routes, Route, Navigate } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { Nav } from './components/layout/Nav';
import { Footer } from './components/layout/Footer';
import { IntroPage } from './components/pages/IntroPage';
import { FaqPage } from './components/pages/FaqPage';
import { StatsPage } from './components/pages/StatsPage';
import { MintPage } from './components/pages/MintPage';
import { TimelinePage } from './components/pages/TimelinePage';
import { ExplorePage } from './components/pages/ExplorePage';
import { ProfilePage } from './components/pages/ProfilePage';
import { MergePage } from './components/pages/MergePage';
import { InfinityPage } from './components/pages/InfinityPage';
import { LineageModal } from './components/modals/LineageModal';
import { MergeProvider } from './contexts/MergeContext';
import { LineageProvider } from './contexts/LineageContext';

// Wallet-gated wrapper — redirects to home if not connected.
function RequireWallet({ children }: { children: React.ReactNode }) {
  const { isConnected } = useAccount();
  if (!isConnected) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <MergeProvider>
      <LineageProvider>
        <Nav />
        <Routes>
          <Route path="/" element={<IntroPage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/mint" element={<MintPage />} />
          <Route path="/timeline" element={<TimelinePage />} />
          <Route path="/faq" element={<FaqPage />} />
          <Route path="/explore" element={<ExplorePage />} />
          <Route
            path="/profile"
            element={<RequireWallet><ProfilePage /></RequireWallet>}
          />
          <Route
            path="/merge"
            element={<RequireWallet><MergePage /></RequireWallet>}
          />
          <Route
            path="/infinity"
            element={<RequireWallet><InfinityPage /></RequireWallet>}
          />
          {/* Backward compat: redirect hash routes to clean URLs */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Footer />
        {/* App-level modals */}
        <LineageModal />
      </LineageProvider>
    </MergeProvider>
  );
}
