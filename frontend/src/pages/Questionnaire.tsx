import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation  } from "react-router-dom";
import BottomNav from "../components/BottomNav";
import "../styles/global.css";
import "../styles/questionnaire.css";

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
  const [completedSections, setCompletedSections] = useState<number[]>([]);
  const [errorMsg, setErrorMsg] = useState("");

  const userId = localStorage.getItem("user_id") || "1";
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const isFinalSection = activeSection === sections.length - 1;

  // 🟣 Load questionnaire + saved responses + progress
  useEffect(() => {
    const loadAllData = async () => {
      try {
        // 1️⃣ Fetch questionnaire
        const qRes = await fetch(`${API_BASE_URL}/questionnaire/`);
        const qData = await qRes.json();
        if (qData?.data?.sections) setSections(qData.data.sections);

        // 2️⃣ Fetch saved answers
        const rRes = await fetch(`${API_BASE_URL}/questionnaire/responses/${userId}`);
        const rData = await rRes.json();
        if (rData?.data) {
          const restored: Record<string, string> = {};
          rData.data.forEach((r: any) => {
            restored[r.question_id] = typeof r.answer === "string" ? r.answer : JSON.stringify(r.answer);
          });
          setResponses(restored);
        }

        // 🧩 Derive which sections are completed based on saved responses
        if (rData?.data && qData?.data?.sections) {
          // Get unique categories that have at least one saved answer
          const completedCategories = Array.from(
            new Set(rData.data.map((r: any) => r.category))
          );

          // Convert category names into their section indexes
          const completedIndexes = completedCategories
            .map((cat: string) =>
              qData.data.sections.findIndex((s: any) => s.category === cat)
            )
            .filter((i: number) => i !== -1);

          setCompletedSections(completedIndexes);
          console.log("✅ Completed sections synced:", completedIndexes);
        }


        // 3️⃣ Fetch user progress
        const pRes = await fetch(`${API_BASE_URL}/questionnaire/progress/${userId}`);
        if (pRes.ok) {
          const pData = await pRes.json();
          if (pData?.current_tab !== undefined && initialSectionIndex === 0) {
            setActiveSection(pData.current_tab - 1); // DB stores 1-indexed tab
          }
          if (pData?.is_completed) {
            setCompletedSections(Array.from({ length: (qData?.data?.sections?.length || 0) }, (_, i) => i));
          }
        }
      } catch (err) {
        console.error("❌ Failed to load questionnaire data:", err);
      } finally {
        setLoading(false);
      }
    };
    loadAllData();
  }, []);

  // 🟢 Keep active tab centered
  useEffect(() => {
    const activeTab = tabRefs.current[activeSection];
    const scrollContainer = scrollRef.current;
    if (activeTab && scrollContainer) {
      const tabRect = activeTab.getBoundingClientRect();
      const containerRect = scrollContainer.getBoundingClientRect();
      const offset =
        tabRect.left -
        containerRect.left -
        (containerRect.width / 2 - tabRect.width / 2);
      scrollContainer.scrollBy({ left: offset, behavior: "smooth" });
    }
  }, [activeSection]);

  if (loading) return <p style={{ textAlign: "center" }}>Loading questionnaire...</p>;
  if (!sections.length) return <p style={{ textAlign: "center" }}>No questionnaire found.</p>;

  const currentSection = sections[activeSection];
  const questions = currentSection?.questions || [];
  const totalInSection = questions.length;
  const currentQ = questions[activeQuestion];
  const progressPct = Math.round(((activeQuestion + 1) / totalInSection) * 100);

  // 🟣 Handle response selection
  const handleResponse = (qid: string, value: string) => {
    setResponses((prev) => ({ ...prev, [qid]: value }));
  };

  // 💾 Save each answer immediately
  const saveResponse = async (qid: string, answer: string) => {
    try {
      await fetch(`${API_BASE_URL}/questionnaire/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: parseInt(userId, 10),
          category: sections[activeSection]?.category, // ✅ REQUIRED
          question_id: qid,
          answer: answer, // ✅ backend expects "answer"
        }),
      });
    } catch (err) {
      console.error("⚠️ Failed to save response:", err);
    }
  };

  // 🟣 Next / Back Logic
  const handleNext = async () => {
    const q = questions[activeQuestion];
    const ans = responses[q.id] || "";

    if (!ans && currentSection.required) {
      setErrorMsg("⚠️ Please answer this question before moving on.");
      return;
    } else {
      setErrorMsg(""); // clear if answered
    }

    await saveResponse(q.id, ans);

    if (activeQuestion < questions.length - 1) {
      setActiveQuestion((prev) => prev + 1);
    } else {
      setShowPopup(true);
      setCompletedSections((prev) =>
        prev.includes(activeSection) ? prev : [...prev, activeSection]
      );
    }
  };

  const handleBack = () => {
    if (activeQuestion > 0) {
      setActiveQuestion((prev) => prev - 1);
    } else if (activeSection > 0) {
      const prevSection = activeSection - 1;
      setActiveSection(prevSection);
      setActiveQuestion(sections[prevSection].questions.length - 1);
    } else {
      navigate("/journey");
    }
  };

  const handleContinue = () => {
    setShowPopup(false);
    if (activeSection < sections.length - 1) {
      // Normal behavior for earlier sections
      setActiveSection((prev) => prev + 1);
      setActiveQuestion(0);
    } else {
      // 🎉 Final section completed → go to AI Coach
      navigate("/coach");
    }
  };

  const handleLater = () => {
    setShowPopup(false);
    navigate("/journey");
  };

  // 🟣 Render question
  const renderQuestion = (q: Question) => {
    switch (q.type) {
      case "multi_choice":
      case "single_choice": {
        const isMulti = q.type === "multi_choice";
        const isWorkValues =
          q.category?.toLowerCase().includes("work_values") ||
          q.question.toLowerCase().includes("values that best reflect");

        // Parse current response as an array (for multi-choice)
        const currentValue = (() => {
          try {
            const val = responses[q.id];
            if (isMulti && val) return JSON.parse(val);
            return val;
          } catch {
            return [];
          }
        })();

        const handleOptionClick = (opt: string) => {
          if (isMulti) {
            const prevArray = Array.isArray(currentValue) ? [...currentValue] : [];
            const alreadySelected = prevArray.includes(opt);
            const maxSelect = q.max_select || Infinity;

            // 🔹 Enforce max limit
            if (!alreadySelected && prevArray.length >= maxSelect) {
              return;
            }

            const updated = alreadySelected
              ? prevArray.filter((o) => o !== opt)
              : [...prevArray, opt];

            handleResponse(q.id, JSON.stringify(updated));
            saveResponse(q.id, updated);
          } else {
            handleResponse(q.id, opt);
            saveResponse(q.id, opt);
          }
        };

        return (
          <div className={`qn-options ${isWorkValues ? "qn-options-grid" : ""}`}>
            {q.options?.map((opt, idx) => {
              const isSelected = isMulti
                ? Array.isArray(currentValue) && currentValue.includes(opt)
                : currentValue === opt;

              return (
                <button
                  key={idx}
                  onClick={() => handleOptionClick(opt)}
                  className={`qn-tab ${isSelected ? "active" : ""}`}
                  type="button"
                >
                  {opt}
                </button>
              );
            })}

            {/* 🟣 Show max-select info */}
            {isMulti && q.max_select && (
              <p
                style={{
                  marginTop: "0.6rem",
                  fontSize: "0.8rem",
                  color: "#6b6b6b",
                  fontStyle: "italic",
                }}
              >
                You can select up to {q.max_select} options.
              </p>
            )}

          </div>
        );
      }

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
                  onClick={() => {
                    handleResponse(q.id, num.toString());
                    saveResponse(q.id, num.toString());
                  }}
                  className={`qn-tab ${
                    responses[q.id] === num.toString() ? "active" : ""
                  }`}
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
            onChange={(e) => {
              handleResponse(q.id, e.target.value);
              saveResponse(q.id, e.target.value);
            }}
            className={q.type === "text_long" ? "qn-textarea" : "qn-input"}
          />
        );

      default:
        return <p>Unsupported question type: {q.type}</p>;
    }
  };

  const ConfettiBurst: React.FC = () => {
    const pieces = Array.from({ length: 22 });
    const palette = ["#a594f9", "#ffb86c", "#8be9fd", "#f06292", "#81c784"];

    return (
      <div className="confetti">
        {pieces.map((_, i) => (
          <span
            key={i}
            className="confetti-piece"
            style={
              {
                // random-ish spread using indices (no Math.random needed)
                ["--x" as any]: `${(i * 9) % 100}%`,
                ["--d" as any]: `${(i % 10) * 0.08}s`,
                ["--c" as any]: palette[i % palette.length],
              } as React.CSSProperties
            }
          />
        ))}
      </div>
    );
  };

  return (
    <div className="mobile-frame">
      <div className="qn-header">
        <h2 className="qn-title">TruNorthAI Assistant</h2>
        <p className="qn-subtitle">Setting up your profile</p>
      </div>

      {/* Tabs */}
      <div className="qn-tabs-wrapper" ref={scrollRef}>
        <div className="qn-tabs-scroll">
          {sections.map((s, i) => {
            const isLocked = i > activeSection && !completedSections.includes(i);
            return (
              <button
                key={s.category}
                ref={(el) => (tabRefs.current[i] = el)}
                className={`qn-tab 
                  ${activeSection === i ? "active" : ""} 
                  ${isLocked ? "locked" : ""}`}
                onClick={() => {
                  if (!isLocked) {
                    setActiveSection(i);
                    setActiveQuestion(0);
                  }
                }}
                type="button"
                disabled={isLocked}
              >
                {s.display_name}
                {isLocked && " 🔒"}
              </button>
            );
          })}
        </div>
      </div>

      {/* Progress */}
      <div className="qn-progress-wrapper full-width-divider">
        <div className="qn-progress-text">
          <span className="qn-current">{activeQuestion + 1}</span>
          <span className="qn-total">/{totalInSection}</span>
        </div>
        <div className="qn-progress-bar full-width-bar">
          <div
            className="qn-progress-fill"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Body */}
      <div className="qn-body">
        <div className="qn-body-scroll">
          {currentQ ? (
            <>
              <h3 className="qn-question">{currentQ.question}</h3>

              {errorMsg && (
                <p
                  style={{
                    color: "#ff5c5c",
                    fontSize: "0.9rem",
                    marginBottom: "0.5rem",
                    fontWeight: 500,
                  }}
                >
                  {errorMsg}
                </p>
              )}

              {renderQuestion(currentQ)}
            </>
          ) : (
            <p style={{ textAlign: "center", marginTop: "2rem" }}>
              Loading question...
            </p>
          )}

        </div>
      </div>

      {/* Footer */}
      <div className="qn-footer-fixed">
        <button className="qn-back" onClick={handleBack}>
          Back
        </button>
        <button className="qn-next" onClick={handleNext}>
          Next
        </button>
      </div>

      {/* Popup */}
      {showPopup && (
        <div className="qn-popup-overlay">
          {/* 🎊 Show confetti only for final section */}
          {isFinalSection && <ConfettiBurst />}

          <div className="qn-popup">
            {isFinalSection ? (
              <>
                <h3>🎉 Well Done!</h3>
                <p>
                  You’ve completed all sections of your profile setup.
                  <br />
                  Let’s go talk to <b>Ruby, your AI Coach</b>! 🤖
                </p>
                <div className="qn-popup-buttons">
                  <button className="continue-btn" onClick={() => navigate("/coach")}>
                    Talk to Ruby
                  </button>
                  <button className="later-btn" onClick={() => navigate("/journey")}>
                    Maybe later
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3>🎉 Congratulations!</h3>
                <p>
                  You’ve completed the <b>{currentSection.display_name}</b> section.
                  Would you like to move to the next one?
                </p>
                <div className="qn-popup-buttons">
                  <button className="continue-btn" onClick={handleContinue}>
                    Yes, continue
                  </button>
                  <button className="later-btn" onClick={handleLater}>
                    Later
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      <BottomNav />
    </div>
  );
};

export default Questionnaire;
