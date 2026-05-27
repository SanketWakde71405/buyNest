import {asyncHandler} from '../utils/asyncHandler.js';
import {User} from '../models/users.models.js';
import {ApiError} from '../utils/ApiError.js';
import {ApiResponse} from '../utils/ApiResponse.js';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { emailVerificationMailgenContent, sendEmail } from "../utils/mail.js";

 // get user details from frontend
    // validation - not empty
    // check if user already exists: username, email
    // check for images, check for avatar
    // upload them to cloudinary, avatar
    // create user object - create entry in db
    // remove password and refresh token field from response
    // check for user creation
    // return res

const registerUser = asyncHandler(async (req, res) =>{
    const {name, email, password, role} = req.body;

    if(!name || !email || !password){
        throw new ApiError(400, "Name, email and password are required");
    }

    const existingUser = await User.findOne({email});
    if(existingUser){
        throw new ApiError(400, "User with this email already exists");
    }

    const user = await User.create({name, email, password, role});

    if(!user){
        throw new ApiError(500, "Failed to create user");
    }

     const { unHashedToken, hashedToken, tokenExpiry } =
       user.generateTemporaryToken();

     user.emailVerificationToken = hashedToken;
     user.emailVerificationExpiry = tokenExpiry;

     await user.save({ validateBeforeSave: false });

     await sendEmail({
       email: user?.email,
       subject: "Please verify your email",
       mailgenContent: emailVerificationMailgenContent(
         user.username,
         `${req.protocol}://${req.get("host")}/api/v1/users/verify-email/${unHashedToken}`,
       ),
     });


     const createdUser = await User.findById(user._id).select(
       "-password -refreshToken -emailVerificationToken -emailVerificationExpiry",
     );

     if (!createdUser) {
       throw new ApiError(
         500,
         "Something went wrong while registering the user",
       );
     }

     return res
       .status(201)
       .json(new ApiResponse(200, createdUser, "User registered Successfully. Please verify your email to activate your account."));

})    


export {registerUser}