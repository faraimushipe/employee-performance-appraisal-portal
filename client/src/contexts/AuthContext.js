import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      // Verify token and get user data
      api.get('/auth/profile')
        .then(response => {
          setUser(response.data.user);
        })
        .catch(error => {
          console.error('Token verification failed:', error);
          localStorage.removeItem('token');
          delete api.defaults.headers.common['Authorization'];
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    try {
      const { data } = await api.post('/auth/login', { email, password });
      const { token, user: userData } = data;
      
      localStorage.setItem('token', token);
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(userData);
      
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return { 
        success: false, 
        message: error.response?.data?.message || 'Login failed' 
      };
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('token');
      delete api.defaults.headers.common['Authorization'];
      setUser(null);
    }
  };

  const updateProfile = async (profileData) => {
    try {
      const response = await api.put('/auth/profile', profileData);
      setUser(prev => ({ ...prev, ...profileData }));
      return { success: true };
    } catch (error) {
      console.error('Profile update error:', error);
      return { 
        success: false, 
        message: error.response?.data?.message || 'Profile update failed' 
      };
    }
  };

  const changePassword = async (currentPassword, newPassword) => {
    try {
      await api.put('/auth/change-password', { 
        current_password: currentPassword, 
        new_password: newPassword 
      });
      return { success: true };
    } catch (error) {
      console.error('Password change error:', error);
      return { 
        success: false, 
        message: error.response?.data?.message || 'Password change failed' 
      };
    }
  };

  const hasPermission = (resource, action) => {
    if (!user) return false;
    
    const permissions = {
      HR_Manager: {
        users: ['create', 'read', 'update', 'delete'],
        reviews: ['create', 'read', 'update', 'delete', 'approve'],
        analytics: ['read_all', 'export'],
        surveys: ['create', 'read', 'update', 'delete', 'analyze'],
        development: ['create', 'read', 'update', 'delete', 'monitor']
      },
      Department_Supervisor: {
        users: ['read_own_dept'],
        reviews: ['create', 'read_own_dept', 'update_own_dept', 'approve_own_dept'],
        analytics: ['read_dept'],
        surveys: ['create', 'read_dept', 'analyze_dept'],
        development: ['create', 'read_own_dept', 'update_own_dept', 'monitor_own_dept']
      },
      Employee: {
        users: ['read_own'],
        reviews: ['read_own', 'create_self_assessment'],
        analytics: ['read_personal'],
        surveys: ['create', 'read_own'],
        development: ['create', 'read_own', 'update_own']
      }
    };

    const rolePermissions = permissions[user.role];
    if (!rolePermissions || !rolePermissions[resource]) {
      return false;
    }
    
    // Allow scoped variants to satisfy generic actions
    const normalizeAction = (requested) => {
      switch (requested) {
        case 'read':
          return ['read', 'read_own_dept', 'read_own'];
        case 'update':
          return ['update', 'update_own_dept', 'update_own'];
        case 'approve':
          return ['approve', 'approve_own_dept'];
        case 'monitor':
          return ['monitor', 'monitor_own_dept'];
        case 'analyze':
          return ['analyze', 'analyze_dept'];
        default:
          return [requested];
      }
    };

    const acceptableActions = new Set(normalizeAction(action));
    return rolePermissions[resource].some(a => acceptableActions.has(a));
  };

  const value = {
    user,
    loading,
    login,
    logout,
    updateProfile,
    changePassword,
    hasPermission
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
