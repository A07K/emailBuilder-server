const express = require("express");
const Template = require("../models/Template");
const auth = require("../middleware/auth");
const mongoose = require("mongoose");
const User = require("../models/User");

const router = express.Router();

// GET /templates/:id - Get template by ID
router.get("/templateById/:id", auth, async (req, res) => {
  try {
    const templateId = req.params.id;
    const userId = req.user.id;

    console.log({
      debug: "Template Lookup Debug Info",
      templateId,
      userId,
      isValidObjectId: mongoose.Types.ObjectId.isValid(templateId),
    });

    // First, try to find the template without user restriction to see if it exists at all
    const templateExists = await Template.findById(templateId);
    console.log({
      debug: "Template Existence Check",
      exists: !!templateExists,
      templateData: templateExists,
    });

    // Now try with user restriction
    const template = await Template.findOne({
      _id: templateId,
      user: userId,
    });

    console.log({
      debug: "Template User Match Check",
      hasTemplate: !!template,
      templateUserId: template?.user,
      requestUserId: userId,
      matches: template?.user?.toString() === userId,
    });

    if (!template) {
      return res.status(404).json({
        message: "Template not found",
        debug: {
          templateExists: !!templateExists,
          userMatch: templateExists?.user?.toString() === userId,
        },
      });
    }

    res.json({
      message: "Template retrieved successfully",
      template: {
        _id: template._id,
        name: template.name,
        content: template.content,
        isFavorite: template.isFavorite,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt,
        userId: template.user, // Add this for debugging
      },
    });
  } catch (error) {
    console.error("Template retrieval error:", {
      error: error.message,
      stack: error.stack,
      templateId: req.params.id,
    });

    if (error.kind === "ObjectId") {
      return res.status(400).json({
        message: "Invalid template ID format",
        detail: "The provided ID is not in the correct format",
      });
    }

    res.status(500).json({
      message: "Error retrieving template",
      error: error.message,
    });
  }
});

// Add a debugging route to check template existence
router.get("/templates/:id/debug", auth, async (req, res) => {
  try {
    const templateId = req.params.id;
    const userId = req.user.id;

    const template = await Template.findById(templateId);

    res.json({
      templateExists: !!template,
      templateUserId: template ? template.user : null,
      requestingUserId: userId,
      wouldHaveAccess: template ? template.user.toString() === userId : false,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error debugging template",
      error: error.message,
    });
  }
});

router.get("/debug/template/:id", auth, async (req, res) => {
  try {
    const templateId = req.params.id;

    // Try different query methods
    const results = {
      // Try direct findById
      findById: await Template.findById(templateId),

      // Try finding without user restriction
      findOne: await Template.findOne({ _id: templateId }),

      // Check if ID is valid ObjectId
      isValidObjectId: mongoose.Types.ObjectId.isValid(templateId),

      // Get all templates for the user
      userTemplates: await Template.find({ user: req.user.id }).select("_id"),

      // Document details if found
      templateDetails: null,
    };

    // If we found the template with findOne, get more details
    if (results.findOne) {
      results.templateDetails = {
        id: results.findOne._id,
        user: results.findOne.user,
        name: results.findOne.name,
        userMatch: results.findOne.user.toString() === req.user.id,
      };
    }

    res.json({
      searchedId: templateId,
      userId: req.user.id,
      results,
    });
  } catch (error) {
    res.status(500).json({
      message: "Debug route error",
      error: error.message,
      stack: error.stack,
    });
  }
});

router.put("/templates/:id", auth, async (req, res) => {
  try {
    const templateId = req.params.id;
    const userId = req.user.id;
    const { name, content, isFavorite } = req.body;

    // Validate inputs
    if (!name && !content && typeof isFavorite === "undefined") {
      return res.status(400).json({
        message: "Please provide at least one field to update",
      });
    }

    // First find the template and verify ownership
    const existingTemplate = await Template.findOne({
      _id: templateId,
      user: userId,
    });

    if (!existingTemplate) {
      return res.status(404).json({
        message: "Template not found",
      });
    }

    // Prepare update object with only provided fields
    const updateData = {};
    if (name) updateData.name = name;
    if (content) updateData.content = content;
    if (typeof isFavorite !== "undefined") updateData.isFavorite = isFavorite;

    // Handle favorite status change
    if (
      typeof isFavorite !== "undefined" &&
      isFavorite !== existingTemplate.isFavorite
    ) {
      const updateOperation = isFavorite
        ? { $addToSet: { "templates.fav": templateId } }
        : { $pull: { "templates.fav": templateId } };

      await User.findByIdAndUpdate(userId, updateOperation);
    }

    // Update the template
    const updatedTemplate = await Template.findOneAndUpdate(
      { _id: templateId, user: userId },
      updateData,
      {
        new: true,
        runValidators: true,
      }
    );

    // Update recents list
    await User.findByIdAndUpdate(userId, {
      $pull: { "templates.recents": templateId },
    });
    await User.findByIdAndUpdate(userId, {
      $push: {
        "templates.recents": {
          $each: [templateId],
          $position: 0,
          $slice: 5,
        },
      },
    });

    // Get updated user data
    const updatedUser = await User.findById(userId);

    res.json({
      message: "Template updated successfully",
      template: {
        _id: updatedTemplate._id,
        name: updatedTemplate.name,
        content: updatedTemplate.content,
        isFavorite: updatedTemplate.isFavorite,
        createdAt: updatedTemplate.createdAt,
        updatedAt: updatedTemplate.updatedAt,
      },
      user: {
        templatesCount: updatedUser.templates.all.length,
        favoritesCount: updatedUser.templates.fav.length,
        recentsCount: updatedUser.templates.recents.length,
      },
    });
  } catch (error) {
    console.error("Template update error:", error);
    res.status(500).json({
      message: "Error updating template",
    });
  }
});

module.exports = router;
