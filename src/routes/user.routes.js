import {
  getCurrentUser,
  updateUserDetails,
  updateUserAvatar,
} from "../controllers/user.controllers.js";
import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();

router.route("/me").get(verifyJWT, getCurrentUser);
router
  .route("/me/avatar")
  .put(verifyJWT, upload.single("avatar"), updateUserAvatar);

export default router;
