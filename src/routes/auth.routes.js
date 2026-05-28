import { Router } from "express";
import { registerUser, verifyEmail, resendVerificationEmail, loginUser} from "../controllers/auth.controllers.js";

const router = Router();

router.route("/register").post(registerUser);
router.route("/login").post(loginUser);
router.route("/verify-email/:verificationToken").get(verifyEmail);
router.route("/resend-verification-email").post(resendVerificationEmail);

export default router;