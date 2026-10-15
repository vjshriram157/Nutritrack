import React, { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import CmfAppHeader from "./components/CmfAppHeader";
import CmfSettingsModal from "./components/CmfSettingsModal";
import DeviceTab from "./pages/DeviceTab";
import HealthTab from "./pages/HealthTab";
import FoodsDatabase from "./pages/FoodsDatabase";
import WeightTracker from "./pages/WeightTracker";
import MealPlanner from "./pages/MealPlanner";
import ShoppingList from "./pages/ShoppingList";
import Profile from "./pages/Profile";
import OnboardingFlow from "./components/OnboardingFlow";
import { ArrowLeft } from "lucide-react";

/**
 * Secondary view wrapper with clean back button to return to the primary two tabs
 */
function SubpageLayout({ title, backTo = "/", children }) {
  const navigate = useNavigate();
  return (
    <div className="cmf-subpage-wrapper">
      <header className="cmf-subpage-header">
        <button
          type="button"
          onClick={() => navigate(backTo)}
          className="cmf-back-btn"
          aria-label="Back"
        >
          <ArrowLeft size={16} />
          <span>Back</span>
        </button>
        <h2 className="cmf-subpage-title">{title}</h2>
        <div style={{ width: 68 }} />
      </header>
      <div className="cmf-subpage-content">
        {children}
      </div>
    </div>
  );
}

function MainApp() {
  const location = useLocation();
  const navigate = useNavigate();
  const [settingsOpen, setSettingsOpen] = useState(false);

  // First-launch onboarding state (persisted locally)
  const [onboardingCompleted, setOnboardingCompleted] = useState(() => {
    return localStorage.getItem("nutritrack_onboarding_completed") === "true";
  });

  // Listen for reset onboarding event from settings
  React.useEffect(() => {
    const handleReset = () => {
      setOnboardingCompleted(false);
    };
    window.addEventListener("nutritrack_reset_onboarding", handleReset);
    return () => {
      window.removeEventListener("nutritrack_reset_onboarding", handleReset);
    };
  }, []);

  if (!onboardingCompleted) {
    return <OnboardingFlow onComplete={() => setOnboardingCompleted(true)} />;
  }

  // Determine active tab between "device" and "health"
  const isHealthPath =
    location.pathname.startsWith("/health") ||
    location.pathname === "/food-log" ||
    location.pathname === "/diary";

  const activeTab = isHealthPath ? "health" : "device";

  const handleTabChange = (tab) => {
    if (tab === "health") {
      navigate("/health");
    } else {
      navigate("/");
    }
  };

  const isPrimaryTab =
    location.pathname === "/" ||
    location.pathname === "/device" ||
    location.pathname === "/activity" ||
    location.pathname === "/health" ||
    location.pathname === "/food-log" ||
    location.pathname === "/diary";

  return (
    <div className="cmf-app-shell">
      {/* Top Header with "My devices" and "Health" tabs */}
      {isPrimaryTab && (
        <CmfAppHeader
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onOpenProfileModal={() => setSettingsOpen(true)}
        />
      )}

      <main className="cmf-main-content">
        <Routes>
          {/* Primary Tab 1: Device */}
          <Route path="/" element={<DeviceTab />} />
          <Route path="/device" element={<DeviceTab />} />
          <Route path="/activity" element={<DeviceTab />} />

          {/* Primary Tab 2: Health */}
          <Route path="/health" element={<HealthTab />} />
          <Route path="/food-log" element={<HealthTab />} />
          <Route path="/diary" element={<HealthTab />} />

          {/* Secondary Views Preserved (accessible via Settings / shortcuts) */}
          <Route
            path="/weight"
            element={
              <SubpageLayout title="Weight Tracker" backTo="/">
                <WeightTracker />
              </SubpageLayout>
            }
          />
          <Route
            path="/foods"
            element={
              <SubpageLayout title="Food Database" backTo="/health">
                <FoodsDatabase />
              </SubpageLayout>
            }
          />
          <Route
            path="/meal-plans"
            element={
              <SubpageLayout title="Meal Planner" backTo="/health">
                <MealPlanner />
              </SubpageLayout>
            }
          />
          <Route
            path="/shopping-list"
            element={
              <SubpageLayout title="Shopping List" backTo="/health">
                <ShoppingList />
              </SubpageLayout>
            }
          />
          <Route
            path="/profile"
            element={
              <SubpageLayout title="Account & Goals" backTo="/">
                <Profile />
              </SubpageLayout>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* Settings & Profile Modal */}
      <CmfSettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <MainApp />
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
