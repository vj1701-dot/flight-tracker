import React from 'react'
import { Routes, Route } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import AddFlight from './pages/AddFlight'
import StandaloneAddFlight from './pages/StandaloneAddFlight'
import TelegramInfo from './pages/TelegramInfo'
import DataManagement from './pages/DataManagement'
import Login from './pages/Login'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Dashboard />} />
      <Route path="/flight-form" element={<StandaloneAddFlight />} />
      <Route path="/telegram-info" element={<TelegramInfo />} />
      <Route path="/data-management" element={<DataManagement />} />
    </Routes>
  )
}

export default App