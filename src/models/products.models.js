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

productSchema.virtual("profit").get(function () {
  if (this.costPrice == null) return null;
  const sellingPrice = this.discountPrice ?? this.price;
  return sellingPrice - this.costPrice;
});


productSchema.virtual("stockStatus").get(function () {
  return classifyStock(this.stock);
});


productSchema.pre("save", function () {
  const outOfStock = this.stock != null && this.stock < LOW_STOCK_THRESHOLD;
  const tooFewImages = (this.images?.length || 0) < MIN_ACTIVE_IMAGES;

  if (this.isActive && (outOfStock || tooFewImages)) {
    this.isActive = false;
  }
});

productSchema.pre("findOneAndUpdate", async function () {
  const update = this.getUpdate() || {};
  const setBlock = update.$set || update;

  const stockChanging = setBlock.stock !== undefined;
  const imagesChanging = Array.isArray(setBlock.images);
  const settingActiveTrue = setBlock.isActive === true;

  
  if (!stockChanging && !imagesChanging && !settingActiveTrue) {
    return ;
  }

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


productSchema.post("save", async function (doc) {
  const Category = mongoose.model("Category");
  await Category.syncStatus(doc.category);
});

productSchema.pre("findOneAndUpdate", async function () {
  const update = this.getUpdate() || {};
  const setBlock = update.$set || update;

  if (setBlock.category === undefined) {
    this._categorySyncSkipped = true;
    return;
  }

  const existing = await this.model
    .findOne(this.getQuery())
    .select("category");
  this._previousCategories = existing?.category || [];
});

productSchema.post("findOneAndUpdate", async function (doc) {
  if (this._categorySyncSkipped) return;

  const Category = mongoose.model("Category");
  const previous = this._previousCategories || [];
  const current = doc?.category || [];
  await Category.syncStatus([...previous, ...current]);
});

// Single-document delete via .deleteOne() on a fetched document.
productSchema.pre(
  "deleteOne",
  { document: true, query: false },
  function () {
    this._deletedCategories = this.category;
  },
);

productSchema.post(
  "deleteOne",
  { document: true, query: false },
  async function () {
    const Category = mongoose.model("Category");
    await Category.syncStatus(this._deletedCategories);
  },
);

productSchema.pre("findOneAndDelete", async function () {
  const existing = await this.model
    .findOne(this.getQuery())
    .select("category");
  this._deletedCategories = existing?.category || [];
});

productSchema.post("findOneAndDelete", async function () {
  const Category = mongoose.model("Category");
  await Category.syncStatus(this._deletedCategories);
});

// Bulk delete — this is what deleteCategory's Product.deleteMany() uses.
productSchema.pre("deleteMany", async function () {
  const docs = await this.model.find(this.getFilter()).select("category");
  this._deletedCategories = docs.flatMap((d) => d.category);
});

productSchema.post("deleteMany", async function () {
  const Category = mongoose.model("Category");
  await Category.syncStatus(this._deletedCategories);
});

export const Product = mongoose.model("Product", productSchema);