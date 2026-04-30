# 🔗 BETNEXA - Vercel Deployment Complete

## 📌 Your Deployed URLs

```
Frontend:  https://betnexa.vercel.app
Backend:   https://betnexa-globalback.vercel.app
Health:    https://betnexa-globalback.vercel.app/api/health
```

---

## 🔧 Configure Environment Variables

### Step 1: Frontend Environment Variables
**URL:** https://vercel.com/dashboard/betnexa/settings/environment-variables

Add these 3 variables:

```
VITE_SUPABASE_URL
https://eaqogmybihiqzivuwyav.supabase.co

VITE_SUPABASE_ANON_KEY
<your-anon-key>

VITE_API_URL
https://server-chi-orcin.vercel.app
```

### Step 2: Backend Environment Variables
**URL:** https://vercel.com/dashboard/server-chi-orcin/settings/environment-variables

Add these 7 variables:

```
SUPABASE_URL
https://eaqogmybihiqzivuwyav.supabase.co

SUPABASE_SERVICE_KEY
<your-service-key>

SUPABASE_ANON_KEY
sb_publishable_Lc8dQIzND4_qyIbN2EuQrQ_0Ma0OINQ

PAYHERO_API_KEY
<your-payhero-api-key>

PAYHERO_API_SECRET
<your-payhero-secret>

PAYHERO_ACCOUNT_ID
3398

NODE_ENV
production
```

---

## ✅ After Adding Environment Variables

1. **Frontend Redeployment:**
   - Go to: https://vercel.com/dashboard/betnexa/deployments
   - Click on latest deployment
   - Click "Redeploy" button
   - Wait for deployment to complete ✓

2. **Backend Redeployment:**
   - Go to: https://vercel.com/dashboard/server-chi-orcin/deployments
   - Click on latest deployment
   - Click "Redeploy" button
   - Wait for deployment to complete ✓

---

## 🧪 Test Your Deployment

### Frontend Loading Test
Open in browser:
```
https://betnexa.vercel.app
```
Should see the betting application interface

### Backend Health Check
```
https://server-chi-orcin.vercel.app/api/health
```
Should return:
```json
{
  "status": "Server is running",
  "timestamp": "2026-02-22T...",
  "environment": "production"
}
```

### Test User Registration
1. Go to https://betnexa.vercel.app
2. Click "Sign Up"
3. Create account with:
   - Phone: 254712345678
   - Password: test1234
4. You should see: "Account created successfully"

### Test Login
1. Go to https://betnexa.vercel.app/login
2. Enter phone: 254712345678
3. Enter password: test1234
4. Should redirect to dashboard

### Test Admin Portal
1. Make your user admin in Supabase:
   - Go to: https://app.supabase.com
   - Project: eaqogmybihiqzivuwyav
   - Table Editor → users
   - Find your user and set:
     - is_admin = true ✓
     - role = 'admin' ✓

2. Login to: https://betnexa.vercel.app
3. Go to: https://betnexa.vercel.app/muleiadmin
4. Should see admin dashboard with tabs

---

## 🔄 Automatic Deployments

Your projects are now connected to GitHub! Each time you push to GitHub:

```bash
git push origin master
```

Both Frontend and Backend will **auto-deploy** to Vercel without any manual action!

---

## 📊 Monitoring Your Deployment

### Frontend Analytics
https://vercel.com/dashboard/betnexa/analytics

### Backend Logs
https://vercel.com/dashboard/server-chi-orcin/logs

### Deployments History
- Frontend: https://vercel.com/dashboard/betnexa/deployments
- Backend: https://vercel.com/dashboard/server-chi-orcin/deployments

---

## 🔒 Security Checklist

✅ API keys stored securely in Vercel (not in code)  
✅ .env files added to .gitignore  
✅ Admin portal protected by AdminProtectedRoute  
✅ Supabase RLS policies enabled  
✅ Session management for multi-device login  
✅ Backend CORS enabled for frontend domain  

---

## 🚀 Connected Services

| Service | URL | Status |
|---------|-----|--------|
| Frontend | https://betnexa.vercel.app | ✓ Deployed |
| Backend | https://server-chi-orcin.vercel.app | ✓ Deployed |
| Database | Supabase (eaqogmybihiqzivuwyav) | ✓ Connected |
| Payments | PayHero | ✓ Configured |
| Repository | github.com/betnex01-netizen/betnexa2 | ✓ Connected |

---

## 📱 Features Ready to Test

- ✅ User Registration & Login
- ✅ Multi-Device Login Support
- ✅ Admin Portal Management
- ✅ Game Management
- ✅ Betting Slip & Placement
- ✅ Balance Management
- ✅ Transaction History
- ✅ Profile Management
- ✅ Admin Logs & Auditing

---

## 💡 Next Steps

1. ✅ Add environment variables to both Vercel projects
2. ✅ Redeploy both projects
3. ✅ Test user registration and login
4. ✅ Make a test user admin
5. ✅ Access admin portal
6. ✅ Create test games and bets
7. ✅ Monitor logs in Vercel dashboard

Your BETNEXA platform is now live! 🎉

---

## 📞 Support

**Issues?**
- Check Vercel Logs: https://vercel.com/dashboard/server-chi-orcin/logs
- Check GitHub Issues: https://github.com/betnex01-netizen/betnexa2/issues
- Review Supabase Logs: https://app.supabase.com/project/eaqogmybihiqzivuwyav/logs

Happy betting! 🎯
