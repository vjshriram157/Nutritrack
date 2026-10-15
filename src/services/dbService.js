/**
 * Database Service Layer for NutriTrack
 * Implements operations for all 7 Firestore collections:
 *  1. users
 *  2. foods
 *  3. recipes
 *  4. mealPlans
 *  5. foodLogs
 *  6. weightLogs
 *  7. shoppingLists
 *
 * Supports live Cloud Firestore with seamless offline/demo storage fallback.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  writeBatch
} from "firebase/firestore";
import { db, isFirebaseConfigured } from "../firebase/config";
import { SEED_FOODS } from "../data/seedFoods";

// Local storage backup keys
const LOCAL_KEYS = {
  USERS: "nt_users",
  FOODS: "nt_foods",
  RECIPES: "nt_recipes",
  MEAL_PLANS: "nt_meal_plans",
  FOOD_LOGS: "nt_food_logs",
  WEIGHT_LOGS: "nt_weight_logs",
  SHOPPING_LISTS: "nt_shopping_lists",
  ACTIVITY_LOGS: "nt_activity_logs",
  WEARABLE_CONNECTIONS: "nt_wearable_connections"
};

// In-memory / LocalStorage helper
function getLocal(key, defaultVal = []) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultVal;
  } catch (e) {
    console.error("LocalStorage read error", e);
    return defaultVal;
  }
}

function setLocal(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) {
    console.error("LocalStorage write error", e);
  }
}

// Initialize seed data in LocalStorage if empty
function ensureLocalSeed() {
  const existingFoods = getLocal(LOCAL_KEYS.FOODS, null);
  if (!existingFoods || existingFoods.length === 0) {
    setLocal(LOCAL_KEYS.FOODS, SEED_FOODS);
  }
}
ensureLocalSeed();

/* ==========================================================================
   1. USERS COLLECTION
   ========================================================================== */

export async function getUserProfile(userId) {
  if (!userId) return null;

  if (isFirebaseConfigured && db) {
    const userDocRef = doc(db, "users", userId);
    const snap = await getDoc(userDocRef);
    if (snap.exists()) {
      return { userId: snap.id, ...snap.data() };
    }
    return null;
  }

  // Local fallback
  const users = getLocal(LOCAL_KEYS.USERS, {});
  return users[userId] || null;
}

export async function saveUserProfile(userId, profileData) {
  if (!userId) throw new Error("userId is required to save profile");

  const now = new Date().toISOString();
  const cleanProfile = {
    userId,
    age: parseInt(profileData.age, 10) || 26,
    sex: profileData.sex || "male",
    height: parseFloat(profileData.height) || 178,
    currentWeight: parseFloat(profileData.currentWeight) || 74,
    targetWeight: parseFloat(profileData.targetWeight) || 72,
    fitnessGoal: profileData.fitnessGoal || "maintenance", // 'fat_loss' | 'maintenance' | 'muscle_gain'
    activityLevel: parseFloat(profileData.activityLevel) || 1.375,
    walkingDuration: parseInt(profileData.walkingDuration, 10) || 30, // mins
    dietaryPreference: profileData.dietaryPreference || "omnivore",
    allergiesAndIntolerances: profileData.allergiesAndIntolerances || [],
    foodsAvoided: profileData.foodsAvoided || [],
    preferredNumberOfMeals: parseInt(profileData.preferredNumberOfMeals, 10) || 3,
    updatedAt: now
  };

  if (isFirebaseConfigured && db) {
    const userDocRef = doc(db, "users", userId);
    await setDoc(userDocRef, { ...cleanProfile, updatedAt: serverTimestamp() }, { merge: true });
    return cleanProfile;
  }

  // Local fallback
  const users = getLocal(LOCAL_KEYS.USERS, {});
  users[userId] = { ...users[userId], ...cleanProfile, createdAt: users[userId]?.createdAt || now };
  setLocal(LOCAL_KEYS.USERS, users);
  return users[userId];
}

/* ==========================================================================
   2. FOODS COLLECTION (Verified Shared Food Database)
   ========================================================================== */

