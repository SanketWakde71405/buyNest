
import {
  createSupplier,
  updateSupplierDetails,
  updateSupplierPendingAmount,
  getAllSuppliers,
  getSupplierById,
  deleteSupplier,
} from "../controllers/supplier.controllers.js";
import {
  createSupplierValidator,
  updateSupplierDetailsValidator,
  updateSupplierPendingAmountValidator,
} from "../validators/supplier.validators.js";
import { validate } from "../middlewares/validator.middleware.js";
import Router from "express";
import { verifyJWT, authorizeRoles } from "../middlewares/auth.middleware.js";
import { ROLES } from "../constants.js";

const router = Router();

router.route("/").get(verifyJWT, getAllSuppliers);
router
  .route("/add-supplier")
  .post(
    verifyJWT,
    authorizeRoles(ROLES.ADMIN),
    createSupplierValidator(),
    validate,
    createSupplier,
  );

//params routes
router
  .route("/update-supplier-details/:supplierId")
  .put(
    verifyJWT,
    authorizeRoles(ROLES.ADMIN),
    updateSupplierDetailsValidator(),
    validate,
    updateSupplierDetails,
  );
router
  .route("/update-pending-amount/:supplierId")
  .patch(
    verifyJWT,
    authorizeRoles(ROLES.ADMIN),
    updateSupplierPendingAmountValidator(),
    validate,
    updateSupplierPendingAmount,
  );
router.route("/:supplierId").get(verifyJWT, getSupplierById);
router
  .route("/:supplierId")
  .delete(verifyJWT, authorizeRoles(ROLES.ADMIN), deleteSupplier);

export default router;
