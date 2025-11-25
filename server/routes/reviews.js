const express = require('express');
const { body, validationResult } = require('express-validator');
const { db } = require('../database/postgres');
const { authenticateToken, authorize, departmentScope, checkPermission, auditLog } = require('../middleware/auth');

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
      sql += ' AND pr.employee_id = ?';
      params.push(req.user.id);
    } else if (req.user.role === 'Department_Supervisor') {
      sql += ' AND e.department = ?';
      params.push(req.user.department);
    }

    // Apply department scope filtering
    if (req.departmentScope) {
      sql += ' AND e.department = ?';
      params.push(req.departmentScope);
    }

    sql += ' ORDER BY pr.created_at DESC';

    try {
      const rows = await db.all(sql, params);
      
      // Parse JSON fields
      const reviews = rows.map(row => ({
        ...row,
        goals_set: JSON.parse(row.goals_set),
        ratings: JSON.parse(row.ratings),
        competencies: JSON.parse(row.competencies)
      }));

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
  body('goals_set').isArray({ min: 1 }),
  body('ratings').isObject(),
  body('competencies').isObject()
], auditLog('create', 'review'), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        details: errors.array()
      });
    }

    const { employee_id, review_period, goals_set, ratings, competencies, comments } = req.body;

    // Check if employee exists and is active
    const employee = await db.get(
      'SELECT * FROM "Users" WHERE id = $1 AND is_active = true',
      [employee_id]
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
      const reviewer = await db.get(
        'SELECT * FROM "Users" WHERE id = $1 AND is_active = true',
        [req.body.reviewer_id]
      );

      if (!reviewer) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Reviewer not found or inactive'
        });
      }
      reviewer_id = req.body.reviewer_id;
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

    // Insert the new review
    const result = await db.run(`
      INSERT INTO "PerformanceReviews" (
        employee_id, 
        reviewer_id, 
        review_period, 
        goals_set, 
        ratings, 
        overall_score, 
        comments,
        status
      ) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft')
      RETURNING id
    `, [
      employee_id,
      reviewer_id,
      review_period,
      JSON.stringify(goals_set),
      JSON.stringify(ratings),
      overall_score,
      comments || null
    ]);

    res.status(201).json({
      message: 'Performance review created successfully',
      reviewId: result.id || result.lastID
    });

  } catch (error) {
    console.error('Create review error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create performance review'
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
    const currentReview = await db((resolve, reject) => {
      db.get(
        `SELECT pr.*, e.department as employee_department
         FROM PerformanceReviews pr
         JOIN Users e ON pr.employee_id = e.id
         WHERE pr.id = ?`,
        [reviewId],
        (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row);
          }
        }
      );
    });

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
      updates.push('goals_set = ?');
      values.push(JSON.stringify(goals_set));
    }
    if (ratings) {
      updates.push('ratings = ?');
      values.push(JSON.stringify(ratings));
    }
    if (competencies) {
      updates.push('competencies = ?');
      values.push(JSON.stringify(competencies));
    }
    if (comments !== undefined) {
      updates.push('comments = ?');
      values.push(comments);
    }
    if (status) {
      updates.push('status = ?');
      values.push(status);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'No valid fields to update'
      });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(reviewId);

    const sql = `UPDATE PerformanceReviews SET ${updates.join(', ')} WHERE id = ?`;
    
    await db((resolve, reject) => {
      db.run(sql, values, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });

    res.json({
      message: 'Performance review updated successfully'
    });

  } catch (error) {
    console.error('Update review error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update performance review'
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
    const currentReview = await db((resolve, reject) => {
      db.get(
        `SELECT pr.*, e.department as employee_department
         FROM PerformanceReviews pr
         JOIN Users e ON pr.employee_id = e.id
         WHERE pr.id = ?`,
        [reviewId],
        (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row);
          }
        }
      );
    });

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
    await db((resolve, reject) => {
      db.run(
        'UPDATE PerformanceReviews SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        ['submitted', reviewId],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });

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
    const currentReview = await db((resolve, reject) => {
      db.get(
        `SELECT pr.*, e.department as employee_department
         FROM PerformanceReviews pr
         JOIN Users e ON pr.employee_id = e.id
         WHERE pr.id = ?`,
        [reviewId],
        (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row);
          }
        }
      );
    });

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
    await db((resolve, reject) => {
      db.run(
        'UPDATE PerformanceReviews SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        ['approved', reviewId],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });

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
      sql += ' AND e.department = ?';
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
