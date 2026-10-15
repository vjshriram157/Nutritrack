/**
 * Universal Smartwatch & Health Connect Integration Bridge
 *
 * Universal Architecture:
 *   Compatible Smartwatch (Samsung Galaxy Watch, Google Pixel Watch, CMF by Nothing,
 *   Garmin, Amazfit, OnePlus, Noise, boAt, etc.)
 *     → Manufacturer Companion App (Nothing X, Samsung Health, Garmin Connect, Zepp, etc.)
 *     → Google Health Connect (androidx.health.connect.client)
 *     → NutriTrack
 *
 * Supported Health Records verified via Health Connect:
 *   1. Steps (count) - android.permission.health.READ_STEPS
 *   2. Active Calories (kcal) - android.permission.health.READ_ACTIVE_CALORIES_BURNED
 *   3. Distance (meters) - android.permission.health.READ_DISTANCE
 *   4. Workouts & Exercise Sessions (minutes) - android.permission.health.READ_EXERCISE
 *   5. Heart Rate (bpm) - android.permission.health.READ_HEART_RATE
 *   6. Sleep Duration (minutes) - android.permission.health.READ_SLEEP
 *   7. Body Weight (kg) - android.permission.health.READ_WEIGHT
 */

import { Capacitor } from "@capacitor/core";
import { Health } from "@interval-health/capacitor-health";
import {
  generateActivityLogId,
  upsertActivityLog,
  batchUpsertActivityLogs,
  saveWearableConnection,
  addWeightLog
} from "./dbService.js";

// Permission Scopes
export const HEALTH_CONNECT_PERMISSIONS = [
  {
    id: "steps",
    label: "Daily Steps Count",
    required: true,
    permission: "android.permission.health.READ_STEPS",
    rationale: "Quantifies your daily physical activity volume and non-exercise activity thermogenesis (NEAT)."
  },
  {
    id: "calories",
    label: "Active Calories Burned",
    required: true,
    permission: "android.permission.health.READ_ACTIVE_CALORIES_BURNED",
    rationale: "Measures energy burned through active movement above your resting metabolic rate (excludes BMR)."
  },
  {
    id: "distance",
    label: "Walking & Running Distance",
    required: false,
    permission: "android.permission.health.READ_DISTANCE",
    rationale: "Tracks ambulatory mileage to calculate aerobic exertion and stride efficiency."
  },
  {
    id: "workout",
    label: "Exercise & Workout Sessions",
    required: false,
    permission: "android.permission.health.READ_EXERCISE",
    rationale: "Captures dedicated sports sessions (running, gym, cycling) for athletic energy accounting."
  },
  {
    id: "heartRate",
    label: "Heart Rate Records",
    required: false,
    permission: "android.permission.health.READ_HEART_RATE",
    rationale: "Monitors cardiovascular intensity and resting pulse trends across the day."
  },
  {
    id: "sleep",
    label: "Sleep Sessions & Duration",
    required: false,
    permission: "android.permission.health.READ_SLEEP",
    rationale: "Evaluates nightly recovery duration to contextualize metabolic appetite and fatigue."
  },
  {
    id: "weight",
    label: "Body Weight & Mass",
    required: false,
    permission: "android.permission.health.READ_WEIGHT",
    rationale: "Synchronizes body mass measurements from compatible smart scales or manual watch logs."
  }
];

export const ECOSYSTEM_METADATA = {
  layer: "Google Health Connect (androidx.health.connect.client)",
  architecture: "Smartwatch → Manufacturer Companion App → Google Health Connect → NutriTrack",
  supportedManufacturers: [
    { brand: "CMF / Nothing", companion: "Nothing X / CMF Watch app", verified: true },
    { brand: "Samsung", companion: "Samsung Health", verified: true },
    { brand: "Google / Fitbit", companion: "Fitbit / Pixel Watch app", verified: true },
    { brand: "Garmin", companion: "Garmin Connect", verified: true },
    { brand: "OnePlus / OPPO", companion: "OHealth", verified: true },
    { brand: "Amazfit / Zepp", companion: "Zepp / Zepp Life", verified: true },
    { brand: "Xiaomi", companion: "Mi Fitness", verified: true },
    { brand: "Noise / boAt", companion: "NoiseFit / boAt Crest", verified: true }
  ],
  supportedMetrics: [
    { type: "steps", name: "Steps", unit: "count", verifiedAvailable: true },
    { type: "calories", name: "Active Energy Burned", unit: "kcal", verifiedAvailable: true },
    { type: "distance", name: "Distance", unit: "meters", verifiedAvailable: true },
    { type: "workout", name: "Workout Sessions", unit: "minutes", verifiedAvailable: true },
    { type: "heartRate", name: "Heart Rate", unit: "bpm", verifiedAvailable: true },
    { type: "sleep", name: "Sleep Duration", unit: "minutes", verifiedAvailable: true },
    { type: "weight", name: "Weight", unit: "kg", verifiedAvailable: true }
  ]
};

/**
 * Resolves raw package names into human-readable companion app / manufacturer labels.
 */
export function resolveCompanionSource(packageName) {
  if (!packageName) return "Smartwatch / Health Connect";
  const pkg = packageName.toLowerCase();
  if (pkg.includes("nothing") || pkg.includes("hearth") || pkg.includes("cmf") || pkg.includes("b163") || pkg.includes("b164") || pkg.includes("d395")) {
    return "Nothing X (CMF / Nothing Watch)";
  }
  if (pkg.includes("shealth") || pkg.includes("samsung")) return "Samsung Health (Galaxy Watch)";
  if (pkg.includes("garmin")) return "Garmin Connect";
  if (pkg.includes("fitbit") || pkg.includes("pixel watch")) return "Fitbit (Pixel Watch / Fitbit)";
  if (pkg.includes("google.android.apps.fitness") || pkg.includes("google.android.apps.health")) return "Google Fit / Health Connect";
  if (pkg.includes("heytap") || pkg.includes("ohealth") || pkg.includes("realme")) return "realme / OHealth";
  if (pkg.includes("zepp") || pkg.includes("huami") || pkg.includes("midong")) return "Zepp (Amazfit)";
  if (pkg.includes("xiaomi") || pkg.includes("wearable")) return "Mi Fitness (Xiaomi Watch)";
  if (pkg.includes("boat") || pkg.includes("coveiot")) return "boAt Crest";
  if (pkg.includes("noise")) return "NoiseFit";
  return packageName;
}

/**
 * Reliably identifies the user's smartwatch companion app and hardware brand
 * based on Health Connect records, package names, and detected source metadata.
 * Never assumes CMF Watch 3 Pro or that the phone model is the watch model.
 *
 * @param {Array} records - Synced activity records or raw samples
 * @param {Array|string} candidateSources - Candidate source names or package names
 * @returns {object} Device identification details
 */
export function identifyWatchDevice(records = [], candidateSources = []) {
  const pkgs = new Set();

  const addSource = (val) => {
    if (!val || typeof val !== "string") return;
    const clean = val.trim().toLowerCase();
    if (clean && !isPhoneOrInactiveSource(clean, clean)) {
      pkgs.add(clean);
    }
  };

  (Array.isArray(candidateSources) ? candidateSources : [candidateSources]).forEach(addSource);

  (records || []).forEach((r) => {
    addSource(r.metadata?.sourcePackage);
    addSource(r.metadata?.bridgeSource);
    addSource(r.source);
    if (Array.isArray(r.metadata?.origins)) {
      r.metadata.origins.forEach((o) => addSource(o.packageName || o.name || o));
    }
    if (r.metadata?.latestOrigin) addSource(r.metadata.latestOrigin);
  });

  const combined = Array.from(pkgs).join(" ");

  if (
    combined.includes("com.nothing.hearth") ||
    combined.includes("nothing") ||
    combined.includes("cmf") ||
    combined.includes("b163") ||
    combined.includes("b164") ||
    combined.includes("d395")
  ) {
    return {
      type: "nothing",
      brand: "CMF by Nothing",
      model: "CMF / Nothing Watch",
      companionApp: "Nothing X",
      packageName: "com.nothing.hearth",
      isReliablyIdentified: true,
      description: "Connected via Nothing X companion app"
    };
  }

  if (
    combined.includes("com.sec.android.app.shealth") ||
    combined.includes("samsung") ||
    combined.includes("galaxy")
  ) {
    return {
      type: "samsung",
      brand: "Samsung",
      model: "Galaxy Watch",
      companionApp: "Samsung Health",
      packageName: "com.sec.android.app.shealth",
      isReliablyIdentified: true,
      description: "Connected via Samsung Health"
    };
  }

  if (
    combined.includes("com.fitbit.fitbitmobile") ||
    combined.includes("fitbit") ||
    combined.includes("pixel watch")
  ) {
    return {
      type: "pixel",
      brand: "Google / Fitbit",
      model: "Pixel Watch / Fitbit",
      companionApp: "Fitbit",
      packageName: "com.fitbit.FitbitMobile",
      isReliablyIdentified: true,
      description: "Connected via Fitbit / Pixel Watch app"
    };
  }

  if (combined.includes("garmin")) {
    return {
      type: "garmin",
      brand: "Garmin",
      model: "Garmin Smartwatch",
      companionApp: "Garmin Connect",
      packageName: "com.garmin.android.apps.connectmobile",
      isReliablyIdentified: true,
      description: "Connected via Garmin Connect"
    };
  }

  if (
    combined.includes("zepp") ||
    combined.includes("huami") ||
    combined.includes("amazfit")
  ) {
    return {
      type: "generic",
      brand: "Amazfit",
      model: "Amazfit Smartwatch",
      companionApp: "Zepp",
      packageName: "com.huami.watch.hmwatchmanager",
      isReliablyIdentified: true,
      description: "Connected via Zepp"
    };
  }

  // Not reliably identified - Return generic Health Connect device representation
  return {
    type: "generic",
    brand: "Health Connect",
    model: "Health Connect Device",
    companionApp: "Google Health Connect",
    packageName: null,
    isReliablyIdentified: false,
    description: "Health data read through Google Health Connect"
  };
}

/**
 * Opens Android Health Connect settings screen or falls back to system application settings.
 */
export async function openHealthConnectSettings() {
  if (!Capacitor.isNativePlatform()) {
    return {
      success: false,
      reason: "Health Connect settings are only accessible in the Android app."
    };
  }

  try {
    if (typeof Health.openHealthConnectSettings === "function") {
      await Health.openHealthConnectSettings();
      return { success: true };
    }
    // Fallback: request authorization which invokes Health Connect settings/permissions UI
    const res = await Health.requestAuthorization({ read: IMPLEMENTED_DATA_TYPES });
    return { success: true, res };
  } catch (err) {
    console.warn("Could not launch Health Connect settings:", err);
    return {
      success: false,
      error: err?.message || "Could not open Health Connect settings"
    };
  }
}

