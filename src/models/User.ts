import mongoose, { Schema } from 'mongoose';

export interface IUser extends mongoose.Document {
    countryCode: string;
    phone: string;
    fullPhone: string; // Combined for backward compatibility and queries
    email: string;
    otp?: {
        code: string;
        expiresAt: Date;
        attempts: number;
    };
    createdAt: Date;
    updatedAt: Date;
}

const UserSchema: Schema = new Schema(
    {
        countryCode: {
            type: String,
            required: [true, 'Country code is required'],
            trim: true
        },
        phone: {
            type: String,
            required: [true, 'Phone number is required'],
            trim: true
        },
        fullPhone: {
            type: String,
            required: [true, 'Full phone number is required'],
            unique: true,
            trim: true,
            index: true
        },
        email: {
            type: String,
            required: [true, 'Email is required'],
            unique: true,
            trim: true,
            lowercase: true,
            index: true,
            match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
        },
        otp: {
            code: {
                type: String,
                default: null
            },
            expiresAt: {
                type: Date,
                default: null
            },
            attempts: {
                type: Number,
                default: 0
            }
        }
    },
    {
        timestamps: true
    }
);

// Pre-save hook to ensure fullPhone is set
UserSchema.pre('save', function(next: mongoose.CallbackWithoutResultAndOptionalError) {
    if (this.countryCode && this.phone && !this.fullPhone) {
        this.fullPhone = String(this.countryCode) + String(this.phone);
    }
    next();
});

export default mongoose.model<IUser>('User', UserSchema);

