import { Router } from "express";
import { 
    registerUser, 
    verifyEmail, 
    resendVerificationEmail, 
    loginUser, 
    forgotPassword, 
    resetPassword,
    refreshTokens,
    logoutUser,
    changeCurrentPassword
} from "../controllers/auth.controllers.js";

import {
    registerUserValidator,
    loginUserValidator,
    userForgotPasswordValidator,
    userResetPasswordValidator,
    userChangeCurrentPasswordValidator
} from "../validators/auth.validators.js";

import { validate } from "../middlewares/validator.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
const router = Router();

// unprotected routes no use of JWT token required
router.route("/register").post(registerUserValidator(), validate, registerUser);
router.route("/login").post(loginUserValidator(), validate, loginUser);
router.route("/verify-email/:verificationToken").get(verifyEmail);
router.route("/resend-verification-email").post(resendVerificationEmail);
router.route("/forgot-password").post(userForgotPasswordValidator(), validate, forgotPassword);
router.route("/reset-password/:resetToken").post(userResetPasswordValidator(), validate, resetPassword);
router.route("/refresh-tokens").post(refreshTokens);


// protected routes - use of JWT token required
router.route("/change-password").post(verifyJWT, userChangeCurrentPasswordValidator(), validate, changeCurrentPassword);
router.route("/logout").post(verifyJWT, logoutUser);

export default router;