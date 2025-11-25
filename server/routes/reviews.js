const express = require('express');
const { body, validationResult } = require('express-validator');
const { db } = require('../database/postgres');
const { authenticateToken, authorize, departmentScope, checkPermission, auditLog } = require('../middleware/auth');

// Helper function to safely parse JSON
const safeJsonParse = (value, defaultValue = null) => {
  try {
    return value ? JSON.parse(value) : defaultValue;
  } catch (e) {
    console.warn('Failed to parse JSON:', e);
    return defaultValue;
  }
};

const router = express.Router();

// Get all performance reviews (with role-based filtering)
router.get('/', [
  authenticateToken,
  departmentScope,
  checkPermission('reviews', 'read')
], async (req, res) => {
  try {
    let sql = `
      SELECT 
        pr.*,
        e.first_name as employee_first_name,
        e.last_name as employee_last_name,
        e.department as employee_department,
        r.first_name as reviewer_first_name,
        r.last_name as reviewer_last_name
      FROM PerformanceReviews pr
      JOIN Users e ON pr.employee_id = e.id
      JOIN Users r ON pr.reviewer_id = r.id
      WHERE 1=1
    `;
    const params = [];

    // Apply role-based filtering
    if (req.user.role === 'Employee') {
      sql += ' AND pr.employee_id = $1';
      params.push(req.user.id);
    } else if (req.user.role === 'Department_Supervisor') {
      sql += ' AND e.department = $1';
      params.push(req.user.department);
    }

    // Apply department scope filtering
    if (req.departmentScope) {
      sql += ' AND e.department = $' + (params.length + 1);
      params.push(req.departmentScope);
    }

    sql += ' ORDER BY pr.created_at DESC';

    try {
      const rows = await db.all(sql, params);
      
      // Safely parse JSON fields
      const reviews = rows.map(row => {
        const parsedRow = { ...row };
        
        // Helper function to safely parse JSON
        const safeJsonParse = (value, defaultValue = null) => {
          try {
            return value ? JSON.parse(value) : defaultValue;
          } catch (e) {
            console.warn('Failed to parse JSON:', e);
            return defaultValue;
          }
        };

        // Parse each JSON field safely
        parsedRow.goals = safeJsonParse(row.goals, []);
        parsedRow.ratings = safeJsonParse(row.ratings, {});
        
        // Handle competencies if the column exists
        if (row.competencies !== undefined) {
          parsedRow.competencies = safeJsonParse(row.competencies, {});
        }
        
        return parsedRow;
      });

      res.json({
        reviews,
        count: reviews.length
      });
    } catch (err) {
      console.error('Database error:', err);
      return res.status(500).json({
        error: 'Database Error',
        message: 'Failed to fetch performance reviews'
      });
    }

  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch performance reviews'
    });
  }
});

// Get review by ID
router.get('/:id', [
  authenticateToken,
  checkPermission('reviews', 'read')
], async (req, res) => {
  try {
    const reviewId = req.params.id;

    const sql = `
      SELECT 
        pr.*,
        e.first_name as employee_first_name,
        e.last_name as employee_last_name,
        e.department as employee_department,
        r.first_name as reviewer_first_name,
        r.last_name as reviewer_last_name
      FROM PerformanceReviews pr
      JOIN Users e ON pr.employee_id = e.id
      JOIN Users r ON pr.reviewer_id = r.id
      WHERE pr.id = ?
    `;

    try {
      const row = await db.get(sql, [reviewId]);
      
      if (!row) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Performance review not found'
        });
      }

      // Check permissions
      if (req.user.role === 'Employee' && row.employee_id !== req.user.id) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Cannot access other employees\' reviews'
        });
      }

      if (req.user.role === 'Department_Supervisor' && row.employee_department !== req.user.department) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Cannot access reviews from other departments'
        });
      }

      // Parse JSON fields
      const review = {
        ...row,
        goals_set: JSON.parse(row.goals_set),
        ratings: JSON.parse(row.ratings),
        competencies: JSON.parse(row.competencies)
      };

      res.json({ review });
    } catch (err) {
      console.error('Database error:', err);
      return res.status(500).json({
        error: 'Database Error',
        message: 'Failed to fetch performance review'
      });
    }

  } catch (error) {
    console.error('Get review error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch performance review'
    });
  }
});