/**
 * Detects whether the current runtime environment can directly access Health Connect APIs.
 */
export function detectHealthConnectEnvironment() {
  const isCapacitor = typeof Capacitor !== "undefined" && Capacitor.isNativePlatform();
  const platform = isCapacitor ? Capacitor.getPlatform() : "web";
  const isAndroid = platform === "android" || (typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent));
  const hasNativeBridge = typeof window !== "undefined" && Boolean(window.AndroidHealthConnectBridge);

  return {
    isAndroid,
    isCapacitor,
    hasDirectHardwareAccess: isCapacitor || hasNativeBridge,
    runtimeType: isCapacitor
      ? `capacitor_${platform}`
      : hasNativeBridge
      ? "native_android_webview"
      : isAndroid
      ? "android_mobile_browser"
      : "desktop_browser",
    needsCompanionOrImport: !isCapacitor && !hasNativeBridge
  };
}

/**
 * Checks whether native Health Connect APIs are supported and ready on this device.
 */
export async function checkHealthAvailability() {
  if (!Capacitor.isNativePlatform()) {
    return {
      available: false,
      platform: "web",
      reason: "Running in web browser. Direct Health Connect synchronization operates natively in the Android app."
    };
  }

  try {
    const res = await Health.isAvailable();
    return {
      available: Boolean(res.available),
      platform: res.platform || Capacitor.getPlatform(),
      reason: res.reason || (res.available ? "Health Connect is ready" : "Health Connect is not available on this device")
    };
  } catch (err) {
    return {
      available: false,
      platform: Capacitor.getPlatform(),
      reason: err?.message || "Health Connect availability check failed"
    };
  }
}

const IMPLEMENTED_DATA_TYPES = ["steps", "calories", "distance", "workout", "heartRate", "sleep", "weight"];

/**
 * Checks native authorization status without prompting the user.
 */
export async function checkHealthPermissions() {
  if (!Capacitor.isNativePlatform()) {
    return {
      hasPermissions: false,
      readAuthorized: [],
      readDenied: []
    };
  }

  try {
    const res = await Health.checkAuthorization({
      read: IMPLEMENTED_DATA_TYPES
    });
    const readAuthorized = res?.readAuthorized || [];
    const readDenied = res?.readDenied || [];
    return {
      hasPermissions: readAuthorized.length > 0,
      readAuthorized,
      readDenied,
      hasSteps: readAuthorized.includes("steps"),
      hasCalories: readAuthorized.includes("calories"),
      hasDistance: readAuthorized.includes("distance"),
      hasWorkout: readAuthorized.includes("workout"),
      hasHeartRate: readAuthorized.includes("heartRate"),
      hasSleep: readAuthorized.includes("sleep"),
      hasWeight: readAuthorized.includes("weight")
    };
  } catch (err) {
    return {
      hasPermissions: false,
      readAuthorized: [],
      readDenied: IMPLEMENTED_DATA_TYPES,
      error: err?.message
    };
  }
}

/**
 * Requests native Health Connect read permissions for all implemented data types.
 */
export async function requestHealthPermissions() {
  if (!Capacitor.isNativePlatform()) {
    return {
      success: false,
      reason: "Native permissions can only be requested within the Android app."
    };
  }

  try {
    const res = await Health.requestAuthorization({
      read: IMPLEMENTED_DATA_TYPES
    });

    const readAuthorized = res.readAuthorized || [];
    const readDenied = res.readDenied || [];

    return {
      success: readAuthorized.length > 0,
      readAuthorized,
      readDenied,
      hasSteps: readAuthorized.includes("steps"),
      hasCalories: readAuthorized.includes("calories"),
      hasDistance: readAuthorized.includes("distance"),
      hasWorkout: readAuthorized.includes("workout"),
      hasHeartRate: readAuthorized.includes("heartRate"),
      hasSleep: readAuthorized.includes("sleep"),
      hasWeight: readAuthorized.includes("weight")
    };
  } catch (err) {
    console.error("Health Connect requestAuthorization error:", err);
    return {
      success: false,
      error: err?.message || "Permission request failed",
      readAuthorized: [],
      readDenied: IMPLEMENTED_DATA_TYPES
    };
  }
}

/**
 * Detects whether a data origin corresponds to a phone hardware step counter or inactive phone source.
 */
export function isPhoneOrInactiveSource(sourceId = "", sourceName = "") {
  const combined = `${sourceId || ""} ${sourceName || ""}`.toLowerCase();
  return (
    combined.includes("realme") ||
    combined.includes("oppo") ||
    combined.includes("heytap") ||
    combined.includes("coloros") ||
    combined.includes("oneplus") ||
    combined.includes("phone") ||
    combined.includes("pedometer") ||
    combined.includes("sensor") ||
    combined.includes("inactive") ||
    combined.includes("hardware")
  );
}

/**
 * Determines whether a source originates from a dedicated smartwatch companion app.
 * Excludes phone hardware pedometers and inactive phone sources.
 */
export function isSmartwatchCompanion(sourceId = "", sourceName = "") {
  if (isPhoneOrInactiveSource(sourceId, sourceName)) {
    return false;
  }
  const combined = `${sourceId || ""} ${sourceName || ""}`.toLowerCase();
  return (
    combined.includes("nothing") ||
    combined.includes("hearth") ||
    combined.includes("cmf") ||
    combined.includes("shealth") ||
    combined.includes("samsung") ||
    combined.includes("garmin") ||
    combined.includes("fitbit") ||
    combined.includes("zepp") ||
    combined.includes("huami") ||
    combined.includes("xiaomi") ||
    combined.includes("polar") ||
    combined.includes("coros") ||
    combined.includes("whoop") ||
    combined.includes("oura") ||
    combined.includes("withings") ||
    combined.includes("coveiot") ||
    combined.includes("boat") ||
    combined.includes("noise") ||
    combined.includes("watch") ||
    combined.includes("wear") ||
    combined.includes("b163") ||
    combined.includes("b164") ||
    combined.includes("d395")
  );
}

/**
 * Returns YYYY-MM-DD representing local device calendar date.
 */
export function getLocalDateString(dateInput = new Date()) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return new Date().toISOString().split("T")[0];
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Returns ISO strings for the start and end of a local day in device timezone.
 * When clampToNow is true and date is today, clamps endDate to the current instant
 * to avoid querying future time. Guarantees start < end.
 */
export function getLocalDayBoundaries(dateInput = new Date(), clampToNow = true) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const now = new Date();

  // Local calendar boundaries in device timezone
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  let end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

  const isToday = getLocalDateString(d) === getLocalDateString(now);
  let wasClamped = false;

  if (clampToNow && isToday && end.getTime() > now.getTime()) {
    end = new Date(now.getTime());
    wasClamped = true;
  }

  // Ensure end is strictly after start by at least 1000ms
  if (end.getTime() <= start.getTime()) {
    if (wasClamped) {
      start.setTime(end.getTime() - 60000); // Shift start back 1 minute
    } else {
      end.setTime(start.getTime() + 1000);
    }
  }

  return {
    startDateIso: start.toISOString(),
    endDateIso: end.toISOString(),
    startMs: start.getTime(),
    endMs: end.getTime(),
    isToday,
    wasClamped
  };
}

/**
 * Validates, normalizes, and clamps time ranges before dispatching Health Connect queries.
 * Enforces startTime < endTime (required by Health Connect TimeRangeFilter.between).
 * Clamps end time to current instant so future time is never queried unnecessarily.
 * Returns valid UTC ISO-8601 strings ending in 'Z' expected by native Instant.parse().
 *
 * @param {Date|string|number} startDateInput
 * @param {Date|string|number} endDateInput
 * @param {object} options - { clampToNow: boolean, minSpanMs: number }
 * @returns {{ isValid: boolean, reason?: string, startDateIso: string, endDateIso: string, startMs: number, endMs: number, durationMs: number, wasClamped: boolean, wasAdjusted: boolean }}
 */
export function buildSafeHealthConnectRange(startDateInput, endDateInput, options = {}) {
  const { clampToNow = true, minSpanMs = 1000 } = options;
  const now = new Date();
  const nowMs = now.getTime();

  const parseToDate = (val, isEnd = false) => {
    if (val === null || val === undefined) return null;
    if (val instanceof Date) {
      return isNaN(val.getTime()) ? null : new Date(val.getTime());
    }
    if (typeof val === "number") {
      return isFinite(val) ? new Date(val) : null;
    }
    if (typeof val === "string") {
      const trimmed = val.trim();
      if (!trimmed) return null;
      // Handle local calendar date 'YYYY-MM-DD'
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        const [y, m, d] = trimmed.split("-").map(Number);
        return isEnd
          ? new Date(y, m - 1, d, 23, 59, 59, 999)
          : new Date(y, m - 1, d, 0, 0, 0, 0);
      }
      const parsed = new Date(trimmed);
      return isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
  };

  let start = parseToDate(startDateInput, false);
  let end = parseToDate(endDateInput, true);

  if (!start) {
    return {
      isValid: false,
      reason: `Invalid or unparseable startDate: ${String(startDateInput)}`,
      startDateIso: null,
      endDateIso: null
    };
  }

  if (!end) {
    return {
      isValid: false,
      reason: `Invalid or unparseable endDate: ${String(endDateInput)}`,
      startDateIso: null,
      endDateIso: null
    };
  }

  let wasClamped = false;
  let wasAdjusted = false;

  // Clamp end timestamp to now if it reaches into the future and clampToNow is enabled
  if (clampToNow && end.getTime() > nowMs) {
    end = new Date(nowMs);
    wasClamped = true;
  }

  // Ensure startTime < endTime (guaranteeing startTime.isBefore(endTime) in Health Connect)
  if (end.getTime() <= start.getTime()) {
    wasAdjusted = true;
    if (wasClamped) {
      // If end was clamped to current instant, shift start back so start < end
      const safeSpan = Math.max(minSpanMs, 60000);
      start = new Date(end.getTime() - safeSpan);
    } else {
      end = new Date(start.getTime() + minSpanMs);
    }
  }

  const finalStartMs = start.getTime();
  const finalEndMs = end.getTime();
  if (finalStartMs >= finalEndMs) {
    return {
      isValid: false,
      reason: `Unable to establish startTime < endTime (${finalStartMs} >= ${finalEndMs})`,
      startDateIso: null,
      endDateIso: null
    };
  }

  return {
    isValid: true,
    startDateIso: start.toISOString(),
    endDateIso: end.toISOString(),
    startMs: finalStartMs,
    endMs: finalEndMs,
    durationMs: finalEndMs - finalStartMs,
    wasClamped,
    wasAdjusted
  };
}

