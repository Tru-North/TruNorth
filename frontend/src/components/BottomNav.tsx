import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import journeyIcon from "../assets/onboarding/journey_map_icon.svg";
import aiCoachIcon from "../assets/onboarding/logo.svg";
import settingsIcon from "../assets/onboarding/settings_icon.svg";
import "../styles/bottomnav.css";

const BottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const tabs = [
    { name: "Journey", path: "/journey", icon: journeyIcon },
    { name: "AI Coach", path: "/coach", icon: aiCoachIcon },
    { name: "Settings", path: "/settings", icon: settingsIcon },
  ];

  return (
    <nav className="bottom-nav">
      {tabs.map((tab) => (
        <div
          key={tab.name}
          className={`nav-item ${location.pathname === tab.path ? "active" : ""}`}
          onClick={() => navigate(tab.path)}
        >
          <img src={tab.icon} alt={tab.name} className="nav-icon" />
          <span className="nav-label">{tab.name}</span>
        </div>
      ))}
    </nav>
  );
};

export default BottomNav;
