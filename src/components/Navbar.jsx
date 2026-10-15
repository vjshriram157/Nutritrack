import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  PieChart,
  Utensils,
  BookOpen,
  Scale,
  ShoppingCart,
  User,
  LogOut,
  Database,
  Watch
} from "lucide-react";

export default function Navbar() {
  const { currentUser, userProfile, logout, isFirebaseConfigured } = useAuth();
  const location = useLocation();

  const navLinks = [
    { to: "/", label: "Discover", icon: PieChart },
    { to: "/food-log", label: "Diary", icon: Utensils },
    { to: "/foods", label: "Foods", icon: BookOpen },
    { to: "/activity", label: "Activity", icon: Watch },
    { to: "/weight", label: "Weight", icon: Scale },
    { to: "/shopping-list", label: "Shopping", icon: ShoppingCart },
    { to: "/profile", label: "Profile", icon: User },
  ];

  return (
    <header className="app-header">
      <div className="app-header-inner">
        {/* Brand */}
        <Link to="/" className="header-brand">
          <h1>Nutri<span>Track</span></h1>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="header-nav-desktop" aria-label="Main Navigation">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`nav-link ${isActive ? "active" : ""}`}
              >
                <Icon size={15} />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Header Right Actions */}
        <div className="header-right-actions">
          <div
            className={`db-status-pill ${
              isFirebaseConfigured && !currentUser?.isDemo ? "db-online" : "db-offline"
            }`}
            title={
              isFirebaseConfigured && !currentUser?.isDemo
                ? `Connected to Firestore (${currentUser?.email || "Authenticated"})`
                : "Running in Local Demo mode (Data stored locally in browser storage)"
            }
          >
            <Database size={11} />
            <span>
              {isFirebaseConfigured && !currentUser?.isDemo
                ? "Cloud Sync"
                : "Local Demo"}
            </span>
          </div>

          {currentUser && (
            <button
              type="button"
              onClick={logout}
              className="icon-btn"
              title="Sign Out"
              aria-label="Sign Out"
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
