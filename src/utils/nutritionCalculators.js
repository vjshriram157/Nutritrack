/**
 * Pure, deterministic nutrition calculation engine for NutriTrack.
 * These functions have no side-effects or external dependencies,
 * ensuring complete testability and separation from Firestore read/write logic.
 */

/**
 * Calculates macro and calorie amounts for a specific food portion.
 * Formula: Nutrient amount = (Nutrient per 100g * portionGrams) / 100
 *
 * @param {Object} food - Verified food item with per 100g nutritional profile
 * @param {number} portionGrams - Weight in grams
 * @returns {Object} Calculated calories and macros rounded to 1 decimal place
 */
export function calculatePortionNutrition(food, portionGrams) {
  const grams = Math.max(0, parseFloat(portionGrams) || 0);
  const factor = grams / 100;

  const calories = Math.round((food.caloriesPer100g || 0) * factor);
  const protein = Math.round((food.proteinPer100g || 0) * factor * 10) / 10;
  const carbs = Math.round((food.carbsPer100g || 0) * factor * 10) / 10;
  const fat = Math.round((food.fatPer100g || 0) * factor * 10) / 10;
  const fibre = Math.round((food.fibrePer100g || 0) * factor * 10) / 10;

  return {
    portionGrams: grams,
    calories,
    protein,
    carbs,
    fat,
    fibre
  };
}

/**
 * Calculates sum totals of an array of portioned food items for a single meal.
 *
 * @param {Array} items - List of food items with portion quantities
 * @returns {Object} Total calories and macros
 */
export function calculateMealTotals(items = []) {
  return items.reduce(
    (acc, item) => {
      acc.calories += item.calories || 0;
      acc.protein = Math.round((acc.protein + (item.protein || 0)) * 10) / 10;
      acc.carbs = Math.round((acc.carbs + (item.carbs || 0)) * 10) / 10;
      acc.fat = Math.round((acc.fat + (item.fat || 0)) * 10) / 10;
      acc.fibre = Math.round((acc.fibre + (item.fibre || 0)) * 10) / 10;
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 }
  );
}

/**
 * Calculates sum totals across multiple meals (e.g. daily food log).
 *
 * @param {Array} foodLogs - Array of logged items
 * @returns {Object} Total calories and macros
 */
export function calculateDailyTotals(foodLogs = []) {
  return calculateMealTotals(foodLogs);
}

/**
 * Calculates Basal Metabolic Rate (BMR) using the Mifflin-St Jeor Equation.
 * Men:   BMR = 10 * weight(kg) + 6.25 * height(cm) - 5 * age + 5
 * Women: BMR = 10 * weight(kg) + 6.25 * height(cm) - 5 * age - 161
 *
 * @param {Object} params - { sex, weightKg, heightCm, ageYears }
 * @returns {number} Basal Metabolic Rate in kcal
 */
export function calculateBmr({ sex = 'male', weightKg, heightCm, ageYears }) {
  const w = parseFloat(weightKg) || 70;
  const h = parseFloat(heightCm) || 170;
  const a = parseInt(ageYears, 10) || 25;

  let bmr = 10 * w + 6.25 * h - 5 * a;
  if (sex.toLowerCase() === 'female') {
    bmr -= 161;
  } else {
    bmr += 5;
  }

  return Math.round(bmr);
}

/**
 * Calculates Total Daily Energy Expenditure (TDEE).
 * Activity multipliers:
 *  - Sedentary: 1.2
 *  - Lightly Active: 1.375
 *  - Moderately Active: 1.55
 *  - Very Active: 1.725
 *  - Extra Active: 1.9
 *
 * Additionally factors in walking duration (MET ~ 3.3 for brisk walk: ~3.3 * weight * duration_hours).
 *
 * @param {number} bmr
 * @param {number|string} activityLevel - Activity multiplier (e.g. 1.375)
 * @param {number} walkingDurationMins - Daily walking time in minutes
 * @param {number} weightKg - Current weight in kg
 * @returns {number} TDEE in kcal
 */
export function calculateTdee(bmr, activityLevel = 1.375, walkingDurationMins = 0, weightKg = 70) {
  const mult = parseFloat(activityLevel) || 1.375;
  const baseTdee = bmr * mult;

  // Additional walking energy expenditure (if regular walk > 20 mins)
  const walkMins = Math.max(0, parseInt(walkingDurationMins, 10) || 0);
  const walkingCalories = (3.3 * (weightKg || 70) * (walkMins / 60)) * 0.5; // marginal additional calorie expenditure

  return Math.round(baseTdee + walkingCalories);
}

