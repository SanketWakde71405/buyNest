import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Product } from "../models/products.models.js";
import { Category } from "../models/categories.models.js";
import { Store } from "../models/store.models.js";
import { Brand } from "../models/brands.models.js";
import mongoose from "mongoose";

const attachProductCounts = async (categories) => {
  const categoryIds = categories.map((cat) => cat._id);

  const counts = await Product.aggregate([
    { $match: { category: { $in: categoryIds } } },
    { $unwind: "$category" },
    { $match: { category: { $in: categoryIds } } },
    { $group: { _id: "$category", count: { $sum: 1 } } },
  ]);

  const countMap = new Map(
    counts.map(({ _id, count }) => [_id.toString(), count]),
  );

  return categories.map((cat) => {
    const plain = cat.toObject ? cat.toObject() : cat;
    return {
      ...plain,
      productCount: countMap.get(cat._id.toString()) || 0,
    };
  });
};

// Returns the ids of all descendants of `categoryId` (not including
// itself). Used to block a category from being reparented under its own
// subtree, which would otherwise create a cycle.
const getDescendantIds = async (categoryId) => {
  const [result] = await Category.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(categoryId) } },
    {
      $graphLookup: {
        from: Category.collection.name,
        startWith: "$_id",
        connectFromField: "_id",
        connectToField: "parentCategory",
        as: "descendants",
      },
    },
    { $project: { descendantIds: "$descendants._id" } },
  ]);

  return (result?.descendantIds || []).map((id) => id.toString());
};

const createCategory = asyncHandler(async (req, res) => {
  const user = req.user;

  if (!user) {
    throw new ApiError(401, "Unauthorized");
  }

  const { name, slug, description, parentCategory } = req.body;

  if (!name || !slug) {
    throw new ApiError(400, "Name and slug are required");
  }

  const resolvedParentId = parentCategory || null;

  if (resolvedParentId) {
    if (!mongoose.Types.ObjectId.isValid(resolvedParentId)) {
      throw new ApiError(400, "Invalid parent category");
    }
    const existingParent =
      await Category.findById(resolvedParentId).select("_id");
    if (!existingParent) {
      throw new ApiError(400, "Invalid parent category");
    }
  }

  // Check for duplicate name or slug under the same parent
  const duplicate = await Category.findOne({
    $or: [{ name }, { slug }],
    parentCategory: resolvedParentId,
  });

  if (duplicate) {
    const conflictField = duplicate.name === name ? "name" : "slug";
    throw new ApiError(
      409,
      `A category with this ${conflictField} already exists ${
        resolvedParentId ? "under this parent category" : "at the top level"
      }`,
    );
  }

  // displayOrder is never accepted from the client — new categories are
  // always appended to the end of their sibling group. Use the reorder
  // endpoint to change position afterwards.
  const nextDisplayOrder = await Category.getNextDisplayOrder(resolvedParentId);

  const category = await Category.create({
    name,
    slug,
    description,
    displayOrder: nextDisplayOrder,
    parentCategory: resolvedParentId,
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

  const categories = await Category.find()
    .select("-slug -description -parentCategory -createdAt -updatedAt")
    .sort({ displayOrder: 1 });

  const categoriesWithCounts = await attachProductCounts(categories);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        categoriesWithCounts,
        "Categories retrieved successfully",
      ),
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

  const [categoryWithCount] = await attachProductCounts([category]);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        categoryWithCount,
        "Category retrieved successfully",
      ),
    );
});

const getParentCategories = asyncHandler(async (req, res) => {
  const user = req.user;
  if (!user) {
    throw new ApiError(401, "Unauthorized");
  }

  const parentCategories = await Category.find({ parentCategory: null }).sort({
    displayOrder: 1,
  });

  const parentCategoriesWithCounts =
    await attachProductCounts(parentCategories);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        parentCategoriesWithCounts,
        "Parent categories retrieved successfully",
      ),
    );
});

const getSubCategories = asyncHandler(async (req, res) => {
  const user = req.user;
  const { parentCategoryId } = req.params;

  if (!user) {
    throw new ApiError(401, "Unauthorized");
  }

  if (!parentCategoryId) {
    throw new ApiError(400, "Parent category ID is required");
  }

  if (!mongoose.Types.ObjectId.isValid(parentCategoryId)) {
    throw new ApiError(400, "Invalid parent category ID");
  }

  const parentExists = await Category.exists({ _id: parentCategoryId });
  if (!parentExists) {
    throw new ApiError(404, "Parent category not found");
  }

  const subCategories = await Category.find({
    parentCategory: parentCategoryId,
  }).sort({
    displayOrder: 1,
  });

  const subCategoriesWithCounts = await attachProductCounts(subCategories);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        subCategoriesWithCounts,
        "Subcategories retrieved successfully",
      ),
    );
});

