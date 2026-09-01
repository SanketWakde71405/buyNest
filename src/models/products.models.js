import mongoose, { Schema } from "mongoose";

const MIN_ACTIVE_IMAGES = 3;

// Stock thresholds for both the storefront classifier and the isActive gate.
// stock < LOW_STOCK_THRESHOLD  => out of stock (forces isActive: false)
// stock < HIGH_STOCK_THRESHOLD => low stock
// otherwise                    => active / in stock
const LOW_STOCK_THRESHOLD = 10;
const HIGH_STOCK_THRESHOLD = 20;

export const STOCK_STATUS = {
  IN_STOCK: "In Stock",
  LOW_STOCK: "Low Stock",
  OUT_OF_STOCK: "Out of Stock",
};

function classifyStock(stock) {
  if (stock == null) return null;
  if (stock < LOW_STOCK_THRESHOLD) return STOCK_STATUS.OUT_OF_STOCK;
  if (stock < HIGH_STOCK_THRESHOLD) return STOCK_STATUS.LOW_STOCK;
  return STOCK_STATUS.IN_STOCK;
}

const productSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
    },
    discountPrice: {
      type: Number,
      required: true,
    },
    // What the vendor paid to acquire the item. Used to compute `profit`
    // below — never exposed on customer-facing routes (excluded via
    // .select("-costPrice") in getProductsByCategory and anywhere else
    // that serves the storefront).
    costPrice: {
      type: Number,
    },
    category: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Category" }],
      required: true,
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0,
        message: "At least one category is required",
      },
    },
    stock: {
      type: Number,
      required: true,
    },
    brand: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Brand",
      required: true,
    },
    images: [
      {
        type: String,
      },
    ],
    features: [
      {
        type: String,
      },
    ],
    ratingsAverage: {
      type: Number,
      default: 0,
    },
    ratingsCount: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Computed, not stored, so it's always derived from the current
// price/costPrice rather than going stale. Returns null when costPrice
// hasn't been set yet (e.g. older products created before this field
// existed) rather than a misleading number.
productSchema.virtual("profit").get(function () {
  if (this.costPrice == null) return null;
  const sellingPrice = this.discountPrice ?? this.price;
  return sellingPrice - this.costPrice;
});

// Purely derived from `stock` — always accurate, no hook needed to keep
// it in sync. Distinct from `isActive`: this is a stock-level label,
// isActive is the actual listability flag (gated on both stock and
// image count below).
productSchema.virtual("stockStatus").get(function () {
  return classifyStock(this.stock);
});

// Covers .save() calls — addProductImages, deleteProductImage,
// deleteAllProductImages, and createProduct all go through this.
// isActive is forced false if the product is out of stock OR doesn't
// have enough images. It's never forced back to true here — that only
// happens if the caller explicitly sets isActive: true again once both
// conditions clear.
productSchema.pre("save", function () {
  const outOfStock = this.stock != null && this.stock < LOW_STOCK_THRESHOLD;
  const tooFewImages = (this.images?.length || 0) < MIN_ACTIVE_IMAGES;

  if (this.isActive && (outOfStock || tooFewImages)) {
    this.isActive = false;
  }
});

// findByIdAndUpdate/findOneAndUpdate (used by updateProduct) bypass
// document middleware entirely, so the same gate needs to be re-applied
// here — otherwise an admin could flip isActive: true, or drop stock
// below the threshold, straight through the update endpoint without
// isActive reacting.
productSchema.pre("findOneAndUpdate", async function () {
  const update = this.getUpdate() || {};
  const setBlock = update.$set || update;

  const stockChanging = setBlock.stock !== undefined;
  const imagesChanging = Array.isArray(setBlock.images);
  const settingActiveTrue = setBlock.isActive === true;

  // Nothing that could affect the isActive gate is happening — skip the
  // extra DB round trip.
  if (!stockChanging && !imagesChanging && !settingActiveTrue) {
    return ;
  }

  // Need the current stock/images if this update doesn't touch them, to
  // know what the resulting state will be.
  let current = null;
  if (!stockChanging || !imagesChanging) {
    current = await this.model.findOne(this.getQuery()).select("stock images");
  }

  const resultingStock = stockChanging ? setBlock.stock : current?.stock;
  const resultingImageCount = imagesChanging
    ? setBlock.images.length
    : current?.images?.length || 0;

  const outOfStock = resultingStock != null && resultingStock < LOW_STOCK_THRESHOLD;
  const tooFewImages = resultingImageCount < MIN_ACTIVE_IMAGES;

  if (outOfStock || tooFewImages) {
    setBlock.isActive = false;
  }


});

export const Product = mongoose.model("Product", productSchema);