/**
 * Calculates Target Daily Calories and recommended macronutrient distribution
 * based on fitness goal and dietary preference.
 *
 * @param {number} tdee
 * @param {string} fitnessGoal - 'fat_loss' | 'maintenance' | 'muscle_gain'
 * @param {number} weightKg
 * @param {string} dietaryPreference - 'omnivore' | 'high_protein' | 'keto' | 'plant_based'
 * @returns {Object} { dailyCalorieTarget, proteinTarget, carbsTarget, fatTarget, fibreTarget }
 */
export function calculateNutritionTargets(tdee, fitnessGoal = 'maintenance', weightKg = 70, dietaryPreference = 'omnivore') {
  let targetCalories = tdee;

  if (fitnessGoal === 'fat_loss') {
    // 20% deficit, minimum 1200 kcal floor
    targetCalories = Math.max(1200, Math.round(tdee - 500));
  } else if (fitnessGoal === 'muscle_gain') {
    // 10-15% surplus
    targetCalories = Math.round(tdee + 350);
  }

  // Protein targets based on goal and weight (grams per kg)
  let proteinPerKg = 1.6;
  if (fitnessGoal === 'fat_loss') proteinPerKg = 2.0; // Preserve lean muscle
  if (fitnessGoal === 'muscle_gain') proteinPerKg = 2.2; // Hypertrophy support

  let proteinGrams = Math.round((weightKg || 70) * proteinPerKg);
  let proteinCalories = proteinGrams * 4;

  // Dietary preference macro splits
  let fatGrams = 0;
  let carbsGrams = 0;

  if (dietaryPreference === 'keto') {
    // 70% fat, 25% protein, 5% carbs
    const fatCalories = targetCalories * 0.7;
    fatGrams = Math.round(fatCalories / 9);
    proteinGrams = Math.round((targetCalories * 0.25) / 4);
    carbsGrams = Math.round((targetCalories * 0.05) / 4);
  } else if (dietaryPreference === 'low_carb') {
    // 40% protein, 35% fat, 25% carbs
    fatGrams = Math.round((targetCalories * 0.35) / 9);
    carbsGrams = Math.max(30, Math.round((targetCalories - (proteinCalories + fatGrams * 9)) / 4));
  } else {
    // Balanced: 25-30% fat, remaining in complex carbs
    fatGrams = Math.round((targetCalories * 0.28) / 9);
    const remainingCalories = targetCalories - (proteinCalories + fatGrams * 9);
    carbsGrams = Math.max(50, Math.round(remainingCalories / 4));
  }

  // Recommended daily fibre: 14g per 1000 kcal consumed
  const fibreTarget = Math.round((targetCalories / 1000) * 14);

  return {
    dailyCalorieTarget: targetCalories,
    proteinTarget: proteinGrams,
    carbohydrateTarget: carbsGrams,
    fatTarget: fatGrams,
    fibreTarget
  };
}

/**
 * Aggregates all recipe and meal ingredients into a consolidated shopping list.
 * Merges duplicate ingredients and sums portion quantities.
 *
 * @param {Array} meals - List of meals with food items
 * @returns {Array} Consolidated shopping list items
 */
export function aggregateShoppingList(meals = []) {
  const map = new Map();

  meals.forEach(meal => {
    (meal.items || []).forEach(item => {
      const key = (item.foodName || 'Item').trim().toLowerCase();
      const existing = map.get(key);
      const quantity = parseFloat(item.portionGrams) || 0;

      if (existing) {
        existing.aggregatedQuantity += quantity;
      } else {
        map.set(key, {
          ingredientName: item.foodName,
          aggregatedQuantity: quantity,
          unit: 'g',
          category: item.category || 'Pantry',
          purchased: false
        });
      }
    });
  });

  return Array.from(map.values());
}

/**
 * Aggregates all activity logs for a specific day.
 * Ensures metrics not reported by the wearable are represented as null/undefined,
 * never misleading zeros.
 *
 * @param {Array} activityLogs - Array of activity records for the day
 * @returns {Object} Aggregated daily activity summary
 */
