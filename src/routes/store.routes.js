import { 
    createStore,
    updateStoreDetails,
    getStoreDetails,
    addStoreLogo 
} from "../controllers/store.controllers.js";

import { verifyJWT, authorizeRoles } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";
import { ROLES } from "../constants.js";
import { Router } from "express";

const router= Router();

router.route("/create-store").post(verifyJWT,authorizeRoles(ROLES.ADMIN),createStore);
router
  .route("/add-store-logo")
  .patch(verifyJWT, authorizeRoles(ROLES.ADMIN), upload.single("storeLogo"),addStoreLogo);
router.route("/update-store").put(verifyJWT, authorizeRoles(ROLES.ADMIN),updateStoreDetails);
router.route("/:storeId").get(verifyJWT,authorizeRoles(ROLES.ADMIN),getStoreDetails);

export default router;


