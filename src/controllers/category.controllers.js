import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Product } from "../models/products.models.js";
import { Category } from "../models/categories.models.js";
import { Store } from "../models/store.models.js";
import mongoose from "mongoose";

const createCategory = asyncHandler(async (req, res) => {
  const user = req.user;

  if (!user) {
    throw new ApiError(401, "Unauthorized");
  }

  const { name, slug, description, parentCategory } = req.body;

  if (!name || !slug) {
    throw new ApiError(400, "Name and slug are required");
  }

  if (parentCategory) {
    const existingParentCategory = await Category.find();

    const existingCategoryIds = existingParentCategory.map((category) =>
      category._id.toString(),
    );

    if (!existingCategoryIds.includes(parentCategory)) {
      throw new ApiError(400, "Invalid parent category");
    }
  }

  // Check for duplicate name or slug under the same parent
  const duplicate = await Category.findOne({
    $or: [{ name }, { slug }],
    parentCategory: parentCategory || null,
  });

  if (duplicate) {
    const conflictField = duplicate.name === name ? "name" : "slug";
    throw new ApiError(
      409,
      `A category with this ${conflictField} already exists ${
        parentCategory ? "under this parent category" : "at the top level"
      }`,
    );
  }

  const category = await Category.create({
    name,
    slug,
    description,
    parentCategory: parentCategory || null,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, category, "Category created successfully"));
});

const getCategories = asyncHandler(async (req, res) => {
  const user = req.user;

  if (!user) {
    throw new ApiError(401, "Unauthorized");
  }

  const categories = await Category.find().select(
    "-slug -description -parentCategory -createdAt -updatedAt",
  );

  if (!categories) {
    throw new ApiError(404, "No categories found");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, categories, "Categories retrieved successfully"),
    );
});

const getCategoryById = asyncHandler(async (req, res) => {
  const user = req.user;
  const { categoryId } = req.params;

  if (!user) {
    throw new ApiError(401, "Unauthorized");
  }

  if (!categoryId) {
    throw new ApiError(400, "Category ID is required");
  }

  const category = await Category.findById(categoryId);

  if (!category) {
    throw new ApiError(404, "Category not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, category, "Category retrieved successfully"));
});

const getParentCategories = asyncHandler(async (req, res) => {
  const user = req.user;
  if (!user) {
    throw new ApiError(401, "Unauthorized");
  }

  const parentCategories = await Category.find({ parentCategory: null });

  if (!parentCategories) {
    throw new ApiError(404, "No parent categories found");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        parentCategories,
        "Parent categories retrieved successfully",
      ),
    );
});

const getParentCategoriesForStore = asyncHandler(async (req, res) => {
  const user = req.user;

  if (!user) {
    throw new ApiError(401, "Unauthorized access");
  }

  const store = await Store.findOne({ owner: user._id });

  if (!store) {
    throw new ApiError(404, "Store not found");
  }

  const categoryIds = store.categories;

  if (!categoryIds) {
    throw new ApiError(404, "No categories for this store");
  }

  const categories = await Category.find(
    { _id: { $in: categoryIds } },
    "name slug", // only pull back what you need
  );

  return res
    .status(200)
    .json(
      new ApiResponse(200, categories, "Categories retrieved successfully"),
    );
});

const getSubCategories = asyncHandler(async (req, res) => {
  const user = req.user;
  const { parentCategoryId } = req.params;

  if (!user) {
    throw new ApiError(401, "Unauthorized");
  }

  if (!parentCategoryId || !mongoose.Types.ObjectId.isValid(parentCategoryId)) {
    throw new ApiError(400, "A valid parent category ID is required");
  }

  const subCategories = await Category.find({
    parentCategory: parentCategoryId,
  });

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        subCategories,
        "Subcategories retrieved successfully",
      ),
    );
});

const updateCategory = asyncHandler(async (req, res) => {
  const user = req.user;
  const { categoryId } = req.params;
  const { name, slug, description } = req.body;

  if (!user) {
    throw new ApiError(401, "Unauthorized");
  }

  if (!categoryId) {
    throw new ApiError(400, "Category ID is required");
  }

  if (!name && !slug && !description) {
    throw new ApiError(
      400,
      "At least one field (name, slug, description) is required to update",
    );
  }

  const existingCategory = await Category.findById(categoryId);

  if (!existingCategory) {
    throw new ApiError(404, "Category not found");
  }

  // Check for duplicate name or slug
  if (name || slug) {
    const duplicateCategory = await Category.findOne({
      _id: { $ne: categoryId }, // exclude current category
      parentCategory: existingCategory.parentCategory,
      $or: [...(name ? [{ name }] : []), ...(slug ? [{ slug }] : [])],
    });

    if (duplicateCategory) {
      const conflictField = duplicateCategory.name === name ? "name" : "slug";

      throw new ApiError(
        409,
        `A category with this ${conflictField} already exists ${
          existingCategory.parentCategory
            ? "under this parent category"
            : "at the top level"
        }`,
      );
    }
  }

  const updatedCategory = await Category.findByIdAndUpdate(
    categoryId,
    {
      ...(name && { name }),
      ...(slug && { slug }),
      ...(description && { description }),
    },
    { new: true },
  );

  return res
    .status(200)
    .json(
      new ApiResponse(200, updatedCategory, "Category updated successfully"),
    );
});

const deleteCategory = asyncHandler(async (req, res) => {
  const user = req.user;
  const { categoryId } = req.params;

  if (!user) {
    throw new ApiError(401, "Unauthorized");
  }

  if (!categoryId) {
    throw new ApiError(400, "Category ID is required");
  }

  const category = await Category.findById(categoryId);

  if (!category) {
    throw new ApiError(404, "Category not found");
  }

  // Check if this category is a parent of any other category
  const childCategoryExists = await Category.exists({
    parentCategory: categoryId,
  });

  if (childCategoryExists) {
    throw new ApiError(
      400,
      "Cannot delete category because it contains subcategories. Delete or reassign the subcategories first.",
    );
  }

  // Delete all products belonging to this category
  await Product.deleteMany({ category: categoryId });

  // Delete the category
  await Category.findByIdAndDelete(categoryId);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        null,
        "Category and associated products deleted successfully",
      ),
    );
});

export {
  createCategory,
  getCategories,
  getParentCategories,
  getParentCategoriesForStore,
  getSubCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
};