export async function getVerifiedFoods() {
  if (isFirebaseConfigured && db) {
    try {
      const q = query(collection(db, "foods"), where("isVerified", "==", true));
      const snap = await getDocs(q);
      if (!snap.empty) {
        return snap.docs.map(doc => ({ foodId: doc.id, ...doc.data() }));
      }
    } catch (err) {
      console.warn("Firestore foods query error, using seed cache:", err);
    }
  }

  // Local fallback / Seed
  return getLocal(LOCAL_KEYS.FOODS, SEED_FOODS);
}

export async function seedFirestoreFoods() {
  if (!isFirebaseConfigured || !db) {
    return { success: true, count: SEED_FOODS.length, message: "Using local verified food database" };
  }

  const batch = writeBatch(db);
  SEED_FOODS.forEach(food => {
    const docRef = doc(db, "foods", food.foodId);
    batch.set(docRef, food);
  });
  await batch.commit();
  return { success: true, count: SEED_FOODS.length, message: "Seeded Firestore foods collection" };
}

/* ==========================================================================
   3. RECIPES COLLECTION
   ========================================================================== */

export async function getRecipes(userId) {
  if (isFirebaseConfigured && db) {
    const q = query(collection(db, "recipes"), where("creatorUserId", "==", userId));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ recipeId: d.id, ...d.data() }));
  }

  const recipes = getLocal(LOCAL_KEYS.RECIPES, []);
  return recipes.filter(r => r.creatorUserId === userId || r.isPublic);
}

export async function saveRecipe(recipe) {
  const recipeId = recipe.recipeId || `recipe_${Date.now()}`;
  const record = {
    ...recipe,
    recipeId,
    createdAt: new Date().toISOString()
  };

  if (isFirebaseConfigured && db) {
    await setDoc(doc(db, "recipes", recipeId), record);
    return record;
  }

  const recipes = getLocal(LOCAL_KEYS.RECIPES, []);
  recipes.unshift(record);
  setLocal(LOCAL_KEYS.RECIPES, recipes);
  return record;
}

/* ==========================================================================
   4. MEAL PLANS COLLECTION
   ========================================================================== */

export async function getMealPlans(userId) {
  if (isFirebaseConfigured && db) {
    const q = query(
      collection(db, "mealPlans"),
      where("userId", "==", userId),
      orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ planId: d.id, ...d.data() }));
  }

  const plans = getLocal(LOCAL_KEYS.MEAL_PLANS, []);
  return plans.filter(p => p.userId === userId);
}

export async function saveMealPlan(userId, plan) {
  const planId = plan.planId || `plan_${Date.now()}`;
  const record = {
    planId,
    userId,
    planName: plan.planName || "Daily Balanced Plan",
    dailyCalorieTarget: plan.dailyCalorieTarget || 2000,
    proteinTarget: plan.proteinTarget || 140,
    carbohydrateTarget: plan.carbohydrateTarget || 200,
    fatTarget: plan.fatTarget || 65,
    fibreTarget: plan.fibreTarget || 30,
    meals: plan.meals || [],
    calculatedTotals: plan.calculatedTotals || {},
    createdAt: new Date().toISOString()
  };

  if (isFirebaseConfigured && db) {
    await setDoc(doc(db, "mealPlans", planId), record);
    return record;
  }

  const plans = getLocal(LOCAL_KEYS.MEAL_PLANS, []);
  const index = plans.findIndex(p => p.planId === planId);
  if (index >= 0) {
    plans[index] = record;
  } else {
    plans.unshift(record);
  }
  setLocal(LOCAL_KEYS.MEAL_PLANS, plans);
  return record;
}

export async function deleteMealPlan(planId) {
  if (isFirebaseConfigured && db) {
    await deleteDoc(doc(db, "mealPlans", planId));
    return true;
  }

  const plans = getLocal(LOCAL_KEYS.MEAL_PLANS, []);
  setLocal(LOCAL_KEYS.MEAL_PLANS, plans.filter(p => p.planId !== planId));
  return true;
}

/* ==========================================================================
   5. FOOD LOGS COLLECTION
   ========================================================================== */

export async function getFoodLogs(userId, dateString) {
  if (isFirebaseConfigured && db) {
    const q = query(
      collection(db, "foodLogs"),
      where("userId", "==", userId),
      where("date", "==", dateString)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ logId: d.id, ...d.data() }));
  }

  const logs = getLocal(LOCAL_KEYS.FOOD_LOGS, []);
  return logs.filter(l => l.userId === userId && l.date === dateString);
}

