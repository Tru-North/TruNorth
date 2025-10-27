import React from "react";
import botLogo from "../assets/onboarding/logo.svg"; // 👈 your bot icon
import "../styles/global.css";

interface ChatBubbleProps {
  sender: "bot" | "user";
  text: string;
  options?: string[];
  onOptionSelect?: (option: string) => void;
}

const ChatBubble: React.FC<ChatBubbleProps> = ({
  sender,
  text,
  options,
  onOptionSelect,
}) => {
  const isUser = sender === "user";

  return (
    <div
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        alignItems: "flex-start",
        marginBottom: "0.8rem",
        width: "100%",
        padding: "0 1rem",
        gap: isUser ? "0" : "0.6rem",
      }}
    >
      {/* 🤖 Bot Avatar */}
      {!isUser && (
        <img
          src={botLogo}
          alt="Bot"
          style={{
            width: "28px",
            height: "28px",
            borderRadius: "50%",
            marginTop: "3px",
          }}
        />
      )}

      {/* 💬 Message bubble */}
      <div
        style={{
            backgroundColor: isUser ? "#ffffff" : "var(--accent)", // 🔄 swapped colors
            color: isUser ? "#000" : "#fff",
            padding: "0.8rem 1rem",
            borderRadius: "16px",
            maxWidth: "85%",
            wordBreak: "break-word",
            boxShadow: isUser
            ? "0 2px 6px rgba(0,0,0,0.08)" // soft shadow for user bubble
            : "none",
            fontSize: "0.95rem",
            lineHeight: "1.5",
        }}
      >
        {text}

        {/* 🎯 Render options (multi-choice) */}
        {options && options.length > 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              marginTop: "0.6rem",
              gap: "0.4rem",
            }}
          >
            {options.map((option, idx) => (
              <button
                key={idx}
                onClick={() => onOptionSelect && onOptionSelect(option)}
                style={{
                  backgroundColor: "#fff",
                  border: "1px solid var(--accent)",
                  color: "var(--accent)",
                  borderRadius: "10px",
                  padding: "6px 10px",
                  cursor: "pointer",
                  fontSize: "0.9rem",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(event) => {
                  event.currentTarget.style.backgroundColor = "var(--accent)";
                  event.currentTarget.style.color = "#fff";
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.backgroundColor = "#fff";
                  event.currentTarget.style.color = "var(--accent)";
                }}
              >
                {option}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatBubble;
