// frontend/src/pages/AICoach.tsx
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import AICoachChat from "./AICoachChat";
import AICoachVoice from "./AICoachVoice";

const AICoach: React.FC = () => {
  return (
    <Routes>
      {/* Default Chat Mode */}
      <Route path="/" element={<AICoachChat />} />

      {/* Voice Mode */}
      <Route path="/voice" element={<AICoachVoice />} />

      {/* Redirect invalid subroutes */}
      <Route path="*" element={<Navigate to="/coach" />} />
    </Routes>
  );
};

export default AICoach;
