// 🧠 Handles all Questionnaire-related API calls

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// 🧩 Fetch all questionnaire sections & questions
export const getQuestionnaire = async () => {
  try {
    const res = await fetch(`${API_BASE_URL}/questionnaire/`);
    if (!res.ok) throw new Error("Failed to fetch questionnaire");
    const data = await res.json();
    return data.data; // matches your backend’s structure
  } catch (err) {
    console.error("❌ Error fetching questionnaire:", err);
    return null;
  }
};

// 💾 Save progress per section
export const saveProgress = async (userId: number, sectionId: number, responses: any) => {
  try {
    const res = await fetch(`${API_BASE_URL}/questionnaire/progress`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: userId,
        section_id: sectionId,
        responses,
      }),
    });
    return await res.json();
  } catch (err) {
    console.error("❌ Error saving progress:", err);
    return null;
  }
};

// 📥 Fetch saved responses (for resume)
export const getSavedResponses = async (userId: number) => {
  try {
    const res = await fetch(`${API_BASE_URL}/questionnaire/output/${userId}`);
    if (!res.ok) throw new Error("Failed to fetch saved responses");
    const data = await res.json();
    return data.data;
  } catch (err) {
    console.error("❌ Error loading saved responses:", err);
    return null;
  }
};

// ✅ Final submission
export const submitQuestionnaire = async (userId: number) => {
  try {
    const res = await fetch(`${API_BASE_URL}/questionnaire/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
    });
    return await res.json();
  } catch (err) {
    console.error("❌ Error submitting questionnaire:", err);
    return null;
  }
};
