import { Router, Request, Response } from 'express';
import Transaction from '../models/Transaction';
import { ICreateTransactionDTO, ISmsStatus } from '../types';

const router: Router = Router();

// Get all transactions between two users
router.get('/between/:user1/:user2', async (req: Request, res: Response): Promise<void> => {
    try {
        const { user1, user2 } = req.params;

        if (!user1 || !user2) {
            res.status(400).json({ error: 'Both user1 and user2 are required' });
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
router.post('/', async (req: Request, res: Response): Promise<void> => {
    try {
        const transactionData: ICreateTransactionDTO = req.body;

        if (!transactionData.sender || !transactionData.receiver || !transactionData.amount) {
            res.status(400).json({ error: 'Sender, receiver, and amount are required' });
            return;
        }

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

// Get balance between two users
router.get('/balance/:user1/:user2', async (req: Request, res: Response): Promise<void> => {
    try {
        const { user1, user2 } = req.params;

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

// Get all contacts with transactions and balances for a user
router.get('/dashboard/:userPhone', async (req: Request, res: Response): Promise<void> => {
    try {
        const { userPhone } = req.params;

        if (!userPhone) {
            res.status(400).json({ error: 'User phone is required' });
            return;
        }

        // Get all transactions where user is either sender or receiver
        const transactions = await Transaction.find({
            $or: [
                { sender: userPhone },
                { receiver: userPhone }
            ]
        }).sort({ date: -1 });

        // Group transactions by contact (other party)
        const contactMap = new Map<string, {
            phone: string;
            transactions: any[];
            balance: number;
            lastTransactionDate: Date;
        }>();

        transactions.forEach(tx => {
            const otherParty = tx.sender === userPhone ? tx.receiver : tx.sender;
            
            if (!contactMap.has(otherParty)) {
                contactMap.set(otherParty, {
                    phone: otherParty,
                    transactions: [],
                    balance: 0,
                    lastTransactionDate: tx.date
                });
            }

            const contact = contactMap.get(otherParty)!;
            contact.transactions.push(tx);
            
            // Calculate balance
            if (tx.sender === userPhone) {
                contact.balance += tx.amount; // User sent money (they owe user)
            } else {
                contact.balance -= tx.amount; // User received money (user owes them)
            }

            // Update last transaction date
            if (tx.date > contact.lastTransactionDate) {
                contact.lastTransactionDate = tx.date;
            }
        });

        // Convert map to array and calculate totals
        const contacts = Array.from(contactMap.values()).map(contact => ({
            ...contact,
            lastTransactionDate: contact.lastTransactionDate.toISOString()
        }));
        
        let totalToGive = 0; // Negative balances (user owes)
        let totalToReceive = 0; // Positive balances (they owe user)

        contacts.forEach(contact => {
            if (contact.balance < 0) {
                totalToGive += Math.abs(contact.balance);
            } else if (contact.balance > 0) {
                totalToReceive += contact.balance;
            }
        });

        const finalAmount = totalToReceive - totalToGive;

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
