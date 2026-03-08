/**
 * Component that automatically handles presence tracking
 * Should be placed inside all providers
 */
import { usePresenceTracking } from '@/hooks/usePresenceTracking';
import { ReactNode } from 'react';

export function PresenceTracker({ children }: { children: ReactNode }) {
  // This hook automatically tracks presence
  usePresenceTracking();

  return <>{children}</>;
}
