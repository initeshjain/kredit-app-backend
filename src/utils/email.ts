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

export const sendOTP = async (email: string, otp: string): Promise<boolean> => {
    try {
        const mailOptions = {
            from: "noreply@noobgeek.in",
            to: email,
            subject: 'Your Kredit App OTP',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background-color: #ffcd1c; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
                        <h1 style="color: #000000; margin: 0;">Kredit App</h1>
                    </div>
                    <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
                        <h2 style="color: #333333; margin-top: 0;">OTP Verification</h2>
                        <p style="color: #666666; font-size: 16px; line-height: 1.6;">
                            Your OTP for Kredit App login is:
                        </p>
                        <div style="background-color: #f5f5f5; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
                            <h1 style="color: #ffcd1c; font-size: 36px; letter-spacing: 8px; margin: 0; font-weight: bold;">${otp}</h1>
                        </div>
                        <p style="color: #666666; font-size: 14px; line-height: 1.6;">
                            This OTP will expire in 10 minutes. Please do not share this code with anyone.
                        </p>
                        <p style="color: #999999; font-size: 12px; margin-top: 30px; border-top: 1px solid #e0e0e0; padding-top: 20px;">
                            If you didn't request this OTP, please ignore this email.
                        </p>
                    </div>
                </div>
            `
        };

        // await transporter.sendMail(mailOptions);
        resend.emails.send({
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