// Create performance review
router.post('/', [
  authenticateToken,
  checkPermission('reviews', 'create'),
  body('employee_id').isInt({ min: 1 }),
  body('review_period').notEmpty().trim(),
  body('goals').isArray({ min: 1 }).withMessage('At least one goal is required'),
  body('ratings').isObject().withMessage('Ratings must be an object'),
  body('competencies').optional().isObject().withMessage('Competencies must be an object')
], auditLog('create', 'review'), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        details: errors.array()
      });
    }

    const { employee_id, review_period, goals, ratings, competencies, comments } = req.body;
    
    // Convert and validate employee_id
    const empId = parseInt(employee_id);
    if (isNaN(empId) || empId <= 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Valid employee ID is required'
      });
    }
    
    if (!review_period || !goals || !ratings) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Review period, goals, and ratings are required'
      });
    }

    // Check if employee exists and is active
    const employee = await db.get(
      'SELECT * FROM "Users" WHERE id = $1 AND is_active = true',
      [empId]
    );

    if (!employee) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Employee not found or inactive'
      });
    }

    // Check department scope for supervisors
    if (req.user.role === 'Department_Supervisor' && employee.department !== req.user.department) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Cannot create reviews for employees in other departments'
      });
    }

    let reviewer_id = req.user.id;
    
    // If HR_Manager is creating review for someone else, they can assign a different reviewer
    if (req.user.role === 'HR_Manager' && req.body.reviewer_id) {
      // Convert and validate reviewer_id
      const revId = parseInt(req.body.reviewer_id);
      if (isNaN(revId) || revId <= 0) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Valid reviewer ID is required'
        });
      }
      
      const reviewer = await db.get(
        'SELECT * FROM "Users" WHERE id = $1 AND is_active = true',
        [revId]
      );

      if (!reviewer) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Reviewer not found or inactive'
        });
      }
      reviewer_id = revId;
    }

    // Calculate overall score if ratings are provided
    let overall_score = null;
    if (ratings && typeof ratings === 'object') {
      const ratingValues = Object.values(ratings).filter(v => typeof v === 'number');
      if (ratingValues.length > 0) {
        overall_score = ratingValues.reduce((a, b) => a + b, 0) / ratingValues.length;
        // Round to 2 decimal places
        overall_score = Math.round(overall_score * 100) / 100;
      }
    }

    // Ensure overall_score is properly typed (number or null)
    const overallScore = overall_score !== null ? parseFloat(overall_score) : null;

    // Insert the new review
    try {
      const result = await db.run(`
        INSERT INTO "PerformanceReviews" (
          employee_id, 
          reviewer_id, 
          review_period, 
          goals, 
          ratings, 
          overall_score, 
          comments,
          status
        ) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft')
        RETURNING id
      `, [
        empId,                 // Use validated employee ID
        reviewer_id,           // Use validated reviewer ID
        review_period,
        JSON.stringify(goals || []),
        JSON.stringify(ratings || {}),
        overallScore,
        comments || null
      ]);
      
      if (!result || !result.id) {
        throw new Error('Failed to create review: No ID returned from database');
      }

    res.status(201).json({
      message: 'Performance review created successfully',
      reviewId: result.id || result.lastID
    });

    } catch (dbError) {
      console.error('Database error when creating review:', dbError);
      return res.status(500).json({
        error: 'Database Error',
        message: 'Failed to create performance review',
        details: process.env.NODE_ENV === 'development' ? dbError.message : undefined
      });
    }

  } catch (error) {
    console.error('Create review error:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      position: error.position,
      internalPosition: error.internalPosition,
      internalQuery: error.internalQuery,
      where: error.where,
      schema: error.schema,
      table: error.table,
      column: error.column,
      dataType: error.dataType,
      constraint: error.constraint,
      file: error.file,
      line: error.line,
      routine: error.routine
    });
    
    let errorMessage = 'Failed to create performance review';
    if (error.code === '22P02') {
      errorMessage = 'Invalid data type provided. Please check your input values.';
    }
    
    return res.status(500).json({
      error: 'Database Error',
      code: error.code,
      message: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Update performance review
router.put('/:id', [
  authenticateToken,
  checkPermission('reviews', 'update'),
  body('goals_set').optional().isArray(),
  body('ratings').optional().isObject(),
  body('competencies').optional().isObject(),
  body('comments').optional().isString(),
  body('status').optional().isIn(['draft', 'submitted', 'approved', 'completed'])
], auditLog('update', 'review'), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        details: errors.array()
      });
    }

    const reviewId = req.params.id;
    const { goals_set, ratings, competencies, comments, status } = req.body;

    // Get current review
    const currentReview = await db.get(
      `SELECT pr.*, e.department as employee_department
       FROM PerformanceReviews pr
       JOIN Users e ON pr.employee_id = e.id
       WHERE pr.id = $1`,
      [reviewId]
    );

    if (!currentReview) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Performance review not found'
      });
    }

    // Check permissions
    if (req.user.role === 'Employee' && currentReview.employee_id !== req.user.id) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Cannot update other employees\' reviews'
      });
    }

    if (req.user.role === 'Department_Supervisor' && currentReview.employee_department !== req.user.department) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Cannot update reviews from other departments'
      });
    }

    // Build update query
    const updates = [];
    const values = [];

    if (goals_set) {
      updates.push('goals = $' + (values.length + 1));
      values.push(JSON.stringify(goals_set));
    }
    if (ratings) {
      updates.push('ratings = $' + (values.length + 1));
      values.push(JSON.stringify(ratings));
      
      // Calculate new overall score if ratings are updated
      const ratingValues = Object.values(ratings).filter(v => typeof v === 'number');
      if (ratingValues.length > 0) {
        const overallScore = ratingValues.reduce((a, b) => a + b, 0) / ratingValues.length;
        updates.push('overall_score = $' + (values.length + 1));
        values.push(Math.round(overallScore * 100) / 100);
      }
    }
    if (competencies) {
      updates.push('competencies = $' + (values.length + 1));
      values.push(JSON.stringify(competencies));
    }
    if (comments !== undefined) {
      updates.push('comments = $' + (values.length + 1));
      values.push(comments);
    }
    if (status) {
      updates.push('status = $' + (values.length + 1));
      values.push(status);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'No valid fields to update'
      });
    }

    // Add updated_at timestamp
    updates.push('updated_at = CURRENT_TIMESTAMP');
    
    // Add review ID for WHERE clause
    values.push(reviewId);

    const sql = `UPDATE PerformanceReviews SET ${updates.join(', ')} WHERE id = $${values.length} RETURNING *`;
    
    const updatedReview = await db.get(sql, values).catch(error => {
      console.error('Database error when updating review:', error);
      throw new Error('Failed to update review in database');
    });
    
    if (!updatedReview) {
      throw new Error('Failed to retrieve updated review data');
    }
    
    res.json({
      message: 'Review updated successfully',
      review: {
        ...updatedReview,
        goals: safeJsonParse(updatedReview.goals, []),
        ratings: safeJsonParse(updatedReview.ratings, {}),
        competencies: safeJsonParse(updatedReview.competencies, {})
      }
    });
  } catch (error) {
    console.error('Update review error:', error);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      error: statusCode === 500 ? 'Internal Server Error' : error.name || 'Error',
      message: error.message || 'Failed to update performance review',
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
  }
});

