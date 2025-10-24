import React, { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import '../styles/verifycode.css'
import { verifyCode, forgotPassword } from '../utils/api' // ✅ import API helpers

const VerifyCode: React.FC = () => {
  const [code, setCode] = useState<string[]>(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const location = useLocation()
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  const email = location.state?.email || ''

  useEffect(() => {
    inputRefs.current[0]?.focus()
  }, [])

  const handleCodeChange = (index: number, value: string) => {
    if (value && !/^\d$/.test(value)) return

    const newCode = [...code]
    newCode[index] = value
    setCode(newCode)

    if (value && index < 4) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text').slice(0, 6)
    const newCode = [...code]

    for (let i = 0; i < pastedData.length; i++) {
      if (/^\d$/.test(pastedData[i])) {
        newCode[i] = pastedData[i]
      }
    }

    setCode(newCode)
    const nextEmptyIndex = newCode.findIndex(c => !c)
    if (nextEmptyIndex !== -1) {
      inputRefs.current[nextEmptyIndex]?.focus()
    } else {
      inputRefs.current[4]?.focus()
    }
  }

  const handleVerifyCode = async () => {
    setError('')
    setLoading(true)
    const verificationCode = code.join('')

    try {
      // ✅ real API call
      await verifyCode(email, verificationCode)
      navigate('/set-new-password', { state: { email, code: verificationCode } })
    } catch (err: any) {
      const detail = err.response?.data?.detail || 'Invalid or expired code'
      setError(detail)
    } finally {
      setLoading(false)
    }
  }

  const handleResendEmail = async () => {
    setLoading(true)
    setError('')
    try {
      // ✅ call forgotPassword again to resend
      await forgotPassword(email)
      alert('Verification code resent!')
      setCode(['', '', '', '', '', ''])
      inputRefs.current[0]?.focus()
    } catch (err: any) {
      const detail = err.response?.data?.detail || 'Failed to resend email'
      setError(detail)
    } finally {
      setLoading(false)
    }
  }

  const isCodeComplete = code.every(digit => digit !== '')

  return (
    <div className="otp-container">
      <div className="otp-card">
        <button
          onClick={() => navigate(-1)}
          className="otp-back-button"
          disabled={loading}
        >
          ←
        </button>

        <h1>Check your email</h1>
        <p className="otp-description">
          We sent a reset code to{' '}
          <span className="email-highlight">{email}</span> — enter the 6-digit code below.
        </p>

        <div className="otp-inputs">
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <input
              key={index}
              ref={(el) => (inputRefs.current[index] = el)}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={code[index]}
              onChange={(e) => handleCodeChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={index === 0 ? handlePaste : undefined}
              disabled={loading}
              className={`otp-input ${code[index] ? 'filled' : ''} ${error ? 'error' : ''}`}
            />
          ))}
        </div>

        {error && <p className="error-message">{error}</p>}

        <button
          onClick={handleVerifyCode}
          disabled={loading || !isCodeComplete}
          className={`verify-button ${loading ? 'loading' : ''}`}
        >
          {loading ? 'Verifying...' : 'Verify Code'}
        </button>

        <div className="resend-section">
          <p className="resend-text">
            Haven’t got the email yet?{' '}
            <button
              type="button"
              onClick={handleResendEmail}
              disabled={loading}
              className="resend-link"
            >
              Resend email
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}

export default VerifyCode
