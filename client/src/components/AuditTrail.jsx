import React, { useState, useEffect } from 'react'
import { Search, Plane, Calendar, Clock, User, Edit, Eye, ArrowLeft, Archive, PlaneTakeoff } from 'lucide-react'
import { formatAirportDisplay } from '../utils'

const API_BASE = '/api'

export default function AuditTrail() {
  const [view, setView] = useState('selection') // 'selection' or 'audit'
  const [flights, setFlights] = useState([])
  const [archivedFlights, setArchivedFlights] = useState([])
  const [selectedFlight, setSelectedFlight] = useState(null)
  const [auditLogs, setAuditLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState('upcoming') // 'upcoming' or 'archived'

  useEffect(() => {
    fetchFlights()
  }, [])

  const fetchFlights = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      
      // Fetch upcoming flights
      const upcomingResponse = await fetch(`${API_BASE}/flights`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (upcomingResponse.ok) {
        const upcomingData = await upcomingResponse.json()
        setFlights(upcomingData)
      }

      // Fetch archived flights
      const archivedResponse = await fetch(`${API_BASE}/flights/archived`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (archivedResponse.ok) {
        const archivedData = await archivedResponse.json()
        setArchivedFlights(archivedData)
      }
    } catch (error) {
      console.error('Error fetching flights:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchFlightAuditLogs = async (flightId) => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE}/audit-logs/flight/${flightId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
      if (response.ok) {
        const data = await response.json()
        setAuditLogs(data.logs || [])
      } else {
        setAuditLogs([])
      }
    } catch (error) {
      console.error('Error fetching flight audit logs:', error)
      setAuditLogs([])
    } finally {
      setLoading(false)
    }
  }

  const handleFlightSelect = (flight) => {
    setSelectedFlight(flight)
    setView('audit')
    fetchFlightAuditLogs(flight.id)
  }

  const handleBackToSelection = () => {
    setView('selection')
    setSelectedFlight(null)
    setAuditLogs([])
  }

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    })
  }

  const renderChanges = (changes) => {
    if (!changes || Object.keys(changes).length === 0) return null

    return (
      <div style={{ marginTop: '0.75rem' }}>
        <div style={{ fontWeight: '600', fontSize: '0.875rem', marginBottom: '0.5rem', color: '#374151' }}>
          Field Changes:
        </div>
        {Object.entries(changes).map(([field, change]) => (
          <div key={field} style={{ 
            marginBottom: '0.5rem',
            padding: '0.75rem',
            background: '#f9fafb',
            borderRadius: '0.375rem',
            border: '1px solid #e5e7eb'
          }}>
            <div style={{ fontWeight: '500', fontSize: '0.875rem', marginBottom: '0.25rem', color: '#1f2937' }}>
              {field.charAt(0).toUpperCase() + field.slice(1)}:
            </div>
            <div style={{ fontSize: '0.8125rem' }}>
              <div style={{ 
                padding: '0.25rem 0.5rem', 
                background: '#fee2e2', 
                borderRadius: '0.25rem',
                marginBottom: '0.25rem',
                color: '#7f1d1d'
              }}>
                <strong>Before:</strong> {typeof change.from === 'object' ? JSON.stringify(change.from, null, 2) : String(change.from)}
              </div>
              <div style={{ 
                padding: '0.25rem 0.5rem', 
                background: '#dcfce7', 
                borderRadius: '0.25rem',
                color: '#14532d'
              }}>
                <strong>After:</strong> {typeof change.to === 'object' ? JSON.stringify(change.to, null, 2) : String(change.to)}
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  const getActionBadge = (action) => {
    const styles = {
      CREATE: { background: '#dcfce7', color: '#166534', text: 'Created' },
      UPDATE: { background: '#fef3c7', color: '#92400e', text: 'Updated' },
      DELETE: { background: '#fee2e2', color: '#991b1b', text: 'Deleted' }
    }
    
    const style = styles[action] || { background: '#f3f4f6', color: '#374151', text: action }
    
    return (
      <span style={{
        padding: '0.25rem 0.75rem',
        borderRadius: '9999px',
        fontSize: '0.75rem',
        fontWeight: '600',
        ...style
      }}>
        {style.text}
      </span>
    )
  }

  // Filter flights based on search term
  const filterFlights = (flightList) => {
    if (!searchTerm) return flightList
    
    const term = searchTerm.toLowerCase()
    return flightList.filter(flight => 
      flight.flightNumber?.toLowerCase().includes(term) ||
      flight.airline?.toLowerCase().includes(term) ||
      flight.from?.toLowerCase().includes(term) ||
      flight.to?.toLowerCase().includes(term) ||
      flight.passengers?.some(p => p.name.toLowerCase().includes(term))
    )
  }

  const filteredUpcomingFlights = filterFlights(flights)
  const filteredArchivedFlights = filterFlights(archivedFlights)

  if (view === 'audit' && selectedFlight) {
    return (
      <div style={{ padding: '2rem' }}>
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '1rem',
          marginBottom: '2rem'
        }}>
          <button
            onClick={handleBackToSelection}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              background: '#f3f4f6',
              color: '#374151',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              fontSize: '0.875rem'
            }}
          >
            <ArrowLeft size={16} />
            Back to Flight Selection
          </button>
          
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '600', color: '#1e40af', margin: 0 }}>
              Audit Trail: {selectedFlight?.airline} {selectedFlight?.flightNumber}
            </h2>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: '0.25rem 0 0 0' }}>
              {selectedFlight?.from} → {selectedFlight?.to} | {new Date(selectedFlight?.departureDateTime).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Flight Info Summary */}
        <div style={{
          background: 'white',
          borderRadius: '0.5rem',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          padding: '1.5rem',
          marginBottom: '1.5rem'
        }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem', color: '#374151' }}>
            Flight Details
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>Flight</div>
              <div style={{ fontWeight: '500' }}>{selectedFlight.airline} {selectedFlight.flightNumber}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>Route</div>
              <div style={{ fontWeight: '500' }}>{selectedFlight.from} → {selectedFlight.to}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>Departure</div>
              <div style={{ fontWeight: '500' }}>{new Date(selectedFlight.departureDateTime).toLocaleString()}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>Passengers</div>
              <div style={{ fontWeight: '500' }}>{selectedFlight.passengers?.length || 0}</div>
            </div>
          </div>
        </div>

        {/* Audit Logs */}
        <div style={{
          background: 'white',
          borderRadius: '0.5rem',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          overflow: 'hidden'
        }}>
          <div style={{ padding: '1.5rem', borderBottom: '1px solid #e5e7eb' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: '600', margin: 0, color: '#374151' }}>
              Change History ({auditLogs.length} entries)
            </h3>
          </div>

          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
              Loading audit trail...
            </div>
          ) : auditLogs.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
              No changes recorded for this flight
            </div>
          ) : (
            <div>
              {auditLogs.map((entry, index) => (
                <div key={entry.id || index} style={{
                  padding: '1.5rem',
                  borderBottom: index < auditLogs.length - 1 ? '1px solid #e5e7eb' : 'none'
                }}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'flex-start',
                    marginBottom: '0.75rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      {getActionBadge(entry.action)}
                      <div>
                        <div style={{ fontWeight: '500', color: '#374151' }}>
                          {entry.username || 'Unknown User'}
                        </div>
                        <div style={{ fontSize: '0.8125rem', color: '#6b7280' }}>
                          {entry.action === 'CREATE' ? 'Created this flight' :
                           entry.action === 'UPDATE' ? 'Modified flight details' :
                           entry.action === 'DELETE' ? 'Deleted this flight' : 
                           `Performed ${entry.action.toLowerCase()} action`}
                        </div>
                      </div>
                    </div>
                    
                    <div style={{ textAlign: 'right', fontSize: '0.8125rem', color: '#6b7280' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', justifyContent: 'flex-end' }}>
                        <Clock size={12} />
                        {formatTimestamp(entry.timestamp)}
                      </div>
                    </div>
                  </div>

                  {entry.changes && renderChanges(entry.changes)}
                  
                  {entry.metadata && (
                    <div style={{ 
                      marginTop: '0.75rem',
                      padding: '0.75rem',
                      background: '#f8fafc',
                      borderRadius: '0.375rem',
                      fontSize: '0.8125rem',
                      color: '#64748b'
                    }}>
                      <strong>Additional Info:</strong> {JSON.stringify(entry.metadata)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // Flight Selection View
  return (
    <div style={{ padding: '2rem' }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '2rem'
      }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '600', color: '#1e40af', margin: 0 }}>
            Flight Audit Trail
          </h2>
          <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: '0.25rem 0 0 0' }}>
            Select a flight to view its complete change history
          </p>
        </div>
      </div>

      {/* Search */}
      <div style={{
        background: 'white',
        borderRadius: '0.5rem',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        padding: '1.5rem',
        marginBottom: '1.5rem'
      }}>
        <div style={{ position: 'relative', maxWidth: '400px' }}>
          <Search size={16} style={{ 
            position: 'absolute', 
            left: '0.75rem', 
            top: '50%', 
            transform: 'translateY(-50%)',
            color: '#6b7280'
          }} />
          <input
            type="text"
            placeholder="Search flights by number, airline, route, or passenger..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '0.75rem 0.75rem 0.75rem 2.5rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.375rem',
              fontSize: '0.875rem'
            }}
          />
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        background: 'white',
        borderRadius: '0.5rem',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        overflow: 'hidden'
      }}>
        <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb' }}>
          <button
            onClick={() => setActiveTab('upcoming')}
            style={{
              flex: 1,
              padding: '1rem',
              background: activeTab === 'upcoming' ? '#f0f9ff' : 'transparent',
              color: activeTab === 'upcoming' ? '#0369a1' : '#6b7280',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}
          >
            <Plane size={16} />
            Upcoming Flights ({filteredUpcomingFlights.length})
          </button>
          <button
            onClick={() => setActiveTab('archived')}
            style={{
              flex: 1,
              padding: '1rem',
              background: activeTab === 'archived' ? '#f0f9ff' : 'transparent',
              color: activeTab === 'archived' ? '#0369a1' : '#6b7280',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}
          >
            <Archive size={16} />
            Archived Flights ({filteredArchivedFlights.length})
          </button>
        </div>

        {/* Flight List */}
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
            Loading flights...
          </div>
        ) : (
          <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            {(activeTab === 'upcoming' ? filteredUpcomingFlights : filteredArchivedFlights).length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
                {searchTerm ? 'No flights match your search' : `No ${activeTab} flights found`}
              </div>
            ) : (
              (activeTab === 'upcoming' ? filteredUpcomingFlights : filteredArchivedFlights).map(flight => (
                <div
                  key={flight.id}
                  onClick={() => handleFlightSelect(flight)}
                  style={{
                    padding: '1.5rem',
                    borderBottom: '1px solid #e5e7eb',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s',
                    background: 'white'
                  }}
                  onMouseEnter={(e) => e.target.style.background = '#f9fafb'}
                  onMouseLeave={(e) => e.target.style.background = 'white'}
                >
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'flex-start',
                    marginBottom: '0.5rem'
                  }}>
                    <div>
                      <div style={{ 
                        fontSize: '1rem', 
                        fontWeight: '600', 
                        color: '#374151',
                        marginBottom: '0.25rem'
                      }}>
                        {flight.airline} {flight.flightNumber}
                      </div>
                      <div style={{ 
                        fontSize: '0.875rem', 
                        color: '#6b7280',
                        marginBottom: '0.5rem'
                      }}>
                        {formatAirportDisplay(flight.from)} → {formatAirportDisplay(flight.to)}
                      </div>
                      <div style={{ 
                        fontSize: '0.8125rem', 
                        color: '#6b7280'
                      }}>
                        <Calendar size={12} style={{ display: 'inline', marginRight: '0.25rem' }} />
                        {new Date(flight.departureDateTime).toLocaleString()}
                      </div>
                    </div>
                    
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ 
                        fontSize: '0.8125rem', 
                        color: '#6b7280',
                        marginBottom: '0.25rem'
                      }}>
                        {flight.passengers?.length || 0} passengers
                      </div>
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        padding: '0.25rem 0.5rem',
                        background: '#e0f2fe',
                        color: '#0369a1',
                        borderRadius: '0.25rem',
                        fontSize: '0.75rem',
                        fontWeight: '500'
                      }}>
                        <Eye size={12} />
                        View History
                      </div>
                    </div>
                  </div>
                  
                  {flight.passengers && flight.passengers.length > 0 && (
                    <div style={{ 
                      fontSize: '0.8125rem', 
                      color: '#6b7280',
                      borderTop: '1px solid #f3f4f6',
                      paddingTop: '0.5rem',
                      marginTop: '0.5rem'
                    }}>
                      <strong>Passengers:</strong> {flight.passengers.map(p => p.name).join(', ')}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}