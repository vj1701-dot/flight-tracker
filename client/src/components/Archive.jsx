import React, { useState, useEffect } from 'react'
import { Calendar, Clock, Users, MapPin } from 'lucide-react'
import Filters from './Filters'
import { formatAirportDisplay } from '../utils'

const API_BASE = '/api'

export default function Archive() {
  const [flights, setFlights] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  const [filters, setFilters] = useState({
    location: '',
    passengerName: '',
    dateFrom: '',
    dateTo: ''
  })

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}')
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

  const formatDateTime = (dateTime) => {
    return new Date(dateTime).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  // Filter for past flights only
  const now = new Date()
  const pastFlights = flights.filter(flight => {
    const departureTime = new Date(flight.departureDateTime)
    return departureTime < now
  })

  const filteredFlights = pastFlights.filter(flight => {
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
  })

  // Sort by departure date (most recent first)
  const sortedFlights = filteredFlights.sort((a, b) => 
    new Date(b.departureDateTime) - new Date(a.departureDateTime)
  )

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div>Loading archived flights...</div>
      </div>
    )
  }

  return (
    <div style={{ padding: '1rem' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '1.5rem'
      }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: '600', color: '#1e40af', margin: 0 }}>
          Flight Archive
        </h2>
      </div>

      {error && (
        <div style={{ 
          background: '#fee2e2', 
          color: '#991b1b', 
          padding: '1rem', 
          borderRadius: '0.5rem', 
          marginBottom: '1.5rem' 
        }}>
          {error}
        </div>
      )}

      <Filters filters={filters} onFiltersChange={setFilters} />

      <div style={{ 
        marginBottom: '1.5rem', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center' 
      }}>
        <h3 style={{ fontSize: '1.125rem', fontWeight: '500', margin: 0 }}>
          Past Flights ({sortedFlights.length})
        </h3>
      </div>

      {sortedFlights.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '3rem',
          background: 'white',
          borderRadius: '0.5rem',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          <Calendar size={64} style={{ color: '#9ca3af', marginBottom: '1rem' }} />
          <h3 style={{ color: '#374151', marginBottom: '0.5rem' }}>No archived flights found</h3>
          <p style={{ color: '#6b7280' }}>Past flights will appear here after their departure time</p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gap: '1rem',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))'
        }}>
          {sortedFlights.map(flight => (
            <div key={flight.id} style={{
              background: 'white',
              borderRadius: '0.5rem',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
              padding: '1.5rem',
              border: '1px solid #e5e7eb',
              opacity: '0.8'
            }}>
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.5rem'
                }}>
                  <h3 style={{ 
                    fontSize: '1.125rem', 
                    fontWeight: '600', 
                    color: '#374151',
                    margin: 0 
                  }}>
                    {flight.airline}
                  </h3>
                  <span style={{
                    background: '#f3f4f6',
                    color: '#6b7280',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '0.25rem',
                    fontSize: '0.75rem',
                    fontWeight: '500'
                  }}>
                    COMPLETED
                  </span>
                </div>
                <div style={{ 
                  fontSize: '0.875rem', 
                  color: '#6b7280',
                  marginBottom: '0.75rem' 
                }}>
                  Flight {flight.flightNumber}
                </div>
              </div>

              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: '1rem'
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ 
                    fontSize: '1.25rem', 
                    fontWeight: '600', 
                    color: '#374151' 
                  }}>
                    {formatAirportDisplay(flight.from)}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                    {formatDateTime(flight.departureDateTime)}
                  </div>
                </div>
                
                <div style={{ 
                  flex: 1, 
                  height: '2px', 
                  background: '#e5e7eb', 
                  margin: '0 1rem',
                  position: 'relative'
                }}>
                  <div style={{
                    position: 'absolute',
                    right: '-4px',
                    top: '-3px',
                    width: '8px',
                    height: '8px',
                    background: '#6b7280',
                    borderRadius: '50%'
                  }}></div>
                </div>
                
                <div style={{ textAlign: 'center' }}>
                  <div style={{ 
                    fontSize: '1.25rem', 
                    fontWeight: '600', 
                    color: '#374151' 
                  }}>
                    {formatAirportDisplay(flight.to)}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                    {formatDateTime(flight.arrivalDateTime)}
                  </div>
                </div>
              </div>

              {flight.passengers && flight.passengers.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.5rem',
                    marginBottom: '0.5rem'
                  }}>
                    <Users size={16} style={{ color: '#6b7280' }} />
                    <span style={{ fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>
                      Passengers ({flight.passengers.length})
                    </span>
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                    {flight.passengers.map(p => p.name).join(', ')}
                  </div>
                </div>
              )}

              {(flight.pickupSevakName || flight.dropoffSevakName) && (
                <div style={{ 
                  background: '#f9fafb', 
                  padding: '0.75rem', 
                  borderRadius: '0.375rem',
                  fontSize: '0.75rem',
                  color: '#6b7280'
                }}>
                  {flight.pickupSevakName && (
                    <div>Pickup: {flight.pickupSevakName} ({flight.pickupSevakPhone})</div>
                  )}
                  {flight.dropoffSevakName && (
                    <div>Dropoff: {flight.dropoffSevakName} ({flight.dropoffSevakPhone})</div>
                  )}
                </div>
              )}

              {currentUser?.role === 'superadmin' && (flight.createdBy || flight.updatedBy) && (
                <div style={{ 
                  marginTop: '1rem',
                  padding: '0.5rem',
                  background: '#f0f9ff',
                  borderRadius: '0.25rem',
                  fontSize: '0.75rem',
                  color: '#0369a1'
                }}>
                  Created by: {flight.createdBy}
                  {flight.updatedBy !== flight.createdBy && (
                    <div>Last updated by: {flight.updatedBy}</div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}