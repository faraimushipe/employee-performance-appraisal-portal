const express = require('express');
const { body, validationResult } = require('express-validator');
const { db } = require('../database/postgres');
const { authenticateToken, authorize, departmentScope, checkPermission, auditLog } = require('../middleware/auth');

const router = express.Router();

// Survey templates for different roles
const SURVEY_TEMPLATES = {
  employee: {
    appraisal_satisfaction: {
      title: 'Appraisal Process Satisfaction Survey',
      questions: [
        { id: 'process_fairness', text: 'How fair do you find the appraisal process?', type: 'scale', min: 1, max: 5 },
        { id: 'feedback_helpfulness', text: 'How helpful was the feedback you received?', type: 'scale', min: 1, max: 5 },
        { id: 'goal_clarity', text: 'How clear were your performance goals?', type: 'scale', min: 1, max: 5 },
        { id: 'development_support', text: 'How well does the system support your development?', type: 'scale', min: 1, max: 5 },
        { id: 'supervisor_support', text: 'How supportive is your supervisor?', type: 'scale', min: 1, max: 5 },
        { id: 'motivation_impact', text: 'How has the appraisal process affected your motivation?', type: 'scale', min: 1, max: 5 },
        { id: 'suggestions', text: 'What suggestions do you have for improving the process?', type: 'text' }
      ]
    },
    development_effectiveness: {
      title: 'Development Plan Effectiveness Survey',
      questions: [
        { id: 'plan_relevance', text: 'How relevant is your development plan to your role?', type: 'scale', min: 1, max: 5 },
        { id: 'resource_availability', text: 'Are adequate resources available for your development?', type: 'scale', min: 1, max: 5 },
        { id: 'progress_tracking', text: 'How well can you track your development progress?', type: 'scale', min: 1, max: 5 },
        { id: 'skill_improvement', text: 'Have you seen improvement in your skills?', type: 'scale', min: 1, max: 5 },
        { id: 'career_impact', text: 'How has this impacted your career development?', type: 'scale', min: 1, max: 5 }
      ]
    }
  },
  supervisor: {
    system_usability: {
      title: 'System Usability Survey',
      questions: [
        { id: 'ease_of_use', text: 'How easy is the system to use?', type: 'scale', min: 1, max: 5 },
        { id: 'efficiency', text: 'How efficient is the review process?', type: 'scale', min: 1, max: 5 },
        { id: 'team_insights', text: 'How well does the system provide team insights?', type: 'scale', min: 1, max: 5 },
        { id: 'resource_allocation', text: 'How helpful is the system for resource allocation?', type: 'scale', min: 1, max: 5 },
        { id: 'hr_support', text: 'How supportive is HR in the process?', type: 'scale', min: 1, max: 5 }
      ]
    },
    management_effectiveness: {
      title: 'Management Effectiveness Survey',
      questions: [
        { id: 'team_performance', text: 'How would you rate your team\'s overall performance?', type: 'scale', min: 1, max: 5 },
        { id: 'development_support', text: 'How well do you support team development?', type: 'scale', min: 1, max: 5 },
        { id: 'feedback_quality', text: 'How effective is your feedback to team members?', type: 'scale', min: 1, max: 5 },
        { id: 'challenges', text: 'What are your main challenges in managing performance?', type: 'text' }
      ]
    }
  },
  hr_manager: {
    strategic_impact: {
      title: 'Strategic Impact Assessment Survey',
      questions: [
        { id: 'roi_measurement', text: 'How well can you measure ROI of the appraisal system?', type: 'scale', min: 1, max: 5 },
        { id: 'policy_effectiveness', text: 'How effective are current HR policies?', type: 'scale', min: 1, max: 5 },
        { id: 'cross_dept_coordination', text: 'How well do departments coordinate?', type: 'scale', min: 1, max: 5 },
        { id: 'strategic_alignment', text: 'How well aligned is the system with strategic goals?', type: 'scale', min: 1, max: 5 },
        { id: 'organizational_impact', text: 'What is the overall organizational impact?', type: 'scale', min: 1, max: 5 }
      ]
    }
  }
};

