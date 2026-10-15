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
    status: {
      type: String,
      enum: ["active", "inactive"],
      // A new category has no products yet, so it starts inactive and
      // becomes active automatically once a product is assigned to it.
      default: "inactive",
    },
    // Position among siblings sharing the same parentCategory (including
    // top-level categories, where parentCategory is null). NOT globally
    // unique — only unique within a sibling group. Managed exclusively via
    // Category.reorderSiblings (see controllers) — never set directly by
    // clients through the generic update endpoint.
    displayOrder: {
      type: Number,
      default: 0,
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

// Returns the next free displayOrder (i.e. sibling count) for a given
// parent, so a newly created/moved category is appended to the end of
// that parent's list.
categorySchema.statics.getNextDisplayOrder = async function (parentId) {
  return this.countDocuments({ parentCategory: parentId || null });
};

// Replaces the full displayOrder sequence for one sibling group in a
// single bulk write. `orderedIds` must contain exactly the current
// siblings under `parentId` (validated by the caller) — this avoids the
// duplicate-key issues that come from shifting individual positions
// one at a time.
categorySchema.statics.reorderSiblings = async function (parentId, orderedIds) {
  const bulkOps = orderedIds.map((id, index) => ({
    updateOne: {
      filter: { _id: id, parentCategory: parentId || null },
      update: { displayOrder: index },
    },
  }));

  if (bulkOps.length > 0) {
    await this.bulkWrite(bulkOps);
  }
};

categorySchema.statics.syncStatus = async function (categoryIds) {

  const ids = (categoryIds || [])
    .filter(Boolean)
    .map((id) => new mongoose.Types.ObjectId(id._id ?? id));

  if (ids.length === 0) return;

  const withAncestors = await this.aggregate([
    { $match: { _id: { $in: ids } } },
    {
      $graphLookup: {
        from: this.collection.name,
        startWith: "$parentCategory",
        connectFromField: "parentCategory",
        connectToField: "_id",
        as: "ancestors",
      },
    },
    { $project: { ancestorIds: "$ancestors._id" } },
  ]);

  const idsToUpdateSet = new Set(ids.map((id) => id.toString()));
  withAncestors.forEach((doc) => {
    (doc.ancestorIds || []).forEach((ancestorId) =>
      idsToUpdateSet.add(ancestorId.toString()),
    );
  });
  const idsToUpdate = Array.from(idsToUpdateSet).map(
    (id) => new mongoose.Types.ObjectId(id),
  );

  // For every category being updated, gather its own subtree (itself +
  // all descendants) — that's the full set of categories whose products
  // would keep it "active".
  const withDescendants = await this.aggregate([
    { $match: { _id: { $in: idsToUpdate } } },
    {
      $graphLookup: {
        from: this.collection.name,
        startWith: "$_id",
        connectFromField: "_id",
        connectToField: "parentCategory",
        as: "descendants",
      },
    },
    {
      $project: {
        subtreeIds: { $concatArrays: [["$_id"], "$descendants._id"] },
      },
    },
  ]);

  const allSubtreeIds = Array.from(
    new Set(
      withDescendants.flatMap((doc) =>
        (doc.subtreeIds || []).map((id) => id.toString()),
      ),
    ),
  ).map((id) => new mongoose.Types.ObjectId(id));

  const Product = mongoose.model("Product");

  const counts = await Product.aggregate([
    { $match: { category: { $in: allSubtreeIds } } },
    { $unwind: "$category" },
    { $match: { category: { $in: allSubtreeIds } } },
    { $group: { _id: "$category", count: { $sum: 1 } } },
  ]);

  const categoriesWithProducts = new Set(
    counts.map(({ _id }) => _id.toString()),
  );

  const bulkOps = withDescendants.map((doc) => {
    const isActive = (doc.subtreeIds || []).some((id) =>
      categoriesWithProducts.has(id.toString()),
    );
    return {
      updateOne: {
        filter: { _id: doc._id },
        update: { status: isActive ? "active" : "inactive" },
      },
    };
  });

  if (bulkOps.length > 0) {
    await this.bulkWrite(bulkOps);
  }
};

export const Category = mongoose.model("Category", categorySchema);
