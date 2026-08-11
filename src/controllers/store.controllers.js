import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Product } from "../models/products.models.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { encryptSecret } from "../utils/encryption.js";
import { Store } from "../models/store.models.js";
import { Category } from "../models/categories.models.js";
import mongoose from "mongoose";

const createStore = asyncHandler(async (req, res) => {
  const user = req.user;

  if (!user) {
    throw new ApiError(401, "Unauthorized access!");
  }

  const {
    storeName,
    description,
    categories,
    businessType,
    registrationNumber,
    address,
    businessEmail,
  } = req.body;

  if (
    !storeName ||
    !businessType ||
    !businessEmail ||
    !address ||
    !categories?.length
  ) {
    throw new ApiError(400, "Please provide all required fields.");
  }

  const existingStore = await Store.findOne({ owner: user._id });

  if (existingStore) {
    throw new ApiError(409, "You already own a store.");
  }

  const duplicateStore = await Store.findOne({
    storeName: storeName.trim(),
  });

  if (duplicateStore) {
    throw new ApiError(409, "Store name already exists.");
  }

  if (!Array.isArray(categories) || categories.length === 0) {
    throw new ApiError(400, "Please select at least one category.");
  }

  const invalidIds = categories.filter(
    (id) => !mongoose.Types.ObjectId.isValid(id),
  );

  if (invalidIds.length > 0) {
    throw new ApiError(400, "One or more category IDs are invalid.");
  }

  const existingCategories = await Category.find({
    _id: { $in: categories },
  }).select("_id");

  if (existingCategories.length !== categories.length) {
    throw new ApiError(404, "One or more selected categories do not exist.");
  }

  const store = await Store.create({
    owner: user._id,
    storeName: storeName.trim(),
    description,
    categories,
    businessType,
    registrationNumber,
    businessEmail: businessEmail.toLowerCase().trim(),
    address,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, store, "Store created successfully."));
});

const addStoreLogo = asyncHandler(async (req, res) => {
  const logoLocalPath = req.file?.path;

  if (!logoLocalPath) {
    throw new ApiError(400, "Store logo is required.");
  }

  // Resolved once by the attachStore middleware.
  const store = req.store;

  const logo = await uploadOnCloudinary(logoLocalPath, {
    folder: `stores/${store._id}`,
    publicId: "logo",
    overwrite: true,
  });

  if (!logo?.secure_url) {
    throw new ApiError(500, "Error uploading store logo.");
  }

  store.logo = {
    url: logo.secure_url,
    public_id: logo.public_id,
  };

  await store.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, store, "Store logo uploaded successfully."));
});

const getStoreDetails = asyncHandler(async (req, res) => {
  const user = req.user;

  if (!user) {
    throw new ApiError(401, "Unauthorized access!");
  }

  const { storeId } = req.params;

  if (!storeId) {
    throw new ApiError(500, "Store ID is required");
  }

  const store = await Store.findById(storeId);

  if (!store) {
    throw new ApiError(404, "Store not found.");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, store, "Store details retrieved successfully."));
});

// req.store is resolved once by the attachStore middleware — this
// controller just returns it.
const getMyStore = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(
      new ApiResponse(200, req.store, "Store details retrieved successfully."),
    );
});

const updateStoreDetails = asyncHandler(async (req, res) => {
  // Resolved once by the attachStore middleware.
  const store = req.store;

  const {
    storeName,
    description,
    categories,
    businessType,
    registrationNumber,
    businessEmail,
    address,
  } = req.body;

  const updatedStore = await Store.findByIdAndUpdate(
    store._id,
    {
      $set: {
        storeName,
        description,
        categories,
        businessType,
        registrationNumber,
        businessEmail,
        address,
      },
    },
    { new: true, runValidators: true },
  );

  return res
    .status(201)
    .json(
      new ApiResponse(201, updatedStore, "Store details updated successfully."),
    );
});

const updateStoreSettings = asyncHandler(async (req, res) => {
  // Resolved once by the attachStore middleware.
  const store = req.store;

  const { payment, shipping, tax } = req.body;

  if (payment?.methods) {
    store.settings.payment.methods = {
      ...store.settings.payment.methods.toObject(),
      ...payment.methods,
    };
  }

  if (payment?.codOrderLimit !== undefined) {
    if (payment.codOrderLimit !== null && payment.codOrderLimit < 0) {
      throw new ApiError(400, "COD order limit cannot be negative");
    }
    store.settings.payment.codOrderLimit = payment.codOrderLimit;
  }

  if (payment?.payout) {
    const { accountHolderName, accountNumber, ifscCode } = payment.payout;

    if (accountHolderName !== undefined) {
      store.settings.payment.payout.accountHolderName = accountHolderName;
    }

    if (ifscCode !== undefined) {
      store.settings.payment.payout.ifscCode = ifscCode;
    }

    if (accountNumber) {
      const digitsOnly = accountNumber.replace(/\D/g, "");

      if (digitsOnly.length < 9 || digitsOnly.length > 18) {
        throw new ApiError(400, "Invalid account number");
      }

      store.settings.payment.payout.accountNumberEncrypted =
        encryptSecret(digitsOnly);
      store.settings.payment.payout.accountNumberLast4 = digitsOnly.slice(-4);
    }
  }

  if (shipping) {
    store.settings.shipping = {
      ...store.settings.shipping.toObject(),
      ...shipping,
    };
  }

  if (tax) {
    if (tax.gstRegistered && !tax.gstin) {
      throw new ApiError(
        400,
        "GSTIN is required when GST registered is enabled",
      );
    }
    store.settings.tax = { ...store.settings.tax.toObject(), ...tax };
  }

  await store.save();

  const responseStore = store.toObject();
  delete responseStore.settings?.payment?.payout?.accountNumberEncrypted;

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        responseStore,
        "Store settings updated successfully.",
      ),
    );
});

export {
  createStore,
  addStoreLogo,
  getStoreDetails,
  getMyStore,
  updateStoreDetails,
  updateStoreSettings,
};
