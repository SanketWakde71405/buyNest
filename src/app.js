import dotenv from "dotenv";
dotenv.config({ path: "./src/.env" });

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

// Routes
import authRouter from "./routes/auth.routes.js";
import healthCheckRouter from "./routes/healthCheck.routes.js";
import userRouter from "./routes/user.routes.js";
import addressRouter from "./routes/address.routes.js";
import categoriesRouter from "./routes/categories.routes.js";
import brandsRouter from "./routes/brands.routes.js";
import productsRouter from "./routes/products.routes.js";
import storeRouter from "./routes/store.routes.js";

const app = express();

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use(cookieParser());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  }),
);

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/health", healthCheckRouter);
app.use("/api/v1/users/me", userRouter);
app.use("/api/v1/users/addresses", addressRouter);
app.use("/api/v1/categories", categoriesRouter);
app.use("/api/v1/brands", brandsRouter);
app.use("/api/v1/products", productsRouter);
app.use("/api/v1/store",storeRouter);


// Error handler
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  return res.status(statusCode).json({
    statusCode,
    message: err.message || "Something went wrong",
    errors: err.errors || [],
    success: false,
  });
});

export default app;
