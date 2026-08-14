import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Brand } from "../models/brands.models.js";
import { Category } from "../models/categories.models.js";
import { Product } from "../models/products.models.js";
import { Store } from "../models/store.models.js";
import { slugifyForFolder } from "../utils/slugify.js";
import {
  uploadOnCloudinary,
  deleteFromCloudinary,
} from "../utils/cloudinary.js";
import mongoose from "mongoose";

const createBrand = asyncHandler(async (req, res) => {
  const user = req.user;

  if (!user) {
    throw new ApiError(401, "Unauthorized");
  }

  const { name, slug, description, categories } = req.body;
  if (!name || !slug) {
    throw new ApiError(400, "Name and slug are required");
  }

  // Check for duplicate name or slug
  const duplicate = await Brand.findOne({
    $or: [{ name }, { slug }],
  });

  if (duplicate) {
    const conflictField = duplicate.name === name ? "name" : "slug";
    throw new ApiError(
      409,
      `A brand with this ${conflictField} already exists`,
    );
  }

  if (categories && categories.length > 0) {
    const existingCategories = await Category.find({
      _id: { $in: categories },
    });

    if (existingCategories.length !== categories.length) {
      throw new ApiError(400, "One or more categories are invalid");
    }
  }

  const brand = await Brand.create({
    name,
    slug,
    description,
    categories,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, brand, "Brand created successfully"));
});

const updateBrandLogo = asyncHandler(async (req, res) => {
  const user = req.user;

  if (!user) {
    throw new ApiError(401, "Unauthorized");
  }

  const brandId = req.body?.brandId;
  const brandLogo = req.file?.path;

  if (!mongoose.Types.ObjectId.isValid(brandId)) {
    throw new ApiError(400, "Brand ID invalid");
  }

  if (!brandLogo) {
    throw new ApiError(400, "Brand logo file is missing");
  }

  const [brand, store] = await Promise.all([
    Brand.findById(brandId).populate("categories", "name"),
    Store.findOne({ owner: user?._id }),
  ]);

  if (!brand) {
    throw new ApiError(404, `Brand with ID ${brandId} not found`);
  }

  if (!store) {
    throw new ApiError(404, "Store not found for this user");
  }

  const categoryName = brand.categories?.[0]?.name || "uncategorized";

  const folder = [store.storeName, categoryName, brand.name, "logo"]
    .map(slugifyForFolder)
    .join("/");

  const logo = await uploadOnCloudinary(brandLogo, { folder });

  if (!logo || !logo.url) {
    throw new ApiError(400, "Error while uploading brand logo");
  }

  // Delete the previous logo from Cloudinary only after the new one
  // has uploaded successfully, so a failed upload never leaves the
  // brand without any logo asset.
  const previousLogoPublicId = brand.logoPublicId;
  if (previousLogoPublicId) {
    await deleteFromCloudinary(previousLogoPublicId);
  }

  brand.logo = logo.url;
  brand.logoPublicId = logo.public_id;
  await brand.save();

  const updatedBrand = await Brand.findById(brandId).select("-categories");

  return res
    .status(200)
    .json(
      new ApiResponse(200, updatedBrand, "Brand logo updated successfully"),
    );
});

const updateBrandDetails = asyncHandler(async (req, res) => {
  const user = req.user;

  if (!user) {
    throw new ApiError(401, "Unauthorized");
  }

  const { brandId } = req.params;
  const { name, slug, description } = req.body;

  if (!brandId) {
    throw new ApiError(400, "Brand ID is required");
  }

  if (!name && !slug && !description) {
    throw new ApiError(
      400,
      "At least one field (name, slug, description) must be provided for update",
    );
  }

  const duplicate = await Brand.findOne({
    $or: [{ name }, { slug }],
    _id: { $ne: brandId },
  });

  if (duplicate) {
    const conflictField = duplicate.name === name ? "name" : "slug";
    throw new ApiError(
      409,
      `A brand with this ${conflictField} already exists`,
    );
  }

  const updatedBrand = await Brand.findByIdAndUpdate(
    brandId,
    { $set: { name, slug, description } },
    { new: true },
  ).select("-categories");

  if (!updatedBrand) {
    throw new ApiError(404, `Brand with ID ${brandId} not found`);
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, updatedBrand, "Brand details updated successfully"),
    );
});

