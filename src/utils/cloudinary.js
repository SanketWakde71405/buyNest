import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

// ✅ Config must be called at module load time, before any upload
export const uploadOnCloudinary = async (
  localFilePath,
  { folder = "uploads", publicId = null, overwrite = false } = {},
) => {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

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