import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/users.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import crypto from "crypto";
import {
  emailVerificationMailgenContent,
  passwordResetMailgenContent,
  sendEmail,
} from "../utils/mail.js";

// get user details from frontend
// validation - not empty
// check if user already exists: username, email
// check for images, check for avatar
// upload them to cloudinary, avatar
// create user object - create entry in db
// remove password and refresh token field from response
// check for user creation
// return res

const sendVerificationEmail = async (user, req) => {
  const { unHashedToken, hashedToken, tokenExpiry } =
    user.generateTemporaryToken();

  user.emailVerificationToken = hashedToken;

  user.emailVerificationExpiry = tokenExpiry;

  await user.save({
    validateBeforeSave: false,
  });

  await sendEmail({
    email: user.email,

    subject: "Verify your email",

    mailgenContent: emailVerificationMailgenContent(
      user.name,

      `${req.protocol}://${req.get(
        "host",
      )}/api/v1/auth/verify-email/${unHashedToken}`,
    ),
  });
};

const sendPasswordResetEmail = async (user, req) => {
  const { unHashedToken, hashedToken, tokenExpiry } =
    user.generateTemporaryToken();

  user.passwordResetToken = hashedToken;
  user.passwordResetExpiry = tokenExpiry;

  await user.save({
    validateBeforeSave: false,
  });

  await sendEmail({
    email: user.email,
    subject: "Reset your password",
    mailgenContent: passwordResetMailgenContent(
      user.name,
      `${req.protocol}://${req.get(
        "host",
      )}/api/v1/auth/reset-password/${unHashedToken}`,
    ),
  });
};

const generateAccessandRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(404, "User not found");
    }
    const refreshToken = user.generateRefreshToken();
    const accessToken = user.generateAccessToken();

    user.refreshToken = refreshToken;

    await user.save({ validateBeforeSave: false });
    return { accessToken, refreshToken };
  } catch (error) {
     console.error("Token generation error:", error.message); 
    throw new ApiError(500, "Failed to generate authentication tokens");
  }
};

const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    throw new ApiError(400, "Name, email and password are required");
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new ApiError(400, "User with this email already exists");
  }

  const user = await User.create({ name, email, password, role });

  if (!user) {
    throw new ApiError(500, "Failed to create user");
  }

  
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken -emailVerificationToken -emailVerificationExpiry",
  );

  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering the user");
  }

  await sendVerificationEmail(user, req);

  return res
    .status(201)
    .json(
      new ApiResponse(
        200,
        createdUser,
        "User registered Successfully. Please verify your email to activate your account.",
      ),
    );
});

const resendVerificationEmail = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (user.isVerified) {
    throw new ApiError(400, "Email is already verified");
  }

  await sendVerificationEmail(user, req);

  return res
    .status(200)
    .json(new ApiResponse(200, null, "Verification email resent successfully"));
});

const verifyEmail = asyncHandler(async (req, res) => {
  const { verificationToken } = req.params;

  // console.log("Original Token:", verificationToken);
  if (!verificationToken) {
    throw new ApiError(400, "Verification token is required");
  }

  let hashedToken = crypto
    .createHash("sha256")
    .update(verificationToken)
    .digest("hex");

  // console.log("Hashed Token:", hashedToken);

  const user = await User.findOne({
    emailVerificationToken: hashedToken,
    emailVerificationExpiry: { $gt: Date.now() },
  });

  if (!user) {
    throw new ApiError(400, "Token is invalid or expired");
  }

  user.emailVerificationToken = undefined;
  user.emailVerificationExpiry = undefined;

  user.isVerified = true;
  await user.save({ validateBeforeSave: false });

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        isVerified: true,
      },
      "Email is verified",
    ),
  );
});

const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ApiError(400, "Email and password are required");
  }

  const user = await User.findOne({ email });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const isPasswordCorrect = await user.isPasswordCorrect(password);

  if (!isPasswordCorrect) {
    throw new ApiError(401, "Invalid credentials");
  }

  const { accessToken, refreshToken } = await generateAccessandRefreshToken(
    user._id,
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken -emailVerificationToken -emailVerificationExpiry",
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("refreshToken", refreshToken, options)
    .cookie("accessToken", accessToken, options)
    .json(
      new ApiResponse(
        200,
        { user: loggedInUser, accessToken, refreshToken },
        "User logged in successfully",
      ),
    );
});

const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw new ApiError(400, "Email is required");
  }

  const user = await User.findOne({ email });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  await sendPasswordResetEmail(user, req);

  return res.
  status(200).
  json(new ApiResponse(200, null, "Password reset email sent successfully"));

});

const resetPassword = asyncHandler(async (req,res) =>{
  const { resetToken } = req.params;
  const { newPassword } = req.body;

  if (!resetToken) {
    throw new ApiError(400, "Reset token is required");
  }

  if (!newPassword) {
    throw new ApiError(400, "New password is required");
  }

  const hashedToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");
  
  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpiry: { $gt: Date.now() },
  });

  if (!user) {
    throw new ApiError(400, "Token is invalid or expired");
  }
  
  user.password = newPassword;
  user.passwordResetToken = undefined;
  user.passwordResetExpiry = undefined;

  await user.save();

  return res.
  status(200).
  json(new ApiResponse(200,null,"Password has been reset successfully"));
  
});

const refreshTokens= asyncHandler(async(req,res)=>{
  const incomingRefreshToken =
    req.cookies.refreshToken ||
    req.body.refreshToken;


  if(!incomingRefreshToken){
    throw new ApiError(400,"Refresh token is required");
  }

  const decodedToken = jwt.verify(
    incomingRefreshToken,
    process.env.REFRESH_TOKEN_SECRET,
  );

  const user = await User.findById(decodedToken?._id);

  if (!user){
    throw new ApiError(404,"User not found");
  }

  if (user.refreshToken !== incomingRefreshToken){
    throw new ApiError(401,"Invalid refresh token or refresh token is expired");
  }

  const { accessToken, refreshToken: newRefreshToken } = await generateAccessandRefreshToken(
    user._id,
  );

  const options ={
    httpOnly: true,
    secure: true,
  };

  user.refreshToken = newRefreshToken;
  await user.save();

  return res.
  status(200).
  cookie("refreshToken",newRefreshToken,options).
  cookie("accessToken",accessToken,options).
  json(new ApiResponse(200,{ accessToken, refreshToken: newRefreshToken },"Tokens refreshed successfully"));

});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: "",
      },
    },
    {
      new: true,
    },
  );
  const options = {
    httpOnly: true,
    secure: true,
  };
  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out"));
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
        throw new ApiError(400, "Old password and new password are required");
    }

    const user = await User.findById(req.user?._id);
    if (!user) {
        throw new ApiError(404, "User not found");
    }
    const isOldPasswordCorrect = await user.isPasswordCorrect(oldPassword);
    if (!isOldPasswordCorrect) {
        throw new ApiError(401, "Old password is incorrect");
    }
    user.password = newPassword;
    await user.save({validateBeforeSave: false});
    return res.status(200).json(new ApiResponse(200, null, "Password changed successfully"));
});


export { 
  registerUser, 
  verifyEmail, 
  resendVerificationEmail, 
  loginUser, 
  forgotPassword,
  resetPassword,
  refreshTokens,
  logoutUser,
  changeCurrentPassword
};
