import React, { useState, useEffect } from 'react';

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', color: 'red', border: '2px solid red', margin: '1rem' }}>
          <h2>Something went wrong in DataManagement component.</h2>
          <details style={{ whiteSpace: 'pre-wrap' }}>
            <summary>Error Details</summary>
            <p><strong>Error:</strong> {this.state.error && this.state.error.toString()}</p>
            <p><strong>Stack:</strong> {this.state.errorInfo.componentStack}</p>
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}

const DataManagement = () => {
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
  }, []);
  const [activeTab, setActiveTab] = useState('passengers');
  const [data, setData] = useState({
    passengers: [],
    users: [],
    volunteers: []
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [airports, setAirports] = useState([]);
  const [selectedAirports, setSelectedAirports] = useState([]);
  const [airportInput, setAirportInput] = useState('');
  const [filteredAirports, setFilteredAirports] = useState([]);

  // Load data on component mount
  useEffect(() => {
    loadAllData();
    loadAirports();
  }, []);


  const loadAllData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = {
        'Authorization': `Bearer ${token}`
      };

      const [passengersRes, usersRes, volunteersRes] = await Promise.all([
        fetch('/api/data-management/passengers', { headers }),
        fetch('/api/data-management/users', { headers }),
        fetch('/api/data-management/volunteers', { headers })
      ]);

      if (!passengersRes.ok || !usersRes.ok || !volunteersRes.ok) {
        throw new Error('Failed to load data');
      }

      const passengers = await passengersRes.json();
      const users = await usersRes.json();
      const volunteers = await volunteersRes.json();

      setData({
        passengers: passengers || [],
        users: users || [],
        volunteers: volunteers || []
      });
    } catch (error) {
      console.error('Error loading data:', error);
      setError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadAirports = async () => {
    try {
      const response = await fetch('/api/airports');
      if (response.ok) {
        const data = await response.json();
        setAirports(data);
      }
    } catch (error) {
      console.error('Error loading airports:', error);
    }
  };

  const saveItem = async (item, type) => {
    setSaving(true);
    setError('');
    try {
      let url, method;
      
      if (type === 'users') {
        // Use user management API for users
        url = editingItem ? `/api/users/${editingItem.id}` : `/api/register`;
        method = editingItem ? 'PUT' : 'POST';
        
        // Add selected airports to user data
        item.allowedAirports = selectedAirports;
        
        // Don't send empty password for updates
        if (editingItem && !item.password) {
          delete item.password;
        }
      } else {
        // Use data management API for passengers and volunteers
        url = editingItem ? `/api/data-management/${type}/${editingItem.id}` : `/api/data-management/${type}`;
        method = editingItem ? 'PUT' : 'POST';
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(item)
      });

      if (!response.ok) {
        throw new Error('Failed to save item');
      }

      setSuccess(`${type.slice(0, -1)} ${editingItem ? 'updated' : 'created'} successfully!`);
      setEditingItem(null);
      setShowAddModal(false);
      setSelectedAirports([]);
      setAirportInput('');
      setFilteredAirports([]);
      await loadAllData();
    } catch (error) {
      console.error('Error saving item:', error);
      setError(`Failed to save ${type.slice(0, -1)}. Please try again.`);
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = async (id, type) => {
    if (!window.confirm(`Are you sure you want to delete this ${type.slice(0, -1)}?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/data-management/${type}/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete item');
      }

      setSuccess(`${type.slice(0, -1)} deleted successfully!`);
      await loadAllData();
    } catch (error) {
      console.error('Error deleting item:', error);
      setError(`Failed to delete ${type.slice(0, -1)}. Please try again.`);
    }
  };

  const filteredData = () => {
    const currentData = data[activeTab] || [];
    // Filter out null/undefined items
    const validData = currentData.filter(item => item && typeof item === 'object');
    
    if (!searchTerm) return validData;
    
    return validData.filter(item => {
      const searchableText = [
        item.name,
        item.username,
        item.legalName,
        item.phone,
        item.city,
        item.role
      ].filter(Boolean).join(' ').toLowerCase();
      
      return searchableText.includes(searchTerm.toLowerCase());
    });
  };

  const getFormFields = (type, isEditing = false) => {
    switch (type) {
      case 'passengers':
        return [
          { name: 'name', label: 'Full Name', type: 'text', required: true },
          { name: 'legalName', label: 'Legal Name', type: 'text', required: true },
          { name: 'phone', label: 'Phone Number', type: 'tel', required: false },
          { name: 'telegramChatId', label: 'Telegram Chat ID', type: 'number', required: false }
        ];
      case 'users':
        return [
          { name: 'username', label: 'Username', type: 'text', required: true },
          { name: 'name', label: 'Full Name', type: 'text', required: true },
          { name: 'password', label: 'Password', type: 'password', required: !isEditing },
          { name: 'role', label: 'Role', type: 'select', options: ['user', 'admin', 'superadmin'], required: true },
          { name: 'phone', label: 'Phone Number', type: 'tel', required: false },
          { name: 'telegramChatId', label: 'Telegram Chat ID', type: 'number', required: false }
        ];
      case 'volunteers':
        return [
          { name: 'name', label: 'Full Name', type: 'text', required: true },
          { name: 'phone', label: 'Phone Number', type: 'tel', required: true },
          { name: 'city', label: 'City', type: 'text', required: false },
          { name: 'telegramChatId', label: 'Telegram Chat ID', type: 'number', required: false }
        ];
      default:
        return [];
    }
  };

  const renderForm = (item = {}) => {
    try {
      const fields = getFormFields(activeTab, !!editingItem);
      
      if (!fields || fields.length === 0) {
        console.error('No fields returned from getFormFields');
        return <div>Error: No form fields available</div>;
      }
      
      return (
      <form onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const itemData = {};
        
        fields.forEach(field => {
          const value = formData.get(field.name);
          if (field.type === 'number' && value) {
            itemData[field.name] = parseInt(value);
          } else if (value !== null && value !== '') {
            itemData[field.name] = value;
          }
        });

        // Add metadata
        if (editingItem) {
          itemData.id = editingItem.id;
          itemData.createdAt = editingItem.createdAt;
          itemData.updatedAt = new Date().toISOString();
        } else {
          itemData.id = crypto.randomUUID();
          itemData.createdAt = new Date().toISOString();
          itemData.updatedAt = new Date().toISOString();
        }

        // Add defaults for specific types
        if (activeTab === 'passengers' && !editingItem) {
          itemData.flightCount = 0;
        } else if (activeTab === 'users' && !editingItem) {
          itemData.allowedAirports = [];
        } else if (activeTab === 'volunteers' && !editingItem) {
          itemData.role = 'volunteer';
          itemData.allowedAirports = [];
        }

        saveItem(itemData, activeTab);
      }}>
        {fields.map(field => (
          <div key={field.name} style={{ marginBottom: '1rem' }}>
            <label style={{ 
              display: 'block', 
              fontSize: '0.875rem', 
              fontWeight: '500', 
              color: '#374151', 
              marginBottom: '0.5rem' 
            }}>
              {field.name === 'password' && editingItem ? 
                `${field.label} (leave blank to keep current)` : 
                field.label
              } {field.required && <span style={{ color: '#ef4444' }}>*</span>}
            </label>
            {field.type === 'select' ? (
              <select
                name={field.name}
                defaultValue={(item && item[field.name]) || ''}
                required={field.required}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.375rem',
                  outline: 'none'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#3b82f6';
                  e.target.style.boxShadow = '0 0 0 1px #3b82f6';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#d1d5db';
                  e.target.style.boxShadow = 'none';
                }}
              >
                <option value="">Select {field.label}</option>
                {field.options.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            ) : (
              <input
                type={field.type}
                name={field.name}
                defaultValue={(item && item[field.name]) || ''}
                required={field.required}
                autoComplete={field.type === 'password' ? 'new-password' : field.name}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.375rem',
                  outline: 'none'
                }}
                placeholder={`Enter ${field.label.toLowerCase()}`}
                onFocus={(e) => {
                  e.target.style.borderColor = '#3b82f6';
                  e.target.style.boxShadow = '0 0 0 1px #3b82f6';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#d1d5db';
                  e.target.style.boxShadow = 'none';
                }}
              />
            )}
          </div>
        ))}
        
        {/* Airport selection for users */}
        {activeTab === 'users' && (
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ 
              display: 'block', 
              fontSize: '0.875rem', 
              fontWeight: '500', 
              color: '#374151', 
              marginBottom: '0.5rem' 
            }}>
              Allowed Airports {selectedAirports.length === 0 && <span style={{ color: '#ef4444' }}>*</span>}
            </label>
            
            {/* Airport input */}
            <input
              type="text"
              value={airportInput}
              onChange={(e) => {
                const value = e.target.value.toLowerCase();
                setAirportInput(value);
                
                if (value.length >= 2) {
                  const filtered = airports.filter(airport => 
                    airport && airport.code && airport.name && airport.city &&
                    (airport.code.toLowerCase().includes(value) ||
                    airport.name.toLowerCase().includes(value) ||
                    airport.city.toLowerCase().includes(value))
                  ).slice(0, 10);
                  setFilteredAirports(filtered);
                } else {
                  setFilteredAirports([]);
                }
              }}
              placeholder="Search airports (code, name, or city)..."
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem',
                outline: 'none',
                marginBottom: '0.5rem'
              }}
            />
            
            {/* Filtered airports dropdown */}
            {filteredAirports.length > 0 && (
              <div style={{
                maxHeight: '200px',
                overflowY: 'auto',
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem',
                backgroundColor: 'white',
                marginBottom: '0.5rem'
              }}>
                {filteredAirports.map(airport => (
                  <div
                    key={airport.code}
                    onClick={() => {
                      if (!selectedAirports.includes(airport.code)) {
                        setSelectedAirports([...selectedAirports, airport.code]);
                      }
                      setAirportInput('');
                      setFilteredAirports([]);
                    }}
                    style={{
                      padding: '0.5rem',
                      cursor: 'pointer',
                      borderBottom: '1px solid #e5e7eb'
                    }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = '#f3f4f6'}
                    onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
                  >
                    <strong>{airport.code}</strong> - {airport.name}, {airport.city}
                  </div>
                ))}
              </div>
            )}
            
            {/* Selected airports */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.5rem',
              marginTop: '0.5rem'
            }}>
              {selectedAirports.map(airportCode => {
                const airport = airports.find(a => a && a.code === airportCode);
                return (
                  <span
                    key={airportCode}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '0.25rem 0.5rem',
                      backgroundColor: '#dbeafe',
                      color: '#1e40af',
                      borderRadius: '0.375rem',
                      fontSize: '0.75rem',
                      gap: '0.25rem'
                    }}
                  >
                    {airportCode} {airport ? `- ${airport.name}` : ''}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAirports(selectedAirports.filter(code => code !== airportCode));
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#1e40af',
                        cursor: 'pointer',
                        padding: '0',
                        fontSize: '0.875rem'
                      }}
                    >
                      ×
                    </button>
                  </span>
                );
              })}
            </div>
          </div>
        )}
        
        <div style={{ 
          display: 'flex', 
          justifyContent: 'flex-end', 
          gap: '0.5rem', 
          paddingTop: '1rem', 
          borderTop: '1px solid #e5e7eb' 
        }}>
          <button
            type="button"
            onClick={() => {
              setEditingItem(null);
              setShowAddModal(false);
              setSelectedAirports([]);
              setAirportInput('');
              setFilteredAirports([]);
            }}
            style={{
              padding: '0.5rem 1rem',
              color: '#4b5563',
              backgroundColor: '#e5e7eb',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#d1d5db'}
            onMouseLeave={(e) => e.target.style.backgroundColor = '#e5e7eb'}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: saving ? '#93c5fd' : '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: saving ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => {
              if (!saving) e.target.style.backgroundColor = '#1d4ed8';
            }}
            onMouseLeave={(e) => {
              if (!saving) e.target.style.backgroundColor = '#2563eb';
            }}
          >
            {saving ? 'Saving...' : editingItem ? 'Update' : 'Create'}
          </button>
        </div>
      </form>
    );
    } catch (error) {
      console.error('Error in renderForm:', error);
      return (
        <div style={{ padding: '1rem', color: 'red', border: '1px solid red', borderRadius: '4px' }}>
          <h4>Form Rendering Error</h4>
          <p>Error: {error.message}</p>
          <p>Stack: {error.stack}</p>
        </div>
      );
    }
  };

  const renderTable = () => {
    const currentData = filteredData();
    const fields = getFormFields(activeTab, false);
    
    if (currentData.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '2rem 0', color: '#6b7280' }}>
          {searchTerm ? 'No items match your search.' : `No ${activeTab} found.`}
        </div>
      );
    }

    return (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ minWidth: '100%', backgroundColor: 'white', border: '1px solid #e5e7eb' }}>
          <thead style={{ backgroundColor: '#f9fafb' }}>
            <tr>
              {fields.map(field => (
                <th key={field.name} style={{
                  padding: '0.75rem 1.5rem',
                  textAlign: 'left',
                  fontSize: '0.75rem',
                  fontWeight: '500',
                  color: '#6b7280',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  {field.label}
                </th>
              ))}
              <th style={{
                padding: '0.75rem 1.5rem',
                textAlign: 'left',
                fontSize: '0.75rem',
                fontWeight: '500',
                color: '#6b7280',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                Created
              </th>
              <th style={{
                padding: '0.75rem 1.5rem',
                textAlign: 'left',
                fontSize: '0.75rem',
                fontWeight: '500',
                color: '#6b7280',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody style={{ backgroundColor: 'white' }}>
            {currentData.map(item => {
              // Skip null/undefined items
              if (!item || typeof item !== 'object') return null;
              
              return (
                <tr key={item.id || Math.random()} style={{
                  borderTop: '1px solid #e5e7eb',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                  {fields.map(field => (
                    <td key={field.name} style={{
                      padding: '1rem 1.5rem',
                      whiteSpace: 'nowrap',
                      fontSize: '0.875rem',
                      color: '#111827'
                    }}>
                      {field.name === 'telegramChatId' ? (
                        item[field.name] ? (
                          <span style={{ color: '#059669' }}>✓ Linked</span>
                        ) : (
                          <span style={{ color: '#9ca3af' }}>Not linked</span>
                        )
                      ) : (
                        item[field.name] || '-'
                      )}
                    </td>
                  ))}
                  <td style={{
                    padding: '1rem 1.5rem',
                    whiteSpace: 'nowrap',
                    fontSize: '0.875rem',
                    color: '#6b7280'
                  }}>
                    {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '-'}
                  </td>
                  <td style={{
                    padding: '1rem 1.5rem',
                    whiteSpace: 'nowrap',
                    fontSize: '0.875rem',
                    fontWeight: '500'
                  }}>
                    <button
                      onClick={() => {
                        if (item) {
                          setEditingItem(item);
                          if (activeTab === 'users' && item.allowedAirports) {
                            setSelectedAirports(item.allowedAirports);
                          }
                        }
                      }}
                      style={{
                        color: '#2563eb',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        marginRight: '1rem',
                        transition: 'color 0.2s'
                      }}
                      onMouseEnter={(e) => e.target.style.color = '#1d4ed8'}
                      onMouseLeave={(e) => e.target.style.color = '#2563eb'}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteItem(item.id, activeTab)}
                      style={{
                        color: '#dc2626',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'color 0.2s'
                      }}
                      onMouseEnter={(e) => e.target.style.color = '#991b1b'}
                      onMouseLeave={(e) => e.target.style.color = '#dc2626'}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            }).filter(Boolean)}
          </tbody>
        </table>
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '16rem' 
      }}>
        <div style={{
          width: '3rem',
          height: '3rem',
          border: '2px solid #e5e7eb',
          borderBottom: '2px solid #2563eb',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
    <div style={{ padding: '1.5rem', backgroundColor: '#f9fafb', minHeight: '100vh' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.875rem', fontWeight: '700', color: '#1f2937', marginBottom: '0.5rem' }}>
          Data Management
        </h1>
        <p style={{ color: '#6b7280' }}>Manage passengers, users, and volunteers</p>
      </div>

      {/* Alert Messages */}
      {error && (
        <div style={{
          marginBottom: '1rem',
          padding: '1rem',
          backgroundColor: '#fee2e2',
          border: '1px solid #f87171',
          color: '#991b1b',
          borderRadius: '0.5rem',
          position: 'relative'
        }}>
          {error}
          <button 
            onClick={() => setError('')} 
            style={{
              position: 'absolute',
              right: '1rem',
              top: '1rem',
              background: 'none',
              border: 'none',
              color: '#dc2626',
              cursor: 'pointer',
              fontSize: '1.25rem'
            }}
          >
            ×
          </button>
        </div>
      )}
      
      {success && (
        <div style={{
          marginBottom: '1rem',
          padding: '1rem',
          backgroundColor: '#d1fae5',
          border: '1px solid #34d399',
          color: '#059669',
          borderRadius: '0.5rem',
          position: 'relative'
        }}>
          {success}
          <button 
            onClick={() => setSuccess('')} 
            style={{
              position: 'absolute',
              right: '1rem',
              top: '1rem',
              background: 'none',
              border: 'none',
              color: '#059669',
              cursor: 'pointer',
              fontSize: '1.25rem'
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Card Container */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '0.75rem',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        padding: '1.5rem'
      }}>
        {/* Tabs */}
        <div style={{ borderBottom: '1px solid #e5e7eb', marginBottom: '1.5rem' }}>
          <nav style={{ display: 'flex', gap: '2rem', marginBottom: '-1px' }}>
            {['passengers', 'users', 'volunteers'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '0.5rem 0.25rem',
                  borderBottom: activeTab === tab ? '2px solid #3b82f6' : '2px solid transparent',
                  fontWeight: '500',
                  fontSize: '0.875rem',
                  textTransform: 'capitalize',
                  color: activeTab === tab ? '#2563eb' : '#6b7280',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (activeTab !== tab) {
                    e.target.style.color = '#374151';
                    e.target.style.borderBottomColor = '#d1d5db';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== tab) {
                    e.target.style.color = '#6b7280';
                    e.target.style.borderBottomColor = 'transparent';
                  }
                }}
              >
                {tab} ({data[tab]?.length || 0})
              </button>
            ))}
          </nav>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div style={{ flex: '1', maxWidth: '24rem' }}>
            <input
              type="text"
              placeholder={`Search ${activeTab}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                outline: 'none'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#3b82f6';
                e.target.style.boxShadow = '0 0 0 1px #3b82f6';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#d1d5db';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>
          <button
            onClick={() => {
              setShowAddModal(true);
              setSelectedAirports([]);
              setAirportInput('');
              setFilteredAirports([]);
            }}
            style={{
              marginLeft: '1rem',
              padding: '0.75rem 1rem',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontWeight: '500',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#2563eb'}
            onMouseLeave={(e) => e.target.style.backgroundColor = '#3b82f6'}
          >
            Add {activeTab.slice(0, -1)}
          </button>
        </div>

        {/* Data Table */}
        {renderTable()}
      </div>

      {/* Add/Edit Modal */}
      {(showAddModal || editingItem) && (
        <div 
          id="modal-overlay"
          style={{
            position: 'fixed',
            inset: '0',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: '50'
          }}
          onClick={(e) => {
            if (e.target.id === 'modal-overlay') {
              setShowAddModal(false);
              setEditingItem(null);
            }
          }}
        >
          <div 
            id="modal-content"
            style={{
              backgroundColor: 'white',
              borderRadius: '0.75rem',
              padding: '2rem',
              width: '90%',
              maxWidth: '32rem',
              maxHeight: '80vh',
              overflow: 'auto',
            }}
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <h3 style={{
              fontSize: '1.125rem',
              fontWeight: '600',
              color: '#1f2937',
              marginBottom: '1.5rem'
            }}>
              {editingItem ? `Edit ${activeTab.slice(0, -1)}` : `Add ${activeTab.slice(0, -1)}`}
            </h3>
            {renderForm(editingItem)}
          </div>
        </div>
      )}
    </div>
    </ErrorBoundary>
  );
};

export default DataManagement;