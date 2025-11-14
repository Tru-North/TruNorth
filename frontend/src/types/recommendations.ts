// src/types/recommendations.ts

// ---------- Salary Range ----------
export interface SalaryRange {
  min: number | null;
  max: number | null;
  median: number | null;
  currency: string;
}

// ---------- Career Card ----------
export interface CareerCard {
  id: number | null;
  soc_code?: string | null;
  title: string;
  fit_score: number;
  salary_range?: SalaryRange | null;
  growth_trend?: string | null;     // e.g. "↑ 5%"
  industry_tag?: string | null;     // e.g. "Technology & Computing"
  why_this_fits: string;            // 2-bullet explanation
  top_skills: string[];
  tips: string[];
  user_action?: string | null;      // "saved", "dismissed", "no_action"
}

// ---------- Recommendation Batch ----------
export interface RecommendationBatch {
  generated_at: string;             // ISO timestamp
  items: CareerCard[];
}

// ---------- API Responses ----------
export interface GenerateRecommendationsResponse {
  items: CareerCard[];
}

export interface RecommendationHistoryResponse {
  batches: RecommendationBatch[];
}

// ---------- Requests ----------
export interface GenerateRecommendationsRequest {
  user_id?: number;
  top_k?: number;
  coach_context?: string;
}

export interface FavoriteRequest {
  user_id?: number;
  career_id: number;
}

export interface DismissRequest {
  user_id?: number;
  career_id: number;
}

// ---------- Career Detail ----------
export interface CareerDetailCard {
  id?: number | null;
  career_id?: number | null;
  soc_code?: string | null;
  title: string;
  fit_score?: number | null;
  salary_range?: SalaryRange | null;
  growth_trend?: string | null;
  industry_tag?: string | null;
  user_action?: string | null;
  bullets: { title?: string; text: string }[];
}
