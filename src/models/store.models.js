import mongoose from "mongoose";

const addressSchema = new mongoose.Schema(
  {
    addressLine1: {
      type: String,
      required: true,
      trim: true,
    },
    addressLine2: {
      type: String,
      trim: true,
      default: "",
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    state: {
      type: String,
      required: true,
      trim: true,
    },
    country: {
      type: String,
      default: "India",
      trim: true,
    },
    postalCode: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false },
);

const storeSchema = new mongoose.Schema(
  {
    // Owner of the store
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Store Details
    storeName: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 100,
    },

    description: {
      type: String,
      trim: true,
      default: "",
      maxlength: 1000,
    },

    categories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
      },
    ],

    // Business Information
    businessType: {
      type: String,
      required: true,
      enum: [
        "Individual",
        "Proprietorship",
        "Partnership",
        "LLP",
        "Private Limited",
        "Public Limited",
        "Other",
      ],
    },

    registrationNumber: {
      type: String,
      trim: true,
      default: "",
    },

    businessEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },

    address: {
      type: addressSchema,
      required: true,
    },

    // Store Logo
    logo: {
      public_id: {
        type: String,
        default: "",
      },
      url: {
        type: String,
        default: "",
      },
    },

    // Store Status
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected", "Suspended"],
      default: "Pending",
    },

    isVerified: {
      type: Boolean,
      default: false,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    // Marketplace Statistics
    totalProducts: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalOrders: {
      type: Number,
      default: 0,
      min: 0,
    },

    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },

    totalReviews: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  },
);

// Prevent duplicate store names
storeSchema.index({ storeName: 1 }, { unique: true });

// One user can own only one store
storeSchema.index({ owner: 1 }, { unique: true });


export const Store =mongoose.model("Store", storeSchema);
