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

// Add this right after app.use(express.json());
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost",
      "https://tradeflow-ui.vercel.app",
    ],
    credentials: true,
  }),
);

// Health check (public)
app.get("/health", (req, res) => res.json({ status: "ok" }));

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

const PORT = process.env.PORT || 3000;
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

  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
};

start();
// Alternative if you want to run migrate separately:
// migrate().then(() => {
//   app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
// });
// app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

module.exports = app;
