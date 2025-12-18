import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key-change-in-production';
const ACCESS_TOKEN_EXPIRY: string = process.env.ACCESS_TOKEN_EXPIRY || '30m';
const REFRESH_TOKEN_EXPIRY: string = process.env.REFRESH_TOKEN_EXPIRY || '7d';

export interface ITokenPayload {
    phone: string;
    email: string;
    userId: string;
}

export const generateAccessToken = (payload: ITokenPayload): string => {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY } as jwt.SignOptions);
};

export const generateRefreshToken = (payload: ITokenPayload): string => {
    return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY } as jwt.SignOptions);
};

export const verifyAccessToken = (token: string): ITokenPayload => {
    try {
        return jwt.verify(token, JWT_SECRET) as ITokenPayload;
    } catch (error) {
        throw new Error('Invalid or expired access token');
    }
};

export const verifyRefreshToken = (token: string): ITokenPayload => {
    try {
        return jwt.verify(token, JWT_REFRESH_SECRET) as ITokenPayload;
    } catch (error) {
        throw new Error('Invalid or expired refresh token');
    }
};

