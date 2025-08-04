import React, { useState, useEffect } from 'react'
import { User, Plus, Shield, MapPin, Trash2, Edit } from 'lucide-react'

const API_BASE = '/api'

export default function UserManagement() {
  const [users, setUsers] = useState([])
  const [airports, setAirports] = useState([])
  const [showAddUser, setShowAddUser] = useState(false)
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState(null)
  const [formData, setFormData] = useState({
    username: '',
    name: '',
    password: '',
    role: 'user',
    allowedAirports: [],
    telegramChatId: ''
  })
  const [editingUser, setEditingUser] = useState(null)
  const [errors, setErrors] = useState({})
  const [airportInput, setAirportInput] = useState('')
  const [filteredAirports, setFilteredAirports] = useState([])

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    setCurrentUser(user)
    fetchUsers()
    fetchAirports()
  }, [])

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE}/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (response.ok) {
        const data = await response.json()
        setUsers(data)
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchAirports = async () => {
    try {
      const response = await fetch(`${API_BASE}/airports`)
      if (response.ok) {
        const data = await response.json()
        setAirports(data)
      }
    } catch (error) {
      console.error('Error fetching airports:', error)
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }))
    }
  }

  const handleAirportToggle = (airportCode) => {
    setFormData(prev => ({
      ...prev,
      allowedAirports: prev.allowedAirports.includes(airportCode)
        ? prev.allowedAirports.filter(code => code !== airportCode)
        : [...prev.allowedAirports, airportCode]
    }))
  }

  const handleAirportInputChange = (e) => {
    const value = e.target.value.toLowerCase()
    setAirportInput(value)
    
    if (value.length >= 2) {
      const filtered = airports.filter(airport => 
        airport.code.toLowerCase().includes(value) ||
        airport.name.toLowerCase().includes(value) ||
        airport.city.toLowerCase().includes(value)
      ).slice(0, 10) // Limit to 10 results
      setFilteredAirports(filtered)
    } else {
      setFilteredAirports([])
    }
  }

  const addAirportFromInput = (airport) => {
    if (!formData.allowedAirports.includes(airport.code)) {
      setFormData(prev => ({
        ...prev,
        allowedAirports: [...prev.allowedAirports, airport.code]
      }))
    }
    setAirportInput('')
    setFilteredAirports([])
  }

  const removeAirport = (airportCode) => {
    setFormData(prev => ({
      ...prev,
      allowedAirports: prev.allowedAirports.filter(code => code !== airportCode)
    }))
  }

  const validateForm = () => {
    const newErrors = {}
    if (!formData.username.trim()) newErrors.username = 'Username is required'
    if (!formData.name.trim()) newErrors.name = 'Name is required'
    // Password is required for new users, optional for updates
    if (!editingUser && !formData.password.trim()) {
      newErrors.password = 'Password is required'
    }
    if (formData.role === 'user' && formData.allowedAirports.length === 0) {
      newErrors.allowedAirports = 'Users must have at least one allowed airport'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validateForm()) return

    try {
      const token = localStorage.getItem('token')
      const url = editingUser ? `${API_BASE}/users/${editingUser.id}` : `${API_BASE}/register`
      const method = editingUser ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...formData,
          allowedAirports: formData.role === 'user' ? formData.allowedAirports : []
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || `Failed to ${editingUser ? 'update' : 'create'} user`)
      }

      resetForm()
      fetchUsers()
    } catch (error) {
      setErrors({ submit: error.message })
    }
  }

  const resetForm = () => {
    setFormData({
      username: '',
      name: '',
      password: '',
      role: 'user',
      allowedAirports: [],
      telegramChatId: ''
    })
    setEditingUser(null)
    setShowAddUser(false)
    setErrors({})
    setAirportInput('')
    setFilteredAirports([])
  }

  const handleEditUser = (user) => {
    setFormData({
      username: user.username,
      name: user.name || '',
      password: '', // Don't show existing password
      role: user.role,
      allowedAirports: user.allowedAirports || [],
      telegramChatId: user.telegramChatId || ''
    })
    setEditingUser(user)
    setShowAddUser(true)
  }

  const handleDeleteUser = async (userId) => {
    if (!confirm('Are you sure you want to delete this user?')) return

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE}/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete user')
      }

      fetchUsers()
    } catch (error) {
      alert(`Error: ${error.message}`)
    }
  }

  const getRoleIcon = (role) => {
    switch (role) {
      case 'superadmin': return <Shield size={16} style={{ color: '#dc2626' }} />
      case 'admin': return <Shield size={16} style={{ color: '#ea580c' }} />
      default: return <User size={16} style={{ color: '#3b82f6' }} />
    }
  }

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'superadmin': return { background: '#fee2e2', color: '#dc2626' }
      case 'admin': return { background: '#fed7aa', color: '#ea580c' }
      default: return { background: '#dbeafe', color: '#3b82f6' }
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div>Loading users...</div>
      </div>
    )
  }

  return (
    <div style={{ padding: 'clamp(1rem, 3vw, 2rem)' }}>
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem'
        }}>
          <h2 style={{ fontSize: 'clamp(1.25rem, 3vw, 1.5rem)', fontWeight: '600', color: '#1e40af', margin: 0 }}>
            User Management
          </h2>
          <button
            onClick={() => setShowAddUser(true)}
            style={{
              padding: '0.75rem 1.5rem',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: '500',
              whiteSpace: 'nowrap'
            }}
          >
            <Plus size={16} />
            Add User
          </button>
        </div>
      </div>

      {showAddUser && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: '0.5rem',
            padding: '2rem',
            width: '90%',
            maxWidth: '600px',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.25rem', fontWeight: '600' }}>
              {editingUser ? 'Edit User' : 'Add New User'}
            </h3>

            {errors.submit && (
              <div style={{
                background: '#fee2e2',
                color: '#991b1b',
                padding: '0.75rem',
                borderRadius: '0.5rem',
                marginBottom: '1rem',
                fontSize: '0.875rem'
              }}>
                {errors.submit}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <label style={{ 
                    display: 'block', 
                    fontSize: '0.875rem', 
                    fontWeight: '500', 
                    marginBottom: '0.5rem'
                  }}>
                    Username *
                  </label>
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleInputChange}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: `1px solid ${errors.username ? '#dc2626' : '#d1d5db'}`,
                      borderRadius: '0.375rem',
                      fontSize: '0.875rem'
                    }}
                  />
                  {errors.username && (
                    <span style={{ color: '#dc2626', fontSize: '0.75rem' }}>{errors.username}</span>
                  )}
                </div>

                <div>
                  <label style={{ 
                    display: 'block', 
                    fontSize: '0.875rem', 
                    fontWeight: '500', 
                    marginBottom: '0.5rem'
                  }}>
                    Full Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Chirag Patel San Jose"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: `1px solid ${errors.name ? '#dc2626' : '#d1d5db'}`,
                      borderRadius: '0.375rem',
                      fontSize: '0.875rem'
                    }}
                  />
                  {errors.name && (
                    <span style={{ color: '#dc2626', fontSize: '0.75rem' }}>{errors.name}</span>
                  )}
                </div>


                <div>
                  <label style={{ 
                    display: 'block', 
                    fontSize: '0.875rem', 
                    fontWeight: '500', 
                    marginBottom: '0.5rem'
                  }}>
                    Password {editingUser ? '(leave blank to keep current)' : '*'}
                  </label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: `1px solid ${errors.password ? '#dc2626' : '#d1d5db'}`,
                      borderRadius: '0.375rem',
                      fontSize: '0.875rem'
                    }}
                  />
                  {errors.password && (
                    <span style={{ color: '#dc2626', fontSize: '0.75rem' }}>{errors.password}</span>
                  )}
                </div>

                <div>
                  <label style={{ 
                    display: 'block', 
                    fontSize: '0.875rem', 
                    fontWeight: '500', 
                    marginBottom: '0.5rem'
                  }}>
                    Role *
                  </label>
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleInputChange}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.375rem',
                      fontSize: '0.875rem'
                    }}
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                    {currentUser?.role === 'superadmin' && (
                      <option value="superadmin">Super Admin</option>
                    )}
                  </select>
                </div>

                {formData.role === 'user' && (
                  <div>
                    <label style={{ 
                      display: 'block', 
                      fontSize: '0.875rem', 
                      fontWeight: '500', 
                      marginBottom: '0.5rem'
                    }}>
                      Allowed Airports *
                    </label>
                    
                    {/* Airport Input */}
                    <div style={{ position: 'relative', marginBottom: '1rem' }}>
                      <input
                        type="text"
                        value={airportInput}
                        onChange={handleAirportInputChange}
                        placeholder="Enter IATA code or airport name (e.g., SJC, San Jose)"
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          border: '1px solid #d1d5db',
                          borderRadius: '0.375rem',
                          fontSize: '0.875rem'
                        }}
                      />
                      
                      {/* Dropdown with filtered airports */}
                      {filteredAirports.length > 0 && (
                        <div style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          background: 'white',
                          border: '1px solid #d1d5db',
                          borderRadius: '0.375rem',
                          maxHeight: '200px',
                          overflowY: 'auto',
                          zIndex: 10,
                          marginTop: '2px'
                        }}>
                          {filteredAirports.map(airport => (
                            <div
                              key={airport.code}
                              onClick={() => addAirportFromInput(airport)}
                              style={{
                                padding: '0.75rem',
                                cursor: 'pointer',
                                borderBottom: '1px solid #f3f4f6',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                              }}
                              onMouseEnter={(e) => e.target.style.background = '#f9fafb'}
                              onMouseLeave={(e) => e.target.style.background = 'white'}
                            >
                              <div>
                                <div style={{ fontWeight: '600', fontSize: '0.875rem' }}>
                                  {airport.code} - {airport.name}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                  {airport.city}, {airport.country}
                                </div>
                              </div>
                              {formData.allowedAirports.includes(airport.code) && (
                                <span style={{ color: '#16a34a', fontSize: '0.75rem' }}>✓ Added</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    {/* Selected Airports */}
                    {formData.allowedAirports.length > 0 && (
                      <div style={{
                        border: '1px solid #d1d5db',
                        borderRadius: '0.375rem',
                        padding: '0.75rem',
                        marginBottom: '0.5rem'
                      }}>
                        <div style={{ fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                          Selected Airports ({formData.allowedAirports.length}):
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                          {formData.allowedAirports.map(code => {
                            const airport = airports.find(a => a.code === code)
                            return (
                              <div
                                key={code}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.5rem',
                                  background: '#e0f2fe',
                                  color: '#0369a1',
                                  padding: '0.25rem 0.5rem',
                                  borderRadius: '0.375rem',
                                  fontSize: '0.75rem'
                                }}
                              >
                                <span>
                                  {code} {airport && `- ${airport.city}`}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => removeAirport(code)}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#dc2626',
                                    cursor: 'pointer',
                                    padding: '0',
                                    fontSize: '0.875rem',
                                    fontWeight: 'bold'
                                  }}
                                >
                                  ×
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                    
                    {errors.allowedAirports && (
                      <span style={{ color: '#dc2626', fontSize: '0.75rem' }}>{errors.allowedAirports}</span>
                    )}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={resetForm}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: '#6b7280',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.375rem',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.375rem',
                    cursor: 'pointer'
                  }}
                >
                  {editingUser ? 'Update User' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div style={{
        background: 'white',
        borderRadius: '0.5rem',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        overflow: 'hidden'
      }}>
        <div style={{ overflowX: 'auto', minWidth: '100%' }}>
          <table style={{ width: '100%', minWidth: '600px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#374151' }}>
                  Name
                </th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#374151' }}>
                  User Details
                </th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#374151' }}>
                  Role
                </th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#374151' }}>
                  Allowed Airports
                </th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#374151' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => {
                const canModifyUser = currentUser?.role === 'superadmin' || 
                  (currentUser?.role === 'admin' && user.role !== 'superadmin');
                
                return (
                  <tr key={user.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ fontWeight: '600', color: '#111827', fontSize: '1rem' }}>
                        {user.name || user.username}
                      </div>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <div>
                        <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>@{user.username}</div>
                        {user.telegramChatId && (
                          <div style={{ 
                            fontSize: '0.75rem', 
                            color: '#16a34a',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            marginTop: '0.25rem'
                          }}>
                            <span>📱</span> Telegram Connected
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: '500',
                        ...getRoleBadgeColor(user.role)
                      }}>
                        {getRoleIcon(user.role)}
                        {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                      </div>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      {user.allowedAirports.length === 0 ? (
                        <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>All airports</span>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                          {user.allowedAirports.slice(0, 3).map(code => (
                            <span
                              key={code}
                              style={{
                                background: '#e0f2fe',
                                color: '#0369a1',
                                padding: '0.125rem 0.5rem',
                                borderRadius: '0.25rem',
                                fontSize: '0.75rem',
                                fontWeight: '500'
                              }}
                            >
                              {code}
                            </span>
                          ))}
                          {user.allowedAirports.length > 3 && (
                            <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>
                              +{user.allowedAirports.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {canModifyUser && (
                          <>
                            <button
                              onClick={() => handleEditUser(user)}
                              style={{
                                padding: '0.25rem',
                                background: '#3b82f6',
                                color: 'white',
                                border: 'none',
                                borderRadius: '0.375rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center'
                              }}
                              title="Edit user"
                            >
                              <Edit size={14} />
                            </button>
                            {user.id !== currentUser?.id && (
                              <button
                                onClick={() => handleDeleteUser(user.id)}
                                style={{
                                  padding: '0.25rem',
                                  background: '#dc2626',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '0.375rem',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center'
                                }}
                                title="Delete user"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </>
                        )}
                        {!canModifyUser && (
                          <span style={{ color: '#9ca3af', fontSize: '0.75rem', fontStyle: 'italic' }}>
                            No access
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}