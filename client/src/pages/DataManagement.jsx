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
      const [passengersRes, usersRes, volunteersRes] = await Promise.all([
        fetch('/api/passengers'),
        fetch('/api/users'),
        fetch('/api/volunteers')
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
      const url = editingItem ? `/api/${type}/${editingItem.id}` : `/api/${type}`;
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
      const response = await fetch(`/api/${type}/${id}`, {
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
        <div className="text-center py-8 text-gray-500">
          {searchTerm ? 'No items match your search.' : `No ${activeTab} found.`}
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-200">
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
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Data Management</h1>
        <p className="text-gray-600">Manage passengers, users, and volunteers</p>
      </div>

      {/* Alert Messages */}
      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
          <button onClick={() => setError('')} className="float-right text-red-500 hover:text-red-700">×</button>
        </div>
      )}
      
      {success && (
        <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
          {success}
          <button onClick={() => setSuccess('')} className="float-right text-green-500 hover:text-green-700">×</button>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {['passengers', 'users', 'volunteers'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-2 px-1 border-b-2 font-medium text-sm capitalize ${
                activeTab === tab
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab} ({data[tab]?.length || 0})
            </button>
          ))}
        </nav>
      </div>

      {/* Controls */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex-1 max-w-md">
          <input
            type="text"
            placeholder={`Search ${activeTab}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="ml-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Add {activeTab.slice(0, -1)}
        </button>
      </div>

      {/* Data Table */}
      {renderTable()}

      {/* Add/Edit Modal */}
      {(showAddModal || editingItem) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-screen overflow-y-auto">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
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