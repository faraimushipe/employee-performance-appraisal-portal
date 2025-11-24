const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { db } = require('../database/postgres');
const { generateToken, authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Test route to verify auth routes are loading
router.get('/test', (req, res) => {
  res.json({ message: 'Auth routes are working!' });
});

// Login endpoint
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        details: errors.array()
      });
    }

    const { email, password } = req.body;

    // Find user by email
    const user = await db.get(
      'SELECT * FROM Users WHERE email = ? AND is_active = 1',
      [email]
    );

    if (!user) {
      return res.status(401).json({
        error: 'Authentication Failed',
        message: 'Invalid email or password'
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Authentication Failed',
        message: 'Invalid email or password'
      });
    }

    // Generate JWT token
    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
      department: user.department,
      first_name: user.first_name,
      last_name: user.last_name
    });

    // Return user data (excluding password)
    const { password_hash, ...userData } = user;
    
    res.json({
      message: 'Login successful',
      token,
      user: userData
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Login failed'
    });
  }
});

// Register endpoint (public for first HR Manager)
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('first_name').notEmpty().trim(),
  body('last_name').notEmpty().trim(),
  body('department').isIn(['HR', 'IT', 'Finance']),
  body('role').isIn(['HR_Manager', 'Department_Supervisor', 'Employee']),
  body('employment_date').isISO8601()
], async (req, res) => {
  try {
    // Allow registration if no users exist (first setup) or if HR Manager
    const userCount = await db.get('SELECT COUNT(*) as count FROM Users', []);

    // If users exist, check if requester is HR Manager
    if (userCount > 0) {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Token required for registration'
        });
      }
      
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production');
      if (decoded.role !== 'HR_Manager') {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Only HR Managers can register new users'
        });
      }
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        details: errors.array()
      });
    }

    const { email, password, first_name, last_name, department, role, employment_date } = req.body;

    // Check if user already exists
    const existingUser = await db.get(
      'SELECT id FROM Users WHERE email = ?',
      [email]
    );

    if (existingUser) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'User with this email already exists'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const result = await db.run(
      `INSERT INTO Users (email, password_hash, first_name, last_name, department, role, employment_date)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [email, hashedPassword, first_name, last_name, department, role, employment_date]
    );

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: result.id,
        email,
        first_name,
        last_name,
        department,
        role,
        employment_date
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Registration failed'
    });
  }
});

// Get current user profile
router.get('/profile', authenticateToken, (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role,
      department: req.user.department,
      first_name: req.user.first_name,
      last_name: req.user.last_name
    }
  });
});

// Update user profile
router.put('/profile', [
  authenticateToken,
  body('first_name').optional().notEmpty().trim(),
  body('last_name').optional().notEmpty().trim(),
  body('email').optional().isEmail().normalizeEmail()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        details: errors.array()
      });
    }

    const { first_name, last_name, email } = req.body;
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
          [email, req.user.id],
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

    if (updates.length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'No valid fields to update'
      });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(req.user.id);

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
      message: 'Profile updated successfully'
    });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Profile update failed'
    });
  }
});

// Change password
router.put('/change-password', [
  authenticateToken,
  body('current_password').notEmpty(),
  body('new_password').isLength({ min: 6 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        details: errors.array()
      });
    }

    const { current_password, new_password } = req.body;

    // Get current user with password
    const user = await new Promise((resolve, reject) => {
      db.get(
        'SELECT password_hash FROM Users WHERE id = ?',
        [req.user.id],
        (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row);
          }
        }
      );
    });

    if (!user) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found'
      });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(current_password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Authentication Failed',
        message: 'Current password is incorrect'
      });
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(new_password, 10);

    // Update password
    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE Users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [hashedNewPassword, req.user.id],
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
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Password change failed'
    });
  }
});

// Logout endpoint (client-side token removal)
router.post('/logout', authenticateToken, (req, res) => {
  res.json({
    message: 'Logout successful'
  });
});

module.exports = router;
