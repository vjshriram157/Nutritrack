import React from "react";

export default function MacroBar({
  protein = 0,
  carbs = 0,
  fat = 0,
  fibre = 0,
  proteinTarget = 150,
  carbsTarget = 200,
  fatTarget = 65,
  fibreTarget = 30
}) {
  const macros = [
    {
      name: "Protein",
      current: protein,
      target: proteinTarget,
      color: "var(--accent-coral)",
      unit: "g",
      calorieFactor: 4
    },
    {
      name: "Carbohydrates",
      current: carbs,
      target: carbsTarget,
      color: "var(--accent-cyan)",
      unit: "g",
      calorieFactor: 4
    },
    {
      name: "Fats",
      current: fat,
      target: fatTarget,
      color: "var(--accent-amber)",
      unit: "g",
      calorieFactor: 9
    },
    {
      name: "Fibre",
      current: fibre,
      target: fibreTarget,
      color: "var(--accent-emerald)",
      unit: "g",
      calorieFactor: 2
    }
  ];

  return (
    <div className="macro-bar-component">
      <div className="macro-grid">
        {macros.map((m) => {
          const percent = m.target > 0 ? Math.round((m.current / m.target) * 100) : 0;
          return (
            <div key={m.name} className="macro-item-box">
              <div className="macro-item-header">
                <span className="macro-title">{m.name}</span>
                <span className="macro-ratio">
                  <strong>{Math.round(m.current)}</strong> / {m.target} {m.unit}
                </span>
              </div>
              <div
                className="macro-progress-track"
                role="progressbar"
                aria-valuenow={Math.min(100, percent)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${m.name} intake: ${Math.round(m.current)} of ${m.target} ${m.unit} (${percent}%)`}
              >
                <div
                  className="macro-progress-fill"
                  style={{
                    width: `${Math.min(100, percent)}%`,
                    backgroundColor: m.color
                  }}
                />
              </div>
              <div className="macro-sub-percentage">
                <span className="macro-pct-val">{percent}%</span> of target
                {percent > 100 && <span className="macro-pct-over"> (+{percent - 100}%)</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
