import mongoose, { Schema } from "mongoose";
const categorySchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    parentCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },
    parentCategoryName: {
      type: String,
      default: null,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

categorySchema.pre("save", async function () {
  if (this.parentCategory) {
    const parent = await mongoose
      .model("Category")
      .findById(this.parentCategory)
      .select("name");
    this.parentCategoryName = parent ? parent.name : null;
  } else {
    this.parentCategoryName = null;
  }
});

export const Category = mongoose.model("Category", categorySchema);
