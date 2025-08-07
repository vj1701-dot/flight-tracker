import React, { useState, useEffect, useRef } from 'react'
import { ChevronDown, X } from 'lucide-react'

export default function SearchableSelect({ 
  value, 
  onChange, 
  options = [], 
  placeholder = "Search...",
  name,
  id,
  error,
  disabled = false,
  renderOption = (option) => option,
  getOptionValue = (option) => option,
  getOptionLabel = (option) => option
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filteredOptions, setFilteredOptions] = useState(options)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  
  const containerRef = useRef(null)
  const inputRef = useRef(null)
  const optionsRef = useRef(null)

  useEffect(() => {
    // Filter options based on search term
    const filtered = options.filter(option => {
      const label = getOptionLabel(option)
      return label && typeof label === 'string' && 
        label.toLowerCase().includes(searchTerm.toLowerCase())
    })
    setFilteredOptions(filtered)
    setSelectedIndex(-1)
  }, [searchTerm, options, getOptionLabel])

  useEffect(() => {
    // Set initial search term based on selected value
    if (value) {
      const selectedOption = options.find(option => getOptionValue(option) === value)
      if (selectedOption) {
        const label = getOptionLabel(selectedOption)
        setSearchTerm(label && typeof label === 'string' ? label : '')
      }
    } else {
      setSearchTerm('')
    }
  }, [value, options, getOptionValue, getOptionLabel])

  const handleInputChange = (e) => {
    setSearchTerm(e.target.value)
    if (!isOpen) {
      setIsOpen(true)
    }
  }

  const handleOptionClick = (option) => {
    const optionValue = getOptionValue(option)
    onChange({ target: { name, value: optionValue } })
    const label = getOptionLabel(option)
    setSearchTerm(label && typeof label === 'string' ? label : '')
    setIsOpen(false)
    setSelectedIndex(-1)
  }

  const handleInputFocus = () => {
    setIsOpen(true)
  }

  const handleInputBlur = (e) => {
    // Delay closing to allow option clicks
    setTimeout(() => {
      if (!containerRef.current?.contains(document.activeElement)) {
        setIsOpen(false)
        // Reset search term to selected value if no valid selection made
        if (value) {
          const selectedOption = options.find(option => getOptionValue(option) === value)
          if (selectedOption) {
            const label = getOptionLabel(selectedOption)
            setSearchTerm(label && typeof label === 'string' ? label : '')
          }
        } else {
          setSearchTerm('')
        }
      }
    }, 200)
  }

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown') {
        e.preventDefault()
        setIsOpen(true)
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => 
          prev < filteredOptions.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1)
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && filteredOptions[selectedIndex]) {
          handleOptionClick(filteredOptions[selectedIndex])
        } else if (filteredOptions.length === 1) {
          handleOptionClick(filteredOptions[0])
        }
        break
      case 'Escape':
        setIsOpen(false)
        setSelectedIndex(-1)
        inputRef.current?.blur()
        break
      default:
        break
    }
  }

  const clearSelection = () => {
    onChange({ target: { name, value: '' } })
    setSearchTerm('')
    setIsOpen(false)
    inputRef.current?.focus()
  }

  const displayValue = value ? (
    options.find(option => getOptionValue(option) === value) ? 
    (() => {
      const selectedOption = options.find(option => getOptionValue(option) === value)
      const label = getOptionLabel(selectedOption)
      return label && typeof label === 'string' ? label : value
    })() : value
  ) : ''

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <div style={{ position: 'relative' }}>
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={isOpen ? searchTerm : displayValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          style={{
            width: '100%',
            padding: '0.75rem 2.5rem 0.75rem 0.75rem',
            border: `1px solid ${error ? '#dc2626' : '#d1d5db'}`,
            borderRadius: '0.375rem',
            fontSize: '1rem',
            backgroundColor: disabled ? '#f9fafb' : 'white',
            cursor: disabled ? 'not-allowed' : 'text'
          }}
        />
        
        <div style={{
          position: 'absolute',
          right: '0.75rem',
          top: '50%',
          transform: 'translateY(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem'
        }}>
          {value && !disabled && (
            <button
              type="button"
              onClick={clearSelection}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#6b7280',
                display: 'flex',
                alignItems: 'center',
                padding: '0.25rem'
              }}
              tabIndex={-1}
            >
              <X size={16} />
            </button>
          )}
          <ChevronDown 
            size={20} 
            style={{ 
              color: '#6b7280',
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s'
            }} 
          />
        </div>
      </div>

      {isOpen && filteredOptions.length > 0 && (
        <div
          ref={optionsRef}
          style={{
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
          }}
        >
          {filteredOptions.map((option, index) => (
            <div
              key={getOptionValue(option)}
              onClick={() => handleOptionClick(option)}
              style={{
                padding: '0.75rem',
                cursor: 'pointer',
                borderBottom: index < filteredOptions.length - 1 ? '1px solid #e5e7eb' : 'none',
                backgroundColor: index === selectedIndex ? '#f3f4f6' : 
                               getOptionValue(option) === value ? '#e0f2fe' : 'white',
                color: getOptionValue(option) === value ? '#0369a1' : '#1f2937'
              }}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              {renderOption(option)}
            </div>
          ))}
        </div>
      )}

      {isOpen && filteredOptions.length === 0 && searchTerm && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: 'white',
            border: '1px solid #d1d5db',
            borderRadius: '0.375rem',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            zIndex: 1000,
            padding: '0.75rem',
            color: '#6b7280',
            textAlign: 'center'
          }}
        >
          No options found
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