import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Product } from "../models/products.models.js";
import { Brand } from "../models/brands.models.js";
import { Category } from "../models/categories.models.js";
import { Store } from "../models/store.models.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import mongoose from "mongoose";
import { UPDATABLE_FIELDS, ROLES } from "../constants.js";

// A product's `category` is usually a leaf/subcategory (e.g. "Mobile
// Accessories" under "Electronics"), but `store.categories` only ever
// holds top-level categories the store registered under. So "is this
// category allowed for this store" means "is the top-level ancestor of
// this category one the store registered under" — not a direct ID match.
const isCategoryAllowedForStore = async (categoryId, storeCategoryIds) => {
  const result = await Category.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(categoryId) } },
    {
      $graphLookup: {
        from: "categories",
        startWith: "$parentCategory",
        connectFromField: "parentCategory",
        connectToField: "_id",
        as: "ancestors",
      },
    },
  ]);

  if (!result.length) return false;

  const chainIds = [
    categoryId.toString(),
    ...result[0].ancestors.map((ancestor) => ancestor._id.toString()),
  ];

  const allowedIds = storeCategoryIds.map((id) => id.toString());

  return chainIds.some((id) => allowedIds.includes(id));
};

const createProduct = asyncHandler(async (req, res) => {
  const user = req.user;

  if (!user) {
    throw new ApiError(401, "Unauthorized");
  }

  const {
    title,
    description,
    slug,
    price,
    discountPrice,
    category,
    stock,
    brand,
    features,
    ratingsAverage,
    ratingsCount,
    isActive,
  } = req.body;

  if (
    !title ||
    !slug ||
    !description ||
    !price ||
    !discountPrice ||
    !brand ||
    !category ||
    !stock
  ) {
    throw new ApiError(
      400,
      "Title,slug,description,Price, discount price,brand, category and stock are required fields",
    );
  }

  if (!mongoose.Types.ObjectId.isValid(category)) {
    throw new ApiError(400, "Invalid category ID");
  }

  // ✅ Single-seller app: there's exactly one Store document (enforced at
  // the model level), so we look it up directly rather than by
  // `owner: user._id` — this route is already admin-only, and scoping by
  // the current admin's own ownership would incorrectly lock out any
  // other admin/staff account from adding products to the same store.
  const store = await Store.findOne({});

  if (!store) {
    throw new ApiError(400, "You must create a store before adding products");
  }

  // ✅ category must be one the store registered under (or a descendant of
  // one) — products can't be listed outside the categories the store was
  // approved for
  const isCategoryAllowed = await isCategoryAllowedForStore(
    category,
    store.categories,
  );

  if (!isCategoryAllowed) {
    throw new ApiError(
      400,
      "This category is not registered under your store. Update your store categories first.",
    );
  }

  // ✅ 1. Move duplicate check BEFORE new Product()
  // ✅ 2. Compare document fields, not the document itself

  const duplicate = await Product.findOne({ $or: [{ title }, { slug }] });

  if (duplicate) {
    const conflictField = duplicate.title === title ? "title" : "slug";
    throw new ApiError(
      409,
      `A product with this ${conflictField} already exists`,
    );
  }

  const newProduct = await Product.create({
    title,
    description,
    slug,
    price,
    discountPrice,
    category,
    stock,
    brand,
    store: store._id,
    storeName: store.storeName,
    features,
    ratingsAverage,
    ratingsCount,
    isActive,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, newProduct, "New product added successfully."));
});

const updateProduct = asyncHandler(async (req, res) => {
  const user = req.user;

  if (!user) {
    throw new ApiError(401, "Unauthorized");
  }

  const { productID } = req.params;

  if (!mongoose.Types.ObjectId.isValid(productID)) {
    throw new ApiError(400, "Invalid Product ID");
  }

  const product = await Product.findById(productID);

  if (!product) {
    throw new ApiError(404, "Product not found");
  }

  // ✅ Single store — this now just confirms the product actually belongs
  // to it (data-integrity check) rather than an ownership check tied to
  // whichever admin is logged in. Route-level authorizeRoles(ADMIN) is
  // what actually gates who can call this.
  const store = await Store.findOne({});

  if (!store || product.store.toString() !== store._id.toString()) {
    throw new ApiError(403, "You are not authorized to update this product");
  }

  // ✅ Only pick allowed, present fields — images/features are excluded
  // entirely and must go through addImagestoProduct / updateFeatures
  const updates = {};
  for (const field of UPDATABLE_FIELDS) {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    throw new ApiError(400, "No valid fields provided to update");
  }

  if (updates.category) {
    if (!mongoose.Types.ObjectId.isValid(updates.category)) {
      throw new ApiError(400, "Invalid category ID");
    }

    // Same rule as createProduct — category (or one of its ancestors) must
    // be one the store registered under
    const isCategoryAllowed = await isCategoryAllowedForStore(
      updates.category,
      store.categories,
    );

    if (!isCategoryAllowed) {
      throw new ApiError(
        400,
        "This category is not registered under your store. Update your store categories first.",
      );
    }
  }

  // ✅ Duplicate check on title/slug, excluding this product itself
  if (updates.title || updates.slug) {
    const duplicate = await Product.findOne({
      _id: { $ne: product._id },
      $or: [
        ...(updates.title ? [{ title: updates.title }] : []),
        ...(updates.slug ? [{ slug: updates.slug }] : []),
      ],
    });

    if (duplicate) {
      const conflictField =
        duplicate.title === updates.title ? "title" : "slug";
      throw new ApiError(
        409,
        `A product with this ${conflictField} already exists`,
      );
    }
  }

  const updatedProduct = await Product.findByIdAndUpdate(
    productID,
    { $set: updates },
    { new: true },
  );

  return res
    .status(200)
    .json(new ApiResponse(200, updatedProduct, "Product updated successfully"));
});

