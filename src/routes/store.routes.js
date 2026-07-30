import Router from "express";
import {
  createStore,
  addStoreLogo,
  getStoreDetails,
  updateStoreDetails,
} from "../controllers/store.controllers.js";
import { verifyJWT, authorizeRoles } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";
import { ROLES } from "../constants.js";

const router = Router();

// Single-seller app: only the admin may create or manage the one store.
// Previously these two routes only required a valid login, which meant
// any registered user (not just the admin) could create a store or swap
// its logo — that's a multi-vendor hole in a single-seller app.
router.route("/create-store").post(verifyJWT, authorizeRoles(ROLES.ADMIN), createStore);
router.route("/add-store-logo").patch(verifyJWT,authorizeRoles(ROLES.ADMIN),upload.single("storeLogo"),addStoreLogo);
router.route("/update-store").put(verifyJWT, authorizeRoles(ROLES.ADMIN), updateStoreDetails);
router.route("/:storeId").get(verifyJWT, getStoreDetails);

export default router;
