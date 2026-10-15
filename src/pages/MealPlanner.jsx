import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import {
  getMealPlans,
  saveMealPlan,
  deleteMealPlan,
  getVerifiedFoods,
  syncAggregatedMealPlanShoppingList
} from "../services/dbService";
import {
  calculatePortionNutrition,
  calculateMealTotals,
  aggregateShoppingList
} from "../utils/nutritionCalculators";
import EmptyState from "../components/EmptyState";
import {
  Plus,
  Trash2,
  ShoppingCart,
  Save,
  CheckCircle,
  Calendar,
  Layers,
  Sparkles,
  ArrowRight
} from "lucide-react";
import { Link } from "react-router-dom";

export default function MealPlanner() {
  const { currentUser, userProfile } = useAuth();
  const { showToast } = useToast();

  const [verifiedFoods, setVerifiedFoods] = useState([]);
  const [savedPlans, setSavedPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  // Active Plan Builder State
  const [activePlanId, setActivePlanId] = useState("active_meal_plan");
  const [planName, setPlanName] = useState("Balanced Day Plan");
  const [dailyCalorieTarget, setDailyCalorieTarget] = useState(2200);
  const [proteinTarget, setProteinTarget] = useState(150);
  const [carbsTarget, setCarbsTarget] = useState(220);
  const [fatTarget, setFatTarget] = useState(65);
  const [fibreTarget, setFibreTarget] = useState(30);

  // Meals array
  const [meals, setMeals] = useState([
    {
      id: "meal_1",
      name: "Breakfast",
      items: [
        {
          id: "item_1_1",
          foodId: "food_rolled_oats_dry",
          foodName: "Whole Rolled Oats",
          portionGrams: 70,
          category: "Grains"
        },
        {
          id: "item_1_2",
          foodId: "food_whey_isolate_dry",
          foodName: "Whey Protein Isolate Powder",
          portionGrams: 30,
          category: "Supplements"
        }
      ]
    },
    {
      id: "meal_2",
      name: "Lunch",
      items: [
        {
          id: "item_2_1",
          foodId: "food_chicken_breast_raw",
          foodName: "Chicken Breast (Boneless, Skinless)",
          portionGrams: 180,
          category: "Poultry"
        },
        {
          id: "item_2_2",
          foodId: "food_sweet_potato_raw",
          foodName: "Sweet Potato (Raw, Skin On)",
          portionGrams: 200,
          category: "Tubers"
        }
      ]
    }
  ]);

  useEffect(() => {
    async function init() {
      if (!currentUser?.uid) return;
      try {
        const [foods, plans] = await Promise.all([
          getVerifiedFoods(),
          getMealPlans(currentUser.uid)
        ]);
        setVerifiedFoods(foods);
        setSavedPlans(plans);
      } catch (err) {
        console.error("Meal planner init error:", err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [currentUser]);

  // Add Meal Section
  const addMealSection = () => {
    const newId = `meal_${Date.now()}`;
    setMeals((prev) => [
      ...prev,
      { id: newId, name: `Meal ${prev.length + 1}`, items: [] }
    ]);
  };

  // Add Item to a Meal
  const addItemToMeal = (mealId) => {
    if (verifiedFoods.length === 0) return;
    const defaultFood = verifiedFoods[0];
    const newItem = {
      id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      foodId: defaultFood.foodId,
      foodName: defaultFood.foodName,
      portionGrams: defaultFood.defaultServingSize || 100,
      category: defaultFood.category
    };

    setMeals((prev) =>
      prev.map((m) =>
        m.id === mealId ? { ...m, items: [...m.items, newItem] } : m
      )
    );
  };

  // Update item in a meal
  const updateMealItem = (mealId, itemId, field, value) => {
    setMeals((prev) =>
      prev.map((m) => {
        if (m.id !== mealId) return m;
        return {
          ...m,
          items: m.items.map((it) => {
            if (it.id !== itemId) return it;
            if (field === "foodId") {
              const selectedFood = verifiedFoods.find((f) => f.foodId === value);
              return {
                ...it,
                foodId: value,
                foodName: selectedFood ? selectedFood.foodName : it.foodName,
                category: selectedFood ? selectedFood.category : it.category
              };
            }
            return { ...it, [field]: value };
          })
        };
      })
    );
  };

  // Remove Item
  const removeMealItem = (mealId, itemId) => {
    setMeals((prev) =>
      prev.map((m) =>
        m.id === mealId
          ? { ...m, items: m.items.filter((it) => it.id !== itemId) }
          : m
      )
    );
  };

  // Calculate totals for all meals
  const calculatePlanTotals = () => {
    let totals = { calories: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 };

    meals.forEach((meal) => {
      meal.items.forEach((item) => {
        const food = verifiedFoods.find((f) => f.foodId === item.foodId);
        if (food) {
          const nut = calculatePortionNutrition(food, item.portionGrams);
          totals.calories += nut.calories;
          totals.protein += nut.protein;
          totals.carbs += nut.carbs;
          totals.fat += nut.fat;
          totals.fibre += nut.fibre;
        }
      });
    });

    return {
      calories: Math.round(totals.calories),
      protein: Math.round(totals.protein * 10) / 10,
      carbs: Math.round(totals.carbs * 10) / 10,
      fat: Math.round(totals.fat * 10) / 10,
      fibre: Math.round(totals.fibre * 10) / 10
    };
  };

  const planTotals = calculatePlanTotals();

  // Save Meal Plan
  const handleSavePlan = async () => {
    if (!currentUser?.uid) return;

    try {
      const saved = await saveMealPlan(currentUser.uid, {
        planId: activePlanId !== "active_meal_plan" ? activePlanId : undefined,
        planName,
        dailyCalorieTarget,
        proteinTarget,
        carbohydrateTarget: carbsTarget,
        fatTarget,
        fibreTarget,
        meals,
        calculatedTotals: planTotals
      });

      setActivePlanId(saved.planId);
      setSavedPlans((prev) => [
        saved,
        ...prev.filter((p) => p.planId !== saved.planId)
      ]);
      showToast("Meal Plan Saved!", `"${planName}" stored in your plans.`, "success");
    } catch (err) {
      console.error("Save plan error:", err);
      showToast("Save Failed", "Could not save meal plan.", "warning");
    }
  };

  // Generate Shopping List
  const handleGenerateShoppingList = async () => {
    if (!currentUser?.uid) return;
    const aggregated = aggregateShoppingList(meals);
    if (aggregated.length === 0) {
      showToast("Empty Plan", "Add items to your meal plan first.", "warning");
      return;
    }

    try {
      await syncAggregatedMealPlanShoppingList(
        currentUser.uid,
        activePlanId || "active_meal_plan",
        aggregated
      );
      showToast(
        "Shopping List Created!",
        `Aggregated ${aggregated.length} ingredients into your shopping list.`,
        "success"
      );
    } catch (err) {
      console.error("Shopping list sync error:", err);
    }
  };

  // Load a saved plan into editor
  const handleLoadPlan = (sp) => {
    setActivePlanId(sp.planId);
    setPlanName(sp.planName || "Saved Plan");
    setDailyCalorieTarget(sp.dailyCalorieTarget || 2000);
    setProteinTarget(sp.proteinTarget || 140);
    setCarbsTarget(sp.carbohydrateTarget || 200);
    setFatTarget(sp.fatTarget || 65);
    setFibreTarget(sp.fibreTarget || 30);
    if (sp.meals && sp.meals.length > 0) {
      setMeals(sp.meals);
    }
    showToast("Plan Loaded", `Loaded "${sp.planName}".`, "info");
  };

  // Delete saved plan
  const handleDeletePlan = async (planId) => {
    try {
      await deleteMealPlan(planId);
      setSavedPlans((prev) => prev.filter((p) => p.planId !== planId));
      showToast("Plan Deleted", "Meal plan removed.", "info");
    } catch (err) {
      console.error("Delete plan error:", err);
    }
  };

  return (
    <div className="meal-planner-page">
      {/* Header Strip */}
      <section className="meal-planner-hero glass-card">
        <div className="hero-text-block">
          <h2>
            Meal Planner &amp; <span className="text-emerald">Recipe Engine</span>
          </h2>
          <p>
            Build comprehensive nutrition plans matching your exact macro
            targets and automatically generate consolidated grocery lists.
          </p>
        </div>
        <div className="hero-actions">
          <button onClick={handleSavePlan} className="primary-btn glow-btn">
            <Save size={18} />
            <span>Save Meal Plan</span>
          </button>
          <button
            onClick={handleGenerateShoppingList}
            className="glass-btn secondary-btn"
          >
            <ShoppingCart size={18} />
            <span>Generate Shopping List</span>
          </button>
        </div>
      </section>

      {/* Plan Builder Grid */}
      <div className="meal-planner-grid">
        {/* Left Section: Plan Name & Targets & Live Nutrition Bar */}
        <div className="builder-left-col">
          <div className="glass-card plan-meta-card">
            <h3 className="card-title">Plan Configuration</h3>
            <div className="input-group">
              <label>Meal Plan Name</label>
              <input
                type="text"
                value={planName}
                onChange={(e) => setPlanName(e.target.value)}
                placeholder="e.g. Clean Bulking Phase"
              />
            </div>

            <div className="form-row-two mt-2">
              <div className="input-group">
                <label>Calorie Target</label>
                <input
                  type="number"
                  value={dailyCalorieTarget}
                  onChange={(e) => setDailyCalorieTarget(e.target.value)}
                />
              </div>
              <div className="input-group">
                <label>Protein Target (g)</label>
                <input
                  type="number"
                  value={proteinTarget}
                  onChange={(e) => setProteinTarget(e.target.value)}
                />
              </div>
            </div>

            {/* Live Planned Nutrition vs Target Summary Box */}
            <div className="plan-nutrition-gauge-box">
              <div className="gauge-header">
                <Sparkles size={16} className="text-emerald" />
                <span>Planned Nutrition vs Targets:</span>
              </div>
              <div className="gauge-row">
                <div className="gauge-item">
                  <span className="gauge-val text-emerald font-bold">
                    {planTotals.calories} / {dailyCalorieTarget} kcal
                  </span>
                  <span className="gauge-lbl">Calories</span>
                </div>
                <div className="gauge-item">
                  <span className="gauge-val text-coral font-bold">
                    {planTotals.protein}g / {proteinTarget}g
                  </span>
                  <span className="gauge-lbl">Protein</span>
                </div>
                <div className="gauge-item">
                  <span className="gauge-val text-cyan font-bold">
                    {planTotals.carbs}g / {carbsTarget}g
                  </span>
                  <span className="gauge-lbl">Carbs</span>
                </div>
                <div className="gauge-item">
                  <span className="gauge-val text-amber font-bold">
                    {planTotals.fat}g / {fatTarget}g
                  </span>
                  <span className="gauge-lbl">Fats</span>
                </div>
              </div>
            </div>
          </div>

          {/* Saved Plans List */}
          <div className="glass-card saved-plans-card">
            <h3 className="card-title">Saved Plans ({savedPlans.length})</h3>
            {savedPlans.length === 0 ? (
              <p className="text-muted text-sm mt-2">
                No saved meal plans yet. Create one above and click "Save Meal Plan".
              </p>
            ) : (
              <ul className="saved-plans-list">
                {savedPlans.map((sp) => (
                  <li key={sp.planId} className="saved-plan-item">
                    <div onClick={() => handleLoadPlan(sp)} style={{ cursor: "pointer", flex: 1 }}>
                      <span className="font-semibold">{sp.planName}</span>
                      <span className="plan-meta-sub">
                        {sp.calculatedTotals?.calories || sp.dailyCalorieTarget} kcal •{" "}
                        {sp.meals?.length || 0} meals
                      </span>
                    </div>
                    <button
                      onClick={() => handleDeletePlan(sp.planId)}
                      className="delete-entry-btn"
                      title="Delete Plan"
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Right Section: Meals & Ingredients Builder */}
        <div className="builder-right-col">
          <div className="meals-builder-header">
            <h3>Meals &amp; Portions</h3>
            <button onClick={addMealSection} className="glass-btn btn-sm">
              <Plus size={16} />
              <span>Add Meal Section</span>
            </button>
          </div>

          <div className="meals-stack">
            {meals.map((meal) => (
              <div key={meal.id} className="glass-card meal-builder-card">
                <div className="meal-builder-header">
                  <input
                    type="text"
                    value={meal.name}
                    onChange={(e) =>
                      setMeals((prev) =>
                        prev.map((m) =>
                          m.id === meal.id ? { ...m, name: e.target.value } : m
                        )
                      )
                    }
                    className="meal-name-inline-input"
                  />
                  <button
                    onClick={() => addItemToMeal(meal.id)}
                    className="primary-btn btn-sm"
                  >
                    <Plus size={14} />
                    <span>Add Food</span>
                  </button>
                </div>

                {meal.items.length === 0 ? (
                  <p className="text-muted text-sm p-3">
                    No items in this meal yet. Click "+ Add Food" to add ingredients.
                  </p>
                ) : (
                  <ul className="meal-builder-items-list">
                    {meal.items.map((item) => {
                      const food = verifiedFoods.find(
                        (f) => f.foodId === item.foodId
                      );
                      const nut = food
                        ? calculatePortionNutrition(food, item.portionGrams)
                        : null;

                      return (
                        <li key={item.id} className="builder-item-row">
                          <div className="select-food-wrap flex-2">
                            <select
                              value={item.foodId}
                              onChange={(e) =>
                                updateMealItem(
                                  meal.id,
                                  item.id,
                                  "foodId",
                                  e.target.value
                                )
                              }
                            >
                              {verifiedFoods.map((vf) => (
                                <option key={vf.foodId} value={vf.foodId}>
                                  {vf.foodName} ({vf.caloriesPer100g} kcal/100g)
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="portion-wrap flex-1">
                            <input
                              type="number"
                              min="1"
                              max="2000"
                              value={item.portionGrams}
                              onChange={(e) =>
                                updateMealItem(
                                  meal.id,
                                  item.id,
                                  "portionGrams",
                                  e.target.value
                                )
                              }
                            />
                            <span className="unit-label">g</span>
                          </div>

                          {nut && (
                            <div className="item-live-nut-preview">
                              <span className="cal-chip">+{nut.calories} kcal</span>
                              <span className="p-chip">P:{nut.protein}g</span>
                            </div>
                          )}

                          <button
                            onClick={() => removeMealItem(meal.id, item.id)}
                            className="delete-entry-btn"
                            title="Remove Item"
                          >
                            <Trash2 size={14} />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
