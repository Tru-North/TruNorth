import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import BottomNav from "../components/BottomNav";
import Sidebar from "../components/Sidebar";
import RatingReviewModal from "../components/RatingReviewModal";
import ChatBubbleStatic from "../components/ChatBubbleStatic";
import "../styles/global.css";
import "../styles/ReadyToLaunch.css";
import { FiArrowLeft, FiMenu } from "react-icons/fi";

import microstepsService from "../services/microstepsService";
import rocketImage from "../assets/ready_to_launch/summary_page_icon.svg";

// ✅ UNIVERSAL LOADER
import ContentLoader from "../components/ContentLoader";

const ReadyToLaunch: React.FC = () => {
  const navigate = useNavigate();
  const { career_id } = useParams();

  const [microstepId, setMicrostepId] = useState<number | null>(null);
  const [existingRating, setExistingRating] = useState<number | null>(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  // ✅ NEW LOADER
  const [loadingSummary, setLoadingSummary] = useState(true);

  // ---------------------------------------------------
  // STEP 2 + 3 — Load microstep → summary → launch logic
  // ---------------------------------------------------
  useEffect(() => {
    const loadData = async () => {
      setLoadingSummary(true); // ✅ START LOADER

      try {
        console.log("🔵 STEP 2 STARTED — career_id from URL:", career_id);

        if (!career_id) {
          console.warn("⚠️ No career_id found in URL");
          return;
        }

        // 1️⃣ Fetch all microsteps
        const allMicrosteps = await microstepsService.getAllMicrosteps();
        console.log("📌 All microsteps fetched:", allMicrosteps);

        // 2️⃣ Find the microstep for this career
        const selected = allMicrosteps.find(
          (m: any) => m.career_id === Number(career_id)
        );
        console.log("🎯 Matched microstep for this career:", selected);

        if (!selected) {
          console.error("❌ No matching microstep found for career:", career_id);
          return;
        }

        setMicrostepId(selected.id);
        console.log("🆔 microstepId:", selected.id);

        // 3️⃣ FIRST call summary (contains launched_at + rating)
        const summaryResponse = await microstepsService.getLaunchSummary(selected.id);
        console.log("📄 Summary API Response:", summaryResponse);

        setExistingRating(summaryResponse.rating ?? null);

        let launchedAt = summaryResponse.launched_at;
        let summaryData = summaryResponse.progress_summary || null;

        console.log("🚀 launched_at BEFORE:", launchedAt);

        // 4️⃣ Launch only if NEVER launched
        if (!launchedAt) {
          console.log("✨ Launching microstep for the FIRST TIME…");

          const launchResponse = await microstepsService.launchMicrostep(selected.id);
          console.log("🎉 Launch response:", launchResponse);

          launchedAt = launchResponse.launched_at;
          summaryData = launchResponse.progress_summary;
        } else {
          console.log("⏭ Already launched before → skip");
        }

        console.log("🚀 launched_at AFTER:", launchedAt);

        // 5️⃣ Update UI summary
        setSummary(summaryData);

      } catch (err) {
        console.error("🔥 ERROR in loadData:", err);
      } finally {
        setLoadingSummary(false); // ✅ STOP LOADER
      }
    };

    loadData();
  }, [career_id]);

  // ---------------------------------------------------
  // FINISH BUTTON → Show modal only if not rated
  // ---------------------------------------------------
  const handleFinish = () => {
    console.log("🎯 Finish clicked — existingRating:", existingRating);

    if (existingRating !== null && existingRating !== undefined) {
      console.log("✅ Rating already exists — skip modal");
      navigate("/journey");
      return;
    }

    console.log("⭐ No rating yet — open modal");
    setIsModalOpen(true);
  };

  // ---------------------------------------------------
  // SUBMIT RATING
  // ---------------------------------------------------
  const handleModalSubmit = async (rating: number, feedback: string) => {
    try {
      console.log("📤 SUBMIT — rating:", rating, " feedback:", feedback);

      if (!microstepId) {
        console.error("❌ Missing microstepId");
        navigate("/journey");
        return;
      }

      const res = await microstepsService.rateMicrostep(
        microstepId,
        rating,
        feedback
      );

      console.log("✅ Rating saved:", res);

      setExistingRating(rating);
      setIsModalOpen(false);
      navigate("/journey");

    } catch (err) {
      console.error("🔥 ERROR submitting rating:", err);
      navigate("/journey");
    }
  };

  const handleModalClose = () => {
    console.log("⏭ Rating skipped — navigate");
    setIsModalOpen(false);
    navigate("/journey");
  };

  const handleExploreMore = () => {
    navigate("/explorematches");
  };

  return (
    <div className="mobile-frame rtl-page">
      {/* Header */}
      <div className="rtl-header">
        <button
          className="rtl-header-btn left"
          onClick={() => navigate(-1)}
          aria-label="Back"
        >
          <FiArrowLeft size={20} color="#000" />
        </button>

        <div className="rtl-header-center">
          <h3 className="rtl-title">Ready to launch</h3>
          <p className="rtl-subtitle">
            You've made solid progress on this path, well done!
          </p>
        </div>

        <button
          className="rtl-header-btn right"
          onClick={() => setIsSidebarOpen(true)}
          aria-label="Menu"
        >
          <FiMenu size={22} color="#1E1E1E" />
        </button>
      </div>

      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <div className="rtl-body">
        <div className="rtl-rocket-illustration">
          <img
            src={rocketImage}
            alt="Person on rocket"
            className="rtl-rocket-image"
          />
        </div>

        <ChatBubbleStatic
          text="Here is what you were looking for when you started, and how your direction evolved."
          width="90%"
        />

        <div className="rtl-summary-card">
          <div className="rtl-summary-card-inner">
            {summary ? (
              <p className="rtl-summary-text">{summary}</p>
            ) : (
              <p className="rtl-summary-placeholder">Summary will display here</p>
            )}
          </div>
        </div>

        <div className="rtl-action-buttons">
          <button className="rtl-explore-btn" onClick={handleExploreMore}>
            Explore More Matches
          </button>
          <button className="rtl-finish-btn" onClick={handleFinish}>
            Finish
          </button>
        </div>
      </div>

      <div className="bottom-nav-wrapper">
        <BottomNav />
      </div>

      <RatingReviewModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSubmit={handleModalSubmit}
      />

      {/* ✅ UNIVERSAL CONTENT LOADER */}
      {loadingSummary && <ContentLoader text="Loading your summary…" />}
    </div>
  );
};

export default ReadyToLaunch;
