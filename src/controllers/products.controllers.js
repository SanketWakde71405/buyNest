import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Product } from "../models/products.models.js";
import { Brand } from "../models/brands.models.js";
import { Category } from "../models/categories.models.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

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

  const duplicate = await Product.findOne({ $or: [{ title }, { slug }] });

  if (duplicate) {
    const conflictField = duplicate.name === name ? "name" : "slug";
    throw new ApiError(
      409,
      `A product with this ${conflictField} already exists
          }`,
    );
  }

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

  if (!productID) {
    throw new ApiError(404, "Product ID is required");
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

  if (!brandId) {
    return new ApiError(404, "Brand ID required");
  }

  const products = await Product.find({ brand: brandId }).select(
    "-ratingsAverage -ratingsCount -isActive",
  );

  if (!products) {
    throw new ApiError(404, "Products not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, products, "Products fetched successfully"));
});

const getAllProducts = asyncHandler(async(req,res)=>{
     const user = req.user;

     if(!user){
       throw new ApiError(401,"Unauthorized");
     }

     const products = await Product.find();

     if(!products){
      throw new ApiError(404,"Products not found");
     }

     return res.
     status(200).
     json(new ApiResponse(200,products,"All Products fetched successfully"));

});

const deleteProduct= asyncHandler(async(req,res)=>{
     const user = req.user;

     if(!user){
       throw new ApiError(401,"Unauthorized");
     }

     const {productID}= req.params;

     if(!productID){
       throw new ApiError(404,"Product ID not found");
     }

     const product = await Product.findByIdAndDelete(productID);

     if(!product){
       throw new ApiError(404,"Product not found");
     }

     return res.
     status(200).
     json(new ApiResponse(200,null,"Product deleted successfully"));

});

export { 
  createProduct, 
  getProductById, 
  addImagestoProduct,
  getProductsByBrand,
  getAllProducts,
  deleteProduct 
 };
