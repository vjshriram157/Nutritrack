import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  BarChart2,
  BookOpen,
  Plus,
  Apple,
  MoreHorizontal,
  Watch,
  Scale,
  Calendar,
  User,
  X
} from "lucide-react";

/**
 * Mobile Bottom Navigation Bar with prominent central orange '+' FAB button
 * matching Screenshot 2.
 */
export default function BottomNav({ onOpenQuickAction }) {
  const location = useLocation();
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const isDiscover = location.pathname === "/";
  const isDiary = location.pathname === "/food-log";
  const isFoods = location.pathname === "/foods";
  const isMore = ["/activity", "/weight", "/meal-plans", "/profile", "/shopping-list"].includes(
    location.pathname
  );

  return (
    <>
      <nav className="mobile-bottom-nav" aria-label="Bottom Navigation">
        {/* Tab 1: Discover */}
        <Link
          to="/"
          className={`bottom-nav-item ${isDiscover ? "active" : ""}`}
        >
          <BarChart2 size={20} />
          <span className="bottom-nav-label">Discover</span>
        </Link>

        {/* Tab 2: Diary */}
        <Link
          to="/food-log"
          className={`bottom-nav-item ${isDiary ? "active" : ""}`}
        >
          <BookOpen size={20} />
          <span className="bottom-nav-label">Diary</span>
        </Link>

        {/* Center: Central Floating '+' Action Button */}
        <div className="bottom-nav-fab-wrapper">
          <button
            type="button"
            className="bottom-nav-fab"
            onClick={onOpenQuickAction}
            aria-label="Add Food or Activity"
            title="Quick Action"
          >
            <Plus size={26} strokeWidth={2.6} />
          </button>
        </div>

        {/* Tab 3: Foods */}
        <Link
          to="/foods"
          className={`bottom-nav-item ${isFoods ? "active" : ""}`}
        >
          <Apple size={20} />
          <span className="bottom-nav-label">Foods</span>
        </Link>

        {/* Tab 4: More */}
        <button
          type="button"
          className={`bottom-nav-item ${isMore || showMoreMenu ? "active" : ""}`}
          onClick={() => setShowMoreMenu((prev) => !prev)}
        >
          <MoreHorizontal size={20} />
          <span className="bottom-nav-label">More</span>
        </button>
      </nav>

      {/* More Options Popover */}
      {showMoreMenu && (
        <div
          className="more-menu-overlay"
          onClick={() => setShowMoreMenu(false)}
        >
          <div
            className="more-menu-popover"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="more-menu-header">
              <span className="font-semibold text-sm">More Features</span>
              <button
                type="button"
                className="icon-btn text-muted"
                onClick={() => setShowMoreMenu(false)}
              >
                <X size={16} />
              </button>
            </div>
            <div className="more-menu-links">
              <Link
                to="/activity"
                className="more-menu-item"
                onClick={() => setShowMoreMenu(false)}
              >
                <Watch size={18} className="text-emerald" />
                <span>Smartwatch &amp; Activity</span>
              </Link>
              <Link
                to="/meal-plans"
                className="more-menu-item"
                onClick={() => setShowMoreMenu(false)}
              >
                <Calendar size={18} className="text-teal" />
                <span>Meal Planner</span>
              </Link>
              <Link
                to="/weight"
                className="more-menu-item"
                onClick={() => setShowMoreMenu(false)}
              >
                <Scale size={18} className="text-purple" />
                <span>Weight Tracker</span>
              </Link>
              <Link
                to="/profile"
                className="more-menu-item"
                onClick={() => setShowMoreMenu(false)}
              >
                <User size={18} className="text-amber" />
                <span>Profile &amp; TDEE</span>
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
