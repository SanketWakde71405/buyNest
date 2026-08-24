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
      .withMessage("Discount must be a number"),
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
      .withMessage("Brand ID is invalid")
      ,
    body("images").optional().isArray(),
    body("features").optional().isArray(),
    body("ratingsAverage").optional().isNumeric(),
    body("ratingsCount").optional().isNumeric(),
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
      .withMessage("Brand ID is invalid")
      ,
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
const deleteAllProductImagesValidator = () => {
  return [
    body("productId")
      .trim()
      .notEmpty()
      .withMessage("Product ID is required")
      .isMongoId()
      .withMessage("Invalid Product ID"),
  ];
};

const deleteProductImageValidator = () => {
  return [
    body("productId")
      .trim()
      .notEmpty()
      .withMessage("Product ID is required")
      .isMongoId()
      .withMessage("Invalid Product ID"),
    body("imageUrl").trim().notEmpty().withMessage("Image URL is required"),
  ];
};


const updateFeaturesValidator= ()=>{
   return [
     body("productId")
       .notEmpty()
       .withMessage("Product ID is required")
       .isMongoId()
       .withMessage("Product ID is invalid"),
     body("featuresArray")
     .notEmpty()
     .isArray({ min: 1, max: 10 })
     .withMessage("Feature array cannot be more than 10 elements"),

   ];
}

const updateProductValidator = () => {
  return [
    body("productId")
      .trim()
      .notEmpty()
      .withMessage("Product ID is required")
      .isMongoId()
      .withMessage("Invalid Product ID"),
    body("title").notEmpty().trim().withMessage("Product title is required"),
    body("slug").notEmpty().trim().withMessage("Product Slug is required"),
    body("description").optional().trim(),
    body("price").optional().isNumeric().withMessage("Price must be a number"),
    body("discountPrice")
      .optional()
      .isNumeric()
      .withMessage("Discount must be a number"),
    body("costPrice")
      .optional()
      .isNumeric()
      .withMessage("Cost price must be a number"),
    body("stock")
      .optional()
      .isInt()
      .withMessage("Stock must be a whole number"),
    body("isActive").optional().isBoolean(),
  ];
};

export {
  createProductValidator,
  addBulkProducts,
  addImagesToProductValidator,
  updateFeaturesValidator,
  deleteAllProductImagesValidator,
  deleteProductImageValidator,
  updateProductValidator,
};
