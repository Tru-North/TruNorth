import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import BottomNav from "../components/BottomNav";
import Sidebar from "../components/Sidebar";
import { FiArrowLeft, FiMenu, FiChevronRight, FiSearch } from "react-icons/fi";
import {
  FaUser,
  FaBell,
  FaLock,
  FaInfoCircle,
  FaFileAlt,
  FaGlobe,
  FaSignOutAlt,
} from "react-icons/fa";
import "../styles/global.css";
import "../styles/aboutyou.css";

const AboutYou: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/auth", { state: { logout: true } });
  };

  const aboutOptions = [
    { icon: <FaUser />, label: "Account", onClick: () => navigate("/account") },
    { icon: <FaBell />, label: "Notifications", onClick: () => navigate("/notifications") },
    { icon: <FaLock />, label: "Privacy & Security", onClick: () => navigate("/privacy") },
    { icon: <FaInfoCircle />, label: "Help & Support", onClick: () => navigate("/help") },
    { icon: <FaFileAlt />, label: "Terms of Service", onClick: () => navigate("/terms") },
    { icon: <FaGlobe />, label: "Language", value: "English", onClick: () => navigate("/language") },
    { icon: <FaSignOutAlt />, label: "Log Out", onClick: handleLogout },
  ];

  const filteredOptions = aboutOptions.filter((item) =>
    item.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="mobile-frame aboutyou-container">
      {/* Header */}
      <div className="aboutyou-header">
        <FiArrowLeft className="aboutyou-back" onClick={() => navigate(-1)} />
        <h3>About You</h3>
        <FiMenu
          className="aboutyou-menu"
          onClick={() => setIsSidebarOpen(true)}
        />
      </div>

      {/* Sidebar */}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Search Bar */}
      <div className="aboutyou-search">
        <FiSearch className="search-icon" />
        <input
          type="text"
          placeholder="Search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Options List */}
      <div className="aboutyou-list">
        {filteredOptions.map((item, index) => (
          <div key={index} className="aboutyou-item" onClick={item.onClick}>
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

export default AboutYou;
