import React, { useState, useEffect } from 'react'
import { Bell, Play, Square, RefreshCw, Settings, AlertTriangle, CheckCircle } from 'lucide-react'

const API_BASE = '/api'

export default function FlightMonitoring() {
  const [monitoringStatus, setMonitoringStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [intervalMinutes, setIntervalMinutes] = useState(30)

  useEffect(() => {
    fetchMonitoringStatus()
    // Refresh status every 30 seconds
    const interval = setInterval(fetchMonitoringStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchMonitoringStatus = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE}/monitoring/status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
      if (response.ok) {
        const data = await response.json()
        setMonitoringStatus(data.data)
        setIntervalMinutes(data.data.checkIntervalMinutes)
      } else {
        throw new Error('Failed to fetch monitoring status')
      }
    } catch (err) {
      console.error('Error fetching monitoring status:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }


  const updateInterval = async () => {
    try {
      setError(null)
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE}/monitoring/interval`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ minutes: intervalMinutes })
      })
      
      if (response.ok) {
        await fetchMonitoringStatus()
      } else {
        throw new Error('Failed to update interval')
      }
    } catch (err) {
      setError(err.message)
    }
  }

  const checkNow = async () => {
    try {
      setError(null)
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE}/monitoring/check-now`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
      if (response.ok) {
        // Show success message
        setError('Manual flight check initiated - alerts will be sent if delays are detected')
      } else {
        throw new Error('Failed to initiate manual check')
      }
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <RefreshCw className="animate-spin" size={48} style={{ color: '#3b82f6', marginBottom: '1rem' }} />
        <h2>Loading monitoring status...</h2>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ 
          fontSize: '2rem', 
          fontWeight: '600', 
          color: '#1e40af',
          margin: '0 0 0.5rem 0',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem'
        }}>
          <Bell size={32} />
          Flight Delay Monitoring
        </h1>
        <p style={{ color: '#6b7280', fontSize: '1.125rem' }}>
          Fully automated system that monitors flights, sends 24-hour check-in reminders, and provides instant delay alerts
        </p>
      </div>

      {error && (
        <div style={{
          background: error.includes('initiated') ? '#d1fae5' : '#fee2e2',
          color: error.includes('initiated') ? '#065f46' : '#991b1b',
          padding: '1rem',
          borderRadius: '0.5rem',
          marginBottom: '2rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          {error.includes('initiated') ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
          {error}
        </div>
      )}

      <div style={{ 
        background: 'white', 
        borderRadius: '0.5rem', 
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        padding: '2rem',
        marginBottom: '2rem'
      }}>
        <h2 style={{ 
          fontSize: '1.5rem', 
          fontWeight: '600', 
          color: '#374151',
          marginBottom: '1.5rem'
        }}>
          Monitoring Status
        </h2>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '1.5rem',
          marginBottom: '2rem'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              background: '#dcfce7',
              marginBottom: '0.75rem'
            }}>
              <Play size={24} style={{ color: '#16a34a' }} />
            </div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: '600', margin: '0 0 0.25rem 0' }}>
              System Status
            </h3>
            <p style={{ 
              color: '#16a34a',
              fontWeight: '600',
              margin: 0
            }}>
              Always Active
            </p>
          </div>

          <div style={{ textAlign: 'center' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              background: '#dbeafe',
              marginBottom: '0.75rem'
            }}>
              <Settings size={24} style={{ color: '#3b82f6' }} />
            </div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: '600', margin: '0 0 0.25rem 0' }}>
              Check Interval
            </h3>
            <p style={{ color: '#6b7280', margin: 0 }}>
              Every {monitoringStatus?.checkIntervalMinutes} minutes
            </p>
          </div>

          <div style={{ textAlign: 'center' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              background: '#f3e8ff',
              marginBottom: '0.75rem'
            }}>
              <RefreshCw size={24} style={{ color: '#8b5cf6' }} />
            </div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: '600', margin: '0 0 0.25rem 0' }}>
              Auto-Check Frequency
            </h3>
            <p style={{ color: '#6b7280', margin: 0 }}>
              Every {monitoringStatus?.checkIntervalMinutes || 30} minutes
            </p>
          </div>
        </div>

        <div style={{
          background: '#f0f9ff',
          border: '1px solid #0ea5e9',
          borderRadius: '0.5rem',
          padding: '1.5rem',
          textAlign: 'center'
        }}>
          <h3 style={{ 
            fontSize: '1.125rem', 
            fontWeight: '600', 
            color: '#0c4a6e',
            margin: '0 0 0.75rem 0'
          }}>
            🚀 Fully Automated System
          </h3>
          <p style={{ color: '#075985', margin: '0 0 1rem 0', lineHeight: '1.6' }}>
            This monitoring system runs automatically without manual intervention. It sends check-in reminders 24 hours before departure and starts delay monitoring 6 hours before departure.
          </p>
          <button
            onClick={checkNow}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.5rem',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={20} />
            Manual Check Now
          </button>
        </div>
      </div>

      <div style={{ 
        background: 'white', 
        borderRadius: '0.5rem', 
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        padding: '2rem'
      }}>
        <h2 style={{ 
          fontSize: '1.5rem', 
          fontWeight: '600', 
          color: '#374151',
          marginBottom: '1.5rem'
        }}>
          Settings
        </h2>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ 
            display: 'block', 
            fontSize: '0.875rem', 
            fontWeight: '500', 
            color: '#374151',
            marginBottom: '0.5rem'
          }}>
            Check Interval (minutes)
          </label>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <input
              type="number"
              min="15"
              max="120"
              value={intervalMinutes}
              onChange={(e) => setIntervalMinutes(parseInt(e.target.value))}
              style={{
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem',
                fontSize: '1rem',
                width: '100px'
              }}
            />
            <button
              onClick={updateInterval}
              style={{
                padding: '0.75rem 1rem',
                background: '#f59e0b',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                fontSize: '0.875rem',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              Update
            </button>
          </div>
          <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.5rem' }}>
            Must be between 15 and 120 minutes
          </p>
        </div>

        <div style={{
          background: '#f9fafb',
          border: '1px solid #e5e7eb',
          borderRadius: '0.5rem',
          padding: '1rem'
        }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.5rem' }}>
            How it works:
          </h3>
          <ul style={{ margin: 0, paddingLeft: '1.5rem', color: '#6b7280' }}>
            <li>Sends 24-hour check-in reminders to passengers with airline-specific links</li>
            <li>Automatically starts delay monitoring each flight 6 hours before departure</li>
            <li>Checks FlightAware API for delays and status changes every 30 minutes</li>
            <li>Sends automatic Telegram alerts to passengers, volunteers, and dashboard users</li>
            <li>Alerts for delays greater than 15 minutes or significant status changes</li>
            <li>Respects FlightAware API rate limits (2-second delay between calls)</li>
            <li>Operates 24/7 without manual intervention</li>
          </ul>
        </div>
      </div>
    </div>
  )
}