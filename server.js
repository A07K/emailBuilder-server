const express = require("express");
const mongoose = require("mongoose");
require("dotenv").config();
const cookieParser = require("cookie-parser");
const fileUpload = require("express-fileupload");
const cors = require("cors");
const userRouter = require("./routes/userRouter");
const templateRoutes = require("./routes/templates");
const imageRoutes = require("./routes/imageRoutes");
const renderTemplateRoutes = require("./routes/renderTemplateRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());
app.use(
  fileUpload({
    useTempFiles: true,
  })
);
app.use("/user", userRouter);
app.use("/api", templateRoutes);
app.use("/api", require("./routes/templateById"));
app.use("/api", imageRoutes);
app.use("/api", renderTemplateRoutes);

// Default route
app.get("/", (req, res) => {
  res.json({ msg: "Server is up and running!" });
});

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("MONGODB_URI is not defined in the environment variables");
  process.exit(1);
}

mongoose
  .connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log(`Connected to MongoDB database: EmailBuilder`))
  .catch((err) => console.error("MongoDB connection error:", err));

mongoose.connection.on("error", (err) => {
  console.error(`MongoDB connection error: ${err}`);
});

mongoose.connection.on("connected", () => {
  console.log("Connected to MongoDB database: EmailBuilder");
});

mongoose.connection.on("disconnected", () => {
  console.log("Disconnected from MongoDB");
});

// 404 handler
app.use((req, res) => {
  console.log(`404 Not Found: ${req.method} ${req.url}`);
  res.status(404).send("Not Found");
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