const addImagestoProduct = asyncHandler(async (req, res) => {
  const user = req.user;

  if (!user) {
    throw new ApiError(401, "Unauthorized");
  }

  const productId = req.body?.productId;

  if (!mongoose.Types.ObjectId.isValid(productId)) {
    throw new ApiError(400, "Product ID invalid");
  }

  const product = await Product.findById(productId);

  if (!product) {
    throw new ApiError(404, "Product not found");
  }

  let existingImages = req.body.existingImages || [];

  // Handle case when only one image is sent
  if (!Array.isArray(existingImages)) {
    existingImages = [existingImages];
  }

  // Upload new images
  let uploadedImageUrls = [];

  if (req.files?.length > 0) {
    const uploadedImages = await Promise.all(
      req.files.map((file) => uploadOnCloudinary(file.path)),
    );

    uploadedImageUrls = uploadedImages.map((image) => {
      if (!image?.url) {
        throw new ApiError(400, "Error uploading image");
      }

      return image.url;
    });
  }

  const finalImages = [...existingImages, ...uploadedImageUrls];

  // Validation
  if (finalImages.length < 3) {
    throw new ApiError(400, "A product must contain at least 3 images");
  }

  if (finalImages.length > 5) {
    throw new ApiError(400, "A product can contain at most 5 images");
  }

  product.images = finalImages;

  await product.save();

  return res
    .status(200)
    .json(new ApiResponse(200, product, "Product images updated successfully"));
});

