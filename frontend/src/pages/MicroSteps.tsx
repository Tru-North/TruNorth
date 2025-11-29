import React, { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { FiArrowLeft, FiMenu } from "react-icons/fi";

import BottomNav from "../components/BottomNav";
import Sidebar from "../components/Sidebar";
import ChatBubbleStatic from "../components/ChatBubbleStatic";

import "../styles/MicroSteps.css";
import "../styles/global.css";

import microstepsService from "../services/microstepsService";

import CompletedIcon from "../assets/microsteps/completed_microstep_list_icon.svg";
import InProgressIcon from "../assets/microsteps/inprogress_microstep_list_icon.svg";
import UnexploredIcon from "../assets/microsteps/unexplored_microstep_list_icon.svg";

// ✅ UNIVERSAL LOADER
import ContentLoader from "../components/ContentLoader";

interface MicrostepItem {
  id: number;
  title: string;
  description: string;
  status: "unexplored" | "in-progress" | "completed";
}

type MicrostepStatus = MicrostepItem["status"];

/* ------------------------------------------------------
   STATUS ICON COMPONENT
------------------------------------------------------ */
const StatusIndicator: React.FC<{ status: MicrostepStatus }> = ({ status }) => {
  if (status === "completed")
    return (
      <div className="status-indicator completed">
        <img src={CompletedIcon} width={20} height={20} />
      </div>
    );

  if (status === "in-progress")
    return (
      <div className="status-indicator in-progress">
        <img src={InProgressIcon} width={20} height={20} />
      </div>
    );

  return (
    <div className="status-indicator unexplored">
      <img src={UnexploredIcon} width={20} height={20} />
    </div>
  );
};

/* ------------------------------------------------------
   MAIN PAGE
------------------------------------------------------ */
const Microsteps: React.FC = () => {
  const { id } = useParams<{ id: string }>(); // career_id from URL
  const navigate = useNavigate();
  const location = useLocation();

  const career = (location.state as any)?.career;
  const fromIndex = (location.state as any)?.fromIndex ?? 0;

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeFilter, setActiveFilter] =
    useState<"all" | "unexplored" | "in-progress" | "completed">("all");

  const [microsteps, setMicrosteps] = useState<MicrostepItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [microstepId, setMicrostepId] = useState<number | null>(null);
  const [careerTitleFromAPI, setCareerTitleFromAPI] = useState<string | null>(null);

  /* ------------------------------------------------------
      STATUS MAPPER
  ------------------------------------------------------ */
  const mapBackendStatusToUI = (status: string | null | undefined): MicrostepStatus => {
    if (status === "completed") return "completed";
    if (status === "in_progress") return "in-progress";
    return "unexplored";
  };

  /* ------------------------------------------------------
      STAGE 1.4 LOADER — SMART GET FIRST → THEN GENERATE
  ------------------------------------------------------ */
  useEffect(() => {
    const careerId = career?.id ?? (id ? Number(id) : undefined);
    if (!careerId) return;

    const loadMicrosteps = async () => {
      console.log("🔵 Stage 1.4 → Loading microsteps for career_id:", careerId);
      setLoading(true);
      setError(null);

      try {
        // STEP 1 → GET ALL MICROSTEPS
        const all = await microstepsService.getAllMicrosteps();

        const existing = all.find((m: any) => m.career_id === careerId);

        if (existing) {
          setMicrostepId(existing.id);

          try {
            const detail = await microstepsService.getMicrostepDetail(existing.id);

            const steps = detail?.data?.steps ?? [];
            const mapped = steps.map((step: any, index: number) => ({
              id: index,
              title: step.title ?? `Step ${index + 1}`,
              description: step.mini_description ?? "",
              status: mapBackendStatusToUI(step.status),
            }));

            if (detail.career_title) setCareerTitleFromAPI(detail.career_title);

            setMicrosteps(mapped);
            setLoading(false);
            return;
          } catch (err) {
            console.log("🔴 Error loading existing microstep detail → regenerating…");
          }
        }

        // STEP 2 → GENERATE IF NOT FOUND
        const gen = await microstepsService.generateMicrosteps(careerId);

        setMicrostepId(gen.microstep_id ?? null);
        if (gen.career_title) setCareerTitleFromAPI(gen.career_title);

        const steps = gen?.data?.steps ?? [];
        const mapped = steps.map((step: any, index: number) => ({
          id: index,
          title: step.title ?? `Step ${index + 1}`,
          description: step.mini_description ?? "",
          status: mapBackendStatusToUI(step.status),
        }));

        setMicrosteps(mapped);
      } catch (err) {
        console.error("❗ ERROR LOADING MICROSTEPS:", err);
        setError("Could not load microsteps. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    loadMicrosteps();
  }, [career?.id, id]);

  /* ------------------------------------------------------
      UI COMPUTATIONS
  ------------------------------------------------------ */
  const completedCount = microsteps.filter((s) => s.status === "completed").length;
  const totalCount = microsteps.length;
  const progressPercentage = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

  const filteredMicrosteps =
    activeFilter === "all"
      ? microsteps
      : microsteps.filter((s) => s.status === activeFilter);

  /* ------------------------------------------------------
      CLICK HANDLER → MICROSTEP DETAIL
  ------------------------------------------------------ */
  const handleTakeStep = (stepId: number) => {
    const step = microsteps.find((m) => m.id === stepId);
    if (!step) return;

    navigate(`/microstep/${microstepId ?? "unknown"}`, {
      state: {
        step: { ...step, status: "in-progress" },
        career,
        microstepId,
        stepIndex: stepId,
        fromIndex,
      },
    });
  };

  const headerCareerTitle = career?.title || careerTitleFromAPI || "";

  /* ------------------------------------------------------
      RENDER
  ------------------------------------------------------ */
  return (
    <div className="mobile-frame microsteps-page">
      <div className="microsteps-header">
        <FiArrowLeft className="microsteps-header-btn left" onClick={() => navigate(-1)} />
        <div className="microsteps-header-center">
          <h3 className="microsteps-header-title">Microsteps</h3>
          <p className="microsteps-header-subtitle">{headerCareerTitle}</p>
        </div>
        <FiMenu className="microsteps-header-btn right" onClick={() => setIsSidebarOpen(true)} />
      </div>

      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <div className="microsteps-body">
        <div className="microsteps-body-inner">
          <ChatBubbleStatic
            text={`Here are some easy, low-pressure ways to start exploring what it's really like to be a ${headerCareerTitle}.`}
            width="80%"
            showAvatar={true}
          />

          <div className="progress-section">
            <div className="progress-bar-wrap">
              <div className="progress-bar-bg" />
              <div className="progress-bar-fill" style={{ width: `${progressPercentage}%` }} />
            </div>
            <p className="progress-text">
              {completedCount} of {totalCount} steps complete.
            </p>
          </div>

          <div className="filter-row">
            <button
              className={`filter-pill ${activeFilter === "all" ? "active" : ""}`}
              onClick={() => setActiveFilter("all")}
            >
              All
            </button>

            <button
              className={`filter-pill ${activeFilter === "unexplored" ? "active" : ""}`}
              onClick={() => setActiveFilter("unexplored")}
            >
              Unexplored <img src={UnexploredIcon} className="filter-icon-img" />
            </button>

            <button
              className={`filter-pill ${activeFilter === "in-progress" ? "active" : ""}`}
              onClick={() => setActiveFilter("in-progress")}
            >
              In progress <img src={InProgressIcon} className="filter-icon-img" />
            </button>

            <button
              className={`filter-pill ${activeFilter === "completed" ? "active" : ""}`}
              onClick={() => setActiveFilter("completed")}
            >
              Completed <img src={CompletedIcon} className="filter-icon-img" />
            </button>
          </div>

          {/* ❌ OLD INLINE LOADING TEXT REMOVED */}
          {/* ❌ OLD error text kept as-is */}
          {error && <p className="no-steps-message">{error}</p>}

          {/* Steps list */}
          {!loading && filteredMicrosteps.length > 0 && (
            <div className="microsteps-list">
              {filteredMicrosteps.map((step) => (
                <div key={step.id} className={`microstep-card ${step.status}`}>
                  <StatusIndicator status={step.status} />
                  <div className="microstep-main">
                    <h4 className="microstep-title">{step.title}</h4>
                    <p className="microstep-description">{step.description}</p>
                    <div className="microstep-actions">
                      <button
                        className="take-step-btn"
                        onClick={() => handleTakeStep(step.id)}
                      >
                        Take this Step
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && !error && filteredMicrosteps.length === 0 && (
            <p className="no-steps-message">No steps in this category yet.</p>
          )}
        </div>
      </div>

      <BottomNav />

      {/* ✅ UNIVERSAL LOADER OVERLAY */}
      {loading && <ContentLoader text="Loading microsteps…" />}
    </div>
  );
};

export default Microsteps;
