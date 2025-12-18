import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, ITokenPayload } from '../utils/jwt';

// Extend Express Request to include user
declare global {
    namespace Express {
        interface Request {
            user?: ITokenPayload;
        }
    }
}

export const authMiddleware = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({ error: 'No token provided' });
            return;
        }

        const token = authHeader.substring(7); // Remove 'Bearer ' prefix

        try {
            const decoded = verifyAccessToken(token);
            req.user = decoded;
            next();
        } catch (error) {
            res.status(401).json({ error: 'Invalid or expired token' });
            return;
        }
    } catch (error) {
        res.status(401).json({ error: 'Authentication failed' });
        return;
    }
};

