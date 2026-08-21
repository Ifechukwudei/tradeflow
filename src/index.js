require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const { authenticate, authorize } = require("./middleware/auth.middleware");

const authRoutes = require("./routes/auth.routes");
const productRoutes = require("./routes/product.routes");
const inventoryRoutes = require("./routes/inventory.routes");
const customerRoutes = require("./routes/customer.routes");
const orderRoutes = require("./routes/order.routes");
const invoiceRoutes = require("./routes/invoice.routes");
const reportsRoutes = require("./routes/reports.routes");
const returnRoutes = require("./routes/return.routes");
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

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    
    // Prevent Render from sleeping by self-pinging every 14 minutes
    const keepAliveUrl = process.env.RENDER_EXTERNAL_URL || 'https://tradeflow-1-ss85.onrender.com';
    setInterval(() => {
      try {
        require('https').get(`${keepAliveUrl}/health`, (res) => {
          if (res.statusCode === 200) console.log('Keep-alive ping successful');
        });
      } catch (e) {
        console.error('Keep-alive ping failed:', e.message);
      }
    }, 14 * 60 * 1000);
  });
};

start();

module.exports = app;
