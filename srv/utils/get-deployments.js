const axios = require('axios');

async function getDeployments() {
  try {
    const defaultEnv = require('../../default-env.json');
    const aiCoreService = defaultEnv.VCAP_SERVICES.aicore[0];
    const creds = aiCoreService.credentials;
    
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
    
    // Try different resource groups
    const resourceGroups = ['default', 'defaultai', 'Default', 'rg-default'];
    
    for (const rg of resourceGroups) {
      try {
        console.log(`\n🔍 Checking resource group: "${rg}"`);
        const deploymentsUrl = `${creds.serviceurls.AI_API_URL}/v2/lm/deployments`;
        
        const deploymentsResponse = await axios.get(deploymentsUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'AI-Resource-Group': rg
          }
        });
        
        const deployments = deploymentsResponse.data.resources || [];
        console.log(`   Found ${deployments.length} deployment(s) in "${rg}"`);
        
        if (deployments.length > 0) {
          deployments.forEach((d, i) => {
            console.log(`\n   --- Deployment ${i + 1} ---`);
            console.log(`   ID:            ${d.id}`);
            console.log(`   Status:        ${d.status}`);
            console.log(`   Scenario:      ${d.scenarioId}`);
            console.log(`   Configuration: ${d.configurationId}`);
            console.log(`   Created:       ${d.createdAt}`);
            
            if (d.status === 'RUNNING') {
              console.log(`\n   ✅ ACTIVE! Use this in your .env:`);
              console.log(`   AI_RESOURCE_GROUP=${rg}`);
              console.log(`   AI_DEPLOYMENT_ID=${d.id}`);
            }
          });
        }
      } catch (err) {
        console.log(`   ❌ Error accessing "${rg}":`, err.response?.data || err.message);
      }
    }
    
    console.log('\n\n=== SUMMARY ===');
    console.log('If you see a RUNNING deployment above, copy those values to your .env file.');
    console.log('If no deployments found, you need to:');
    console.log('1. Go to SAP AI Launchpad');
    console.log('2. Create a configuration for a model (GPT-4, Claude, etc.)');
    console.log('3. Deploy it');
    console.log('4. Come back and run this script again\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
  }
}

getDeployments();