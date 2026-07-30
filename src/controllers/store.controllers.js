import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { Store } from "../models/store.models.js";
import { Category } from "../models/categories.models.js";
import mongoose from "mongoose";

const createStore = asyncHandler(async (req, res) => {
  const user = req.user;

  if (!user) {
    throw new ApiError(401, "Unauthorized");
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

  const existingStore = await Store.findOne({ owner: user?._id });
  if (existingStore) {
    throw new ApiError(400, "You already have a store");
  }

  // --- categories validation ---
  if (!Array.isArray(categories) || categories.length === 0) {
    throw new ApiError(400, "At least one category is required");
  }

  const uniqueCategoryIds = [...new Set(categories)];

  const invalidIds = uniqueCategoryIds.filter(
    (id) => !mongoose.Types.ObjectId.isValid(id),
  );
  if (invalidIds.length > 0) {
    throw new ApiError(400, "One or more category ids are not valid");
  }

  const validCategories = await Category.find({
    _id: { $in: uniqueCategoryIds },
  }).select("_id");

  if (validCategories.length !== uniqueCategoryIds.length) {
    throw new ApiError(400, "One or more selected categories do not exist");
  }

  const store = await Store.create({
    owner: req.user._id,
    storeName,
    slug: storeName.toLowerCase().trim().replace(/\s+/g, "-"),
    description,
    categories: uniqueCategoryIds, // validated list, not raw req.body.categories
    businessType,
    registrationNumber,
    businessEmail,
    address,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, store, "Store created successfully"));
});

const addStoreLogo = asyncHandler(async (req, res) => {

  const user=req.user;

  if(!user){
     throw new ApiError(401,"Unauthorized");
  }

  console.log(req.headers["content-type"], req.file, req.body);

  const storeLogoLocalPath = req.file?.path;

  if (!storeLogoLocalPath) {
    throw new ApiError(400, "Store logo file is missing");
  }

  const store = await Store.findOne({ owner: req.user?._id });

  if (!store) {
    throw new ApiError(404, "Store not found for this user");
  }

  const uploaded = await uploadOnCloudinary(
    storeLogoLocalPath,
    `Stores/${store.slug}`,
  );

  if (!uploaded || !uploaded.secure_url) {
    throw new ApiError(500, "Error while uploading store logo");
  }

  store.storeLogo = uploaded.secure_url;
  await store.save();

  return res
    .status(200)
    .json(new ApiResponse(200, store, "Store logo updated successfully"));
});


const getStoreDetails = asyncHandler(async(req,res)=>{

    const {storeId}= req.params;
    const user=req.user;

    if(!user){
        throw new ApiError(401,"Unauthorized access");
    }

    const store= await Store.findById(storeId);

    if(!store){
        throw new ApiError(404, "Store not found!");
    }

    return res.
    status(200).
    json(new ApiResponse(200,store,"Store Details retrieved successfully."));


});


const updateStoreDetails = asyncHandler(async (req,res)=>{
  const user=req.user;

  const {
    storeName,
    description,
    categories,
    businessType,
    registrationNumber,
    businessEmail,
    address,
  } = req.body;

  if(!user){
     throw new ApiError(401,"Unauthorized access");
  }

  const updatedStore = await Store.findOneAndUpdate(
    { owner: req.user?._id },
    {
      $set: {
        storeName,
        description,
        categories,
        businessType,
        registrationNumber,
        businessEmail,
        address
      },
    },
  );

  if(!updatedStore){
    throw new ApiError(404, "Store not found");
  }

  return res.
  status(200).
  json(new ApiResponse(200,updatedStore,"Store Details updated successfully."));

})






export { 
    createStore,
    addStoreLogo,
    updateStoreDetails,
    getStoreDetails,
};
