import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import discoverRoutes from "./routes/discoverRoutes.js";
const app = express();

app.use(cors());
app.use(express.json());
app.set("view engine", "ejs");
app.set("views", path.join(process.cwd(), "views"));

app.get("/", (req, res) => {
  res.render("login");
});

app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/discover", discoverRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});