// Get available surveys for user's role
router.get('/available', [
  authenticateToken,
  checkPermission('surveys', 'read')
], async (req, res) => {
  try {
    const userRole = req.user.role;
    let availableSurveys = [];

    if (userRole === 'Employee') {
      availableSurveys = Object.keys(SURVEY_TEMPLATES.employee).map(key => ({
        id: key,
        ...SURVEY_TEMPLATES.employee[key]
      }));
    } else if (userRole === 'Department_Supervisor') {
      availableSurveys = Object.keys(SURVEY_TEMPLATES.supervisor).map(key => ({
        id: key,
        ...SURVEY_TEMPLATES.supervisor[key]
      }));
    } else if (userRole === 'HR_Manager') {
      availableSurveys = Object.keys(SURVEY_TEMPLATES.hr_manager).map(key => ({
        id: key,
        ...SURVEY_TEMPLATES.hr_manager[key]
      }));
    }

    res.json({
      available_surveys: availableSurveys,
      user_role: userRole
    });

  } catch (error) {
    console.error('Get available surveys error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch available surveys'
    });
  }
});

// Get survey template
router.get('/template/:surveyType', [
  authenticateToken,
  checkPermission('surveys', 'read')
], (req, res) => {
  try {
    const { surveyType } = req.params;
    const userRole = req.user.role;

    let template = null;

    if (userRole === 'Employee' && SURVEY_TEMPLATES.employee[surveyType]) {
      template = SURVEY_TEMPLATES.employee[surveyType];
    } else if (userRole === 'Department_Supervisor' && SURVEY_TEMPLATES.supervisor[surveyType]) {
      template = SURVEY_TEMPLATES.supervisor[surveyType];
    } else if (userRole === 'HR_Manager' && SURVEY_TEMPLATES.hr_manager[surveyType]) {
      template = SURVEY_TEMPLATES.hr_manager[surveyType];
    }

    if (!template) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Survey template not found for your role'
      });
    }

    res.json({
      survey_template: template,
      survey_type: surveyType
    });

  } catch (error) {
    console.error('Get survey template error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch survey template'
    });
  }
});

