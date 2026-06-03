import Router from 'express';
import {createCategory} from "../controllers/products.controllers.js";
import { verifyJWT } from "../middlewares/auth.middleware.js"
const router = Router();

router.post('/add-categories',verifyJWT, createCategory);

export default router;