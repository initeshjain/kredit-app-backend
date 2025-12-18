import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import User from '../models/User';
import { sendOTP } from '../utils/email';
import { generateAccessToken, generateRefreshToken, ITokenPayload } from '../utils/jwt';

const router: Router = Router();

// Rate limiting for OTP requests
const otpRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 3, // 3 requests per window
    message: 'Too many OTP requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
});

// Rate limiting for OTP verification
const verifyRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    message: 'Too many verification attempts, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
});

// Generate 6-digit OTP
const generateOTP = (): string => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// Login/Register - Send OTP
router.post('/login', otpRateLimiter, async (req: Request, res: Response): Promise<void> => {
    try {
        const { phone, email } = req.body;

        if (!phone || !email) {
            res.status(400).json({ error: 'Phone number and email are required' });
            return;
        }

        // Validate email format
        const emailRegex = /^\S+@\S+\.\S+$/;
        if (!emailRegex.test(email)) {
            res.status(400).json({ error: 'Invalid email format' });
            return;
        }

        // Validate phone format (should start with +)
        if (!phone.startsWith('+')) {
            res.status(400).json({ error: 'Phone number must start with +' });
            return;
        }

        // Find or create user
        let user = await User.findOne({ phone });

        if (user) {
            // User exists - update email if different
            if (user.email !== email.toLowerCase()) {
                // Check if email is already taken by another user
                const emailExists = await User.findOne({ email: email.toLowerCase() });
                if (emailExists && emailExists.phone !== phone) {
                    res.status(400).json({ error: 'Email is already registered with another phone number' });
                    return;
                }
                user.email = email.toLowerCase();
            }
        } else {
            // Check if email is already taken
            const emailExists = await User.findOne({ email: email.toLowerCase() });
            if (emailExists) {
                res.status(400).json({ error: 'Email is already registered' });
                return;
            }

            // Create new user
            user = new User({
                phone,
                email: email.toLowerCase()
            });
        }

        // Generate OTP
        const otp = generateOTP();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        // Save OTP to user
        user.otp = {
            code: otp,
            expiresAt,
            attempts: 0
        };

        await user.save();

        // Send OTP via email
        const emailSent = await sendOTP(user.email, otp);

        if (!emailSent) {
            res.status(500).json({ error: 'Failed to send OTP email. Please check your email configuration.' });
            return;
        }

        res.json({
            message: 'OTP sent to your email',
            phone: user.phone,
            email: user.email
        });
    } catch (error) {
        const err = error as Error;
        console.error('Login error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Verify OTP
router.post('/verify-otp', verifyRateLimiter, async (req: Request, res: Response): Promise<void> => {
    try {
        const { phone, otp } = req.body;

        if (!phone || !otp) {
            res.status(400).json({ error: 'Phone number and OTP are required' });
            return;
        }

        const user = await User.findOne({ phone });

        if (!user) {
            res.status(404).json({ error: 'User not found. Please request OTP first.' });
            return;
        }

        if (!user.otp || !user.otp.code) {
            res.status(400).json({ error: 'No OTP found. Please request a new OTP.' });
            return;
        }

        // Check if OTP is expired
        if (user.otp.expiresAt && new Date() > user.otp.expiresAt) {
            res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
            return;
        }

        // Check attempts
        if (user.otp.attempts >= 5) {
            res.status(429).json({ error: 'Too many failed attempts. Please request a new OTP.' });
            return;
        }

        // Verify OTP
        if (user.otp.code !== otp) {
            user.otp.attempts = (user.otp.attempts || 0) + 1;
            await user.save();
            res.status(400).json({ error: 'Invalid OTP', attemptsLeft: 5 - user.otp.attempts });
            return;
        }

        // OTP verified - clear OTP and generate tokens
        user.otp = undefined;
        await user.save();

        const tokenPayload: ITokenPayload = {
            phone: user.phone,
            email: user.email,
            userId: user._id.toString()
        };

        const accessToken = generateAccessToken(tokenPayload);
        const refreshToken = generateRefreshToken(tokenPayload);

        res.json({
            message: 'OTP verified successfully',
            accessToken,
            refreshToken,
            user: {
                phone: user.phone,
                email: user.email
            }
        });
    } catch (error) {
        const err = error as Error;
        console.error('Verify OTP error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Refresh token
router.post('/refresh-token', async (req: Request, res: Response): Promise<void> => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            res.status(400).json({ error: 'Refresh token is required' });
            return;
        }

        try {
            const { verifyRefreshToken } = await import('../utils/jwt');
            const decoded = verifyRefreshToken(refreshToken);

            // Verify user still exists
            const user = await User.findOne({ phone: decoded.phone });
            if (!user) {
                res.status(404).json({ error: 'User not found' });
                return;
            }

            // Generate new tokens
            const tokenPayload: ITokenPayload = {
                phone: user.phone,
                email: user.email,
                userId: user._id.toString()
            };

            const newAccessToken = generateAccessToken(tokenPayload);
            const newRefreshToken = generateRefreshToken(tokenPayload);

            res.json({
                accessToken: newAccessToken,
                refreshToken: newRefreshToken
            });
        } catch (error) {
            res.status(401).json({ error: 'Invalid or expired refresh token' });
            return;
        }
    } catch (error) {
        const err = error as Error;
        console.error('Refresh token error:', err);
        res.status(500).json({ error: err.message });
    }
});

export default router;

