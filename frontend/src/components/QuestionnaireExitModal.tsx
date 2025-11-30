import React from "react";
import "../styles/questionnaire.css";
import ExitPopupIcon from "../assets/chatIntro_and_questionnaire/exit_popup_icon.svg";

interface QuestionnaireExitModalProps {
  show: boolean;
  isSavingExit: boolean;
  onKeepGoing: () => void;
  onSaveAndExit: () => void;
}

const QuestionnaireExitModal: React.FC<QuestionnaireExitModalProps> = ({
  show,
  isSavingExit,
  onKeepGoing,
  onSaveAndExit
}) => {
  if (!show) return null;

  return (
    <div className="exit-modal-overlay">
      <div className="exit-modal purple-theme">

        <div className="exit-icon-container">
          <img
            src={ExitPopupIcon}
            alt="exit popup icon"
            width={32}
            height={32}
            style={{ display: "block" }}
          />
        </div>

        <h2 className="exit-title white">Leaving already?</h2>

        {isSavingExit ? (
          <p className="exit-text white">Saving your progress...</p>
        ) : (
          <>
            <p className="exit-text white">We will save your progress</p>

            <div className="exit-buttons">
              <button className="btn-keep outlined" onClick={onKeepGoing}>
                Keep Going
              </button>

              <button
                className="btn-exit filled"
                onClick={onSaveAndExit}
              >
                Save And Exit
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default QuestionnaireExitModal;
