import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../styles/forgotpassword.css'
import { forgotPassword } from '../utils/api'

// ✅ Import your custom SVG icon
import BackIcon from '../assets/login_and_registration/back_button_icon.svg'

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await forgotPassword(email)
      navigate('/verify-code', { state: { email } })
    } catch (err: any) {
      const detail =
        err.response?.data?.detail ||
        err.message ||
        'Failed to send reset email'
      setError(detail)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="forgot-container">
      <div className="forgot-card">

        {/* ✅ Back button with SVG */}
        <button onClick={() => navigate(-1)} className="back-button">
          <img 
            src={BackIcon} 
            alt="Back"
            className="back-svg"
          />
        </button>

        <h1>Forgot password</h1>
        <p>Please enter your email to reset the password</p>

        <div className="form-group">
          <label htmlFor="reset-email">Your Email</label>
          <input
            id="reset-email"
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />
        </div>

        {error && <p className="error-text">{error}</p>}

        <button
          onClick={handleResetPassword}
          disabled={loading || !email}
          className="reset-button"
        >
          {loading ? 'Sending...' : 'Reset Password'}
        </button>
      </div>
    </div>
  )
}

export default ForgotPassword
