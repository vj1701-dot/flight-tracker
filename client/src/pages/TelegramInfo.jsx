import React from 'react'
import { MessageCircle, Users, Shield, Bell, Clock, Phone, CheckCircle, AlertTriangle, Eye } from 'lucide-react'

export default function TelegramInfo() {
  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: 'clamp(1rem, 3vw, 2rem)' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{ marginBottom: 'clamp(2rem, 4vw, 3rem)', textAlign: 'center' }}>
          <h1 style={{ 
            fontSize: 'clamp(2rem, 5vw, 3rem)', 
            fontWeight: '700', 
            color: '#1e40af',
            margin: '0 0 1rem 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1rem',
            flexWrap: 'wrap'
          }}>
            🤖 Telegram Bot
          </h1>
          <p style={{ color: '#6b7280', fontSize: 'clamp(1rem, 2.5vw, 1.25rem)', maxWidth: '600px', margin: '0 auto', lineHeight: '1.6' }}>
            Get instant flight notifications, automatic delay alerts, and real-time access to your flight data through our intelligent Telegram bot with Google Sheets integration
          </p>
        </div>

        {/* Bot Capabilities */}
        <div style={{
          background: 'white',
          borderRadius: '0.75rem',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
          padding: 'clamp(1rem, 3vw, 2rem)',
          marginBottom: 'clamp(1.5rem, 3vw, 2rem)'
        }}>
          <h2 style={{ 
            fontSize: '1.75rem', 
            fontWeight: '600', 
            color: '#1e40af', 
            margin: '0 0 1.5rem 0',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <MessageCircle size={28} />
            Bot Capabilities
          </h2>
          
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
            gap: 'clamp(1rem, 2vw, 1.5rem)' 
          }}>
            {/* Passenger Features */}
            <div style={{
              background: '#f0f9ff',
              border: '1px solid #0ea5e9',
              borderRadius: '0.5rem',
              padding: '1.5rem'
            }}>
              <h3 style={{ 
                fontSize: '1.25rem', 
                fontWeight: '600', 
                color: '#0c4a6e', 
                margin: '0 0 1rem 0',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <Users size={20} />
                For Passengers
              </h3>
              <ul style={{ margin: '0', paddingLeft: '0', listStyle: 'none', color: '#075985' }}>
                <li style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckCircle size={16} style={{ color: '#059669' }} />
                  Flight confirmation notifications
                </li>
                <li style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckCircle size={16} style={{ color: '#059669' }} />
                  Flight changes and deletions
                </li>
                <li style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckCircle size={16} style={{ color: '#059669' }} />
                  24-hour check-in reminders
                </li>
                <li style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckCircle size={16} style={{ color: '#059669' }} />
                  Volunteer contact information
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckCircle size={16} style={{ color: '#059669' }} />
                  View your upcoming flights
                </li>
              </ul>
            </div>

            {/* Volunteer Features */}
            <div style={{
              background: '#fef3c7',
              border: '1px solid #f59e0b',
              borderRadius: '0.5rem',
              padding: '1.5rem'
            }}>
              <h3 style={{ 
                fontSize: '1.25rem', 
                fontWeight: '600', 
                color: '#92400e', 
                margin: '0 0 1rem 0',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <Shield size={20} />
                For Volunteers
              </h3>
              <ul style={{ margin: '0', paddingLeft: '0', listStyle: 'none', color: '#92400e' }}>
                <li style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckCircle size={16} style={{ color: '#059669' }} />
                  Drop-off: 6-hour & 3-hour reminders
                </li>
                <li style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckCircle size={16} style={{ color: '#059669' }} />
                  Pickup: 6-hour & 1-hour reminders
                </li>
                <li style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckCircle size={16} style={{ color: '#059669' }} />
                  Assignment notifications
                </li>
                <li style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckCircle size={16} style={{ color: '#059669' }} />
                  Automatic flight delay alerts
                </li>
                <li style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckCircle size={16} style={{ color: '#059669' }} />
                  Passenger contact details
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckCircle size={16} style={{ color: '#059669' }} />
                  View assigned flights
                </li>
              </ul>
            </div>

            {/* Dashboard User Features */}
            <div style={{
              background: '#f3e8ff',
              border: '1px solid #8b5cf6',
              borderRadius: '0.5rem',
              padding: '1.5rem'
            }}>
              <h3 style={{ 
                fontSize: '1.25rem', 
                fontWeight: '600', 
                color: '#6b21a8', 
                margin: '0 0 1rem 0',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <Eye size={20} />
                For Dashboard Users
              </h3>
              <ul style={{ margin: '0', paddingLeft: '0', listStyle: 'none', color: '#6b21a8' }}>
                <li style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckCircle size={16} style={{ color: '#059669' }} />
                  Airport-based flight notifications
                </li>
                <li style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckCircle size={16} style={{ color: '#059669' }} />
                  Automatic delay alerts for your airports
                </li>
                <li style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckCircle size={16} style={{ color: '#059669' }} />
                  System notifications and updates
                </li>
                <li style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckCircle size={16} style={{ color: '#059669' }} />
                  Flight additions and changes
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckCircle size={16} style={{ color: '#059669' }} />
                  Real-time flight status updates
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Registration Guide */}
        <div style={{
          background: 'white',
          borderRadius: '0.75rem',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
          padding: 'clamp(1rem, 3vw, 2rem)',
          marginBottom: 'clamp(1.5rem, 3vw, 2rem)'
        }}>
          <h2 style={{ 
            fontSize: '1.75rem', 
            fontWeight: '600', 
            color: '#1e40af', 
            margin: '0 0 1.5rem 0',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <Phone size={28} />
            How to Register
          </h2>
          
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
            gap: 'clamp(1rem, 2vw, 2rem)' 
          }}>
            {/* Passenger Registration */}
            <div>
              <h3 style={{ 
                fontSize: '1.25rem', 
                fontWeight: '600', 
                color: '#059669', 
                margin: '0 0 1rem 0',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                👥 Passenger Registration
              </h3>
              <div style={{
                background: '#f0fdf4',
                border: '1px solid #16a34a',
                borderRadius: '0.5rem',
                padding: '1.5rem'
              }}>
                <ol style={{ margin: '0', paddingLeft: '1.5rem', color: '#166534', lineHeight: '1.6' }}>
                  <li style={{ marginBottom: '0.75rem' }}>
                    <strong>Find the bot:</strong> Search for <code style={{ background: '#dcfce7', padding: '0.125rem 0.25rem', borderRadius: '0.25rem' }}>@WestSantTransportBot</code>
                  </li>
                  <li style={{ marginBottom: '0.75rem' }}>
                    <strong>Start conversation:</strong> Send <code style={{ background: '#dcfce7', padding: '0.125rem 0.25rem', borderRadius: '0.25rem' }}>/start</code>
                  </li>
                  <li style={{ marginBottom: '0.75rem' }}>
                    <strong>Register:</strong> Send <code style={{ background: '#dcfce7', padding: '0.125rem 0.25rem', borderRadius: '0.25rem' }}>/register_passenger Your Full Name</code>
                  </li>
                  <li>
                    <strong>Example:</strong> <code style={{ background: '#dcfce7', padding: '0.125rem 0.25rem', borderRadius: '0.25rem' }}>/register_passenger Harinivas Swami</code>
                  </li>
                </ol>
              </div>
            </div>

            {/* Volunteer Registration */}
            <div>
              <h3 style={{ 
                fontSize: '1.25rem', 
                fontWeight: '600', 
                color: '#d97706', 
                margin: '0 0 1rem 0',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                🚗 Volunteer Registration
              </h3>
              <div style={{
                background: '#fffbeb',
                border: '1px solid #d97706',
                borderRadius: '0.5rem',
                padding: '1.5rem'
              }}>
                <ol style={{ margin: '0', paddingLeft: '1.5rem', color: '#92400e', lineHeight: '1.6' }}>
                  <li style={{ marginBottom: '0.75rem' }}>
                    <strong>Find the bot:</strong> Search for <code style={{ background: '#fef3c7', padding: '0.125rem 0.25rem', borderRadius: '0.25rem' }}>@WestSantTransportBot</code>
                  </li>
                  <li style={{ marginBottom: '0.75rem' }}>
                    <strong>Start conversation:</strong> Send <code style={{ background: '#fef3c7', padding: '0.125rem 0.25rem', borderRadius: '0.25rem' }}>/start</code>
                  </li>
                  <li style={{ marginBottom: '0.75rem' }}>
                    <strong>Register:</strong> Send <code style={{ background: '#fef3c7', padding: '0.125rem 0.25rem', borderRadius: '0.25rem' }}>/register_volunteer your_username</code>
                  </li>
                  <li>
                    <strong>Example:</strong> <code style={{ background: '#fef3c7', padding: '0.125rem 0.25rem', borderRadius: '0.25rem' }}>/register_volunteer john_smith</code>
                  </li>
                </ol>
                <div style={{ 
                  marginTop: '1rem', 
                  fontSize: '0.875rem', 
                  color: '#b45309',
                  fontStyle: 'italic'
                }}>
                  💡 Note: Use your system username, not your display name
                </div>
              </div>
            </div>

            {/* Dashboard User Registration */}
            <div>
              <h3 style={{ 
                fontSize: '1.25rem', 
                fontWeight: '600', 
                color: '#7c3aed', 
                margin: '0 0 1rem 0',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                👤 Dashboard User Registration
              </h3>
              <div style={{
                background: '#f3e8ff',
                border: '1px solid #8b5cf6',
                borderRadius: '0.5rem',
                padding: '1.5rem'
              }}>
                <ol style={{ margin: '0', paddingLeft: '1.5rem', color: '#6b21a8', lineHeight: '1.6' }}>
                  <li style={{ marginBottom: '0.75rem' }}>
                    <strong>Find the bot:</strong> Search for <code style={{ background: '#ede9fe', padding: '0.125rem 0.25rem', borderRadius: '0.25rem' }}>@WestSantTransportBot</code>
                  </li>
                  <li style={{ marginBottom: '0.75rem' }}>
                    <strong>Start conversation:</strong> Send <code style={{ background: '#ede9fe', padding: '0.125rem 0.25rem', borderRadius: '0.25rem' }}>/start</code>
                  </li>
                  <li style={{ marginBottom: '0.75rem' }}>
                    <strong>Register:</strong> Send <code style={{ background: '#ede9fe', padding: '0.125rem 0.25rem', borderRadius: '0.25rem' }}>/register_user your_dashboard_username</code>
                  </li>
                  <li>
                    <strong>Example:</strong> <code style={{ background: '#ede9fe', padding: '0.125rem 0.25rem', borderRadius: '0.25rem' }}>/register_user admin_user</code>
                  </li>
                </ol>
                <div style={{ 
                  marginTop: '1rem', 
                  fontSize: '0.875rem', 
                  color: '#7c2d12',
                  fontStyle: 'italic'
                }}>
                  💡 Note: Must have an existing dashboard account with username/password access
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Available Commands */}
        <div style={{
          background: 'white',
          borderRadius: '0.75rem',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
          padding: 'clamp(1rem, 3vw, 2rem)',
          marginBottom: 'clamp(1.5rem, 3vw, 2rem)'
        }}>
          <h2 style={{ 
            fontSize: '1.75rem', 
            fontWeight: '600', 
            color: '#1e40af', 
            margin: '0 0 1.5rem 0',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            ⌨️ Available Commands
          </h2>
          
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
            gap: '1rem' 
          }}>
            {[
              { cmd: '/start', desc: 'Begin using the bot and see registration options' },
              { cmd: '/help', desc: 'Show all available commands and help information' },
              { cmd: '/flights', desc: 'View your assigned flights (Volunteers & Dashboard Users)' },
              { cmd: '/myflights', desc: 'View your upcoming flights (Passengers)' },
              { cmd: '/status', desc: 'Check your registration status and account details' },
              { cmd: '/flightinfo FLIGHT DATE', desc: 'Get real-time flight information (e.g., /flightinfo UA100 2024-12-01)' },
              { cmd: '/register_passenger', desc: 'Register as a passenger using your full name' },
              { cmd: '/register_volunteer', desc: 'Register as a volunteer using your username' },
              { cmd: '/register_user', desc: 'Register as a dashboard user using your username' }
            ].map((item, index) => (
              <div key={index} style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '0.5rem',
                padding: '1rem'
              }}>
                <code style={{ 
                  background: '#e2e8f0', 
                  padding: '0.25rem 0.5rem', 
                  borderRadius: '0.25rem',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  color: '#1e40af'
                }}>
                  {item.cmd}
                </code>
                <p style={{ 
                  margin: '0.5rem 0 0 0', 
                  fontSize: '0.875rem', 
                  color: '#64748b',
                  lineHeight: '1.4'
                }}>
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Automated Monitoring System */}
        <div style={{
          background: 'white',
          borderRadius: '0.75rem',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
          padding: 'clamp(1rem, 3vw, 2rem)',
          marginBottom: 'clamp(1.5rem, 3vw, 2rem)'
        }}>
          <h2 style={{ 
            fontSize: '1.75rem', 
            fontWeight: '600', 
            color: '#1e40af', 
            margin: '0 0 1.5rem 0',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <AlertTriangle size={28} />
            🚨 NEW: Automated Flight Monitoring
          </h2>
          
          <div style={{
            background: '#fee2e2',
            border: '2px solid #dc2626',
            borderRadius: '0.5rem',
            padding: '1.5rem',
            marginBottom: '1.5rem'
          }}>
            <h3 style={{ 
              fontSize: '1.25rem', 
              fontWeight: '600', 
              color: '#7f1d1d', 
              margin: '0 0 1rem 0',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              🔴 Automatic Delay Detection
            </h3>
            <p style={{ margin: '0 0 1rem 0', color: '#7f1d1d', lineHeight: '1.6' }}>
              Our system now automatically monitors all flights starting <strong>6 hours before departure</strong> and checks for delays every 30 minutes until takeoff.
            </p>
            <ul style={{ margin: '0', paddingLeft: '1.5rem', color: '#7f1d1d' }}>
              <li style={{ marginBottom: '0.5rem' }}>Monitors flights using real-time FlightAware data</li>
              <li style={{ marginBottom: '0.5rem' }}>Automatically detects delays over 15 minutes</li>
              <li style={{ marginBottom: '0.5rem' }}>Sends instant alerts to all relevant parties</li>
              <li>Works 24/7 without manual intervention</li>
            </ul>
          </div>

          <div style={{
            background: '#ecfdf5',
            border: '1px solid #10b981',
            borderRadius: '0.5rem',
            padding: '1.5rem'
          }}>
            <h3 style={{ 
              fontSize: '1.125rem', 
              fontWeight: '600', 
              color: '#047857', 
              margin: '0 0 0.75rem 0'
            }}>
              Who Gets Automatic Delay Alerts:
            </h3>
            <ul style={{ margin: '0', paddingLeft: '1.5rem', color: '#047857', lineHeight: '1.6' }}>
              <li><strong>Passengers:</strong> Get notified about delays for their specific flights</li>
              <li><strong>Volunteers:</strong> Receive alerts for flights they're assigned to pick up or drop off</li>
              <li><strong>Dashboard Users:</strong> Get notified about delays for flights at their assigned airports</li>
            </ul>
          </div>
        </div>

        {/* Notification Settings */}
        <div style={{
          background: 'white',
          borderRadius: '0.75rem',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
          padding: '2rem'
        }}>
          <h2 style={{ 
            fontSize: '1.75rem', 
            fontWeight: '600', 
            color: '#1e40af', 
            margin: '0 0 1.5rem 0',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <Bell size={28} />
            Notification Types & Timing
          </h2>
          
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
            gap: 'clamp(1rem, 2vw, 1.5rem)' 
          }}>
            {/* Passenger Notifications */}
            <div style={{
              background: '#f0f9ff',
              border: '1px solid #0ea5e9',
              borderRadius: '0.5rem',
              padding: '1.5rem'
            }}>
              <h3 style={{ 
                fontSize: '1.25rem', 
                fontWeight: '600', 
                color: '#0c4a6e', 
                margin: '0 0 1rem 0'
              }}>
                📱 Passenger Alerts
              </h3>
              <ul style={{ margin: '0', paddingLeft: '0', listStyle: 'none', color: '#075985' }}>
                <li style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <Clock size={16} style={{ marginTop: '0.125rem', color: '#0ea5e9' }} />
                  <div>
                    <strong>Flight Confirmation:</strong> Immediate notification when your flight is created
                  </div>
                </li>
                <li style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <Clock size={16} style={{ marginTop: '0.125rem', color: '#0ea5e9' }} />
                  <div>
                    <strong>Flight Changes/Deletions:</strong> Updates for time changes, volunteer assignments, or flight cancellations
                  </div>
                </li>
                <li style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <Clock size={16} style={{ marginTop: '0.125rem', color: '#0ea5e9' }} />
                  <div>
                    <strong>Check-in Reminder:</strong> 24 hours before departure to prepare for your flight
                  </div>
                </li>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <Clock size={16} style={{ marginTop: '0.125rem', color: '#0ea5e9' }} />
                  <div>
                    <strong>Volunteer Info:</strong> Contact details for your assigned volunteers
                  </div>
                </li>
              </ul>
            </div>

            {/* Volunteer Notifications */}
            <div style={{
              background: '#fef3c7',
              border: '1px solid #f59e0b',
              borderRadius: '0.5rem',
              padding: '1.5rem'
            }}>
              <h3 style={{ 
                fontSize: '1.25rem', 
                fontWeight: '600', 
                color: '#92400e', 
                margin: '0 0 1rem 0'
              }}>
                🚗 Volunteer Alerts
              </h3>
              <ul style={{ margin: '0', paddingLeft: '0', listStyle: 'none', color: '#92400e' }}>
                <li style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <Clock size={16} style={{ marginTop: '0.125rem', color: '#f59e0b' }} />
                  <div>
                    <strong>Drop-off Reminders:</strong> 6 hours and 3 hours before departure with passenger and flight details
                  </div>
                </li>
                <li style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <Clock size={16} style={{ marginTop: '0.125rem', color: '#f59e0b' }} />
                  <div>
                    <strong>Pickup Reminders:</strong> 6 hours and 1 hour before arrival with passenger and flight details
                  </div>
                </li>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <Clock size={16} style={{ marginTop: '0.125rem', color: '#f59e0b' }} />
                  <div>
                    <strong>Assignment Changes:</strong> Immediate notification for any updates
                  </div>
                </li>
              </ul>
            </div>

            {/* Dashboard User Notifications */}
            <div style={{
              background: '#f3e8ff',
              border: '1px solid #8b5cf6',
              borderRadius: '0.5rem',
              padding: '1.5rem'
            }}>
              <h3 style={{ 
                fontSize: '1.25rem', 
                fontWeight: '600', 
                color: '#6b21a8', 
                margin: '0 0 1rem 0'
              }}>
                👤 Dashboard User Alerts
              </h3>
              <ul style={{ margin: '0', paddingLeft: '0', listStyle: 'none', color: '#6b21a8' }}>
                <li style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <Clock size={16} style={{ marginTop: '0.125rem', color: '#8b5cf6' }} />
                  <div>
                    <strong>Airport-Based Delays:</strong> Automatic alerts for delays at airports you have access to
                  </div>
                </li>
                <li style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <Clock size={16} style={{ marginTop: '0.125rem', color: '#8b5cf6' }} />
                  <div>
                    <strong>Flight Additions:</strong> Notifications when new flights are added to your airports
                  </div>
                </li>
                <li style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <Clock size={16} style={{ marginTop: '0.125rem', color: '#8b5cf6' }} />
                  <div>
                    <strong>System Updates:</strong> Important system notifications and maintenance alerts
                  </div>
                </li>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <Clock size={16} style={{ marginTop: '0.125rem', color: '#8b5cf6' }} />
                  <div>
                    <strong>Flight Changes:</strong> Updates for flight modifications and cancellations
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}