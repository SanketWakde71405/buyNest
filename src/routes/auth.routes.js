import { Router } from "express";
import {
  registerUser,
  registerAdmin,
  createEmployee,
  verifyEmail,
  resendVerificationEmail,
  loginUser,
  forgotPassword,
  resetPassword,
  refreshTokens,
  logoutUser,
  changeCurrentPassword,
  getCurrentUser,
  completeOnBoarding,
  googleAuth,
} from "../controllers/auth.controllers.js";

import {
  registerUserValidator,
  loginUserValidator,
  userForgotPasswordValidator,
  userResetPasswordValidator,
  userChangeCurrentPasswordValidator,
  registerAdminValidator,
  createEmployeeValidator,
} from "../validators/auth.validators.js";

import { validate } from "../middlewares/validator.middleware.js";
import { verifyJWT, authorizeRoles } from "../middlewares/auth.middleware.js";
import { ROLES } from "../constants.js";
const router = Router();

// unprotected routes no use of JWT token required
router.route("/register").post(registerUserValidator(), validate, registerUser);
router.route("/login").post(loginUserValidator(), validate, loginUser);
router.route("/google").post(googleAuth);
router.route("/verify-email/:verificationToken").get(verifyEmail);
router.route("/resend-verification-email").post(resendVerificationEmail);
router
  .route("/forgot-password")
  .post(userForgotPasswordValidator(), validate, forgotPassword);
router
  .route("/reset-password/:resetToken")
  .post(userResetPasswordValidator(), validate, resetPassword);
router.route("/refresh-tokens").post(refreshTokens);

// Bootstrap-only: creates the single admin account. Not gated by
// verifyJWT (nobody's logged in yet) — gated instead by ADMIN_SETUP_KEY
// (see auth.controllers.js) and a singleton check. Run this once, then
// treat the setup key as compromised/rotate it if it was ever exposed.
router
  .route("/register-admin")
  .post(registerAdminValidator(), validate, registerAdmin);

// protected routes - use of JWT token required
router
  .route("/change-password")
  .post(
    verifyJWT,
    userChangeCurrentPasswordValidator(),
    validate,
    changeCurrentPassword,
  );
router.route("/logout").post(verifyJWT, logoutUser);
router.route("/current-user").get(verifyJWT, getCurrentUser);
router
  .route("/complete-onboarding/:userId")
  .patch(verifyJWT, completeOnBoarding);

// Admin-only: create an employee account. req.user.role here comes from
// the verified JWT (authorizeRoles), not from anything in the request body.
router
  .route("/create-employee")
  .post(
    verifyJWT,
    authorizeRoles(ROLES.ADMIN),
    createEmployeeValidator(),
    validate,
    createEmployee,
  );

export default router;
