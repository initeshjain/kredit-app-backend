import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/database';
import transactionRoutes from './routes/transactions';

dotenv.config();

const app: Application = express();
const PORT: number = parseInt(process.env.PORT || '8080', 10);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect to MongoDB
connectDB();

// Routes
app.use('/api/transactions', transactionRoutes);

// Health check
app.get('/', (req: Request, res: Response) => {
    res.json({
        message: 'OkCredit API is running!',
        timestamp: new Date().toISOString()
    });
});

// 404 handler
app.use((req: Request, res: Response) => {
    res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
