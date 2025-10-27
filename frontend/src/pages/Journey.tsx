import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import BottomNav from "../components/BottomNav";
import Sidebar from "../components/Sidebar";
import { FiMenu } from "react-icons/fi";
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [firstName, setFirstName] = useState<string>(
    localStorage.getItem("first_name") || "User"
  );

  const userId = localStorage.getItem("user_id");

  // ✅ Helper function to safely extract name from any response structure
  const pickFirstName = (p: any): string | undefined =>
    p?.first_name ||
    p?.firstname ||
    p?.data?.first_name ||
    p?.data?.firstname ||
    p?.user?.first_name ||
    p?.user?.firstname;

  // 🟣 Fetch questionnaire sections
  useEffect(() => {
    const fetchSections = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/questionnaire/`);
        const data = await res.json();
        if (data?.data?.sections) {
          console.log("✅ Sections loaded:", data.data.sections);
          setSections(data.data.sections);
        }
      } catch (err) {
        console.error("❌ Failed to load sections:", err);
      }
    };
    fetchSections();
  }, []);

  // 🟢 Fetch unlocked sections from responses
  useEffect(() => {
    if (!userId) {
      console.warn("⚠️ No user_id found in localStorage.");
      return;
    }

    const fetchUnlockedSections = async () => {
      try {
        const qRes = await fetch(`${API_BASE_URL}/questionnaire/`);
        const qData = await qRes.json();
        if (!qData?.data?.sections) return;
        setSections(qData.data.sections);

        const rRes = await fetch(`${API_BASE_URL}/questionnaire/responses/${userId}`);
        const rData = await rRes.json();

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

  // 🧠 Fetch user's first name (with logging + fallback)
  useEffect(() => {
    const loadFirstName = async () => {
      try {
        const uid = localStorage.getItem("user_id");
        const token = localStorage.getItem("token");

        console.log("🔍 Fetching user name...");
        console.log("🧾 user_id:", uid);
        console.log("🔐 token present:", token ? "✅ Yes" : "❌ No");

        if (!uid) {
          console.warn("⚠️ No user_id found, skipping fetch.");
          return;
        }

        // Show cached name immediately
        const stored = localStorage.getItem("first_name");
        if (stored) {
          console.log("💾 Using cached first name:", stored);
          setFirstName(stored);
        }

        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;

        // 🧭 Try primary endpoint
        let res = await fetch(`${API_BASE_URL}/users/${uid}`, { headers });
        console.log("📡 Response status from /users/:id:", res.status);

        // 🧩 Try fallback if 404
        if (res.status === 404) {
          console.log("🔁 Trying fallback /user/:id endpoint...");
          res = await fetch(`${API_BASE_URL}/user/${uid}`, { headers });
          console.log("📡 Fallback response:", res.status);
        }

        // 🧱 If still unauthorized, log and skip
        if (!res.ok) {
          console.warn(`🚫 Failed to fetch name (status ${res.status})`);
          return;
        }

        const data = await res.json();
        console.log("🧾 Raw user data response:", data);

        const name = pickFirstName(data);
        console.log("✅ Extracted first name:", name);

        if (name && typeof name === "string") {
          setFirstName(name);
          localStorage.setItem("first_name", name);
        } else {
          console.warn("⚠️ No valid name found in response; keeping default.");
        }
      } catch (e) {
        console.error("❌ Error loading user name:", e);
      }
    };

    loadFirstName();
  }, []);

  const handleStartQuestionnaire = () => navigate("/questionnaire");
  const handleChatIntro = () => navigate("/chat-intro");

  const handleSectionClick = (index: number, category: string) => {
    const isLocked = index > 0 && !completedSections.includes(index - 1);
    if (!isLocked) navigate(`/questionnaire?section=${index}&category=${category}`);
  };

  return (
    <div className="mobile-frame" 
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-start",
        alignItems: "stretch",
        background: "#fff",
      }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: "70px",
          background: "#fff",
          padding: "0 16px",
          flexShrink: 0,
          borderBottom: "1px solid #eee",
        }}
      >
        <div style={{ textAlign: "left" }}>
          <h3
            style={{
              fontSize: "18px",
              fontWeight: 700,
              color: "#000",
              margin: 0,
              fontFamily: "Outfit, sans-serif",
            }}
          >
            Welcome {firstName}
          </h3>
          <p
            style={{
              fontSize: "13px",
              color: "#666",
              margin: "2px 0 0",
            }}
          >
            Your journey to a fulfilling career awaits.
          </p>
        </div>

        <FiMenu
          onClick={() => setIsSidebarOpen(true)}
          style={{
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
        {/* Actions */}
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
