import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FiX, FiMenu } from "react-icons/fi";
import Sidebar from "../components/Sidebar";
import ChatBubbleCoachLite from "../components/ChatBubbleCoachLite";
import TypingIndicator from "../components/TypingIndicator";
import ModalPrompt from "../components/ModalPrompt";
import "../styles/global.css";
import "../styles/chatintro.css";
import SendIcon from "../assets/chatIntro_and_questionnaire/chatIntro_send_button_icon.svg";

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

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [chatScript, setChatScript] = useState<ChatMessage[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState("");
  const [showModal, setShowModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const userId = localStorage.getItem("user_id") || "1";
  const [showToast, setShowToast] = useState(false);

  // -------------------------------------
  // 🚀 NEW — Mark chat intro done
  // -------------------------------------
  const markChatIntroDone = async () => {
    try {
      await fetch(`${API_BASE_URL}/journey/state/update`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          user_id: parseInt(userId, 10),
          chat_intro_done: true,
        }),
      });
    } catch (err) {
      console.error("Failed to update chat_intro_done:", err);
    }
  };

  const markChatIntroDoneAndGoToQuestionnaire = async () => {
    await markChatIntroDone();
    navigate("/questionnaire");
  };

  const markChatIntroDoneAndGoToJourney = async () => {
    await markChatIntroDone();
    navigate("/journey");
  };
  // -------------------------------------

  // Fetch Chat Script
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

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle User Reply
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

    // Save to backend
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

    // Typing bubble
    setMessages((prev) => [
      ...prev,
      { id: "typing", sender: "bot", text: "..." },
    ]);

    setTimeout(() => {
      setMessages((prev) => prev.filter((m) => m.id !== "typing"));

      if (nextIndex < chatScript.length) {
        setMessages((prev) => [...prev, chatScript[nextIndex]]);
      } else {
        const lowerText = text.toLowerCase().trim();

        if (lowerText.includes("maybe later") || lowerText.includes("remind me")) {
          setShowToast(true);

          setTimeout(() => {
            setShowToast(false);
            markChatIntroDoneAndGoToJourney();
          }, 2000);
        } else {
          setShowModal(true);
        }
      }
    }, 1200);

    setUserInput("");
  };

  return (
    <div className="mobile-frame">

      {/* HEADER */}
      <div className="chatintro-header">
        <button className="chatintro-header-btn" onClick={() => navigate("/journey")}>
          <FiX size={22} />
        </button>

        <div className="chatintro-header-center">
          <h3>TruNorth</h3>
          <p>Setting up your profile</p>
        </div>

        <button
          className="chatintro-header-btn"
          onClick={() => setIsSidebarOpen(true)}
        >
          <FiMenu size={22} />
        </button>
      </div>

      {/* SIDEBAR */}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* CHAT AREA */}
      <div className="chatintro-chat-area">
        {messages.map((msg, idx) =>
          msg.id === "typing" ? (
            <TypingIndicator key={idx} />
          ) : (
            <div key={idx} className="chatintro-msg-wrapper">
              <ChatBubbleCoachLite sender={msg.sender} text={msg.text} />

              {msg.options && msg.options.length > 0 && (
                <div className="chatintro-options">
                  {msg.options.map((option, i) => (
                    <button
                      key={i}
                      onClick={() => handleUserResponse(option)}
                      className="chatintro-option-btn"
                    >
                      {option}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* INPUT */}
      <div className="chatintro-input-wrapper">
        <input
          type="text"
          placeholder="Type here..."
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          onKeyDown={(e) =>
            e.key === "Enter" && handleUserResponse(userInput.trim())
          }
          className="chatintro-input-field"
        />

        <button
          onClick={() => handleUserResponse(userInput.trim())}
          disabled={!userInput.trim()}
          className="chatintro-send-btn-new"
        >
          <img src={SendIcon} alt="send" className="chatintro-send-icon" />
        </button>
      </div>

      {/* MODAL */}
      <ModalPrompt
        isOpen={showModal}
        title="Questionnaire"
        message="I've attached a series of questions to help us get to know you."
        primaryText="Answer"
        secondaryText="Remind Me"
        onPrimary={markChatIntroDoneAndGoToQuestionnaire}  
        onSecondary={markChatIntroDoneAndGoToJourney}      
      />

      {showToast && (
        <div className="chatintro-toast">
          You can continue the questionnaire later from the Journey tab.
        </div>
      )}

    </div>
  );
};

export default ChatIntro;
