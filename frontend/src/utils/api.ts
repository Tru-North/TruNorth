// src/utils/api.ts
// Centralized API helper for TruNorth frontend ↔ backend communication.
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE_URL;

/** Registers a new user */
export async function registerUser(userData: {
  FirstName: string;
  LastName: string;
  Email: string;
  Password: string;
}) {
  try {
    const response = await fetch(`${API_BASE}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstname: userData.FirstName,
        lastname: userData.LastName,
        email: userData.Email,
        password: userData.Password,
      }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || data.error || "Signup failed");
    return data;
  } catch (error: any) {
    console.error("❌ Register error:", error.message);
    if (error.message.includes("EMAIL_EXISTS")) {
      throw new Error("This email is already registered.");
    }
    throw new Error(error.message);
  }
}

/** Logs in an existing user */
export async function loginUser(email: string, password: string) {
  try {
    const formData = new URLSearchParams();
    formData.append("username", email);
    formData.append("password", password);

    const response = await fetch(`${API_BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString(),
    });

    const data = await response.json();

    // ✅ Handle errors gracefully
    if (!response.ok) {
      console.error("❌ Login failed:", data.detail);
      throw new Error(data.detail || "Invalid email or password.");
    }

    // ✅ Store access token
    if (data.access_token) {
      localStorage.setItem("token", data.access_token);
    }

    // ✅ Store user_id if backend includes it
    if (data.user?.id) {
      localStorage.setItem("user_id", data.user.id.toString());
      console.log("✅ Saved user_id:", data.user.id);
    } else {
      console.warn("⚠️ Backend did not return user.id:", data);
    }

    // Save firebase_uid from backend
    if (data.user?.firebase_uid) {
      localStorage.setItem("firebase_uid", data.user.firebase_uid);
      console.log("🔥 Saved firebase_uid:", data.user.firebase_uid);
    }

    return data;
  } catch (error: any) {
    console.error("❌ Login error:", error.message);
    if (error.message.includes("INVALID_LOGIN_CREDENTIALS")) {
      throw new Error("Incorrect email or password.");
    }
    throw new Error(error.message || "Login failed.");
  }
}

/** Logs out the current user */
export async function logoutUser() {
  try {
    const token = localStorage.getItem("token");
    if (!token) return { message: "No active session" };

    const response = await fetch(`${API_BASE}/logout`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    localStorage.removeItem("token");
    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error("❌ Logout error:", error.message);
    throw error;
  }
}

/** Fetch a specific user by ID */
export async function getUserById(userId: number) {
  try {
    const token = localStorage.getItem("token");
    const response = await fetch(`${API_BASE}/users/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || "Failed to fetch user");
    return data;
  } catch (error: any) {
    console.error("❌ Get user error:", error.message);
    throw error;
  }
}

/** Fetch all users (admin or dashboard usage) */
export async function getAllUsers() {
  try {
    const token = localStorage.getItem("token");
    const response = await fetch(`${API_BASE}/users`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || "Failed to fetch users");
    return data;
  } catch (error: any) {
    console.error("❌ Get all users error:", error.message);
    throw error;
  }
}

/** Update user profile */
export async function updateUser(
  userId: number,
  updateData: Partial<{ firstname: string; lastname: string; password: string }>
) {
  try {
    const token = localStorage.getItem("token");
    const response = await fetch(`${API_BASE}/users/${userId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updateData),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || "Failed to update user");
    return data;
  } catch (error: any) {
    console.error("❌ Update user error:", error.message);
    throw error;
  }
}

/** Delete user */
export async function deleteUser(userId: number) {
  try {
    const token = localStorage.getItem("token");
    const response = await fetch(`${API_BASE}/users/${userId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || "Failed to delete user");
    return data;
  } catch (error: any) {
    console.error("❌ Delete user error:", error.message);
    throw error;
  }
}

/** Password Reset Flow */
export const forgotPassword = async (email: string) => {
  const res = await axios.post(`${API_BASE}/forgot-password`, { email });
  return res.data;
};

export const verifyCode = async (email: string, code: string) => {
  const res = await axios.post(`${API_BASE}/verify-code`, { email, code });
  return res.data;
};

export const resetPassword = async (
  email: string,
  code: string,
  newPassword: string
) => {
  const res = await axios.post(`${API_BASE}/reset-password`, {
    email,
    code,
    new_password: newPassword,
  });
  return res.data;
};

/** Shared axios instance */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000",
  headers: {
    "Content-Type": "application/json",
  },
});

import { getAuth } from "firebase/auth";

// Attach firebase_uid on every API request
api.interceptors.request.use(
  async (config) => {
    const firebaseUid = localStorage.getItem("firebase_uid");

    if (firebaseUid) {
      config.headers["x-firebase-uid"] = firebaseUid;
    }

    console.log("🔐 Sending Firebase UID:", firebaseUid || "NONE");

    return config;
  },
  (error) => Promise.reject(error)
);
