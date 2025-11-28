import React from "react";
import ReactMarkdown from "react-markdown";
import botLogo from "../assets/trunorth/trunorth_icon.svg";
import "../styles/global.css";

interface ChatBubbleCoachLiteProps {
  sender: "bot" | "user";
  text: string;
}

const ChatBubbleCoachLite: React.FC<ChatBubbleCoachLiteProps> = ({
  sender,
  text,
}) => {
  const isUser = sender === "user";

  return (
    <div
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        alignItems: "flex-end",
        marginBottom: "1rem",
        width: "100%",
        paddingRight: "1rem",
        paddingLeft: isUser ? "1rem" : "0",
        gap: isUser ? "0" : "0.6rem",
      }}
    >
      {/* 🤖 Bot Avatar */}
      {!isUser && (
        <img
          src={botLogo}
          alt="Bot"
          style={{
            width: "34px",
            height: "34px",
            borderRadius: "50%",
            objectFit: "cover",
            marginBottom: "4px",
          }}
        />
      )}

      {/* 💬 Bubble */}
      <div
        style={{
          backgroundColor: isUser ? "#ffffff" : "var(--accent)",
          color: isUser ? "#000" : "#fff",
          padding: "0.9rem 1.1rem",
          borderRadius: isUser
            ? "16px 16px 4px 16px"
            : "16px 16px 16px 4px",
          maxWidth: "95%",
          width: "fit-content",
          wordBreak: "break-word",
          boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
          fontSize: "0.95rem",
          lineHeight: "1.5",
        }}
      >
        {/* markdown support for bot */}
        {!isUser ? (
          <ReactMarkdown
            components={{
              p: ({ ...props }) => (
                <p style={{ marginBottom: "0.6rem", lineHeight: "1.5" }} {...props} />
              ),
              ul: ({ ...props }) => (
                <ul
                  style={{
                    margin: "0.4rem 0 0.4rem 1.2rem",
                    lineHeight: "1.5",
                  }}
                  {...props}
                />
              ),
              ol: ({ ...props }) => (
                <ol
                  style={{
                    margin: "0.4rem 0 0.4rem 1.2rem",
                    lineHeight: "1.5",
                  }}
                  {...props}
                />
              ),
              li: ({ ...props }) => (
                <li style={{ marginBottom: "0.4rem" }} {...props} />
              ),
              strong: ({ ...props }) => (
                <strong style={{ fontWeight: 600 }} {...props} />
              ),
              em: ({ ...props }) => (
                <em style={{ fontStyle: "italic" }} {...props} />
              ),
            }}
          >
            {text}
          </ReactMarkdown>
        ) : (
          text
        )}
      </div>
    </div>
  );
};

export default ChatBubbleCoachLite;
