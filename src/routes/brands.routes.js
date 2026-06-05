import {
    createBrand,
    updateBrandLogo,
    updateBrandDetails,
    getAllBrands,
    getBrandById,
    addcategoriesToBrand,
    deleteCategoriesFromBrand,
    deleteBrand
} from "../controllers/brands.controllers.js";
import {
    createBrandValidator,
    addCategoriesToBrandValidator,
    deleteCategoriesFromBrandValidator
} from "../validators/brands.validators.js";
import { validate } from "../middlewares/validator.middleware.js"; 
import Router from "express";
import { verifyJWT} from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";


const router = Router();

router.route("/").get(verifyJWT, getAllBrands);
router.route("/add-brand").post(verifyJWT,createBrandValidator(),validate, createBrand);
router.route("/add-categories").put(verifyJWT,addCategoriesToBrandValidator(),validate, addcategoriesToBrand);
router.route("/update-brand-logo").put(verifyJWT,upload.single("logo"), updateBrandLogo);
router.route("/delete-categories").delete(verifyJWT, deleteCategoriesFromBrandValidator(),validate, deleteCategoriesFromBrand);

//params routes
router.route("/update-brand-details/:brandId").patch(verifyJWT, updateBrandDetails);
router.route("/:brandId").get(verifyJWT, getBrandById);
router.route("/:brandId").delete(verifyJWT, deleteBrand);

export default router;