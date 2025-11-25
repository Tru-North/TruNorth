// frontend/src/components/SaveProgressPopup.tsx
import React from "react";
import "../styles/SaveProgressPopup.css";
import SaveProgressIcon from "../assets/microsteps/save_progress_icon.svg";

interface SaveProgressPopupProps {
  isOpen: boolean;
  onKeepGoing: () => void;
  onSaveAndExit: () => void;
}

const SaveProgressPopup: React.FC<SaveProgressPopupProps> = ({
  isOpen,
  onKeepGoing,
  onSaveAndExit,
}) => {
  if (!isOpen) return null;

  return (
    <div className="save-progress-overlay">
      <div className="save-progress-card">

        <img
          src={SaveProgressIcon}
          alt="Save Progress"
          className="save-progress-icon"
        />

        <h3 className="save-progress-title">Save Progress</h3>

        <p className="save-progress-text">
          Do you wish to save your progress for<br />
          this microstep before you exit
        </p>

        <div className="save-progress-actions">

          <button className="popup-btn-keep" onClick={onKeepGoing}>
            Keep Going
          </button>

          <button className="popup-btn-save" onClick={onSaveAndExit}>
            Save And Exit
          </button>

        </div>
      </div>
    </div>
  );
};

export default SaveProgressPopup;
