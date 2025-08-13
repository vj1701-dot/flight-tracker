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
  const [uploadFiles, setUploadFiles] = useState([])
  const [uploadOperation, setUploadOperation] = useState(null)

  // Add keyframe animation for spinner
  React.useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, [])

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
        const contentType = response.headers.get('content-type')
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json()
          setBackups(data.backups || [])
        } else {
          throw new Error('Server returned non-JSON response')
        }
      } else {
        const contentType = response.headers.get('content-type')
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || `HTTP ${response.status}: Failed to fetch backups`)
        } else {
          throw new Error(`HTTP ${response.status}: Server error`)
        }
      }
    } catch (err) {
      console.error('Backup fetch error:', err)
      setError(err.message)
      setBackups([]) // Set empty array on error
    }
  }

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE}/backup/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
      if (response.ok) {
        const contentType = response.headers.get('content-type')
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json()
          setStats(data)
        } else {
          console.error('Expected JSON but received:', contentType)
          setStats({ error: 'Server returned invalid response format' })
        }
      } else {
        const contentType = response.headers.get('content-type')
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json().catch(() => ({}))
          console.error('Stats fetch failed:', errorData)
          setStats({ error: errorData.error || `HTTP ${response.status}: Failed to fetch stats` })
        } else {
          console.error('Stats fetch failed with non-JSON response')
          setStats({ error: `HTTP ${response.status}: Server error` })
        }
      }
    } catch (err) {
      console.error('Error fetching stats:', err)
      setStats({ error: err.message })
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

  const handleFileUpload = (event) => {
    const files = Array.from(event.target.files)
    setUploadFiles(files)
  }

  const uploadAndRestoreBackup = async () => {
    if (uploadFiles.length === 0) {
      setError('Please select backup files to upload')
      return
    }

    // Validate that we have the required files
    const requiredFiles = ['flights.json', 'users.json', 'passengers.json', 'volunteers.json']
    const uploadedFileNames = uploadFiles.map(f => f.name)
    const missingFiles = requiredFiles.filter(file => !uploadedFileNames.includes(file))
    
    if (missingFiles.length > 0) {
      if (!confirm(`Missing files: ${missingFiles.join(', ')}.\n\nDo you want to continue with partial restore? This may cause data inconsistencies.`)) {
        return
      }
    }

    if (!confirm(`Are you sure you want to restore from uploaded backup files?\n\nThis will overwrite all current data. A backup of current data will be created first.`)) {
      return
    }

    setUploadOperation('uploading')
    setError('')
    setSuccess('')
    
    try {
      const token = localStorage.getItem('token')
      const formData = new FormData()
      
      uploadFiles.forEach(file => {
        formData.append('backupFiles', file, file.name)
      })
      
      const response = await fetch(`${API_BASE}/backup/upload-restore`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}` 
        },
        body: formData
      })
      
      const data = await response.json()
      
      if (response.ok) {
        setSuccess('Backup files uploaded and restored successfully! Please refresh the page to see changes.')
        setUploadFiles([])
        fetchBackups()
        fetchStats()
      } else {
        throw new Error(data.error || 'Failed to upload and restore backup')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setUploadOperation(null)
    }
  }

  const formatBackupName = (backup) => {
    if (!backup || typeof backup !== 'string') {
      return { type: 'Unknown', date: 'Invalid backup name', operationType: 'unknown' }
    }
    
    // Handle new date-based structure: YYYY-MM-DD/auto-timestamp-operation or YYYY-MM-DD/manual-timestamp
    if (backup.includes('/')) {
      const [dateFolder, backupSubfolder] = backup.split('/')
      const parts = backupSubfolder.split('-')
      const type = parts[0] === 'auto' ? '🤖 Automatic' : '👤 Manual'
      
      // Extract operation type if available (for auto backups)
      let operationType = 'general'
      if (parts[0] === 'auto' && parts.length > 4) {
        operationType = parts.slice(4).join('-') // Everything after timestamp
      }
      
      // Use the date folder as the main date, with time from the backup subfolder
      const timestampParts = parts.slice(1, 4) // Get timestamp parts
      const timeStr = timestampParts.join('-').replace(/T/, ' ').replace(/Z$/, '')
      const dateStr = `${dateFolder} ${timeStr}`
      
      return { 
        type, 
        date: dateStr,
        operationType,
        dateFolder,
        backupSubfolder
      }
    } else {
      // Handle legacy flat structure: auto-timestamp or manual-timestamp
      const parts = backup.split('-')
      const type = parts[0] === 'auto' ? '🤖 Automatic' : '👤 Manual'
      const dateStr = parts.slice(1).join('-').replace(/T/, ' ').replace(/Z$/, ' UTC')
      return { type, date: dateStr, operationType: 'legacy' }
    }
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
      {stats && !stats.error ? (
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
              <strong>Latest Backup:</strong> {stats.latestBackup !== 'None' ? (() => {
                const formatted = formatBackupName(stats.latestBackup);
                return `${formatted.date}${formatted.operationType && formatted.operationType !== 'general' && formatted.operationType !== 'legacy' ? ` (${formatted.operationType})` : ''}`;
              })() : 'None'}
            </div>
            <div>
              <strong>Storage:</strong> {stats.storageType}
            </div>
            <div>
              <strong>Bucket:</strong> {stats.bucketName}
            </div>
          </div>
        </div>
      ) : stats && stats.error ? (
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
          <div>
            <strong>Backup Service Error:</strong> {stats.error}
            <br />
            <small>Please check Google Cloud Storage credentials and bucket configuration.</small>
          </div>
        </div>
      ) : null}

      {/* Actions */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
        gap: '1.5rem',
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
              const backupId = backup.folder || backup;
              let displayName;
              
              if (backup.folder) {
                // New structure with manifest data
                const operationType = backup.operationType && backup.operationType !== 'general' 
                  ? ` (${backup.operationType})` 
                  : '';
                displayName = `${backup.type} - ${backup.created}${operationType} (${backup.filesCount} files)`;
              } else {
                // Legacy structure or fallback
                const formatted = formatBackupName(backup);
                const operationType = formatted.operationType && formatted.operationType !== 'general' && formatted.operationType !== 'legacy'
                  ? ` (${formatted.operationType})`
                  : '';
                displayName = `${formatted.type} - ${formatted.date}${operationType}`;
              }
              
              return (
                <option key={backupId} value={backupId}>
                  {displayName}
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

        {/* Upload Backup */}
        <div style={{
          background: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '0.5rem',
          padding: '1.5rem'
        }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem' }}>
            Upload & Restore
          </h3>
          <p style={{ color: '#6b7280', marginBottom: '1rem' }}>
            Upload backup files from your computer and restore data
          </p>
          
          <input
            type="file"
            multiple
            accept=".json"
            onChange={handleFileUpload}
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.375rem',
              marginBottom: '1rem',
              fontSize: '0.875rem'
            }}
          />
          
          {uploadFiles.length > 0 && (
            <div style={{
              background: '#f9fafb',
              border: '1px solid #e5e7eb',
              borderRadius: '0.375rem',
              padding: '0.75rem',
              marginBottom: '1rem'
            }}>
              <h4 style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem', color: '#374151' }}>
                Selected Files ({uploadFiles.length}):
              </h4>
              <ul style={{ 
                margin: 0, 
                padding: 0, 
                listStyle: 'none',
                fontSize: '0.75rem',
                color: '#6b7280'
              }}>
                {uploadFiles.map((file, index) => (
                  <li key={index} style={{ 
                    padding: '0.25rem 0',
                    borderBottom: index < uploadFiles.length - 1 ? '1px solid #f3f4f6' : 'none'
                  }}>
                    📄 {file.name} ({(file.size / 1024).toFixed(1)} KB)
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            onClick={uploadAndRestoreBackup}
            disabled={uploadOperation === 'uploading' || uploadFiles.length === 0}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.5rem',
              background: uploadOperation === 'uploading' || uploadFiles.length === 0 ? '#9ca3af' : '#dc2626',
              color: 'white',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: uploadOperation === 'uploading' || uploadFiles.length === 0 ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500',
              width: '100%',
              justifyContent: 'center'
            }}
          >
            {uploadOperation === 'uploading' ? (
              <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <Upload size={16} />
            )}
            {uploadOperation === 'uploading' ? 'Uploading...' : 'Upload & Restore'}
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
              const backupId = backup.folder || backup;
              let backupType, backupDate, operationType, fileCount, dateFolder;
              
              if (backup.folder) {
                // New structure with manifest data
                backupType = backup.type;
                backupDate = backup.created;
                operationType = backup.operationType;
                fileCount = backup.filesCount || 'Unknown';
                dateFolder = backup.dateFolder;
              } else {
                // Legacy structure or fallback
                const formatted = formatBackupName(backup);
                backupType = formatted.type;
                backupDate = formatted.date;
                operationType = formatted.operationType;
                fileCount = 'Unknown';
                dateFolder = formatted.dateFolder;
              }
              
              return (
                <div
                  key={backupId}
                  style={{
                    padding: '1rem 1.5rem',
                    borderBottom: index < backups.length - 1 ? '1px solid #f3f4f6' : 'none',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '500', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{ 
                        background: backupType === 'manual' ? '#10b981' : '#6366f1',
                        color: 'white',
                        padding: '0.125rem 0.5rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        textTransform: 'uppercase'
                      }}>
                        {backupType}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{fileCount} files</span>
                      {operationType && operationType !== 'general' && operationType !== 'legacy' && (
                        <span style={{
                          background: '#f3f4f6',
                          color: '#374151',
                          padding: '0.125rem 0.375rem',
                          borderRadius: '0.25rem',
                          fontSize: '0.625rem',
                          fontWeight: '500'
                        }}>
                          {operationType}
                        </span>
                      )}
                      {dateFolder && (
                        <span style={{
                          background: '#fef3c7',
                          color: '#92400e',
                          padding: '0.125rem 0.375rem',
                          borderRadius: '0.25rem',
                          fontSize: '0.625rem',
                          fontWeight: '500'
                        }}>
                          📅 {dateFolder}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                      {backupDate}
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedBackup(backupId)}
                    style={{
                      padding: '0.25rem 0.75rem',
                      background: selectedBackup === backupId ? '#3b82f6' : 'transparent',
                      color: selectedBackup === backupId ? 'white' : '#3b82f6',
                      border: '1px solid #3b82f6',
                      borderRadius: '0.25rem',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      minWidth: '80px'
                    }}
                  >
                    {selectedBackup === backupId ? 'Selected' : 'Select'}
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
          <li>Automatic backups are created after every data operation (flights, passengers, users, volunteers)</li>
          <li>Backups are organized by date in folders (YYYY-MM-DD format) in Google Cloud Storage</li>
          <li>Old backups are automatically deleted after 30 days</li>
          <li>Manual backups are preserved until manually deleted</li>
          <li>You can upload backup files from your computer to restore data</li>
          <li>Restoring a backup will create a backup of current data first</li>
          <li>All backup operations are logged in the audit trail</li>
          <li>Backup files include: flights.json, users.json, passengers.json, volunteers.json, audit_log.json</li>
        </ul>
      </div>
    </div>
  )
}