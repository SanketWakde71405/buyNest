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

const paymentMethodsSchema = new mongoose.Schema(
  {
    upi: { type: Boolean, default: false },
    cards: { type: Boolean, default: false },
    netBanking: { type: Boolean, default: false },
    cod: { type: Boolean, default: false },
    wallets: { type: Boolean, default: false },
  },
  { _id: false },
);

const payoutDetailsSchema = new mongoose.Schema(
  {
    accountHolderName: {
      type: String,
      trim: true,
      default: "",
    },
    // Only the last 4 digits are kept in plaintext for display purposes.
    // The full account number is stored encrypted below and must never
    // be returned in an API response.
    accountNumberLast4: {
      type: String,
      default: "",
    },
    accountNumberEncrypted: {
      type: String,
      default: "",
      select: false,
    },
    ifscCode: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
      match: [/^[A-Z]{4}0[A-Z0-9]{6}$/, "Invalid IFSC code"],
    },
  },
  { _id: false },
);

const paymentSettingsSchema = new mongoose.Schema(
  {
    methods: {
      type: paymentMethodsSchema,
      default: () => ({}),
    },
    codOrderLimit: {
      type: Number,
      min: 0,
      default: null,
    },
    payout: {
      type: payoutDetailsSchema,
      default: () => ({}),
    },
  },
  { _id: false },
);

const shippingSettingsSchema = new mongoose.Schema(
  {
    domesticOnly: {
      type: Boolean,
      default: true,
    },
    freeShippingThreshold: {
      type: Number,
      min: 0,
      default: null,
    },
    estimatedDeliveryDays: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { _id: false },
);

const taxSettingsSchema = new mongoose.Schema(
  {
    gstRegistered: {
      type: Boolean,
      default: false,
    },
    gstin: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
      match: [
        /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
        "Invalid GSTIN",
      ],
    },
    pricingType: {
      type: String,
      enum: ["inclusive", "exclusive"],
      default: "exclusive",
    },
    // Back the "Additional Tax Options" toggles in TaxTab.jsx.
    displayTaxSeparately: {
      type: Boolean,
      default: false,
    },
    roundOffTax: {
      type: Boolean,
      default: false,
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

    // Payment, Shipping & Tax Settings (Onboarding Step 3)
    settings: {
      payment: {
        type: paymentSettingsSchema,
        default: () => ({}),
      },
      shipping: {
        type: shippingSettingsSchema,
        default: () => ({}),
      },
      tax: {
        type: taxSettingsSchema,
        default: () => ({}),
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

export const Store = mongoose.model("Store", storeSchema);