/**
 * Validates an individual step record from Health Connect.
 * Checks for missing or non-finite timestamps, negative or zero step counts,
 * inverted timestamps (start > end), and millisecond vs ISO formats.
 * Preserves zero-duration samples (start === end) safely.
 */
export function inspectAndValidateStepSample(sample) {
  if (!sample || typeof sample !== "object") {
    return { isValid: false, reason: "Sample is null or not an object", sample };
  }

  // 1. Step count validation
  const rawVal = sample.value !== undefined ? sample.value :
                 sample.count !== undefined ? sample.count :
                 sample.steps !== undefined ? sample.steps :
                 sample.sampleValue !== undefined ? sample.sampleValue : null;

  if (rawVal === null || rawVal === undefined) {
    return { isValid: false, reason: "Missing step count property", sample };
  }

  const numVal = parseFloat(rawVal);
  if (isNaN(numVal) || !isFinite(numVal) || numVal < 0) {
    return { isValid: false, reason: `Invalid step value (${rawVal})`, sample };
  }

  // 2. Timestamp validation (handling ISO string or millisecond number)
  const parseTime = (val) => {
    if (val === null || val === undefined) return NaN;
    if (typeof val === "number") return isFinite(val) ? val : NaN;
    if (typeof val === "string") {
      const d = new Date(val);
      return d.getTime();
    }
    if (val instanceof Date) {
      return val.getTime();
    }
    return NaN;
  };

  let startMs = parseTime(sample.startDate);
  let endMs = parseTime(sample.endDate);

  // Missing one timestamp: safely use the other
  if (isNaN(startMs) && !isNaN(endMs)) {
    startMs = endMs;
  } else if (!isNaN(startMs) && isNaN(endMs)) {
    endMs = startMs;
  }

  if (isNaN(startMs) || isNaN(endMs) || !isFinite(startMs) || !isFinite(endMs)) {
    return { isValid: false, reason: `Invalid timestamp format (start=${sample.startDate}, end=${sample.endDate})`, sample };
  }

  // Inverted timestamps: end time earlier than start time
  if (startMs > endMs) {
    return {
      isValid: false,
      reason: `Inverted timestamps: start (${new Date(startMs).toISOString()}) is after end (${new Date(endMs).toISOString()})`,
      sample
    };
  }

  const isZeroDuration = startMs === endMs;
  const count = Math.round(numVal);
  const normalizedStartDate = new Date(startMs).toISOString();
  const normalizedEndDate = new Date(endMs).toISOString();

  return {
    isValid: true,
    isZeroDuration,
    startMs,
    endMs,
    durationMs: endMs - startMs,
    normalizedStartDate,
    normalizedEndDate,
    count,
    cleanSample: {
      ...sample,
      startDate: normalizedStartDate,
      endDate: normalizedEndDate,
      value: count,
      count: count,
      startMs,
      endMs,
      isZeroDuration
    }
  };
}

/**
 * Resolves overlapping intervals using time-slice rate integration.
 * Splits contiguous overlapping intervals by boundary timestamps and integrates
 * the maximum step rate across covering records to avoid double-counting.
 *
 * @param {Array} items - Array of intervals with { startMs, endMs, stepCount }
 * @returns {number}
 */
export function resolveTimeSliceSteps(items) {
  if (!items || items.length === 0) return 0;
  if (items.length === 1) return items[0].stepCount;

  const pointsSet = new Set();
  items.forEach((it) => {
    pointsSet.add(it.startMs);
    pointsSet.add(it.endMs);
  });
  const boundaries = Array.from(pointsSet).sort((a, b) => a - b);

  let sliceSum = 0;
  for (let i = 0; i < boundaries.length - 1; i++) {
    const t0 = boundaries[i];
    const t1 = boundaries[i + 1];
    const dt = t1 - t0;
    if (dt <= 0) continue;

    const covering = items.filter((it) => it.startMs <= t0 && it.endMs >= t1);
    if (covering.length === 0) continue;

    let maxRate = 0;
    covering.forEach((cov) => {
      const covDuration = cov.endMs - cov.startMs;
      if (covDuration > 0) {
        const rate = cov.stepCount / covDuration;
        if (rate > maxRate) maxRate = rate;
      }
    });

    sliceSum += maxRate * dt;
  }

  return sliceSum;
}

/**
 * Calculates non-duplicate step count for a single origin (package/source).
 * Resolves cumulative snapshot records vs independent intervals, handles boundary overlaps,
 * and eliminates duplicate counts from repeated synchronizations.
 *
 * @param {Array} samples - Raw samples for this origin
 * @returns {number}
 */
export function calculateOriginDeduplicatedSteps(samples = []) {
  if (!samples || samples.length === 0) return 0;

  // 1. Sanitize & normalize
  const valid = [];
  samples.forEach((s) => {
    const rawVal = s.value !== undefined ? s.value :
                   s.count !== undefined ? s.count :
                   s.steps !== undefined ? s.steps :
                   s.stepCount !== undefined ? s.stepCount : 0;
    const count = Math.max(0, parseFloat(rawVal) || 0);
    const startMs = s.startMs || (s.startDate ? new Date(s.startDate).getTime() : 0);
    const endMs = s.endMs || (s.endDate ? new Date(s.endDate).getTime() : startMs);
    const safeEnd = endMs > startMs ? endMs : startMs + 1000;
    if (count > 0 && isFinite(startMs) && isFinite(safeEnd)) {
      valid.push({
        startMs,
        endMs: safeEnd,
        duration: safeEnd - startMs,
        stepCount: count
      });
    }
  });

  if (valid.length === 0) return 0;

  // 2. Exact interval deduplication: identical (startMs, endMs) -> keep max stepCount
  const intervalMap = new Map();
  valid.forEach((s) => {
    const key = `${s.startMs}_${s.endMs}`;
    if (!intervalMap.has(key) || intervalMap.get(key).stepCount < s.stepCount) {
      intervalMap.set(key, s);
    }
  });
  const uniqueSamples = Array.from(intervalMap.values());

  if (uniqueSamples.length === 1) {
    return Math.round(uniqueSamples[0].stepCount);
  }

  // 3. Sort by startMs ASC, duration DESC
  uniqueSamples.sort((a, b) => a.startMs - b.startMs || b.duration - a.duration);

  // 4. Cluster into connected overlapping components (1-sec boundary tolerance)
  const clusters = [];
  let currentCluster = [uniqueSamples[0]];
  let clusterEnd = uniqueSamples[0].endMs;

  for (let i = 1; i < uniqueSamples.length; i++) {
    const item = uniqueSamples[i];
    if (item.startMs < clusterEnd - 1000) {
      currentCluster.push(item);
      clusterEnd = Math.max(clusterEnd, item.endMs);
    } else {
      clusters.push(currentCluster);
      currentCluster = [item];
      clusterEnd = item.endMs;
    }
  }
  clusters.push(currentCluster);

  // 5. Resolve each cluster
  let totalSteps = 0;

  clusters.forEach((cluster) => {
    if (cluster.length === 1) {
      totalSteps += cluster[0].stepCount;
      return;
    }

    const clusterStart = Math.min(...cluster.map((c) => c.startMs));
    const clusterEnd = Math.max(...cluster.map((c) => c.endMs));
    const clusterSpan = clusterEnd - clusterStart;

    // Check if there is an encompassing record that covers >= 75% of the cluster
    const encompassing = cluster.filter((c) => c.duration >= 0.75 * clusterSpan);

    if (encompassing.length > 0) {
      const maxEncompassingCount = Math.max(...encompassing.map((c) => c.stepCount));
      const primaryEncompassing = encompassing.reduce((prev, cur) =>
        cur.duration >= prev.duration && cur.stepCount >= prev.stepCount ? cur : prev
      );

      const subIntervals = cluster.filter(
        (c) =>
          c !== primaryEncompassing &&
          c.startMs >= primaryEncompassing.startMs - 60000 &&
          c.endMs <= primaryEncompassing.endMs + 60000
      );

      const outsideIntervals = cluster.filter(
        (c) =>
          c !== primaryEncompassing &&
          (c.startMs < primaryEncompassing.startMs - 60000 || c.endMs > primaryEncompassing.endMs + 60000)
      );

      const subIntervalSteps = resolveTimeSliceSteps(subIntervals);
      const windowSteps = Math.max(maxEncompassingCount, subIntervalSteps);
      const outsideSteps = outsideIntervals.length > 0 ? resolveTimeSliceSteps(outsideIntervals) : 0;

      totalSteps += windowSteps + outsideSteps;
    } else {
      totalSteps += resolveTimeSliceSteps(cluster);
    }
  });

  return Math.round(totalSteps);
}

/**
 * Aggregates daily steps from multiple Health Connect sources (e.g. Nothing X and phone pedometer)
 * without double-counting overlapping time intervals.
 * Prioritizes dedicated smartwatch companion apps (Nothing X) over phone sensors.
 *
 * @param {Array} samples - Raw step samples belonging to this local calendar day
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @returns {{ totalSteps: number, primarySource: string, diagnostic: object }}
 */
