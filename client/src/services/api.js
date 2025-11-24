import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      delete api.defaults.headers.common['Authorization'];
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  logout: () => api.post('/auth/logout'),
  getProfile: () => api.get('/auth/profile'),
  updateProfile: (data) => api.put('/auth/profile', data),
  changePassword: (currentPassword, newPassword) => 
    api.put('/auth/change-password', { current_password: currentPassword, new_password: newPassword }),
  register: (userData) => api.post('/auth/register', userData),
};

// Users API
export const usersAPI = {
  getUsers: () => api.get('/users'),
  getUser: (id) => api.get(`/users/${id}`),
  createUser: (data) => api.post('/users', data),
  updateUser: (id, data) => api.put(`/users/${id}`, data),
  deleteUser: (id) => api.delete(`/users/${id}`),
  resetPassword: (id) => api.post(`/users/${id}/reset-password`),
  getDepartmentStats: () => api.get('/users/stats/department'),
  getRoleStats: () => api.get('/users/stats/roles'),
};

// Reviews API
export const reviewsAPI = {
  getReviews: () => api.get('/reviews'),
  getReview: (id) => api.get(`/reviews/${id}`),
  createReview: (data) => api.post('/reviews', data),
  updateReview: (id, data) => api.put(`/reviews/${id}`, data),
  submitReview: (id) => api.post(`/reviews/${id}/submit`),
  approveReview: (id) => api.post(`/reviews/${id}/approve`),
  getReviewStats: () => api.get('/reviews/stats/overview'),
};

// Development API
export const developmentAPI = {
  getPlans: () => api.get('/development'),
  getPlan: (id) => api.get(`/development/${id}`),
  createPlan: (data) => api.post('/development', data),
  updatePlan: (id, data) => api.put(`/development/${id}`, data),
  addProgress: (id, data) => api.post(`/development/${id}/progress`, data),
  completePlan: (id, data) => api.post(`/development/${id}/complete`, data),
  getStats: () => api.get('/development/stats/overview'),
  getSkillStats: () => api.get('/development/stats/skills'),
};

// Surveys API
export const surveysAPI = {
  getAvailableSurveys: () => api.get('/surveys/available'),
  getSurveyTemplate: (surveyType) => api.get(`/surveys/template/${surveyType}`),
  submitSurvey: (data) => api.post('/surveys/submit', data),
  getResponses: () => api.get('/surveys/responses'),
  getAnalytics: () => api.get('/surveys/analytics'),
  getStats: () => api.get('/surveys/stats'),
  exportData: (format) => api.get(`/surveys/export/${format}`),
};

// Analytics API
export const analyticsAPI = {
  getComprehensive: () => api.get('/analytics/comprehensive'),
  getDepartment: () => api.get('/analytics/department'),
  getPersonal: () => api.get('/analytics/personal'),
  exportData: (format) => api.get(`/analytics/export/${format}`),
};

export default api;
