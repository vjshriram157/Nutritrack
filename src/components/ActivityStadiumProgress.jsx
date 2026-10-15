import React from "react";
import { Footprints } from "lucide-react";

/**
 * CMF Watch "Today's activities" Multi-Track Stadium Loop Progress
 * Matches Screenshot 3 with high fidelity:
 * - Rounded stadium loop bars (outer red, middle white/cyan, inner grey)
 * - Legend rows for Calories (kcal), Exercise (min), Distance/Stand
 * - Steps row with walker icon and current / goal steps
 */
export default function ActivityStadiumProgress({
  calories = { current: 520, target: 800, unit: "kcal" },
  exercise = { current: 48, target: 30, unit: "min" },
  secondary = { label: "Distance (km)", current: 4.5, target: 6.0 },
  steps = { current: 5911, target: 9000 }
}) {
  // Clamped percentages (0 to 100+)
  const cPerc = Math.min(100, Math.round(((calories.current || 0) / Math.max(1, calories.target || 800)) * 100));
  const ePerc = Math.min(100, Math.round(((exercise.current || 0) / Math.max(1, exercise.target || 30)) * 100));
  const sPerc = Math.min(100, Math.round(((secondary.current || 0) / Math.max(1, secondary.target || 6)) * 100));
  const stepsPerc = Math.min(100, Math.round(((steps.current || 0) / Math.max(1, steps.target || 9000)) * 100));

  // Stadium path stroke-dash calculations (perimeter approx 2 * (w - 2r) + 2 * PI * r)
  // Outer pill: w = 280, h = 90, r = 45 -> straight = 190*2 = 380, curve = 2*PI*45 = 282.7 -> total ~ 663
  const pOuter = 660;
  const pMid = 560;
  const pInner = 460;

  const offsetOuter = pOuter - (cPerc / 100) * pOuter;
  const offsetMid = pMid - (ePerc / 100) * pMid;
  const offsetInner = pInner - (sPerc / 100) * pInner;

  return (
    <div className="cmf-stadium-card">
      <div className="cmf-stadium-svg-wrap">
        <svg viewBox="0 0 320 110" className="cmf-stadium-svg">
          {/* Outer Stadium Track (Calories - Red) */}
          <rect
            x="20"
            y="10"
            width="280"
            height="90"
            rx="45"
            fill="none"
            stroke="#27272a"
            strokeWidth="11"
          />
          <rect
            x="20"
            y="10"
            width="280"
            height="90"
            rx="45"
            fill="none"
            stroke="#ff3b30"
            strokeWidth="11"
            strokeDasharray={pOuter}
            strokeDashoffset={offsetOuter}
            strokeLinecap="round"
          />

          {/* Middle Stadium Track (Exercise - White) */}
          <rect
            x="36"
            y="23"
            width="248"
            height="64"
            rx="32"
            fill="none"
            stroke="#27272a"
            strokeWidth="10"
          />
          <rect
            x="36"
            y="23"
            width="248"
            height="64"
            rx="32"
            fill="none"
            stroke="#ffffff"
            strokeWidth="10"
            strokeDasharray={pMid}
            strokeDashoffset={offsetMid}
            strokeLinecap="round"
          />

          {/* Inner Stadium Track (Distance / Stand - Grey) */}
          <rect
            x="51"
            y="35"
            width="218"
            height="40"
            rx="20"
            fill="none"
            stroke="#27272a"
            strokeWidth="9"
          />
          <rect
            x="51"
            y="35"
            width="218"
            height="40"
            rx="20"
            fill="none"
            stroke="#a1a1aa"
            strokeWidth="9"
            strokeDasharray={pInner}
            strokeDashoffset={offsetInner}
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* Metric breakdown rows matching Screenshot 3 */}
      <div className="cmf-stadium-metrics-list">
        <div className="cmf-metric-row">
          <div className="cmf-metric-left">
            <span className="cmf-dot cmf-dot-red" />
            <span className="cmf-metric-title">Calories (kcal)</span>
          </div>
          <div className="cmf-metric-value">
            <strong>{calories.current !== null ? Math.round(calories.current).toLocaleString() : "Unavailable"}</strong>
            <span className="cmf-metric-target">/{calories.target?.toLocaleString() || 800}</span>
          </div>
        </div>

        <div className="cmf-metric-row">
          <div className="cmf-metric-left">
            <span className="cmf-dot cmf-dot-white" />
            <span className="cmf-metric-title">Exercise (min)</span>
          </div>
          <div className="cmf-metric-value">
            <strong>{exercise.current !== null ? Math.round(exercise.current).toLocaleString() : "Unavailable"}</strong>
            <span className="cmf-metric-target">/{exercise.target?.toLocaleString() || 30}</span>
          </div>
        </div>

        <div className="cmf-metric-row">
          <div className="cmf-metric-left">
            <span className="cmf-dot cmf-dot-grey" />
            <span className="cmf-metric-title">{secondary.label || "Distance (km)"}</span>
          </div>
          <div className="cmf-metric-value">
            <strong>{secondary.current !== null ? secondary.current : "Unavailable"}</strong>
            <span className="cmf-metric-target">/{secondary.target}</span>
          </div>
        </div>

        {/* Dotted separator before Steps */}
        <div className="cmf-metric-separator" />

        <div className="cmf-metric-row cmf-steps-row">
          <div className="cmf-metric-left">
            <Footprints size={16} className="cmf-steps-icon" />
            <span className="cmf-metric-title">Steps</span>
          </div>
          <div className="cmf-metric-value">
            <strong className="cmf-steps-number">
              {steps.current !== null ? Math.round(steps.current).toLocaleString() : "Unavailable"}
            </strong>
            <span className="cmf-metric-target">/{steps.target?.toLocaleString() || 9000}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
