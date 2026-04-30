// Test backend endpoint connectivity
const backendUrl = 'https://betnexa-globalback.vercel.app/';

console.log('🧪 Testing Backend Endpoints\n');
console.log(`Backend URL: ${backendUrl}\n`);

async function testEndpoint(endpoint, method = 'GET', body = null) {
  try {
    console.log(`Testing: ${method} ${endpoint}`);
    
    const options = {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://betnexa.vercel.app'
      }
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(`${backendUrl}${endpoint}`, options);
    console.log(`✅ Status: ${response.status}`);
    
    if (response.headers.get('content-type')?.includes('application/json')) {
      const data = await response.json();
      console.log('Response:', JSON.stringify(data, null, 2));
    } else {
      const text = await response.text();
      console.log('Response:', text.substring(0, 200));
    }
    console.log('---\n');
  } catch (error) {
    console.log(`❌ Error: ${error.message}\n`);
  }
}

async function runTests() {
  // Test health endpoint
  await testEndpoint('/api/health', 'GET');
  
  // Test payment initiation with mock data
  await testEndpoint('/api/payments/initiate', 'POST', {
    amount: 100,
    phoneNumber: '254712345678',
    userId: 'test-user-1'
  });
}

runTests().catch(console.error);
