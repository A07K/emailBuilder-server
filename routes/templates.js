const express = require("express");
const Template = require("../models/Template");
const User = require("../models/User");
const auth = require("../middleware/auth");

const router = express.Router();

// POST /templates - Create new template
router.post("/templates", auth, async (req, res) => {
  try {
    const { name, content, style, isFavorite } = req.body;
    const userId = req.user.id; // Get user ID from auth middleware

    // First verify the user exists and get the user document
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    // Create and save the template
    const newTemplate = new Template({
      name,
      content,
      style,
      isFavorite,
      user: userId,
    });

    const savedTemplate = await newTemplate.save();

    // Update the existing user's template arrays using findByIdAndUpdate
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        $push: {
          "templates.all": savedTemplate._id,
          ...(isFavorite ? { "templates.fav": savedTemplate._id } : {}),
          "templates.recents": {
            $each: [savedTemplate._id],
            $position: 0,
            $slice: 5,
          },
        },
      },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      // If update failed, delete the template we just created
      await Template.findByIdAndDelete(savedTemplate._id);
      return res.status(500).json({
        message: "Failed to update user with new template.",
      });
    }

    res.status(201).json({
      message: "Template saved successfully",
      template: savedTemplate,
      user: {
        templatesCount: updatedUser.templates.all.length,
        favoritesCount: updatedUser.templates.fav.length,
        recentsCount: updatedUser.templates.recents.length,
      },
    });
  } catch (error) {
    console.error("Template creation error:", error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: "Invalid template data",
        errors: error.errors,
      });
    }

    res.status(500).json({
      message: "An error occurred while saving the template.",
      error: error.message,
    });
  }
});

// Add a test route to verify authentication
router.get("/test-auth", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      message: "Authentication working",
      user: {
        id: user._id,
        email: user.email,
        templatesCount: user.templates.all.length,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Error testing authentication",
      error: error.message,
    });
  }
});

router.get("/templates", auth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user document to access template lists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // Fetch all templates that belong to the user
    const templates = await Template.find({
      _id: { $in: user.templates.all },
    }).sort({ updatedAt: -1 }); // Sort by most recently updated

    // Map templates to include their status (favorite/recent)
    const templatesWithStatus = templates.map((template) => ({
      _id: template._id,
      name: template.name,
      content: template.content,
      isFavorite: user.templates.fav.includes(template._id),
      isRecent: user.templates.recents.includes(template._id),
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    }));

    // Organize templates by category
    const organizedTemplates = {
      all: templatesWithStatus,
      favorites: templatesWithStatus.filter((t) => t.isFavorite),
      recent: user.templates.recents
        .map((recentId) =>
          templatesWithStatus.find(
            (t) => t._id.toString() === recentId.toString()
          )
        )
        .filter(Boolean), // Keep the recent order and remove any null values
    };

    res.json({
      message: "Templates retrieved successfully",
      templates: organizedTemplates,
      count: {
        total: templatesWithStatus.length,
        favorites: organizedTemplates.favorites.length,
        recent: organizedTemplates.recent.length,
      },
    });
  } catch (error) {
    console.error("Get templates error:", error);
    res.status(500).json({
      message: "Error retrieving templates",
    });
  }
});

// Optional: Add a route to get templates by category
router.get("/templates/:category", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const category = req.params.category.toLowerCase();

    if (!["all", "favorites", "recent"].includes(category)) {
      return res.status(400).json({
        message: "Invalid category. Use 'all', 'favorites', or 'recent'",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    let templateIds;
    switch (category) {
      case "all":
        templateIds = user.templates.all;
        break;
      case "favorites":
        templateIds = user.templates.fav;
        break;
      case "recent":
        templateIds = user.templates.recents;
        break;
    }

    const templates = await Template.find({
      _id: { $in: templateIds },
    });

    // If category is 'recent', maintain the order from user.templates.recents
    const orderedTemplates =
      category === "recent"
        ? templateIds
            .map((id) =>
              templates.find((t) => t._id.toString() === id.toString())
            )
            .filter(Boolean)
        : templates;

    res.json({
      message: `${category} templates retrieved successfully`,
      templates: orderedTemplates,
      count: orderedTemplates.length,
    });
  } catch (error) {
    console.error(`Get ${req.params.category} templates error:`, error);
    res.status(500).json({
      message: "Error retrieving templates",
    });
  }
});

function renderBlock(block, values) {
  let renderedContent = "";

  switch (block.type) {
    case "heading":
      renderedContent = `<h2 class="text-2xl">${replaceValues(
        block.content,
        values
      )}</h2>`;
      break;

    case "paragraph":
      renderedContent = `<p>${replaceValues(block.content, values)}</p>`;
      break;

    case "member-card":
      renderedContent = `
        <div class="bg-gray-50 p-5 rounded-lg">
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
              <span class="text-xl">${replaceValues(
                block.content.initials,
                values
              )}</span>
            </div>
            <div>
              <h3 class="font-medium">${replaceValues(
                block.content.name,
                values
              )}</h3>
              <p class="text-sm text-gray-600">${replaceValues(
                block.content.status,
                values
              )}</p>
            </div>
          </div>
        </div>`;
      break;

    case "button":
      renderedContent = `
        <button class="px-6 py-3 rounded-md text-white">
          ${replaceValues(block.content, values)}
        </button>`;
      break;

    case "image":
      renderedContent = `
        <img 
          src="${replaceValues(block.content.url, values)}"
          alt="${replaceValues(block.content.alt, values)}"
          class="max-w-full h-auto rounded"
          ${block.style?.width ? `style="width: ${block.style.width};"` : ""}
        />`;
      break;

    default:
      renderedContent = `<p>${replaceValues(block.content, values)}</p>`;
  }

  return renderedContent;
}

function replaceValues(content, values) {
  if (typeof content === "string") {
    return Object.keys(values).reduce((acc, key) => {
      return acc.replace(new RegExp(`{{${key}}}`, "g"), values[key]);
    }, content);
  }
  return content;
}

router.post("/render-template/:id", auth, async (req, res) => {
  try {
    const templateId = req.params.id;
    const userId = req.user.id;
    const { values } = req.body;

    const template = await Template.findOne({
      _id: templateId,
      user: userId,
    });

    if (!template) {
      return res.status(404).json({
        message: "Template not found",
      });
    }

    // Render each block
    const renderedBlocks = template.content.map((block) =>
      renderBlock(block, values)
    );

    // Combine into final HTML with Tailwind CSS
    const finalHTML = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${template.name}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            margin: 0;
            padding: 20px;
          }
        </style>
      </head>
      <body>
        ${renderedBlocks.join("\n")}
      </body>
      </html>
    `;

    // Set headers for file download
    res.setHeader("Content-Type", "text/html");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${template.name}.html"`
    );
    res.send(finalHTML);
  } catch (error) {
    console.error("Template rendering error:", error);
    res.status(500).json({
      message: "Error rendering template",
    });
  }
});

module.exports = router;

/*for comparison making it to the front end*/
