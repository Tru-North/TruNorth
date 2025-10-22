// src/utils/api.ts
// Centralized API helper for TruNorth frontend ↔ backend communication.

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
      body: JSON.stringify(userData),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || data.error || "Signup failed");
    return data;
  } catch (error: any) {
    console.error("❌ Register error:", error.message);
    throw error;
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
    if (!response.ok) throw new Error(data.detail || "Invalid email or password");

    // Store Firebase ID token (returned as access_token)
    localStorage.setItem("token", data.access_token);
    return data;
  } catch (error: any) {
    console.error("❌ Login error:", error.message);
    throw error;
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
  updateData: Partial<{ FirstName: string; LastName: string; Password: string }>
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
