import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Welcome from './pages/Welcome'
import Onboarding from './pages/Onboarding'
import Auth from './pages/Auth'

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Welcome />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/auth" element={<Auth />} />
      </Routes>
    </Router>
  )
}

export default App
