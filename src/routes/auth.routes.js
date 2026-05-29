import { Router } from "express";
import { 
    registerUser, 
    verifyEmail, 
    resendVerificationEmail, 
    loginUser, 
    forgotPassword, 
    resetPassword
} from "../controllers/auth.controllers.js";

import {
    registerUserValidator,
    loginUserValidator,
    userForgotPasswordValidator,
    userResetPasswordValidator
} from "../validators/auth.validators.js";

import { validate } from "../middlewares/validator.middleware.js";

const router = Router();

// unprotected routes no use of JWT token required
router.route("/register").post(registerUserValidator, validate, registerUser);
router.route("/login").post(loginUserValidator, validate, loginUser);
router.route("/verify-email/:verificationToken").get(verifyEmail);
router.route("/resend-verification-email").post(resendVerificationEmail);
router.route("/forgot-password").post(userForgotPasswordValidator, validate, forgotPassword);
router.route("/reset-password/:resetToken").post(userResetPasswordValidator, validate, resetPassword);

export default router;