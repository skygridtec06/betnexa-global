/**
 * User Presence Tracking Routes
 * Handles real-time user activity tracking and online status
 */

const express = require('express');
const router = express.Router();
const supabase = require('../services/database.js');
const { v4: uuidv4 } = require('uuid');
const ACTIVE_WINDOW_MS = 2000;

/**
 * POST /api/presence/login
 * Record user login and create presence session
 */
router.post('/login', async (req, res) => {
  try {
    const { userId, phoneNumber, userAgent, ipAddress } = req.body;
    
    console.log('\n👤 [POST /api/presence/login] User login');
    console.log('   User ID:', userId);
    console.log('   Phone:', phoneNumber);

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    const sessionId = uuidv4();
    const { data, error } = await supabase
      .from('user_presence')
      .insert({
        user_id: userId,
        session_id: sessionId,
        status: 'online',
        user_agent: userAgent || '',
        ip_address: ipAddress || '',
        last_activity: new Date().toISOString(),
        login_time: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating presence session:', error.message);
      return res.status(500).json({
        success: false,
        error: 'Failed to create presence session'
      });
    }

    console.log(`✅ Presence session created for user ${userId}`);
    res.json({
      success: true,
      sessionId: sessionId,
      data
    });
  } catch (error) {
    console.error('❌ Login presence error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to track login'
    });
  }
});

/**
 * POST /api/presence/heartbeat
 * Update user activity timestamp (send every ~5 seconds)
 */
router.post('/heartbeat', async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Session ID is required'
      });
    }

    const { data, error } = await supabase
      .from('user_presence')
      .update({
        last_activity: new Date().toISOString(),
        status: 'online'
      })
      .eq('session_id', sessionId)
      .select()
      .single();

    if (error) {
      console.warn('⚠️ Heartbeat update error:', error.message);
      // Don't fail if session doesn't exist
      return res.json({
        success: true,
        message: 'Heartbeat received'
      });
    }

    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('❌ Heartbeat error:', error);
    // Don't fail on heartbeat errors
    res.json({
      success: true,
      message: 'Heartbeat recorded'
    });
  }
});

/**
 * POST /api/presence/logout
 * Record user logout and delete presence session
 */
router.post('/logout', async (req, res) => {
  try {
    const sessionId = req.body?.sessionId || req.query?.sessionId;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Session ID is required'
      });
    }

    console.log('\n👤 [POST /api/presence/logout] User logout');
    console.log('   Session ID:', sessionId);

    const { error } = await supabase
      .from('user_presence')
      .delete()
      .eq('session_id', sessionId);

    if (error) {
      console.warn('⚠️ Logout error:', error.message);
      // Don't fail if session doesn't exist
      return res.json({
        success: true,
        message: 'Logout recorded'
      });
    }

    console.log(`✅ Presence session deleted for session ${sessionId}`);
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('❌ Logout error:', error);
    res.json({
      success: true,
      message: 'Logout recorded'
    });
  }
});

/**
 * GET /api/presence/active
 * Get list of currently active users
 * Only returns users active within the last 15 seconds (for real-time accuracy)
 */
router.get('/active', async (req, res) => {
  try {
    console.log('\n👥 [GET /api/presence/active] Fetching active users');

    // Keep online list very fresh for near real-time dashboard updates.
    const activeWindowStart = new Date(Date.now() - ACTIVE_WINDOW_MS).toISOString();
    
    const { data: activeSessions, error } = await supabase
      .from('user_presence')
      .select(`
        id,
        user_id,
        session_id,
        last_activity,
        login_time,
        status,
        users:user_id (
          id,
          username,
          phone_number,
          email,
          total_bets,
          total_winnings,
          account_balance
        )
      `)
      .eq('status', 'online')
      .gt('last_activity', activeWindowStart)
      .order('last_activity', { ascending: false });

    if (error) {
      console.error('❌ Error fetching active users:', error.message);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch active users'
      });
    }

    const uniqueUserCount = new Set((activeSessions || []).map((s) => s.user_id)).size;
    console.log(`✅ Retrieved ${activeSessions?.length || 0} active sessions (${uniqueUserCount} unique users)`);

    res.json({
      success: true,
      activeCount: uniqueUserCount,
      users: activeSessions || []
    });
  } catch (error) {
    console.error('❌ Get active users error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get active users'
    });
  }
});

/**
 * GET /api/presence/stats
 * Get real-time presence statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const activeWindowStart = new Date(Date.now() - ACTIVE_WINDOW_MS).toISOString();

    const { data: onlineUsers } = await supabase
      .from('user_presence')
      .select('user_id', { count: 'exact' })
      .eq('status', 'online')
      .gt('last_activity', activeWindowStart);

    const uniqueOnlineUsers = new Set((onlineUsers || []).map((u) => u.user_id)).size;

    const { data: totalUsers } = await supabase
      .from('users')
      .select('id', { count: 'exact' });

    const { data: recentLogins } = await supabase
      .from('user_presence')
      .select('id', { count: 'exact' })
      .gt('login_time', new Date(Date.now() - 3600 * 1000).toISOString()); // Last hour

    const stats = {
      onlineCount: uniqueOnlineUsers,
      totalUsers: totalUsers?.length || 0,
      recentLoginsLastHour: recentLogins?.length || 0,
      onlinePercentage: totalUsers?.length ? Math.round(uniqueOnlineUsers / totalUsers.length * 100) : 0
    };

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('❌ Get presence stats error:', error);
    res.json({
      success: true,
      stats: {
        onlineCount: 0,
        totalUsers: 0,
        recentLoginsLastHour: 0,
        onlinePercentage: 0
      }
    });
  }
});

module.exports = router;
