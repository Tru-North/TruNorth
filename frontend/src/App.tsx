import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Welcome from "./pages/Welcome";
import Onboarding from "./pages/Onboarding";
import Auth from "./pages/Auth";
import Journey from "./pages/Journey";
import AICoach from "./pages/AICoach";
import AboutYou from "./pages/AboutYou"; // ✅ updated import
import ProtectedRoute from "./components/ProtectedRoute";
import ForgotPassword from "./pages/ForgotPassword";
import VerifyCode from "./pages/VerifyCode";
import SetNewPassword from "./pages/SetNewPassword";
import ChatIntro from "./pages/ChatIntro";
import Questionnaire from "./pages/Questionnaire";
import Account from "./pages/Account";
import Notifications from "./pages/Notifications";
import Privacy from "./pages/Privacy";
import Help from "./pages/Help";
import Terms from "./pages/Terms";
import Language from "./pages/Language";
import ExploreMatches from "./pages/ExploreMatches";
import ActionPlanPreview from "./pages/ActionPlanPreview";
import SavedCareers from "./pages/SavedCareers";

import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUserReview from "./pages/admin/AdminUserReview";

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        {/* 🛠 Admin Routes (Public for Now — Add Admin ProtectedRoute Later) */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/user-review" element={<AdminUserReview />} />

        {/* 🌐 Public Routes */}
        <Route path="/" element={<Welcome />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/auth" element={<Auth />} />

        {/* 🔐 Password Reset Flow (Public) */}
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/verify-code" element={<VerifyCode />} />
        <Route path="/set-new-password" element={<SetNewPassword />} />

        {/* 🔒 Protected Routes */}
        <Route
          path="/journey"
          element={
            <ProtectedRoute>
              <Journey />
            </ProtectedRoute>
          }
        />

        <Route
          path="/chat-intro"
          element={
            <ProtectedRoute>
              <ChatIntro />
            </ProtectedRoute>
          }
        />

        <Route
          path="/questionnaire"
          element={
            <ProtectedRoute>
              <Questionnaire />
            </ProtectedRoute>
          }
        />

        <Route
          path="/coach/*"
          element={
            <ProtectedRoute>
              <AICoach />
            </ProtectedRoute>
          }
        />

        {/* 🧍 About You Page (formerly Settings) */}
        <Route
          path="/aboutyou"
          element={
            <ProtectedRoute>
              <AboutYou />
            </ProtectedRoute>
          }
        />

        {/* 💼 Matches Pages */}
        <Route
          path="/explorematches"
          element={
            <ProtectedRoute>
              <ExploreMatches />
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/savedcareers"
          element={
            <ProtectedRoute>
              <SavedCareers />
            </ProtectedRoute>
          }
        />

        <Route 
          path="/career/:id" 
          element={
            <ProtectedRoute>
              <ActionPlanPreview />
            </ProtectedRoute>
          } 
        />

        {/* ⚙️ Sub-pages of About You */}
        <Route
          path="/account"
          element={
            <ProtectedRoute>
              <Account />
            </ProtectedRoute>
          }
        />
        <Route
          path="/notifications"
          element={
            <ProtectedRoute>
              <Notifications />
            </ProtectedRoute>
          }
        />
        <Route
          path="/privacy"
          element={
            <ProtectedRoute>
              <Privacy />
            </ProtectedRoute>
          }
        />
        <Route
          path="/help"
          element={
            <ProtectedRoute>
              <Help />
            </ProtectedRoute>
          }
        />
        <Route
          path="/terms"
          element={
            <ProtectedRoute>
              <Terms />
            </ProtectedRoute>
          }
        />
        <Route
          path="/language"
          element={
            <ProtectedRoute>
              <Language />
            </ProtectedRoute>
          }
        />
        {/* 🚦 Redirect unknown routes */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
};

export default App;
