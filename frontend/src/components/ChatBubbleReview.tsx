import React from "react";
import ReactMarkdown from "react-markdown";
import botLogo from "../assets/trunorth/trunorth_icon.svg";

interface ChatBubbleReviewProps {
  role: "assistant" | "user";
  content: string;
}

const ChatBubbleReview: React.FC<ChatBubbleReviewProps> = ({
  role,
  content
}) => {
  const isUser = role === "user";

  return (
    <div
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        alignItems: "flex-start",
        marginBottom: "18px",
        width: "100%",
        gap: isUser ? "0" : "10px"
      }}
    >
      {!isUser && (
        <img
          src={botLogo}
          alt="AI"
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "50%",
            marginTop: "4px"
          }}
        />
      )}

      <div
        style={{
          backgroundColor: isUser ? "#ffffff" : "#B1A2FF",
          color: isUser ? "#000" : "#fff",
          padding: "12px 16px",
          borderRadius: isUser
            ? "16px 16px 4px 16px"
            : "16px 16px 16px 4px",
          maxWidth: "80%",
          width: "fit-content",
          wordBreak: "break-word",
          boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
          fontSize: "15px",
          lineHeight: "1.5"
        }}
      >
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </div>
  );
};

export default ChatBubbleReview;
