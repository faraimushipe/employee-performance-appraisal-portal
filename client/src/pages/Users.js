import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { usersAPI } from '../services/api';
import { Plus, Search, Edit, Trash2, Eye } from 'lucide-react';
import toast from 'react-hot-toast';

const Users = () => {
  const { user, hasPermission } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await usersAPI.getUsers();
      setUsers(response.data.users);
    } catch (error) {
      console.error('Error loading users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = !filterRole || user.role === filterRole;
    const matchesDepartment = !filterDepartment || user.department === filterDepartment;
    
    return matchesSearch && matchesRole && matchesDepartment;
  });

  const getRoleColor = (role) => {
    switch (role) {
      case 'HR_Manager':
        return 'badge bg-purple-100 text-purple-800';
      case 'Department_Supervisor':
        return 'badge bg-blue-100 text-blue-800';
      case 'Employee':
        return 'badge bg-green-100 text-green-800';
      default:
        return 'badge bg-gray-100 text-gray-800';
    }
  };

  const getDepartmentColor = (department) => {
    switch (department) {
      case 'HR':
        return 'badge bg-pink-100 text-pink-800';
      case 'IT':
        return 'badge bg-indigo-100 text-indigo-800';
      case 'Finance':
        return 'badge bg-emerald-100 text-emerald-800';
      default:
        return 'badge bg-gray-100 text-gray-800';
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to deactivate this user?')) {
      return;
    }

    try {
      await usersAPI.deleteUser(userId);
      toast.success('User deactivated successfully');
      loadUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Failed to deactivate user');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Users</h1>
            <p className="mt-1 text-sm text-gray-600">
              Manage user accounts and permissions
            </p>
          </div>
          {hasPermission('users', 'create') && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-primary flex items-center"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add User
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="label">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search users..."
                className="input-field pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          
          <div>
            <label className="label">Role</label>
            <select
              className="input-field"
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
            >
              <option value="">All Roles</option>
              <option value="HR_Manager">HR Manager</option>
              <option value="Department_Supervisor">Department Supervisor</option>
              <option value="Employee">Employee</option>
            </select>
          </div>
          
          <div>
            <label className="label">Department</label>
            <select
              className="input-field"
              value={filterDepartment}
              onChange={(e) => setFilterDepartment(e.target.value)}
            >
              <option value="">All Departments</option>
              <option value="HR">HR</option>
              <option value="IT">IT</option>
              <option value="Finance">Finance</option>
            </select>
          </div>
          
          <div className="flex items-end">
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterRole('');
                setFilterDepartment('');
              }}
              className="btn-secondary w-full"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Department
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Employment Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.map((userItem) => (
                <tr key={userItem.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                          <span className="text-sm font-medium text-primary-600">
                            {userItem.first_name[0]}{userItem.last_name[0]}
                          </span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {userItem.first_name} {userItem.last_name}
                        </div>
                        <div className="text-sm text-gray-500">{userItem.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={getRoleColor(userItem.role)}>
                      {userItem.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={getDepartmentColor(userItem.department)}>
                      {userItem.department}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(userItem.employment_date)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`badge ${userItem.is_active ? 'badge-success' : 'badge-danger'}`}>
                      {userItem.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => setEditingUser(userItem)}
                        className="text-primary-600 hover:text-primary-900"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {hasPermission('users', 'update') && (
                        <button
                          onClick={() => setEditingUser(userItem)}
                          className="text-indigo-600 hover:text-indigo-900"
                          title="Edit User"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      )}
                      {hasPermission('users', 'update') && (
                        <button
                          onClick={async () => {
                            if (window.confirm('Reset password for this user?')) {
                              try {
                                const response = await usersAPI.resetPassword(userItem.id);
                                toast.success(`Password reset. New password: ${response.data.temp_password}`);
                              } catch (error) {
                                console.error('Error resetting password:', error);
                                toast.error('Failed to reset password');
                              }
                            }
                          }}
                          className="text-yellow-600 hover:text-yellow-900"
                          title="Reset Password"
                        >
                          🔑
                        </button>
                      )}
                      {hasPermission('users', 'delete') && userItem.id !== user.id && (
                        <button
                          onClick={() => handleDeleteUser(userItem.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Deactivate User"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredUsers.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-500">
              {searchTerm || filterRole || filterDepartment
                ? 'No users found matching your filters'
                : 'No users found'
              }
            </div>
          </div>
        )}
      </div>

      {/* User Details Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">User Details</h3>
                <button
                  onClick={() => setEditingUser(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="label">Name</label>
                  <p className="text-sm text-gray-900">
                    {editingUser.first_name} {editingUser.last_name}
                  </p>
                </div>
                
                <div>
                  <label className="label">Email</label>
                  <p className="text-sm text-gray-900">{editingUser.email}</p>
                </div>
                
                <div>
                  <label className="label">Role</label>
                  <span className={getRoleColor(editingUser.role)}>
                    {editingUser.role.replace('_', ' ')}
                  </span>
                </div>
                
                <div>
                  <label className="label">Department</label>
                  <span className={getDepartmentColor(editingUser.department)}>
                    {editingUser.department}
                  </span>
                </div>
                
                <div>
                  <label className="label">Employment Date</label>
                  <p className="text-sm text-gray-900">
                    {formatDate(editingUser.employment_date)}
                  </p>
                </div>
                
                <div>
                  <label className="label">Status</label>
                  <span className={`badge ${editingUser.is_active ? 'badge-success' : 'badge-danger'}`}>
                    {editingUser.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
              
              <div className="flex justify-end space-x-2 mt-6">
                <button
                  onClick={() => setEditingUser(null)}
                  className="btn-secondary"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Create New User</h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
              
              <form onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                const userData = {
                  first_name: formData.get('firstName'),
                  last_name: formData.get('lastName'),
                  email: formData.get('email'),
                  role: formData.get('role'),
                  department: formData.get('department'),
                  employment_date: formData.get('employmentDate')
                };
                
                try {
                  await usersAPI.createUser(userData);
                  toast.success('User created successfully');
                  setShowCreateModal(false);
                  loadUsers();
                } catch (error) {
                  console.error('Error creating user:', error);
                  toast.error('Failed to create user');
                }
              }}>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">First Name</label>
                      <input
                        type="text"
                        name="firstName"
                        className="input-field"
                        required
                      />
                    </div>
                    <div>
                      <label className="label">Last Name</label>
                      <input
                        type="text"
                        name="lastName"
                        className="input-field"
                        required
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="label">Email</label>
                    <input
                      type="email"
                      name="email"
                      className="input-field"
                      required
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">Role</label>
                      <select
                        name="role"
                        className="input-field"
                        required
                      >
                        <option value="">Select Role</option>
                        <option value="HR_Manager">HR Manager</option>
                        <option value="Department_Supervisor">Department Supervisor</option>
                        <option value="Employee">Employee</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">Department</label>
                      <select
                        name="department"
                        className="input-field"
                        required
                      >
                        <option value="">Select Department</option>
                        <option value="HR">HR</option>
                        <option value="IT">IT</option>
                        <option value="Finance">Finance</option>
                      </select>
                    </div>
                  </div>
                  
                  <div>
                    <label className="label">Employment Date</label>
                    <input
                      type="date"
                      name="employmentDate"
                      className="input-field"
                      required
                    />
                  </div>
                </div>
                
                <div className="flex justify-end space-x-2 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                  >
                    Create User
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
