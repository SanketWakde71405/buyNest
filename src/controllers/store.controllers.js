import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Product } from "../models/products.models.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
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

  // Validate required fields
  if (
    !storeName ||
    !businessType ||
    !businessEmail ||
    !address ||
    !categories?.length
  ) {
    throw new ApiError(400, "Please provide all required fields.");
  }

  // Check if user already owns a store
  const existingStore = await Store.findOne({ owner: user._id });

  if (existingStore) {
    throw new ApiError(409, "You already own a store.");
  }

  // Check for duplicate store name (optional)
  const duplicateStore = await Store.findOne({
    storeName: storeName.trim(),
  });

  if (duplicateStore) {
    throw new ApiError(409, "Store name already exists.");
  }

  // categories must be an array
  if (!Array.isArray(categories) || categories.length === 0) {
    throw new ApiError(400, "Please select at least one category.");
  }

  // Validate ObjectIds
  const invalidIds = categories.filter(
    (id) => !mongoose.Types.ObjectId.isValid(id),
  );

  if (invalidIds.length > 0) {
    throw new ApiError(400, "One or more category IDs are invalid.");
  }

  // Check that all categories exist
  const existingCategories = await Category.find({
    _id: { $in: categories },
  }).select("_id");

  if (existingCategories.length !== categories.length) {
    throw new ApiError(404, "One or more selected categories do not exist.");
  }

  // Create store
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

  // Find the user's store
  const store = await Store.findOne({ owner: req.user._id });

  if (!store) {
    throw new ApiError(404, "Store not found.");
  }

  // Upload logo
  const logo = await uploadOnCloudinary(logoLocalPath, {
    folder: `stores/${store._id}`,
    publicId: "logo",
    overwrite: true,
  });

  if (!logo?.secure_url) {
    throw new ApiError(500, "Error uploading store logo.");
  }

  // Save logo details
  store.logo = {
    url: logo.secure_url,
    public_id: logo.public_id,
  };

  await store.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, store, "Store logo uploaded successfully."));
});


const getStoreDetails= asyncHandler(async(req,res)=>{

    const user=req.user;

    if(!user){
        throw new ApiError(401,"Unauthorized access!");
    }

    const {storeId} =req.params;

    if(!storeId){
        throw new ApiError(500,"Store ID is required");
    }

    const store = await Store.findById(storeId);

    if(!store){
        throw new ApiError(404, "Store not found.");
    }

    return res.
    status(200).
    json(new ApiResponse(200,store,"Store details retrieved successfully."));

});


const updateStoreDetails= asyncHandler(async(req,res)=>{

    const user =req.user;

    if(!user){
        throw new ApiError(401,"Unauthorized access!");
    }

    const store = await Store.findOne({ owner: user._id });

    if (!store) {
      throw new ApiError(404, "Store not found.");
    }

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

});


export {
    createStore,
    addStoreLogo,
    getStoreDetails,
    updateStoreDetails,

}
