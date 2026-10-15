import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import {
  getActivityLogs,
  getHistoricalActivityLogs,
  upsertActivityLog,
  getWearableConnection,
  saveWearableConnection,
  disconnectWearable,
  addWeightLog
} from "../services/dbService";
import {
  aggregateDailyActivity,
  calculateEnergyBalance
} from "../utils/nutritionCalculators";
import {
  detectHealthConnectEnvironment,
  checkHealthAvailability,
  checkHealthPermissions,
  requestHealthPermissions,
  syncNativeHealthConnect,
  parseHealthConnectExportJson,
  parseHealthConnectExportCsv,
  parseHealthConnectExport,
  syncHealthConnectRecordsToFirestore,
  HEALTH_CONNECT_PERMISSIONS,
  resolveCompanionSource,
  identifyWatchDevice,
  openHealthConnectSettings,
  getLocalDateString
} from "../services/healthConnectBridge";
import UniversalWatchGraphic from "../components/UniversalWatchGraphic";
import ActivityStadiumProgress from "../components/ActivityStadiumProgress";
import {
  Watch,
  Activity,
  Footprints,
  Flame,
  Route,
  Timer,
  RefreshCw,
  Upload,
  Plus,
  Trash2,
  CheckCircle,
  AlertCircle,
  Shield,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Info,
  Heart,
  Moon,
  Scale,
  Settings,
  Sliders,
  HelpCircle,
  ExternalLink
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from "recharts";

export default function DeviceTab() {
  const { currentUser, userProfile } = useAuth();
  const { showToast } = useToast();

  const effectiveUserId = currentUser?.uid || "demo_athlete_01";

  const [selectedDate, setSelectedDate] = useState(() => getLocalDateString(new Date()));
  const [dailyLogs, setDailyLogs] = useState([]);
  const [historicalLogs, setHistoricalLogs] = useState([]);
  const [connection, setConnection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState(null);
  const lastFeedbackMessageRef = useRef(null);

  // Modals state
  const [showImportModal, setShowImportModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [showDiagnosticsModal, setShowDiagnosticsModal] = useState(false);
  const [showEnergyModeModal, setShowEnergyModeModal] = useState(false);
  const [showPairingModal, setShowPairingModal] = useState(false);
  const [showHeartRateInfoModal, setShowHeartRateInfoModal] = useState(false);

  const [lastSyncDiagnostics, setLastSyncDiagnostics] = useState(() => {
    try {
      const stored = localStorage.getItem("nutritrack_last_health_sync_diagnostics");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  // Manual Activity Log State
  const [manualMetric, setManualMetric] = useState("steps");
  const [manualValue, setManualValue] = useState("");
  const [manualDate, setManualDate] = useState(selectedDate);
  const [manualSubmitting, setManualSubmitting] = useState(false);

  // Import File State
  const [importing, setImporting] = useState(false);
  const [importFeedback, setImportFeedback] = useState(null);

  const env = detectHealthConnectEnvironment();

  // Load daily activity & wearable connection
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setLoading(true);
      try {
        const [dayLogs, histLogs, conn] = await Promise.all([
          getActivityLogs(effectiveUserId, selectedDate),
          getHistoricalActivityLogs(effectiveUserId, 14),
          getWearableConnection(effectiveUserId)
        ]);

        if (isMounted) {
          setDailyLogs(dayLogs || []);
          setHistoricalLogs(histLogs || []);
          setConnection(conn);
        }
      } catch (err) {
        console.error("Error loading activity logs:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();
    return () => { isMounted = false; };
  }, [effectiveUserId, selectedDate]);

  // Aggregated Daily Metrics
  const activitySummary = aggregateDailyActivity(dailyLogs);

  // Energy Balance Calculation
  const energyBalance = calculateEnergyBalance({
    targetCalories: userProfile?.dailyCalorieTarget || 2000,
    activityData: activitySummary,
    accountingMode: connection?.energyAccountingMode || "strict_tdee"
  });

  const stepGoal = userProfile?.dailyStepGoal || 9000;
  const currentSteps = activitySummary.steps;
  const stepsRemaining = currentSteps !== null ? Math.max(0, stepGoal - currentSteps) : null;
  const stepsPercent = currentSteps !== null ? Math.min(100, Math.round((currentSteps / stepGoal) * 100)) : null;

  // Date Navigation
  const changeDateBy = (days) => {
    const [y, m, d] = selectedDate.split("-").map(Number);
    const cur = new Date(y, m - 1, d);
    cur.setDate(cur.getDate() + days);
    setSelectedDate(getLocalDateString(cur));
  };

  const isToday = selectedDate === getLocalDateString(new Date());

  // Native Health Connect Synchronization
  const handleNativeSync = async () => {
    setSyncFeedback(null);
    setSyncing(true);

    try {
      const availability = await checkHealthAvailability();

      if (!availability.available && availability.platform === "web") {
        const webMsg = "Running in web browser. For direct Health Connect sync, use the installed Android APK or import data below.";
        setSyncFeedback({
          type: "info",
          title: "Web Browser Mode",
          message: webMsg
        });
        showToast("Web Browser Mode", webMsg, "info", 5000);
        setShowImportModal(true);
        return;
      }

      if (!availability.available) {
        const errorMsg = availability.reason || "Android Health Connect is not available on this device.";
        setSyncFeedback({
          type: "error",
          title: "Health Connect Unavailable",
          message: errorMsg
        });
        showToast("Health Connect Unavailable", errorMsg, "warning", 6000);
        return;
      }

      showToast("Connecting...", "Reading activity records from Health Connect...", "info", 4000);
      const result = await syncNativeHealthConnect(effectiveUserId, { days: 14 });

      if (!result.success) {
        const warnMsg = result.reason || "Could not read records from Health Connect.";
        setSyncFeedback({
          type: "warning",
          title: "Sync Permissions Needed",
          message: warnMsg
        });
        showToast("Sync Notice", warnMsg, "warning", 6000);
        return;
      }

      const todayStepLog = (result.records || []).find(r => r.date === selectedDate && r.metricType === "steps");
      const stepsError = result.summary?.todayStepsQueryError || result.summary?.rangeStepsQueryError;
      const stepsDenied = result.stepsPermissionDenied || result.summary?.stepsAuthStatus === "DENIED";

      if (result.summary) {
        setLastSyncDiagnostics({
          syncedAt: new Date().toISOString(),
          userId: effectiveUserId,
          summary: result.summary,
          detectedCompanion: result.detectedCompanion,
          recordsGenerated: result.records?.length || 0,
          stepsPermissionDenied: stepsDenied
        });
      }

      let successMsg = "";
      let toastType = "success";

      if (todayStepLog) {
        successMsg = `Synced ${todayStepLog.value.toLocaleString()} steps today from ${result.detectedCompanion || "smartwatch"}.`;
      } else if (stepsDenied) {
        successMsg = `Health Connect READ_STEPS permission is not granted. Please open Permissions to allow daily steps.`;
        toastType = "warning";
      } else if (stepsError) {
        successMsg = `Steps sync notice: ${stepsError}. Other metrics synchronized.`;
        toastType = "warning";
      } else if (result.count > 0) {
        successMsg = `Synchronized ${result.count} records from ${result.detectedCompanion || "smartwatch"} via Health Connect.`;
      } else {
        successMsg = result.message || "Connected to Health Connect! No activity records were recorded yet in this time frame.";
      }

      // Present clear, dismissible inline feedback without repeating identical stacked toasts
      setSyncFeedback({
        type: toastType,
        title: toastType === "success" ? "Sync Complete!" : "Sync Completed with Notice",
        message: successMsg
      });

      if (lastFeedbackMessageRef.current !== successMsg || toastType === "success") {
        showToast(
          toastType === "success" ? "Health Connect Synced!" : "Sync Completed with Notice",
          successMsg,
          toastType,
          5000
        );
        lastFeedbackMessageRef.current = successMsg;
      }

      // Reload state from database
      const [updatedDay, updatedHist, updatedConn] = await Promise.all([
        getActivityLogs(effectiveUserId, selectedDate),
        getHistoricalActivityLogs(effectiveUserId, 14),
        getWearableConnection(effectiveUserId)
      ]);
      setDailyLogs(updatedDay || []);
      setHistoricalLogs(updatedHist || []);
      if (updatedConn) setConnection(updatedConn);
    } catch (err) {
      console.error("Native Health Connect sync error:", err);
      const errText = err?.message || "Error syncing Health Connect data.";
      setSyncFeedback({
        type: "error",
        title: "Sync Error",
        message: errText
      });
      showToast("Sync Error", errText, "error", 5000);
    } finally {
      setSyncing(false);
    }
  };

  // Reconnect Watch action
  const handleReconnect = async () => {
    setSyncFeedback(null);
    setSyncing(true);
    try {
      const availability = await checkHealthAvailability();
      if (!availability.available && availability.platform === "web") {
        showToast("Web Browser Mode", "On desktop/web, use Import File or Manual Log.", "info");
        setShowImportModal(true);
        return;
      }

      const permCheck = await checkHealthPermissions();
      if (!permCheck.hasPermissions) {
        showToast("Permissions Needed", "Opening Health Connect permissions prompt...", "info", 4000);
        const reqResult = await requestHealthPermissions();
        if (!reqResult.success) {
          showToast("Permissions Needed", "Please allow permissions in Android Health Connect settings.", "warning", 6000);
          setShowPermissionsModal(true);
          return;
        }
      }

      showToast("Reconnected", "Reading latest activity records...", "info", 3000);
      await handleNativeSync();
    } catch (err) {
      console.error("Reconnect error:", err);
      showToast("Reconnect Failed", err?.message || "Failed to verify connection.", "error");
    } finally {
      setSyncing(false);
    }
  };

  // Disconnect action
  const handleDisconnect = async () => {
    if (confirm("Disconnect smartwatch integration? Health data will stop synchronizing until reconnected.")) {
      await disconnectWearable(effectiveUserId);
      setConnection((prev) => ({ ...prev, isConnected: false }));
      showToast("Disconnected", "Health Connect synchronization disabled.", "warning");
    }
  };

  // Manual Activity Submission
  const handleManualSubmit = async (e) => {
    e.preventDefault();
    const val = parseFloat(manualValue);
    if (isNaN(val) || val <= 0) {
      showToast("Invalid Value", "Please enter a positive numeric value.", "warning");
      return;
    }

    const unitMap = {
      steps: "count",
      active_calories: "kcal",
      distance_meters: "meters",
      workout_duration_minutes: "minutes"
    };

    setManualSubmitting(true);
    try {
      const now = new Date().toISOString();
      const newLog = await upsertActivityLog(effectiveUserId, {
        date: manualDate,
        metricType: manualMetric,
        value: val,
        unit: unitMap[manualMetric] || "count",
        source: "manual_entry",
        recordedTimestamp: `${manualDate}T12:00:00.000Z`,
        lastSyncedTimestamp: now,
        metadata: { enteredBy: "user_manual_entry" }
      });

      if (manualDate === selectedDate) {
        setDailyLogs((prev) => {
          const filtered = prev.filter(
            (l) => !(l.date === manualDate && l.metricType === manualMetric && l.source === "manual_entry")
          );
          return [...filtered, newLog];
        });
      }

      showToast("Activity Recorded", `Successfully saved ${val} ${unitMap[manualMetric]} for ${manualDate}.`, "success");
      setManualValue("");
      setShowManualModal(false);
    } catch (err) {
      console.error("Manual activity save error:", err);
      showToast("Save Failed", err?.message || "Could not save manual entry.", "error");
    } finally {
      setManualSubmitting(false);
    }
  };

  // File Import Handler
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportFeedback(null);

    try {
      const text = await file.text();
      let parsed = [];

      if (file.name.endsWith(".json")) {
        parsed = parseHealthConnectExportJson(text, effectiveUserId);
      } else if (file.name.endsWith(".csv")) {
        parsed = parseHealthConnectExportCsv(text, effectiveUserId);
      } else {
        parsed = parseHealthConnectExport(text, effectiveUserId);
      }

      if (parsed.length === 0) {
        setImportFeedback({ type: "warning", message: "No compatible activity records found in this file." });
        return;
      }

      const res = await syncHealthConnectRecordsToFirestore(effectiveUserId, parsed);
      const updatedDay = await getActivityLogs(effectiveUserId, selectedDate);
      setDailyLogs(updatedDay || []);

      setImportFeedback({
        type: "success",
        message: `Successfully imported ${res.count} activity record(s) from "${file.name}".`
      });
      showToast("Import Success", `Imported ${res.count} records.`, "success");
    } catch (err) {
      console.error("File import error:", err);
      setImportFeedback({ type: "error", message: err?.message || "Failed to parse import file." });
      showToast("Import Error", err?.message || "Could not read file.", "error");
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  // Energy Accounting Mode Change
  const handleAccountingModeChange = async (mode) => {
    try {
      const updated = await saveWearableConnection(effectiveUserId, {
        energyAccountingMode: mode
      });
      setConnection(updated);
      showToast(
        "Energy Accounting Updated",
        mode === "strict_tdee"
          ? "Target fixed to scientific TDEE baseline. Prevents overeating."
          : "Target adjusts dynamically with wearable active burn.",
        "success"
      );
      setShowEnergyModeModal(false);
    } catch (err) {
      console.error("Failed to update accounting mode:", err);
    }
  };

  const recordsForIdentification = (dailyLogs && dailyLogs.length > 0)
    ? dailyLogs
    : (historicalLogs && historicalLogs.length > 0 ? historicalLogs : []);
  const identifiedDevice = identifyWatchDevice(recordsForIdentification, [
    connection?.companionApp,
    connection?.deviceModel,
    connection?.sourceName
  ]);
  const deviceName = identifiedDevice.isReliablyIdentified
    ? identifiedDevice.model
    : (connection?.deviceModel || "Health Connect Device");

  return (
    <div className="cmf-device-tab-container">
      {/* 1. Top Connected Device Card matching Screenshot 1 */}
      <section className="cmf-device-hero-card">
        {/* Device Header Bar: Mini Watch thumbnail + Connection indicator + Settings/Action */}
        <div className="cmf-device-top-bar">
          <div className="cmf-device-badge-wrap">
            <div className="cmf-mini-watch-thumb">
              <Watch size={18} className="text-white" />
              <span
                className={`cmf-status-dot ${connection?.isConnected ? "cmf-dot-connected" : "cmf-dot-disconnected"}`}
              />
            </div>
            <span className="cmf-device-status-text">
              {connection?.isConnected
                ? (identifiedDevice.isReliablyIdentified ? `${identifiedDevice.brand} Synced` : "Health Connect Active")
                : env.isCapacitor
                ? "Permission Needed"
                : "Browser Mode"}
            </span>
          </div>

          <div className="cmf-device-top-actions">
            <button
              type="button"
              onClick={() => setShowPairingModal(true)}
              className="cmf-round-action-btn"
              title="Pair Watch & Health Connect Guide"
              aria-label="Pair Watch"
              style={{ marginRight: "6px" }}
            >
              <Watch size={16} />
            </button>
            <button
              type="button"
              onClick={() => setShowDiagnosticsModal(true)}
              className="cmf-round-action-btn"
              title="Health Connect Diagnostics"
              aria-label="Diagnostics"
            >
              <Activity size={16} />
            </button>
          </div>
        </div>

        {/* Dynamic Universal Watch Hardware Graphic */}
        <UniversalWatchGraphic
          watchType={identifiedDevice.type}
          isConnected={connection?.isConnected}
          stepProgress={currentSteps && stepGoal ? currentSteps / stepGoal : 0}
        />

        {/* Device Name Title */}
        <h2 className="cmf-device-name-title">{deviceName}</h2>

        {/* Dynamic sync status indicator (replaces hardcoded 64%) */}
        <div className="cmf-battery-status-row">
          <div className="cmf-slider-notch" />
          <span className="cmf-battery-text">
            {syncing
              ? "Syncing..."
              : connection?.lastSyncedTimestamp
              ? `Synced • ${new Date(connection.lastSyncedTimestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
              : "Standby"}
          </span>
        </div>

        {/* Sync Now Action Banner */}
        <div className="cmf-sync-action-banner">
          <button
            type="button"
            onClick={handleNativeSync}
            disabled={syncing}
            className="cmf-btn-primary cmf-sync-pill-btn"
          >
            <RefreshCw size={16} className={syncing ? "animate-spin" : ""} />
            <span>{syncing ? "Syncing Health Connect..." : "Sync Now"}</span>
          </button>

          <span className="cmf-last-sync-caption">
            Last Synced:{" "}
            {connection?.lastSyncedTimestamp || activitySummary.lastSyncedTimestamp
              ? new Date(connection?.lastSyncedTimestamp || activitySummary.lastSyncedTimestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  month: "short",
                  day: "numeric"
                })
              : "Never"}
          </span>
        </div>

        {/* Live sync notice banner if notice/warning exists */}
        {syncFeedback && (
          <div className={`cmf-sync-feedback-banner ${syncFeedback.type}`}>
            <div className="cmf-feedback-text">
              <strong>{syncFeedback.title}:</strong> {syncFeedback.message}
            </div>
            <button
              type="button"
              onClick={() => setSyncFeedback(null)}
              className="cmf-close-feedback-btn"
            >
              ✕
            </button>
          </div>
        )}
      </section>

      {/* 2. Date Navigation Bar */}
      <section className="cmf-date-nav-bar">
        <button
          type="button"
          onClick={() => changeDateBy(-1)}
          className="cmf-date-arrow-btn"
          aria-label="Previous Day"
        >
          <ChevronLeft size={18} />
        </button>

        <div className="cmf-date-display-wrap">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="cmf-date-picker-hidden"
            id="device-date-picker"
          />
          <label htmlFor="device-date-picker" className="cmf-date-label-clickable">
            <Calendar size={14} className="text-muted" />
            <span className="cmf-date-text">
              {isToday ? "Today" : new Date(selectedDate).toLocaleDateString("en-US", { month: "short", day: "numeric", weekday: "short" })}
            </span>
            <span className="cmf-date-sub">{selectedDate}</span>
          </label>
        </div>

        <button
          type="button"
          onClick={() => changeDateBy(1)}
          className="cmf-date-arrow-btn"
          aria-label="Next Day"
        >
          <ChevronRight size={18} />
        </button>
      </section>

      {/* 3. Steps Goal Visualization: CMF "Today's activities" Multi-Track Stadium Loop */}
      <section className="cmf-card cmf-activities-stadium-section">
        <div className="cmf-card-header-row">
          <h3 className="cmf-card-title">Today's activities</h3>
          <span className="cmf-card-badge">
            {stepsPercent !== null ? `${stepsPercent}% Goal` : "Steps"}
          </span>
        </div>

        <ActivityStadiumProgress
          calories={{
            current: activitySummary.activeCalories,
            target: 800,
            unit: "kcal"
          }}
          exercise={{
            current: activitySummary.workoutDurationMinutes,
            target: 30,
            unit: "min"
          }}
          secondary={{
            label: "Distance (km)",
            current: activitySummary.distanceKm,
            target: 6.0
          }}
          steps={{
            current: currentSteps,
            target: stepGoal
          }}
        />

        {/* Steps Goal Callout Subtext */}
        <div className="cmf-steps-goal-subtext">
          {currentSteps !== null ? (
            <span>
              <strong>{currentSteps.toLocaleString()}</strong> of <strong>{stepGoal.toLocaleString()}</strong> steps •{" "}
              {stepsRemaining === 0 ? "Goal Achieved! 🎉" : `${stepsRemaining?.toLocaleString()} steps remaining`}
            </span>
          ) : (
            <span className="text-muted">Not recorded in Health Connect for this date.</span>
          )}
        </div>
      </section>

      {/* 4. Daily Activity Metrics (2x2 Grid of CMF Cards) */}
      <section className="cmf-metrics-grid-2x2">
        {/* Steps Card */}
        <div className="cmf-metric-box">
          <div className="cmf-metric-box-top">
            <span className="cmf-metric-label">Daily Steps</span>
            <Footprints size={18} className="text-cyan" />
          </div>
          <div className="cmf-metric-box-number">
            {currentSteps !== null ? currentSteps.toLocaleString() : "Unavailable"}
          </div>
          <span className="cmf-metric-box-footer">
            {currentSteps !== null ? `${stepsPercent}% of ${stepGoal.toLocaleString()} goal` : "No steps recorded"}
          </span>
        </div>

        {/* Active Calories Card */}
        <div className="cmf-metric-box">
          <div className="cmf-metric-box-top">
            <span className="cmf-metric-label">Active Burn</span>
            <Flame size={18} className="text-coral" />
          </div>
          <div className="cmf-metric-box-number">
            {activitySummary.activeCalories !== null ? `${Math.round(activitySummary.activeCalories)}` : "Unavailable"}
            {activitySummary.activeCalories !== null && <small> kcal</small>}
          </div>
          <span className="cmf-metric-box-footer">
            {activitySummary.activeCalories !== null ? "Active burn above BMR" : "No active energy recorded"}
          </span>
        </div>

        {/* Distance Card */}
        <div className="cmf-metric-box">
          <div className="cmf-metric-box-top">
            <span className="cmf-metric-label">Distance</span>
            <Route size={18} className="text-emerald" />
          </div>
          <div className="cmf-metric-box-number">
            {activitySummary.distanceKm !== null ? `${activitySummary.distanceKm}` : "Unavailable"}
            {activitySummary.distanceKm !== null && <small> km</small>}
          </div>
          <span className="cmf-metric-box-footer">
            {activitySummary.distanceMeters !== null ? `${activitySummary.distanceMeters.toLocaleString()} m` : "No distance recorded"}
          </span>
        </div>

        {/* Workouts Card */}
        <div className="cmf-metric-box">
          <div className="cmf-metric-box-top">
            <span className="cmf-metric-label">Workouts</span>
            <Timer size={18} className="text-teal" />
          </div>
          <div className="cmf-metric-box-number">
            {activitySummary.workoutDurationMinutes !== null ? `${activitySummary.workoutDurationMinutes}` : "Unavailable"}
            {activitySummary.workoutDurationMinutes !== null && <small> mins</small>}
          </div>
          <span className="cmf-metric-box-footer">
            {activitySummary.workoutDurationMinutes !== null ? "Dedicated exercise sessions" : "No workouts recorded"}
          </span>
        </div>
      </section>

      {/* 5. Heart Rate & Sleep Metrics Grid */}
      <section className="cmf-metrics-grid-2x2" style={{ marginTop: "12px" }}>
        {/* Heart Rate Metric Box with Sparkline */}
        <div className="cmf-metric-box cmf-heart-rate-box">
          <div className="cmf-metric-box-top">
            <span className="cmf-metric-label">Heart Rate</span>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <button
                type="button"
                onClick={() => setShowHeartRateInfoModal(true)}
                className="cmf-info-icon-btn"
                title="Heart Rate Sync Info & Limitations"
                aria-label="Heart rate info"
              >
                <HelpCircle size={14} className="text-muted" />
              </button>
              <Heart size={18} className="text-coral" />
            </div>
          </div>
          <div className="cmf-metric-box-number">
            {(activitySummary.heartRateLatest !== null || activitySummary.heartRateAvg !== null) ? (
              <>
                {activitySummary.heartRateLatest ?? activitySummary.heartRateAvg} <small>bpm</small>
              </>
            ) : (
              <span style={{ fontSize: "1.05rem", color: "#a1a1aa" }}>Unavailable</span>
            )}
          </div>

          {(activitySummary.heartRateLatest !== null || activitySummary.heartRateAvg !== null) ? (
            <div className="cmf-hr-details-wrap">
              <span className="cmf-metric-box-footer">
                {activitySummary.heartRateMin ? `Min ${activitySummary.heartRateMin} • ` : ""}
                {activitySummary.heartRateMax ? `Max ${activitySummary.heartRateMax} • ` : ""}
                Avg {activitySummary.heartRateAvg || "--"} bpm
              </span>

              {/* Sparkline chart of daily BPM readings if >= 2 samples */}
              {activitySummary.heartRateSamples?.length >= 2 && (
                <div className="cmf-hr-sparkline-wrap" title={`${activitySummary.heartRateSamples.length} readings today`}>
                  <svg width="100%" height="26" viewBox="0 0 100 26" preserveAspectRatio="none" className="cmf-hr-sparkline">
                    <defs>
                      <linearGradient id="hrSparkGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ef4444" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#ef4444" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    {(() => {
                      const pts = activitySummary.heartRateSamples;
                      const minVal = Math.min(...pts.map((p) => p.bpm));
                      const maxVal = Math.max(...pts.map((p) => p.bpm));
                      const range = maxVal - minVal || 1;
                      const coords = pts.map((p, idx) => {
                        const x = (idx / (pts.length - 1)) * 100;
                        const y = 22 - ((p.bpm - minVal) / range) * 18;
                        return `${x.toFixed(1)},${y.toFixed(1)}`;
                      });
                      const polyPath = `M ${coords.join(" L ")}`;
                      const areaPath = `M 0,26 L ${coords.join(" L ")} L 100,26 Z`;
                      return (
                        <>
                          <path d={areaPath} fill="url(#hrSparkGrad)" />
                          <path d={polyPath} fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </>
                      );
                    })()}
                  </svg>
                </div>
              )}
            </div>
          ) : (
            <span className="cmf-metric-box-footer" style={{ color: "#71717a", fontSize: "0.72rem" }}>
              {lastSyncDiagnostics?.summary?.heartRate?.hasPermission === false
                ? "Permission needed • Tap Health Connect"
                : lastSyncDiagnostics?.summary?.heartRate?.isNothingXDetected
                ? "Nothing X limitation: Continuous HR is not exported"
                : "Not recorded in Health Connect for this date"}
            </span>
          )}
        </div>

        {/* Sleep Duration Card */}
        <div className="cmf-metric-box">
          <div className="cmf-metric-box-top">
            <span className="cmf-metric-label">Sleep Duration</span>
            <Moon size={18} className="text-purple" />
          </div>
          <div className="cmf-metric-box-number">
            {activitySummary.sleepDurationMinutes !== null ? (
              <>
                {Math.round((activitySummary.sleepDurationMinutes / 60) * 10) / 10} <small>hrs</small>
              </>
            ) : (
              <span style={{ fontSize: "1.05rem", color: "#a1a1aa" }}>Unavailable</span>
            )}
          </div>
          <span className="cmf-metric-box-footer">
            {activitySummary.sleepDurationMinutes !== null
              ? `${activitySummary.sleepDurationMinutes} mins total rest`
              : "No sleep recorded"}
          </span>
        </div>
      </section>

      {/* 6. Device Actions & Settings Grid matching Screenshot 2 */}
      <section className="cmf-actions-section">
        <h4 className="cmf-section-title">Device & Activity Controls</h4>
        <div className="cmf-actions-grid-2x2">
          {/* Watch Setup & Pairing Guide */}
          <div
            className="cmf-action-card"
            onClick={() => setShowPairingModal(true)}
          >
            <div>
              <div className="cmf-action-card-title">Watch Setup</div>
              <div className="cmf-action-card-sub">Pairing &amp; companion guide</div>
            </div>
            <div className="cmf-action-card-bottom">
              <Watch size={20} className="text-white" />
            </div>
          </div>

          {/* Permissions */}
          <div
            className="cmf-action-card"
            onClick={() => setShowPermissionsModal(true)}
          >
            <div>
              <div className="cmf-action-card-title">Health Connect</div>
              <div className="cmf-action-card-sub">Manage permissions</div>
            </div>
            <div className="cmf-action-card-bottom">
              <Shield size={20} className="text-white" />
            </div>
          </div>

          {/* Manual Activity Log */}
          <div
            className="cmf-action-card"
            onClick={() => setShowManualModal(true)}
          >
            <div>
              <div className="cmf-action-card-title">Manual Log</div>
              <div className="cmf-action-card-sub">Log activity manually</div>
            </div>
            <div className="cmf-action-card-bottom">
              <Plus size={20} className="text-white" />
            </div>
          </div>

          {/* Import File */}
          <div
            className="cmf-action-card"
            onClick={() => setShowImportModal(true)}
          >
            <div>
              <div className="cmf-action-card-title">Import Data</div>
              <div className="cmf-action-card-sub">JSON or CSV export</div>
            </div>
            <div className="cmf-action-card-bottom">
              <Upload size={20} className="text-white" />
            </div>
          </div>

          {/* Diagnostics */}
          <div
            className="cmf-action-card"
            onClick={() => setShowDiagnosticsModal(true)}
          >
            <div>
              <div className="cmf-action-card-title">Diagnostics</div>
              <div className="cmf-action-card-sub">Live sync logs &amp; debug</div>
            </div>
            <div className="cmf-action-card-bottom">
              <Activity size={20} className="text-white" />
            </div>
          </div>

          {/* Energy Accounting Strategy */}
          <div
            className="cmf-action-card"
            onClick={() => setShowEnergyModeModal(true)}
          >
            <div>
              <div className="cmf-action-card-title">Energy Strategy</div>
              <div className="cmf-action-card-sub">
                {connection?.energyAccountingMode === "strict_tdee" ? "Strict TDEE Baseline" : "Dynamic Net Burn"}
              </div>
            </div>
            <div className="cmf-action-card-bottom">
              <Flame size={20} className="text-coral" />
            </div>
          </div>

          {/* Reconnect Watch */}
          <div
            className="cmf-action-card"
            onClick={connection?.isConnected ? handleDisconnect : handleReconnect}
          >
            <div>
              <div className="cmf-action-card-title">
                {connection?.isConnected ? "Disconnect Watch" : "Reconnect Watch"}
              </div>
              <div className="cmf-action-card-sub">
                {connection?.isConnected ? "Tap to disconnect" : "Probe Health Connect"}
              </div>
            </div>
            <div className="cmf-action-card-bottom">
              <RefreshCw size={20} className={syncing ? "animate-spin text-coral" : "text-white"} />
            </div>
          </div>
        </div>
      </section>

      {/* 7. Historical 14-Day Activity Trends Chart */}
      {historicalLogs.length > 0 && (
        <section className="cmf-card cmf-trends-card">
          <h4 className="cmf-card-title" style={{ marginBottom: "14px" }}>14-Day Activity History</h4>
          <div style={{ width: "100%", height: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={historicalLogs} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                <XAxis
                  dataKey="date"
                  tickFormatter={(d) => d.slice(8)}
                  stroke="#71717a"
                  fontSize={10}
                  tickLine={false}
                />
                <YAxis stroke="#71717a" fontSize={10} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#18181b",
                    color: "#ffffff",
                    borderRadius: "8px",
                    border: "1px solid #27272a",
                    fontSize: "0.75rem"
                  }}
                />
                <Bar dataKey="steps" fill="#ff3b30" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* MODAL 1: PERMISSIONS MODAL */}
      {showPermissionsModal && (
        <div className="modal-overlay" onClick={() => setShowPermissionsModal(false)}>
          <div className="cmf-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="cmf-modal-header">
              <div className="cmf-modal-title-row">
                <Shield size={18} className="text-coral" />
                <h3 className="cmf-modal-title">Health Connect Permissions</h3>
              </div>
              <button type="button" onClick={() => setShowPermissionsModal(false)} className="cmf-close-btn">✕</button>
            </div>

            <div className="cmf-modal-body">
              <p style={{ fontSize: "0.82rem", color: "#a1a1aa", marginBottom: "14px" }}>
                NutriTrack synchronizes physical activity from Google Health Connect. Permissions are stored securely on this device and can be modified in Android Settings anytime.
              </p>

              <div className="cmf-perm-list">
                {HEALTH_CONNECT_PERMISSIONS.map((p) => (
                  <div key={p.id} className="cmf-perm-item">
                    <div>
                      <div className="cmf-perm-label">{p.label}</div>
                      <div className="cmf-perm-desc">{p.rationale}</div>
                    </div>
                    <span className="cmf-perm-badge">READ</span>
                  </div>
                ))}
              </div>

              <div className="cmf-modal-actions">
                <button
                  type="button"
                  onClick={async () => {
                    await requestHealthPermissions();
                    setShowPermissionsModal(false);
                    handleNativeSync();
                  }}
                  className="cmf-btn-primary"
                >
                  <Shield size={14} />
                  <span>Request All Permissions</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: MANUAL ACTIVITY LOG MODAL */}
      {showManualModal && (
        <div className="modal-overlay" onClick={() => setShowManualModal(false)}>
          <div className="cmf-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="cmf-modal-header">
              <div className="cmf-modal-title-row">
                <Plus size={18} className="text-coral" />
                <h3 className="cmf-modal-title">Manual Activity Entry</h3>
              </div>
              <button type="button" onClick={() => setShowManualModal(false)} className="cmf-close-btn">✕</button>
            </div>

            <form onSubmit={handleManualSubmit} className="cmf-modal-body">
              <div className="cmf-input-group">
                <label className="cmf-label">Metric</label>
                <select
                  value={manualMetric}
                  onChange={(e) => setManualMetric(e.target.value)}
                  className="cmf-input"
                >
                  <option value="steps">Daily Steps (count)</option>
                  <option value="active_calories">Active Calories Burned (kcal)</option>
                  <option value="distance_meters">Distance (meters)</option>
                  <option value="workout_duration_minutes">Workout Duration (minutes)</option>
                </select>
              </div>

              <div className="cmf-input-group">
                <label className="cmf-label">Value</label>
                <input
                  type="number"
                  value={manualValue}
                  onChange={(e) => setManualValue(e.target.value)}
                  placeholder="e.g. 7500"
                  className="cmf-input"
                  min="1"
                  step="any"
                  required
                />
              </div>

              <div className="cmf-input-group">
                <label className="cmf-label">Date</label>
                <input
                  type="date"
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                  className="cmf-input"
                  required
                />
              </div>

              <div className="cmf-modal-actions">
                <button type="submit" disabled={manualSubmitting} className="cmf-btn-primary">
                  {manualSubmitting ? "Saving..." : "Save Activity Record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: IMPORT DATA MODAL */}
      {showImportModal && (
        <div className="modal-overlay" onClick={() => setShowImportModal(false)}>
          <div className="cmf-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="cmf-modal-header">
              <div className="cmf-modal-title-row">
                <Upload size={18} className="text-coral" />
                <h3 className="cmf-modal-title">Import Health Connect File</h3>
              </div>
              <button type="button" onClick={() => setShowImportModal(false)} className="cmf-close-btn">✕</button>
            </div>

            <div className="cmf-modal-body">
              <p style={{ fontSize: "0.82rem", color: "#a1a1aa", marginBottom: "14px" }}>
                Import an exported JSON or CSV file from Google Health Connect, Google Takeout, or your companion app.
              </p>

              <div className="cmf-file-dropzone">
                <input
                  type="file"
                  accept=".json,.csv"
                  onChange={handleFileChange}
                  disabled={importing}
                  id="import-file-input"
                  style={{ display: "none" }}
                />
                <label htmlFor="import-file-input" className="cmf-dropzone-label">
                  <Upload size={24} className="text-coral" />
                  <span>{importing ? "Importing records..." : "Choose JSON or CSV file"}</span>
                </label>
              </div>

              {importFeedback && (
                <div className={`cmf-sync-feedback-banner ${importFeedback.type}`} style={{ marginTop: "12px" }}>
                  <span>{importFeedback.message}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: SYNC DIAGNOSTICS MODAL */}
      {showDiagnosticsModal && (
        <div className="modal-overlay" onClick={() => setShowDiagnosticsModal(false)}>
          <div className="cmf-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="cmf-modal-header">
              <div className="cmf-modal-title-row">
                <Activity size={18} className="text-coral" />
                <h3 className="cmf-modal-title">Sync Diagnostics</h3>
              </div>
              <button type="button" onClick={() => setShowDiagnosticsModal(false)} className="cmf-close-btn">✕</button>
            </div>

            <div className="cmf-modal-body" style={{ fontSize: "0.82rem", lineHeight: 1.6 }}>
              {/* Device and local calendar context */}
              <div className="cmf-diag-box">
                <div>Selected Date: <strong style={{ color: "#10b981" }}>{selectedDate}</strong></div>
                <div>Runtime Platform: <strong>{env.runtimeType}</strong></div>
                <div>Companion App: <strong>{connection?.companionApp || "Google Health Connect"}</strong></div>
                <div>Status: <strong>{connection?.isConnected ? "Connected" : "Disconnected"}</strong></div>
              </div>

              {/* Dedicated Today's-Steps Query & Time Range */}
              <div className="cmf-diag-box">
                <h5 style={{ margin: "0 0 6px", fontWeight: 700 }}>Today's Steps Query &amp; Time Range</h5>
                <div>Target Local Date: <strong>{lastSyncDiagnostics?.summary?.todayDate || selectedDate}</strong></div>
                <div>Query Start (UTC): <code>{lastSyncDiagnostics?.summary?.todayQueryStartIso || "N/A"}</code></div>
                <div>Query End (UTC): <code>{lastSyncDiagnostics?.summary?.todayQueryEndIso || "N/A"}</code></div>
                <div>
                  Range Validation:{" "}
                  <strong style={{ color: lastSyncDiagnostics?.summary?.todayQueryValidated ? "#10b981" : "#ef4444" }}>
                    {lastSyncDiagnostics?.summary?.todayQueryValidated ? "VALID (startTime < endTime, clamped)" : "PENDING / INVALID"}
                  </strong>
                </div>
                <div>Query Type: <code>{lastSyncDiagnostics?.summary?.todayStepsQueryType || "today_focused_clamped"}</code></div>
                <div>
                  Query Error:{" "}
                  <strong style={{ color: lastSyncDiagnostics?.summary?.todayStepsQueryError ? "#ef4444" : "#10b981" }}>
                    {lastSyncDiagnostics?.summary?.todayStepsQueryError || "None (Success)"}
                  </strong>
                </div>
                {lastSyncDiagnostics?.summary?.todayStepsTelemetry && (
                  <div style={{ fontSize: "0.74rem", color: "#a1a1aa", marginTop: "4px" }}>
                    Timestamps: {lastSyncDiagnostics.summary.todayStepsTelemetry.startMs}ms &rarr; {lastSyncDiagnostics.summary.todayStepsTelemetry.endMs}ms (earlier: {String(lastSyncDiagnostics.summary.todayStepsTelemetry.isStrictlyEarlier)})
                  </div>
                )}
                <div style={{ marginTop: "6px", paddingTop: "6px", borderTop: "1px solid #27272a" }}>
                  <div>Timezone: <strong>{lastSyncDiagnostics?.summary?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone}</strong></div>
                  <div>Raw Records: <strong>{lastSyncDiagnostics?.summary?.rawStepRecordsCount ?? 0}</strong></div>
                  <div>Invalid Skipped: <strong>{lastSyncDiagnostics?.summary?.invalidRecordsSkipped ?? 0}</strong></div>
                  <div>Valid Used: <strong>{lastSyncDiagnostics?.summary?.validStepRecordsUsed ?? 0}</strong></div>
                  <div style={{ marginTop: "6px", paddingTop: "6px", borderTop: "1px dashed #3f3f46" }}>
                    <div>Watch-Origin Total: <strong style={{ color: "#10b981" }}>{(lastSyncDiagnostics?.summary?.watchTotal ?? lastSyncDiagnostics?.summary?.stepsDiagnostic?.watchTotal ?? 0).toLocaleString()}</strong> steps</div>
                    <div>Phone-Origin Total: <strong style={{ color: "#f87171" }}>{(lastSyncDiagnostics?.summary?.phoneTotal ?? lastSyncDiagnostics?.summary?.stepsDiagnostic?.phoneTotal ?? 0).toLocaleString()}</strong> steps <span style={{ fontSize: "0.72rem", color: "#a1a1aa" }}>(Excluded)</span></div>
                    <div>Health Connect Aggregate: <strong>{lastSyncDiagnostics?.summary?.healthConnectAggregateTotal != null ? `${lastSyncDiagnostics.summary.healthConnectAggregateTotal.toLocaleString()} steps` : "N/A (Query uses Record Samples)"}</strong></div>
                    <div>Raw Records Sum: <strong>{(lastSyncDiagnostics?.summary?.rawRecordsSum ?? lastSyncDiagnostics?.summary?.stepsDiagnostic?.rawRecordsSum ?? 0).toLocaleString()}</strong> steps</div>
                    <div>Final Selected Total: <strong style={{ color: "#10b981", fontSize: "0.95rem" }}>{(lastSyncDiagnostics?.summary?.todaySteps ?? (activitySummary.steps ?? 0))?.toLocaleString()}</strong> steps</div>
                  </div>
                  {lastSyncDiagnostics?.summary?.stepsDiagnostic?.resolutionReason && (
                    <div style={{ fontSize: "0.74rem", color: "#60a5fa", marginTop: "5px" }}>
                      &bull; {lastSyncDiagnostics.summary.stepsDiagnostic.resolutionReason}
                    </div>
                  )}
                </div>
              </div>

              {/* Detected Step Sources & Package Breakdown */}
              {(lastSyncDiagnostics?.summary?.stepsDiagnostic?.origins?.length > 0 || lastSyncDiagnostics?.summary?.stepsDiagnostic?.sourcesFound?.length > 0) && (
                <div className="cmf-diag-box">
                  <h5 style={{ margin: "0 0 6px", fontWeight: 700 }}>Data Origins Breakdown</h5>
                  {(lastSyncDiagnostics?.summary?.stepsDiagnostic?.origins || lastSyncDiagnostics.summary.stepsDiagnostic.sourcesFound).map((org, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: "1px solid #27272a" }}>
                      <div>
                        <div>
                          <strong>{org.displayName || org.source}</strong>{" "}
                          {org.isWatch ? (
                            <span style={{ color: "#10b981", fontSize: "0.68rem", fontWeight: 700, background: "rgba(16, 185, 129, 0.15)", padding: "1px 5px", borderRadius: "4px" }}>WATCH (AUTHORITATIVE)</span>
                          ) : (
                            <span style={{ color: "#a1a1aa", fontSize: "0.68rem", background: "rgba(161, 161, 170, 0.15)", padding: "1px 5px", borderRadius: "4px" }}>PHONE SENSOR</span>
                          )}
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "#71717a" }}>
                          {org.packageName || "package"} &bull; {org.recordCount || org.samples || 0} records
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <strong>{org.totalSteps.toLocaleString()}</strong> steps
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Heart Rate Diagnostics Telemetry */}
              <div className="cmf-diag-box">
                <h5 style={{ margin: "0 0 6px", fontWeight: 700 }}>Heart Rate Diagnostics &amp; Source Telemetry</h5>
                <div>
                  Permission Status:{" "}
                  <strong style={{ color: lastSyncDiagnostics?.summary?.heartRate?.hasPermission ? "#10b981" : "#ef4444" }}>
                    {lastSyncDiagnostics?.summary?.heartRate?.permissionStatus || "CHECKED"}
                  </strong>
                </div>
                <div>Today Samples: <strong>{lastSyncDiagnostics?.summary?.heartRate?.todaySampleCount ?? 0}</strong></div>
                <div>Total Range Samples: <strong>{lastSyncDiagnostics?.summary?.totalHeartRateSamples ?? 0}</strong></div>
                <div>
                  Detected HR Origins:{" "}
                  <strong>
                    {lastSyncDiagnostics?.summary?.heartRate?.detectedOrigins?.join(", ") || "None found"}
                  </strong>
                </div>
                <div>
                  Latest BPM:{" "}
                  <strong>{lastSyncDiagnostics?.summary?.heartRate?.todayLatestBpm ? `${lastSyncDiagnostics.summary.heartRate.todayLatestBpm} bpm` : "None"}</strong>
                </div>
                {lastSyncDiagnostics?.summary?.heartRate?.todayQueryError && (
                  <div style={{ color: "#ef4444", fontSize: "0.74rem", marginTop: "4px" }}>
                    Query Error: {lastSyncDiagnostics.summary.heartRate.todayQueryError}
                  </div>
                )}
                {lastSyncDiagnostics?.summary?.heartRate?.limitationNote && (
                  <div style={{ fontSize: "0.72rem", color: "#f59e0b", background: "rgba(245, 158, 11, 0.1)", padding: "6px 8px", borderRadius: "6px", marginTop: "6px", lineHeight: 1.4 }}>
                    ⚠ {lastSyncDiagnostics.summary.heartRate.limitationNote}
                  </div>
                )}
              </div>

              <div className="cmf-modal-actions">
                <button
                  type="button"
                  onClick={handleNativeSync}
                  disabled={syncing}
                  className="cmf-btn-primary"
                >
                  <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
                  <span>Re-Sync Health Connect</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: HEART RATE INFO & DIAGNOSTICS MODAL */}
      {showHeartRateInfoModal && (
        <div className="modal-overlay" onClick={() => setShowHeartRateInfoModal(false)}>
          <div className="cmf-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="cmf-modal-header">
              <div className="cmf-modal-title-row">
                <Heart size={18} className="text-coral" />
                <h3 className="cmf-modal-title">Heart Rate Integration</h3>
              </div>
              <button type="button" onClick={() => setShowHeartRateInfoModal(false)} className="cmf-close-btn">✕</button>
            </div>

            <div className="cmf-modal-body">
              <div className="cmf-diag-box">
                <h5 style={{ margin: "0 0 6px", fontWeight: 700 }}>Telemetry &amp; Permissions</h5>
                <div>
                  Permission Status:{" "}
                  <strong style={{ color: lastSyncDiagnostics?.summary?.heartRate?.hasPermission ? "#10b981" : "#ef4444" }}>
                    {lastSyncDiagnostics?.summary?.heartRate?.permissionStatus || "CHECKED"}
                  </strong>
                </div>
                <div>Today Samples: <strong>{lastSyncDiagnostics?.summary?.heartRate?.todaySampleCount ?? 0}</strong></div>
                <div>
                  Detected Origins:{" "}
                  <strong>
                    {lastSyncDiagnostics?.summary?.heartRate?.detectedOrigins?.join(", ") || "None"}
                  </strong>
                </div>
                {lastSyncDiagnostics?.summary?.heartRate?.todayQueryError && (
                  <div style={{ color: "#ef4444", fontSize: "0.75rem", marginTop: "4px" }}>
                    Query Error: {lastSyncDiagnostics.summary.heartRate.todayQueryError}
                  </div>
                )}
              </div>

              <div className="cmf-info-box" style={{ marginTop: "12px" }}>
                <Info size={16} className="text-teal" />
                <div>
                  <strong>Companion App Sync Differences:</strong>
                  <p style={{ margin: "4px 0 0", fontSize: "0.78rem", color: "#a1a1aa" }}>
                    NutriTrack requests standard Android Health Connect <code>READ_HEART_RATE</code> permissions. Whether heart rate is populated depends on your companion app:
                  </p>
                  <ul style={{ margin: "6px 0 0 16px", fontSize: "0.76rem", color: "#d4d4d8", lineHeight: 1.45 }}>
                    <li><strong>Nothing X / CMF Watch:</strong> Exports daily Steps, Active Calories, Distance, Sleep, and Workouts to Health Connect. <em>Continuous 24/7 passive heart rate is kept internal to Nothing X and is not written to Google Health Connect by Nothing OS.</em></li>
                    <li><strong>Samsung Galaxy Watch (Samsung Health):</strong> Syncs steps, calories, sleep, and continuous heart rate records.</li>
                    <li><strong>Google Pixel Watch &amp; Fitbit:</strong> Exports steps, active burn, sleep, and periodic heart rate records.</li>
                  </ul>
                </div>
              </div>

              <div className="cmf-modal-actions" style={{ marginTop: "16px", display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowHeartRateInfoModal(false);
                    setShowPermissionsModal(true);
                  }}
                  className="cmf-btn-secondary"
                  style={{ flex: 1 }}
                >
                  <Shield size={14} />
                  <span>Permissions</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowHeartRateInfoModal(false);
                    openHealthConnectSettings();
                  }}
                  className="cmf-btn-primary"
                  style={{ flex: 1 }}
                >
                  <ExternalLink size={14} />
                  <span>Open Health Connect</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: WATCH SETUP & PAIRING GUIDE MODAL */}
      {showPairingModal && (
        <div className="modal-overlay" onClick={() => setShowPairingModal(false)}>
          <div className="cmf-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="cmf-modal-header">
              <div className="cmf-modal-title-row">
                <Watch size={18} className="text-teal" />
                <h3 className="cmf-modal-title">Connect Watch &amp; Health Data</h3>
              </div>
              <button type="button" onClick={() => setShowPairingModal(false)} className="cmf-close-btn">✕</button>
            </div>

            <div className="cmf-modal-body">
              <p style={{ fontSize: "0.82rem", color: "#a1a1aa", marginBottom: "14px" }}>
                NutriTrack works with any smartwatch supported by Google Health Connect. Follow these steps:
              </p>

              <div className="cmf-checklist-list">
                <div className="cmf-checklist-step">
                  <div className="cmf-step-num">1</div>
                  <div className="cmf-step-content">
                    <strong>Pair Watch with Companion App</strong>
                    <span>Use Nothing X (CMF/Nothing), Samsung Health (Galaxy Watch), Fitbit (Pixel Watch), Garmin Connect, or your watch's companion app.</span>
                  </div>
                </div>

                <div className="cmf-checklist-step">
                  <div className="cmf-step-num">2</div>
                  <div className="cmf-step-content">
                    <strong>Enable Health Connect Sharing</strong>
                    <span>In your watch app settings, turn on data export / synchronization with Google Health Connect.</span>
                  </div>
                </div>

                <div className="cmf-checklist-step">
                  <div className="cmf-step-num">3</div>
                  <div className="cmf-step-content">
                    <strong>Grant NutriTrack Permissions</strong>
                    <span>Allow NutriTrack to read steps, active calories, workouts, heart rate, and sleep in Health Connect.</span>
                  </div>
                </div>

                <div className="cmf-checklist-step">
                  <div className="cmf-step-num">4</div>
                  <div className="cmf-step-content">
                    <strong>Sync With NutriTrack</strong>
                    <span>Tap &ldquo;Sync Now&rdquo; to import your health measurements.</span>
                  </div>
                </div>
              </div>

              <div className="cmf-modal-actions" style={{ marginTop: "16px", display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => openHealthConnectSettings()}
                  className="cmf-btn-secondary"
                  style={{ flex: 1 }}
                >
                  <ExternalLink size={14} />
                  <span>Open Health Connect</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPairingModal(false);
                    handleNativeSync();
                  }}
                  disabled={syncing}
                  className="cmf-btn-primary"
                  style={{ flex: 1 }}
                >
                  <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
                  <span>Sync Now</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: ENERGY ACCOUNTING STRATEGY MODAL */}
      {showEnergyModeModal && (
        <div className="modal-overlay" onClick={() => setShowEnergyModeModal(false)}>
          <div className="cmf-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="cmf-modal-header">
              <div className="cmf-modal-title-row">
                <Flame size={18} className="text-coral" />
                <h3 className="cmf-modal-title">Energy-Accounting Strategy</h3>
              </div>
              <button type="button" onClick={() => setShowEnergyModeModal(false)} className="cmf-close-btn">✕</button>
            </div>

            <div className="cmf-modal-body">
              <p style={{ fontSize: "0.82rem", color: "#a1a1aa", marginBottom: "14px" }}>
                Choose how your daily dietary calorie budget accounts for active calories measured by your smartwatch:
              </p>

              <div className="cmf-strategy-list">
                <div
                  className={`cmf-strategy-item ${connection?.energyAccountingMode === "strict_tdee" ? "active" : ""}`}
                  onClick={() => handleAccountingModeChange("strict_tdee")}
                >
                  <div className="cmf-strategy-header">
                    <strong>1. Strict TDEE Baseline (Recommended)</strong>
                    {connection?.energyAccountingMode === "strict_tdee" && <CheckCircle size={16} className="text-emerald" />}
                  </div>
                  <p className="cmf-strategy-sub">
                    Calorie budget remains fixed to scientific TDEE. Smartwatch burn is displayed side-by-side without increasing food calories, preventing overeating.
                  </p>
                </div>

                <div
                  className={`cmf-strategy-item ${connection?.energyAccountingMode === "dynamic_active_burn" ? "active" : ""}`}
                  onClick={() => handleAccountingModeChange("dynamic_active_burn")}
                >
                  <div className="cmf-strategy-header">
                    <strong>2. Dynamic Net (BMR + Active Burn)</strong>
                    {connection?.energyAccountingMode === "dynamic_active_burn" && <CheckCircle size={16} className="text-emerald" />}
                  </div>
                  <p className="cmf-strategy-sub">
                    Budget starts at Basal Metabolic Rate and adds verified smartwatch active calories dynamically.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
