import {
  createBrand,
  updateBrandLogo,
  updateBrandDetails,
  getAllBrands,
  getBrandById,
  addcategoriesToBrand,
  deleteCategoriesFromBrand,
  deleteBrand,
  getBrandsByCategory,
} from "../controllers/brands.controllers.js";
import {
  createBrandValidator,
  addCategoriesToBrandValidator,
  deleteCategoriesFromBrandValidator,
} from "../validators/brands.validators.js";
import { validate } from "../middlewares/validator.middleware.js";
import Router from "express";
import { verifyJWT, authorizeRoles } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";
import { ROLES } from "../constants.js";

const router = Router();

router.route("/").get(verifyJWT, getAllBrands);
router
  .route("/add-brand")
  .post(
    verifyJWT,
    authorizeRoles(ROLES.ADMIN, ROLES.EMPLOYEE),
    createBrandValidator(),
    validate,
    createBrand,
  );
router
  .route("/add-categories")
  .put(
    verifyJWT,
    authorizeRoles(ROLES.ADMIN, ROLES.EMPLOYEE),
    addCategoriesToBrandValidator(),
    validate,
    addcategoriesToBrand,
  );
router
  .route("/update-brand-logo")
  .patch(
    verifyJWT,
    authorizeRoles(ROLES.ADMIN, ROLES.EMPLOYEE),
    upload.single("logo"),
    updateBrandLogo,
  );
// Removal-style actions stay admin-only, same as product delete.
router
  .route("/delete-categories")
  .delete(
    verifyJWT,
    authorizeRoles(ROLES.ADMIN),
    deleteCategoriesFromBrandValidator(),
    validate,
    deleteCategoriesFromBrand,
  );

//params routes
router.route("/category/:categoryId").get(verifyJWT, getBrandsByCategory);
router
  .route("/update-brand-details/:brandId")
  .patch(
    verifyJWT,
    authorizeRoles(ROLES.ADMIN, ROLES.EMPLOYEE),
    updateBrandDetails,
  );
router.route("/:brandId").get(verifyJWT, getBrandById);
router
  .route("/:brandId")
  .delete(verifyJWT, authorizeRoles(ROLES.ADMIN), deleteBrand);

export default router;