const getCategoriesForStore = asyncHandler(async (req, res) => {
  const user = req.user;

  if (!user) {
    throw new ApiError(401, "Unauthorized access");
  }

  const store = await Store.findOne({ owner: user._id })
    .select("categories")
    .populate(
      "categories",
      "name slug description status parentCategory parentCategoryName displayOrder createdAt updatedAt",
    );

  if (!store) {
    throw new ApiError(404, "Store not found");
  }

  if (!store.categories || store.categories.length === 0) {
    throw new ApiError(404, "No categories found for this store.");
  }

  // .populate() preserves the order the ids are stored in the array, not
  // displayOrder — sort explicitly after populating.
  const categories = store.categories
    .slice()
    .sort((a, b) => a.displayOrder - b.displayOrder);

  const categoriesWithCounts = await attachProductCounts(categories);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        categoriesWithCounts,
        "Categories retrieved successfully.",
      ),
    );
});

const updateCategory = asyncHandler(async (req, res) => {
  const user = req.user;
  const { categoryId } = req.params;
  const { name, slug, description, parentCategory } = req.body;

  if (!user) {
    throw new ApiError(401, "Unauthorized");
  }

  if (!categoryId) {
    throw new ApiError(400, "Category ID is required");
  }

  const parentProvided = parentCategory !== undefined;

  if (!name && !slug && !description && !parentProvided) {
    throw new ApiError(
      400,
      "At least one field (name, slug, description, parentCategory) is required to update",
    );
  }

  const existingCategory = await Category.findById(categoryId);

  if (!existingCategory) {
    throw new ApiError(404, "Category not found");
  }

  const oldParentId = existingCategory.parentCategory
    ? existingCategory.parentCategory.toString()
    : null;

  let resolvedParentId = existingCategory.parentCategory;

  if (parentProvided) {
    if (parentCategory === null) {
      resolvedParentId = null;
    } else {
      if (!mongoose.Types.ObjectId.isValid(parentCategory)) {
        throw new ApiError(400, "Invalid parent category");
      }

      if (parentCategory === categoryId) {
        throw new ApiError(400, "A category cannot be its own parent");
      }

      const newParent = await Category.findById(parentCategory).select("_id");
      if (!newParent) {
        throw new ApiError(400, "Invalid parent category");
      }

      // Prevent cycles: the new parent can't be a descendant of this
      // category, or this category would end up as its own ancestor.
      const descendantIds = await getDescendantIds(categoryId);
      if (descendantIds.includes(parentCategory)) {
        throw new ApiError(
          400,
          "Cannot set a subcategory of this category as its parent",
        );
      }

      resolvedParentId = newParent._id;
    }
  }

  const newParentId = resolvedParentId ? resolvedParentId.toString() : null;
  const parentIsChanging = parentProvided && oldParentId !== newParentId;

  // Check for duplicate name/slug against siblings under the *effective*
  // (possibly new) parent — a name/slug that's fine under the old parent
  // may collide under the new one, and vice versa.
  if (name || slug || parentIsChanging) {
    const effectiveName = name || existingCategory.name;
    const effectiveSlug = slug || existingCategory.slug;

    const duplicateCategory = await Category.findOne({
      _id: { $ne: categoryId },
      parentCategory: resolvedParentId,
      $or: [{ name: effectiveName }, { slug: effectiveSlug }],
    });

    if (duplicateCategory) {
      const conflictField =
        duplicateCategory.name === effectiveName ? "name" : "slug";

      throw new ApiError(
        409,
        `A category with this ${conflictField} already exists ${
          resolvedParentId ? "under this parent category" : "at the top level"
        }`,
      );
    }
  }

  if (name) existingCategory.name = name;
  if (slug) existingCategory.slug = slug;
  if (description) existingCategory.description = description;

  if (parentIsChanging) {
    existingCategory.parentCategory = resolvedParentId;
    // Moved into a new sibling group — append to the end of it rather
    // than keeping a displayOrder value that was only meaningful under
    // the old parent. Use the reorder endpoint afterwards to reposition.
    existingCategory.displayOrder =
      await Category.getNextDisplayOrder(resolvedParentId);
  }

  await existingCategory.save(); // pre-save hook updates parentCategoryName

  if (parentIsChanging) {
    const idsToSync = [existingCategory._id];
    if (oldParentId) idsToSync.push(new mongoose.Types.ObjectId(oldParentId));
    await Category.syncStatus(idsToSync);
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, existingCategory, "Category updated successfully"),
    );
});

