import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Product } from "../models/products.models.js";
import { Brand } from "../models/brands.models.js";
import { Supplier } from "../models/supplier.models.js";
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

// Fields of a linked supplier that the UI needs to render the supplier
// rows on a product (name + enough contact info for a tooltip).
const SUPPLIER_POPULATE = {
  path: "suppliers.supplier",
  select: "supplierName contactPerson contactDetails",
};

const isBlank = (v) => v === undefined || v === null || v === "";

// Validates and cleans a `suppliers` payload ([{ supplier, costPrice,
// leadTimeDays?, minOrderQty?, isPrimary? }]) and returns the array ready
// to store. findOneAndUpdate / insertMany skip the model's pre("save")
// guard, so the same rules (no duplicates, exactly one primary) are
// enforced here — with proper 400s instead of a generic 500.
const normalizeSuppliers = async (suppliers) => {
  if (!Array.isArray(suppliers)) {
    throw new ApiError(400, "Suppliers must be an array");
  }

  const seen = new Set();

  const cleaned = suppliers.map((entry, index) => {
    const row = `Supplier #${index + 1}`;

    // Accept either an id or a populated { _id } object, so the client can
    // send back exactly what a GET returned.
    const rawId =
      entry?.supplier && typeof entry.supplier === "object"
        ? entry.supplier._id
        : entry?.supplier;

    if (!mongoose.Types.ObjectId.isValid(rawId)) {
      throw new ApiError(400, `${row}: supplier ID invalid`);
    }

    const supplierId = String(rawId);
    if (seen.has(supplierId)) {
      throw new ApiError(400, "A product cannot list the same supplier twice");
    }
    seen.add(supplierId);

    if (isBlank(entry.costPrice) || isNaN(Number(entry.costPrice))) {
      throw new ApiError(400, `${row}: cost price is required`);
    }
    const costPrice = Number(entry.costPrice);
    if (costPrice < 0) {
      throw new ApiError(400, `${row}: cost price cannot be negative`);
    }

    const result = { supplier: supplierId, costPrice };

    if (!isBlank(entry.leadTimeDays)) {
      const leadTimeDays = Number(entry.leadTimeDays);
      if (isNaN(leadTimeDays) || leadTimeDays < 0) {
        throw new ApiError(400, `${row}: lead time must be 0 or more days`);
      }
      result.leadTimeDays = leadTimeDays;
    }

    if (!isBlank(entry.minOrderQty)) {
      const minOrderQty = Number(entry.minOrderQty);
      if (isNaN(minOrderQty) || minOrderQty < 1) {
        throw new ApiError(
          400,
          `${row}: minimum order quantity must be at least 1`,
        );
      }
      result.minOrderQty = minOrderQty;
    }

    result.isPrimary = entry.isPrimary === true;
    return result;
  });

  if (cleaned.length > 0) {
    const primaryCount = cleaned.filter((s) => s.isPrimary).length;
    if (primaryCount > 1) {
      throw new ApiError(400, "Only one supplier can be marked as primary");
    }
    // Same rule as the model: no explicit primary -> the first one is it.
    if (primaryCount === 0) cleaned[0].isPrimary = true;

    const found = await Supplier.find({ _id: { $in: [...seen] } }).select(
      "_id",
    );
    if (found.length !== seen.size) {
      const foundIds = new Set(found.map((s) => s._id.toString()));
      const missing = [...seen].filter((id) => !foundIds.has(id));
      throw new ApiError(404, `Supplier not found: ${missing.join(", ")}`);
    }
  }

  return cleaned;
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
    suppliers,
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

  // costPrice is no longer a stored field — it's a virtual derived from the
  // primary supplier. Cost now arrives per supplier inside `suppliers`.
  const normalizedSuppliers =
    suppliers !== undefined ? await normalizeSuppliers(suppliers) : [];

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
    suppliers: normalizedSuppliers,
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

  // Recompute status for every category this product was assigned to (and,
  // per Category.syncStatus, their ancestors too).
  await Category.syncStatus(newProduct.category);

  await newProduct.populate(SUPPLIER_POPULATE);

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
    // No populate here — category/brand must stay raw ObjectIds. product.save()
    // below fires a post("save") hook that passes doc.category straight into
    // Category.syncStatus; populating this field would hand it full documents
    // instead of ids.
    Product.findById(productId),
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

  // Fetched separately (and .lean()) purely for the Cloudinary folder name —
  // this must NOT touch product.category / product.brand themselves.
  const [categoryDoc, brandDoc] = await Promise.all([
    product.category?.[0]
      ? Category.findById(product.category[0]).select("name").lean()
      : null,
    Brand.findById(product.brand).select("name").lean(),
  ]);

  const categoryName = categoryDoc?.name || "uncategorized";
  const brandName = brandDoc?.name || "unbranded";

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

  // Populate only after save() — the save hooks need raw ids.
  await product.populate(SUPPLIER_POPULATE);

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
  await product.populate(SUPPLIER_POPULATE);

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
  await product.populate(SUPPLIER_POPULATE);

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

  const product = await Product.findById(productID).populate(SUPPLIER_POPULATE);

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

  const products = await Product.find({ brand: brandId })
    .select("-ratingsAverage -ratingsCount -isActive")
    .populate(SUPPLIER_POPULATE);

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
  const products = await Product.find().populate(SUPPLIER_POPULATE);

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

  // The product's category link is gone now — resync status for every
  // category it used to belong to (findByIdAndDelete skips save hooks).
  await Category.syncStatus(product.category);

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

  const { categoryId } = req.params;

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

  const products = await Product.find({
    category: { $in: categoryIds },
  })
    .populate("category", "name slug")
    .populate("brand", "name logo")
    .populate(SUPPLIER_POPULATE);

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

  // insertMany skips pre("save"), so each product's suppliers are validated
  // and normalized here. Any legacy top-level costPrice is dropped.
  const productsToInsert = await Promise.all(
    products.map(async ({ costPrice, suppliers, ...product }) => {
      const imageCount = Array.isArray(product.images)
        ? product.images.length
        : 0;
      const tooFewImages = imageCount < MIN_IMAGES;

      return {
        ...product,
        suppliers:
          suppliers !== undefined ? await normalizeSuppliers(suppliers) : [],
        brand: brandId,
        isActive: product.isActive === false ? false : !tooFewImages,
      };
    }),
  );

  const createdProducts = await Product.insertMany(productsToInsert);

  const store = await Store.findOne({ owner: user._id });
  if (store) {
    await Store.updateOne(
      { _id: store._id },
      { $inc: { totalProducts: createdProducts.length } },
    );
  }

  // insertMany also bypasses post("save"), so category status isn't synced
  // automatically the way createProduct's Product.create() gets it — do it
  // explicitly here for every category referenced by the inserted products.
  const insertedCategoryIds = createdProducts.flatMap((p) => p.category);
  await Category.syncStatus(insertedCategoryIds);

  return res
    .status(201)
    .json(
      new ApiResponse(201, createdProducts, "Products created successfully"),
    );
});

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

  const existingProduct = await Product.findById(productId).select("category");

  if (!existingProduct) {
    throw new ApiError(404, "Product not found");
  }

  const previousCategoryIds = (existingProduct.category || []).map((id) =>
    id.toString(),
  );

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

  // Resync status for every category on either side of this change — ones
  // the product left may have just lost their last product, and ones it
  // joined may have just gained their first.
  await Category.syncStatus([
    ...new Set([...previousCategoryIds, ...uniqueCategoryIds]),
  ]);

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
    stock,
    isActive,
  } = req.body;

  // Cost is managed per supplier via updateProductSuppliers — a top-level
  // costPrice in the payload is intentionally ignored.
  if (!productId) throw new ApiError(400, "Product ID is required");
  if (!title) throw new ApiError(400, "Product title is required");
  if (!slug) throw new ApiError(400, "Product slug is required");

  const duplicate = await Product.findOne({ $or: [{ title }, { slug }] });

  if (duplicate && duplicate._id.toString() !== productId) {
    throw new ApiError(
      409,
      "Another product with this title or slug already exists.",
    );
  }

  const updatedProduct = await Product.findByIdAndUpdate(
    productId,
    {
      $set: {
        title,
        description,
        slug,
        price,
        discountPrice,
        stock,
        ...(isActive !== undefined && { isActive }),
      },
    },
    { new: true, runValidators: true },
  ).populate(SUPPLIER_POPULATE);

  if (!updatedProduct) {
    throw new ApiError(404, "Updating product failed");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, updatedProduct, "Product updated successfully"));
});

// Replaces the product's whole supplier list in one call (an empty array
// unlinks every supplier). The edit form sends its full list on save, the
// same way updateFeatures / updateProductCategories work, so there's no
// separate add/remove/set-primary endpoint to keep in sync.
const updateProductSuppliers = asyncHandler(async (req, res) => {
  const user = req.user;
  if (!user) {
    throw new ApiError(401, "Unauthorized");
  }

  const { productId, suppliers } = req.body;

  if (!mongoose.Types.ObjectId.isValid(productId)) {
    throw new ApiError(400, "Invalid product ID");
  }

  if (suppliers === undefined) {
    throw new ApiError(400, "Suppliers array is required");
  }

  const normalizedSuppliers = await normalizeSuppliers(suppliers);

  const updatedProduct = await Product.findByIdAndUpdate(
    productId,
    { $set: { suppliers: normalizedSuppliers } },
    { new: true, runValidators: true },
  )
    .populate(SUPPLIER_POPULATE)
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
        "Product suppliers updated successfully",
      ),
    );
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
  updateProductSuppliers,
};
