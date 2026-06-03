import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import {Product} from "../models/products.models.js";
import {Category} from "../models/categories.models.js";


const createCategory = asyncHandler(async (req, res) => {
  const user = req.body;

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


export { createCategory }