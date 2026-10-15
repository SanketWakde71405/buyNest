import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Supplier } from "../models/supplier.models.js";
import { Brand } from "../models/brands.models.js";
import { Product } from "../models/products.models.js";
import mongoose from "mongoose";

const createSupplier = asyncHandler(async (req, res) => {
  const user = req.user;

  if (!user) {
    throw new ApiError(401, "Unauthorized");
  }

  const { supplierName, contactPerson, contactDetails, pendingAmount } =
    req.body;

  if (!supplierName) {
    throw new ApiError(400, "Supplier name is required");
  }

  const duplicate = await Supplier.findOne({ supplierName });

  if (duplicate) {
    throw new ApiError(409, "A supplier with this name already exists");
  }

  const supplier = await Supplier.create({
    supplierName,
    contactPerson,
    contactDetails,
    pendingAmount,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, supplier, "Supplier created successfully"));
});

const updateSupplierDetails = asyncHandler(async (req, res) => {
  const user = req.user;

  if (!user) {
    throw new ApiError(401, "Unauthorized");
  }

  const { supplierId } = req.params;
  const { supplierName, contactPerson, contactDetails } = req.body;

  if (!mongoose.Types.ObjectId.isValid(supplierId)) {
    throw new ApiError(400, "Supplier ID invalid");
  }

  if (!supplierName && !contactPerson && !contactDetails) {
    throw new ApiError(
      400,
      "At least one field (supplierName, contactPerson, contactDetails) must be provided for update",
    );
  }

  if (supplierName) {
    const duplicate = await Supplier.findOne({
      supplierName,
      _id: { $ne: supplierId },
    });

    if (duplicate) {
      throw new ApiError(409, "A supplier with this name already exists");
    }
  }

  const updateFields = { supplierName, contactPerson };

  // Merge contactDetails instead of overwriting, so a partial payload
  // (e.g. just a new phone number) doesn't wipe out the email/address.
  if (contactDetails) {
    const existing = await Supplier.findById(supplierId);
    if (!existing) {
      throw new ApiError(404, `Supplier with ID ${supplierId} not found`);
    }
    updateFields.contactDetails = {
      ...existing.contactDetails?.toObject?.(),
      ...contactDetails,
    };
  }

  const updatedSupplier = await Supplier.findByIdAndUpdate(
    supplierId,
    { $set: updateFields },
    { new: true },
  );

  if (!updatedSupplier) {
    throw new ApiError(404, `Supplier with ID ${supplierId} not found`);
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        updatedSupplier,
        "Supplier details updated successfully",
      ),
    );
});

const updateSupplierPendingAmount = asyncHandler(async (req, res) => {
  const user = req.user;

  if (!user) {
    throw new ApiError(401, "Unauthorized");
  }

  const { supplierId } = req.params;
  const { amount, mode } = req.body; // mode: "set" | "add" | "subtract"

  if (!mongoose.Types.ObjectId.isValid(supplierId)) {
    throw new ApiError(400, "Supplier ID invalid");
  }

  if (amount === undefined || isNaN(amount)) {
    throw new ApiError(400, "A valid amount is required");
  }

  const supplier = await Supplier.findById(supplierId);

  if (!supplier) {
    throw new ApiError(404, `Supplier with ID ${supplierId} not found`);
  }

  let newAmount = supplier.pendingAmount;

  if (mode === "add") {
    newAmount += Number(amount);
  } else if (mode === "subtract") {
    newAmount -= Number(amount);
  } else {
    newAmount = Number(amount); // default: "set"
  }

  if (newAmount < 0) {
    throw new ApiError(400, "Pending amount cannot go below 0");
  }

  supplier.pendingAmount = newAmount;
  await supplier.save();

  return res
    .status(200)
    .json(new ApiResponse(200, supplier, "Supplier pending amount updated"));
});

const getAllSuppliers = asyncHandler(async (req, res) => {
  const user = req.user;

  if (!user) {
    throw new ApiError(401, "Unauthorized");
  }

  const suppliers = await Supplier.find().sort({ supplierName: 1 });

  return res
    .status(200)
    .json(new ApiResponse(200, suppliers, "Suppliers retrieved successfully"));
});

const getSupplierById = asyncHandler(async (req, res) => {
  const user = req.user;

  if (!user) {
    throw new ApiError(401, "Unauthorized");
  }

  const { supplierId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(supplierId)) {
    throw new ApiError(400, "Supplier ID invalid");
  }

  const supplier = await Supplier.findById(supplierId);

  if (!supplier) {
    throw new ApiError(404, `Supplier with ID ${supplierId} not found`);
  }

  // Bonus: show which brands are linked to this supplier
  const brands = await Brand.find({ supplier: supplierId }).select(
    "name slug logo",
  );

  // Products this supplier provides, with the terms they offered on each.
  const linkedProducts = await Product.find({
    "suppliers.supplier": supplierId,
  })
    .select("title slug images suppliers")
    .lean();

  const products = linkedProducts.map((product) => {
    const link = product.suppliers.find(
      (s) => s.supplier.toString() === supplierId,
    );
    return {
      _id: product._id,
      title: product.title,
      slug: product.slug,
      image: product.images?.[0] || null,
      costPrice: link.costPrice,
      leadTimeDays: link.leadTimeDays ?? null,
      minOrderQty: link.minOrderQty ?? null,
      isPrimary: link.isPrimary,
    };
  });

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { ...supplier.toObject(), brands, products },
        "Supplier retrieved successfully",
      ),
    );
});

const deleteSupplier = asyncHandler(async (req, res) => {
  const user = req.user;

  if (!user) {
    throw new ApiError(401, "Unauthorized");
  }

  const { supplierId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(supplierId)) {
    throw new ApiError(400, "Supplier ID invalid");
  }

  const supplier = await Supplier.findByIdAndDelete(supplierId);

  if (!supplier) {
    throw new ApiError(404, `Supplier with ID ${supplierId} not found`);
  }

  // Unlink this supplier from any brands pointing to it, so no brand
  // is left referencing a deleted supplier ID.
  await Brand.updateMany(
    { supplier: supplierId },
    { $set: { supplier: null } },
  );

  // Same for products: remove this supplier from every product's supplier
  // list. If it was a product's primary, promote the next remaining supplier
  // so the "exactly one primary" rule still holds (findOneAndUpdate/bulkWrite
  // skip the model's pre-save guard, so it has to be done here).
  const affectedProducts = await Product.find({
    "suppliers.supplier": supplierId,
  }).select("suppliers");

  if (affectedProducts.length > 0) {
    await Product.bulkWrite(
      affectedProducts.map((product) => {
        const remaining = product.suppliers
          .filter((s) => s.supplier.toString() !== supplierId)
          .map((s) => s.toObject());

        if (remaining.length > 0 && !remaining.some((s) => s.isPrimary)) {
          remaining[0].isPrimary = true;
        }

        return {
          updateOne: {
            filter: { _id: product._id },
            update: { $set: { suppliers: remaining } },
          },
        };
      }),
    );
  }

  return res
    .status(200)
    .json(new ApiResponse(200, null, "Supplier deleted successfully"));
});

export {
  createSupplier,
  updateSupplierDetails,
  updateSupplierPendingAmount,
  getAllSuppliers,
  getSupplierById,
  deleteSupplier,
};
