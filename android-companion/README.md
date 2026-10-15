# CMF Watch 3 Pro & Android Health Connect Integration Architecture ⌚📱

This directory contains the native Android companion layer and integration architecture for syncing **CMF Watch 3 Pro** fitness metrics into **NutriTrack** via **Android Health Connect**.

---

## 1. Data Pipeline Overview

```
[ CMF Watch 3 Pro (Wrist Sensors) ]
            │ Bluetooth Low Energy (BLE)
            ▼
[ Nothing X / CMF Watch App on Android Phone ]
            │ Periodic Background Data Push
            ▼
[ Android Health Connect API (androidx.health.connect) ]
            │ Read Permission Requested (Steps, Active Calories, Distance, Exercise)
            ▼
[ NutriTrack Companion Worker / Capacitor Plugin ]
            │ Stable ID Normalization (${userId}_${date}_${metricType}_cmf_watch)
            ▼
[ Google Firebase Cloud Firestore (`activityLogs` Collection) ]
            │ Real-time Firestore Sync / Reactive State
            ▼
[ NutriTrack React Web Application ]
```

---

## 2. Investigation: What Metrics Does Nothing X / CMF Watch Actually Sync?

Based on verified Android Health Connect compatibility:
1. **Steps (`StepsRecord`)**: Fully supported. Incremental and cumulative daily steps are pushed reliably.
2. **Active Calories (`ActiveCaloriesBurnedRecord`)**: Supported on latest firmware/app versions. *Represents physical energy expended above basal rate (excluding BMR)*.
3. **Distance (`DistanceRecord`)**: Supported (meters calculated from pedometer/GPS).
4. **Workout Sessions (`ExerciseSessionRecord`)**: Tracked outdoor runs, cycling, and gym workouts are pushed when manually initiated from the watch.
5. **Basal Calories**: CMF Watch does not consistently export separate BMR curves; hence NutriTrack uses its clinical Mifflin-St Jeor engine for BMR calculations rather than wearable approximations.

---

## 3. Why a Web App Cannot Directly Call Health Connect

Android Health Connect is an on-device Jetpack system API requiring:
- Specific Android runtime permissions declared in `AndroidManifest.xml` (`android.permission.health.READ_STEPS`).
- An Android Activity with an intent-filter handling `androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE`.
- Direct IPC communication with the `com.google.android.apps.healthdata` package.

Standard mobile browsers (Chrome, Edge, Firefox) do **not** expose a Web Bluetooth / Web Health API for Health Connect. Therefore, this architecture uses:
1. **Option A (Native Companion Worker / Capacitor)**: Background worker on Android reads Health Connect and writes directly to Cloud Firestore.
2. **Option B (Direct In-App Export Importer)**: In the browser app, users can import a Health Connect export file (JSON/CSV) exported directly from Android settings.
3. **Option C (Manual Entry Fallback)**: Enter verified watch readings directly with source attribution.

---

## 4. Deduplication & Idempotent Record Keys

To prevent duplicate logs or cumulative calculation errors when syncing multiple times throughout the day, NutriTrack uses deterministic document IDs:

$$\text{Document ID} = \text{userId}\_\text{date}\_\text{metricType}\_\text{source}$$

Example: `user123_2026-10-13_steps_cmf_watch_health_connect`

Using Firestore's `SetOptions.merge()`, subsequent syncs update existing documents with the latest values instead of inserting duplicate rows.

---

## 5. Avoiding Calorie Double-Counting (Energy-Accounting Models)

Adding wearable active calories directly to a standard TDEE allowance causes **double-counting**, because TDEE already incorporates an activity multiplier (e.g. 1.375 or 1.55).

NutriTrack solves this with 3 distinct energy-accounting modes:
- **Strict TDEE (Recommended)**: Base dietary budget is fixed to scientific TDEE. Wearable active burn is tracked side-by-side as observed energy expenditure without artificially inflating food calories.
- **Dynamic Net (BMR + Active Burn)**: Calorie allowance starts at basal BMR and only verified CMF Watch active calories are dynamically added.
- **Exercise Exclusivity**: Only standalone high-intensity workouts add a conservative 50% replacement back into the diet budget.
