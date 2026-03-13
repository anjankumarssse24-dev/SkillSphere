const axios = require('axios');

async function testAI() {
  const defaultEnv = require('../../default-env.json');
  const creds = defaultEnv.VCAP_SERVICES.aicore[0].credentials;
  
  // Get token
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
  const deploymentId = 'd5daa676ad9d963c';
  
  const payload = {
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Say hello in 5 words.' }
    ],
    max_tokens: 50,
    temperature: 0.7
  };
  
  // Try endpoint 1
  try {
    console.log('🔄 Test 1: /chat/completions');
    const r1 = await axios.post(
      `${creds.serviceurls.AI_API_URL}/v2/inference/deployments/${deploymentId}/chat/completions`,
      payload,
      { headers: { 'Authorization': `Bearer ${token}`, 'AI-Resource-Group': 'default', 'Content-Type': 'application/json' }}
    );
    console.log('✅ SUCCESS!', r1.data);
  } catch (e) {
    console.log('❌ Failed:', e.response?.status, e.response?.data);
  }
  
  
  // Try endpoint 2
  try {
    console.log('\n🔄 Test 2: base deployment URL');
    const r2 = await axios.post(
      `${creds.serviceurls.AI_API_URL}/v2/inference/deployments/${deploymentId}`,
      payload,
      { headers: { 'Authorization': `Bearer ${token}`, 'AI-Resource-Group': 'default', 'Content-Type': 'application/json' }}
    );
    console.log('✅ SUCCESS!', r2.data);
  } catch (e) {
    console.log('❌ Failed:', e.response?.status, e.response?.data);
  }
}

testAI().catch(console.error);