import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

interface UserPresence {
  id: string;
  user_id: string;
  session_id: string;
  last_activity: string;
  login_time: string;
  status: 'online' | 'idle' | 'offline';
  users?: {
    id: string;
    username: string;
    phone_number: string;
    email: string;
    total_bets: number;
    total_winnings: number;
    account_balance: number;
  };
}

interface PresenceContextType {
  sessionId: string | null;
  activeUsers: UserPresence[];
  activeCount: number;
  isTracking: boolean;
  startTracking: (userId: string) => Promise<void>;
  stopTracking: () => Promise<void>;
  subscribeToPresence: () => void;
}

const PresenceContext = createContext<PresenceContextType | undefined>(undefined);

let heartbeatInterval: NodeJS.Timeout | null = null;
let presenceSubscription: any = null;

export function PresenceProvider({ children }: { children: ReactNode }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [activeUsers, setActiveUsers] = useState<UserPresence[]>([]);
  const [activeCount, setActiveCount] = useState(0);
  const [isTracking, setIsTracking] = useState(false);

  const apiUrl = import.meta.env.VITE_API_URL || 'https://server-tau-puce.vercel.app';

  // Start presence tracking (called on login)
  const startTracking = useCallback(async (userId: string) => {
    try {
      console.log('\n🟢 [PresenceContext] Starting presence tracking for user:', userId);

      const userAgent = navigator.userAgent;
      const response = await fetch(`${apiUrl}/api/presence/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          userAgent,
          ipAddress: ''
        })
      });

      const data = await response.json();
      if (data.success && data.sessionId) {
        setSessionId(data.sessionId);
        console.log(`✅ Presence session created: ${data.sessionId}`);

        // Start heartbeat
        startHeartbeat(data.sessionId);
        setIsTracking(true);

        // Subscribe to real-time updates
        subscribeToPresence();
      }
    } catch (error) {
      console.error('❌ Error starting presence tracking:', error);
    }
  }, [apiUrl]);

  // Send heartbeat to keep session alive
  const startHeartbeat = useCallback((sId: string) => {
    // Clear any existing heartbeat
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
    }

    // Send initial heartbeat immediately
    const sendHeartbeat = async () => {
      try {
        await fetch(`${apiUrl}/api/presence/heartbeat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: sId })
        });
      } catch (error) {
        console.warn('⚠️ Heartbeat send failed:', error);
      }
    };

    sendHeartbeat();

    // Send heartbeat every 3 seconds for real-time accuracy
    heartbeatInterval = setInterval(sendHeartbeat, 3000);
  }, [apiUrl]);

  // Stop presence tracking (called on logout)
  const stopTracking = useCallback(async () => {
    try {
      console.log('\n🔴 [PresenceContext] Stopping presence tracking');

      if (sessionId) {
        await fetch(`${apiUrl}/api/presence/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId })
        });
      }

      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }

      setSessionId(null);
      setIsTracking(false);
      setActiveUsers([]);
      setActiveCount(0);
    } catch (error) {
      console.error('❌ Error stopping presence tracking:', error);
    }
  }, [sessionId, apiUrl]);

  // Fetch active users
  const fetchActiveUsers = useCallback(async () => {
    try {
      const response = await fetch(`${apiUrl}/api/presence/active`, {
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();
      if (data.success && data.users) {
        setActiveUsers(data.users);
        setActiveCount(data.activeCount);
        console.log(`👥 Active users updated: ${data.activeCount}`);
      }
    } catch (error) {
      console.warn('⚠️ Error fetching active users:', error);
    }
  }, [apiUrl]);

  // Subscribe to real-time presence updates using Supabase
  const subscribeToPresence = useCallback(() => {
    try {
      // Import supabase dynamically
      import('../services/supabaseClient').then((module) => {
        const supabase = module.default;

        // Clean up old subscription if exists
        if (presenceSubscription) {
          presenceSubscription.unsubscribe();
        }

        console.log('📡 Subscribing to real-time presence updates...');

        // Subscribe to changes in user_presence table
        presenceSubscription = supabase
          .channel('user_presence_channel')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'user_presence'
            },
            (payload: any) => {
              console.log('🔄 Presence update received:', payload.eventType);
              // Fetch updated active users list
              fetchActiveUsers();
            }
          )
          .subscribe((status: string) => {
            if (status === 'SUBSCRIBED') {
              console.log('✅ Real-time presence subscription active');
              // Fetch initial list
              fetchActiveUsers();
            }
          });
      }).catch((error) => {
        console.warn('⚠️ Could not subscribe to real-time updates:', error);
        // Fallback to polling every 1.5 seconds for real-time accuracy
        const pollInterval = setInterval(fetchActiveUsers, 1500);
        return () => clearInterval(pollInterval);
      });
    } catch (error) {
      console.warn('⚠️ Subscription error, using polling fallback:', error);
      // Fallback to polling every 1.5 seconds for real-time accuracy
      const pollInterval = setInterval(fetchActiveUsers, 1500);
      return () => clearInterval(pollInterval);
    }
  }, [fetchActiveUsers]);

  // Handle page visibility changes (pause/resume tracking)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('📵 Page hidden - pausing heartbeat');
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
          heartbeatInterval = null;
        }
      } else {
        console.log('📱 Page visible - resuming heartbeat');
        if (sessionId) {
          startHeartbeat(sessionId);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [sessionId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
      }
      if (presenceSubscription) {
        presenceSubscription.unsubscribe();
      }
    };
  }, []);

  return (
    <PresenceContext.Provider
      value={{
        sessionId,
        activeUsers,
        activeCount,
        isTracking,
        startTracking,
        stopTracking,
        subscribeToPresence
      }}
    >
      {children}
    </PresenceContext.Provider>
  );
}

export function usePresence() {
  const context = useContext(PresenceContext);
  if (context === undefined) {
    throw new Error("usePresence must be used within a PresenceProvider");
  }
  return context;
}
