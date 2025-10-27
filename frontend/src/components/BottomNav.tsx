import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import journeyIcon from "../assets/onboarding/journey_map_icon.svg";
import aiCoachIcon from "../assets/onboarding/logo.svg";
import settingsIcon from "../assets/onboarding/settings_icon.svg";
import "../styles/bottomnav.css";
import { FaLock } from "react-icons/fa";

const BottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isQuestionnaireComplete, setIsQuestionnaireComplete] = useState<boolean>(false);

  // 🧠 Fetch progress from backend
  useEffect(() => {
    const fetchProgress = async () => {
      try {
        const userId = localStorage.getItem("user_id"); // ✅ assuming user_id is stored in localStorage
        if (!userId) return;

        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/questionnaire/progress/${userId}`);
        if (response.ok) {
          const data = await response.json();
          setIsQuestionnaireComplete(data?.is_completed === true);
        }
      } catch (err) {
        console.error("❌ Failed to fetch progress:", err);
      }
    };
    fetchProgress();
  }, []);

  const tabs = [
    { name: "Journey", path: "/journey", icon: journeyIcon },
    { name: "AI Coach", path: "/coach", icon: aiCoachIcon, locked: !isQuestionnaireComplete },
    { name: "Settings", path: "/settings", icon: settingsIcon },
  ];

  const handleClick = (tab: any) => {
    if (tab.locked) {
      alert("🔒 Please complete the questionnaire before accessing the AI Coach!");
      return;
    }
    navigate(tab.path);
  };

  return (
    <nav className="bottom-nav">
      {tabs.map((tab) => (
        <div
          key={tab.name}
          className={`nav-item ${location.pathname === tab.path ? "active" : ""} ${
            tab.locked ? "locked" : ""
          }`}
          onClick={() => handleClick(tab)}
        >
          <div className="icon-container">
            <img src={tab.icon} alt={tab.name} className="nav-icon" />
            {tab.locked && <FaLock className="lock-icon" />}
          </div>
          <span className="nav-label">{tab.name}</span>
        </div>
      ))}
    </nav>
  );
};

export default BottomNav;
