import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import {
  getFoodLogs,
  addFoodLog,
  deleteFoodLog,
  getVerifiedFoods
} from "../services/dbService";
import {
  calculatePortionNutrition,
  calculateMealTotals,
  calculateDailyTotals,
  calculateBmr,
  calculateTdee,
  calculateNutritionTargets
} from "../utils/nutritionCalculators";
import { getLocalDateString } from "../services/healthConnectBridge";
import {
  Utensils,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Search,
  Check,
  Flame,
  Coffee,
  Sun,
  Moon,
  Apple,
  Calendar,
  X,
  Sparkles,
  Info
} from "lucide-react";

export default function HealthTab() {
  const { currentUser, userProfile } = useAuth();
  const { showToast } = useToast();

  const effectiveUserId = currentUser?.uid || "demo_athlete_01";

  // Selected date (defaults to device's local calendar date)
  const [selectedDate, setSelectedDate] = useState(() => getLocalDateString(new Date()));
  const [foodLogs, setFoodLogs] = useState([]);
  const [verifiedFoods, setVerifiedFoods] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal State for Adding Meal
  const [showAddModal, setShowAddModal] = useState(false);
  const [mealCategory, setMealCategory] = useState("Breakfast");
  const [mealTime, setMealTime] = useState(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  });

  // Food Search & Selection
  const [foodSearchQuery, setFoodSearchQuery] = useState("");
  const [selectedFood, setSelectedFood] = useState(null);
  const [portionGrams, setPortionGrams] = useState(100);

  // Multi-item items in current composition
  const [pendingItems, setPendingItems] = useState([]);

  // Manual Custom Food Entry Toggle
  const [isCustomFood, setIsCustomFood] = useState(false);
  const [customFoodName, setCustomFoodName] = useState("");
  const [customCaloriesPer100g, setCustomCaloriesPer100g] = useState("");
  const [customProteinPer100g, setCustomProteinPer100g] = useState("");
  const [customCarbsPer100g, setCustomCarbsPer100g] = useState("");
  const [customFatPer100g, setCustomFatPer100g] = useState("");

  // Duplicate submission guard
  const [submitting, setSubmitting] = useState(false);

  // Category accordion expansion
  const [expandedCategories, setExpandedCategories] = useState({
    Breakfast: true,
    Lunch: true,
    Dinner: true,
    Snack: true
  });

  // Calorie & Macro Target Calculations
  const bmr = useMemo(() => {
    return calculateBmr({
      sex: userProfile?.sex || "male",
      weightKg: userProfile?.currentWeight || 75,
      heightCm: userProfile?.height || 178,
      ageYears: userProfile?.age || 27
    });
  }, [userProfile]);

  const tdee = useMemo(() => {
    return calculateTdee(
      bmr,
      userProfile?.activityLevel || 1.375,
      userProfile?.walkingDuration || 30,
      userProfile?.currentWeight || 75
    );
  }, [bmr, userProfile]);

  const targets = useMemo(() => {
    return calculateNutritionTargets(
      userProfile?.dailyCalorieTarget || tdee,
      userProfile?.fitnessGoal || "fat_loss",
      userProfile?.currentWeight || 75,
      userProfile?.dietaryPreference || "omnivore"
    );
  }, [tdee, userProfile]);

  // Load Verified Foods Database once
  useEffect(() => {
    let isMounted = true;
    async function loadFoods() {
      try {
        const foods = await getVerifiedFoods();
        if (isMounted) {
          setVerifiedFoods(foods || []);
          if (foods && foods.length > 0 && !selectedFood) {
            setSelectedFood(foods[0]);
            setPortionGrams(foods[0].defaultServingSize || 100);
          }
        }
      } catch (err) {
        console.error("Failed to load verified foods:", err);
      }
    }
    loadFoods();
    return () => { isMounted = false; };
  }, []);

  // Load food logs for selectedDate
  useEffect(() => {
    let isMounted = true;
    async function fetchLogs() {
      setLoading(true);
      try {
        const logs = await getFoodLogs(effectiveUserId, selectedDate);
        if (isMounted) {
          setFoodLogs(logs || []);
        }
      } catch (err) {
        console.error("Error loading food logs:", err);
        showToast("Load Error", "Could not load meals for selected date.", "warning");
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    fetchLogs();
    return () => { isMounted = false; };
  }, [effectiveUserId, selectedDate]);

  // Daily Totals Calculation
  const dailyTotals = useMemo(() => {
    return calculateDailyTotals(foodLogs);
  }, [foodLogs]);

  const calorieTarget = userProfile?.dailyCalorieTarget || targets.targetCalories || 2000;
  const remainingCalories = Math.max(0, calorieTarget - dailyTotals.calories);
  const caloriePercent = Math.min(100, Math.round((dailyTotals.calories / calorieTarget) * 100));

  // Filtered Food Search
  const filteredFoods = useMemo(() => {
    if (!foodSearchQuery.trim()) return verifiedFoods.slice(0, 15);
    const q = foodSearchQuery.toLowerCase();
    return verifiedFoods
      .filter((f) => {
        const name = (f?.foodName || f?.name || "").toLowerCase();
        const category = (f?.category || "").toLowerCase();
        const aliases = Array.isArray(f?.aliases) ? f.aliases : [];
        return (
          name.includes(q) ||
          category.includes(q) ||
          aliases.some((a) => String(a || "").toLowerCase().includes(q))
        );
      })
      .slice(0, 20);
  }, [foodSearchQuery, verifiedFoods]);

  // Calculated Portion Nutrition for Current Item in Modal
  const currentItemNutrition = useMemo(() => {
    if (isCustomFood) {
      const c100 = parseFloat(customCaloriesPer100g) || 0;
      const p100 = parseFloat(customProteinPer100g) || 0;
      const carb100 = parseFloat(customCarbsPer100g) || 0;
      const f100 = parseFloat(customFatPer100g) || 0;
      const factor = Math.max(0, parseFloat(portionGrams) || 0) / 100;
      return {
        calories: Math.round(c100 * factor),
        protein: Math.round(p100 * factor * 10) / 10,
        carbs: Math.round(carb100 * factor * 10) / 10,
        fat: Math.round(f100 * factor * 10) / 10,
        fibre: 0
      };
    }

    if (!selectedFood) return { calories: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 };
    return calculatePortionNutrition(selectedFood, portionGrams);
  }, [isCustomFood, customCaloriesPer100g, customProteinPer100g, customCarbsPer100g, customFatPer100g, selectedFood, portionGrams]);

  // Date Navigation
  const handleDateShift = (offsetDays) => {
    const [y, m, d] = selectedDate.split("-").map(Number);
    const dateObj = new Date(y, m - 1, d);
    dateObj.setDate(dateObj.getDate() + offsetDays);
    setSelectedDate(getLocalDateString(dateObj));
  };

  const isToday = selectedDate === getLocalDateString(new Date());

  // Category Toggle
  const toggleCategory = (cat) => {
    setExpandedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  // Open Add Meal Modal with pre-selected category
  const handleOpenAddModal = (cat = "Breakfast") => {
    setMealCategory(cat);
    setPendingItems([]);
    setIsCustomFood(false);
    setFoodSearchQuery("");
    setShowAddModal(true);
  };

  // Add currently configured food item to pending list or submit directly
  const handleAddPendingItem = () => {
    const qty = parseFloat(portionGrams);
    if (isNaN(qty) || qty <= 0) {
      showToast("Invalid Portion", "Please enter a positive portion weight in grams.", "warning");
      return;
    }

    let foodName = "";
    let foodId = null;

    if (isCustomFood) {
      if (!customFoodName.trim()) {
        showToast("Missing Name", "Please enter a name for the custom food.", "warning");
        return;
      }
      foodName = customFoodName.trim();
    } else {
      if (!selectedFood) {
        showToast("Select Food", "Please select a food item from the database.", "warning");
        return;
      }
      foodName = selectedFood.foodName || selectedFood.name || "Food Item";
      foodId = selectedFood.foodId;
    }

    const newItem = {
      tempId: `item_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      foodId,
      foodName,
      portionQuantity: Math.round(qty),
      calculatedCalories: currentItemNutrition.calories,
      protein: currentItemNutrition.protein,
      carbs: currentItemNutrition.carbs,
      fat: currentItemNutrition.fat,
      fibre: currentItemNutrition.fibre || 0
    };

    setPendingItems((prev) => [...prev, newItem]);
    // Reset selection for next item
    setFoodSearchQuery("");
    setCustomFoodName("");
    setCustomCaloriesPer100g("");
    setCustomProteinPer100g("");
    setCustomCarbsPer100g("");
    setCustomFatPer100g("");
    setIsCustomFood(false);
  };

  const handleRemovePendingItem = (tempId) => {
    setPendingItems((prev) => prev.filter((i) => i.tempId !== tempId));
  };

  // Save all pending items as meal logs
  const handleSaveMeal = async (e) => {
    if (e) e.preventDefault();
    if (submitting) return;

    // If no items in pending list, check if user has filled current form
    let itemsToSave = [...pendingItems];
    if (itemsToSave.length === 0) {
      const qty = parseFloat(portionGrams);
      if (qty > 0 && (selectedFood || (isCustomFood && customFoodName.trim()))) {
        const foodName = isCustomFood ? customFoodName.trim() : (selectedFood.foodName || selectedFood.name || "Food Item");
        itemsToSave.push({
          foodId: isCustomFood ? null : selectedFood.foodId,
          foodName,
          portionQuantity: Math.round(qty),
          calculatedCalories: currentItemNutrition.calories,
          protein: currentItemNutrition.protein,
          carbs: currentItemNutrition.carbs,
          fat: currentItemNutrition.fat,
          fibre: currentItemNutrition.fibre || 0
        });
      }
    }

    if (itemsToSave.length === 0) {
      showToast("No Food Added", "Please add at least one food item to this meal.", "warning");
      return;
    }

    setSubmitting(true);
    try {
      const savedList = [];
      for (const item of itemsToSave) {
        const record = await addFoodLog(effectiveUserId, {
          date: selectedDate,
          mealType: mealCategory,
          foodId: item.foodId,
          foodName: item.foodName,
          portionQuantity: item.portionQuantity,
          weightBasis: "raw",
          calculatedCalories: item.calculatedCalories,
          protein: item.protein,
          carbs: item.carbs,
          fat: item.fat,
          fibre: item.fibre || 0
        });
        savedList.push(record);
      }

      setFoodLogs((prev) => [...savedList, ...prev]);
      showToast(
        "Meal Saved!",
        `Added ${itemsToSave.length} item(s) to ${mealCategory} (${itemsToSave.reduce((a, b) => a + b.calculatedCalories, 0)} kcal).`,
        "success"
      );
      setShowAddModal(false);
      setPendingItems([]);
    } catch (err) {
      console.error("Save meal error:", err);
      showToast("Save Error", err?.message || "Could not save meal.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Delete individual food log item
  const handleDeleteLog = async (logId, name) => {
    if (!confirm(`Remove "${name}" from ${selectedDate}?`)) return;

    try {
      await deleteFoodLog(logId);
      setFoodLogs((prev) => prev.filter((l) => l.logId !== logId));
      showToast("Item Removed", `Deleted ${name}. Daily totals updated.`, "info");
    } catch (err) {
      console.error("Delete food log error:", err);
      showToast("Delete Failed", err?.message || "Could not delete food log.", "error");
    }
  };

  // Group logs by Category
  const logsByCategory = useMemo(() => {
    const map = {
      Breakfast: [],
      Lunch: [],
      Dinner: [],
      Snack: []
    };
    foodLogs.forEach((log) => {
      const cat = log.mealType || "Snack";
      if (map[cat]) {
        map[cat].push(log);
      } else {
        map.Snack.push(log);
      }
    });
    return map;
  }, [foodLogs]);

  const categories = [
    { id: "Breakfast", label: "Breakfast", icon: Coffee, color: "#f97316" },
    { id: "Lunch", label: "Lunch", icon: Sun, color: "#06b6d4" },
    { id: "Dinner", label: "Dinner", icon: Moon, color: "#8b5cf6" },
    { id: "Snack", label: "Snacks", icon: Apple, color: "#10b981" }
  ];

  return (
    <div className="cmf-health-tab-container">
      {/* 1. Date Selector Navigation Bar */}
      <section className="cmf-date-nav-bar">
        <button
          type="button"
          onClick={() => handleDateShift(-1)}
          className="cmf-date-arrow-btn"
          aria-label="Previous day"
        >
          <ChevronLeft size={18} />
        </button>

        <div className="cmf-date-display-wrap">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="cmf-date-picker-hidden"
            id="health-date-picker"
          />
          <label htmlFor="health-date-picker" className="cmf-date-label-clickable">
            <Calendar size={14} className="text-muted" />
            <span className="cmf-date-text">
              {isToday ? "Today" : new Date(selectedDate).toLocaleDateString("en-US", { month: "short", day: "numeric", weekday: "short" })}
            </span>
            <span className="cmf-date-sub">{selectedDate}</span>
          </label>
        </div>

        <button
          type="button"
          onClick={() => handleDateShift(1)}
          className="cmf-date-arrow-btn"
          aria-label="Next day"
        >
          <ChevronRight size={18} />
        </button>
      </section>

      {/* 2. CMF "Today's activities" Style Nutrition Summary Card */}
      <section className="cmf-card cmf-nutrition-hero-card">
        <div className="cmf-card-header-row">
          <div className="cmf-card-title-group">
            <Flame size={16} className="text-coral" />
            <h3 className="cmf-card-title">Daily Nutrition</h3>
          </div>
          <span className="cmf-card-badge">
            {caloriePercent}% Goal
          </span>
        </div>

        {/* Stadium multi-track progress for nutrition: Calories (Red), Protein (Purple), Carbs (Amber), Fat (Blue) */}
        <div className="cmf-nutrition-rings-row">
          <div className="cmf-cals-big-group">
            <span className="cmf-cals-big-number">{dailyTotals.calories.toLocaleString()}</span>
            <span className="cmf-cals-big-unit">kcal consumed</span>
            <div className="cmf-cals-target-sub">
              Target: <strong>{calorieTarget.toLocaleString()} kcal</strong> • <span>{remainingCalories.toLocaleString()} left</span>
            </div>
          </div>

          <div className="cmf-cals-mini-gauge-wrap">
            <svg width="76" height="76" viewBox="0 0 76 76" className="cmf-cals-svg">
              <circle cx="38" cy="38" r="32" fill="none" stroke="#27272a" strokeWidth="8" />
              <circle
                cx="38"
                cy="38"
                r="32"
                fill="none"
                stroke="#ff3b30"
                strokeWidth="8"
                strokeDasharray="201"
                strokeDashoffset={201 - (caloriePercent / 100) * 201}
                strokeLinecap="round"
                transform="rotate(-90 38 38)"
              />
            </svg>
            <div className="cmf-gauge-center-text">
              {caloriePercent}%
            </div>
          </div>
        </div>

        {/* 3 Macro Progress Bars matching CMF minimalist design */}
        <div className="cmf-macro-bars-grid">
          {/* Protein */}
          <div className="cmf-macro-bar-card">
            <div className="cmf-macro-bar-header">
              <span className="cmf-macro-name text-purple">Protein</span>
              <span className="cmf-macro-value">
                <strong>{Math.round(dailyTotals.protein)}g</strong> / {targets.proteinGrams}g
              </span>
            </div>
            <div className="cmf-macro-track">
              <div
                className="cmf-macro-fill fill-purple"
                style={{ width: `${Math.min(100, (dailyTotals.protein / Math.max(1, targets.proteinGrams)) * 100)}%` }}
              />
            </div>
          </div>

          {/* Carbs */}
          <div className="cmf-macro-bar-card">
            <div className="cmf-macro-bar-header">
              <span className="cmf-macro-name text-amber">Carbs</span>
              <span className="cmf-macro-value">
                <strong>{Math.round(dailyTotals.carbs)}g</strong> / {targets.carbGrams}g
              </span>
            </div>
            <div className="cmf-macro-track">
              <div
                className="cmf-macro-fill fill-amber"
                style={{ width: `${Math.min(100, (dailyTotals.carbs / Math.max(1, targets.carbGrams)) * 100)}%` }}
              />
            </div>
          </div>

          {/* Fat */}
          <div className="cmf-macro-bar-card">
            <div className="cmf-macro-bar-header">
              <span className="cmf-macro-name text-blue">Fat</span>
              <span className="cmf-macro-value">
                <strong>{Math.round(dailyTotals.fat)}g</strong> / {targets.fatGrams}g
              </span>
            </div>
            <div className="cmf-macro-track">
              <div
                className="cmf-macro-fill fill-blue"
                style={{ width: `${Math.min(100, (dailyTotals.fat / Math.max(1, targets.fatGrams)) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* 3. Prominent Add Meal Action Button */}
      <section className="cmf-add-meal-banner">
        <button
          type="button"
          onClick={() => handleOpenAddModal("Breakfast")}
          className="cmf-btn-primary cmf-btn-large"
        >
          <Plus size={18} />
          <span>Add Meal / Food</span>
        </button>
      </section>

      {/* 4. Meal Categories Accordion List */}
      <section className="cmf-meals-list-section">
        {categories.map((cat) => {
          const CatIcon = cat.icon;
          const items = logsByCategory[cat.id] || [];
          const catTotals = calculateMealTotals(items);
          const isExpanded = expandedCategories[cat.id];

          return (
            <div key={cat.id} className="cmf-card cmf-meal-category-card">
              <div
                className="cmf-meal-card-header"
                onClick={() => toggleCategory(cat.id)}
              >
                <div className="cmf-meal-header-left">
                  <div className="cmf-category-icon-box" style={{ background: `${cat.color}20`, color: cat.color }}>
                    <CatIcon size={16} />
                  </div>
                  <div className="cmf-category-info">
                    <h4 className="cmf-category-title">{cat.label}</h4>
                    <span className="cmf-category-count">
                      {items.length === 0 ? "No foods logged" : `${items.length} item${items.length === 1 ? "" : "s"}`}
                    </span>
                  </div>
                </div>

                <div className="cmf-meal-header-right">
                  <span className="cmf-category-cals">
                    <strong>{catTotals.calories}</strong> <small>kcal</small>
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenAddModal(cat.id);
                    }}
                    className="cmf-category-add-btn"
                    title={`Add food to ${cat.label}`}
                    aria-label={`Add to ${cat.label}`}
                  >
                    <Plus size={14} />
                  </button>
                  <button type="button" className="cmf-category-chevron-btn" aria-label="Toggle">
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="cmf-meal-card-body">
                  {items.length === 0 ? (
                    <div className="cmf-empty-meal-state">
                      <span>No items recorded for {cat.label} yet.</span>
                      <button
                        type="button"
                        onClick={() => handleOpenAddModal(cat.id)}
                        className="cmf-btn-subtle"
                      >
                        + Log {cat.label}
                      </button>
                    </div>
                  ) : (
                    <div className="cmf-food-items-list">
                      {items.map((item) => (
                        <div key={item.logId} className="cmf-food-item-row">
                          <div className="cmf-food-item-left">
                            <span className="cmf-food-item-name">{item.foodName}</span>
                            <span className="cmf-food-item-meta">
                              {item.portionQuantity}g • P: {item.protein}g • C: {item.carbs}g • F: {item.fat}g
                            </span>
                          </div>
                          <div className="cmf-food-item-right">
                            <span className="cmf-food-item-cals">
                              {item.calculatedCalories} kcal
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDeleteLog(item.logId, item.foodName)}
                              className="cmf-item-delete-btn"
                              title="Delete food entry"
                              aria-label={`Delete ${item.foodName}`}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      ))}

                      {/* Meal category subtotal summary */}
                      <div className="cmf-meal-subtotal-row">
                        <span>{cat.label} Subtotal:</span>
                        <span>
                          <strong>{catTotals.calories} kcal</strong> (P: {catTotals.protein}g • C: {catTotals.carbs}g • F: {catTotals.fat}g)
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* 5. ADD MEAL / FOOD MODAL */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="cmf-modal-card cmf-add-meal-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cmf-modal-header">
              <div className="cmf-modal-title-row">
                <Utensils size={18} className="text-coral" />
                <h3 className="cmf-modal-title">Add Food to {mealCategory}</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="cmf-close-btn"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="cmf-modal-body">
              {/* Category Switcher in Modal */}
              <div className="cmf-category-pills-row">
                {categories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setMealCategory(c.id)}
                    className={`cmf-pill-btn ${mealCategory === c.id ? "active" : ""}`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              {/* Mode Toggle: Database Food vs Manual Entry */}
              <div className="cmf-mode-toggle-row">
                <button
                  type="button"
                  onClick={() => setIsCustomFood(false)}
                  className={`cmf-toggle-tab ${!isCustomFood ? "active" : ""}`}
                >
                  Search Database
                </button>
                <button
                  type="button"
                  onClick={() => setIsCustomFood(true)}
                  className={`cmf-toggle-tab ${isCustomFood ? "active" : ""}`}
                >
                  Manual / Custom Food
                </button>
              </div>

              {!isCustomFood ? (
                /* Search Verified Foods */
                <div className="cmf-food-search-box">
                  <div className="cmf-search-input-wrap">
                    <Search size={15} className="cmf-search-icon" />
                    <input
                      type="text"
                      value={foodSearchQuery}
                      onChange={(e) => setFoodSearchQuery(e.target.value)}
                      placeholder="Search chicken, rice, eggs, oats, apple..."
                      className="cmf-input cmf-search-input"
                    />
                  </div>

                  <div className="cmf-foods-dropdown-list">
                    {filteredFoods.map((f) => (
                      <div
                        key={f.foodId}
                        onClick={() => {
                          setSelectedFood(f);
                          setPortionGrams(f.defaultServingSize || 100);
                        }}
                        className={`cmf-food-select-item ${selectedFood?.foodId === f.foodId ? "selected" : ""}`}
                      >
                        <div className="cmf-food-select-info">
                          <span className="cmf-food-select-name">{f.foodName || f.name || "Food Item"}</span>
                          <span className="cmf-food-select-sub">
                            {f.category} • {f.caloriesPer100g} kcal/100g (P: {f.proteinPer100g}g, C: {f.carbsPer100g}g, F: {f.fatPer100g}g)
                          </span>
                        </div>
                        {selectedFood?.foodId === f.foodId && (
                          <Check size={16} className="text-coral" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                /* Manual Food Entry Form */
                <div className="cmf-custom-food-form">
                  <div className="cmf-input-group">
                    <label className="cmf-label">Food Name *</label>
                    <input
                      type="text"
                      value={customFoodName}
                      onChange={(e) => setCustomFoodName(e.target.value)}
                      placeholder="e.g. Grandma's Lentil Soup"
                      className="cmf-input"
                    />
                  </div>

                  <div className="cmf-input-grid-2">
                    <div className="cmf-input-group">
                      <label className="cmf-label">Calories per 100g (kcal)</label>
                      <input
                        type="number"
                        value={customCaloriesPer100g}
                        onChange={(e) => setCustomCaloriesPer100g(e.target.value)}
                        placeholder="e.g. 150"
                        className="cmf-input"
                        min="0"
                      />
                    </div>
                    <div className="cmf-input-group">
                      <label className="cmf-label">Protein per 100g (g)</label>
                      <input
                        type="number"
                        value={customProteinPer100g}
                        onChange={(e) => setCustomProteinPer100g(e.target.value)}
                        placeholder="e.g. 12"
                        className="cmf-input"
                        min="0"
                        step="0.1"
                      />
                    </div>
                  </div>

                  <div className="cmf-input-grid-2">
                    <div className="cmf-input-group">
                      <label className="cmf-label">Carbs per 100g (g)</label>
                      <input
                        type="number"
                        value={customCarbsPer100g}
                        onChange={(e) => setCustomCarbsPer100g(e.target.value)}
                        placeholder="e.g. 20"
                        className="cmf-input"
                        min="0"
                        step="0.1"
                      />
                    </div>
                    <div className="cmf-input-group">
                      <label className="cmf-label">Fat per 100g (g)</label>
                      <input
                        type="number"
                        value={customFatPer100g}
                        onChange={(e) => setCustomFatPer100g(e.target.value)}
                        placeholder="e.g. 4"
                        className="cmf-input"
                        min="0"
                        step="0.1"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Portion Weight Input */}
              <div className="cmf-portion-weight-card">
                <div className="cmf-portion-row">
                  <div className="cmf-portion-left">
                    <label className="cmf-label">Serving Size (Grams)</label>
                    <div className="cmf-portion-input-wrap">
                      <input
                        type="number"
                        value={portionGrams}
                        onChange={(e) => setPortionGrams(Math.max(1, parseFloat(e.target.value) || 0))}
                        className="cmf-input cmf-portion-input"
                        min="1"
                        max="2000"
                      />
                      <span className="cmf-unit-addon">grams</span>
                    </div>
                  </div>

                  {/* Quick gram pills */}
                  <div className="cmf-portion-pills">
                    {[50, 100, 150, 200, 250].map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setPortionGrams(g)}
                        className={`cmf-gram-pill ${portionGrams === g ? "active" : ""}`}
                      >
                        {g}g
                      </button>
                    ))}
                  </div>
                </div>

                {/* Auto Calculated Live Preview */}
                <div className="cmf-auto-calc-preview">
                  <span className="cmf-calc-preview-title">Calculated for {portionGrams}g:</span>
                  <div className="cmf-calc-preview-stats">
                    <span className="cmf-calc-badge cmf-badge-cals">
                      {currentItemNutrition.calories} kcal
                    </span>
                    <span className="cmf-calc-badge cmf-badge-p">
                      P: {currentItemNutrition.protein}g
                    </span>
                    <span className="cmf-calc-badge cmf-badge-c">
                      C: {currentItemNutrition.carbs}g
                    </span>
                    <span className="cmf-calc-badge cmf-badge-f">
                      F: {currentItemNutrition.fat}g
                    </span>
                  </div>
                </div>
              </div>

              {/* Multi-Item Pending List */}
              {pendingItems.length > 0 && (
                <div className="cmf-pending-items-box">
                  <span className="cmf-pending-title">Items ready in this meal ({pendingItems.length}):</span>
                  {pendingItems.map((p) => (
                    <div key={p.tempId} className="cmf-pending-item-chip">
                      <span>{p.foodName} ({p.portionQuantity}g) • {p.calculatedCalories} kcal</span>
                      <button
                        type="button"
                        onClick={() => handleRemovePendingItem(p.tempId)}
                        className="cmf-chip-delete"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Action Buttons in Modal */}
              <div className="cmf-modal-actions-stacked">
                <button
                  type="button"
                  onClick={handleAddPendingItem}
                  className="cmf-btn-secondary"
                  title="Add another food item to this same meal"
                >
                  <Plus size={15} />
                  <span>+ Add Another Food to this Meal</span>
                </button>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleSaveMeal}
                  className="cmf-btn-primary cmf-btn-large"
                >
                  <span>
                    {submitting
                      ? "Saving Meal..."
                      : pendingItems.length > 0
                      ? `Save Meal (${pendingItems.reduce((a, b) => a + b.calculatedCalories, 0) + (selectedFood ? currentItemNutrition.calories : 0)} kcal)`
                      : `Save ${currentItemNutrition.calories} kcal to ${mealCategory}`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
