import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { FiMenu, FiArrowLeft } from "react-icons/fi";
import BottomNav from "../components/BottomNav";
import Sidebar from "../components/Sidebar";
import "../styles/MicrostepDetail.css";
import "../styles/global.css";
import ChatBubbleReflection from "../components/ChatBubbleReflection";
import ChatBubbleStatic from "../components/ChatBubbleStatic";
import MicrostepCompletePopup from "../components/MicrostepCompletePopup";
import AllMicrostepsCompletePopup from "../components/AllStepsCompletePopup";
import SaveProgressPopup from "../components/SaveProgressPopup";

import microstepsService from "../services/microstepsService";

import TimeIcon from "../assets/microsteps/estimated_time_clock_icon.svg";
import DifficultyIcon from "../assets/microsteps/difficulty_level_icon.svg";
import GenerateAIIcon from "../assets/microsteps/generate_ai_content_icon.svg";
import SendButtonReflection from "../assets/microsteps/send_button_icon_reflection_chat.svg";

interface ChecklistItem {
  id: number;
  text: string;
  completed: boolean;
}

const MicrostepDetail: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();

  const stepFromNav = (location.state as any)?.step;
  const career = (location.state as any)?.career ?? { title: "" };
  const microstepId = (location.state as any)?.microstepId ?? Number(id);
  const stepIndex = (location.state as any)?.stepIndex ?? 0;

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [stepTitle, setStepTitle] = useState(stepFromNav?.title ?? "");
  const [miniDescription, setMiniDescription] = useState(stepFromNav?.description ?? "");
  const [detailedDescription, setDetailedDescription] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [timeEstimate, setTimeEstimate] = useState("");
  const [careerTitleFromAPI, setCareerTitleFromAPI] = useState("");

  const [careerIdFromAPI, setCareerIdFromAPI] = useState<number | null>(null); // ✅ ADDED

  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);

  const [messages, setMessages] = useState<any[]>([]);
  const [reflectionText, setReflectionText] = useState("");

  const [summaryGenerated, setSummaryGenerated] = useState(false);
  const [summaryText, setSummaryText] = useState("");

  const chatRef = useRef<HTMLDivElement | null>(null);

  const [showCompletePopup, setShowCompletePopup] = useState(false);
  const [showSavePopup, setShowSavePopup] = useState(false);
  const [showAllMicrostepsComplete, setShowAllMicrostepsComplete] = useState(false);

  const [allStepsCompleted, setAllStepsCompleted] = useState(false);

  // ---------------------------------------------------------
  // LOAD MICROSTEP DETAIL
  // ---------------------------------------------------------
  useEffect(() => {
    const loadDetail = async () => {
      console.log("🔵 [LOAD DETAIL] Fetching microstep detail for:", microstepId);

      try {
        const detail = await microstepsService.getMicrostepDetail(microstepId);

        console.log("🔥 FULL MICROSTEP DETAIL:", detail);

        if (detail.career_title) setCareerTitleFromAPI(detail.career_title);

        if (detail.career_id) setCareerIdFromAPI(detail.career_id); // ✅ ADDED

        const steps = detail?.data?.steps ?? [];

        console.log(
          "🔥 STEP STATUSES:",
          steps.map((s: any) => s.status)
        );

        const allCompletedCheck = steps.every((s: any) => s.status === "completed");

        console.log("🔥 allStepsCompleted (AFTER CHECK):", allCompletedCheck);

        setAllStepsCompleted(allCompletedCheck);

        const selected = steps[stepIndex];
        if (!selected) return;

        setStepTitle(selected.title ?? "");
        setMiniDescription(selected.mini_description ?? "");
        setDetailedDescription(selected.detailed_description ?? "");
        setDifficulty(selected.difficulty ?? "");
        setTimeEstimate(selected.time_estimate ?? "");

        const checklistMapped =
          selected.ministeps?.map((m: any, idx: number) => ({
            id: idx,
            text: m.description ? `${m.title}: ${m.description}` : m.title,
            completed: m.status === "completed",
          })) ?? [];

        setChecklist(checklistMapped);

        try {
          const history = await microstepsService.getReflectionChat(microstepId, stepIndex);
          if (Array.isArray(history)) {
            setMessages(
              history.map((m: any, idx: number) => ({
                id: idx,
                role: m.role,
                content: m.message,
              }))
            );
          }
        } catch {}

        try {
          const summary = await microstepsService.getSummary(microstepId, stepIndex);

          if (summary) {
            setSummaryText(summary);
            setSummaryGenerated(true);
          }
        } catch {}
      } catch (err) {
        console.error("❌ Error loading microstep detail:", err);
      }
    };

    loadDetail();
  }, [microstepId, stepIndex]);

  // ---------------------------------------------------------
  // AUTOSCROLL CHAT
  // ---------------------------------------------------------
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  // ---------------------------------------------------------
  // CHECKLIST HANDLER
  // ---------------------------------------------------------
  const toggleChecklistItem = async (itemId: number) => {
    const updated = checklist.map((item) =>
      item.id === itemId ? { ...item, completed: !item.completed } : item
    );

    setChecklist(updated);

    const ministepStatus = updated[itemId].completed ? "completed" : "incomplete";
    const completedCount = updated.filter((c) => c.completed).length;

    let stepStatus: "incomplete" | "in_progress";
    if (completedCount === 0) stepStatus = "incomplete";
    else stepStatus = "in_progress";

    await microstepsService.updateProgress(microstepId, {
      step_index: stepIndex,
      ministep_index: itemId,
      status: ministepStatus,
    });

    await microstepsService.updateProgress(microstepId, {
      step_index: stepIndex,
      ministep_index: undefined,
      status: stepStatus,
    });

    const refreshed = await microstepsService.getMicrostepDetail(microstepId);
    const refreshedSteps = refreshed.data.steps[stepIndex].ministeps;

    setChecklist(
      refreshedSteps.map((m: any, idx: number) => ({
        id: idx,
        text: m.description ? `${m.title}: ${m.description}` : m.title,
        completed: m.status === "completed",
      }))
    );
  };

  // ---------------------------------------------------------
  // SEND REFLECTION MESSAGE
  // ---------------------------------------------------------
  const handleSendReflectionMessage = async () => {
    if (!reflectionText.trim()) return;

    const cleaned = reflectionText.trim();

    setMessages((prev) => [
      ...prev,
      { id: Date.now(), role: "user", content: cleaned },
    ]);

    setReflectionText("");

    try {
      const res = await microstepsService.sendReflectionMessage(
        microstepId,
        stepIndex,
        cleaned
      );

      if (res?.assistant_response?.message) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            role: "assistant",
            content: res.assistant_response.message,
          },
        ]);
      }
    } catch {}
  };

  // ---------------------------------------------------------
  // GENERATE SUMMARY
  // ---------------------------------------------------------
  const handleGenerateSummary = async () => {
    try {
      const summary = await microstepsService.generateSummary(microstepId, stepIndex);

      setSummaryText(summary);
      setSummaryGenerated(true);
    } catch {}
  };

  // ---------------------------------------------------------
  // MARK MICROSTEP DONE (MAIN TRIGGER LOGIC)
  // ---------------------------------------------------------
  const handleMarkDone = async () => {
    console.log("🟦 Mark Done clicked!");
    console.log("🟦 allStepsCompleted value BEFORE REFRESH:", allStepsCompleted);

    await microstepsService.updateProgress(microstepId, {
      step_index: stepIndex,
      ministep_index: undefined,
      status: "completed",
    });

    const refreshed = await microstepsService.getMicrostepDetail(microstepId);
    const refreshedSteps = refreshed.data.steps;

    console.log(
      "♻️ Refreshed step statuses:",
      refreshedSteps.map((s: any) => s.status)
    );

    const nowAllCompleted = refreshedSteps.every((s: any) => s.status === "completed");

    console.log("🔥 nowAllCompleted (AFTER REFRESH):", nowAllCompleted);

    if (nowAllCompleted) {
      console.log("🟩 TRIGGER: ALL MICROSTEPS COMPLETE POPUP");
      setShowAllMicrostepsComplete(true);
      return;
    }

    console.log("🟨 TRIGGER: NORMAL MICROSTEP POPUP");
    setShowCompletePopup(true);
  };

  const allMiniStepsComplete =
    checklist.length > 0 && checklist.every((c) => c.completed);

  const handleExploreOtherCareers = () => {
    console.log("➡️ Navigating to /explorematches");
    navigate("/explorematches");
  };

  // ---------------------------------------------------------
  // ✅ UPDATED HANDLE LAUNCH (ONLY CHANGE REQUIRED)
  // ---------------------------------------------------------
  const handleLaunch = () => {
    if (!careerIdFromAPI) {
      console.error("❌ No career_id found for ready-to-launch navigation");
      return;
    }

    console.log("🚀 Navigating to /readytolaunch/" + careerIdFromAPI);
    navigate(`/readytolaunch/${careerIdFromAPI}`);
  };

  return (
    <div className="mobile-frame microstep-detail-page">
      <div className="microstep-detail-header">
        <button
          className="microstep-detail-header-btn left"
          onClick={() => setShowSavePopup(true)}
        >
          <FiArrowLeft size={22} />
        </button>

        <div className="microstep-detail-header-center">
          <h3 className="microstep-detail-header-title">
            {careerTitleFromAPI || career?.title || ""}
          </h3>
          <p className="microstep-detail-header-subtitle">{stepTitle}</p>
        </div>

        <button
          className="microstep-detail-header-btn right"
          onClick={() => setIsSidebarOpen(true)}
        >
          <FiMenu size={22} />
        </button>
      </div>

      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <div className="microstep-detail-body">
        <section className="detail-section">
          <h2 className="section-title">What to do</h2>

          <div className="info-card">
            <div className="info-badges">
              <span className="info-badge">
                <img src={TimeIcon} width={13} /> Estimated time: {timeEstimate}
              </span>
              <span className="info-badge">
                <img src={DifficultyIcon} width={13} /> Difficulty: {difficulty}
              </span>
            </div>

            <p className="info-description">
              {detailedDescription || miniDescription}
            </p>

            <div className="checklist">
              {checklist.map((item) => (
                <label key={item.id} className="checklist-item">
                  <input
                    type="checkbox"
                    checked={item.completed}
                    onChange={() => toggleChecklistItem(item.id)}
                  />
                  <span className="checklist-text">{item.text}</span>
                </label>
              ))}
            </div>
          </div>
        </section>

        <section className="detail-section">
          <h2 className="section-title">Reflection</h2>

          <ChatBubbleStatic
            text="What did you learn from this experience?"
            width="80%"
            showAvatar={true}
          />

          <div className="reflection-chat-card">
            <div className="reflection-chat-scroll" ref={chatRef}>
              {messages.map((msg) => (
                <ChatBubbleReflection key={msg.id} role={msg.role} content={msg.content} />
              ))}
            </div>

            <div className="reflection-input-row">
              <input
                className="reflection-input"
                placeholder="Type here..."
                value={reflectionText}
                onChange={(e) => setReflectionText(e.target.value)}
              />

              <button
                className={`reflection-send-btn ${
                  reflectionText.trim() ? "active" : "disabled"
                }`}
                disabled={!reflectionText.trim()}
                onClick={handleSendReflectionMessage}
              >
                <img src={SendButtonReflection} width={16} />
              </button>
            </div>
          </div>
        </section>

        <section className="detail-section">
          <h2 className="section-title">Step Summary</h2>

          <div className="summary-card">
            {summaryGenerated ? (
              <div className="summary-content">
                <p className="summary-text">{summaryText}</p>
              </div>
            ) : (
              <p className="summary-placeholder">
                Get your summarized progress of this microstep here
              </p>
            )}

            <button className="generate-summary-btn" onClick={handleGenerateSummary}>
              <img src={GenerateAIIcon} width={16} />
              Generate summary
            </button>
          </div>
        </section>

        <button
          className={`mark-done-btn ${allMiniStepsComplete ? "active" : "disabled"}`}
          disabled={!allMiniStepsComplete}
          onClick={handleMarkDone}
        >
          Mark Microstep Done
        </button>
      </div>

      <div className="bottom-nav-wrapper">
        <BottomNav />
      </div>

      <MicrostepCompletePopup
        isOpen={showCompletePopup}
        onStayHere={() => setShowCompletePopup(false)}
        onBackToMicrosteps={() => navigate(-1)}
      />

      <AllMicrostepsCompletePopup
        isOpen={showAllMicrostepsComplete}
        onExploreCareers={handleExploreOtherCareers}
        onReady={handleLaunch}
      />

      <SaveProgressPopup
        isOpen={showSavePopup}
        onKeepGoing={() => setShowSavePopup(false)}
        onSaveAndExit={() => navigate(-1)}
      />
    </div>
  );
};

export default MicrostepDetail;
