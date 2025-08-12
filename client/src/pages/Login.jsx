import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plane, User, Lock, Eye, EyeOff } from 'lucide-react'

const API_BASE = '/api'

export default function Login() {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleChange = (e) => {
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

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.username.trim()) {
      setErrors({ username: 'Username is required' })
      return
    }
    if (!formData.password) {
      setErrors({ password: 'Password is required' })
      return
    }

    setLoading(true)
    setErrors({})

    try {
      const response = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Login failed')
      }

      // Store token and user info
      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))

      // Redirect to dashboard
      navigate('/')
      
    } catch (error) {
      setErrors({ submit: error.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '1rem'
    }}>
      <div style={{ 
        background: 'white', 
        borderRadius: '1rem', 
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)',
        padding: '3rem',
        width: '100%',
        maxWidth: '400px'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            width: '80px',
            height: '80px',
            background: 'linear-gradient(135deg, #3b82f6, #1e40af)',
            borderRadius: '50%',
            marginBottom: '1rem'
          }}>
            <Plane size={40} style={{ color: 'white' }} />
          </div>
          <h1 style={{ 
            fontSize: '2rem', 
            fontWeight: '700', 
            color: '#1e40af',
            margin: '0 0 0.5rem 0'
          }}>
            West Sant Transportation
          </h1>
          <p style={{ color: '#6b7280', fontSize: '1rem' }}>
            Sign in to manage flights
          </p>
        </div>

        {errors.submit && (
          <div style={{
            background: '#fee2e2',
            color: '#991b1b',
            padding: '0.75rem',
            borderRadius: '0.5rem',
            marginBottom: '1.5rem',
            fontSize: '0.875rem',
            textAlign: 'center'
          }}>
            {errors.submit}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ 
              display: 'block', 
              fontSize: '0.875rem', 
              fontWeight: '500', 
              color: '#374151',
              marginBottom: '0.5rem'
            }}>
              Username
            </label>
            <div style={{ position: 'relative' }}>
              <User 
                size={20} 
                style={{ 
                  position: 'absolute', 
                  left: '0.75rem', 
                  top: '50%', 
                  transform: 'translateY(-50%)',
                  color: '#9ca3af'
                }} 
              />
              <input
                type="text"
                name="username"
                placeholder="Enter your username"
                value={formData.username}
                onChange={handleChange}
                autoComplete="username"
                style={{ 
                  width: '100%',
                  padding: '0.75rem 0.75rem 0.75rem 3rem',
                  border: `2px solid ${errors.username ? '#dc2626' : '#e5e7eb'}`,
                  borderRadius: '0.5rem',
                  fontSize: '1rem',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.target.style.borderColor = errors.username ? '#dc2626' : '#e5e7eb'}
              />
            </div>
            {errors.username && (
              <span style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                {errors.username}
              </span>
            )}
          </div>

          <div style={{ marginBottom: '2rem' }}>
            <label style={{ 
              display: 'block', 
              fontSize: '0.875rem', 
              fontWeight: '500', 
              color: '#374151',
              marginBottom: '0.5rem'
            }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock 
                size={20} 
                style={{ 
                  position: 'absolute', 
                  left: '0.75rem', 
                  top: '50%', 
                  transform: 'translateY(-50%)',
                  color: '#9ca3af'
                }} 
              />
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                placeholder="Enter your password"
                value={formData.password}
                onChange={handleChange}
                autoComplete="current-password"
                style={{ 
                  width: '100%',
                  padding: '0.75rem 3rem 0.75rem 3rem',
                  border: `2px solid ${errors.password ? '#dc2626' : '#e5e7eb'}`,
                  borderRadius: '0.5rem',
                  fontSize: '1rem',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.target.style.borderColor = errors.password ? '#dc2626' : '#e5e7eb'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#9ca3af'
                }}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {errors.password && (
              <span style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                {errors.password}
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.875rem',
              background: loading ? '#9ca3af' : 'linear-gradient(135deg, #3b82f6, #1e40af)',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
            }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

      </div>
    </div>
  )
}