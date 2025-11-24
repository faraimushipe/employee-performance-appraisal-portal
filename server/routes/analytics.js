const express = require('express');
const { db } = require('../database/init');
const { authenticateToken, authorize, departmentScope, checkPermission } = require('../middleware/auth');

const router = express.Router();

// Statistical calculation helpers
const calculateMean = (values) => {
  return values.reduce((sum, val) => sum + val, 0) / values.length;
};

const calculateStandardDeviation = (values, mean) => {
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
};

const calculateTTest = (group1, group2) => {
  const mean1 = calculateMean(group1);
  const mean2 = calculateMean(group2);
  const std1 = calculateStandardDeviation(group1, mean1);
  const std2 = calculateStandardDeviation(group2, mean2);
  
  const n1 = group1.length;
  const n2 = group2.length;
  
  const pooledStd = Math.sqrt(((n1 - 1) * std1 * std1 + (n2 - 1) * std2 * std2) / (n1 + n2 - 2));
  const tStatistic = (mean1 - mean2) / (pooledStd * Math.sqrt(1/n1 + 1/n2));
  
  // Simplified p-value calculation (for demonstration)
  const degreesOfFreedom = n1 + n2 - 2;
  const pValue = 2 * (1 - Math.abs(tStatistic) / Math.sqrt(degreesOfFreedom));
  
  return {
    tStatistic,
    pValue,
    mean1,
    mean2,
    significant: pValue < 0.05
  };
};

const calculateCorrelation = (x, y) => {
  const n = x.length;
  const meanX = calculateMean(x);
  const meanY = calculateMean(y);
  
  let numerator = 0;
  let sumXSquared = 0;
  let sumYSquared = 0;
  
  for (let i = 0; i < n; i++) {
    const xDiff = x[i] - meanX;
    const yDiff = y[i] - meanY;
    numerator += xDiff * yDiff;
    sumXSquared += xDiff * xDiff;
    sumYSquared += yDiff * yDiff;
  }
  
  const denominator = Math.sqrt(sumXSquared * sumYSquared);
  return denominator === 0 ? 0 : numerator / denominator;
};

// HR Manager - Comprehensive Analytics
router.get('/comprehensive', [
  authenticateToken,
  authorize('HR_Manager'),
  checkPermission('analytics', 'read_all')
], async (req, res) => {
  try {
    // Cross-department performance comparison
    const departmentPerformance = await new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          e.department,
          COUNT(pr.id) as total_reviews,
          AVG(CAST(json_extract(pr.ratings, '$.overall') AS REAL)) as avg_overall_rating,
          AVG(CAST(json_extract(pr.ratings, '$.technical') AS REAL)) as avg_technical_rating,
          AVG(CAST(json_extract(pr.ratings, '$.communication') AS REAL)) as avg_communication_rating,
          AVG(CAST(json_extract(pr.ratings, '$.leadership') AS REAL)) as avg_leadership_rating
        FROM PerformanceReviews pr
        JOIN Users e ON pr.employee_id = e.id
        WHERE pr.status = 'approved'
        GROUP BY e.department
        ORDER BY avg_overall_rating DESC
      `;
      
      db.all(sql, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });

    // Statistical analysis between departments
    const overallRatings = {};
    departmentPerformance.forEach(dept => {
      const rating = parseFloat(dept.avg_overall_rating);
      if (!isNaN(rating)) {
        overallRatings[dept.department] = rating;
      }
    });

    const departments = Object.keys(overallRatings);
    const statisticalAnalysis = {};
    
    for (let i = 0; i < departments.length; i++) {
      for (let j = i + 1; j < departments.length; j++) {
        const dept1 = departments[i];
        const dept2 = departments[j];
        
        // Get individual ratings for t-test
        const dept1Ratings = await new Promise((resolve, reject) => {
          const sql = `
            SELECT CAST(json_extract(pr.ratings, '$.overall') AS REAL) as rating
            FROM PerformanceReviews pr
            JOIN Users e ON pr.employee_id = e.id
            WHERE e.department = ? AND pr.status = 'approved'
          `;
          
          db.all(sql, [dept1], (err, rows) => {
            if (err) {
              reject(err);
            } else {
              resolve(rows.map(row => row.rating));
            }
          });
        });

        const dept2Ratings = await new Promise((resolve, reject) => {
          const sql = `
            SELECT CAST(json_extract(pr.ratings, '$.overall') AS REAL) as rating
            FROM PerformanceReviews pr
            JOIN Users e ON pr.employee_id = e.id
            WHERE e.department = ? AND pr.status = 'approved'
          `;
          
          db.all(sql, [dept2], (err, rows) => {
            if (err) {
              reject(err);
            } else {
              resolve(rows.map(row => row.rating));
            }
          });
        });

        if (dept1Ratings.length > 1 && dept2Ratings.length > 1) {
          const tTest = calculateTTest(dept1Ratings, dept2Ratings);
          statisticalAnalysis[`${dept1}_vs_${dept2}`] = tTest;
        }
      }
    }

    // Organization-wide trends
    const monthlyTrends = await new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          strftime('%Y-%m', pr.created_at) as month,
          COUNT(pr.id) as reviews_count,
          AVG(CAST(json_extract(pr.ratings, '$.overall') AS REAL)) as avg_rating
        FROM PerformanceReviews pr
        WHERE pr.status = 'approved'
        GROUP BY strftime('%Y-%m', pr.created_at)
        ORDER BY month DESC
        LIMIT 12
      `;
      
      db.all(sql, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });

    // Strategic recommendations
    const recommendations = [];
    
    // Find department with lowest performance
    if (departmentPerformance.length > 0) {
      const lowestPerformingDept = departmentPerformance.reduce((min, dept) => 
        (dept.avg_overall_rating ?? Infinity) < (min.avg_overall_rating ?? Infinity) ? dept : min
      );
      
      if (lowestPerformingDept && lowestPerformingDept.avg_overall_rating != null && lowestPerformingDept.avg_overall_rating < 3.0) {
      recommendations.push({
        type: 'performance_improvement',
        department: lowestPerformingDept.department,
        message: `Focus on performance improvement initiatives for ${lowestPerformingDept.department} department`,
        priority: 'high'
      });
      }
    }

    // Check for significant differences
    Object.entries(statisticalAnalysis).forEach(([comparison, analysis]) => {
      if (analysis.significant) {
        recommendations.push({
          type: 'statistical_insight',
          comparison,
          message: `Significant performance difference detected between departments (p-value: ${analysis.pValue.toFixed(4)})`,
          priority: 'medium'
        });
      }
    });

    res.json({
      department_performance: departmentPerformance,
      statistical_analysis: statisticalAnalysis,
      monthly_trends: monthlyTrends,
      recommendations,
      generated_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('Comprehensive analytics error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to generate comprehensive analytics'
    });
  }
});

