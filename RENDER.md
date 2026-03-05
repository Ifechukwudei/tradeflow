# Deploying Tradeflow to Render.com

## Prerequisites

1. A Render.com account
2. Your code pushed to a Git repository (GitHub, GitLab, or Bitbucket)

## Step 1: Create PostgreSQL Database

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **New +** → **PostgreSQL**
3. Configure:
   - **Name**: `tradeflow-db`
   - **Database**: `o2c_db`
   - **User**: `postgres` (or leave default)
   - **Region**: Choose closest to you
   - **Plan**: Free or paid
4. Click **Create Database**
5. **Save the Internal Database URL** - you'll need this!

## Step 2: Deploy Backend

1. Click **New +** → **Web Service**
2. Connect your Git repository
3. Configure:
   - **Name**: `tradeflow-backend`
   - **Region**: Same as database
   - **Branch**: `main` (or your branch)
   - **Root Directory**: `tradeflow`
   - **Runtime**: `Node`
   - **Build Command**: `chmod +x render-build.sh && ./render-build.sh`
   - **Start Command**: `chmod +x render-start.sh && ./render-start.sh`
   - **Plan**: Free or paid

4. **Add Environment Variables**:
   Click **Advanced** → **Add Environment Variable**
   
   ```
   PORT=3000
   NODE_ENV=production
   JWT_SECRET=tr4d3fl0w$3cr3tK3y!2026#xZ9
   JWT_EXPIRES_IN=7d
   ```

5. **Add Database Connection**:
   - Click **Add Environment Variable**
   - Select **Add from Database**
   - Choose your `tradeflow-db`
   - This will automatically add: `DATABASE_URL`

6. **Parse DATABASE_URL** (Render provides it as a single URL):
   Add these environment variables manually by parsing the DATABASE_URL:
   
   If your DATABASE_URL is: `postgres://user:password@host:5432/database`
   
   Add:
   ```
   DB_HOST=<host from DATABASE_URL>
   DB_PORT=5432
   DB_NAME=<database from DATABASE_URL>
   DB_USER=<user from DATABASE_URL>
   DB_PASSWORD=<password from DATABASE_URL>
   ```
   
   **OR** use the Internal Database URL from Step 1 and parse it.

7. Click **Create Web Service**

## Step 3: Deploy Frontend

1. Click **New +** → **Static Site**
2. Connect your Git repository
3. Configure:
   - **Name**: `tradeflow-frontend`
   - **Branch**: `main`
   - **Root Directory**: `tradeflow-ui`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`

4. **Add Environment Variable**:
   ```
   VITE_API_URL=https://tradeflow-backend.onrender.com/api
   ```
   (Replace with your actual backend URL)

5. Click **Create Static Site**

## Step 4: Update Frontend API URL

Update `tradeflow-ui/src/api/client.js`:

```javascript
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});
```

## Step 5: Update Backend CORS

Update `tradeflow/src/index.js` to allow your frontend domain:

```javascript
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://tradeflow-frontend.onrender.com', // Add your Render frontend URL
  ],
  credentials: true,
}));
```

## Troubleshooting

### Database Connection Issues

1. Check environment variables in Render dashboard
2. Verify DATABASE_URL is set correctly
3. Check logs: `View Logs` in Render dashboard

### Migration Failures

1. Check if database is accessible
2. Run migrations manually via Render Shell:
   ```bash
   node src/db/migrate.js
   ```

### CORS Errors

1. Ensure backend CORS includes your frontend URL
2. Check `withCredentials: true` is set in frontend
3. Verify cookies are being sent

### Free Tier Limitations

- Services spin down after 15 minutes of inactivity
- First request after spin-down takes ~30 seconds
- Database has 90-day expiration on free tier

## Alternative: Using DATABASE_URL Directly

If you prefer to use Render's `DATABASE_URL` directly, update `tradeflow/src/db/index.js`:

```javascript
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
```

## Useful Commands

### View Logs
In Render dashboard → Your service → Logs

### Access Shell
In Render dashboard → Your service → Shell

### Manual Migration
```bash
node src/db/migrate.js
```

### Check Database Connection
```bash
node -e "require('./src/db').query('SELECT NOW()').then(r => console.log(r.rows))"
```
