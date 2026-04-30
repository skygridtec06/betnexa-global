# Set environment variable for Vercel frontend
$backendUrl = "https://betnexa-globalback.vercel.app"

# Use echo and pipe to vercel
$backendUrl | npx vercel env add VITE_API_URL --yes
