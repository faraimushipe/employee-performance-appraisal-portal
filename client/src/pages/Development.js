import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { developmentAPI, usersAPI } from '../services/api';
import { Plus, Search, Edit, Eye, Target, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const Development = () => {
  const { hasPermission } = useAuth();
  const { addNotification } = useNotifications();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [editingPlan, setEditingPlan] = useState(null);
  const [showProgressModal, setShowProgressModal] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    loadData();
    usersAPI.getUsers().then(res => setEmployees(res.data.users || [])).catch(() => {});
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const plansResponse = await developmentAPI.getPlans();
      setPlans(plansResponse.data.development_plans);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load development plans');
    } finally {
      setLoading(false);
    }
  };

  const filteredPlans = plans.filter(plan => {
    const matchesSearch = 
      plan.employee_first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      plan.employee_last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      plan.skill_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      plan.skill_category.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = !filterStatus || plan.completion_status === filterStatus;
    const matchesCategory = !filterCategory || plan.skill_category === filterCategory;
    
    return matchesSearch && matchesStatus && matchesCategory;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'not_started':
        return 'badge bg-gray-100 text-gray-800';
      case 'in_progress':
        return 'badge bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'badge bg-green-100 text-green-800';
      case 'cancelled':
        return 'badge bg-red-100 text-red-800';
      default:
        return 'badge bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'not_started':
        return <Clock className="w-4 h-4" />;
      case 'in_progress':
        return <Target className="w-4 h-4" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4" />;
      case 'cancelled':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const handleCompletePlan = async (planId, impactRating) => {
    try {
      await developmentAPI.completePlan(planId, { impact_rating: impactRating });
      toast.success('Development plan completed successfully');
      loadData();
    } catch (error) {
      console.error('Error completing plan:', error);
      toast.error('Failed to complete development plan');
    }
  };

  const handleEditPlan = async (planId, planData) => {
    try {
      await developmentAPI.updatePlan(planId, planData);
      toast.success('Development plan updated successfully');
      setEditingPlan(null);
      loadData();
    } catch (error) {
      console.error('Error updating plan:', error);
      toast.error('Failed to update development plan');
    }
  };

  const handleAddProgress = async (planId, progressData) => {
    try {
      await developmentAPI.addProgress(planId, progressData);
      toast.success('Progress update added successfully');
      
      // Add notification
      addNotification({
        type: 'development',
        title: 'Development Progress Updated',
        message: `Progress has been updated for your development plan.`,
        action: {
          label: 'View Details',
          onClick: () => {
            // Navigate to development page or open modal
            window.location.href = '/development';
          }
        }
      });
      
      loadData();
    } catch (error) {
      console.error('Error adding progress:', error);
      toast.error('Failed to add progress update');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  const renderProgressBar = (current, target) => {
    const percentage = (current / target) * 100;
    return (
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-primary-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${Math.min(percentage, 100)}%` }}
        ></div>
      </div>
    );
  };

  const renderStars = (rating) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <span
          key={i}
          className={`text-lg ${
            i <= rating ? 'text-yellow-400' : 'text-gray-300'
          }`}
        >
          ★
        </span>
      );
    }
    return stars;
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
            <h1 className="text-2xl font-bold text-gray-900">Development Plans</h1>
            <p className="mt-1 text-sm text-gray-600">
              Track and manage employee development plans
            </p>
          </div>
          {hasPermission('development', 'create') && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-primary flex items-center"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Plan
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
                placeholder="Search plans..."
                className="input-field pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          
          <div>
            <label className="label">Status</label>
            <select
              className="input-field"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="not_started">Not Started</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          
          <div>
            <label className="label">Category</label>
            <select
              className="input-field"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="">All Categories</option>
              <option value="Technical">Technical</option>
              <option value="Leadership">Leadership</option>
              <option value="Communication">Communication</option>
              <option value="Management">Management</option>
              <option value="Soft Skills">Soft Skills</option>
            </select>
          </div>
          
          <div className="flex items-end">
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterStatus('');
                setFilterCategory('');
              }}
              className="btn-secondary w-full"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Development Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPlans.map((plan) => (
          <div key={plan.id} className="card hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="text-lg font-medium text-gray-900 mb-1">
                  {plan.skill_name}
                </h3>
                <p className="text-sm text-gray-500 mb-2">{plan.skill_category}</p>
                <div className="flex items-center">
                  <span className={`badge flex items-center w-fit ${getStatusColor(plan.completion_status)}`}>
                    {getStatusIcon(plan.completion_status)}
                    <span className="ml-1">{plan.completion_status.replace('_', ' ')}</span>
                  </span>
                </div>
                
                {/* Progress Bar */}
                <div className="mt-3">
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>Progress: {plan.current_level}/5</span>
                    <span>Target: {plan.target_level}/5</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-yellow-400 to-yellow-600 h-2 rounded-full transition-all duration-300"
                      style={{ 
                        width: `${Math.min((plan.current_level / plan.target_level) * 100, 100)}%` 
                      }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>Current Level</span>
                    <span>Target Level</span>
                  </div>
                </div>
              </div>
              <div className="flex space-x-1">
                <button
                  onClick={() => setEditingPlan(plan)}
                  className="text-primary-600 hover:text-primary-900"
                  title="View Details"
                >
                  <Eye className="w-4 h-4" />
                </button>
                {hasPermission('development', 'update') && (
                  <button
                    onClick={() => setEditingPlan(plan)}
                    className="text-indigo-600 hover:text-indigo-900"
                    title="Edit Plan"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm text-gray-600 mb-1">
                  <span>Progress</span>
                  <span>{plan.current_level}/{plan.target_level}</span>
                </div>
                {renderProgressBar(plan.current_level, plan.target_level)}
              </div>

              <div className="text-sm text-gray-600">
                <p><strong>Employee:</strong> {plan.employee_first_name} {plan.employee_last_name}</p>
                <p><strong>Created:</strong> {formatDate(plan.created_at)}</p>
                {plan.impact_rating && (
                  <div className="flex items-center mt-2">
                    <span className="text-sm text-gray-600 mr-2">Impact:</span>
                    <div className="flex">{renderStars(plan.impact_rating)}</div>
                  </div>
                )}
              </div>

              {plan.completion_status === 'in_progress' && hasPermission('development', 'update') && (
                <div className="flex space-x-2 pt-2">
                  <button
                    onClick={() => setShowProgressModal(plan.id)}
                    className="btn-secondary text-xs py-1 px-2"
                  >
                    Add Progress
                  </button>
                  <button
                    onClick={() => {
                      const rating = prompt('Enter impact rating (1-5):');
                      if (rating && rating >= 1 && rating <= 5) {
                        handleCompletePlan(plan.id, parseInt(rating));
                      }
                    }}
                    className="btn-primary text-xs py-1 px-2"
                  >
                    Complete
                  </button>
                </div>
              )}
              
              {plan.completion_status === 'completed' && (
                <div className="pt-2">
                  <div className="text-xs text-green-600 font-medium">
                    ✅ Completed
                    {plan.impact_rating && (
                      <span className="ml-2">
                        Impact: {'★'.repeat(plan.impact_rating)}{'☆'.repeat(5 - plan.impact_rating)}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredPlans.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-500">
            {searchTerm || filterStatus || filterCategory
              ? 'No development plans found matching your filters'
              : 'No development plans found'
            }
          </div>
        </div>
      )}

      {/* Plan Details Modal */}
      {editingPlan && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Development Plan Details</h3>
                <button
                  onClick={() => setEditingPlan(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
              
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="label">Skill Name</label>
                    <p className="text-sm text-gray-900">{editingPlan.skill_name}</p>
                  </div>
                  
                  <div>
                    <label className="label">Category</label>
                    <p className="text-sm text-gray-900">{editingPlan.skill_category}</p>
                  </div>
                  
                  <div>
                    <label className="label">Current Level</label>
                    <p className="text-sm text-gray-900">{editingPlan.current_level}/5</p>
                  </div>
                  
                  <div>
                    <label className="label">Target Level</label>
                    <p className="text-sm text-gray-900">{editingPlan.target_level}/5</p>
                  </div>
                  
                  <div>
                    <label className="label">Status</label>
                    <span className={`badge ${getStatusColor(editingPlan.completion_status)}`}>
                      {editingPlan.completion_status.replace('_', ' ')}
                    </span>
                  </div>
                  
                  <div>
                    <label className="label">Employee</label>
                    <p className="text-sm text-gray-900">
                      {editingPlan.employee_first_name} {editingPlan.employee_last_name}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="label">Progress</label>
                  <div className="mt-2">
                    {renderProgressBar(editingPlan.current_level, editingPlan.target_level)}
                    <div className="flex justify-between text-sm text-gray-600 mt-1">
                      <span>Current: {editingPlan.current_level}</span>
                      <span>Target: {editingPlan.target_level}</span>
                    </div>
                  </div>
                </div>

                {editingPlan.impact_rating && (
                  <div>
                    <label className="label">Impact Rating</label>
                    <div className="flex items-center">
                      {renderStars(editingPlan.impact_rating)}
                      <span className="ml-2 text-sm text-gray-900">
                        {editingPlan.impact_rating}/5
                      </span>
                    </div>
                  </div>
                )}

                {editingPlan.progress_updates && editingPlan.progress_updates.length > 0 && (
                  <div>
                    <label className="label">Progress Updates</label>
                    <div className="space-y-2">
                      {editingPlan.progress_updates.map((update, index) => (
                        <div key={index} className="bg-gray-50 p-3 rounded-lg">
                          <p className="text-sm text-gray-900">{update.text}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {formatDate(update.created_at)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              <form onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                const planData = {
                  skill_name: formData.get('skillName'),
                  skill_category: formData.get('skillCategory'),
                  current_level: parseInt(formData.get('currentLevel')),
                  target_level: parseInt(formData.get('targetLevel'))
                };
                await handleEditPlan(editingPlan.id, planData);
              }}>
                <div className="space-y-4">
                  <div>
                    <label className="label">Skill Name</label>
                    <input
                      type="text"
                      name="skillName"
                      className="input-field"
                      defaultValue={editingPlan.skill_name}
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="label">Skill Category</label>
                    <select
                      name="skillCategory"
                      className="input-field"
                      defaultValue={editingPlan.skill_category}
                      required
                    >
                      <option value="Technical">Technical</option>
                      <option value="Leadership">Leadership</option>
                      <option value="Communication">Communication</option>
                      <option value="Management">Management</option>
                      <option value="Soft Skills">Soft Skills</option>
                    </select>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">Current Level</label>
                      <select
                        name="currentLevel"
                        className="input-field"
                        defaultValue={editingPlan.current_level}
                        required
                      >
                        <option value="1">1 - Beginner</option>
                        <option value="2">2 - Novice</option>
                        <option value="3">3 - Intermediate</option>
                        <option value="4">4 - Advanced</option>
                        <option value="5">5 - Expert</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">Target Level</label>
                      <select
                        name="targetLevel"
                        className="input-field"
                        defaultValue={editingPlan.target_level}
                        required
                      >
                        <option value="1">1 - Beginner</option>
                        <option value="2">2 - Novice</option>
                        <option value="3">3 - Intermediate</option>
                        <option value="4">4 - Advanced</option>
                        <option value="5">5 - Expert</option>
                      </select>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end space-x-2 mt-6">
                  <button
                    type="button"
                    onClick={() => setEditingPlan(null)}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                  >
                    Update Plan
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Progress Modal */}
      {showProgressModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Add Progress Update</h3>
                <button
                  onClick={() => setShowProgressModal(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
              
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                const updateText = formData.get('updateText');
                const progressPercentage = formData.get('progressPercentage');
                
                if (updateText) {
                  handleAddProgress(showProgressModal, {
                    update_text: updateText,
                    progress_percentage: progressPercentage ? parseInt(progressPercentage) : null
                  });
                  setShowProgressModal(null);
                }
              }}>
                <div className="space-y-4">
                  <div>
                    <label className="label">Update Text</label>
                    <textarea
                      name="updateText"
                      className="input-field"
                      rows={3}
                      placeholder="Describe your progress..."
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="label">Progress Percentage (Optional)</label>
                    <input
                      type="number"
                      name="progressPercentage"
                      className="input-field"
                      min="0"
                      max="100"
                      placeholder="0-100"
                    />
                  </div>
                </div>
                
                <div className="flex justify-end space-x-2 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowProgressModal(null)}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                  >
                    Add Update
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Create Development Plan Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Create Development Plan</h3>
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
                const planData = {
                  employee_id: parseInt(formData.get('employeeId')),
                  skill_name: formData.get('skillName'),
                  skill_category: formData.get('skillCategory'),
                  current_level: parseInt(formData.get('currentLevel')),
                  target_level: parseInt(formData.get('targetLevel'))
                };
                
                try {
                  console.log('Sending plan data:', planData);
                  await developmentAPI.createPlan(planData);
                  toast.success('Development plan created successfully');
                  setShowCreateModal(false);
                  loadData();
                } catch (error) {
                  console.error('Error creating plan:', error);
                  console.error('Error response:', error.response?.data);
                  toast.error(`Failed to create development plan: ${error.response?.data?.message || error.message}`);
                }
              }}>
                <div className="space-y-4">
                  <div>
                    <label className="label">Employee</label>
                    <select
                      name="employeeId"
                      className="input-field"
                      required
                    >
                      <option value="">Select Employee</option>
                      {employees.map(e => (
                        <option key={e.id} value={e.id}>
                          {e.first_name} {e.last_name} ({e.department})
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="label">Skill Name</label>
                    <input
                      type="text"
                      name="skillName"
                      className="input-field"
                      placeholder="e.g., React Development"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="label">Skill Category</label>
                    <select
                      name="skillCategory"
                      className="input-field"
                      required
                    >
                      <option value="">Select Category</option>
                      <option value="Technical">Technical</option>
                      <option value="Leadership">Leadership</option>
                      <option value="Communication">Communication</option>
                      <option value="Management">Management</option>
                      <option value="Soft Skills">Soft Skills</option>
                    </select>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">Current Level</label>
                      <select
                        name="currentLevel"
                        className="input-field"
                        required
                      >
                        <option value="">Select Level</option>
                        <option value="1">1 - Beginner</option>
                        <option value="2">2 - Novice</option>
                        <option value="3">3 - Intermediate</option>
                        <option value="4">4 - Advanced</option>
                        <option value="5">5 - Expert</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">Target Level</label>
                      <select
                        name="targetLevel"
                        className="input-field"
                        required
                      >
                        <option value="">Select Level</option>
                        <option value="1">1 - Beginner</option>
                        <option value="2">2 - Novice</option>
                        <option value="3">3 - Intermediate</option>
                        <option value="4">4 - Advanced</option>
                        <option value="5">5 - Expert</option>
                      </select>
                    </div>
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
                    Create Plan
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

export default Development;
