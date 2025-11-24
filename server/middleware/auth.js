const jwt = require('jsonwebtoken');
const { db } = require('../database/postgres');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// Generate JWT token
const generateToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

// Verify JWT token
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid token');
  }
};

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ 
      error: 'Access denied', 
      message: 'No token provided' 
    });
  }

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ 
      error: 'Invalid token', 
      message: error.message 
    });
  }
};

// Role-based authorization middleware
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Authentication required' 
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: 'Insufficient permissions' 
      });
    }

    next();
  };
};

// Department scope middleware
const departmentScope = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Authentication required' 
    });
  }

  // HR_Manager can access all departments
  if (req.user.role === 'HR_Manager') {
    req.departmentScope = null; // No restriction
    return next();
  }

  // Department_Supervisor and Employee can only access their own department
  req.departmentScope = req.user.department;
  next();
};

// Resource ownership middleware
const checkResourceOwnership = (resourceType) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Authentication required' 
      });
    }

    // HR_Manager can access all resources
    if (req.user.role === 'HR_Manager') {
      return next();
    }

    const resourceId = req.params.id || req.params.employeeId || req.params.userId;
    
    if (!resourceId) {
      return res.status(400).json({ 
        error: 'Bad Request', 
        message: 'Resource ID required' 
      });
    }

    // Check if user owns the resource or is their supervisor
    const query = `
      SELECT u.id, u.department, u.role, 
             CASE 
               WHEN u.role = 'Department_Supervisor' THEN 1
               WHEN u.id = ? THEN 1
               ELSE 0
             END as can_access
      FROM Users u
      WHERE u.id = ?
    `;

    db.get(query, [req.user.id, resourceId], (err, row) => {
      if (err) {
        return res.status(500).json({ 
          error: 'Database Error', 
          message: 'Failed to verify resource ownership' 
        });
      }

      if (!row) {
        return res.status(404).json({ 
          error: 'Not Found', 
          message: 'Resource not found' 
        });
      }

      // Check department scope for supervisors
      if (req.user.role === 'Department_Supervisor' && row.department !== req.user.department) {
        return res.status(403).json({ 
          error: 'Forbidden', 
          message: 'Cannot access resources from other departments' 
        });
      }

      if (!row.can_access) {
        return res.status(403).json({ 
          error: 'Forbidden', 
          message: 'Cannot access this resource' 
        });
      }

      next();
    });
  };
};

// Audit logging middleware
const auditLog = (action, resourceType) => {
  return (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(data) {
      // Log the action after response is sent
      const logData = {
        user_id: req.user?.id || null,
        action: action,
        resource_type: resourceType,
        resource_id: req.params.id || req.params.employeeId || req.params.userId || null,
        old_values: req.oldValues || null,
        new_values: req.body || null,
        ip_address: req.ip || req.connection.remoteAddress,
        user_agent: req.get('User-Agent'),
        status_code: res.statusCode
      };

      // Insert audit log asynchronously
      db.run(
        `INSERT INTO AuditLogs (user_id, action, resource_type, resource_id, old_values, new_values, ip_address, user_agent)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          logData.user_id,
          logData.action,
          logData.resource_type,
          logData.resource_id,
          logData.old_values ? JSON.stringify(logData.old_values) : null,
          logData.new_values ? JSON.stringify(logData.new_values) : null,
          logData.ip_address,
          logData.user_agent
        ],
        (err) => {
          if (err) {
            console.error('Failed to log audit:', err);
          }
        }
      );

      originalSend.call(this, data);
    };

    next();
  };
};

// Permission matrix for different operations
const PERMISSIONS = {
  HR_Manager: {
    users: ['create', 'read', 'update', 'delete'],
    reviews: ['create', 'read', 'update', 'delete', 'approve'],
    analytics: ['read_all', 'export'],
    surveys: ['create', 'read', 'update', 'delete', 'analyze'],
    development: ['create', 'read', 'update', 'delete', 'monitor']
  },
  Department_Supervisor: {
    users: ['read_own_dept'],
    reviews: ['create', 'read_own_dept', 'update_own_dept', 'approve_own_dept'],
    analytics: ['read_dept'],
    surveys: ['create', 'read_dept', 'analyze_dept'],
    development: ['create', 'read_own_dept', 'update_own_dept', 'monitor_own_dept']
  },
  Employee: {
    users: ['read_own'],
    reviews: ['read_own', 'create_self_assessment'],
    analytics: ['read_personal'],
    surveys: ['create', 'read_own'],
    development: ['create', 'read_own', 'update_own']
  }
};

// Check specific permission
const hasPermission = (userRole, resource, action) => {
  const rolePermissions = PERMISSIONS[userRole];
  if (!rolePermissions || !rolePermissions[resource]) {
    return false;
  }

  // Allow scoped variants to satisfy generic actions
  const normalizeAction = (requested) => {
    switch (requested) {
      case 'read':
        return ['read', 'read_own_dept', 'read_own'];
      case 'update':
        return ['update', 'update_own_dept', 'update_own'];
      case 'approve':
        return ['approve', 'approve_own_dept'];
      case 'monitor':
        return ['monitor', 'monitor_own_dept'];
      case 'analyze':
        return ['analyze', 'analyze_dept'];
      default:
        return [requested];
    }
  };

  const acceptableActions = new Set(normalizeAction(action));
  return rolePermissions[resource].some(a => acceptableActions.has(a));
};

// Permission check middleware
const checkPermission = (resource, action) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Authentication required' 
      });
    }

    if (!hasPermission(req.user.role, resource, action)) {
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: `Insufficient permissions for ${action} on ${resource}` 
      });
    }

    next();
  };
};

module.exports = {
  generateToken,
  verifyToken,
  authenticateToken,
  authorize,
  departmentScope,
  checkResourceOwnership,
  auditLog,
  hasPermission,
  checkPermission,
  PERMISSIONS
};