export function aggregateStepsDeduplicated(samples = [], dateStr) {
  const deviceTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const tzOffset = -new Date().getTimezoneOffset();
  const tzSign = tzOffset >= 0 ? "+" : "-";
  const tzHours = String(Math.floor(Math.abs(tzOffset) / 60)).padStart(2, "0");
  const tzMins = String(Math.abs(tzOffset) % 60).padStart(2, "0");
  const timeZoneFormatted = `${deviceTimeZone} (UTC${tzSign}${tzHours}:${tzMins})`;

  if (!samples || samples.length === 0) {
    return {
      totalSteps: 0,
      primarySource: "Health Connect",
      diagnostic: {
        date: dateStr,
        timeZone: timeZoneFormatted,
        sampleCount: 0,
        origins: [],
        sourcesFound: [],
        healthConnectAggregateTotal: null,
        rawRecordsSum: 0,
        watchTotal: 0,
        phoneTotal: 0,
        watchMax: 0,
        allMax: 0,
        computedFinalSteps: 0,
        resolutionReason: "No step records available in Health Connect for this date",
        empty: true
      }
    };
  }

  // Group samples by origin/package name and track per-source metrics
  const originMap = new Map();
  let totalRawCount = 0;

  samples.forEach((sample) => {
    const rawVal = sample.value !== undefined ? sample.value :
                   sample.count !== undefined ? sample.count :
                   sample.steps !== undefined ? sample.steps :
                   sample.sampleValue !== undefined ? sample.sampleValue : 0;
    const count = Math.max(0, parseFloat(rawVal) || 0);
    totalRawCount += count;

    // Use packageName if provided by native plugin, otherwise fallback to sourceId or sourceName
    const pkgName = sample.packageName || sample.sourceId || "unknown_origin";
    const srcName = sample.sourceName || sample.sourceId || pkgName;
    const isWatch = isSmartwatchCompanion(pkgName, srcName);

    if (!originMap.has(pkgName)) {
      originMap.set(pkgName, {
        packageName: pkgName,
        sourceName: srcName,
        displayName: resolveCompanionSource(srcName !== pkgName ? srcName : pkgName),
        isWatch,
        totalSteps: 0,
        sampleCount: 0,
        samples: []
      });
    }

    const entry = originMap.get(pkgName);
    // Upgrade display name if a cleaner human-readable device/companion name arrives
    if (srcName && srcName !== pkgName && entry.sourceName === pkgName) {
      entry.sourceName = srcName;
      entry.displayName = resolveCompanionSource(srcName);
    }
    if (isWatch && !entry.isWatch) {
      entry.isWatch = true;
    }

    entry.samples.push({
      ...sample,
      stepCount: count,
      startMs: sample.startMs || new Date(sample.startDate).getTime(),
      endMs: sample.endMs || new Date(sample.endDate).getTime()
    });
  });

  // Calculate non-duplicate step count per origin using overlap-aware interval reconciliation
  originMap.forEach((entry) => {
    entry.sampleCount = entry.samples.length;
    entry.totalSteps = calculateOriginDeduplicatedSteps(entry.samples);
  });

  const originsList = Array.from(originMap.values());
  const watchOrigins = originsList.filter((o) => o.isWatch && o.totalSteps > 0);
  const phoneOrigins = originsList.filter((o) => (isPhoneOrInactiveSource(o.packageName, o.sourceName) || !o.isWatch) && o.totalSteps > 0);
  const nonWatchOrigins = originsList.filter((o) => !o.isWatch && o.totalSteps > 0);

  const watchTotal = watchOrigins.length > 0 ? Math.round(Math.max(...watchOrigins.map(w => w.totalSteps))) : 0;
  const phoneTotal = phoneOrigins.length > 0 ? Math.round(phoneOrigins.reduce((acc, p) => acc + p.totalSteps, 0)) : 0;
  const rawRecordsSum = Math.round(totalRawCount);
  const healthConnectAggregateTotal = null; // Native Health Connect COUNT_TOTAL query not returned by capacitor-health plugin (plugin returns sample records only)

  let finalSteps = 0;
  let primarySourceLabel = "Google Health Connect";
  let resolutionReason = "";

  // Dynamic Resolution:
  // 1. Authoritative Smartwatch Priority:
  //    When a dedicated smartwatch companion (e.g. Nothing X / CMF Watch) contributes steps,
  //    it is the user's authoritative wearable tracker worn throughout the day.
  //    Never add phone pedometer steps to watch steps, as phone movement in pockets/bags
  //    is overlapping activity and causes double-counting.
  // 2. Non-Watch Fallback:
  //    If no watch records exist for this date, use the best available phone step counter.
  // 3. Raw Sum Fallback:
  //    Preserved when origins did not categorize into watch/non-watch.
  if (watchOrigins.length > 0) {
    const bestWatch = watchOrigins.reduce((prev, cur) => (cur.totalSteps > prev.totalSteps ? cur : prev));
    finalSteps = Math.round(bestWatch.totalSteps);
    primarySourceLabel = bestWatch.displayName;
    const phoneExclusionText = phoneTotal > 0 ? ` (excluded ${phoneTotal.toLocaleString()} historical phone steps)` : "";
    resolutionReason = `Prioritized authoritative smartwatch companion (${bestWatch.displayName}: ${finalSteps.toLocaleString()} steps)${phoneExclusionText}`;
  } else if (nonWatchOrigins.length > 0) {
    const bestNonWatch = nonWatchOrigins.reduce((prev, cur) => (cur.totalSteps > prev.totalSteps ? cur : prev));
    finalSteps = Math.round(bestNonWatch.totalSteps);
    primarySourceLabel = bestNonWatch.displayName;
    resolutionReason = `No smartwatch companion records found; used primary phone step counter (${bestNonWatch.displayName}: ${finalSteps.toLocaleString()} steps)`;
  } else if (rawRecordsSum > 0) {
    finalSteps = rawRecordsSum;
    primarySourceLabel = "Google Health Connect";
    resolutionReason = `Used raw record sum fallback (${finalSteps.toLocaleString()} steps)`;
  } else {
    finalSteps = 0;
    primarySourceLabel = "Google Health Connect";
    resolutionReason = "Health Connect step records totaled 0 for this date";
  }

  const diagnostic = {
    date: dateStr,
    timeZone: timeZoneFormatted,
    sampleCount: samples.length,
    origins: originsList.map((o) => ({
      packageName: o.packageName,
      sourceName: o.sourceName,
      displayName: o.displayName,
      isWatch: o.isWatch,
      recordCount: o.sampleCount,
      totalSteps: Math.round(o.totalSteps)
    })),
    // Backward compatibility for existing UI
    sourcesFound: originsList.map((o) => ({
      source: o.displayName,
      packageName: o.packageName,
      isWatch: o.isWatch,
      totalSteps: Math.round(o.totalSteps),
      samples: o.sampleCount
    })),
    watchMax: watchOrigins.length > 0 ? Math.round(Math.max(...watchOrigins.map(w => w.totalSteps))) : 0,
    allMax: originsList.length > 0 ? Math.round(Math.max(...originsList.map(o => o.totalSteps))) : 0,
    rawRecordsSum,
    healthConnectAggregateTotal,
    watchTotal,
    phoneTotal,
    computedFinalSteps: finalSteps,
    primarySource: primarySourceLabel,
    resolutionReason
  };

  console.log(`[HealthConnect DIAGNOSTIC] Steps Aggregation for ${dateStr} [${timeZoneFormatted}]:`, {
    date: dateStr,
    timeZone: timeZoneFormatted,
    watchTotal,
    phoneTotal,
    rawRecordsSum,
    healthConnectAggregateTotal,
    finalSelectedTotal: finalSteps,
    resolutionReason,
    origins: diagnostic.origins
  });

  return {
    totalSteps: finalSteps,
    primarySource: primarySourceLabel,
    diagnostic
  };
}

/**
 * Safe, resilient query executor for Health.readSamples with comprehensive diagnostic telemetry.
 * Pre-validates finite timestamps, verifies startTime < endTime, records argument conversion,
 * and handles native plugin errors gracefully without crashing the overall synchronization.
 *
 * @param {string} queryId - Human-readable query identifier for telemetry
 * @param {string} dataType - Health data type ('steps', 'calories', 'distance', etc.)
 * @param {string} startDateIso - ISO-8601 UTC timestamp string
 * @param {string} endDateIso - ISO-8601 UTC timestamp string
 * @param {number} limit - Maximum samples to fetch
 * @returns {Promise<{ samples: Array, error: string|null, errorStack: string|null, queryId: string, telemetry: object, succeeded: boolean, skipped?: boolean }>}
 */
export async function executeHealthQuery(queryId, dataType, startDateIso, endDateIso, limit = 1000) {
  const startMs = Date.parse(startDateIso);
  const endMs = Date.parse(endDateIso);

  const isStartFinite = isFinite(startMs);
  const isEndFinite = isFinite(endMs);
  const isStrictlyEarlier = isStartFinite && isEndFinite && startMs < endMs;

  const telemetry = {
    queryId,
    dataType,
    startDatePassed: startDateIso,
    endDatePassed: endDateIso,
    startMs,
    endMs,
    spanMs: isStartFinite && isEndFinite ? endMs - startMs : null,
    isStrictlyEarlier,
    executedAt: new Date().toISOString()
  };

  console.log(`[HealthConnect TELEMETRY] Dispatching query [${queryId}] (${dataType}):`, telemetry);

  if (!isStartFinite || !isEndFinite || !isStrictlyEarlier) {
    const errorMsg = `Pre-query validation failed: start (${startDateIso}, ${startMs}ms) is not strictly before end (${endDateIso}, ${endMs}ms)`;
    console.warn(`[HealthConnect TELEMETRY] Skipping invalid query [${queryId}]:`, errorMsg);
    return {
      samples: [],
      error: errorMsg,
      errorStack: null,
      queryId,
      telemetry,
      succeeded: false,
      skipped: true
    };
  }

  try {
    const res = await Health.readSamples({
      queryId,
      dataType,
      startDate: startDateIso,
      endDate: endDateIso,
      limit
    });
    const samples = res?.samples || [];
    console.log(`[HealthConnect TELEMETRY] Query [${queryId}] (${dataType}) succeeded: ${samples.length} samples returned.`);
    return {
      samples,
      error: null,
      errorStack: null,
      queryId,
      telemetry,
      succeeded: true
    };
  } catch (err) {
    const errDetails = {
      message: err?.message || String(err),
      stack: err?.stack || null,
      queryId,
      dataType,
      telemetry
    };
    console.error(`[HealthConnect TELEMETRY] Query [${queryId}] (${dataType}) threw exception:`, errDetails);
    return {
      samples: [],
      error: err?.message || "Failed to read native samples",
      errorStack: err?.stack || null,
      queryId,
      telemetry,
      succeeded: false,
      failed: true
    };
  }
}

/**
 * Reads native Health Connect records for a specified date range.
 * Normalizes metrics into NutriTrack's activity schema with stable deterministic IDs.
 *
 * @param {string} userId - Current authenticated user ID
 * @param {object} options - Options including days (default 7) or startDate/endDate
 * @returns {Promise<{ records: Array, summary: object }>}
 */
