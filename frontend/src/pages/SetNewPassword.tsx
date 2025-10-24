import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import "../styles/setnewpassword.css";
import { resetPassword } from "../utils/api"; // ✅ import backend call

const SetNewPassword: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  // ✅ get email & code from VerifyCode page
  const email = location.state?.email || "";
  const code = location.state?.code || "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (!password || !confirm) {
      setError("Please fill in all fields.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    setLoading(true);
    try {
      // ✅ real backend call
      await resetPassword(email, code, password);
      setSuccess(true);
      setTimeout(() => navigate("/auth"), 1500);
    } catch (err: any) {
      const detail =
        err.response?.data?.detail || err.message || "Failed to reset password.";
      setError(detail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="password-container">
      <div className="password-card">
        <button className="password-back-button" onClick={() => navigate(-1)}>
          <ArrowLeft size={22} /> &nbsp; Back
        </button>

        <h1>Set New Password</h1>
        <p className="password-description">
          Your new password must be different from previously used passwords.
        </p>

        <form onSubmit={handleSubmit}>
          <label className="password-label">New Password</label>
          <input
            type="password"
            className="password-input"
            placeholder="Enter new password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <label className="password-label">Confirm Password</label>
          <input
            type="password"
            className="password-input"
            placeholder="Confirm password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />

          {error && <p className="error-message">{error}</p>}
          {success && (
            <p className="success-message">Password reset successful!</p>
          )}

          <button
            type="submit"
            className={`password-button ${loading ? "loading" : ""}`}
            disabled={loading}
          >
            {loading ? "Resetting..." : "Reset Password"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SetNewPassword;
