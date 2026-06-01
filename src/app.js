import dotenv from "dotenv";
dotenv.config({ path: "./.env" });
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";


// Routes
import authRouter from "./routes/auth.routes.js";
import healthCheckRouter from "./routes/healthCheck.routes.js";
import userRouter from "./routes/user.routes.js";
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



export default app;