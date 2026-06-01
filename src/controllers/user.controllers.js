import {ApiResponse} from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {uploadOnCloudinary} from "../utils/cloudinary.js";
import {User} from "../models/users.models.js";
import { ApiError } from "../utils/ApiError.js";
import mongoose from "mongoose";
import {ROLES} from "../constants.js";

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "Current user fetched successfully"));
});

// ✅ Only allow updating name and role for now 
const updateUserDetails = asyncHandler(async (req,res) =>{
    const {name, role} = req.body;

    if(!name || !role){
        return res.status(400).json(new ApiResponse(400, null, "Name and role are required"));
    }

    if(!Object.values(ROLES).includes(role)){
        return res.status(400).json(new ApiResponse(400, null, "Invalid role value"));
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        { name, role },
        { new: true }
    ).select("-password -refreshToken -emailVerificationToken -emailVerificationExpiry -passwordResetToken -passwordResetExpiry");

    return res.
    status(200).
    json(new ApiResponse(200, user,"User details updated successfully"));

});

const updateUserAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.file?.path;

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is missing");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);

  if (!avatar || !avatar.url) {
    // ✅ null-safe check
    throw new ApiError(400, "Error while uploading avatar");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    { $set: { avatar: avatar.url } },
    { new: true },
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Avatar image updated successfully"));
});



export { getCurrentUser, updateUserDetails, updateUserAvatar };