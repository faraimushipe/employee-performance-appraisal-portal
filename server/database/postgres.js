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
    let pgParams = params ? [...params] : [];
    
    if (params && params.length > 0) {
      let paramIndex = 1;
      pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
      
      // Fix boolean comparisons (SQLite uses 1/0, PostgreSQL uses true/false)
      pgSql = pgSql.replace(/= 1(?!\d)/g, '= true');
      pgSql = pgSql.replace(/= 0(?!\d)/g, '= false');
      
      // Convert boolean parameters (SQLite uses 1/0, PostgreSQL uses true/false)
      pgParams = pgParams.map(param => {
        if (param === 1) return true;
        if (param === 0) return false;
        return param;
      });
    }
    console.log('Converted PostgreSQL Query:', pgSql, pgParams);
    return new Promise((resolve, reject) => {
      pool.query(pgSql, pgParams)
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
    // If params is undefined, use empty array
    const safeParams = Array.isArray(params) ? [...params] : [];
    let pgSql = sql;
    
    // Convert SQLite ? parameters to PostgreSQL $1, $2, etc.
    if (safeParams.length > 0) {
      let paramIndex = 1;
      pgSql = sql.replace(/\?/g, (match, offset) => {
        // Skip replacing if it's part of a JSON operator (->> or ->)
        if (offset > 0 && (sql[offset - 1] === '>' && (offset === 1 || sql[offset - 2] === '-'))) {
          return match;
        }
        return `$${paramIndex++}`;
      });
      
      // Convert boolean parameters (SQLite uses 1/0, PostgreSQL uses true/false)
      const pgParams = safeParams.map(param => {
        if (param === 1 || param === '1') return true;
        if (param === 0 || param === '0') return false;
        return param;
      });
      
      // Fix boolean comparisons in the SQL (SQLite uses 1/0, PostgreSQL uses true/false)
      pgSql = pgSql.replace(/= 1(?!\d)/g, '= true');
      pgSql = pgSql.replace(/= 0(?!\d)/g, '= false');
      
      console.log('Converted PostgreSQL Query (all):', pgSql, pgParams);
      return pool.query(pgSql, pgParams)
        .then(result => result.rows)
        .catch(err => {
          console.error('PostgreSQL Error (all):', err);
          throw err;
        });
    }
    
    // If no parameters, execute directly
    console.log('Converted PostgreSQL Query (all):', pgSql, '[]');
    return pool.query(pgSql)
      .then(result => result.rows)
      .catch(err => {
        console.error('PostgreSQL Error (all):', err);
        throw err;
      });
  },
  run: (sql, params) => {
    console.log('PostgreSQL Query (run):', sql, params);
    // Convert SQLite ? parameters to PostgreSQL $1, $2, etc.
    let pgSql = sql;
    let pgParams = params ? [...params] : [];
    
    if (params && params.length > 0) {
      let paramIndex = 1;
      pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
      
      // Fix boolean comparisons (SQLite uses 1/0, PostgreSQL uses true/false)
      pgSql = pgSql.replace(/= 1(?!\d)/g, '= true');
      pgSql = pgSql.replace(/= 0(?!\d)/g, '= false');
      
      // Convert boolean parameters (SQLite uses 1/0, PostgreSQL uses true/false)
      pgParams = pgParams.map(param => {
        if (param === 1 || param === '1') return true;
        if (param === 0 || param === '0') return false;
        return param;
      });
    }
    
    console.log('Converted PostgreSQL Query (run):', pgSql, pgParams);
    return pool.query(pgSql, pgParams)
      .then(result => ({
        lastID: result.rows[0]?.id || 0,
        changes: result.rowCount
      }))
      .catch(err => {
        console.error('PostgreSQL Error (run):', err);
        throw err;
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
  try {
    // First, ensure Users table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "Users" (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        role VARCHAR(50) NOT NULL,
        department VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Then create SurveyResponses with foreign key
    const sql = `
      CREATE TABLE IF NOT EXISTS "SurveyResponses" (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        survey_type VARCHAR(50) NOT NULL,
        responses JSONB NOT NULL,
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        department VARCHAR(50),
        role VARCHAR(50),
        FOREIGN KEY (user_id) REFERENCES "Users"(id) ON DELETE CASCADE
      )
    `;
    
    await pool.query(sql);
    console.log('SurveyResponses table created or already exists');
    
    // Add any missing columns (for existing tables)
    try {
      await pool.query('ALTER TABLE "SurveyResponses" ADD COLUMN IF NOT EXISTS department VARCHAR(50)');
      await pool.query('ALTER TABLE "SurveyResponses" ADD COLUMN IF NOT EXISTS role VARCHAR(50)');
    } catch (alterError) {
      console.log('Columns already exist or could not be added:', alterError.message);
    }
    
  } catch (error) {
    console.error('Error creating SurveyResponses table:', error);
    throw error;
  }
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
