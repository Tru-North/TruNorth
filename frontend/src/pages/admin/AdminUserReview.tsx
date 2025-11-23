import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import "../../styles/AdminUserReview.css";

import CompanyLogo from "../../assets/trunorth/trunorth_icon.svg";
import ClockIcon from "../../assets/admin/admin_user_review_clock_icon.svg";
import LogoutIcon from "../../assets/admin/admin_logout_icon.svg";

import ChatBubbleReview from "../../components/ChatBubbleReview";

import {
  adminAuthService,
  adminAuthToken,
} from "../../services/admin_auth_service";
import { adminUserService } from "../../services/adminUserService";

// ⭐ EST DATE FORMATTER
const formatEST = (iso: string | null) => {
  if (!iso) return "--";

  try {
    const date = new Date(iso);
    return (
      date.toLocaleString("en-US", {
        timeZone: "America/New_York",
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }) + " EST"
    );
  } catch {
    return iso;
  }
};

// ---- Types for sessions + messages from backend ----
type AdminSession = {
  session_id: number;
  started_at: string;
  last_message: string | null;
  message_count: number;
};

type AdminMessage = {
  id: number;
  user_id: number;
  role: string; // "assistant" | "user"
  message: string;
  timestamp: string;
};

const AdminUserReview: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const userId = id ? parseInt(id, 10) : null;

  // ---------------------------------------------------------
  // AUTH GUARD
  // ---------------------------------------------------------
  useEffect(() => {
    if (!adminAuthToken.get()) {
      navigate("/admin/login");
    }
    if (!userId || Number.isNaN(userId)) {
      navigate("/admin/dashboard");
    }
  }, [navigate, userId]);

  const handleLogout = () => {
    adminAuthService.logout();
  };

  // ---------------------------------------------------------
  // LEFT PANEL: Sessions + Messages
  // ---------------------------------------------------------
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [activeSessionIndex, setActiveSessionIndex] = useState(0);
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [profileName, setProfileName] = useState("User");
  const [profileLastLogin, setProfileLastLogin] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<any>(null);

  useEffect(() => {
    if (!userId) return;

    const loadUserInfo = async () => {
      try {
        const user = await adminUserService.getSingleUser(userId);
        setUserInfo(user);
      } catch (err) {
        console.error("Failed to load user info", err);
      }
    };

    loadUserInfo();
  }, [userId]);


  useEffect(() => {
    const loadSessions = async () => {
      if (!userId) return;
      try {
        setLoadingSessions(true);
        const data = await adminUserService.getSessions(userId);
        setSessions(data || []);
        setActiveSessionIndex(0);
      } catch (err) {
        console.error("Failed to load sessions", err);
      } finally {
        setLoadingSessions(false);
      }
    };
    loadSessions();
  }, [userId]);

  useEffect(() => {
    const loadMessages = async () => {
      if (!userId) return;
      if (!sessions.length) {
        setMessages([]);
        return;
      }
      const session = sessions[activeSessionIndex];
      if (!session) return;

      try {
        setLoadingMessages(true);
        const data = await adminUserService.getSessionMessages(
          userId,
          session.session_id
        );
        setMessages(data || []);
      } catch (err) {
        console.error("Failed to load messages", err);
        setMessages([]);
      } finally {
        setLoadingMessages(false);
      }
    };
    loadMessages();
  }, [userId, sessions, activeSessionIndex]);

  const formatLastActivity = (iso: string | null) => {
    if (!iso) return "No activity";
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // ---------------------------------------------------------
  // RIGHT PANEL: Step 1 (Load + Display backend data)
  // ---------------------------------------------------------
  const [loadingRightPanel, setLoadingRightPanel] = useState(true);

  const [aiIntentSummary, setAiIntentSummary] = useState("");
  const [profileSummary, setProfileSummary] = useState("");

  const [reviewData, setReviewData] = useState({
    editable_output: "",
    tag: "",
    comment: "",
    message_to_user: "",
    nudge_ai: "",
  });

  const [otherTagText, setOtherTagText] = useState("");
  const tagOptions = [
    "Off-Scope Response",
    "Inaccurate Info",
    "Hallucination",
    "Repetitive",
    "Tone Issue",
    "Under-Responsive",
    "Prompt Misunderstanding",
    "Broken Flow",
    "Needs Escalation",
    "Other",
  ];

  // ---- LOAD RIGHT PANEL DATA ----
  useEffect(() => {
    const loadRightPanel = async () => {
      if (!userId) return;

      try {
        setLoadingRightPanel(true);

        const [intent, profile, review] = await Promise.all([
          adminUserService.getAIIntentSummary(userId),
          adminUserService.getProfileSummary(userId),
          adminUserService.loadReview(userId),
        ]);

        setAiIntentSummary(intent?.ai_intent_summary || "");
        // setProfileName(profile?.name || "User");
        // setProfileSummary(profile?.context || "");
        setProfileName(profile?.name || "User");
        setProfileLastLogin(profile?.last_login || null);

        let cleanedContext = profile?.context || "";

        // Remove markdown **
        cleanedContext = cleanedContext.replace(/\*\*/g, "");

        // Remove "Profile Summary for <Name>"
        const name = profile?.name || "";
        const headerRegex = new RegExp(`Profile Summary for ${name}\\s*`, "i");
        cleanedContext = cleanedContext.replace(headerRegex, "").trim();

        setProfileSummary(cleanedContext);

        let editable = review?.editable_output ?? "";

        // 🚫 If editable output accidentally contains auto-generated profile summary, clear it
        if (editable.trim().startsWith("**Profile Summary for")) {
          editable = "";
        }

        setReviewData({
          editable_output: editable,
          tag: review?.tag || "",
          comment: review?.comment || "",
          message_to_user: review?.message_to_user || "",
          nudge_ai: review?.nudge_ai || "",
        });

        // 🚀 Force React to rebuild textarea nodes after async load
        setTimeout(() => {
          setReviewData((prev) => ({ ...prev }));
        }, 0);

        if (review?.tag === "Other") {
          setOtherTagText(review?.tag_other_text || "");
        }
      } catch (err) {
        console.error("Failed to load right panel data", err);
      } finally {
        setLoadingRightPanel(false);
      }
    };

    loadRightPanel();
  }, [userId]);

  // ---- SAVE LOGIC ----
  const [saving, setSaving] = useState(false);

  const saveField = async (field: string, value: string) => {
    if (!userId) return;

    try {
      setSaving(true);

      const payload: any = {};
      payload[field] = value;

      // If user chooses "Other", also send the custom text
      if (field === "tag" && value === "Other") {
        payload.tag_other_text = otherTagText;
      }

      // If admin is explicitly saving the custom text
      if (field === "tag_other_text") {
        payload.tag_other_text = value;
      }

      const updated = await adminUserService.saveReview(userId, payload);

      // Update everything with backend response
      setReviewData({
        editable_output: updated.editable_output || "",
        tag: updated.tag || "",
        comment: updated.comment || "",
        message_to_user: updated.message_to_user || "",
        nudge_ai: updated.nudge_ai || "",
      });

      // ⭐ MOST IMPORTANT: Persist custom tag text properly
      if (updated.tag === "Other") {
        setOtherTagText(updated.tag_other_text || "");
      }
    } catch (err) {
      console.error("Failed to save field", field, err);
    } finally {
      setSaving(false);
    }
  };

  // ---------------------------------------------------------
  // AI CONFIDENCE SCORE (must be above conditional return)
  // ---------------------------------------------------------
  const [aiScore, setAiScore] = useState<number | null>(null);

  useEffect(() => {
    if (!userId) return;

    const loadAIConfidence = async () => {
      try {
        const data = await adminUserService.getAIConfidence(userId);
        setAiScore(data.ai_confidence_score);
      } catch (err) {
        console.error("Failed to load AI confidence", err);
        setAiScore(null);
      }
    };

    loadAIConfidence();
  }, [userId]);


  if (loadingRightPanel) {
    return (
      <div className="admin-review-page">
        <div className="loading-placeholder" style={{ padding: "40px", textAlign: "center" }}>
          Loading…
        </div>
      </div>
    );
  }

  return (
    <div className="admin-review-page">
      
      {/* TOP HEADER */}
      <div className="header-top">
        <header className="review-page-header">
          <div className="page-header-inner">
            <img
              src={CompanyLogo}
              className="page-header-logo"
              onClick={() => navigate("/admin/dashboard")}
              style={{ cursor: "pointer" }}
            />
            <span className="page-header-title">User Review Dashboard</span>
            <button className="logout-btn" onClick={handleLogout}>
              Log out
              <img src={LogoutIcon} className="logout-icon" alt="logout" />
            </button>
          </div>
        </header>
      </div>

      {/* SECOND HEADER */}
      <div className="header-sub">
        <div className="review-user-header">
          <div className="review-user-section">
            <span className="review-user-label">User ID:</span>
            <span className="review-user-value">{userId ?? "—"}</span>
          </div>

          <div className="review-user-section">
            <img src={ClockIcon} className="review-user-icon" />
            <span className="review-user-label">Last login:</span>
            <span className="review-user-value">
              {userInfo?.last_login
                ? new Date(userInfo.last_login).toLocaleString("en-US", {
                    month: "long",
                    day: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                    timeZone: "America/New_York",
                    timeZoneName: "short"
                  })
                : "--"}
            </span>
          </div>

          <div className="review-user-confidence">AI Confidence: {aiScore ?? "--"}%</div>
        </div>
      </div>

      {/* MAIN LAYOUT */}
      <div className="admin-review-wrapper">
        <div className="admin-review-layout">

          {/* LEFT SIDE */}
          <div className="review-left">
            <div className="chat-tabs">
              {loadingSessions && sessions.length === 0 && (
                <div className="user-tab loading">Loading sessions…</div>
              )}

              {!loadingSessions &&
                sessions.map((session, index) => (
                  <div
                    key={session.session_id}
                    className={`user-tab ${
                      activeSessionIndex === index ? "active" : ""
                    }`}
                    onClick={() => setActiveSessionIndex(index)}
                  >
                    <div className="user-tab-title">Session {index + 1}</div>
                    <div className="user-tab-subtitle">
                      Last Login:{" "}
                      {session.last_message
                        ? new Date(session.last_message).toLocaleString("en-US", {
                            month: "short",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                            // timeZone: "America/New_York",
                          }) //+ " EST"
                        : "--"}
                    </div>
                  </div>
                ))}

              {!loadingSessions && sessions.length === 0 && (
                <div className="user-tab empty">No sessions found</div>
              )}
            </div>

            <div className="chat-box">
              {loadingMessages && (
                <div className="chat-loading">Loading chat…</div>
              )}

              {!loadingMessages && messages.length === 0 && (
                <div className="chat-empty">No messages for this session.</div>
              )}

              {!loadingMessages &&
                messages.map((msg) => (
                  <ChatBubbleReview
                    key={msg.id}
                    role={msg.role === "assistant" ? "assistant" : "user"}
                    content={msg.message}
                  />
                ))}
            </div>
          </div>

          {/* DIVIDER */}
          <div className="review-divider"></div>

          {/* RIGHT PANEL */}
          <div className="review-right">
            <h2 className="review-right-title">Review Tool</h2>

            {/* BOX 1 */}
            <div className="review-box">
              <div className="review-section">
                <h3 className="section-title">AI Intent Summary</h3>

                <textarea
                  className="intent-textarea"
                  placeholder="Loading intent summary..."
                  value={aiIntentSummary}
                  readOnly
                  disabled={loadingRightPanel}
                />
              </div>

              <div className="review-section">
                <h3 className="section-title">Editable Output</h3>

                <div className="editable-output-wrapper">
                  <textarea
                    className="editable-output-textarea"
                    placeholder="Enter editable output..."
                    value={reviewData.editable_output}
                    onChange={(e) =>
                      setReviewData({ ...reviewData, editable_output: e.target.value })
                    }
                    disabled={loadingRightPanel}
                  />
                  <button
                    className="editable-save-btn"
                    disabled={saving}
                    onClick={() => saveField("editable_output", reviewData.editable_output)}
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>

                </div>
              </div>

              {/* C) TAG DROPDOWN */}
              <div className="review-section">
                <h3 className="section-title">Tags</h3>

                <select
                  className="tag-dropdown"
                  value={reviewData.tag}
                  onChange={(e) => {
                    const v = e.target.value;
                    setReviewData({ ...reviewData, tag: v });
                    saveField("tag", v);
                  }}
                >
                  <option value="">Select...</option>
                  {tagOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>

                {reviewData.tag === "Other" && (
                  <div className="tag-other-inline-box">
                    <textarea
                      className="tag-other-inline-input"
                      placeholder="Enter custom tag..."
                      value={otherTagText}
                      onChange={(e) => setOtherTagText(e.target.value)}
                    />

                    <button
                      className="tag-other-inline-save-btn"
                      onClick={() => saveField("tag_other_text", otherTagText)}
                    >
                      Save
                    </button>
                  </div>
                )}
              </div>


              <div className="review-section">
                <h3 className="section-title">Comment Box</h3>
                <div className="editable-output-wrapper">
                  <textarea
                    className="editable-output-textarea"
                    value={reviewData.comment}
                    onChange={(e) =>
                      setReviewData({ ...reviewData, comment: e.target.value })
                    }
                  />
                  <button
                    className="editable-save-btn"
                    disabled={saving}
                    onClick={() => saveField("comment", reviewData.comment)}
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>

                </div>
              </div>

              <div className="review-section">
                <h3 className="section-title">Message User</h3>
                <div className="editable-output-wrapper">
                  <textarea
                    className="editable-output-textarea"
                    value={reviewData.message_to_user}
                    onChange={(e) =>
                      setReviewData({ ...reviewData, message_to_user: e.target.value })
                    }
                  />
                  <button
                    className="editable-save-btn"
                    disabled={saving}
                    onClick={() => saveField("message_to_user", reviewData.message_to_user)}
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>

                </div>
              </div>

              <div className="review-section">
                <h3 className="section-title">Nudge AI</h3>
                <div className="editable-output-wrapper">
                  <textarea
                    className="editable-output-textarea"
                    value={reviewData.nudge_ai}
                    onChange={(e) =>
                      setReviewData({ ...reviewData, nudge_ai: e.target.value })
                    }
                  />
                  <button
                    className="editable-save-btn"
                    disabled={saving}
                    onClick={() => saveField("nudge_ai", reviewData.nudge_ai)}
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>

                </div>
              </div>
            </div>

            {/* BOX 2 */}
            <div className="review-box">
              <div className="review-section last">
                <h3 className="section-title">Profile Summary</h3>

                <div className="profile-summary-wrapper">
                  <div className="profile-summary-header">
                    <div className="profile-summary-icon">👤</div>
                    <span className="profile-summary-name">
                      {profileName}
                    </span>
                  </div>

                  <p className="profile-summary-text">
                    {profileSummary || "No profile summary available."}
                  </p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default AdminUserReview;
