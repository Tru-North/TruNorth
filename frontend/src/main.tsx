import React from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

function App() {
  return (
    <div style={{ fontFamily: 'sans-serif', textAlign: 'center', marginTop: '3rem' }}>
      <h1>TruNorth is Live!</h1>
      <p>Welcome to the frontend setup ✅</p>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
