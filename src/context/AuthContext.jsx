import React, { createContext, useContext, useState, useEffect } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "firebase/auth";
import { auth, isFirebaseConfigured } from "../firebase/config";
import { getUserProfile, saveUserProfile } from "../services/dbService";

const AuthContext = createContext();

const DEMO_USER = {
  uid: "demo_athlete_01",
  email: "athlete@nutritrack.io",
  displayName: "Alex Rivera",
  isAnonymous: false,
  isDemo: true
};

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initialize listener or demo session
  useEffect(() => {
    if (isFirebaseConfigured && auth) {
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (user) {
          setCurrentUser(user);
          const profile = await getUserProfile(user.uid);
          setUserProfile(profile);
        } else {
          setCurrentUser(null);
          setUserProfile(null);
        }
        setLoading(false);
      });
      return unsubscribe;
    } else {
      // Demo / Local Mode: check localStorage for session
      const savedUid = localStorage.getItem("nt_current_uid");
      if (savedUid) {
        setCurrentUser(DEMO_USER);
        getUserProfile(DEMO_USER.uid).then((prof) => {
          if (!prof) {
            // Seed initial demo profile
            const initProf = {
              userId: DEMO_USER.uid,
              age: 27,
              sex: "male",
              height: 178,
              currentWeight: 75.0,
              targetWeight: 72.0,
              fitnessGoal: "fat_loss",
              activityLevel: 1.375,
              walkingDuration: 35,
              dietaryPreference: "omnivore",
              allergiesAndIntolerances: [],
              foodsAvoided: [],
              preferredNumberOfMeals: 3
            };
            saveUserProfile(DEMO_USER.uid, initProf).then(setUserProfile);
          } else {
            setUserProfile(prof);
          }
        });
      } else {
        // Default to demo user for instantaneous interactive experience
        loginAsGuest();
      }
      setLoading(false);
    }
  }, []);

  async function login(email, password) {
    if (isFirebaseConfigured && auth) {
      const res = await signInWithEmailAndPassword(auth, email, password);
      const profile = await getUserProfile(res.user.uid);
      setUserProfile(profile);
      return res.user;
    } else {
      setCurrentUser(DEMO_USER);
      localStorage.setItem("nt_current_uid", DEMO_USER.uid);
      const profile = await getUserProfile(DEMO_USER.uid);
      setUserProfile(profile);
      return DEMO_USER;
    }
  }

  async function signup(email, password, displayName = "Athlete") {
    if (isFirebaseConfigured && auth) {
      const res = await createUserWithEmailAndPassword(auth, email, password);
      const initialProfile = {
        userId: res.user.uid,
        age: 26,
        sex: "male",
        height: 175,
        currentWeight: 70,
        targetWeight: 70,
        fitnessGoal: "maintenance",
        activityLevel: 1.375,
        walkingDuration: 30,
        dietaryPreference: "omnivore"
      };
      await saveUserProfile(res.user.uid, initialProfile);
      setUserProfile(initialProfile);
      return res.user;
    } else {
      setCurrentUser({ ...DEMO_USER, email, displayName });
      localStorage.setItem("nt_current_uid", DEMO_USER.uid);
      return DEMO_USER;
    }
  }

  async function logout() {
    if (isFirebaseConfigured && auth) {
      await signOut(auth);
    }
    localStorage.removeItem("nt_current_uid");
    setCurrentUser(null);
    setUserProfile(null);
  }

  async function loginAsGuest() {
    setCurrentUser(DEMO_USER);
    localStorage.setItem("nt_current_uid", DEMO_USER.uid);
    let profile = await getUserProfile(DEMO_USER.uid);
    if (!profile) {
      profile = {
        userId: DEMO_USER.uid,
        age: 27,
        sex: "male",
        height: 178,
        currentWeight: 75.0,
        targetWeight: 72.0,
        fitnessGoal: "fat_loss",
        activityLevel: 1.375,
        walkingDuration: 35,
        dietaryPreference: "omnivore",
        allergiesAndIntolerances: [],
        foodsAvoided: [],
        preferredNumberOfMeals: 3
      };
      await saveUserProfile(DEMO_USER.uid, profile);
    }
    setUserProfile(profile);
    return DEMO_USER;
  }

  async function refreshProfile() {
    if (currentUser?.uid) {
      const p = await getUserProfile(currentUser.uid);
      setUserProfile(p);
      return p;
    }
  }

  async function updateProfile(updates) {
    const uid = currentUser?.uid || "demo_athlete_01";
    const current = userProfile || {};
    const updated = {
      ...current,
      ...updates,
      name: updates.name || updates.displayName || current.name || "Athlete"
    };
    await saveUserProfile(uid, updated);
    setUserProfile(updated);
    if (updated.name) {
      localStorage.setItem("nutritrack_user_name", updated.name);
    }
    return updated;
  }

  const value = {
    currentUser,
    userProfile,
    setUserProfile,
    refreshProfile,
    updateProfile,
    login,
    signup,
    logout,
    loginAsGuest,
    isFirebaseConfigured,
    loading
  };

  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
