import {
  createProduct,
  getProductById,
  addImagestoProduct,
  getProductsByBrand,
  getAllProducts,
  deleteProduct,
  updateFeatures,
  getProductsByCategory,
  addProductstoBrand,
  getMyStoreProducts,
  updateProduct,
} from "../controllers/products.controllers.js";
import {
  createProductValidator,
  updateProductValidator,
  addBulkProducts,
  addImagesToProductValidator,
  updateFeaturesValidator,
} from "../validators/products.validators.js";
import { validate } from "../middlewares/validator.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT, authorizeRoles } from "../middlewares/auth.middleware.js";
import { ROLES } from "../constants.js";
import Router from "express";

const router = Router();

// Employee can add/update/view products; only admin can delete.
router
  .route("/add-product")
  .post(
    verifyJWT,
    authorizeRoles(ROLES.ADMIN, ROLES.EMPLOYEE),
    createProductValidator(),
    validate,
    createProduct,
  );
router
  .route("/bulk")
  .post(
    verifyJWT,
    authorizeRoles(ROLES.ADMIN, ROLES.EMPLOYEE),
    addBulkProducts(),
    validate,
    addProductstoBrand,
  );
router
  .route("/add-images")
  .put(
    verifyJWT,
    authorizeRoles(ROLES.ADMIN, ROLES.EMPLOYEE),
    upload.array("images", 5),
    addImagesToProductValidator(),
    validate,
    addImagestoProduct,
  );
router
  .route("/update-product")
  .put(
    verifyJWT,
    authorizeRoles(ROLES.ADMIN, ROLES.EMPLOYEE),
    updateProductValidator(),
    validate,
    updateProduct,
  );
router
  .route("/features")
  .put(
    verifyJWT,
    authorizeRoles(ROLES.ADMIN, ROLES.EMPLOYEE),
    updateFeaturesValidator(),
    validate,
    updateFeatures,
  );
router.route("/brand").get(verifyJWT, getProductsByBrand);
router.route("/category").get(verifyJWT, getProductsByCategory);
router
  .route("/store")
  .get(
    verifyJWT,
    authorizeRoles(ROLES.ADMIN, ROLES.EMPLOYEE),
    getMyStoreProducts,
  );
router.route("/").get(verifyJWT, getAllProducts);
router.route("/:productID").get(verifyJWT, getProductById);
// Delete stays admin-only — this is the one action employees never get.
router
  .route("/:productID")
  .delete(verifyJWT, authorizeRoles(ROLES.ADMIN), deleteProduct);

export default router;