export async function readNativeHealthRecords(userId, options = {}) {
  const targetUserId = userId || "demo_athlete_01";

  const days = Math.max(1, options.days || 7);
  const today = new Date();
  const todayStr = getLocalDateString(today);
  const todayBoundaries = getLocalDayBoundaries(today, true);

  // Local calendar boundaries for historical query
  const rangeStartDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - days, 0, 0, 0, 0);

  // Validate and build safe query ranges
  const safeTodayRange = buildSafeHealthConnectRange(
    todayBoundaries.startDateIso,
    todayBoundaries.endDateIso,
    { clampToNow: true }
  );

  const safeHistoricalRange = buildSafeHealthConnectRange(
    options.startDate || rangeStartDate,
    options.endDate || todayBoundaries.endDateIso,
    { clampToNow: true }
  );

  const now = new Date().toISOString();

  // Check READ_STEPS authorization specifically
  let hasStepsAuth = true;
  let stepsAuthStatus = "CHECKED";
  try {
    const authCheck = await Health.checkAuthorization({ read: ["steps"] });
    hasStepsAuth = authCheck?.readAuthorized?.includes("steps") ?? false;
    stepsAuthStatus = hasStepsAuth ? "AUTHORIZED" : "DENIED";
  } catch (authErr) {
    stepsAuthStatus = `ERROR: ${authErr?.message}`;
  }

  // Check READ_HEART_RATE authorization specifically
  let hasHeartRateAuth = true;
  let heartRateAuthStatus = "CHECKED";
  try {
    const hrAuthCheck = await Health.checkAuthorization({ read: ["heartRate"] });
    hasHeartRateAuth = hrAuthCheck?.readAuthorized?.includes("heartRate") ?? false;
    heartRateAuthStatus = hasHeartRateAuth ? "AUTHORIZED" : "DENIED";
  } catch (hrAuthErr) {
    heartRateAuthStatus = `ERROR: ${hrAuthErr?.message}`;
  }

  console.log(`[HealthConnect DIAGNOSTIC] Initiating sync for user ${targetUserId}:`, {
    todayLocal: todayStr,
    todayBoundaries,
    historicalDays: days,
    safeTodayRange,
    safeHistoricalRange,
    stepsAuthStatus,
    heartRateAuthStatus
  });

  // Dedicated today query for heart rate (validated, clamped, strictly startTime < endTime)
  let todayHeartRateRes = {
    samples: [],
    error: null,
    queryType: "today_focused_clamped",
    queryStartIso: safeTodayRange.startDateIso,
    queryEndIso: safeTodayRange.endDateIso
  };

  if (hasHeartRateAuth && safeTodayRange.isValid) {
    todayHeartRateRes = await executeHealthQuery(
      "today_heartRate_primary",
      "heartRate",
      safeTodayRange.startDateIso,
      safeTodayRange.endDateIso,
      3000
    );
    todayHeartRateRes.queryType = "today_focused_clamped";
  } else if (!hasHeartRateAuth) {
    todayHeartRateRes = {
      samples: [],
      error: "android.permission.health.READ_HEART_RATE not granted",
      queryType: "permission_denied"
    };
  }

  // 1. Dedicated today query for steps (validated, clamped, strictly startTime < endTime)
  let todayStepsRes = {
    samples: [],
    error: null,
    queryType: "today_focused_clamped",
    queryStartIso: safeTodayRange.startDateIso,
    queryEndIso: safeTodayRange.endDateIso,
    rangeValid: safeTodayRange.isValid
  };

  if (hasStepsAuth && safeTodayRange.isValid) {
    todayStepsRes = await executeHealthQuery(
      "today_steps_primary",
      "steps",
      safeTodayRange.startDateIso,
      safeTodayRange.endDateIso,
      3000
    );
    todayStepsRes.queryType = "today_focused_clamped";
    todayStepsRes.queryStartIso = safeTodayRange.startDateIso;
    todayStepsRes.queryEndIso = safeTodayRange.endDateIso;

    // If primary query failed or returned an error, attempt validated same-day fallback
    if (!todayStepsRes.succeeded || todayStepsRes.error) {
      console.warn("[HealthConnect TELEMETRY] Primary today steps query failed; attempting validated same-day fallback...");
      // Safe fallback: strictly within today's boundaries (never pulls yesterday's records)
      const sameDayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 1, 0);
      const sameDayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 0);
      const sameDayRange = buildSafeHealthConnectRange(sameDayStart, sameDayEnd, { clampToNow: false });

      if (sameDayRange.isValid) {
        const fallbackRes = await executeHealthQuery(
          "today_steps_fallback_same_day",
          "steps",
          sameDayRange.startDateIso,
          sameDayRange.endDateIso,
          3000
        );
        if (fallbackRes.succeeded && fallbackRes.samples.length > 0) {
          todayStepsRes = fallbackRes;
          todayStepsRes.queryType = "today_fallback_same_day";
          todayStepsRes.queryStartIso = sameDayRange.startDateIso;
          todayStepsRes.queryEndIso = sameDayRange.endDateIso;
        } else if (fallbackRes.error) {
          todayStepsRes.fallbackError = fallbackRes.error;
          todayStepsRes.fallbackErrorStack = fallbackRes.errorStack;
        }
      }
    }
  } else if (!hasStepsAuth) {
    todayStepsRes = {
      samples: [],
      error: "android.permission.health.READ_STEPS not granted",
      queryType: "permission_denied"
    };
  } else {
    todayStepsRes = {
      samples: [],
      error: `Invalid time range: ${safeTodayRange.reason}`,
      queryType: "invalid_range"
    };
  }

  // 2. Historical range queries for steps and other metrics
  let rangeStepsRes = { samples: [], error: null };
  if (hasStepsAuth && safeHistoricalRange.isValid) {
    rangeStepsRes = await executeHealthQuery(
      "range_historical_steps",
      "steps",
      safeHistoricalRange.startDateIso,
      safeHistoricalRange.endDateIso,
      3000
    );
  } else if (!hasStepsAuth) {
    rangeStepsRes = { samples: [], error: "android.permission.health.READ_STEPS not granted" };
  } else {
    rangeStepsRes = { samples: [], error: `Invalid range: ${safeHistoricalRange.reason}` };
  }

  // Concurrently query non-steps metrics via executeHealthQuery (ensuring full resilience)
  const [
    caloriesRes,
    distanceRes,
    workoutRes,
    heartRateRes,
    sleepRes,
    weightRes
  ] = await Promise.all([
    safeHistoricalRange.isValid
      ? executeHealthQuery("historical_calories", "calories", safeHistoricalRange.startDateIso, safeHistoricalRange.endDateIso, 2000)
      : Promise.resolve({ samples: [] }),
    safeHistoricalRange.isValid
      ? executeHealthQuery("historical_distance", "distance", safeHistoricalRange.startDateIso, safeHistoricalRange.endDateIso, 2000)
      : Promise.resolve({ samples: [] }),
    safeHistoricalRange.isValid
      ? executeHealthQuery("historical_workout", "workout", safeHistoricalRange.startDateIso, safeHistoricalRange.endDateIso, 1000)
      : Promise.resolve({ samples: [] }),
    safeHistoricalRange.isValid
      ? executeHealthQuery("historical_heartRate", "heartRate", safeHistoricalRange.startDateIso, safeHistoricalRange.endDateIso, 2000)
      : Promise.resolve({ samples: [] }),
    safeHistoricalRange.isValid
      ? executeHealthQuery("historical_sleep", "sleep", safeHistoricalRange.startDateIso, safeHistoricalRange.endDateIso, 1000)
      : Promise.resolve({ samples: [] }),
    safeHistoricalRange.isValid
      ? executeHealthQuery("historical_weight", "weight", safeHistoricalRange.startDateIso, safeHistoricalRange.endDateIso, 500)
      : Promise.resolve({ samples: [] })
  ]);

  // Merge, inspect, and deduplicate step samples
  const rawStepSamples = [...(todayStepsRes?.samples || []), ...(rangeStepsRes?.samples || [])];
  const seenStepSignatures = new Set();
  const stepSamples = [];
  let invalidRecordsSkipped = 0;
  const invalidReasons = [];

  rawStepSamples.forEach((rawSample) => {
    const inspected = inspectAndValidateStepSample(rawSample);
    if (!inspected.isValid) {
      invalidRecordsSkipped++;
      if (invalidReasons.length < 5) {
        invalidReasons.push(inspected.reason);
      }
      return;
    }

    const sample = inspected.cleanSample;
    const sig = `${sample.startDate}_${sample.endDate}_${sample.sourceId || ""}_${sample.sourceName || ""}_${sample.value}`;
    if (!seenStepSignatures.has(sig)) {
      seenStepSignatures.add(sig);
      stepSamples.push(sample);
    }
  });

  const stepSampleDiagnostics = stepSamples.slice(0, 15).map((s) => ({
    count: s.value,
    startDate: s.startDate,
    endDate: s.endDate,
    sourceId: s.sourceId,
    sourceName: s.sourceName
  }));

  console.log("[HealthConnect DIAGNOSTIC] Raw Query Results:", {
    stepsAuthStatus,
    todayStepsCount: (todayStepsRes?.samples || []).length,
    todayStepsError: todayStepsRes?.error || null,
    rangeStepsCount: (rangeStepsRes?.samples || []).length,
    rangeStepsError: rangeStepsRes?.error || null,
    combinedDeduplicatedStepSamples: stepSamples.length,
    samplePreview: stepSampleDiagnostics,
    calorieSamplesCount: (caloriesRes?.samples || []).length,
    distanceSamplesCount: (distanceRes?.samples || []).length,
    workoutSamplesCount: (workoutRes?.samples || []).length,
    heartRateSamplesCount: (heartRateRes?.samples || []).length,
    sleepSamplesCount: (sleepRes?.samples || []).length,
    weightSamplesCount: (weightRes?.samples || []).length
  });

  const calorieSamples = caloriesRes?.samples || [];
  const distanceSamples = distanceRes?.samples || [];
  const workoutSamples = workoutRes?.samples || [];
  const sleepSamples = sleepRes?.samples || [];
  const weightSamples = weightRes?.samples || [];

  // Dedicated heart rate parsing and sample extraction (Health Connect HeartRateRecords contain multiple samples per record)
  const rawHeartRateSamples = [...(todayHeartRateRes?.samples || []), ...(heartRateRes?.samples || [])];
  const seenHeartRateSignatures = new Set();
  const validHeartRateSamples = [];

  rawHeartRateSamples.forEach((raw) => {
    const bpm = parseFloat(raw.value);
    // Never fabricate heart rate, generate demo values, or record zero
    if (!bpm || bpm <= 0 || !isFinite(bpm)) return;
    const timeStr = raw.startDate || raw.endDate || now;
    const origin = raw.packageName || raw.sourceId || raw.sourceName || "unknown";
    const sig = `${timeStr}_${Math.round(bpm)}_${origin}`;
    if (!seenHeartRateSignatures.has(sig)) {
      seenHeartRateSignatures.add(sig);
      validHeartRateSamples.push({
        value: bpm,
        bpm: Math.round(bpm),
        startDate: timeStr,
        endDate: raw.endDate || timeStr,
        timeMs: new Date(timeStr).getTime(),
        sourceId: raw.sourceId,
        sourceName: raw.sourceName,
        packageName: raw.packageName || raw.sourceId || origin
      });
    }
  });

  // Group by local device calendar date (YYYY-MM-DD)
  const dateMap = new Map();

  const getOrCreateDay = (dateStr) => {
    if (!dateMap.has(dateStr)) {
      dateMap.set(dateStr, {
        date: dateStr,
        steps: 0,
        hasSteps: false,
        stepSampleCount: 0,
        activeCalories: 0,
        hasCalories: false,
        distanceMeters: 0,
        hasDistance: false,
        workoutMinutes: 0,
        hasWorkouts: false,
        heartRateValues: [],
        heartRateSamples: [],
        hasHeartRate: false,
        heartRateLatest: null,
        heartRateLatestTimestamp: null,
        heartRateLatestOrigin: null,
        heartRateMin: null,
        heartRateMax: null,
        heartRateAvg: null,
        sleepMinutes: 0,
        hasSleep: false,
        weightKg: null,
        hasWeight: false,
        sources: new Set()
      });
    }
    return dateMap.get(dateStr);
  };

  // Group step samples by local date
  const stepsByDate = new Map();
  stepSamples.forEach((sample) => {
    const sampleDate = new Date(sample.startDate || sample.endDate || now);
    const dStr = getLocalDateString(sampleDate);
    if (!stepsByDate.has(dStr)) {
      stepsByDate.set(dStr, []);
    }
    stepsByDate.get(dStr).push(sample);
  });

  // Deduplicate and aggregate steps per local calendar date
  stepsByDate.forEach((daySamples, dateStr) => {
    const day = getOrCreateDay(dateStr);
    const { totalSteps, primarySource, diagnostic } = aggregateStepsDeduplicated(daySamples, dateStr);
    day.steps = totalSteps;
    day.hasSteps = daySamples.length > 0;
    day.stepSampleCount = daySamples.length;
    day.sources.add(primarySource);
    day.stepsDiagnostic = diagnostic;
  });

  // Group active calories by local date
  calorieSamples.forEach((sample) => {
    const dStr = getLocalDateString(new Date(sample.startDate || sample.endDate || now));
    const day = getOrCreateDay(dStr);
    day.activeCalories += parseFloat(sample.value) || 0;
    day.hasCalories = true;
    if (sample.sourceName) day.sources.add(sample.sourceName);
  });

  // Group distance by local date
  distanceSamples.forEach((sample) => {
    const dStr = getLocalDateString(new Date(sample.startDate || sample.endDate || now));
    const day = getOrCreateDay(dStr);
    day.distanceMeters += parseFloat(sample.value) || 0;
    day.hasDistance = true;
    if (sample.sourceName) day.sources.add(sample.sourceName);
  });

  // Group workout sessions by local date
  workoutSamples.forEach((sample) => {
    const dStr = getLocalDateString(new Date(sample.startDate || sample.endDate || now));
    const day = getOrCreateDay(dStr);
    day.workoutMinutes += parseFloat(sample.value) || 0;
    day.hasWorkouts = true;
    if (sample.sourceName) day.sources.add(sample.sourceName);
  });

  // Group heart rate by local date & aggregate individual BPM measurements
  const heartRateByDate = new Map();
  validHeartRateSamples.forEach((sample) => {
    const sampleDate = new Date(sample.startDate || sample.endDate || now);
    const dStr = getLocalDateString(sampleDate);
    if (!heartRateByDate.has(dStr)) {
      heartRateByDate.set(dStr, []);
    }
    heartRateByDate.get(dStr).push(sample);
  });

  heartRateByDate.forEach((daySamples, dateStr) => {
    const day = getOrCreateDay(dateStr);
    daySamples.sort((a, b) => a.timeMs - b.timeMs);
    const bpmValues = daySamples.map((s) => s.bpm);
    const sum = bpmValues.reduce((a, b) => a + b, 0);
    const avg = Math.round(sum / bpmValues.length);
    const min = Math.min(...bpmValues);
    const max = Math.max(...bpmValues);
    const latest = daySamples[daySamples.length - 1];

    day.hasHeartRate = true;
    day.heartRateValues = bpmValues;
    day.heartRateAvg = avg;
    day.heartRateMin = min;
    day.heartRateMax = max;
    day.heartRateLatest = latest.bpm;
    day.heartRateLatestTimestamp = latest.startDate;
    day.heartRateLatestOrigin = latest.packageName || latest.sourceName;
    day.heartRateSamples = daySamples;
    daySamples.forEach((s) => {
      if (s.sourceName) day.sources.add(s.sourceName);
      if (s.packageName) day.sources.add(s.packageName);
    });
  });

  // Group sleep by local date
  sleepSamples.forEach((sample) => {
    const dStr = getLocalDateString(new Date(sample.startDate || sample.endDate || now));
    const day = getOrCreateDay(dStr);
    day.sleepMinutes += parseFloat(sample.value) || 0;
    day.hasSleep = true;
    if (sample.sourceName) day.sources.add(sample.sourceName);
  });

  // Group weight by local date
  weightSamples.forEach((sample) => {
    const dStr = getLocalDateString(new Date(sample.startDate || sample.endDate || now));
    const day = getOrCreateDay(dStr);
    const w = parseFloat(sample.value);
    if (w > 0) {
      day.weightKg = w;
      day.hasWeight = true;
    }
    if (sample.sourceName) day.sources.add(sample.sourceName);
  });

  const records = [];

  dateMap.forEach((dayData, dateStr) => {
    const rawSource = Array.from(dayData.sources)[0] || "smartwatch_health_connect";
    const companionSource = resolveCompanionSource(rawSource);

    // 1. Steps Record
    if (dayData.hasSteps) {
      records.push({
        logId: generateActivityLogId(targetUserId, dateStr, "steps", "smartwatch_health_connect"),
        userId: targetUserId,
        date: dateStr,
        metricType: "steps",
        value: Math.round(dayData.steps),
        unit: "count",
        source: "smartwatch_health_connect",
        recordedTimestamp: `${dateStr}T23:59:59.000Z`,
        lastSyncedTimestamp: now,
        metadata: {
          bridge: "Google Health Connect",
          sourcePackage: companionSource,
          sampleCount: dayData.stepSampleCount
        }
      });
    }

    // 2. Active Calories Burned Record
    if (dayData.hasCalories) {
      records.push({
        logId: generateActivityLogId(targetUserId, dateStr, "active_calories", "smartwatch_health_connect"),
        userId: targetUserId,
        date: dateStr,
        metricType: "active_calories",
        value: Math.round(dayData.activeCalories),
        unit: "kcal",
        source: "smartwatch_health_connect",
        recordedTimestamp: `${dateStr}T23:59:59.000Z`,
        lastSyncedTimestamp: now,
        metadata: {
          energyType: "Active Burn Only",
          bridge: "Google Health Connect",
          sourcePackage: companionSource
        }
      });
    }

    // 3. Distance Record
    if (dayData.hasDistance) {
      records.push({
        logId: generateActivityLogId(targetUserId, dateStr, "distance_meters", "smartwatch_health_connect"),
        userId: targetUserId,
        date: dateStr,
        metricType: "distance_meters",
        value: Math.round(dayData.distanceMeters),
        unit: "meters",
        source: "smartwatch_health_connect",
        recordedTimestamp: `${dateStr}T23:59:59.000Z`,
        lastSyncedTimestamp: now,
        metadata: {
          bridge: "Google Health Connect",
          sourcePackage: companionSource
        }
      });
    }

    // 4. Workout Duration Record
    if (dayData.hasWorkouts && dayData.workoutMinutes > 0) {
      records.push({
        logId: generateActivityLogId(targetUserId, dateStr, "workout_duration_minutes", "smartwatch_health_connect"),
        userId: targetUserId,
        date: dateStr,
        metricType: "workout_duration_minutes",
        value: Math.round(dayData.workoutMinutes),
        unit: "minutes",
        source: "smartwatch_health_connect",
        recordedTimestamp: `${dateStr}T23:59:59.000Z`,
        lastSyncedTimestamp: now,
        metadata: {
          bridge: "Google Health Connect",
          sourcePackage: companionSource
        }
      });
    }

    // 5. Average Heart Rate Record with full BPM samples timeline
    if (dayData.hasHeartRate && dayData.heartRateValues.length > 0) {
      records.push({
        logId: generateActivityLogId(targetUserId, dateStr, "heart_rate_avg", "smartwatch_health_connect"),
        userId: targetUserId,
        date: dateStr,
        metricType: "heart_rate_avg",
        value: dayData.heartRateAvg,
        unit: "bpm",
        source: "smartwatch_health_connect",
        recordedTimestamp: `${dateStr}T23:59:59.000Z`,
        lastSyncedTimestamp: now,
        metadata: {
          latestBpm: dayData.heartRateLatest,
          latestTimestamp: dayData.heartRateLatestTimestamp,
          latestOrigin: dayData.heartRateLatestOrigin,
          minBpm: dayData.heartRateMin,
          maxBpm: dayData.heartRateMax,
          avgBpm: dayData.heartRateAvg,
          sampleCount: dayData.heartRateValues.length,
          samples: dayData.heartRateSamples.map(s => ({
            time: s.startDate,
            bpm: s.bpm,
            origin: s.packageName || s.sourceName
          })).slice(-100),
          bridge: "Google Health Connect",
          sourcePackage: companionSource
        }
      });
    }

    // 6. Sleep Duration Record
    if (dayData.hasSleep && dayData.sleepMinutes > 0) {
      records.push({
        logId: generateActivityLogId(targetUserId, dateStr, "sleep_duration_minutes", "smartwatch_health_connect"),
        userId: targetUserId,
        date: dateStr,
        metricType: "sleep_duration_minutes",
        value: Math.round(dayData.sleepMinutes),
        unit: "minutes",
        source: "smartwatch_health_connect",
        recordedTimestamp: `${dateStr}T23:59:59.000Z`,
        lastSyncedTimestamp: now,
        metadata: {
          bridge: "Google Health Connect",
          sourcePackage: companionSource
        }
      });
    }

    // 7. Weight Record
    if (dayData.hasWeight && dayData.weightKg > 0) {
      records.push({
        logId: generateActivityLogId(targetUserId, dateStr, "weight_kg", "smartwatch_health_connect"),
        userId: targetUserId,
        date: dateStr,
        metricType: "weight_kg",
        value: Math.round(dayData.weightKg * 10) / 10,
        unit: "kg",
        source: "smartwatch_health_connect",
        recordedTimestamp: `${dateStr}T23:59:59.000Z`,
        lastSyncedTimestamp: now,
        metadata: {
          bridge: "Google Health Connect",
          sourcePackage: companionSource
        }
      });

      addWeightLog(targetUserId, {
        date: dateStr,
        weightKg: dayData.weightKg,
        dailySteps: dayData.hasSteps ? Math.round(dayData.steps) : null
      }).catch(e => console.warn("Auto weight log sync error:", e));
    }
  });

  console.log(`[HealthConnect DIAGNOSTIC] Generated ${records.length} activity records across ${dateMap.size} calendar days.`);

  const todayEntry = dateMap.get(todayStr);
  const todayHrSamples = heartRateByDate.get(todayStr) || [];
  const detectedSources = Array.from(new Set([
    ...stepSamples.map(s => s.packageName || s.sourceName),
    ...validHeartRateSamples.map(s => s.packageName || s.sourceName),
    ...calorieSamples.map(s => s.packageName || s.sourceName),
    ...workoutSamples.map(s => s.packageName || s.sourceName)
  ].filter(Boolean)));

  const isNothingXSource = detectedSources.some(o =>
    o.toLowerCase().includes("nothing") ||
    o.toLowerCase().includes("hearth") ||
    o.toLowerCase().includes("cmf")
  );

  const summary = {
    daysFound: dateMap.size,
    todayDate: todayStr,
    todayHasSteps: todayEntry?.hasSteps || false,
    todaySteps: todayEntry ? Math.round(todayEntry.steps) : null,
    todayStepSamples: stepsByDate.get(todayStr)?.length || 0,
    totalStepSamples: stepSamples.length,
    rawStepRecordsCount: rawStepSamples.length,
    invalidRecordsSkipped,
    invalidReasonsPreview: invalidReasons,
    validStepRecordsUsed: stepSamples.length,
    stepsAuthStatus,
    timeZone: todayEntry?.stepsDiagnostic?.timeZone || (Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"),
    todayQueryStartIso: todayStepsRes.queryStartIso || safeTodayRange.startDateIso,
    todayQueryEndIso: todayStepsRes.queryEndIso || safeTodayRange.endDateIso,
    todayQueryValidated: safeTodayRange.isValid,
    todayStepsQuerySamples: (todayStepsRes?.samples || []).length,
    todayStepsQueryError: todayStepsRes?.error || null,
    todayStepsQueryErrorStack: todayStepsRes?.errorStack || null,
    todayStepsQueryType: todayStepsRes?.queryType || "unknown",
    todayStepsTelemetry: todayStepsRes?.telemetry || null,
    rangeQueryStartIso: safeHistoricalRange.startDateIso,
    rangeQueryEndIso: safeHistoricalRange.endDateIso,
    rangeQueryValidated: safeHistoricalRange.isValid,
    rangeStepsQuerySamples: (rangeStepsRes?.samples || []).length,
    rangeStepsQueryError: rangeStepsRes?.error || null,
    rangeStepsTelemetry: rangeStepsRes?.telemetry || null,
    stepsDiagnostic: todayEntry?.stepsDiagnostic || null,
    rawRecordsSum: todayEntry?.stepsDiagnostic?.rawRecordsSum ?? 0,
    healthConnectAggregateTotal: todayEntry?.stepsDiagnostic?.healthConnectAggregateTotal ?? null,
    originsBreakdown: todayEntry?.stepsDiagnostic?.origins || [],
    watchTotal: todayEntry?.stepsDiagnostic?.watchTotal ?? 0,
    phoneTotal: todayEntry?.stepsDiagnostic?.phoneTotal ?? 0,
    resolutionReason: todayEntry?.stepsDiagnostic?.resolutionReason || "",
    samplePreview: stepSampleDiagnostics,
    totalCalorieSamples: calorieSamples.length,
    totalDistanceSamples: distanceSamples.length,
    totalWorkoutSamples: workoutSamples.length,
    totalHeartRateSamples: validHeartRateSamples.length,
    totalSleepSamples: sleepSamples.length,
    totalWeightSamples: weightSamples.length,
    hasIndividualWorkouts: workoutSamples.length > 0,
    heartRate: {
      hasPermission: hasHeartRateAuth,
      permissionStatus: heartRateAuthStatus,
      todaySampleCount: todayHrSamples.length,
      todayLatestBpm: todayEntry?.heartRateLatest ?? null,
      todayLatestTimestamp: todayEntry?.heartRateLatestTimestamp ?? null,
      todayLatestOrigin: todayEntry?.heartRateLatestOrigin ?? null,
      todayAvgBpm: todayEntry?.heartRateAvg ?? null,
      todayMinBpm: todayEntry?.heartRateMin ?? null,
      todayMaxBpm: todayEntry?.heartRateMax ?? null,
      todaySamples: todayEntry?.heartRateSamples || [],
      totalSamplesAcrossDays: validHeartRateSamples.length,
      detectedOrigins: Array.from(new Set(validHeartRateSamples.map(s => s.packageName || s.sourceName))),
      todayQueryError: todayHeartRateRes?.error || null,
      historicalQueryError: heartRateRes?.error || null,
      isNothingXDetected: isNothingXSource,
      limitationNote: isNothingXSource && todayHrSamples.length === 0
        ? "Nothing X / CMF Watch app only exports Steps, Active Calories, Distance, Sleep, and Workouts to Health Connect. Continuous passive heart rate records are retained internally by Nothing X and not exported to Health Connect."
        : null
    }
  };

  return {
    records,
    summary
  };
}

