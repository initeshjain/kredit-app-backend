// import nodemailer from 'nodemailer';
import { Resend } from 'resend';

// const EMAIL_USER = process.env.EMAIL_USER || '';
// const EMAIL_PASS = process.env.EMAIL_PASS || '';
// const EMAIL_FROM = process.env.EMAIL_FROM || EMAIL_USER;

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';

const resend = new Resend(RESEND_API_KEY);

// Create transporter
// const transporter = nodemailer.createTransport({
//     service: 'gmail', // Change to your email service if needed
//     auth: {
//         user: EMAIL_USER,
//         pass: EMAIL_PASS
//     }
// });

// Theme colors matching the app theme
const THEME_COLORS = {
    primary: '#234f9d',
    primaryLight: '#3B82F6',
    background: '#f2f4f7',
    surface: '#FFFFFF',
    textDark: '#020617',
    textMuted: '#475569',
    textLight: '#94a3b8',
    border: '#E2E8F0',
};

export const sendOTP = async (email: string, otp: string): Promise<boolean> => {
    try {
        const mailOptions = {
            from: "noreply@noobgeek.in",
            to: email,
            subject: 'Your Kredit App OTP',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background-color: ${THEME_COLORS.primary}; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
                        <h1 style="color: ${THEME_COLORS.surface}; margin: 0; font-size: 28px; font-weight: bold;">Kredit App</h1>
                    </div>
                    <div style="background-color: ${THEME_COLORS.surface}; padding: 30px; border: 1px solid ${THEME_COLORS.border}; border-top: none; border-radius: 0 0 10px 10px;">
                        <h2 style="color: ${THEME_COLORS.textDark}; margin-top: 0; font-size: 24px;">OTP Verification</h2>
                        <p style="color: ${THEME_COLORS.textMuted}; font-size: 16px; line-height: 1.6;">
                            Your OTP for Kredit App login is:
                        </p>
                        <div style="background-color: ${THEME_COLORS.background}; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0; border: 2px solid ${THEME_COLORS.primaryLight};">
                            <h1 style="color: ${THEME_COLORS.primary}; font-size: 36px; letter-spacing: 8px; margin: 0; font-weight: bold;">${otp}</h1>
                        </div>
                        <p style="color: ${THEME_COLORS.textMuted}; font-size: 14px; line-height: 1.6;">
                            This OTP will expire in 10 minutes. Please do not share this code with anyone.
                        </p>
                        <p style="color: ${THEME_COLORS.textLight}; font-size: 12px; margin-top: 30px; border-top: 1px solid ${THEME_COLORS.border}; padding-top: 20px;">
                            If you didn't request this OTP, please ignore this email.
                        </p>
                    </div>
                </div>
            `
        };

        // await transporter.sendMail(mailOptions);
        await resend.emails.send({
            from: mailOptions.from,
            to: mailOptions.to,
            subject: mailOptions.subject,
            html: mailOptions.html
        });
        return true;
    } catch (error) {
        console.error('Error sending OTP email:', error);
        return false;
    }
};