export async function addFoodLog(userId, logItem) {
  const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  const record = {
    logId,
    userId,
    date: logItem.date, // 'YYYY-MM-DD'
    mealType: logItem.mealType || "Snack", // 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack'
    foodId: logItem.foodId || null,
    foodName: logItem.foodName,
    portionQuantity: logItem.portionQuantity, // in grams
    weightBasis: logItem.weightBasis || "raw",
    calculatedCalories: logItem.calculatedCalories,
    protein: logItem.protein,
    carbs: logItem.carbs,
    fat: logItem.fat,
    fibre: logItem.fibre,
    createdAt: new Date().toISOString()
  };

  if (isFirebaseConfigured && db) {
    await setDoc(doc(db, "foodLogs", logId), record);
    return record;
  }

  const logs = getLocal(LOCAL_KEYS.FOOD_LOGS, []);
  logs.unshift(record);
  setLocal(LOCAL_KEYS.FOOD_LOGS, logs);
  return record;
}

export async function deleteFoodLog(logId) {
  if (isFirebaseConfigured && db) {
    await deleteDoc(doc(db, "foodLogs", logId));
    return true;
  }

  const logs = getLocal(LOCAL_KEYS.FOOD_LOGS, []);
  setLocal(LOCAL_KEYS.FOOD_LOGS, logs.filter(l => l.logId !== logId));
  return true;
}

/* ==========================================================================
   6. WEIGHT LOGS COLLECTION
   ========================================================================== */

export async function getWeightLogs(userId) {
  if (isFirebaseConfigured && db) {
    const q = query(
      collection(db, "weightLogs"),
      where("userId", "==", userId),
      orderBy("date", "asc")
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ logId: d.id, ...d.data() }));
  }

  const logs = getLocal(LOCAL_KEYS.WEIGHT_LOGS, []);
  return logs
    .filter(w => w.userId === userId)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

export async function addWeightLog(userId, entry) {
  const logId = `wlog_${Date.now()}`;
  const record = {
    logId,
    userId,
    date: entry.date, // 'YYYY-MM-DD'
    weightKg: parseFloat(entry.weightKg),
    waistCm: entry.waistCm ? parseFloat(entry.waistCm) : null,
    dailySteps: entry.dailySteps ? parseInt(entry.dailySteps, 10) : null,
    walkingDurationMins: entry.walkingDurationMins ? parseInt(entry.walkingDurationMins, 10) : null,
    createdAt: new Date().toISOString()
  };

  if (isFirebaseConfigured && db) {
    await setDoc(doc(db, "weightLogs", logId), record);
    return record;
  }

  const logs = getLocal(LOCAL_KEYS.WEIGHT_LOGS, []);
  logs.push(record);
  setLocal(LOCAL_KEYS.WEIGHT_LOGS, logs);
  return record;
}

export async function deleteWeightLog(logId) {
  if (isFirebaseConfigured && db) {
    await deleteDoc(doc(db, "weightLogs", logId));
    return true;
  }

  const logs = getLocal(LOCAL_KEYS.WEIGHT_LOGS, []);
  setLocal(LOCAL_KEYS.WEIGHT_LOGS, logs.filter(w => w.logId !== logId));
  return true;
}

/* ==========================================================================
   7. SHOPPING LISTS COLLECTION
   ========================================================================== */

export async function getShoppingList(userId, mealPlanId = null) {
  if (isFirebaseConfigured && db) {
    let q = query(collection(db, "shoppingLists"), where("userId", "==", userId));
    if (mealPlanId) {
      q = query(collection(db, "shoppingLists"), where("userId", "==", userId), where("associatedMealPlanId", "==", mealPlanId));
    }
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ itemId: d.id, ...d.data() }));
  }

  const lists = getLocal(LOCAL_KEYS.SHOPPING_LISTS, []);
  return lists.filter(item => item.userId === userId && (!mealPlanId || item.associatedMealPlanId === mealPlanId));
}

