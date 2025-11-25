import React, { useState, useRef } from "react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { FiX, FiMenu } from "react-icons/fi";
import "../styles/global.css";
import "../styles/aicoach.css";
import "../styles/voice.css";
import MicIcon from "../assets/ai_coach/voice_screen_mic_icon.svg";
import CancelIcon from "../assets/ai_coach/voice_screen_cancel_icon.svg";
import TruNorthLogo from "../assets/trunorth/trunorth_icon.svg";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const AICoachVoice: React.FC = () => {
  const navigate = useNavigate();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isUserTalking, setIsUserTalking] = useState(false);
  const [isRubyProcessing, setIsRubyProcessing] = useState(false);
  const [isRubySpeaking, setIsRubySpeaking] = useState(false);

  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const voiceRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceChunksRef = useRef<BlobPart[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  /* ---------------- Initialize Firebase UID & Session ---------------- */
  useEffect(() => {
    const initUser = async () => {
      try {
        const userId = localStorage.getItem("user_id");
        const token = localStorage.getItem("token");

        if (!userId || !token) return;

        // Ensure session exists
        let sid = localStorage.getItem("session_id");
        if (!sid) {
          sid = crypto.randomUUID();
          localStorage.setItem("session_id", sid);
        }

        // Fetch Firebase UID if missing
        const firebaseUid = localStorage.getItem("firebase_uid");
        if (!firebaseUid) {
          const res = await fetch(`${API_BASE_URL}/users/${userId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) throw new Error("Failed to fetch Firebase UID");
          const data = await res.json();
          if (data.firebase_uid) {
            localStorage.setItem("firebase_uid", data.firebase_uid);
            console.log("✅ Firebase UID initialized:", data.firebase_uid);
          }
        }
      } catch (err) {
        console.error("Failed to initialize Firebase UID:", err);
      }
    };
    initUser();
  }, []);

  /* ---------------- Case 2: User starts speaking ---------------- */
  const startVoiceListening = async () => {
    try {
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        setCurrentAudio(null);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      voiceRecorderRef.current = recorder;
      voiceChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) voiceChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(voiceChunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach((t) => t.stop());
        handleVoiceUpload(blob);
      };

      recorder.start();
      setIsUserTalking(true);
      setIsRubyProcessing(false);
      setIsRubySpeaking(false);
    } catch {
      alert("Microphone access denied.");
      navigate("/coach");
    }
  };

  /* ---------------- User stops talking ---------------- */
  const stopVoiceListening = () => {
    if (voiceRecorderRef.current?.state === "recording") voiceRecorderRef.current.stop();
    setIsUserTalking(false);
  };

  /* ---------------- Cancel entire mode ---------------- */
  const cancelVoiceMode = () => {
    if (voiceRecorderRef.current?.state === "recording") voiceRecorderRef.current.stop();
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setCurrentAudio(null);
    }

    setIsUserTalking(false);
    setIsRubyProcessing(false);
    setIsRubySpeaking(false);
    navigate("/coach");
  };

  /* ---------------- Case 3 & 4: Ruby processing → speaking ---------------- */
  const handleVoiceUpload = async (blob: Blob) => {
    try {
      // Case 3: Ruby processing
      setIsRubyProcessing(true);
      setIsRubySpeaking(false);

      const firebaseUid = localStorage.getItem("firebase_uid");
      const sessionId = localStorage.getItem("session_id");
      if (!firebaseUid || !sessionId) return;

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const formData = new FormData();
      formData.append("audio", blob, "recording.webm");
      formData.append("firebase_uid", firebaseUid);
      formData.append("session_id", sessionId);

      const res = await fetch(`${API_BASE_URL}/ai-coach/voice/voice`, {
        method: "POST",
        signal: controller.signal,
        body: formData,
      });

      if (!res.ok) throw new Error("Voice-to-Voice request failed");

      // Case 4: Ruby starts speaking
      // Case 4: Ruby finished processing → prepare to speak
      //setIsRubyProcessing(false);

      // ✅ Keep Ruby in "processing" until playback is ready
      const wavBlob = await res.blob();
      const audioUrl = URL.createObjectURL(wavBlob);
      const newAudio = new Audio(audioUrl);
      setCurrentAudio(newAudio);

      newAudio.onloadedmetadata = () => {
        // Now switch from processing → speaking exactly at playback readiness
        setIsRubyProcessing(false);
        setIsRubySpeaking(true);
        newAudio.play();
      };

      // ✅ Cleanup when playback ends
      newAudio.onended = () => {
        setIsRubySpeaking(false);
        setCurrentAudio(null);
        abortControllerRef.current = null;
      };

    } catch (err: any) {
      setIsRubyProcessing(false);
      setIsRubySpeaking(false);
      if (err.name === "AbortError") {
        console.log("Voice request aborted.");
      } else {
        alert("Voice interaction failed — switching to chat.");
        navigate("/coach");
      }
    }
  };

  /* ---------------- Text Display (based on cases) ---------------- */
  let mainText = "Tap Microphone to start talking";
  if (isUserTalking) mainText = "I'm listening\nTap Microphone to stop talking";
  else if (isRubyProcessing) mainText = "Ruby is processing the input audio";
  else if (isRubySpeaking) mainText = "Ruby is speaking\nTap Microphone to interrupt";

  /* ---------------- Determine Visual States ---------------- */
  const logoClass = isRubySpeaking
    ? "ruby-pulse" // pulsing
    : isRubyProcessing
    ? "ruby-highlight" // soft purple glow
    : ""; // static

  const micClass = isUserTalking ? "recording" : ""; // highlighted when user is speaking

  /* ---------------- UI ---------------- */
  return (
    <div className="mobile-frame ai-coach-container" style={{ position: "relative" }}>
      {/* Header */}
      <div className="ai-coach-header">
        <FiX onClick={() => navigate("/journey")} className="header-icon left" />
        <div className="header-text">
          <h3>TruNorth</h3>
          <p>Talk with your Career Coach</p>
        </div>
        <FiMenu onClick={() => setIsSidebarOpen(true)} className="header-icon right" />
      </div>
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Voice UI container */}
      <div className="voice-ui-container">
        {/* Center logo */}
        <div className="mic-ring-container">
          <div className={`pulse-ring ${logoClass}`}>
            <img src={TruNorthLogo} alt="TruNorth Logo" className="trunorth-logo" />
          </div>
        </div>

        {/* Text */}
        <div className="caption-text">{mainText}</div>

        {/* Controls */}
        <div className="transport-controls">
          <button
            className={`control-btn mic-btn ${micClass}`}
            onClick={isUserTalking ? stopVoiceListening : startVoiceListening}
          >
            <img src={MicIcon} alt="Mic" />
          </button>
          <button className="control-btn cancel-btn" onClick={cancelVoiceMode}>
            <img src={CancelIcon} alt="Cancel" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AICoachVoice;
