const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true, // Convert email to lowercase
      validate: {
        validator: function (v) {
          return /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(v);
        },
        message: "Please enter a valid email address",
      },
    },
    password: {
      type: String,
      required: true,
    },
    templates: {
      all: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Template",
        },
      ],
      fav: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Template",
        },
      ],
      recents: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Template",
        },
      ],
    },
  },
  {
    timestamps: true,
  }
);

// Create indexes
userSchema.index({ email: 1 }, { unique: true });

module.exports = mongoose.model("users", userSchema, "users", {
  dbName: "EmailBuilder",
});
