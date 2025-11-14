import React from "react";
import "../styles/CareerPathCard.css";
import LeftArrow from "../assets/career_path_card/left_slide_button.svg";
import RightArrow from "../assets/career_path_card/right_slide_button.svg";
import FitLeft1 from "../assets/career_path_card/fits_pt1_left.svg";
import FitRight1 from "../assets/career_path_card/fits_pt1_right.svg";
import FitLeft2 from "../assets/career_path_card/fits_pt2_left.svg";
import FitRight2 from "../assets/career_path_card/fits_pt2_right.svg";
import BookmarkFilled from "../assets/career_path_card/bookmark_filled.svg";
import BookmarkOutline from "../assets/career_path_card/bookmark_outline.svg";
import GrowthUp from "../assets/career_path_card/upward_growth_rate.svg";
import GrowthDown from "../assets/career_path_card/downward_growth_rate.svg";
import GrowthStable from "../assets/career_path_card/stable_growth_rate.svg";

interface Reason {
  icon: string;
  text: string;
}

interface CareerCardProps {
  card: {
    id: number;
    title: string;
    industries: string;
    salary: string;
    matchPercentage: number;
    growth: string;
    reasons: Reason[];
    skills: string[];
    tips: string[];
    isBookmarked: boolean;
  };
  totalCards: number;
  currentIndex: number;
  onNext: () => void;
  onPrevious: () => void;
  onSave: (id: number, state: boolean) => void;
  onDismiss: (id: number) => void;
  onExplore: (id: number) => void;
}

const CareerPathCard: React.FC<CareerCardProps> = ({
  card,
  totalCards,
  currentIndex,
  onNext,
  onPrevious,
  onSave,
  onDismiss,
  onExplore,
}) => {
  if (!card) return null;
  
  // ✅ remove any unwanted bullet symbol from backend text
  const cleanText = (text: string) => text.replace(/^•\s*/, "").trim();

  const parseGrowth = (growthStr: string) => {
    if (!growthStr) return { icon: GrowthStable, color: "#9d8bf9", value: "0%" };

    // Extract arrow + number
    const arrow = growthStr.trim().charAt(0);
    const numberMatch = growthStr.match(/[-+]?\d+(\.\d+)?/);
    const number = numberMatch ? numberMatch[0] : "0";

    // Determine state
    if (arrow === "↑") {
      return {
        icon: GrowthUp,
        color: "#0FA958", // green
        value: `+${number}%`,
      };
    }

    if (arrow === "↓") {
      return {
        icon: GrowthDown,
        color: "#E74C3C", // red
        value: `-${number}%`,
      };
    }

    // Default → stable
    return {
      icon: GrowthStable,
      color: "#9D8BF9", // purple
      value: `${number}%`,
    };
 
  };

  const growth = parseGrowth(card.growth);

  return (
    <div className="career-card-container">
      {/* Left & Right Navigation Buttons */}
      <button className="slide-btn left" onClick={onPrevious}>
        <img src={LeftArrow} alt="Previous" />
      </button>

      <div className="career-card">
        {/* Header */}
        <div className="career-card-header">
          <div className="header-title">Career path match</div>
          <button
            className={`bookmark-btn ${card.isBookmarked ? "bookmarked" : ""}`}
            onClick={() => onSave(card.id, !card.isBookmarked)}
          >
            <span className="bookmark-text">
              {card.isBookmarked ? "Saved" : "Save"}
            </span>
            <img
              src={card.isBookmarked ? BookmarkFilled : BookmarkOutline}
              alt="Bookmark"
              className="bookmark-icon"
            />
          </button>
        </div>

        {/* Body */}
        <div className="career-card-body">
          {/* Title */}
          <div className="career-card-top">
            <div className="career-info">
              <h2>{card.title}</h2>
              <p>{card.industries}</p>
            </div>
            
            {/* Career Growth */}
            <div className="career-growth-block">
              <div className="growth-top">
                <img src={growth.icon} alt="growth" className="growth-icon" />
                <span className="growth-value" style={{ color: growth.color }}>
                  {growth.value}
                </span>
              </div>
              <span className="growth-label" style={{ color: growth.color }}>
                Demand Growth
              </span>
            </div>
          </div>

          {/* Salary + Match */}
          <div className="career-salary-match">
            <div className="salary-tag">{card.salary}</div>
            <div className="match-circle">
              <div className="match-number">{card.matchPercentage}%</div>
              <p className="match-label">Match</p>
            </div>
          </div>

          {/* Why this fits */}
          <div className="career-section">
            <h3>Why this fits you</h3>
            <div className="fit-items">
              {card.reasons.slice(0, 2).map((reason, index) => (
                <div key={index} className="fit-card">
                  <img
                    src={index === 0 ? FitLeft1 : FitLeft2}
                    alt="fit-left"
                    className="fit-left"
                  />
                  <p className="fit-text">{cleanText(reason.text)}</p>
                  <img
                    src={index === 0 ? FitRight1 : FitRight2}
                    alt="fit-right"
                    className="fit-right"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Skills */}
          <div className="career-section">
            <h3>Top skill</h3>
            <div className="skills-grid">
              {card.skills.slice(0, 4).map((skill, i) => (
                <span key={i} className="skill-item">
                  {skill}
                </span>
              ))}
            </div>
          </div>

          {/* Divider Line */}
          <hr className="career-divider" />

          {/* Tips */}
          <div className="career-section">
            <h3>Career Boost Tip</h3>
            <ul className="tips-list">
              {card.tips.map((tip, index) => (
                <li key={index}>{tip}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="career-card-footer">
          <button className="decline-btn" onClick={() => onDismiss(card.id)}>
            Decline
          </button>
          <button className="explore-btn" onClick={() => onExplore(card.id)}>
            Explore
          </button>
        </div>
        <div className="career-card-footer-strip"></div>
      </div>

      {/* Right button */}
      <button className="slide-btn right" onClick={onNext}>
        <img src={RightArrow} alt="Next" />
      </button>
      
    </div>
    
  );
};

export default CareerPathCard;
