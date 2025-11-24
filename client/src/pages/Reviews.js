import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { reviewsAPI, usersAPI } from '../services/api';
import { Plus, Search, Edit, Eye, CheckCircle, Clock, Star } from 'lucide-react';
import toast from 'react-hot-toast';

const Reviews = () => {
  const { hasPermission } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [editingReview, setEditingReview] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [reviewers, setReviewers] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    loadData();
    // Load employees for selection and potential reviewers based on role
    usersAPI.getUsers().then(res => {
      const list = res.data.users || [];
      setEmployees(list);
      setReviewers(list);
    }).catch(() => {});
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const reviewsResponse = await reviewsAPI.getReviews();
      setReviews(reviewsResponse.data.reviews);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load reviews');
    } finally {
      setLoading(false);
    }
  };

  const filteredReviews = reviews.filter(review => {
    const matchesSearch = 
      review.employee_first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      review.employee_last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      review.review_period.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = !filterStatus || review.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'draft':
        return 'badge bg-gray-100 text-gray-800';
      case 'submitted':
        return 'badge bg-yellow-100 text-yellow-800';
      case 'approved':
        return 'badge bg-green-100 text-green-800';
      case 'completed':
        return 'badge bg-blue-100 text-blue-800';
      default:
        return 'badge bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'draft':
        return <Edit className="w-4 h-4" />;
      case 'submitted':
        return <Clock className="w-4 h-4" />;
      case 'approved':
        return <CheckCircle className="w-4 h-4" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const handleSubmitReview = async (reviewId) => {
    try {
      await reviewsAPI.submitReview(reviewId);
      toast.success('Review submitted successfully');
      loadData();
    } catch (error) {
      console.error('Error submitting review:', error);
      toast.error('Failed to submit review');
    }
  };

  const handleApproveReview = async (reviewId) => {
    try {
      await reviewsAPI.approveReview(reviewId);
      toast.success('Review approved successfully');
      loadData();
    } catch (error) {
      console.error('Error approving review:', error);
      toast.error('Failed to approve review');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  const renderRatingStars = (rating) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Star
          key={i}
          className={`w-4 h-4 ${
            i <= rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
          }`}
        />
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
            <h1 className="text-2xl font-bold text-gray-900">Performance Reviews</h1>
            <p className="mt-1 text-sm text-gray-600">
              Manage and track performance reviews
            </p>
          </div>
          {hasPermission('reviews', 'create') && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-primary flex items-center"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Review
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="label">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search reviews..."
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
              <option value="draft">Draft</option>
              <option value="submitted">Submitted</option>
              <option value="approved">Approved</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          
          <div className="flex items-end">
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterStatus('');
              }}
              className="btn-secondary w-full"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Reviews Table */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Employee
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Review Period
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Overall Rating
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Reviewer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredReviews.map((review) => (
                <tr key={review.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                          <span className="text-sm font-medium text-primary-600">
                            {review.employee_first_name[0]}{review.employee_last_name[0]}
                          </span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {review.employee_first_name} {review.employee_last_name}
                        </div>
                        <div className="text-sm text-gray-500">{review.employee_department}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {review.review_period}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {renderRatingStars(review.ratings?.overall || 0)}
                      <span className="ml-2 text-sm text-gray-900">
                        {review.ratings?.overall || 0}/5
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`badge flex items-center w-fit ${getStatusColor(review.status)}`}>
                      {getStatusIcon(review.status)}
                      <span className="ml-1">{review.status}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {review.reviewer_first_name} {review.reviewer_last_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(review.created_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => setEditingReview(review)}
                        className="text-primary-600 hover:text-primary-900"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      
                      {hasPermission('reviews', 'update') && review.status === 'draft' && (
                        <button
                          onClick={() => setEditingReview(review)}
                          className="text-indigo-600 hover:text-indigo-900"
                          title="Edit Review"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      )}
                      
                      {hasPermission('reviews', 'update') && review.status === 'draft' && (
                        <button
                          onClick={() => handleSubmitReview(review.id)}
                          className="text-green-600 hover:text-green-900"
                          title="Submit Review"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                      
                      {hasPermission('reviews', 'approve') && review.status === 'submitted' && (
                        <button
                          onClick={() => handleApproveReview(review.id)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Approve Review"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredReviews.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-500">
              {searchTerm || filterStatus
                ? 'No reviews found matching your filters'
                : 'No reviews found'
              }
            </div>
          </div>
        )}
      </div>

      {/* Review Details Modal */}
      {editingReview && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Review Details</h3>
                <button
                  onClick={() => setEditingReview(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
              
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="label">Employee</label>
                    <p className="text-sm text-gray-900">
                      {editingReview.employee_first_name} {editingReview.employee_last_name}
                    </p>
                  </div>
                  
                  <div>
                    <label className="label">Review Period</label>
                    <p className="text-sm text-gray-900">{editingReview.review_period}</p>
                  </div>
                  
                  <div>
                    <label className="label">Status</label>
                    <span className={`badge ${getStatusColor(editingReview.status)}`}>
                      {editingReview.status}
                    </span>
                  </div>
                  
                  <div>
                    <label className="label">Reviewer</label>
                    <p className="text-sm text-gray-900">
                      {editingReview.reviewer_first_name} {editingReview.reviewer_last_name}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="label">Overall Rating</label>
                  <div className="flex items-center">
                    {renderRatingStars(editingReview.ratings?.overall || 0)}
                    <span className="ml-2 text-sm text-gray-900">
                      {editingReview.ratings?.overall || 0}/5
                    </span>
                  </div>
                </div>

                <div>
                  <label className="label">Detailed Ratings</label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Technical</p>
                      <div className="flex items-center">
                        {renderRatingStars(editingReview.ratings?.technical || 0)}
                        <span className="ml-2 text-sm text-gray-900">
                          {editingReview.ratings?.technical || 0}/5
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Communication</p>
                      <div className="flex items-center">
                        {renderRatingStars(editingReview.ratings?.communication || 0)}
                        <span className="ml-2 text-sm text-gray-900">
                          {editingReview.ratings?.communication || 0}/5
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Leadership</p>
                      <div className="flex items-center">
                        {renderRatingStars(editingReview.ratings?.leadership || 0)}
                        <span className="ml-2 text-sm text-gray-900">
                          {editingReview.ratings?.leadership || 0}/5
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {editingReview.comments && (
                  <div>
                    <label className="label">Comments</label>
                    <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded-lg">
                      {editingReview.comments}
                    </p>
                  </div>
                )}

                <div>
                  <label className="label">Goals</label>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    {editingReview.goals_set?.map((goal, index) => (
                      <div key={index} className="text-sm text-gray-900 mb-1">
                        • {goal}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end space-x-2 mt-6">
                <button
                  onClick={() => setEditingReview(null)}
                  className="btn-secondary"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Review Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Create New Review</h3>
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
                const reviewData = {
                  employee_id: parseInt(formData.get('employeeId')),
                  review_period: formData.get('reviewPeriod'),
                  reviewer_id: formData.get('reviewerId') ? parseInt(formData.get('reviewerId')) : undefined,
                  goals_set: formData.get('goalsSet') ? formData.get('goalsSet').split('\n').filter(goal => goal.trim()) : ['Initial goal setting'],
                  ratings: {
                    overall: 3,
                    technical: 3,
                    communication: 3,
                    leadership: 3
                  },
                  competencies: {
                    technical: 3,
                    communication: 3,
                    leadership: 3,
                    problem_solving: 3
                  },
                  comments: formData.get('comments') || ''
                };
                
                try {
                  await reviewsAPI.createReview(reviewData);
                  toast.success('Review created successfully');
                  setShowCreateModal(false);
                  loadData();
                } catch (error) {
                  console.error('Error creating review:', error);
                  toast.error('Failed to create review');
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
                    <label className="label">Review Period</label>
                    <input
                      type="text"
                      name="reviewPeriod"
                      className="input-field"
                      placeholder="e.g., Q1 2024"
                      required
                    />
                  </div>
                  
                  {hasPermission('reviews', 'create') && (
                    <div>
                      <label className="label">Reviewer</label>
                      <select
                        name="reviewerId"
                        className="input-field"
                      >
                        <option value="">Assign (optional)</option>
                        {reviewers.map(r => (
                          <option key={r.id} value={r.id}>
                            {r.first_name} {r.last_name} ({r.role})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  
                  <div>
                    <label className="label">Goals Set (one per line)</label>
                    <textarea
                      name="goalsSet"
                      className="input-field"
                      rows={3}
                      placeholder="Enter goals, one per line..."
                    />
                  </div>
                  
                  <div>
                    <label className="label">Comments (Optional)</label>
                    <textarea
                      name="comments"
                      className="input-field"
                      rows={2}
                      placeholder="Additional comments..."
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
                    Create Review
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

export default Reviews;
