import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

const configureCloudinary = () => {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
};

// ✅ Config must be called at module load time, before any upload
export const uploadOnCloudinary = async (
  localFilePath,
  { folder = "uploads", publicId = null, overwrite = false } = {},
) => {
  configureCloudinary();

  try {
    if (!localFilePath) return null;

    const options = {
      resource_type: "auto",
      folder,
    };

    if (publicId) {
      options.public_id = publicId;
      options.overwrite = overwrite;
    }

    const response = await cloudinary.uploader.upload(localFilePath, options);

    fs.unlinkSync(localFilePath);

    return response;
  } catch (error) {
    fs.unlinkSync(localFilePath);
    console.error(error);

    return null;
  }
};

// ✅ Deletes an existing asset from Cloudinary using its public_id
export const deleteFromCloudinary = async (
  publicId,
  resourceType = "image",
) => {
  if (!publicId) return null;

  configureCloudinary();

  try {
    const response = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });

    return response;
  } catch (error) {
    console.error("Cloudinary deletion error:", error);
    return null;
  }
};
