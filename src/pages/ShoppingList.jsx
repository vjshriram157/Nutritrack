import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import {
  getShoppingList,
  addShoppingItem,
  toggleShoppingItem,
  updateShoppingItemQuantity,
  markCategoryPurchased,
  deleteShoppingItem
} from "../services/dbService";
import EmptyState from "../components/EmptyState";
import {
  ShoppingBag,
  Package,
  Plus,
  Minus,
  Trash2,
  CheckCircle,
  Sparkles,
  ChevronLeft,
  Users,
  Settings,
  X,
  Filter
} from "lucide-react";

function getFoodEmoji(name = "", category = "") {
  const n = name.toLowerCase();
  const c = category.toLowerCase();
  if (n.includes("cheese")) return "🧀";
  if (n.includes("milk") || n.includes("yogurt") || c.includes("dairy")) return "🥛";
  if (n.includes("apple")) return "🍎";
  if (n.includes("banana")) return "🍌";
  if (n.includes("chicken") || n.includes("poultry")) return "🍗";
  if (n.includes("egg")) return "🥚";
  if (n.includes("fish") || n.includes("salmon") || c.includes("seafood")) return "🐟";
  if (n.includes("bread") || n.includes("toast") || n.includes("roti") || n.includes("naan")) return "🍞";
  if (n.includes("oat") || n.includes("rice") || c.includes("grain")) return "🌾";
  if (n.includes("oil") || n.includes("olive") || n.includes("ghee")) return "🫒";
  if (n.includes("potato") || n.includes("sweet potato")) return "🥔";
  if (n.includes("berry") || n.includes("strawberry")) return "🍓";
  if (c.includes("produce") || c.includes("veg")) return "🥬";
  if (c.includes("fruit")) return "🍊";
  if (c.includes("pantry")) return "🥫";
  return "🛒";
}

function getStorageLocation(category = "") {
  const c = category.toLowerCase();
  if (c.includes("dairy") || c.includes("poultry") || c.includes("seafood") || c.includes("meat")) {
    return "🥛 Fridge";
  }
  if (c.includes("produce") || c.includes("fruit") || c.includes("veg")) {
    return "Kitchen Counter";
  }
  return "Kitchen Pantry";
}

