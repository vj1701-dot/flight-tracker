import React, { useState, useEffect } from 'react'
import { Plane } from 'lucide-react'
import PassengerAutocomplete from '../components/PassengerAutocomplete'

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

  const handleChange = (e) => {
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


  const validateForm = () => {
    const newErrors = {}
    
    if (!formData.airline.trim()) newErrors.airline = 'Airline is required'
    if (!formData.flightNumber.trim()) newErrors.flightNumber = 'Flight number is required'
    if (!formData.from.trim()) newErrors.from = 'From location is required'
    if (!formData.to.trim()) newErrors.to = 'To location is required'
    if (!formData.departureDateTime) newErrors.departureDateTime = 'Departure time is required'
    if (!formData.arrivalDateTime) newErrors.arrivalDateTime = 'Arrival time is required'
    
    if (formData.departureDateTime && formData.arrivalDateTime) {
      if (new Date(formData.departureDateTime) >= new Date(formData.arrivalDateTime)) {
        newErrors.arrivalDateTime = 'Arrival time must be after departure time'
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
            ✅ Flight added successfully! Form will reset in 3 seconds...
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
                <select
                  name="airline"
                  value={formData.airline}
                  onChange={handleChange}
                  style={{ 
                    width: '100%',
                    padding: '0.75rem',
                    border: `1px solid ${errors.airline ? '#dc2626' : '#d1d5db'}`,
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem'
                  }}
                >
                  <option value="">Select an airline</option>
                  {airlines.map(airline => (
                    <option key={airline} value={airline}>{airline}</option>
                  ))}
                </select>
                {errors.airline && (
                  <span style={{ color: '#dc2626', fontSize: '0.75rem' }}>{errors.airline}</span>
                )}
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
                <select
                  name="from"
                  value={formData.from}
                  onChange={handleChange}
                  style={{ 
                    width: '100%',
                    padding: '0.75rem',
                    border: `1px solid ${errors.from ? '#dc2626' : '#d1d5db'}`,
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem'
                  }}
                >
                  <option value="">Select departure airport</option>
                  {airports.map(airport => (
                    <option key={airport.code} value={airport.code}>
                      {airport.code} - {airport.name} ({airport.city}, {airport.country})
                    </option>
                  ))}
                </select>
                {errors.from && (
                  <span style={{ color: '#dc2626', fontSize: '0.75rem' }}>{errors.from}</span>
                )}
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
                <select
                  name="to"
                  value={formData.to}
                  onChange={handleChange}
                  style={{ 
                    width: '100%',
                    padding: '0.75rem',
                    border: `1px solid ${errors.to ? '#dc2626' : '#d1d5db'}`,
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem'
                  }}
                >
                  <option value="">Select destination airport</option>
                  {airports.map(airport => (
                    <option key={airport.code} value={airport.code}>
                      {airport.code} - {airport.name} ({airport.city}, {airport.country})
                    </option>
                  ))}
                </select>
                {errors.to && (
                  <span style={{ color: '#dc2626', fontSize: '0.75rem' }}>{errors.to}</span>
                )}
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