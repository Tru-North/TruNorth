// frontend/src/services/adminUserService.ts

import { adminAuthService } from "./admin_auth_service";

// Use the same protected axios instance
const api = adminAuthService.axios;

export const adminUserService = {
  /* ---------------------------------------------------------
     GET /admin/users
     Search + Sort + Pagination supported (backend ready)
  --------------------------------------------------------- */
  async getUsers(params?: {
    search?: string;
    sort_by?: string;
    page?: number;
  }) {
    const res = await api.get("/admin/users", {
      params: { ...params, page_size: 10 },
    });
    return res.data;
  },

  /* ---------------------------------------------------------
     GET /admin/users/:user_id/sessions
  --------------------------------------------------------- */
  async getSessions(userId: number) {
    const res = await api.get(`/admin/users/${userId}/sessions`);
    return res.data;
  },

  /* ---------------------------------------------------------
     GET /admin/users/:user_id/sessions/:session_id/messages
  --------------------------------------------------------- */
  async getSessionMessages(userId: number, sessionId: number) {
    const res = await api.get(
      `/admin/users/${userId}/sessions/${sessionId}/messages`
    );
    return res.data;
  },

  /* ---------------------------------------------------------
     GET /admin/users/:user_id/ai-confidence
  --------------------------------------------------------- */
  async getAIConfidence(userId: number) {
    const res = await api.get(`/admin/users/${userId}/ai-confidence`);
    return res.data;
  },

  /* ---------------------------------------------------------
     GET /admin/users/:user_id/ai-intent-summary
  --------------------------------------------------------- */
  async getAIIntentSummary(userId: number) {
    const res = await api.get(`/admin/users/${userId}/ai-intent-summary`);
    return res.data;
  },

  /* ---------------------------------------------------------
     GET /admin/users/:user_id/profile-summary
  --------------------------------------------------------- */
  async getProfileSummary(userId: number) {
    const res = await api.get(`/admin/users/${userId}/profile-summary`);
    return res.data;
  },

  /* ---------------------------------------------------------
     GET /admin/users/:user_id/review 
     Returns previous saved review OR all empty fields
  --------------------------------------------------------- */
  async loadReview(userId: number) {
    const res = await api.get(`/admin/users/${userId}/review`);
    return res.data;
  },

  /* ---------------------------------------------------------
     POST /admin/users/:user_id/review
     Saves all admin inputs:
       - ai_intent_summary
       - editable_output
       - tag
       - comment
       - message_to_user
       - nudge_ai
  --------------------------------------------------------- */
  async saveReview(
    userId: number,
    payload: {
      ai_intent_summary?: string;
      editable_output?: string;
      tag?: string;
      comment?: string;
      message_to_user?: string;
      nudge_ai?: string;
    }
  ) {
    const res = await api.post(`/admin/users/${userId}/review`, payload);
    return res.data;
  },

  /* ---------------------------------------------------------
    GET a single user by ID (efficient endpoint)  
  --------------------------------------------------------- */
  async getSingleUser(userId: number) {
    const res = await api.get(`/admin/users/${userId}`);
    return res.data;
  },

};

export default adminUserService;
