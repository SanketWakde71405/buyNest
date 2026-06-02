import { body } from "express-validator";
import {ADDRESS_TYPES} from "../constants.js";

const addressValidator=()=>{
  return [
    body("type")
    .notEmpty()
    .trim()
    .isIn(Object.values(ADDRESS_TYPES))
    .withMessage(`Type must be one of ${Object.values(ADDRESS_TYPES).join(", ")}`),
    body("fullName")
    .notEmpty()
    .trim()
    .withMessage("Full name is required"),
    body("phone")
    .notEmpty()
    .trim()
    .matches(/^[6-9]\d{9}$/)
    .withMessage("Please enter a valid phone number"),
    body("addressLine1")
    .notEmpty()
    .trim()
    .withMessage("Address Line 1 is required"),
    body("addressLine2")
    .trim(),
    body("city")
    .notEmpty()
    .trim()
    .withMessage("City is required"),
    body("state")
    .notEmpty()
    .trim()
    .withMessage("State is required"),
    body("country")
    .notEmpty()
    .trim()
    .withMessage("Country is required"),
    body("postalCode")
    .notEmpty()
    .trim()
    .withMessage("Postal code is required")
  ]

};

export {addressValidator};