export default function ShoppingList() {
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("basket"); // "basket" | "pantry"
  const [groupBy, setGroupBy] = useState("category"); // "category" | "all"
  const [showAddModal, setShowAddModal] = useState(false);

  // New Custom Item Form state
  const [ingredientName, setIngredientName] = useState("");
  const [aggregatedQuantity, setAggregatedQuantity] = useState(1);
  const [unit, setUnit] = useState("pcs");
  const [category, setCategory] = useState("Dairy");

  useEffect(() => {
    async function load() {
      if (!currentUser?.uid) return;
      try {
        const list = await getShoppingList(currentUser.uid);
        setItems(list || []);
      } catch (err) {
        console.error("Shopping list load error:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [currentUser]);

  const basketItems = items.filter((i) => !i.purchased);
  const pantryItems = items.filter((i) => i.purchased);
  const currentTabItems = activeTab === "basket" ? basketItems : pantryItems;

  // Toggle item purchased
  const handleTogglePurchased = async (item) => {
    const newStatus = !item.purchased;
    try {
      await toggleShoppingItem(item.itemId, newStatus);
      setItems((prev) =>
        prev.map((i) =>
          i.itemId === item.itemId ? { ...i, purchased: newStatus } : i
        )
      );
      if (newStatus) {
        showToast("Got It!", `Moved ${item.ingredientName} to Pantry.`, "success");
      }
    } catch (err) {
      console.error("Toggle error:", err);
    }
  };

  // Quantity Stepper: Increment / Decrement
  const handleStepQuantity = async (item, delta) => {
    const current = parseFloat(item.aggregatedQuantity) || 1;
    const next = Math.max(1, Math.round((current + delta) * 10) / 10);
    if (next === current) return;

    try {
      await updateShoppingItemQuantity(item.itemId, next);
      setItems((prev) =>
        prev.map((i) =>
          i.itemId === item.itemId ? { ...i, aggregatedQuantity: next } : i
        )
      );
    } catch (err) {
      console.error("Quantity update error:", err);
    }
  };

  // "Got All" for a category
  const handleGotAllCategory = async (catName) => {
    if (!currentUser?.uid) return;
    try {
      await markCategoryPurchased(currentUser.uid, catName, true);
      setItems((prev) =>
        prev.map((i) => (i.category === catName ? { ...i, purchased: true } : i))
      );
      showToast("Category Complete", `Marked all ${catName} items as Got It!`, "success");
    } catch (err) {
      console.error("Got All error:", err);
    }
  };

  // Add Item Submit
  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!currentUser?.uid || !ingredientName.trim()) return;

    try {
      const added = await addShoppingItem(currentUser.uid, {
        ingredientName: ingredientName.trim(),
        aggregatedQuantity: parseFloat(aggregatedQuantity) || 1,
        unit,
        category,
        purchased: false
      });

      setItems((prev) => {
        const existingIdx = prev.findIndex((i) => i.itemId === added.itemId);
        if (existingIdx >= 0) {
          const updated = [...prev];
          updated[existingIdx] = added;
          return updated;
        }
        return [added, ...prev];
      });

      setIngredientName("");
      setAggregatedQuantity(1);
      setShowAddModal(false);
      showToast("Added", `Added ${added.ingredientName} to Basket.`, "success");
    } catch (err) {
      console.error("Add item error:", err);
    }
  };

  // Delete Item
  const handleDelete = async (itemId, e) => {
    if (e) e.stopPropagation();
    try {
      await deleteShoppingItem(itemId);
      setItems((prev) => prev.filter((i) => i.itemId !== itemId));
    } catch (err) {
      console.error("Delete shopping item error:", err);
    }
  };

  // Group items by category
  const categoriesMap = new Map();
  currentTabItems.forEach((it) => {
    const cat = it.category || "General";
    if (!categoriesMap.has(cat)) {
      categoriesMap.set(cat, []);
    }
    categoriesMap.get(cat).push(it);
  });
  const categoriesList = Array.from(categoriesMap.entries());

  return (
    <div className="reference-shopping-container">
      {/* 1. Top Reference Header */}
      <header className="ref-shopping-header">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="ref-header-btn"
          aria-label="Back"
        >
          <ChevronLeft size={20} />
        </button>

        <div className="ref-header-title">
          <span className="ref-basket-icon" role="img" aria-label="shopping basket">🧺</span>
          <h2>Shopping List</h2>
        </div>

        <div className="ref-header-right-actions">
          <Link
            to="/meal-plans"
            className="ref-header-btn"
            title="Generate from Meal Plan"
            aria-label="Meal Plan Sync"
          >
            <Sparkles size={18} />
          </Link>
          <button
            type="button"
            className="ref-header-btn"
            title="Settings"
            aria-label="Settings"
            onClick={() => setShowAddModal(true)}
          >
            <Settings size={18} />
          </button>
        </div>
      </header>

      {/* 2. Top Segmented Tabs: Basket vs Pantry */}
      <div className="ref-tabs-container">
        <button
          type="button"
          className={`ref-tab-btn ${activeTab === "basket" ? "active" : ""}`}
          onClick={() => setActiveTab("basket")}
        >
          <span className="tab-icon">🧺</span>
          <span className="tab-text">Basket ({basketItems.length})</span>
        </button>

        <button
          type="button"
          className={`ref-tab-btn ${activeTab === "pantry" ? "active" : ""}`}
          onClick={() => setActiveTab("pantry")}
        >
          <span className="tab-icon">🗄️</span>
          <span className="tab-text">Pantry ({pantryItems.length})</span>
        </button>
      </div>

      {/* 3. Group by Controls Bar */}
      <div className="ref-controls-strip">
        <span className="ref-groupby-label">Group by:</span>
        <div className="ref-select-wrapper">
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value)}
            className="ref-groupby-select"
          >
            <option value="category">Category</option>
            <option value="all">All Items</option>
          </select>
        </div>
      </div>

      {/* 4. Categorized Items List */}
      <main className="ref-shopping-content">
        {currentTabItems.length === 0 ? (
          <EmptyState
            icon={activeTab === "basket" ? "🧺" : "🗄️"}
            title={activeTab === "basket" ? "Your basket is empty" : "Pantry is currently empty"}
            description={
              activeTab === "basket"
                ? "Tap the '+' button below or build a meal plan to generate ingredients."
                : "Check off items in your Basket with 'Got It!' to stock your pantry."
            }
          />
        ) : (
          <div className="ref-categories-stack">
            {categoriesList.map(([catName, catItems]) => (
              <section key={catName} className="ref-category-section">
                {/* Category Header Row */}
                <div className="ref-category-header">
                  <div className="ref-cat-left">
                    <span className="ref-cat-emoji">{getFoodEmoji("", catName)}</span>
                    <h3 className="ref-cat-title">{catName}</h3>
                    <span className="ref-cat-count">{catItems.length}</span>
                  </div>

                  {activeTab === "basket" && (
                    <button
                      type="button"
                      onClick={() => handleGotAllCategory(catName)}
                      className="ref-got-all-btn"
                      title={`Mark all ${catName} items as purchased`}
                    >
                      Got All
                    </button>
                  )}
                </div>

                {/* Items in Category */}
                <div className="ref-items-group">
                  {catItems.map((item) => (
                    <div
                      key={item.itemId}
                      className={`ref-item-card ${item.purchased ? "is-got" : ""}`}
                    >
                      {/* Food Emoji Avatar */}
                      <div className="ref-item-avatar">
                        <span>{getFoodEmoji(item.ingredientName, item.category)}</span>
                      </div>

                      {/* Title & Subtitle */}
                      <div className="ref-item-info">
                        <span className="ref-item-name">{item.ingredientName}</span>
                        <span className="ref-item-sub">
                          {item.category} • {getStorageLocation(item.category)}
                        </span>
                      </div>

                      {/* Stepper Quantity Control: (-) [qty] (+) */}
                      <div className="ref-stepper-control">
                        <button
                          type="button"
                          onClick={() => handleStepQuantity(item, -1)}
                          className="ref-step-btn"
                          aria-label="Decrease quantity"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="ref-step-value">
                          {item.aggregatedQuantity}
                          {item.unit && item.unit !== "pcs" ? ` ${item.unit}` : ""}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleStepQuantity(item, 1)}
                          className="ref-step-btn"
                          aria-label="Increase quantity"
                        >
                          <Plus size={14} />
                        </button>
                      </div>

                      {/* Right Action: Got It! / In Basket */}
                      <button
                        type="button"
                        onClick={() => handleTogglePurchased(item)}
                        className={`ref-got-it-btn ${item.purchased ? "btn-pantry" : "btn-basket"}`}
                      >
                        {item.purchased ? "In Pantry" : "Got It!"}
                      </button>

                      {/* Delete Icon */}
                      <button
                        type="button"
                        onClick={(e) => handleDelete(item.itemId, e)}
                        className="ref-delete-item-btn"
                        title="Remove from list"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      {/* 5. Circular Orange Floating Action Button (FAB) matching Image 1 */}
      <button
        type="button"
        onClick={() => setShowAddModal(true)}
        className="ref-fab-button"
        aria-label="Add Grocery Item"
        title="Add Grocery Item"
      >
        <Plus size={26} strokeWidth={2.6} />
      </button>

      {/* 6. Add Custom Grocery Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Add Item to Grocery List</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="icon-btn"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddItem} className="interactive-form modal-body">
              <div className="input-group">
                <label>Item Name</label>
                <input
                  type="text"
                  placeholder="e.g. Cheese, Whole Milk, Apples, Bread"
                  value={ingredientName}
                  onChange={(e) => setIngredientName(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div className="form-row-two">
                <div className="input-group">
                  <label>Quantity</label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.5"
                    value={aggregatedQuantity}
                    onChange={(e) => setAggregatedQuantity(e.target.value)}
                    required
                  />
                </div>

                <div className="input-group">
                  <label>Unit</label>
                  <select value={unit} onChange={(e) => setUnit(e.target.value)}>
                    <option value="pcs">Pieces (pcs)</option>
                    <option value="g">Grams (g)</option>
                    <option value="kg">Kilograms (kg)</option>
                    <option value="ml">Milliliters (ml)</option>
                    <option value="pack">Pack</option>
                    <option value="bottle">Bottle</option>
                  </select>
                </div>
              </div>

              <div className="input-group">
                <label>Category</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="Dairy">Dairy</option>
                  <option value="Produce">Produce</option>
                  <option value="Pantry">Pantry</option>
                  <option value="Poultry">Poultry &amp; Meats</option>
                  <option value="Seafood">Seafood</option>
                  <option value="Grains">Grains &amp; Cereals</option>
                  <option value="Oils &amp; Fats">Oils &amp; Fats</option>
                  <option value="General">General Groceries</option>
                </select>
              </div>

              <button type="submit" className="primary-btn glow-btn btn-block mt-2">
                <Plus size={18} />
                <span>Add to Shopping List</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
