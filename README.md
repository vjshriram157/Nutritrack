# NutriTrack 🥗⚡

> **Zero-cost, open-source nutrition and fitness tracker with Universal Smartwatch integration via Google Health Connect.**

NutriTrack is a local-first, privacy-respecting health platform engineered with **React 19**, **Vite**, **Vanilla CSS Design System**, **Capacitor**, and **Android Health Connect**. It accurately computes energy balance, tracks macronutrients, organizes meal plans and groceries, logs body metrics, and synchronizes real physical activity from compatible smartwatches at **zero financial cost** ($0.00 / ₹0.00).

---

## ⌚ Universal Smartwatch Support

NutriTrack uses **Google Health Connect** as the standard, open Android health-data bridge rather than tying users to any single vendor ecosystem.

### Universal Hub Architecture
```text
Smartwatch (CMF / Nothing / Samsung / Garmin / Fitbit / Pixel / Amazfit / etc.)
   │
   ▼  (Bluetooth Sync)
Manufacturer Companion App (Nothing X / Samsung Health / Garmin Connect / Zepp Life / etc.)
   │
   ▼  (Android Health Connect API)
Google Health Connect (On-device Android secure datastore)
   │
   ▼  (Capacitor Native Health Plugin: @interval-health/capacitor-health)
NutriTrack (On-device React Android App)
```

> **Important Watch Compatibility Note**:  
> NutriTrack does not communicate directly via proprietary Bluetooth protocols with watches. Compatibility depends on whether your smartwatch manufacturer's companion app supports writing activity records to **Google Health Connect**. If a companion app (e.g., Nothing X, Samsung Health, Garmin Connect, Health Sync) writes steps, calories, heart rate, sleep, or weight to Health Connect, NutriTrack can read and analyze them.

### Supported Record Types & Plugin Capabilities
Powered by `@interval-health/capacitor-health` and Android Health Connect API (`minSdkVersion 26`):

| Health Metric | Health Connect Permission | Plugin Native Status | Fallback / Display |
| :--- | :--- | :--- | :--- |
| **Steps** | `READ_STEPS` | ✅ Fully Supported | Live count or Unavailable |
| **Active Calories** | `READ_ACTIVE_CALORIES_BURNED` | ✅ Fully Supported | Live kcal or Unavailable |
| **Distance** | `READ_DISTANCE` | ✅ Fully Supported | Live km or Unavailable |
| **Workouts / Exercise** | `READ_EXERCISE` | ✅ Fully Supported | Sessions list with start/end |
| **Heart Rate** | `READ_HEART_RATE` | ✅ Fully Supported | BPM average or Unavailable |
| **Sleep** | `READ_SLEEP` | ✅ Fully Supported | Hours/mins sleep or Unavailable |
| **Weight** | `READ_WEIGHT` | ✅ Fully Supported | Auto-logs to weight records |
| *Mobility / Gait* | `READ_STEPS` (Placeholder in plugin) | ⚠️ Limitation: Plugin maps to steps | Documented; omitted from UI |

---

## 🔥 Data Accuracy & Energy Accounting Models

NutriTrack protects against "double-counting" exercise calories against your basal metabolic rate (BMR) and daily activity factor. You can select among three distinct energy accounting strategies in the **Smartwatch & Activity** dashboard:

1. **Dynamic Active Burn (Recommended)**:
   $$\text{Daily Burn} = \text{BMR} + \text{Wearable Active Calories} + \text{Manual Workouts}$$
   *Ideal for users whose smartwatch continuously tracks active expenditure, preventing physical activity from being double-counted against a static multiplier.*
2. **Strict Planned TDEE**:
   $$\text{Daily Burn} = \text{Baseline TDEE (BMR} \times \text{Activity Multiplier)}$$
   *Wearable active metrics are logged purely for informational and pacing purposes without inflating your caloric target.*
3. **Exercise Sessions Only**:
   $$\text{Daily Burn} = \text{Baseline TDEE} + \text{Logged Structured Workout Calories}$$
   *Only explicit high-intensity workouts add to your burn pool, ignoring passive non-exercise steps.*

### Deterministic Deduplication
Every wearable session and aggregated daily sample is assigned a deterministic, reproducible identifier:
$$\text{ID} = \text{hc\_}\{\text{packageName}\}\_\{\text{recordId} \lor \text{timestamp}\}$$
Synchronizing repeatedly never creates duplicate records or skews calorie accounting.

---

## 🔒 Privacy & Local-First Architecture

