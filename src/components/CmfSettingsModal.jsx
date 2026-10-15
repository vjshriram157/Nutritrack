import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import {
  User,
  Scale,
  BookOpen,
  Database,
  LogOut,
  X,
  CheckCircle,
  Save,
  Shield,
  RotateCcw
} from "lucide-react";

export default function CmfSettingsModal({ isOpen, onClose, onNavigate }) {
  const { currentUser, userProfile, updateProfile, logout, isFirebaseConfigured } = useAuth();
  const { showToast } = useToast();

  const [name, setName] = useState(userProfile?.name || currentUser?.displayName || "Athlete");
  const [calorieTarget, setCalorieTarget] = useState(userProfile?.dailyCalorieTarget || 2000);
  const [stepGoal, setStepGoal] = useState(userProfile?.dailyStepGoal || 9000);
  const [fitnessGoal, setFitnessGoal] = useState(userProfile?.fitnessGoal || "fat_loss");
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (updateProfile) {
        await updateProfile({
          name,
          dailyCalorieTarget: parseInt(calorieTarget, 10) || 2000,
          dailyStepGoal: parseInt(stepGoal, 10) || 9000,
          fitnessGoal
        });
      }
      showToast("Profile Updated", "Daily targets and profile saved successfully.", "success");
      onClose();
    } catch (err) {
      console.error("Save profile error:", err);
      showToast("Save Error", err?.message || "Could not save profile.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="cmf-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="cmf-modal-header">
          <div className="cmf-modal-title-row">
            <User size={18} className="text-coral" />
            <h3 className="cmf-modal-title">Settings & Profile</h3>
          </div>
          <button type="button" onClick={onClose} className="cmf-close-btn" aria-label="Close">
            ✕
          </button>
        </div>

        <form onSubmit={handleSave} className="cmf-modal-body">
          {/* Status Banner */}
          <div className="cmf-info-box">
            <Database size={14} />
            <span>
              {isFirebaseConfigured && !currentUser?.isDemo
                ? `Cloud Sync: Authenticated as ${currentUser?.email || "User"}`
                : "Local-First Storage: Nutrition & smartwatch data stored securely on this device."}
            </span>
          </div>

          <div className="cmf-input-group">
            <label className="cmf-label">Display Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="cmf-input"
              placeholder="Your name"
            />
          </div>

          <div className="cmf-input-grid-2">
            <div className="cmf-input-group">
              <label className="cmf-label">Daily Calorie Target (kcal)</label>
              <input
                type="number"
                value={calorieTarget}
                onChange={(e) => setCalorieTarget(e.target.value)}
                className="cmf-input"
                min="1000"
                max="5000"
              />
            </div>

            <div className="cmf-input-group">
              <label className="cmf-label">Daily Step Goal (steps)</label>
              <input
                type="number"
                value={stepGoal}
                onChange={(e) => setStepGoal(e.target.value)}
                className="cmf-input"
                min="1000"
                max="50000"
                step="500"
              />
            </div>
          </div>

          <div className="cmf-input-group">
            <label className="cmf-label">Fitness Goal</label>
            <select
              value={fitnessGoal}
              onChange={(e) => setFitnessGoal(e.target.value)}
              className="cmf-input"
            >
              <option value="fat_loss">Fat Loss (Calorie Deficit)</option>
              <option value="maintenance">Weight Maintenance</option>
              <option value="muscle_gain">Muscle Building (Hypertrophy)</option>
              <option value="endurance">Endurance & Cardio</option>
            </select>
          </div>

          {/* Quick Shortcuts to Weight Tracker & Food Database */}
          <div className="cmf-shortcuts-section">
            <span className="cmf-shortcuts-label">Feature Shortcuts</span>
            <div className="cmf-shortcuts-grid">
              <Link
                to="/weight"
                onClick={onClose}
                className="cmf-shortcut-btn"
              >
                <Scale size={15} />
                <span>Weight Tracker</span>
              </Link>

              <Link
                to="/foods"
                onClick={onClose}
                className="cmf-shortcut-btn"
              >
                <BookOpen size={15} />
                <span>Food Database</span>
              </Link>
            </div>
          </div>

          {/* Onboarding Reset Option for Testing */}
          <div className="cmf-shortcuts-section" style={{ marginTop: "12px" }}>
            <span className="cmf-shortcuts-label">Testing &amp; Guided Setup</span>
            <button
              type="button"
              onClick={() => {
                try {
                  localStorage.removeItem("nutritrack_onboarding_completed");
                  localStorage.removeItem("nutritrack_onboarding_step");
                  window.dispatchEvent(new Event("nutritrack_reset_onboarding"));
                  onClose();
                  showToast(
                    "Onboarding Reset",
                    "The onboarding walkthrough has been reset. All existing health and nutrition records are preserved.",
                    "info"
                  );
                } catch (e) {
                  console.warn("Could not reset onboarding:", e);
                }
              }}
              className="cmf-shortcut-btn"
              style={{ width: "100%", justifyContent: "center", color: "#60a5fa" }}
            >
              <RotateCcw size={14} />
              <span>Reset Onboarding Walkthrough</span>
            </button>
          </div>

          <div className="cmf-modal-actions">
            <button
              type="submit"
              disabled={saving}
              className="cmf-btn-primary"
            >
              <Save size={14} />
              <span>{saving ? "Saving..." : "Save Targets"}</span>
            </button>

            {currentUser && (
              <button
                type="button"
                onClick={() => {
                  logout?.();
                  onClose();
                }}
                className="cmf-btn-secondary"
              >
                <LogOut size={14} />
                <span>Sign Out</span>
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
