import React from "react";

const TypingIndicator: React.FC = () => {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "5px",
        backgroundColor: "#f0f0f0",
        padding: "0.6rem 0.9rem",
        borderRadius: "16px",
        maxWidth: "70%",
        marginLeft: "3.2rem",
        marginBottom: "0.8rem",
        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.08)",
      }}
    >
      <span className="dot" />
      <span className="dot" />
      <span className="dot" />
    </div>
  );
};

export default TypingIndicator;
