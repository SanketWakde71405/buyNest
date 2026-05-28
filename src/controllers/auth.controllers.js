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

const generateAccessandRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    if(!user){
        throw new ApiError(404, "User not found");
    }
    const refreshToken = user.generateRefreshToken();
    const accessToken = user.generateAccessToken();

    user.refreshToken = refreshToken;

    await user.save({ validateBeforeSave: false });
    return { accessToken, refreshToken };
  } catch (error) {
    console.error("Error generating tokens: ", error);
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

  sendVerificationEmail(user, req);

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken -emailVerificationToken -emailVerificationExpiry",
  );

  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering the user");
  }

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

  sendVerificationEmail(user, req);

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

const loginUser = asyncHandler(async(req,res)=>{
    const {email, password} = req.body;

    if(!email || !password){
        throw new ApiError(400, "Email and password are required");
    }

    const user = await User.findOne({email});

    if(!user){
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
    .json( new ApiResponse(200, {user:loggedInUser, accessToken, refreshToken}, "User logged in successfully"));

    
});

export { registerUser, verifyEmail, resendVerificationEmail, loginUser };
