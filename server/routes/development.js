const express = require('express');
const { body, validationResult } = require('express-validator');
const { db } = require('../database/postgres');
const { authenticateToken, authorize, departmentScope, checkPermission, auditLog } = require('../middleware/auth');

const router = express.Router();

// Get development plans (with role-based filtering)
router.get('/', [
  authenticateToken,
  departmentScope,
  checkPermission('development', 'read')
], (req, res) => {
  try {
    let sql = `
      SELECT 
        dp.*,
        e.first_name as employee_first_name,
        e.last_name as employee_last_name,
        e.department as employee_department
      FROM DevelopmentPlans dp
      JOIN Users e ON dp.employee_id = e.id
      WHERE 1=1
    `;
    const params = [];

    // Apply role-based filtering
    if (req.user.role === 'Employee') {
      sql += ' AND dp.employee_id = ?';
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

    sql += ' ORDER BY dp.created_at DESC';

    db.all(sql, params, (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({
          error: 'Database Error',
          message: 'Failed to fetch development plans'
        });
      }

      // Parse JSON fields
      const plans = rows.map(row => ({
        ...row,
        progress_updates: row.progress_updates ? JSON.parse(row.progress_updates) : []
      }));

      res.json({
        development_plans: plans,
        count: plans.length
      });
    });

  } catch (error) {
    console.error('Get development plans error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch development plans'
    });
  }
});

// Get development plan by ID
router.get('/:id', [
  authenticateToken,
  checkPermission('development', 'read')
], async (req, res) => {
  try {
    const planId = req.params.id;

    const sql = `
      SELECT 
        dp.*,
        e.first_name as employee_first_name,
        e.last_name as employee_last_name,
        e.department as employee_department
      FROM DevelopmentPlans dp
      JOIN Users e ON dp.employee_id = e.id
      WHERE dp.id = ?
    `;

    try {
      const row = await db.get(sql, [planId]);
      
      if (!row) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Development plan not found'
        });
      }

      // Check permissions
      if (req.user.role === 'Employee' && row.employee_id !== req.user.id) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Cannot access other employees\' development plans'
        });
      }

      if (req.user.role === 'Department_Supervisor' && row.employee_department !== req.user.department) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Cannot access development plans from other departments'
        });
      }

      // Parse JSON fields
      const plan = {
        ...row,
        progress_updates: row.progress_updates ? JSON.parse(row.progress_updates) : []
      };

      res.json({ development_plan: plan });
    } catch (err) {
      console.error('Database error:', err);
      return res.status(500).json({
        error: 'Database Error',
        message: 'Failed to fetch development plan'
      });
    }

  } catch (error) {
    console.error('Get development plan error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch development plan'
    });
  }
});

// Create development plan
router.post('/', [
  authenticateToken,
  checkPermission('development', 'create'),
  body('employee_id').isInt({ min: 1 }),
  body('skill_category').notEmpty().trim(),
  body('skill_name').notEmpty().trim(),
  body('current_level').isInt({ min: 1, max: 5 }),
  body('target_level').isInt({ min: 1, max: 5 }),
  body('review_id').optional().isInt({ min: 1 })
], auditLog('create', 'development_plan'), async (req, res) => {
  try {
    console.log('Development plan creation request body:', req.body);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return res.status(400).json({
        error: 'Validation Error',
        details: errors.array()
      });
    }

    const { employee_id, skill_category, skill_name, current_level, target_level, review_id } = req.body;

    // Check if employee exists and is in the same department (for supervisors)
    const employee = await new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM Users WHERE id = ? AND is_active = 1',
        [employee_id],
        (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row);
          }
        }
      );
    });

    if (!employee) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Employee not found'
      });
    }

    // Check department scope for supervisors
    if (req.user.role === 'Department_Supervisor' && employee.department !== req.user.department) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Cannot create development plans for employees in other departments'
      });
    }

    // Check if review exists (if provided)
    if (review_id) {
      const review = await new Promise((resolve, reject) => {
        db.get(
          'SELECT * FROM PerformanceReviews WHERE id = ? AND employee_id = ?',
          [review_id, employee_id],
          (err, row) => {
            if (err) {
              reject(err);
            } else {
              resolve(row);
            }
          }
        );
      });

      if (!review) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Performance review not found for this employee'
        });
      }
    }

    // Validate target level is higher than current level
    if (target_level <= current_level) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Target level must be higher than current level'
      });
    }

    // Create development plan
    const result = await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO DevelopmentPlans (employee_id, review_id, skill_category, skill_name, current_level, target_level, completion_status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [employee_id, review_id || null, skill_category, skill_name, current_level, target_level, 'not_started'],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ id: this.lastID });
          }
        }
      );
    });

    res.status(201).json({
      message: 'Development plan created successfully',
      plan_id: result.id
    });

  } catch (error) {
    console.error('Create development plan error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create development plan'
    });
  }
});

