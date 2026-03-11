import { createContext, useContext, useState, ReactNode, useEffect } from "react";

export interface Transaction {
  id: string;
  userId: string;
  username: string;
  type: "deposit" | "withdrawal" | "bet_placement" | "bet_payout" | "admin_adjustment";
  amount: number;
  status: "completed" | "pending" | "failed" | "cancelled";
  method: string;
  date: string;
  mpesaNumber?: string;
  mpesaReceipt?: string;
  externalReference?: string;
  adminNotes?: string;
  completedAt?: string;
}

interface TransactionContextType {
  transactions: Transaction[];
  addTransaction: (transaction: Transaction) => Promise<void>;
  updateTransactionStatus: (transactionId: string, status: Transaction["status"], phone?: string) => Promise<void>;
  getUserTransactions: (userId: string) => Transaction[];
  getAllTransactions: () => Transaction[];
  fetchTransactions: (userId: string) => Promise<void>;
  isLoading: boolean;
}

const TransactionContext = createContext<TransactionContextType | undefined>(undefined);

export function TransactionProvider({ children }: { children: ReactNode }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch transactions from server for a specific user
  const fetchTransactions = async (userId: string) => {
    try {
      setIsLoading(true);
      const apiUrl = import.meta.env.VITE_API_URL || 'https://server-tau-puce.vercel.app';
      const response = await fetch(`${apiUrl}/api/admin/transactions/user/${userId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        console.warn('⚠️ Failed to fetch transactions from server');
        return;
      }

      const data = await response.json();
      if (data.success && data.transactions) {
        // Transform server transactions to match frontend format
        const transformedTransactions = data.transactions.map((tx: any) => ({
          id: tx.id,
          userId: tx.user_id,
          username: data.user?.username || 'User',
          type: tx.type,
          amount: tx.amount,
          status: tx.status,
          method: tx.method || 'M-Pesa',
          date: new Date(tx.created_at).toLocaleString(),
          mpesaReceipt: tx.mpesa_receipt,
          externalReference: tx.external_reference,
          adminNotes: tx.admin_notes,
          completedAt: tx.completed_at
        }));

        setTransactions(transformedTransactions);
        console.log(`✅ Fetched ${transformedTransactions.length} transactions from server for user ${userId}`);
      }
    } catch (error) {
      console.error('❌ Error fetching transactions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addTransaction = async (transaction: Transaction) => {
    // Add to local state immediately for UI feedback
    setTransactions((prev) => [transaction, ...prev]);
    
    // Optionally sync to database (transactions are already created by payment endpoint)
    console.log('📊 Transaction added locally:', transaction.id);
  };

  const updateTransactionStatus = async (
    transactionId: string,
    status: Transaction["status"],
    phone?: string
  ) => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'https://server-tau-puce.vercel.app';
      const endpoint = status === 'failed'
        ? `${apiUrl}/api/admin/transactions/${transactionId}/mark-rejected`
        : `${apiUrl}/api/admin/transactions/${transactionId}/mark-completed`;

      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone || '' })
      });

      const data = await response.json();
      if (data.success) {
        // Update local state to reflect the change immediately
        setTransactions((prev) =>
          prev.map((t) => (t.id === transactionId ? { ...t, status } : t))
        );
        console.log(`✅ Transaction ${transactionId} marked as ${status} on server`);
      } else {
        console.error('❌ Failed to update transaction status:', data.message);
        throw new Error(data.message);
      }
    } catch (error) {
      console.error('❌ Error updating transaction status:', error);
      throw error;
    }
  };

  const getUserTransactions = (userId: string) => {
    return transactions.filter((t) => t.userId === userId);
  };

  const getAllTransactions = () => {
    return transactions;
  };

  return (
    <TransactionContext.Provider
      value={{
        transactions,
        addTransaction,
        updateTransactionStatus,
        getUserTransactions,
        getAllTransactions,
        fetchTransactions,
        isLoading
      }}
    >
      {children}
    </TransactionContext.Provider>
  );
}

export function useTransactions() {
  const context = useContext(TransactionContext);
  if (context === undefined) {
    throw new Error("useTransactions must be used within a TransactionProvider");
  }
  return context;
}
