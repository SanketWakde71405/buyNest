import {
  createProduct,
  getProductById,
  addImagestoProduct,
  getProductsByBrand,
  getAllProducts,
  deleteProduct,
  updateFeatures,
  getProductsByCategory,
  addProductstoBrand
} from "../controllers/products.controllers.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import Router from "express";

const router = Router();

router.route("/add-product").post(verifyJWT, createProduct);
router.route("/bulk").post(verifyJWT,addProductstoBrand);
router.route("/add-images").put(verifyJWT, upload.array("images", 5), addImagestoProduct);
router.route("/features").put(verifyJWT,updateFeatures);
router.route("/brand").get(verifyJWT,getProductsByBrand);
router.route("/category").get(verifyJWT,getProductsByCategory);
router.route("/").get(verifyJWT,getAllProducts);
router.route("/:productID").get(verifyJWT, getProductById);
router.route("/:productID").delete(verifyJWT,deleteProduct);

export default router;
