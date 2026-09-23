import {
  createStore,
  updateStoreDetails,
  getStoreDetails,
  getMyStore,
  addStoreLogo,
  updateStoreSettings,
  addCategoriesToStore,
  removeCategoriesFromStore
} from "../controllers/store.controllers.js";

import { verifyJWT, authorizeRoles } from "../middlewares/auth.middleware.js";
import { attachStore } from "../middlewares/attachStore.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";
import { ROLES } from "../constants.js";
import { Router } from "express";

const router = Router();

router
  .route("/create-store")
  .post(verifyJWT, authorizeRoles(ROLES.ADMIN), createStore);

router
  .route("/add-store-logo")
  .patch(
    verifyJWT,
    authorizeRoles(ROLES.ADMIN),
    attachStore,
    upload.single("storeLogo"),
    addStoreLogo,
  );

router
  .route("/update-store")
  .put(verifyJWT, authorizeRoles(ROLES.ADMIN), attachStore, updateStoreDetails);

router
  .route("/update-settings")
  .patch(
    verifyJWT,
    authorizeRoles(ROLES.ADMIN),
    attachStore,
    updateStoreSettings,
  );

router
  .route("/categories")
  .patch(
    verifyJWT,
    authorizeRoles(ROLES.ADMIN),
    attachStore,
    addCategoriesToStore,
  )
  .delete(
    verifyJWT,
    authorizeRoles(ROLES.ADMIN),
    attachStore,
    removeCategoriesFromStore,
  );

// Must come before "/:storeId" — otherwise Express matches "me" as a
// storeId value and this route is never reached.
router
  .route("/me")
  .get(verifyJWT, authorizeRoles(ROLES.ADMIN), attachStore, getMyStore);

router
  .route("/:storeId")
  .get(verifyJWT, authorizeRoles(ROLES.ADMIN), getStoreDetails);

export default router;
