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
    website: {
      type: String,
      trim: true,
      default: "",
    },
    countryOfOrigin: {
      type: String,
      trim: true,
      default: "",
    },
    yearEstablished: {
      type: Number,
      min: 1500,
      max: new Date().getFullYear(),
      default: null,
    },
    categories: [
      {
        type: Schema.Types.ObjectId,
        ref: "Category",
      },
    ],
    supplier: {
      type: Schema.Types.ObjectId,
      ref: "Supplier",
      default: null, // not required — a brand can exist without a supplier
    },
  },
  {
    timestamps: true,
  },
);

export const Brand = mongoose.model("Brand", brandSchema);
