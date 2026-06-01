import {
  getCurrentUser,
  updateUserDetails,
  updateUserAvatar,
} from "../controllers/user.controllers.js";
import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();

router.route("/").get(verifyJWT, getCurrentUser);
router
  .route("/avatar")
  .put(verifyJWT, upload.single("avatar"), updateUserAvatar);
router.route("/").patch(verifyJWT, updateUserDetails);

export default router;
