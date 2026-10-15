import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import {
  HEALTH_CONNECT_PERMISSIONS,
  requestHealthPermissions,
  checkHealthPermissions,
  syncNativeHealthConnect,
  openHealthConnectSettings,
  identifyWatchDevice
} from "../services/healthConnectBridge";
import UniversalWatchGraphic from "./UniversalWatchGraphic";
import {
  Activity,
  Footprints,
  Flame,
  Route,
  Timer,
  Heart,
  Moon,
  Shield,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  ArrowRight,
  User,
  Watch,
  Sparkles,
  Info
} from "lucide-react";

/**
 * First-Launch Landing Page and Onboarding Flow
 * 5-Screen guided walkthrough:
 * 1. Welcome ("Your health. Your way.")
 * 2. Personal details (Name required, display name)
 * 3. Connect health data (Health Connect permission categories rationale & non-blocking request)
 * 4. Watch setup and first sync (Checklist + Sync now + Real metrics preview)
 * 5. Enter the dashboard (Transition to two-tab dashboard)
 *
 * Local-first persistence. Resumes at saved step if interrupted.
 */
export default function OnboardingFlow({ onComplete }) {
  const { userProfile, updateProfile } = useAuth();

  // Resume at saved step or start at step 1
  const [step, setStep] = useState(() => {
    try {
      const savedStep = parseInt(localStorage.getItem("nutritrack_onboarding_step"), 10);
      return savedStep >= 1 && savedStep <= 5 ? savedStep : 1;
    } catch {
      return 1;
    }
  });

  // Step 2: User details
  const [name, setName] = useState(() => {
    return localStorage.getItem("nutritrack_user_name") || userProfile?.name || "";
  });
  const [displayName, setDisplayName] = useState("");
  const [nameError, setNameError] = useState("");

  // Step 3: Permissions state
  const [permissionStatus, setPermissionStatus] = useState(null);
  const [requestingPerms, setRequestingPerms] = useState(false);

  // Step 4: First sync state
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [syncError, setSyncError] = useState(null);

  // Persist current step
  useEffect(() => {
    try {
      localStorage.setItem("nutritrack_onboarding_step", String(step));
    } catch (e) {
      console.warn("Could not save onboarding step:", e);
    }
  }, [step]);

  // Check initial permissions status when entering step 3
  useEffect(() => {
    if (step === 3) {
      checkHealthPermissions().then((res) => {
        setPermissionStatus(res);
      });
    }
  }, [step]);

  // Handle Step 2 Submission
  const handleSaveDetails = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError("Please enter your name to personalize your health dashboard.");
      return;
    }
    setNameError("");

    try {
      const finalName = displayName.trim() || trimmed;
      localStorage.setItem("nutritrack_user_name", finalName);
      if (updateProfile) {
        await updateProfile({
          name: finalName,
          displayName: finalName
        });
      }
      setStep(3);
    } catch (err) {
      console.warn("Could not save profile name:", err);
      setStep(3);
    }
  };

  // Handle Step 3 Permission Request
  const handleRequestPermissions = async () => {
    setRequestingPerms(true);
    try {
      const res = await requestHealthPermissions();
      setPermissionStatus(res);
    } catch (err) {
      console.warn("Permission request error:", err);
    } finally {
      setRequestingPerms(false);
    }
  };

  // Handle Step 4 First Sync
  const handleFirstSync = async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      const res = await syncNativeHealthConnect();
      setSyncResult(res);
      if (!res.success && res.reason) {
        setSyncError(res.reason);
      }
    } catch (err) {
      console.error("First sync exception:", err);
      setSyncError(err?.message || "Sync encountered an error.");
    } finally {
      setSyncing(false);
    }
  };

  // Handle Step 5 Completion
  const handleFinishOnboarding = () => {
    try {
      localStorage.setItem("nutritrack_onboarding_completed", "true");
      localStorage.removeItem("nutritrack_onboarding_step");
    } catch (e) {
      console.warn("Could not set onboarding completed flag:", e);
    }
    if (typeof onComplete === "function") {
      onComplete();
    }
  };

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-container">
        {/* Progress Bar (Steps 1 to 5) */}
        <div className="onboarding-progress-bar">
          {[1, 2, 3, 4, 5].map((s) => (
            <div
              key={s}
              className={`onboarding-progress-segment ${s <= step ? "active" : ""}`}
            />
          ))}
        </div>

        {/* ==================== SCREEN 1: WELCOME ==================== */}
        {step === 1 && (
          <div className="onboarding-card onboarding-screen-welcome">
            <div className="onboarding-brand-pill">
              <span className="onboarding-brand-dot" />
              <span>NUTRITRACK</span>
            </div>

            {/* Stylized Modern Fitness Visual */}
            <div className="onboarding-hero-art">
              <svg width="180" height="150" viewBox="0 0 180 150" fill="none">
                <defs>
                  <linearGradient id="artFlameGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#ef4444" />
                    <stop offset="100%" stopColor="#ea580c" />
                  </linearGradient>
                  <linearGradient id="artTealGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#06b6d4" />
                    <stop offset="100%" stopColor="#10b981" />
                  </linearGradient>
                </defs>
                {/* Concentric rings */}
                <circle cx="90" cy="75" r="60" stroke="#27272a" strokeWidth="6" opacity="0.4" />
                <circle
                  cx="90"
                  cy="75"
                  r="60"
                  stroke="url(#artFlameGrad)"
                  strokeWidth="6"
                  strokeDasharray="377"
                  strokeDashoffset="120"
                  strokeLinecap="round"
                />
                <circle cx="90" cy="75" r="44" stroke="#27272a" strokeWidth="6" opacity="0.4" />
                <circle
                  cx="90"
                  cy="75"
                  r="44"
                  stroke="url(#artTealGrad)"
                  strokeWidth="6"
                  strokeDasharray="276"
                  strokeDashoffset="80"
                  strokeLinecap="round"
                />
                <circle cx="90" cy="75" r="28" fill="#18181b" stroke="#3f3f46" strokeWidth="2" />
                {/* Heart pulse icon */}
                <path
                  d="M80 75 L86 75 L89 68 L92 82 L95 72 L98 75 L102 75"
                  stroke="#ef4444"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <h1 className="onboarding-title">Your health. Your way.</h1>
            <p className="onboarding-subtitle">
              Bring your daily activity and nutrition together in one place.
            </p>

            <div className="onboarding-features-list">
              <div className="onboarding-feature-item">
                <Footprints size={16} className="text-cyan" />
                <span>Universal smartwatch step &amp; active burn synchronization</span>
              </div>
              <div className="onboarding-feature-item">
                <Flame size={16} className="text-coral" />
                <span>Evidence-based macro targets and intelligent nutrition accounting</span>
              </div>
              <div className="onboarding-feature-item">
                <Shield size={16} className="text-emerald" />
                <span>Local-first, privacy-respecting storage on your device</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setStep(2)}
              className="cmf-btn-primary onboarding-btn-cta"
            >
              <span>Get started</span>
              <ArrowRight size={16} />
            </button>
          </div>
        )}

        {/* ==================== SCREEN 2: PERSONAL DETAILS ==================== */}
        {step === 2 && (
          <div className="onboarding-card onboarding-screen-details">
            <div className="onboarding-step-header">
              <span className="onboarding-step-tag">Step 1 of 4</span>
              <h2 className="onboarding-title">What should we call you?</h2>
              <p className="onboarding-subtitle">
                We use your name for personalized greetings and your athlete profile.
              </p>
            </div>

            <form onSubmit={handleSaveDetails} className="onboarding-form">
              <div className="cmf-input-group">
                <label className="cmf-label">
                  Your Full Name <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (nameError) setNameError("");
                  }}
                  className={`cmf-input ${nameError ? "input-error" : ""}`}
                  placeholder="e.g. Alex Rivera"
                  autoFocus
                />
                {nameError && (
                  <span className="onboarding-error-msg">{nameError}</span>
                )}
              </div>

              <div className="cmf-input-group" style={{ marginTop: "12px" }}>
                <label className="cmf-label">
                  Preferred Display Name <span style={{ color: "#71717a" }}>(Optional)</span>
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="cmf-input"
                  placeholder="e.g. Alex"
                />
                <span className="cmf-helper-text" style={{ fontSize: "0.74rem", color: "#71717a", marginTop: "4px" }}>
                  Used for greetings on your daily dashboard. You can edit this anytime in Settings.
                </span>
              </div>

              <div className="onboarding-btn-row">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="cmf-btn-secondary"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="cmf-btn-primary"
                  style={{ flex: 1 }}
                >
                  <span>Continue</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ==================== SCREEN 3: CONNECT HEALTH DATA ==================== */}
        {step === 3 && (
          <div className="onboarding-card onboarding-screen-perms">
            <div className="onboarding-step-header">
              <span className="onboarding-step-tag">Step 2 of 4</span>
              <h2 className="onboarding-title">Connect health data</h2>
              <p className="onboarding-subtitle">
                NutriTrack reads activity through Google Health Connect. We only request permissions necessary to calculate your daily energy budget:
              </p>
            </div>

            {/* Permissions list with explanations */}
            <div className="onboarding-perms-list">
              <div className="onboarding-perm-item">
                <div className="onboarding-perm-icon text-cyan">
                  <Footprints size={18} />
                </div>
                <div className="onboarding-perm-text">
                  <div className="onboarding-perm-title">
                    <strong>Daily Steps Count</strong>
                    {permissionStatus?.hasSteps && <CheckCircle size={14} className="text-emerald" />}
                  </div>
                  <span>Quantifies daily non-exercise physical movement (NEAT).</span>
                </div>
              </div>

              <div className="onboarding-perm-item">
                <div className="onboarding-perm-icon text-coral">
                  <Flame size={18} />
                </div>
                <div className="onboarding-perm-text">
                  <div className="onboarding-perm-title">
                    <strong>Active Calories &amp; Distance</strong>
                    {permissionStatus?.hasCalories && <CheckCircle size={14} className="text-emerald" />}
                  </div>
                  <span>Measures energy burned during workouts and aerobic travel.</span>
                </div>
              </div>

              <div className="onboarding-perm-item">
                <div className="onboarding-perm-icon text-teal">
                  <Timer size={18} />
                </div>
                <div className="onboarding-perm-text">
                  <div className="onboarding-perm-title">
                    <strong>Exercise &amp; Workout Sessions</strong>
                    {permissionStatus?.hasWorkout && <CheckCircle size={14} className="text-emerald" />}
                  </div>
                  <span>Identifies dedicated sports, running, and gym training sessions.</span>
                </div>
              </div>

              <div className="onboarding-perm-item">
                <div className="onboarding-perm-icon text-coral">
                  <Heart size={18} />
                </div>
                <div className="onboarding-perm-text">
                  <div className="onboarding-perm-title">
                    <strong>Heart Rate Records</strong>
                    {permissionStatus?.hasHeartRate && <CheckCircle size={14} className="text-emerald" />}
                  </div>
                  <span>Tracks cardiovascular exertion and intensity throughout the day.</span>
                </div>
              </div>

              <div className="onboarding-perm-item">
                <div className="onboarding-perm-icon text-purple">
                  <Moon size={18} />
                </div>
                <div className="onboarding-perm-text">
                  <div className="onboarding-perm-title">
                    <strong>Sleep Duration</strong>
                    {permissionStatus?.hasSleep && <CheckCircle size={14} className="text-emerald" />}
                  </div>
                  <span>Assesses nightly recovery to contextualize appetite and fatigue.</span>
                </div>
              </div>
            </div>

            <div className="onboarding-notice-box">
              <Info size={14} className="text-teal" />
              <span>
                Permissions are optional and non-blocking. Available metrics depend on what your smartwatch companion app exports to Health Connect.
              </span>
            </div>

            <div className="onboarding-actions-stack">
              <button
                type="button"
                onClick={handleRequestPermissions}
                disabled={requestingPerms}
                className="cmf-btn-primary onboarding-btn-full"
              >
                <Shield size={16} />
                <span>{requestingPerms ? "Requesting Permissions..." : "Grant Permissions"}</span>
              </button>

              <button
                type="button"
                onClick={() => openHealthConnectSettings()}
                className="cmf-btn-secondary onboarding-btn-full"
              >
                <ExternalLink size={14} />
                <span>Open Health Connect Settings</span>
              </button>

              <button
                type="button"
                onClick={() => setStep(4)}
                className="onboarding-link-btn"
              >
                {permissionStatus?.hasPermissions ? "Continue to Watch Setup →" : "Skip / Continue Anyway →"}
              </button>
            </div>
          </div>
        )}

        {/* ==================== SCREEN 4: WATCH SETUP & FIRST SYNC ==================== */}
        {step === 4 && (
          <div className="onboarding-card onboarding-screen-sync">
            <div className="onboarding-step-header">
              <span className="onboarding-step-tag">Step 3 of 4</span>
              <h2 className="onboarding-title">Watch setup &amp; first sync</h2>
              <p className="onboarding-subtitle">
                Ensure your watch has synced with its manufacturer app, then perform your first Health Connect import:
              </p>
            </div>

            {/* Checklist */}
            <div className="cmf-checklist-list">
              <div className="cmf-checklist-step">
                <div className="cmf-step-num">1</div>
                <div className="cmf-step-content">
                  <strong>Pair watch with its companion app</strong>
                  <span>Nothing X, Samsung Health, Garmin Connect, Fitbit, Zepp, etc.</span>
                </div>
              </div>

              <div className="cmf-checklist-step">
                <div className="cmf-step-num">2</div>
                <div className="cmf-step-content">
                  <strong>Enable Health Connect sharing</strong>
                  <span>In your watch app settings, turn on synchronization to Google Health Connect.</span>
                </div>
              </div>

              <div className="cmf-checklist-step">
                <div className="cmf-step-num">3</div>
                <div className="cmf-step-content">
                  <strong>Grant NutriTrack read access</strong>
                  <span>Ensure steps and health records are authorized.</span>
                </div>
              </div>

              <div className="cmf-checklist-step">
                <div className="cmf-step-num">4</div>
                <div className="cmf-step-content">
                  <strong>Tap &ldquo;Sync now&rdquo; below</strong>
                  <span>NutriTrack reads only verified records without fabricating data.</span>
                </div>
              </div>
            </div>

            {/* Sync Action & Live Results Preview */}
            <div className="onboarding-sync-box">
              <button
                type="button"
                onClick={handleFirstSync}
                disabled={syncing}
                className="cmf-btn-primary onboarding-btn-full"
              >
                <RefreshCw size={16} className={syncing ? "animate-spin" : ""} />
                <span>{syncing ? "Reading Health Connect..." : "Sync Now"}</span>
              </button>

              {/* Sync Results Preview */}
              {syncResult && (
                <div className="onboarding-sync-results">
                  <div className="onboarding-results-header">
                    <CheckCircle size={15} className="text-emerald" />
                    <strong>Synchronization Complete</strong>
                  </div>

                  <div className="onboarding-metrics-preview-grid">
                    <div className="onboarding-metric-chip">
                      <span className="chip-label">Daily Steps</span>
                      <strong className="chip-val">
                        {syncResult.summary?.todaySteps !== null
                          ? `${syncResult.summary.todaySteps.toLocaleString()} steps`
                          : "Not recorded"}
                      </strong>
                    </div>

                    <div className="onboarding-metric-chip">
                      <span className="chip-label">Active Burn</span>
                      <strong className="chip-val">
                        {syncResult.summary?.totalCalorieSamples > 0
                          ? "Recorded"
                          : "None"}
                      </strong>
                    </div>

                    <div className="onboarding-metric-chip">
                      <span className="chip-label">Heart Rate</span>
                      <strong className="chip-val">
                        {syncResult.summary?.heartRate?.todayLatestBpm
                          ? `${syncResult.summary.heartRate.todayLatestBpm} bpm`
                          : "None in HC"}
                      </strong>
                    </div>

                    <div className="onboarding-metric-chip">
                      <span className="chip-label">Companion</span>
                      <strong className="chip-val">
                        {syncResult.detectedCompanion || "Health Connect"}
                      </strong>
                    </div>
                  </div>

                  {syncResult.summary?.todaySteps === null && (
                    <p className="onboarding-sync-hint">
                      No steps found for today yet. Make sure your watch has synced with its companion app, then sync again.
                    </p>
                  )}
                </div>
              )}

              {syncError && (
                <div className="onboarding-sync-error">
                  <AlertCircle size={14} className="text-coral" />
                  <span>{syncError}</span>
                </div>
              )}
            </div>

            <div className="onboarding-btn-row" style={{ marginTop: "16px" }}>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="cmf-btn-secondary"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep(5)}
                className="cmf-btn-primary"
                style={{ flex: 1 }}
              >
                <span>Continue</span>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ==================== SCREEN 5: ENTER DASHBOARD ==================== */}
        {step === 5 && (
          <div className="onboarding-card onboarding-screen-finish">
            <div className="onboarding-finish-icon-wrap">
              <Sparkles size={28} className="text-coral" />
            </div>

            <h1 className="onboarding-title">Welcome to NutriTrack!</h1>
            <p className="onboarding-subtitle">
              You are ready to explore your two-tab dashboard:
            </p>

            <div className="onboarding-summary-box">
              <div className="onboarding-summary-row">
                <span className="text-muted">Athlete</span>
                <strong>{localStorage.getItem("nutritrack_user_name") || userProfile?.name || "Athlete"}</strong>
              </div>
              <div className="onboarding-summary-row">
                <span className="text-muted">Health Connect</span>
                <strong style={{ color: "#10b981" }}>Ready &amp; Configured</strong>
              </div>
              <div className="onboarding-summary-row">
                <span className="text-muted">Navigation</span>
                <strong>2 Main Tabs: My devices &bull; Health</strong>
              </div>
            </div>

            <p style={{ fontSize: "0.76rem", color: "#71717a", textAlign: "center", margin: "14px 0" }}>
              You can adjust daily calorie targets, step goals, and permission settings anytime via the top avatar profile icon.
            </p>

            <button
              type="button"
              onClick={handleFinishOnboarding}
              className="cmf-btn-primary onboarding-btn-cta"
            >
              <span>Enter NutriTrack</span>
              <ArrowRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
