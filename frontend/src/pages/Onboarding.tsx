import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useScreenSize } from '../hooks/useScreenSize'
import OnboardingStep1 from './OnboardingStep1'
import OnboardingStep2 from './OnboardingStep2'
import '../styles/global.css'
import '../styles/onboarding.css'

const Onboarding: React.FC = () => {
  const [step, setStep] = useState(1)
  const { width } = useScreenSize()
  const isMobile = width <= 480
  const navigate = useNavigate()

  const next = () => setStep((prev) => Math.min(prev + 1, 2))
  const prev = () => setStep((prev) => Math.max(prev - 1, 1))

  return (
    <div
      className="mobile-frame"
      style={{
        width: isMobile ? '100vw' : '390px',
        height: isMobile ? '100vh' : '844px',
      }}
    >
      {/* Step Components */}
      {step === 1 && <OnboardingStep1 onNext={next} />}
      {step === 2 && <OnboardingStep2 onNext={() => navigate('/auth')} onBack={prev} />}

      {/* Progress Dots */}
      <div className="dots">
        <span className={`dot ${step === 1 ? 'active' : ''}`} />
        <span className={`dot ${step === 2 ? 'active' : ''}`} />
      </div>

      {/* Skip only visible on Step 1 */}
      {step === 1 && (
        <button className="skip-btn" onClick={() => navigate('/auth')}>
          Skip
        </button>
      )}
    </div>
  )
}

export default Onboarding
