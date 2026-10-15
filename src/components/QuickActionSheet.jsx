import React from "react";
import { useNavigate } from "react-router-dom";
import {
  HelpCircle,
  Apple,
  ScanBarcode,
  HeartPulse,
  FileText,
  Activity,
  Mic,
  Camera,
  X
} from "lucide-react";

/**
 * Quick Action Bottom Sheet matching Screenshot 1:
 * Displays a clean 3x3 grid of colorful circular icon actions.
 */
export default function QuickActionSheet({ isOpen, onClose, onQuickAddFood }) {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleAction = (action) => {
    onClose();
    switch (action) {
      case "add_food":
        if (onQuickAddFood) onQuickAddFood();
        else navigate("/food-log");
        break;
      case "suggest_food":
        navigate("/meal-plans");
        break;
      case "scan_food":
        navigate("/foods");
        break;
      case "add_biometric":
        navigate("/weight");
        break;
      case "add_exercise":
        navigate("/activity");
        break;
      case "add_note":
        navigate("/food-log");
        break;
      case "voice_log":
      case "photo_log":
        navigate("/food-log");
        break;
      default:
        break;
    }
  };

  return (
    <div className="quick-action-overlay" onClick={onClose}>
      <div
        className="quick-action-sheet"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Quick Actions"
      >
        <div className="sheet-drag-handle" />

        <div className="sheet-header-row">
          <span className="sheet-title">Quick Action</span>
          <button
            type="button"
            className="sheet-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="quick-actions-grid">
          {/* 1. Suggest Food */}
          <button
            type="button"
            className="quick-action-btn"
            onClick={() => handleAction("suggest_food")}
          >
            <div className="action-circle-icon bg-amber-soft text-amber">
              <HelpCircle size={22} />
            </div>
            <span className="action-label">Suggest Food</span>
          </button>

          {/* 2. Add Food */}
          <button
            type="button"
            className="quick-action-btn"
            onClick={() => handleAction("add_food")}
          >
            <div className="action-circle-icon bg-red-soft text-red">
              <Apple size={22} />
            </div>
            <span className="action-label">Add Food</span>
          </button>

          {/* 3. Scan Food */}
          <button
            type="button"
            className="quick-action-btn"
            onClick={() => handleAction("scan_food")}
          >
            <div className="action-circle-icon bg-purple-soft text-purple">
              <ScanBarcode size={22} />
            </div>
            <span className="action-label">Scan Food</span>
          </button>

          {/* 4. Add Biometric */}
          <button
            type="button"
            className="quick-action-btn"
            onClick={() => handleAction("add_biometric")}
          >
            <div className="action-circle-icon bg-pink-soft text-pink">
              <HeartPulse size={22} />
            </div>
            <span className="action-label">Add Biometric</span>
          </button>

          {/* 5. Add Note */}
          <button
            type="button"
            className="quick-action-btn"
            onClick={() => handleAction("add_note")}
          >
            <div className="action-circle-icon bg-amber-soft text-amber">
              <FileText size={22} />
            </div>
            <span className="action-label">Add Note</span>
          </button>

          {/* 6. Add Exercise */}
          <button
            type="button"
            className="quick-action-btn"
            onClick={() => handleAction("add_exercise")}
          >
            <div className="action-circle-icon bg-teal-soft text-teal">
              <Activity size={22} />
            </div>
            <span className="action-label">Add Exercise</span>
          </button>

          {/* 7. Voice Log */}
          <button
            type="button"
            className="quick-action-btn"
            onClick={() => handleAction("voice_log")}
          >
            <div className="action-circle-icon bg-violet-soft text-violet">
              <Mic size={22} />
            </div>
            <span className="action-label">Voice Log</span>
          </button>

          {/* 8. Photo Log */}
          <button
            type="button"
            className="quick-action-btn"
            onClick={() => handleAction("photo_log")}
          >
            <div className="action-circle-icon bg-teal-soft text-teal">
              <Camera size={22} />
            </div>
            <span className="action-label">Photo Log</span>
          </button>
        </div>
      </div>
    </div>
  );
}