export async function addShoppingItem(userId, item) {
  const normName = (item.ingredientName || "").trim().toLowerCase();
  const unit = (item.unit || "g").trim().toLowerCase();
  const addQty = parseFloat(item.aggregatedQuantity) || 1;

  if (isFirebaseConfigured && db) {
    try {
      const q = query(collection(db, "shoppingLists"), where("userId", "==", userId));
      const snap = await getDocs(q);
      const existingDoc = snap.docs.find(d => {
        const data = d.data();
        return (data.ingredientName || "").trim().toLowerCase() === normName &&
               (data.unit || "g").trim().toLowerCase() === unit;
      });

      if (existingDoc) {
        const data = existingDoc.data();
        const updatedQty = Math.round(((parseFloat(data.aggregatedQuantity) || 0) + addQty) * 100) / 100;
        await updateDoc(doc(db, "shoppingLists", existingDoc.id), {
          aggregatedQuantity: updatedQty,
          purchased: false
        });
        return { itemId: existingDoc.id, ...data, aggregatedQuantity: updatedQty, purchased: false };
      }
    } catch (e) {
      console.warn("Could not query existing items, writing new item:", e);
    }

    const itemId = `shop_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const record = {
      itemId,
      userId,
      associatedMealPlanId: item.associatedMealPlanId || null,
      ingredientName: item.ingredientName.trim(),
      aggregatedQuantity: addQty,
      unit: item.unit || "g",
      category: item.category || "General",
      purchased: Boolean(item.purchased)
    };
    await setDoc(doc(db, "shoppingLists", itemId), record);
    return record;
  }

  const lists = getLocal(LOCAL_KEYS.SHOPPING_LISTS, []);
  const existing = lists.find(
    i => i.userId === userId &&
         (i.ingredientName || "").trim().toLowerCase() === normName &&
         (i.unit || "g").trim().toLowerCase() === unit
  );

  if (existing) {
    existing.aggregatedQuantity = Math.round(((parseFloat(existing.aggregatedQuantity) || 0) + addQty) * 100) / 100;
    existing.purchased = false;
    setLocal(LOCAL_KEYS.SHOPPING_LISTS, lists);
    return existing;
  }

  const itemId = `shop_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  const record = {
    itemId,
    userId,
    associatedMealPlanId: item.associatedMealPlanId || null,
    ingredientName: item.ingredientName.trim(),
    aggregatedQuantity: addQty,
    unit: item.unit || "g",
    category: item.category || "General",
    purchased: Boolean(item.purchased)
  };
  lists.unshift(record);
  setLocal(LOCAL_KEYS.SHOPPING_LISTS, lists);
  return record;
}

export async function toggleShoppingItem(itemId, purchased) {
  if (isFirebaseConfigured && db) {
    await updateDoc(doc(db, "shoppingLists", itemId), { purchased });
    return true;
  }

  const lists = getLocal(LOCAL_KEYS.SHOPPING_LISTS, []);
  const target = lists.find(i => i.itemId === itemId);
  if (target) {
    target.purchased = purchased;
    setLocal(LOCAL_KEYS.SHOPPING_LISTS, lists);
  }
  return true;
}

export async function updateShoppingItemQuantity(itemId, quantity) {
  const newQty = Math.max(0.1, Math.round(parseFloat(quantity) * 10) / 10);
  if (isFirebaseConfigured && db) {
    await updateDoc(doc(db, "shoppingLists", itemId), { aggregatedQuantity: newQty });
    return true;
  }

  const lists = getLocal(LOCAL_KEYS.SHOPPING_LISTS, []);
  const target = lists.find(i => i.itemId === itemId);
  if (target) {
    target.aggregatedQuantity = newQty;
    setLocal(LOCAL_KEYS.SHOPPING_LISTS, lists);
  }
  return true;
}

export async function markCategoryPurchased(userId, category, purchased = true) {
  if (isFirebaseConfigured && db) {
    try {
      const q = query(
        collection(db, "shoppingLists"),
        where("userId", "==", userId),
        where("category", "==", category)
      );
      const snap = await getDocs(q);
      const batch = writeBatch(db);
      snap.docs.forEach(d => {
        batch.update(d.ref, { purchased });
      });
      await batch.commit();
      return true;
    } catch (e) {
      console.warn("markCategoryPurchased firestore batch error:", e);
    }
  }

  const lists = getLocal(LOCAL_KEYS.SHOPPING_LISTS, []);
  lists.forEach(it => {
    if (it.userId === userId && it.category === category) {
      it.purchased = purchased;
    }
  });
  setLocal(LOCAL_KEYS.SHOPPING_LISTS, lists);
  return true;
}

export async function deleteShoppingItem(itemId) {
  if (isFirebaseConfigured && db) {
    await deleteDoc(doc(db, "shoppingLists", itemId));
    return true;
  }

  const lists = getLocal(LOCAL_KEYS.SHOPPING_LISTS, []);
  setLocal(LOCAL_KEYS.SHOPPING_LISTS, lists.filter(i => i.itemId !== itemId));
  return true;
}

export async function syncAggregatedMealPlanShoppingList(userId, mealPlanId, aggregatedItems) {
  const targetPlanId = mealPlanId || "active_meal_plan";

  // Pre-consolidate incoming items by normalized name and unit
  const consolidatedMap = new Map();
  (aggregatedItems || []).forEach(item => {
    const key = `${(item.ingredientName || "").trim().toLowerCase()}__${(item.unit || "g").trim().toLowerCase()}`;
    const qty = parseFloat(item.aggregatedQuantity) || 0;
    if (consolidatedMap.has(key)) {
      const existing = consolidatedMap.get(key);
      existing.aggregatedQuantity += qty;
    } else {
      consolidatedMap.set(key, {
        ingredientName: item.ingredientName.trim(),
        aggregatedQuantity: qty,
        unit: item.unit || "g",
        category: item.category || "Groceries"
      });
    }
  });

  const consolidatedList = Array.from(consolidatedMap.values());

  if (isFirebaseConfigured && db) {
    const q = query(collection(db, "shoppingLists"), where("userId", "==", userId));
    const snap = await getDocs(q);
    const existingDocs = snap.docs.map(d => ({ itemId: d.id, ...d.data() }));

    const batch = writeBatch(db);

    // Remove any previously synced items for this plan to prevent duplicates
    existingDocs
      .filter(it => it.associatedMealPlanId === targetPlanId)
      .forEach(it => {
        batch.delete(doc(db, "shoppingLists", it.itemId));
      });

    const newRecords = [];
    consolidatedList.forEach(item => {
      const itemId = `shop_${targetPlanId}_${Math.random().toString(36).substr(2, 6)}`;
      const rec = {
        itemId,
        userId,
        associatedMealPlanId: targetPlanId,
        ingredientName: item.ingredientName,
        aggregatedQuantity: Math.round(item.aggregatedQuantity * 10) / 10,
        unit: item.unit,
        category: item.category,
        purchased: false
      };
      batch.set(doc(db, "shoppingLists", itemId), rec);
      newRecords.push(rec);
    });

    await batch.commit();
    return newRecords;
  }

  const lists = getLocal(LOCAL_KEYS.SHOPPING_LISTS, []);
  // Remove prior items for this meal plan
  const remaining = lists.filter(l => !(l.userId === userId && l.associatedMealPlanId === targetPlanId));

  const newRecords = consolidatedList.map(item => ({
    itemId: `shop_${targetPlanId}_${Math.random().toString(36).substr(2, 6)}`,
    userId,
    associatedMealPlanId: targetPlanId,
    ingredientName: item.ingredientName,
    aggregatedQuantity: Math.round(item.aggregatedQuantity * 10) / 10,
    unit: item.unit,
    category: item.category,
    purchased: false
  }));

  const combined = [...newRecords, ...remaining];
  setLocal(LOCAL_KEYS.SHOPPING_LISTS, combined);
  return newRecords;
}

/* ==========================================================================
   8. ACTIVITY LOGS COLLECTION (CMF Watch 3 Pro & Health Connect data)
   ========================================================================== */

/**
 * Generates a stable deterministic record ID to prevent duplicates when re-syncing.
 * Format: `${userId}_${date}_${metricType}_${sourceSanitized}`
 */
export function generateActivityLogId(userId, date, metricType, source = "cmf_watch") {
  const safeSource = String(source).toLowerCase().replace(/[^a-z0-9]/g, "_");
  return `${userId}_${date}_${metricType}_${safeSource}`;
}

export async function getActivityLogs(userId, dateString) {
  if (!userId) return [];

  if (isFirebaseConfigured && db) {
    try {
      const q = query(
        collection(db, "activityLogs"),
        where("userId", "==", userId),
        where("date", "==", dateString)
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ logId: d.id, ...d.data() }));
    } catch (err) {
      console.warn("Firestore activityLogs query error:", err);
    }
  }

  const logs = getLocal(LOCAL_KEYS.ACTIVITY_LOGS, []);
  return logs.filter(l => l.userId === userId && l.date === dateString);
}

