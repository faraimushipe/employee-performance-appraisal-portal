const express = require('express');
const { body, validationResult } = require('express-validator');
const { db } = require('../database/postgres');
const { authenticateToken, authorize, departmentScope, checkPermission, auditLog } = require('../middleware/auth');

const router = express.Router();

// Get all users (with role-based filtering)
router.get('/', [
  authenticateToken,
  departmentScope,
  checkPermission('users', 'read')
], (req, res) => {
  try {
    let sql = `
      SELECT id, email, first_name, last_name, department, role, employment_date, is_active, created_at
      FROM Users
      WHERE is_active = 1
    `;
    const params = [];

    // Apply department scope filtering
    if (req.departmentScope) {
      sql += ' AND department = ?';
      params.push(req.departmentScope);
    }

    // HR_Manager can see all users
    // Department_Supervisor can see users in their department
    // Employee can only see themselves
    if (req.user.role === 'Employee') {
      sql += ' AND id = ?';
      params.push(req.user.id);
    }

    sql += ' ORDER BY department, last_name, first_name';

    db.all(sql, params, (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({
          error: 'Database Error',
          message: 'Failed to fetch users'
        });
      }

      res.json({
        users: rows,
        count: rows.length
      });
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch users'
    });
  }
});

// Create new user
router.post('/', [
  authenticateToken,
  authorize('HR_Manager'),
  checkPermission('users', 'create'),
  body('first_name').notEmpty().trim().withMessage('First name is required'),
  body('last_name').notEmpty().trim().withMessage('Last name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('department').isIn(['HR', 'IT', 'Finance']).withMessage('Department must be HR, IT, or Finance'),
  body('role').isIn(['HR_Manager', 'Department_Supervisor', 'Employee']).withMessage('Role must be HR_Manager, Department_Supervisor, or Employee'),
  body('employment_date').isISO8601().withMessage('Valid employment date is required')
], auditLog('create', 'user'), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        details: errors.array()
      });
    }

    const { first_name, last_name, email, department, role, employment_date } = req.body;

    // Check if email already exists
    const existingUser = await db.get('SELECT id FROM Users WHERE email = ?', [email]);

    if (existingUser) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'Email already in use'
      });
    }

    // Generate a temporary password (in production, this should be sent via email)
    const tempPassword = Math.random().toString(36).slice(-8);
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    // Insert new user
    const sql = `
      INSERT INTO Users (first_name, last_name, email, password_hash, department, role, employment_date, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;

    const result = await new Promise((resolve, reject) => {
      db.run(sql, [first_name, last_name, email, hashedPassword, department, role, employment_date], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID });
        }
      });
    });

    // Get the created user (without password)
    const newUser = await new Promise((resolve, reject) => {
      db.get(`
        SELECT id, email, first_name, last_name, department, role, employment_date, is_active, created_at
        FROM Users WHERE id = ?
      `, [result.id], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });

    res.status(201).json({
      message: 'User created successfully',
      user: newUser,
      temp_password: tempPassword // In production, this should be sent via email
    });

  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create user'
    });
  }
});

// Reset user password (HR Manager only)
router.post('/:id/reset-password', [
  authenticateToken,
  authorize('HR_Manager'),
  checkPermission('users', 'update')
], async (req, res) => {
  try {
    const userId = req.params.id;

    // Check if user exists
    const user = await db.get('SELECT * FROM Users WHERE id = ?', [userId]);

    if (!user) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found'
      });
    }

    // Generate a new temporary password
    const tempPassword = Math.random().toString(36).slice(-8);
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    // Update user password
    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE Users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [hashedPassword, userId],
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
      message: 'Password reset successfully',
      temp_password: tempPassword // In production, this should be sent via email
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to reset password'
    });
  }
});

// Get user by ID
router.get('/:id', [
  authenticateToken,
  checkPermission('users', 'read')
], async (req, res) => {
  try {
    const userId = req.params.id;

    // Check if user can access this resource
    if (req.user.role === 'Employee' && req.user.id !== parseInt(userId)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Cannot access other users\' profiles'
      });
    }

    const sql = `
      SELECT id, email, first_name, last_name, department, role, employment_date, is_active, created_at
      FROM Users
      WHERE id = ? AND is_active = 1
    `;

    try {
      const row = await db.get(sql, [userId]);
      
      if (!row) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'User not found'
        });
      }

      // Check department scope for supervisors
      if (req.user.role === 'Department_Supervisor' && row.department !== req.user.department) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Cannot access users from other departments'
        });
      }

      res.json({ user: row });
    } catch (err) {
      console.error('Database error:', err);
      return res.status(500).json({
        error: 'Database Error',
        message: 'Failed to fetch user'
      });
    }

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch user'
    });
  }
});

// Update user
router.put('/:id', [
  authenticateToken,
  checkPermission('users', 'update'),
  body('first_name').optional().notEmpty().trim(),
  body('last_name').optional().notEmpty().trim(),
  body('email').optional().isEmail().normalizeEmail(),
  body('department').optional().isIn(['HR', 'IT', 'Finance']),
  body('role').optional().isIn(['HR_Manager', 'Department_Supervisor', 'Employee']),
  body('is_active').optional().isBoolean()
], auditLog('update', 'user'), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        details: errors.array()
      });
    }

    const userId = req.params.id;
    const { first_name, last_name, email, department, role, is_active } = req.body;

    // Check permissions
    if (req.user.role === 'Employee' && req.user.id !== parseInt(userId)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Cannot update other users'
      });
    }

    // Get current user data for audit log
    const currentUser = await db.get('SELECT * FROM Users WHERE id = ?', [userId]);

    if (!currentUser) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found'
      });
    }

    // Check department scope for supervisors
    if (req.user.role === 'Department_Supervisor' && currentUser.department !== req.user.department) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Cannot update users from other departments'
      });
    }

    // Only HR_Manager can change role and department
    if ((role || department) && req.user.role !== 'HR_Manager') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only HR Managers can change user roles and departments'
      });
    }

    // Build update query
    const updates = [];
    const values = [];

    if (first_name) {
      updates.push('first_name = ?');
      values.push(first_name);
    }
    if (last_name) {
      updates.push('last_name = ?');
      values.push(last_name);
    }
    if (email) {
      // Check if email is already taken by another user
      const existingUser = await new Promise((resolve, reject) => {
        db.get(
          'SELECT id FROM Users WHERE email = ? AND id != ?',
          [email, userId],
          (err, row) => {
            if (err) {
              reject(err);
            } else {
              resolve(row);
            }
          }
        );
      });

      if (existingUser) {
        return res.status(409).json({
          error: 'Conflict',
          message: 'Email already in use by another user'
        });
      }

      updates.push('email = ?');
      values.push(email);
    }
    if (department) {
      updates.push('department = ?');
      values.push(department);
    }
    if (role) {
      updates.push('role = ?');
      values.push(role);
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(is_active ? 1 : 0);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'No valid fields to update'
      });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(userId);

    const sql = `UPDATE Users SET ${updates.join(', ')} WHERE id = ?`;
    
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
      message: 'User updated successfully'
    });

  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update user'
    });
  }
});

// Deactivate user (soft delete)
router.delete('/:id', [
  authenticateToken,
  authorize('HR_Manager'),
  checkPermission('users', 'delete')
], auditLog('delete', 'user'), async (req, res) => {
  try {
    const userId = req.params.id;

    // Prevent self-deletion
    if (req.user.id === parseInt(userId)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Cannot deactivate your own account'
      });
    }

    // Check if user exists
    const user = await db.get('SELECT * FROM Users WHERE id = ?', [userId]);

    if (!user) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found'
      });
    }

    // Soft delete (deactivate)
    await db.run(
      'UPDATE Users SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [userId]
    );

    res.json({
      message: 'User deactivated successfully'
    });

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to deactivate user'
    });
  }
});

// Get department statistics
router.get('/stats/department', [
  authenticateToken,
  checkPermission('users', 'read')
], (req, res) => {
  try {
    let sql = `
      SELECT 
        department,
        COUNT(*) as total_users,
        SUM(CASE WHEN role = 'HR_Manager' THEN 1 ELSE 0 END) as hr_managers,
        SUM(CASE WHEN role = 'Department_Supervisor' THEN 1 ELSE 0 END) as supervisors,
        SUM(CASE WHEN role = 'Employee' THEN 1 ELSE 0 END) as employees,
        AVG(julianday('now') - julianday(employment_date)) as avg_tenure_days
      FROM Users
      WHERE is_active = 1
    `;
    const params = [];

    // Apply department scope filtering
    if (req.departmentScope) {
      sql += ' AND department = ?';
      params.push(req.departmentScope);
    }

    sql += ' GROUP BY department ORDER BY department';

    db.all(sql, params, (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({
          error: 'Database Error',
          message: 'Failed to fetch department statistics'
        });
      }

      res.json({
        department_stats: rows
      });
    });

  } catch (error) {
    console.error('Get department stats error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch department statistics'
    });
  }
});

// Get role distribution
router.get('/stats/roles', [
  authenticateToken,
  checkPermission('users', 'read')
], (req, res) => {
  try {
    let sql = `
      SELECT 
        role,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM Users WHERE is_active = 1), 2) as percentage
      FROM Users
      WHERE is_active = 1
    `;
    const params = [];

    // Apply department scope filtering
    if (req.departmentScope) {
      sql += ' AND department = ?';
      params.push(req.departmentScope);
    }

    sql += ' GROUP BY role ORDER BY count DESC';

    db.all(sql, params, (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({
          error: 'Database Error',
          message: 'Failed to fetch role statistics'
        });
      }

      res.json({
        role_distribution: rows
      });
    });

  } catch (error) {
    console.error('Get role stats error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch role statistics'
    });
  }
});

module.exports = router;
