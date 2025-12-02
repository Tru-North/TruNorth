<p align="center">
  <img src="./frontend/src/assets/trunorth/trunorth_icon.svg" width="120" />
</p>

<h1 align="center">🧭 TruNorth — AI-Powered Career Navigation Platform</h1>

TruNorth is a mobile-first AI career-guidance platform that helps individuals discover strengths, talk to an intelligent AI Coach, explore personalized career paths, and take action through guided micro-steps.  
It combines conversational AI, structured inputs, recommendations, and a clear journey map.

---

## ⭐ Key Features

### **🧠 AI Career Coach (Text + Voice)**
- Real-time text + voice interaction  
- Whisper STT + TTS playback  
- Barge-in behavior and replay controls  
- Uses questionnaire + chat history for personalization  
- Seamless mode switching  

### **📝 Multi-Step Questionnaire**
- Five structured sections  
- Required + optional tabs  
- Autosave and validation  
- Unlocks the AI Coach upon completion  

### **🔍 Personalized Career Recommendations**
- Embedding-based matching  
- Fit Score, Growth Trend, Salary Range  
- Favorite, dismiss, explore  
- Horizontal card navigation  

### **🪜 Microstep Action System**
- Career-specific guided actions  
- Connect / Reflect / Explore tabs  
- Progress tracking  
- AI-generated summaries  

### **🚀 Ready to Launch**
- Final reflection  
- Rating + review  
- Summary of the journey  
- Journey map updates to completion  

### **🖥️ Admin Dashboard (Desktop-Only)**
- Role-based admin login  
- User table with search + sorting  
- Full chat transcript viewer  
- AI output editor, tags, comments, nudges  
- All actions logged  

---

## 🏗 System Architecture

<p align="center">
  <img src="./frontend/src/assets/trunorth/system_architecture_design.png" width="100%" />
</p>

Architecture details are fully covered in the project documentation  
:contentReference[oaicite:0]{index=0} :contentReference[oaicite:1]{index=1}

---

## 🧠 AI Confidence Score

The AI Confidence Score (ACS) shows how confidently the system can generate career recommendations for a user.

Milestones, weights, formulas, and normalization logic are defined in  
:contentReference[oaicite:2]{index=2}

---

## 📁 Project Structure (Updated)

### **Root**
```

trunorth/
│
├── .venv
├── backend/
│   ├── .mypy_cache/
│   ├── .ruff_cache/
│   ├── app/
│   │   ├── api/
│   │   ├── core/
│   │   ├── data/
│   │   ├── models/
│   │   ├── services/
│   │   ├── tests/
│   │   ├── utils/
│   │   ├── **init**.py
│   │   └── main.py
│   ├── venv/
│   ├── .env
│   ├── mypy.ini
│   ├── requirements.txt
│   ├── ruff-config.toml
│   └── runtime.txt
│
└── frontend/
├── public/
└── src/
├── assets/
├── components/
├── data/
├── hooks/
├── pages/
├── services/
├── styles/
├── types/
├── utils/
├── App.tsx
├── index.css
└── main.tsx

```

---

## 🏗 Tech Stack Summary

Based on the detailed breakdown in the uploaded documentation  
:contentReference[oaicite:3]{index=3}

### **Frontend**
- React + Vite  
- CSS + Shadcn/UI  
- Zustand  
- WebSockets  

### **Backend**
- Python  
- FastAPI (REST + WebSockets)  
- SQLAlchemy ORM  

### **Databases**
- PostgreSQL (AWS RDS)  
- Pinecone (embeddings)  

### **AI**
- OpenAI GPT-4.x  
- Whisper STT + TTS  
- LangChain + LangGraph  

### **Auth**
- Firebase Authentication  
- JWT validation  

### **Deployment**
- Frontend → Vercel  
- Backend → Render  
- DB → AWS RDS  
- Pinecone Cloud  

---

## 🛠 Local Development Setup

### **1. Clone**
```

git clone [https://github.com/Tru-North/TruNorth.git](https://github.com/Tru-North/TruNorth.git)
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
Copy:
```

cp .env.example .env

```

Set:
- Firebase config  
- PostgreSQL URI  
- OpenAI key  
- Pinecone key  
- Backend/Frontend URLs  

---

## 🌐 Deployment

### **Frontend → Vercel**
- Auto deploy on push  
- Env vars managed in dashboard  

### **Backend → Render**
- FastAPI server with Uvicorn/Gunicorn  
- Env vars managed in dashboard  

### **Database → AWS RDS**
- PostgreSQL instance  

### **Vector DB → Pinecone**
- Index per environment  

---

## 🤝 Contributing

1. Fork the repo  
2. Create a feature branch  
3. Follow ESLint/Prettier + Ruff/MyPy  
4. Add tests  
5. Open a PR  

Contributions welcome.