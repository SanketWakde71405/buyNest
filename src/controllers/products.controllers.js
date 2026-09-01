import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Product } from "../models/products.models.js";
import { Brand } from "../models/brands.models.js";
import { Category } from "../models/categories.models.js";
import { Store } from "../models/store.models.js";
import { slugifyForFolder } from "../utils/slugify.js";
import {
  uploadOnCloudinary,
  deleteFromCloudinary,
  extractPublicIdFromUrl,
} from "../utils/cloudinary.js";
import mongoose from "mongoose";

const MIN_IMAGES = 3;
const MAX_IMAGES = 5;

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
    costPrice,
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
    !stock ||
    !Array.isArray(category) ||
    category.length === 0
  ) {
    throw new ApiError(
      400,
      "Title, slug, description, price, discount price, brand, stock and at least one category are required fields",
    );
  }

  if (!mongoose.Types.ObjectId.isValid(brand)) {
    throw new ApiError(400, "Brand ID invalid");
  }

  const brandExists = await Brand.findById(brand);
  if (!brandExists) {
    throw new ApiError(404, `Brand with ID ${brand} not found`);
  }

  const duplicate = await Product.findOne({ $or: [{ title }, { slug }] });

  if (duplicate) {
    const conflictField = duplicate.title === title ? "title" : "slug";
    throw new ApiError(
      409,
      `A product with this ${conflictField} already exists`,
    );
  }

  const store = await Store.findOne({ owner: user._id });
  if (!store) {
    throw new ApiError(404, "Store not found for this user");
  }

  // isActive/stock/image gating is handled by the Product model's
  // pre("save") hook — no extra logic needed here.
  const newProduct = await Product.create({
    title,
    description,
    slug,
    price,
    discountPrice,
    ...(costPrice !== undefined && { costPrice }),
    category,
    stock,
    brand,
    features,
    ratingsAverage,
    ratingsCount,
    isActive,
  });

  // Keep the store's running product count in sync. Best-effort — a
  // failed counter update shouldn't roll back an otherwise-successful
  // product creation.
  await Store.updateOne({ _id: store._id }, { $inc: { totalProducts: 1 } });

  return res
    .status(201)
    .json(new ApiResponse(201, newProduct, "New product added successfully."));
});

// Appends newly uploaded images to a product. Existing images are left
// untouched — this endpoint only adds, bounded by MAX_IMAGES. Removal is
// a separate, explicit action (deleteProductImage / deleteAllProductImages
// below), so the client never has to resend the images it wants to keep.
const addProductImages = asyncHandler(async (req, res) => {
  const user = req.user;

  if (!user) {
    throw new ApiError(401, "Unauthorized");
  }

  const productId = req.body?.productId;

  if (!mongoose.Types.ObjectId.isValid(productId)) {
    throw new ApiError(400, "Product ID invalid");
  }

  if (!req.files?.length) {
    throw new ApiError(400, "At least one image file is required");
  }

  const [product, store] = await Promise.all([
    Product.findById(productId)
      .populate("brand", "name")
      .populate("category", "name"),
    Store.findOne({ owner: user?._id }),
  ]);

  if (!product) {
    throw new ApiError(404, "Product not found");
  }

  if (!store) {
    throw new ApiError(404, "Store not found for this user");
  }

  const currentCount = product.images?.length || 0;
  const remainingSlots = MAX_IMAGES - currentCount;

  if (remainingSlots <= 0) {
    throw new ApiError(
      400,
      `Product already has the maximum of ${MAX_IMAGES} images`,
    );
  }

  if (req.files.length > remainingSlots) {
    throw new ApiError(
      400,
      `Only ${remainingSlots} more image(s) can be added — a product can contain at most ${MAX_IMAGES} images`,
    );
  }

  const categoryName = product.category?.[0]?.name || "uncategorized";
  const brandName = product.brand?.name || "unbranded";

  const folder = [
    store.storeName,
    categoryName,
    brandName,
    product._id.toString(),
  ]
    .map(slugifyForFolder)
    .join("/");

  const uploadedImages = await Promise.all(
    req.files.map((file) => uploadOnCloudinary(file.path, { folder })),
  );

  const newImageUrls = uploadedImages.map((image) => {
    if (!image?.url) {
      throw new ApiError(400, "Error uploading image");
    }
    return image.url;
  });

  product.images.push(...newImageUrls);
  await product.save();

  return res
    .status(200)
    .json(new ApiResponse(200, product, "Images added successfully"));
});

