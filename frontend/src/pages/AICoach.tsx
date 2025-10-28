import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import BottomNav from "../components/BottomNav";
import Sidebar from "../components/Sidebar";
import { FiX, FiMenu } from "react-icons/fi";
import "../styles/global.css";

const AICoach: React.FC = () => {
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
        background: "#fff",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "70px",
          background: "#fff",
          position: "relative",
          flexShrink: 0,
          borderBottom: "1px solid #eee",
          flexDirection: "column",
          paddingTop: "5px",
        }}
      >
        {/* Cross (Back to Journey) */}
        <FiX
          onClick={() => navigate("/journey")}
          style={{
            position: "absolute",
            left: "16px",
            fontSize: "22px",
            cursor: "pointer",
            color: "#000",
          }}
        />

        {/* Title and Subtitle */}
        <div style={{ textAlign: "center" }}>
          <h3
            style={{
              fontSize: "18px",
              fontWeight: 700,
              color: "#000",
              margin: "0",
              fontFamily: "Outfit, sans-serif",
            }}
          >
            TruNorthAI Assistant
          </h3>
          <p
            style={{
              fontSize: "13px",
              color: "#666",
              margin: "2px 0 0",
            }}
          >
            Chat with you personlized Career Coach
          </p>
        </div>

        {/* Hamburger */}
        <FiMenu
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
          background: "#fff",
          textAlign: "center",
          padding: "1rem",
        }}
      >
        <h2 style={{ color: "#0f1416", fontSize: "20px", fontWeight: 500 }}>
          🤖 AI Coach screen coming soon
        </h2>
      </div>

      <BottomNav />
    </div>
  );
};

export default AICoach;
