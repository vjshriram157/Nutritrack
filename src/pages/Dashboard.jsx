import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  getFoodLogs,
  getWeightLogs,
  getActivityLogs,
  getWearableConnection
} from "../services/dbService";
import {
  calculateDailyTotals,
  calculateBmr,
  calculateTdee,
  calculateNutritionTargets,
  aggregateDailyActivity,
  calculateEnergyBalance
} from "../utils/nutritionCalculators";
import EnergySummaryRings from "../components/EnergySummaryRings";
import MacroBar from "../components/MacroBar";
import {
  Target,
  UtensilsCrossed,
  ArrowRight,
  Watch,
  Footprints,
  Flame,
  Plus
} from "lucide-react";

export default function Dashboard() {
  const { currentUser, userProfile } = useAuth();
  const todayStr = new Date().toISOString().split("T")[0];

  const [todayLogs, setTodayLogs] = useState([]);
  const [recentWeights, setRecentWeights] = useState([]);
  const [todayActivity, setTodayActivity] = useState([]);
  const [wearableConn, setWearableConn] = useState(null);
  const [loading, setLoading] = useState(true);

  // Derived user targets from profile
  const bmr = calculateBmr({
    sex: userProfile?.sex || "male",
    weightKg: userProfile?.currentWeight || 75,
    heightCm: userProfile?.height || 178,
    ageYears: userProfile?.age || 27
  });

  const tdee = calculateTdee(
    bmr,
    userProfile?.activityLevel || 1.375,
    userProfile?.walkingDuration || 30,
    userProfile?.currentWeight || 75
  );

  const targets = calculateNutritionTargets(
    tdee,
    userProfile?.fitnessGoal || "fat_loss",
    userProfile?.currentWeight || 75,
    userProfile?.dietaryPreference || "omnivore"
  );

  useEffect(() => {
    async function loadData() {
      if (!currentUser?.uid) return;
      setLoading(true);
      try {
        const [logs, weights, acts, conn] = await Promise.all([
          getFoodLogs(currentUser.uid, todayStr),
          getWeightLogs(currentUser.uid),
          getActivityLogs(currentUser.uid, todayStr),
          getWearableConnection(currentUser.uid)
        ]);
        setTodayLogs(logs || []);
        setRecentWeights(weights || []);
        setTodayActivity(acts || []);
        setWearableConn(conn);
      } catch (err) {
        console.error("Dashboard data load error:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [currentUser, todayStr]);

  const dailyTotals = calculateDailyTotals(todayLogs);
  const activityData = aggregateDailyActivity(todayActivity);
  const activeBurn = activityData.activeCalories || 0;

  // Energy balance calculation with strict TDEE double-counting safeguard
  const energyBalance = calculateEnergyBalance({
    tdee,
    consumedCalories: dailyTotals.calories,
    wearableActiveBurn: activeBurn,
    mode: wearableConn?.energyAccountingMode || "strict_tdee",
    dailyTargetOverride: targets.dailyCalorieTarget
  });

  return (
    <div className="dashboard-page-container">
      {/* 1. Energy Summary with Screenshot 1 layout (Calories + 2x2 Macro Cards) */}
      <EnergySummaryRings
        consumed={dailyTotals.calories}
        expenditure={Math.round(energyBalance.effectiveExpenditure || tdee)}
        target={Math.round(targets.dailyCalorieTarget || 2000)}
        activeBurn={activeBurn}
        macros={{
          protein: dailyTotals.protein,
          carbs: dailyTotals.carbs,
          fat: dailyTotals.fat,
          fiber: dailyTotals.fiber || 18
        }}
        macroTargets={{
          protein: targets?.proteinTarget || 120,
          carbs: targets?.carbohydrateTarget || 220,
          fat: targets?.fatTarget || 60,
          fiber: targets?.fiberTarget || 25
        }}
      />

      {/* 2. Today's Diary Overview Card */}
      <div className="clean-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <span className="card-title">Today's Food Diary</span>
          <p className="card-subtitle">
            {todayLogs.length > 0
              ? `${todayLogs.length} item${todayLogs.length === 1 ? "" : "s"} logged • ${dailyTotals.calories} kcal consumed`
              : "No food logged yet for today"}
          </p>
        </div>
        <Link to="/food-log" className="primary-btn btn-sm">
          <span>Go to Diary</span>
          <ArrowRight size={14} />
        </Link>
      </div>

      {/* 3. Smartwatch Activity Strip */}
      <div className="clean-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Watch size={18} className="text-teal" />
            <span className="card-title" style={{ fontSize: "0.88rem" }}>
              Smartwatch Activity • Health Connect
            </span>
          </div>
          <Link
            to="/activity"
            style={{ fontSize: "0.78rem", color: "var(--accent-orange)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "4px" }}
          >
            <span>Manage</span>
            <ArrowRight size={13} />
          </Link>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
          <div style={{ background: "#fafaf9", padding: "10px 12px", borderRadius: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--text-muted)", fontSize: "0.74rem" }}>
              <Footprints size={14} />
              <span>Daily Steps</span>
            </div>
            <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)", marginTop: "2px" }}>
              {activityData.steps !== null ? activityData.steps.toLocaleString() : "Unavailable"}
            </div>
          </div>

          <div style={{ background: "#fafaf9", padding: "10px 12px", borderRadius: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--text-muted)", fontSize: "0.74rem" }}>
              <Flame size={14} />
              <span>Active Calories</span>
            </div>
            <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)", marginTop: "2px" }}>
              {activityData.activeCalories !== null ? `${activityData.activeCalories} kcal` : "Unavailable"}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Macronutrient Targets Progress */}
      <div className="clean-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
          <div>
            <span className="card-title">Macronutrient Targets</span>
            <p className="card-subtitle">Intake vs daily recommended split</p>
          </div>
          <Link
            to="/food-log"
            style={{ fontSize: "0.78rem", color: "var(--accent-orange)", fontWeight: 600 }}
          >
            Log Food
          </Link>
        </div>

        <MacroBar
          protein={dailyTotals.protein}
          carbs={dailyTotals.carbs}
          fat={dailyTotals.fat}
          fibre={dailyTotals.fibre}
          proteinTarget={targets?.proteinTarget || 120}
          carbsTarget={targets?.carbohydrateTarget || 220}
          fatTarget={targets?.fatTarget || 60}
          fibreTarget={targets?.fibreTarget || 30}
        />
      </div>
    </div>
  );
}
