import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Product } from "../models/products.models.js";
import { Brand } from "../models/brands.models.js";
import { Category } from "../models/categories.models.js";
import { Store } from "../models/store.models.js";
import { slugifyForFolder } from "../utils/slugify.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import mongoose from "mongoose";

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

  const invalidBrandId= !mongoose.Types.ObjectId.isValid(brand);

  if(invalidBrandId){
     throw new ApiError(500, "Invalid brand ID. Check whether the brand exists or try contacting developer.");
  }

  const product = new Product({
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
  });

  const newProduct = await Product.create(product);

  return res
    .status(201)
    .json(new ApiResponse(201, newProduct, "New product added successfully."));
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

  let existingImages = req.body.existingImages || [];
  if (!Array.isArray(existingImages)) {
    existingImages = [existingImages];
  }

  let uploadedImageUrls = [];

  if (req.files?.length > 0) {
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

    uploadedImageUrls = uploadedImages.map((image) => {
      if (!image?.url) {
        throw new ApiError(400, "Error uploading image");
      }
      return image.url;
    });
  }

  const finalImages = [...existingImages, ...uploadedImageUrls];

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

  const product = await Product.findById(productID).select(
    "-ratingsAverage -ratingsCount -isActive",
  );

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

  const productsToInsert = products.map((product) => ({
    ...product,
    brand: brandId,
  }));

  const createdProducts = await Product.insertMany(productsToInsert);

  return res
    .status(201)
    .json(
      new ApiResponse(201, createdProducts, "Products created successfully"),
    );
});

const updateProduct = asyncHandler(async (req, res) => {
  const user = req.user;
  if (!user) {
    throw new ApiError(401, "Unauthorized access");
  }

  const { productId, title, description, slug, price, discountPrice, stock } =
    req.body;

  if (!productId) {
    throw new ApiError(400, "Product ID is required");
  }
  if (!title) {
    throw new ApiError(400, "Product title is required");
  }
  if (!slug) {
    throw new ApiError(400, "Product slug is required");
  }

  const duplicate = await Product.findOne({ $or: [{ title }, { slug }] });

  if (duplicate?._id.toString() !== productId) {
    throw new ApiError(
      500,
      "Another product with this title or slug already exists.",
    );
  }

  const updatedProduct = await Product.findByIdAndUpdate(
    productId,
    {
      title,
      description,
      slug,
      price,
      discountPrice,
      stock,
    },
    { new: true },
  );

  if (!updatedProduct) {
    throw new ApiError(404, "Updating product failed");
  }

  return res
    .status(201)
    .json(new ApiResponse(200, updatedProduct, "Product updated successfully"));
});

export {
  createProduct,
  getProductById,
  addImagestoProduct,
  getProductsByBrand,
  getAllProducts,
  deleteProduct,
  updateFeatures,
  getProductsByCategory,
  addProductstoBrand,
  updateProduct
};
