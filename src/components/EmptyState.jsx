import React from "react";

export default function EmptyState({ icon = "🍽️", title, description, action }) {
  return (
    <div className="empty-state-card">
      <span className="empty-icon-glyph">{icon}</span>
      <h4 className="empty-state-title">{title}</h4>
      {description && <p className="empty-state-desc">{description}</p>}
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  );
}
