import React, { useState } from 'react'
import { Filter, ChevronDown, ChevronUp } from 'lucide-react'

export default function Filters({ filters, onFiltersChange }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const handleFilterChange = (key, value) => {
    onFiltersChange(prev => ({
      ...prev,
      [key]: value
    }))
  }

  const clearFilters = () => {
    onFiltersChange({
      location: '',
      passengerName: '',
      dateFrom: '',
      dateTo: ''
    })
  }

  const hasActiveFilters = Object.values(filters).some(value => value !== '')

  return (
    <div className="filters">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          style={{
            background: 'none',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '1.125rem',
            fontWeight: '600',
            cursor: 'pointer',
            color: '#374151'
          }}
        >
          <Filter size={20} />
          Filters
          {hasActiveFilters && (
            <span style={{
              backgroundColor: '#3b82f6',
              color: 'white',
              borderRadius: '50%',
              width: '20px',
              height: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.75rem',
              marginLeft: '0.25rem'
            }}>
              {Object.values(filters).filter(value => value !== '').length}
            </span>
          )}
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        
        {hasActiveFilters && isExpanded && (
          <button 
            className="btn btn-secondary"
            onClick={clearFilters}
            style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
          >
            Clear All
          </button>
        )}
      </div>
      
      {isExpanded && (
        <div className="filter-grid">
        <div className="form-group">
          <label htmlFor="location">Location (From/To)</label>
          <input
            id="location"
            type="text"
            placeholder="e.g., SJC, JFK, LAX"
            value={filters.location}
            onChange={(e) => handleFilterChange('location', e.target.value)}
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="passengerName">Passenger Name</label>
          <input
            id="passengerName"
            type="text"
            placeholder="e.g., John Doe, Jane Smith"
            value={filters.passengerName}
            onChange={(e) => handleFilterChange('passengerName', e.target.value)}
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="dateFrom">From Date</label>
          <input
            id="dateFrom"
            type="date"
            value={filters.dateFrom}
            onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="dateTo">To Date</label>
          <input
            id="dateTo"
            type="date"
            value={filters.dateTo}
            onChange={(e) => handleFilterChange('dateTo', e.target.value)}
          />
        </div>
      </div>
      )}
    </div>
  )
}