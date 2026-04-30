# Admin API Quick Reference

## Base URL
```
https://betnexa-globalback.vercel.app/api/admin
```

## Authentication
All requests require the admin phone number in the request body:
```json
{
  "phone": "0714945142"
}
```

## Endpoints

### Games Management

#### 1. Create Game
```
POST /games

Body:
{
  "phone": "0714945142",
  "league": "Premier League",
  "homeTeam": "Arsenal",
  "awayTeam": "Chelsea",
  "homeOdds": 2.5,
  "drawOdds": 3.0,
  "awayOdds": 2.8,
  "time": "2024-01-15T15:00:00Z",
  "status": "upcoming",
  "markets": {}
}

Response:
{
  "success": true,
  "game": {
    "id": "uuid",
    "game_id": "g1234567890",
    "home_team": "Arsenal",
    ...
  }
}
```

#### 2. Get All Games
```
GET /games

Response:
{
  "success": true,
  "games": [
    { game details... },
    ...
  ]
}
```

#### 3. Update Game
```
PUT /games/:gameId

Body:
{
  "phone": "0714945142",
  "status": "live",
  "home_score": 2,
  "away_score": 1
}

Response:
{
  "success": true,
  "game": { updated game details... }
}
```

#### 4. Update Game Score
```
PUT /games/:gameId/score

Body:
{
  "phone": "0714945142",
  "homeScore": 2,
  "awayScore": 1,
  "minute": 45,
  "status": "live"
}

Response:
{
  "success": true,
  "game": { game with updated score... }
}
```

#### 5. Update Game Markets
```
PUT /games/:gameId/markets

Body:
{
  "phone": "0714945142",
  "markets": {
    "over25": 1.8,
    "under25": 2.0,
    "bttsYes": 1.9,
    "bttsNo": 1.95
  }
}

Response:
{
  "success": true,
  "game": { game with updated markets... }
}
```

#### 6. Delete Game
```
DELETE /games/:gameId

Body:
{
  "phone": "0714945142"
}

Response:
{
  "success": true,
  "message": "Game deleted"
}
```

### User Management

#### 1. Update User Balance
```
PUT /users/:userId/balance

Body:
{
  "phone": "0714945142",
  "balance": 10000,
  "reason": "Admin adjustment"
}

Response:
{
  "success": true,
  "user": { updated user details... }
}
```

#### 2. Activate Withdrawal
```
PUT /users/:userId/activate-withdrawal

Body:
{
  "phone": "0714945142",
  "withdrawalId": "withdrawal-uuid"
}

Response:
{
  "success": true,
  "withdrawal": { withdrawal details... }
}
```

### Payments Management

#### 1. Resolve Payment
```
POST /payments/:paymentId/resolve

Body:
{
  "phone": "0714945142",
  "status": "completed",
  "notes": "Payment resolved by admin"
}

Response:
{
  "success": true,
  "payment": { payment details... }
}
```

### Dashboard

#### 1. Get Admin Stats
```
GET /stats

Response:
{
  "success": true,
  "stats": {
    "totalUsers": 150,
    "totalGames": 42,
    "pendingPayments": 5,
    "totalBets": 1200
  }
}
```

## Error Responses

### 401 Unauthorized
```json
{
  "error": "Phone number required"
}
```

### 403 Forbidden
```json
{
  "error": "Admin access required"
}
```

### 400 Bad Request
```json
{
  "error": "Home and away teams required"
}
```

### 404 Not Found
```json
{
  "error": "User not found"
}
```

### 500 Server Error
```json
{
  "error": "Failed to create game"
}
```

## Status Codes

- `200` - Success
- `400` - Bad request (missing/invalid data)
- `401` - Unauthorized (missing phone)
- `403` - Forbidden (not admin)
- `404` - Not found (resource doesn't exist)
- `500` - Server error

## Game Statuses

- `upcoming` - Game not started
- `live` - Game in progress
- `finished` - Game completed

## Testing with cURL

```bash
# Add a game
curl -X POST https://betnexa-globalback.vercel.app/api/admin/games \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "0714945142",
    "league": "Premier League",
    "homeTeam": "Arsenal",
    "awayTeam": "Chelsea",
    "homeOdds": 2.5,
    "drawOdds": 3.0,
    "awayOdds": 2.8,
    "time": "2024-01-15T15:00:00Z",
    "status": "upcoming"
  }'

# Get all games
curl https://betnexa-globalback.vercel.app/api/admin/games

# Update score
curl -X PUT https://betnexa-globalback.vercel.app/api/admin/games/g1234567890/score \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "0714945142",
    "homeScore": 2,
    "awayScore": 1,
    "minute": 45,
    "status": "live"
  }'

# Delete game
curl -X DELETE https://betnexa-globalback.vercel.app/api/admin/games/g1234567890 \
  -H "Content-Type: application/json" \
  -d '{"phone": "0714945142"}'
```

## Testing with Postman

1. Create a new collection
2. Set base URL: `https://betnexa-globalback.vercel.app/api/admin`
3. Add each endpoint as a request
4. Set `Content-Type: application/json` header
5. Include `phone: "0714945142"` in request body
6. Save responses for reference

## Common Response Fields

### Game Object
```json
{
  "id": "uuid",
  "game_id": "g1234567890",
  "league": "Premier League",
  "home_team": "Arsenal",
  "away_team": "Chelsea",
  "home_odds": 2.5,
  "draw_odds": 3.0,
  "away_odds": 2.8,
  "status": "upcoming",
  "home_score": null,
  "away_score": null,
  "minute": 0,
  "is_kickoff_started": false,
  "game_paused": false,
  "markets": {},
  "created_at": "2024-01-15T10:00:00Z",
  "updated_at": "2024-01-15T10:00:00Z"
}
```

### User Object
```json
{
  "id": "uuid",
  "phone": "0714945142",
  "name": "Admin User",
  "email": "admin@example.com",
  "balance": 50000,
  "is_admin": true,
  "created_at": "2024-01-01T00:00:00Z"
}
```

## Important Notes

1. All timestamps are in ISO 8601 format (UTC)
2. All currency values are in KSH (Kenyan Shillings)
3. Game IDs are unique text identifiers (e.g., `g1234567890`)
4. User IDs and other IDs are UUIDs
5. All changes are logged in the `admin_logs` table
6. Admin must be properly authenticated in database (is_admin=true)

## Debugging

Enable request/response logging:
```javascript
// Browser console
console.log('Request:', {url, method, body});
console.log('Response:', data);

// Check network tab (F12 > Network)
// - Look for your API endpoints
// - Check status code
// - Inspect request/response bodies
```

## Limits & Best Practices

- **No rate limiting** yet - be reasonable with requests
- **Bulk operations** - not yet supported (add one game at a time)
- **Pagination** - not yet supported (gets all results)
- **Real-time updates** - manual refresh required (WebSocket coming soon)

## Support

For issues:
1. Check response error message
2. Verify phone number matches admin user
3. Check Supabase dashboard for database errors
4. Review server logs in Vercel dashboard
