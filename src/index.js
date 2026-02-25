require("dotenv").config();
const express = require("express");

const productRoutes = require("./Routes/product.routes");
const inventoryRoutes = require("./Routes/inventory.routes");

const app = express();

app.use(express.json());

// Health check
app.get("/health", (req, res) => res.json({ status: "ok" }));

// Routes
app.use("/api/products", productRoutes);
app.use("/api/inventory", inventoryRoutes);

// 404 handler
app.use((req, res) => res.status(404).json({ error: "Route not found" }));

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

module.exports = app;
