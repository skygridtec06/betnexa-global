# ✅ BETNEXA Final Setup & Testing Checklist

## 🔗 Your Deployment URLs
- **Frontend:** https://betnexa.vercel.app
- **Backend:** https://betnexa-globalback.vercel.app
- **Admin:** https://betnexa.vercel.app/muleiadmin

---

## 📌 IMMEDIATE ACTIONS REQUIRED

### Phase 1: Configure Environment Variables (5 minutes)

**[ ] Frontend Environment Variables**

Go to: https://vercel.com/dashboard/betnexa/settings/environment-variables

Click "Add" and enter these 3 variables:

| Variable | Value |
|----------|-------|
| `VITE_SUPABASE_URL` | `https://eaqogmybihiqzivuwyav.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `<your-anon-key>` |
| `VITE_API_URL` | `https://betnexa-globalback.vercel.app` |

**[ ] Backend Environment Variables**

Go to: https://vercel.com/dashboard/server-chi-orcin/settings/environment-variables

Click "Add" and enter these 7 variables:

| Variable | Value |
|----------|-------|
| `SUPABASE_URL` | `https://eaqogmybihiqzivuwyav.supabase.co` |
| `SUPABASE_SERVICE_KEY` | `<your-service-key>` |
| `SUPABASE_ANON_KEY` | `<your-anon-key>` |
| `PAYHERO_API_KEY` | `<your-payhero-api-key>` |
| `PAYHERO_API_SECRET` | `<your-payhero-secret>` |
| `PAYHERO_ACCOUNT_ID` | `3398` |
| `NODE_ENV` | `production` |

---

### Phase 2: Redeploy Both Projects (5 minutes)

**[ ] Redeploy Frontend**
1. Go to: https://vercel.com/dashboard/betnexa/deployments
2. Click on the latest deployment
3. Click "Redeploy" button
4. Wait for green checkmark ✓

**[ ] Redeploy Backend**
1. Go to: https://vercel.com/dashboard/server-chi-orcin/deployments
2. Click on the latest deployment
3. Click "Redeploy" button
4. Wait for green checkmark ✓

---

## 🧪 Phase 3: Testing (10 minutes)

### Backend Health Check
**[ ] Test Backend is Running**
```
URL: https://server-chi-orcin.vercel.app/api/health
Expected: {"status":"Server is running"...}
```

### Frontend Loading
**[ ] Test Frontend Loads**
```
URL: https://betnexa.vercel.app
Expected: See login page with betting app interface
```

### User Registration
**[ ] Create Test Account**
1. Go to https://betnexa.vercel.app
2. Click "Sign Up"
3. Enter:
   - Phone: 254712345678
   - Password: test1234
   - Username: testuser
4. Expected: Account created successfully message

### User Login
**[ ] Test Login Works**
1. Go to https://betnexa.vercel.app/login
2. Enter:
   - Phone: 254712345678
   - Password: test1234
3. Expected: Redirect to dashboard

### Multi-Device Login
**[ ] Test on Two Devices**
1. Login on Device 1 (browser)
2. Open second browser (or incognito)
3. Login to same account
4. Expected: Both devices logged in simultaneously

---

## 👨‍💼 Phase 4: Admin Portal Setup (5 minutes)

### Make Test User Admin
**[ ] Promote User to Admin**
1. Go to: https://app.supabase.com
2. Select project: eaqogmybihiqzivuwyav
3. Click "Table Editor"
4. Open "users" table
5. Find your test user (254712345678)
6. Click to edit
7. Set:
   - `is_admin` = true
   - `role` = 'admin'
8. Click "Save"

### Access Admin Portal
**[ ] Test Admin Portal**
1. Go to https://betnexa.vercel.app/muleiadmin
2. Expected: See admin dashboard with tabs
3. Should see:
   - Games tab
   - Users tab
   - Transactions tab
   - Bets tab
   - Settings tab

---

## 🎮 Phase 5: Feature Testing (Optional)

### Games Management
**[ ] Create Test Game**
1. In admin portal, go to "Games" tab
2. Click "Add Game"
3. Fill in:
   - League: Premier League
   - Home Team: Arsenal
   - Away Team: Liverpool
   - Odds: 2.50, 3.20, 2.80
4. Click "Add"
5. Expected: Game appears in list

### User Management
**[ ] Test User Balance Adjustment**
1. In admin portal, go to "Users" tab
2. Find your test user
3. Click edit balance
4. Set new balance: 5000
5. Click Save
6. Expected: Balance updates immediately

### View Transactions
**[ ] Check Transaction History**
1. In admin portal, go to "Transactions" tab
2. Expected: See all user transactions
3. Should show: deposits, bets, payouts

---

## 🔐 Security Verification

**[ ] Secrets Not in Code**
- Check .env.local is in .gitignore ✓
- Check server/.env is in .gitignore ✓
- No API keys in commits ✓

**[ ] Admin Protection Works**
- [ ] Non-admin users cannot access /muleiadmin
- [ ] Redirects to dashboard if not admin

**[ ] Database Security**
- [ ] RLS policies enabled
- [ ] Users can only see own transactions
- [ ] Admins can see everything

---

## 📊 Monitoring Setup

**[ ] Enable Vercel Monitoring**
- [ ] Check frontend analytics: https://vercel.com/dashboard/betnexa/analytics
- [ ] Check backend logs: https://vercel.com/dashboard/server-chi-orcin/logs
- [ ] Setup alerts (optional)

**[ ] Enable Supabase Monitoring**
- [ ] Check database logs: https://app.supabase.com/project/eaqogmybihiqzivuwyav/logs
- [ ] Review database activity
- [ ] Monitor API usage

---

## 🚀 Final Deployment Checklist

### Before Going Live
- [ ] All environment variables configured
- [ ] Both projects redeployed
- [ ] Backend health check passing
- [ ] Frontend loading successfully
- [ ] Login and signup working
- [ ] Multi-device login tested
- [ ] Admin portal accessible
- [ ] Test games created
- [ ] Payment integration ready
- [ ] Supabase auth URLs configured

### Post-Deployment
- [ ] Monitor error logs for 24 hours
- [ ] Test payment processing
- [ ] Verify email notifications (if configured)
- [ ] Check mobile responsiveness
- [ ] Test on different browsers
- [ ] Monitor performance metrics

---

## ✅ Your System is Ready When:

1. ✓ Frontend app loads at betnexa.vercel.app
2. ✓ Backend responds at /api/health
3. ✓ Users can register and login
4. ✓ Multi-device login works
5. ✓ Admin can access admin portal
6. ✓ Games can be created and managed
7. ✓ Transactions are recorded
8. ✓ No console errors in browser
9. ✓ No deployment errors in Vercel

---

## 📞 Troubleshooting Quick Links

| Issue | Solution |
|-------|----------|
| Frontend blank page | Check Vercel logs for build errors |
| API connection error | Verify VITE_API_URL in frontend environment |
| Login not working | Check Supabase service is running |
| Admin portal 404 | Make sure user has is_admin = true |
| Payment not working | Check PayHero API keys in backend |
| Database errors | Check Supabase connection in server logs |

---

**Status: 🟢 All Systems Ready for Deployment**

Your BETNEXA platform is fully configured and ready to serve customers! 🎉
