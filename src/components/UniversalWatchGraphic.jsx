import React from "react";

/**
 * Universal Smartwatch Graphic
 * Dynamic, smartwatch-agnostic hardware illustration.
 * Supports:
 * - "nothing": CMF / Nothing Watch (minimalist dark chassis with orange rotary accent)
 * - "samsung": Samsung Galaxy Watch (circular bezel with dual flat buttons & Galaxy cyan rings)
 * - "pixel": Google Pixel Watch / Fitbit (3D domed pebble glass & continuous curvature)
 * - "garmin": Garmin Smartwatch (rugged tactical bezel with screw rivets & sports telemetry)
 * - "generic": Universal Health Connect smartwatch (neutral sleek dark circular hardware)
 *
 * Never assumes CMF Watch 3 Pro for every user.
 * Displays dynamic local clock time and actual activity progress.
 * Never displays fabricated battery levels.
 */
export default function UniversalWatchGraphic({
  watchType = "generic",
  isConnected = true,
  stepProgress = 0,
  statusText = ""
}) {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");

  const normalizedProgress = Math.min(Math.max(stepProgress || 0, 0), 1);
  const ringCircumference = 2 * Math.PI * 34;
  const strokeDashoffset = ringCircumference * (1 - normalizedProgress);

  return (
    <div className="universal-watch-visual-container" style={{ textAlign: "center", margin: "16px auto 10px" }}>
      <svg
        width="170"
        height="220"
        viewBox="0 0 170 220"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ filter: "drop-shadow(0 14px 28px rgba(0, 0, 0, 0.65))" }}
        role="img"
        aria-label={`${watchType} smartwatch hardware illustration`}
      >
        <defs>
          {/* Universal Dark Strap */}
          <linearGradient id="darkStrapGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#27272a" />
            <stop offset="40%" stopColor="#3f3f46" />
            <stop offset="70%" stopColor="#27272a" />
            <stop offset="100%" stopColor="#18181b" />
          </linearGradient>

          {/* CMF Nothing Signature Dark Matte Strap with subtle red under-bevel */}
          <linearGradient id="cmfDarkStrapGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#1c1c1e" />
            <stop offset="50%" stopColor="#2c2c2e" />
            <stop offset="100%" stopColor="#121214" />
          </linearGradient>

          {/* Casing Metallic Gradient */}
          <linearGradient id="casingGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#3a3a3c" />
            <stop offset="50%" stopColor="#242426" />
            <stop offset="100%" stopColor="#121214" />
          </linearGradient>

          {/* Domed Glass Highlight for Pixel Pebble */}
          <radialGradient id="pixelDomeGrad" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.18)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.03)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.85)" />
          </radialGradient>

          {/* Galaxy Cyan Ring Gradient */}
          <linearGradient id="galaxyRingGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>
        </defs>

        {/* -------------------- 1. TOP & BOTTOM STRAPS -------------------- */}
        {watchType === "nothing" ? (
          // CMF / Nothing: Structured strap with clean channel groves
          <>
            <path d="M58 8 C58 4, 62 2, 68 2 L102 2 C108 2, 112 4, 112 8 L114 55 L56 55 Z" fill="url(#cmfDarkStrapGrad)" />
            <line x1="66" y1="14" x2="104" y2="14" stroke="#e53935" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="64" y1="26" x2="106" y2="26" stroke="#27272a" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="62" y1="38" x2="108" y2="38" stroke="#27272a" strokeWidth="1.5" strokeLinecap="round" />

            <path d="M56 165 L114 165 L112 212 C112 216, 108 218, 102 218 L68 218 C62 218, 58 216, 58 212 Z" fill="url(#cmfDarkStrapGrad)" />
            <line x1="62" y1="182" x2="108" y2="182" stroke="#27272a" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="64" y1="194" x2="106" y2="194" stroke="#27272a" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="66" y1="206" x2="104" y2="206" stroke="#e53935" strokeWidth="1.5" strokeLinecap="round" />
          </>
        ) : watchType === "garmin" ? (
          // Garmin: Tactical rugged textured strap
          <>
            <path d="M56 10 C56 5, 60 2, 66 2 L104 2 C110 2, 114 5, 114 10 L115 54 L55 54 Z" fill="url(#darkStrapGrad)" stroke="#18181b" strokeWidth="1" />
            <rect x="68" y="10" width="34" height="6" rx="1.5" fill="#18181b" />
            <rect x="66" y="22" width="38" height="6" rx="1.5" fill="#18181b" />
            <rect x="64" y="34" width="42" height="6" rx="1.5" fill="#18181b" />

            <path d="M55 166 L115 166 L114 210 C114 215, 110 218, 104 218 L66 218 C60 218, 56 215, 56 210 Z" fill="url(#darkStrapGrad)" stroke="#18181b" strokeWidth="1" />
            <rect x="64" y="180" width="42" height="6" rx="1.5" fill="#18181b" />
            <rect x="66" y="192" width="38" height="6" rx="1.5" fill="#18181b" />
            <rect x="68" y="204" width="34" height="6" rx="1.5" fill="#18181b" />
          </>
        ) : (
          // Galaxy Watch, Pixel Watch & Generic: Sleek contoured silicone strap
          <>
            <path d="M60 10 C60 5, 64 2, 70 2 L100 2 C106 2, 110 5, 110 10 L112 55 L58 55 Z" fill="url(#darkStrapGrad)" />
            <path d="M58 165 L112 165 L110 210 C110 215, 106 218, 100 218 L70 218 C64 218, 60 215, 60 210 Z" fill="url(#darkStrapGrad)" />
          </>
        )}

        {/* -------------------- 2. HARDWARE CHASSIS & BEZEL -------------------- */}
        {/* Outer Shadow Base */}
        <circle cx="85" cy="110" r="56" fill="#09090b" />
        <circle cx="85" cy="110" r="54" fill="url(#casingGrad)" stroke="#3f3f46" strokeWidth="1" />

        {/* Brand Specific Hardware Details */}
        {watchType === "nothing" && (
          // CMF Rotary Crown with orange accent
          <>
            <rect x="137" y="94" width="7" height="15" rx="2" fill="#71717a" stroke="#27272a" strokeWidth="0.8" />
            <rect x="139" y="97" width="2" height="9" rx="1" fill="#ea580c" />
          </>
        )}

        {watchType === "samsung" && (
          // Samsung Galaxy Watch dual low-profile buttons at 2 and 4 o'clock
          <>
            <rect x="137" y="86" width="6" height="14" rx="2" fill="#52525b" stroke="#27272a" strokeWidth="0.8" />
            <rect x="137" y="120" width="6" height="14" rx="2" fill="#52525b" stroke="#27272a" strokeWidth="0.8" />
            {/* Bezel subtle tachymeter dots */}
            <circle cx="85" cy="60" r="1.5" fill="#71717a" />
            <circle cx="85" cy="160" r="1.5" fill="#71717a" />
            <circle cx="35" cy="110" r="1.5" fill="#71717a" />
            <circle cx="135" cy="110" r="1.5" fill="#71717a" />
          </>
        )}

        {watchType === "pixel" && (
          // Pixel Watch domed pebble crown
          <>
            <circle cx="139" cy="110" r="4" fill="#52525b" stroke="#27272a" strokeWidth="0.8" />
          </>
        )}

        {watchType === "garmin" && (
          // Garmin 5 tactical bezel screw rivets
          <>
            <rect x="26" y="92" width="6" height="12" rx="2" fill="#52525b" />
            <rect x="26" y="116" width="6" height="12" rx="2" fill="#52525b" />
            <rect x="138" y="86" width="6" height="14" rx="2" fill="#ea580c" />
            <rect x="138" y="120" width="6" height="14" rx="2" fill="#52525b" />
            <circle cx="85" cy="62" r="2" fill="#71717a" stroke="#27272a" strokeWidth="0.5" />
            <circle cx="123" cy="85" r="2" fill="#71717a" stroke="#27272a" strokeWidth="0.5" />
            <circle cx="123" cy="135" r="2" fill="#71717a" stroke="#27272a" strokeWidth="0.5" />
            <circle cx="47" cy="135" r="2" fill="#71717a" stroke="#27272a" strokeWidth="0.5" />
            <circle cx="47" cy="85" r="2" fill="#71717a" stroke="#27272a" strokeWidth="0.5" />
          </>
        )}

        {watchType === "generic" && (
          // Neutral minimal single button
          <>
            <rect x="137" y="103" width="6" height="14" rx="2" fill="#52525b" stroke="#27272a" strokeWidth="0.8" />
          </>
        )}

        {/* Inner Bezel Ring */}
        <circle cx="85" cy="110" r="48" fill="#121214" stroke="#27272a" strokeWidth="1.5" />

        {/* OLED Screen */}
        <circle cx="85" cy="110" r="44" fill="#000000" />

        {/* -------------------- 3. WATCH FACE DISPLAY -------------------- */}
        {watchType === "nothing" ? (
          // CMF / Nothing Face: Bold Stylized Digits
          <g opacity={isConnected ? "1" : "0.75"}>
            <text
              x="62"
              y="104"
              fontFamily="-apple-system, system-ui, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
              fontSize="24"
              fontWeight="900"
              fill="#e53935"
              textAnchor="middle"
              letterSpacing="-1"
            >
              {hours}
            </text>
            <text
              x="62"
              y="128"
              fontFamily="-apple-system, system-ui, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
              fontSize="24"
              fontWeight="900"
              fill="#e4e4e7"
              textAnchor="middle"
              letterSpacing="-1"
            >
              {minutes}
            </text>
            {/* Step arc indicator */}
            <circle cx="106" cy="110" r="14" fill="none" stroke="#27272a" strokeWidth="3" />
            <circle
              cx="106"
              cy="110"
              r="14"
              fill="none"
              stroke="#e53935"
              strokeWidth="3"
              strokeDasharray={2 * Math.PI * 14}
              strokeDashoffset={2 * Math.PI * 14 * (1 - normalizedProgress)}
              strokeLinecap="round"
              transform="rotate(-90 106 110)"
            />
            <circle cx="106" cy="110" r="3" fill="#ea580c" />
          </g>
        ) : watchType === "samsung" ? (
          // Samsung Galaxy Watch Face: Modern Circular Dial with Dual Rings
          <g opacity={isConnected ? "1" : "0.75"}>
            <circle cx="85" cy="110" r="34" fill="none" stroke="#1f2937" strokeWidth="3.5" />
            <circle
              cx="85"
              cy="110"
              r="34"
              fill="none"
              stroke="url(#galaxyRingGrad)"
              strokeWidth="3.5"
              strokeDasharray={ringCircumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              transform="rotate(-90 85 110)"
            />
            <text
              x="85"
              y="107"
              fontFamily="-apple-system, system-ui, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
              fontSize="20"
              fontWeight="800"
              fill="#f4f4f5"
              textAnchor="middle"
            >
              {hours}:{minutes}
            </text>
            <text
              x="85"
              y="124"
              fontFamily="-apple-system, system-ui, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
              fontSize="9"
              fontWeight="600"
              fill="#06b6d4"
              textAnchor="middle"
              letterSpacing="0.5"
            >
              GALAXY
            </text>
          </g>
        ) : watchType === "pixel" ? (
          // Pixel Watch / Fitbit: Smooth pebble typography with subtle gradient
          <g opacity={isConnected ? "1" : "0.75"}>
            <circle cx="85" cy="110" r="32" fill="none" stroke="#27272a" strokeWidth="3" />
            <circle
              cx="85"
              cy="110"
              r="32"
              fill="none"
              stroke="#a78bfa"
              strokeWidth="3"
              strokeDasharray={2 * Math.PI * 32}
              strokeDashoffset={2 * Math.PI * 32 * (1 - normalizedProgress)}
              strokeLinecap="round"
              transform="rotate(-90 85 110)"
            />
            <text
              x="85"
              y="113"
              fontFamily="-apple-system, system-ui, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
              fontSize="22"
              fontWeight="700"
              fill="#f4f4f5"
              textAnchor="middle"
            >
              {hours}:{minutes}
            </text>
            {/* Domed glass reflection overlay */}
            <circle cx="85" cy="110" r="44" fill="url(#pixelDomeGrad)" pointerEvents="none" />
          </g>
        ) : watchType === "garmin" ? (
          // Garmin Face: High-contrast athletic display
          <g opacity={isConnected ? "1" : "0.75"}>
            <rect x="58" y="88" width="54" height="22" rx="4" fill="#18181b" stroke="#3f3f46" strokeWidth="0.8" />
            <text
              x="85"
              y="105"
              fontFamily="monospace, -apple-system, sans-serif"
              fontSize="16"
              fontWeight="900"
              fill="#34d399"
              textAnchor="middle"
              letterSpacing="1"
            >
              {hours}:{minutes}
            </text>
            <circle cx="85" cy="110" r="36" fill="none" stroke="#27272a" strokeWidth="2.5" strokeDasharray="3 3" />
            <circle
              cx="85"
              cy="110"
              r="36"
              fill="none"
              stroke="#34d399"
              strokeWidth="2.5"
              strokeDasharray={2 * Math.PI * 36}
              strokeDashoffset={2 * Math.PI * 36 * (1 - normalizedProgress)}
              strokeLinecap="round"
              transform="rotate(-90 85 110)"
            />
            <text
              x="85"
              y="128"
              fontFamily="-apple-system, sans-serif"
              fontSize="9"
              fontWeight="700"
              fill="#a1a1aa"
              textAnchor="middle"
            >
              GARMIN
            </text>
          </g>
        ) : (
          // Universal Generic Smartwatch: Clean modern activity rings & digital clock
          <g opacity={isConnected ? "1" : "0.75"}>
            <circle cx="85" cy="110" r="33" fill="none" stroke="#27272a" strokeWidth="3" />
            <circle
              cx="85"
              cy="110"
              r="33"
              fill="none"
              stroke="#06b6d4"
              strokeWidth="3"
              strokeDasharray={2 * Math.PI * 33}
              strokeDashoffset={2 * Math.PI * 33 * (1 - normalizedProgress)}
              strokeLinecap="round"
              transform="rotate(-90 85 110)"
            />
            <text
              x="85"
              y="108"
              fontFamily="-apple-system, system-ui, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
              fontSize="21"
              fontWeight="800"
              fill="#f4f4f5"
              textAnchor="middle"
              letterSpacing="-0.5"
            >
              {hours}:{minutes}
            </text>
            <text
              x="85"
              y="125"
              fontFamily="-apple-system, system-ui, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
              fontSize="9"
              fontWeight="600"
              fill="#71717a"
              textAnchor="middle"
              letterSpacing="0.8"
            >
              HEALTH
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
