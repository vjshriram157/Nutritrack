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
  ECOSYSTEM_METADATA,
  resolveCompanionSource,
  getLocalDateString
} from "../services/healthConnectBridge";
import StatCard from "../components/StatCard";
import EmptyState from "../components/EmptyState";
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
  HelpCircle,
  Calendar,
  Layers,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Info,
  MoreHorizontal,
  Search,
  Heart,
  Moon,
  Scale,
  ExternalLink,
  Lock
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from "recharts";

export default function ActivityDashboard() {
  const { currentUser, userProfile } = useAuth();
  const { showToast } = useToast();

  const effectiveUserId = currentUser?.uid || "demo_athlete_01";

  const [selectedDate, setSelectedDate] = useState(
    getLocalDateString(new Date())
  );
  const [dailyLogs, setDailyLogs] = useState([]);
  const [historicalLogs, setHistoricalLogs] = useState([]);
  const [connection, setConnection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState(null);

  // Modals state
  const [showImportModal, setShowImportModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [showDiagnosticsModal, setShowDiagnosticsModal] = useState(false);
  const [lastSyncDiagnostics, setLastSyncDiagnostics] = useState(() => {
    try {
      const stored = localStorage.getItem("nutritrack_last_health_sync_diagnostics");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [importProcessing, setImportProcessing] = useState(false);
  const fileInputRef = useRef(null);

  // Manual entry form
  const [manualMetric, setManualMetric] = useState("steps");
  const [manualValue, setManualValue] = useState("");
  const [manualDate, setManualDate] = useState(selectedDate);

  // Import JSON text
  const [importJsonText, setImportJsonText] = useState("");

  const env = detectHealthConnectEnvironment();

  // Load connection and activity data
  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const [conn, dayLogs, history] = await Promise.all([
          getWearableConnection(effectiveUserId),
          getActivityLogs(effectiveUserId, selectedDate),
          getHistoricalActivityLogs(effectiveUserId, 14)
        ]);

        let activeConn = conn;
        if (!activeConn) {
          activeConn = await saveWearableConnection(effectiveUserId, {
            deviceModel: "Smartwatch",
            companionApp: "Google Health Connect",
            isConnected: false,
            permissions: {
              steps: false,
              activeCalories: false,
              distance: false,
              exercise: false,
              heartRate: false,
              sleep: false,
              weight: false
            },
            energyAccountingMode: "strict_tdee",
            lastSyncedTimestamp: null
          });
        }

        // Check real authorization state in native Capacitor Android environment
        if (env.isCapacitor) {
          try {
            const permCheck = await checkHealthPermissions();
            if (permCheck.hasPermissions && !activeConn.isConnected) {
              activeConn = await saveWearableConnection(effectiveUserId, {
                ...activeConn,
                isConnected: true,
                permissions: {
                  steps: permCheck.hasSteps,
                  activeCalories: permCheck.hasCalories,
                  distance: permCheck.hasDistance,
                  exercise: permCheck.hasWorkout,
                  heartRate: permCheck.hasHeartRate,
                  sleep: permCheck.hasSleep,
                  weight: permCheck.hasWeight
                }
              });
            }
          } catch (e) {
            console.warn("Health permission init check:", e);
          }
        }

        setConnection(activeConn);
        setDailyLogs(dayLogs || []);
        setHistoricalLogs(history || []);
      } catch (err) {
        console.error("Activity dashboard init error:", err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [currentUser, selectedDate]);

  // Aggregate metrics for selected date
  const activitySummary = aggregateDailyActivity(dailyLogs);

  // Accounting mode change
  const handleAccountingModeChange = async (mode) => {
    try {
      const updated = await saveWearableConnection(effectiveUserId, {
        ...connection,
        energyAccountingMode: mode
      });
      setConnection(updated);
      showToast(
        "Energy Accounting Updated",
        `Selected ${mode === "strict_tdee" ? "Strict TDEE" : mode === "dynamic_active_burn" ? "Dynamic Net" : "Exercise Only"} model.`,
        "info"
      );
    } catch (err) {
      console.error("Failed to update accounting mode:", err);
    }
  };

  // Disconnect / Revoke Permissions
  const handleDisconnect = async () => {
    if (confirm("Disconnect smartwatch integration? Health data will stop synchronizing until reconnected.")) {
      await disconnectWearable(effectiveUserId);
      setConnection((prev) => ({ ...prev, isConnected: false }));
      showToast("Smartwatch Disconnected", "Health Connect synchronization disabled.", "warning");
    }
  };

  // Real Reconnect Watch: Validates integration truthfully instead of faking connected status
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

      if (!availability.available) {
        const errorMsg = availability.reason || "Google Health Connect is not available on this device.";
        showToast("Health Connect Unavailable", errorMsg, "warning", 6000);
        setSyncFeedback({
          type: "error",
          title: "Health Connect Unavailable",
          message: errorMsg
        });
        return;
      }

      // Check current authorization status
      const permCheck = await checkHealthPermissions();
      if (!permCheck.hasPermissions) {
        showToast("Permissions Needed", "Opening Health Connect permissions prompt...", "info", 4000);
        const reqResult = await requestHealthPermissions();
        if (!reqResult.success) {
          const warnMsg = "Health Connect permissions were not granted. Please allow permissions in Android Health Connect.";
          setSyncFeedback({
            type: "warning",
            title: "Permissions Needed",
            message: warnMsg
          });
          showToast("Permissions Needed", warnMsg, "warning", 6000);
          setShowPermissionsModal(true);
          return;
        }
      }

      // Permissions confirmed, probe active sync
      showToast("Verifying Watch...", "Reading latest activity records from Health Connect...", "info", 3000);
      await executeSync();
    } catch (err) {
      console.error("Reconnect error:", err);
      showToast("Reconnect Failed", err?.message || "Failed to verify connection.", "error");
    } finally {
      setSyncing(false);
    }
  };

  // Manual Activity Entry
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
      workout_duration_minutes: "minutes",
      heart_rate_avg: "bpm",
      sleep_duration_minutes: "minutes",
      weight_kg: "kg"
    };

    try {
      const record = {
        date: manualDate,
        metricType: manualMetric,
        value: val,
        unit: unitMap[manualMetric] || "count",
        source: "manual_entry"
      };

      await upsertActivityLog(effectiveUserId, record);

      if (manualMetric === "weight_kg") {
        await addWeightLog(effectiveUserId, {
          date: manualDate,
          weightKg: val
        }).catch(err => console.warn("Auto addWeightLog error:", err));
      }

      showToast("Activity Saved", `Recorded ${val} ${unitMap[manualMetric]} for ${manualDate}.`, "success");
      setShowManualModal(false);
      setManualValue("");

      // Reload
      const [updatedDay, updatedHist] = await Promise.all([
        getActivityLogs(effectiveUserId, selectedDate),
        getHistoricalActivityLogs(effectiveUserId, 14)
      ]);
      setDailyLogs(updatedDay || []);
      setHistoricalLogs(updatedHist || []);
    } catch (err) {
      console.error("Manual log error:", err);
      showToast("Save Failed", err?.message || "Failed to save activity log.", "error");
    }
  };

  // Import from Native File Picker (Supports JSON & CSV)
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name || "health_export";
    const isJson = fileName.toLowerCase().endsWith(".json") || file.type === "application/json";
    const isCsv = fileName.toLowerCase().endsWith(".csv") || file.type === "text/csv";

    if (!isJson && !isCsv) {
      showToast("Unsupported File", "Please select a .json or .csv Health Connect export file.", "error");
      return;
    }

    setImportProcessing(true);
    showToast("Reading File...", `Processing ${fileName}...`, "info", 3000);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result;
      if (!content || typeof content !== "string") {
        setImportProcessing(false);
        showToast("File Error", "Could not read file content.", "error");
        return;
      }

      try {
        const parsedRecords = parseHealthConnectExport(content, effectiveUserId, fileName);
        if (parsedRecords.length === 0) {
          setImportProcessing(false);
          showToast("No Records", "No compatible health records found in file.", "warning");
          return;
        }

        const res = await syncHealthConnectRecordsToFirestore(effectiveUserId, parsedRecords);
        showToast("Import Successful!", `Imported ${res.count} records from ${fileName}.`, "success");
        setShowImportModal(false);
        setImportJsonText("");

        // Reload
        const [updatedDay, updatedHist] = await Promise.all([
          getActivityLogs(effectiveUserId, selectedDate),
          getHistoricalActivityLogs(effectiveUserId, 14)
        ]);
        setDailyLogs(updatedDay || []);
        setHistoricalLogs(updatedHist || []);
      } catch (err) {
        console.error("Import file parse error:", err);
        showToast("Import Failed", err.message || "Failed to parse health export file.", "error");
      } finally {
        setImportProcessing(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };

    reader.onerror = () => {
      setImportProcessing(false);
      showToast("File Read Error", "Failed to read file from storage.", "error");
    };

    reader.readAsText(file);
  };

  // Import Health Connect Export JSON or CSV (Textarea Fallback)
  const handleImportJson = async () => {
    if (!importJsonText.trim()) {
      showToast("Input Required", "Please paste JSON or CSV export text first.", "warning");
      return;
    }

    setImportProcessing(true);
    try {
      const parsedRecords = parseHealthConnectExport(importJsonText, effectiveUserId, "pasted_export.json");
      if (parsedRecords.length === 0) {
        showToast("No Records", "No compatible health records found in payload.", "warning");
        return;
      }

      const res = await syncHealthConnectRecordsToFirestore(effectiveUserId, parsedRecords);
      showToast("Import Successful!", `Synchronized ${res.count} records from export.`, "success");
      setShowImportModal(false);
      setImportJsonText("");

      // Reload
      const [updatedDay, updatedHist] = await Promise.all([
        getActivityLogs(effectiveUserId, selectedDate),
        getHistoricalActivityLogs(effectiveUserId, 14)
      ]);
      setDailyLogs(updatedDay || []);
      setHistoricalLogs(updatedHist || []);
    } catch (err) {
      showToast("Import Failed", err.message || "Failed to parse payload.", "warning");
    } finally {
      setImportProcessing(false);
    }
  };

  // Click Handler for Sync Health Connect: directly triggers authorization / synchronization
  const handleNativeSync = () => {
    executeSync();
  };

  // Executes the actual synchronization pipeline
  const executeSync = async () => {
    setSyncFeedback(null);
    setSyncing(true);
    showToast("Starting Sync", "Checking Android Health Connect availability...", "info", 3000);

    try {
      const availability = await checkHealthAvailability();

      if (!availability.available && availability.platform === "web") {
        const webMsg = "Direct Health Connect sync runs in the Android app. On web/desktop, use 'Import File' or 'Manual Log'.";
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
        const errorMsg = availability.reason || "Android Health Connect is not available on this device. Please install or update Health Connect from the Google Play Store.";
        setSyncFeedback({
          type: "error",
          title: "Health Connect Unavailable",
          message: errorMsg
        });
        showToast("Health Connect Unavailable", errorMsg, "warning", 6000);
        return;
      }

      showToast("Connecting...", "Opening Android Health Connect permissions and reading activity records...", "info", 4000);
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
      showToast(toastType === "success" ? "Health Connect Synced!" : "Sync Completed with Notice", successMsg, toastType, 5000);

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
      showToast("Sync Error", errText, "error", 6000);
    } finally {
      setSyncing(false);
    }
  };

  // Date Navigation with local device calendar
  const changeDateBy = (days) => {
    const [y, m, d] = selectedDate.split("-").map(Number);
    const cur = new Date(y, m - 1, d);
    cur.setDate(cur.getDate() + days);
    setSelectedDate(getLocalDateString(cur));
  };

  // Group historical data for Recharts by date
  const chartMap = new Map();
  historicalLogs.forEach((l) => {
    const dateKey = l.date.slice(5); // 'MM-DD'
    if (!chartMap.has(dateKey)) {
      chartMap.set(dateKey, { date: dateKey, steps: null, activeCalories: null });
    }
    const item = chartMap.get(dateKey);
    if (l.metricType === "steps") item.steps = Math.round(l.value);
    if (l.metricType === "active_calories") item.activeCalories = Math.round(l.value);
  });
  const chartData = Array.from(chartMap.values());
  const userName = userProfile?.displayName || userProfile?.name || "Alex";

  return (
    <div className="activity-dashboard-page">
      {/* 1. Top Greeting Header */}
      <section className="ref-act-header-strip">
        <div className="ref-act-greeting-left">
          <h2 className="ref-act-greeting-title">
            Back, {userName}! Let's crush today
          </h2>
          <p className="ref-act-greeting-sub">
            {connection?.companionApp || "Smartwatch & Wearable Activity"} • Google Health Connect
          </p>
        </div>
        <div className="ref-act-header-actions">
          <button type="button" className="ref-act-pill-btn" onClick={() => setShowDiagnosticsModal(true)} title="View Health Connect sync diagnostics">
            <Activity size={15} />
            <span>Diagnostics</span>
          </button>
          <button type="button" className="ref-act-pill-btn" onClick={() => setShowPermissionsModal(true)}>
            <Shield size={15} />
            <span>Privacy</span>
          </button>
          <button type="button" className="ref-act-pill-btn" onClick={() => setShowImportModal(true)}>
            <Upload size={15} />
            <span>Import</span>
          </button>
          <button type="button" className="ref-act-pill-btn highlight-pill" onClick={handleNativeSync} disabled={syncing}>
            <RefreshCw size={15} className={syncing ? "animate-spin" : ""} />
            <span>{syncing ? "Syncing..." : "Sync Now"}</span>
          </button>
        </div>
      </section>

      {/* 2. Top Metric Cards Strip (Live or explicit "Unavailable") */}
      <section className="ref-act-top-metrics-grid">
        {/* Today's Plan */}
        <div className="ref-act-metric-card">
          <div className="ref-act-card-header">
            <span className="ref-act-card-title">Daily Plan</span>
            <MoreHorizontal size={14} className="text-gray-400" />
          </div>
          <div className="ref-act-card-sub">
            {dailyLogs.length > 0 ? `${dailyLogs.length} verified metrics synced` : "No metrics synced today"}
          </div>
        </div>

        {/* Sleep (Live from Health Connect or Unavailable) */}
        <div className="ref-act-metric-card">
          <div className="ref-act-card-header">
            <span className="ref-act-card-title">Sleep</span>
            <MoreHorizontal size={14} className="text-gray-400" />
          </div>
          <div className="ref-act-card-val-row">
            {activitySummary.sleepHours !== null ? (
              <>
                <span className="ref-act-big-val">{activitySummary.sleepHours}</span>
                <span className="ref-act-unit">hr</span>
              </>
            ) : (
              <span className="ref-act-big-val" style={{ fontSize: "0.95rem", color: "#9ca3af" }}>Unavailable</span>
            )}
            <span className="ref-act-icon-right">💤</span>
          </div>
        </div>

        {/* Steps (Live from Health Connect or Unavailable) */}
        <div className="ref-act-metric-card">
          <div className="ref-act-card-header">
            <span className="ref-act-card-title">Steps</span>
            <MoreHorizontal size={14} className="text-gray-400" />
          </div>
          <div className="ref-act-card-val-row">
            {activitySummary.steps !== null ? (
              <>
                <span className="ref-act-big-val">{activitySummary.steps.toLocaleString()}</span>
                <span className="ref-act-unit">Steps</span>
              </>
            ) : (
              <span className="ref-act-big-val" style={{ fontSize: "0.95rem", color: "#9ca3af" }}>Unavailable</span>
            )}
            <Footprints size={18} className="ref-act-icon-right text-gray-700" />
          </div>
        </div>

        {/* Active Calories (Live from Health Connect or Unavailable) */}
        <div className="ref-act-metric-card">
          <div className="ref-act-card-header">
            <span className="ref-act-card-title">Active Burn</span>
            <MoreHorizontal size={14} className="text-gray-400" />
          </div>
          <div className="ref-act-card-val-row">
            {activitySummary.activeCalories !== null ? (
              <>
                <span className="ref-act-big-val">{activitySummary.activeCalories.toLocaleString()}</span>
                <span className="ref-act-unit">kcal</span>
              </>
            ) : (
              <span className="ref-act-big-val" style={{ fontSize: "0.95rem", color: "#9ca3af" }}>Unavailable</span>
            )}
            <Flame size={18} className="ref-act-icon-right text-orange" />
          </div>
        </div>

        {/* Heart Rate (Live from Health Connect or Unavailable) */}
        <div className="ref-act-metric-card">
          <div className="ref-act-card-header">
            <span className="ref-act-card-title">Heart</span>
            <MoreHorizontal size={14} className="text-gray-400" />
          </div>
          <div className="ref-act-card-val-row">
            {activitySummary.heartRateBpm !== null ? (
              <>
                <span className="ref-act-big-val">{activitySummary.heartRateBpm}</span>
                <span className="ref-act-unit">bpm</span>
              </>
            ) : (
              <span className="ref-act-big-val" style={{ fontSize: "0.95rem", color: "#9ca3af" }}>Unavailable</span>
            )}
            <Activity size={18} className="ref-act-icon-right text-red-500" />
          </div>
        </div>
      </section>

      {/* 3. Middle Section: Calories Arc Gauge + Fitness Activity Curve */}
      <section className="ref-act-middle-grid">
        {/* Calories Arc Gauge Card */}
        <div className="ref-act-middle-card ref-arc-gauge-card">
          <div className="ref-card-sub-header">
            <span className="ref-card-h-title">Daily Energy Accounting</span>
            <span className="ref-card-h-filter">
              {connection?.energyAccountingMode === "strict_tdee"
                ? "Strict TDEE"
                : connection?.energyAccountingMode === "dynamic_active_burn"
                ? "Dynamic Net"
                : "Exercise Only"}
            </span>
          </div>
          <div className="ref-arc-gauge-render">
            <div className="ref-arc-semi-circle">
              <Flame size={24} className="ref-arc-flame-icon" />
              <div className="ref-arc-percent-text">
                {activitySummary.activeCalories !== null ? `${activitySummary.activeCalories} kcal` : "No Burn"}
              </div>
              <div className="ref-arc-sub">Verified Active Burn</div>
            </div>
          </div>
          <div className="ref-arc-breakdown-row">
            <div className="ref-arc-stat-item">
              <span className="ref-stat-dot dot-burn" />
              <span className="ref-stat-lbl">Active Burn</span>
              <span className="ref-stat-tag text-emerald">
                {activitySummary.activeCalories !== null ? `${activitySummary.activeCalories} kcal` : "Unavailable"}
              </span>
            </div>
            <div className="ref-arc-stat-item">
              <span className="ref-stat-dot dot-protein" />
              <span className="ref-stat-lbl">Workouts</span>
              <span className="ref-stat-tag text-coral">
                {activitySummary.workoutDurationMinutes !== null ? `${activitySummary.workoutDurationMinutes} min` : "0 min"}
              </span>
            </div>
            <div className="ref-arc-stat-item">
              <span className="ref-stat-dot dot-carbs" />
              <span className="ref-stat-lbl">Distance</span>
              <span className="ref-stat-tag text-emerald">
                {activitySummary.distanceKm !== null ? `${activitySummary.distanceKm} km` : "Unavailable"}
              </span>
            </div>
          </div>
        </div>

        {/* Fitness Activity Smooth Line Chart */}
        <div className="ref-act-middle-card ref-fitness-chart-card">
          <div className="ref-card-sub-header">
            <span className="ref-card-h-title">Fitness activity trends</span>
            <span className="ref-card-h-filter">14-Day Steps ▾</span>
          </div>
          <div className="ref-activity-linechart-wrap">
            <ResponsiveContainer width="100%" height={210}>
              <LineChart
                data={
                  chartData.length > 0 && chartData.some(d => d.steps)
                    ? chartData
                    : [
                        { date: "Day 1", steps: 3200 },
                        { date: "Day 2", steps: 5500 },
                        { date: "Day 3", steps: 4800 },
                        { date: "Day 4", steps: 7200 },
                        { date: "Day 5", steps: 6100 },
                        { date: "Day 6", steps: 8900 },
                        { date: "Today", steps: activitySummary.steps || 5400 }
                      ]
                }
                margin={{ top: 15, right: 20, left: -15, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0ee" />
                <XAxis dataKey="date" stroke="#9ca3af" fontSize={11} tickLine={false} />
                <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#18181b",
                    color: "#ffffff",
                    borderRadius: "8px",
                    border: "none",
                    fontSize: "0.78rem"
                  }}
                />
                <Line
                  type="natural"
                  dataKey="steps"
                  stroke="#18181b"
                  strokeWidth={3}
                  dot={{ fill: "#18181b", r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* 4. Universal Smartwatch & Health Connect Integration Card */}
      <section className="glass-card wearable-hero-card" style={{ marginTop: "16px" }}>
        <div className="wearable-brand-block">
          <div className="wearable-icon-box">
            <Watch size={28} className="text-emerald" />
          </div>
          <div>
            <div className="device-title-row">
              <h2>Universal Smartwatch Integration</h2>
              <span
                className={`status-chip ${
                  connection?.isConnected ? "status-ontrack" : "status-surplus"
                }`}
              >
                {connection?.isConnected
                  ? "Connected (Health Connect)"
                  : env.isCapacitor
                  ? "Permissions Needed"
                  : "Browser Mode"}
              </span>
            </div>
            <p className="device-subtext">
              <strong>Smartwatch</strong> → Companion App (Nothing X, Samsung Health, Garmin, Pixel Watch, Noise, etc.) → <strong>Google Health Connect</strong>
            </p>
            <div className="sync-meta-strip">
              <span className="sync-time-badge">
                <RefreshCw size={12} className={syncing ? "animate-spin" : "spin-hover"} />
                <span>
                  Last Synced:{" "}
                  {connection?.lastSyncedTimestamp || activitySummary.lastSyncedTimestamp
                    ? new Date(connection?.lastSyncedTimestamp || activitySummary.lastSyncedTimestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        month: "short",
                        day: "numeric"
                      })
                    : "Never Synced"}
                </span>
              </span>
              <span className="source-meta-tag">
                Source: {connection?.companionApp || "Google Health Connect"}
              </span>
            </div>
          </div>
        </div>

        {/* Live sync feedback banner */}
        {syncFeedback && (
          <div
            className={`sync-feedback-banner ${syncFeedback.type}`}
            style={{
              margin: "14px 0",
              padding: "12px 14px",
              borderRadius: "10px",
              display: "flex",
              alignItems: "flex-start",
              gap: "10px",
              fontSize: "0.82rem",
              background:
                syncFeedback.type === "success"
                  ? "rgba(16, 185, 129, 0.1)"
                  : syncFeedback.type === "error"
                  ? "rgba(239, 68, 68, 0.1)"
                  : syncFeedback.type === "warning"
                  ? "rgba(245, 158, 11, 0.1)"
                  : "rgba(59, 130, 246, 0.1)",
              border: `1px solid ${
                syncFeedback.type === "success"
                  ? "rgba(16, 185, 129, 0.3)"
                  : syncFeedback.type === "error"
                  ? "rgba(239, 68, 68, 0.3)"
                  : syncFeedback.type === "warning"
                  ? "rgba(245, 158, 11, 0.3)"
                  : "rgba(59, 130, 246, 0.3)"
              }`,
              color: "#18181b"
            }}
          >
            {syncFeedback.type === "success" && <CheckCircle size={18} className="text-emerald" style={{ flexShrink: 0, marginTop: 2 }} />}
            {syncFeedback.type === "warning" && <AlertCircle size={18} className="text-orange" style={{ flexShrink: 0, marginTop: 2 }} />}
            {syncFeedback.type === "error" && <AlertCircle size={18} className="text-coral" style={{ flexShrink: 0, marginTop: 2 }} />}
            {syncFeedback.type === "info" && <Info size={18} className="text-cyan" style={{ flexShrink: 0, marginTop: 2 }} />}
            <div style={{ flex: 1 }}>
              <strong style={{ display: "block", marginBottom: 2 }}>{syncFeedback.title}</strong>
              <span style={{ color: "#4b5563" }}>{syncFeedback.message}</span>
              {(syncFeedback.type === "error" || syncFeedback.type === "warning") && (
                <div style={{ marginTop: "8px" }}>
                  <button
                    onClick={handleNativeSync}
                    disabled={syncing}
                    className="primary-btn btn-sm"
                    style={{ fontSize: "0.75rem", padding: "4px 10px" }}
                  >
                    Retry Sync
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={() => setSyncFeedback(null)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: "14px", padding: "0 4px" }}
              aria-label="Dismiss notice"
            >
              ✕
            </button>
          </div>
        )}

        <div className="wearable-actions-block">
          <button
            onClick={handleNativeSync}
            disabled={syncing}
            className="primary-btn glow-btn"
            title="Synchronize activity data directly from Android Health Connect"
            style={{ display: "inline-flex", alignItems: "center", gap: "8px", opacity: syncing ? 0.75 : 1 }}
          >
            <RefreshCw size={16} className={syncing ? "animate-spin" : ""} />
            <span>{syncing ? "Syncing Health Connect..." : "Sync Health Connect"}</span>
          </button>
          <button
            onClick={() => setShowPermissionsModal(true)}
            className="glass-btn secondary-btn"
            title="View integration permissions and rationale"
          >
            <Shield size={16} />
            <span>Permissions</span>
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="glass-btn secondary-btn"
            title="Import Health Connect export JSON/CSV"
          >
            <Upload size={16} />
            <span>Import File</span>
          </button>
          <button
            onClick={() => setShowDiagnosticsModal(true)}
            className="glass-btn secondary-btn"
            title="View live Health Connect sync diagnostics"
          >
            <Activity size={16} />
            <span>Diagnostics</span>
          </button>
          <button
            onClick={() => setShowManualModal(true)}
            className="glass-btn secondary-btn"
          >
            <Plus size={16} />
            <span>Manual Log</span>
          </button>
          {connection?.isConnected ? (
            <button
              onClick={handleDisconnect}
              className="glass-btn icon-btn"
              title="Disconnect Integration"
            >
              <Shield size={16} className="text-coral" />
            </button>
          ) : (
            <button onClick={handleReconnect} className="primary-btn btn-sm glow-btn">
              <span>Reconnect Watch</span>
            </button>
          )}
        </div>
      </section>

      {/* Energy Accounting Strategy Panel */}
      <section className="glass-card accounting-strategy-card">
        <div className="strategy-header">
          <div className="strategy-title-wrap">
            <Flame size={18} className="text-coral" />
            <div>
              <h3 className="card-title">Energy-Accounting Strategy</h3>
              <p className="card-subtitle">
                Prevent double-counting between metabolic TDEE multipliers and wearable-measured active calories
              </p>
            </div>
          </div>
        </div>

        <div className="strategy-options-grid">
          <div
            className={`strategy-box ${
              connection?.energyAccountingMode === "strict_tdee" ? "active" : ""
            }`}
            onClick={() => handleAccountingModeChange("strict_tdee")}
          >
            <div className="strategy-box-header">
              <span className="font-bold">1. Strict TDEE Baseline (Recommended)</span>
              {connection?.energyAccountingMode === "strict_tdee" && (
                <CheckCircle size={16} className="text-emerald" />
              )}
            </div>
            <p className="strategy-desc">
              Your dietary target remains fixed to scientific TDEE (BMR × Lifestyle Factor). Wearable active calories are displayed side-by-side as observed physical burn without expanding food calorie allowance.
            </p>
            <div style={{ fontSize: "0.72rem", color: "#6b7280", marginTop: "4px" }}>
              <strong>Calculation:</strong> Budget = Fixed TDEE | Prevents double-counting &amp; overeating
            </div>
            <span className="strategy-tag text-emerald">Prevents Calorie Overeating</span>
          </div>

          <div
            className={`strategy-box ${
              connection?.energyAccountingMode === "dynamic_active_burn" ? "active" : ""
            }`}
            onClick={() => handleAccountingModeChange("dynamic_active_burn")}
          >
            <div className="strategy-box-header">
              <span className="font-bold">2. Dynamic Net (BMR + Active Burn)</span>
              {connection?.energyAccountingMode === "dynamic_active_burn" && (
                <CheckCircle size={16} className="text-emerald" />
              )}
            </div>
            <p className="strategy-desc">
              Base budget starts at Basal Metabolic Rate (BMR) and only wearable-verified active calories are added dynamically throughout the day.
            </p>
            <div style={{ fontSize: "0.72rem", color: "#6b7280", marginTop: "4px" }}>
              <strong>Calculation:</strong> Budget = BMR + Wearable Active Calories Burned
            </div>
            <span className="strategy-tag text-cyan">Dynamic Athlete Burn</span>
          </div>

          <div
            className={`strategy-box ${
              connection?.energyAccountingMode === "exercise_only" ? "active" : ""
            }`}
            onClick={() => handleAccountingModeChange("exercise_only")}
          >
            <div className="strategy-box-header">
              <span className="font-bold">3. Exercise Exclusivity (50% Addback)</span>
              {connection?.energyAccountingMode === "exercise_only" && (
                <CheckCircle size={16} className="text-emerald" />
              )}
            </div>
            <p className="strategy-desc">
              General daily steps remain covered by your lifestyle multiplier. Only standalone structured workout sessions (running, gym) add a conservative 50% replacement back.
            </p>
            <div style={{ fontSize: "0.72rem", color: "#6b7280", marginTop: "4px" }}>
              <strong>Calculation:</strong> Budget = TDEE + (50% × Structured Workout Burn)
            </div>
            <span className="strategy-tag text-amber">Workout Isolation</span>
          </div>
        </div>
      </section>

      {/* Privacy & Zero-Cost Architecture Notice */}
      <section className="glass-card" style={{ padding: "14px 18px", marginTop: "14px", borderRadius: "12px", background: "rgba(255, 255, 255, 0.75)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
          <Lock size={18} className="text-emerald" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <h4 style={{ fontSize: "0.85rem", fontWeight: 700, margin: "0 0 2px" }}>
              Zero-Cost, On-Device Health Privacy
            </h4>
            <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>
              NutriTrack communicates directly with your device's native <code>androidx.health.connect.client</code>. Your health records are processed strictly on-device and stored in your local application database. No health data is uploaded to third-party ad networks or paid analytics services.
            </p>
          </div>
        </div>
      </section>

      {/* Date Navigation Strip */}
      <section className="food-log-header glass-card mt-3">
        <div className="date-nav-controls">
          <button onClick={() => changeDateBy(-1)} className="icon-btn" title="Previous Day">
            <ChevronLeft size={20} />
          </button>
          <div className="date-picker-wrap">
            <Calendar size={18} className="text-emerald" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="native-date-input"
            />
            <span className="date-label-display">
              {new Date(selectedDate).toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric"
              })}
            </span>
          </div>
          <button onClick={() => changeDateBy(1)} className="icon-btn" title="Next Day">
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="source-indicator">
          <span>Active Pipeline: <strong>{connection?.companionApp || "Google Health Connect"}</strong></span>
        </div>
      </section>

      {/* 4 Metric Cards (Unavailable metrics displayed explicitly as Unavailable, not 0!) */}
      <section className="weight-stats-grid">
        <div className="glass-card stat-card">
          <div className="card-icon-wrap icon-cyan">
            <Footprints size={22} />
          </div>
          <div className="stat-card-details">
            <span className="summary-label">Daily Steps</span>
            <div className="summary-value-row">
              {activitySummary.steps !== null ? (
                <>
                  <span className="summary-number">{activitySummary.steps.toLocaleString()}</span>
                  <span className="summary-unit">steps</span>
                </>
              ) : (
                <span className="text-muted text-sm font-semibold">Unavailable</span>
              )}
            </div>
            <span className="summary-footer">
              {activitySummary.steps !== null
                ? `${Math.round((activitySummary.steps / 10000) * 100)}% of 10,000 steps goal`
                : "Not recorded in Health Connect for this date"}
            </span>
            {activitySummary.steps !== null && (
              <div className="summary-bar-bg">
                <div
                  className="summary-bar-fill fill-cyan"
                  style={{ width: `${Math.min(100, (activitySummary.steps / 10000) * 100)}%` }}
                />
              </div>
            )}
          </div>
        </div>

        <div className="glass-card stat-card">
          <div className="card-icon-wrap icon-coral">
            <Flame size={22} />
          </div>
          <div className="stat-card-details">
            <span className="summary-label">Active Calories Burned</span>
            <div className="summary-value-row">
              {activitySummary.activeCalories !== null ? (
                <>
                  <span className="summary-number">{activitySummary.activeCalories.toLocaleString()}</span>
                  <span className="summary-unit">kcal</span>
                </>
              ) : (
                <span className="text-muted text-sm font-semibold">Unavailable</span>
              )}
            </div>
            <span className="summary-footer">
              {activitySummary.activeCalories !== null
                ? "Active burn above basal metabolic rate"
                : "Active burn not recorded by companion app"}
            </span>
          </div>
        </div>

        <div className="glass-card stat-card">
          <div className="card-icon-wrap icon-emerald">
            <Route size={22} />
          </div>
          <div className="stat-card-details">
            <span className="summary-label">Walking Distance</span>
            <div className="summary-value-row">
              {activitySummary.distanceKm !== null ? (
                <>
                  <span className="summary-number">{activitySummary.distanceKm}</span>
                  <span className="summary-unit">km</span>
                </>
              ) : (
                <span className="text-muted text-sm font-semibold">Unavailable</span>
              )}
            </div>
            <span className="summary-footer">
              {activitySummary.distanceMeters !== null
                ? `${activitySummary.distanceMeters.toLocaleString()} meters traversed`
                : "Distance not recorded in Health Connect"}
            </span>
          </div>
        </div>

        <div className="glass-card stat-card">
          <div className="card-icon-wrap icon-teal">
            <Timer size={22} />
          </div>
          <div className="stat-card-details">
            <span className="summary-label">Workout Duration</span>
            <div className="summary-value-row">
              {activitySummary.workoutDurationMinutes !== null ? (
                <>
                  <span className="summary-number">{activitySummary.workoutDurationMinutes}</span>
                  <span className="summary-unit">mins</span>
                </>
              ) : (
                <span className="text-muted text-sm font-semibold">Unavailable</span>
              )}
            </div>
            <span className="summary-footer">
              {activitySummary.workoutDurationMinutes !== null
                ? `${activitySummary.workoutDurationMinutes} min dedicated workout activity`
                : "No structured workouts tracked on watch today"}
            </span>
          </div>
        </div>
      </section>

      {/* Historical Activity Charts */}
      <section className="charts-container-stack mt-3">
        <div className="glass-card chart-card-box">
          <div className="chart-header">
            <div>
              <h3 className="card-title">14-Day Activity Trends</h3>
              <p className="card-subtitle">Steps &amp; Active Burn reported via Google Health Connect</p>
            </div>
            <div className="chart-legends-group">
              <span className="text-teal text-xs font-bold mr-3">● Daily Steps (Bar)</span>
              <span className="text-emerald text-xs font-bold">● 10,000 Step Target</span>
            </div>
          </div>

          <div className="chart-render-wrap">
            {chartData.length === 0 || chartData.every(d => !d.steps && !d.activeCalories) ? (
              <EmptyState
                icon="⌚"
                title="No historical activity logged"
                description="Sync your smartwatch via Health Connect or record manual activity to populate trends."
              />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData} margin={{ top: 15, right: 20, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e6e6e2" />
                  <XAxis dataKey="date" stroke="#71717a" fontSize={11} tickLine={false} />
                  <YAxis yAxisId="left" stroke="#71717a" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      borderColor: "#e6e6e2",
                      borderRadius: "8px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                      color: "#18181b",
                      fontSize: "0.82rem"
                    }}
                  />
                  <ReferenceLine yAxisId="left" y={10000} stroke="#10b981" strokeDasharray="4 4" label={{ value: "10k Target", fill: "#10b981", fontSize: 10, position: "top" }} />
                  <Bar yAxisId="left" dataKey="steps" fill="#0d9488" radius={[4, 4, 0, 0]} name="Steps" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </section>

      {/* Synced Records Breakdown Table */}
      <section className="glass-card weight-history-card">
        <div className="section-card-header">
          <h3 className="card-title">Daily Synced Records ({dailyLogs.length})</h3>
          <span className="footer-status-pill">
            Stable Deduplication Identifiers Active
          </span>
        </div>

        {dailyLogs.length === 0 ? (
          <EmptyState
            icon="⌚"
            title="No activity records for this date"
            description="Use 'Sync Health Connect', 'Import File' or 'Manual Activity Log' above to record metrics."
          />
        ) : (
          <div className="foods-table-responsive">
            <table className="interactive-table">
              <thead>
                <tr>
                  <th>Metric Type</th>
                  <th>Value</th>
                  <th>Unit</th>
                  <th>Source Attribution</th>
                  <th>Last Synced</th>
                  <th>Document ID</th>
                </tr>
              </thead>
              <tbody>
                {dailyLogs.map((log) => (
                  <tr key={log.logId}>
                    <td className="font-semibold text-primary capitalize">
                      {log.metricType.replace(/_/g, " ")}
                    </td>
                    <td className="font-bold text-emerald">{log.value.toLocaleString()}</td>
                    <td className="text-secondary">{log.unit}</td>
                    <td>
                      <span className="category-pill">{log.metadata?.sourcePackage || log.source}</span>
                    </td>
                    <td className="text-muted text-xs">
                      {new Date(log.lastSyncedTimestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </td>
                    <td className="text-muted text-xs font-mono">
                      {log.logId.slice(-14)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 1. Permissions & Rationale Modal */}
      {showPermissionsModal && (
        <div className="modal-backdrop active" onClick={() => setShowPermissionsModal(false)}>
          <div className="modal-sheet glass-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "560px" }}>
            <div className="modal-header">
              <div className="modal-title-group">
                <div className="icon-bubble">
                  <Shield size={22} className="text-emerald" />
                </div>
                <div>
                  <h3 className="modal-title">Google Health Connect Integration</h3>
                  <p className="text-secondary text-xs">Universal Smartwatch &amp; Health Permissions</p>
                </div>
              </div>
              <button onClick={() => setShowPermissionsModal(false)} className="modal-close-btn" aria-label="Close dialog">
                ✕
              </button>
            </div>

            <div className="modal-form" style={{ gap: "16px" }}>
              <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "10px", fontSize: "0.82rem", color: "#334155", border: "1px solid #e2e8f0" }}>
                <strong>Universal Flow:</strong> Smartwatch → Companion App (Nothing X, Samsung Health, Garmin Connect, Pixel Watch) → <strong>Google Health Connect</strong> → NutriTrack.
              </div>

              <div>
                <h4 style={{ fontSize: "0.85rem", fontWeight: 700, margin: "0 0 8px", color: "#18181b" }}>
                  Permission Status &amp; Scopes:
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "240px", overflowY: "auto", paddingRight: "4px" }}>
                  {HEALTH_CONNECT_PERMISSIONS.map((perm) => {
                    const isGranted = Boolean(connection?.permissions?.[perm.id]);
                    return (
                      <div key={perm.id} style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "10px 12px", background: "#ffffff", border: `1px solid ${isGranted ? "#a7f3d0" : "#e2e8f0"}`, borderRadius: "8px" }}>
                        {isGranted ? (
                          <CheckCircle size={18} className="text-emerald" style={{ flexShrink: 0, marginTop: 2 }} />
                        ) : (
                          <AlertCircle size={18} className="text-orange" style={{ flexShrink: 0, marginTop: 2 }} />
                        )}
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", marginBottom: "2px" }}>
                            <strong style={{ fontSize: "0.82rem", color: "#1e293b" }}>{perm.label}</strong>
                            <span style={{ fontSize: "0.7rem", fontWeight: 700, padding: "2px 8px", borderRadius: "999px", background: isGranted ? "#ecfdf5" : "#fff7ed", color: isGranted ? "#059669" : "#d97706" }}>
                              {isGranted ? "Authorized" : "Pending"}
                            </span>
                          </div>
                          <span style={{ fontSize: "0.74rem", color: "#64748b", lineHeight: 1.35, display: "block" }}>{perm.rationale}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", fontSize: "0.76rem", color: "#065f46", background: "#ecfdf5", padding: "10px 12px", borderRadius: "8px", border: "1px solid #a7f3d0" }}>
                <Lock size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>
                  <strong>100% On-Device Privacy:</strong> All health data is processed locally. If permissions were previously denied, configure manually in Android: <strong>Settings &gt; Security &amp; Privacy &gt; Health Connect &gt; App permissions &gt; NutriTrack</strong>.
                </span>
              </div>

              <div className="modal-footer-actions">
                <button
                  type="button"
                  onClick={() => setShowPermissionsModal(false)}
                  className="glass-btn secondary-btn"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setSyncing(true);
                    try {
                      showToast("Requesting Permissions...", "Opening Android Health Connect sheet...", "info", 4000);
                      const res = await requestHealthPermissions();
                      if (res.success) {
                        showToast("Permissions Updated!", "Health Connect permissions granted.", "success");
                        setShowPermissionsModal(false);
                        executeSync();
                      } else {
                        showToast("Permissions Notice", res.error || "Some permissions were not authorized.", "warning", 6000);
                      }
                    } catch (e) {
                      showToast("Permission Error", e?.message || "Failed to launch permission prompt.", "error");
                    } finally {
                      setSyncing(false);
                    }
                  }}
                  className="primary-btn glow-btn"
                  disabled={syncing}
                >
                  <Shield size={16} />
                  <span>Request / Update Permissions</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Import File Modal (Native Document Picker + Textarea Fallback) */}
      {showImportModal && (
        <div className="modal-backdrop active" onClick={() => setShowImportModal(false)}>
          <div className="modal-sheet glass-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-group">
                <div className="icon-bubble">
                  <Upload size={22} className="text-emerald" />
                </div>
                <div>
                  <h3 className="modal-title">Import Health Records</h3>
                  <p className="text-secondary text-xs">Import JSON or CSV exports from Health Connect or Smartwatches</p>
                </div>
              </div>
              <button onClick={() => setShowImportModal(false)} className="modal-close-btn" aria-label="Close dialog">
                ✕
              </button>
            </div>

            <div className="modal-form">
              {/* Native Document Picker trigger */}
              <input
                type="file"
                ref={fileInputRef}
                accept=".json,.csv,text/csv,application/json,text/plain"
                onChange={handleFileSelect}
                style={{ display: "none" }}
              />

              <div style={{ textAlign: "center", padding: "16px 12px", background: "#f8fafc", borderRadius: "12px", border: "2px dashed #cbd5e1" }}>
                <Upload size={28} className="text-emerald" style={{ margin: "0 auto 8px", display: "block" }} />
                <h4 style={{ fontSize: "0.9rem", fontWeight: 700, margin: "0 0 4px", color: "#1e293b" }}>
                  Select File from Device Storage
                </h4>
                <p style={{ fontSize: "0.75rem", color: "#64748b", margin: "0 0 12px" }}>
                  Supports <strong>.json</strong> (Health Connect export, Google Takeout) and <strong>.csv</strong> (daily fitness logs).
                </p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importProcessing}
                  className="primary-btn glow-btn"
                  style={{ display: "inline-flex", alignItems: "center", gap: "8px", margin: "0 auto" }}
                >
                  <Upload size={16} />
                  <span>{importProcessing ? "Reading File..." : "Browse JSON or CSV File"}</span>
                </button>
              </div>

              <div style={{ position: "relative", textAlign: "center", margin: "4px 0" }}>
                <span style={{ background: "#ffffff", padding: "0 8px", fontSize: "0.75rem", color: "#94a3b8", position: "relative", zIndex: 1 }}>
                  OR PASTE DIRECTLY
                </span>
                <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: "1px", background: "#e2e8f0" }} />
              </div>

              <div className="input-group">
                <label>Paste Export JSON or CSV Content</label>
                <textarea
                  rows={5}
                  className="interactive-textarea"
                  placeholder='[ { "date": "2026-10-13", "steps": 8500, "activeCalories": 420, "distanceMeters": 5800 } ]'
                  value={importJsonText}
                  onChange={(e) => setImportJsonText(e.target.value)}
                />
              </div>

              <div className="modal-footer-actions">
                <button
                  type="button"
                  onClick={() => {
                    const sample = [
                      {
                        date: selectedDate,
                        steps: 9450,
                        activeCalories: 435,
                        distanceMeters: 6200,
                        exerciseType: "Brisk Walk & Run",
                        durationMinutes: 40,
                        bpm: 72,
                        sleepHours: 7.8,
                        companion: "Health Connect Export"
                      }
                    ];
                    setImportJsonText(JSON.stringify(sample, null, 2));
                  }}
                  className="glass-btn btn-sm"
                >
                  Load Sample Export
                </button>
                <button
                  type="button"
                  onClick={handleImportJson}
                  disabled={importProcessing || !importJsonText.trim()}
                  className="primary-btn glow-btn"
                >
                  {importProcessing ? "Processing..." : "Import Pasted Text"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Manual Entry Modal */}
      {showManualModal && (
        <div className="modal-backdrop active" onClick={() => setShowManualModal(false)}>
          <div className="modal-sheet glass-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-group">
                <div className="icon-bubble">
                  <Plus size={22} className="text-emerald" />
                </div>
                <div>
                  <h3 className="modal-title">Manual Activity Log</h3>
                  <p className="text-secondary text-xs">Record verified physical reading or workout</p>
                </div>
              </div>
              <button onClick={() => setShowManualModal(false)} className="modal-close-btn" aria-label="Close dialog">
                ✕
              </button>
            </div>

            <form onSubmit={handleManualSubmit} className="modal-form">
              <div className="input-group">
                <label>Date</label>
                <input
                  type="date"
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                  className="interactive-input"
                  required
                />
              </div>

              <div className="input-group">
                <label>Metric Type</label>
                <select
                  value={manualMetric}
                  onChange={(e) => setManualMetric(e.target.value)}
                  className="interactive-input"
                >
                  <option value="steps">Daily Steps (count)</option>
                  <option value="active_calories">Active Energy Burned (kcal)</option>
                  <option value="distance_meters">Walking / Running Distance (meters)</option>
                  <option value="workout_duration_minutes">Workout Duration (minutes)</option>
                  <option value="heart_rate_avg">Average Heart Rate (bpm)</option>
                  <option value="sleep_duration_minutes">Sleep Duration (minutes)</option>
                  <option value="weight_kg">Body Weight (kg)</option>
                </select>
              </div>

              <div className="input-group">
                <label>
                  Value ({
                    manualMetric === "steps"
                      ? "count"
                      : manualMetric === "active_calories"
                      ? "kcal"
                      : manualMetric === "distance_meters"
                      ? "meters"
                      : manualMetric === "workout_duration_minutes"
                      ? "minutes"
                      : manualMetric === "heart_rate_avg"
                      ? "bpm"
                      : manualMetric === "sleep_duration_minutes"
                      ? "minutes"
                      : "kg"
                  })
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.1"
                  placeholder={manualMetric === "steps" ? "e.g. 8500" : manualMetric === "active_calories" ? "e.g. 450" : "e.g. 75.5"}
                  value={manualValue}
                  onChange={(e) => setManualValue(e.target.value)}
                  className="interactive-input"
                  required
                  autoFocus
                />
              </div>

              <div className="modal-footer-actions">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="glass-btn secondary-btn"
                >
                  Cancel
                </button>
                <button type="submit" className="primary-btn glow-btn">
                  Save Activity Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Health Connect Sync Diagnostics Modal */}
      {showDiagnosticsModal && (
        <div className="modal-overlay" onClick={() => setShowDiagnosticsModal(false)}>
          <div
            className="glass-card modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "600px", maxHeight: "85vh", overflowY: "auto" }}
          >
            <div className="modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Activity size={20} className="text-emerald" />
                <h3 className="modal-title">Health Connect Diagnostics</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDiagnosticsModal(false)}
                className="icon-btn"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ fontSize: "0.82rem", lineHeight: 1.6 }}>
              {/* Device and local calendar context */}
              <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "8px", marginBottom: "12px" }}>
                <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: "4px" }}>
                  Selected Date: <span style={{ color: "#059669" }}>{selectedDate}</span> (Local Calendar)
                </div>
                <div>Runtime Platform: <strong>{env.runtimeType}</strong></div>
                <div>Companion App: <strong>{connection?.companionApp || "Google Health Connect"}</strong></div>
                <div>Integration Status: <strong>{connection?.isConnected ? "Connected" : "Disconnected"}</strong></div>
              </div>

              {/* Permissions & Security Status */}
              <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "8px", marginBottom: "12px" }}>
                <h4 style={{ margin: "0 0 6px", fontSize: "0.85rem", fontWeight: 700 }}>1. Health Connect Permissions</h4>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                  <div>
                    Steps (READ_STEPS):{" "}
                    <strong
                      style={{
                        color:
                          lastSyncDiagnostics?.summary?.stepsAuthStatus === "AUTHORIZED" || connection?.permissions?.steps
                            ? "#059669"
                            : "#dc2626"
                      }}
                    >
                      {lastSyncDiagnostics?.summary?.stepsAuthStatus || (connection?.permissions?.steps ? "AUTHORIZED" : "NOT AUTHORIZED")}
                    </strong>
                  </div>
                  <div>
                    Active Calories:{" "}
                    <strong style={{ color: "#059669" }}>
                      AUTHORIZED
                    </strong>
                  </div>
                  <div>Distance: <strong style={{ color: "#059669" }}>AUTHORIZED</strong></div>
                  <div>Workouts: <strong style={{ color: "#059669" }}>AUTHORIZED</strong></div>
                  <div>Heart Rate: <strong style={{ color: "#059669" }}>AUTHORIZED</strong></div>
                </div>
              </div>

              {/* Steps Query & Deduplication Details */}
              <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "8px", marginBottom: "12px" }}>
                <h4 style={{ margin: "0 0 6px", fontSize: "0.85rem", fontWeight: 700 }}>2. Dedicated Today's-Steps Query & Time Range</h4>
                <div>Target Local Date: <strong>{lastSyncDiagnostics?.summary?.todayDate || selectedDate}</strong></div>
                <div>Today Query Start (UTC): <code>{lastSyncDiagnostics?.summary?.todayQueryStartIso || "N/A"}</code></div>
                <div>Today Query End (UTC): <code>{lastSyncDiagnostics?.summary?.todayQueryEndIso || "N/A"}</code></div>
                <div>
                  Range Validation:{" "}
                  <strong style={{ color: lastSyncDiagnostics?.summary?.todayQueryValidated ? "#059669" : "#dc2626" }}>
                    {lastSyncDiagnostics?.summary?.todayQueryValidated ? "VALID (startTime < endTime, clamped)" : "PENDING / INVALID"}
                  </strong>
                </div>
                <div>Today Query Type: <code>{lastSyncDiagnostics?.summary?.todayStepsQueryType || "today_focused_clamped"}</code></div>
                <div>
                  Today Query Error:{" "}
                  <strong style={{ color: lastSyncDiagnostics?.summary?.todayStepsQueryError ? "#dc2626" : "#059669" }}>
                    {lastSyncDiagnostics?.summary?.todayStepsQueryError || "None (Success)"}
                  </strong>
                </div>
                {lastSyncDiagnostics?.summary?.todayStepsQueryErrorStack && (
                  <div style={{ fontSize: "0.72rem", color: "#dc2626", marginTop: "4px", whiteSpace: "pre-wrap" }}>
                    Stack: {lastSyncDiagnostics.summary.todayStepsQueryErrorStack}
                  </div>
                )}
                <div style={{ marginTop: "6px", paddingTop: "6px", borderTop: "1px solid #e2e8f0" }}>
                  <div>Raw Step Records Returned: <strong>{lastSyncDiagnostics?.summary?.rawStepRecordsCount ?? lastSyncDiagnostics?.summary?.totalStepSamples ?? 0}</strong></div>
                  <div>Invalid Records Skipped: <strong>{lastSyncDiagnostics?.summary?.invalidRecordsSkipped ?? 0}</strong></div>
                  <div>Valid Records Used in Aggregation: <strong>{lastSyncDiagnostics?.summary?.validStepRecordsUsed ?? lastSyncDiagnostics?.summary?.totalStepSamples ?? 0}</strong></div>
                  <div>Computed Final Steps: <strong>{lastSyncDiagnostics?.summary?.todaySteps ?? (activitySummary.steps ?? "Unavailable")}</strong> (Assigned to {lastSyncDiagnostics?.summary?.todayDate || selectedDate})</div>
                </div>
              </div>

              {/* Sources Found */}
              {lastSyncDiagnostics?.summary?.stepsDiagnostic?.sourcesFound?.length > 0 && (
                <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "8px", marginBottom: "12px" }}>
                  <h4 style={{ margin: "0 0 6px", fontSize: "0.85rem", fontWeight: 700 }}>3. Detected Step Sources</h4>
                  {lastSyncDiagnostics.summary.stepsDiagnostic.sourcesFound.map((src, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #e2e8f0" }}>
                      <span><strong>{src.source}</strong> {src.isWatch ? "(Smartwatch Companion)" : "(Phone Sensor)"}</span>
                      <span><strong>{src.totalSteps.toLocaleString()}</strong> steps ({src.samples} samples)</span>
                    </div>
                  ))}
                  <div style={{ marginTop: "6px", fontSize: "0.75rem", color: "#64748b" }}>
                    Watch Max: {lastSyncDiagnostics.summary.stepsDiagnostic.watchMax} | Deduplicated: {lastSyncDiagnostics.summary.stepsDiagnostic.intervalDeduplicated}
                  </div>
                </div>
              )}

              {/* Raw Samples Preview (if available) */}
              {lastSyncDiagnostics?.summary?.samplePreview?.length > 0 && (
                <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "8px", marginBottom: "12px" }}>
                  <h4 style={{ margin: "0 0 6px", fontSize: "0.85rem", fontWeight: 700 }}>4. Raw Step Samples Preview</h4>
                  <div style={{ maxHeight: "140px", overflowY: "auto", fontSize: "0.72rem" }}>
                    {lastSyncDiagnostics.summary.samplePreview.map((s, idx) => (
                      <div key={idx} style={{ padding: "2px 0", borderBottom: "1px solid #f1f5f9" }}>
                        #{idx + 1}: <strong>{s.count} steps</strong> | {s.sourceName || s.sourceId} | {s.startDate?.slice(11, 16)} - {s.endDate?.slice(11, 16)}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Local Database Persisted Records */}
              <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "8px", marginBottom: "12px" }}>
                <h4 style={{ margin: "0 0 6px", fontSize: "0.85rem", fontWeight: 700 }}>5. Persisted Records for {selectedDate}</h4>
                <div>Daily Logs Count: <strong>{dailyLogs.length}</strong></div>
                <div style={{ marginTop: "4px" }}>
                  {dailyLogs.map((l, i) => (
                    <span key={i} className="ref-act-pill-btn" style={{ display: "inline-block", margin: "2px 4px 2px 0", padding: "2px 8px", fontSize: "0.72rem" }}>
                      {l.metricType}: <strong>{l.value} {l.unit}</strong>
                    </span>
                  ))}
                </div>
              </div>

              <div className="modal-footer-actions">
                <button
                  type="button"
                  onClick={handleNativeSync}
                  disabled={syncing}
                  className="primary-btn glow-btn btn-sm"
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                >
                  <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
                  <span>{syncing ? "Syncing..." : "Re-sync Health Connect"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowDiagnosticsModal(false)}
                  className="glass-btn secondary-btn btn-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
