// imageRoutes.js
const express = require("express");
const router = express.Router();
const cloudinary = require("cloudinary").v2;
const auth = require("../middleware/auth");
const fs = require("fs").promises;
const path = require("path");

// Configure cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

// Utility function to remove temporary files
async function removeTmp(filePath) {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    console.error("Error removing temp file:", error);
  }
}

// Validate file type
function isValidFileType(mimetype) {
  const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  return validTypes.includes(mimetype);
}

// Upload image
router.post("/upload", auth, async (req, res) => {
  try {
    // Check if file exists in request
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json({
        message: "No files were uploaded.",
        detail: "Please select an image to upload.",
      });
    }

    const file = req.files.image; // 'image' should be the field name in the form data

    // Validate file size (2MB limit)
    const maxSize = 2 * 1024 * 1024; // 2MB in bytes
    if (file.size > maxSize) {
      await removeTmp(file.tempFilePath);
      return res.status(400).json({
        message: "File size too large",
        detail: "Maximum file size is 2MB",
      });
    }

    // Validate file type
    if (!isValidFileType(file.mimetype)) {
      await removeTmp(file.tempFilePath);
      return res.status(400).json({
        message: "Invalid file type",
        detail: "Supported formats: JPEG, PNG, GIF, WEBP",
      });
    }

    // Upload to Cloudinary
    const userId = req.user.id;
    const uploadResult = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload(
        file.tempFilePath,
        {
          folder: `emailbuilder/${userId}`,
          resource_type: "image",
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
    });

    // Clean up temp file
    await removeTmp(file.tempFilePath);

    // Send response
    res.json({
      message: "Image uploaded successfully",
      image: {
        public_id: uploadResult.public_id,
        url: uploadResult.secure_url,
        width: uploadResult.width,
        height: uploadResult.height,
        format: uploadResult.format,
        size: uploadResult.bytes,
      },
    });
  } catch (error) {
    // Clean up temp file if it exists
    if (req.files?.image?.tempFilePath) {
      await removeTmp(req.files.image.tempFilePath);
    }

    console.error("Image upload error:", error);
    res.status(500).json({
      message: "Error uploading image",
      error: error.message,
    });
  }
});

// Delete image
router.delete("/images/:publicId", auth, async (req, res) => {
  try {
    const { publicId } = req.params;

    if (!publicId) {
      return res.status(400).json({
        message: "Public ID is required",
        detail: "Please provide the public_id of the image to delete",
      });
    }

    // Verify the image belongs to the user's folder
    const userId = req.user.id;
    if (!publicId.includes(`emailbuilder/${userId}`)) {
      return res.status(403).json({
        message: "Access denied",
        detail: "You can only delete your own images",
      });
    }

    // Delete from Cloudinary
    const result = await cloudinary.uploader.destroy(publicId);

    if (result.result !== "ok") {
      return res.status(400).json({
        message: "Failed to delete image",
        detail: "The image may have already been deleted or does not exist",
      });
    }

    res.json({
      message: "Image deleted successfully",
      detail: result,
    });
  } catch (error) {
    console.error("Image deletion error:", error);
    res.status(500).json({
      message: "Error deleting image",
      error: error.message,
    });
  }
});

module.exports = router;
