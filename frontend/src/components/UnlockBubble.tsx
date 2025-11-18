import React from "react";
import CareerUnlockedIcon from "../assets/ai_coach/career_matches_unlocked.svg";

interface UnlockBubbleProps {
  onYes: () => void;
  onNotNow: () => void;
}

const UnlockBubble: React.FC<UnlockBubbleProps> = ({ onYes, onNotNow }) => {
  return (
    <div
      style={{
        background: "#9D8BF9",      // Soft purple matching screenshot
        borderRadius: "20px",
        padding: "10px",
        margin: "10px",
        maxWidth: "100%",
        alignSelf: "flex-start",
        color: "#fff",
        boxShadow: "0 4px 10px rgba(0,0,0,0.15)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
      }}
    >
      {/* Icon */}
      <img
        src={CareerUnlockedIcon}
        alt="Career Matches Unlocked"
        style={{
          width: "32px",
          height: "32px",
          marginBottom: "10px",
        }}
      />

      {/* Title */}
      <h3
        style={{
          margin: "0 0 6px 0",
          fontSize: "13px",
          fontWeight: 600,
          color: "#FFFFFF",
        }}
      >
        Career Matches Unlocked
      </h3>

      {/* Body Text */}
      <p
        style={{
          margin: "0 0 8px 0",
          fontSize: "11px",
          fontWeight: 400,
          lineHeight: "1.4",
          color: "#F5F3FF",
          textAlign: "left"
        }}
      >
        Career matches milestone is now unlocked.
        <br />
        Would you like to go there now?
      </p>

      {/* Buttons */}
      <div style={{ display: "flex", gap: "12px" }}>
        <button
          onClick={onNotNow}
          style={{
            padding: "5px 12px",
            borderRadius: "10px",
            background: "#EFECFC",
            border: "1px solid #333",
            fontWeight: 600,
            color: "#333",
            cursor: "pointer",
            minWidth: "88px",
          }}
        >
          Not now
        </button>

        <button
          onClick={onYes}
          style={{
            padding: "5px 12px",
            borderRadius: "10px",
            background: "#FFFFFF",
            color: "#333",
            border: "1px solid #333",
            fontWeight: 600,
            cursor: "pointer",
            minWidth: "70px",
          }}
        >
          Yes
        </button>
      </div>
    </div>
  );
};

export default UnlockBubble;
