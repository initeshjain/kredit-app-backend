import mongoose, { Schema } from 'mongoose';
import { ITransaction } from '../types';

const TransactionSchema: Schema = new Schema(
    {
        sender: {
            type: String,
            required: [true, 'Sender phone number is required'],
            trim: true
        },
        receiver: {
            type: String,
            required: [true, 'Receiver phone number is required'],
            trim: true
        },
        amount: {
            type: Number,
            required: [true, 'Amount is required'],
            min: [0, 'Amount must be positive']
        },
        date: {
            type: Date,
            default: Date.now
        },
        transactionDate: {
            type: Date,
            default: Date.now
        },
        note: {
            type: String,
            default: '',
            trim: true
        },
        smsStatus: {
            sent: {
                type: Boolean,
                default: false
            },
            sentAt: {
                type: Date
            },
            error: {
                type: String
            }
        }
    },
    {
        timestamps: true
    }
);

// Index for faster queries
TransactionSchema.index({ sender: 1, receiver: 1 });
TransactionSchema.index({ createdAt: -1 });

export default mongoose.model<ITransaction>('Transaction', TransactionSchema);
