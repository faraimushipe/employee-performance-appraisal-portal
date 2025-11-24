import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { surveysAPI } from '../services/api';
import { Plus, BarChart3, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const Surveys = () => {
  const { hasPermission } = useAuth();
  const [availableSurveys, setAvailableSurveys] = useState([]);
  const [responses, setResponses] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('available');
  const [selectedSurvey, setSelectedSurvey] = useState(null);
  const [surveyResponse, setSurveyResponse] = useState({});
  const [showCreateModal, setShowCreateModal] = useState(false); // Added missing state

  // ✅ FIX: loadData is defined BEFORE useEffect
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [surveysResponse, responsesResponse] = await Promise.all([
        surveysAPI.getAvailableSurveys(),
        surveysAPI.getResponses()
      ]);
      setAvailableSurveys(surveysResponse.data.available_surveys);
      setResponses(responsesResponse.data.responses);

      // Load analytics if user has permission
      if (hasPermission('surveys', 'analyze')) {
        try {
          const analyticsResponse = await surveysAPI.getAnalytics();
          setAnalytics(analyticsResponse.data);
        } catch (error) {
          console.log('Analytics not available for this user');
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load surveys');
    } finally {
      setLoading(false);
    }
  }, [hasPermission]);

  // ✅ Now useEffect comes AFTER loadData is defined
  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleTakeSurvey = (survey) => {
    setSelectedSurvey(survey);
    setSurveyResponse({});
  };

  const handleResponseChange = (questionId, value) => {
    setSurveyResponse(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  const handleSubmitSurvey = async () => {
    try {
      await surveysAPI.submitSurvey({
        survey_type: selectedSurvey.id,
        response_data: surveyResponse
      });
      toast.success('Survey submitted successfully');
      setSelectedSurvey(null);
      setSurveyResponse({});
      loadData();
    } catch (error) {
      console.error('Error submitting survey:', error);
      toast.error('Failed to submit survey');
    }
  };

  const renderRatingScale = (question, value, onChange) => {
    const scale = Array.from({ length: question.max - question.min + 1 }, (_, i) => i + question.min);
    
    return (
      <div className="flex items-center space-x-2">
        <span className="text-sm text-gray-600">{question.min}</span>
        <div className="flex space-x-1">
          {scale.map((rating) => (
            <button
              key={rating}
              type="button"
              onClick={() => onChange(question.id, rating)}
              className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-medium transition-colors ${
                value === rating
                  ? 'border-primary-500 bg-primary-100 text-primary-700'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              {rating}
            </button>
          ))}
        </div>
        <span className="text-sm text-gray-600">{question.max}</span>
      </div>
    );
  };

  const renderQuestion = (question) => {
    const value = surveyResponse[question.id] || '';

    switch (question.type) {
      case 'scale':
        return renderRatingScale(question, value, handleResponseChange);
      case 'text':
        return (
          <textarea
            value={value}
            onChange={(e) => handleResponseChange(question.id, e.target.value)}
            className="input-field"
            rows={3}
            placeholder="Enter your response..."
          />
        );
      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleResponseChange(question.id, e.target.value)}
            className="input-field"
            placeholder="Enter your response..."
          />
        );
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  const renderAnalyticsChart = (surveyType, data) => {
    if (!data.question_averages) return null;

    const chartData = Object.entries(data.question_averages).map(([questionId, stats]) => ({
      question: questionId.replace(/_/g, ' '),
      average: stats.average.toFixed(1)
    }));

    return (
      <div className="card">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          {surveyType.replace(/_/g, ' ')} - Question Averages
        </h3>
        <div className="space-y-3">
          {chartData.map((item, index) => (
            <div key={index} className="flex items-center justify-between">
              <span className="text-sm text-gray-600">{item.question}</span>
              <div className="flex items-center">
                <div className="w-32 bg-gray-200 rounded-full h-2 mr-2">
                  <div
                    className="bg-primary-600 h-2 rounded-full"
                    style={{ width: `${(item.average / 5) * 100}%` }}
                  ></div>
                </div>
                <span className="text-sm font-medium text-gray-900">{item.average}/5</span>
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
        <h1 className="text-2xl font-bold text-gray-900">Surveys</h1>
        <p className="mt-1 text-sm text-gray-600">
          Participate in surveys and view analytics
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('available')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'available'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Available Surveys
          </button>
          <button
            onClick={() => setActiveTab('responses')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'responses'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            My Responses
          </button>
          {hasPermission('surveys', 'analyze') && (
            <button
              onClick={() => setActiveTab('analytics')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'analytics'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Analytics
            </button>
          )}
        </nav>
      </div>

      {/* Available Surveys Tab */}
      {activeTab === 'available' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {availableSurveys.map((survey) => (
            <div key={survey.id} className="card hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {survey.title}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {survey.questions.length} questions
                  </p>
                </div>
                <BarChart3 className="w-8 h-8 text-primary-600" />
              </div>
              
              <div className="space-y-2">
                <p className="text-sm text-gray-600">
                  {survey.questions.slice(0, 2).map(q => q.text).join(', ')}
                  {survey.questions.length > 2 && '...'}
                </p>
              </div>
              
              <div className="mt-4">
                <button
                  onClick={() => handleTakeSurvey(survey)}
                  className="btn-primary w-full flex items-center justify-center"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Take Survey
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* My Responses Tab */}
      {activeTab === 'responses' && (
        <div className="space-y-4">
          {responses.map((response) => (
            <div key={response.id} className="card">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">
                    {response.survey_type.replace(/_/g, ' ')}
                  </h3>
                  <p className="text-sm text-gray-500">
                    Submitted on {formatDate(response.created_at)}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="text-sm text-green-600">Completed</span>
                </div>
              </div>
              
              <div className="mt-4">
                <button
                  onClick={() => {
                    setSelectedSurvey({ id: response.survey_type, questions: [] });
                    setSurveyResponse(response.response_data);
                  }}
                  className="text-primary-600 hover:text-primary-900 text-sm font-medium"
                >
                  View Response
                </button>
              </div>
            </div>
          ))}
          
          {responses.length === 0 && (
            <div className="text-center py-12">
              <div className="text-gray-500">No survey responses found</div>
            </div>
          )}
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && analytics && (
        <div className="space-y-6">
          {Object.entries(analytics.survey_analytics).map(([surveyType, data]) => (
            <div key={surveyType}>
              {renderAnalyticsChart(surveyType, data)}
            </div>
          ))}
          
          {Object.keys(analytics.survey_analytics).length === 0 && (
            <div className="text-center py-12">
              <div className="text-gray-500">No analytics data available</div>
            </div>
          )}
        </div>
      )}

      {/* Survey Modal */}
      {selectedSurvey && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-medium text-gray-900">
                  {selectedSurvey.title}
                </h3>
                <button
                  onClick={() => {
                    setSelectedSurvey(null);
                    setSurveyResponse({});
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
              
              <div className="space-y-6 max-h-96 overflow-y-auto">
                {selectedSurvey.questions?.map((question, index) => (
                  <div key={question.id} className="border-b border-gray-200 pb-4">
                    <label className="label text-base">
                      {index + 1}. {question.text}
                    </label>
                    <div className="mt-2">
                      {renderQuestion(question)}
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="flex justify-end space-x-2 mt-6">
                <button
                  onClick={() => {
                    setSelectedSurvey(null);
                    setSurveyResponse({});
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitSurvey}
                  className="btn-primary"
                >
                  Submit Survey
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Surveys;