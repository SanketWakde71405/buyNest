import { body } from "express-validator";

const createBrandValidator = () => {
  return [
    body("name")
    .notEmpty()
    .trim()
    .withMessage("Brand name is required"),
    body("slug")
    .notEmpty()
    .trim()
    .withMessage("Brand slug is required"),
    body("description")
    .optional()
    .trim(),
  ];
};

const addCategoriesToBrandValidator = () => {
  return [
    body("brandId")
    .notEmpty()
    .trim()
    .withMessage("Brand ID is required"),
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
    body("brandId")
    .notEmpty()
    .trim()
    .withMessage("Brand ID is required"),
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
    addCategoriesToBrandValidator,
    deleteCategoriesFromBrandValidator
}