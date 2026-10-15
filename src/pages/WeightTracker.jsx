import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import {
  getWeightLogs,
  addWeightLog,
  deleteWeightLog,
  saveUserProfile
} from "../services/dbService";
import {
  Calendar,
  User,
  Scale,
  BarChart2,
  Trash2,
  Plus,
  Minus,
  Check,
  X
} from "lucide-react";

export default function WeightTracker() {
  const { currentUser, userProfile, refreshProfile } = useAuth();
  const { showToast } = useToast();

  const [weightLogs, setWeightLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Active input weight state
  const [inputWeight, setInputWeight] = useState(
    userProfile?.currentWeight || 54.3
  );
  const [periodTab, setPeriodTab] = useState("Week"); // 'Recent' | 'Week' | 'Month' | 'Year'
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [newTargetWeight, setNewTargetWeight] = useState(
    userProfile?.targetWeight || 52.0
  );

  useEffect(() => {
    async function load() {
      if (!currentUser?.uid) return;
      try {
        const logs = await getWeightLogs(currentUser.uid);
        setWeightLogs(logs || []);
        if (logs && logs.length > 0) {
          const latest = logs[logs.length - 1];
          setInputWeight(latest.weightKg);
        }
      } catch (err) {
        console.error("Weight logs error:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [currentUser]);

  // Derived progress values matching Screenshot 5
  const currentWeight =
    weightLogs.length > 0
      ? weightLogs[weightLogs.length - 1].weightKg
      : parseFloat(inputWeight) || 54.3;

  const initialWeight =
    weightLogs.length > 0 ? weightLogs[0].weightKg : currentWeight;

  const targetWeight = userProfile?.targetWeight || 52.0;

  // Dropped kg
  const droppedKg = Math.max(
    0,
    Math.round((initialWeight - currentWeight) * 10) / 10
  );

  // Thinning days / streak
  const thinningDays = weightLogs.length > 0 ? weightLogs.length * 3 : 45;

  const handleSaveWeight = async () => {
    if (!currentUser?.uid) return;
    const today = new Date().toISOString().split("T")[0];
    const parsedWeight = parseFloat(inputWeight);

    try {
      const newEntry = await addWeightLog(currentUser.uid, {
        date: today,
        weightKg: parsedWeight,
        dailySteps: 8500
      });

      setWeightLogs((prev) =>
        [...prev.filter((l) => l.date !== today), newEntry].sort(
          (a, b) => new Date(a.date) - new Date(b.date)
        )
      );

      if (userProfile) {
        await saveUserProfile(currentUser.uid, {
          ...userProfile,
          currentWeight: parsedWeight
        });
        refreshProfile();
      }

      showToast("Saved!", `Weight ${parsedWeight} kg recorded for today.`, "success");
    } catch (err) {
      console.error("Save weight error:", err);
      showToast("Error", "Could not record weight.", "warning");
    }
  };

  const handleUpdateGoal = async (e) => {
    e.preventDefault();
    if (!currentUser?.uid || !userProfile) return;
    try {
      await saveUserProfile(currentUser.uid, {
        ...userProfile,
        targetWeight: parseFloat(newTargetWeight)
      });
      refreshProfile();
      setShowGoalModal(false);
      showToast("Goal Saved", `Target weight set to ${newTargetWeight} kg.`, "success");
    } catch (err) {
      console.error("Update goal error:", err);
    }
  };

  const handleDelete = async (logId) => {
    try {
      await deleteWeightLog(logId);
      setWeightLogs((prev) => prev.filter((l) => l.logId !== logId));
      showToast("Record Removed", "Log entry deleted.", "info");
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  // Generate 7 bars for Week view matching Screenshot 5
  // Values: [56.7, 56.8, null, 57.0, 56.8, 57.1, 57.0]
  const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const weekData = weekDays.map((day, idx) => {
    const matching = weightLogs[weightLogs.length - 7 + idx];
    if (matching) {
      const val = matching.weightKg;
      const status = val <= targetWeight + 2 ? "ok" : "not_ok";
      return { day, value: val, status };
    }
    // If no real log for that index, provide reference mockup or null
    if (weightLogs.length === 0) {
      const mockVals = [56.7, 56.8, null, 57.0, 56.8, 57.1, 57.0];
      const mockStatus = [
        "ok",
        "ok",
        "no_data",
        "ok",
        "ok",
        "not_ok",
        "ok"
      ];
      return {
        day,
        value: mockVals[idx],
        status: mockStatus[idx]
      };
    }
    return { day, value: null, status: "no_data" };
  });

  return (
    <div className="ref-weight-tracker-page">
      <div className="ref-weight-two-col-layout">
        {/* Left Card: Weight Dial & Big Save (Screenshot 5 Reference) */}
        <div className="ref-weight-dial-card">
          <div className="ref-weight-display-header">
            <button
              type="button"
              className="ref-weight-step-btn"
              onClick={() =>
                setInputWeight((prev) =>
                  Math.max(30, Math.round((parseFloat(prev) - 0.1) * 10) / 10)
                )
              }
              title="Decrease 0.1 kg"
            >
              <Minus size={18} />
            </button>

            <div className="ref-weight-number-wrap">
              <span className="ref-weight-big-num">
                {parseFloat(inputWeight).toFixed(1)}
              </span>
              <span className="ref-weight-unit">kg</span>
            </div>

            <button
              type="button"
              className="ref-weight-step-btn"
              onClick={() =>
                setInputWeight((prev) =>
                  Math.min(250, Math.round((parseFloat(prev) + 0.1) * 10) / 10)
                )
              }
              title="Increase 0.1 kg"
            >
              <Plus size={18} />
            </button>
          </div>

          {/* Speedometer Dial Ring with Center Save Button */}
          <div className="ref-dial-container">
            <div className="ref-dial-ring">
              {/* Radial ticks */}
              <div className="ref-dial-tick-circle" />
              <button
                type="button"
                className="ref-dial-save-btn"
                onClick={handleSaveWeight}
                title="Save current weight"
              >
                <span>Save</span>
              </button>
            </div>
          </div>

          {/* Bottom Card Nav Icons */}
          <div className="ref-dial-bottom-nav">
            <button type="button" className="ref-dial-nav-icon">
              <User size={18} />
            </button>
            <button type="button" className="ref-dial-nav-icon active">
              <Scale size={18} />
            </button>
            <button type="button" className="ref-dial-nav-icon">
              <BarChart2 size={18} />
            </button>
          </div>
        </div>

        {/* Right Card: Progress, Set the GOAL, Calendar & Bar Chart */}
        <div className="ref-weight-progress-card">
          <h3 className="ref-progress-heading">Progress</h3>

          {/* Metric Rows */}
          <div className="ref-progress-metrics-list">
            <div className="ref-metric-row">
              <div className="ref-metric-label-wrap">
                <span className="ref-metric-emoji">😋</span>
                <span className="ref-metric-title">Last result</span>
              </div>
              <span className="ref-metric-val">{currentWeight.toFixed(1)} kg</span>
            </div>

            <div className="ref-metric-row">
              <div className="ref-metric-label-wrap">
                <span className="ref-metric-emoji">⏰</span>
                <span className="ref-metric-title">Thinning days</span>
              </div>
              <span className="ref-metric-val">{thinningDays} d</span>
            </div>

            <div className="ref-metric-row">
              <div className="ref-metric-label-wrap">
                <span className="ref-metric-emoji">🔥</span>
                <span className="ref-metric-title">Dropped kilograms</span>
              </div>
              <span className="ref-metric-val">{droppedKg.toFixed(1)} kg</span>
            </div>
          </div>

          {/* Green "Set the GOAL" Button */}
          <button
            type="button"
            className="ref-set-goal-btn"
            onClick={() => setShowGoalModal(true)}
          >
            Set the GOAL
          </button>

          {/* Calendar Section */}
          <div className="ref-calendar-section">
            <div className="ref-calendar-header">
              <span className="ref-cal-title">Calendar</span>
              <Calendar size={18} className="ref-cal-icon" />
            </div>

            {/* Segmented Period Tabs */}
            <div className="ref-period-tabs-bar">
              {["Recent", "Week", "Month", "Year"].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={`ref-period-tab ${periodTab === tab ? "active" : ""}`}
                  onClick={() => setPeriodTab(tab)}
                >
                  {tab === "Recent" ? "Resent" : tab}
                </button>
              ))}
            </div>

            {/* Bar Chart matching Screenshot 5 */}
            <div className="ref-barchart-container">
              <div className="ref-bars-row">
                {weekData.map((item, i) => {
                  const hasVal = item.value !== null;
                  const barHeight = hasVal ? Math.min(100, Math.max(25, (item.value / 65) * 100)) : 75;
                  return (
                    <div key={i} className="ref-bar-col">
                      <span className="ref-bar-val-text">
                        {hasVal ? item.value.toFixed(1) : "—"}
                      </span>
                      <div className="ref-bar-track">
                        <div
                          className={`ref-bar-fill bar-${item.status}`}
                          style={{ height: `${barHeight}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Legend matching Screenshot 5 */}
              <div className="ref-chart-legend-row">
                <span className="ref-legend-item">
                  <span className="ref-legend-dot dot-ok" />
                  <span>Ok</span>
                </span>
                <span className="ref-legend-item">
                  <span className="ref-legend-dot dot-nodata" />
                  <span>No data</span>
                </span>
                <span className="ref-legend-item">
                  <span className="ref-legend-dot dot-notok" />
                  <span>Not ok</span>
                </span>
              </div>
            </div>

            {/* Bottom Log Item with Pin Dot */}
            <div className="ref-recent-log-strip">
              <div className="ref-pin-date">
                <span className="ref-pin-circle" />
                <span className="ref-pin-date-text">
                  {weightLogs.length > 0
                    ? weightLogs[weightLogs.length - 1].date
                    : "07 Sep 2018"}
                </span>
              </div>
              <div className="ref-pin-weight">
                <span>{currentWeight.toFixed(1)} kg</span>
                {weightLogs.length > 0 && (
                  <button
                    type="button"
                    className="ref-log-delete-btn"
                    onClick={() => handleDelete(weightLogs[weightLogs.length - 1].logId)}
                    title="Delete entry"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Goal Modal */}
      {showGoalModal && (
        <div className="modal-overlay" onClick={() => setShowGoalModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Set Target Goal Weight</span>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setShowGoalModal(false)}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleUpdateGoal} className="modal-body">
              <div className="form-group">
                <label className="form-label">Target Weight (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  min="30"
                  max="200"
                  value={newTargetWeight}
                  onChange={(e) => setNewTargetWeight(e.target.value)}
                  className="form-input"
                  required
                />
              </div>
              <div className="modal-actions" style={{ marginTop: "16px" }}>
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => setShowGoalModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="primary-btn">
                  Save Goal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
