import React, { useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { FiArrowLeft, FiMenu } from "react-icons/fi";
import BottomNav from "../components/BottomNav";
import Sidebar from "../components/Sidebar";
import ChatBubbleStatic from "../components/ChatBubbleStatic";
import "../styles/Microsteps.css";
import UnexploredFilterSVG from "../assets/microsteps/unexplored_black_icon.svg";
import InProgressFilterSVG from "../assets/microsteps/inprogress_black_icon.svg";
import CompletedFilterSVG from "../assets/microsteps/completed_black_icon.svg";



interface MicrostepItem {
  id: number;
  title: string;
  description: string;
  status: "unexplored" | "in-progress" | "completed";
}

type MicrostepStatus = MicrostepItem["status"];

const StatusIndicator: React.FC<{ status: MicrostepStatus }> = ({ status }) => {
  if (status === "completed") {
    return (
      <div className="status-indicator completed" aria-label="Completed">
        {/* Completed: purple filled circle + white tick */}
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          aria-hidden="true"
        >
          <title>Completed</title>
          <circle cx="10" cy="10" r="9.2" fill="#8E7BF8" />
          <path
            d="M5.5 10.5 L8.6 13.6 L14.4 7.8"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    );
  }

  if (status === "in-progress") {
  return (
    <div className="status-indicator in-progress" aria-label="In progress">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
      >
        <path
          d="M10 1.25C8.26942 1.25 6.57769 1.76318 5.13876 2.72464C3.69983 3.6861 2.57832 5.05267 1.91606 6.65152C1.25379 8.25037 1.08051 10.0097 1.41813 11.707C1.75575 13.4044 2.58911 14.9635 3.81282 16.1872C5.03653 17.4109 6.59563 18.2443 8.29296 18.5819C9.9903 18.9195 11.7496 18.7462 13.3485 18.0839C14.9473 17.4217 16.3139 16.3002 17.2754 14.8612C18.2368 13.4223 18.75 11.7306 18.75 10C18.7474 7.68017 17.8246 5.45611 16.1843 3.81574C14.5439 2.17537 12.3198 1.25265 10 1.25ZM10 17.5C8.01088 17.5 6.10323 16.7098 4.6967 15.3033C3.29018 13.8968 2.5 11.9891 2.5 10C2.5 8.01088 3.29018 6.10322 4.6967 4.6967C6.10323 3.29018 8.01088 2.5 10 2.5V10L15.3006 15.3006C14.6055 15.9983 13.7794 16.5518 12.8698 16.9293C11.9601 17.3067 10.9849 17.5007 10 17.5Z"
          fill="#9D8BF9"
        />
      </svg>
    </div>
  );
}

  // unexplored
  return (
    <div className="status-indicator unexplored" aria-label="Unexplored">
      {/* Empty circle outline */}
      <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-hidden="true"
      >
        <title>Unexplored</title>
        <circle cx="10" cy="10" r="8.8" fill="transparent" stroke="#9d8bf9" strokeWidth="1.8" />
      </svg>
    </div>
  );
};

const Microsteps: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const career = (location.state as any)?.career;
  const fromIndex = (location.state as any)?.fromIndex ?? 0;

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<
    "all" | "unexplored" | "in-progress" | "completed"
  >("all");

  const [microsteps, setMicrosteps] = useState<MicrostepItem[]>([
    {
      id: 1,
      title: "Connect with a professional in the field",
      description: "Talk to an experienced PM for real-world insights and answers",
      status: "in-progress",
    },
    {
      id: 2,
      title: "Job Reality Check",
      description:
        "Write down what a typical week looks like in this role (tasks, hours, work environment) and compare that with your ideal.",
      status: "unexplored",
    },
    {
      id: 3,
      title: "Listen to a Podcast",
      description: "Search your favorite podcast platform for podcasts about the role.",
      status: "completed",
    },
  ]);

  const completedCount = microsteps.filter((s) => s.status === "completed").length;
  const totalCount = microsteps.length;
  const progressPercentage = Math.round((completedCount / totalCount) * 100);

  const filteredMicrosteps =
    activeFilter === "all" ? microsteps : microsteps.filter((s) => s.status === activeFilter);

// replace your current handleTakeStep with this
const handleTakeStep = (stepId: number) => {
  // find the step using current state
  const step = microsteps.find((m) => m.id === stepId);
  if (!step) return;

  // optimistically update status to in-progress
  setMicrosteps((prev) =>
    prev.map((m) => (m.id === stepId ? { ...m, status: "in-progress" } : m))
  );

  // pass the step to the detail page (optionally update status in the step you pass)
  const stepToPass = { ...step, status: "in-progress" };
  navigate(`/microstep/${stepId}`, {
    state: { step: stepToPass, career },
  });
};


  return (
    <div className="mobile-frame microsteps-page">
      {/* Header */}
      <div className="microsteps-header">
        <button
          className="microsteps-header-btn left"
          onClick={() => navigate(-1)}
          aria-label="Back"
        >
          <FiArrowLeft />
        </button>

        <div className="microsteps-header-center">
          <h3>Microsteps</h3>
          <p className="microsteps-subtitle">{career?.title || "Product Management"}</p>
        </div>

        <button
          className="microsteps-header-btn right"
          onClick={() => setIsSidebarOpen(true)}
          aria-label="Menu"
        >
          <FiMenu />
        </button>
      </div>

      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <div className="microsteps-body">
        <ChatBubbleStatic
          text={`Here are some easy, low-pressure ways to start exploring what it's really like to be a ${
            career?.title || "Product Manager"
          }.`}
          width="78%"
          showAvatar={true}
        />

        {/* Progress */}
        <div className="progress-section">
          <div className="progress-bar-wrap" aria-hidden>
            <div className="progress-bar-bg" />
            <div className="progress-bar-fill" style={{ width: `${progressPercentage}%` }} />
          </div>
          <p className="progress-text">
            {completedCount} of {totalCount} steps complete.
          </p>
        </div>

        {/* Filters */}
        <div className="filter-row" role="tablist" aria-label="Filters">
          <button
            className={`filter-pill ${activeFilter === "unexplored" ? "active" : ""}`}
            onClick={() => setActiveFilter("unexplored")}
            aria-pressed={activeFilter === "unexplored"}
          >
            Unexplored <img src={UnexploredFilterSVG} alt="" className="filter-icon-img"/>
          </button>

          <button
            className={`filter-pill ${activeFilter === "in-progress" ? "active" : ""}`}
            onClick={() => setActiveFilter("in-progress")}
            aria-pressed={activeFilter === "in-progress"}
          >
            In progress <img src={InProgressFilterSVG} alt="" className="filter-icon-img"/>
          </button>

          <button
            className={`filter-pill ${activeFilter === "completed" ? "active" : ""}`}
            onClick={() => setActiveFilter("completed")}
            aria-pressed={activeFilter === "completed"}
          >
            Completed <img src={CompletedFilterSVG} alt="" className="filter-icon-img"/>
          </button>

        </div>

        {/* Steps List */}
        <div className="microsteps-list">
          {filteredMicrosteps.map((step) => (
            <div key={step.id} className={`microstep-card ${step.status}`}>
              <StatusIndicator status={step.status} />

              <div className="microstep-main">
                <div className="microstep-topline">
                  <h4 className="microstep-title">{step.title}</h4>
                </div>

                <p className="microstep-description">{step.description}</p>

                <div className="microstep-actions">
                  <button className="take-step-btn" onClick={() => handleTakeStep(step.id)}>
                    Take this Step
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredMicrosteps.length === 0 && (
          <p className="no-steps-message">No steps in this category yet.</p>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default Microsteps;
