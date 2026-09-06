import { body } from "express-validator";
import mongoose from "mongoose";

const CURRENT_YEAR = new Date().getFullYear();

const createBrandValidator = () => {
  return [
    body("name").notEmpty().trim().withMessage("Brand name is required"),
    body("slug").notEmpty().trim().withMessage("Brand slug is required"),
    body("description").optional().trim(),
    body("website")
      .optional({ checkFalsy: true })
      .trim()
      .isURL()
      .withMessage("Website must be a valid URL"),
    body("countryOfOrigin")
      .optional({ checkFalsy: true })
      .trim()
      .isLength({ max: 100 })
      .withMessage("Country of origin must be under 100 characters"),
    body("yearEstablished")
      .optional({ checkFalsy: true })
      .isInt({ min: 1500, max: CURRENT_YEAR })
      .withMessage(`Year established must be between 1500 and ${CURRENT_YEAR}`),
  ];
};

// The update route previously had no validator at all — every field here
// is optional since a caller may update just one thing (e.g. only the
// supplier), but whatever IS sent still gets checked.
const updateBrandDetailsValidator = () => {
  return [
    body("name")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("Brand name cannot be empty"),
    body("slug")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("Brand slug cannot be empty"),
    body("description").optional().trim(),
    body("website")
      .optional({ checkFalsy: true })
      .trim()
      .isURL()
      .withMessage("Website must be a valid URL"),
    body("countryOfOrigin")
      .optional({ checkFalsy: true })
      .trim()
      .isLength({ max: 100 })
      .withMessage("Country of origin must be under 100 characters"),
    body("yearEstablished")
      .optional({ checkFalsy: true })
      .isInt({ min: 1500, max: CURRENT_YEAR })
      .withMessage(`Year established must be between 1500 and ${CURRENT_YEAR}`),
    // supplier is tri-state: omitted (no change), null (unlink), a string
    // (existing supplier ObjectId), or an object (create + link a new one).
    body("supplier")
      .optional({ nullable: true })
      .custom((value) => {
        if (value === null) return true;
        if (typeof value === "string") {
          if (!mongoose.Types.ObjectId.isValid(value)) {
            throw new Error("Supplier ID invalid");
          }
          return true;
        }
        if (typeof value === "object") {
          if (!value.supplierName || !String(value.supplierName).trim()) {
            throw new Error("Supplier name is required for a new supplier");
          }
          return true;
        }
        throw new Error("Invalid supplier payload");
      }),
  ];
};

const addCategoriesToBrandValidator = () => {
  return [
    body("brandId").notEmpty().trim().withMessage("Brand ID is required"),
    body("categoryIds")
      .isArray({ min: 1 })
      .withMessage("At least one category ID is required"),
    body("categoryIds.*")
      .notEmpty()
      .trim()
      .withMessage("Category ID cannot be empty"),
  ];
};

const deleteCategoriesFromBrandValidator = () => {
  return [
    body("brandId").notEmpty().trim().withMessage("Brand ID is required"),
    body("categoryIds")
      .isArray({ min: 1 })
      .withMessage("At least one category ID is required"),
    body("categoryIds.*")
      .notEmpty()
      .trim()
      .withMessage("Category ID cannot be empty"),
  ];
};

export {
  createBrandValidator,
  updateBrandDetailsValidator,
  addCategoriesToBrandValidator,
  deleteCategoriesFromBrandValidator,
};
