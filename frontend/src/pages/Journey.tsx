import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import BottomNav from "../components/BottomNav";
import Sidebar from "../components/Sidebar";
import { FiMenu } from "react-icons/fi";
import "../styles/global.css";
import "../styles/journey.css";

import IconPast from "../assets/journey/journey_active_past_milestone_icon.svg";
import IconCurrent from "../assets/journey/journey_current_milestone_icon.svg";
import IconFuture from "../assets/journey/journey_inactive_future_milestone_icon.svg";
import JourneyLine from "../assets/journey/journey_linking_icon.svg";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

type Key = "discovery" | "coaching" | "matches" | "action" | "launch";
type State = "past" | "current" | "future";

const LABEL: Record<Key, string> = {
  discovery: "Discovery",
  coaching: "Coaching",
  matches: "Career Matches",
  action: "Take Action",
  launch: "Ready to Launch",
};

const HELPER: Record<Key, { accent: string; rest: string }> = {
  discovery: { accent: "Let’s", rest: " get to know you!" },
  coaching: { accent: "Get", rest: " guided insights." },
  matches: { accent: "Explore", rest: " career fits" },
  action: { accent: "Turn", rest: " plans into steps" },
  launch: { accent: "Ready", rest: " for your next move." },
};

const Journey: React.FC = () => {
  const navigate = useNavigate();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [firstName, setFirstName] = useState<string>(
    localStorage.getItem("first_name") || "User"
  );

  const [discoveryCompleted, setDiscoveryCompleted] = useState<boolean>(
    localStorage.getItem("discovery_completed") === "true"
  );

  const [questionnaireComplete, setQuestionnaireComplete] = useState<boolean>(
    localStorage.getItem("questionnaire_complete") === "true"
  );

  const [careerUnlockConfirmed, setCareerUnlockConfirmed] =
    useState<boolean>(false);

  const userId = localStorage.getItem("user_id");
  const token = localStorage.getItem("token");

  const pickFirstName = (p: any): string | undefined =>
    p?.first_name ||
    p?.firstname ||
    p?.data?.first_name ||
    p?.data?.firstname ||
    p?.user?.first_name ||
    p?.user?.firstname;

  /** -------------------------------
   * Load Name
   --------------------------------*/
  useEffect(() => {
    const loadName = async () => {
      try {
        if (!userId) return;

        const cached = localStorage.getItem("first_name");
        if (cached) setFirstName(cached);

        const headers: Record<string, string> = {};
        if (token) headers.Authorization = `Bearer ${token}`;

        let r = await fetch(`${API_BASE_URL}/users/${userId}`, { headers });
        if (r.status === 404)
          r = await fetch(`${API_BASE_URL}/user/${userId}`, { headers });

        if (!r.ok) return;
        const data = await r.json();

        const name = pickFirstName(data);
        if (name) {
          setFirstName(name);
          localStorage.setItem("first_name", name);
        }
      } catch {}
    };

    loadName();
  }, [API_BASE_URL, token, userId]);

  /** -------------------------------
   * Load Questionnaire Completion
   --------------------------------*/
  useEffect(() => {
    const loadProgress = async () => {
      try {
        if (!userId) return;

        const headers: Record<string, string> = {};
        if (token) headers.Authorization = `Bearer ${token}`;

        let complete: boolean | null = null;

        try {
          const [sR, rR] = await Promise.all([
            fetch(`${API_BASE_URL}/questionnaire/`, { headers }),
            fetch(`${API_BASE_URL}/questionnaire/responses/${userId}`, {
              headers,
            }),
          ]);

          if (sR.ok && rR.ok) {
            const s = await sR.json();
            const r = await rR.json();

            const allSections = s?.data?.sections || [];

            const required = allSections
              .slice(0, -1)
              .filter((x: any) => x?.required !== false);

            const answered = new Set(
              (r?.data || []).map((x: any) => x?.category)
            );

            complete = required.every((sec: any) =>
              answered.has(sec.category)
            );
          }
        } catch {}

        const final =
          complete ??
          localStorage.getItem("questionnaire_complete") === "true";

        setQuestionnaireComplete(final);

        if (final) localStorage.setItem("questionnaire_complete", "true");

        setDiscoveryCompleted(
          localStorage.getItem("discovery_completed") === "true"
        );
      } catch {}
    };

    loadProgress();
  }, [API_BASE_URL, token, userId]);

  /** -------------------------------
   * Fetch Unlock Flag from DB
   --------------------------------*/
  useEffect(() => {
    const fetchUnlockFlag = async () => {
      if (!userId) return;

      try {
        const headers: Record<string, string> = {};
        if (token) headers.Authorization = `Bearer ${token}`;

        const res = await fetch(`${API_BASE_URL}/users/${userId}`, { headers });
        const data = await res.json();

        const unlock = data?.is_career_unlock_confirmed === true;

        setCareerUnlockConfirmed(unlock);
      } catch {}
    };

    fetchUnlockFlag();
  }, [API_BASE_URL, userId, token]);

  /** -------------------------------
   * Compute Milestone States (NO logic removed)
   --------------------------------*/
  const states: Record<Key, State> = useMemo(() => {
    const s: Record<Key, State> = {
      discovery: "future",
      coaching: "future",
      matches: "future",
      action: "future",
      launch: "future",
    };

    const chatIntroDone =
      localStorage.getItem("chat_intro_done") === "true";

    // your original logic preserved EXACTLY
    if (chatIntroDone && questionnaireComplete) {
      s.discovery = "past";
      s.coaching = "current";
    } else {
      s.discovery = "current";
      return s;
    }

    // DB unlock → matches unlocked
    if (careerUnlockConfirmed) {
      s.coaching = "past";
      s.matches = "current";
      localStorage.setItem("coach_completed", "true");
    }

    return s;
  }, [questionnaireComplete, discoveryCompleted, careerUnlockConfirmed]);

  /** -------------------------------
   * Progress bar based ONLY on past states
   --------------------------------*/
  const progressPct = useMemo(() => {
    const pastCount = Object.values(states).filter((v) => v === "past").length;
    return pastCount * 20;
  }, [states]);

  const iconFor = (st: State) =>
    st === "past" ? IconPast : st === "current" ? IconCurrent : IconFuture;

  /** -------------------------------
   * Navigation — YOUR discovery logic preserved
   --------------------------------*/
  const go = async (k: Key) => {
    switch (k) {
      case "discovery": {
        try {
          const headers: Record<string, string> = {};
          if (token) headers.Authorization = `Bearer ${token}`;

          const resp = await fetch(
            `${API_BASE_URL}/questionnaire/chat_responses/${userId}`,
            { headers }
          );

          if (resp.ok) {
            const data = await resp.json();
            const responses = data?.data || data;

            const introDone = responses.some(
              (r: any) =>
                r.chat_id === "chat_5" ||
                r.response?.includes("Yes, ready!") ||
                r.response?.includes("Maybe later")
            );

            if (introDone) {
              localStorage.setItem("chat_intro_done", "true");
              localStorage.setItem("discovery_completed", "true");
              navigate("/questionnaire");
              return;
            }
          }

          navigate("/chat-intro");
        } catch (err) {
          console.error("Error checking chat intro:", err);
          navigate("/chat-intro");
        }
        return;
      }

      case "coaching":
        if (questionnaireComplete) navigate("/coach");
        return;

      case "matches":
        if (questionnaireComplete) navigate("/explorematches");
        return;

      case "action":
        if (questionnaireComplete) navigate("/action");
        return;

      case "launch":
        if (questionnaireComplete) navigate("/launch");
        return;

      default:
        return;
    }
  };

  /** -------------------------------
   * Render node
   --------------------------------*/
  const Node: React.FC<{
    k: Key;
    className: string;
    bubbleSide: "left" | "right";
  }> = ({ k, className, bubbleSide }) => {
    const st = states[k];

    return (
      <div className={`jm-node ${className}`}>
        <button
          className={`jm-node-btn ${st}`}
          disabled={st === "future"}
          onClick={() => go(k)}
        >
          <img src={iconFor(st)} className="jm-node-icon" alt="" />
        </button>

        <div className={`jm-node-label ${st === "future" ? "locked" : ""}`}>
          {LABEL[k]}
        </div>

        {st === "current" && (
          <button className={`jm-bubble ${bubbleSide}`} onClick={() => go(k)}>
            <span className="accent">{HELPER[k].accent}</span>
            {HELPER[k].rest}
          </button>
        )}
      </div>
    );
  };

  /** -------------------------------
   * UI
   --------------------------------*/
  return (
    <div className="mobile-frame">
      <div className="jm-header">
        <div>
          <h3 className="jm-title">Welcome {firstName}</h3>
          <p className="jm-subtitle">
            Your journey to a fulfilling career awaits.
          </p>
        </div>

        <FiMenu
          className="jm-menu"
          onClick={() => setIsSidebarOpen(true)}
        />
      </div>

      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <div className="jm-canvas">
        <img src={JourneyLine} className="jm-line" alt="" />

        <Node k="discovery" className="pos-discovery" bubbleSide="right" />
        <Node k="coaching" className="pos-coaching" bubbleSide="left" />
        <Node k="matches" className="pos-matches" bubbleSide="left" />
        <Node k="action" className="pos-action" bubbleSide="right" />
        <Node k="launch" className="pos-launch" bubbleSide="left" />
      </div>

      <div className="jm-progress">
        <div className="row">
          <span>Journey Progress</span>
          <span>{progressPct}%</span>
        </div>

        <div className="bar">
          <div
            className="fill"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default Journey;
