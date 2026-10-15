import React from "react";

const RADIUS = 88;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS; // ~552.92

export default function CalorieRing({
  dailyTarget = 2000,
  caloriesConsumed = 0,
  caloriesBurned = 0
}) {
  const netCalories = caloriesConsumed - caloriesBurned;
  const remaining = dailyTarget - netCalories;
  const percentage = dailyTarget > 0 ? (caloriesConsumed / dailyTarget) * 100 : 0;
  const clampedPercent = Math.min(100, Math.max(0, percentage));
  const offset = CIRCUMFERENCE - (clampedPercent / 100) * CIRCUMFERENCE;

  // Ring color depending on consumption vs target
  let strokeColor = "var(--accent-emerald)";
  let statusText = "On Track";
  let statusClass = "status-ontrack";

  if (caloriesConsumed > dailyTarget) {
    strokeColor = "var(--accent-coral)";
    statusText = "Calorie Surplus";
    statusClass = "status-surplus";
  } else if (remaining < dailyTarget * 0.15) {
    strokeColor = "var(--accent-amber)";
    statusText = "Near Limit";
    statusClass = "status-near";
  }

  return (
    <div className="calorie-ring-component">
      <div className="ring-header-row">
        <div>
          <h3 className="card-title">Energy Balance</h3>
          <p className="card-subtitle">Daily Calorie Budget</p>
        </div>
        <span className={`status-chip ${statusClass}`}>{statusText}</span>
      </div>

      <div className="svg-ring-container">
        <svg className="progress-ring" viewBox="0 0 220 220">
          <circle className="ring-bg" cx="110" cy="110" r={RADIUS} />
          <circle
            className="ring-fill"
            cx="110"
            cy="110"
            r={RADIUS}
            style={{
              stroke: strokeColor,
              strokeDashoffset: offset
            }}
          />
        </svg>

        <div className="ring-inner-stat">
          <span className="ring-subtext">REMAINING</span>
          <span className="ring-main-value">{Math.max(0, remaining).toLocaleString()}</span>
          <span className="ring-unit">kcal</span>
          <div className="ring-percentage-badge">
            <span>{Math.round(percentage)}%</span> of {dailyTarget.toLocaleString()} kcal goal
          </div>
        </div>
      </div>

      <div className="ring-legend-bar">
        <div className="legend-item">
          <span className="legend-color-dot consumed-dot"></span>
          <div className="legend-text">
            <span className="legend-label">Consumed</span>
            <span className="legend-val">{caloriesConsumed.toLocaleString()} kcal</span>
          </div>
        </div>
        <div className="legend-divider"></div>
        <div className="legend-item">
          <span className="legend-color-dot burned-dot"></span>
          <div className="legend-text">
            <span className="legend-label">Burned</span>
            <span className="legend-val">{caloriesBurned.toLocaleString()} kcal</span>
          </div>
        </div>
        <div className="legend-divider"></div>
        <div className="legend-item">
          <span className="legend-color-dot target-dot"></span>
          <div className="legend-text">
            <span className="legend-label">Net</span>
            <span className="legend-val">{netCalories.toLocaleString()} kcal</span>
          </div>
        </div>
      </div>
    </div>
  );
}
