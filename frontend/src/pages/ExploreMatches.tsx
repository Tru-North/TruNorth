import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import BottomNav from "../components/BottomNav";
import Sidebar from "../components/Sidebar";
import CareerPathCard from "../components/CareerPathCard";
import ChatBubbleStatic from "../components/ChatBubbleStatic";
import Loader from "../components/Loader"
import {
  getLatestRecommendations,
  generateRecommendations,
  saveRecommendation,
  dismissRecommendation,
} from "../services/recommendationService";
import { CareerCard } from "../types/recommendations";
import { FiX, FiMenu } from "react-icons/fi";
import "../styles/global.css";
import "../styles/ExploreMatches.css";
import SearchButton from "../assets/career_path_card/search_button_no_more_recommendations.svg";
import ReloadButton from "../assets/career_path_card/reload_for_load_more_button.svg";

const ExploreMatches: React.FC = () => {

  const navigate = useNavigate();
  const location = useLocation();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [recommendations, setRecommendations] = useState<CareerCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(
    (location.state as any)?.index ?? 0
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // 🔹 Fetch recommendations
  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        console.log("🔹 Fetching latest recommendations...");
        setLoading(true);

        const latest = await getLatestRecommendations();
        console.log("🟢 Latest response:", latest);

        if (latest && latest.items && latest.items.length > 0) {
          console.log("✅ Found existing recommendations");
          setRecommendations(latest.items);
        } else {
          console.log("⚠️ No existing items, generating new...");
          await triggerGeneration();
        }
      } catch (err: any) {
        console.warn("⚠️ First fetch failed, triggering generation:", err);
        await triggerGeneration(); // fallback if 400 or network issue
      } finally {
        setLoading(false);
      }
    };

    const triggerGeneration = async () => {
      try {
        setIsGenerating(true);
        const genRes = await generateRecommendations({ top_k: 5 });
        console.log("🟢 Generated:", genRes);

        const refreshed = await getLatestRecommendations();
        console.log("🟢 Refetched after generation:", refreshed);
        setRecommendations(refreshed.items || []);
      } catch (err) {
        console.error("❌ Generation also failed:", err);
        setError("Failed to load recommendations.");
      } finally {
        setIsGenerating(false);
      }
    };

    fetchRecommendations();
  }, []);


  // 🔹 Navigation
  const handleNext = () =>
    setCurrentIndex((prev) => (prev + 1) % recommendations.length);
  const handlePrevious = () =>
    setCurrentIndex((prev) => (prev - 1 + recommendations.length) % recommendations.length);

  // 🔹 Save / Dismiss / Explore
  const handleSave = async (id: number, newState: boolean) => {
    try {
      await saveRecommendation({ career_id: id });
      setRecommendations((prev) =>
        prev.map((rec) =>
          rec.id === id ? { ...rec, user_action: newState ? "saved" : "no_action" } : rec
        )
      );
    } catch (err) {
      console.error("Error saving recommendation:", err);
    }
  };

  const handleDismiss = async (id: number) => {
    try {
      await dismissRecommendation({ career_id: id });
      setRecommendations((prev) => prev.filter((rec) => rec.id !== id));
    } catch (err) {
      console.error("Error dismissing recommendation:", err);
    }
  };

  const handleExplore = (id: number) => {
    navigate(`/career/${id}`, {
      state: { fromIndex: currentIndex },   // send index to ActionPlanPreview
    });
  };

  // 🔹 Load More
  const handleLoadMore = async () => {
    try {
      setIsGenerating(true);
      await generateRecommendations({ top_k: 5 });
      const refreshed = await getLatestRecommendations();
      setRecommendations(refreshed.items);
      setCurrentIndex(0);
    } catch (err) {
      console.error("Error generating new recommendations:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  const currentCard = recommendations[currentIndex];

  return (
    <div
      className="mobile-frame"
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-start",
        alignItems: "stretch",
        width: "100%",
      }}
    >
      {/* ✅ Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "56px",
          background: "#fff",
          position: "relative",
          flexShrink: 0,
          maxWidth: "390px",
          margin: "0 auto",
          width: "100%",
        }}
      >
        <FiX
          onClick={() => navigate("/journey")}
          style={{
            position: "absolute",
            left: "16px",
            fontSize: "22px",
            cursor: "pointer",
            color: "#000",
          }}
        />
        <h3
          style={{
            fontSize: "16px",
            fontWeight: 700,
            color: "#000",
            margin: 0,
          }}
        >
          Explore Career Matches
        </h3>
        <FiMenu
          className="aboutyou-menu"
          onClick={() => setIsSidebarOpen(true)}
          style={{
            position: "absolute",
            right: "16px",
            fontSize: "22px",
            cursor: "pointer",
            color: "#000",
          }}
        />
      </div>

      {/* Sidebar */}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Body */}
      <div
        className="explore-body"
        style={{
          paddingBottom: "16px 16px 16px 16px", // ensures space before bottom nav
        }}
      >       
        {/* 🟣 Static AI Message */}
        <ChatBubbleStatic
          text={`I've gathered a few career paths that seem like a great fit for you.\nLet's explore what feels right!`}
        />

        {/* Career Card */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-start",
            marginTop: "-6px",
            transform: "scale(0.9)",
            transformOrigin: "top center",
          }}
        >
          {loading ? (
            <Loader text="Fetching your personalized career matches..." />
          ) : error ? (
            <p style={{ color: "red", fontSize: "13px" }}>{error}</p>
          ) : recommendations.length === 0 ? (
            <div className="empty-state">
              <img
                src={SearchButton}
                alt="No matches illustration"
                className="empty-illustration"
              />
              <h4>No more recommendations</h4>
              <p>Looks like you’ve explored all current matches.  
                Let’s find new opportunities just for you!</p>
              <button
                onClick={handleLoadMore}
                disabled={isGenerating}
                className="loadmore-btn"
              >
                <img
                  src={ReloadButton}
                  alt="Reload"
                  className="loadmore-icon"
                />
                {isGenerating ? "Loading..." : "Load more matches"}
              </button>
            </div>

          ) : (
            <CareerPathCard
              card={{
                id: currentCard.id!,
                title: currentCard.title,
                industries: currentCard.industry_tag || "General",
                salary: currentCard.salary_range
                  ? `$${currentCard.salary_range.min?.toLocaleString()} - $${currentCard.salary_range.max?.toLocaleString()}`
                  : "N/A",
                matchPercentage: Math.round(currentCard.fit_score),
                growth: currentCard.growth_trend || "→ 0%",
                reasons: (currentCard.why_this_fits || "")
                  .split("\n")
                  .filter(Boolean)
                  .map((line, i) => ({
                    icon: (["check", "users", "code", "lightbulb", "target", "message"][
                      i % 6
                    ] ??
                      "check") as
                      | "check"
                      | "users"
                      | "code"
                      | "lightbulb"
                      | "target"
                      | "message",
                    text: line,
                  })),
                skills: currentCard.top_skills || [],
                tips: currentCard.tips || [],
                isBookmarked: currentCard.user_action === "saved",
              }}
              totalCards={recommendations.length}
              currentIndex={currentIndex}
              onNext={handleNext}
              onPrevious={handlePrevious}
              onSave={handleSave}
              onDismiss={handleDismiss}
              onExplore={handleExplore}
            />
          )}
        </div>

        {/* Load More button */}
        {!loading && recommendations.length > 0 && (
          <div className="explore-loadmore-container">
            <button
              onClick={handleLoadMore}
              disabled={isGenerating}
              className="loadmore-btn"
            >
              <img
                src={ReloadButton}
                alt="Reload"
                className={`loadmore-icon ${isGenerating ? "spinning" : ""}`}
              />
              {isGenerating ? "Loading..." : "Load more matches"}
            </button>
          </div>
        )}

      </div>

      <BottomNav />
    </div>
  );
};

export default ExploreMatches;
