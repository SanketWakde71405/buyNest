import Router from "express";
import {
  createCategory,
  getCategories,
  getCategoryById,
  getParentCategories,
  getSubCategories,
  updateCategory,
  deleteCategory,
  getParentCategoriesForStore,
} from "../controllers/category.controllers.js";
import { verifyJWT, authorizeRoles } from "../middlewares/auth.middleware.js";
import { ROLES } from "../constants.js";
const router = Router();

router
  .route("/add-categories")
  .post(verifyJWT, authorizeRoles(ROLES.ADMIN, ROLES.EMPLOYEE), createCategory);
router.route("/list-categories").get(verifyJWT, getCategories);
router.route("/parent-categories").get(verifyJWT, getParentCategories);
router
  .route("/store")
  .get(
    verifyJWT,
    authorizeRoles(ROLES.ADMIN, ROLES.EMPLOYEE),
    getParentCategoriesForStore,
  );
router
  .route("/sub-categories/:parentCategoryId")
  .get(verifyJWT, getSubCategories);
router
  .route("/:categoryId")
  .patch(
    verifyJWT,
    authorizeRoles(ROLES.ADMIN, ROLES.EMPLOYEE),
    updateCategory,
  );
// Delete stays admin-only.
router
  .route("/:categoryId")
  .delete(verifyJWT, authorizeRoles(ROLES.ADMIN), deleteCategory);
router.route("/:categoryId").get(verifyJWT, getCategoryById);

export default router;
