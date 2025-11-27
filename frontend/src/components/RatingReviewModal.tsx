import React, { useState } from "react";
import "../styles/RatingReviewModal.css";
import "../styles/global.css";

import UnratedStar from "../assets/ready_to_launch/unrated_star_icon.svg";
import RatedStar from "../assets/ready_to_launch/rated_star_icon.svg";

interface RatingReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (rating: number, feedback: string) => void;
}

const RatingReviewModal: React.FC<RatingReviewModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [rating, setRating] = useState<number>(0);
  const [hoveredRating, setHoveredRating] = useState<number>(0);
  const [feedback, setFeedback] = useState<string>("");

  const handleSubmit = () => {
    if (rating > 0) {
      onSubmit(rating, feedback);
      handleClose();
    }
  };

  const handleClose = () => {
    setRating(0);
    setHoveredRating(0);
    setFeedback("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="rrm-overlay" onClick={handleClose}>
      <div className="rrm-modal" onClick={(e) => e.stopPropagation()}>
        
        <h2 className="rrm-title">Rating & Review</h2>

        {/* ⭐ Stars */}
        <div className="rrm-stars">
          {[1, 2, 3, 4, 5].map((star) => {
            const isFilled = (hoveredRating || rating) >= star;
            return (
              <button
                key={star}
                className="rrm-star-btn"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoveredRating(star)}
                onMouseLeave={() => setHoveredRating(0)}
              >
                <img
                  src={isFilled ? RatedStar : UnratedStar}
                  alt={`${star} star`}
                  className="rrm-star-icon"
                />
              </button>
            );
          })}
        </div>

        <p className="rrm-question">
          How was your experience with this career path?
        </p>

        <textarea
          className="rrm-textarea"
          placeholder="Write us a feedback..."
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
        />

        <button
          className="rrm-submit-btn"
          onClick={handleSubmit}
          disabled={rating === 0}
        >
          Submit
        </button>

        <button className="rrm-skip-btn" onClick={handleClose}>
          Skip for now
        </button>
      </div>
    </div>
  );
};

export default RatingReviewModal;
