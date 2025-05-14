import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../config/prisma";

const JWT_SECRET = process.env.JWT_SECRET!;

export const signup = async (req: Request, res: Response): Promise<void> => {
    const { email } = req.body;
    if (!email) {
        res.status(400).json({ message: "Email is required" });
        return;
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
        res.status(400).json({ message: "Already registered. Please login." });
        return;
    }

    const user = await prisma.user.create({ data: { email } });

    const token = jwt.sign({ userId: user.id, email }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ token });
};

export const login = async (req: Request, res: Response): Promise<void> => {
    const { email } = req.body;
    if (!email) {
        res.status(400).json({ message: "Email is required" });
        return;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
        res.status(404).json({ message: "User not found. Please sign up." });
        return;
    }

    const token = jwt.sign({ userId: user.id, email }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ token });
};
