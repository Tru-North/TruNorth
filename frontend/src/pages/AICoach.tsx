import React from "react";
import BottomNav from "../components/BottomNav";
import "../styles/global.css";

const AICoach: React.FC = () => {
  return (
    <div className="mobile-frame">
      <div
        style={{
          flex: 1,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <h2 style={{ color: "var(--text)" }}>AI Coach screen coming soon 🤖</h2>
      </div>
      <BottomNav />
    </div>
  );
};

export default AICoach;
