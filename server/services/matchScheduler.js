/**
 * Match Event Scheduler
 * Background service that checks and executes pending match events
 * Runs every 5-10 seconds to trigger events at the correct time
 */

const supabase = require('./database');
const { checkAndExecutePendingEvents } = require('./matchEventService');

let schedulerActive = false;
let schedulerInterval = null;

/**
 * Start the background match event scheduler
 * @param {number} intervalMs - How often to check for pending events (default: 5000ms)
 */
function startMatchEventScheduler(intervalMs = 5000) {
  if (schedulerActive) {
    console.log('⚠️ Match event scheduler already running');
    return;
  }

  console.log(`✅ Starting Match Event Scheduler (checking every ${intervalMs}ms)`);
  schedulerActive = true;

  schedulerInterval = setInterval(async () => {
    try {
      // Get all live games
      const { data: liveGames, error } = await supabase
        .from('games')
        .select('id, home_team, away_team, is_kickoff_started, status')
        .eq('is_kickoff_started', true)
        .neq('status', 'finished')
        .limit(50);

      if (error) {
        console.warn('⚠️ Error fetching live games for scheduler:', error.message);
        return;
      }

      if (!liveGames || liveGames.length === 0) {
        return;
      }

      // Check each game for pending events
      for (const game of liveGames) {
        await checkAndExecutePendingEvents(game.id);
      }
    } catch (err) {
      console.error('❌ Exception in match event scheduler:', err.message);
    }
  }, intervalMs);

  console.log('🎯 Match Event Scheduler started successfully');
}

/**
 * Stop the background match event scheduler
 */
function stopMatchEventScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    schedulerActive = false;
    console.log('⛔ Match Event Scheduler stopped');
  }
}

/**
 * Check if scheduler is currently running
 */
function isSchedulerActive() {
  return schedulerActive;
}

/**
 * Execute pending events for a specific game (manual trigger)
 */
async function executePendingEventsManually(gameId) {
  console.log(`⚡ Manual trigger of pending events for game ${gameId}`);
  return await checkAndExecutePendingEvents(gameId);
}

module.exports = {
  startMatchEventScheduler,
  stopMatchEventScheduler,
  isSchedulerActive,
  executePendingEventsManually,
};
