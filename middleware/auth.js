const jwt = require("jsonwebtoken");

const auth = (req, res, next) => {
  try {
    const token = req.header("Authorization").replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ msg: "No token, authorization denied." });
    }

    const verified = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    req.user = verified; // Attach user payload to the request object
    next();
  } catch (err) {
    return res.status(401).json({ msg: "Invalid or expired token." });
  }
};

module.exports = auth;
