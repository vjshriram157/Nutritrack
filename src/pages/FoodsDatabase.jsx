import React, { useState, useEffect } from "react";
import { getVerifiedFoods, seedFirestoreFoods } from "../services/dbService";
import { useToast } from "../context/ToastContext";
import EmptyState from "../components/EmptyState";
import {
  Search,
  Plus,
  Heart,
  CheckCircle,
  Database,
  X,
  Utensils
} from "lucide-react";

export default function FoodsDatabase() {
  const { showToast } = useToast();
  const [foods, setFoods] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [favorites, setFavorites] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("nt_fav_foods") || "[]");
    } catch {
      return [];
    }
  });

  // Add Food Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newFood, setNewFood] = useState({
    foodName: "",
    calories: "",
    carbs: "",
    fat: "",
    protein: "",
    fiber: "",
    imageUrl: ""
  });

  useEffect(() => {
    async function load() {
      const data = await getVerifiedFoods();
      setFoods(data || []);
    }
    load();
  }, []);

  const toggleFavorite = (foodId, e) => {
    e.stopPropagation();
    setFavorites((prev) => {
      const updated = prev.includes(foodId)
        ? prev.filter((id) => id !== foodId)
        : [...prev, foodId];
      try {
        localStorage.setItem("nt_fav_foods", JSON.stringify(updated));
      } catch (err) {}
      return updated;
    });
  };

  const filteredFoods = foods.filter((f) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      f.foodName.toLowerCase().includes(q) ||
      (f.aliases || []).some((a) => a.toLowerCase().includes(q))
    );
  });

  const handleAddNewFood = (e) => {
    e.preventDefault();
    if (!newFood.foodName.trim() || !newFood.calories) {
      showToast("Missing Info", "Please enter food name and calories.", "warning");
      return;
    }

    const created = {
      foodId: `custom_${Date.now()}`,
      foodName: newFood.foodName.trim(),
      caloriesPer100g: parseFloat(newFood.calories) || 0,
      carbsPer100g: parseFloat(newFood.carbs) || 0,
      fatPer100g: parseFloat(newFood.fat) || 0,
      proteinPer100g: parseFloat(newFood.protein) || 0,
      fibrePer100g: parseFloat(newFood.fiber) || 0,
      imageUrl: newFood.imageUrl.trim() || "https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=160&auto=format&fit=crop&q=80",
      isVerified: false
    };

    setFoods((prev) => [created, ...prev]);
    setShowAddModal(false);
    setNewFood({
      foodName: "",
      calories: "",
      carbs: "",
      fat: "",
      protein: "",
      fiber: "",
      imageUrl: ""
    });
    showToast("Food Added", `${created.foodName} added to your food database.`, "success");
  };

  return (
    <div className="ref-foods-page-container">
      {/* Top Search & Actions Bar (Screenshot 3 Reference) */}
      <div className="ref-foods-action-row">
        <div className="ref-search-input-box">
          <Search size={18} className="ref-search-icon" />
          <input
            type="text"
            placeholder="Search Food"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <button
          type="button"
          className="ref-add-food-btn"
          onClick={() => setShowAddModal(true)}
        >
          <Plus size={16} />
          <span>Add Food</span>
        </button>
      </div>

      {/* Modern Table matching Screenshot 3 */}
      <div className="ref-table-card-container">
        <div className="ref-table-responsive">
          <table className="ref-food-table">
            <thead>
              <tr>
                <th className="th-image">Image</th>
                <th className="th-name">Name</th>
                <th className="th-num">Calories</th>
                <th className="th-num">Carbs</th>
                <th className="th-num">Fat</th>
                <th className="th-num">Protein</th>
                <th className="th-num">Fiber</th>
                <th className="th-fav">Favourite</th>
              </tr>
            </thead>
            <tbody>
              {filteredFoods.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "40px 16px" }}>
                    <EmptyState
                      icon="🔍"
                      title="No matching foods"
                      description={`No food items match "${searchQuery}".`}
                    />
                  </td>
                </tr>
              ) : (
                filteredFoods.map((f) => {
                  const isFav = favorites.includes(f.foodId);
                  return (
                    <tr key={f.foodId} className="ref-food-row">
                      {/* Image Thumbnail */}
                      <td className="td-image">
                        <div className="ref-food-thumb-wrap">
                          {f.imageUrl ? (
                            <img
                              src={f.imageUrl}
                              alt={f.foodName}
                              className="ref-food-thumb"
                              loading="lazy"
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = "https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=160&auto=format&fit=crop&q=80";
                              }}
                            />
                          ) : (
                            <div className="ref-food-thumb-fallback">
                              <Utensils size={18} />
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Name */}
                      <td className="td-name">
                        <span className="ref-food-title">{f.foodName}</span>
                      </td>

                      {/* Calories */}
                      <td className="td-num">
                        <span className="ref-num-cell">{Math.round(f.caloriesPer100g || 0)}</span>
                      </td>

                      {/* Carbs */}
                      <td className="td-num">
                        <span className="ref-num-cell">{(f.carbsPer100g || 0).toFixed(1)}g</span>
                      </td>

                      {/* Fat */}
                      <td className="td-num">
                        <span className="ref-num-cell">{(f.fatPer100g || 0).toFixed(1)}g</span>
                      </td>

                      {/* Protein */}
                      <td className="td-num">
                        <span className="ref-num-cell">{(f.proteinPer100g || 0).toFixed(1)}g</span>
                      </td>

                      {/* Fiber */}
                      <td className="td-num">
                        <span className="ref-num-cell">{(f.fibrePer100g || 0).toFixed(1)}</span>
                      </td>

                      {/* Favourite */}
                      <td className="td-fav">
                        <button
                          type="button"
                          className={`ref-fav-heart-btn ${isFav ? "active" : ""}`}
                          onClick={(e) => toggleFavorite(f.foodId, e)}
                          title={isFav ? "Remove from Favorites" : "Add to Favorites"}
                        >
                          <Heart
                            size={18}
                            className={isFav ? "fill-current text-rose-500" : "text-gray-400"}
                          />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Food Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Add Food to Database</span>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setShowAddModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddNewFood} className="modal-body">
              <div className="form-group">
                <label className="form-label">Food Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Basic Eggs, Paneer Tikka"
                  value={newFood.foodName}
                  onChange={(e) => setNewFood({ ...newFood, foodName: e.target.value })}
                  className="form-input"
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div className="form-group">
                  <label className="form-label">Calories / 100g *</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="e.g. 183"
                    value={newFood.calories}
                    onChange={(e) => setNewFood({ ...newFood, calories: e.target.value })}
                    className="form-input"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Protein (g)</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="e.g. 12.6"
                    value={newFood.protein}
                    onChange={(e) => setNewFood({ ...newFood, protein: e.target.value })}
                    className="form-input"
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                <div className="form-group">
                  <label className="form-label">Carbs (g)</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="0.7"
                    value={newFood.carbs}
                    onChange={(e) => setNewFood({ ...newFood, carbs: e.target.value })}
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Fat (g)</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="14.2"
                    value={newFood.fat}
                    onChange={(e) => setNewFood({ ...newFood, fat: e.target.value })}
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Fiber (g)</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="0.0"
                    value={newFood.fiber}
                    onChange={(e) => setNewFood({ ...newFood, fiber: e.target.value })}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Image URL (Optional)</label>
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/..."
                  value={newFood.imageUrl}
                  onChange={(e) => setNewFood({ ...newFood, imageUrl: e.target.value })}
                  className="form-input"
                />
              </div>

              <div className="modal-actions" style={{ marginTop: "16px" }}>
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="primary-btn">
                  Save Food
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
