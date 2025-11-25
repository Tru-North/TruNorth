import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FiX, FiMenu, FiCheck } from "react-icons/fi";
import Sidebar from "../components/Sidebar";
import "../styles/global.css";
import "../styles/questionnaire.css";
import { useRef } from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

interface Question {
  id: string;
  type: string;
  question: string;
  options?: string[];
  placeholder?: string;
  scale?: { min: number; max: number; labels: string[] };
  max_select?: number;
}

interface Section {
  category: string;
  display_name: string;
  order: number;
  required?: boolean;
  questions: Question[];
}

const Questionnaire: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const initialSectionIndex = Number(params.get("section")) || 0;

  const [sections, setSections] = useState<Section[]>([]);
  const [activeSection, setActiveSection] = useState(initialSectionIndex);
  const [activeQuestion, setActiveQuestion] = useState(0);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [showPopup, setShowPopup] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingExit, setIsSavingExit] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const userId = localStorage.getItem("user_id") || "1";

  /* ---------------- Load questionnaire + saved responses + progress ---------------- */
  useEffect(() => {
    const loadAllData = async () => {
      try {
        // 🔁 Reset before loading new questionnaire
        setLoading(true);
        setSections([]);
        setResponses({});
        setActiveQuestion(0);
        setShowPopup(false);
        setShowExitModal(false);

        const params = new URLSearchParams(location.search);
        const newSectionIndex = Number(params.get("section")) || 0;
        setActiveSection(newSectionIndex);

        console.log("📡 Loading questionnaire for section:", newSectionIndex);

        // 1️⃣ Fetch questionnaire structure
        const qRes = await fetch(`${API_BASE_URL}/questionnaire/`);
        const qData = await qRes.json();
        const allSections: Section[] = qData?.data?.sections || [];
        setSections(allSections);

        // 2️⃣ Fetch saved responses
        const rRes = await fetch(`${API_BASE_URL}/questionnaire/responses/${userId}`);
        const rData = await rRes.json();
        const restored: Record<string, string> = {};
        if (rData?.data) {
          rData.data.forEach((r: any) => {
            restored[r.question_id] =
              typeof r.answer === "string" ? r.answer : JSON.stringify(r.answer);
          });
        }
        setResponses(restored);

        // 3️⃣ Fetch progress (only for journey reopen)
        const pRes = await fetch(`${API_BASE_URL}/questionnaire/progress/${userId}`);
        const pData = await pRes.json();
        const isCompleted = !!pData?.is_completed;

        // 🧠 Determine whether this load came from sidebar or journey
        const cameFromSidebar = location.search.includes("section=");
        if (cameFromSidebar) {
          // 🟣 Sidebar navigation → always start at first question of target section
          setActiveSection(newSectionIndex);
          setActiveQuestion(0);
          console.log("🔄 Loaded via sidebar navigation → starting from section:", newSectionIndex);
        } else {
          // 🟢 Journey reopen → resume from last unanswered
          type FlatQ = { qid: string; sIdx: number; qIdx: number; required: boolean };
          const flat: FlatQ[] = [];
          allSections.forEach((s, sIdx) => {
            s.questions.forEach((q, qIdx) => {
              flat.push({ qid: q.id, sIdx, qIdx, required: !!s.required });
            });
          });

          let resumeSection = 0;
          let resumeQuestion = 0;
          const firstUnansweredIdx = flat.findIndex(f => restored[f.qid] === undefined);

          if (firstUnansweredIdx === -1) {
            if (isCompleted) {
              navigate("/journey");
              return;
            } else {
              setShowPopup(true);
              const last = flat[flat.length - 1];
              resumeSection = last.sIdx;
              resumeQuestion = last.qIdx;
            }
          } else {
            const target = flat[firstUnansweredIdx];
            resumeSection = target.sIdx;
            resumeQuestion = target.qIdx;
          }

          setActiveSection(resumeSection);
          setActiveQuestion(resumeQuestion);
          console.log("🟢 Loaded via journey resume → resuming from", resumeSection, resumeQuestion);
        }
      } catch (err) {
        console.error("❌ Failed to load questionnaire data:", err);
      } finally {
        setLoading(false);
        window.scrollTo(0, 0); // ✅ scroll to top for new section
      }
    };

    loadAllData();
  }, [location.search]);

  /* ---------------- Autosave on unload ---------------- */
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (Object.keys(responses).length > 0) {
        e.preventDefault();
        saveAllResponses(); // fire async, browser may cancel
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [responses]);

  const responsesRef = useRef(responses);
  useEffect(() => {
    responsesRef.current = responses;
  }, [responses]);

  /* ---------------- Autosave on component unmount (e.g., sidebar navigation) ---------------- */
  useEffect(() => {
    return () => {
      const saved = responsesRef.current;
      if (saved && Object.keys(saved).length > 0) {
        console.log("🧩 Auto-saving before unmount (navigation away)...");

        try {
          const payload = Object.entries(saved).map(([qid, ans]) => ({
            user_id: parseInt(userId, 10),
            category: findCategoryByQuestionId(qid),
            question_id: qid,
            answer: ans,
          }));

          const blob = new Blob([JSON.stringify({ responses: payload })], {
            type: "application/json",
          });

          // ✅ Uses sendBeacon so it completes even if the page unloads
          const ok = navigator.sendBeacon(
            `${API_BASE_URL}/questionnaire/bulk-save`,
            blob
          );

          console.log(ok ? "✅ Beacon sent successfully" : "⚠️ Beacon failed, fallback save...");
          if (!ok) saveAllResponses(); // fallback if beacon unsupported
        } catch (err) {
          console.error("⚠️ Beacon save error:", err);
        }
      }
    };
  }, []); // run only on unmount


  /* ---------------- Helper: save all responses at once ---------------- */
  const saveAllResponses = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const payload = Object.entries(responses).map(([qid, ans]) => ({
        user_id: parseInt(userId, 10),
        category: findCategoryByQuestionId(qid),
        question_id: qid,
        answer: ans,
      }));

      const res = await fetch(`${API_BASE_URL}/questionnaire/bulk-save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responses: payload }),
      });

      if (!res.ok) throw new Error("Bulk save failed");
      console.log("✅ All responses saved successfully");
    } catch (err) {
      console.error("⚠️ Bulk save error:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const findCategoryByQuestionId = (qid: string): string => {
    for (const sec of sections) {
      if (sec.questions.some((q) => q.id === qid)) return sec.category;
    }
    return "unknown";
  };

  /* ---------------- Navigation ---------------- */
  if (loading) return <p style={{ textAlign: "center" }}>Loading questionnaire...</p>;
  if (!sections.length) return <p style={{ textAlign: "center" }}>No questionnaire found.</p>;

  const currentSection = sections[activeSection];
  const questions = currentSection?.questions || [];
  const totalInSection = questions.length;
  const currentQ = questions[activeQuestion];
  const progressPct = Math.round(((activeQuestion + 1) / totalInSection) * 100);

  const handleResponse = (qid: string, value: string) => {
    setResponses((prev) => ({ ...prev, [qid]: value }));
  };

  const handleNext = async () => {
    if (isTransitioning) return; // prevent rapid multi-clicks
    setIsTransitioning(true);

    const q = questions[activeQuestion];
    const ans = responses[q.id] || "";

    if (!ans && currentSection.required) {
      setErrorMsg("⚠️ Please answer this question before moving on.");
      setIsTransitioning(false);
      return;
    } else setErrorMsg("");

    // 🧭 Case 1: Move to next question in same section
    if (activeQuestion < questions.length - 1) {
      setActiveQuestion((prev) => prev + 1);
    }
    // 🧭 Case 2: Move to next section (first question)
    else if (activeSection < sections.length - 1) {
      setActiveSection((prev) => prev + 1);
      setActiveQuestion(0);
    }
    // 🧭 Case 3: Last question of last section — save & go to journey
    else {
      console.log("🚀 Last question reached — saving all responses...");
      try {
        await saveAllResponses();
        console.log("✅ All responses saved — redirecting to journey...");
        navigate("/journey");
      } catch (err) {
        console.error("⚠️ Save or navigation failed:", err);
      }
    }

    // small cooldown to prevent rapid clicks
    setTimeout(() => setIsTransitioning(false), 600);
  };

  const handleBack = () => {
    if (activeQuestion > 0) setActiveQuestion((p) => p - 1);
    else if (activeSection > 0) {
      const prev = activeSection - 1;
      setActiveSection(prev);
      setActiveQuestion(sections[prev].questions.length - 1);
    } else navigate("/journey");
  };

  /* ---------------- Exit modal ---------------- */
  const handleCrossClick = () => setShowExitModal(true);
  const handleKeepGoing = () => setShowExitModal(false);
  const handleSaveAndExit = async () => {
    await saveAllResponses();
    setShowExitModal(false);
    navigate("/journey");
  };

  /* ---------------- Question Renderer ---------------- */
  const renderQuestion = (q: Question) => {
    const val = responses[q.id];
    const isMulti = q.type === "multi_choice";

    const handleClick = (opt: string) => {
      if (isMulti) {
        const prev = val ? JSON.parse(val) : [];
        const already = prev.includes(opt);
        const maxSelect = q.max_select || Infinity;
        let updated = [...prev];
        if (already) updated = prev.filter((o: string) => o !== opt);
        else if (prev.length < maxSelect) updated.push(opt);
        handleResponse(q.id, JSON.stringify(updated));
      } else {
        handleResponse(q.id, opt);
      }
    };

    switch (q.type) {
      case "multi_choice":
      case "single_choice":
        const parsed = isMulti ? (val ? JSON.parse(val) : []) : val;
        return (
          <div className="qn-options">
            {q.options?.map((opt, i) => {
              const selected = isMulti ? parsed.includes(opt) : parsed === opt;
              return (
                <button
                  key={i}
                  onClick={() => handleClick(opt)}
                  className={`qn-tab ${selected ? "active" : ""}`}
                  type="button"
                >
                  {opt}
                </button>
              );
            })}
            {isMulti && q.max_select && (
              <p className="qn-hint">Select up to {q.max_select}</p>
            )}
          </div>
        );

      case "rating":
        return (
          <div className="qn-rating">
            <div className="qn-rating-buttons">
              {Array.from(
                { length: (q.scale?.max ?? 10) - (q.scale?.min ?? 1) + 1 },
                (_, i) => (q.scale?.min ?? 1) + i
              ).map((num) => (
                <button
                  key={num}
                  onClick={() => handleResponse(q.id, num.toString())}
                  className={`qn-tab ${responses[q.id] === num.toString() ? "active" : ""}`}
                  type="button"
                >
                  {num}
                </button>
              ))}
            </div>
            {q.scale?.labels && (
              <div className="qn-rating-labels">
                <span>{q.scale.labels[0]}</span>
                <span>{q.scale.labels[1]}</span>
              </div>
            )}
          </div>
        );

      case "text_long":
      case "text_short":
        return (
          <textarea
            placeholder={q.placeholder}
            value={responses[q.id] || ""}
            onChange={(e) => handleResponse(q.id, e.target.value)}
            className={q.type === "text_long" ? "qn-textarea" : "qn-input"}
          />
        );

      default:
        return <p>Unsupported question type: {q.type}</p>;
    }
  };

  /* ---------------- Render ---------------- */
  return (
    <div className="mobile-frame">
      <div className="qn-header">
        <FiX className="qn-icon left" onClick={handleCrossClick} />
        <div className="qn-header-center">
          <h2 className="qn-title">TruNorth</h2>
          <p className="qn-subtitle">{currentSection?.display_name || ""}</p>
        </div>
        <FiMenu className="qn-icon right" onClick={() => setIsSidebarOpen(true)} />
      </div>

      <div className="qn-progress-wrapper full-width-divider">
        <div className="qn-progress-text">
          <span className="qn-current">{activeQuestion + 1}</span>
          <span className="qn-total">/{totalInSection}</span>
        </div>
        <div className="qn-progress-bar full-width-bar">
          <div className="qn-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      <div className="qn-body">
        <div className="qn-body-scroll">
          {currentQ ? (
            <>
              <h3 className="qn-question">{currentQ.question}</h3>
              {errorMsg && <p className="qn-error">{errorMsg}</p>}
              {renderQuestion(currentQ)}
            </>
          ) : (
            <p style={{ textAlign: "center", marginTop: "2rem" }}>Loading question...</p>
          )}
        </div>
      </div>

      <div className="qn-footer-fixed">
        <button className="qn-back" onClick={handleBack}>
          Back
        </button>
        <button
          className="qn-next"
          onClick={handleNext}
          disabled={isSaving || isTransitioning}
        >
          {isSaving ? "Saving..." : isTransitioning ? "..." : "Next"}
        </button>
      </div>

      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {showExitModal && (
        <div className="exit-modal-overlay">
          <div className="exit-modal purple-theme">
            <div className="exit-icon-container">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="white"
                width="32"
                height="32"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1"
                />
              </svg>
            </div>

            <h2 className="exit-title white">Leaving already?</h2>

            {isSavingExit ? (
              <>
                <p className="exit-text white">💾 Saving your progress...</p>
              </>
            ) : (
              <>
                <p className="exit-text white">We will save your progress</p>
                <div className="exit-buttons">
                  <button className="btn-keep outlined" onClick={handleKeepGoing}>
                    Keep Going
                  </button>
                  <button
                    className="btn-exit filled"
                    onClick={async () => {
                      setIsSavingExit(true);
                      await saveAllResponses();
                      setTimeout(() => {
                        setIsSavingExit(false);
                        setShowExitModal(false);
                        navigate("/journey");
                      }, 1000); // smooth UX transition
                    }}
                  >
                    Save And Exit
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

export default Questionnaire;
