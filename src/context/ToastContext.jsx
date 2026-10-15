import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";

const ToastContext = createContext({
  showToast: () => {},
  dismissToast: () => {},
  removeToast: () => {},
  clearToasts: () => {}
});

function getDefaultDuration(type) {
  switch (type) {
    case "error":
      return 7500;
    case "warning":
      return 4500;
    case "info":
      return 3500;
    case "burn":
      return 3500;
    case "success":
    default:
      return 3000;
  }
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());
  const lastCallRef = useRef({ title: "", message: "", type: "", time: 0 });

  // Clear a specific timer by toast ID
  const clearToastTimer = useCallback((id) => {
    if (timersRef.current.has(id)) {
      clearTimeout(timersRef.current.get(id));
      timersRef.current.delete(id);
    }
  }, []);

  // Remove a toast by ID
  const removeToast = useCallback((id) => {
    clearToastTimer(id);
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, [clearToastTimer]);

  // Dismiss current active toast (or specific ID)
  const dismissToast = useCallback((id) => {
    if (id) {
      removeToast(id);
    } else {
      setToasts((prev) => {
        if (prev.length === 0) return prev;
        const [first, ...rest] = prev;
        clearToastTimer(first.id);
        return rest;
      });
    }
  }, [removeToast, clearToastTimer]);

  // Clear all toasts and timers
  const clearToasts = useCallback(() => {
    timersRef.current.forEach((timerId) => clearTimeout(timerId));
    timersRef.current.clear();
    setToasts([]);
  }, []);

  // Show or update toast in-place
  const showToast = useCallback((title, message, rawType = "success", rawDuration, options = {}) => {
    let type = typeof rawType === "object" ? (rawType.type || "success") : rawType;
    let duration = typeof rawDuration === "object" ? rawDuration.duration : rawDuration;
    const opts = typeof rawType === "object" ? rawType : (typeof rawDuration === "object" ? rawDuration : options);

    if (!duration || typeof duration !== "number" || duration <= 0) {
      duration = getDefaultDuration(type);
    }

    const now = Date.now();
    // Debounce rapid duplicate calls (within 600ms)
    if (
      lastCallRef.current.title === title &&
      lastCallRef.current.message === message &&
      lastCallRef.current.type === type &&
      now - lastCallRef.current.time < 600
    ) {
      return;
    }
    lastCallRef.current = { title, message, type, time: now };

    const newId = opts.id || `toast_${now}_${Math.random().toString(36).substr(2, 4)}`;
    const newToast = { id: newId, title, message, type };

    setToasts((prev) => {
      // Single active toast behavior:
      // Replace existing progress/info/success toast in place.
      // If there's an active unexpired error and the new toast is also an error or user action,
      // update to the newest notification.
      // At most 1 active toast at any time.
      prev.forEach((t) => clearToastTimer(t.id));
      return [newToast];
    });

    // Schedule auto-dismissal
    clearToastTimer(newId);
    const timerId = window.setTimeout(() => {
      removeToast(newId);
    }, duration);
    timersRef.current.set(newId, timerId);
  }, [clearToastTimer, removeToast]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach((timerId) => clearTimeout(timerId));
      timersRef.current.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, dismissToast, removeToast, clearToasts }}>
      {children}
      <div className="toast-container" role="region" aria-label="Notifications" aria-live="polite">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast toast-${toast.type}`}
            role={toast.type === "error" ? "alert" : "status"}
            aria-live={toast.type === "error" ? "assertive" : "polite"}
          >
            <span className="toast-icon" aria-hidden="true">
              {toast.type === "success" && "✅"}
              {toast.type === "info" && "⚡"}
              {toast.type === "warning" && "⚠️"}
              {toast.type === "error" && "❌"}
              {toast.type === "burn" && "🔥"}
            </span>
            <div className="toast-content">
              <span className="toast-title">{toast.title}</span>
              <span className="toast-desc">{toast.message}</span>
            </div>
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              className="toast-close"
              aria-label="Dismiss notification"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

