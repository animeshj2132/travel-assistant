import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

export interface AuthRequest extends Request {
    body: { prompt: any; };
    headers: any;
    user?: { userId: string; email: string };
}

export const optionalAuth = (req: AuthRequest, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        console.log("No authorization header found");
        next();
        return;
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
        console.log("No token in authorization header");
        next();
        return;
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string; email: string };
        req.user = decoded;
        console.log(`Authenticated user: ${decoded.email} (${decoded.userId})`);
    } catch (error) {
        console.error("Token verification error:", error);
        
    }
    next();
};

export const requireAuth = (req: AuthRequest, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        console.log("No authorization header found in required auth");
        res.status(401).json({ message: "Unauthorized: Missing authorization header" });
        return;
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
        console.log("No token in authorization header in required auth");
        res.status(401).json({ message: "Unauthorized: Missing token" });
        return;
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string; email: string };
        req.user = decoded;
        console.log(`Authenticated required user: ${decoded.email} (${decoded.userId})`);
        next();
    } catch (error) {
        console.error("Token verification error in required auth:", error);
        res.status(401).json({ message: "Unauthorized: Invalid or expired token" });
    }
};
