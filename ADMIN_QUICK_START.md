# Admin Portal - Quick Start Guide

## Login

1. Go to: **https://betnexa.vercel.app**
2. Click **Login**
3. Enter credentials:
   - Phone: **0714945142**
   - Password: **4306**
4. Click **Login**
5. You'll be redirected to **Admin Portal** (/muleiadmin)

## Main Dashboard

The admin portal has 5 main tabs:

### 1. 📊 Dashboard Tab
- View statistics: Total Users, Total Games, Total Bets, Pending Payments
- Quick overview of platform metrics
- Admin user profile

### 2. ⚽ Games Management Tab
**Add New Game:**
- Click **"+ Add Game"** button
- Fill in details:
  - League (e.g., "Premier League")
  - Home Team (e.g., "Arsenal")
  - Away Team (e.g., "Chelsea")
  - Home Odds (e.g., 2.5)
  - Draw Odds (e.g., 3.0)
  - Away Odds (e.g., 2.8)
  - Time (optional)
- Click **"Add Game"**
- Game saves to database instantly ✓

**Manage Games:**
- **View** - See all games with current status
- **Edit Markets** - Click "⚙️ Edit Markets" to adjust betting odds
- **Update Score** - For live games, update score in real-time
- **Start Kickoff** - Click "▶️ Start Kickoff" to begin game
- **Pause Game** - Click "⏸️ Pause Game" during match
- **Resume Game** - Click "▶️ Resume Game" after pause
- **End Game** - Click "🏁 End Game" when finished
- **Delete** - Click "🗑️" to permanently delete game

### 3. 👥 User Management Tab
**View Users:**
- See all registered users
- View their details: name, email, phone, balance, stats

**Edit User:**
- Click **"✏️ Edit User"** to modify:
  - Name
  - Email
  - Phone
  - Account Balance
- Click **"💾 Save"** to update (saves to DB)

**Activate Withdrawal:**
- Click **"🔓 Activate Withdrawal"** on users without withdrawal access
- This allows them to request withdrawal of funds
- Status updates to "Withdrawal: Activated"

**Delete User:**
- Click **"🗑️"** to permanently delete user account
- ⚠️ Cannot delete your own admin account

### 4. 💳 Payments Tab
**View Payments:**
- See all payment transactions
- View status: pending, completed, failed

**Resolve Failed Payments:**
- Failed payments appear in a separate section
- Click **"✅ Resolve"** to mark as completed
- Optionally add M-Pesa receipt number
- Payment status updates immediately

### 5. ⚙️ Settings Tab
- View admin profile
- View system settings
- View deployment info

## Common Tasks

### Add a Match (Game)
1. Go to **Games Management** tab
2. Click **"+ Add Game"**
3. Fill in team names and odds
4. Click **"Add Game"**
5. ✅ Game saved to database and visible to all users

### Update Live Score
1. Find the game in Games list
2. Click **"▶️ Start Kickoff"** to begin match
3. Enter score updates: Home Score and Away Score
4. Click **"📊 Update Score"**
5. ✅ Score saves and odds adjust automatically
6. All users see the updated score

### Regenerate Odds
1. Find a game in the list
2. Click **"🔄 Regenerate Odds"**
3. All market odds recalculate
4. ✅ New odds saved to database

### Edit Betting Markets
1. Find a game
2. Click **"⚙️ Edit Markets"**
3. Choose market to edit (BTTS, Over/Under, Double Chance, etc.)
4. Enter new odds values
5. Click **"💾 Save Markets"**
6. ✅ Market odds update and persist

### Adjust User Balance
1. Go to **User Management** tab
2. Find the user
3. Click **"✏️ Edit User"**
4. Change "Account Balance (KSH)"
5. Click **"💾 Save"**
6. ✅ Balance updates, change logged automatically

### Enable User Withdrawal
1. Go to **User Management** tab
2. Find user with "Withdrawal: Not Activated"
3. Click **"🔓 Activate Withdrawal"**
4. Wait for confirmation
5. ✅ User can now request withdrawal

