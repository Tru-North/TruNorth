// frontend/src/pages/AICoachChat.tsx
import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { FiX, FiMenu } from "react-icons/fi";
import "../styles/global.css";
import "../styles/aicoach.css";
import ChatBubbleCoach from "../components/ChatBubbleCoach";

import RewindIcon from "../assets/ai_coach/10sec_rewind_icon.svg";
import ForwardIcon from "../assets/ai_coach/10sec_forward_icon.svg";
import PauseIcon from "../assets/ai_coach/audio_pause_icon.svg";
import CancelIcon from "../assets/ai_coach/playback_cancel_icon.svg";
import MicIcon from "../assets/ai_coach/chat_screen_microphone_icon.svg";
import VoiceNavIcon from "../assets/ai_coach/chat_screen_voice_navigation_icon.svg";
import SendIcon from "../assets/ai_coach/chat_screen_send_icon.svg";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
}

const AICoachChat: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [firebaseUid, setFirebaseUid] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Audio / playback
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  const [showPlaybackBar, setShowPlaybackBar] = useState(false);
  const [activeMsgIndex, setActiveMsgIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [popupCoords, setPopupCoords] = useState<{ top: number; left: number } | null>(null); // ✅ new

  // Feedback
  const [feedbackState, setFeedbackState] = useState<Record<number, "like" | "dislike" | null>>(
    {}
  );

  // Inline STT
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingSTT, setIsProcessingSTT] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  /* -------------------- Firebase & session init -------------------- */
  useEffect(() => {
    const initUser = async () => {
      try {
        const userId = localStorage.getItem("user_id");
        const token = localStorage.getItem("token");
        if (!userId || !token) {
          setError("User not authenticated.");
          return;
        }
        let sid = localStorage.getItem("session_id");
        if (!sid) {
          sid = crypto.randomUUID();
          localStorage.setItem("session_id", sid);
        }
        setSessionId(sid);

        const res = await fetch(`${API_BASE_URL}/users/${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed to fetch user record");
        const data = await res.json();
        setFirebaseUid(data.firebase_uid);
        setIsReady(true);
      } catch (err: any) {
        setError(err.message || "Failed to load user data");
      }
    };
    initUser();
  }, []);

  /* -------------------- WebSocket connection -------------------- */
  const connectWebSocket = () => {
    if (!firebaseUid || socketRef.current) return;
    try {
      const wsUrl = `${API_BASE_URL.replace("http", "ws")}/ai-coach/ws/coach`;
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = () => setIsSocketConnected(true);
      socket.onclose = () => {
        setIsSocketConnected(false);
        socketRef.current = null;
        setIsLoading(false);
        setIsStreaming(false);
      };
      socket.onerror = () => {
        setIsSocketConnected(false);
        setIsLoading(false);
        setIsStreaming(false);
      };
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.answer) {
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last && last.role === "assistant")
                updated[updated.length - 1] = {
                  ...last,
                  content: last.content + data.answer,
                };
              else updated.push({ role: "assistant", content: data.answer });
              return updated;
            });
            setIsStreaming(true);
          }
          if (data.done === true) {
            setIsStreaming(false);
            setIsLoading(false);
          }
        } catch {
          setIsStreaming(false);
          setIsLoading(false);
        }
      };
    } catch {
      setIsLoading(false);
      setIsStreaming(false);
    }
  };

  useEffect(() => {
    if (firebaseUid && sessionId) connectWebSocket();
    return () => socketRef.current?.close();
  }, [firebaseUid, sessionId]);

  /* -------------------- Load chat history -------------------- */
  useEffect(() => {
    const loadHistory = async () => {
      if (!firebaseUid || !sessionId) return;
      try {
        const res = await fetch(`${API_BASE_URL}/ai-coach/history/${sessionId}`, {
          headers: {
            "x-firebase-uid": firebaseUid,
            "Content-Type": "application/json",
          },
        });
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.messages)) {
            const history = data.messages.map((m: any) => ({
              role: m.role,
              content: m.message || m.content || "",
              timestamp: m.timestamp,
            }));
            setMessages(history);
          }
        }
      } catch {
        console.warn("No previous chat history.");
      }
    };
    if (isReady) loadHistory();
  }, [firebaseUid, sessionId, isReady, location?.state]);

  /* -------------------- Auto-scroll -------------------- */
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  /* -------------------- Send message -------------------- */
  const handleSendMessage = async () => {
    if (!inputValue.trim() || !firebaseUid || !sessionId) return;
    const text = inputValue.trim();
    setInputValue("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setIsLoading(true);
    setIsStreaming(false);

    try {
      if (isSocketConnected && socketRef.current) {
        const payload = {
          message: text,
          firebase_uid: firebaseUid,
          session_id: sessionId,
        };
        socketRef.current.send(JSON.stringify(payload));
        setIsStreaming(true);
        return;
      }
      const res = await fetch(`${API_BASE_URL}/ai-coach/ask`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-firebase-uid": firebaseUid,
          "x-session-id": sessionId,
        },
        body: JSON.stringify({ question: text }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setMessages((p) => [...p, { role: "assistant", content: data.answer || "..." }]);
      setIsLoading(false);
    } catch {
      setMessages((p) => [...p, { role: "assistant", content: "⚠️ Something went wrong." }]);
      setIsLoading(false);
    }
  };

  /* -------------------- Audio / Feedback / STT -------------------- */
    // ✅ Updated playTTS anchored to speaker icon & clamped within chat-body
    const playTTS = async (text: string, index: number, iconRect?: DOMRect | null) => {
    try {
        if (!firebaseUid || !sessionId) return;
        if (audio) audio.pause();

        // ✅ FINAL FIX — always visible near bottom of mobile frame
        if (iconRect) {
        const frame = document.querySelector(".mobile-frame") as HTMLElement | null;
        if (frame) {
            const popupWidth = 220;
            const popupHeight = 60;
            const marginBottom = 100; // just above input bar

            // ✅ Center horizontally in 390px frame
            const frameWidth = frame.clientWidth || 390;
            const left = frameWidth / 2 - popupWidth / 2;

            // ✅ Stick popup above input bar (fixed, not scroll-based)
            const top = frame.clientHeight - popupHeight - marginBottom;

            console.log("Popup fixed inside mobile frame:", { top, left });
            setPopupCoords({ top, left });
        }
        }

        // ✅ Request and play audio as before
        const res = await fetch(`${API_BASE_URL}/ai-coach/voice/tts`, {
        method: "POST",
        headers: {
            "x-firebase-uid": firebaseUid,
            "x-session-id": sessionId,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
        });

        if (!res.ok) throw new Error();
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const newAudio = new Audio(url);
        setAudio(newAudio);
        setActiveMsgIndex(index);
        setShowPlaybackBar(true);

        newAudio.play();
        newAudio.onplay = () => setIsPlaying(true);
        newAudio.onpause = () => setIsPlaying(false);
        newAudio.onended = () => {
        setShowPlaybackBar(false);
        setActiveMsgIndex(null);
        setIsPlaying(false);
        setPopupCoords(null);
        setCurrentTime(0);
        setDuration(0);
        };
        newAudio.ontimeupdate = () => setCurrentTime(newAudio.currentTime);
        newAudio.onloadedmetadata = () => setDuration(newAudio.duration);
    } catch (err) {
        console.error("TTS error:", err);
        alert("Voice unavailable — showing text only.");
    }
    };

  const togglePlayPause = () => {
    if (!audio) return;
    isPlaying ? audio.pause() : audio.play();
  };
  const skip = (s: number) => {
    if (!audio) return;
    audio.currentTime = Math.min(Math.max(audio.currentTime + s, 0), duration);
  };
  const cancelPlayback = () => {
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setShowPlaybackBar(false);
    setPopupCoords(null);
    setActiveMsgIndex(null);
    setIsPlaying(false);
  };
  const formatTime = (t: number) => {
    const m = Math.floor(t / 60)
      .toString()
      .padStart(2, "0");
    const s = Math.floor(t % 60)
      .toString()
      .padStart(2, "0");
    return `${m}:${s}`;
  };

  /* -------------------- Feedback -------------------- */
  const handleFeedback = async (index: number, type: "like" | "dislike") => {
    setFeedbackState((prev) => {
      const cur = prev[index];
      const next = cur === type ? null : type;
      if (firebaseUid && sessionId) sendFeedbackToBackend(index, next);
      return { ...prev, [index]: next };
    });
  };

  const sendFeedbackToBackend = async (
    messageIndex: number,
    feedbackType: "like" | "dislike" | null
  ) => {
    if (!firebaseUid || feedbackType === null) return;
    try {
      const message = messages[messageIndex];
      if (!message || message.role !== "assistant") return;
      const messagePreview = message.content.substring(0, 50);
      const params = new URLSearchParams({
        feedback_type: feedbackType,
        message_content: messagePreview,
      });
      await fetch(`${API_BASE_URL}/ai-coach/feedback?${params.toString()}`, {
        method: "POST",
        headers: {
          "x-firebase-uid": firebaseUid,
          "Content-Type": "application/json",
        },
      });
    } catch (err) {
      console.error("Feedback submission error:", err);
    }
  };

  /* -------------------- Inline recording -------------------- */
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      mediaRecorderRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach((t) => t.stop());
        await handleSTTUpload(blob);
      };
      rec.start();
      setIsRecording(true);
    } catch {
      alert("Microphone access denied.");
    }
  };
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };
  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording")
      mediaRecorderRef.current.stop();
    setIsRecording(false);
  };

  const handleSTTUpload = async (blob: Blob) => {
    if (!firebaseUid || !sessionId) return;
    try {
      setIsProcessingSTT(true);
      const fd = new FormData();
      fd.append("audio", blob, "rec.webm");
      const res = await fetch(`${API_BASE_URL}/ai-coach/voice/stt`, {
        method: "POST",
        headers: {
          "x-firebase-uid": firebaseUid,
          "x-session-id": sessionId,
        },
        body: fd,
      });
      const data = await res.json();
      if (data.text) setInputValue(data.text);
      else alert("Didn’t catch that.");
    } catch {
      alert("Speech recognition failed.");
    } finally {
      setIsProcessingSTT(false);
    }
  };

  /* -------------------- UI -------------------- */
  return (
    <div
      className="mobile-frame ai-coach-container"
      style={{
        position: "relative",
        height: "844px",             // ✅ fixed height for bottom-nav math
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      {/* Header */}
      <div className="ai-coach-header">
        <FiX onClick={() => navigate("/journey")} className="header-icon left" />
        <div className="header-text">
          <h3>TruNorthAI Assistant</h3>
          <p>Chat with your Career Coach</p>
        </div>
        <FiMenu onClick={() => setIsSidebarOpen(true)} className="header-icon right" />
      </div>
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Chat body */}
      <div className="chat-body">
        {messages.map((msg, i) => (
          <ChatBubbleCoach
            key={i}
            role={msg.role}
            content={msg.content}
            feedbackState={feedbackState[i]}
            onFeedback={(type) => handleFeedback(i, type)}
            onPlayTTS={(bubbleRef) => playTTS(msg.content, i, bubbleRef)}
          />
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* Playback bar (anchored) */}
        {showPlaybackBar && popupCoords && (
            <div
            className="playback-bar-popup"
            style={{
                position: "absolute",
                top: `${popupCoords.top}px`,
                left: `${popupCoords.left}px`,
                transform: "translateY(0)",
                zIndex: 50,
                background: "#fff",
                borderRadius: "12px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                padding: "10px 14px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                minWidth: "220px",
                transition: "opacity 0.2s ease",
            }}
            >

            <div className="playback-controls">
            <img src={RewindIcon} alt="Rewind" onClick={() => skip(-10)} />
            <img src={PauseIcon} alt="Pause/Play" onClick={togglePlayPause} />
            <img src={ForwardIcon} alt="Forward" onClick={() => skip(10)} />
            <img src={CancelIcon} alt="Cancel" onClick={cancelPlayback} />
            </div>
            <p className="playback-time">
            {formatTime(currentTime)} / {formatTime(duration || 0)}
            </p>
        </div>
        )}

      {/* 🎙 Recording Popup */}
      {isRecording && (
        <div className="recording-popup">
          <div className="recording-left">
            <span className="recording-dot"></span>
            <span className="recording-text">Recording...</span>
          </div>
          <div className="recording-controls">
            <button onClick={stopRecording}>⏹ Stop</button>
            <button onClick={cancelRecording}>✖ Cancel</button>
          </div>
        </div>
      )}

      {/* Input bar */}
      <div className="chat-input-bar">
        <img
          src={MicIcon}
          alt="Mic"
          className={`chat-icon mic ${isRecording ? "recording" : ""}`}
          onClick={startRecording}
        />
        <img
          src={VoiceNavIcon}
          alt="Voice Mode"
          className="chat-icon voice"
          onClick={() => navigate("/coach/voice")}
        />
        <input
          type="text"
          placeholder="Type here..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
          className="chat-input"
        />
        <img
          src={SendIcon}
          alt="Send"
          className={`chat-icon send ${!inputValue.trim() || isLoading ? "disabled" : ""}`}
          onClick={handleSendMessage}
        />
      </div>
    </div>
  );
};

export default AICoachChat;
