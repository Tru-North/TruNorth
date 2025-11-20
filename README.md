# 🧭 TruNorth — AI-Powered Career Navigation Platform

TruNorth is a mobile-first AI career guidance platform designed to help individuals uncover their strengths, interact with an intelligent AI Coach, explore personalized career paths, and take meaningful action through guided micro-steps. The platform blends conversational AI, structured user input, actionable insights, and a transparent journey experience into one cohesive system.

---

## ⭐ Key Features

### **🧠 AI Career Coach (Text + Voice)**

* Real-time conversation with both **text and voice modes**
* Whisper-based speech-to-text + TTS playback with captions
* Barge-in behavior, replay controls, and adjustable speaking speed
* Personalized guidance using user questionnaire data and chat history
* Seamless switching between text and voice

### **📝 Multi-Step Questionnaire**

* Five structured sections to capture background, values, skills, and goals
* Required and optional sections
* Autosave across all tabs
* Smooth resume experience and validation-driven flow

### **🔍 Personalized Career Recommendations**

* AI-driven role matching using embeddings and model reasoning
* Each card includes: Fit Score, Growth Trend, Salary Range, Role Summary, and more
* Favorite, dismiss, and explore actions
* Horizontal card navigation

### **🪜 Microstep Action System**

* Career-specific micro-activities broken into simple actionable steps
* Three structured views: Connect, Reflect, Explore
* Time estimates, difficulty levels, reflection prompts
* Autosave with progress tracking
* Motivational AI summaries
* Completion animation when the user finishes a path

### **🚀 Launch & Reflection**

* Final summary of user journey
* Optional rating + feedback
* Next-step actions (finish, explore more, revisit)
* Clear visual updates on the journey map

### **🖥️ Admin Dashboard (Desktop-Only)**

* Secure role-based admin access
* User table with sorting, search, and quick controls
* Full chat transcripts per session
* Editable AI outputs, tagging system, admin comments, nudges, and notes
* All actions logged with timestamps and admin IDs

---

## 🏗 System Architecture Overview

### **Frontend**

* React + Vite
* Shadcn/UI
* Tailwind/CSS
* Zustand (state management)
* WebSocket integration
* Mobile-first design with desktop-only admin views

### **Backend**

* Python
* FastAPI
* REST + WebSocket endpoints
* SQLAlchemy ORM
* AI orchestration layer (GPT reasoning + embeddings)

### **Databases & Storage**

* PostgreSQL (AWS RDS) — structured data
* Pinecone — vector embeddings
* S3 or similar — optional media storage

### **AI Layer**

* GPT-4/5 for reasoning, recommendations, summaries
* Embedding similarity for career matching
* Whisper STT + TTS voice output

### **Auth**

* Firebase Auth
* JWT verification for backend calls

### **Hosting**

* **Frontend:** Vercel
* **Backend:** Render or Google Cloud Run
* **Database:** AWS RDS
* **Vector DB:** Pinecone Cloud

---

## 📁 Project Structure

```
trunorth/
│
├── frontend/
│   ├── public/
│   └── src/
│       ├── pages/
│       ├── components/
│       ├── context/
│       ├── services/
│       └── styles/
│
└── backend/
    ├── app/
    │   ├── api/
    │   ├── core/
    │   ├── models/
    │   ├── services/
    │   ├── utils/
    │   └── tests/
    └── requirements.txt

```

---

## 🤖 AI Confidence Score

The platform includes a dynamic **AI Confidence Score (0–100)** showing how confidently the system can recommend personalized career paths for a user.

### **Score Factors**

* Questionnaire quality
* Depth and relevance of AI Coach conversation
* Strength of career-role matches
* Microstep engagement
* User readiness signals

### **High-Level Formula**

```
AIConfidence = (EarnedPoints / PossiblePoints) * 100
```

### **Returned as**

* Final score
* Detailed JSON breakdown

### **API Example**

```
GET /admin/users/{id}/ai-confidence
```

---

## 🛠 Local Development Setup

### **1. Clone the Repository**

```
git clone https://github.com/Tru-North/TruNorth.git
cd TruNorth
```

### **2. Frontend**

```
cd frontend
npm install
npm run dev
```

### **3. Backend**

```
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### **4. Environment Variables**

Copy template:

```
cp .env.example .env
```

Set:

* Firebase config
* PostgreSQL URI
* Pinecone key
* OpenAI key
* Backend/Frontend URLs

---

## 🌐 Deployment

### **Frontend (Vercel)**

* Auto-deploys on push
* Environment vars managed in dashboard

### **Backend (Render or Cloud Run)**

* Uvicorn/Gunicorn entry
* Secure environment variable management

### **Database (AWS RDS)**

* PostgreSQL instance
* Run migrations using scripts

### **Vector DB (Pinecone)**

* Index per environment
* Used by recommendation engine

---

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch
3. Follow code style rules (ESLint/Prettier, Ruff/MyPy)
4. Add tests where required
5. Open a pull request

Contributions are always welcome.

---

## 📄 License

MIT License