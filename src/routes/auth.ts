import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import User from '../models/User';
import { sendOTP } from '../utils/email';
import { generateAccessToken, generateRefreshToken, ITokenPayload } from '../utils/jwt';
import { authMiddleware } from '../middleware/auth';

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

// Helper function to parse phone number into country code and phone
const parsePhoneNumber = (fullPhone: string): { countryCode: string; phone: string } | null => {
    if (!fullPhone) return null;
    
    // Remove all non-digit characters except +
    const cleaned = fullPhone.replace(/[^\d+]/g, '');
    
    // If starts with +, extract country code (1-3 digits)
    if (cleaned.startsWith('+')) {
        const withoutPlus = cleaned.substring(1);
        // Try to match common country codes
        // 1 digit: +1 (USA/Canada)
        if (withoutPlus.startsWith('1') && withoutPlus.length >= 11) {
            return { countryCode: '+1', phone: withoutPlus.substring(1) };
        }
        // 2 digits: +91 (India), +44 (UK), etc.
        const twoDigitCodes = ['91', '44', '86', '81', '49', '33', '39', '34', '61', '7'];
        for (const code of twoDigitCodes) {
            if (withoutPlus.startsWith(code) && withoutPlus.length >= (code.length + 10)) {
                return { countryCode: `+${code}`, phone: withoutPlus.substring(code.length) };
            }
        }
        // 3 digits: less common
        if (withoutPlus.length >= 13) {
            return { countryCode: `+${withoutPlus.substring(0, 3)}`, phone: withoutPlus.substring(3) };
        }
    }
    
    // If no +, assume it's already just the phone number (default to +91 for India)
    if (cleaned.length === 10) {
        return { countryCode: '+91', phone: cleaned };
    }
    
    return null;
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

        // Parse phone number
        const parsed = parsePhoneNumber(phone);
        if (!parsed) {
            res.status(400).json({ error: 'Invalid phone number format' });
            return;
        }

        const { countryCode, phone: phoneNumber } = parsed;
        const fullPhone = countryCode + phoneNumber;

        // Find or create user by fullPhone
        let user = await User.findOne({ fullPhone });

        if (user) {
            // User exists - update email and phone details if different
            if (user.email !== email.toLowerCase()) {
                // Check if email is already taken by another user
                const emailExists = await User.findOne({ email: email.toLowerCase() });
                if (emailExists && emailExists.fullPhone !== fullPhone) {
                    res.status(400).json({ error: 'Email is already registered with another phone number' });
                    return;
                }
                user.email = email.toLowerCase();
            }
            // Update country code and phone if changed
            user.countryCode = countryCode;
            user.phone = phoneNumber;
        } else {
            // Check if email is already taken
            const emailExists = await User.findOne({ email: email.toLowerCase() });
            if (emailExists) {
                res.status(400).json({ error: 'Email is already registered' });
                return;
            }

            // Create new user
            user = new User({
                countryCode,
                phone: phoneNumber,
                fullPhone,
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
            phone: user.fullPhone,
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

        // Parse phone to get fullPhone for lookup
        const parsed = parsePhoneNumber(phone);
        if (!parsed) {
            res.status(400).json({ error: 'Invalid phone number format' });
            return;
        }
        const fullPhone = parsed.countryCode + parsed.phone;
        
        const user = await User.findOne({ fullPhone });

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
            phone: user.fullPhone, // Use fullPhone for backward compatibility
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
                phone: user.fullPhone,
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

            // Verify user still exists (decoded.phone is fullPhone)
            const user = await User.findOne({ fullPhone: decoded.phone });
            if (!user) {
                res.status(404).json({ error: 'User not found' });
                return;
            }

            // Generate new tokens
            const tokenPayload: ITokenPayload = {
                phone: user.fullPhone,
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

// Verify user exists and token is valid
router.get('/verify', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    try {
        const userPhone = req.user!.phone; // Authenticated user's phone (fullPhone)
        
        // Verify user exists in database
        const user = await User.findOne({ fullPhone: userPhone });
        
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        
        res.json({
            valid: true,
            user: {
                phone: user.fullPhone,
                email: user.email,
                name: user.name || ''
            }
        });
    } catch (error) {
        const err = error as Error;
        console.error('Verify user error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get user profile
router.get('/profile', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    try {
        const userPhone = req.user!.phone;
        const user = await User.findOne({ fullPhone: userPhone });
        
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        
        res.json({
            phone: user.fullPhone,
            email: user.email,
            name: user.name || ''
        });
    } catch (error) {
        const err = error as Error;
        console.error('Get profile error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Update user profile
router.put('/profile', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    try {
        const userPhone = req.user!.phone;
        const { name } = req.body;
        
        const user = await User.findOne({ fullPhone: userPhone });
        
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        
        if (name !== undefined) {
            user.name = name.trim() || '';
        }
        
        await user.save();
        
        res.json({
            phone: user.fullPhone,
            email: user.email,
            name: user.name || ''
        });
    } catch (error) {
        const err = error as Error;
        console.error('Update profile error:', err);
        res.status(500).json({ error: err.message });
    }
});

export default router;

