import React, { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { FiArrowLeft, FiMenu } from "react-icons/fi";
import BottomNav from "../components/BottomNav";
import Sidebar from "../components/Sidebar";
import ChatBubbleStatic from "../components/ChatBubbleStatic";
import { getCareerDetail } from "../services/recommendationService";
import "../styles/ActionPlanPreview.css";

const ActionPlanPreview: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  // 🌟 index passed from ExploreMatches
  const fromIndex = (location.state as any)?.fromIndex ?? 0;
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [career, setCareer] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Fetch career detail
  useEffect(() => {
    const fetchCareerDetail = async () => {
      try {
        if (!id) return;
        const data = await getCareerDetail(Number(id));
        console.log("🟢 Career detail response:", data);
        setCareer(data);
      } catch (err) {
        console.error("Error fetching career details:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchCareerDetail();
  }, [id]);

  return (
    <div className="mobile-frame action-plan-page">
      {/* ✅ Header */}
      <div className="action-header">
        <FiArrowLeft
          className="action-header-icon left"
          onClick={() =>
            navigate("/explorematches", {
              state: { index: fromIndex },
            })
          }
        />

        <div className="action-header-title">
          <h3>Action Plan Preview</h3>
          <p>{career?.title || ""}</p>
        </div>

        <FiMenu
          className="action-header-icon right"
          onClick={() => setIsSidebarOpen(true)}
        />
      </div>

      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Body */}
      <div className="action-body">
        {loading ? (
          <p className="loading-text">Fetching your action plan...</p>
        ) : career ? (
          <>
            <ChatBubbleStatic
              text={`Looks like you're ready to step into the world of ${career.title}, exciting!`}
            />

            <div className="action-card">
              <h4>Here’s What We’ll Focus On Next</h4>

              {career.bullets && career.bullets.length > 0 ? (
                <ul className="action-list">
                  {career.bullets.map((step: string, index: number) => (
                    <li key={index}>{step}</li>
                  ))}
                </ul>
              ) : (
                <p className="no-data">No action steps available for this career.</p>
              )}

              <p className="action-description">
                If this path feels right, I’ll save it and set up your
                personalized next steps so you can start taking action.
              </p>

              <button className="ready-btn">Ready To Try This Path?</button>

              <button
                className="explore-btn-alt"
                onClick={() =>
                  navigate("/explorematches", { state: { index: fromIndex } })
                }
              >
                Explore A Different Career Path
              </button>
            </div>
          </>
        ) : (
          <p className="no-data">No action plan available for this career.</p>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default ActionPlanPreview;