/**
 * Full synchronization pipeline for Native Health Connect to Firestore & local storage.
 */
export async function syncNativeHealthConnect(userId, options = {}) {
  const targetUserId = userId || "demo_athlete_01";

  const availability = await checkHealthAvailability();
  if (!availability.available) {
    return {
      success: false,
      reason: availability.reason || "Health Connect is not available on this device.",
      isNative: availability.platform !== "web"
    };
  }

  // Request/verify permissions
  const permResult = await requestHealthPermissions();
  if (!permResult.success) {
    const errorMsg = permResult.error
      ? `Permission check error: ${permResult.error}`
      : "Health Connect permissions were not granted. Please allow permissions in Android Health Connect settings.";
    return {
      success: false,
      reason: errorMsg,
      denied: permResult.readDenied
    };
  }

  const { records, summary } = await readNativeHealthRecords(targetUserId, options);
  const now = new Date().toISOString();

  // Reliably identify watch companion app and hardware model from records
  const identifiedDevice = identifyWatchDevice(records);
  const detectedCompanion = identifiedDevice.isReliablyIdentified
    ? identifiedDevice.companionApp
    : (records.find(r => r.metadata?.sourcePackage)?.metadata?.sourcePackage || "Google Health Connect");

  // Check if steps permission is missing
  const stepsPermissionDenied = summary?.stepsAuthStatus === "DENIED" || permResult.hasSteps === false;

  // Persist full sync diagnostics to localStorage for physical device on-screen inspection
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("nutritrack_last_health_sync_diagnostics", JSON.stringify({
        syncedAt: now,
        userId: targetUserId,
        summary,
        detectedCompanion,
        identifiedDevice,
        recordsGenerated: records.length,
        stepsPermissionDenied,
        permResult
      }));
    }
  } catch (storageErr) {
    console.warn("Could not save sync diagnostics to localStorage:", storageErr);
  }

  if (records.length === 0) {
    // Save successful sync timestamp even when no records were found today
    await saveWearableConnection(targetUserId, {
      isConnected: true,
      companionApp: detectedCompanion,
      deviceModel: identifiedDevice.model,
      brand: identifiedDevice.brand,
      watchType: identifiedDevice.type,
      isReliablyIdentified: identifiedDevice.isReliablyIdentified,
      lastSyncedTimestamp: now
    });
    return {
      success: true,
      count: 0,
      records: [],
      summary,
      stepsPermissionDenied,
      identifiedDevice,
      message: "Health Connect connected successfully, but no activity records were recorded yet in this time frame."
    };
  }

  const result = await syncHealthConnectRecordsToFirestore(targetUserId, records);

  // Save successful sync timestamp and detected source to wearable connection
  await saveWearableConnection(targetUserId, {
    isConnected: true,
    companionApp: detectedCompanion,
    deviceModel: identifiedDevice.model,
    brand: identifiedDevice.brand,
    watchType: identifiedDevice.type,
    isReliablyIdentified: identifiedDevice.isReliablyIdentified,
    lastSyncedTimestamp: now
  });

  return {
    success: true,
    count: result.count,
    records,
    summary,
    syncedAt: now,
    detectedCompanion,
    stepsPermissionDenied
  };
}

