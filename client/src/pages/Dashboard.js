import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { analyticsAPI, reviewsAPI, developmentAPI, surveysAPI } from '../services/api';
import {
  Users,
  FileText,
  Target,
  BarChart3,
  CheckCircle,
  AlertCircle,
  Star
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

const Dashboard = () => {
  const { user, hasPermission } = useAuth();
  const [dashboardData, setDashboardData] = useState({
    analytics: null,
    reviews: null,
    development: null,
    surveys: null
  });
  const [loading, setLoading] = useState(true);

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const promises = [];

      // Load analytics based on user role
      if (hasPermission('analytics', 'read_all')) {
        promises.push(analyticsAPI.getComprehensive().then(res => ({ type: 'analytics', data: res.data })));
      } else if (hasPermission('analytics', 'read_dept')) {
        promises.push(analyticsAPI.getDepartment().then(res => ({ type: 'analytics', data: res.data })));
      } else if (hasPermission('analytics', 'read_personal')) {
        promises.push(analyticsAPI.getPersonal().then(res => ({ type: 'analytics', data: res.data })));
      }

      // Load other data
      if (hasPermission('reviews', 'read')) {
        promises.push(reviewsAPI.getReviews().then(res => ({ type: 'reviews', data: res.data })));
        promises.push(reviewsAPI.getReviewStats().then(res => ({ type: 'reviewStats', data: res.data })));
      }

      if (hasPermission('development', 'read')) {
        promises.push(developmentAPI.getPlans().then(res => ({ type: 'development', data: res.data })));
        promises.push(developmentAPI.getStats().then(res => ({ type: 'developmentStats', data: res.data })));
      }

      if (hasPermission('surveys', 'read')) {
        promises.push(surveysAPI.getStats().then(res => ({ type: 'surveys', data: res.data })));
      }

      const results = await Promise.allSettled(promises);
      
      const newData = {};
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          const { type, data } = result.value;
          newData[type] = data;
        }
      });

      setDashboardData(prev => ({ ...prev, ...newData }));
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, [hasPermission]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const getRoleBasedTitle = () => {
    switch (user?.role) {
      case 'HR_Manager':
        return 'Organization Overview';
      case 'Department_Supervisor':
        return `${user?.department} Department Overview`;
      case 'Employee':
        return 'Personal Dashboard';
      default:
        return 'Dashboard';
    }
  };

  const getRoleBasedDescription = () => {
    switch (user?.role) {
      case 'HR_Manager':
        return 'Comprehensive view of organization-wide performance metrics and analytics';
      case 'Department_Supervisor':
        return `Performance insights and team management for ${user?.department} department`;
      case 'Employee':
        return 'Your personal performance tracking and development progress';
      default:
        return 'Your performance dashboard';
    }
  };

  const renderAnalyticsCards = () => {
    if (!dashboardData.analytics) return null;

    const analytics = dashboardData.analytics;
    
    if (user?.role === 'HR_Manager' && analytics.department_performance) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {analytics.department_performance.map((dept, index) => (
            <div key={index} className="card">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-primary-600" />
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">{dept.department}</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {dept.avg_overall_rating?.toFixed(1) || 'N/A'}
                  </p>
                  <p className="text-xs text-gray-500">{dept.total_reviews} reviews</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (user?.role === 'Department_Supervisor' && analytics.team_performance) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <div className="card">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-green-600" />
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Team Members</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {analytics.team_performance.length}
                </p>
              </div>
            </div>
          </div>
          
          <div className="card">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Star className="w-5 h-5 text-blue-600" />
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Avg Rating</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {analytics.team_performance.reduce((sum, emp) => sum + (emp.avg_overall_rating || 0), 0) / analytics.team_performance.length || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-yellow-600" />
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Competency Gaps</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {analytics.competency_gaps?.length || 0}
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (user?.role === 'Employee' && analytics.personal_stats) {
      const stats = analytics.personal_stats;
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="card">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Reviews</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.total_reviews}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <Star className="w-5 h-5 text-green-600" />
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Avg Rating</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {stats.average_rating?.toFixed(1) || 'N/A'}
                </p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Target className="w-5 h-5 text-purple-600" />
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Dev Plans</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.development_plans}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-yellow-600" />
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Completed</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.completed_plans}</p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  const renderCharts = () => {
    if (!dashboardData.analytics) return null;

    const analytics = dashboardData.analytics;

    if (user?.role === 'Employee' && analytics.performance_trends) {
      const trends = analytics.performance_trends;
      if (trends.length === 0) return null;

      return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="card">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Performance Trend</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="review_period" />
                <YAxis domain={[1, 5]} />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey="overall_rating" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Rating Breakdown</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={[
                { name: 'Technical', value: trends[trends.length - 1]?.technical_rating || 0 },
                { name: 'Communication', value: trends[trends.length - 1]?.communication_rating || 0 },
                { name: 'Leadership', value: trends[trends.length - 1]?.leadership_rating || 0 }
              ]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis domain={[1, 5]} />
                <Tooltip />
                <Bar dataKey="value" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
    }

    return null;
  };

  const renderQuickActions = () => {
    const actions = [];

    if (hasPermission('reviews', 'create')) {
      actions.push({
        title: 'Create Review',
        description: 'Start a new performance review',
        href: '/reviews',
        icon: FileText,
        color: 'bg-blue-100 text-blue-600'
      });
    }

    if (hasPermission('development', 'create')) {
      actions.push({
        title: 'Create Development Plan',
        description: 'Set up a new development plan',
        href: '/development',
        icon: Target,
        color: 'bg-green-100 text-green-600'
      });
    }

    if (hasPermission('surveys', 'create')) {
      actions.push({
        title: 'Take Survey',
        description: 'Complete a feedback survey',
        href: '/surveys',
        icon: BarChart3,
        color: 'bg-purple-100 text-purple-600'
      });
    }

    if (actions.length === 0) return null;

    return (
      <div className="card">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {actions.map((action, index) => (
            <a
              key={index}
              href={action.href}
              className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              onClick={(e) => {
                e.preventDefault();
                window.location.href = action.href;
              }}
            >
              <div className="flex items-center">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${action.color}`}>
                  <action.icon className="w-5 h-5" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-900">{action.title}</p>
                  <p className="text-xs text-gray-500">{action.description}</p>
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    );
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
        <h1 className="text-2xl font-bold text-gray-900">{getRoleBasedTitle()}</h1>
        <p className="mt-1 text-sm text-gray-600">{getRoleBasedDescription()}</p>
      </div>

      {renderAnalyticsCards()}
      {renderCharts()}
      {renderQuickActions()}
    </div>
  );
};

export default Dashboard;