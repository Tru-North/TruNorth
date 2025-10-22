import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../styles/global.css'
import '../styles/auth.css'
import googleIcon from '../assets/google_logo.svg'
import { registerUser, loginUser } from '../utils/api'

const Auth: React.FC = () => {
  const [tab, setTab] = useState<'login' | 'signup'>('signup')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (tab === 'signup') {
        const result = await registerUser({
          FirstName: firstName,
          LastName: lastName,
          Email: email,
          Password: password,
        })

        if (result?.id) {
          alert('🎉 Registration successful!')
          navigate('/intro')
        } else {
          setError(result?.error || 'Signup failed')
        }
      } else {
        const result = await loginUser(email, password)
        if (result?.access_token) {
          alert('✅ Login successful!')
          navigate('/intro')
        } else {
          setError(result?.detail || 'Invalid credentials')
        }
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-wrapper">
      <div className="mobile-frame">
        <div className="auth-header">
          <h1 className="auth-heading">{tab === 'login' ? 'Welcome Back!' : 'Getting Started'}</h1>
          <div className="auth-tabs">
            <button
              onClick={() => setTab('login')}
              className={`tab ${tab === 'login' ? 'active' : ''}`}
              disabled={loading}
            >
              Login
            </button>
            <button
              onClick={() => setTab('signup')}
              className={`tab ${tab === 'signup' ? 'active' : ''}`}
              disabled={loading}
            >
              Signup
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {tab === 'signup' && (
            <>
              <div className="input-group">
                <label htmlFor="firstName">First Name</label>
                <input
                  id="firstName"
                  type="text"
                  placeholder="First Name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </div>
              <div className="input-group">
                <label htmlFor="lastName">Last Name</label>
                <input
                  id="lastName"
                  type="text"
                  placeholder="Last Name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
              </div>
            </>
          )}

          <div className="input-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              placeholder="hello@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {tab === 'login' && (
            <div className="login-options">
              <label className="remember-me">
                <input type="checkbox" /> Remember Me
              </label>
              <span className="forgot-password">Forgot Password?</span>
            </div>
          )}

          <button type="submit" className="primary-btn" disabled={loading}>
            {loading
              ? tab === 'login'
                ? 'Logging in...'
                : 'Signing up...'
              : tab === 'login'
                ? 'Login'
                : 'Sign Up'}
          </button>

          {error && <p style={{ color: 'red', textAlign: 'center', marginTop: '10px' }}>{error}</p>}

          <div className="divider">
            <span>Or</span>
          </div>

          <button type="button" className="google-btn">
            <img src={googleIcon} alt="Google" className="google-icon" />
            Continue with Google
          </button>

          <p className="auth-footer">
            {tab === 'login' ? (
              <>
                Don’t have an account? <span onClick={() => setTab('signup')}>Sign Up</span>
              </>
            ) : (
              <>
                Already have an account? <span onClick={() => setTab('login')}>Login</span>
              </>
            )}
          </p>
        </form>
      </div>
    </div>
  )
}

export default Auth
