import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Plane, LogOut, Users, Shield, Archive, Menu, X, Home, MessageCircle, Database, Bell } from 'lucide-react'
import FlightModal from '../components/FlightModal'
import FlightCard from '../components/FlightCard'
import Filters from '../components/Filters'
import UserManagement from '../components/UserManagement'
import AuditTrail from '../components/AuditTrail'
import ArchiveComponent from '../components/Archive'
import BackupManagement from '../components/BackupManagement'
import FlightMonitoring from '../components/FlightMonitoring'
import AddFlight from './AddFlight'

const API_BASE = '/api'

function Dashboard() {
  const [flights, setFlights] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [editingFlight, setEditingFlight] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  const [activeTab, setActiveTab] = useState('flights')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [filters, setFilters] = useState({
    location: '',
    passengerName: '',
    dateFrom: '',
    dateTo: ''
  })
  const navigate = useNavigate()

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    const token = localStorage.getItem('token')
    
    if (!token || !user.id) {
      navigate('/login')
      return
    }
    
    setCurrentUser(user)
    fetchFlights()
  }, [])

  const fetchFlights = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE}/flights`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!response.ok) throw new Error('Failed to fetch flights')
      const data = await response.json()
      setFlights(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login')
  }

  const handleCreateFlight = async (flightData) => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE}/flights`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(flightData)
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create flight')
      }
      
      // Clear any previous errors
      setError(null)
      
      // Refresh the flights list
      await fetchFlights()
      
      // Close the modal and clear editing state
      setShowModal(false)
      setEditingFlight(null)
      
    } catch (err) {
      setError(err.message)
      // Don't close modal on error so user can fix and retry
    }
  }

  const handleUpdateFlight = async (flightData) => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE}/flights/${editingFlight.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(flightData)
      })
      if (!response.ok) throw new Error('Failed to update flight')
      await fetchFlights()
      setShowModal(false)
      setEditingFlight(null)
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDeleteFlight = async (id) => {
    if (!confirm('Are you sure you want to delete this flight?')) return
    
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE}/flights/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (!response.ok) throw new Error('Failed to delete flight')
      await fetchFlights()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleEditFlight = (flight) => {
    setEditingFlight(flight)
    setShowModal(true)
  }

  // Filter for upcoming flights only (future flights)
  const now = new Date()
  const upcomingFlights = flights.filter(flight => {
    const departureTime = new Date(flight.departureDateTime)
    return departureTime >= now
  })

  const filteredFlights = upcomingFlights.filter(flight => {
    const matchesLocation = !filters.location || 
      flight.from.toLowerCase().includes(filters.location.toLowerCase()) ||
      flight.to.toLowerCase().includes(filters.location.toLowerCase())
    
    const matchesPassengerName = !filters.passengerName ||
      flight.passengers?.some(passenger => 
        passenger.name.toLowerCase().includes(filters.passengerName.toLowerCase())
      )
    
    const departureDate = new Date(flight.departureDateTime).toDateString()
    const matchesDateFrom = !filters.dateFrom ||
      new Date(departureDate) >= new Date(filters.dateFrom)
    
    const matchesDateTo = !filters.dateTo ||
      new Date(departureDate) <= new Date(filters.dateTo)
    
    return matchesLocation && matchesPassengerName && matchesDateFrom && matchesDateTo
  }).sort((a, b) => new Date(a.departureDateTime) - new Date(b.departureDateTime))

  if (loading) {
    return (
      <div className="container">
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <Plane size={48} style={{ color: '#3b82f6', marginBottom: '1rem' }} />
          <h2>Loading flights...</h2>
        </div>
      </div>
    )
  }

  const renderSidebar = () => (
    <div style={{
      position: 'fixed',
      top: 0,
      left: sidebarOpen ? '0' : '-280px',
      width: '280px',
      height: '100vh',
      background: 'white',
      boxShadow: '2px 0 10px rgba(0, 0, 0, 0.1)',
      zIndex: 1000,
      transition: 'left 0.3s ease',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{
        padding: '1rem',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '600' }}>Menu</h2>
        <button
          onClick={() => setSidebarOpen(false)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '0.5rem'
          }}
        >
          <X size={20} />
        </button>
      </div>
      
      <nav style={{ flex: 1, padding: '1rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <button
            onClick={() => { setActiveTab('flights'); setSidebarOpen(false) }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem',
              background: activeTab === 'flights' ? '#e0f2fe' : 'transparent',
              color: activeTab === 'flights' ? '#0369a1' : '#374151',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              width: '100%',
              textAlign: 'left',
              fontSize: '0.875rem',
              fontWeight: '500'
            }}
          >
            <Home size={18} />
            Upcoming Flights
          </button>

          <button
            onClick={() => { setActiveTab('addFlight'); setSidebarOpen(false) }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem',
              background: activeTab === 'addFlight' ? '#e0f2fe' : 'transparent',
              color: activeTab === 'addFlight' ? '#0369a1' : '#374151',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              width: '100%',
              textAlign: 'left',
              fontSize: '0.875rem',
              fontWeight: '500'
            }}
          >
            <Plus size={18} />
            Add Flight
          </button>
          
          <button
            onClick={() => { setActiveTab('archive'); setSidebarOpen(false) }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem',
              background: activeTab === 'archive' ? '#e0f2fe' : 'transparent',
              color: activeTab === 'archive' ? '#0369a1' : '#374151',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              width: '100%',
              textAlign: 'left',
              fontSize: '0.875rem',
              fontWeight: '500'
            }}
          >
            <Archive size={18} />
            Flight Archive
          </button>

          {(currentUser?.role === 'superadmin' || currentUser?.role === 'admin') && (
            <button
              onClick={() => { setActiveTab('users'); setSidebarOpen(false) }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem',
                background: activeTab === 'users' ? '#e0f2fe' : 'transparent',
                color: activeTab === 'users' ? '#0369a1' : '#374151',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                width: '100%',
                textAlign: 'left',
                fontSize: '0.875rem',
                fontWeight: '500'
              }}
            >
              <Users size={18} />
              User Management
            </button>
          )}

          {currentUser?.role === 'superadmin' && (
            <button
              onClick={() => { setActiveTab('monitoring'); setSidebarOpen(false) }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem',
                background: activeTab === 'monitoring' ? '#e0f2fe' : 'transparent',
                color: activeTab === 'monitoring' ? '#0369a1' : '#374151',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                width: '100%',
                textAlign: 'left',
                fontSize: '0.875rem',
                fontWeight: '500'
              }}
            >
              <Bell size={18} />
              Flight Monitoring
            </button>
          )}

          {currentUser?.role === 'superadmin' && (
            <button
              onClick={() => { setActiveTab('audit'); setSidebarOpen(false) }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem',
                background: activeTab === 'audit' ? '#e0f2fe' : 'transparent',
                color: activeTab === 'audit' ? '#0369a1' : '#374151',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                width: '100%',
                textAlign: 'left',
                fontSize: '0.875rem',
                fontWeight: '500'
              }}
            >
              <Shield size={18} />
              Audit Trail
            </button>
          )}


          {currentUser?.role === 'superadmin' && (
            <button
              onClick={() => { setActiveTab('backup'); setSidebarOpen(false) }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem',
                background: activeTab === 'backup' ? '#e0f2fe' : 'transparent',
                color: activeTab === 'backup' ? '#0369a1' : '#374151',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                width: '100%',
                textAlign: 'left',
                fontSize: '0.875rem',
                fontWeight: '500'
              }}
            >
              <Database size={18} />
              Backup Management
            </button>
          )}
          
          <div style={{ 
            borderTop: '1px solid #e5e7eb', 
            marginTop: '1rem', 
            paddingTop: '1rem' 
          }}>
            <a
              href="/telegram-info"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem',
                background: '#f0f9ff',
                color: '#0ea5e9',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                width: '100%',
                textAlign: 'left',
                fontSize: '0.875rem',
                fontWeight: '500',
                textDecoration: 'none',
                marginBottom: '0.5rem'
              }}
            >
              <MessageCircle size={18} />
              Telegram Bot Info
            </a>

            <a
              href="/flight-form"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem',
                background: '#f0fdf4',
                color: '#16a34a',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                width: '100%',
                textAlign: 'left',
                fontSize: '0.875rem',
                fontWeight: '500',
                textDecoration: 'none'
              }}
            >
              <Plus size={18} />
              Shareable Flight Form
            </a>
          </div>
        </div>
      </nav>
      
      <div style={{
        padding: '1rem',
        borderTop: '1px solid #e5e7eb'
      }}>
        <div style={{ marginBottom: '1rem', fontSize: '0.875rem', color: '#6b7280' }}>
          Welcome {currentUser?.name || currentUser?.username}
        </div>
        <button
          onClick={handleLogout}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.75rem',
            background: '#fee2e2',
            color: '#dc2626',
            border: 'none',
            borderRadius: '0.5rem',
            cursor: 'pointer',
            width: '100%',
            textAlign: 'left',
            fontSize: '0.875rem',
            fontWeight: '500'
          }}
        >
          <LogOut size={18} />
          Logout
        </button>
      </div>
    </div>
  )

  return (
    <div>
      {/* Sidebar */}
      {renderSidebar()}
      
      {/* Sidebar overlay */}
      {sidebarOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            zIndex: 999
          }}
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      <header className="header">
        <div className="container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <button
                onClick={() => setSidebarOpen(true)}
                style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: 'none',
                  color: 'white',
                  padding: '0.5rem',
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <Menu size={20} />
              </button>
            </div>
            <h1 style={{ margin: 0, textAlign: 'center', flex: 1 }}>West Sant Transportation Dashboard</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            </div>
          </div>
        </div>
      </header>

      <div className="container">
        {error && (
          <div style={{ 
            background: '#fee2e2', 
            color: '#991b1b', 
            padding: '1rem', 
            borderRadius: '0.5rem', 
            marginBottom: '2rem' 
          }}>
            {error}
          </div>
        )}

        {activeTab === 'users' ? (
          <UserManagement />
        ) : activeTab === 'monitoring' ? (
          <FlightMonitoring />
        ) : activeTab === 'audit' ? (
          <AuditTrail />
        ) : activeTab === 'backup' ? (
          <BackupManagement />
        ) : activeTab === 'archive' ? (
          <ArchiveComponent />
        ) : activeTab === 'addFlight' ? (
          <AddFlight 
            onFlightAdded={fetchFlights} 
            onBackClick={() => setActiveTab('flights')} 
          />
        ) : (
          <>
            <Filters filters={filters} onFiltersChange={setFilters} />

            <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>Upcoming Flights ({filteredFlights.length})</h2>
            </div>

            {filteredFlights.length === 0 ? (
              <div className="empty-state">
                <Plane size={64} style={{ color: '#9ca3af', marginBottom: '1rem' }} />
                <h3>No upcoming flights found</h3>
                <p>Add your first flight to get started</p>
              </div>
            ) : (
              <div className="flights-grid">
                {filteredFlights.map(flight => (
                  <FlightCard
                    key={flight.id}
                    flight={flight}
                    onEdit={handleEditFlight}
                    onDelete={handleDeleteFlight}
                    currentUser={currentUser}
                  />
                ))}
              </div>
            )}

            {showModal && (
              <FlightModal
                flight={editingFlight}
                onSave={editingFlight ? handleUpdateFlight : handleCreateFlight}
                onClose={() => {
                  setShowModal(false)
                  setEditingFlight(null)
                }}
                currentUser={currentUser}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default Dashboard