import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FiX, FiMenu, FiCheck } from "react-icons/fi";
import Sidebar from "../components/Sidebar";
import "../styles/global.css";
import "../styles/questionnaire.css";
import QuestionnaireExitModal from "../components/QuestionnaireExitModal";
import QuestionnaireCoachPopup from "../components/QuestionnaireCoachPopup";
import TickCircle from "../assets/chatIntro_and_questionnaire/questionnaire_progress_bar_ticked_circle_icon.svg";
import EmptyCircle from "../assets/chatIntro_and_questionnaire/questionnaire_progress_bar_empty_circle_icon.svg";
import LineIcon from "../assets/chatIntro_and_questionnaire/questionnaire_progress_bar_line_icon.svg";
import LockedCircle from "../assets/chatIntro_and_questionnaire/questionnaire_progress_bar_locked_section_icon.svg";

// ✅ UNIVERSAL LOADER
import ContentLoader from "../components/ContentLoader";

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
        // Reset
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

        // 3️⃣ Fetch progress
        const pRes = await fetch(`${API_BASE_URL}/questionnaire/progress/${userId}`);
        const pData = await pRes.json();
        const isCompleted = !!pData?.is_completed;

        // 🧠 Sidebar or journey navigation?
        const cameFromSidebar = location.search.includes("section=");
        if (cameFromSidebar) {
          setActiveSection(newSectionIndex);
          setActiveQuestion(0);
          console.log("🔄 Loaded via sidebar → start from section", newSectionIndex);
        } else {
          // Resume logic
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
          console.log("🟢 Resume:", resumeSection, resumeQuestion);
        }
      } catch (err) {
        console.error("❌ Failed to load questionnaire:", err);
      } finally {
        setLoading(false);
        window.scrollTo(0, 0);
      }
    };

    loadAllData();
  }, [location.search]);

  /* ---------------- Autosave on unload ---------------- */
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (Object.keys(responses).length > 0) {
        e.preventDefault();
        saveAllResponses();
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

  /* ---------------- Autosave on unmount ---------------- */
  useEffect(() => {
    return () => {
      const saved = responsesRef.current;
      if (saved && Object.keys(saved).length > 0) {
        console.log("🧩 Auto-saving before unmount...");
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

          const ok = navigator.sendBeacon(
            `${API_BASE_URL}/questionnaire/bulk-save`,
            blob
          );

          if (!ok) saveAllResponses();
        } catch (err) {
          console.error("Beacon error:", err);
        }
      }
    };
  }, []);

  /* ---------------- Save responses ---------------- */
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
      console.log("✅ Saved");
    } catch (err) {
      console.error("Save error:", err);
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

  /* ---------------- Loading State ---------------- */
  if (loading) {
    return (
      <div
        className="mobile-frame"
        style={{
          width: "390px",
          height: "100vh",
          overflow: "hidden"
        }}
      >
        <ContentLoader text="Loading questionnaire…" />
      </div>
    );
  }

  if (!sections.length) {
    return <p style={{ textAlign: "center" }}>No questionnaire found.</p>;
  }

  /* ---------------- Section + Question Logic ---------------- */
  const currentSection = sections[activeSection];
  const questions = currentSection?.questions || [];
  const totalInSection = questions.length;
  const currentQ = questions[activeQuestion];
  const progressPct = Math.round(((activeQuestion + 1) / totalInSection) * 100);

  const handleResponse = (qid: string, value: string) => {
    setResponses((prev) => ({ ...prev, [qid]: value }));
  };

  const handleNext = async () => {
    if (isTransitioning) return;
    setIsTransitioning(true);

    const q = questions[activeQuestion];
    const ans = responses[q.id] || "";

    if (!ans && currentSection.required) {
      setErrorMsg("⚠️ Please answer this question before moving on.");
      setIsTransitioning(false);
      return;
    } else setErrorMsg("");

    if (activeQuestion < questions.length - 1) {
      setActiveQuestion((prev) => prev + 1);
    } else if (activeSection === 1 && activeQuestion === questions.length - 1) {
      await saveAllResponses();
      setShowPopup(true);
    } else if (activeSection < sections.length - 1) {
      setActiveSection((prev) => prev + 1);
      setActiveQuestion(0);
    } else {
      await saveAllResponses();
      navigate("/journey");
    }

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

  const handleSectionClick = (index: number) => {
    if (!isStepClickable(index)) return; // block locked steps

    // navigate to first question of that section
    navigate(`/questionnaire?section=${index}&category=${sections[index].category}`);
  };

  /* ---------------- Exit modal ---------------- */
  const handleCrossClick = () => setShowExitModal(true);
  const handleKeepGoing = () => setShowExitModal(false);
  const handleSaveAndExit = async () => {
    setIsSavingExit(true);     // 🔥 show loading state & disable buttons
    await saveAllResponses();  // wait for save
    setShowExitModal(false);
    setIsSavingExit(false);
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

  // 👇 Custom titles ONLY for progress bar
  const PROGRESS_TITLES: Record<string, string> = {
    "about_me": "About Me",
    "your_work_values": "Values",
    "skills_and_interests": "Skills",
    "your_work_background": "Background",
    "career_snapshot": "Snapshot",
  };

  /** Check if a section is fully completed */
  const isSectionCompleted = (sectionIndex: number) => {
    const sec = sections[sectionIndex];
    return sec.questions.every(q => responses[q.id] !== undefined);
  };

  /** REQUIRED SECTIONS (0 and 1) must be completed */
  const REQUIRED_COUNT = 2;

  /** Check if all required sections are completed */
  const requiredCompleted = () => {
    return [...Array(REQUIRED_COUNT).keys()].every(i => isSectionCompleted(i));
  };

  /** Determine if a bubble is clickable */
  const isStepClickable = (idx: number) => {
    // first section always open
    if (idx === 0) return true;

    // required sections can only unlock one after other
    if (idx < REQUIRED_COUNT) {
      return isSectionCompleted(idx - 1);
    }

    // optional sections unlock only when required are done
    if (idx >= REQUIRED_COUNT) {
      if (requiredCompleted()) return true;
      return isSectionCompleted(idx); // already finished → allow revisit
    }

    return false;
  };

  const getSectionStatus = (index: number) => {
    const sec = sections[index];

    const allAnswered = sec.questions.every(q => responses[q.id] !== undefined);

    const REQUIRED_SECTIONS = [0, 1]; // About Me, Values

    if (index === activeSection) return "current";

    // Required section logic
    if (REQUIRED_SECTIONS.includes(index)) {
      // If required but not fully answered AND is ahead of current section → locked
      const prevRequiredCompleted =
        REQUIRED_SECTIONS.every(rIndex =>
          sections[rIndex].questions.every(q => responses[q.id] !== undefined)
        );

      if (!allAnswered && index > activeSection && !prevRequiredCompleted) {
        return "locked";
      }

      // Past or fully answered required section
      return allAnswered ? "done" : "unanswered";
    }

    // Optional sections unlock ONLY after required completed
    const requiredCompleted =
      REQUIRED_SECTIONS.every(rIndex =>
        sections[rIndex].questions.every(q => responses[q.id] !== undefined)
      );

    if (!requiredCompleted) {
      // required not completed yet → optional sections locked
      return "locked";
    }

    // Optional sections unlocked
    return allAnswered ? "done" : "unanswered";
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

      {/* 🌟 Figma Perfect Progress Bar */}
      <div className="qn-sec-progress">
        {/* Single line whose ends match first/last dot centers */}
        <div
          className="qn-sec-line"
          style={{
            left: `${50 / sections.length}%`,
            right: `${50 / sections.length}%`,
          }}
        />

        <div
          className="qn-sec-steps"
          style={{ gridTemplateColumns: `repeat(${sections.length}, 1fr)` }}
        >
          {sections.map((sec, idx) => {
            const completed = isSectionCompleted(idx);
            const current = idx === activeSection;
            const clickable = isStepClickable(idx);

            return (
              <div
                key={sec.category}
                className={`qn-sec-step ${clickable ? "clickable" : ""}`}
                onClick={() => clickable && handleSectionClick(idx)}
              >
                {/* <div className="qn-sec-bubble-wrap">
                  {current ? (
                    <div className="qn-sec-pill">
                      Step {activeQuestion + 1}/{currentSection.questions.length}
                    </div>
                  ) : (
                    <img
                      src={completed ? TickCircle : EmptyCircle}
                      className="qn-sec-circle"
                      style={{ opacity: clickable ? 1 : 0.35 }}
                      alt=""
                    />
                  )}
                </div> */}

                <div className="qn-sec-bubble-wrap" onClick={() => {
                  const status = getSectionStatus(idx);
                  if (status === "locked") return;
                  handleSectionClick(idx);
                }}>

                  {(() => {
                    const status = getSectionStatus(idx);

                    if (status === "current") {
                      return (
                        <div className="qn-sec-pill">
                          Step {activeQuestion + 1}/{currentSection.questions.length}
                        </div>
                      );
                    }

                    if (status === "done") {
                      return <img src={TickCircle} className="qn-sec-circle" />;
                    }

                    if (status === "unanswered") {
                      return <img src={EmptyCircle} className="qn-sec-circle" />;
                    }

                    if (status === "locked") {
                      return <img src={LockedCircle} className="qn-sec-circle locked" />;
                    }

                    return null;
                  })()}

                </div>


                <div className={`qn-sec-label ${current ? "active" : ""}`}>
                  {PROGRESS_TITLES[sec.category] || sec.display_name}
                </div>
              </div>
            );

          })}
        </div>

      </div>


      {/* <div className="qn-progress-wrapper full-width-divider">
        <div className="qn-progress-text">
          <span className="qn-current">{activeQuestion + 1}</span>
          <span className="qn-total">/{totalInSection}</span>
        </div>
        <div className="qn-progress-bar full-width-bar">
          <div className="qn-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
      </div> */}

      <div className="qn-body">
        <div className="qn-body-scroll">
          {currentQ ? (
            <>
              <h3 className="qn-question">{currentQ.question}</h3>
              {errorMsg && <p className="qn-error">{errorMsg}</p>}
              {renderQuestion(currentQ)}
            </>
          ) : (
            <p style={{ textAlign: "center", marginTop: "2rem" }}>
              Loading question...
            </p>
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

      <QuestionnaireExitModal
        show={showExitModal}
        isSavingExit={isSavingExit}
        onKeepGoing={handleKeepGoing}
        onSaveAndExit={handleSaveAndExit}
      />

      {showPopup && (
        <QuestionnaireCoachPopup
          onGoToCoach={async () => {
            console.log("🚀 [GoToCoach] Triggered!");

            // 1️⃣ Save questionnaire
            console.log("📝 [GoToCoach] Saving ALL questionnaire responses...");
            await saveAllResponses();
            console.log("✅ [GoToCoach] Questionnaire saved.");

            const userId = localStorage.getItem("user_id");
            if (!userId) {
              console.error("❌ [GoToCoach] user_id missing!");
              return;
            }

            // 2️⃣ Mark chat intro done
            console.log("💬 [GoToCoach] Marking chat intro as completed...");
            const chatRes = await fetch(`${API_BASE_URL}/questionnaire/chat/save`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                user_id: parseInt(userId, 10),
                chat_id: "chat_intro_completed",
                response: "completed",
              }),
            });

            console.log("📨 [GoToCoach] Chat intro API response:", chatRes.status);
            if (!chatRes.ok) {
              console.error("❌ [GoToCoach] Failed to save chat intro!");
            } else {
              console.log("✅ [GoToCoach] Chat intro saved.");
            }

            // 3️⃣ Update journey state manually (to ensure DB is correct)
            console.log("🌍 [GoToCoach] Updating journey state: chat_intro_done + questionnaire_completed...");
            const journeyRes = await fetch(`${API_BASE_URL}/journey/state/update`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${localStorage.getItem("token")}`,
              },
              body: JSON.stringify({
                user_id: parseInt(userId, 10),
                chat_intro_done: true,
                questionnaire_completed: true,
                discovery_completed: true, // optional but matches your logic
              }),
            });

            console.log("📨 [GoToCoach] Journey state API response:", journeyRes.status);

            if (!journeyRes.ok) {
              console.error("❌ [GoToCoach] Failed to update journey state!");
            } else {
              const j = await journeyRes.json();
              console.log("🌟 [GoToCoach] Updated journey state:", j);
            }

            // 4️⃣ Final navigation
            console.log("➡️ [GoToCoach] Navigating to /coach ...");
            navigate("/coach");
          }}

          onContinue={async () => {
            await saveAllResponses();
            navigate(`/questionnaire?section=2`);
          }}
        />
      )}
    </div>
  );
};

export default Questionnaire;
