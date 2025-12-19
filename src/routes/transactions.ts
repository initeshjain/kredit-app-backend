import { Router, Request, Response } from 'express';
import Transaction from '../models/Transaction';
import { ICreateTransactionDTO, ISmsStatus } from '../types';
import { authMiddleware } from '../middleware/auth';

const router: Router = Router();

// All transaction routes require authentication
router.use(authMiddleware);

// Get all transactions between authenticated user and another user
router.get('/between/:user2', async (req: Request, res: Response): Promise<void> => {
    try {
        const user1 = req.user!.phone; // Authenticated user's phone
        const { user2 } = req.params;

        if (!user2) {
            res.status(400).json({ error: 'Other user phone is required' });
            return;
        }

        const transactions = await Transaction.find({
            $or: [
                { sender: user1, receiver: user2 },
                { sender: user2, receiver: user1 }
            ]
        }).sort({ date: 1 });

        res.json(transactions);
    } catch (error) {
        const err = error as Error;
        res.status(500).json({ error: err.message });
    }
});

// Create new transaction
// If isReceive is true, the contact is the sender and authenticated user is the receiver
// If isReceive is false (default), authenticated user is the sender and contact is the receiver
router.post('/', async (req: Request, res: Response): Promise<void> => {
    try {
        const authenticatedUser = req.user!.phone; // Authenticated user's phone
        const { receiver, amount, date, note, isReceive } = req.body;

        if (!receiver || !amount) {
            res.status(400).json({ error: 'Receiver and amount are required' });
            return;
        }

        // If isReceive is true, swap sender and receiver
        // Contact sends to authenticated user
        const sender = isReceive ? receiver : authenticatedUser;
        const actualReceiver = isReceive ? authenticatedUser : receiver;

        const transactionData: ICreateTransactionDTO = {
            sender,
            receiver: actualReceiver,
            amount,
            date: date ? new Date(date) : undefined,
            note: note || ''
        };

        const transaction = new Transaction(transactionData);
        await transaction.save();

        res.status(201).json(transaction);
    } catch (error) {
        const err = error as Error;
        res.status(400).json({ error: err.message });
    }
});

// Update SMS status
router.patch('/:id/sms-status', async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const smsStatus: ISmsStatus = req.body;

        const transaction = await Transaction.findByIdAndUpdate(
            id,
            { smsStatus },
            { new: true, runValidators: true }
        );

        if (!transaction) {
            res.status(404).json({ error: 'Transaction not found' });
            return;
        }

        res.json(transaction);
    } catch (error) {
        const err = error as Error;
        res.status(400).json({ error: err.message });
    }
});

// Get balance between authenticated user and another user
router.get('/balance/:user2', async (req: Request, res: Response): Promise<void> => {
    try {
        const user1 = req.user!.phone; // Authenticated user's phone
        const { user2 } = req.params;

        if (!user2) {
            res.status(400).json({ error: 'Other user phone is required' });
            return;
        }

        const transactions = await Transaction.find({
            $or: [
                { sender: user1, receiver: user2 },
                { sender: user2, receiver: user1 }
            ]
        });

        const balance = transactions.reduce((total, tx) => {
            if (tx.sender === user1) {
                return total + tx.amount;
            } else {
                return total - tx.amount;
            }
        }, 0);

        res.json({ balance });
    } catch (error) {
        const err = error as Error;
        res.status(500).json({ error: err.message });
    }
});

// Get all contacts with transactions and balances for authenticated user
router.get('/dashboard', async (req: Request, res: Response): Promise<void> => {
    try {
        const userPhone = req.user!.phone; // Authenticated user's phone

        // Use aggregation to calculate balances and stats efficiently
        // This avoids loading all transactions into memory
        const contactStats = await Transaction.aggregate([
            {
                $match: {
                    $or: [
                        { sender: userPhone },
                        { receiver: userPhone }
                    ]
                }
            },
            {
                $group: {
                    _id: {
                        $cond: [
                            { $eq: ['$sender', userPhone] },
                            '$receiver',
                            '$sender'
                        ]
                    },
                    balance: {
                        $sum: {
                            $cond: [
                                { $eq: ['$sender', userPhone] },
                                '$amount',  // User sent money (they owe user)
                                { $multiply: ['$amount', -1] }  // User received money (user owes them)
                            ]
                        }
                    },
                    transactionCount: { $sum: 1 },
                    lastTransactionDate: { $max: '$date' }
                }
            },
            {
                $project: {
                    _id: 0,
                    phone: '$_id',
                    balance: 1,
                    transactionCount: 1,
                    lastTransactionDate: 1
                }
            }
        ]);

        // Calculate totals
        let totalToGive = 0; // Negative balances (user owes)
        let totalToReceive = 0; // Positive balances (they owe user)

        contactStats.forEach(contact => {
            if (contact.balance < 0) {
                totalToGive += Math.abs(contact.balance);
            } else if (contact.balance > 0) {
                totalToReceive += contact.balance;
            }
        });

        const finalAmount = totalToReceive - totalToGive;

        // Convert dates to ISO strings
        const contacts = contactStats.map(contact => ({
            phone: contact.phone,
            balance: contact.balance,
            transactionCount: contact.transactionCount,
            lastTransactionDate: contact.lastTransactionDate.toISOString()
        }));

        res.json({
            contacts,
            stats: {
                totalToGive,
                totalToReceive,
                finalAmount
            }
        });
    } catch (error) {
        const err = error as Error;
        res.status(500).json({ error: err.message });
    }
});

export default router;
