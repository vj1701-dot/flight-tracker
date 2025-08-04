import React from 'react'
import { Filter } from 'lucide-react'

export default function Filters({ filters, onFiltersChange }) {
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
        <h3>
          <Filter size={20} style={{ display: 'inline', marginRight: '0.5rem' }} />
          Filters
        </h3>
        {hasActiveFilters && (
          <button 
            className="btn btn-secondary"
            onClick={clearFilters}
            style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
          >
            Clear All
          </button>
        )}
      </div>
      
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
    </div>
  )
}