import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

import "../../styles/admin_global.css";
import "../../styles/AdminLogin.css";

import AdminLoginIllustration from "../../assets/admin/admin_login_leftside.svg";
import TruNorthLogo from "../../assets/trunorth/trunorth_icon.svg";

const AdminLogin: React.FC = () => {
  const navigate = useNavigate();

  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    // TODO: replace this with real admin auth API call.
    // For now, just navigate to the dashboard on submit.
    navigate("/admin/dashboard");
  };

  return (
    <div className="admin-page admin-login-page">
      <div className="admin-login-container">
        {/* LEFT SIDE */}
        <div className="admin-login-left">
          <img
            src={AdminLoginIllustration}
            alt="Admin working at laptop illustration"
            className="admin-login-illustration"
          />
        </div>

        {/* RIGHT SIDE */}
        <div className="admin-login-right">
          {/* Logo + Brand */}
          <div className="admin-login-logo-wrapper">
            <img
              src={TruNorthLogo}
              alt="TruNorth AI logo"
              className="admin-login-logo"
            />
            <div className="admin-login-logo-text">TruNorth AI</div>
          </div>

          {/* Form */}
          <div className="admin-login-form-wrapper">
            <h1 className="admin-login-title">Welcome!</h1>
            <p className="admin-login-subtitle">Admin Login</p>

            <form className="admin-login-form" onSubmit={handleSubmit}>
              <div className="admin-login-field">
                <input
                  type="text"
                  className="admin-login-input"
                  placeholder="Enter your email or username"
                  value={emailOrUsername}
                  onChange={(e) => setEmailOrUsername(e.target.value)}
                />
              </div>

              <div className="admin-login-field">
                <input
                  type="password"
                  className="admin-login-input"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <div className="admin-login-remember-row">
                <label className="admin-login-remember">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <span>Remember me</span>
                </label>

                <button
                  type="button"
                  className="admin-login-forgot-button"
                  onClick={() => {
                    // TODO: hook up to real forgot-password flow later
                    console.log("Forgot password clicked");
                  }}
                >
                  Forget Your Password?
                </button>
              </div>

              <button type="submit" className="admin-login-submit">
                Log In
              </button>
            </form>
          </div>

          <div className="admin-login-footer">
            © 2025 TruNorth AI Platform. All Rights Reserved.
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
