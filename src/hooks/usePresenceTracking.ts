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
    const currentUserId = user?.id;

    if (!currentUserId) {
      if (isTracking) {
        console.log('📍 User logged out, stopping presence tracking');
        stopTracking();
      }
      return;
    }

    // Ensure tracking exists for the current account identity.
    // If account changes in the same tab/session, restart tracking explicitly.
    const trackedUserId = sessionStorage.getItem('presence_tracked_user_id');
    if (!isTracking || trackedUserId !== currentUserId) {
      const restartTracking = async () => {
        if (isTracking) {
          await stopTracking();
        }

        console.log('📍 User logged in/switched, starting presence tracking');
        await startTracking({
          id: currentUserId,
          username: user?.username,
          phone: user?.phone,
        });
        sessionStorage.setItem('presence_tracked_user_id', currentUserId);
      };

      restartTracking().catch((error) => {
        console.error('❌ Failed to restart presence tracking:', error);
      });
    }
  }, [user?.id, user?.username, user?.phone, isTracking, startTracking, stopTracking]);

  return { isTracking };
}
