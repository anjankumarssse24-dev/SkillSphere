const axios = require('axios');

async function testAllDeployments() {
  const defaultEnv = require('../../default-env.json');
  const creds = defaultEnv.VCAP_SERVICES.aicore[0].credentials;
  
  // Get token
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
  
  // Test these deployments (from your list)
  const deploymentIds = [
    'd9359f8ae853daf5', // Newest (Jan 7, 2026)
    'dcf9eeb94deed3a9', // Jan 7, 2026
    'd990d3cedd188374', // Jan 7, 2026
    'd5daa676ad9d963c', // Oct 29, 2025 (current one)
    'db09062569caa280'  // Orchestration (Sep 22, 2025)
  ];
  
  const payload = {
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Say hello in exactly 5 words.' }
    ],
    max_tokens: 50,
    temperature: 0.7
  };
  
  // Orchestration payload (different format)
  const orchPayload = {
    "orchestration_config": {
      "module_configurations": {
        "llm_module_config": {
          "model_name": "gpt-4",
          "model_params": {
            "max_tokens": 50,
            "temperature": 0.7
          }
        }
      }
    },
    "input_params": {
      "messages": [
        { role: 'user', content: 'Say hello in exactly 5 words.' }
      ]
    }
  };
  
  for (const deploymentId of deploymentIds) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`Testing Deployment: ${deploymentId}`);
    console.log('='.repeat(70));
    
    const isOrch = deploymentId === 'db09062569caa280';
    const testPayload = isOrch ? orchPayload : payload;
    
    // Try different endpoints
    const endpoints = [
      `/v2/inference/deployments/${deploymentId}/chat/completions`,
      `/v2/inference/deployments/${deploymentId}/completions`,
      `/v2/inference/deployments/${deploymentId}/completion`,
      `/v2/inference/deployments/${deploymentId}`,
      `/v2/invoke/${deploymentId}`,
      `/lm/deployments/${deploymentId}/inference`
    ];
    
    for (const endpoint of endpoints) {
      try {
        const fullUrl = `${creds.serviceurls.AI_API_URL}${endpoint}`;
        console.log(`\n🔄 Testing: ${endpoint}`);
        
        const response = await axios.post(fullUrl, testPayload, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'AI-Resource-Group': 'default',
            'Content-Type': 'application/json'
          },
          timeout: 10000
        });
        
        console.log(`SUCCESS!`);
        console.log('Response:', JSON.stringify(response.data, null, 2));
        console.log('\n🎯 USE THIS CONFIGURATION:');
        console.log(`AI_DEPLOYMENT_ID=${deploymentId}`);
        console.log(`Endpoint: ${endpoint}`);
        console.log('\nFull working URL:');
        console.log(fullUrl);
        
        // If we found one that works, we can stop
        return { deploymentId, endpoint, response: response.data };
        
      } catch (e) {
        const status = e.response?.status || 'Network Error';
        const errorMsg = e.response?.data?.error?.message || e.response?.data || e.message;
        console.log(`  ❌ ${status}: ${typeof errorMsg === 'object' ? JSON.stringify(errorMsg) : errorMsg.substring(0, 100)}`);
      }
    }
  }
  
  console.log('\n\n❌ None of the deployments worked with any endpoint!');
  console.log('This might indicate:');
  console.log('1. Deployments are not fully initialized');
  console.log('2. Different authentication or headers needed');
  console.log('3. AI Core service configuration issue');
}

testAllDeployments().catch(console.error);