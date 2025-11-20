import React from "react";
import "../../styles/AdminUserReview.css";

import CompanyLogo from "../../assets/trunorth/trunorth_icon.svg";
import ClockIcon from "../../assets/admin/admin_user_review_clock_icon.svg";

const AdminUserReview: React.FC = () => {
  return (
    <div className="admin-review-page">

      {/* TOP GLOBAL HEADER (STICKY) */}
      <div className="header-top">
        <header className="review-page-header">
          <div className="page-header-inner">
            <img src={CompanyLogo} className="page-header-logo" />
            <span className="page-header-title">Review Dashboard</span>
          </div>
        </header>
      </div>

      {/* SECOND HEADER (USER INFO) — NOT STICKY */}
      <div className="header-sub">
        <div className="review-user-header">

          {/* USER ID */}
          <div className="review-user-section">
            <span className="review-user-label">User ID</span>
            <span className="review-user-value">4582</span>
          </div>

          {/* LAST LOGIN */}
          <div className="review-user-section">
            <img src={ClockIcon} className="review-user-icon" />
            <span className="review-user-label">Last login:</span>
            <span className="review-user-value">Oct 31, 2025 — 09:42 AM</span>
          </div>

          {/* AI CONFIDENCE */}
          <div className="review-user-confidence">
            AI Confidence: 92%
          </div>

        </div>
      </div>

      {/* MAIN CONTENT WRAPPER */}
      <div className="admin-review-wrapper">
        <div className="admin-review-layout">

          {/* LEFT SIDE (chat etc — empty for now) */}
          <div className="review-left"></div>

          {/* VERTICAL LINE */}
          <div className="review-divider"></div>

          {/* RIGHT SIDE PANEL */}
          <div className="review-right">
            <h2 className="review-right-title">Review Tool</h2>
          </div>

        </div>
      </div>

    </div>
  );
};

export default AdminUserReview;