export async function getHistoricalActivityLogs(userId, days = 30) {
  if (!userId) return [];

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startStr = startDate.toISOString().split("T")[0];

  if (isFirebaseConfigured && db) {
    try {
      const q = query(
        collection(db, "activityLogs"),
        where("userId", "==", userId),
        where("date", ">=", startStr),
        orderBy("date", "asc")
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ logId: d.id, ...d.data() }));
    } catch (err) {
      console.warn("Firestore historical activity query error:", err);
    }
  }

  const logs = getLocal(LOCAL_KEYS.ACTIVITY_LOGS, []);
  return logs
    .filter(l => l.userId === userId && l.date >= startStr)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function upsertActivityLog(userId, record) {
  if (!userId) throw new Error("userId required for activity log");

  const now = new Date().toISOString();
  const logId = record.logId || generateActivityLogId(userId, record.date, record.metricType, record.source);

  const cleanRecord = {
    logId,
    userId,
    date: record.date, // 'YYYY-MM-DD'
    metricType: record.metricType, // 'steps' | 'active_calories' | 'distance_meters' | 'workout_duration_minutes' | 'exercise_session'
    value: Math.max(0, parseFloat(record.value) || 0),
    unit: record.unit || "count",
    source: record.source || "cmf_watch_health_connect",
    recordedTimestamp: record.recordedTimestamp || now,
    lastSyncedTimestamp: now,
    metadata: record.metadata || {}
  };

  if (isFirebaseConfigured && db) {
    await setDoc(doc(db, "activityLogs", logId), cleanRecord, { merge: true });
    return cleanRecord;
  }

  const logs = getLocal(LOCAL_KEYS.ACTIVITY_LOGS, []);
  const index = logs.findIndex(l => l.logId === logId);
  if (index >= 0) {
    logs[index] = { ...logs[index], ...cleanRecord };
  } else {
    logs.push(cleanRecord);
  }
  setLocal(LOCAL_KEYS.ACTIVITY_LOGS, logs);
  return cleanRecord;
}

