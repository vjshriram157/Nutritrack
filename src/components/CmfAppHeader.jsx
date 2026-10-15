import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { User, Settings, Database } from "lucide-react";

/**
 * CMF Watch Companion App Header with Top Tab Switcher
 * Faithfully matches Screenshots 1, 2 & 3:
 * - Two main tabs: "My devices" and "Health"
 * - Clean left-aligned tab typography with active bold state
 * - Top-right avatar / settings circle button
 */
export default function CmfAppHeader({ activeTab, onTabChange, onOpenProfileModal }) {
  const { currentUser, userProfile, isFirebaseConfigured } = useAuth();

  const userInitial = (userProfile?.name || currentUser?.displayName || currentUser?.email || "U")
    .charAt(0)
    .toUpperCase();

  return (
    <header className="cmf-top-header">
      <div className="cmf-top-header-inner">
        {/* Top Tab Switcher */}
        <div className="cmf-tab-switcher" role="tablist" aria-label="Main Navigation">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "device"}
            className={`cmf-tab-btn ${activeTab === "device" ? "active" : ""}`}
            onClick={() => onTabChange("device")}
          >
            My devices
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "health"}
            className={`cmf-tab-btn ${activeTab === "health" ? "active" : ""}`}
            onClick={() => onTabChange("health")}
          >
            Health
          </button>
        </div>

        {/* Right Circle Avatar / Settings Action */}
        <div className="cmf-header-right">
          <button
            type="button"
            onClick={onOpenProfileModal}
            className="cmf-avatar-circle"
            title="Account, Weight & App Settings"
            aria-label="Account Settings"
          >
            <span>{userInitial}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
