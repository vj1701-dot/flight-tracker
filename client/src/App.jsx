import React from 'react'
import { Routes, Route } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import AddFlight from './pages/AddFlight'
import StandaloneAddFlight from './pages/StandaloneAddFlight'
import TelegramInfo from './pages/TelegramInfo'
import Login from './pages/Login'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Dashboard />} />
      <Route path="/flight-form" element={<StandaloneAddFlight />} />
      <Route path="/telegram-info" element={<TelegramInfo />} />
    </Routes>
  )
}

export default App