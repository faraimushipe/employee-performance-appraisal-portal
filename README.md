# Employee Performance Appraisal Portal (EPAP)

A comprehensive, research-grade Employee Performance Appraisal Portal built with React, Node.js, Express, and SQLite. This system serves as both a functional HR platform and an academic research tool with advanced role-based architecture, comprehensive analytics, and data integrity features.

## 🚀 Features

### Advanced Role-Based Architecture
- **HR_Manager**: Full system access, cross-department analytics, user management
- **Department_Supervisor**: Manage own department, review team members, access department analytics
- **Employee**: View own reviews, submit self-assessments, update development plans

### Department-Specific Features
- **HR**: Compliance metrics, policy adherence tracking
- **IT**: Technical competency matrices, innovation project tracking
- **Finance**: Accuracy metrics, deadline compliance, regulatory tracking

### Intelligent Database Schema
- Users with role-based permissions
- Performance Reviews with JSON-based goals and ratings
- Development Plans with progress tracking
- Survey Responses for research data collection
- Analytics Cache for statistical calculations
- Comprehensive Audit Logging

### Role-Specific Analytics Engine
- **HR_Manager**: Cross-department comparisons, statistical analysis, strategic recommendations
- **Department_Supervisor**: Team performance within department, competency gaps analysis
- **Employee**: Personal performance trends, development progress, peer comparison

### Research Data Integrity Framework
- Stratified data sampling by role and department
- Multi-level analysis framework
- Statistical calculations (t-tests, correlations, significance testing)
- Export functionality for dissertation data analysis

## 🛠️ Technology Stack

### Backend
- **Node.js** with Express.js
- **SQLite** database with proper indexing
- **JWT** authentication and authorization
- **bcryptjs** for password hashing
- **express-validator** for input validation
- **helmet** for security headers
- **cors** for cross-origin requests

### Frontend
- **React 18** with functional components and hooks
- **React Router** for navigation
- **Tailwind CSS** for styling
- **Recharts** for data visualization
- **React Hook Form** for form handling
- **Axios** for API communication
- **React Hot Toast** for notifications

## 📦 Installation

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Backend Setup
```bash
# Install dependencies
npm install

# Start the server
npm run server
```

### Frontend Setup
```bash
# Navigate to client directory
cd client

# Install dependencies
npm install

# Start the development server
npm start
```

### Full Development Setup
```bash
# Install all dependencies (backend + frontend)
npm run install-all

# Start both backend and frontend
npm run dev
```

## 🔐 Demo Accounts

The system comes with pre-seeded demo accounts:

- **HR Manager**: `hr.manager@company.com` / `hr123456`
- **IT Supervisor**: `it.supervisor@company.com` / `it123456`
- **Finance Supervisor**: `finance.supervisor@company.com` / `finance123456`
- **Employee**: `john.doe@company.com` / `employee123`

## 📊 Key Features

### 1. Role-Based Dashboard
Each role sees a customized dashboard with relevant metrics and quick actions.

### 2. Performance Reviews
- Create and manage performance reviews
- Multi-dimensional rating system
- Goal setting and tracking
- Review workflow (draft → submitted → approved → completed)

### 3. Development Plans
- Skill-based development planning
- Progress tracking with updates
- Impact rating system
- Completion status management

### 4. Survey System
- Role-specific survey templates
- Employee satisfaction surveys
- Supervisor effectiveness surveys
- HR strategic impact surveys

### 5. Advanced Analytics
- Statistical analysis with t-tests and correlations
- Department performance comparisons
- Personal performance trends
- Competency gap analysis
- Research-ready data exports

### 6. User Management
- Role-based user creation and management
- Department-specific access controls
- User profile management
- Password change functionality

## 🔒 Security Features

- JWT-based authentication
- Role-based access control (RBAC)
- Department-scoped data access
- Input validation and sanitization
- SQL injection prevention
- XSS protection
- Rate limiting
- Comprehensive audit logging

## 📈 Research Capabilities

### Data Export
- JSON and CSV export formats
- Role-based data filtering
- Statistical significance calculations
- Confidence intervals
- Correlation matrices

### Analytics Features
- Cross-department performance analysis
- Statistical hypothesis testing
- Trend analysis and forecasting
- Competency gap identification
- ROI measurement capabilities

## 🚀 Getting Started

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd employee-performance-appraisal-portal
   ```

2. **Install dependencies**
   ```bash
   npm run install-all
   ```

3. **Start the development servers**
   ```bash
   npm run dev
   ```

4. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000

5. **Login with demo credentials**
   Use any of the provided demo accounts to explore different role perspectives.

## 📁 Project Structure

```
epap/
├── server/                 # Backend API
│   ├── database/          # Database initialization and schema
│   ├── middleware/        # Authentication and authorization
│   ├── routes/           # API route handlers
│   └── index.js          # Server entry point
├── client/               # React frontend
│   ├── public/          # Static assets
│   ├── src/
│   │   ├── components/  # Reusable UI components
│   │   ├── contexts/    # React contexts (Auth)
│   │   ├── pages/       # Page components
│   │   ├── services/    # API service functions
│   │   └── App.js       # Main App component
│   └── package.json
├── package.json         # Root package.json
└── README.md
```

## 🔧 Configuration

### Environment Variables
Create a `.env` file in the server directory:

```env
NODE_ENV=development
PORT=5000
CLIENT_URL=http://localhost:3000
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=24h
```

### Database
The SQLite database is automatically created and seeded with sample data on first run. The database file is located at `server/database/epap.db`.

## 📊 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration (HR Manager only)
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update user profile
- `PUT /api/auth/change-password` - Change password

### Users
- `GET /api/users` - Get users (role-filtered)
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Deactivate user

### Performance Reviews
- `GET /api/reviews` - Get reviews (role-filtered)
- `POST /api/reviews` - Create review
- `PUT /api/reviews/:id` - Update review
- `POST /api/reviews/:id/submit` - Submit review
- `POST /api/reviews/:id/approve` - Approve review

### Development Plans
- `GET /api/development` - Get development plans
- `POST /api/development` - Create development plan
- `PUT /api/development/:id` - Update development plan
- `POST /api/development/:id/progress` - Add progress update
- `POST /api/development/:id/complete` - Complete plan

### Surveys
- `GET /api/surveys/available` - Get available surveys
- `POST /api/surveys/submit` - Submit survey response
- `GET /api/surveys/responses` - Get user responses
- `GET /api/surveys/analytics` - Get survey analytics

### Analytics
- `GET /api/analytics/comprehensive` - HR Manager analytics
- `GET /api/analytics/department` - Department Supervisor analytics
- `GET /api/analytics/personal` - Employee analytics
- `GET /api/analytics/export/:format` - Export analytics data

## 🧪 Testing

The system includes comprehensive test data and can be used for:
- Academic research on performance management systems
- HR process optimization studies
- Digital transformation impact analysis
- Employee engagement research

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📞 Support

For support or questions, please open an issue in the repository or contact the development team.

---

**Note**: This is a research-grade system designed for both operational use and academic research. Ensure you follow your organization's data protection policies when using this system in production environments.
