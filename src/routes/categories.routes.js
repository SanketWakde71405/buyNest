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

router.post('/add-categories',verifyJWT, createCategory);
router.get('/list-categories',verifyJWT, getCategories);
router.get('/parent-categories',verifyJWT, getParentCategories);
router.get('/sub-categories',verifyJWT, getSubCategories);
router.patch('/:categoryId',verifyJWT, updateCategory);
router.delete('/:categoryId',verifyJWT, deleteCategory);
router.get('/:categoryId',verifyJWT, getCategoryById);

export default router;