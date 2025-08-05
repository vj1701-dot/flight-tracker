import React, { useState, useEffect } from 'react'
import { Plane } from 'lucide-react'
import PassengerAutocomplete from '../components/PassengerAutocomplete'
import SearchableSelect from '../components/SearchableSelect'

const API_BASE = '/api'

export default function StandaloneAddFlight() {
  const [formData, setFormData] = useState({
    airline: '',
    flightNumber: '',
    from: '',
    to: '',
    departureDateTime: '',
    arrivalDateTime: '',
    notes: ''
  })
  const [passengers, setPassengers] = useState([])
  const [errors, setErrors] = useState({})
  const [airlines, setAirlines] = useState([])
  const [airports, setAirports] = useState([])
  const [loadingData, setLoadingData] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [fetchingFlightInfo, setFetchingFlightInfo] = useState(false)
  const [flightInfoFetched, setFlightInfoFetched] = useState(false)
  const [flightInfoMessage, setFlightInfoMessage] = useState('')
  const [multipleFlights, setMultipleFlights] = useState([])
  const [showFlightSelection, setShowFlightSelection] = useState(false)

  useEffect(() => {
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
      console.log('🔍 Checking if should fetch flight info:', {
        flightNumber: formData.flightNumber,
        departureDateTime: formData.departureDateTime,
        fetchingFlightInfo,
        flightInfoFetched
      });
      
      if (!formData.flightNumber || !formData.departureDateTime) {
        console.log('❌ Missing required fields: flightNumber or departureDateTime');
        return false;
      }
      if (fetchingFlightInfo || flightInfoFetched) {
        console.log('❌ Already fetching or fetched');
        return false;
      }
      if (formData.flightNumber.length < 3) {
        console.log('❌ Flight number too short:', formData.flightNumber.length);
        return false;
      }
      
      // Extract date from either datetime-local format or date format
      const departureDate = formData.departureDateTime && formData.departureDateTime.includes('T') 
        ? formData.departureDateTime.split('T')[0]
        : formData.departureDateTime
      if (!departureDate || departureDate.length !== 10) {
        console.log('❌ Invalid date format:', departureDate);
        return false;
      }
      
      console.log('✅ All conditions met, will fetch flight info');
      return true
    }

    if (shouldFetchFlightInfo()) {
      fetchFlightInformation()
    }
  }, [formData.flightNumber, formData.departureDateTime])

  const fetchFlightInformation = async () => {
    if (fetchingFlightInfo) return
    
    console.log('🚀 Starting fetchFlightInformation...');
    setFetchingFlightInfo(true)
    try {
      // Extract date from either datetime-local format or date format (same logic as useEffect)
      const departureDate = formData.departureDateTime && formData.departureDateTime.includes('T') 
        ? formData.departureDateTime.split('T')[0]
        : formData.departureDateTime
      
      const apiUrl = `${API_BASE}/flights/info/${formData.flightNumber}/${departureDate}`;
      console.log('📡 Making API call to:', apiUrl);
      
      const response = await fetch(apiUrl)
      
      if (response.ok) {
        const flightInfo = await response.json()
        
        if (flightInfo.success && flightInfo.data) {
          const flight = flightInfo.data
          
          // Auto-populate form data
          setFormData(prev => {
            console.log('🔍 Single flight API response scheduledForInput values:', {
              departure: flight.departure?.scheduledForInput,
              arrival: flight.arrival?.scheduledForInput,
              prevDeparture: prev.departureDateTime,
              prevArrival: prev.arrivalDateTime
            });
            
            return {
              ...prev,
              airline: flight.airline || prev.airline,
              from: flight.departure?.airport || prev.from,
              to: flight.arrival?.airport || prev.to,
              departureDateTime: flight.departure?.scheduledForInput || prev.departureDateTime,
              arrivalDateTime: flight.arrival?.scheduledForInput || prev.arrivalDateTime
            };
          })
          
          setFlightInfoFetched(true)
          setFlightInfoMessage('Flight details auto-populated successfully! Please verify the information matches your booking.')
          console.log('✅ Flight information auto-populated from API')
        } else if (flightInfo.multipleFlights) {
          // Handle multiple flights - show selection dialog
          console.log('🔍 Multiple flights data received:', flightInfo.flights)
          setMultipleFlights(flightInfo.flights)
          setShowFlightSelection(true)
          setFlightInfoMessage(`Found ${flightInfo.flights.length} flights for ${formData.flightNumber}. Please select the correct one.`)
          // Don't set flightInfoFetched to true for multiple flights
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
          setFlightInfoMessage(fallback.message || 'Please enter flight details manually and verify with your booking')
          console.log(`💡 ${fallback.message}`)
        } else {
          setFlightInfoMessage('Flight information not found, please enter manually and verify with your booking')
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
    console.log('🔍 Selecting flight:', selectedFlight)
    console.log('🔍 Departure scheduledForInput:', selectedFlight.departure?.scheduledForInput)
    console.log('🔍 Arrival scheduledForInput:', selectedFlight.arrival?.scheduledForInput)
    
    setFormData(prev => ({
      ...prev,
      airline: selectedFlight.airline || prev.airline,
      from: selectedFlight.departure?.airport || prev.from,
      to: selectedFlight.arrival?.airport || prev.to,
      departureDateTime: selectedFlight.departure?.scheduledForInput || prev.departureDateTime,
      arrivalDateTime: selectedFlight.arrival?.scheduledForInput || prev.arrivalDateTime
    }))
    
    setFlightInfoFetched(true)
    setFlightInfoMessage('Flight details auto-populated successfully! Please verify the information matches your booking.')
    setShowFlightSelection(false)
    setMultipleFlights([])
    console.log('✅ Selected flight auto-populated from API')
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    
    // Reset flight info fetched state if user changes flight number or departure date
    if (name === 'flightNumber' || name === 'departureDateTime') {
      setFlightInfoFetched(false)
      setFlightInfoMessage('')
    }
    
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

      const response = await fetch(`${API_BASE}/flights/public`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(submissionData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create flight')
      }
      
      setSuccess(true)
      
      // Reset form after 3 seconds
      setTimeout(() => {
        setFormData({
          airline: '',
          flightNumber: '',
          from: '',
          to: '',
          departureDateTime: '',
          arrivalDateTime: '',
          notes: ''
        })
        setPassengers([])
        setSuccess(false)
      }, 3000)
      
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
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '2rem 1rem' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
          <h1 style={{ 
            fontSize: '2.5rem', 
            fontWeight: '600', 
            color: '#1e40af',
            margin: '0 0 0.5rem 0'
          }}>
            ✈️ West Sant Transportation - Add Flight
          </h1>
          <p style={{ color: '#6b7280', fontSize: '1.125rem' }}>
            Enter flight number and departure date to auto-populate flight details, then add passenger information
          </p>
          
          {/* Instructions */}
          <div style={{
            background: '#f0f9ff',
            border: '1px solid #0ea5e9',
            borderRadius: '0.5rem',
            padding: '1rem',
            marginTop: '1rem',
            fontSize: '0.875rem',
            color: '#075985'
          }}>
            <h4 style={{ fontSize: '1rem', fontWeight: '600', margin: '0 0 0.5rem 0', color: '#0c4a6e' }}>
              📋 How to Use This Form:
            </h4>
            <ol style={{ margin: '0', paddingLeft: '1.25rem' }}>
              <li style={{ marginBottom: '0.25rem' }}><strong>Enter your flight number</strong> (e.g., AA123, UA456)</li>
              <li style={{ marginBottom: '0.25rem' }}><strong>Select your departure date and time</strong></li>
              <li style={{ marginBottom: '0.25rem' }}><strong>Wait for auto-population</strong> - Flight details will be filled automatically</li>
              <li style={{ marginBottom: '0.25rem' }}><strong>Verify the information</strong> matches your booking confirmation</li>
              <li><strong>Add passenger names</strong> and submit</li>
            </ol>
          </div>
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
            ✅ Flight added successfully! Form will reset in 3 seconds...
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
                  transition: 'all 0.2s',
                  ':hover': { backgroundColor: '#f8fafc' }
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
          padding: '2rem'
        }}>
          <form onSubmit={handleSubmit}>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
              gap: '1.5rem',
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
                  getOptionValue={(option) => option.name}
                  getOptionLabel={(option) => option.name}
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
                  placeholder="e.g., AA123, UA456"
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
                      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{airport.city}, {airport.country}</div>
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
                      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{airport.city}, {airport.country}</div>
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
                {flightInfoFetched || (formData.departureDateTime && formData.departureDateTime.includes('T')) ? (
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
                ) : (
                  <input
                    type="date"
                    name="departureDateTime"
                    value={formData.departureDateTime ? formData.departureDateTime.split('T')[0] : ''}
                    onChange={(e) => {
                      const dateValue = e.target.value;
                      if (dateValue) {
                        // Set just the date part, don't auto-fill time
                        setFormData(prev => ({
                          ...prev,
                          departureDateTime: dateValue
                        }));
                      }
                    }}
                    style={{ 
                      width: '100%',
                      padding: '0.75rem',
                      border: `1px solid ${errors.departureDateTime ? '#dc2626' : '#d1d5db'}`,
                      borderRadius: '0.375rem',
                      fontSize: '0.875rem'
                    }}
                    placeholder="Select departure date"
                  />
                )}
                {errors.departureDateTime && (
                  <span style={{ color: '#dc2626', fontSize: '0.75rem' }}>{errors.departureDateTime}</span>
                )}
                {!flightInfoFetched && formData.departureDateTime && !formData.departureDateTime.includes('T') && (
                  <div style={{ 
                    fontSize: '0.75rem', 
                    color: '#6b7280', 
                    marginTop: '0.25rem' 
                  }}>
                    💡 Time will be auto-populated after flight lookup
                  </div>
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
                {flightInfoFetched || formData.arrivalDateTime ? (
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
                ) : (
                  <div style={{ 
                    width: '100%',
                    padding: '0.75rem',
                    border: `1px solid ${errors.arrivalDateTime ? '#dc2626' : '#d1d5db'}`,
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                    backgroundColor: '#f9fafb',
                    color: '#6b7280',
                    display: 'flex',
                    alignItems: 'center'
                  }}>
                    Will be auto-populated after flight lookup
                  </div>
                )}
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

        {/* Telegram Bot Information */}
        <div style={{
          background: '#f0f9ff',
          border: '1px solid #0ea5e9',
          borderRadius: '0.5rem',
          padding: '1.5rem',
          marginTop: '2rem'
        }}>
          <h3 style={{ 
            fontSize: '1.25rem', 
            fontWeight: '600', 
            color: '#0c4a6e', 
            margin: '0 0 1rem 0',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            🤖 Get Flight Updates via Telegram
          </h3>
          
          <div style={{ fontSize: '0.875rem', color: '#075985', lineHeight: '1.6' }}>
            <p style={{ marginBottom: '1rem' }}>
              <strong>Want to receive automatic flight notifications?</strong> Join our Telegram bot to get instant updates about your flights!
            </p>
            
            <div style={{ 
              background: 'white', 
              border: '1px solid #bae6fd',
              borderRadius: '0.375rem', 
              padding: '1rem',
              marginBottom: '1rem'
            }}>
              <h4 style={{ fontSize: '1rem', fontWeight: '600', margin: '0 0 0.5rem 0', color: '#0c4a6e' }}>
                📱 How to Register as a Passenger:
              </h4>
              <ol style={{ margin: '0', paddingLeft: '1.5rem', color: '#075985' }}>
                <li style={{ marginBottom: '0.5rem' }}>Search for our Telegram bot: <code style={{ background: '#e0f2fe', padding: '0.125rem 0.25rem', borderRadius: '0.25rem' }}>@WestSantTransportBot</code></li>
                <li style={{ marginBottom: '0.5rem' }}>Send the command: <code style={{ background: '#e0f2fe', padding: '0.125rem 0.25rem', borderRadius: '0.25rem' }}>/start</code></li>
                <li style={{ marginBottom: '0.5rem' }}>Register with: <code style={{ background: '#e0f2fe', padding: '0.125rem 0.25rem', borderRadius: '0.25rem' }}>/register_passenger Your Full Name</code></li>
                <li>Example: <code style={{ background: '#e0f2fe', padding: '0.125rem 0.25rem', borderRadius: '0.25rem' }}>/register_passenger Harinivas Swami</code></li>
              </ol>
            </div>
            
            <div style={{ fontSize: '0.8rem', color: '#0369a1', fontStyle: 'italic' }}>
              💡 <strong>Pro Tip:</strong> Use the exact same name you enter in the passenger list above to receive notifications for your flights!<br/>
              📱 <strong>You'll receive:</strong> Flight confirmations, changes/deletions, and 24-hour check-in reminders
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}