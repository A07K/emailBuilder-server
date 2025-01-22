// renderTemplateRoutes.js
const express = require("express");
const router = express.Router();
const Template = require("../models/Template");
const auth = require("../middleware/auth");
const fs = require("fs").promises;
const path = require("path");

// POST /api/render-template/:id
router.post("/render-template/:id", auth, async (req, res) => {
  try {
    const templateId = req.params.id;
    const userId = req.user.id;
    const { values } = req.body; // Values to substitute in the template

    // Find template and verify ownership
    const template = await Template.findOne({
      _id: templateId,
      user: userId,
    });

    if (!template) {
      return res.status(404).json({
        message: "Template not found",
      });
    }

    // Get the HTML content from template
    let htmlContent = template.content.join(""); // Assuming content is stored as array of strings

    // Replace placeholders with actual values
    Object.keys(values).forEach((key) => {
      const placeholder = `{{${key}}}`;
      htmlContent = htmlContent.replace(
        new RegExp(placeholder, "g"),
        values[key]
      );
    });

    // Add any additional CSS or styling
    const finalHTML = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${template.name}</title>
                <style>
                    /* You can add default styles here */
                    body {
                        font-family: Arial, sans-serif;
                        line-height: 1.6;
                        margin: 0;
                        padding: 20px;
                    }
                </style>
            </head>
            <body>
                ${htmlContent}
            </body>
            </html>
        `;

    // Set headers for file download
    res.setHeader("Content-Type", "text/html");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${template.name}.html"`
    );

    // Send the rendered HTML
    res.send(finalHTML);
  } catch (error) {
    console.error("Template rendering error:", error);
    res.status(500).json({
      message: "Error rendering template",
    });
  }
});

module.exports = router;
