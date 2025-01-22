const mongoose = require("mongoose");

const blockSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ["heading", "paragraph", "member-card", "button", "image"],
  },
  content: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
  style: {
    type: Map,
    of: String,
    default: new Map(),
  },
});

const templateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    content: [blockSchema],
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isFavorite: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Template", templateSchema);
