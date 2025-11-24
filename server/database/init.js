const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'epap.db');

// Create database connection with error handling
const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  } else {
    console.log('Connected to SQLite database');
  }
});

// Enable foreign keys and optimize settings
db.run('PRAGMA foreign_keys = ON');
db.run('PRAGMA journal_mode = WAL'); // Write-Ahead Logging for better concurrency
db.run('PRAGMA synchronous = NORMAL'); // Balance between safety and performance
db.run('PRAGMA cache_size = 10000'); // Increase cache size
db.run('PRAGMA temp_store = MEMORY'); // Store temp tables in memory

// Handle database errors
db.on('error', (err) => {
  console.error('Database error:', err);
  // Don't exit on database errors, just log them
});

// Handle database close
db.on('close', () => {
  console.log('Database connection closed');
});

const initializeDatabase = async () => {
  return new Promise((resolve, reject) => {
    db.serialize(async () => {
      try {
        // Create Users table
        await createUsersTable();
        
        // Create PerformanceReviews table
        await createPerformanceReviewsTable();
        
        // Create DevelopmentPlans table
        await createDevelopmentPlansTable();
        
        // Create SurveyResponses table
        await createSurveyResponsesTable();
        
        // Create AnalyticsCache table
        await createAnalyticsCacheTable();
        
        // Create AuditLogs table
        await createAuditLogsTable();
        
        // Create indexes for performance
        await createIndexes();
        
        // Seed initial data
        await seedData();
        
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });
};

const createUsersTable = () => {
  return new Promise((resolve, reject) => {
    const sql = `
      CREATE TABLE IF NOT EXISTS Users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        department TEXT NOT NULL CHECK (department IN ('HR', 'IT', 'Finance')),
        role TEXT NOT NULL CHECK (role IN ('HR_Manager', 'Department_Supervisor', 'Employee')),
        employment_date DATE NOT NULL,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    db.run(sql, (err) => {
      if (err) {
        reject(err);
      } else {
        console.log('Users table created/verified');
        resolve();
      }
    });
  });
};

const createPerformanceReviewsTable = () => {
  return new Promise((resolve, reject) => {
    const sql = `
      CREATE TABLE IF NOT EXISTS PerformanceReviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL,
        reviewer_id INTEGER NOT NULL,
        review_period TEXT NOT NULL,
        goals_set TEXT NOT NULL, -- JSON
        ratings TEXT NOT NULL, -- JSON
        competencies TEXT NOT NULL, -- JSON
        status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'completed')),
        comments TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (employee_id) REFERENCES Users(id),
        FOREIGN KEY (reviewer_id) REFERENCES Users(id)
      )
    `;
    
    db.run(sql, (err) => {
      if (err) {
        reject(err);
      } else {
        console.log('PerformanceReviews table created/verified');
        resolve();
      }
    });
  });
};

const createDevelopmentPlansTable = () => {
  return new Promise((resolve, reject) => {
    const sql = `
      CREATE TABLE IF NOT EXISTS DevelopmentPlans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL,
        review_id INTEGER,
        skill_category TEXT NOT NULL,
        skill_name TEXT NOT NULL,
        current_level INTEGER NOT NULL CHECK (current_level BETWEEN 1 AND 5),
        target_level INTEGER NOT NULL CHECK (target_level BETWEEN 1 AND 5),
        progress_updates TEXT, -- JSON
        impact_rating INTEGER CHECK (impact_rating BETWEEN 1 AND 5),
        completion_status TEXT DEFAULT 'in_progress' CHECK (completion_status IN ('not_started', 'in_progress', 'completed', 'cancelled')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (employee_id) REFERENCES Users(id),
        FOREIGN KEY (review_id) REFERENCES PerformanceReviews(id)
      )
    `;
    
    db.run(sql, (err) => {
      if (err) {
        reject(err);
      } else {
        console.log('DevelopmentPlans table created/verified');
        resolve();
      }
    });
  });
};

const createSurveyResponsesTable = () => {
  return new Promise((resolve, reject) => {
    const sql = `
      CREATE TABLE IF NOT EXISTS SurveyResponses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        survey_type TEXT NOT NULL,
        response_data TEXT NOT NULL, -- JSON
        role TEXT NOT NULL,
        department TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES Users(id)
      )
    `;
    
    db.run(sql, (err) => {
      if (err) {
        reject(err);
      } else {
        console.log('SurveyResponses table created/verified');
        resolve();
      }
    });
  });
};

const createAnalyticsCacheTable = () => {
  return new Promise((resolve, reject) => {
    const sql = `
      CREATE TABLE IF NOT EXISTS AnalyticsCache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        metric_name TEXT NOT NULL,
        department TEXT,
        value REAL NOT NULL,
        statistical_significance REAL,
        sample_size INTEGER,
        confidence_interval_lower REAL,
        confidence_interval_upper REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME
      )
    `;
    
    db.run(sql, (err) => {
      if (err) {
        reject(err);
      } else {
        console.log('AnalyticsCache table created/verified');
        resolve();
      }
    });
  });
};

const createAuditLogsTable = () => {
  return new Promise((resolve, reject) => {
    const sql = `
      CREATE TABLE IF NOT EXISTS AuditLogs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        action TEXT NOT NULL,
        resource_type TEXT NOT NULL,
        resource_id INTEGER,
        old_values TEXT, -- JSON
        new_values TEXT, -- JSON
        ip_address TEXT,
        user_agent TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES Users(id)
      )
    `;
    
    db.run(sql, (err) => {
      if (err) {
        reject(err);
      } else {
        console.log('AuditLogs table created/verified');
        resolve();
      }
    });
  });
};

const createIndexes = () => {
  return new Promise((resolve, reject) => {
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_users_department ON Users(department)',
      'CREATE INDEX IF NOT EXISTS idx_users_role ON Users(role)',
      'CREATE INDEX IF NOT EXISTS idx_reviews_employee ON PerformanceReviews(employee_id)',
      'CREATE INDEX IF NOT EXISTS idx_reviews_reviewer ON PerformanceReviews(reviewer_id)',
      'CREATE INDEX IF NOT EXISTS idx_reviews_period ON PerformanceReviews(review_period)',
      'CREATE INDEX IF NOT EXISTS idx_development_employee ON DevelopmentPlans(employee_id)',
      'CREATE INDEX IF NOT EXISTS idx_surveys_user ON SurveyResponses(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_surveys_type ON SurveyResponses(survey_type)',
      'CREATE INDEX IF NOT EXISTS idx_analytics_metric ON AnalyticsCache(metric_name)',
      'CREATE INDEX IF NOT EXISTS idx_audit_user ON AuditLogs(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_audit_action ON AuditLogs(action)'
    ];
    
    let completed = 0;
    indexes.forEach((sql, index) => {
      db.run(sql, (err) => {
        if (err) {
          reject(err);
        } else {
          completed++;
          if (completed === indexes.length) {
            console.log('All indexes created/verified');
            resolve();
          }
        }
      });
    });
  });
};

const seedData = async () => {
  return new Promise((resolve, reject) => {
    // Check if data already exists
    db.get('SELECT COUNT(*) as count FROM Users', async (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      
      if (row.count > 0) {
        console.log('Database already seeded');
        resolve();
        return;
      }
      
      try {
        // Create sample users
        const users = [
          {
            email: 'hr.manager@company.com',
            password: 'hr123456',
            first_name: 'Sarah',
            last_name: 'Johnson',
            department: 'HR',
            role: 'HR_Manager',
            employment_date: '2020-01-15'
          },
          {
            email: 'it.supervisor@company.com',
            password: 'it123456',
            first_name: 'Michael',
            last_name: 'Chen',
            department: 'IT',
            role: 'Department_Supervisor',
            employment_date: '2019-03-20'
          },
          {
            email: 'finance.supervisor@company.com',
            password: 'finance123456',
            first_name: 'Emily',
            last_name: 'Rodriguez',
            department: 'Finance',
            role: 'Department_Supervisor',
            employment_date: '2018-11-10'
          },
          {
            email: 'john.doe@company.com',
            password: 'employee123',
            first_name: 'John',
            last_name: 'Doe',
            department: 'IT',
            role: 'Employee',
            employment_date: '2021-06-01'
          },
          {
            email: 'jane.smith@company.com',
            password: 'employee123',
            first_name: 'Jane',
            last_name: 'Smith',
            department: 'HR',
            role: 'Employee',
            employment_date: '2022-02-15'
          },
          {
            email: 'bob.wilson@company.com',
            password: 'employee123',
            first_name: 'Bob',
            last_name: 'Wilson',
            department: 'Finance',
            role: 'Employee',
            employment_date: '2021-09-30'
          },
          {
            email: 'alice.brown@company.com',
            password: 'employee123',
            first_name: 'Alice',
            last_name: 'Brown',
            department: 'IT',
            role: 'Employee',
            employment_date: '2020-12-01'
          },
          {
            email: 'charlie.davis@company.com',
            password: 'employee123',
            first_name: 'Charlie',
            last_name: 'Davis',
            department: 'HR',
            role: 'Employee',
            employment_date: '2023-01-10'
          },
          {
            email: 'diana.miller@company.com',
            password: 'employee123',
            first_name: 'Diana',
            last_name: 'Miller',
            department: 'Finance',
            role: 'Employee',
            employment_date: '2022-07-20'
          },
          {
            email: 'eve.garcia@company.com',
            password: 'employee123',
            first_name: 'Eve',
            last_name: 'Garcia',
            department: 'IT',
            role: 'Employee',
            employment_date: '2021-04-15'
          },
          {
            email: 'frank.martinez@company.com',
            password: 'employee123',
            first_name: 'Frank',
            last_name: 'Martinez',
            department: 'HR',
            role: 'Employee',
            employment_date: '2020-08-05'
          },
          {
            email: 'grace.lee@company.com',
            password: 'employee123',
            first_name: 'Grace',
            last_name: 'Lee',
            department: 'Finance',
            role: 'Employee',
            employment_date: '2022-11-12'
          },
          {
            email: 'henry.taylor@company.com',
            password: 'employee123',
            first_name: 'Henry',
            last_name: 'Taylor',
            department: 'IT',
            role: 'Employee',
            employment_date: '2021-01-25'
          },
          {
            email: 'ivy.anderson@company.com',
            password: 'employee123',
            first_name: 'Ivy',
            last_name: 'Anderson',
            department: 'HR',
            role: 'Employee',
            employment_date: '2023-03-08'
          },
          {
            email: 'jack.thomas@company.com',
            password: 'employee123',
            first_name: 'Jack',
            last_name: 'Thomas',
            department: 'Finance',
            role: 'Employee',
            employment_date: '2020-05-18'
          }
        ];
        
        // Insert users
        for (const user of users) {
          const hashedPassword = await bcrypt.hash(user.password, 10);
          await new Promise((resolveInsert, rejectInsert) => {
            db.run(
              `INSERT INTO Users (email, password_hash, first_name, last_name, department, role, employment_date) 
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [user.email, hashedPassword, user.first_name, user.last_name, user.department, user.role, user.employment_date],
              function(err) {
                if (err) {
                  rejectInsert(err);
                } else {
                  resolveInsert();
                }
              }
            );
          });
        }
        
        console.log('Sample data seeded successfully');
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });
};

module.exports = {
  db,
  initializeDatabase
};
