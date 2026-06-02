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

router.post("/",verifyJWT,addressValidator(),validate,createAddress);
router.get("/:userId",getAddresses);
router.get("/address/:addressId",verifyJWT,getAddressById);
router.put("/:addressId",verifyJWT,addressValidator(),validate,updateAddress);
router.delete("/:addressId",verifyJWT,deleteAddress);
export default router;