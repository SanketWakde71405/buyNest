import mongoose, { Schema } from "mongoose";
const brandSchema = new Schema(
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
    logo: {
      type: String,
      default: "https://placehold.net/logo-2.png",
    },
    logoPublicId: {
      type: String,
      default: null,
    },
    categories: [
      {
        type: Schema.Types.ObjectId,
        ref: "Category",
      },
    ],
  },
  {
    timestamps: true,
  },
);

export const Brand = mongoose.model("Brand", brandSchema);
