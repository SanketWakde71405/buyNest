import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { Store } from "../models/store.models.js";

// Resolves req.user's store with a single query and attaches it as
// req.store. Any route that needs "the caller's own store" should use
// this instead of repeating `Store.findOne({ owner: user._id })` in
// every controller.
export const attachStore = asyncHandler(async (req, res, next) => {
  const user = req.user;

  if (!user) {
    throw new ApiError(401, "Unauthorized access!");
  }

  const store = await Store.findOne({ owner: user._id });

  if (!store) {
    throw new ApiError(404, "Store not found.");
  }

  req.store = store;
  next();
});