export async function batchUpsertActivityLogs(userId, records = []) {
  if (!userId || records.length === 0) return [];

  const now = new Date().toISOString();
  const prepared = records.map(record => {
    const logId = record.logId || generateActivityLogId(userId, record.date, record.metricType, record.source);
    return {
      logId,
      userId,
      date: record.date,
      metricType: record.metricType,
      value: Math.max(0, parseFloat(record.value) || 0),
      unit: record.unit || "count",
      source: record.source || "cmf_watch_health_connect",
      recordedTimestamp: record.recordedTimestamp || now,
      lastSyncedTimestamp: now,
      metadata: record.metadata || {}
    };
  });

  if (isFirebaseConfigured && db) {
    const batch = writeBatch(db);
    prepared.forEach(item => {
      const docRef = doc(db, "activityLogs", item.logId);
      batch.set(docRef, item, { merge: true });
    });
    await batch.commit();
    return prepared;
  }

  const logs = getLocal(LOCAL_KEYS.ACTIVITY_LOGS, []);
  prepared.forEach(item => {
    const isHcRecord = item.source && (item.source.includes("health_connect") || item.source.includes("cmf_watch") || item.source.includes("smartwatch"));
    // Replace exact logId OR any existing automated Health Connect log for the same user, date, and metricType
    const index = logs.findIndex(l =>
      l.logId === item.logId ||
      (isHcRecord && l.userId === item.userId && l.date === item.date && l.metricType === item.metricType && (l.source?.includes("health_connect") || l.source?.includes("cmf_watch") || l.source?.includes("smartwatch")))
    );
    if (index >= 0) {
      logs[index] = { ...item };
    } else {
      logs.push(item);
    }
  });
  setLocal(LOCAL_KEYS.ACTIVITY_LOGS, logs);
  return prepared;
}

