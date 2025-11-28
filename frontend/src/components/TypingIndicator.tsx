import React from "react";
import botLogo from "../assets/trunorth/trunorth_icon.svg";
import "../styles/typingindicator.css";

const TypingIndicator: React.FC = () => {
  return (
    <div className="typing-wrapper">
      <img src={botLogo} alt="bot" className="typing-avatar" />

      <div className="typing-bubble">
        <span className="typing-dot"></span>
        <span className="typing-dot"></span>
        <span className="typing-dot"></span>
      </div>
    </div>
  );
};

export default TypingIndicator;
