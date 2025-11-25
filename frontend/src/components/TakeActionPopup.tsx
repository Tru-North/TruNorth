import React, { useEffect } from "react";
import "../styles/take_action_popup.css";
import arrowIcon from "../assets/journey/take_action_popup_journey_map_arrow_icon.svg";

interface CareerActionItem {
  career_profile_id: number;
  career_name: string;
}

interface TakeActionPopupProps {
  careers: CareerActionItem[];
  onClose: () => void;
  onSelect: (careerId: number) => void;
}

const TakeActionPopup: React.FC<TakeActionPopupProps> = ({
  careers,
  onClose,
  onSelect,
}) => {

  // Log careers whenever popup opens
  useEffect(() => {
    console.log("🟣 TAKE ACTION POPUP — Careers received:", careers);

    careers.forEach((c, i) => {
      console.log(`   👉 Career #${i + 1}:`, {
        id: c.career_profile_id,
        name: c.career_name,
      });
    });
  }, [careers]);

  return (
    <div className="tap-overlay">
      <div className="tap-container">

        {/* Close area outside */}
        <div className="tap-overlay-click" onClick={onClose}></div>

        <div className="tap-box">
          {/* Arrow at top */}
          <img src={arrowIcon} alt="arrow" className="tap-arrow" />

          <h2 className="tap-title">Continue Conversation</h2>
          <p className="tap-subtitle">
            Which path do you want to take action on?
          </p>

          <div className="tap-buttons-wrapper">
            {careers.map((career) => (
              <button
                key={career.career_profile_id}
                className="tap-bubble"
                onClick={() => {
                  console.log("👉 User clicked career:", career);
                  onSelect(career.career_profile_id);
                }}
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

export default TakeActionPopup;
