import mongoose, { Schema } from 'mongoose';

export interface IUser extends mongoose.Document {
    phone: string;
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
        phone: {
            type: String,
            required: [true, 'Phone number is required'],
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

export default mongoose.model<IUser>('User', UserSchema);

