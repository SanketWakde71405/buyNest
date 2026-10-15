import {
  createProduct,
  getProductById,
  addProductImages,
  deleteProductImage,
  deleteAllProductImages,
  getProductsByBrand,
  getAllProducts,
  deleteProduct,
  updateFeatures,
  getProductsByCategory,
  addProductstoBrand,
  updateProduct,
  updateProductCategories,
  updateProductBrand,
  updateProductSuppliers,
} from "../controllers/products.controllers.js";
import {
  createProductValidator,
  addBulkProducts,
  addImagesToProductValidator,
  deleteProductImageValidator,
  deleteAllProductImagesValidator,
  updateFeaturesValidator,
  updateProductValidator,
} from "../validators/products.validators.js";
import { validate } from "../middlewares/validator.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT, authorizeRoles } from "../middlewares/auth.middleware.js";
import { ROLES } from "../constants.js";
import Router from "express";

const router = Router();

router
  .route("/add-product")
  .post(
    verifyJWT,
    authorizeRoles(ROLES.ADMIN),
    createProductValidator(),
    validate,
    createProduct,
  );

router
  .route("/bulk")
  .post(
    verifyJWT,
    authorizeRoles(ROLES.ADMIN),
    addBulkProducts(),
    validate,
    addProductstoBrand,
  );

router
  .route("/add-images")
  .patch(
    verifyJWT,
    authorizeRoles(ROLES.ADMIN),
    upload.array("images", 5),
    addImagesToProductValidator(),
    validate,
    addProductImages,
  );

router
  .route("/delete-image")
  .patch(
    verifyJWT,
    authorizeRoles(ROLES.ADMIN),
    deleteProductImageValidator(),
    validate,
    deleteProductImage,
  );

router
  .route("/delete-all-images")
  .patch(
    verifyJWT,
    authorizeRoles(ROLES.ADMIN),
    deleteAllProductImagesValidator(),
    validate,
    deleteAllProductImages,
  );

router
  .route("/update")
  .put(
    verifyJWT,
    authorizeRoles(ROLES.ADMIN),
    updateProductValidator(),
    validate,
    updateProduct,
  );

router
  .route("/features")
  .patch(
    verifyJWT,
    authorizeRoles(ROLES.ADMIN),
    updateFeaturesValidator(),
    validate,
    updateFeatures,
  );

router
  .route("/suppliers")
  .patch(verifyJWT, authorizeRoles(ROLES.ADMIN), updateProductSuppliers);

router.route("/categories").patch(verifyJWT, updateProductCategories);
router.route("/brand").patch(verifyJWT, updateProductBrand);
router.route("/brand").get(verifyJWT, getProductsByBrand);
router.route("/").get(verifyJWT, getAllProducts);
router.route("/:productID").get(verifyJWT, getProductById);
router
  .route("/:productID")
  .delete(verifyJWT, authorizeRoles(ROLES.ADMIN), deleteProduct);
router.route("/category/:categoryId").get(verifyJWT, getProductsByCategory);

export default router;
