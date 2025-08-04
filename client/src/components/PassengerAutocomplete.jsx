import React, { useState, useEffect, useRef } from 'react'
import { User, Plus, X } from 'lucide-react'

const API_BASE = '/api'

export default function PassengerAutocomplete({ passengers, onChange, errors }) {
  const [suggestions, setSuggestions] = useState([])
  const [currentInput, setCurrentInput] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activeSuggestion, setActiveSuggestion] = useState(-1)
  const inputRef = useRef(null)
  const suggestionsRef = useRef(null)

  const searchPassengers = async (query) => {
    if (!query || query.length < 2) {
      setSuggestions([])
      return
    }

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE}/passengers/search?q=${encodeURIComponent(query)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
      if (response.ok) {
        const data = await response.json()
        setSuggestions(data)
      }
    } catch (error) {
      console.error('Error searching passengers:', error)
    }
  }

  const handleInputChange = (e) => {
    const value = e.target.value
    setCurrentInput(value)
    setShowSuggestions(true)
    setActiveSuggestion(-1)
    searchPassengers(value)
  }

  const handleSuggestionClick = (suggestion) => {
    addPassenger(suggestion.name)
    setCurrentInput('')
    setSuggestions([])
    setShowSuggestions(false)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e) => {
    if (!showSuggestions) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActiveSuggestion(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setActiveSuggestion(prev => prev > 0 ? prev - 1 : -1)
        break
      case 'Enter':
        e.preventDefault()
        if (activeSuggestion >= 0 && suggestions[activeSuggestion]) {
          handleSuggestionClick(suggestions[activeSuggestion])
        } else if (currentInput.trim()) {
          addPassenger(currentInput.trim())
          setCurrentInput('')
          setSuggestions([])
          setShowSuggestions(false)
        }
        break
      case 'Escape':
        setShowSuggestions(false)
        setActiveSuggestion(-1)
        break
      default:
        break
    }
  }

  const addPassenger = (name) => {
    if (!name.trim()) return
    
    const newPassenger = {
      id: Date.now() + Math.random(),
      name: name.trim()
    }
    
    const isDuplicate = passengers.some(p => 
      p.name.toLowerCase() === newPassenger.name.toLowerCase()
    )
    
    if (!isDuplicate) {
      onChange([...passengers, newPassenger])
    }
  }

  const removePassenger = (passengerId) => {
    onChange(passengers.filter(p => p.id !== passengerId))
  }

  const handleClickOutside = (e) => {
    if (suggestionsRef.current && !suggestionsRef.current.contains(e.target)) {
      setShowSuggestions(false)
      setActiveSuggestion(-1)
    }
  }

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div>
      <label style={{ 
        display: 'block', 
        fontSize: '0.875rem', 
        fontWeight: '500', 
        marginBottom: '0.5rem'
      }}>
        Passengers *
      </label>
      
      {/* Current passengers list */}
      {passengers.length > 0 && (
        <div style={{ 
          marginBottom: '0.75rem',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem'
        }}>
          {passengers.map(passenger => (
            <div
              key={passenger.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: '#e0f2fe',
                color: '#0369a1',
                padding: '0.5rem 0.75rem',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: '500'
              }}
            >
              <User size={14} />
              <span>{passenger.name}</span>
              <button
                type="button"
                onClick={() => removePassenger(passenger.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#0369a1',
                  cursor: 'pointer',
                  padding: '0.125rem',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input with autocomplete */}
      <div style={{ position: 'relative' }} ref={suggestionsRef}>
        <div style={{ position: 'relative' }}>
          <input
            ref={inputRef}
            type="text"
            placeholder="Start typing passenger name..."
            value={currentInput}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (suggestions.length > 0) {
                setShowSuggestions(true)
              }
            }}
            style={{
              width: '100%',
              padding: '0.75rem 3rem 0.75rem 0.75rem',
              border: `1px solid ${errors?.passengers ? '#dc2626' : '#d1d5db'}`,
              borderRadius: '0.375rem',
              fontSize: '0.875rem'
            }}
          />
          <button
            type="button"
            onClick={() => {
              if (currentInput.trim()) {
                addPassenger(currentInput.trim())
                setCurrentInput('')
                setSuggestions([])
                setShowSuggestions(false)
              }
            }}
            style={{
              position: 'absolute',
              right: '0.5rem',
              top: '50%',
              transform: 'translateY(-50%)',
              background: currentInput.trim() ? '#3b82f6' : '#9ca3af',
              color: 'white',
              border: 'none',
              borderRadius: '0.25rem',
              padding: '0.5rem',
              cursor: currentInput.trim() ? 'pointer' : 'default',
              display: 'flex',
              alignItems: 'center'
            }}
            disabled={!currentInput.trim()}
          >
            <Plus size={16} />
          </button>
        </div>

        {/* Suggestions dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: 'white',
            border: '1px solid #d1d5db',
            borderRadius: '0.375rem',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            zIndex: 1000,
            maxHeight: '200px',
            overflowY: 'auto'
          }}>
            {suggestions.map((suggestion, index) => (
              <div
                key={suggestion.id}
                onClick={() => handleSuggestionClick(suggestion)}
                style={{
                  padding: '0.75rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  borderBottom: index < suggestions.length - 1 ? '1px solid #e5e7eb' : 'none',
                  background: index === activeSuggestion ? '#f3f4f6' : 'white'
                }}
                onMouseEnter={() => setActiveSuggestion(index)}
              >
                <User size={16} style={{ color: '#6b7280' }} />
                <div>
                  <div style={{ fontWeight: '500', fontSize: '0.875rem' }}>
                    {suggestion.name}
                  </div>
                  {suggestion.flightCount > 0 && (
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                      {suggestion.flightCount} previous flights
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {errors?.passengers && (
        <span style={{ color: '#dc2626', fontSize: '0.75rem' }}>{errors.passengers}</span>
      )}
      
      <div style={{ 
        fontSize: '0.75rem', 
        color: '#6b7280', 
        marginTop: '0.5rem'
      }}>
        Type passenger name and press Enter or click + to add. Previous passengers will appear as suggestions.
      </div>
    </div>
  )
}