// Update development plan
router.put('/:id', [
  authenticateToken,
  checkPermission('development', 'update'),
  body('skill_category').optional().notEmpty().trim(),
  body('skill_name').optional().notEmpty().trim(),
  body('current_level').optional().isInt({ min: 1, max: 5 }),
  body('target_level').optional().isInt({ min: 1, max: 5 }),
  body('progress_updates').optional().isArray(),
  body('impact_rating').optional().isInt({ min: 1, max: 5 }),
  body('completion_status').optional().isIn(['not_started', 'in_progress', 'completed', 'cancelled'])
], auditLog('update', 'development_plan'), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        details: errors.array()
      });
    }

    const planId = req.params.id;
    const { skill_category, skill_name, current_level, target_level, progress_updates, impact_rating, completion_status } = req.body;

    // Get current plan
    const currentPlan = await new Promise((resolve, reject) => {
      db.get(
        `SELECT dp.*, e.department as employee_department
         FROM DevelopmentPlans dp
         JOIN Users e ON dp.employee_id = e.id
         WHERE dp.id = ?`,
        [planId],
        (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row);
          }
        }
      );
    });

    if (!currentPlan) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Development plan not found'
      });
    }

    // Check permissions
    if (req.user.role === 'Employee' && currentPlan.employee_id !== req.user.id) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Cannot update other employees\' development plans'
      });
    }

    if (req.user.role === 'Department_Supervisor' && currentPlan.employee_department !== req.user.department) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Cannot update development plans from other departments'
      });
    }

    // Build update query
    const updates = [];
    const values = [];

    if (skill_category) {
      updates.push('skill_category = ?');
      values.push(skill_category);
    }
    if (skill_name) {
      updates.push('skill_name = ?');
      values.push(skill_name);
    }
    if (current_level) {
      updates.push('current_level = ?');
      values.push(current_level);
    }
    if (target_level) {
      updates.push('target_level = ?');
      values.push(target_level);
    }
    if (progress_updates) {
      updates.push('progress_updates = ?');
      values.push(JSON.stringify(progress_updates));
    }
    if (impact_rating) {
      updates.push('impact_rating = ?');
      values.push(impact_rating);
    }
    if (completion_status) {
      updates.push('completion_status = ?');
      values.push(completion_status);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'No valid fields to update'
      });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(planId);

    const sql = `UPDATE DevelopmentPlans SET ${updates.join(', ')} WHERE id = ?`;
    
    await new Promise((resolve, reject) => {
      db.run(sql, values, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });

    res.json({
      message: 'Development plan updated successfully'
    });

  } catch (error) {
    console.error('Update development plan error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update development plan'
    });
  }
});

// Add progress update
router.post('/:id/progress', [
  authenticateToken,
  checkPermission('development', 'update'),
  body('update_text').notEmpty().trim(),
  body('progress_percentage').optional().isInt({ min: 0, max: 100 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        details: errors.array()
      });
    }

    const planId = req.params.id;
    const { update_text, progress_percentage } = req.body;

    // Get current plan
    const currentPlan = await new Promise((resolve, reject) => {
      db.get(
        `SELECT dp.*, e.department as employee_department
         FROM DevelopmentPlans dp
         JOIN Users e ON dp.employee_id = e.id
         WHERE dp.id = ?`,
        [planId],
        (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row);
          }
        }
      );
    });

    if (!currentPlan) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Development plan not found'
      });
    }

    // Check permissions
    if (req.user.role === 'Employee' && currentPlan.employee_id !== req.user.id) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Cannot update other employees\' development plans'
      });
    }

    if (req.user.role === 'Department_Supervisor' && currentPlan.employee_department !== req.user.department) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Cannot update development plans from other departments'
      });
    }

    // Get existing progress updates
    const existingUpdates = currentPlan.progress_updates ? JSON.parse(currentPlan.progress_updates) : [];

    // Add new progress update
    const newUpdate = {
      id: Date.now(),
      text: update_text,
      progress_percentage: progress_percentage || null,
      created_at: new Date().toISOString(),
      created_by: req.user.id
    };

    existingUpdates.push(newUpdate);

    // Update the plan
    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE DevelopmentPlans SET progress_updates = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [JSON.stringify(existingUpdates), planId],
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
      message: 'Progress update added successfully',
      update: newUpdate
    });

  } catch (error) {
    console.error('Add progress update error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to add progress update'
    });
  }
});

