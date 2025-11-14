// src/services/recommendationService.ts

import axios from "axios";
import {
  GenerateRecommendationsRequest,
  GenerateRecommendationsResponse,
  FavoriteRequest,
  DismissRequest,
  CareerDetailCard,
} from "../types/recommendations";

// ✅ Base API URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// ✅ Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// ✅ Helper: attach Firebase UID header (if available)
function getAuthHeaders() {
  const firebaseUid = localStorage.getItem("firebase_uid");
  return firebaseUid ? { "x-firebase-uid": firebaseUid } : {};
}

// ✅ Helper: include user_id when no Firebase authentication
function getUserIdPayload<T extends object>(payload: T = {} as T) {
  const user_id = localStorage.getItem("user_id");
  return { user_id: user_id ? Number(user_id) : undefined, ...payload };
}

// ===============================
// 🔹 Recommendation API Endpoints
// ===============================

// 1️⃣ Generate new batch of recommendations
export async function generateRecommendations(
  payload: GenerateRecommendationsRequest
): Promise<GenerateRecommendationsResponse> {
  console.log("📨 POST /recommendations/generate", getUserIdPayload(payload));
  const response = await api.post(
    "/recommendations/generate",
    getUserIdPayload(payload),
    { headers: getAuthHeaders() }
  );
  return response.data;
}

// 2️⃣ Fetch latest (cached) recommendations
export async function getLatestRecommendations(): Promise<GenerateRecommendationsResponse> {
  const user_id = localStorage.getItem("user_id");
  console.log("📨 GET /recommendations/latest", { user_id });
  const response = await api.get("/recommendations/latest", {
    headers: getAuthHeaders(),
    params: { user_id },
  });
  return response.data;
}

// 3️⃣ Save (favorite) a recommendation
export async function saveRecommendation(
  payload: FavoriteRequest
): Promise<{ status: string }> {
  console.log("📨 POST /recommendations/save", getUserIdPayload(payload));
  const response = await api.post(
    "/recommendations/save",
    getUserIdPayload(payload),
    { headers: getAuthHeaders() }
  );
  return response.data;
}

// 4️⃣ Dismiss (remove) a recommendation
export async function dismissRecommendation(
  payload: DismissRequest
): Promise<{ status: string }> {
  console.log("📨 POST /recommendations/dismiss", getUserIdPayload(payload));
  const response = await api.post(
    "/recommendations/dismiss",
    getUserIdPayload(payload),
    { headers: getAuthHeaders() }
  );
  return response.data;
}

// 5️⃣ Fetch saved (favorited) recommendations
export async function getFavoriteRecommendations(): Promise<GenerateRecommendationsResponse> {
  const user_id = localStorage.getItem("user_id");
  console.log("📨 GET /recommendations/favorites", { user_id });
  const response = await api.get("/recommendations/favorites", {
    headers: getAuthHeaders(),
    params: { user_id },
  });
  return response.data;
}

// 6️⃣ Fetch dismissed recommendations
export async function getDismissedRecommendations(): Promise<GenerateRecommendationsResponse> {
  const user_id = localStorage.getItem("user_id");
  console.log("📨 GET /recommendations/dismiss", { user_id });
  const response = await api.get("/recommendations/dismiss", {
    headers: getAuthHeaders(),
    params: { user_id },
  });
  return response.data;
}

// 7️⃣ Fetch detailed info for one career (Explore button)
export async function getCareerDetail(
  careerId: number
): Promise<CareerDetailCard> {
  const user_id = localStorage.getItem("user_id");
  console.log("📨 GET /recommendations/explore", { careerId, user_id });
  const response = await api.get(`/recommendations/explore/${careerId}`, {
    headers: getAuthHeaders(),
    params: { user_id },
  });
  return response.data;
}
