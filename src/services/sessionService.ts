/**
 * Session Management Service
 * Handles multi-device login and session tracking
 */

import { v4 as uuidv4 } from 'uuid';
import supabase from './supabaseClient';

export interface SessionData {
  sessionId: string;
  userId: string;
  deviceName: string;
  userAgent: string;
  ipAddress?: string;
  expiresAt: Date;
  createdAt: Date;
}

class SessionService {
  private readonly SESSION_KEY = 'betnexa_session';
  private readonly SESSION_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days

  /**
   * Create a new session for a user
   */
  async createSession(userId: string, deviceName?: string): Promise<SessionData | null> {
    try {
      const sessionId = uuidv4();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + this.SESSION_DURATION);
      const userAgent = navigator.userAgent;

      // Get device name from localStorage or generate one
      const storedDeviceName = localStorage.getItem(`betnexa_device_name_${userId}`);
      const finalDeviceName = deviceName || storedDeviceName || this.generateDeviceName();

      // Save to Supabase sessions table
      const { data, error } = await supabase
        .from('sessions')
        .insert({
          user_id: userId,
          token: sessionId,
          expires_at: expiresAt.toISOString(),
          user_agent: userAgent,
          created_at: now.toISOString(),
          last_activity_at: now.toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('Failed to create session:', error);
        return null;
      }

      const sessionData: SessionData = {
        sessionId,
        userId,
        deviceName: finalDeviceName,
        userAgent,
        expiresAt,
        createdAt: now,
      };

      // Store session token locally (not user data, just session)
      localStorage.setItem(this.SESSION_KEY, JSON.stringify(sessionData));
      localStorage.setItem(`betnexa_device_name_${userId}`, finalDeviceName);

      console.log(`✅ Session created: ${finalDeviceName}`);
      return sessionData;
    } catch (error) {
      console.error('Session creation error:', error);
      return null;
    }
  }

  /**
   * Get current session
   */
  getCurrentSession(): SessionData | null {
    try {
      const stored = localStorage.getItem(this.SESSION_KEY);
      if (!stored) return null;

      const session: SessionData = JSON.parse(stored);
      
      // Check if session is still valid
      if (new Date() > new Date(session.expiresAt)) {
        this.clearSession();
        return null;
      }

      return session;
    } catch (error) {
      console.error('Failed to get session:', error);
      return null;
    }
  }

  /**
   * Update session activity timestamp
   */
  async updateSessionActivity(sessionId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('sessions')
        .update({ last_activity_at: new Date().toISOString() })
        .eq('token', sessionId);

      if (error) {
        console.error('Failed to update session activity:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Session activity update error:', error);
      return false;
    }
  }

  /**
   * Get all active sessions for a user
   */
  async getUserSessions(userId: string): Promise<SessionData[]> {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', userId)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to fetch sessions:', error);
        return [];
      }

      return (data || []).map(session => ({
        sessionId: session.token,
        userId: session.user_id,
        deviceName: this.getDeviceName(session.user_agent),
        userAgent: session.user_agent,
        ipAddress: session.ip_address,
        expiresAt: new Date(session.expires_at),
        createdAt: new Date(session.created_at),
      }));
    } catch (error) {
      console.error('Failed to get user sessions:', error);
      return [];
    }
  }

  /**
   * Revoke a specific session (logout from device)
   */
  async revokeSession(sessionId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('sessions')
        .delete()
        .eq('token', sessionId);

      if (error) {
        console.error('Failed to revoke session:', error);
        return false;
      }

      // If revoking current session, clear local storage
      const currentSession = this.getCurrentSession();
      if (currentSession?.sessionId === sessionId) {
        this.clearSession();
      }

      return true;
    } catch (error) {
      console.error('Session revocation error:', error);
      return false;
    }
  }

  /**
   * Revoke all sessions for a user (logout everywhere)
   */
  async revokeAllSessions(userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('sessions')
        .delete()
        .eq('user_id', userId);

      if (error) {
        console.error('Failed to revoke all sessions:', error);
        return false;
      }

      // Clear local storage
      this.clearSession();
      return true;
    } catch (error) {
      console.error('Failed to revoke all sessions:', error);
      return false;
    }
  }

  /**
   * Clear current session from local storage
   */
  clearSession(): void {
    localStorage.removeItem(this.SESSION_KEY);
  }

  /**
   * Generate a device name based on user agent
   */
  private generateDeviceName(): string {
    const ua = navigator.userAgent;
    
    if (ua.includes('Mobile') || ua.includes('Android')) {
      if (ua.includes('iPhone')) return 'iPhone';
      if (ua.includes('iPad')) return 'iPad';
      return 'Mobile Device';
    }
    
    if (ua.includes('Windows')) return 'Windows PC';
    if (ua.includes('Mac')) return 'Mac';
    if (ua.includes('Linux')) return 'Linux PC';
    
    return `Device ${Math.random().toString(36).substring(7).toUpperCase()}`;
  }

  /**
   * Get human-readable device name from user agent
   */
  private getDeviceName(userAgent: string): string {
    if (userAgent.includes('Mobile') || userAgent.includes('Android')) {
      if (userAgent.includes('iPhone')) return 'iPhone';
      if (userAgent.includes('iPad')) return 'iPad';
      return 'Mobile Device';
    }
    
    if (userAgent.includes('Windows')) return 'Windows PC';
    if (userAgent.includes('Mac')) return 'Mac';
    if (userAgent.includes('Linux')) return 'Linux PC';
    
    return 'Unknown Device';
  }
}

export const sessionService = new SessionService();
