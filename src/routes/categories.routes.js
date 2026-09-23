import Router from "express";
import {
  createCategory,
  getCategories,
  getCategoryById,
  getParentCategories,
  getSubCategories,
  getCategoriesForStore,
  updateCategory,
  reorderCategories,
  deleteCategory,
  backfillCategoryStatus,
  backfillDisplayOrder,
  getBrandsForCategory,
} from "../controllers/category.controllers.js";
import { verifyJWT, authorizeRoles } from "../middlewares/auth.middleware.js";
import { ROLES } from "../constants.js";
const router = Router();

router
  .route("/add-categories")
  .post(verifyJWT, authorizeRoles(ROLES.ADMIN), createCategory);
router.route("/list-categories").get(verifyJWT, getCategories);
router.route("/parent-categories").get(verifyJWT, getParentCategories);
router
  .route("/reorder")
  .patch(verifyJWT, authorizeRoles(ROLES.ADMIN), reorderCategories);
router
  .route("/backfill")
  .patch(verifyJWT, authorizeRoles(ROLES.ADMIN), backfillCategoryStatus);
router
  .route("/backfill-display-order")
  .patch(verifyJWT, authorizeRoles(ROLES.ADMIN), backfillDisplayOrder);
router
  .route("/brands")
  .post(verifyJWT, authorizeRoles(ROLES.ADMIN), getBrandsForCategory);
router
  .route("/store")
  .get(verifyJWT, authorizeRoles(ROLES.ADMIN), getCategoriesForStore);
router
  .route("/sub-categories/:parentCategoryId")
  .get(verifyJWT, getSubCategories);
router
  .route("/:categoryId")
  .patch(verifyJWT, authorizeRoles(ROLES.ADMIN), updateCategory);
router
  .route("/:categoryId")
  .delete(verifyJWT, authorizeRoles(ROLES.ADMIN), deleteCategory);
router.route("/:categoryId").get(verifyJWT, getCategoryById);

export default router;
