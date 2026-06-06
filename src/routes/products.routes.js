import {
  createProduct,
  getProductById,
  addImagestoProduct,
  getProductsByBrand,
  getAllProducts,
  deleteProduct
} from "../controllers/products.controllers.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import Router from "express";

const router = Router();

router.route("/add-product").post(verifyJWT, createProduct);
router.route("/add-images").put(verifyJWT, upload.array("images", 5), addImagestoProduct);
router.route("/brand").get(verifyJWT,getProductsByBrand);
router.route("/").get(verifyJWT,getAllProducts);
router.route("/:productID").get(verifyJWT, getProductById);
router.route("/:productID").delete(verifyJWT,deleteProduct);

export default router;