// Reorders one sibling group in a single pass. `orderedCategoryIds` must
// contain exactly the current siblings under `parentCategory` (no more,
// no fewer) — this is a full replace, not a single-item move, which
// avoids the duplicate-displayOrder issues that come from shifting
// positions one at a time.
const reorderCategories = asyncHandler(async (req, res) => {
  const user = req.user;

  if (!user) {
    throw new ApiError(401, "Unauthorized");
  }

  const { parentCategory, orderedCategoryIds } = req.body;
  const resolvedParentId = parentCategory || null;

  if (!Array.isArray(orderedCategoryIds) || orderedCategoryIds.length === 0) {
    throw new ApiError(400, "orderedCategoryIds must be a non-empty array");
  }

  const invalidIds = orderedCategoryIds.filter(
    (id) => !mongoose.Types.ObjectId.isValid(id),
  );
  if (invalidIds.length > 0) {
    throw new ApiError(400, "One or more category IDs are invalid.");
  }

  const siblings = await Category.find({
    parentCategory: resolvedParentId,
  }).select("_id");
  const siblingIdSet = new Set(siblings.map((c) => c._id.toString()));

  const providedIdSet = new Set(orderedCategoryIds);

  if (
    orderedCategoryIds.length !== siblings.length ||
    !orderedCategoryIds.every((id) => siblingIdSet.has(id)) ||
    providedIdSet.size !== orderedCategoryIds.length
  ) {
    throw new ApiError(
      400,
      "orderedCategoryIds must exactly match the current siblings under this parent, with no duplicates",
    );
  }

  await Category.reorderSiblings(resolvedParentId, orderedCategoryIds);

  return res
    .status(200)
    .json(new ApiResponse(200, null, "Category order updated successfully"));
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

  // Check if any products still reference this category
  const productCount = await Product.countDocuments({ category: categoryId });

  if (productCount > 0) {
    throw new ApiError(
      400,
      `Cannot delete category because ${productCount} product(s) are still assigned to it. Delete or reassign those products first.`,
    );
  }

  // Check if any brands still reference this category
  const brandCount = await Brand.countDocuments({ categories: categoryId });

  if (brandCount > 0) {
    throw new ApiError(
      400,
      `Cannot delete category because ${brandCount} brand(s) are still assigned to it. Remove this category from those brands first.`,
    );
  }

  // Nothing references this category — safe to delete
  await Category.findByIdAndDelete(categoryId);

  return res
    .status(200)
    .json(new ApiResponse(200, null, "Category deleted successfully"));
});

const backfillCategoryStatus = asyncHandler(async (req, res) => {
  const user = req.user;

  if (!user) {
    throw new ApiError(401, "Unauthorized");
  }

  const allCategoryIds = await Category.find().select("_id");
  await Category.syncStatus(allCategoryIds.map((c) => c._id));

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { count: allCategoryIds.length },
        "Category status backfilled successfully",
      ),
    );
});

// One-off migration helper for categories created before displayOrder was
// managed: assigns sequential displayOrder (0..n-1) within each sibling
// group (parentCategory: null, and each existing parentCategory id),
// ordered by createdAt. Safe to re-run — it always recomputes each
// group's order from scratch rather than assuming prior state, but it
// will override any manual ordering already set via /reorder, so this
// should only be run once against untouched data, not on a schedule.
const backfillDisplayOrder = asyncHandler(async (req, res) => {
  const user = req.user;

  if (!user) {
    throw new ApiError(401, "Unauthorized");
  }

  const parentIds = await Category.distinct("parentCategory");

  let updatedCount = 0;

  for (const parentId of parentIds) {
    const siblings = await Category.find({ parentCategory: parentId })
      .sort({ createdAt: 1 })
      .select("_id");

    if (siblings.length === 0) continue;

    await Category.reorderSiblings(
      parentId,
      siblings.map((c) => c._id.toString()),
    );

    updatedCount += siblings.length;
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { groupCount: parentIds.length, categoryCount: updatedCount },
        "Category displayOrder backfilled successfully",
      ),
    );
});

const getBrandsForCategory = asyncHandler(async (req, res) => {
  const user = req.user;

  if (!user) {
    throw new ApiError(401, "Unauthorized");
  }

  const { categoryId } = req.body;

  if (!categoryId) {
    throw new ApiError(400, "Category ID is required");
  }

  if (!mongoose.Types.ObjectId.isValid(categoryId)) {
    throw new ApiError(400, "Invalid category ID");
  }

  const brands = await Brand.find({
    categories: categoryId,
  });

  if (!brands) {
    throw new ApiError(400, "No brands associated with this category!");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, brands.length, "Brands retrieved successfully."),
    );
});

export {
  createCategory,
  getCategories,
  getParentCategories,
  getSubCategories,
  getCategoriesForStore,
  getCategoryById,
  updateCategory,
  reorderCategories,
  deleteCategory,
  backfillCategoryStatus,
  backfillDisplayOrder,
  getBrandsForCategory,
};
