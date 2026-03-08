/**
 * Hook to automatically track user presence on login/logout
 */
import { useEffect } from 'react';
import { useUser } from '@/context/UserContext';
import { usePresence } from '@/context/PresenceContext';

export function usePresenceTracking() {
  const { user } = useUser();
  const { startTracking, stopTracking, isTracking } = usePresence();

  useEffect(() => {
    if (user && user.id && !isTracking) {
      // User is logged in, start tracking
      console.log('📍 User logged in, starting presence tracking');
      startTracking(user.id);
    }
  }, [user?.id, user, isTracking, startTracking]);

  useEffect(() => {
    // Check if user logged out
    if (!user && isTracking) {
      console.log('📍 User logged out, stopping presence tracking');
      stopTracking();
    }
  }, [user, isTracking, stopTracking]);

  return { isTracking };
}
