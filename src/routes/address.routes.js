import Router from 'express';
import { addressValidator } from '../validators/address.validators.js';
import { validate } from "../middlewares/validator.middleware.js";
import { 
    createAddress,
    getAddresses,
    getAddressById,
    updateAddress,
    deleteAddress 
} from '../controllers/address.controllers.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
const router = Router();

router.route("/").post(verifyJWT, addressValidator(), validate, createAddress);
router.route("/:userId").get(getAddresses);
router.route("/address/:addressId").get(verifyJWT, getAddressById);
router.route("/:addressId").put(verifyJWT, addressValidator(), validate, updateAddress);
router.route("/:addressId").delete(verifyJWT, deleteAddress);
export default router;