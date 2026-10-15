import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import {
  getFoodLogs,
  addFoodLog,
  deleteFoodLog,
  getVerifiedFoods,
  getActivityLogs,
  getWearableConnection
} from "../services/dbService";
import {
  calculatePortionNutrition,
  calculateMealTotals,
  calculateDailyTotals,
  calculateBmr,
  calculateTdee,
  calculateNutritionTargets,
  aggregateDailyActivity,
  calculateEnergyBalance
} from "../utils/nutritionCalculators";
import EnergySummaryRings from "../components/EnergySummaryRings";
import {
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  CheckCircle,
  MoreHorizontal,
  Watch,
  Droplets,
  Sun,
  Utensils,
  Coffee,
  Apple,
  Moon,
  X
} from "lucide-react";

export default function FoodLog() {
  const { currentUser, userProfile } = useAuth();
  const { showToast } = useToast();

  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [logs, setLogs] = useState([]);
  const [verifiedFoods, setVerifiedFoods] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [wearableConn, setWearableConn] = useState(null);
  const [loading, setLoading] = useState(true);

  // Expanded accordion sections state
  const [expandedSlots, setExpandedSlots] = useState({
    water: false,
    device: false,
    Breakfast: true,
    Lunch: true,
    Tea: false,
    Snacks: false,
    Dinner: true
  });

  // Water tracking state
  const [waterMl, setWaterMl] = useState(() => {
    try {
      return parseFloat(localStorage.getItem(`nt_water_${selectedDate}`) || "1250");
    } catch {
      return 1250;
    }
  });

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedFoodId, setSelectedFoodId] = useState("");
  const [customFoodName, setCustomFoodName] = useState("");
  const [customCaloriesPer100g, setCustomCaloriesPer100g] = useState("");
  const [portionGrams, setPortionGrams] = useState(100);
  const [targetMeal, setTargetMeal] = useState("Breakfast");
  const [weightBasis, setWeightBasis] = useState("raw");

  // Calorie & TDEE Calculations
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

  // Load verified foods
  useEffect(() => {
    async function initFoods() {
      try {
        const foods = await getVerifiedFoods();
        setVerifiedFoods(foods);
        if (foods.length > 0) {
          setSelectedFoodId(foods[0].foodId);
          setPortionGrams(foods[0].defaultServingSize || 100);
          setWeightBasis(foods[0].weightBasis || "raw");
        }
      } catch (err) {
        console.error("Foods loading error:", err);
      }
    }
    initFoods();
  }, []);

  // Load day logs and activity
  useEffect(() => {
    async function loadData() {
      if (!currentUser?.uid) return;
      setLoading(true);
      try {
        const [dayLogs, acts, conn] = await Promise.all([
          getFoodLogs(currentUser.uid, selectedDate),
          getActivityLogs(currentUser.uid, selectedDate),
          getWearableConnection(currentUser.uid)
        ]);
        setLogs(dayLogs || []);
        setActivityLogs(acts || []);
        setWearableConn(conn);
      } catch (err) {
        console.error("Diary load error:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [currentUser, selectedDate]);

  // Update water storage when date changes
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`nt_water_${selectedDate}`);
      setWaterMl(stored ? parseFloat(stored) : 1250);
    } catch {
      setWaterMl(1250);
    }
  }, [selectedDate]);

  const handleAddWater = (amount) => {
    const updated = Math.max(0, waterMl + amount);
    setWaterMl(updated);
    try {
      localStorage.setItem(`nt_water_${selectedDate}`, updated.toString());
    } catch (e) {}
    showToast("Hydration Updated", `Recorded ${amount > 0 ? `+${amount}` : amount} ml.`, "info");
  };

  const toggleSlot = (slotKey) => {
    setExpandedSlots((prev) => ({ ...prev, [slotKey]: !prev[slotKey] }));
  };

  const openAddForMeal = (mealName) => {
    setTargetMeal(mealName);
    setShowAddModal(true);
  };

  // Active food preview
  const activeFood = verifiedFoods.find((f) => f.foodId === selectedFoodId);

  const calculatedPreview = activeFood
    ? calculatePortionNutrition(activeFood, portionGrams)
    : customCaloriesPer100g
    ? calculatePortionNutrition(
        {
          caloriesPer100g: parseFloat(customCaloriesPer100g) || 0,
          proteinPer100g: 0,
          carbsPer100g: 0,
          fatPer100g: 0,
          fibrePer100g: 0
        },
        portionGrams
      )
    : { calories: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 };

  // Handle Log Submission
  const handleAddFoodSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser?.uid) return;

    const foodName =
      selectedFoodId === "custom"
        ? customFoodName.trim()
        : activeFood?.foodName || "Food Item";

    if (!foodName) {
      showToast("Validation Error", "Please provide a food name.", "warning");
      return;
    }

    try {
      const newEntry = await addFoodLog(currentUser.uid, {
        date: selectedDate,
        mealType: targetMeal,
        foodId: selectedFoodId === "custom" ? null : selectedFoodId,
        foodName,
        portionQuantity: parseFloat(portionGrams) || 100,
        weightBasis,
        calculatedCalories: calculatedPreview.calories,
        protein: calculatedPreview.protein,
        carbs: calculatedPreview.carbs,
        fat: calculatedPreview.fat,
        fibre: calculatedPreview.fibre
      });

      setLogs((prev) => [newEntry, ...prev]);
      setShowAddModal(false);
      showToast("Food Logged!", `Added ${foodName} to ${targetMeal}.`, "success");

      if (selectedFoodId === "custom") {
        setCustomFoodName("");
        setCustomCaloriesPer100g("");
      }
    } catch (err) {
      console.error("Add food error:", err);
      showToast("Error", "Could not log food item.", "warning");
    }
  };

  const handleDelete = async (logId, name) => {
    try {
      await deleteFoodLog(logId);
      setLogs((prev) => prev.filter((l) => l.logId !== logId));
      showToast("Removed", `Deleted ${name} from diary.`, "info");
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  const changeDateBy = (days) => {
    const cur = new Date(selectedDate);
    cur.setDate(cur.getDate() + days);
    setSelectedDate(cur.toISOString().split("T")[0]);
  };

  const isToday = selectedDate === new Date().toISOString().split("T")[0];
  const dateDisplay = isToday
    ? "Today"
    : new Date(selectedDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric"
      });

  // Calculate totals
  const dailyTotals = calculateDailyTotals(logs);
  const activitySummary = aggregateDailyActivity(activityLogs);
  const activeBurn = activitySummary.activeCalories || 0;

  // Calorie balance with no double-counting safeguard
  const energyBalance = calculateEnergyBalance({
    tdee,
    consumedCalories: dailyTotals.calories,
    wearableActiveBurn: activeBurn,
    mode: wearableConn?.energyAccountingMode || "strict_tdee",
    dailyTargetOverride: targets.dailyCalorieTarget
  });

  // Meal slot definitions matching Screenshot 2
  const mealSlots = [
    { id: "Breakfast", label: "Meal 1", sublabel: "Breakfast" },
    { id: "Lunch", label: "Meal 2", sublabel: "Lunch" },
    { id: "Tea", label: "Meal 3", sublabel: "Tea" },
    { id: "Snacks", label: "Meal 4", sublabel: "Snacks" },
    { id: "Dinner", label: "Meal 5", sublabel: "Dinner" }
  ];

  return (
    <div className="diary-page-container">
      {/* Top Header Bar: < Today > */}
      <div className="date-navigator-bar">
        <button
          type="button"
          className="nav-side-icon-btn"
          title="Daily Goals"
        >
          <CheckCircle size={16} className="text-emerald" />
        </button>

        <div className="date-nav-center">
          <button
            type="button"
            onClick={() => changeDateBy(-1)}
            className="date-nav-arrow"
            aria-label="Previous day"
          >
            <ChevronLeft size={18} />
          </button>

          <label className="date-picker-label">
            <span>{dateDisplay}</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </label>

          <button
            type="button"
            onClick={() => changeDateBy(1)}
            className="date-nav-arrow"
            aria-label="Next day"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div style={{ display: "flex", gap: "6px" }}>
          <button
            type="button"
            onClick={() => openAddForMeal("Breakfast")}
            className="nav-side-icon-btn"
            title="Add Food"
          >
            <Plus size={16} />
          </button>
          <button
            type="button"
            className="nav-side-icon-btn"
            title="Options"
          >
            <MoreHorizontal size={16} />
          </button>
        </div>
      </div>

      {/* 1. Energy Summary Section with Screenshot 1 layout */}
      <EnergySummaryRings
        consumed={dailyTotals.calories}
        expenditure={Math.round(energyBalance.effectiveExpenditure || tdee)}
        target={Math.round(targets.dailyCalorieTarget || 2000)}
        activeBurn={activeBurn}
        macros={{
          protein: dailyTotals.protein,
          carbs: dailyTotals.carbs,
          fat: dailyTotals.fat,
          fiber: 18
        }}
        macroTargets={{
          protein: targets?.proteinTarget || 120,
          carbs: targets?.carbohydrateTarget || 220,
          fat: targets?.fatTarget || 60,
          fiber: 25
        }}
        onOpenTargetModal={() =>
          showToast(
            "Calorie Target",
            `Daily budget: ${Math.round(targets.dailyCalorieTarget)} kcal based on your profile TDEE.`,
            "info"
          )
        }
      />

      {/* 2. Expandable Food Diary Slots List - Exact Alignment from Screenshot 2 */}
      <div className="ref-diary-slots-group">
        {/* Slot: Water (Screenshot 2: Water  0 / 2400 mL) */}
        <div className={`ref-diary-slot-item ${expandedSlots.water ? "slot-expanded-active" : ""}`}>
          <div
            className="ref-water-slot-header"
            onClick={() => toggleSlot("water")}
          >
            <div className="ref-water-left">
              <span className="ref-water-title">Water</span>
              <span className="ref-water-amount">{Math.round(waterMl)} / 2400 mL</span>
            </div>
            <div className="ref-slot-right">
              <ChevronDown
                size={18}
                className={`ref-chevron-icon ${expandedSlots.water ? "expanded" : ""}`}
              />
            </div>
          </div>

          {expandedSlots.water && (
            <div className="diary-slot-content">
              <div className="water-slot-progress-bar">
                <div
                  className="water-progress-fill"
                  style={{ width: `${Math.min(100, (waterMl / 2400) * 100)}%` }}
                />
              </div>
              <div className="water-quick-buttons">
                <button
                  type="button"
                  className="water-add-pill-btn"
                  onClick={() => handleAddWater(250)}
                >
                  +250 ml
                </button>
                <button
                  type="button"
                  className="water-add-pill-btn"
                  onClick={() => handleAddWater(500)}
                >
                  +500 ml
                </button>
                <button
                  type="button"
                  className="water-add-pill-btn"
                  onClick={() => handleAddWater(-250)}
                >
                  -250 ml
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Meal Slots (Meal 1, Meal 2, Meal 3, Meal 4, Meal 5) */}
        {mealSlots.map((slot) => {
          const mealItems = logs.filter(
            (l) => l.mealType?.toLowerCase() === slot.id.toLowerCase()
          );
          const mealTotals = calculateMealTotals(mealItems);
          const isExpanded = expandedSlots[slot.id];
          const hasFood = mealItems.length > 0;

          return (
            <div
              key={slot.id}
              className={`ref-diary-slot-item ${
                isExpanded ? "slot-expanded-active" : ""
              } ${hasFood ? "slot-has-food" : ""}`}
            >
              <div
                className="ref-meal-slot-header"
                onClick={() => toggleSlot(slot.id)}
              >
                {/* Left: '+' Button Aligned Under Water */}
                <button
                  type="button"
                  className="ref-slot-plus-btn"
                  title={`Add Food to ${slot.label}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    openAddForMeal(slot.id);
                  }}
                >
                  <Plus size={18} />
                </button>

                {/* Center: Title + Subtitle */}
                <div className="ref-meal-info-block">
                  <div className="ref-meal-title-row">
                    <span className="ref-meal-name">{slot.label}</span>
                    <span className="ref-meal-subtag">({slot.sublabel})</span>
                  </div>
                  <div className="ref-meal-subtext">
                    {hasFood
                      ? `${mealTotals.calories} kcal, ${Math.round(mealTotals.protein)} g protein, ${Math.round(mealTotals.carbs)} g carbs, ${Math.round(mealTotals.fat)} g fat`
                      : "0 kcal, 0 g protein, 0 g carbs, 0 g fat"}
                  </div>
                </div>

                {/* Right: Chevron */}
                <div className="ref-slot-right">
                  <ChevronDown
                    size={18}
                    className={`ref-chevron-icon ${isExpanded ? "expanded" : ""}`}
                  />
                </div>
              </div>

              {isExpanded && (
                <div className="diary-slot-content">
                  {mealItems.length === 0 ? (
                    <div className="diary-empty-slot">
                      <span>No items logged yet</span>
                      <button
                        type="button"
                        className="slot-add-text-btn"
                        onClick={() => openAddForMeal(slot.id)}
                      >
                        <Plus size={14} />
                        <span>Add Food</span>
                      </button>
                    </div>
                  ) : (
                    <div>
                      {mealItems.map((item) => (
                        <div key={item.logId} className="logged-food-row">
                          <div className="food-item-meta">
                            <span className="food-item-name">{item.foodName}</span>
                            <span className="food-item-portion">
                              {item.portionQuantity}g ({item.weightBasis || "raw"}) •{" "}
                              <span style={{ color: "var(--accent-emerald)" }}>{Math.round(item.protein || 0)}g P</span> •{" "}
                              <span style={{ color: "var(--accent-amber)" }}>{Math.round(item.carbs || 0)}g C</span> •{" "}
                              <span style={{ color: "var(--accent-pink)" }}>{Math.round(item.fat || 0)}g F</span>
                            </span>
                          </div>
                          <div className="food-item-stats">
                            <span className="food-item-cals">
                              {Math.round(item.calculatedCalories)} kcal
                            </span>
                            <button
                              type="button"
                              className="food-item-delete-btn"
                              title="Delete food item"
                              onClick={() => handleDelete(item.logId, item.foodName)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}

                      <div style={{ marginTop: "8px", textAlign: "right" }}>
                        <button
                          type="button"
                          className="slot-add-text-btn"
                          onClick={() => openAddForMeal(slot.id)}
                        >
                          <Plus size={14} />
                          <span>Add More to {slot.label}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Food Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Add Food to {targetMeal}</span>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setShowAddModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddFoodSubmit} className="modal-body">
              {/* Meal Slot Select */}
              <div className="form-group">
                <label className="form-label">Meal Category</label>
                <select
                  value={targetMeal}
                  onChange={(e) => setTargetMeal(e.target.value)}
                  className="form-select"
                >
                  <option value="Breakfast">Breakfast (Breki)</option>
                  <option value="Lunch">Lunch</option>
                  <option value="Tea">Tea</option>
                  <option value="Snacks">Snacks</option>
                  <option value="Dinner">Dinner</option>
                </select>
              </div>

              {/* Food Selection */}
              <div className="form-group">
                <label className="form-label">Select Verified Food</label>
                <select
                  value={selectedFoodId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedFoodId(id);
                    const found = verifiedFoods.find((f) => f.foodId === id);
                    if (found) {
                      setPortionGrams(found.defaultServingSize || 100);
                      setWeightBasis(found.weightBasis || "raw");
                    }
                  }}
                  className="form-select"
                >
                  {verifiedFoods.map((f) => (
                    <option key={f.foodId} value={f.foodId}>
                      {f.foodName} ({f.caloriesPer100g} kcal/100g)
                    </option>
                  ))}
                  <option value="custom">+ Custom Food Entry</option>
                </select>
              </div>

              {/* Custom Food inputs */}
              {selectedFoodId === "custom" && (
                <>
                  <div className="form-group">
                    <label className="form-label">Custom Food Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Masala Dosa"
                      value={customFoodName}
                      onChange={(e) => setCustomFoodName(e.target.value)}
                      className="form-input"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Calories per 100g</label>
                    <input
                      type="number"
                      placeholder="e.g. 180"
                      value={customCaloriesPer100g}
                      onChange={(e) => setCustomCaloriesPer100g(e.target.value)}
                      className="form-input"
                      required
                    />
                  </div>
                </>
              )}

              {/* Portion Weight & Basis */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div className="form-group">
                  <label className="form-label">Weight (grams)</label>
                  <input
                    type="number"
                    min="1"
                    max="3000"
                    value={portionGrams}
                    onChange={(e) => setPortionGrams(parseFloat(e.target.value) || 0)}
                    className="form-input"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Weight Basis</label>
                  <select
                    value={weightBasis}
                    onChange={(e) => setWeightBasis(e.target.value)}
                    className="form-select"
                  >
                    <option value="raw">Raw (Uncooked)</option>
                    <option value="cooked">Cooked</option>
                  </select>
                </div>
              </div>

              {/* Live Nutrition Summary Box */}
              <div
                style={{
                  background: "#f4f4f5",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  marginBottom: "14px",
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.82rem"
                }}
              >
                <div>
                  <span className="font-semibold text-primary">
                    {calculatedPreview.calories} kcal
                  </span>
                </div>
                <div style={{ color: "#71717a" }}>
                  <span>{calculatedPreview.protein}g Protein</span> •{" "}
                  <span>{calculatedPreview.carbs}g Carbs</span> •{" "}
                  <span>{calculatedPreview.fat}g Fat</span>
                </div>
              </div>

              <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="primary-btn">
                  Add to {targetMeal}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
