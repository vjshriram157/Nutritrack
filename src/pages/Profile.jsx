import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { saveUserProfile } from "../services/dbService";
import {
  calculateBmr,
  calculateTdee,
  calculateNutritionTargets
} from "../utils/nutritionCalculators";
import {
  User,
  Scale,
  Activity,
  Heart,
  Save,
  ShieldCheck,
  Sparkles,
  Info,
  HelpCircle,
  MoreHorizontal,
  RotateCcw
} from "lucide-react";

export default function Profile() {
  const { currentUser, userProfile, setUserProfile, refreshProfile } = useAuth();
  const { showToast } = useToast();

  const [age, setAge] = useState(userProfile?.age || 27);
  const [sex, setSex] = useState(userProfile?.sex || "male");
  const [height, setHeight] = useState(userProfile?.height || 178);
  const [currentWeight, setCurrentWeight] = useState(
    userProfile?.currentWeight || 75
  );
  const [targetWeight, setTargetWeight] = useState(
    userProfile?.targetWeight || 72
  );
  const [fitnessGoal, setFitnessGoal] = useState(
    userProfile?.fitnessGoal || "fat_loss"
  );
  const [activityLevel, setActivityLevel] = useState(
    userProfile?.activityLevel || 1.375
  );
  const [walkingDuration, setWalkingDuration] = useState(
    userProfile?.walkingDuration || 35
  );
  const [dietaryPreference, setDietaryPreference] = useState(
    userProfile?.dietaryPreference || "omnivore"
  );
  const [preferredNumberOfMeals, setPreferredNumberOfMeals] = useState(
    userProfile?.preferredNumberOfMeals || 3
  );

  // Reference Image 2: Macro Target Mode & Ratios
  const [targetMode, setTargetMode] = useState("ratios"); // "ratios" | "fixed" | "keto"
  const [proteinPercent, setProteinPercent] = useState(25);
  const [carbsPercent, setCarbsPercent] = useState(45);
  const [fatPercent, setFatPercent] = useState(30);
  const [showResetMenu, setShowResetMenu] = useState(false);

  // Allergies & Avoidances
  const [selectedAllergies, setSelectedAllergies] = useState(
    userProfile?.allergiesAndIntolerances || []
  );
  const [foodsAvoidedText, setFoodsAvoidedText] = useState(
    (userProfile?.foodsAvoided || []).join(", ")
  );

  const allergyOptions = [
    "Dairy / Lactose",
    "Peanuts / Tree Nuts",
    "Gluten / Wheat",
    "Shellfish & Fish",
    "Eggs",
    "Soy"
  ];

  // Sync when userProfile updates
  useEffect(() => {
    if (userProfile) {
      setAge(userProfile.age || 27);
      setSex(userProfile.sex || "male");
      setHeight(userProfile.height || 178);
      setCurrentWeight(userProfile.currentWeight || 75);
      setTargetWeight(userProfile.targetWeight || 72);
      setFitnessGoal(userProfile.fitnessGoal || "fat_loss");
      setActivityLevel(userProfile.activityLevel || 1.375);
      setWalkingDuration(userProfile.walkingDuration || 35);
      setDietaryPreference(userProfile.dietaryPreference || "omnivore");
      setPreferredNumberOfMeals(userProfile.preferredNumberOfMeals || 3);
      setSelectedAllergies(userProfile.allergiesAndIntolerances || []);
      setFoodsAvoidedText((userProfile.foodsAvoided || []).join(", "));
    }
  }, [userProfile]);

  // Live Reactive Calculations
  const liveBmr = calculateBmr({
    sex,
    weightKg: currentWeight,
    heightCm: height,
    ageYears: age
  });

  const liveTdee = calculateTdee(
    liveBmr,
    activityLevel,
    walkingDuration,
    currentWeight
  );

  const liveTargets = calculateNutritionTargets(
    liveTdee,
    fitnessGoal,
    currentWeight,
    dietaryPreference
  );

  const totalCalories = liveTargets.dailyCalorieTarget || 2000;

  // Computed grams and calories based on active ratio percentages (Image 2)
  const computedProteinKcal = Math.round(totalCalories * (proteinPercent / 100));
  const computedProteinGrams = Math.round(computedProteinKcal / 4);

  const computedCarbsKcal = Math.round(totalCalories * (carbsPercent / 100));
  const computedCarbsGrams = Math.round(computedCarbsKcal / 4);

  const computedFatKcal = Math.round(totalCalories * (fatPercent / 100));
  const computedFatGrams = Math.round(computedFatKcal / 9);

  const totalPercent = proteinPercent + carbsPercent + fatPercent;

  const toggleAllergy = (allergy) => {
    setSelectedAllergies((prev) =>
      prev.includes(allergy)
        ? prev.filter((a) => a !== allergy)
        : [...prev, allergy]
    );
  };

  const handleResetDefaults = () => {
    setAge(27);
    setSex("male");
    setHeight(178);
    setCurrentWeight(75);
    setTargetWeight(72);
    setFitnessGoal("fat_loss");
    setActivityLevel(1.375);
    setWalkingDuration(35);
    setDietaryPreference("omnivore");
    setPreferredNumberOfMeals(3);
    setTargetMode("ratios");
    setProteinPercent(25);
    setCarbsPercent(45);
    setFatPercent(30);
    setSelectedAllergies([]);
    setFoodsAvoidedText("");
    setShowResetMenu(false);
    showToast("Defaults Restored", "All profile sections reset to standard baseline.", "info");
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!currentUser?.uid) return;

    const foodsAvoided = foodsAvoidedText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      const updated = await saveUserProfile(currentUser.uid, {
        age: parseInt(age, 10),
        sex,
        height: parseFloat(height),
        currentWeight: parseFloat(currentWeight),
        targetWeight: parseFloat(targetWeight),
        fitnessGoal,
        activityLevel: parseFloat(activityLevel),
        walkingDuration: parseInt(walkingDuration, 10),
        dietaryPreference,
        allergiesAndIntolerances: selectedAllergies,
        foodsAvoided,
        preferredNumberOfMeals: parseInt(preferredNumberOfMeals, 10),
        customMacros: {
          proteinPercent,
          carbsPercent,
          fatPercent,
          proteinGrams: computedProteinGrams,
          carbsGrams: computedCarbsGrams,
          fatGrams: computedFatGrams
        }
      });

      setUserProfile(updated);
      showToast(
        "Profile Calibrated!",
        `Targets updated: ${liveTargets.dailyCalorieTarget.toLocaleString()} kcal/day.`,
        "success"
      );
    } catch (err) {
      console.error("Profile save error:", err);
      showToast("Error", "Could not save profile settings.", "warning");
    }
  };

  return (
    <div className="profile-page">
      {/* 1. Header matching Image 2 */}
      <section className="ref-profile-header-card clean-card">
        <div className="ref-profile-header-top">
          <div>
            <h2 className="ref-page-title">Targets and Profile</h2>
            <p className="ref-page-subtitle">
              Set up your profile so we can accurately calculate your targets.
              Customize your targets to reach a weight goal or address your specific health needs.
            </p>
          </div>

          <div className="ref-header-menu-container">
            <button
              type="button"
              className="ref-more-menu-btn"
              onClick={() => setShowResetMenu((prev) => !prev)}
              aria-label="Profile options"
              title="Profile Options"
            >
              <MoreHorizontal size={20} />
            </button>

            {showResetMenu && (
              <div className="ref-dropdown-popup">
                <button
                  type="button"
                  className="ref-dropdown-action"
                  onClick={handleResetDefaults}
                >
                  <RotateCcw size={14} />
                  <span>Reset all sections to default</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Account Mode Indicator */}
        <div className={`account-mode-banner mt-3 ${currentUser?.isDemo ? "mode-demo" : "mode-cloud"}`}>
          <div className="banner-left">
            <ShieldCheck size={16} />
            <div>
              <span className="banner-title">
                {currentUser?.isDemo ? "Local Demo Mode" : "Cloud Account Connected"}
              </span>
              <span className="banner-subtitle">
                {currentUser?.isDemo
                  ? "All demographic & nutrition data stored locally in browser storage."
                  : `Active cloud user: ${currentUser?.email}`}
              </span>
            </div>
          </div>
          <span className={`status-pill-small ${currentUser?.isDemo ? "pill-demo" : "pill-cloud"}`}>
            {currentUser?.isDemo ? "Offline Demo" : "Firestore Live"}
          </span>
        </div>
      </section>

      {/* 2. Main Layout Grid */}
      <div className="profile-layout-grid">
        {/* Left Column: Form & Target Cards */}
        <div className="profile-form-column">
          {/* Card: Macro & Energy Targets (matching Image 2) */}
          <section className="clean-card ref-macro-targets-card">
            <div className="ref-card-header-row">
              <div className="ref-card-title-group">
                <h3 className="card-title">Macro &amp; Energy Targets</h3>
                <HelpCircle size={15} className="text-muted" title="Macronutrient distribution targets" />
              </div>
              <button type="button" className="icon-btn" aria-label="Target settings">
                <MoreHorizontal size={17} />
              </button>
            </div>
            <p className="card-subtitle mb-3">Targets for protein, carbs, fat and energy.</p>

            {/* Segmented Control */}
            <div className="ref-segmented-wrapper">
              <label className="ref-seg-label">Set macro targets using</label>
              <div className="ref-segmented-control">
                <button
                  type="button"
                  className={`ref-seg-pill ${targetMode === "ratios" ? "active" : ""}`}
                  onClick={() => setTargetMode("ratios")}
                >
                  Ratios
                </button>
                <button
                  type="button"
                  className={`ref-seg-pill ${targetMode === "fixed" ? "active" : ""}`}
                  onClick={() => setTargetMode("fixed")}
                >
                  Fixed Targets
                </button>
                <button
                  type="button"
                  className={`ref-seg-pill ${targetMode === "keto" ? "active" : ""}`}
                  onClick={() => {
                    setTargetMode("keto");
                    setProteinPercent(25);
                    setCarbsPercent(5);
                    setFatPercent(70);
                  }}
                >
                  Keto Calculator
                </button>
              </div>
            </div>

            {/* Macro Ratios Explainer */}
            <div className="ref-ratios-explainer mt-3">
              <div className="ref-explainer-title">
                <span className="font-semibold text-sm">Macro Ratios</span>
                <HelpCircle size={13} className="text-muted" />
              </div>
              <p className="ref-explainer-text">
                Macro Ratios divides energy into protein, carbs, and fat. As your weight changes,
                so do your targets to keep your ratios steady.
              </p>
            </div>

            {/* Macro Ratio Rows Box (matching Image 2) */}
            <div className="ref-ratios-box mt-3">
              {/* Protein Row */}
              <div className="ref-ratio-row">
                <div className="ref-ratio-left">
                  <span className="ref-dot dot-protein" />
                  <span className="ref-name font-bold">Protein</span>
                  <span className="ref-grams font-semibold">{computedProteinGrams} g</span>
                </div>
                <div className="ref-ratio-right">
                  <span className="ref-kcal font-bold">{computedProteinKcal} kcal</span>
                  <div className="ref-percent-input-wrap">
                    <input
                      type="number"
                      min="5"
                      max="90"
                      value={proteinPercent}
                      onChange={(e) => setProteinPercent(Number(e.target.value))}
                      disabled={targetMode !== "ratios"}
                    />
                    <span className="ref-percent-label">%</span>
                  </div>
                </div>
              </div>

              {/* Net Carbs Row */}
              <div className="ref-ratio-row">
                <div className="ref-ratio-left">
                  <span className="ref-dot dot-carbs" />
                  <span className="ref-name font-bold">Net Carbs</span>
                  <span className="ref-grams font-semibold">{computedCarbsGrams} g</span>
                </div>
                <div className="ref-ratio-right">
                  <span className="ref-kcal font-bold">{computedCarbsKcal} kcal</span>
                  <div className="ref-percent-input-wrap">
                    <input
                      type="number"
                      min="0"
                      max="90"
                      value={carbsPercent}
                      onChange={(e) => setCarbsPercent(Number(e.target.value))}
                      disabled={targetMode !== "ratios"}
                    />
                    <span className="ref-percent-label">%</span>
                  </div>
                </div>
              </div>

              {/* Fat Row */}
              <div className="ref-ratio-row">
                <div className="ref-ratio-left">
                  <span className="ref-dot dot-fat" />
                  <span className="ref-name font-bold">Fat</span>
                  <span className="ref-grams font-semibold">{computedFatGrams} g</span>
                </div>
                <div className="ref-ratio-right">
                  <span className="ref-kcal font-bold">{computedFatKcal} kcal</span>
                  <div className="ref-percent-input-wrap">
                    <input
                      type="number"
                      min="5"
                      max="90"
                      value={fatPercent}
                      onChange={(e) => setFatPercent(Number(e.target.value))}
                      disabled={targetMode !== "ratios"}
                    />
                    <span className="ref-percent-label">%</span>
                  </div>
                </div>
              </div>

              {/* Ratio verification footer */}
              <div className="ref-ratio-total-footer">
                <span>Total Allocation:</span>
                <span className={`font-bold ${totalPercent === 100 ? "text-emerald" : "text-amber"}`}>
                  {totalPercent}% {totalPercent === 100 ? "✓ Balanced" : `(${100 - totalPercent}% remaining)`}
                </span>
              </div>
            </div>
          </section>

          {/* Form: Demographics & Lifestyle */}
          <form onSubmit={handleSaveProfile} className="interactive-form">
            {/* Section 1: Demographics */}
            <div className="profile-group-box clean-card">
              <h3 className="section-group-title">
                <User size={15} />
                <span>Body Demographics</span>
              </h3>

              <div className="form-row-two">
                <div className="input-group">
                  <label htmlFor="prof-age">Age (years)</label>
                  <input
                    id="prof-age"
                    type="number"
                    min="14"
                    max="110"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    required
                  />
                </div>

                <div className="input-group">
                  <label htmlFor="prof-sex">Biological Sex</label>
                  <select id="prof-sex" value={sex} onChange={(e) => setSex(e.target.value)}>
                    <option value="male">Male (+5 kcal factor)</option>
                    <option value="female">Female (-161 kcal factor)</option>
                  </select>
                </div>
              </div>

              <div className="form-row-three">
                <div className="input-group">
                  <label htmlFor="prof-height">Height (cm)</label>
                  <input
                    id="prof-height"
                    type="number"
                    min="90"
                    max="250"
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    required
                  />
                </div>

                <div className="input-group">
                  <label htmlFor="prof-curr-weight">Current Weight (kg)</label>
                  <input
                    id="prof-curr-weight"
                    type="number"
                    step="0.1"
                    min="30"
                    max="300"
                    value={currentWeight}
                    onChange={(e) => setCurrentWeight(e.target.value)}
                    required
                  />
                </div>

                <div className="input-group">
                  <label htmlFor="prof-target-weight">Target Weight (kg)</label>
                  <input
                    id="prof-target-weight"
                    type="number"
                    step="0.1"
                    min="30"
                    max="300"
                    value={targetWeight}
                    onChange={(e) => setTargetWeight(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Fitness & Lifestyle */}
            <div className="profile-group-box clean-card">
              <h3 className="section-group-title">
                <Activity size={15} />
                <span>Fitness &amp; Lifestyle Objectives</span>
              </h3>

              <div className="form-row-two">
                <div className="input-group">
                  <label htmlFor="prof-goal">Fitness Goal</label>
                  <select
                    id="prof-goal"
                    value={fitnessGoal}
                    onChange={(e) => setFitnessGoal(e.target.value)}
                  >
                    <option value="fat_loss">Fat Loss (-500 kcal Deficit)</option>
                    <option value="maintenance">Weight Maintenance (TDEE)</option>
                    <option value="muscle_gain">Muscle Hypertrophy (+350 kcal Surplus)</option>
                  </select>
                </div>

                <div className="input-group">
                  <label htmlFor="prof-activity">Daily Activity Multiplier</label>
                  <select
                    id="prof-activity"
                    value={activityLevel}
                    onChange={(e) => setActivityLevel(e.target.value)}
                  >
                    <option value="1.2">Sedentary (Desk Job, minimal exercise)</option>
                    <option value="1.375">Lightly Active (1-3 gym days/week)</option>
                    <option value="1.55">Moderately Active (3-5 workouts/week)</option>
                    <option value="1.725">Very Active (6-7 heavy sessions/week)</option>
                    <option value="1.9">Extra Active (2x day training / physical labor)</option>
                  </select>
                </div>
              </div>

              <div className="form-row-two">
                <div className="input-group">
                  <label htmlFor="prof-walk">Daily Walking Duration (mins)</label>
                  <input
                    id="prof-walk"
                    type="number"
                    min="0"
                    max="240"
                    value={walkingDuration}
                    onChange={(e) => setWalkingDuration(e.target.value)}
                  />
                </div>

                <div className="input-group">
                  <label htmlFor="prof-meals">Preferred Meals per Day</label>
                  <select
                    id="prof-meals"
                    value={preferredNumberOfMeals}
                    onChange={(e) => setPreferredNumberOfMeals(e.target.value)}
                  >
                    <option value="2">2 Meals (Intermittent Fasting)</option>
                    <option value="3">3 Meals (Standard Breakfast, Lunch, Dinner)</option>
                    <option value="4">4 Meals (3 Meals + 1 Snack)</option>
                    <option value="5">5 Meals (High Frequency Athlete Split)</option>
                  </select>
                </div>
              </div>

              <div className="input-group">
                <label htmlFor="prof-diet">Dietary Philosophy</label>
                <select
                  id="prof-diet"
                  value={dietaryPreference}
                  onChange={(e) => setDietaryPreference(e.target.value)}
                >
                  <option value="omnivore">Balanced Omnivore</option>
                  <option value="high_protein">High Protein (2.2g/kg)</option>
                  <option value="low_carb">Low Carbohydrate</option>
                  <option value="keto">Ketogenic (70% Fat)</option>
                  <option value="plant_based">Plant-Based / Vegetarian</option>
                </select>
              </div>
            </div>

            {/* Section 3: Allergies & Avoidances */}
            <div className="profile-group-box clean-card">
              <h3 className="section-group-title">
                <Heart size={15} />
                <span>Allergies &amp; Avoidances</span>
              </h3>

              <div className="input-group">
                <label>Allergies &amp; Intolerances (Tap to toggle)</label>
                <div className="allergies-chips-wrap" role="group" aria-label="Allergies and intolerances">
                  {allergyOptions.map((opt) => {
                    const isSelected = selectedAllergies.includes(opt);
                    return (
                      <button
                        key={opt}
                        type="button"
                        role="checkbox"
                        aria-checked={isSelected}
                        className={`allergy-chip ${isSelected ? "active" : ""}`}
                        onClick={() => toggleAllergy(opt)}
                      >
                        <span className="allergy-check-icon">{isSelected ? "✓" : "+"}</span>
                        <span>{opt}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="input-group mt-2">
                <label htmlFor="prof-avoided">Foods Avoided (comma separated)</label>
                <input
                  id="prof-avoided"
                  type="text"
                  placeholder="e.g. Pork, Artificial sweeteners, Cilantro"
                  value={foodsAvoidedText}
                  onChange={(e) => setFoodsAvoidedText(e.target.value)}
                />
              </div>
            </div>

            <button type="submit" className="primary-btn glow-btn btn-block mt-2">
              <Save size={18} />
              <span>Save Profile &amp; Apply Caloric Goals</span>
            </button>
          </form>
        </div>

        {/* Right Column: Live Scientific Calculator Cards */}
        <section className="profile-preview-column">
          <div className="clean-card calculation-summary-card">
            <div className="card-header">
              <div className="header-icon-box food-theme">
                <Sparkles size={20} />
              </div>
              <div>
                <h3 className="card-title">Metabolic Energy Engine</h3>
                <p className="card-subtitle">Mifflin-St Jeor Clinical Model</p>
              </div>
            </div>

            <div className="metabolic-stats-stack">
              <div className="metabolic-row-box">
                <div className="meta-left">
                  <span className="meta-label">Basal Metabolic Rate (BMR)</span>
                  <span className="meta-sub">Resting energy expenditure</span>
                </div>
                <div className="meta-right">
                  <span className="meta-val">{liveBmr.toLocaleString()}</span>
                  <span className="meta-unit">kcal/day</span>
                </div>
              </div>

              <div className="metabolic-row-box">
                <div className="meta-left">
                  <span className="meta-label">Total Daily Energy (TDEE)</span>
                  <span className="meta-sub">BMR × {activityLevel} + {walkingDuration}m walk</span>
                </div>
                <div className="meta-right">
                  <span className="meta-val">{liveTdee.toLocaleString()}</span>
                  <span className="meta-unit">kcal/day</span>
                </div>
              </div>

              <div className="metabolic-row-box highlight-box">
                <div className="meta-left">
                  <span className="meta-label font-bold text-emerald">
                    Calibrated Daily Goal
                  </span>
                  <span className="meta-sub">
                    {fitnessGoal === "fat_loss"
                      ? "Fat Loss Deficit (-500 kcal)"
                      : fitnessGoal === "muscle_gain"
                      ? "Hypertrophy Surplus (+350 kcal)"
                      : "Maintenance Balance"}
                  </span>
                </div>
                <div className="meta-right">
                  <span className="meta-val text-emerald font-extrabold text-2xl">
                    {liveTargets.dailyCalorieTarget.toLocaleString()}
                  </span>
                  <span className="meta-unit text-emerald">kcal/day</span>
                </div>
              </div>
            </div>

            <div className="macro-targets-box mt-3">
              <h4 className="font-semibold text-sm mb-2 text-primary">
                Live Macronutrient Target Distribution:
              </h4>

              <div className="macro-distribution-grid">
                <div className="macro-dist-item border-coral">
                  <span className="dist-num text-coral">{computedProteinGrams}g</span>
                  <span className="dist-lbl">Protein ({computedProteinKcal} kcal)</span>
                </div>
                <div className="macro-dist-item border-cyan">
                  <span className="dist-num text-cyan">{computedCarbsGrams}g</span>
                  <span className="dist-lbl">Net Carbs ({computedCarbsKcal} kcal)</span>
                </div>
                <div className="macro-dist-item border-amber">
                  <span className="dist-num text-amber">{computedFatGrams}g</span>
                  <span className="dist-lbl">Fats ({computedFatKcal} kcal)</span>
                </div>
                <div className="macro-dist-item border-emerald">
                  <span className="dist-num text-emerald">{liveTargets.fibreTarget}g</span>
                  <span className="dist-lbl">Dietary Fibre</span>
                </div>
              </div>
            </div>

            <div className="formula-explanation-strip mt-3">
              <Info size={14} className="text-secondary" />
              <span>
                Deterministic clinical calculation: Mifflin-St Jeor metabolic equations guarantee mathematical accuracy.
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
