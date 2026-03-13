const axios = require('axios');

async function testOrchestrationModels() {
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
  
  const deploymentId = 'db09062569caa280';
  
  // Try different model names
  const modelsToTry = [
    'gpt-4o',
    'gpt-4-turbo',
    'gpt-35-turbo',
    'gpt-4o-mini',
    'gpt-4-32k',
    'azure-gpt-4',
    'azure-openai-gpt-4',
    'claude-3-sonnet',
    'claude-3-5-sonnet',
    'gemini-1.5-pro'
  ];
  
  for (const modelName of modelsToTry) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`🔄 Testing model: ${modelName}`);
    console.log('='.repeat(70));
    
    const payload = {
      "orchestration_config": {
        "module_configurations": {
          "templating_module_config": {
            "template": [
              {
                "role": "user",
                "content": "{{?input}}"
              }
            ]
          },
          "llm_module_config": {
            "model_name": modelName,
            "model_params": {
              "max_tokens": 100,
              "temperature": 0.7
            }
          }
        }
      },
      "input_params": {
        "input": "Say hello in exactly 5 words."
      }
    };
    
    try {
      const endpoint = `/v2/inference/deployments/${deploymentId}/completion`;
      const fullUrl = `${creds.serviceurls.AI_API_URL}${endpoint}`;
      
      const response = await axios.post(fullUrl, payload, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'AI-Resource-Group': 'default',
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });
      
      console.log(`\n✅✅✅ SUCCESS WITH ${modelName}! ✅✅✅`);
      console.log('Status:', response.status);
      console.log('Response:', JSON.stringify(response.data, null, 2));
      console.log(`\n🎯 USE THIS MODEL:`);
      console.log(`AI_MODEL_NAME=${modelName}`);
      
      // Found a working model, stop testing
      return { modelName, response: response.data };
      
    } catch (e) {
      const status = e.response?.status || 'Network Error';
      const errorMsg = e.response?.data?.message || e.message;
      console.log(`  ❌ ${status}: ${errorMsg}`);
    }
  }
  
  console.log('\n\n❌ No working models found!');
  console.log('You may need to check AI Launchpad for available models.');
}

testOrchestrationModels().catch(console.error);