export async function deleteActivityLog(logId) {
  if (isFirebaseConfigured && db) {
    await deleteDoc(doc(db, "activityLogs", logId));
    return true;
  }

  const logs = getLocal(LOCAL_KEYS.ACTIVITY_LOGS, []);
  setLocal(LOCAL_KEYS.ACTIVITY_LOGS, logs.filter(l => l.logId !== logId));
  return true;
}

/* ==========================================================================
   9. WEARABLE CONNECTIONS COLLECTION (CMF Watch 3 Pro Status)
   ========================================================================== */

export async function getWearableConnection(userId) {
  if (!userId) return null;

  if (isFirebaseConfigured && db) {
    try {
      const snap = await getDoc(doc(db, "wearableConnections", userId));
      if (snap.exists()) {
        return snap.data();
      }
    } catch (err) {
      console.warn("Firestore wearable connection fetch error:", err);
    }
  }

  const connections = getLocal(LOCAL_KEYS.WEARABLE_CONNECTIONS, {});
  return connections[userId] || null;
}

export async function saveWearableConnection(userId, data) {
  if (!userId) throw new Error("userId required for wearable connection");

  // Read existing connection if available to preserve lastSyncedTimestamp and fields
  const existing = await getWearableConnection(userId);

  const cleanData = {
    userId,
    deviceModel: data.deviceModel || existing?.deviceModel || "Smartwatch",
    companionApp: data.companionApp || existing?.companionApp || "Google Health Connect",
    platform: "Android Health Connect",
    isConnected: data.isConnected !== undefined ? Boolean(data.isConnected) : (existing?.isConnected ?? false),
    permissions: {
      steps: Boolean(data.permissions?.steps ?? existing?.permissions?.steps ?? false),
      activeCalories: Boolean(data.permissions?.activeCalories ?? existing?.permissions?.activeCalories ?? false),
      distance: Boolean(data.permissions?.distance ?? existing?.permissions?.distance ?? false),
      exercise: Boolean(data.permissions?.exercise ?? existing?.permissions?.exercise ?? false),
      heartRate: Boolean(data.permissions?.heartRate ?? existing?.permissions?.heartRate ?? false),
      sleep: Boolean(data.permissions?.sleep ?? existing?.permissions?.sleep ?? false),
      weight: Boolean(data.permissions?.weight ?? existing?.permissions?.weight ?? false)
    },
    energyAccountingMode: data.energyAccountingMode || existing?.energyAccountingMode || "strict_tdee",
    lastSyncedTimestamp: data.lastSyncedTimestamp !== undefined ? data.lastSyncedTimestamp : (existing?.lastSyncedTimestamp || null),
    updatedAt: new Date().toISOString()
  };

  if (isFirebaseConfigured && db) {
    await setDoc(doc(db, "wearableConnections", userId), cleanData, { merge: true });
    return cleanData;
  }

  const connections = getLocal(LOCAL_KEYS.WEARABLE_CONNECTIONS, {});
  connections[userId] = cleanData;
  setLocal(LOCAL_KEYS.WEARABLE_CONNECTIONS, connections);
  return cleanData;
}

export async function disconnectWearable(userId) {
  if (!userId) return;

  const update = {
    isConnected: false,
    permissions: {
      steps: false,
      activeCalories: false,
      distance: false,
      exercise: false,
      heartRate: false,
      sleep: false,
      weight: false
    },
    lastDisconnectedAt: new Date().toISOString()
  };

  if (isFirebaseConfigured && db) {
    await setDoc(doc(db, "wearableConnections", userId), update, { merge: true });
    return true;
  }

  const connections = getLocal(LOCAL_KEYS.WEARABLE_CONNECTIONS, {});
  if (connections[userId]) {
    connections[userId] = { ...connections[userId], ...update };
    setLocal(LOCAL_KEYS.WEARABLE_CONNECTIONS, connections);
  }
  return true;
}

