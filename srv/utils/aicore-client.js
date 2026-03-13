const axios = require('axios');

class AICoreClient {
  constructor() {
    const vcapServices = JSON.parse(process.env.VCAP_SERVICES || '{}');
    const aiCoreService = vcapServices.aicore?.[0];
    
    if (!aiCoreService) {
      console.error('AI Core service not found in VCAP_SERVICES');
      throw new Error('AI Core service not configured');
    }
    
    const creds = aiCoreService.credentials;
    
    this.aiApiUrl = creds.serviceurls.AI_API_URL;
    this.clientId = creds.clientid;
    this.clientSecret = creds.clientsecret;
    this.authUrl = creds.url;
    this.identityZone = creds.identityzone;
    
    this.resourceGroup = process.env.AI_RESOURCE_GROUP || 'default';
    this.deploymentId = process.env.AI_DEPLOYMENT_ID;
    
    console.log(' AICoreClient Configuration:');
    console.log('   AI API URL:', this.aiApiUrl);
    console.log('   Auth URL:', this.authUrl);
    console.log('   Resource Group:', this.resourceGroup);
    console.log('  Deployment ID:', this.deploymentId || ' NOT SET');
    
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  async getAccessToken() {
    try {
      if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
        return this.accessToken;
      }

      console.log('🔄 Requesting new OAuth2 token...');
      
      const tokenUrl = `${this.authUrl}/oauth/token`;
      const params = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.clientId,
        client_secret: this.clientSecret
      });

      const response = await axios.post(tokenUrl, params.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 10000
      });

      this.accessToken = response.data.access_token;
      const expiresIn = response.data.expires_in || 3600;
      this.tokenExpiry = Date.now() + ((expiresIn - 300) * 1000);
      
      console.log(' OAuth2 token obtained');
      return this.accessToken;
      
    } catch (error) {
      console.error(' OAuth2 Token Error:', error.message);
      throw new Error(`Failed to get OAuth2 token: ${error.message}`);
    }
  }

  /**
   * Call AI Core - Azure OpenAI GPT-5 Compatible
   */
  async chatCompletion(userQuery, systemPrompt = null) {
    try {
      if (!this.deploymentId) {
        throw new Error('AI_DEPLOYMENT_ID is not configured');
      }

      console.log(' AI Chat Completion (GPT-5):');
      console.log('  - Query:', userQuery.substring(0, 100) + '...');
      
      const token = await this.getAccessToken();
      
      // Azure OpenAI format for GPT-5
      const messages = [];
      
      if (systemPrompt) {
        messages.push({
          role: 'system',
          content: systemPrompt
        });
      }
      
      messages.push({
        role: 'user',
        content: userQuery
      });

      // Payload optimized for Azure OpenAI GPT-5
      const payload = {
        messages: messages,
        max_tokens: 2000,
        temperature: 0.7,
        top_p: 0.95,
        frequency_penalty: 0,
        presence_penalty: 0,
        stream: false
      };

      const apiEndpoint = `${this.aiApiUrl}/v2/inference/deployments/${this.deploymentId}/chat/completions`;
      
      console.log(' Calling AI Core (Azure OpenAI)...');
      console.log('  - Endpoint:', apiEndpoint);
      
      const response = await axios.post(apiEndpoint, payload, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'AI-Resource-Group': this.resourceGroup,
          'Accept': 'application/json'
        },
        timeout: 60000,
        validateStatus: (status) => status < 500 // Don't throw on 4xx errors
      });

      console.log('📥 Response Status:', response.status);

      if (response.status === 404) {
        console.error('404 Error - Trying alternative endpoint format...');
        
        // Try without /chat/completions suffix
        const altEndpoint = `${this.aiApiUrl}/v2/inference/deployments/${this.deploymentId}`;
        console.log('Trying:', altEndpoint);
        
        const altResponse = await axios.post(altEndpoint, payload, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'AI-Resource-Group': this.resourceGroup
          },
          timeout: 60000
        });
        
        return this.extractAnswer(altResponse.data);
      }

      if (response.status !== 200) {
        throw new Error(`HTTP ${response.status}: ${JSON.stringify(response.data)}`);
      }

      return this.extractAnswer(response.data);
      
    } catch (error) {
      console.error('AI Core Error:');
      console.error('  - Message:', error.message);
      
      if (error.response) {
        console.error('  - Status:', error.response.status);
        console.error('  - Data:', JSON.stringify(error.response.data, null, 2));
      }
      
      throw new Error(`AI Core request failed: ${error.message}`);
    }
  }

  /**
   * Extract answer from various response formats
   */
  extractAnswer(data) {
    console.log('📦 Response structure:', Object.keys(data));
    
    // Azure OpenAI format
    if (data.choices && data.choices.length > 0) {
      const choice = data.choices[0];
      
      if (choice.message?.content) {
        console.log('✅ Using choices[0].message.content');
        return choice.message.content;
      }
      
      if (choice.text) {
        console.log('✅ Using choices[0].text');
        return choice.text;
      }
    }
    
    // Alternative formats
    if (data.content) {
      console.log('✅ Using data.content');
      return data.content;
    }
    
    if (data.output) {
      console.log('✅ Using data.output');
      return data.output;
    }
    
    if (data.text) {
      console.log('✅ Using data.text');
      return data.text;
    }
    
    if (data.result) {
      console.log('✅ Using data.result');
      return data.result;
    }
    
    console.error('❌ Unknown response format:', JSON.stringify(data, null, 2));
    throw new Error('Could not extract answer from AI response');
  }

  async getSkillSphereResponse(userQuery, contextData = null) {
    const systemPrompt = `You are an AI assistant for SkillSphere, an enterprise skill management platform.

Help managers and employees with:
- Finding team members with specific skills
- Analyzing team capabilities and skill gaps  
- Project allocation insights
- Employee availability tracking

Be concise, professional, and data-driven.
${contextData ? `\n\nContext:\n${JSON.stringify(contextData, null, 2)}` : ''}`;

    return await this.chatCompletion(userQuery, systemPrompt);
  }
}

module.exports = AICoreClient;