// frontend/src/services/microstepsService.ts
// -------------------------------------------
// ALL Microstep API calls for Phase 5D
// Uses ONLY the 7 approved routes + GET /microsteps/
// Uses your existing axios instance from api.ts
// -------------------------------------------

import { api } from "../utils/api";

// ---------- TYPES ----------
export interface Microstep {
  id: number;
  title: string;
  description: string;
  step_index?: number;
  status: "incomplete" | "in_progress" | "completed";
  mini_steps?: Array<{
    index: number;
    completed: boolean;
  }>;
}

export interface ReflectionMessage {
  id: number;
  role: "assistant" | "user";
  content: string;
  timestamp?: string;
}

// ======================================================
// 0️⃣  NEW — GET all microsteps across all careers
// GET /microsteps/
// ======================================================
async function getAllMicrosteps() {
  const res = await api.get(`/microsteps`);
  return res.data.microsteps ?? [];  // RETURN ARRAY ALWAYS
}

// ======================================================
// 1️⃣  Generate Microsteps
// POST /microsteps/generate/{career_id}
// ======================================================
async function generateMicrosteps(careerId: number) {
  const res = await api.post(`/microsteps/generate/${careerId}`);
  return res.data; // object with: microstep_id, career_title, data.steps...
}

// ======================================================
// 2️⃣  Get Microstep Detail
// GET /microsteps/{microstep_id}
// ======================================================
async function getMicrostepDetail(microstepId: number) {
  const res = await api.get(`/microsteps/${microstepId}`);
  return res.data;
}

// ======================================================
// 3️⃣  Update Progress
// PATCH /microsteps/{microstep_id}/progress
// ======================================================
async function updateProgress(
  microstepId: number,
  params: {
    step_index: number;
    ministep_index: number;
    status: "incomplete" | "in_progress" | "completed";
  }
) {
  const res = await api.patch(
    `/microsteps/${microstepId}/progress`,
    null, // ❗ NO BODY — FastAPI does NOT accept body for this route
    { params } // ❗ ALL VALUES GO IN QUERY
  );

  return res.data;
}

// ======================================================
// 4️⃣  Send Reflection Chat
// POST /microsteps/{microstep_id}/reflection-chat/{step_index}
// ======================================================
async function sendReflectionMessage(
  microstepId: number,
  stepIndex: number,
  message: string
) {
  const res = await api.post(
    `/microsteps/${microstepId}/reflection-chat/${stepIndex}`,
    { message }
  );
  return res.data; // includes AI reply
}

// ======================================================
// 5️⃣  Get Reflection Chat History
// GET /microsteps/{microstep_id}/reflection-chat/{step_index}
// ======================================================
async function getReflectionChat(microstepId: number, stepIndex: number) {
  const res = await api.get(
    `/microsteps/${microstepId}/reflection-chat/${stepIndex}`
  );
  return res.data.chat || [];
}

// ======================================================
// 6️⃣  Generate Summary
// POST /microsteps/{microstep_id}/summary/{step_index}
// ======================================================
async function generateSummary(microstepId: number, stepIndex: number) {
  const res = await api.post(
    `/microsteps/${microstepId}/summary/${stepIndex}`
  );
  return res.data.summary;
}

// ======================================================
// 7️⃣  Get Summary
// GET /microsteps/{microstep_id}/summary/{step_index}
// ======================================================
async function getSummary(microstepId: number, stepIndex: number) {
  const res = await api.get(
    `/microsteps/${microstepId}/summary/${stepIndex}`
  );
  return res.data.summary;
}

// ---------------------------------------
// EXPORT SERVICE
// ---------------------------------------
const microstepsService = {
  getAllMicrosteps,       // NEW
  generateMicrosteps,
  getMicrostepDetail,
  updateProgress,
  sendReflectionMessage,
  getReflectionChat,
  generateSummary,
  getSummary,
};

export default microstepsService;
