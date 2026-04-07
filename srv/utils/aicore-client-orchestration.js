const axios = require('axios');

class AICoreClient {
  constructor() {
    const vcap = JSON.parse(process.env.VCAP_SERVICES || '{}');
    const aiCore = vcap.aicore?.[0];

    // Primary mode: Cloud Foundry service binding
    if (aiCore?.credentials) {
      const creds = aiCore.credentials;
      this.aiApiUrl = creds.serviceurls?.AI_API_URL;
      this.clientId = creds.clientid;
      this.clientSecret = creds.clientsecret;
      this.authUrl = creds.url;
      console.log('🔐 AI Core credentials source: VCAP_SERVICES binding');
    } else {
      // Local mode: explicit environment variables
      this.aiApiUrl =
        process.env.AI_API_URL ||
        process.env.AICORE_AI_API_URL ||
        process.env.AI_CORE_API_URL;
      this.clientId =
        process.env.AI_CLIENT_ID ||
        process.env.AICORE_CLIENTID ||
        process.env.AICORE_CLIENT_ID ||
        process.env.CLIENT_ID;
      this.clientSecret =
        process.env.AI_CLIENT_SECRET ||
        process.env.AICORE_CLIENTSECRET ||
        process.env.AICORE_CLIENT_SECRET ||
        process.env.CLIENT_SECRET;
      this.authUrl =
        process.env.AI_AUTH_URL ||
        process.env.AICORE_URL ||
        process.env.AICORE_AUTH_URL ||
        process.env.AI_TOKEN_BASE_URL;
      console.log('🔐 AI Core credentials source: local environment variables');
    }

    this.resourceGroup =
      process.env.AI_RESOURCE_GROUP ||
      process.env.AICORE_RESOURCE_GROUP ||
      'default';
    this.deploymentId = process.env.AI_DEPLOYMENT_ID || process.env.AICORE_DEPLOYMENT_ID;
    this.modelName = process.env.AI_MODEL_NAME || process.env.AICORE_MODEL_NAME || 'gpt-4o';

    const missing = [];
    if (!this.aiApiUrl) missing.push('AI_API_URL (or VCAP aicore.credentials.serviceurls.AI_API_URL)');
    if (!this.clientId) missing.push('AI_CLIENT_ID (or VCAP aicore.credentials.clientid)');
    if (!this.clientSecret) missing.push('AI_CLIENT_SECRET (or VCAP aicore.credentials.clientsecret)');
    if (!this.authUrl) missing.push('AI_AUTH_URL (or VCAP aicore.credentials.url)');
    if (!this.deploymentId) missing.push('AI_DEPLOYMENT_ID');

    if (missing.length) {
      throw new Error(`AI Core configuration missing: ${missing.join(', ')}`);
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
