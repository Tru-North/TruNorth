import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/global.css";
import "../styles/auth.css";
import googleIcon from "../assets/login_and_registration/google_logo.svg";
import { registerUser, loginUser } from "../utils/api";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../utils/firebaseClient";

const Auth: React.FC = () => {
  const [tab, setTab] = useState<"login" | "signup">("signup");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    localStorage.removeItem("token");

    try {
      if (tab === "signup") {
        const result = await registerUser({
          FirstName: firstName,
          LastName: lastName,
          Email: email,
          Password: password,
        });

        if (result?.id) {
          // store token if backend returns it
          if (result.access_token) {
            localStorage.setItem("token", result.access_token);
          } else {
            // fallback so ProtectedRoute doesn't kick user out
            localStorage.setItem("token", "signup-temp");
          }

          localStorage.setItem("user_id", result.id.toString());
          setSuccess("Account created successfully! Redirecting...");
          setTimeout(() => navigate("/journey"), 1200);
        } else {
          setError(result?.error || "Signup failed. Please try again.");
        }
      } else {
        const result = await loginUser(email, password);
        if (result?.access_token) {
          localStorage.setItem("token", result.access_token);

          // ✅ Safely store user ID if returned from backend
          if (result?.user?.id) {
            localStorage.setItem("user_id", result.user.id.toString());
            console.log("✅ Saved user_id:", result.user.id);
          } else {
            console.warn("⚠️ Backend did not return user.id. Response:", result);
          }

          setSuccess("Login successful! Redirecting...");
          setTimeout(() => navigate("/journey"), 1200);
        } else {
          setError(result?.detail || "Invalid email or password.");
        }
      }
    } catch (err: any) {
      const msg = err.message?.includes("EMAIL_EXISTS")
        ? "This email is already registered."
        : err.message?.includes("INVALID_LOGIN_CREDENTIALS")
        ? "Incorrect email or password."
        : "Something went wrong. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError("");
    setSuccess("");
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

    try {
      // 🔹 Trigger Google sign-in popup
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const idToken = await user.getIdToken(true); // force refresh

      // 🔹 Attempt Google registration/login
      const response = await fetch(`${API_BASE_URL}/register-google`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          email: user.email,
          firstname: user.displayName?.split(" ")[0] || "",
          lastname: user.displayName?.split(" ")[1] || "",
          firebase_uid: user.uid,
        }),
      });

      const data = await response.json();
      console.log("Backend response:", data);

      if (!response.ok) {
        setError(data.detail || "Authentication failed. Please try again.");
        return;
      }

      // ✅ Save valid Firebase token
      localStorage.setItem("token", idToken);

      // ✅ Save numeric user_id returned by backend
      if (data.user?.id) {
        localStorage.setItem("user_id", data.user.id.toString());
        console.log("✅ Saved user_id:", data.user.id);
      } else {
        console.warn("⚠️ Google response missing user.id. Full response:", data);
      }

      // 🔹 Handle both cases gracefully
      if (data.status === "existing_user") {
        setSuccess("Welcome back! Redirecting...");
      } else if (data.status === "new_user" || data.id) {
        setSuccess("Account created successfully! Redirecting...");
      } else {
        setError("Unexpected response. Please try again.");
        return;
      }

      // 🔹 Redirect after short delay
      setTimeout(() => navigate("/journey"), 1200);
    } catch (error: any) {
      console.error("Google Sign-In Error:", error);
      setError("Google Sign-In failed. Please try again.");
    }
  };


  return (
    <div className="auth-wrapper">
      <div className="mobile-frame">
        <div className="auth-header">
          <h1 className="auth-heading">
            {tab === "login" ? "Welcome Back!" : "Getting Started"}
          </h1>
          <div className="auth-tabs">
            <button
              onClick={() => setTab("login")}
              className={`tab ${tab === "login" ? "active" : ""}`}
              disabled={loading}
            >
              Login
            </button>
            <button
              onClick={() => setTab("signup")}
              className={`tab ${tab === "signup" ? "active" : ""}`}
              disabled={loading}
            >
              Signup
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {tab === "signup" && (
            <>
              <div className="input-group">
                <label htmlFor="firstName">First Name</label>
                <input
                  id="firstName"
                  type="text"
                  placeholder="First Name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </div>
              <div className="input-group">
                <label htmlFor="lastName">Last Name</label>
                <input
                  id="lastName"
                  type="text"
                  placeholder="Last Name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
              </div>
            </>
          )}

          <div className="input-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              placeholder="hello@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {tab === "login" && (
            <div className="login-options">
              <label className="remember-me">
                <input type="checkbox" /> Remember Me
              </label>
              <span
                className="forgot-password"
                onClick={() => navigate("/forgot-password")}
                style={{ cursor: "pointer" }}
              >
                Forgot Password?
              </span>
            </div>
          )}

          <button type="submit" className="primary-btn" disabled={loading}>
            {loading
              ? tab === "login"
                ? "Logging in..."
                : "Signing up..."
              : tab === "login"
              ? "Login"
              : "Sign Up"}
          </button>

          {/* Inline error/success message */}
          {error && <p className="error-text">{error}</p>}
          {success && <p className="success-text">{success}</p>}

          <div className="divider">
            <span>Or</span>
          </div>

          <button
            type="button"
            className="google-btn"
            onClick={handleGoogleSignIn}
            disabled={loading}
          >
            <img src={googleIcon} alt="Google" className="google-icon" />
            Continue with Google
          </button>

          {tab === "signup" && error.includes("Account already exists") && (
            <p className="error-text">
              Account already exists. Please login instead.
            </p>
          )}

          <p className="auth-footer">
            {tab === "login" ? (
              <>
                Don’t have an account?{" "}
                <span onClick={() => setTab("signup")}>Sign Up</span>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <span onClick={() => setTab("login")}>Login</span>
              </>
            )}
          </p>
        </form>
      </div>
    </div>
  );
};

export default Auth;
