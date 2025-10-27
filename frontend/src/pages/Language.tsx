import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import BottomNav from "../components/BottomNav";
import Sidebar from "../components/Sidebar";
import { FiArrowLeft, FiMenu } from "react-icons/fi";
import "../styles/global.css";

const Language: React.FC = () => {
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div
      className="mobile-frame"
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-start",
        alignItems: "stretch",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "56px",
          background: "#fff",
          position: "relative",
          flexShrink: 0,
        }}
      >
        <FiArrowLeft
          onClick={() => navigate(-1)}
          style={{
            position: "absolute",
            left: "16px",
            fontSize: "22px",
            cursor: "pointer",
            color: "#000",
          }}
        />
        <h3
          style={{
            fontSize: "18px",
            fontWeight: 600,
            color: "#000",
            margin: 0,
          }}
        >
          Language
        </h3>
        <FiMenu
          className="aboutyou-menu"
          onClick={() => setIsSidebarOpen(true)}
          style={{
            position: "absolute",
            right: "16px",
            fontSize: "22px",
            cursor: "pointer",
            color: "#000",
          }}
        />
      </div>

      {/* Sidebar */}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Body */}
      <div
        style={{
          flex: 1,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          flexDirection: "column",
          gap: "12px",
          background: "#fff",
        }}
      >
        <span style={{ fontSize: "20px" }}>🏗️ Page under construction</span>
      </div>

      <BottomNav />
    </div>
  );
};

export default Language;
