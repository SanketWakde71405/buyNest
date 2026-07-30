import { body } from "express-validator";

const createProductValidator = () => {
  return [
    body("title").notEmpty().trim().withMessage("Product title is required"),
    body("description").optional().trim(),
    body("slug").notEmpty().trim().withMessage("Product Slug is required"),
    body("price")
      .notEmpty()
      .withMessage("Product price is required")
      .isNumeric()
      .withMessage("Price must be a number"),
    body("discountPrice")
      .notEmpty()
      .withMessage("Discount price is required")
      .isNumeric()
      .withMessage("Discount must be a number")
      .custom((value, { req }) => {
        if (Number(value) > Number(req.body.price)) {
          throw new Error("Discount price cannot exceed price");
        }
        return true;
      }),
    body("category")
      .notEmpty()
      .withMessage("Category ID is required")
      .isMongoId()
      .withMessage("Category ID is invalid"),
    body("stock")
      .notEmpty()
      .withMessage("Stock is required")
      .isInt()
      .withMessage("Stock must be a whole number"),
    body("brand")
      .notEmpty()
      .withMessage("Brand ID is required")
      .isMongoId()
      .withMessage("Brand ID is invalid"),
    body("images").optional().isArray(),
    body("features").optional().isArray(),
    body("ratingsAverage").optional().isNumeric(),
    body("ratingsCount").optional().isNumeric(),
    body("isActive").optional().isBoolean(),
  ];
};

// update-product currently runs with NO validator at all — the route just
// calls updateProduct straight through, so nothing checks that price is
// numeric, stock is an integer, category is a valid ObjectId, etc. before
// the request reaches the controller. This closes that gap. Every field
// is optional since updates are partial (only the fields UPDATABLE_FIELDS
// allows and the client actually sends get applied) — adjust this list if
// your UPDATABLE_FIELDS constant differs from what's assumed here.
const updateProductValidator = () => {
  return [
    body("title")
      .optional()
      .notEmpty()
      .trim()
      .withMessage("Title cannot be empty"),
    body("description").optional().trim(),
    body("slug")
      .optional()
      .notEmpty()
      .trim()
      .withMessage("Slug cannot be empty"),
    body("price").optional().isNumeric().withMessage("Price must be a number"),
    body("discountPrice")
      .optional()
      .isNumeric()
      .withMessage("Discount must be a number")
      .custom((value, { req }) => {
        // Only catches the case where both are sent in the same update.
        // If just discountPrice is sent on its own, this can't compare
        // it against the *existing* document's price — a stateless
        // validator has no way to see that. The controller doesn't
        // re-check against the existing product either, so right now a
        // lone discountPrice update could slip past both layers and
        // violate the schema-level rule until the next full save.
        if (
          req.body.price !== undefined &&
          Number(value) > Number(req.body.price)
        ) {
          throw new Error("Discount price cannot exceed price");
        }
        return true;
      }),
    body("category")
      .optional()
      .isMongoId()
      .withMessage("Category ID is invalid"),
    body("brand").optional().isMongoId().withMessage("Brand ID is invalid"),
    body("stock")
      .optional()
      .isInt()
      .withMessage("Stock must be a whole number"),
    body("isActive").optional().isBoolean(),
  ];
};

const addBulkProducts = () => {
  return [
    body("brandId")
      .notEmpty()
      .trim()
      .withMessage("Brand ID is required")
      .isMongoId()
      .withMessage("Brand ID is invalid"),
    body("products")
      .notEmpty()
      .isArray({ min: 1, max: 10 })
      .withMessage("Array length cannot be more than 10"),
  ];
};

const addImagesToProductValidator = () => {
  return [
    body("productId")
      .trim()
      .notEmpty()
      .withMessage("Product ID is required")
      .isMongoId()
      .withMessage("Invalid Product ID"),

    body("existingImages")
      .optional()
      .custom((value) => {
        if (!Array.isArray(value) && typeof value !== "string") {
          throw new Error("existingImages must be an array of image URLs");
        }

        return true;
      }),
  ];
};

const updateFeaturesValidator = () => {
  return [
    body("productId")
      .notEmpty()
      .withMessage("Product ID is required")
      .isMongoId()
      .withMessage("Product ID is invalid"),
    body("features")
      .notEmpty()
      .isArray({ min: 1, max: 10 })
      .withMessage("Feature array cannot be more than 10 elements"),
  ];
};

export {
  createProductValidator,
  updateProductValidator,
  addBulkProducts,
  addImagesToProductValidator,
  updateFeaturesValidator,
};
