import { Document, Types } from 'mongoose';

export interface ITransaction extends Document {
    _id: Types.ObjectId;
    sender: string;
    receiver: string;
    amount: number;
    date: Date;
    note: string;
    smsStatus: {
        sent: boolean;
        sentAt?: Date;
        error?: string;
    };
    createdAt: Date;
    updatedAt: Date;
}

export interface ISmsStatus {
    sent: boolean;
    sentAt?: Date;
    error?: string;
}

export interface ICreateTransactionDTO {
    sender: string;
    receiver: string;
    amount: number;
    date?: Date;
    note?: string;
}
