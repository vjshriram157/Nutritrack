import React, { useState } from "react";
import { ArrowRightLeft, Sparkles, ChevronRight, Check } from "lucide-react";

/**
 * Energy & Macronutrient Summary Card matching Screenshot 1:
 * - Top Card: Calories consumed, remaining, [GOAL] pill, circular Goal % gauge
 * - 2x2 Macro Cards Grid:
 *   1. Protein (Purple, thick bar, remaining)
 *   2. Carbs (Amber, thick bar, remaining)
 *   3. Fat (Blue, thick bar, remaining)
 *   4. Fiber (Teal/Emerald, thick bar, remaining)
 */
export default function EnergySummaryRings({
  consumed = 0,
  expenditure = 2000,
  target = 2000,
  activeBurn = 0,
  macros = { protein: 0, carbs: 0, fat: 0, fiber: 0 },
  macroTargets = { protein: 120, carbs: 220, fat: 60, fiber: 25 },
  onOpenTargetModal
}) {
  const safeTarget = Math.max(1, target || 2000);
  const remainingCals = Math.max(0, safeTarget - consumed);
  const goalPercent = Math.min(100, Math.round((consumed / safeTarget) * 100));

  // Circular gauge parameters
  const ringSize = 130;
  const strokeWidth = 14;
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (goalPercent / 100) * circumference;

  // Macro remaining calculations
  const pRemaining = Math.max(0, (macroTargets.protein || 120) - (macros.protein || 0));
  const cRemaining = Math.max(0, (macroTargets.carbs || 220) - (macros.carbs || 0));
  const fRemaining = Math.max(0, (macroTargets.fat || 60) - (macros.fat || 0));
  const fibTarget = macroTargets.fiber || 25;
  const fibRemaining = Math.max(0, fibTarget - (macros.fiber || 18));

  // Percentage for progress bars
  const pPercent = Math.min(100, Math.round(((macros.protein || 0) / (macroTargets.protein || 120)) * 100));
  const cPercent = Math.min(100, Math.round(((macros.carbs || 0) / (macroTargets.carbs || 220)) * 100));
  const fPercent = Math.min(100, Math.round(((macros.fat || 0) / (macroTargets.fat || 60)) * 100));
  const fibPercent = Math.min(100, Math.round(((macros.fiber || 18) / fibTarget) * 100));

  return (
    <div className="energy-macro-dashboard-container">
      {/* 1. Main Calories Card */}
      <div className="ref-calories-hero-card">
        <div className="ref-cals-left">
          <span className="ref-cals-label">Calories</span>
          <div className="ref-cals-number">{Math.round(consumed).toLocaleString()}</div>
          <div className="ref-cals-remaining">
            {Math.round(remainingCals).toLocaleString()} remaining
          </div>
          <button
            type="button"
            className="ref-cals-goal-pill"
            onClick={onOpenTargetModal}
            title="Adjust Daily Calorie Goal"
          >
            <span>{Math.round(safeTarget).toLocaleString()} GOAL</span>
          </button>
        </div>

        <div className="ref-cals-right">
          <div className="ref-cals-gauge-wrap">
            <svg width={ringSize} height={ringSize} className="ref-cals-gauge-svg">
              {/* Background Track */}
              <circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={radius}
                className="ref-gauge-bg"
                strokeWidth={strokeWidth}
              />
              {/* Progress Track */}
              <circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={radius}
                className="ref-gauge-fill"
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                transform={`rotate(-90 ${ringSize / 2} ${ringSize / 2})`}
              />
            </svg>
            <div className="ref-gauge-center">
              <span className="ref-gauge-label">Goal</span>
              <span className="ref-gauge-percent">{goalPercent}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. 2x2 Grid of Macro Cards (Protein, Carbs, Fat, Fiber) */}
      <div className="ref-macro-grid-2x2">
        {/* Protein */}
        <div className="ref-macro-card macro-protein-card">
          <div className="ref-macro-header">
            <span className="ref-macro-name">Protein</span>
            <span className="ref-macro-value text-purple">{Math.round(macros.protein || 0)}g</span>
          </div>
          <div className="ref-macro-bar-track bg-purple-light">
            <div
              className="ref-macro-bar-fill fill-purple"
              style={{ width: `${pPercent}%` }}
            />
          </div>
          <div className="ref-macro-remaining">{Math.round(pRemaining)}g remaining</div>
        </div>

        {/* Carbs */}
        <div className="ref-macro-card macro-carbs-card">
          <div className="ref-macro-header">
            <span className="ref-macro-name">Carbs</span>
            <span className="ref-macro-value text-amber">{Math.round(macros.carbs || 0)}g</span>
          </div>
          <div className="ref-macro-bar-track bg-amber-light">
            <div
              className="ref-macro-bar-fill fill-amber"
              style={{ width: `${cPercent}%` }}
            />
          </div>
          <div className="ref-macro-remaining">{Math.round(cRemaining)}g remaining</div>
        </div>

        {/* Fat */}
        <div className="ref-macro-card macro-fat-card">
          <div className="ref-macro-header">
            <span className="ref-macro-name">Fat</span>
            <span className="ref-macro-value text-blue">{Math.round(macros.fat || 0)}g</span>
          </div>
          <div className="ref-macro-bar-track bg-blue-light">
            <div
              className="ref-macro-bar-fill fill-blue"
              style={{ width: `${fPercent}%` }}
            />
          </div>
          <div className="ref-macro-remaining">{Math.round(fRemaining)}g remaining</div>
        </div>

        {/* Fiber */}
        <div className="ref-macro-card macro-fiber-card">
          <div className="ref-macro-header">
            <span className="ref-macro-name">Fiber</span>
            <span className="ref-macro-value text-emerald">{Math.round(macros.fiber || 18)}g</span>
          </div>
          <div className="ref-macro-bar-track bg-emerald-light">
            <div
              className="ref-macro-bar-fill fill-emerald"
              style={{ width: `${fibPercent}%` }}
            />
          </div>
          <div className="ref-macro-remaining">{Math.round(fibRemaining)}g remaining</div>
        </div>
      </div>
    </div>
  );
}
