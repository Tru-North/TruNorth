import React from "react";
import "../styles/ChatBubbleStatic.css";
import AssistantIcon from "../assets/trunorth/trunorth_icon.svg";

interface ChatBubbleStaticProps {
  text: string;
  width?: string;
  showAvatar?: boolean;
}

const ChatBubbleStatic: React.FC<ChatBubbleStaticProps> = ({
  text,
  width = "75%",
  showAvatar = true,
}) => {
  return (
    <div className="chatbubble-static-wrapper">
      {showAvatar && (
        <div className="chatbubble-static-avatar">
          <img src={AssistantIcon} alt="AI" className="chatbubble-static-avatar-img" />
        </div>
      )}
      <div className="chatbubble-static-bubble" style={{ maxWidth: width }}>
        <p className="chatbubble-static-text">{text}</p>
      </div>
    </div>
  );
};

export default ChatBubbleStatic;
