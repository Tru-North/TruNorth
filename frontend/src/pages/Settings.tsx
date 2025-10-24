import React from "react";
import { useNavigate } from "react-router-dom";
import BottomNav from "../components/BottomNav";
import "../styles/global.css";
import "../styles/settings.css";

import { 
  FaUser, 
  FaBell, 
  FaLock, 
  FaInfoCircle, 
  FaFileAlt, 
  FaGlobe, 
  FaSignOutAlt 
} from "react-icons/fa";
import { FiChevronRight } from "react-icons/fi";

const Settings: React.FC = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/auth", { state: { logout: true } }); // 👈 silently redirect + trigger message
  };

  const settingsOptions = [
    { icon: <FaUser />, label: "Account", onClick: () => navigate("/account") },
    { icon: <FaBell />, label: "Notifications", onClick: () => navigate("/notifications") },
    { icon: <FaLock />, label: "Privacy & Security", onClick: () => navigate("/privacy") },
    { icon: <FaInfoCircle />, label: "Help & Support", onClick: () => navigate("/help") },
    { icon: <FaFileAlt />, label: "Terms of Service", onClick: () => navigate("/terms") },
    { icon: <FaGlobe />, label: "Language", value: "English", onClick: () => navigate("/language") },
    { icon: <FaSignOutAlt />, label: "Log Out", onClick: handleLogout },
  ];

  return (
    <div className="mobile-frame settings-container">
      <div className="settings-header">
        <h2>Settings</h2>
      </div>

      <div className="settings-list">
        {settingsOptions.map((item, index) => (
          <div
            key={index}
            className={`settings-item ${item.label === "Log Out" ? "logout" : ""}`}
            onClick={item.onClick}
          >
            <div className="left">
              {item.icon}
              <span>{item.label}</span>
            </div>
            <div className="right">
              {item.value && <span className="value">{item.value}</span>}
              <FiChevronRight />
            </div>
          </div>
        ))}
      </div>

      <BottomNav />
    </div>
  );
};

export default Settings;
