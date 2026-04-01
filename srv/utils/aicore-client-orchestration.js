const axios = require('axios');
const cds = require('@sap/cds');

function _readJsonEnv(name) {
  try {
    return JSON.parse(process.env[name] || '{}');
  } catch {
    return {};
  }
}

function _normalizeConfig({ aiApiUrl, authUrl, clientId, clientSecret, resourceGroup, deploymentId, modelName }) {
  return {
    aiApiUrl,
    authUrl,
    clientId,
    clientSecret,
    resourceGroup: resourceGroup || 'default',
    deploymentId,
    modelName: modelName || 'gpt-4o'
  };
}

function _resolveFromVcap() {
  const vcap = _readJsonEnv('VCAP_SERVICES');
  const aiCore = vcap.aicore?.[0];
  if (!aiCore?.credentials) {
    return null;
  }

  const creds = aiCore.credentials;
  return _normalizeConfig({
    aiApiUrl: creds.serviceurls?.AI_API_URL,
    authUrl: creds.url ? `${creds.url}/oauth/token` : undefined,
    clientId: creds.clientid,
    clientSecret: creds.clientsecret,
    resourceGroup: process.env.AI_RESOURCE_GROUP,
    deploymentId: process.env.AI_DEPLOYMENT_ID,
    modelName: process.env.AI_MODEL_NAME
  });
}

function _resolveFromCdsConfig() {
  const creds = cds.env.requires?.aicore?.credentials;
  if (!creds) {
    return null;
  }

  return _normalizeConfig({
    aiApiUrl: creds.serviceurls?.AI_API_URL || creds.aiApiUrl || creds.url,
    authUrl: creds.tokenurl || creds.authUrl || (creds.url && !creds.url.includes('/oauth/token') ? `${creds.url}/oauth/token` : creds.url),
    clientId: creds.clientid || creds.clientId,
    clientSecret: creds.clientsecret || creds.clientSecret,
    resourceGroup: process.env.AI_RESOURCE_GROUP || creds.resourceGroup,
    deploymentId: process.env.AI_DEPLOYMENT_ID || creds.deploymentId,
    modelName: process.env.AI_MODEL_NAME || creds.modelName
  });
}

function _resolveFromEnv() {
  if (!process.env.AI_API_URL && !process.env.AI_AUTH_URL && !process.env.AI_TOKEN_URL) {
    return null;
  }

  return _normalizeConfig({
    aiApiUrl: process.env.AI_API_URL,
    authUrl: process.env.AI_TOKEN_URL || process.env.AI_AUTH_URL,
    clientId: process.env.AI_CLIENT_ID,
    clientSecret: process.env.AI_CLIENT_SECRET,
    resourceGroup: process.env.AI_RESOURCE_GROUP,
    deploymentId: process.env.AI_DEPLOYMENT_ID,
    modelName: process.env.AI_MODEL_NAME
  });
}

function _resolveConfig() {
  return _resolveFromVcap() || _resolveFromCdsConfig() || _resolveFromEnv();
}

class AICoreClient {
  constructor() {
    const config = _resolveConfig();

    if (!config) {
      throw new Error('AI Core configuration not found. Provide VCAP_SERVICES, cds.requires.aicore credentials, or AI_* environment variables');
    }

    this.aiApiUrl = config.aiApiUrl;
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.authUrl = config.authUrl;
    this.resourceGroup = config.resourceGroup;
    this.deploymentId = config.deploymentId;
    this.modelName = config.modelName;

    if (!this.aiApiUrl || !this.authUrl || !this.clientId || !this.clientSecret) {
      throw new Error('Incomplete AI Core configuration. Required: API URL, auth URL, client ID, and client secret');
    }

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

    const tokenUrl = this.authUrl.endsWith('/oauth/token')
      ? this.authUrl
      : `${this.authUrl}/oauth/token`;
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
