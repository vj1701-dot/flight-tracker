import React, { useState, useEffect } from 'react'
import { X, Plus, Minus, Users } from 'lucide-react'
import { formatPhoneNumber } from '../utils'
import PassengerAutocomplete from './PassengerAutocomplete'
import SearchableSelect from './SearchableSelect'
import VolunteerAutocomplete from './VolunteerAutocomplete'

export default function FlightModal({ flight, onSave, onClose, currentUser }) {
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
  const [loadingData, setLoadingData] = useState(true)

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
          
          // Don't filter airports in dropdown - users need to see all airports
          // Validation will ensure at least one airport is in their allowed list
          setAirports(airportsData)
        }
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setLoadingData(false)
      }
    }
    
    fetchData()
  }, [currentUser])

  useEffect(() => {
    if (flight) {
      setFormData({
        airline: flight.airline || '',
        flightNumber: flight.flightNumber || '',
        from: flight.from || '',
        to: flight.to || '',
        departureDateTime: flight.departureDateTime ? 
          new Date(flight.departureDateTime).toISOString().slice(0, 16) : '',
        arrivalDateTime: flight.arrivalDateTime ? 
          new Date(flight.arrivalDateTime).toISOString().slice(0, 16) : '',
        pickupVolunteerName: flight.pickupSevakName || '',
        pickupVolunteerPhone: flight.pickupSevakPhone || '',
        dropoffVolunteerName: flight.dropoffSevakName || '',
        dropoffVolunteerPhone: flight.dropoffSevakPhone || '',
        notes: flight.notes || ''
      })
      
      if (flight.passengers && flight.passengers.length > 0) {
        setPassengers(flight.passengers.map(p => ({ 
          id: p.id || Date.now() + Math.random(), 
          name: p.name || '' 
        })))
      } else {
        setPassengers([{ id: Date.now(), name: '' }])
      }
    } else {
      setPassengers([{ id: Date.now(), name: '' }])
    }
  }, [flight])

  const handleChange = (e) => {
    const { name, value } = e.target
    let formattedValue = value
    
    // Format phone number fields
    if (name === 'pickupVolunteerPhone' || name === 'dropoffVolunteerPhone') {
      formattedValue = formatPhoneNumber(value)
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

    // Validate flight route permissions - must have at least one assigned airport
    if (currentUser && currentUser.allowedAirports && currentUser.allowedAirports.length > 0) {
      if (formData.from && formData.to) {
        const hasFromAccess = currentUser.allowedAirports.includes(formData.from)
        const hasToAccess = currentUser.allowedAirports.includes(formData.to)
        
        if (!hasFromAccess && !hasToAccess) {
          newErrors.from = `You can only create flights that are inbound or outbound to your assigned airports (${currentUser.allowedAirports.join(', ')})`
          newErrors.to = `You can only create flights that are inbound or outbound to your assigned airports (${currentUser.allowedAirports.join(', ')})`
        }
      }
      
      // Validate volunteer assignment permissions
      // Drop-off volunteer validation (departure airport)
      if (formData.dropoffVolunteerName.trim() && formData.from && !currentUser.allowedAirports.includes(formData.from)) {
        newErrors.dropoffVolunteerName = `You cannot assign drop-off volunteer for ${formData.from} - no access to this airport`
      }
      
      // Pickup volunteer validation (arrival airport)  
      if (formData.pickupVolunteerName.trim() && formData.to && !currentUser.allowedAirports.includes(formData.to)) {
        newErrors.pickupVolunteerName = `You cannot assign pickup volunteer for ${formData.to} - no access to this airport`
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

    try {
      await onSave(submissionData)
      // Modal should close automatically from parent component after successful save
    } catch (error) {
      console.error('Error saving flight:', error)
      // Error handling is done in parent component
    }
  }

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div className="modal" onClick={handleBackdropClick}>
      <div className="modal-content">
        <div className="modal-header">
          <h2>{flight ? 'Edit Flight' : 'Add New Flight'}</h2>
          <button 
            onClick={onClose}
            style={{ 
              position: 'absolute', 
              right: '1rem', 
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0.5rem',
              borderRadius: '0.375rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            aria-label="Close modal"
          >
            <X size={24} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* Show flight and sevak restrictions notice for limited users */}
            {currentUser && currentUser.allowedAirports && currentUser.allowedAirports.length > 0 && (
              <div style={{
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '0.375rem',
                padding: '0.75rem',
                marginBottom: '1rem',
                fontSize: '0.875rem',
                color: '#1e40af'
              }}>
                <strong>Airport Access:</strong> You can only create flights that are inbound or outbound to {currentUser.allowedAirports.join(', ')} airports. You can also only assign volunteers for these airports.
              </div>
            )}
            
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="airline">Airline *</label>
                <SearchableSelect
                  id="airline"
                  name="airline"
                  value={formData.airline}
                  onChange={handleChange}
                  options={airlines}
                  placeholder="Search airlines..."
                  error={errors.airline}
                  disabled={loadingData}
                  getOptionValue={(option) => option}
                  getOptionLabel={(option) => option}
                  renderOption={(option) => option}
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="flightNumber">Flight Number *</label>
                <input
                  id="flightNumber"
                  name="flightNumber"
                  type="text"
                  placeholder="e.g., AA123"
                  value={formData.flightNumber}
                  onChange={handleChange}
                  style={{ borderColor: errors.flightNumber ? '#dc2626' : undefined }}
                />
                {errors.flightNumber && <span style={{ color: '#dc2626', fontSize: '0.75rem' }}>{errors.flightNumber}</span>}
              </div>
              
              <div className="form-group">
                <label htmlFor="from">From *</label>
                <SearchableSelect
                  id="from"
                  name="from"
                  value={formData.from}
                  onChange={handleChange}
                  options={airports}
                  placeholder="Search departure airport..."
                  error={errors.from}
                  disabled={loadingData}
                  getOptionValue={(airport) => airport.code}
                  getOptionLabel={(airport) => airport.display || `${airport.code} - ${airport.name} (${airport.city}, ${airport.country})`}
                  renderOption={(airport) => (
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '0.875rem' }}>
                        {airport.display || `${airport.code} - ${airport.name}`}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                        {airport.name}
                      </div>
                    </div>
                  )}
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="to">To *</label>
                <SearchableSelect
                  id="to"
                  name="to"
                  value={formData.to}
                  onChange={handleChange}
                  options={airports}
                  placeholder="Search destination airport..."
                  error={errors.to}
                  disabled={loadingData}
                  getOptionValue={(airport) => airport.code}
                  getOptionLabel={(airport) => airport.display || `${airport.code} - ${airport.name} (${airport.city}, ${airport.country})`}
                  renderOption={(airport) => (
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '0.875rem' }}>
                        {airport.display || `${airport.code} - ${airport.name}`}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                        {airport.name}
                      </div>
                    </div>
                  )}
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="departureDateTime">Departure Date & Time *</label>
                <input
                  id="departureDateTime"
                  name="departureDateTime"
                  type="datetime-local"
                  value={formData.departureDateTime}
                  onChange={handleChange}
                  style={{ borderColor: errors.departureDateTime ? '#dc2626' : undefined }}
                />
                {errors.departureDateTime && <span style={{ color: '#dc2626', fontSize: '0.75rem' }}>{errors.departureDateTime}</span>}
              </div>
              
              <div className="form-group">
                <label htmlFor="arrivalDateTime">Arrival Date & Time *</label>
                <input
                  id="arrivalDateTime"
                  name="arrivalDateTime"
                  type="datetime-local"
                  value={formData.arrivalDateTime}
                  onChange={handleChange}
                  style={{ borderColor: errors.arrivalDateTime ? '#dc2626' : undefined }}
                />
                {errors.arrivalDateTime && <span style={{ color: '#dc2626', fontSize: '0.75rem' }}>{errors.arrivalDateTime}</span>}
              </div>
              
              <div className="form-group">
                <VolunteerAutocomplete
                  name="dropoffVolunteerName"
                  phoneName="dropoffVolunteerPhone"
                  value={formData.dropoffVolunteerName}
                  phoneValue={formData.dropoffVolunteerPhone}
                  onChange={handleChange}
                  onPhoneChange={handleChange}
                  label={`Drop-off Volunteer Name (at origin: ${formData.from || 'select origin'})${
                    currentUser && currentUser.allowedAirports && currentUser.allowedAirports.length > 0 && formData.from && !currentUser.allowedAirports.includes(formData.from) 
                      ? ' - No access to assign' : ''
                  }`}
                  placeholder={
                    currentUser && currentUser.allowedAirports && currentUser.allowedAirports.length > 0 && formData.from && !currentUser.allowedAirports.includes(formData.from)
                      ? `Cannot assign volunteer for ${formData.from}` 
                      : "Start typing volunteer name..."
                  }
                  disabled={currentUser && currentUser.allowedAirports && currentUser.allowedAirports.length > 0 && formData.from && !currentUser.allowedAirports.includes(formData.from)}
                  error={errors.dropoffVolunteerName}
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="dropoffVolunteerPhone">Drop-off Volunteer Phone (at origin)</label>
                <input
                  id="dropoffVolunteerPhone"
                  name="dropoffVolunteerPhone"
                  type="tel"
                  placeholder={
                    currentUser && currentUser.allowedAirports && currentUser.allowedAirports.length > 0 && formData.from && !currentUser.allowedAirports.includes(formData.from)
                      ? `Cannot assign volunteer for ${formData.from}` 
                      : "(555)-123-4567"
                  }
                  value={formData.dropoffVolunteerPhone}
                  onChange={handleChange}
                  disabled={currentUser && currentUser.allowedAirports && currentUser.allowedAirports.length > 0 && formData.from && !currentUser.allowedAirports.includes(formData.from)}
                  style={{
                    backgroundColor: currentUser && currentUser.allowedAirports && currentUser.allowedAirports.length > 0 && formData.from && !currentUser.allowedAirports.includes(formData.from) ? '#f9fafb' : undefined,
                    color: currentUser && currentUser.allowedAirports && currentUser.allowedAirports.length > 0 && formData.from && !currentUser.allowedAirports.includes(formData.from) ? '#6b7280' : undefined
                  }}
                />
              </div>

              <div className="form-group">
                <VolunteerAutocomplete
                  name="pickupVolunteerName"
                  phoneName="pickupVolunteerPhone"
                  value={formData.pickupVolunteerName}
                  phoneValue={formData.pickupVolunteerPhone}
                  onChange={handleChange}
                  onPhoneChange={handleChange}
                  label={`Pickup Volunteer Name (at destination: ${formData.to || 'select destination'})${
                    currentUser && currentUser.allowedAirports && currentUser.allowedAirports.length > 0 && formData.to && !currentUser.allowedAirports.includes(formData.to) 
                      ? ' - No access to assign' : ''
                  }`}
                  placeholder={
                    currentUser && currentUser.allowedAirports && currentUser.allowedAirports.length > 0 && formData.to && !currentUser.allowedAirports.includes(formData.to)
                      ? `Cannot assign volunteer for ${formData.to}` 
                      : "Start typing volunteer name..."
                  }
                  disabled={currentUser && currentUser.allowedAirports && currentUser.allowedAirports.length > 0 && formData.to && !currentUser.allowedAirports.includes(formData.to)}
                  error={errors.pickupVolunteerName}
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="pickupVolunteerPhone">Pickup Volunteer Phone (at destination)</label>
                <input
                  id="pickupVolunteerPhone"
                  name="pickupVolunteerPhone"
                  type="tel"
                  placeholder={
                    currentUser && currentUser.allowedAirports && currentUser.allowedAirports.length > 0 && formData.to && !currentUser.allowedAirports.includes(formData.to)
                      ? `Cannot assign volunteer for ${formData.to}` 
                      : "(555)-123-4567"
                  }
                  value={formData.pickupVolunteerPhone}
                  onChange={handleChange}
                  disabled={currentUser && currentUser.allowedAirports && currentUser.allowedAirports.length > 0 && formData.to && !currentUser.allowedAirports.includes(formData.to)}
                  style={{
                    backgroundColor: currentUser && currentUser.allowedAirports && currentUser.allowedAirports.length > 0 && formData.to && !currentUser.allowedAirports.includes(formData.to) ? '#f9fafb' : undefined,
                    color: currentUser && currentUser.allowedAirports && currentUser.allowedAirports.length > 0 && formData.to && !currentUser.allowedAirports.includes(formData.to) ? '#6b7280' : undefined
                  }}
                />
              </div>
              
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <PassengerAutocomplete 
                  passengers={passengers}
                  onChange={setPassengers}
                  errors={errors}
                />
              </div>
              
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label htmlFor="notes">Notes</label>
                <textarea
                  id="notes"
                  name="notes"
                  rows="3"
                  placeholder="Additional notes, special requirements, etc."
                  value={formData.notes}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                    resize: 'vertical'
                  }}
                />
              </div>
            </div>
          </div>
          
          <div className="modal-footer">
            <button type="submit" className="btn btn-primary">
              {flight ? 'Update Flight' : 'Add Flight'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}