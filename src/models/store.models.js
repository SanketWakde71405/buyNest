import mongoose, { Schema } from "mongoose";
import { BUSINESS_TYPES } from "../constants.js";

const storeAddressSchema = new Schema(
  {
    addressLine1: {
      type: String,
      required: true,
      trim: true,
    },
    addressLine2: {
      type: String,
      trim: true,
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
      required: true,
      trim: true,
      default: "India",
    },
    postalCode: {
      type: String,
      required: true,
      trim: true,
      match: [/^\d{6}$/, "Please enter a valid postal code"],
    },
  },
  { _id: false },
);

const storeSchema = new Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // one store per seller account
    },
    storeName: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    storeLogo: {
      type: String, // Cloudinary secure_url
      default: "https://placehold.net/avatar-2.png",
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    categories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
      },
    ],
    businessType: {
      type: String,
      enum: Object.values(BUSINESS_TYPES),
      required: true,
      trim: true,
    },
    registrationNumber: {
      type: String,
      trim: true,
      uppercase: true,
      match: [
        /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
        "Please enter a valid GSTIN",
      ],
    },
    businessEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Please enter a valid email"],
    },
    address: {
      type: storeAddressSchema,
      required: true,
    },
    isVerified: {
      type: Boolean,
      default: false, // flipped by admin after reviewing GSTIN/docs
    },
    isActive: {
      type: Boolean,
      default: true,
    },

    // This app is single-seller: there must never be more than one Store
    // document. `owner: unique` above only stops one *user* from having
    // two stores — it does nothing to stop many different users from each
    // creating their own. This fixed, always-"singleton" value plus the
    // unique index below is what actually makes a second store impossible
    // at the database level (atomic, race-condition-proof — unlike an
    // application-level "does a store already exist?" check, which has a
    // window between the check and the insert).
    singletonKey: {
      type: String,
      default: "singleton",
      unique: true,
    },
  },
  {
    timestamps: true,
  },
);

// Friendlier error than a raw duplicate-key error, for the common case.
// Still keep the unique index above as the actual guarantee — this hook
// alone has the same race-condition gap it's meant to protect against.
storeSchema.pre("save", async function () {
  if (this.isNew) {
    const alreadyExists = await mongoose.model("Store").exists({});
    if (alreadyExists) {
      throw new Error(
        "A store already exists — this app supports only a single seller.",
      );
    }
  }
});

export const Store = mongoose.model("Store", storeSchema);