// Department Supervisor - Department Analytics
router.get('/department', [
  authenticateToken,
  authorize('Department_Supervisor'),
  departmentScope,
  checkPermission('analytics', 'read_dept')
], async (req, res) => {
  try {
    const department = req.user.department;

    // Team performance within department
    const teamPerformance = await new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          e.id,
          e.first_name,
          e.last_name,
          e.role,
          COUNT(pr.id) as total_reviews,
          AVG(CAST(json_extract(pr.ratings, '$.overall') AS REAL)) as avg_overall_rating,
          MAX(pr.created_at) as last_review_date
        FROM Users e
        LEFT JOIN PerformanceReviews pr ON e.id = pr.employee_id AND pr.status = 'approved'
        WHERE e.department = ? AND e.is_active = 1
        GROUP BY e.id, e.first_name, e.last_name, e.role
        ORDER BY avg_overall_rating DESC
      `;
      
      db.all(sql, [department], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });

    // Competency gaps analysis
    const competencyGaps = await new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          json_extract(pr.competencies, '$.technical') as technical,
          json_extract(pr.competencies, '$.communication') as communication,
          json_extract(pr.competencies, '$.leadership') as leadership,
          json_extract(pr.competencies, '$.problem_solving') as problem_solving
        FROM PerformanceReviews pr
        JOIN Users e ON pr.employee_id = e.id
        WHERE e.department = ? AND pr.status = 'approved'
      `;
      
      db.all(sql, [department], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });

    // Calculate average competency scores
    const competencyAverages = {
      technical: 0,
      communication: 0,
      leadership: 0,
      problem_solving: 0
    };

    if (competencyGaps.length > 0) {
      Object.keys(competencyAverages).forEach(competency => {
        const values = competencyGaps
          .map(row => parseFloat(row[competency]))
          .filter(val => !isNaN(val));
        
        if (values.length > 0) {
          competencyAverages[competency] = calculateMean(values);
        }
      });
    }

    // Identify gaps (scores below 3.0)
    const gaps = Object.entries(competencyAverages)
      .filter(([_, score]) => score < 3.0)
      .map(([competency, score]) => ({
        competency,
        average_score: score,
        gap_size: 3.0 - score
      }));

    // Development plan completion rates
    const developmentStats = await new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          dp.completion_status,
          COUNT(*) as count
        FROM DevelopmentPlans dp
        JOIN Users e ON dp.employee_id = e.id
        WHERE e.department = ?
        GROUP BY dp.completion_status
      `;
      
      db.all(sql, [department], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });

    // Resource allocation recommendations
    const recommendations = [];
    
    if (gaps.length > 0) {
      recommendations.push({
        type: 'competency_development',
        message: `Focus on developing ${gaps.map(g => g.competency).join(', ')} competencies`,
        priority: 'high'
      });
    }

    const lowPerformers = teamPerformance.filter(emp => emp.avg_overall_rating < 3.0);
    if (lowPerformers.length > 0) {
      recommendations.push({
        type: 'performance_support',
        message: `Provide additional support for ${lowPerformers.length} team members with below-average performance`,
        priority: 'medium'
      });
    }

    res.json({
      department,
      team_performance: teamPerformance,
      competency_averages: competencyAverages,
      competency_gaps: gaps,
      development_stats: developmentStats,
      recommendations,
      generated_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('Department analytics error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to generate department analytics'
    });
  }
});

// Employee - Personal Analytics
router.get('/personal', [
  authenticateToken,
  authorize('Employee'),
  checkPermission('analytics', 'read_personal')
], async (req, res) => {
  try {
    const userId = req.user.id;

    // Personal performance trends
    const performanceTrends = await new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          pr.review_period,
          pr.created_at,
          CAST(json_extract(pr.ratings, '$.overall') AS REAL) as overall_rating,
          CAST(json_extract(pr.ratings, '$.technical') AS REAL) as technical_rating,
          CAST(json_extract(pr.ratings, '$.communication') AS REAL) as communication_rating,
          CAST(json_extract(pr.ratings, '$.leadership') AS REAL) as leadership_rating
        FROM PerformanceReviews pr
        WHERE pr.employee_id = ? AND pr.status = 'approved'
        ORDER BY pr.created_at ASC
      `;
      
      db.all(sql, [userId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });

    // Development progress tracking
    const developmentProgress = await new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          dp.skill_category,
          dp.skill_name,
          dp.current_level,
          dp.target_level,
          dp.completion_status,
          dp.impact_rating,
          dp.created_at,
          dp.updated_at
        FROM DevelopmentPlans dp
        WHERE dp.employee_id = ?
        ORDER BY dp.created_at DESC
      `;
      
      db.all(sql, [userId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });

    // Goal achievement metrics
    const goalAchievement = await new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          pr.review_period,
          json_extract(pr.goals_set, '$') as goals,
          pr.status
        FROM PerformanceReviews pr
        WHERE pr.employee_id = ?
        ORDER BY pr.created_at DESC
        LIMIT 5
      `;
      
      db.all(sql, [userId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });

    // Calculate personal statistics
    const personalStats = {
      total_reviews: performanceTrends.length,
      average_rating: performanceTrends.length > 0 ? 
        calculateMean(performanceTrends.map(r => r.overall_rating)) : 0,
      rating_trend: performanceTrends.length > 1 ? 
        performanceTrends[performanceTrends.length - 1].overall_rating - performanceTrends[0].overall_rating : 0,
      development_plans: developmentProgress.length,
      completed_plans: developmentProgress.filter(dp => dp.completion_status === 'completed').length,
      in_progress_plans: developmentProgress.filter(dp => dp.completion_status === 'in_progress').length
    };

    // Anonymized peer comparison (department average)
    const peerComparison = await new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          AVG(CAST(json_extract(pr.ratings, '$.overall') AS REAL)) as dept_avg_rating,
          COUNT(pr.id) as dept_total_reviews
        FROM PerformanceReviews pr
        JOIN Users e ON pr.employee_id = e.id
        WHERE e.department = ? AND pr.status = 'approved' AND e.id != ?
      `;
      
      db.get(sql, [req.user.department, userId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });

    res.json({
      personal_stats: personalStats,
      performance_trends: performanceTrends,
      development_progress: developmentProgress,
      goal_achievement: goalAchievement,
      peer_comparison: {
        department_average: peerComparison.dept_avg_rating || 0,
        department_total_reviews: peerComparison.dept_total_reviews || 0,
        personal_vs_department: personalStats.average_rating - (peerComparison.dept_avg_rating || 0)
      },
      generated_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('Personal analytics error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to generate personal analytics'
    });
  }
});

// Export analytics data for research
router.get('/export/:format', [
  authenticateToken,
  authorize('HR_Manager'),
  checkPermission('analytics', 'export')
], async (req, res) => {
  try {
    const format = req.params.format;
    
    if (!['json', 'csv'].includes(format)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid export format. Supported formats: json, csv'
      });
    }

    // Get all performance data for export
    const exportData = await new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          pr.id as review_id,
          e.id as employee_id,
          e.first_name,
          e.last_name,
          e.department,
          e.role,
          e.employment_date,
          pr.review_period,
          pr.goals_set,
          pr.ratings,
          pr.competencies,
          pr.status,
          pr.created_at as review_date,
          r.first_name as reviewer_first_name,
          r.last_name as reviewer_last_name
        FROM PerformanceReviews pr
        JOIN Users e ON pr.employee_id = e.id
        JOIN Users r ON pr.reviewer_id = r.id
        WHERE pr.status = 'approved'
        ORDER BY pr.created_at DESC
      `;
      
      db.all(sql, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });

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
        'review_id', 'employee_id', 'first_name', 'last_name', 'department', 'role',
        'employment_date', 'review_period', 'goals_set', 'ratings', 'competencies',
        'status', 'review_date', 'reviewer_first_name', 'reviewer_last_name'
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
      res.setHeader('Content-Disposition', 'attachment; filename=performance_data.csv');
      res.send(csvContent);
    }

  } catch (error) {
    console.error('Export analytics error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to export analytics data'
    });
  }
});

module.exports = router;
