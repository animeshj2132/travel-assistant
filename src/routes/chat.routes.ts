import { Router } from "express";
import { handleChat } from "../controller/chat.controller";
import { getHistory } from "../controller/chat.controller";
import { requireAuth, optionalAuth } from "../middleware/auth.middleware";

const router = Router();

/**
 * @swagger
 * /chat:
 *   post:
 *     summary: Chat with the travel assistant
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [prompt]
 *             properties:
 *               prompt:
 *                 type: string
 *                 example: Show me flights from Delhi to Mumbai tomorrow
 *     responses:
 *       200:
 *         description: AI or DB response with results or fallback
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 intent:
 *                   type: string
 *                 message:
 *                   type: string
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                 fallback:
 *                   type: boolean
 *       400:
 *         description: Invalid or missing prompt
 */
router.post("/chat", optionalAuth, handleChat);

/**
 * @swagger
 * /auth/history:
 *   get:
 *     summary: Get recent user queries
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User's past queries
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 logs:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       prompt:
 *                         type: string
 *                       intent:
 *                         type: string
 *       401:
 *         description: Unauthorized
 */
router.get("/auth/history", requireAuth, getHistory);

export default router;
