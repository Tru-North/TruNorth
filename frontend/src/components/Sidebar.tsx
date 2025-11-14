import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/sidebar.css";
import { FaSearch, FaUserCircle } from "react-icons/fa";
import starIcon from "../assets/side_navbar/star_icon.svg";
import trunorthIcon from "../assets/trunorth/trunorth_icon.svg";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

interface Section {
  category: string;
  display_name: string;
  order: number;
}

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const userId = localStorage.getItem("user_id");
  const firstName = localStorage.getItem("first_name") || "User";

  const [sections, setSections] = useState<Section[]>([]);
  const [completedSections, setCompletedSections] = useState<number[]>([]);
  const [isQuestionnaireComplete, setIsQuestionnaireComplete] =
    useState<boolean>(false);

  // 🟣 Fetch questionnaire sections
  useEffect(() => {
    const fetchSections = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/questionnaire/`);
        const data = await res.json();
        if (data?.data?.sections) setSections(data.data.sections);
      } catch (err) {
        console.error("❌ Failed to load sections:", err);
      }
    };
    fetchSections();
  }, []);

  // 🟢 Fetch user progress (responses)
  useEffect(() => {
    if (!userId) return;
    const fetchProgress = async () => {
      try {
        const rRes = await fetch(`${API_BASE_URL}/questionnaire/responses/${userId}`);
        const rData = await rRes.json();

        if (rData?.data && Array.isArray(rData.data)) {
          const completedCategories = Array.from(
            new Set(rData.data.map((r: any) => r.category))
          );

          const completedIndexes = completedCategories
            .map((cat: string) =>
              sections.findIndex((s) => s.category === cat)
            )
            .filter((i: number) => i !== -1);

          setCompletedSections(completedIndexes);
        }
      } catch (err) {
        console.error("⚠️ Failed to fetch user progress:", err);
      }
    };
    fetchProgress();
  }, [userId, sections]);

  // 🧠 Fetch full questionnaire completion status (same as BottomNav)
  useEffect(() => {
    const fetchCompletion = async () => {
      try {
        if (!userId) return;
        const response = await fetch(`${API_BASE_URL}/questionnaire/progress/${userId}`);
        if (response.ok) {
          const data = await response.json();
          setIsQuestionnaireComplete(data?.is_completed === true);
        }
      } catch (err) {
        console.error("❌ Failed to fetch completion:", err);
      }
    };
    fetchCompletion();
  }, [userId]);

  // 🧭 Handlers
  const handleCoachClick = () => {
    if (!isQuestionnaireComplete) return;
    onClose();
    navigate("/coach");
  };

  const handleQuestionnaireClick = (index: number, category: string) => {
    const isLocked = index > 0 && !completedSections.includes(index - 1);
    if (!isLocked) {
      onClose();
      navigate(`/questionnaire?section=${index}&category=${category}`);
    }
  };

  const handleProfileClick = () => {
    onClose();
    navigate("/aboutYou");
  };

  const handleExploreMatches = () => {
    onClose();
    navigate("/explorematches");
  };

  const handleSavedCareers = () => {
    onClose();
    navigate("/savedcareers");
  };

  return (
    <div className={`sidebar-wrapper ${isOpen ? "open" : ""}`}>
      <div className="sidebar-overlay" onClick={onClose}></div>

      <div className="sidebar">
        {/* Header */}
        <div className="sidebar-header">
          <img src={trunorthIcon} alt="TruNorth Logo" className="sidebar-logo" />
          <h3 className="sidebar-title">TruNorth</h3>
        </div>

        <p className="sidebar-chats-title">Chats</p>

        {/* Search */}
        <div className="search-box">
          <FaSearch className="search-icon" />
          <input type="text" placeholder="Search chats" />
        </div>

        <div className="divider" />

        {/* Coach */}
        <div className="sidebar-section">
          <div className="section-header">
            <img src={starIcon} className="star-icon" />
            <h4>Coach</h4>
          </div>
          <p
            className={`section-subtext ${!isQuestionnaireComplete ? "locked" : "clickable"}`}
            onClick={handleCoachClick}
          >
            Your ongoing conversation with Ruby
          </p>
        </div>

        <div className="divider" />

        {/* Questionnaire */}
        <div className="sidebar-section">
          <div className="section-header">
            <img src={starIcon} className="star-icon" />
            <h4>Questionnaire</h4>
          </div>
          <ul>
            {sections.map((section, i) => {
              const isLocked = !completedSections.includes(i);
              return (
                <li
                  key={section.category}
                  onClick={() =>
                    !isLocked && handleQuestionnaireClick(i, section.category)
                  }
                  className={`sidebar-item ${isLocked ? "locked" : "unlocked"}`}
                >
                  {section.display_name}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="divider" />

        {/* Matches */}
        <div className="sidebar-section">
          <div className="section-header">
            <img src={starIcon} className="star-icon" />
            <h4>Matches</h4>
          </div>
          <ul>
            <li className="sidebar-item unlocked" onClick={handleExploreMatches}>
              Explore Matches
            </li>
            <li className="sidebar-item unlocked" onClick={handleSavedCareers}>
              Saved Career Matches
            </li>
          </ul>
        </div>

        {/* Footer */}
        <div className="sidebar-footer">
          <div className="footer-left" onClick={handleProfileClick} style={{ cursor: "pointer" }}>
            <FaUserCircle className="profile-icon" />
            <div className="footer-user-info">
              <p className="footer-name">{firstName}</p>
              <p className="footer-plan">Free</p>
            </div>
          </div>
          <button className="footer-upgrade" disabled>
            Upgrade
          </button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
