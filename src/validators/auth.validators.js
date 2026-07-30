import { body } from "express-validator";

const registerUserValidator = () => {
  return [
    body("name").trim().notEmpty().withMessage("Name is required"),
    body("email")
      .trim()
      .isEmail()
      .withMessage("Valid email is required")
      .normalizeEmail(),
    body("password")
      .trim()
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters long"),
  ];
};

const loginUserValidator = () => {
  return [
    body("email")
      .trim()
      .isEmail()
      .withMessage("Valid email is required")
      .normalizeEmail(),
    body("password").trim().notEmpty().withMessage("Password is required"),
  ];
};

const userForgotPasswordValidator = () => {
  return [
    body("email")
      .notEmpty()
      .withMessage("Email is required")
      .isEmail()
      .withMessage("Email is invalid"),
  ];
};

const userResetPasswordValidator = () => {
  return [body("newPassword").notEmpty().withMessage("Password is required")];
};

const userChangeCurrentPasswordValidator = () => {
  return [
    body("oldPassword").notEmpty().withMessage("Old password is required"),
    body("newPassword").notEmpty().withMessage("New password is required"),
  ];
};

// For /register-admin — same shape as registerUserValidator, plus the
// setupKey that actually gates this endpoint (see auth.controllers.js).
// This only checks that setupKey is *present*; whether it actually
// matches ADMIN_SETUP_KEY is checked in the controller, not here.
const registerAdminValidator = () => {
  return [
    body("name").trim().notEmpty().withMessage("Name is required"),
    body("email")
      .trim()
      .isEmail()
      .withMessage("Valid email is required")
      .normalizeEmail(),
    body("password")
      .trim()
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters long"),
    body("setupKey").trim().notEmpty().withMessage("Setup key is required"),
  ];
};

// For /create-employee — no setupKey needed here since this route is
// already gated by verifyJWT + authorizeRoles(ADMIN) at the route level.
const createEmployeeValidator = () => {
  return [
    body("name").trim().notEmpty().withMessage("Name is required"),
    body("email")
      .trim()
      .isEmail()
      .withMessage("Valid email is required")
      .normalizeEmail(),
    body("password")
      .trim()
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters long"),
  ];
};

export {
  registerUserValidator,
  loginUserValidator,
  userForgotPasswordValidator,
  userResetPasswordValidator,
  userChangeCurrentPasswordValidator,
  registerAdminValidator,
  createEmployeeValidator,
};
