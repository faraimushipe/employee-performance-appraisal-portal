const { Pool } = require('pg');

// PostgreSQL connection for Render deployment
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Export db interface that matches SQLite for compatibility
const db = {
  get: (sql, params) => {
    console.log('PostgreSQL Query (get):', sql, params);
    // Convert SQLite ? parameters to PostgreSQL $1, $2, etc.
    let pgSql = sql;
    if (params && params.length > 0) {
      let paramIndex = 1;
      pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
    }
    console.log('Converted PostgreSQL Query:', pgSql, params);
    return new Promise((resolve, reject) => {
      pool.query(pgSql, params)
        .then(result => {
          resolve(result.rows[0]);
        })
        .catch(err => {
          console.error('PostgreSQL Error (get):', err);
          reject(err);
        });
    });
  },
  all: (sql, params) => {
    console.log('PostgreSQL Query (all):', sql, params);
    // Convert SQLite ? parameters to PostgreSQL $1, $2, etc.
    let pgSql = sql;
    if (params && params.length > 0) {
      let paramIndex = 1;
      pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
    }
    console.log('Converted PostgreSQL Query:', pgSql, params);
    return new Promise((resolve, reject) => {
      pool.query(pgSql, params)
        .then(result => {
          resolve(result.rows);
        })
        .catch(err => {
          console.error('PostgreSQL Error (all):', err);
          reject(err);
        });
    });
  },
  run: (sql, params) => {
    console.log('PostgreSQL Query (run):', sql, params);
    // Convert SQLite ? parameters to PostgreSQL $1, $2, etc.
    let pgSql = sql;
    if (params && params.length > 0) {
      let paramIndex = 1;
      pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
    }
    console.log('Converted PostgreSQL Query:', pgSql, params);
    return new Promise((resolve, reject) => {
      pool.query(pgSql, params)
        .then(result => {
          resolve({ lastID: result.insertId, changes: result.rowCount });
        })
        .catch(err => {
          console.error('PostgreSQL Error (run):', err);
          reject(err);
        });
    });
  }
};

// Initialize PostgreSQL database
const initializePostgresDB = async () => {
  try {
    // Create tables if they don't exist
    await createUsersTable();
    await createPerformanceReviewsTable();
    await createDevelopmentPlansTable();
    await createSurveyResponsesTable();
    await createAnalyticsCacheTable();
    await createAuditLogsTable();
    
    console.log('PostgreSQL database initialized successfully');
  } catch (error) {
    console.error('Error initializing PostgreSQL database:', error);
    throw error;
  }
};

const createUsersTable = async () => {
  const sql = `
    CREATE TABLE IF NOT EXISTS Users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      department VARCHAR(50) NOT NULL CHECK (department IN ('HR', 'IT', 'Finance')),
      role VARCHAR(50) NOT NULL CHECK (role IN ('HR_Manager', 'Department_Supervisor', 'Employee')),
      employment_date DATE NOT NULL,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await pool.query(sql);
};

const createPerformanceReviewsTable = async () => {
  const sql = `
    CREATE TABLE IF NOT EXISTS PerformanceReviews (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER REFERENCES Users(id) ON DELETE CASCADE,
      reviewer_id INTEGER REFERENCES Users(id) ON DELETE CASCADE,
      review_period VARCHAR(50) NOT NULL,
      status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'completed')),
      goals JSONB,
      ratings JSONB,
      overall_score DECIMAL(3,2),
      comments TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await pool.query(sql);
};

const createDevelopmentPlansTable = async () => {
  const sql = `
    CREATE TABLE IF NOT EXISTS DevelopmentPlans (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER REFERENCES Users(id) ON DELETE CASCADE,
      supervisor_id INTEGER REFERENCES Users(id) ON DELETE CASCADE,
      title VARCHAR(200) NOT NULL,
      description TEXT,
      skills JSONB,
      target_date DATE,
      status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused')),
      progress_updates JSONB DEFAULT '[]',
      completion_date DATE,
      impact_rating DECIMAL(3,2),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await pool.query(sql);
};

const createSurveyResponsesTable = async () => {
  const sql = `
    CREATE TABLE IF NOT EXISTS SurveyResponses (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES Users(id) ON DELETE CASCADE,
      survey_type VARCHAR(50) NOT NULL,
      responses JSONB NOT NULL,
      submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      department VARCHAR(50),
      role VARCHAR(50)
    )
  `;
  await pool.query(sql);
};

const createAnalyticsCacheTable = async () => {
  const sql = `
    CREATE TABLE IF NOT EXISTS AnalyticsCache (
      id SERIAL PRIMARY KEY,
      cache_key VARCHAR(255) UNIQUE NOT NULL,
      data JSONB NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await pool.query(sql);
};

const createAuditLogsTable = async () => {
  const sql = `
    CREATE TABLE IF NOT EXISTS AuditLogs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES Users(id) ON DELETE SET NULL,
      action VARCHAR(100) NOT NULL,
      resource_type VARCHAR(50) NOT NULL,
      resource_id INTEGER,
      old_values JSONB,
      new_values JSONB,
      ip_address INET,
      user_agent TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await pool.query(sql);
};

module.exports = {
  db,
  pool,
  initializeDatabase: initializePostgresDB
};