export function aggregateDailyActivity(activityLogs = []) {
  let stepsRecord = null;
  let activeCaloriesRecord = null;
  let distanceRecord = null;
  let workoutDurationRecord = null;
  let heartRateRecord = null;
  let sleepRecord = null;
  let weightRecord = null;
  const workoutSessions = [];
  let latestSync = null;

  activityLogs.forEach((log) => {
    if (!latestSync || new Date(log.lastSyncedTimestamp || log.recordedTimestamp) > new Date(latestSync)) {
      latestSync = log.lastSyncedTimestamp || log.recordedTimestamp;
    }

    if (log.metricType === "steps") {
      const isHcLog = Boolean(log.source && (log.source.includes("health_connect") || log.source.includes("smartwatch") || log.source.includes("cmf_watch")));
      const isPrevHc = Boolean(stepsRecord?.source && (stepsRecord.source.includes("health_connect") || stepsRecord.source.includes("smartwatch") || stepsRecord.source.includes("cmf_watch")));

      if (!stepsRecord) {
        stepsRecord = log;
      } else if (isHcLog && !isPrevHc) {
        // Health Connect sync takes precedence over manual / legacy source
        stepsRecord = log;
      } else if (isHcLog && isPrevHc) {
        // Both are from Health Connect sync: prefer the most recent sync timestamp
        const curTime = new Date(log.lastSyncedTimestamp || log.recordedTimestamp || 0).getTime();
        const prevTime = new Date(stepsRecord.lastSyncedTimestamp || stepsRecord.recordedTimestamp || 0).getTime();
        if (curTime >= prevTime) {
          stepsRecord = log;
        }
      } else if (!isPrevHc && parseFloat(log.value) > parseFloat(stepsRecord.value)) {
        stepsRecord = log;
      }
    } else if (log.metricType === "active_calories") {
      if (!activeCaloriesRecord || log.value > activeCaloriesRecord.value) {
        activeCaloriesRecord = log;
      }
    } else if (log.metricType === "distance_meters") {
      if (!distanceRecord || log.value > distanceRecord.value) {
        distanceRecord = log;
      }
    } else if (log.metricType === "workout_duration_minutes") {
      if (!workoutDurationRecord || log.value > workoutDurationRecord.value) {
        workoutDurationRecord = log;
      }
    } else if (log.metricType === "exercise_session") {
      workoutSessions.push(log);
    } else if (log.metricType === "heart_rate_avg") {
      heartRateRecord = log;
    } else if (log.metricType === "sleep_duration_minutes") {
      if (!sleepRecord || log.value > sleepRecord.value) {
        sleepRecord = log;
      }
    } else if (log.metricType === "weight_kg") {
      weightRecord = log;
    }
  });

  return {
    // If not present in logs, explicitly null (never misleading 0)
    steps: stepsRecord ? Math.round(stepsRecord.value) : null,
    stepsUnit: "steps",
    stepsSource: stepsRecord?.source || null,

    activeCalories: activeCaloriesRecord ? Math.round(activeCaloriesRecord.value) : null,
    activeCaloriesUnit: "kcal",
    activeCaloriesSource: activeCaloriesRecord?.source || null,

    distanceMeters: distanceRecord ? Math.round(distanceRecord.value) : null,
    distanceKm: distanceRecord ? Math.round((distanceRecord.value / 1000) * 10) / 10 : null,
    distanceSource: distanceRecord?.source || null,

    workoutDurationMinutes: workoutDurationRecord ? Math.round(workoutDurationRecord.value) : null,
    workoutDurationSource: workoutDurationRecord?.source || null,

    heartRateBpm: heartRateRecord ? Math.round(heartRateRecord.value) : null,
    heartRateAvg: heartRateRecord ? Math.round(heartRateRecord.value) : null,
    heartRateLatest: heartRateRecord?.metadata?.latestBpm ?? (heartRateRecord ? Math.round(heartRateRecord.value) : null),
    heartRateLatestTimestamp: heartRateRecord?.metadata?.latestTimestamp ?? null,
    heartRateMin: heartRateRecord?.metadata?.minBpm ?? null,
    heartRateMax: heartRateRecord?.metadata?.maxBpm ?? null,
    heartRateSamples: Array.isArray(heartRateRecord?.metadata?.samples) ? heartRateRecord.metadata.samples : [],
    heartRateSource: heartRateRecord?.source || null,
    heartRateMetadata: heartRateRecord?.metadata || null,

    sleepMinutes: sleepRecord ? Math.round(sleepRecord.value) : null,
    sleepHours: sleepRecord ? Math.round((sleepRecord.value / 60) * 10) / 10 : null,
    sleepDurationMinutes: sleepRecord ? Math.round(sleepRecord.value) : null,
    sleepSource: sleepRecord?.source || null,

    weightKg: weightRecord ? Math.round(weightRecord.value * 10) / 10 : null,
    weightSource: weightRecord?.source || null,

    workoutSessions,
    totalLoggedWorkoutSessions: workoutSessions.length,
    lastSyncedTimestamp: latestSync
  };
}

