// frontend/src/components/ChatBubbleReflection.tsx

import React from "react";
import botLogo from "../assets/trunorth/trunorth_icon.svg";
import "../styles/global.css";

interface ChatBubbleReflectionProps {
  role: "assistant" | "user";
  content: string;
}

const ChatBubbleReflection: React.FC<ChatBubbleReflectionProps> = ({
  role,
  content,
}) => {
  const isUser = role === "user";

  return (
    <div
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        alignItems: "flex-end",
        marginBottom: "10px",

        /* 🔥 FIXED — remove huge left/right padding */
        padding: "0 4px",

        width: "100%",
        gap: isUser ? "0" : "6px",
      }}
    >
      {/* Assistant avatar */}
      {!isUser && (
        <img
          src={botLogo}
          alt="Reflection Bot"
          style={{
            width: "30px",
            height: "30px",
            borderRadius: "50%",
            objectFit: "cover",
            marginBottom: "4px",
            flexShrink: 0,
          }}
        />
      )}

      {/* Bubble */}
      <div
        style={{
          backgroundColor: isUser ? "#ffffff" : "var(--accent)",
          color: isUser ? "#000" : "#fff",
          padding: "10px 14px",

          borderRadius: isUser
            ? "16px 16px 4px 16px"
            : "16px 16px 16px 4px",

          /* 🔥 FIXED — make bubble full width, no shrinking */
          maxWidth: "100%",
          width: "fit-content",

          wordBreak: "break-word",
          boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
          fontSize: "13px",
          lineHeight: "1.45",
        }}
      >
        {content}
      </div>
    </div>
  );
};

export default ChatBubbleReflection;
