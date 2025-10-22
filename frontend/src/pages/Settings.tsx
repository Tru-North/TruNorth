import React from "react";
import BottomNav from "../components/BottomNav";
import { useNavigate } from "react-router-dom";
import "../styles/global.css";

const Settings: React.FC = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    const confirmLogout = window.confirm("Are you sure you want to log out?");
    if (confirmLogout) {
      localStorage.removeItem("token");
      navigate("/auth");
    }
  };

  return (
    <div className="mobile-frame">
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          gap: "20px",
        }}
      >
        <h2 style={{ color: "var(--text)" }}>Settings ⚙️</h2>
        <button
          onClick={handleLogout}
          style={{
            padding: "10px 24px",
            borderRadius: "12px",
            background: "var(--accent)",
            color: "white",
            fontSize: "16px",
            fontWeight: "500",
            cursor: "pointer",
            border: "none",
          }}
        >
          Log Out
        </button>
      </div>
      <BottomNav />
    </div>
  );
};

export default Settings;
