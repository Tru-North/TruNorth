import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import BottomNav from "../components/BottomNav";
import "../styles/global.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

interface Section {
  category: string;
  display_name: string;
  order: number;
}

const Journey: React.FC = () => {
  const navigate = useNavigate();
  const [sections, setSections] = useState<Section[]>([]);
  const [completedSections, setCompletedSections] = useState<number[]>([]);

  const userId = localStorage.getItem("user_id");

  // 🟣 Fetch questionnaire sections
  useEffect(() => {
    const fetchSections = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/questionnaire/`);
        const data = await res.json();
        if (data?.data?.sections) setSections(data.data.sections);
      } catch (err) {
        console.error("❌ Failed to load sections:", err);
      }
    };
    fetchSections();
  }, []);

  // 🟢 Fetch user progress summary (persisted unlocks)
  // 🟢 Fetch unlocked sections from saved responses
  useEffect(() => {
    if (!userId) return;
    const fetchUnlockedSections = async () => {
      try {
        // 1️⃣ Fetch questionnaire (for section list)
        const qRes = await fetch(`${API_BASE_URL}/questionnaire/`);
        const qData = await qRes.json();
        if (!qData?.data?.sections) return;
        setSections(qData.data.sections);

        // 2️⃣ Fetch saved responses
        const rRes = await fetch(`${API_BASE_URL}/questionnaire/responses/${userId}`);
        const rData = await rRes.json();

        // 3️⃣ Derive unlocked sections
        if (rData?.data && qData?.data?.sections) {
          const completedCategories = Array.from(
            new Set(rData.data.map((r: any) => r.category))
          );

          const completedIndexes = completedCategories
            .map((cat: string) =>
              qData.data.sections.findIndex((s: any) => s.category === cat)
            )
            .filter((i: number) => i !== -1);

          setCompletedSections(completedIndexes);
          console.log("✅ Journey unlocked sections synced:", completedIndexes);
        }
      } catch (err) {
        console.error("⚠️ Failed to fetch unlocked sections:", err);
      }
    };

    fetchUnlockedSections();
  }, [userId]);

  const handleStartQuestionnaire = () => navigate("/questionnaire");
  const handleChatIntro = () => navigate("/chat-intro");

  const handleSectionClick = (index: number, category: string) => {
    const isLocked = index > 0 && !completedSections.includes(index - 1);
    if (!isLocked) navigate(`/questionnaire?section=${index}&category=${category}`);
  };


  return (
    <div className="mobile-frame">
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          padding: "1rem",
          overflowY: "auto",
        }}
      >
        <h2 style={{ color: "#0f1416", fontSize: "1.4rem", fontWeight: 700 }}>
          Your TruNorth Journey 🗺️
        </h2>
        <p style={{ color: "#6b6b6b", fontSize: "0.95rem", maxWidth: "300px" }}>
          Begin your personalized AI career journey. Start with the questionnaire
          or meet Ruby, your AI coach!
        </p>

        {/* Main actions */}
        <div
          style={{
            marginTop: "1.2rem",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
            alignItems: "center",
          }}
        >
          <button
            onClick={handleStartQuestionnaire}
            style={{
              backgroundColor: "#a594f9",
              color: "#fff",
              border: "none",
              borderRadius: "14px",
              padding: "12px 26px",
              fontSize: "1rem",
              fontWeight: 600,
              cursor: "pointer",
              width: "80%",
              maxWidth: "280px",
              boxShadow: "0 3px 8px rgba(165, 148, 249, 0.3)",
            }}
          >
            🧭 Start Questionnaire
          </button>

          <button
            onClick={handleChatIntro}
            style={{
              backgroundColor: "#fff",
              color: "#a594f9",
              border: "2px solid #a594f9",
              borderRadius: "14px",
              padding: "12px 26px",
              fontSize: "1rem",
              fontWeight: 600,
              cursor: "pointer",
              width: "80%",
              maxWidth: "280px",
              boxShadow: "0 3px 8px rgba(0, 0, 0, 0.05)",
            }}
          >
            💬 Meet Ruby (Static Chat Bot)
          </button>
        </div>

        {/* Section grid */}
        <div
          style={{
            marginTop: "2rem",
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: "0.8rem",
            width: "90%",
            maxWidth: "360px",
          }}
        >
          {sections.map((s, i) => {
            const isLocked = !completedSections.includes(i);
            return (
              <button
                key={s.category}
                onClick={() => handleSectionClick(i, s.category)}
                disabled={isLocked}
                style={{
                  padding: "0.8rem",
                  borderRadius: "12px",
                  border: "1.5px solid #e3e3e3",
                  background: isLocked ? "#eee" : "#f8f8f8",
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  color: isLocked ? "#777" : "#333",
                  textAlign: "center",
                  cursor: isLocked ? "not-allowed" : "pointer",
                  opacity: isLocked ? 0.6 : 1,
                }}
              >
                {isLocked ? "🔒 " : "✅ "}
                {s.display_name}
              </button>
            );
          })}
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default Journey;