/**
 * Parses exported Health Connect JSON records.
 * Supports standard Google Health Connect exports, Takeout format, and universal watch exports.
 *
 * @param {string} fileContent - Raw JSON string from export
 * @param {string} userId - Authenticated user ID
 * @returns {Array} Normalized activity log records with stable IDs
 */
export function parseHealthConnectExportJson(fileContent, userId) {
  let data;
  try {
    data = typeof fileContent === "string" ? JSON.parse(fileContent) : fileContent;
  } catch (err) {
    throw new Error("Invalid JSON file format. Please upload a valid Health Connect export file.");
  }

  const records = [];
  const now = new Date().toISOString();

  // Helper to process arrays of records
  const rawList = Array.isArray(data) ? data : data.records || data.data || [data];

  rawList.forEach((entry) => {
    const timeField = entry.startTime || entry.time || entry.date || entry.endTime || now;
    const dateStr = getLocalDateString(timeField);
    const sourceApp = entry.sourceApp || entry.companion || entry.device || "Health Connect Import";

    // 1. Steps
    if (entry.steps !== undefined || entry.type === "Steps" || entry.metricType === "steps" || entry.count !== undefined) {
      const stepVal = parseFloat(entry.steps ?? entry.count ?? entry.value ?? 0);
      if (stepVal > 0) {
        records.push({
          logId: generateActivityLogId(userId, dateStr, "steps", "smartwatch_health_connect"),
          userId,
          date: dateStr,
          metricType: "steps",
          value: stepVal,
          unit: "count",
          source: "health_connect_import",
          recordedTimestamp: new Date(timeField).toISOString(),
          lastSyncedTimestamp: now,
          metadata: { companion: sourceApp }
        });
      }
    }

    // 2. Active Calories Burned
    if (entry.activeCalories !== undefined || entry.energy !== undefined || entry.calories !== undefined || entry.type === "ActiveCaloriesBurned") {
      const calVal = parseFloat(entry.activeCalories ?? entry.energy?.inKilocalories ?? entry.calories ?? entry.value ?? 0);
      if (calVal > 0) {
        records.push({
          logId: generateActivityLogId(userId, dateStr, "active_calories", "smartwatch_health_connect"),
          userId,
          date: dateStr,
          metricType: "active_calories",
          value: calVal,
          unit: "kcal",
          source: "health_connect_import",
          recordedTimestamp: new Date(timeField).toISOString(),
          lastSyncedTimestamp: now,
          metadata: { type: "Active Energy Only", companion: sourceApp }
        });
      }
    }

    // 3. Distance
    if (entry.distance !== undefined || entry.distanceMeters !== undefined || entry.type === "Distance") {
      const distVal = parseFloat(entry.distanceMeters ?? entry.distance?.inMeters ?? entry.distance ?? entry.value ?? 0);
      if (distVal > 0) {
        records.push({
          logId: generateActivityLogId(userId, dateStr, "distance_meters", "smartwatch_health_connect"),
          userId,
          date: dateStr,
          metricType: "distance_meters",
          value: distVal,
          unit: "meters",
          source: "health_connect_import",
          recordedTimestamp: new Date(timeField).toISOString(),
          lastSyncedTimestamp: now,
          metadata: { companion: sourceApp }
        });
      }
    }

    // 4. Exercise Sessions
    if (entry.exerciseType !== undefined || entry.type === "ExerciseSession" || entry.workoutDuration !== undefined || entry.durationMinutes !== undefined) {
      const durationMins = parseFloat(entry.durationMinutes ?? entry.workoutDuration ?? (entry.duration ? entry.duration / 60 : 0));
      if (durationMins > 0) {
        records.push({
          logId: generateActivityLogId(userId, dateStr, "workout_duration_minutes", "smartwatch_health_connect"),
          userId,
          date: dateStr,
          metricType: "workout_duration_minutes",
          value: durationMins,
          unit: "minutes",
          source: "health_connect_import",
          recordedTimestamp: new Date(timeField).toISOString(),
          lastSyncedTimestamp: now,
          metadata: {
            title: entry.title || entry.exerciseType || "Workout",
            companion: sourceApp
          }
        });
      }
    }

    // 5. Heart Rate
    if (entry.heartRate !== undefined || entry.bpm !== undefined || entry.avgBpm !== undefined) {
      const hrVal = parseFloat(entry.heartRate ?? entry.bpm ?? entry.avgBpm ?? 0);
      if (hrVal > 0) {
        records.push({
          logId: generateActivityLogId(userId, dateStr, "heart_rate_avg", "smartwatch_health_connect"),
          userId,
          date: dateStr,
          metricType: "heart_rate_avg",
          value: Math.round(hrVal),
          unit: "bpm",
          source: "health_connect_import",
          recordedTimestamp: new Date(timeField).toISOString(),
          lastSyncedTimestamp: now,
          metadata: { companion: sourceApp }
        });
      }
    }

    // 6. Sleep Duration
    if (entry.sleepMinutes !== undefined || entry.sleepHours !== undefined) {
      const sleepMins = parseFloat(entry.sleepMinutes ?? (entry.sleepHours ? entry.sleepHours * 60 : 0));
      if (sleepMins > 0) {
        records.push({
          logId: generateActivityLogId(userId, dateStr, "sleep_duration_minutes", "smartwatch_health_connect"),
          userId,
          date: dateStr,
          metricType: "sleep_duration_minutes",
          value: Math.round(sleepMins),
          unit: "minutes",
          source: "health_connect_import",
          recordedTimestamp: new Date(timeField).toISOString(),
          lastSyncedTimestamp: now,
          metadata: { companion: sourceApp }
        });
      }
    }
  });

  return records;
}

