# 🚀 Deploy EPAP to Render (FREE)

This guide will help you deploy your Employee Performance Appraisal Portal to Render for **$0/month**.

## 📋 Prerequisites

1. **GitHub Account**: Push your code to GitHub
2. **Render Account**: Sign up at [render.com](https://render.com)
3. **Project Files**: All files should be committed to Git

## 🛠️ Setup Steps

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit - Ready for Render deployment"
git branch -M main
git remote add origin https://github.com/yourusername/employee-performance-appraisal-portal.git
git push -u origin main
```

### 2. Create Render Account

1. Go to [render.com](https://render.com)
2. Sign up with GitHub (FREE)
3. Verify your email

### 3. Deploy Backend

1. Click **"New +"** → **"Web Service"**
2. Connect your GitHub repository
3. Configure:
   - **Name**: `epap-backend`
   - **Environment**: `Node`
   - **Root Directory**: `server`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free` (selected by default)

4. **Environment Variables**:
   ```
   NODE_ENV=production
   JWT_SECRET=your-super-secret-jwt-key-here
   JWT_EXPIRES_IN=24h
   ```

5. **Create Database**:
   - Click **"New +"** → **"PostgreSQL"**
   - **Name**: `epap-db`
   - **Database Name**: `epap`
   - **User**: `epap_user`
   - **Plan**: `Free`

6. **Connect Database**:
   - Go back to your web service
   - Add Environment Variable:
     ```
     DATABASE_URL=[Copy from database page]
     ```

### 4. Deploy Frontend

1. Click **"New +"** → **"Static Site"**
2. Connect same GitHub repository
3. Configure:
   - **Name**: `epap-frontend`
   - **Root Directory**: `client`
   - **Build Command**: `npm run build`
   - **Publish Directory**: `build`
   - **Environment**: `React`

4. **Environment Variables**:
   ```
   REACT_APP_API_URL=https://epap-backend.onrender.com/api
   ```

### 5. Update API Configuration

The project is already configured to work with Render! The settings include:

- ✅ PostgreSQL support for production
- ✅ SQLite for local development
- ✅ Health check endpoint (`/api/health`)
- ✅ Proper CORS configuration
- ✅ Environment-based database selection

## 🔄 Automatic Deployment

Render automatically deploys when you:
- Push to GitHub
- Create a new branch
- Update environment variables

## 🌐 Access Your App

After deployment (2-3 minutes):
- **Frontend**: `https://epap-frontend.onrender.com`
- **Backend API**: `https://epap-backend.onrender.com/api`
- **Database**: Available via internal connection

## 🧪 Test Deployment

1. Visit your frontend URL
2. Login with demo credentials:
   - HR Manager: `hr.manager@company.com` / `hr123456`
   - Employee: `john.doe@company.com` / `employee123`

## 🔧 Troubleshooting

### Common Issues:

**"Build Failed"**
- Check that all dependencies are in package.json
- Verify build command is correct

**"Database Connection Failed"**
- Ensure DATABASE_URL is copied correctly
- Check database is created and running

**"CORS Errors"**
- Verify REACT_APP_API_URL is correct
- Check backend is running

### Logs & Debugging:

1. Go to your service on Render dashboard
2. Click **"Logs"** tab
3. Check for error messages
4. Use **"Manual Deploy"** to rebuild

## 💡 Pro Tips

1. **Custom Domain**: Add custom domain in settings
2. **Environment Branches**: Deploy preview versions for testing
3. **Backups**: Render automatically backs up PostgreSQL
4. **Monitoring**: Use Render's built-in metrics

## 📞 Support

- **Render Documentation**: [render.com/docs](https://render.com/docs)
- **Community**: [community.render.com](https://community.render.com)
- **GitHub Issues**: Check project issues for help

---

**🎉 Congratulations! Your EPAP is now live for FREE!**