const getAllBrands = asyncHandler(async (req, res) => {
  const user = req.user;

  if (!user) {
    throw new ApiError(401, "Unauthorized");
  }

  const brands = await Brand.aggregate([
    {
      $lookup: {
        from: "categories",
        localField: "categories",
        foreignField: "_id",
        as: "categories",
      },
    },
    {
      $project: {
        name: 1,
        slug: 1,
        description: 1,
        logo: 1,
        categories: "$categories.name",
      },
    },
  ]);

  return res
    .status(200)
    .json(new ApiResponse(200, brands, "Brands retrieved successfully"));
});

const getBrandById = asyncHandler(async (req, res) => {
  const user = req.user;

  if (!user) {
    throw new ApiError(401, "Unauthorized");
  }

  const { brandId } = req.params;

  if (!brandId) {
    throw new ApiError(400, "Brand ID is required");
  }

  const brand = await Brand.findById(brandId).populate("categories", "name");

  if (!brand) {
    throw new ApiError(404, `Brand with ID ${brandId} not found`);
  }

  return res
    .status(200)
    .json(new ApiResponse(200, brand, "Brand retrieved successfully"));
});

const getBrandFromCategories = asyncHandler(async (req, res) => {
  const user = req.user;

  if (!user) {
    throw new ApiError(401, "Unauthorized access!");
  }

  const { categoryId } = req.params;

  if (!categoryId) {
    throw new ApiError(400, "Category ID is required");
  }

  const brands = await Brand.find({ categories: categoryId }).select(
    "name slug logo categories",
  );

  if (!brands || brands.length === 0) {
    throw new ApiError(404, "No brands found for this category");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, brands, "Brands retrieved successfully"));
});

const addcategoriesToBrand = asyncHandler(async (req, res) => {
  const user = req.user;

  if (!user) {
    throw new ApiError(401, "Unauthorized");
  }

  const { brandId, categoryIds } = req.body;

  if (!brandId || !categoryIds || categoryIds.length === 0) {
    throw new ApiError(400, "Brand ID and category IDs are required");
  }

  const brand = await Brand.findById(brandId);

  if (!brand) {
    throw new ApiError(404, `Brand with ID ${brandId} not found`);
  }

  const existingCategories = await Category.find({
    _id: { $in: categoryIds },
  });

  if (existingCategories.length !== categoryIds.length) {
    throw new ApiError(400, "One or more category IDs are invalid");
  }

  const updatedBrand = await Brand.findByIdAndUpdate(
    brandId,
    { $addToSet: { categories: { $each: categoryIds } } },
    { new: true },
  ).populate("categories", "name");

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        updatedBrand,
        "Categories added to brand successfully",
      ),
    );
});

const deleteCategoriesFromBrand = asyncHandler(async (req, res) => {
  const user = req.user;

  if (!user) {
    throw new ApiError(401, "Unauthorized");
  }

  const { brandId, categoryIds } = req.body;

  if (!brandId || !categoryIds || categoryIds.length === 0) {
    throw new ApiError(400, "Brand ID and category IDs are required");
  }

  const brand = await Brand.findById(brandId);

  if (!brand) {
    throw new ApiError(404, `Brand with ID ${brandId} not found`);
  }

  const updatedBrand = await Brand.findByIdAndUpdate(
    brandId,
    { $pull: { categories: { $in: categoryIds } } },
    { new: true },
  ).populate("categories", "name");

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        updatedBrand,
        "Categories removed from brand successfully",
      ),
    );
});

const deleteBrand = asyncHandler(async (req, res) => {
  const user = req.user;

  if (!user) {
    throw new ApiError(401, "Unauthorized");
  }

  const { brandId } = req.params;

  if (!brandId) {
    throw new ApiError(400, "Brand ID is required");
  }

  const brand = await Brand.findByIdAndDelete(brandId);

  if (!brand) {
    throw new ApiError(404, `Brand with ID ${brandId} not found`);
  }

  // Clean up the brand's logo asset from Cloudinary, if one was uploaded
  if (brand.logoPublicId) {
    await deleteFromCloudinary(brand.logoPublicId);
  }

  const products = await Product.deleteMany({
    brand: brandId,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, null, "Brand deleted successfully"));
});

export {
  createBrand,
  updateBrandLogo,
  updateBrandDetails,
  getAllBrands,
  getBrandById,
  addcategoriesToBrand,
  deleteCategoriesFromBrand,
  deleteBrand,
  getBrandFromCategories,
};
