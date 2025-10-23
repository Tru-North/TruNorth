import React from "react";
import { useNavigate } from "react-router-dom";
import BottomNav from "../components/BottomNav";
import { FiArrowLeft } from "react-icons/fi";
import "../styles/global.css";

const Terms: React.FC = () => {
  const navigate = useNavigate();

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
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "56px",
          borderBottom: "1px solid #eee",
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
          Terms of Service
        </h3>
      </div>

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

export default Terms;