const getProductById = asyncHandler(async (req, res) => {
  const user = req.user;

  if (!user) {
    throw new ApiError(401, "Unauthorized");
  }

  const { productID } = req.params;

  if (!mongoose.Types.ObjectId.isValid(productID)) {
    throw new ApiError(400, "Product ID invalid");
  }

  // ✅ Internal-staff vs buyer split: admin AND employee manage inventory
  // and need to see everything, including inactive products. Buyers
  // should only ever be able to fetch active products. Ratings are no
  // longer stripped from the response — hiding ratingsAverage/
  // ratingsCount made no sense on a product page buyers are trying to
  // make a purchase decision from.
  const query = { _id: productID };
  if (![ROLES.ADMIN, ROLES.EMPLOYEE].includes(user.role)) {
    query.isActive = true;
  }

  const product = await Product.findOne(query);

  if (!product) {
    throw new ApiError(404, "Product not Found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, product, "Product fetched successfully"));
});

const getProductsByBrand = asyncHandler(async (req, res) => {
  const user = req.user;

  if (!user) {
    throw new ApiError(401, "Unauthorized");
  }

  const { brandId } = req.body;

  if (!mongoose.Types.ObjectId.isValid(brandId)) {
    throw new ApiError(400, "Brand ID invalid");
  }

  // ✅ Same internal-staff/buyer split as getProductById — buyers browsing
  // by brand should never see inactive products; admin and employee both
  // need the full view for inventory work.
  const query = { brand: brandId };
  if (![ROLES.ADMIN, ROLES.EMPLOYEE].includes(user.role)) {
    query.isActive = true;
  }

  const products = await Product.find(query);

  if (products.length === 0) {
    throw new ApiError(404, "Products not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, products, "Products fetched successfully"));
});

const getMyStoreProducts = asyncHandler(async (req, res) => {
  const user = req.user;

  if (!user) {
    throw new ApiError(401, "Unauthorized");
  }

  // ✅ Single store — this is the admin's full inventory view (route is
  // already ADMIN-only), so it intentionally returns everything including
  // inactive products, unlike the buyer-facing endpoints above.
  const store = await Store.findOne({});

  if (!store) {
    throw new ApiError(404, "Store not found");
  }

  const products = await Product.find({ store: store._id })
    .populate("category", "name slug")
    .populate("brand", "name logo");

  if (products.length === 0) {
    throw new ApiError(404, "No product found in your store");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        products,
        "Your store's products fetched successfully",
      ),
    );
});

const getAllProducts = asyncHandler(async (req, res) => {
  const user = req.user;

  if (!user) {
    throw new ApiError(401, "Unauthorized");
  }

  // ✅ This is the customer-facing "browse everything" endpoint (no role
  // restriction on the route), so it must only ever return active
  // products to buyers. Admin and employee both get the full catalog
  // here too, same as getMyStoreProducts, since both manage inventory.
  const query = [ROLES.ADMIN, ROLES.EMPLOYEE].includes(user.role)
    ? {}
    : { isActive: true };

  const products = await Product.find(query);

  if (products.length === 0) {
    throw new ApiError(404, "Products not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, products, "All Products fetched successfully"));
});

const deleteProduct = asyncHandler(async (req, res) => {
  const user = req.user;

  if (!user) {
    throw new ApiError(401, "Unauthorized");
  }

  const { productID } = req.params;

  if (!mongoose.Types.ObjectId.isValid(productID)) {
    throw new ApiError(400, "Invalid Product ID");
  }

  const product = await Product.findByIdAndDelete(productID);

  if (!product) {
    throw new ApiError(404, "Product not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, null, "Product deleted successfully"));
});

const updateFeatures = asyncHandler(async (req, res) => {
  const user = req.user;

  if (!user) {
    throw new ApiError(401, "Unauthorized");
  }

  const { productId, featuresArray } = req.body;

  if (!mongoose.Types.ObjectId.isValid(productId)) {
    throw new ApiError(400, "Invalid product ID");
  }

  const product = await Product.findByIdAndUpdate(
    productId,
    {
      $set: {
        features: [],
      },
    },
    { new: true },
  );

  if (!featuresArray) {
    return res
      .status(200)
      .json(
        new ApiResponse(200, product, "Product features deleted successfully"),
      );
  }

  const updatedProduct = await Product.findByIdAndUpdate(
    productId,
    {
      $set: {
        features: featuresArray,
      },
    },
    {
      new: true,
    },
  );

  return res
    .status(200)
    .json(new ApiResponse(200, updatedProduct, "Features added successfully"));
});

const getProductsByCategory = asyncHandler(async (req, res) => {
  const user = req.user;

  if (!user) {
    throw new ApiError(401, "Unauthorized");
  }

  const { categoryId } = req.body;

  if (!mongoose.Types.ObjectId.isValid(categoryId)) {
    throw new ApiError(400, "Invalid category ID");
  }

  // Find category and all descendants
  const categories = await Category.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(categoryId),
      },
    },
    {
      $graphLookup: {
        from: "categories",
        startWith: "$_id",
        connectFromField: "_id",
        connectToField: "parentCategory",
        as: "descendants",
      },
    },
    {
      $project: {
        allCategoryIds: {
          $concatArrays: [["$_id"], "$descendants._id"],
        },
      },
    },
  ]);

  if (!categories.length) {
    throw new ApiError(404, "Category not found");
  }

  const categoryIds = categories[0].allCategoryIds;

  // Already buyer-safe — filters isActive: true regardless of role. Left
  // as-is; admins needing an inactive-inclusive category view can use
  // getMyStoreProducts + a client-side filter, or this can grow the same
  // role check as the other read endpoints if that's ever needed.
  const products = await Product.find({
    category: {
      $in: categoryIds,
    },
    isActive: true,
  })
    .populate("category", "name slug")
    .populate("brand", "name logo");

  return res
    .status(200)
    .json(new ApiResponse(200, products, "Products retrieved successfully"));
});

const addProductstoBrand = asyncHandler(async (req, res) => {
  const user = req.user;

  if (!user) {
    throw new ApiError(401, "Unauthorized");
  }

  const { brandId, products } = req.body;

  if (!mongoose.Types.ObjectId.isValid(brandId)) {
    throw new ApiError(400, "Invalid Brand ID");
  }

  if (!products || !Array.isArray(products) || products.length === 0) {
    throw new ApiError(400, "Products array is required");
  }

  if (products.length > 10) {
    throw new ApiError(400, "Maximum 10 products can be added at once");
  }

  // ✅ Fix: this bulk-insert path never set `store`/`storeName`, which
  // now fails Product's required-field validation. Every product belongs
  // to the single store, same as createProduct.
  const store = await Store.findOne({});

  if (!store) {
    throw new ApiError(400, "You must create a store before adding products");
  }

  const productsToInsert = products.map((product) => ({
    ...product,
    brand: brandId,
    store: store._id,
    storeName: store.storeName,
  }));

  const createdProducts = await Product.insertMany(productsToInsert);

  return res
    .status(201)
    .json(
      new ApiResponse(201, createdProducts, "Products created successfully"),
    );
});

export {
  createProduct,
  getProductById,
  updateProduct,
  addImagestoProduct,
  getProductsByBrand,
  getAllProducts,
  deleteProduct,
  updateFeatures,
  getProductsByCategory,
  addProductstoBrand,
  getMyStoreProducts,
};
