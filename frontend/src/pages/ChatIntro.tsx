import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import BottomNav from "../components/BottomNav";
import ChatBubble from "../components/ChatBubble";
import TypingIndicator from "../components/TypingIndicator";
import ModalPrompt from "../components/ModalPrompt";
import "../styles/global.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

interface ChatMessage {
  id: string;
  sender: "bot" | "user";
  text: string;
  response_type?: string;
  options?: string[];
}

const ChatIntro: React.FC = () => {
  const navigate = useNavigate();
  const [chatScript, setChatScript] = useState<ChatMessage[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState("");
  const [showModal, setShowModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const userId = localStorage.getItem("user_id") || "1";
  const [showToast, setShowToast] = useState(false);

  // 🧠 Fetch Chat Script
  useEffect(() => {
    const fetchChatScript = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/questionnaire/chat`);
        const data = await response.json();
        if (data?.data?.intro_chat) {
          const script = data.data.intro_chat.map((msg: any) => ({
            ...msg,
            sender: "bot",
          }));
          setChatScript(script);
          setMessages([{ ...script[0] }]);
        }
      } catch (error) {
        console.error("Error loading chat script:", error);
      }
    };
    fetchChatScript();
  }, []);

  // 🔄 Scroll to bottom when new message appears
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 💬 Handle User Reply
  const handleUserResponse = async (text: string) => {
    if (!chatScript.length) return;

    const lastBotMessage = messages[messages.length - 1];
    const nextIndex =
      chatScript.findIndex((m) => m.id === lastBotMessage.id) + 1;

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      sender: "user",
      text,
    };
    setMessages((prev) => [...prev, userMsg]);

    // Save response to backend
    try {
      await fetch(`${API_BASE_URL}/questionnaire/chat/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: parseInt(userId),
          chat_id: lastBotMessage.id,
          response: text,
        }),
      });
    } catch (err) {
      console.error("Error saving chat response:", err);
    }

    // 🕓 Show typing indicator
    setMessages((prev) => [...prev, { id: "typing", sender: "bot", text: "..." }]);

    setTimeout(() => {
      setMessages((prev) => prev.filter((m) => m.id !== "typing")); // remove typing indicator

      if (nextIndex < chatScript.length) {
        setMessages((prev) => [...prev, chatScript[nextIndex]]);
      } else {
        // ✅ Show modal after final message
        const lowerText = text.toLowerCase().trim();
        if (lowerText.includes("maybe later") || lowerText.includes("remind me")) {
          setShowToast(true);
          setTimeout(() => {
            setShowToast(false);
            navigate("/journey");
          }, 2000);
        } else {
          setShowModal(true);
        }
      }
    }, 1200); // typing delay

    setUserInput("");
  };

  return (
    <div className="mobile-frame">
      {/* 🧠 HEADER */}
      <div style={{ textAlign: "center", padding: "1rem 0 0.5rem" }}>
        <h3 style={{ fontWeight: 700, color: "#0f1416" }}>TruNorthAI Assistant</h3>
        <p style={{ fontSize: "0.85rem", color: "#6c6c6c" }}>
          Start a conversation to get career guidance.
        </p>
      </div>

      {/* 💬 CHAT AREA */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          paddingTop: "0.5rem",
          paddingBottom: "0.5rem",
        }}
      >
        {messages.map((msg, idx) =>
          msg.id === "typing" ? (
            <TypingIndicator key={idx} />
          ) : (
            <ChatBubble
              key={idx}
              sender={msg.sender}
              text={msg.text}
              options={msg.options}
              onOptionSelect={(option) => handleUserResponse(option)}
            />
          )
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ✏️ INPUT AREA */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          backgroundColor: "#fff",
          borderRadius: "24px",
          boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
          margin: "0.6rem 1rem 3.2rem",
          padding: "0.4rem 0.8rem",
        }}
      >
        <input
          type="text"
          placeholder="Type here..."
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          onKeyDown={(e) =>
            e.key === "Enter" && handleUserResponse(userInput.trim())
          }
          style={{
            flex: 1,
            border: "none",
            outline: "none",
            fontSize: "0.95rem",
            backgroundColor: "transparent",
            color: "#333",
            padding: "0.5rem",
          }}
        />
        <button
          onClick={() => handleUserResponse(userInput.trim())}
          disabled={!userInput.trim()}
          style={{
            backgroundColor: "var(--accent)",
            border: "none",
            color: "#fff",
            borderRadius: "50%",
            width: "36px",
            height: "36px",
            cursor: userInput.trim() ? "pointer" : "not-allowed",
          }}
        >
          ↑
        </button>
      </div>

      {/* 🎯 COMPLETION MODAL */}
      <ModalPrompt
        isOpen={showModal}
        title="🎯 Questionnaire Completed"
        message="You’ve finished the intro chat. Would you like to start your personalized questionnaire now?"
        primaryText="Yes, let's go!"
        secondaryText="Maybe later"
        onPrimary={() => navigate("/questionnaire")}
        onSecondary={() => navigate("/journey")}
      />

      {showToast && (
        <div
          style={{
            position: "fixed",
            bottom: "90px",
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "#0f1416",
            color: "#fff",
            padding: "0.7rem 1.2rem",
            borderRadius: "20px",
            fontSize: "0.9rem",
            boxShadow: "0 4px 10px rgba(0,0,0,0.25)",
            animation: "fadeInOut 2s ease-in-out",
            zIndex: 200,
          }}
        >
          You can continue the questionnaire later from the Journey tab.
        </div>
      )}

      <BottomNav />
    </div>
  );
};

export default ChatIntro;
