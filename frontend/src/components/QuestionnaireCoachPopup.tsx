import React from "react";
import "../styles/questionnaireCoachPopup.css";
import ArrowIcon from "../assets/questionnaire/progress_popup_icon.svg";

const QuestionnaireCoachPopup = ({ onGoToCoach, onContinue }) => {
  return (
    <div className="qn-coach-popup-overlay">
      <div className="qn-coach-popup">
        <img src={ArrowIcon} className="qn-coach-popup-icon" />

        <h2 className="qn-coach-title">Nice progress.</h2>
        <p className="qn-coach-text">
          Are you ready to chat with your coach or do you want to go deeper
          with some more questions first?
        </p>

        <div className="qn-coach-buttons">
          <button className="qn-btn-outline" onClick={onGoToCoach}>
            Go To Coach
          </button>
          <button className="qn-btn-filled" onClick={onContinue}>
            Continue
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuestionnaireCoachPopup;