/**
 * Parses exported Health Connect CSV records (e.g. Google Takeout, Nothing X export, etc.).
 *
 * @param {string} csvContent - Raw CSV string
 * @param {string} userId - Authenticated user ID
 * @returns {Array} Normalized activity records with stable IDs
 */
export function parseHealthConnectExportCsv(csvContent, userId) {
  if (typeof csvContent !== "string" || !csvContent.trim()) {
    throw new Error("Empty CSV content.");
  }
  const lines = csvContent.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) {
    throw new Error("CSV file does not contain enough data rows.");
  }

  const rawHeaders = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/['"]/g, ""));
  const records = [];
  const now = new Date().toISOString();

  // Find column indexes
  const dateIdx = rawHeaders.findIndex(h => h.includes("date") || h.includes("time") || h.includes("timestamp"));
  const stepsIdx = rawHeaders.findIndex(h => h === "steps" || h.includes("step"));
  const calIdx = rawHeaders.findIndex(h => h.includes("calor") || h.includes("energy") || h.includes("burn"));
  const distIdx = rawHeaders.findIndex(h => h.includes("dist") || h.includes("meter"));
  const workoutIdx = rawHeaders.findIndex(h => h.includes("workout") || h.includes("exercise") || h.includes("duration"));
  const hrIdx = rawHeaders.findIndex(h => h.includes("heart") || h.includes("pulse") || h.includes("bpm"));
  const sleepIdx = rawHeaders.findIndex(h => h.includes("sleep"));
  const weightIdx = rawHeaders.findIndex(h => h.includes("weight") || h.includes("mass") || h.includes("kg"));

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(",").map(c => c.trim().replace(/['"]/g, ""));
    if (row.length === 0 || !row[0]) continue;

    let dateStr = now.split("T")[0];
    if (dateIdx >= 0 && row[dateIdx]) {
      const parsedDate = new Date(row[dateIdx]);
      if (!isNaN(parsedDate.getTime())) {
        dateStr = getLocalDateString(parsedDate);
      } else if (/^\d{4}-\d{2}-\d{2}/.test(row[dateIdx])) {
        dateStr = row[dateIdx].slice(0, 10);
      }
    }

    // Steps
    if (stepsIdx >= 0 && row[stepsIdx]) {
      const val = parseFloat(row[stepsIdx]);
      if (!isNaN(val) && val > 0) {
        records.push({
          logId: generateActivityLogId(userId, dateStr, "steps", "health_connect_csv"),
          userId,
          date: dateStr,
          metricType: "steps",
          value: Math.round(val),
          unit: "count",
          source: "health_connect_csv",
          recordedTimestamp: `${dateStr}T23:59:59.000Z`,
          lastSyncedTimestamp: now,
          metadata: { format: "CSV" }
        });
      }
    }

    // Active Calories
    if (calIdx >= 0 && row[calIdx]) {
      const val = parseFloat(row[calIdx]);
      if (!isNaN(val) && val > 0) {
        records.push({
          logId: generateActivityLogId(userId, dateStr, "active_calories", "health_connect_csv"),
          userId,
          date: dateStr,
          metricType: "active_calories",
          value: Math.round(val),
          unit: "kcal",
          source: "health_connect_csv",
          recordedTimestamp: `${dateStr}T23:59:59.000Z`,
          lastSyncedTimestamp: now,
          metadata: { format: "CSV" }
        });
      }
    }

    // Distance
    if (distIdx >= 0 && row[distIdx]) {
      const val = parseFloat(row[distIdx]);
      if (!isNaN(val) && val > 0) {
        const meters = val < 100 ? val * 1000 : val;
        records.push({
          logId: generateActivityLogId(userId, dateStr, "distance_meters", "health_connect_csv"),
          userId,
          date: dateStr,
          metricType: "distance_meters",
          value: Math.round(meters),
          unit: "meters",
          source: "health_connect_csv",
          recordedTimestamp: `${dateStr}T23:59:59.000Z`,
          lastSyncedTimestamp: now,
          metadata: { format: "CSV" }
        });
      }
    }

    // Workout Duration
    if (workoutIdx >= 0 && row[workoutIdx]) {
      const val = parseFloat(row[workoutIdx]);
      if (!isNaN(val) && val > 0) {
        records.push({
          logId: generateActivityLogId(userId, dateStr, "workout_duration_minutes", "health_connect_csv"),
          userId,
          date: dateStr,
          metricType: "workout_duration_minutes",
          value: Math.round(val),
          unit: "minutes",
          source: "health_connect_csv",
          recordedTimestamp: `${dateStr}T23:59:59.000Z`,
          lastSyncedTimestamp: now,
          metadata: { format: "CSV" }
        });
      }
    }

    // Heart Rate
    if (hrIdx >= 0 && row[hrIdx]) {
      const val = parseFloat(row[hrIdx]);
      if (!isNaN(val) && val > 0) {
        records.push({
          logId: generateActivityLogId(userId, dateStr, "heart_rate_avg", "health_connect_csv"),
          userId,
          date: dateStr,
          metricType: "heart_rate_avg",
          value: Math.round(val),
          unit: "bpm",
          source: "health_connect_csv",
          recordedTimestamp: `${dateStr}T23:59:59.000Z`,
          lastSyncedTimestamp: now,
          metadata: { format: "CSV" }
        });
      }
    }

    // Sleep
    if (sleepIdx >= 0 && row[sleepIdx]) {
      const val = parseFloat(row[sleepIdx]);
      if (!isNaN(val) && val > 0) {
        const minutes = val < 24 ? val * 60 : val;
        records.push({
          logId: generateActivityLogId(userId, dateStr, "sleep_duration_minutes", "health_connect_csv"),
          userId,
          date: dateStr,
          metricType: "sleep_duration_minutes",
          value: Math.round(minutes),
          unit: "minutes",
          source: "health_connect_csv",
          recordedTimestamp: `${dateStr}T23:59:59.000Z`,
          lastSyncedTimestamp: now,
          metadata: { format: "CSV" }
        });
      }
    }

    // Weight
    if (weightIdx >= 0 && row[weightIdx]) {
      const val = parseFloat(row[weightIdx]);
      if (!isNaN(val) && val > 0) {
        records.push({
          logId: generateActivityLogId(userId, dateStr, "weight_kg", "health_connect_csv"),
          userId,
          date: dateStr,
          metricType: "weight_kg",
          value: Math.round(val * 10) / 10,
          unit: "kg",
          source: "health_connect_csv",
          recordedTimestamp: `${dateStr}T23:59:59.000Z`,
          lastSyncedTimestamp: now,
          metadata: { format: "CSV" }
        });
      }
    }
  }

  return records;
}

/**
 * Universal importer: handles both JSON and CSV files automatically.
 */
export function parseHealthConnectExport(content, userId, filename = "") {
  const isCsv = filename.toLowerCase().endsWith(".csv") || (!content.trim().startsWith("{") && !content.trim().startsWith("["));
  if (isCsv) {
    return parseHealthConnectExportCsv(content, userId);
  }
  return parseHealthConnectExportJson(content, userId);
}

/**
 * Executes synchronization of activity data to Firestore and local storage.
 */
export async function syncHealthConnectRecordsToFirestore(userId, records) {
  if (!userId || records.length === 0) return { count: 0 };

  const saved = await batchUpsertActivityLogs(userId, records);

  const detectedSource = records.find(r => r.metadata?.sourcePackage)?.metadata?.sourcePackage || "Google Health Connect";

  await saveWearableConnection(userId, {
    deviceModel: "Smartwatch",
    companionApp: detectedSource,
    isConnected: true,
    lastSyncedTimestamp: new Date().toISOString()
  });

  return { count: saved.length, records: saved };
}