- **100% On-Device Processing**: NutriTrack functions out of the box with `LocalStorage` and `IndexedDB`. No cloud account, credit card, or subscription is ever required.
- **Zero Third-Party Ad Trackers / Paid SDKs**: No proprietary analytics SDKs or data brokers are bundled.
- **Selective Health Permissions**: Permissions are only requested for metrics actively read. The app explains why each permission is required before invoking Android's system permission sheet.
- **Optional Firebase Cloud Sync**: Firebase Cloud Firestore integration is completely optional (compatible with Google's free Spark tier). If unconfigured, the app runs entirely offline with full feature parity.

---

## 🛠️ Tech Stack & Dependencies

- **Web Core**: React 19, Vite 6, React Router DOM 7
- **Styling**: Pure Vanilla CSS design system with CSS custom properties (Tokens), glassmorphism, and responsive layout
- **Visualizations**: Recharts
- **Android Integration**: Capacitor 7 (`@capacitor/core`, `@capacitor/android`), `@interval-health/capacitor-health`
- **Native Android**: Android SDK (minSdk 26, targetSdk 35), Kotlin, AndroidX Health Connect Client (`androidx.health.connect:connect-client:1.1.0-alpha11`)

---

## 💻 Development & Web Build

### Prerequisites
- Node.js (v18 or higher)
- npm (v9 or higher)

### Setup & Run
```bash
# Clone the repository
git clone https://github.com/your-username/NutriTrack.git
cd NutriTrack

# Install dependencies
npm install

# Start development server on port 3000
npm run dev -- --port 3000

# Build production web bundle
npm run build
```

---

## 📱 Android Build & Debug APK Export

### Prerequisites
- Android Studio Ladybug / Meerkat or Android Command Line Tools
- Android SDK Platform 35 & Platform Tools
- Java Development Kit (JDK 21 or JDK 17)

### Step-by-Step Android Build Commands
```bash
# 1. Compile web assets
npm run build

# 2. Sync web assets and plugins to Android native project
npx cap sync android

# 3. Build the Debug APK using Gradle wrapper
# On Windows PowerShell:
$env:JAVA_HOME = "C:\Users\<user>\.jdks\jbr-21.0.11" # Adjust path to your JDK
cd android
.\gradlew.bat assembleDebug

# On macOS / Linux:
cd android
./gradlew assembleDebug
```

### APK Output Path
The compiled debug APK is located at:
```text
android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 🧪 Testing on a Physical Android Phone

1. **Install Android Health Connect**:
   - On **Android 14+**: Health Connect is built directly into Android Settings (`Settings > Security & Privacy > Health Connect`).
   - On **Android 9 to 13**: Install **Health Connect by Google** from the Google Play Store.
2. **Install NutriTrack APK**:
   ```bash
   adb install -r android/app/build/outputs/apk/debug/app-debug.apk
   ```
   Or transfer `app-debug.apk` directly to your phone via USB or Google Drive and tap to install.
3. **Connect Smartwatch to Health Connect**:
   - Open your watch companion app (e.g. *Nothing X*, *Samsung Health*, *Garmin Connect*, *Fitbit*).
   - Navigate to Settings / App Integrations / Connected Apps.
   - Enable data sync to **Google Health Connect** and grant permissions for Steps, Calories, Distance, Heart Rate, and Sleep.
4. **Grant Permissions in NutriTrack**:
   - Open NutriTrack on your phone.
   - Tap **"Smartwatch & Activity"** in the navigation bar.
   - Tap **"Sync Health Connect"**.
   - Review the on-device permission overview modal and tap **"Proceed to System Sheet"**.
   - Select **"Allow all"** or choose the individual record types in the Android Health Connect prompt.
5. **Verify Data**:
   - Real steps, active calories, distance, heart rate, and sleep will populate in the Activity dashboard and main energy balance card.

---

## ⚠️ Known Limitations

1. **Web Browser Fallback**: Health Connect is an Android OS-level API. When running NutriTrack in a desktop browser or iOS Safari, native Health Connect is unavailable. In browser mode, users can manually log workouts or use the **Import Health Connect JSON** feature.
2. **Companion App Latency**: Some companion apps only sync to Health Connect periodically (e.g., hourly or upon opening the app) to conserve battery. If recent watch data is missing, open your watch's companion app first to force a Bluetooth sync to Health Connect.
3. **Mobility Metrics**: The installed native plugin maps mobility to steps record; gait and cadence metrics are currently unsupported by the plugin and omitted from the interface.

---

## 📄 License

This project is open-source under the [MIT License](LICENSE).
