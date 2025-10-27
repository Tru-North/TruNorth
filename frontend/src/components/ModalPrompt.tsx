import React from "react";
import "../styles/global.css";

interface ModalPromptProps {
  isOpen: boolean;
  title: string;
  message: string;
  primaryText: string;
  secondaryText: string;
  onPrimary: () => void;
  onSecondary: () => void;
}

const ModalPrompt: React.FC<ModalPromptProps> = ({
  isOpen,
  title,
  message,
  primaryText,
  secondaryText,
  onPrimary,
  onSecondary,
}) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "rgba(0,0,0,0.4)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 100,
        animation: "fadeIn 0.3s ease-in",
      }}
    >
      <div
        style={{
          backgroundColor: "var(--accent)",
          width: "85%",
          maxWidth: "340px",
          borderRadius: "22px",
          padding: "1.8rem 1.5rem",
          textAlign: "center",
          color: "#fff",
          boxShadow: "0 8px 20px rgba(0,0,0,0.2)",
        }}
      >
        {/* ❓ Icon */}
        <div
          style={{
            fontSize: "2rem",
            marginBottom: "0.3rem",
          }}
        >
          ❓
        </div>

        {/* Title */}
        <h3
          style={{
            fontWeight: 700,
            fontSize: "1.1rem",
            marginBottom: "0.4rem",
          }}
        >
          {title}
        </h3>

        {/* Description */}
        <p
          style={{
            fontSize: "0.9rem",
            color: "#f8f8f8",
            marginBottom: "1.4rem",
            lineHeight: "1.4",
          }}
        >
          {message}
        </p>

        {/* Buttons */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "0.6rem",
          }}
        >
          <button
            onClick={onPrimary}
            style={{
              backgroundColor: "#fff",
              color: "#000",
              border: "none",
              borderRadius: "10px",
              padding: "0.5rem 1rem",
              fontWeight: 600,
              cursor: "pointer",
              flex: 1,
              boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
            }}
          >
            {primaryText}
          </button>

          <button
            onClick={onSecondary}
            style={{
              backgroundColor: "transparent",
              color: "#fff",
              border: "2px solid #fff",
              borderRadius: "10px",
              padding: "0.5rem 1rem",
              fontWeight: 600,
              cursor: "pointer",
              flex: 1,
            }}
          >
            {secondaryText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModalPrompt;
