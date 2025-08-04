import React, { useState, useEffect, useRef } from 'react'
import { User } from 'lucide-react'

const API_BASE = '/api'

export default function VolunteerAutocomplete({ 
  value, 
  onChange, 
  phoneValue,
  onPhoneChange,
  name, 
  phoneName,
  placeholder = "Start typing volunteer name...",
  label,
  disabled = false,
  error 
}) {
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activeSuggestion, setActiveSuggestion] = useState(-1)
  const inputRef = useRef(null)
  const suggestionsRef = useRef(null)

  const searchVolunteers = async (query) => {
    if (!query || query.length < 2) {
      setSuggestions([])
      return
    }

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE}/volunteers/search?q=${encodeURIComponent(query)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
      if (response.ok) {
        const data = await response.json()
        setSuggestions(data)
      }
    } catch (error) {
      console.error('Error searching volunteers:', error)
    }
  }

  const handleInputChange = (e) => {
    const newValue = e.target.value
    onChange({ target: { name, value: newValue } })
    setShowSuggestions(true)
    setActiveSuggestion(-1)
    searchVolunteers(newValue)
  }

  const handleSuggestionClick = (suggestion) => {
    onChange({ target: { name, value: suggestion.name } })
    if (onPhoneChange && suggestion.phone) {
      onPhoneChange({ target: { name: phoneName, value: suggestion.phone } })
    }
    setShowSuggestions(false)
    setActiveSuggestion(-1)
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
    <div style={{ position: 'relative' }} ref={suggestionsRef}>
      <label htmlFor={name} style={{ 
        display: 'block', 
        fontSize: '0.875rem', 
        fontWeight: '500', 
        marginBottom: '0.5rem',
        color: disabled ? '#9ca3af' : '#374151'
      }}>
        {label}
      </label>
      
      <input
        ref={inputRef}
        id={name}
        name={name}
        type="text"
        placeholder={disabled ? "Cannot assign volunteer" : placeholder}
        value={value || ''}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (suggestions.length > 0 && !disabled) {
            setShowSuggestions(true)
          }
        }}
        disabled={disabled}
        style={{
          width: '100%',
          padding: '0.75rem',
          border: `1px solid ${error ? '#dc2626' : '#d1d5db'}`,
          borderRadius: '0.375rem',
          fontSize: '1rem',
          backgroundColor: disabled ? '#f9fafb' : 'white',
          color: disabled ? '#6b7280' : undefined
        }}
      />

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && !disabled && (
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
                backgroundColor: index === activeSuggestion ? '#f3f4f6' : 'white'
              }}
              onMouseEnter={() => setActiveSuggestion(index)}
            >
              <User size={16} style={{ color: '#6b7280' }} />
              <div>
                <div style={{ fontWeight: '500', fontSize: '0.875rem' }}>
                  {suggestion.name}
                </div>
                {suggestion.phone && (
                  <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                    {suggestion.phone}
                  </div>
                )}
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

      {error && (
        <span style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
          {error}
        </span>
      )}
    </div>
  )
}