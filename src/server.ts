import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/database';
import transactionRoutes from './routes/transactions';
import authRoutes from './routes/auth';

dotenv.config();

const app: Application = express();
const PORT: number = parseInt(process.env.PORT || '8080', 10);

// Logger middleware
const logger = (req: Request, res: Response, next: NextFunction): void => {
    const start = Date.now();
    const timestamp = new Date().toISOString();
    
    // Log incoming request
    console.log(`[${timestamp}] ${req.method} ${req.path}`);
    if (req?.body && Object.keys(req.query).length > 0) {
        console.log(`  Query:`, req.query);
    }
    if (req?.body && Object.keys(req.body).length > 0 && req.path !== '/api/auth/login') {
        // Don't log sensitive data like passwords/OTPs
        const sanitizedBody = { ...req.body };
        if (sanitizedBody.otp) sanitizedBody.otp = '***';
        if (sanitizedBody.password) sanitizedBody.password = '***';
        console.log(`  Body:`, sanitizedBody);
    }
    
    // Log response when finished
    res.on('finish', () => {
        const duration = Date.now() - start;
        const statusColor = res.statusCode >= 400 ? '❌' : res.statusCode >= 300 ? '⚠️' : '✅';
        console.log(`[${new Date().toISOString()}] ${statusColor} ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
    });
    
    next();
};

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(logger);

// Connect to MongoDB
connectDB();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);

// Health check
app.get('/', (req: Request, res: Response) => {
    res.json({
        message: 'Kredit API is running!',
        timestamp: new Date().toISOString()
    });
});

// 404 handler
app.use((req: Request, res: Response) => {
    res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on:`);
});
