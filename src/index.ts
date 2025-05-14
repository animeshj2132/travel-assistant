import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import path from "path";
import { swaggerSpec } from "./config/swagger";
import chatRoutes from "./routes/chat.routes";
import userRoutes from "./routes/user.routes";
import { prisma } from "./config/prisma";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Add a simple diagnostic endpoint
app.get("/api/health", async (req, res) => {
    try {
        // Test database connection
        const flightCount = await prisma.flight.count();
        const hotelCount = await prisma.hotel.count();
        const restaurantCount = await prisma.restaurant.count();

        res.json({
            status: "ok",
            database: "connected",
            counts: {
                flights: flightCount,
                hotels: hotelCount,
                restaurants: restaurantCount
            },
            environment: process.env.NODE_ENV || "development",
            database_url_set: !!process.env.DATABASE_URL
        });
    } catch (error: any) {
        res.status(500).json({
            status: "error",
            database: "disconnected",
            error: error.message,
            database_url_set: !!process.env.DATABASE_URL
        });
    }
});

app.use("/", chatRoutes);
app.use("/", userRoutes);
app.use(express.static(path.join(__dirname, "../public")));
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(` Server running on port ${PORT}`));
