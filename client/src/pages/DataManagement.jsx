import React, { useState, useEffect } from 'react';

const DataManagement = () => {
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

  // Load data on component mount
  useEffect(() => {
    loadAllData();
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

  const saveItem = async (item, type) => {
    setSaving(true);
    setError('');
    try {
      const url = editingItem ? `/api/data-management/${type}/${editingItem.id}` : `/api/data-management/${type}`;
      const method = editingItem ? 'PUT' : 'POST';

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
    if (!searchTerm) return currentData;
    
    return currentData.filter(item => {
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

  const getFormFields = (type) => {
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
          { name: 'name', label: 'Display Name', type: 'text', required: true },
          { name: 'role', label: 'Role', type: 'select', options: ['user', 'admin', 'superadmin'], required: true },
          { name: 'phone', label: 'Phone Number', type: 'tel', required: false },
          { name: 'telegramChatId', label: 'Telegram Chat ID', type: 'number', required: false }
        ];
      case 'volunteers':
        return [
          { name: 'username', label: 'Username', type: 'text', required: true },
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
    const fields = getFormFields(activeTab);
    
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
          <div key={field.name} className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {field.label} {field.required && <span className="text-red-500">*</span>}
            </label>
            {field.type === 'select' ? (
              <select
                name={field.name}
                defaultValue={item[field.name] || ''}
                required={field.required}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                defaultValue={item[field.name] || ''}
                required={field.required}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder={`Enter ${field.label.toLowerCase()}`}
              />
            )}
          </div>
        ))}
        
        <div className="flex justify-end gap-2 pt-4 border-t">
          <button
            type="button"
            onClick={() => {
              setEditingItem(null);
              setShowAddModal(false);
            }}
            className="px-4 py-2 text-gray-600 bg-gray-200 rounded hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-400"
          >
            {saving ? 'Saving...' : editingItem ? 'Update' : 'Create'}
          </button>
        </div>
      </form>
    );
  };

  const renderTable = () => {
    const currentData = filteredData();
    const fields = getFormFields(activeTab);
    
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
          <thead className="bg-gray-50">
            <tr>
              {fields.slice(0, 4).map(field => (
                <th key={field.name} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {field.label}
                </th>
              ))}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {currentData.map(item => (
              <tr key={item.id} className="hover:bg-gray-50">
                {fields.slice(0, 4).map(field => (
                  <td key={field.name} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {field.name === 'telegramChatId' ? (
                      item[field.name] ? (
                        <span className="text-green-600">✓ Linked</span>
                      ) : (
                        <span className="text-gray-400">Not linked</span>
                      )
                    ) : (
                      item[field.name] || '-'
                    )}
                  </td>
                ))}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    onClick={() => setEditingItem(item)}
                    className="text-blue-600 hover:text-blue-900 mr-4"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteItem(item.id, activeTab)}
                    className="text-red-600 hover:text-red-900"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
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
            onClick={() => setShowAddModal(true)}
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
        <div style={{
          position: 'fixed',
          inset: '0',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: '50'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '0.75rem',
            padding: '2rem',
            width: '90%',
            maxWidth: '32rem',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
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
  );
};

export default DataManagement;