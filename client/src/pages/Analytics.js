import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { analyticsAPI } from '../services/api';
import {
  BarChart3,
  TrendingUp,
  Users,
  Target,
  Star,
  Download,
  RefreshCw
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';
import toast from 'react-hot-toast';

const Analytics = () => {
  const { user, hasPermission } = useAuth();
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);

  // ✅ FIX: Move loadAnalytics to be defined BEFORE useEffect
  const loadAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      let response;
      
      if (hasPermission('analytics', 'read_all')) {
        response = await analyticsAPI.getComprehensive();
      } else if (hasPermission('analytics', 'read_dept')) {
        response = await analyticsAPI.getDepartment();
      } else if (hasPermission('analytics', 'read_personal')) {
        response = await analyticsAPI.getPersonal();
      } else {
        toast.error('You do not have permission to view analytics');
        return;
      }
      
      setAnalyticsData(response.data);
    } catch (error) {
      console.error('Error loading analytics:', error);
      toast.error('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  }, [hasPermission]);

  // ✅ Now useEffect comes AFTER loadAnalytics is defined
  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const handleExport = async (format) => {
    try {
      if (hasPermission('analytics', 'export')) {
        const response = await analyticsAPI.exportData(format);
        
        if (format === 'json') {
          const dataStr = JSON.stringify(response.data, null, 2);
          const dataBlob = new Blob([dataStr], { type: 'application/json' });
          const url = URL.createObjectURL(dataBlob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `analytics_export_${new Date().toISOString().split('T')[0]}.json`;
          link.click();
          URL.revokeObjectURL(url);
        } else if (format === 'csv') {
          const blob = new Blob([response.data], { type: 'text/csv' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `analytics_export_${new Date().toISOString().split('T')[0]}.csv`;
          link.click();
          URL.revokeObjectURL(url);
        }
        
        toast.success('Data exported successfully');
      } else {
        toast.error('You do not have permission to export data');
      }
    } catch (error) {
      console.error('Error exporting data:', error);
      toast.error('Failed to export data');
    }
  };

  const getRoleBasedTitle = () => {
    switch (user?.role) {
      case 'HR_Manager':
        return 'Organization Analytics';
      case 'Department_Supervisor':
        return `${user?.department} Department Analytics`;
      case 'Employee':
        return 'Personal Analytics';
      default:
        return 'Analytics';
    }
  };

  const renderOverviewCards = () => {
    if (!analyticsData) return null;

    if (user?.role === 'HR_Manager' && analyticsData.department_performance) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {analyticsData.department_performance.map((dept, index) => (
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

    if (user?.role === 'Department_Supervisor' && analyticsData.team_performance) {
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
                  {analyticsData.team_performance.length}
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
                  {(analyticsData.team_performance.reduce((sum, emp) => sum + (emp.avg_overall_rating || 0), 0) / analyticsData.team_performance.length || 0).toFixed(1)}
                </p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <Target className="w-5 h-5 text-yellow-600" />
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Competency Gaps</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {analyticsData.competency_gaps?.length || 0}
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (user?.role === 'Employee' && analyticsData.personal_stats) {
      const stats = analyticsData.personal_stats;
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="card">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-blue-600" />
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
                  <TrendingUp className="w-5 h-5 text-yellow-600" />
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
    if (!analyticsData) return null;

    if (user?.role === 'Employee' && analyticsData.performance_trends) {
      const trends = analyticsData.performance_trends;
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

    if (user?.role === 'HR_Manager' && analyticsData.department_performance) {
      const deptData = analyticsData.department_performance.map(dept => ({
        name: dept.department,
        overall: dept.avg_overall_rating || 0,
        technical: dept.avg_technical_rating || 0,
        communication: dept.avg_communication_rating || 0,
        leadership: dept.avg_leadership_rating || 0
      }));

      return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="card">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Department Performance</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={deptData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis domain={[1, 5]} />
                <Tooltip />
                <Bar dataKey="overall" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Competency Comparison</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={deptData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis domain={[1, 5]} />
                <Tooltip />
                <Bar dataKey="technical" fill="#10b981" />
                <Bar dataKey="communication" fill="#f59e0b" />
                <Bar dataKey="leadership" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
    }

    return null;
  };

  const renderRecommendations = () => {
    if (!analyticsData?.recommendations) return null;

    return (
      <div className="card">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Recommendations</h3>
        <div className="space-y-3">
          {analyticsData.recommendations.map((rec, index) => (
            <div key={index} className={`p-3 rounded-lg ${
              rec.priority === 'high' ? 'bg-red-50 border border-red-200' :
              rec.priority === 'medium' ? 'bg-yellow-50 border border-yellow-200' :
              'bg-blue-50 border border-blue-200'
            }`}>
              <div className="flex items-start">
                <div className={`w-2 h-2 rounded-full mt-2 mr-3 ${
                  rec.priority === 'high' ? 'bg-red-500' :
                  rec.priority === 'medium' ? 'bg-yellow-500' :
                  'bg-blue-500'
                }`}></div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{rec.message}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {rec.type?.replace('_', ' ')} • {rec.priority} priority
                  </p>
                </div>
              </div>
            </div>
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
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{getRoleBasedTitle()}</h1>
            <p className="mt-1 text-sm text-gray-600">
              Comprehensive performance analytics and insights
            </p>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={loadAnalytics}
              className="btn-secondary flex items-center"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </button>
            {hasPermission('analytics', 'export') && (
              <div className="flex space-x-1">
                <button
                  onClick={() => handleExport('json')}
                  className="btn-secondary flex items-center"
                >
                  <Download className="w-4 h-4 mr-2" />
                  JSON
                </button>
                <button
                  onClick={() => handleExport('csv')}
                  className="btn-secondary flex items-center"
                >
                  <Download className="w-4 h-4 mr-2" />
                  CSV
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {renderOverviewCards()}
      {renderCharts()}
      {renderRecommendations()}

      {!analyticsData && (
        <div className="text-center py-12">
          <div className="text-gray-500">No analytics data available</div>
        </div>
      )}
    </div>
  );
};

export default Analytics;