// Submit survey response
router.post('/submit', [
  authenticateToken,
  checkPermission('surveys', 'create'),
  body('survey_type').notEmpty().trim(),
  body('response_data').isObject()
], auditLog('create', 'survey_response'), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        details: errors.array()
      });
    }

    const { survey_type, response_data } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;
    const department = req.user.department;

    // Validate survey type for user role
    const validSurveyTypes = {
      'Employee': Object.keys(SURVEY_TEMPLATES.employee),
      'Department_Supervisor': Object.keys(SURVEY_TEMPLATES.supervisor),
      'HR_Manager': Object.keys(SURVEY_TEMPLATES.hr_manager)
    };

    if (!validSurveyTypes[userRole].includes(survey_type)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid survey type for your role'
      });
    }

    // Check if user has already submitted this survey type
    const existingResponse = await db.get(
      'SELECT id FROM SurveyResponses WHERE user_id = ? AND survey_type = ?',
      [userId, survey_type]
    );

    if (existingResponse) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'You have already submitted this survey'
      });
    }

    // Create survey response
    const result = await db.run(
      `INSERT INTO SurveyResponses (user_id, survey_type, response_data, role, department)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, survey_type, JSON.stringify(response_data), userRole, department]
    );

    res.status(201).json({
      message: 'Survey response submitted successfully',
      response_id: result.id
    });

  } catch (error) {
    console.error('Submit survey error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to submit survey response'
    });
  }
});

// Get user's survey responses
router.get('/responses', [
  authenticateToken,
  checkPermission('surveys', 'read')
], async (req, res) => {
  try {
    const userId = req.user.id;

    const sql = `
      SELECT 
        id,
        survey_type,
        response_data,
        created_at
      FROM SurveyResponses
      WHERE user_id = ?
      ORDER BY created_at DESC
    `;

    try {
      const rows = await db.all(sql, [userId]);
      
      const responses = rows.map(row => ({
        ...row,
        response_data: JSON.parse(row.response_data)
      }));

      res.json({
        responses,
        count: responses.length
      });
    } catch (err) {
      console.error('Database error:', err);
      return res.status(500).json({
        error: 'Database Error',
        message: 'Failed to fetch survey responses'
      });
    }

  } catch (error) {
    console.error('Get survey responses error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch survey responses'
    });
  }
});

// Get survey analytics (HR Manager and Department Supervisor)
router.get('/analytics', [
  authenticateToken,
  authorize('HR_Manager', 'Department_Supervisor'),
  departmentScope,
  checkPermission('surveys', 'analyze')
], (req, res) => {
  try {
    let sql = `
      SELECT 
        survey_type,
        role,
        department,
        response_data,
        created_at
      FROM SurveyResponses
      WHERE 1=1
    `;
    const params = [];

    // Apply department scope filtering
    if (req.departmentScope) {
      sql += ' AND department = ?';
      params.push(req.departmentScope);
    }

    sql += ' ORDER BY created_at DESC';

    db.all(sql, params, (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({
          error: 'Database Error',
          message: 'Failed to fetch survey analytics'
        });
      }

      // Process responses for analytics
      const analytics = {};
      
      rows.forEach(row => {
        const surveyType = row.survey_type;
        const role = row.role;
        const department = row.department;
        const responseData = JSON.parse(row.response_data);
        
        if (!analytics[surveyType]) {
          analytics[surveyType] = {
            total_responses: 0,
            by_role: {},
            by_department: {},
            question_averages: {}
          };
        }
        
        analytics[surveyType].total_responses++;
        
        // Count by role
        if (!analytics[surveyType].by_role[role]) {
          analytics[surveyType].by_role[role] = 0;
        }
        analytics[surveyType].by_role[role]++;
        
        // Count by department
        if (!analytics[surveyType].by_department[department]) {
          analytics[surveyType].by_department[department] = 0;
        }
        analytics[surveyType].by_department[department]++;
        
        // Calculate question averages
        Object.entries(responseData).forEach(([questionId, answer]) => {
          if (typeof answer === 'number') {
            if (!analytics[surveyType].question_averages[questionId]) {
              analytics[surveyType].question_averages[questionId] = {
                total: 0,
                count: 0,
                average: 0
              };
            }
            analytics[surveyType].question_averages[questionId].total += answer;
            analytics[surveyType].question_averages[questionId].count++;
            analytics[surveyType].question_averages[questionId].average = 
              analytics[surveyType].question_averages[questionId].total / 
              analytics[surveyType].question_averages[questionId].count;
          }
        });
      });

      res.json({
        survey_analytics: analytics,
        generated_at: new Date().toISOString()
      });
    });

  } catch (error) {
    console.error('Get survey analytics error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch survey analytics'
    });
  }
});

// Get survey response statistics
router.get('/stats', [
  authenticateToken,
  authorize('HR_Manager', 'Department_Supervisor'),
  departmentScope,
  checkPermission('surveys', 'analyze')
], (req, res) => {
  try {
    let sql = `
      SELECT 
        survey_type,
        role,
        department,
        COUNT(*) as response_count,
        MIN(created_at) as first_response,
        MAX(created_at) as last_response
      FROM SurveyResponses
      WHERE 1=1
    `;
    const params = [];

    // Apply department scope filtering
    if (req.departmentScope) {
      sql += ' AND department = ?';
      params.push(req.departmentScope);
    }

    sql += ' GROUP BY survey_type, role, department ORDER BY survey_type, role, department';

    db.all(sql, params, (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({
          error: 'Database Error',
          message: 'Failed to fetch survey statistics'
        });
      }

      res.json({
        survey_statistics: rows,
        generated_at: new Date().toISOString()
      });
    });

  } catch (error) {
    console.error('Get survey stats error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch survey statistics'
    });
  }
});

// Export survey data for research
router.get('/export/:format', [
  authenticateToken,
  authorize('HR_Manager'),
  checkPermission('surveys', 'analyze')
], async (req, res) => {
  try {
    const format = req.params.format;
    
    if (!['json', 'csv'].includes(format)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid export format. Supported formats: json, csv'
      });
    }

    // Get all survey data for export
    const exportData = await db.all(`
      SELECT 
        sr.id as response_id,
        u.id as user_id,
        u.first_name,
        u.last_name,
        u.department,
        u.role,
        sr.survey_type,
        sr.response_data,
        sr.created_at
      FROM SurveyResponses sr
      JOIN Users u ON sr.user_id = u.id
      ORDER BY sr.created_at DESC
    `);

    if (format === 'json') {
      res.json({
        export_data: exportData,
        export_metadata: {
          generated_at: new Date().toISOString(),
          total_records: exportData.length,
          format: 'json'
        }
      });
    } else if (format === 'csv') {
      // Convert to CSV format
      const csvHeaders = [
        'response_id', 'user_id', 'first_name', 'last_name', 'department', 'role',
        'survey_type', 'response_data', 'created_at'
      ];
      
      const csvRows = exportData.map(row => 
        csvHeaders.map(header => {
          const value = row[header];
          if (typeof value === 'object') {
            return JSON.stringify(value);
          }
          return value || '';
        }).join(',')
      );
      
      const csvContent = [csvHeaders.join(','), ...csvRows].join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=survey_data.csv');
      res.send(csvContent);
    }

  } catch (error) {
    console.error('Export survey data error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to export survey data'
    });
  }
});

module.exports = router;
