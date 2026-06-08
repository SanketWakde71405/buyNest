import { User } from "../models/users.models.js";
import { ApiError } from "../utils/ApiError.js";
import jwt from "jsonwebtoken";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ROLES } from "../constants.js";

export const verifyJWT = asyncHandler(async (req, res, next) => {
  const token =
    req.cookies?.accessToken ||
    req.header("Authorization")?.replace("Bearer ", "");

  if (!token) {
    throw new ApiError(401, "Unauthorized access - token is missing");
  }

  try {
    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    const user = await User.findById(decodedToken?._id).select(
      "-password -refreshToken -passwordResetToken -passwordResetExpiry -emailVerificationToken -emailVerificationExpiry",
    );

    if (!user) {
      throw new ApiError(404, "Invalid token - user not found");
    }
    req.user = user;
    next();
  } catch (error) {
    throw new ApiError(401, "Unauthorized access - invalid or expired token");
  }
});

export const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    const user = req.user;

    if (!user) {
      throw new ApiError(401, "Unauthorized access");
    }

    if (!allowedRoles.includes(user.role)) {
      throw new ApiError(403, "Forbidden - insufficient permissions");
    }

    next();
  };
};
