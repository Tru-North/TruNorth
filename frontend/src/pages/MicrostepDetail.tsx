import React, { useState } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { FiMenu } from "react-icons/fi";
import { Clock } from "lucide-react";
import BottomNav from "../components/BottomNav";
import Sidebar from "../components/Sidebar";
import "../styles/MicrostepDetail.css";

interface ChecklistItem {
  id: number;
  text: string;
  completed: boolean;
}

const MicrostepDetail: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();

  const step = (location.state as any)?.step ?? {
    id: id ?? "1",
    title: "Connect with a professional in the field",
    description:
      "Talk directly with an experienced product manager to gain real-world insights, ask questions, and see how theory meets practice.",
  };
  const career = (location.state as any)?.career ?? { title: "Product Management" };

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([
    {
      id: 1,
      text: "Set a meeting with a product management professional",
      completed: false,
    },
    {
      id: 2,
      text: "Prepare 3–5 questions to ask during the conversation",
      completed: false,
    },
  ]);

  const [reflectionText, setReflectionText] = useState("");
  const [summaryGenerated, setSummaryGenerated] = useState(false);

  const toggleChecklistItem = (itemId: number) => {
    setChecklist((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, completed: !item.completed } : item))
    );
  };

  const handleGenerateSummary = () => {
    setSummaryGenerated(true);
  };

  const handleMarkDone = () => {
    navigate(-1);
  };

  const allCompleted = checklist.length > 0 && checklist.every((c) => c.completed);

  return (
    <div className="mobile-frame microstep-detail-page">
      {/* Header */}
      <div className="microstep-detail-header">
        <button
          className="microstep-detail-header-btn left"
          onClick={() => navigate(-1)}
          aria-label="Back"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="20" viewBox="0 0 10 20" fill="none">
            <path fillRule="evenodd" clipRule="evenodd" d="M2.7859 10.0005L8.6784 15.893L7.50007 17.0714L1.0184 10.5897C0.862177 10.4334 0.774414 10.2215 0.774414 10.0005C0.774414 9.77955 0.862177 9.56763 1.0184 9.41135L7.50007 2.92969L8.6784 4.10802L2.7859 10.0005Z" fill="black"/>
          </svg>
        </button>

        <div className="microstep-detail-header-center">
          <h3 className="page-title">{career?.title || "Product Management"}</h3>
          <p className="microstep-detail-subtitle">Connect with professional in the field</p>
        </div>

        <button
          className="microstep-detail-header-btn right"
          onClick={() => setIsSidebarOpen(true)}
          aria-label="Menu"
        >
          <FiMenu />
        </button>
      </div>

      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <div className="microstep-detail-body">
        {/* WHAT TO DO */}
        <section className="detail-section">
          <h2 className="section-title">What to do</h2>

          <div className="info-card">
            <div className="info-badges">
              <span className="info-badge">
                <Clock size={13} color="#8e7bf8" />
                Estimated time: 1 day
              </span>
              <span className="info-badge">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M1.375 8.8905H2.3385V10.625H1.375V8.8905ZM3.44675 6.9635H4.41025V10.6248H3.44675V6.9635ZM5.51825 5.0365H6.48175V10.6248H5.51825V5.0365ZM7.59 3.1095H8.5535V10.6248H7.58975L7.59 3.1095ZM9.6615 1.375H10.625V10.625H9.6615V1.375Z" stroke="black" strokeWidth="0.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Difficulty: Beginner
              </span>
            </div>

            <p className="info-description">{step?.description}</p>

            <div className="checklist">
              {checklist.map((item) => (
                <label key={item.id} className="checklist-item">
                  <input
                    type="checkbox"
                    checked={item.completed}
                    onChange={() => toggleChecklistItem(item.id)}
                    className="checklist-checkbox"
                  />
                  <span className="checklist-text">{item.text}</span>
                </label>
              ))}
            </div>
          </div>
        </section>

        {/* REFLECTION */}
        <section className="detail-section">
          <h2 className="section-title">Reflection</h2>

          {/* Logo and Purple pill on same line */}
          <div className="reflection-header">
            <div className="reflection-avatar">
              <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30" fill="none">
                <path d="M15 30C23.2843 30 30 23.2843 30 15C30 6.71573 23.2843 0 15 0C6.71573 0 0 6.71573 0 15C0 23.2843 6.71573 30 15 30Z" fill="url(#paint0_linear_81_7649)" fillOpacity="0.7"/>
                <path opacity="0.15" d="M14.9948 3.33398C15.6615 10.0007 19.9948 14.334 26.6615 15.0007C19.9948 15.6673 15.6615 20.0007 14.9948 26.6673C14.3281 20.0007 9.99479 15.6673 3.32812 15.0007C9.99479 14.334 14.3281 10.0007 14.9948 3.33398Z" fill="#FDFDFD"/>
                <path d="M15.0039 25C20.5268 25 25.0039 20.5229 25.0039 15C25.0039 9.47715 20.5268 5 15.0039 5C9.48106 5 5.00391 9.47715 5.00391 15C5.00391 20.5229 9.48106 25 15.0039 25Z" fill="url(#paint1_radial_81_7649)"/>
                <path opacity="0.8" d="M15.0026 16.6673C15.9231 16.6673 16.6693 15.9211 16.6693 15.0007C16.6693 14.0802 15.9231 13.334 15.0026 13.334C14.0821 13.334 13.3359 14.0802 13.3359 15.0007C13.3359 15.9211 14.0821 16.6673 15.0026 16.6673Z" fill="#FDFDFD"/>
                <defs>
                  <linearGradient id="paint0_linear_81_7649" x1="33.3465" y1="14.4927" x2="-0.712544" y2="14.2574" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#8F35EC"/>
                    <stop offset="0.0673077" stopColor="#8C56E1"/>
                    <stop offset="0.177885" stopColor="#8784D1"/>
                    <stop offset="0.495192" stopColor="#83ADC3"/>
                    <stop offset="1" stopColor="#7EDAB3"/>
                  </linearGradient>
                  <radialGradient id="paint1_radial_81_7649" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(15.0039 15) scale(10)">
                    <stop offset="0.177885" stopColor="#F4D35E"/>
                    <stop offset="0.528846" stopColor="#FFEEB3" stopOpacity="0.7"/>
                    <stop offset="1" stopColor="#468189" stopOpacity="0"/>
                  </radialGradient>
                </defs>
              </svg>
            </div>

            <div className="reflection-pill">
              <span className="pill-text">What did you learn from this experience?</span>
            </div>
          </div>

          {/* White reflection box with mic circle and placeholder text */}
          <div className="reflection-card">
            <div className="reflection-input-wrapper">
              <button className="mic-circle" aria-label="Record voice">
                <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30" fill="none">
                  <circle cx="15" cy="15" r="15" fill="#9D8BF9"/>
                  <path d="M14.9999 16.666C14.3055 16.666 13.7152 16.423 13.2291 15.9368C12.743 15.4507 12.4999 14.8605 12.4999 14.166V9.16602C12.4999 8.47157 12.743 7.88129 13.2291 7.39518C13.7152 6.90907 14.3055 6.66602 14.9999 6.66602C15.6943 6.66602 16.2846 6.90907 16.7707 7.39518C17.2568 7.88129 17.4999 8.47157 17.4999 9.16602V14.166C17.4999 14.8605 17.2568 15.4507 16.7707 15.9368C16.2846 16.423 15.6943 16.666 14.9999 16.666ZM14.1666 21.666V19.9368C12.8888 19.7563 11.7952 19.2146 10.8857 18.3118C9.97629 17.4091 9.42407 16.3118 9.22907 15.0202C9.20129 14.7841 9.26379 14.5827 9.41657 14.416C9.56934 14.2493 9.76379 14.166 9.9999 14.166C10.236 14.166 10.4341 14.246 10.5941 14.406C10.7541 14.566 10.8616 14.7638 10.9166 14.9993C11.111 15.9716 11.5938 16.7702 12.3649 17.3952C13.136 18.0202 14.0143 18.3327 14.9999 18.3327C15.9999 18.3327 16.8818 18.0168 17.6457 17.3852C18.4096 16.7535 18.8888 15.9582 19.0832 14.9993C19.1388 14.7632 19.2466 14.5655 19.4066 14.406C19.5666 14.2466 19.7643 14.1666 19.9999 14.166C20.2355 14.1655 20.4299 14.2488 20.5832 14.416C20.7366 14.5832 20.7991 14.7846 20.7707 15.0202C20.5763 16.2841 20.0277 17.3743 19.1249 18.291C18.2221 19.2077 17.1249 19.7563 15.8332 19.9368V21.666C15.8332 21.9021 15.7532 22.1002 15.5932 22.2602C15.4332 22.4202 15.2355 22.4999 14.9999 22.4993C14.7643 22.4988 14.5666 22.4188 14.4066 22.2593C14.2466 22.0999 14.1666 21.9021 14.1666 21.666Z" fill="#FDFDFD"/>
                </svg>
              </button>
              <textarea
                className="reflection-textarea-with-mic"
                placeholder="Type or record what you learned from this experience"
                value={reflectionText}
                onChange={(e) => setReflectionText(e.target.value)}
                rows={6}
              />
            </div>
          </div>
        </section>

        {/* STEP SUMMARY */}
        <section className="detail-section">
          <h2 className="section-title">Step Summary</h2>

          <div className="summary-card">
            {!summaryGenerated ? (
              <>
                <p className="summary-placeholder">
                  Get your summarized progress of this microstep here
                </p>

                <button className="generate-summary-btn" onClick={handleGenerateSummary}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M9.4999 2.67275C9.4999 2.80536 9.55258 2.93254 9.64635 3.0263C9.74012 3.12007 9.8673 3.17275 9.9999 3.17275C10.1325 3.17275 10.2597 3.12007 10.3535 3.0263C10.4472 2.93254 10.4999 2.80536 10.4999 2.67275V0.84375C10.4999 0.711142 10.4472 0.583965 10.3535 0.490197C10.2597 0.396428 10.1325 0.34375 9.9999 0.34375C9.8673 0.34375 9.74012 0.396428 9.64635 0.490197C9.55258 0.583965 9.4999 0.711142 9.4999 0.84375V2.67275ZM13.9999 2.70775C14.091 2.61345 14.1414 2.48715 14.1402 2.35605C14.1391 2.22495 14.0865 2.09954 13.9938 2.00684C13.9011 1.91414 13.7757 1.86155 13.6446 1.86041C13.5135 1.85927 13.3872 1.90967 13.2929 2.00075L11.9999 3.29375C11.9521 3.33987 11.9141 3.39505 11.8879 3.45605C11.8616 3.51705 11.8479 3.58266 11.8473 3.64905C11.8467 3.71544 11.8594 3.78128 11.8845 3.84273C11.9096 3.90418 11.9468 3.96 11.9937 4.00695C12.0407 4.05389 12.0965 4.09102 12.1579 4.11616C12.2194 4.1413 12.2852 4.15395 12.3516 4.15338C12.418 4.1528 12.4836 4.13901 12.5446 4.1128C12.6056 4.0866 12.6608 4.04851 12.7069 4.00075L13.9999 2.70775ZM7.29291 4.00075C7.33903 4.04851 7.3942 4.0866 7.4552 4.1128C7.5162 4.13901 7.58181 4.1528 7.6482 4.15338C7.71459 4.15395 7.78043 4.1413 7.84188 4.11616C7.90333 4.09102 7.95916 4.05389 8.0061 4.00695C8.05305 3.96 8.09018 3.90418 8.11532 3.84273C8.14046 3.78128 8.15311 3.71544 8.15253 3.64905C8.15195 3.58266 8.13816 3.51705 8.11196 3.45605C8.08575 3.39505 8.04766 3.33987 7.99991 3.29375L6.7069 2.00075C6.6126 1.90967 6.4863 1.85927 6.3552 1.86041C6.22411 1.86155 6.0987 1.91414 6.006 2.00684C5.91329 2.09954 5.86071 2.22495 5.85957 2.35605C5.85843 2.48715 5.90883 2.61345 5.99991 2.70775L7.29291 4.00075ZM6.67191 6.50075C6.80451 6.50075 6.93169 6.44807 7.02546 6.3543C7.11923 6.26054 7.17191 6.13336 7.17191 6.00075C7.17191 5.86814 7.11923 5.74096 7.02546 5.6472C6.93169 5.55343 6.80451 5.50075 6.67191 5.50075H4.84291C4.7103 5.50075 4.58312 5.55343 4.48935 5.6472C4.39558 5.74096 4.3429 5.86814 4.3429 6.00075C4.3429 6.13336 4.39558 6.26054 4.48935 6.3543C4.58312 6.44807 4.7103 6.50075 4.84291 6.50075H6.67191ZM15.1569 6.50075C15.2895 6.50075 15.4167 6.44807 15.5105 6.3543C15.6042 6.26054 15.6569 6.13336 15.6569 6.00075C15.6569 5.86814 15.6042 5.74096 15.5105 5.6472C15.4167 5.55343 15.2895 5.50075 15.1569 5.50075H13.3279C13.1953 5.50075 13.0681 5.55343 12.9744 5.6472C12.8806 5.74096 12.8279 5.86814 12.8279 6.00075C12.8279 6.13336 12.8806 6.26054 12.9744 6.3543C13.0681 6.44807 13.1953 6.50075 13.3279 6.50075H15.1569ZM13.2929 10.0007C13.339 10.0485 13.3942 10.0866 13.4552 10.1128C13.5162 10.139 13.5818 10.1528 13.6482 10.1534C13.7146 10.154 13.7804 10.1413 13.8419 10.1162C13.9033 10.091 13.9592 10.0539 14.0061 10.0069C14.053 9.96 14.0902 9.90417 14.1153 9.84273C14.1405 9.78128 14.1531 9.71544 14.1525 9.64905C14.152 9.58266 14.1382 9.51705 14.112 9.45605C14.0858 9.39505 14.0477 9.33987 13.9999 9.29375L12.7069 8.00075C12.6608 7.95299 12.6056 7.9149 12.5446 7.8887C12.4836 7.86249 12.418 7.8487 12.3516 7.84812C12.2852 7.84755 12.2194 7.8602 12.1579 7.88534C12.0965 7.91048 12.0407 7.94761 11.9937 7.99455C11.9468 8.0415 11.9096 8.09732 11.8845 8.15877C11.8594 8.22022 11.8467 8.28606 11.8473 8.35245C11.8479 8.41884 11.8616 8.48445 11.8879 8.54545C11.9141 8.60645 11.9521 8.66163 11.9999 8.70775L13.2929 10.0007ZM9.4999 11.1577C9.4999 11.2904 9.55258 11.4175 9.64635 11.5113C9.74012 11.6051 9.8673 11.6577 9.9999 11.6577C10.1325 11.6577 10.2597 11.6051 10.3535 11.5113C10.4472 11.4175 10.4999 11.2904 10.4999 11.1577V9.32875C10.4999 9.19614 10.4472 9.06896 10.3535 8.9752C10.2597 8.88143 10.1325 8.82875 9.9999 8.82875C9.8673 8.82875 9.74012 8.88143 9.64635 8.9752C9.55258 9.06896 9.4999 9.19614 9.4999 9.32875V11.1577ZM11.3539 6.06075C11.4473 5.96703 11.4998 5.84009 11.4998 5.70775C11.4998 5.57541 11.4473 5.44847 11.3539 5.35475L10.6459 4.64675C10.5521 4.55301 10.425 4.50036 10.2924 4.50036C10.1598 4.50036 10.0327 4.55301 9.9389 4.64675L8.6459 5.94075C8.55217 6.03451 8.49951 6.16167 8.49951 6.29425C8.49951 6.42683 8.55217 6.55399 8.6459 6.64775L9.3539 7.35575C9.44767 7.44949 9.57482 7.50214 9.70741 7.50214C9.83999 7.50214 9.96714 7.44949 10.0609 7.35575L11.3539 6.06275V6.06075ZM8.35391 9.06075C8.44734 8.96703 8.4998 8.84009 8.4998 8.70775C8.4998 8.57541 8.44734 8.44847 8.35391 8.35475L7.64591 7.64675C7.55214 7.55301 7.42499 7.50036 7.29241 7.50036C7.15982 7.50036 7.03267 7.55301 6.93891 7.64675L0.645905 13.9407C0.552169 14.0345 0.499512 14.1617 0.499512 14.2942C0.499512 14.4268 0.552169 14.554 0.645905 14.6477L1.3539 15.3557C1.44767 15.4495 1.57482 15.5021 1.7074 15.5021C1.83999 15.5021 1.96714 15.4495 2.06091 15.3557L8.35391 9.06075Z" fill="#FDFDFD"/>
                  </svg>
                  Generate summary
                </button>
              </>
            ) : (
              <div className="summary-content">
                <p className="summary-text">
                  You've connected with a professional and gathered practical insights about the
                  role. You prepared questions and reflected on them — great progress!
                </p>
              </div>
            )}
          </div>
        </section>

        {/* MARK DONE */}
        <button className={`mark-done-btn ${allCompleted ? "active" : ""}`} onClick={handleMarkDone}>
          Mark Microstep Done
        </button>
      </div>

      <div className="bottom-nav-wrapper">
        <BottomNav />
      </div>
    </div>
  );
};

export default MicrostepDetail;