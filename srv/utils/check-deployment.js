const axios = require('axios');

async function checkDeployment() {
  try {
    const defaultEnv = require('../../default-env.json');
    const aiCoreService = defaultEnv.VCAP_SERVICES.aicore[0];
    const creds = aiCoreService.credentials;
    
    const deploymentId = 'd5daa676ad9d963c';
    
    console.log('🔄 Getting OAuth token...');
    const tokenUrl = `${creds.url}/oauth/token`;
    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: creds.clientid,
      client_secret: creds.clientsecret
    });
    
    const tokenResponse = await axios.post(tokenUrl, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    
    const accessToken = tokenResponse.data.access_token;
    console.log('✅ Token obtained\n');
    
    // Get specific deployment details
    console.log(`🔍 Fetching details for deployment: ${deploymentId}\n`);
    const deploymentUrl = `${creds.serviceurls.AI_API_URL}/v2/lm/deployments/${deploymentId}`;
    
    const response = await axios.get(deploymentUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'AI-Resource-Group': 'default'
      }
    });
    
    const deployment = response.data;
    
    console.log('📋 Deployment Details:');
    console.log('─'.repeat(60));
    console.log(`ID:              ${deployment.id}`);
    console.log(`Status:          ${deployment.status}`);
    console.log(`Scenario ID:     ${deployment.scenarioId}`);
    console.log(`Configuration:   ${deployment.configurationId}`);
    console.log(`Executable ID:   ${deployment.executableId || 'N/A'}`);
    console.log(`Model Name:      ${deployment.modelName || 'N/A'}`);
    console.log(`Version:         ${deployment.modelVersion || 'N/A'}`);
    console.log(`Created:         ${deployment.createdAt}`);
    console.log(`Modified:        ${deployment.modifiedAt}`);
    
    if (deployment.details) {
      console.log('\n📝 Details:', JSON.stringify(deployment.details, null, 2));
    }
    
    if (deployment.deploymentUrl) {
      console.log(`\n🔗 Deployment URL: ${deployment.deploymentUrl}`);
    }
    
    // Get configuration details
    console.log('\n🔍 Fetching configuration details...\n');
    const configUrl = `${creds.serviceurls.AI_API_URL}/v2/lm/configurations/${deployment.configurationId}`;
    
    const configResponse = await axios.get(configUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'AI-Resource-Group': 'default'
      }
    });
    
    const config = configResponse.data;
    
    console.log('⚙️  Configuration Details:');
    console.log('─'.repeat(60));
    console.log(`Name:            ${config.name || 'N/A'}`);
    console.log(`Scenario ID:     ${config.scenarioId}`);
    console.log(`Executable ID:   ${config.executableId}`);
    console.log(`Model Name:      ${config.parameters?.modelName || 'N/A'}`);
    console.log(`Model Version:   ${config.parameters?.modelVersion || 'N/A'}`);
    
    console.log('\n📦 Parameters:', JSON.stringify(config.parameters, null, 2));
    
    // Determine correct endpoint
    console.log('\n\n✅ RECOMMENDED CONFIGURATION:');
    console.log('─'.repeat(60));
    
    const scenario = deployment.scenarioId || config.scenarioId;
    
    if (scenario === 'foundation-models') {
      console.log('Scenario: Foundation Models (OpenAI-compatible)');
      console.log('\nCorrect endpoint format:');
      console.log(`${creds.serviceurls.AI_API_URL}/v2/inference/deployments/${deploymentId}/chat/completions`);
      console.log('\n✅ This is what you\'re already using - endpoint is correct!');
      console.log('\nPossible issues:');
      console.log('1. Model might not support chat completions');
      console.log('2. Try /completions instead of /chat/completions');
      console.log('3. Check if deployment is fully initialized');
    } else if (scenario === 'orchestration') {
      console.log('Scenario: Orchestration Service');
      console.log('\nCorrect endpoint format:');
      console.log(`${creds.serviceurls.AI_API_URL}/v2/inference/deployments/${deploymentId}/completion`);
    } else {
      console.log(`Scenario: ${scenario}`);
      console.log('\nTry these endpoints:');
      console.log(`1. ${creds.serviceurls.AI_API_URL}/v2/inference/deployments/${deploymentId}/chat/completions`);
      console.log(`2. ${creds.serviceurls.AI_API_URL}/v2/inference/deployments/${deploymentId}/completions`);
      console.log(`3. ${creds.serviceurls.AI_API_URL}/v2/inference/deployments/${deploymentId}/completion`);
      console.log(`4. ${creds.serviceurls.AI_API_URL}/v2/inference/deployments/${deploymentId}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

checkDeployment();