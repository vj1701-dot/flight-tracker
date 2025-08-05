import React, { useState, useEffect } from 'react'
import { ArrowLeft, Plane } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { formatPhoneNumber } from '../utils'
import PassengerAutocomplete from '../components/PassengerAutocomplete'
import VolunteerAutocomplete from '../components/VolunteerAutocomplete'
import SearchableSelect from '../components/SearchableSelect'

const API_BASE = '/api'

export default function AddFlight({ onFlightAdded, onBackClick }) {
  const [formData, setFormData] = useState({
    airline: '',
    flightNumber: '',
    from: '',
    to: '',
    departureDateTime: '',
    arrivalDateTime: '',
    pickupVolunteerName: '',
    pickupVolunteerPhone: '',
    dropoffVolunteerName: '',
    dropoffVolunteerPhone: '',
    notes: ''
  })
  const [passengers, setPassengers] = useState([{ id: Date.now(), name: '' }])
  const [errors, setErrors] = useState({})
  const [airlines, setAirlines] = useState([])
  const [airports, setAirports] = useState([])
  const [currentUser, setCurrentUser] = useState(null)
  const [loadingData, setLoadingData] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [fetchingFlightInfo, setFetchingFlightInfo] = useState(false)
  const [flightInfoFetched, setFlightInfoFetched] = useState(false)
  const [multipleFlights, setMultipleFlights] = useState([])
  const [showFlightSelection, setShowFlightSelection] = useState(false)
  const [flightInfoMessage, setFlightInfoMessage] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    setCurrentUser(user)
    
    const fetchData = async () => {
      try {
        const [airlinesRes, airportsRes] = await Promise.all([
          fetch('/api/airlines'),
          fetch('/api/airports')
        ])
        
        if (airlinesRes.ok && airportsRes.ok) {
          const airlinesData = await airlinesRes.json()
          const airportsData = await airportsRes.json()
          setAirlines(airlinesData)
          setAirports(airportsData)
        }
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setLoadingData(false)
      }
    }
    
    fetchData()
  }, [])

  // Auto-fetch flight information when flight number and departure date are provided
  useEffect(() => {
    const shouldFetchFlightInfo = () => {
      if (!formData.flightNumber || !formData.departureDateTime) return false
      if (fetchingFlightInfo || flightInfoFetched) return false
      if (formData.flightNumber.length < 3) return false // Minimum flight number length
      
      // Extract date from datetime-local format
      const departureDate = formData.departureDateTime.split('T')[0]
      if (!departureDate || departureDate.length !== 10) return false
      
      return true
    }

    if (shouldFetchFlightInfo()) {
      fetchFlightInformation()
    }
  }, [formData.flightNumber, formData.departureDateTime])

  const fetchFlightInformation = async () => {
    if (fetchingFlightInfo) return
    
    setFetchingFlightInfo(true)
    try {
      const departureDate = formData.departureDateTime.split('T')[0] // Extract date part
      const token = localStorage.getItem('token')
      
      const response = await fetch(`${API_BASE}/flights/info/${formData.flightNumber}/${departureDate}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
      if (response.ok) {
        const flightInfo = await response.json()
        
        if (flightInfo.success && flightInfo.data) {
          const flight = flightInfo.data
          
          // Auto-populate form data
          setFormData(prev => ({
            ...prev,
            airline: flight.airline || prev.airline,
            from: flight.departure?.airport || prev.from,
            to: flight.arrival?.airport || prev.to,
            departureDateTime: flight.departure?.scheduledForInput || prev.departureDateTime,
            arrivalDateTime: flight.arrival?.scheduledForInput || prev.arrivalDateTime
          }))
          
          setFlightInfoFetched(true)
          setFlightInfoMessage('Flight details auto-populated successfully!')
          console.log('✅ Flight information auto-populated from API')
        } else if (flightInfo.multipleFlights) {
          // Handle multiple flights - show selection dialog
          setMultipleFlights(flightInfo.flights)
          setShowFlightSelection(true)
          setFlightInfoMessage(`Found ${flightInfo.flights.length} flights for ${formData.flightNumber}. Please select the correct one.`)
          console.log(`⚠️ Multiple flights found: ${flightInfo.flights.length}`)
        } else if (flightInfo.fallback) {
          // Handle API limitations gracefully with suggestions
          const fallback = flightInfo.fallback
          
          // Auto-populate at least the airline if we can determine it
          setFormData(prev => ({
            ...prev,
            airline: fallback.airline || prev.airline
          }))
          
          setFlightInfoFetched(true)
          setFlightInfoMessage(fallback.message || 'Please enter flight details manually')
          console.log(`💡 ${fallback.message}`)
        } else {
          setFlightInfoMessage('Flight information not found, please enter manually')
          console.log('⚠️ Flight information not found in API, manual entry required')
        }
      } else {
        console.log('⚠️ Could not fetch flight information from API')
      }
    } catch (error) {
      console.log('⚠️ Error fetching flight information:', error.message)
    } finally {
      setFetchingFlightInfo(false)
    }
  }

  const handleFlightSelection = (selectedFlight) => {
    // Auto-populate form data with selected flight
    setFormData(prev => ({
      ...prev,
      airline: selectedFlight.airline || prev.airline,
      from: selectedFlight.departure?.airport || prev.from,
      to: selectedFlight.arrival?.airport || prev.to,
      departureDateTime: selectedFlight.departure?.scheduledForInput || prev.departureDateTime,
      arrivalDateTime: selectedFlight.arrival?.scheduledForInput || prev.arrivalDateTime
    }))
    
    setFlightInfoFetched(true)
    setFlightInfoMessage('Flight details auto-populated successfully!')
    setShowFlightSelection(false)
    setMultipleFlights([])
    console.log('✅ Selected flight auto-populated from API')
  }

  const canEditPickupVolunteer = () => {
    if (!currentUser || currentUser.role !== 'user') return true
    return currentUser.allowedAirports?.includes(formData.to)
  }

  const canEditDropoffVolunteer = () => {
    if (!currentUser || currentUser.role !== 'user') return true
    return currentUser.allowedAirports?.includes(formData.from)
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    let formattedValue = value
    
    // Format phone number fields
    if (name === 'pickupVolunteerPhone' || name === 'dropoffVolunteerPhone') {
      formattedValue = formatPhoneNumber(value)
    }
    
    // Reset flight info fetched state if user changes flight number or departure date
    if (name === 'flightNumber' || name === 'departureDateTime') {
      setFlightInfoFetched(false)
      setFlightInfoMessage('')
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: formattedValue
    }))
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }))
    }
  }

  const handleVolunteerNameChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }))
    }
  }

  const handleVolunteerPhoneChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: formatPhoneNumber(value)
    }))
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }))
    }
  }


  const validateForm = () => {
    const newErrors = {}
    
    if (!formData.airline.trim()) newErrors.airline = 'Airline is required'
    if (!formData.flightNumber.trim()) newErrors.flightNumber = 'Flight number is required'
    if (!formData.from.trim()) newErrors.from = 'From location is required'
    if (!formData.to.trim()) newErrors.to = 'To location is required'
    if (!formData.departureDateTime) newErrors.departureDateTime = 'Departure time is required'
    if (!formData.arrivalDateTime) newErrors.arrivalDateTime = 'Arrival time is required'
    
    if (formData.departureDateTime && formData.arrivalDateTime) {
      const depTime = new Date(formData.departureDateTime);
      const arrTime = new Date(formData.arrivalDateTime);
      const durationMs = arrTime - depTime;
      
      if (durationMs < 0) {
        // Allow negative durations up to 12 hours for timezone differences
        const hours = Math.abs(durationMs) / (1000 * 60 * 60);
        if (hours > 12) {
          newErrors.arrivalDateTime = 'Flight times seem incorrect. Please verify departure and arrival times.'
        } else if (formData.from && formData.to) {
          // If airports are selected, allow timezone crossing
          // Add a note instead of an error
          console.log('Note: Flight appears to cross timezones - this is normal for international flights');
        } else {
          newErrors.arrivalDateTime = 'Arrival time appears to be before departure time. Please verify your times.'
        }
      } else {
        // Validate maximum flight duration (20 hours)
        const hours = durationMs / (1000 * 60 * 60);
        const minutes = (durationMs % (1000 * 60 * 60)) / (1000 * 60);
        if (hours > 20) {
          newErrors.arrivalDateTime = 'Flight duration exceeds 20 hours. Please verify departure and arrival times.'
        } else if (hours === 0 && minutes < 5) {
          newErrors.arrivalDateTime = 'Flight duration is less than 5 minutes. Please verify departure and arrival times.'
        }
      }
    }

    const validPassengers = passengers.filter(p => p.name.trim())
    if (validPassengers.length === 0) {
      newErrors.passengers = 'At least one passenger name is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!validateForm()) return

    setSubmitting(true)
    
    try {
      const validPassengers = passengers.filter(p => p.name.trim()).map(p => ({
        id: p.id,
        name: p.name.trim()
      }))

      const submissionData = {
        ...formData,
        departureDateTime: new Date(formData.departureDateTime).toISOString(),
        arrivalDateTime: new Date(formData.arrivalDateTime).toISOString(),
        passengers: validPassengers
      }

      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE}/flights`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(submissionData)
      })

      if (!response.ok) {
        let errorMessage = 'Failed to create flight'
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch (jsonError) {
          // If JSON parsing fails, use the response status text
          errorMessage = `Server error (${response.status}): ${response.statusText}`
        }
        throw new Error(errorMessage)
      }
      
      // Try to parse the success response (but don't fail if it's empty)
      try {
        await response.json()
      } catch (jsonError) {
        // Response parsing failed but request succeeded
      }
      
      setSuccess(true)
      
      // Call the parent callback to refresh flights
      if (onFlightAdded) {
        onFlightAdded()
      }
      
      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        if (onBackClick) {
          onBackClick()
        } else {
          navigate('/')
        }
      }, 2000)
      
    } catch (error) {
      setErrors({ submit: error.message })
    } finally {
      setSubmitting(false)
    }
  }

  if (loadingData) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#f8fafc'
      }}>
        <div style={{ textAlign: 'center' }}>
          <Plane size={48} style={{ color: '#3b82f6', marginBottom: '1rem' }} />
          <h2>Loading flight data...</h2>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '1rem' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ marginBottom: '2rem' }}>
          <button
            onClick={onBackClick}
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '0.5rem',
              color: '#3b82f6',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '1rem',
              marginBottom: '1rem',
              padding: '0.25rem 0'
            }}
          >
            <ArrowLeft size={20} />
            Back to Upcoming Flights
          </button>
          
          <h1 style={{ 
            fontSize: 'clamp(1.5rem, 4vw, 2.5rem)', 
            fontWeight: '600', 
            color: '#1e40af',
            margin: '0 0 0.5rem 0'
          }}>
            ✈️ Add New Flight
          </h1>
          <p style={{ color: '#6b7280', fontSize: '1.125rem' }}>
            Enter flight details and passenger information
          </p>
        </div>

        {success && (
          <div style={{
            background: '#d1fae5',
            color: '#065f46',
            padding: '1rem',
            borderRadius: '0.5rem',
            marginBottom: '2rem',
            textAlign: 'center'
          }}>
            Jai Swaminarayan 🙏 Your flight has been added successfully! Redirecting to dashboard...
          </div>
        )}

        {/* Flight Selection Modal */}
        {showFlightSelection && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}>
            <div style={{
              backgroundColor: 'white',
              padding: '2rem',
              borderRadius: '0.5rem',
              maxWidth: '600px',
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto'
            }}>
              <h3 style={{ marginBottom: '1rem', color: '#1e40af' }}>
                Multiple Flights Found - Select Your Flight
              </h3>
              <p style={{ marginBottom: '1.5rem', color: '#6b7280' }}>
                We found {multipleFlights.length} flights for {formData.flightNumber}. Please select the correct one:
              </p>
              
              {multipleFlights.map((flight, index) => (
                <div key={index} style={{
                  border: '1px solid #d1d5db',
                  borderRadius: '0.5rem',
                  padding: '1rem',
                  marginBottom: '1rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }} onClick={() => handleFlightSelection(flight)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>
                        {flight.airline} {formData.flightNumber}
                      </div>
                      <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                        {flight.departure?.airport} → {flight.arrival?.airport}
                      </div>
                      <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                        Departure: {flight.departure?.scheduledTime || 'Unknown'}
                      </div>
                      <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                        Arrival: {flight.arrival?.scheduledTime || 'Unknown'}
                      </div>
                    </div>
                    <button style={{
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.25rem',
                      padding: '0.5rem 1rem',
                      cursor: 'pointer'
                    }}>
                      Select
                    </button>
                  </div>
                </div>
              ))}
              
              <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
                <button 
                  onClick={() => setShowFlightSelection(false)}
                  style={{
                    backgroundColor: '#6b7280',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.25rem',
                    padding: '0.5rem 1rem',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {errors.submit && (
          <div style={{
            background: '#fee2e2',
            color: '#991b1b',
            padding: '1rem',
            borderRadius: '0.5rem',
            marginBottom: '2rem'
          }}>
            {errors.submit}
          </div>
        )}

        <div style={{ 
          background: 'white', 
          borderRadius: '0.5rem', 
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          padding: 'clamp(1rem, 3vw, 2rem)'
        }}>
          <form onSubmit={handleSubmit}>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
              gap: 'clamp(1rem, 2vw, 1.5rem)',
              marginBottom: '2rem'
            }}>
              {/* Airline */}
              <div>
                <label style={{ 
                  display: 'block', 
                  fontSize: '0.875rem', 
                  fontWeight: '500', 
                  color: '#374151',
                  marginBottom: '0.5rem'
                }}>
                  Airline *
                </label>
                <SearchableSelect
                  name="airline"
                  value={formData.airline}
                  onChange={handleChange}
                  options={airlines}
                  placeholder="Type to search airlines..."
                  error={errors.airline}
                  getOptionValue={(option) => option}
                  getOptionLabel={(option) => option}
                />
              </div>

              {/* Flight Number */}
              <div>
                <label style={{ 
                  display: 'block', 
                  fontSize: '0.875rem', 
                  fontWeight: '500', 
                  color: '#374151',
                  marginBottom: '0.5rem'
                }}>
                  Flight Number *
                  {fetchingFlightInfo && (
                    <span style={{ 
                      marginLeft: '0.5rem', 
                      fontSize: '0.75rem', 
                      color: '#3b82f6',
                      fontWeight: 'normal'
                    }}>
                      🔄 Fetching flight info...
                    </span>
                  )}
                  {flightInfoFetched && (
                    <span style={{ 
                      marginLeft: '0.5rem', 
                      fontSize: '0.75rem', 
                      color: '#059669',
                      fontWeight: 'normal'
                    }}>
                      ✅ Info fetched
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  name="flightNumber"
                  placeholder="e.g., AA123"
                  value={formData.flightNumber}
                  onChange={handleChange}
                  style={{ 
                    width: '100%',
                    padding: '0.75rem',
                    border: `1px solid ${errors.flightNumber ? '#dc2626' : '#d1d5db'}`,
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem'
                  }}
                />
                {errors.flightNumber && (
                  <span style={{ color: '#dc2626', fontSize: '0.75rem' }}>{errors.flightNumber}</span>
                )}
                {!fetchingFlightInfo && !flightInfoFetched && formData.flightNumber && formData.departureDateTime && (
                  <div style={{ 
                    fontSize: '0.75rem', 
                    color: '#6b7280', 
                    marginTop: '0.25rem' 
                  }}>
                    💡 Flight details will be auto-populated when both flight number and date are provided
                  </div>
                )}
                {flightInfoMessage && (
                  <div style={{ 
                    fontSize: '0.75rem', 
                    color: flightInfoMessage.includes('auto-populated') ? '#059669' : '#f59e0b',
                    marginTop: '0.25rem',
                    padding: '0.5rem',
                    backgroundColor: flightInfoMessage.includes('auto-populated') ? '#ecfdf5' : '#fef3c7',
                    borderRadius: '0.25rem',
                    border: `1px solid ${flightInfoMessage.includes('auto-populated') ? '#d1fae5' : '#fde68a'}`
                  }}>
                    {flightInfoMessage.includes('auto-populated') ? '✅' : '💡'} {flightInfoMessage}
                  </div>
                )}
              </div>

              {/* From */}
              <div>
                <label style={{ 
                  display: 'block', 
                  fontSize: '0.875rem', 
                  fontWeight: '500', 
                  color: '#374151',
                  marginBottom: '0.5rem'
                }}>
                  From *
                </label>
                <SearchableSelect
                  name="from"
                  value={formData.from}
                  onChange={handleChange}
                  options={airports}
                  placeholder="Type to search departure airport..."
                  error={errors.from}
                  getOptionValue={(airport) => airport.code}
                  getOptionLabel={(airport) => airport.display || `${airport.code} - ${airport.name} (${airport.city}, ${airport.country})`}
                  renderOption={(airport) => (
                    <div style={{ fontSize: '0.875rem' }}>
                      <div style={{ fontWeight: '600' }}>{airport.display || `${airport.code} - ${airport.name}`}</div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{airport.name}</div>
                    </div>
                  )}
                />
              </div>

              {/* To */}
              <div>
                <label style={{ 
                  display: 'block', 
                  fontSize: '0.875rem', 
                  fontWeight: '500', 
                  color: '#374151',
                  marginBottom: '0.5rem'
                }}>
                  To *
                </label>
                <SearchableSelect
                  name="to"
                  value={formData.to}
                  onChange={handleChange}
                  options={airports}
                  placeholder="Type to search destination airport..."
                  error={errors.to}
                  getOptionValue={(airport) => airport.code}
                  getOptionLabel={(airport) => airport.display || `${airport.code} - ${airport.name} (${airport.city}, ${airport.country})`}
                  renderOption={(airport) => (
                    <div style={{ fontSize: '0.875rem' }}>
                      <div style={{ fontWeight: '600' }}>{airport.display || `${airport.code} - ${airport.name}`}</div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{airport.name}</div>
                    </div>
                  )}
                />
              </div>

              {/* Departure DateTime */}
              <div>
                <label style={{ 
                  display: 'block', 
                  fontSize: '0.875rem', 
                  fontWeight: '500', 
                  color: '#374151',
                  marginBottom: '0.5rem'
                }}>
                  Departure Date & Time *
                </label>
                <input
                  type="datetime-local"
                  name="departureDateTime"
                  value={formData.departureDateTime}
                  onChange={handleChange}
                  style={{ 
                    width: '100%',
                    padding: '0.75rem',
                    border: `1px solid ${errors.departureDateTime ? '#dc2626' : '#d1d5db'}`,
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem'
                  }}
                />
                {errors.departureDateTime && (
                  <span style={{ color: '#dc2626', fontSize: '0.75rem' }}>{errors.departureDateTime}</span>
                )}
              </div>

              {/* Arrival DateTime */}
              <div>
                <label style={{ 
                  display: 'block', 
                  fontSize: '0.875rem', 
                  fontWeight: '500', 
                  color: '#374151',
                  marginBottom: '0.5rem'
                }}>
                  Arrival Date & Time *
                </label>
                <input
                  type="datetime-local"
                  name="arrivalDateTime"
                  value={formData.arrivalDateTime}
                  onChange={handleChange}
                  style={{ 
                    width: '100%',
                    padding: '0.75rem',
                    border: `1px solid ${errors.arrivalDateTime ? '#dc2626' : '#d1d5db'}`,
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem'
                  }}
                />
                {errors.arrivalDateTime && (
                  <span style={{ color: '#dc2626', fontSize: '0.75rem' }}>{errors.arrivalDateTime}</span>
                )}
              </div>
            </div>

            {/* Passengers Section */}
            <div style={{ marginBottom: '2rem' }}>
              <PassengerAutocomplete 
                passengers={passengers}
                onChange={setPassengers}
                errors={errors}
              />
            </div>

            {/* Volunteer Information */}
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ 
                fontSize: '1.125rem', 
                fontWeight: '600', 
                color: '#374151',
                marginBottom: '1rem'
              }}>
                Transport Volunteer Information
              </h3>
              {currentUser?.role === 'user' && (
                <div style={{
                  background: '#fef3c7',
                  border: '1px solid #f59e0b',
                  borderRadius: '0.5rem',
                  padding: '0.75rem',
                  marginBottom: '1rem',
                  fontSize: '0.875rem',
                  color: '#92400e'
                }}>
                  <strong>Note:</strong> You can only edit volunteer information for your allowed airports.
                  Drop-off Volunteer is for the origin airport, Pickup Volunteer is for the destination airport.
                </div>
              )}
              
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
                gap: 'clamp(1rem, 2vw, 1.5rem)'
              }}>
                {/* Drop-off Volunteer Name */}
                <VolunteerAutocomplete
                  value={formData.dropoffVolunteerName}
                  onChange={handleVolunteerNameChange}
                  phoneValue={formData.dropoffVolunteerPhone}
                  onPhoneChange={handleVolunteerPhoneChange}
                  name="dropoffVolunteerName"
                  phoneName="dropoffVolunteerPhone"
                  label={`Drop-off Volunteer Name (at origin: ${formData.from || 'Select origin first'})`}
                  placeholder={canEditDropoffVolunteer() ? "Start typing volunteer name..." : "Not authorized for this location"}
                  disabled={!canEditDropoffVolunteer()}
                  error={errors.dropoffVolunteerName}
                />
                
                {/* Drop-off Volunteer Phone */}
                <div>
                  <label style={{ 
                    display: 'block', 
                    fontSize: '0.875rem', 
                    fontWeight: '500', 
                    color: '#374151',
                    marginBottom: '0.5rem'
                  }}>
                    Drop-off Volunteer Phone (at origin: {formData.from || 'Select origin first'})
                  </label>
                  <input
                    type="tel"
                    name="dropoffVolunteerPhone"
                    placeholder={canEditDropoffVolunteer() ? "(555) 123-4567" : "Not authorized for this location"}
                    value={formData.dropoffVolunteerPhone}
                    onChange={handleVolunteerPhoneChange}
                    disabled={!canEditDropoffVolunteer()}
                    style={{ 
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.375rem',
                      fontSize: '1rem',
                      backgroundColor: !canEditDropoffVolunteer() ? '#f9fafb' : 'white',
                      color: !canEditDropoffVolunteer() ? '#6b7280' : '#374151'
                    }}
                  />
                </div>
                
                {/* Pickup Volunteer Name */}
                <VolunteerAutocomplete
                  value={formData.pickupVolunteerName}
                  onChange={handleVolunteerNameChange}
                  phoneValue={formData.pickupVolunteerPhone}
                  onPhoneChange={handleVolunteerPhoneChange}
                  name="pickupVolunteerName"
                  phoneName="pickupVolunteerPhone"
                  label={`Pickup Volunteer Name (at destination: ${formData.to || 'Select destination first'})`}
                  placeholder={canEditPickupVolunteer() ? "Start typing volunteer name..." : "Not authorized for this location"}
                  disabled={!canEditPickupVolunteer()}
                  error={errors.pickupVolunteerName}
                />
                
                {/* Pickup Volunteer Phone */}
                <div>
                  <label style={{ 
                    display: 'block', 
                    fontSize: '0.875rem', 
                    fontWeight: '500', 
                    color: '#374151',
                    marginBottom: '0.5rem'
                  }}>
                    Pickup Volunteer Phone (at destination: {formData.to || 'Select destination first'})
                  </label>
                  <input
                    type="tel"
                    name="pickupVolunteerPhone"
                    placeholder={canEditPickupVolunteer() ? "(555) 123-4567" : "Not authorized for this location"}
                    value={formData.pickupVolunteerPhone}
                    onChange={handleVolunteerPhoneChange}
                    disabled={!canEditPickupVolunteer()}
                    style={{ 
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.375rem',
                      fontSize: '1rem',
                      backgroundColor: !canEditPickupVolunteer() ? '#f9fafb' : 'white',
                      color: !canEditPickupVolunteer() ? '#6b7280' : '#374151'
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div style={{ marginBottom: '2rem' }}>
              <label style={{ 
                display: 'block', 
                fontSize: '0.875rem', 
                fontWeight: '500', 
                color: '#374151',
                marginBottom: '0.5rem'
              }}>
                Notes
              </label>
              <textarea
                name="notes"
                rows="4"
                placeholder="Additional notes, special requirements, etc."
                value={formData.notes}
                onChange={handleChange}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                  resize: 'vertical'
                }}
              />
            </div>

            {/* Submit Button */}
            <div style={{ textAlign: 'center' }}>
              <button
                type="submit"
                disabled={submitting}
                style={{
                  padding: '1rem 2rem',
                  background: submitting ? '#9ca3af' : '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.5rem',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  margin: '0 auto'
                }}
              >
                <Plane size={20} />
                {submitting ? 'Adding Flight...' : 'Add Flight'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}