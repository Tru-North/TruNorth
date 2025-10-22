import React from "react";
import journeySVG from "../assets/onboarding/sample_journey.svg";

interface Props {
  onNext: () => void;
}

const OnboardingStep1: React.FC<Props> = ({ onNext }) => {
  return (
    <div className="onboarding-screen">
      {/* Entire SVG journey */}
      <img src={journeySVG} alt="Career journey path" className="journey-svg" />

      {/* Text and CTA */}
      <div className="text-block">
        <h2>Your Journey starts here</h2>
        <p>
          In a few minutes, your AI coach will help you uncover your{" "}
          <span className="accent">strengths</span>, explore{" "}
          <span className="accent">new directions</span>, and design a{" "}
          <span className="accent">career path</span> that fits who you are, not
          just what you do.
        </p>
      </div>

      <button className="next-btn" onClick={onNext}>
        Meet Your Coach
      </button>
    </div>
  );
};

export default OnboardingStep1;
