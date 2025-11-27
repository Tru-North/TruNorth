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

import TakeActionPopup from "../components/TakeActionPopup";
import LaunchPopup from "../components/LaunchPopup";

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

const STAGE_ORDER: Key[] = ["discovery", "coaching", "matches", "action", "launch"];

interface JourneyState {
  user_id: number;
  chat_intro_done: boolean;
  questionnaire_completed: boolean;
  discovery_completed: boolean;
  coach_completed: boolean;
  matches_completed: boolean;
  action_completed: boolean;
  launch_completed: boolean;
  is_career_unlock_confirmed: boolean;
  current_stage: "discovery" | "coaching" | "matches" | "action" | "launch" | "completed";
  progress_percent: number;
  updated_at: string;
}

const Journey: React.FC = () => {
  const navigate = useNavigate();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [firstName, setFirstName] = useState<string>(
    localStorage.getItem("first_name") || "User"
  );

  const [journeyState, setJourneyState] = useState<JourneyState | null>(null);
  const [loadingJourney, setLoadingJourney] = useState<boolean>(true);

  const [questionnaireComplete, setQuestionnaireComplete] = useState<boolean>(
    localStorage.getItem("questionnaire_complete") === "true"
  );

  const userId = localStorage.getItem("user_id");
  const token = localStorage.getItem("token");

  // --------------------------------
  // TAKE ACTION POPUP STATE
  // --------------------------------
  const [showTakeActionPopup, setShowTakeActionPopup] = useState(false);
  const [actionableCareers, setActionableCareers] = useState<
    { career_profile_id: number; career_name: string }[]
  >([]);

  // --------------------------------
  // LAUNCH POPUP STATE
  // --------------------------------
  const [showLaunchPopup, setShowLaunchPopup] = useState(false);
  const [launchableCareers, setLaunchableCareers] = useState<
    { career_profile_id: number; career_name: string }[]
  >([]);

  const pickFirstName = (p: any): string | undefined =>
    p?.first_name ||
    p?.firstname ||
    p?.data?.first_name ||
    p?.data?.firstname ||
    p?.user?.first_name ||
    p?.user?.firstname;

  const authHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  };

  // --------------------------------
  // LOAD USER NAME
  // --------------------------------
  useEffect(() => {
    const loadName = async () => {
      try {
        if (!userId) return;

        const cached = localStorage.getItem("first_name");
        if (cached) setFirstName(cached);

        let r = await fetch(`${API_BASE_URL}/users/${userId}`, {
          headers: authHeaders(),
        });
        if (r.status === 404) {
          r = await fetch(`${API_BASE_URL}/user/${userId}`, {
            headers: authHeaders(),
          });
        }

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
  }, [userId, token]);

  // --------------------------------
  // LOAD JOURNEY STATE
  // --------------------------------
  const fetchJourneyState = async () => {
    if (!userId) return;
    setLoadingJourney(true);
    try {
      const res = await fetch(`${API_BASE_URL}/journey/state/${userId}`, {
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
      });
      if (res.ok) {
        const data: JourneyState = await res.json();
        setJourneyState(data);
      }
    } catch (err) {
      console.error("Error loading journey state", err);
    } finally {
      setLoadingJourney(false);
    }
  };

  useEffect(() => {
    fetchJourneyState();
  }, [userId, token]);

  // --------------------------------
  // UPDATE JOURNEY STATE
  // --------------------------------
  const updateJourneyState = async (payload: Partial<JourneyState>) => {
    if (!userId) return;
    try {
      const body = { user_id: Number(userId), ...payload };

      const res = await fetch(`${API_BASE_URL}/journey/state/update`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data: JourneyState = await res.json();
        setJourneyState(data);
      }
    } catch (err) {
      console.error("Error updating journey state", err);
    }
  };

  // --------------------------------
  // LOAD TAKE ACTION CAREERS
  // --------------------------------
  const loadActionableCareers = async () => {
    if (!userId) return;

    try {
      const res = await fetch(
        `${API_BASE_URL}/journey/actionable-careers/${userId}`,
        { headers: authHeaders() }
      );

      if (res.ok) {
        const data = await res.json();
        setActionableCareers(data.careers || []);
      }
    } catch (err) {
      console.error("Failed to load actionable careers", err);
    }
  };

  // --------------------------------
  // LOAD LAUNCHABLE CAREERS
  // --------------------------------
  const loadLaunchableCareers = async () => {
    if (!userId) return;

    try {
      const res = await fetch(
        `${API_BASE_URL}/journey/launchable-careers/${userId}`,
        { headers: authHeaders() }
      );

      if (res.ok) {
        const data = await res.json();
        setLaunchableCareers(data.careers || []);
      }
    } catch (err) {
      console.error("Failed to load launchable careers", err);
    }
  };

  // --------------------------------
  // QUESTIONNAIRE COMPLETION CHECK
  // --------------------------------
  useEffect(() => {
    const loadProgress = async () => {
      try {
        if (!userId) return;

        const headers = authHeaders();

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

            const answered = new Set((r?.data || []).map((x: any) => x?.category));

            complete = required.every((sec: any) =>
              answered.has(sec.category)
            );
          }
        } catch {}

        const final =
          complete ?? localStorage.getItem("questionnaire_complete") === "true";

        setQuestionnaireComplete(final);

        if (final) {
          localStorage.setItem("questionnaire_complete", "true");
          await updateJourneyState({ questionnaire_completed: true });
        }
      } catch {}
    };

    loadProgress();
  }, [userId, token]);

  // --------------------------------
  // MILESTONE STATES
  // --------------------------------
  const states: Record<Key, State> = useMemo(() => {
    const base: Record<Key, State> = {
      discovery: "current",
      coaching: "future",
      matches: "future",
      action: "future",
      launch: "future",
    };

    if (!journeyState) return base;

    const currentStage = journeyState.current_stage;
    if (currentStage === "completed") {
      return {
        discovery: "past",
        coaching: "past",
        matches: "past",
        action: "past",
        launch: "past",
      };
    }

    const currentIndex = STAGE_ORDER.indexOf(currentStage as Key);
    const result: Record<Key, State> = { ...base };

    STAGE_ORDER.forEach((stage, idx) => {
      if (idx < currentIndex) result[stage] = "past";
      else if (idx === currentIndex) result[stage] = "current";
      else result[stage] = "future";
    });

    return result;
  }, [journeyState]);

  // --------------------------------
  // PROGRESS PERCENT
  // --------------------------------
  const progressPct = useMemo(() => {
    if (!journeyState) return 0;
    const pct = journeyState.progress_percent;
    return Math.min(100, Math.max(0, pct));
  }, [journeyState]);

  const iconFor = (st: State) =>
    st === "past" ? IconPast : st === "current" ? IconCurrent : IconFuture;

  // --------------------------------
  // NAVIGATION LOGIC
  // --------------------------------
  const go = async (k: Key) => {
    switch (k) {
      case "discovery":
        try {
          const headers = authHeaders();

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
              await updateJourneyState({ chat_intro_done: true });
              navigate("/questionnaire");
              return;
            }
          }

          navigate("/chat-intro");
        } catch {
          navigate("/chat-intro");
        }
        return;

      case "coaching":
        if (questionnaireComplete) navigate("/coach");
        return;

      case "matches":
        if (questionnaireComplete) navigate("/explorematches");
        return;

      case "action":
        if (!questionnaireComplete) return;

        await loadActionableCareers();
        setShowTakeActionPopup(true);
        return;

      case "launch":
        if (!questionnaireComplete) return;

        await loadLaunchableCareers();
        setShowLaunchPopup(true);
        return;

      default:
        return;
    }
  };

  // --------------------------------
  // NODE COMPONENT
  // --------------------------------
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

  // --------------------------------
  // UI
  // --------------------------------
  return (
    <div className="mobile-frame">
      <div className="jm-header">
        <div>
          <h3 className="jm-title">Welcome {firstName}</h3>
          <p className="jm-subtitle">
            Your journey to a fulfilling career awaits.
          </p>
        </div>

        <FiMenu className="jm-menu" onClick={() => setIsSidebarOpen(true)} />
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
          <div className="fill" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {loadingJourney && (
        <div className="jm-loading">
          <span>Loading your journey...</span>
        </div>
      )}

      {/* TAKE ACTION POPUP */}
      {showTakeActionPopup && (
        <TakeActionPopup
          careers={actionableCareers}
          onClose={() => setShowTakeActionPopup(false)}
          onSelect={(careerId) => {
            setShowTakeActionPopup(false);
            navigate(`/microsteps/${careerId}`);
          }}
        />
      )}

      {/* LAUNCH POPUP */}
      {showLaunchPopup && (
        <LaunchPopup
          careers={launchableCareers}
          onClose={() => setShowLaunchPopup(false)}
          onSelect={(careerId) => {
            setShowLaunchPopup(false);
            navigate(`/readytolaunch/${careerId}`);
          }}
        />
      )}

      <BottomNav />
    </div>
  );
};

export default Journey;
