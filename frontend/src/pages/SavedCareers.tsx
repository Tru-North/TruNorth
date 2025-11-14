import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiX, FiMenu} from "react-icons/fi";
import BottomNav from "../components/BottomNav";
import Sidebar from "../components/Sidebar";
import ChatBubbleStatic from "../components/ChatBubbleStatic";
import DeleteConfirmModal from "../components/DeleteConfirmModal";
import {
  getFavoriteRecommendations,
  saveRecommendation,
} from "../services/recommendationService";
import "../styles/SavedCareers.css";
import DeleteIcon from "../assets/career_path_card/saved_career_delete_button.svg";

const SavedCareers: React.FC = () => {
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [savedCareers, setSavedCareers] = useState<any[]>([]);
  const [selectedCareer, setSelectedCareer] = useState<any | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSaved = async () => {
      try {
        const res = await getFavoriteRecommendations();
        setSavedCareers(res.items || []);
      } catch (err) {
        console.error("Error fetching favorites:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchSaved();
  }, []);

  const handleExplore = (id: number) => navigate(`/career/${id}`);

  const handleDeleteClick = (career: any) => {
    setSelectedCareer(career);
    setShowModal(true);
  };

  const confirmDelete = async () => {
    if (!selectedCareer) return;
    try {
      await saveRecommendation({ career_id: selectedCareer.id }); // toggle off
      setSavedCareers((prev) => prev.filter((c) => c.id !== selectedCareer.id));
    } catch (err) {
      console.error("Error removing favorite:", err);
    } finally {
      setShowModal(false);
      setSelectedCareer(null);
    }
  };

  return (
    <div className="mobile-frame saved-careers-page">
      {/* ✅ Header */}
      <div className="saved-header">
        <FiX className="saved-header-icon left" onClick={() => navigate("/journey")} />
        <h3 className="saved-header-title">Saved Careers</h3>
        <FiMenu
          className="saved-header-icon right"
          onClick={() => setIsSidebarOpen(true)}
        />
      </div>

      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <div className="saved-body">
        <ChatBubbleStatic text="Hi user, this is where you'll find your saved careers." />

        <hr className="saved-divider" />

        {loading ? (
          <p className="saved-loading">Loading...</p>
        ) : savedCareers.length === 0 ? (
          <p className="saved-empty">No saved careers yet.</p>
        ) : (
          <div className="saved-list">
            {savedCareers.map((career) => (
              <div key={career.id} className="saved-item">
                <span className="career-title">{career.title}</span>
                <div className="saved-actions">
                  <button
                    className="explore-btn"
                    onClick={() => handleExplore(career.id)}
                  >
                    Explore
                  </button>
                  <img
                    src={DeleteIcon}
                    alt="Delete"
                    className="delete-icon"
                    onClick={() => handleDeleteClick(career)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && selectedCareer && (
        <DeleteConfirmModal
          title={selectedCareer.title}
          onCancel={() => setShowModal(false)}
          onConfirm={confirmDelete}
        />
      )}

      <BottomNav />
    </div>
  );
};

export default SavedCareers;