## Data Persistence

✅ **Everything you do is automatically saved to the database**

- Add a game → Saved to database
- Update a score → Saved to database
- Change odds → Saved to database
- Edit balance → Saved to database, change logged
- Update withdrawal → Saved to database

**Verify:** Refresh the page or open on another device/browser - all changes persist!

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt + G` | Jump to Games tab |
| `Alt + U` | Jump to Users tab |
| `Alt + P` | Jump to Payments tab |
| `F5` | Refresh page |
| `F12` | Open Developer Console (for debugging) |

## Tips & Tricks

1. **Bulk Add Games** - Add multiple games quickly by doing one after another
2. **Live Score Updates** - Update scores frequently for better accuracy (every few minutes)
3. **Odds Management** - Adjust odds based on betting patterns
4. **User Verification** - Always verify user identity before changing balance
5. **Export Data** - Take screenshots of stats for records
6. **Monitor Payments** - Check payments tab regularly for failed transactions

## Troubleshooting

### Game Won't Save
- Check network tab (F12 > Network)
- Verify admin login is active
- Try refreshing page

### Score Update Not Working
- Must start kickoff first
- Check if game status is "live"
- Verify internet connection

### Balance Change Not Visible
- Logout and login again to sync
- Check balance_history in Supabase
- Refresh the page

### Can't Add Game
- Fill in all required fields
- Must be logged in as admin
- Check console for error message

## Support

**For Issues:**
1. Check browser console (F12 > Console)
2. Verify admin credentials
3. Refresh page and try again
4. Check Vercel backend logs if API fails
5. Contact development team with error message

**Emergency Contacts:**
- Backend: betnexa-globalback.vercel.app
- Database: Supabase dashboard
- Frontend: betnexa.vercel.app

## Important Notes

⚠️ **Be Careful With:**
- Deleting games (cannot be undone)
- Changing user balances (impacts their accounts)
- Resolving payments (marks as completed)

✅ **Everything is Logged:**
- All admin actions recorded in admin_logs
- All balance changes recorded in balance_history
- Full audit trail available

## Keyboard & Mouse

- **Left Click** - Select, open, execute action
- **Right Click** - (Usually no context menu, not needed)
- **Tab Key** - Navigate between fields
- **Enter Key** - Submit forms
- **Escape Key** - Close modals
- **Delete Key** - Remove items (with confirmation)

## What Gets Saved Automatically

When you click "Save" or "Submit", these things happen automatically:

1. **Data saved to database** ✓
2. **Audit log entry created** ✓
3. **Timestamp recorded** ✓
4. **Change notified to API** ✓
5. **All connected users get update** ✓

## Performance

- Add game: ~1 second
- Update score: ~500ms
- Save markets: ~1 second
- Edit balance: ~1 second
- All operations proceed with confirmation alerts

## Admin Capabilities

✅ **You can:**
- Add unlimited games
- Update scores in real-time
- Manage all users
- Edit user balances
- Activate withdrawals
- Resolve payments
- View all statistics
- Access admin logs

❌ **You cannot:**
- Vote on bets
- Place bets
- Withdraw money
- Delete your own account
- Bypass payment system

## Session Management

- **Session Duration:** 30 days (auto-renew on activity)
- **Multi-Device:** Can login on multiple devices simultaneously
- **Auto-Logout:** 30 days of inactivity
- **Manual Logout:** Click your profile → Logout

## Data Privacy

- All admin actions are logged
- Balance history is transparent
- Audit trail is permanent
- Cannot delete logs

## Final Checklist

Before using admin portal:
- ✓ Logged in with correct credentials (0714945142)
- ✓ On correct page (/muleiadmin)
- ✓ Browser is up to date
- ✓ JavaScript enabled
- ✓ Internet connection stable

Ready to go! 🚀

---

**Portal:** https://betnexa.vercel.app/muleiadmin
**Admin Phone:** 0714945142
**Admin Password:** 4306
**Support:** Check console errors or Vercel logs