const deleteProductImage = asyncHandler(async (req, res) => {
  const user = req.user;

  if (!user) {
    throw new ApiError(401, "Unauthorized");
  }

  const { productId, imageUrl } = req.body;

  if (!mongoose.Types.ObjectId.isValid(productId)) {
    throw new ApiError(400, "Product ID invalid");
  }

  if (!imageUrl) {
    throw new ApiError(400, "Image URL is required");
  }

  const product = await Product.findById(productId);

  if (!product) {
    throw new ApiError(404, "Product not found");
  }

  if (!product.images.includes(imageUrl)) {
    throw new ApiError(404, "Image not found on this product");
  }

  const publicId = extractPublicIdFromUrl(imageUrl);
  if (publicId) {
    await deleteFromCloudinary(publicId);
  }

  product.images = product.images.filter((url) => url !== imageUrl);
  await product.save();

  return res
    .status(200)
    .json(new ApiResponse(200, product, "Image removed successfully"));
});

const deleteAllProductImages = asyncHandler(async (req, res) => {
  const user = req.user;

  if (!user) {
    throw new ApiError(401, "Unauthorized");
  }

  const { productId } = req.body;

  if (!mongoose.Types.ObjectId.isValid(productId)) {
    throw new ApiError(400, "Product ID invalid");
  }

  const product = await Product.findById(productId);

  if (!product) {
    throw new ApiError(404, "Product not found");
  }

  if (product.images?.length) {
    await Promise.all(
      product.images.map((url) => {
        const publicId = extractPublicIdFromUrl(url);
        return publicId ? deleteFromCloudinary(publicId) : null;
      }),
    );
  }

  product.images = [];
  await product.save();

  return res
    .status(200)
    .json(new ApiResponse(200, product, "All images removed successfully"));
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

  const product = await Product.findById(productID);

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

  const products = await Product.find({ brand: brandId }).select(
    "-ratingsAverage -ratingsCount -isActive",
  );

  if (products.length === 0) {
    throw new ApiError(404, "Products not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, products, "Products fetched successfully"));
});

const getAllProducts = asyncHandler(async (req, res) => {
  const user = req.user;

  if (!user) {
    throw new ApiError(401, "Unauthorized");
  }

  // stockStatus and profit are schema virtuals (toJSON: { virtuals: true }),
  // so they're included automatically here — no extra selection needed.
  const products = await Product.find();

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

  const product = await Product.findById(productID);

  if (!product) {
    throw new ApiError(404, "Product not found");
  }

  if (product.images?.length) {
    await Promise.all(
      product.images.map((url) => {
        const publicId = extractPublicIdFromUrl(url);
        return publicId ? deleteFromCloudinary(publicId) : null;
      }),
    );
  }

  await Product.findByIdAndDelete(productID);

  // Best-effort — don't block a successful delete on the counter update.
  const store = await Store.findOne({ owner: user._id });
  if (store) {
    await Store.updateOne({ _id: store._id }, { $inc: { totalProducts: -1 } });
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
  ).select("-ratingsAverage -ratingsCount -isActive");

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
  ).select("-ratingsAverage -ratingsCount -isActive");

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

  const categories = await Category.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(categoryId) } },
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
        allCategoryIds: { $concatArrays: [["$_id"], "$descendants._id"] },
      },
    },
  ]);

  if (!categories.length) {
    throw new ApiError(404, "Category not found");
  }

  const categoryIds = categories[0].allCategoryIds;

  // Customer-facing query — exclude costPrice, it's vendor-internal.
  // isActive: true already excludes out-of-stock/too-few-image products,
  // since the model gate forces isActive false in both cases.
  const products = await Product.find({
    category: { $in: categoryIds },
    isActive: true,
  })
    .select("-costPrice")
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

  // insertMany bypasses pre("save") middleware entirely, so the model's
  // isActive gate never runs for these documents. Stock is guaranteed
  // fine at this call site, so the only gap left is image count — if a
  // caller passes isActive: true (or leaves it defaulting to true) with
  // fewer than MIN_IMAGES images, it would otherwise go live ungated.
  // Re-apply that one check manually before inserting.
  const productsToInsert = products.map((product) => {
    const imageCount = Array.isArray(product.images)
      ? product.images.length
      : 0;
    const tooFewImages = imageCount < MIN_IMAGES;

    return {
      ...product,
      brand: brandId,
      isActive: product.isActive === false ? false : !tooFewImages,
    };
  });

  const createdProducts = await Product.insertMany(productsToInsert);

  const store = await Store.findOne({ owner: user._id });
  if (store) {
    await Store.updateOne(
      { _id: store._id },
      { $inc: { totalProducts: createdProducts.length } },
    );
  }

  return res
    .status(201)
    .json(
      new ApiResponse(201, createdProducts, "Products created successfully"),
    );
});

