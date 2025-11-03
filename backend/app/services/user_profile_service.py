"""
User Profile Service
Retrieves and formats user questionnaire data for AI Coach
"""

from typing import Optional, Dict, List
from sqlalchemy.orm import Session

def get_user_profile(db: Session, user_id: int) -> Optional[Dict]:
    """
    Get user's questionnaire profile data from user_final_data table
    Returns the final_json JSONB field containing all questionnaire responses
    """
    try:
        from app.models.final_data import UserFinalData
        
        final_data = db.query(UserFinalData).filter(
            UserFinalData.user_id == user_id
        ).first()
        
        if final_data and final_data.final_json:
            return final_data.final_json
        
        return None
    except Exception as e:
        print(f"Error fetching user profile: {e}")
        return None


def format_profile_for_ai(profile_data: Dict) -> str:
    """
    Format user profile data into a human-readable string for AI context
    Tailored for TruNorth questionnaire structure based on:
    - Career change interests
    - Strengths
    - Non-negotiables
    - Experience/skills paragraph
    - Work constraints
    """
    if not profile_data:
        return ""
    
    sections = []
    sections.append("=" * 60)
    sections.append("USER CAREER PROFILE (From Initial Questionnaire)")
    sections.append("=" * 60)
    
    # Parse questionnaire_responses from the final_json
    questionnaire_responses = profile_data.get("questionnaire_responses", [])
    
    # Group responses by category
    responses_by_category = {}
    for response in questionnaire_responses:
        category = response.get("category", "unknown")
        question_id = response.get("question_id", "")
        answer = response.get("answer", "")
        
        if category not in responses_by_category:
            responses_by_category[category] = []
        
        responses_by_category[category].append({
            "question_id": question_id,
            "answer": answer
        })
    
    # 1. Career Change Interests (from - question 1/5)
    if "career_interests" in responses_by_category or "interests" in responses_by_category:
        sections.append("\n### 🎯 Career Change Motivation")
        interests = responses_by_category.get("career_interests", responses_by_category.get("interests", []))
        
        for item in interests:
            answer = item["answer"]
            if isinstance(answer, list):
                sections.append(f"  - {', '.join(str(a) for a in answer)}")
            else:
                sections.append(f"  - {answer}")
    
    # 2. Top Strengths (from - question 2/5)
    if "strengths" in responses_by_category:
        sections.append("\n### 💪 Top Strengths")
        strengths = responses_by_category["strengths"]
        
        for item in strengths:
            answer = item["answer"]
            if isinstance(answer, list):
                sections.append(f"  - {', '.join(str(a) for a in answer)}")
            else:
                sections.append(f"  - {answer}")
    
    # 3. Non-Negotiables (from - question 3/5)
    if "non_negotiables" in responses_by_category or "requirements" in responses_by_category:
        sections.append("\n### ⭐ Non-Negotiables for Next Role")
        non_neg = responses_by_category.get("non_negotiables", responses_by_category.get("requirements", []))
        
        for item in non_neg:
            answer = item["answer"]
            if isinstance(answer, list):
                sections.append(f"  - {', '.join(str(a) for a in answer)}")
            else:
                sections.append(f"  - {answer}")
    
    # 4. Experience and Skills Paragraph (from - question 4/5)
    if "experience" in responses_by_category or "skills" in responses_by_category:
        sections.append("\n### 📝 Experience & Skills Summary")
        exp = responses_by_category.get("experience", responses_by_category.get("skills", []))
        
        for item in exp:
            answer = item["answer"]
            if answer:
                sections.append(f"  {answer}")
    
    # 5. Work Constraints (from - question 5/5)
    if "constraints" in responses_by_category or "preferences" in responses_by_category:
        sections.append("\n### 🚧 Work Constraints")
        constraints = responses_by_category.get("constraints", responses_by_category.get("preferences", []))
        
        for item in constraints:
            answer = item["answer"]
            if isinstance(answer, list):
                sections.append(f"  - {', '.join(str(a) for a in answer)}")
            else:
                sections.append(f"  - {answer}")
    
    # Handle any other categories not explicitly mapped
    known_categories = {"career_interests", "interests", "strengths", "non_negotiables", 
                       "requirements", "experience", "skills", "constraints", "preferences"}
    
    for category, items in responses_by_category.items():
        if category not in known_categories:
            sections.append(f"\n### 📌 {category.replace('_', ' ').title()}")
            for item in items:
                answer = item["answer"]
                if isinstance(answer, list):
                    sections.append(f"  - {', '.join(str(a) for a in answer)}")
                elif answer:
                    sections.append(f"  - {answer}")
    
    # Add completion timestamp if available
    if "completed_at" in profile_data:
        sections.append(f"\n\n📅 Profile completed: {profile_data['completed_at']}")
    
    sections.append("\n" + "=" * 60)
    
    return "\n".join(sections)


def format_profile_summary(profile_data: Dict) -> str:
    """
    Create a short 2-3 sentence summary of the user's profile
    Perfect for chat history context or quick reference
    """
    if not profile_data:
        return "No profile available."
    
    questionnaire_responses = profile_data.get("questionnaire_responses", [])
    
    # Extract key information
    interests = []
    strengths = []
    constraints = []
    
    for response in questionnaire_responses:
        category = response.get("category", "")
        answer = response.get("answer", "")
        
        if "interest" in category.lower():
            if isinstance(answer, list):
                interests.extend(answer)
            else:
                interests.append(answer)
        
        elif "strength" in category.lower():
            if isinstance(answer, list):
                strengths.extend(answer)
            else:
                strengths.append(answer)
        
        elif "constraint" in category.lower() or "preference" in category.lower():
            if isinstance(answer, list):
                constraints.extend(answer)
            else:
                constraints.append(answer)
    
    summary_parts = []
    
    if interests:
        summary_parts.append(f"Interested in: {', '.join(str(i) for i in interests[:3])}")
    
    if strengths:
        summary_parts.append(f"Key strengths: {', '.join(str(s) for s in strengths[:3])}")
    
    if constraints:
        summary_parts.append(f"Work preferences: {', '.join(str(c) for c in constraints[:2])}")
    
    return ". ".join(summary_parts) + "." if summary_parts else "Profile incomplete."
