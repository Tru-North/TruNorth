import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "../styles/bottomnav.css";
import { FaLock } from "react-icons/fa";

// 🔹 Import all SVG assets
import journeyActive from "../assets/bottom_navbar/journey_icon_active.svg";
import journeyInactive from "../assets/bottom_navbar/journey_icon_inactive.svg";
import coachIcon from "../assets/trunorth/trunorth_icon.svg";
import youActive from "../assets/bottom_navbar/user_icon_active.svg";
import youInactive from "../assets/bottom_navbar/user_icon_inactive.svg";
import spotlight from "../assets/bottom_navbar/spotlight_icon.svg";

const BottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isQuestionnaireComplete, setIsQuestionnaireComplete] =
    useState<boolean>(false);

  // 🧠 Fetch progress from backend
  useEffect(() => {
    const fetchProgress = async () => {
      try {
        const userId = localStorage.getItem("user_id");
        if (!userId) return;

        const response = await fetch(
          `${import.meta.env.VITE_API_BASE_URL}/questionnaire/progress/${userId}`
        );
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
    {
      name: "Journey",
      path: "/journey",
      activeIcon: journeyActive,
      inactiveIcon: journeyInactive,
    },
    {
      name: "AI Coach",
      path: "/coach",
      activeIcon: coachIcon, // same icon but spotlight will show when active
      inactiveIcon: coachIcon,
      locked: !isQuestionnaireComplete,
    },
    {
      name: "You",
      path: "/aboutYou",
      activeIcon: youActive,
      inactiveIcon: youInactive,
    },
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
      {tabs.map((tab) => {
        const isActive = location.pathname === tab.path;
        return (
          <div
            key={tab.name}
            className={`nav-item ${isActive ? "active" : ""} ${
              tab.locked ? "locked" : ""
            }`}
            onClick={() => handleClick(tab)}
          >
            <div className="icon-wrapper">
              {isActive && <img src={spotlight} alt="spotlight" className="spotlight" />}
              <img
                src={isActive ? tab.activeIcon : tab.inactiveIcon}
                alt={tab.name}
                className="nav-icon"
              />
              {tab.locked && <FaLock className="lock-icon" />}
            </div>
            <span className={`nav-label ${isActive ? "active-text" : ""}`}>
              {tab.name}
            </span>
          </div>
        );
      })}
    </nav>
  );
};

export default BottomNav;
