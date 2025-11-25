// frontend/src/components/MicrostepCompletePopup.tsx
import React from "react";
import "../styles/MicrostepCompletePopup.css";
import CompleteIcon from "../assets/microsteps/microstep_complete_celebration_popup_icon.svg";

interface MicrostepCompletePopupProps {
  isOpen: boolean;
  onStayHere: () => void;
  onBackToMicrosteps: () => void;
}

const MicrostepCompletePopup: React.FC<MicrostepCompletePopupProps> = ({
  isOpen,
  onStayHere,
  onBackToMicrosteps,
}) => {
  if (!isOpen) return null;

  return (
    <div className="microstep-complete-overlay">
      <div className="microstep-complete-card updated-popup">

        <img
          src={CompleteIcon}
          alt="celebration"
          className="microstep-complete-illustration updated-illustration"
        />

        <h3 className="microstep-complete-title updated-title">
          Step Complete!
        </h3>

        <p className="microstep-complete-text updated-text">
          Nice work, every small step brings you closer to your next milestone.
        </p>

        <div className="popup-actions">
          <button className="popup-btn-stay" onClick={onStayHere}>
            Stay here
          </button>

          <button className="popup-btn-back" onClick={onBackToMicrosteps}>
            Back to microsteps
          </button>
        </div>

      </div>
    </div>
  );
};

export default MicrostepCompletePopup;