// Submit review for approval
router.post('/:id/submit', [
  authenticateToken,
  checkPermission('reviews', 'update')
], async (req, res) => {
  try {
    const reviewId = req.params.id;

    // Get current review
    const currentReview = await db.get(
      `SELECT pr.*, e.department as employee_department
       FROM PerformanceReviews pr
       JOIN Users e ON pr.employee_id = e.id
       WHERE pr.id = $1`,
      [reviewId]
    );

    if (!currentReview) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Performance review not found'
      });
    }

    // Check permissions
    if (req.user.role === 'Employee' && currentReview.employee_id !== req.user.id) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Cannot submit other employees\' reviews'
      });
    }

    if (req.user.role === 'Department_Supervisor' && currentReview.employee_department !== req.user.department) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Cannot submit reviews from other departments'
      });
    }

    // Update status to submitted
    await db.run(
      'UPDATE PerformanceReviews SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['submitted', reviewId]
    );

    res.json({
      message: 'Performance review submitted successfully'
    });

  } catch (error) {
    console.error('Submit review error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to submit performance review'
    });
  }
});

// Approve review
router.post('/:id/approve', [
  authenticateToken,
  authorize('HR_Manager', 'Department_Supervisor'),
  checkPermission('reviews', 'approve')
], async (req, res) => {
  try {
    const reviewId = req.params.id;

    // Get current review
    const currentReview = await db.get(
      `SELECT pr.*, e.department as employee_department
       FROM PerformanceReviews pr
       JOIN Users e ON pr.employee_id = e.id
       WHERE pr.id = $1`,
      [reviewId]
    );

    if (!currentReview) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Performance review not found'
      });
    }

    // Check department scope for supervisors
    if (req.user.role === 'Department_Supervisor' && currentReview.employee_department !== req.user.department) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Cannot approve reviews from other departments'
      });
    }

    // Update status to approved
    await db.run(
      'UPDATE PerformanceReviews SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['approved', reviewId]
    );

    res.json({
      message: 'Performance review approved successfully'
    });

  } catch (error) {
    console.error('Approve review error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to approve performance review'
    });
  }
});

// Get review statistics
router.get('/stats/overview', [
  authenticateToken,
  checkPermission('reviews', 'read')
], async (req, res) => {
  try {
    let sql = `
      SELECT 
        pr.status,
        COUNT(*) as count,
        e.department,
        AVG(CAST((pr.ratings->>'overall') AS FLOAT)) as avg_overall_rating
      FROM PerformanceReviews pr
      JOIN Users e ON pr.employee_id = e.id
      WHERE 1=1
    `;
    const params = [];

    // Apply department scope filtering
    if (req.departmentScope) {
      sql += ' AND e.department = $1';
      params.push(req.departmentScope);
    }

    sql += ' GROUP BY pr.status, e.department ORDER BY e.department, pr.status';

    try {
      const rows = await db.all(sql, params);
      
      res.json({
        review_stats: rows
      });
    } catch (err) {
      console.error('Database error:', err);
      return res.status(500).json({
        error: 'Database Error',
        message: 'Failed to fetch review statistics'
      });
    }

  } catch (error) {
    console.error('Get review stats error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch review statistics'
    });
  }
});

module.exports = router;
