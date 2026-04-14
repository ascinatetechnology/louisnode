import jwt from "jsonwebtoken";

const getTokenFromRequest = (req) => {
  const authHeader = req.headers.authorization;

  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.split(" ")[1];
  }

  const cookieHeader = req.headers.cookie;

  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(";").map(item => item.trim());
  const adminTokenCookie = cookies.find(item => item.startsWith("adminToken="));

  if (!adminTokenCookie) {
    return null;
  }

  return decodeURIComponent(adminTokenCookie.split("=")[1]);
};

export const verifyAdminToken = (req, res, next) => {
  const token = getTokenFromRequest(req);

  if (!token) {
    return res.status(401).json({
      message: "Admin token required"
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role !== "admin" && decoded.role !== "super_admin") {
      return res.status(403).json({
        message: "Admin access denied"
      });
    }

    req.admin = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      message: "Invalid admin token"
    });
  }
};

export const verifyAdminPage = (req, res, next) => {
  const token = getTokenFromRequest(req);

  if (!token) {
    return res.redirect("/");
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role !== "admin" && decoded.role !== "super_admin") {
      return res.redirect("/");
    }

    req.admin = decoded;
    next();
  } catch (error) {
    return res.redirect("/");
  }
};
