import React from "react";

export default function StatCard({
  icon: Icon,
  iconTheme = "emerald",
  label,
  value,
  unit = "kcal",
  subtitle,
  progress = null
}) {
  return (
    <div className="glass-card stat-card">
      <div className={`card-icon-wrap icon-${iconTheme}`}>
        {Icon && <Icon size={22} />}
      </div>
      <div className="stat-card-details">
        <span className="summary-label">{label}</span>
        <div className="summary-value-row">
          <span className="summary-number">{value}</span>
          {unit && <span className="summary-unit">{unit}</span>}
        </div>
        {subtitle && <span className="summary-footer">{subtitle}</span>}
        {progress !== null && (
          <div className="summary-bar-bg">
            <div
              className={`summary-bar-fill fill-${iconTheme}`}
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            ></div>
          </div>
        )}
      </div>
    </div>
  );
}
