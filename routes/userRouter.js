const express = require("express");
const userCtrl = require("../controllers/userController");
const auth = require("../middleware/auth");

const router = express.Router();

// Register route
router.post("/register", userCtrl.register);

// Login route
router.post("/login", userCtrl.login);

router.get("/profile", auth, userCtrl.getUserProfile);

module.exports = router;
