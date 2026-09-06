import { body } from "express-validator";

const createSupplierValidator = () => {
  return [
    body("supplierName")
      .notEmpty()
      .trim()
      .withMessage("Supplier name is required"),
    body("contactPerson").optional().trim(),
    body("contactDetails.email").optional().trim(),
    body("contactDetails.phone").optional().trim(),
    body("contactDetails.address").optional().trim(),
    body("pendingAmount").optional().trim(),
  ];
};

const updateSupplierDetailsValidator = () => {
  return [
    body("supplierName").optional().trim(),
    body("contactPerson").optional().trim(),
    body("contactDetails.email").optional().trim(),
    body("contactDetails.phone").optional().trim(),
    body("contactDetails.address").optional().trim(),
  ];
};

const updateSupplierPendingAmountValidator = () => {
  return [
    body("amount").notEmpty().trim().withMessage("Amount is required"),
    body("mode").optional().trim(),
  ];
};

export {
  createSupplierValidator,
  updateSupplierDetailsValidator,
  updateSupplierPendingAmountValidator,
};
