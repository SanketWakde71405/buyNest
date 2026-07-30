export const DB_NAME = "buynest_db";

export const ROLES = {
  USER: "User",
  ADMIN: "Admin",
  EMPLOYEE:"Employee"
};

export const ADDRESS_TYPES = {
  HOME: "Home",
  WORK: "Work",
  OTHER: "Other",
};

export const PAYMENT_METHODS = {
  CREDIT_CARD: "Credit Card",
  PAYPAL: "PayPal",
  CASH_ON_DELIVERY: "Cash on Delivery",
};

export const PAYMENT_STATUS = {
  PENDING: "Pending",
  COMPLETED: "Completed",
  FAILED: "Failed",
  REFUNDED: "Refunded",
};

export const ORDER_STATUS = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

export const BUSINESS_TYPES = {
  INDIVIDUAL: "individual",
  PROPRIETORSHIP: "proprietorship",
  PARTNERSHIP: "partnership",
  LLP: "llp",
  PRIVATE_LIMITED: "private_limited",
};

// Only for product controllers
export const UPDATABLE_FIELDS = [
  "title",
  "description",
  "slug",
  "price",
  "discountPrice",
  "category",
  "stock",
  "brand",
  "isActive",
];