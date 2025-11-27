import React from "react";
import "../styles/launch_popup.css";
import arrowIcon from "../assets/journey/launch_popup_journey_map_arrow_icon.svg";

interface CareerLaunchItem {
  career_profile_id: number;
  title: string;
}

interface LaunchPopupProps {
  careers: CareerLaunchItem[];
  onClose: () => void;
  onSelect: (careerId: number) => void;
}

const LaunchPopup: React.FC<LaunchPopupProps> = ({
  careers,
  onClose,
  onSelect,
}) => {
  return (
    <div className="lp-overlay">
      <div className="lp-container">

        {/* Close area */}
        <div className="lp-overlay-click" onClick={onClose}></div>

        <div className="lp-box">
          {/* Arrow */}
          <img src={arrowIcon} alt="arrow" className="lp-arrow" />

          <h2 className="lp-title">Ready to Launch</h2>
          <p className="lp-subtitle">Which path do you want to launch?</p>

          <div className="lp-buttons-wrapper">
            {careers.map((career) => (
              <button
                key={career.career_profile_id}
                className="lp-bubble"
                onClick={() => onSelect(career.career_profile_id)}
              >
                {career.title}
              </button>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
};

export default LaunchPopup;