/**
 * Calculates energy balance and daily budget using defined energy-accounting methods.
 * Prevents double-counting between TDEE activity factor and wearable active calories.
 *
 * Strategies:
 * 1. 'strict_tdee' (Recommended):
 *    Base calorie target is determined strictly by TDEE equation (which already models daily activity).
 *    Wearable-reported active burn is tracked side-by-side as observed physical burn,
 *    WITHOUT expanding the food calorie allowance.
 *
 * 2. 'dynamic_active_burn':
 *    Calorie target starts at Basal Metabolic Rate (BMR) and only wearable-verified active calories
 *    are added to the budget. (Useful on high-intensity or very fluctuating training days).
 *
 * 3. 'exercise_only':
 *    Daily target = TDEE, but verified structured workout sessions (e.g. running 5km)
 *    are added with a 50% conservative replacement ratio.
 *
 * @param {Object} params
 * @returns {Object} Deterministic energy balance report
 */
export function calculateEnergyBalance(params = {}) {
  const {
    dailyFoodCalories,
    consumedCalories,
    targetCalories,
    dailyTargetOverride,
    tdee,
    bmr = 1650,
    activityData = {},
    wearableActiveBurn,
    accountingMode,
    mode
  } = params;

  const foodConsumed = Math.max(0, Math.round(consumedCalories ?? dailyFoodCalories ?? 0));
  const activeBurn = wearableActiveBurn ?? activityData?.activeCalories ?? null;
  const effectiveBaseTarget = targetCalories ?? dailyTargetOverride ?? tdee ?? 2000;
  const currentMode = accountingMode ?? mode ?? "strict_tdee";

  let effectiveBudget = effectiveBaseTarget;
  let explanation = "";
  let energySurplusOrDeficit = 0;

  if (currentMode === "dynamic_active_burn") {
    // BMR + Wearable Active Burn
    const burnToAdd = activeBurn !== null ? activeBurn : 300; // conservative sedentary baseline if not yet reported
    effectiveBudget = Math.round(bmr + burnToAdd);
    explanation = "Dynamic Mode: Budget is Base BMR + verified wearable active burn.";
  } else if (currentMode === "exercise_only") {
    // TDEE + 50% of dedicated workout session calories to avoid metabolic compensation
    const workoutBurn = activityData?.workoutSessions?.reduce((acc, s) => acc + (s.value || 0), 0) || 0;
    const addback = Math.round(workoutBurn * 0.5);
    effectiveBudget = Math.round(effectiveBaseTarget + addback);
    explanation = `Exercise Mode: Base target + 50% structured workout addback (+${addback} kcal).`;
  } else {
    // 'strict_tdee'
    effectiveBudget = effectiveBaseTarget;
    explanation = "Strict TDEE Mode: Budget factors in lifestyle multiplier. Wearable burn tracked separately to avoid double-counting.";
  }

  const remainingCalories = effectiveBudget - foodConsumed;
  energySurplusOrDeficit = foodConsumed - effectiveBudget;

  return {
    foodConsumed,
    wearableActiveBurn,
    effectiveBudget,
    remainingCalories,
    energySurplusOrDeficit,
    accountingMode,
    explanation,
    isSurplus: energySurplusOrDeficit > 0,
    // Clear identification of every metric
    metricDefinitions: {
      foodConsumed: "Energy consumed from logged food and beverages",
      wearableActiveBurn: "Active energy expended above basal rate as measured by smartwatch via Health Connect",
      effectiveBudget: "Calibrated daily dietary allowance under selected accounting model",
      remainingCalories: "Calories remaining before reaching daily target"
    }
  };
}

