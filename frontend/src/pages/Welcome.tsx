import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useScreenSize } from '../hooks/useScreenSize'
import '../styles/global.css'
import '../styles/welcome.css'
import logo from '../assets/trunorth/trunorth_icon.svg'

const Welcome: React.FC = () => {
  const navigate = useNavigate()
  const { width } = useScreenSize()
  const isMobile = width <= 480

  return (
    <div
      className="mobile-frame"
      style={{
        width: isMobile ? '100vw' : '390px',
        height: isMobile ? '100vh' : '844px',
      }}
    >
      <div className="welcome-container">
        <div className="welcome-content">
          <img src={logo} alt="TruNorth Logo" className="welcome-logo" />

          <h1 className="welcome-title">Welcome to TruNorth</h1>
          <p className="welcome-text">
            Find clarity, purpose, and direction in your next career move, guided by your personal
            AI coach.
          </p>

          <button className="welcome-btn" onClick={() => navigate('/onboarding')}>
            Get Started
          </button>
        </div>
      </div>
    </div>
  )
}

export default Welcome
