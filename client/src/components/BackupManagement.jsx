import React, { useState, useEffect } from 'react'
import { Download, Upload, RefreshCw, Info, AlertTriangle, CheckCircle } from 'lucide-react'

const API_BASE = '/api'

export default function BackupManagement() {
  const [backups, setBackups] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [operation, setOperation] = useState(null) // 'creating', 'restoring'
  const [selectedBackup, setSelectedBackup] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    fetchBackups()
    fetchStats()
  }, [])

  const fetchBackups = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE}/backup/list`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
      if (response.ok) {
        const data = await response.json()
        setBackups(data.backups)
      } else {
        throw new Error('Failed to fetch backups')
      }
    } catch (err) {
      setError(err.message)
    }
  }

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE}/backup/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (err) {
      console.error('Error fetching stats:', err)
    } finally {
      setLoading(false)
    }
  }

  const createBackup = async () => {
    setOperation('creating')
    setError('')
    setSuccess('')
    
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE}/backup/create`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
      const data = await response.json()
      
      if (response.ok) {
        setSuccess(`Backup created successfully: ${data.backupFolder}`)
        fetchBackups()
        fetchStats()
      } else {
        throw new Error(data.error || 'Failed to create backup')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setOperation(null)
    }
  }

  const restoreBackup = async () => {
    if (!selectedBackup) {
      setError('Please select a backup to restore')
      return
    }

    if (!confirm(`Are you sure you want to restore backup "${selectedBackup}"?\n\nThis will overwrite all current data. A backup of current data will be created first.`)) {
      return
    }

    setOperation('restoring')
    setError('')
    setSuccess('')
    
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE}/backup/restore`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ backupFolder: selectedBackup })
      })
      
      const data = await response.json()
      
      if (response.ok) {
        setSuccess('Backup restored successfully! Please refresh the page to see changes.')
        fetchBackups()
        fetchStats()
      } else {
        throw new Error(data.error || 'Failed to restore backup')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setOperation(null)
    }
  }

  const formatBackupName = (backup) => {
    const parts = backup.split('-')
    const type = parts[0] === 'auto' ? '🤖 Automatic' : '👤 Manual'
    const dateStr = parts.slice(1).join('-').replace(/T/, ' ').replace(/Z$/, ' UTC')
    return { type, date: dateStr }
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <RefreshCw size={32} style={{ color: '#3b82f6', animation: 'spin 1s linear infinite' }} />
        <p>Loading backup information...</p>
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ 
          fontSize: '1.875rem', 
          fontWeight: '700', 
          color: '#1f2937',
          marginBottom: '0.5rem'
        }}>
          Backup Management
        </h2>
        <p style={{ color: '#6b7280' }}>
          Create and restore data backups stored securely in Google Cloud Storage
        </p>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div style={{
          background: '#fef2f2',
          border: '1px solid #fecaca',
          color: '#dc2626',
          padding: '1rem',
          borderRadius: '0.5rem',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <AlertTriangle size={20} />
          {error}
        </div>
      )}

      {success && (
        <div style={{
          background: '#f0fdf4',
          border: '1px solid #bbf7d0',
          color: '#16a34a',
          padding: '1rem',
          borderRadius: '0.5rem',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <CheckCircle size={20} />
          {success}
        </div>
      )}

      {/* Backup Statistics */}
      {stats && (
        <div style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '0.5rem',
          padding: '1.5rem',
          marginBottom: '2rem'
        }}>
          <h3 style={{ 
            fontSize: '1.125rem', 
            fontWeight: '600', 
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <Info size={20} />
            Backup Statistics
          </h3>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
            gap: '1rem' 
          }}>
            <div>
              <strong>Total Backups:</strong> {stats.totalBackups}
            </div>
            <div>
              <strong>Automatic:</strong> {stats.automaticBackups}
            </div>
            <div>
              <strong>Manual:</strong> {stats.manualBackups}
            </div>
            <div>
              <strong>Total Size:</strong> {stats.totalSizeMB} MB
            </div>
            <div>
              <strong>Latest Backup:</strong> {stats.latestBackup !== 'None' ? formatBackupName(stats.latestBackup).date : 'None'}
            </div>
            <div>
              <strong>Storage Bucket:</strong> {stats.bucketName}
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
        gap: '2rem',
        marginBottom: '2rem'
      }}>
        {/* Create Backup */}
        <div style={{
          background: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '0.5rem',
          padding: '1.5rem'
        }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem' }}>
            Create Backup
          </h3>
          <p style={{ color: '#6b7280', marginBottom: '1rem' }}>
            Create a manual backup of all application data
          </p>
          <button
            onClick={createBackup}
            disabled={operation === 'creating'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.5rem',
              background: operation === 'creating' ? '#9ca3af' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: operation === 'creating' ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500'
            }}
          >
            {operation === 'creating' ? (
              <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <Download size={16} />
            )}
            {operation === 'creating' ? 'Creating...' : 'Create Backup'}
          </button>
        </div>

        {/* Restore Backup */}
        <div style={{
          background: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '0.5rem',
          padding: '1.5rem'
        }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem' }}>
            Restore Backup
          </h3>
          <p style={{ color: '#6b7280', marginBottom: '1rem' }}>
            Restore data from a previous backup
          </p>
          
          <select
            value={selectedBackup}
            onChange={(e) => setSelectedBackup(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.375rem',
              marginBottom: '1rem'
            }}
          >
            <option value="">Select backup to restore</option>
            {backups.map(backup => {
              const { type, date } = formatBackupName(backup)
              return (
                <option key={backup} value={backup}>
                  {type} - {date}
                </option>
              )
            })}
          </select>

          <button
            onClick={restoreBackup}
            disabled={operation === 'restoring' || !selectedBackup}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.5rem',
              background: operation === 'restoring' || !selectedBackup ? '#9ca3af' : '#dc2626',
              color: 'white',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: operation === 'restoring' || !selectedBackup ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500'
            }}
          >
            {operation === 'restoring' ? (
              <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <Upload size={16} />
            )}
            {operation === 'restoring' ? 'Restoring...' : 'Restore Backup'}
          </button>
        </div>
      </div>

      {/* Backup List */}
      <div style={{
        background: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: '0.5rem',
        overflow: 'hidden'
      }}>
        <div style={{ 
          padding: '1rem 1.5rem', 
          borderBottom: '1px solid #e5e7eb',
          background: '#f9fafb'
        }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: '600', margin: 0 }}>
            Available Backups ({backups.length})
          </h3>
        </div>
        
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {backups.length === 0 ? (
            <div style={{ 
              padding: '2rem', 
              textAlign: 'center', 
              color: '#6b7280' 
            }}>
              No backups available. Create your first backup above.
            </div>
          ) : (
            backups.map((backup, index) => {
              const { type, date } = formatBackupName(backup)
              return (
                <div
                  key={backup}
                  style={{
                    padding: '1rem 1.5rem',
                    borderBottom: index < backups.length - 1 ? '1px solid #f3f4f6' : 'none',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: '500', marginBottom: '0.25rem' }}>
                      {type}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                      {date}
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedBackup(backup)}
                    style={{
                      padding: '0.25rem 0.75rem',
                      background: selectedBackup === backup ? '#3b82f6' : 'transparent',
                      color: selectedBackup === backup ? 'white' : '#3b82f6',
                      border: '1px solid #3b82f6',
                      borderRadius: '0.25rem',
                      cursor: 'pointer',
                      fontSize: '0.75rem'
                    }}
                  >
                    {selectedBackup === backup ? 'Selected' : 'Select'}
                  </button>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Important Notes */}
      <div style={{
        background: '#fffbeb',
        border: '1px solid #fcd34d',
        borderRadius: '0.5rem',
        padding: '1rem',
        marginTop: '2rem'
      }}>
        <h4 style={{ 
          fontSize: '1rem', 
          fontWeight: '600', 
          color: '#92400e',
          marginBottom: '0.5rem'
        }}>
          Important Notes:
        </h4>
        <ul style={{ color: '#92400e', fontSize: '0.875rem', margin: 0, paddingLeft: '1.5rem' }}>
          <li>Automatic backups are created every 24 hours in production</li>
          <li>Backups are stored securely in Google Cloud Storage</li>
          <li>Old automatic backups are automatically deleted after 90 days</li>
          <li>Manual backups are preserved until manually deleted</li>
          <li>Restoring a backup will create a backup of current data first</li>
          <li>All backup operations are logged in the audit trail</li>
        </ul>
      </div>
    </div>
  )
}