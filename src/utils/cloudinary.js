import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

// Config is called once here, at module load time — not inside
// uploadOnCloudinary. It used to be called on every invocation, which
// contradicted this comment and re-did the same idempotent setup work on
// every upload for no benefit.
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Cleanup is its own guarded step, not duplicated inline in both the try
// and catch branches. Previously, if the *first* fs.unlinkSync (on the
// success path) threw — file already gone, a permissions hiccup, a race
// with something else touching public/temp — control fell into the catch
// block, which called fs.unlinkSync on the same path again. That second
// call had no guard at all, so it threw uncaught: the function rejected
// instead of returning null like every caller expects, and if this
// happened *after* a successful Cloudinary upload, the successful result
// was discarded and reported as a failed upload.
const removeLocalFile = (localFilePath) => {
  try {
    if (fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }
  } catch (cleanupError) {
    console.error("Failed to remove temp file:", cleanupError.message);
  }
};

export const uploadOnCloudinary = async (localFilePath, folder = "") => {
  if (!localFilePath) return null;

  try {
    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
      folder,
    });

    removeLocalFile(localFilePath);
    return response;
  } catch (error) {
    removeLocalFile(localFilePath);
    console.error("Cloudinary upload error:", error.message);
    return null;
  }
};
