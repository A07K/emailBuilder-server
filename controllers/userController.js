const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const userCtrl = {
  // Register a new user
  register: async (req, res) => {
    try {
      const { name, email, password } = req.body;

      // Validate input fields
      if (!name || !email || !password) {
        return res.status(400).json({ msg: "All fields are required." });
      }

      // Check if the user already exists
      const user = await User.findOne({ email });
      if (user)
        return res.status(400).json({ msg: "Email already registered." });

      // Validate password length
      if (password.length < 6) {
        return res
          .status(400)
          .json({ msg: "Password too short, try for a longer one." });
      }

      // Hash the password
      const passwordHash = await bcrypt.hash(password, 10);

      // Create a new user
      const newUser = new User({ name, email, password: passwordHash });
      await newUser.save();

      // Generate tokens
      const accessToken = createAccessToken({ id: newUser._id });
      const refreshToken = createRefreshToken({ id: newUser._id });

      // Set refresh token as HTTP-only cookie
      res.cookie("refreshtoken", refreshToken, {
        httpOnly: true,
        path: "/user/refresh_token",
      });

      res.json({ accesstoken: accessToken });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },

  // Login function
  login: async (req, res) => {
    try {
      const { email, password } = req.body;

      // Validate input fields
      if (!email || !password) {
        return res.status(400).json({ msg: "All fields are required." });
      }

      // Check if the user exists
      const user = await User.findOne({ email });
      if (!user) return res.status(404).json({ msg: "User not found." });

      // Validate password
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch)
        return res.status(401).json({ msg: "Invalid email or password." });

      // Generate tokens
      const accessToken = createAccessToken({ id: user._id });
      const refreshToken = createRefreshToken({ id: user._id });

      // Set refresh token as HTTP-only cookie
      res.cookie("refreshtoken", refreshToken, {
        httpOnly: true,
        path: "/user/refresh_token",
      });

      res.json({ accesstoken: accessToken });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },

  getUserProfile: async (req, res) => {
    try {
      const userId = req.user.id; // Assuming user ID is extracted from a JWT token

      const user = await User.findById(userId).select("-password");
      if (!user) {
        return res.status(404).json({ msg: "User not found" });
      }

      res.json({
        name: user.name,
        email: user.email,
        templates: user.templates,
      });
      console.log(req.body); // Check the structure of the data
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },
};

// Generate Access Token
const createAccessToken = (payload) => {
  return jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: "1d",
  });
};

// Generate Refresh Token
const createRefreshToken = (payload) => {
  return jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: "7d",
  });
};

module.exports = userCtrl;
