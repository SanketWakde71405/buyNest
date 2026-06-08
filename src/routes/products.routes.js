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
} from "../controllers/products.controllers.js";
import {
  createProductValidator,
  addBulkProducts,
  addImagesToProductValidator,
  updateFeaturesValidator
} from "../validators/products.validators.js";
import { validate } from "../middlewares/validator.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT, authorizeRoles } from "../middlewares/auth.middleware.js";
import { ROLES } from "../constants.js";
import Router from "express";

const router = Router();

router
  .route("/add-product")
  .post(verifyJWT, authorizeRoles(ROLES.ADMIN),createProductValidator(),validate, createProduct);
router
  .route("/bulk")
  .post(verifyJWT, authorizeRoles(ROLES.ADMIN),addBulkProducts(),validate, addProductstoBrand);
router
  .route("/add-images")
  .put(
    verifyJWT,
    authorizeRoles(ROLES.ADMIN),
    upload.array("images", 5),
    addImagesToProductValidator(),
    validate,
    addImagestoProduct,
  );
router
  .route("/features")
  .put(verifyJWT, authorizeRoles(ROLES.ADMIN),updateFeaturesValidator(),validate, updateFeatures);
router.route("/brand").get(verifyJWT, getProductsByBrand);
router.route("/category").get(verifyJWT, getProductsByCategory);
router.route("/").get(verifyJWT, getAllProducts);
router.route("/:productID").get(verifyJWT, getProductById);
router
  .route("/:productID")
  .delete(verifyJWT, authorizeRoles(ROLES.ADMIN), deleteProduct);

export default router;
