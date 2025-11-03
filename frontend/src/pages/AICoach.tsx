import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { FiX, FiMenu } from "react-icons/fi";
import "../styles/global.css";
import "../styles/aicoach.css";
import ReactMarkdown from "react-markdown"; // ✅ Add this import
import SpeakerIcon from "../assets/ai_coach/coach_reply_speaker_icon.svg";
import RewindIcon from "../assets/ai_coach/10sec_rewind_icon.svg";
import ForwardIcon from "../assets/ai_coach/10sec_forward_icon.svg";
import PauseIcon from "../assets/ai_coach/audio_pause_icon.svg";
import CancelIcon from "../assets/ai_coach/playback_cancel_icon.svg";
import LikeIcon from "../assets/ai_coach/coach_reply_like_icon.svg";
import DislikeIcon from "../assets/ai_coach/coach_reply_dislike_icon.svg";
import MicIcon from "../assets/ai_coach/chat_screen_microphone_icon.svg";
import VoiceNavIcon from "../assets/ai_coach/chat_screen_voice_navigation_icon.svg";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
}

const AICoach: React.FC = () => {
  const navigate = useNavigate();
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  // 🧠 WebSocket connection reference
  const socketRef = useRef<WebSocket | null>(null);

  // Connection status and partial response
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);

  // 🔹 States
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [firebaseUid, setFirebaseUid] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // 🔊 Audio playback
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  const [showPlaybackBar, setShowPlaybackBar] = useState(false);
  const [activeMsgIndex, setActiveMsgIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // 👍👎 Feedback
  const [feedbackState, setFeedbackState] = useState<
    Record<number, "like" | "dislike" | null>
  >({});

  // 🎙 Inline STT recording
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  // 🧠 Used to cancel in-flight /voice/voice requests during barge-in
  const abortControllerRef = useRef<AbortController | null>(null);
  const [isProcessingSTT, setIsProcessingSTT] = useState(false);

  // 🆕 PHASE 4: Voice-to-Voice mode states
  const [mode, setMode] = useState<"text" | "voice">("text");
  const [isVoiceListening, setIsVoiceListening] = useState(false);
  const [isVoiceProcessing, setIsVoiceProcessing] = useState(false);
  const voiceRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceChunksRef = useRef<BlobPart[]>([]);

  /* ------------------------------ Firebase UID ------------------------------ */
  useEffect(() => {
    const fetchFirebaseUid = async () => {
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
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });
        if (!res.ok) throw new Error("Failed to fetch user record");
        const data = await res.json();
        setFirebaseUid(data.firebase_uid);
        setIsReady(true);
      } catch (err: any) {
        setError(err.message || "Failed to load user data");
      }
    };
    fetchFirebaseUid();
  }, []);

  const connectWebSocket = () => {
    if (!firebaseUid || socketRef.current) return;
    
    try {
      const wsUrl = `${API_BASE_URL.replace("http", "ws")}/ai-coach/ws/coach`;
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        console.log("✅ WebSocket connected");
        setIsSocketConnected(true);
      };

      socket.onclose = () => {
        console.warn("⚠️ WebSocket disconnected");
        setIsSocketConnected(false);
        socketRef.current = null;
        // ✅ Always stop loading on disconnect
        setIsLoading(false);
        setIsStreaming(false);
      };

      socket.onerror = (err) => {
        console.error("❌ WebSocket error:", err);
        setIsSocketConnected(false);
        // ✅ Stop loading on error
        setIsLoading(false);
        setIsStreaming(false);
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // 🧠 If assistant is sending streaming text
          if (data.answer) {
            setMessages((prev) => {
              const updated = [...prev];
              const lastMsg = updated[updated.length - 1];

              if (lastMsg && lastMsg.role === "assistant") {
                // ✅ Append to existing message
                updated[updated.length - 1] = {
                  ...lastMsg,
                  content: lastMsg.content + data.answer,
                };
              } else {
                // ✅ Create new assistant message
                updated.push({
                  role: "assistant",
                  content: data.answer,
                });
              }

              return updated;
            });

            // ✅ Keep streaming active
            setIsStreaming(true);
          }

          // 🏁 When stream is DONE
          if (data.done === true) {
            console.log("✅ Stream complete");
            // ✅ STOP BOTH FLAGS
            setIsStreaming(false);
            setIsLoading(false);
          }
          
          // 🛑 On error from backend
          if (data.error) {
            console.error("Backend error:", data.error);
            setIsStreaming(false);
            setIsLoading(false);
          }
          
        } catch (e) {
          console.error("WebSocket parse error:", e);
          setIsStreaming(false);
          setIsLoading(false);
        }
      };

    } catch (e) {
      console.error("WebSocket connection failed:", e);
      setIsLoading(false);
      setIsStreaming(false);
    }
  };

  useEffect(() => {
    if (firebaseUid && sessionId) connectWebSocket();
    return () => {
      if (socketRef.current) socketRef.current.close();
    };
  }, [firebaseUid, sessionId]);


  /* ------------------------------ Load History ------------------------------ */
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
  }, [firebaseUid, sessionId, isReady]);

  /* ------------------------------ Auto Scroll ------------------------------ */
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  /* ----------------------------- Send Message ------------------------------- */
  const handleSendMessage = async () => {
    if (!inputValue.trim() || !firebaseUid || !sessionId) return;

    const userMessage = inputValue.trim();
    setInputValue("");
    
    // ✅ Add user message immediately
    setMessages((prev) => [
      ...prev,
      { role: "user", content: userMessage },
    ]);
    
    // ✅ Start loading states ONLY
    setIsLoading(true);
    setIsStreaming(false); // Reset streaming first

    try {
      if (isSocketConnected && socketRef.current) {
        // 🔹 Send via WebSocket
        const payload = {
          message: userMessage,
          firebase_uid: firebaseUid,
          session_id: sessionId,
        };
        
        socketRef.current.send(JSON.stringify(payload));
        console.log("📤 Sent to WebSocket:", payload);
        
        // ✅ Set streaming AFTER sending
        setIsStreaming(true);
        return;
      }

      // 🧩 Fallback: Use REST API
      const res = await fetch(`${API_BASE_URL}/ai-coach/ask`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-firebase-uid": firebaseUid,
          "x-session-id": sessionId,
        },
        body: JSON.stringify({ question: userMessage }),
      });

      if (!res.ok) throw new Error("Failed to fetch response");

      const data = await res.json();
      
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.answer || "..." },
      ]);
      
      // ✅ Stop loading immediately
      setIsLoading(false);
      
    } catch (err) {
      console.error("Message send error:", err);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "⚠️ Something went wrong." },
      ]);
      // ✅ Stop loading on error
      setIsLoading(false);
    }
  };



  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  /* ----------------------------- Audio Controls ----------------------------- */
  const playTTS = async (text: string, index: number) => {
    try {
      if (!firebaseUid || !sessionId) return;
      if (audio) {
        audio.pause();
        setAudio(null);
      }

      const res = await fetch(`${API_BASE_URL}/ai-coach/voice/tts`, {
        method: "POST",
        headers: {
          "x-firebase-uid": firebaseUid,
          "x-session-id": sessionId,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) throw new Error("TTS request failed");

      const blob = await res.blob();
      const audioUrl = URL.createObjectURL(blob);

      const newAudio = new Audio(audioUrl);
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
        setCurrentTime(0);
        setDuration(0);
      };
      newAudio.ontimeupdate = () => setCurrentTime(newAudio.currentTime);
      newAudio.onloadedmetadata = () => setDuration(newAudio.duration);
    } catch (err) {
      console.error("TTS playback failed:", err);
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

  /* ----------------------------- Feedback Logic ----------------------------- */
  const handleFeedback = async (index: number, type: "like" | "dislike") => {
    // Toggle feedback state in UI
    setFeedbackState((prev) => {
      const current = prev[index];
      const newType = current === type ? null : type;
      
      // If changing or removing feedback, send to backend
      if (firebaseUid && sessionId) {
        sendFeedbackToBackend(index, newType);
      }
      
      return { ...prev, [index]: newType };
    });
  };
  const sendFeedbackToBackend = async (
    messageIndex: number,
    feedbackType: "like" | "dislike" | null
  ) => {
    if (!firebaseUid || feedbackType === null) return;

    try {
      // Get the message content (first 50 chars for identification)
      const message = messages[messageIndex];
      if (!message || message.role !== "assistant") return;
      
      const messagePreview = message.content.substring(0, 50);
      
      const params = new URLSearchParams({
        feedback_type: feedbackType,
        message_content: messagePreview,
      });
      
      const res = await fetch(
        `${API_BASE_URL}/ai-coach/feedback?${params.toString()}`,
        {
          method: "POST",
          headers: {
            "x-firebase-uid": firebaseUid,
            "Content-Type": "application/json",
          },
        }
      );

      if (res.ok) {
        const data = await res.json();
        console.log(`✅ Feedback '${feedbackType}' saved:`, data);
      } else {
        const error = await res.json();
        console.error("Failed to save feedback:", error);
      }
    } catch (err) {
      console.error("Feedback submission error:", err);
    }
  };

  /* ------------------------- Inline Recording Logic -------------------------- */
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        console.log("🎙️ Recorded Blob:", blob);
        stream.getTracks().forEach((t) => t.stop());
        await handleSTTUpload(blob);
      };

      recorder.start();
      setIsRecording(true);
    } catch {
      alert("Microphone access denied. Please enable it in your browser.");
    }
  };

  const handleStopRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleCancelRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  /* ------------------------- Upload to /voice/stt ---------------------------- */
  const handleSTTUpload = async (blob: Blob) => {
    if (!firebaseUid || !sessionId) return;
    try {
      setIsProcessingSTT(true);
      const formData = new FormData();
      formData.append("audio", blob, "recording.webm");

      const res = await fetch(`${API_BASE_URL}/ai-coach/voice/stt`, {
        method: "POST",
        headers: {
          "x-firebase-uid": firebaseUid,
          "x-session-id": sessionId,
        },
        body: formData,
      });

      if (!res.ok) throw new Error("STT request failed");

      const data = await res.json();
      if (data.text) {
        setInputValue(data.text);
      } else {
        alert("Didn’t catch that. Try again?");
      }
    } catch (err) {
      console.error("STT Upload Error:", err);
      alert("Speech recognition failed. Please try again.");
    } finally {
      setIsProcessingSTT(false);
    }
  };

  /* --------------------------- Voice Mode Handlers --------------------------- */
  const toggleVoiceMode = () => {
    setMode((prev) => (prev === "text" ? "voice" : "text"));
    setIsVoiceListening(false);
  };

  const startVoiceListening = async () => {
    try {
      // 🛑 1. Stop any playing audio first
      if (audio) {
        audio.pause();
        setAudio(null);
      }

      // 🛑 2. Cancel any active fetch (previous /voice/voice call)
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }

      // 🧩 3. Continue as before — start new mic recording
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      voiceRecorderRef.current = recorder;
      voiceChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) voiceChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(voiceChunksRef.current, { type: "audio/webm" });
        console.log("🎧 Voice-mode blob ready:", blob);
        stream.getTracks().forEach((t) => t.stop());
        handleVoiceUpload(blob);
      };

      recorder.start();
      setIsVoiceListening(true);
    } catch {
      alert("Microphone access denied. Please allow mic access.");
      setMode("text");
    }
  };

  const stopVoiceListening = () => {
    if (
      voiceRecorderRef.current &&
      voiceRecorderRef.current.state === "recording"
    ) {
      voiceRecorderRef.current.stop();
    }
    setIsVoiceListening(false);
  };

  const cancelVoiceMode = () => {
    // 🛑 Stop listening (if recording)
    stopVoiceListening();

    // 🛑 Stop any playing audio (Ruby speaking)
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      setAudio(null);
    }

    // 🛑 Cancel any in-progress voice request (fetch)
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // 🧹 Reset UI state
    setIsVoiceListening(false);
    setIsVoiceProcessing(false);
    setMode("text");
  };

  /* ------------------------- Upload to /voice/voice ---------------------------- */
  // 🎤 Upload the voice blob and play Ruby's response (voice → voice)
  const handleVoiceUpload = async (blob: Blob) => {
    if (!firebaseUid || !sessionId) return;
    try {
      setIsVoiceProcessing(true);

      // 💫 new AbortController for this fetch
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const formData = new FormData();
      formData.append("audio", blob, "recording.webm");
      formData.append("firebase_uid", firebaseUid);
      formData.append("session_id", sessionId);

      const res = await fetch(`${API_BASE_URL}/ai-coach/voice/voice`, {
        method: "POST",
        signal: controller.signal, // 👈 key addition
        body: formData,
      });

      if (!res.ok) throw new Error("Voice-to-Voice request failed");

      // 🗣 play the WAV response from backend
      const wavBlob = await res.blob();
      const audioUrl = URL.createObjectURL(wavBlob);
      const newAudio = new Audio(audioUrl);

      // 💬 Show user + assistant messages
      const userText = res.headers.get("X-User-Text");
      const answerText = res.headers.get("X-Answer-Text");

      if (userText) {
        setMessages((prev) => [...prev, { role: "user", content: userText }]);
      }
      if (answerText) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: answerText },
        ]);
      }

      // 🔊 Play the coach’s voice reply
      newAudio.play();
      setAudio(newAudio);
      newAudio.onended = () => {
        setIsVoiceProcessing(false);
        abortControllerRef.current = null;
      };
    } catch (err: any) {
      if (err.name === "AbortError") {
        console.log("⏹ Voice fetch aborted (barge-in triggered).");
      } else {
        console.error("Voice-to-Voice error:", err);
        alert("Voice interaction failed — switching to text mode.");
        setMode("text");
      }
    } finally {
      setIsVoiceProcessing(false);
    }
  };


  /* --------------------------- UI Rendering --------------------------- */
  return (
    <div className="mobile-frame ai-coach-container" style={{ position: "relative" }}>
      {/* Header */}
      <div className="ai-coach-header">
        <FiX onClick={() => navigate("/journey")} className="header-icon left" />
        <div className="header-text">
          <h3>TruNorthAI Assistant</h3>
          <p>
            {mode === "voice"
              ? "Voice Conversation Mode"
              : "Chat with your personalized Career Coach"}
          </p>
        </div>
        <FiMenu onClick={() => setIsSidebarOpen(true)} className="header-icon right" />
      </div>

      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Chat Body - ✅ UPDATED WITH MARKDOWN RENDERING */}
      <div className="chat-body">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`chat-row ${msg.role} ${
              activeMsgIndex === i ? "active-bubble" : ""
            }`}
          >
            <div
              className={`chat-bubble ${
                msg.role === "user" ? "bubble-user" : "bubble-assistant"
              }`}
            >
              {/* ✅ Use ReactMarkdown for assistant messages */}
              {msg.role === "assistant" ? (
                <div className="markdown-content">
                  <ReactMarkdown
                    components={{
                      // Style headings
                      h1: ({ node, ...props }) => (
                        <h1 className="text-xl font-bold mt-3 mb-2" {...props} />
                      ),
                      h2: ({ node, ...props }) => (
                        <h2 className="text-lg font-bold mt-2 mb-1" {...props} />
                      ),
                      h3: ({ node, ...props }) => (
                        <h3 className="text-base font-bold mt-2 mb-1" {...props} />
                      ),
                      // Style lists
                      ul: ({ node, ...props }) => (
                        <ul className="list-disc list-inside space-y-1 my-2 ml-2" {...props} />
                      ),
                      ol: ({ node, ...props }) => (
                        <ol className="list-decimal list-inside space-y-1 my-2 ml-2" {...props} />
                      ),
                      li: ({ node, ...props }) => (
                        <li className="ml-2 leading-relaxed" {...props} />
                      ),
                      // Style paragraphs
                      p: ({ node, ...props }) => (
                        <p className="mb-2 leading-relaxed" {...props} />
                      ),
                      // Style code blocks
                      code: ({ node, inline, className, children, ...props }: any) =>
                        inline ? (
                          <code
                            className="bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded text-sm"
                            {...props}
                          >
                            {children}
                          </code>
                        ) : (
                          <code
                            className="block bg-gray-200 dark:bg-gray-700 p-2 rounded my-2 text-sm overflow-x-auto"
                            {...props}
                          >
                            {children}
                          </code>
                        ),
                      // Style bold text
                      strong: ({ node, ...props }) => (
                        <strong className="font-semibold" {...props} />
                      ),
                      // Style emphasis/italic
                      em: ({ node, ...props }) => (
                        <em className="italic" {...props} />
                      ),
                      // Style links
                      a: ({ node, ...props }) => (
                        <a
                          className="text-blue-600 dark:text-blue-400 underline hover:text-blue-800"
                          target="_blank"
                          rel="noopener noreferrer"
                          {...props}
                        />
                      ),
                      // Style blockquotes
                      blockquote: ({ node, ...props }) => (
                        <blockquote
                          className="border-l-4 border-gray-300 pl-3 italic my-2"
                          {...props}
                        />
                      ),
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
              ) : (
                // User messages stay as plain text
                msg.content
              )}

              {/* Feedback buttons */}
              {msg.role === "assistant" && (
                <div className="feedback-buttons">
                  <img
                    src={LikeIcon}
                    alt="Like"
                    className={`feedback-icon ${
                      feedbackState[i] === "like" ? "active-like" : ""
                    }`}
                    onClick={() => handleFeedback(i, "like")}
                  />
                  <img
                    src={DislikeIcon}
                    alt="Dislike"
                    className={`feedback-icon ${
                      feedbackState[i] === "dislike" ? "active-dislike" : ""
                    }`}
                    onClick={() => handleFeedback(i, "dislike")}
                  />
                  <img
                    src={SpeakerIcon}
                    alt="Play voice"
                    className="feedback-icon speaker-inline"
                    onClick={() => playTTS(msg.content, i)}
                  />
                </div>
              )}
            </div>
          </div>
        ))}

        <div ref={chatEndRef} />
      </div>

      {/* Inline Recording Overlay */}
      {isRecording && (
        <div className="recording-overlay">
          <div className="recording-overlay-left">
            <span className="pulse-dot"></span>
            <span className="recording-text">
              {isProcessingSTT ? "Processing..." : "Recording..."}
            </span>
          </div>
          <div className="recording-controls">
            <button onClick={handleStopRecording} disabled={isProcessingSTT}>
              ✅
            </button>
            <button onClick={handleCancelRecording} disabled={isProcessingSTT}>
              ❌
            </button>
          </div>
        </div>
      )}

      {/* Playback Bar */}
      {showPlaybackBar && (
        <div className="playback-bar">
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

      {/* 🆕 Voice Mode Overlay */}
      {mode === "voice" && (
        <div className="voice-overlay">
          <div className={`pulse-ring ${isVoiceListening ? "active" : ""}`}>
            <img src={VoiceNavIcon} alt="Voice" className="voice-center-icon" />
          </div>
          <p className="overlay-text">
            {isVoiceProcessing
              ? "Processing your voice..."
              : isVoiceListening
              ? "I'm listening..."
              : "Tap Start to begin speaking"}
          </p>
          <div className="overlay-controls">
            {isVoiceListening ? (
              <button onClick={stopVoiceListening}>✅ Stop</button>
            ) : (
              <button onClick={startVoiceListening}>🎙 Start</button>
            )}
            <button onClick={cancelVoiceMode}>❌ Cancel</button>
          </div>
        </div>
      )}

      {/* ✅ Input bar for text mode */}
      {mode === "text" && (
        <div className="input-bar">
          <img
            src={MicIcon}
            alt="Mic"
            className={`mic-btn ${isRecording ? "recording" : ""}`}
            onClick={startRecording}
          />
          <img
            src={VoiceNavIcon}
            alt="Voice Mode"
            className="voice-toggle-btn"
            onClick={toggleVoiceMode}
          />
          <input
            type="text"
            placeholder="Type your message..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSendMessage();
            }}
            className="input-field"
          />
          <button
            onClick={handleSendMessage}
            disabled={isLoading || !inputValue.trim()}
            className="send-btn"
          >
            ➤
          </button>
        </div>
      )}
    </div>
  );
};

export default AICoach;
