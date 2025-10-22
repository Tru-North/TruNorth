import React from "react";
import replyBubbles from "../assets/onboarding/reply_bubbles.svg";
import logo from "../assets/onboarding/logo.svg";

interface Props {
  onNext: () => void;
  onBack: () => void;
}

const OnboardingStep2: React.FC<Props> = ({ onNext }) => {
  return (
    <div className="onboarding-screen chat-static">
      <div className="text-block">
        <h2>Meet Ruby, your personal career coach</h2>
        <p className="subtext">
          Ruby will guide you through quick chats to uncover your goals,
          strengths, and values.
        </p>
      </div>

      <div className="chat-area">
        <div className="ruby-chat-left">
          <img src={logo} alt="Ruby Logo" className="ruby-avatar-left" />
          <div className="ruby-bubbles">
            <div className="bubble-primary">
              Hi, I’m Ruby! Your TruNorth Coach.
            </div>
            <div className="bubble-secondary">
              Thinking about a career change or even just exploring possibilities
              can feel exciting, overwhelming, or somewhere in between. <br />
              What brings you here today?
            </div>
            <img
              src={replyBubbles}
              alt="Reply Bubbles"
              className="reply-bubbles right"
            />
          </div>
        </div>
      </div>

      <button className="next-btn" onClick={onNext}>
        Let’s Begin
      </button>
    </div>
  );
};

export default OnboardingStep2;