// Complete development plan
router.post('/:id/complete', [
  authenticateToken,
  checkPermission('development', 'update'),
  body('impact_rating').isInt({ min: 1, max: 5 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        details: errors.array()
      });
    }

    const planId = req.params.id;
    const { impact_rating } = req.body;

    // Get current plan
    const currentPlan = await new Promise((resolve, reject) => {
      db.get(
        `SELECT dp.*, e.department as employee_department
         FROM DevelopmentPlans dp
         JOIN Users e ON dp.employee_id = e.id
         WHERE dp.id = ?`,
        [planId],
        (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row);
          }
        }
      );
    });

    if (!currentPlan) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Development plan not found'
      });
    }

    // Check permissions
    if (req.user.role === 'Employee' && currentPlan.employee_id !== req.user.id) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Cannot complete other employees\' development plans'
      });
    }

    if (req.user.role === 'Department_Supervisor' && currentPlan.employee_department !== req.user.department) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Cannot complete development plans from other departments'
      });
    }

    // Update plan to completed
    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE DevelopmentPlans SET completion_status = ?, impact_rating = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        ['completed', impact_rating, planId],
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
      message: 'Development plan completed successfully'
    });

  } catch (error) {
    console.error('Complete development plan error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to complete development plan'
    });
  }
});

// Get development plan statistics
router.get('/stats/overview', [
  authenticateToken,
  checkPermission('development', 'read')
], (req, res) => {
  try {
    let sql = `
      SELECT 
        dp.completion_status,
        COUNT(*) as count,
        e.department,
        AVG(dp.impact_rating) as avg_impact_rating
      FROM DevelopmentPlans dp
      JOIN Users e ON dp.employee_id = e.id
      WHERE 1=1
    `;
    const params = [];

    // Apply department scope filtering
    if (req.departmentScope) {
      sql += ' AND e.department = ?';
      params.push(req.departmentScope);
    }

    sql += ' GROUP BY dp.completion_status, e.department ORDER BY e.department, dp.completion_status';

    db.all(sql, params, (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({
          error: 'Database Error',
          message: 'Failed to fetch development plan statistics'
        });
      }

      res.json({
        development_stats: rows
      });
    });

  } catch (error) {
    console.error('Get development stats error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch development plan statistics'
    });
  }
});

// Get skill category distribution
router.get('/stats/skills', [
  authenticateToken,
  checkPermission('development', 'read')
], (req, res) => {
  try {
    let sql = `
      SELECT 
        dp.skill_category,
        COUNT(*) as count,
        AVG(dp.current_level) as avg_current_level,
        AVG(dp.target_level) as avg_target_level,
        AVG(dp.impact_rating) as avg_impact_rating
      FROM DevelopmentPlans dp
      JOIN Users e ON dp.employee_id = e.id
      WHERE 1=1
    `;
    const params = [];

    // Apply department scope filtering
    if (req.departmentScope) {
      sql += ' AND e.department = ?';
      params.push(req.departmentScope);
    }

    sql += ' GROUP BY dp.skill_category ORDER BY count DESC';

    db.all(sql, params, (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({
          error: 'Database Error',
          message: 'Failed to fetch skill statistics'
        });
      }

      res.json({
        skill_statistics: rows
      });
    });

  } catch (error) {
    console.error('Get skill stats error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch skill statistics'
    });
  }
});

module.exports = router;
