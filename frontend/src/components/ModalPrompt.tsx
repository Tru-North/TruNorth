import React from "react";
import "../styles/ModalPrompt.css";

import QuestionIcon from "../assets/chatIntro_and_questionnaire/questionnaire_popup_icon.svg";
import RemindMeIcon from "../assets/chatIntro_and_questionnaire/remind_me_button_icon.svg";

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
    <div className="modal-overlay">
      <div className="modal-card">

        {/* Icon */}
        <div className="modal-icon-wrapper">
          <img src={QuestionIcon} className="modal-question-icon" alt="?" />
        </div>

        {/* Title */}
        <h3 className="modal-title">{title}</h3>

        {/* Message */}
        <p className="modal-message">{message}</p>

        {/* Buttons */}
        <div className="modal-buttons">
          <button className="modal-primary-btn" onClick={onPrimary}>
            {primaryText}
          </button>

          <button className="modal-secondary-btn" onClick={onSecondary}>
            <img src={RemindMeIcon} className="modal-remind-icon" alt="bell" />
            {secondaryText}
          </button>
        </div>

      </div>
    </div>
  );
};

export default ModalPrompt;
