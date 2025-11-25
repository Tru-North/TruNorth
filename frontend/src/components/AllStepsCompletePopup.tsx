import React from "react";
import "../styles/AllStepsCompletePopup.css";
import AllCompleteIcon from "../assets/microsteps/all_microsteps_complete_celebration_popup_icon.svg";

interface Props {
  isOpen: boolean;
  onExploreCareers: () => void;
  onReady: () => void;
}

const AllMicrostepsCompletePopup: React.FC<Props> = ({
  isOpen,
  onExploreCareers,
  onReady,
}) => {
  if (!isOpen) return null;

  return (
    <div className="all-microsteps-overlay">
      <div className="all-microsteps-popup">
        <img
          src={AllCompleteIcon}
          className="popup-illustration"
          alt="Complete"
        />

        <h2 className="popup-title">Microsteps Completed!</h2>

        <p className="popup-subtitle">
          Great work completing your microsteps!
          <br />
          Ready to begin your new career?
        </p>

        <div className="popup-btn-row">
          <button className="popup-btn-outline" onClick={onExploreCareers}>
            Explore other careers
          </button>

          <button className="popup-btn-filled" onClick={onReady}>
            I’m ready
          </button>
        </div>
      </div>
    </div>
  );
};

export default AllMicrostepsCompletePopup;
