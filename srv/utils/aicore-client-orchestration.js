const axios = require('axios');

class AICoreClient {
  constructor() {
    const vcap = JSON.parse(process.env.VCAP_SERVICES || '{}');
    const aiCore = vcap.aicore?.[0];

    if (!aiCore) {
      throw new Error('AI Core service not bound');
    }

    const creds = aiCore.credentials;

    this.aiApiUrl = creds.serviceurls.AI_API_URL;
    this.clientId = creds.clientid;
    this.clientSecret = creds.clientsecret;
    this.authUrl = creds.url;
    this.resourceGroup = process.env.AI_RESOURCE_GROUP || 'default';
    this.deploymentId = process.env.AI_DEPLOYMENT_ID;
    this.modelName = process.env.AI_MODEL_NAME || 'gpt-4o';

    if (!this.deploymentId) {
      throw new Error('AI_DEPLOYMENT_ID not set in environment variables');
    }

    this.accessToken = null;
    this.tokenExpiry = 0;

    console.log('🤖 AI Core Orchestration Client initialized');
    console.log('  ✅ Model:', this.modelName);
    console.log('  ✅ Deployment:', this.deploymentId);
    console.log('  ✅ Resource Group:', this.resourceGroup);
  }

  async _getToken() {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    console.log('🔄 Getting OAuth2 token...');

    const tokenUrl = `${this.authUrl}/oauth/token`;
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.clientId,
      client_secret: this.clientSecret
    });

    const res = await axios.post(tokenUrl, body.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    this.accessToken = res.data.access_token;
    this.tokenExpiry = Date.now() + (res.data.expires_in - 300) * 1000;

    console.log('✅ OAuth2 token obtained');
    return this.accessToken;
  }

  async chatCompletion({ systemPrompt, userPrompt }) {
    if (!systemPrompt || !userPrompt) {
      throw new Error('systemPrompt and userPrompt are required');
    }

    console.log('🔄 AI Chat Completion Request (Orchestration):');
    console.log('  - Query length:', userPrompt.length, 'characters');

    const token = await this._getToken();

    // SAP AI Core ORCHESTRATION payload format (CORRECT!)
    const payload = {
      orchestration_config: {
        module_configurations: {
          templating_module_config: {
            template: [
              {
                role: "system",
                content: systemPrompt
              },
              {
                role: "user",
                content: "{{?input}}"
              }
            ]
          },
          llm_module_config: {
            model_name: this.modelName,
            model_params: {
              max_tokens: 2000,
              temperature: 0.7,
              top_p: 0.95,
              frequency_penalty: 0,
              presence_penalty: 0
            }
          }
        }
      },
      input_params: {
        input: userPrompt
      }
    };

    // CORRECT orchestration endpoint: /completion (singular)
    const url = `${this.aiApiUrl}/v2/inference/deployments/${this.deploymentId}/completion`;

    console.log('🔄 Calling SAP AI Core Orchestration...');
    console.log('  - Endpoint:', url);

    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        'AI-Resource-Group': this.resourceGroup,
        'Content-Type': 'application/json'
      },
      timeout: 60000
    });

    console.log('✅ AI Core response received');

    // Extract answer from orchestration response
    const msg = 
      response.data?.orchestration_result?.choices?.[0]?.message?.content ||
      response.data?.module_results?.llm?.choices?.[0]?.message?.content ||
      response.data?.choices?.[0]?.message?.content;

    if (!msg) {
      console.error('❌ Unexpected response format:', JSON.stringify(response.data, null, 2));
      throw new Error('Invalid AI Core response format');
    }

    console.log('✅ Answer extracted:', msg.substring(0, 100) + '...');
    return msg;
  }
}

module.exports = AICoreClient;
