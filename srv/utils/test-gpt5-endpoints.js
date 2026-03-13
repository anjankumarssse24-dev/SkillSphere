const axios = require('axios');

async function testGPT5() {
  const defaultEnv = require('../../default-env.json');
  const creds = defaultEnv.VCAP_SERVICES.aicore[0].credentials;
  
  console.log('🔄 Getting OAuth token...');
  const tokenUrl = `${creds.url}/oauth/token`;
  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: creds.clientid,
    client_secret: creds.clientsecret
  });
  
  const tokenResp = await axios.post(tokenUrl, params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });
  
  const token = tokenResp.data.access_token;
  console.log('✅ Token obtained\n');
  
  const deploymentId = 'd9359f8ae853daf5'; // Newest deployment
  
  const payload = {
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Say hello in exactly 5 words.' }
    ],
    max_tokens: 50,
    temperature: 0.7
  };
  
  // GPT-5 specific endpoints based on Azure OpenAI API
  const endpoints = [
    `/v2/inference/deployments/${deploymentId}/chat/completions`,
    `/inference/deployments/${deploymentId}/chat/completions`,
    `/v2/deployments/${deploymentId}/chat/completions`,
    `/deployments/${deploymentId}/chat/completions`,
  ];
  
  for (const endpoint of endpoints) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`🔄 Testing: ${endpoint}`);
    console.log('='.repeat(70));
    
    try {
      const fullUrl = `${creds.serviceurls.AI_API_URL}${endpoint}`;
      console.log('URL:', fullUrl);
      
      const response = await axios.post(fullUrl, payload, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'AI-Resource-Group': 'default',
          'Content-Type': 'application/json',
          'api-version': '2024-02-15-preview' // Try Azure API version header
        },
        timeout: 15000
      });
      
      console.log(`\n✅✅✅ SUCCESS! ✅✅✅`);
      console.log('Status:', response.status);
      console.log('Response:', JSON.stringify(response.data, null, 2));
      console.log('\n🎯 WORKING CONFIGURATION:');
      console.log(`AI_DEPLOYMENT_ID=${deploymentId}`);
      console.log(`Endpoint pattern: ${endpoint}`);
      
      return { deploymentId, endpoint, response: response.data };
      
    } catch (e) {
      const status = e.response?.status || 'Network Error';
      const error = e.response?.data?.error || e.response?.data || e.message;
      console.log(`❌ ${status}:`, typeof error === 'object' ? JSON.stringify(error) : error);
      
      // Print more details for debugging
      if (e.response?.headers) {
        console.log('Response headers:', e.response.headers);
      }
    }
  }
  
  console.log('\n\n❌ All endpoints failed');
  console.log('\n📋 Error Analysis:');
  console.log('GPT-5 rejected "completion" subpath.');
  console.log('Likely needs Azure OpenAI compatible format.');
  console.log('\nPossible solutions:');
  console.log('1. Check AI Core documentation for GPT-5 specific API');
  console.log('2. Contact SAP support for correct endpoint');
  console.log('3. Use a different deployment (GPT-4 instead of GPT-5)');
  console.log('4. Use mock client until resolved');
}

testGPT5().catch(console.error);