import Router from 'express';
import {
    createCategory,
    getCategories,
    getCategoryById,
    getParentCategories,
    getSubCategories,
    updateCategory,
    deleteCategory
} from "../controllers/category.controllers.js";
import { verifyJWT } from "../middlewares/auth.middleware.js"
const router = Router();

router.route("/add-categories").post(verifyJWT, createCategory);
router.route("/list-categories").get(verifyJWT, getCategories);
router.route("/parent-categories").get(verifyJWT, getParentCategories);
router.route("/sub-categories").get(verifyJWT, getSubCategories);
router.route("/:categoryId").patch(verifyJWT, updateCategory);
router.route("/:categoryId").delete(verifyJWT, deleteCategory);
router.route("/:categoryId").get(verifyJWT, getCategoryById);

export default router;