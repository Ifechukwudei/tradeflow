require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per `window`
  message: { error: 'Too many requests from this IP, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

const { authenticate, authorize } = require("./middleware/auth.middleware");

const authRoutes = require("./routes/auth.routes");
const productRoutes = require("./routes/product.routes");
const inventoryRoutes = require("./routes/inventory.routes");
const customerRoutes = require("./routes/customer.routes");
const orderRoutes = require("./routes/order.routes");
const invoiceRoutes = require("./routes/invoice.routes");
const reportsRoutes = require("./routes/reports.routes");
const returnRoutes = require("./routes/return.routes");
const auditRoutes = require("./routes/audit.routes");
const { migrate } = require("./db/migrate");

const app = express();
app.use(express.json());

app.use(cookieParser());

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

// Apply rate limiting to all requests
app.use(limiter);

// CORS configuration
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:5173",
      "http://localhost",
      "https://tradeflow-ui.vercel.app",
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

const db = require("./db");

// Health check (public)
app.get("/health", async (req, res) => {
  try {
    // Ping the database to keep it awake on free tiers (like Supabase)
    await db.query("SELECT 1");
    res.json({ status: "ok", database: "connected" });
  } catch (err) {
    res.status(500).json({ status: "error", database: "disconnected" });
  }
});

// Auth routes (public - login/register)
app.use("/api/auth", authRoutes);

// All routes below this line require authentication
app.use(authenticate);

// Role-based route protection
app.use("/api/products", productRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/returns", returnRoutes);
app.use("/api/audit-logs", auditRoutes);

// 404 handler
app.use((req, res) => res.status(404).json({ error: "Route not found" }));

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 5000;
const start = async () => {
  // Wait for postgres to be ready
  let retries = 10;
  while (retries > 0) {
    try {
      await migrate();
      break;
    } catch (err) {
      retries--;
      console.log(`Database not ready, retrying... (${retries} attempts left)`);
      await new Promise((res) => setTimeout(res, 3000));
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    
    // Keep Supabase awake by pinging the health endpoint internally every 14 minutes
    // (Railway doesn't sleep, so we just ping localhost to avoid external bandwidth usage)
    setInterval(() => {
      try {
        require('http').get(`http://127.0.0.1:${PORT}/health`, (res) => {
          if (res.statusCode === 200) console.log('Database keep-alive ping successful');
        });
      } catch (e) {
        console.error('Keep-alive ping failed:', e.message);
      }
    }, 14 * 60 * 1000);
  });
};

// Only start the server if we are not running in a Vercel Serverless environment
if (!process.env.VERCEL) {
  start();
}

module.exports = app;
