// frontend/src/components/ChatBubbleCoach.tsx
import React, { useRef } from "react";
import ReactMarkdown from "react-markdown";
import botLogo from "../assets/trunorth/trunorth_icon.svg";
import LikeIcon from "../assets/ai_coach/coach_reply_like_icon.svg";
import DislikeIcon from "../assets/ai_coach/coach_reply_dislike_icon.svg";
import SpeakerIcon from "../assets/ai_coach/coach_reply_speaker_icon.svg";
import "../styles/global.css";

interface ChatBubbleCoachProps {
  role: "assistant" | "user";
  content: string;
  feedbackState?: "like" | "dislike" | null;
  onFeedback?: (type: "like" | "dislike") => void;
  // ✅ now passes the speaker icon's bounding rect
  onPlayTTS?: (iconRect: DOMRect | null) => void;
}

const ChatBubbleCoach: React.FC<ChatBubbleCoachProps> = ({
  role,
  content,
  feedbackState,
  onFeedback,
  onPlayTTS,
}) => {
  const isUser = role === "user";
  const speakerRef = useRef<HTMLImageElement | null>(null);

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
      {/* 🤖 Coach Avatar */}
      {!isUser && (
        <img
          src={botLogo}
          alt="Coach"
          style={{
            width: "34px",
            height: "34px",
            borderRadius: "50%",
            objectFit: "cover",
            marginBottom: "4px",
          }}
        />
      )}

      {/* 💬 Message bubble */}
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
          position: "relative",
        }}
      >
        {isUser ? (
          content
        ) : (
          <ReactMarkdown
            components={{
              p: ({ node, ...props }) => (
                <p style={{ marginBottom: "0.6rem", lineHeight: "1.5" }} {...props} />
              ),
              ul: ({ node, ...props }) => (
                <ul
                  style={{
                    margin: "0.4rem 0 0.4rem 1.2rem",
                    lineHeight: "1.5",
                  }}
                  {...props}
                />
              ),
              ol: ({ node, ...props }) => (
                <ol
                  style={{
                    margin: "0.4rem 0 0.4rem 1.2rem",
                    lineHeight: "1.5",
                  }}
                  {...props}
                />
              ),
              li: ({ node, ...props }) => (
                <li style={{ marginBottom: "0.4rem" }} {...props} />
              ),
              strong: ({ node, ...props }) => (
                <strong style={{ fontWeight: 600 }} {...props} />
              ),
              em: ({ node, ...props }) => (
                <em style={{ fontStyle: "italic" }} {...props} />
              ),
            }}
          >
            {content}
          </ReactMarkdown>
        )}

        {/* 👍👎🔊 Feedback Buttons (assistant only) */}
        {!isUser && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.6rem",
              marginTop: "0.5rem",
            }}
          >
            <img
              src={LikeIcon}
              alt="Like"
              style={{
                width: "18px",
                height: "18px",
                opacity: feedbackState === "like" ? 1 : 0.6,
                cursor: "pointer",
              }}
              onClick={() => onFeedback && onFeedback("like")}
            />
            <img
              src={DislikeIcon}
              alt="Dislike"
              style={{
                width: "18px",
                height: "18px",
                opacity: feedbackState === "dislike" ? 1 : 0.6,
                cursor: "pointer",
              }}
              onClick={() => onFeedback && onFeedback("dislike")}
            />
            <img
              ref={speakerRef}
              src={SpeakerIcon}
              alt="Play"
              style={{ width: "18px", height: "18px", cursor: "pointer" }}
              onClick={() =>
                onPlayTTS &&
                onPlayTTS(speakerRef.current?.getBoundingClientRect() ?? null)
              }
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatBubbleCoach;
