# Game Revert Feature - Complete Implementation Guide

## Overview
Admins can now revert finished games back to live status and unsettle all settled bets, reversing any winnings that were credited to users.

---

## Backend Implementation

### New Endpoint
**PUT /api/admin/games/:gameId/revert**

#### Parameters
- `gameId` (URL param): The ID of the finished game to revert
- `phone` (body): Admin phone number for authorization

#### Request
```json
{
  "phone": "+254712345678"
}
```

#### Response - Success
```json
{
  "success": true,
  "data": {
    "id": "game123",
    "status": "live",
    "homeTeam": "Team A",
    "awayTeam": "Team B",
    ...
  }
}
```

#### Response - Error
```json
{
  "success": false,
  "error": "Game not found",
  "details": "..."
}
```

#### Error Cases
- Game not found (404)
- Game not in finished status
- Admin not authorized
- Database error during revert

---

## Revert Process

### What Happens When You Revert a Game

1. **Game Status Update**: Changes from `finished` → `live`
2. **Bet Selection Reset**: All selections reset from their outcomes (Won/Lost) → `pending`
3. **User Balance Reversal**: For Won bets:
   - Calculate `amount_won` from the settled bet
   - Subtract amount from user's:
     - `account_balance`
     - `winnings_balance`
     - `total_winnings`
   - Prevents negative balances using `Math.max(0, balance - amount)`
4. **Bet Status Reset**: All bets for this game → `Open` status
5. **Settlement Metadata Clear**: Clears `settled_at` timestamps

### Unsettlement Helper Function
Location: `server/routes/admin.routes.js` (lines ~242-365)

```javascript
async function unsettleBetsForGame(gameId) {
  // 1. Find all bet_selections for this game
  // 2. For each affected bet:
  //    - Reset selections to 'pending'
  //    - If Won: reverse winnings from user balances
  //    - Reset bet status to 'Open'
  // 3. Prevent negative balances with Math.max(0, ...)
}
```

---

## Frontend Implementation

### Admin Portal Button
**Location**: AdminPortal.tsx - Game Controls Section

**Visibility**: Only shown for finished games
**Label**: "Revert to Live" with refresh icon
**Confirmation**: Requires user confirmation dialog before execution

#### Button Behavior
```tsx
{game.status === "finished" && (
  <Button
    onClick={() => revertGame(game.id)}
    variant="outline"
    disabled={isApiManagedGame(game.id)}
  >
    <RefreshCw className="mr-1 h-3 w-3" /> Revert to Live
  </Button>
)}
```

### Revert Function
Location: `AdminPortal.tsx` (lines ~1364-1410)

```javascript
const revertGame = async (gameId: string) => {
  // 1. Verify it's a manual game
  // 2. Show confirmation dialog
  // 3. Call PUT /api/admin/games/{gameId}/revert
  // 4. Update game status to 'live' on success
  // 5. Show success/error alert
}
```

---

## Testing Instructions

### Prerequisites
- Admin account with access to AdminPortal
- A finished game with settled bets in the database
- Bets with different outcomes (Won/Lost)

### Test Case 1: Basic Revert
1. Navigate to Admin Portal → Games tab
2. Find a finished game (status shows "FINISHED")
3. Scroll down to see game controls
4. Click "Revert to Live" button
5. Confirm in the dialog
6. Verify:
   - Game status changes to "LIVE"
   - Button disappears (now shows "End Game" again)
   - All bets reset to "Open"

### Test Case 2: Winnings Reversal
1. Create a test game and end it with a settled bet (Won)
2. Check user's balance before reverting:
   ```sql
   SELECT account_balance, winnings_balance, total_winnings 
   FROM users WHERE id = 'user123';
   ```
3. Revert the game
4. Check user's balance after reverting:
   ```sql
   SELECT account_balance, winnings_balance, total_winnings 
   FROM users WHERE id = 'user123';
   ```
5. Verify the won amount was subtracted from balances

### Test Case 3: Multiple Bets
1. Create a game with multiple users who placed bets
2. End the game with various outcomes (Won/Lost)
3. Revert the game
4. Verify:
   - All bets reset to Open
   - Only Won bets had winnings reversed
   - Lost bets remain with their stakes intact
   - No negative balances created

### Test Case 4: Edge Cases
- **Partial Wins**: Multi-selection bets with partial wins
- **Margin Calculations**: Verify odds calculations preserved
- **Concurrent Requests**: Rapid reverts shouldn't cause conflicts
- **User Notifications**: No SMS should be sent on revert

---

## Deployment Status

✅ **Backend**: Deployed to https://server-tau-puce.vercel.app
✅ **Frontend**: Deployed to https://betnexa.co.ke

### Commit Hash
`90efdf7` - Feature: Add game revert functionality

### Files Modified
1. `server/routes/admin.routes.js`
   - Added `unsettleBetsForGame()` helper (lines ~242-365)
   - Added PUT `/api/admin/games/:gameId/revert` endpoint (lines ~2025-2088)

2. `src/pages/AdminPortal.tsx`
   - Added `revertGame()` function (lines ~1364-1410)
   - Added "Revert to Live" button in game controls

---

## Safety Features

✅ **Admin Authorization**: Requires checkAdmin middleware
✅ **Manual Games Only**: Prevents reverting API-managed games
✅ **Confirmation Dialog**: Requires explicit user confirmation
✅ **Balance Safeguards**: Math.max(0, ...) prevents negative balances
✅ **Transaction Logging**: Console logs all revert operations
✅ **Error Handling**: Comprehensive error messages for debugging

---

## Rollback Instructions

If you need to rollback this feature:

```bash
# Revert to previous commit
git revert 90efdf7

# Or reset to before feature
git reset --hard 6fa8c40
git push origin master

# Redeploy
vercel --prod --force  # in both frontend and backend directories
```

---

## FAQ

**Q: Can I revert an API-managed game?**
A: No, only manual games can be reverted. API-managed games are disabled to prevent inconsistencies.

**Q: What if a user has no winnings balance?**
A: The system uses `Math.max(0, balance)` to prevent negative balances, so it safely handles this case.

**Q: Will users be notified about unsettlement?**
A: Currently no automatic SMS is sent. Consider adding this in future versions.

**Q: Can I revert a revert?**
A: If you reverted a game to live and then end it again, the normal settlement flow applies.

---

## Logs & Debugging

When reverting, check the backend logs for entries like:
```
⏪ [UNSETTLE] Processing bets for game: game123
   Found 5 selections to unsettle
   🎯 Unsettling bet abc123... (status: Won)
      💰 Reversing winnings: KSH 500
      ✅ User balances updated: account KSH 4500, winnings KSH 0 (-KSH 500)
      ✅ Bet status reset to Open
✅ Unsettlement complete for game game123
```

---

## Next Steps (Optional Enhancements)

1. **SMS Notification**: Send SMS to users when their bets are unsettled
2. **Audit Trail**: Log all revert operations with timestamp and admin details
3. **Bulk Operations**: Allow reverting multiple games at once
4. **Scheduled Reversions**: Auto-revert games after X minutes if marked as "test"
5. **Settlement Reason**: Allow admins to specify reason for reverting (dispute, error, etc.)

