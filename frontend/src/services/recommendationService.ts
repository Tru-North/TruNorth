// src/services/recommendationService.ts

import axios from "axios";
import {
  GenerateRecommendationsRequest,
  GenerateRecommendationsResponse,
  FavoriteRequest,
  DismissRequest,
  CareerDetailCard,
} from "../types/recommendations";

// =====================================
// ✅ Base API URL
// =====================================
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// =====================================
// ✅ Create axios instance
// =====================================
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// =====================================
// 🔥 Attach ALL authentication headers
//    (token + user_id + firebase_uid)
// =====================================
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  const firebaseUid = localStorage.getItem("firebase_uid");
  const userId = localStorage.getItem("user_id");

  // JWT token (local DB login)
  if (token) {
    config.headers["Authorization"] = `Bearer ${token}`;
  }

  // Firebase login (AI Coach)
  if (firebaseUid) {
    config.headers["x-firebase-uid"] = firebaseUid;
  }

  // Local user_id (normal login)
  if (userId) {
    config.headers["X-User-ID"] = userId;
  }

  return config;
});

// Helper used only for POST bodies
function getUserIdPayload<T extends object>(payload: T = {} as T) {
  const user_id = localStorage.getItem("user_id");
  return { user_id: user_id ? Number(user_id) : undefined, ...payload };
}

// =====================================
// 🔹 Recommendation API Endpoints
// =====================================

// 1️⃣ Generate new batch of recommendations
export async function generateRecommendations(
  payload: GenerateRecommendationsRequest
): Promise<GenerateRecommendationsResponse> {
  console.log("📨 POST /recommendations/generate → BODY", getUserIdPayload(payload));
  const response = await api.post(
    "/recommendations/generate",
    getUserIdPayload(payload)
  );
  return response.data;
}

// 2️⃣ Fetch latest (cached) recommendations
export async function getLatestRecommendations(): Promise<GenerateRecommendationsResponse> {
  const user_id = localStorage.getItem("user_id");
  console.log("📨 GET /recommendations/latest → PARAMS", { user_id });

  const response = await api.get("/recommendations/latest", {
    params: { user_id },
  });
  return response.data;
}

// 3️⃣ Save (favorite)
export async function saveRecommendation(
  payload: FavoriteRequest
): Promise<{ status: string }> {
  console.log("📨 POST /recommendations/save → BODY", getUserIdPayload(payload));
  const response = await api.post(
    "/recommendations/save",
    getUserIdPayload(payload)
  );
  return response.data;
}

// 4️⃣ Dismiss
export async function dismissRecommendation(
  payload: DismissRequest
): Promise<{ status: string }> {
  console.log("📨 POST /recommendations/dismiss → BODY", getUserIdPayload(payload));
  const response = await api.post(
    "/recommendations/dismiss",
    getUserIdPayload(payload)
  );
  return response.data;
}

// 5️⃣ Fetch favorites
export async function getFavoriteRecommendations(): Promise<GenerateRecommendationsResponse> {
  const user_id = localStorage.getItem("user_id");
  console.log("📨 GET /recommendations/favorites → PARAMS", { user_id });

  const response = await api.get("/recommendations/favorites", {
    params: { user_id },
  });
  return response.data;
}

// 6️⃣ Fetch dismissed
export async function getDismissedRecommendations(): Promise<GenerateRecommendationsResponse> {
  const user_id = localStorage.getItem("user_id");
  console.log("📨 GET /recommendations/dismiss → PARAMS", { user_id });

  const response = await api.get("/recommendations/dismiss", {
    params: { user_id },
  });
  return response.data;
}

// 7️⃣ Detailed career info
export async function getCareerDetail(
  careerId: number
): Promise<CareerDetailCard> {
  const user_id = localStorage.getItem("user_id");
  console.log("📨 GET /recommendations/explore/:id → PARAMS", { careerId, user_id });

  const response = await api.get(`/recommendations/explore/${careerId}`, {
    params: { user_id },
  });

  return response.data;
}