// Category is an array, so "edit" and "delete" are really the same
// operation from the model's point of view: the client always sends the
// complete desired list of category ids (same convention createProduct
// and updateProduct already use for `category`). Editing means sending a
// different set; deleting a category off a product means sending the
// current list with that one id left out. Either way, the one rule that
// has to hold is the schema's own: a product can never end up with zero
// categories.
const updateProductCategories = asyncHandler(async (req, res) => {
  const user = req.user;
  if (!user) {
    throw new ApiError(401, "Unauthorized");
  }

  const { productId, categoryIds } = req.body;

  if (!mongoose.Types.ObjectId.isValid(productId)) {
    throw new ApiError(400, "Invalid product ID");
  }

  if (!Array.isArray(categoryIds) || categoryIds.length === 0) {
    throw new ApiError(
      400,
      "At least one category is required — a product can't be left with zero categories",
    );
  }

  const invalidId = categoryIds.find(
    (id) => !mongoose.Types.ObjectId.isValid(id),
  );
  if (invalidId) {
    throw new ApiError(400, `Invalid category ID: ${invalidId}`);
  }

  // De-dupe in case the client sends the same id twice.
  const uniqueCategoryIds = [...new Set(categoryIds)];

  const foundCategories = await Category.find({
    _id: { $in: uniqueCategoryIds },
  }).select("_id");

  if (foundCategories.length !== uniqueCategoryIds.length) {
    const foundIds = new Set(foundCategories.map((c) => c._id.toString()));
    const missing = uniqueCategoryIds.filter((id) => !foundIds.has(id));
    throw new ApiError(404, `Category not found: ${missing.join(", ")}`);
  }

  const updatedProduct = await Product.findByIdAndUpdate(
    productId,
    { $set: { category: uniqueCategoryIds } },
    { new: true, runValidators: true },
  )
    .populate("category", "name")
    .select("-ratingsAverage -ratingsCount -isActive");

  if (!updatedProduct) {
    throw new ApiError(404, "Product not found");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        updatedProduct,
        "Product categories updated successfully",
      ),
    );
});

// Brand is singular and required on the schema — there's no "delete the
// brand" state a product can be left in, only "replace it with a
// different one". A request that tries to clear it (no brandId, or a
// falsy one) is rejected rather than silently nulling the field out, so
// "edit" and "delete" both go through this same replace operation: to
// delete brand A off a product, the caller sends brand B instead.
const updateProductBrand = asyncHandler(async (req, res) => {
  const user = req.user;
  if (!user) {
    throw new ApiError(401, "Unauthorized");
  }

  const { productId, brandId } = req.body;

  if (!mongoose.Types.ObjectId.isValid(productId)) {
    throw new ApiError(400, "Invalid product ID");
  }

  if (!brandId) {
    throw new ApiError(
      400,
      "A product must have a brand — provide a new brand ID to replace the current one instead of removing it",
    );
  }

  if (!mongoose.Types.ObjectId.isValid(brandId)) {
    throw new ApiError(400, "Invalid brand ID");
  }

  const brandExists = await Brand.findById(brandId).select("_id");
  if (!brandExists) {
    throw new ApiError(404, `Brand with ID ${brandId} not found`);
  }

  const updatedProduct = await Product.findByIdAndUpdate(
    productId,
    { $set: { brand: brandId } },
    { new: true, runValidators: true },
  )
    .populate("brand", "name")
    .select("-ratingsAverage -ratingsCount -isActive");

  if (!updatedProduct) {
    throw new ApiError(404, "Product not found");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        updatedProduct,
        "Product brand updated successfully",
      ),
    );
});

const updateProduct = asyncHandler(async (req, res) => {
  const user = req.user;
  if (!user) {
    throw new ApiError(401, "Unauthorized access");
  }

  const {
    productId,
    title,
    description,
    slug,
    price,
    discountPrice,
    costPrice,
    stock,
    isActive,
  } = req.body;

  if (!productId) throw new ApiError(400, "Product ID is required");
  if (!title) throw new ApiError(400, "Product title is required");
  if (!slug) throw new ApiError(400, "Product slug is required");

  const duplicate = await Product.findOne({ $or: [{ title }, { slug }] });

  // Fixed: was `duplicate?._id...` which threw on every update even with
  // no conflict, since optional chaining on a null match made the
  // comparison always true.
  if (duplicate && duplicate._id.toString() !== productId) {
    throw new ApiError(
      409,
      "Another product with this title or slug already exists.",
    );
  }

  // isActive/stock/image gating (including the out-of-stock -> isActive
  // false rule) is re-applied inside the model's pre("findOneAndUpdate")
  // hook, since findByIdAndUpdate bypasses document middleware.
  const updatedProduct = await Product.findByIdAndUpdate(
    productId,
    {
      $set: {
        title,
        description,
        slug,
        price,
        discountPrice,
        ...(costPrice !== undefined && { costPrice }),
        stock,
        ...(isActive !== undefined && { isActive }),
      },
    },
    { new: true, runValidators: true },
  );

  if (!updatedProduct) {
    throw new ApiError(404, "Updating product failed");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, updatedProduct, "Product updated successfully"));
});

export {
  createProduct,
  getProductById,
  addProductImages,
  deleteProductImage,
  deleteAllProductImages,
  getProductsByBrand,
  getAllProducts,
  deleteProduct,
  updateFeatures,
  getProductsByCategory,
  addProductstoBrand,
  updateProduct,
  updateProductCategories,
  updateProductBrand,
};
