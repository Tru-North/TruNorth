import React from "react";
import BottomNav from "../components/BottomNav";
import "../styles/global.css";

const Journey: React.FC = () => {
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
        <h2 style={{ color: "var(--text)" }}>Journey Map will be here 🗺️</h2>
      </div>
      <BottomNav />
    </div>
  );
};

export default Journey;
