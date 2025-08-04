import React from 'react'
import { Edit, Trash2, Phone, Users } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { formatAirportDisplay } from '../utils'

export default function FlightCard({ flight, onEdit, onDelete, currentUser }) {
  const formatDateTime = (dateTime) => {
    try {
      return format(parseISO(dateTime), 'MMM d, yyyy h:mm a')
    } catch {
      return dateTime
    }
  }

  const formatDateTimeWithTimezone = (dateTime, localTime, timezone) => {
    // If we have converted local time with timezone, use that
    if (localTime && timezone) {
      try {
        // Parse the local time (format: "2025-08-05 14:04:00")
        const [datePart, timePart] = localTime.split(' ');
        const [year, month, day] = datePart.split('-');
        const [hour, minute] = timePart.split(':');
        
        // Create a date object from the local time components
        const localDate = new Date(year, month - 1, day, hour, minute);
        const formatted = format(localDate, 'MMM d, yyyy h:mm a');
        return `${formatted} ${timezone}`;
      } catch (error) {
        console.error('Error formatting local time:', error);
        // Fallback to original time
        return formatDateTime(dateTime);
      }
    }
    
    // Fallback to original time formatting
    return formatDateTime(dateTime);
  }

  return (
    <div className="flight-card">
      <div className="flight-header">
        <div>
          <div className="flight-route">
            {formatAirportDisplay(flight.from)} → {formatAirportDisplay(flight.to)}
          </div>
          <div className="flight-details">
            {flight.airline} {flight.flightNumber}
          </div>
        </div>
        <div className="flight-actions">
          <button 
            className="btn btn-secondary"
            onClick={() => onEdit(flight)}
            title="Edit flight"
          >
            <Edit size={16} />
          </button>
          <button 
            className="btn btn-danger"
            onClick={() => onDelete(flight.id)}
            title="Delete flight"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="flight-times">
        <div className="time-info">
          <div className="time-label">Departure</div>
          <div className="time-value">
            {formatDateTimeWithTimezone(
              flight.departureDateTime, 
              flight.departureLocalTime, 
              flight.departureTimezone
            )}
          </div>
        </div>
        <div className="time-info">
          <div className="time-label">Arrival</div>
          <div className="time-value">
            {formatDateTimeWithTimezone(
              flight.arrivalDateTime, 
              flight.arrivalLocalTime, 
              flight.arrivalTimezone
            )}
          </div>
        </div>
      </div>

      {(flight.pickupSevakName || flight.dropoffSevakName) && (
        <div className="volunteer-info">
          {flight.dropoffSevakName && (
            <div className="volunteer-card">
              <div className="volunteer-type">Drop-off Volunteer</div>
              <div className="volunteer-name">{flight.dropoffSevakName}</div>
              {flight.dropoffSevakPhone && (
                <div className="volunteer-phone">
                  <Phone size={12} style={{ display: 'inline', marginRight: '0.25rem' }} />
                  {flight.dropoffSevakPhone}
                </div>
              )}
              {(flight.createdByName || flight.createdBy || flight.updatedByName || flight.updatedBy) && (
                <div style={{ 
                  fontSize: '0.7rem', 
                  color: '#6b7280', 
                  marginTop: '0.25rem',
                  fontStyle: 'italic'
                }}>
                  {(flight.createdByName || flight.createdBy) && `Assigned by: ${flight.createdByName || flight.createdBy}`}
                  {(flight.updatedByName || flight.updatedBy) && (flight.updatedByName || flight.updatedBy) !== (flight.createdByName || flight.createdBy) && (
                    <div>Last updated by: {flight.updatedByName || flight.updatedBy}</div>
                  )}
                </div>
              )}
            </div>
          )}
          {flight.pickupSevakName && (
            <div className="volunteer-card">
              <div className="volunteer-type">Pickup Volunteer</div>
              <div className="volunteer-name">{flight.pickupSevakName}</div>
              {flight.pickupSevakPhone && (
                <div className="volunteer-phone">
                  <Phone size={12} style={{ display: 'inline', marginRight: '0.25rem' }} />
                  {flight.pickupSevakPhone}
                </div>
              )}
              {(flight.createdByName || flight.createdBy || flight.updatedByName || flight.updatedBy) && (
                <div style={{ 
                  fontSize: '0.7rem', 
                  color: '#6b7280', 
                  marginTop: '0.25rem',
                  fontStyle: 'italic'
                }}>
                  {(flight.createdByName || flight.createdBy) && `Assigned by: ${flight.createdByName || flight.createdBy}`}
                  {(flight.updatedByName || flight.updatedBy) && (flight.updatedByName || flight.updatedBy) !== (flight.createdByName || flight.createdBy) && (
                    <div>Last updated by: {flight.updatedByName || flight.updatedBy}</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {flight.passengers && flight.passengers.length > 0 && (
        <div style={{ 
          padding: '0.75rem', 
          background: '#f0f9ff', 
          borderRadius: '0.375rem', 
          borderLeft: '4px solid #0ea5e9',
          marginBottom: '1rem'
        }}>
          <div style={{ 
            fontSize: '0.75rem', 
            fontWeight: '500', 
            color: '#0c4a6e', 
            textTransform: 'uppercase', 
            marginBottom: '0.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem'
          }}>
            <Users size={12} />
            Passengers ({flight.passengers.length})
          </div>
          <div style={{ 
            display: 'flex', 
            flexWrap: 'wrap', 
            gap: '0.5rem' 
          }}>
            {flight.passengers.slice(0, 5).map((passenger, index) => (
              <span 
                key={passenger.id || index}
                style={{
                  fontSize: '0.875rem',
                  color: '#075985',
                  background: '#e0f2fe',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '0.25rem',
                  border: '1px solid #bae6fd'
                }}
              >
                {passenger.name}
              </span>
            ))}
            {flight.passengers.length > 5 && (
              <span style={{
                fontSize: '0.875rem',
                color: '#0c4a6e',
                fontStyle: 'italic'
              }}>
                +{flight.passengers.length - 5} more
              </span>
            )}
          </div>
        </div>
      )}

      {flight.notes && (
        <div className="notes">
          <div className="notes-label">Notes</div>
          <div className="notes-text">{flight.notes}</div>
        </div>
      )}

      {(flight.createdByName || flight.createdBy || flight.updatedByName || flight.updatedBy) && (
        <div style={{ 
          padding: '0.5rem', 
          background: '#f8f9fa', 
          borderRadius: '0.25rem', 
          marginTop: '0.5rem',
          fontSize: '0.75rem',
          color: '#6b7280'
        }}>
          {(flight.createdByName || flight.createdBy) && (
            <div>Created by: {flight.createdByName || flight.createdBy}</div>
          )}
          {(flight.updatedByName || flight.updatedBy) && (flight.updatedByName || flight.updatedBy) !== (flight.createdByName || flight.createdBy) && (
            <div>Last updated by: {flight.updatedByName || flight.updatedBy}</div>
          )}
        </div>
      )}
    </div>
  )
}