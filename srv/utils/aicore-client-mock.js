/**
 * Mock AI Core Client for Testing (No BTP required)
 */
class MockAICoreClient {
  constructor() {
    console.log('🤖 MockAICoreClient initialized (MOCK MODE - No real AI)');
  }

  async chatCompletion(input, systemPrompt = null) {
    const rawQuery = typeof input === 'object' && input !== null
      ? input.userPrompt
      : input;
    const effectiveSystemPrompt = typeof input === 'object' && input !== null
      ? input.systemPrompt
      : systemPrompt;

    const userQuery = this.extractUserQuestion(rawQuery || '');

    console.log('🔄 Mock AI called with query:', userQuery);
    console.log('🔄 System prompt:', effectiveSystemPrompt);
    
    // Simulate AI processing delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Generate mock response based on query keywords
    let mockResponse = this.generateMockResponse(userQuery || '');
    
    console.log('✅ Mock AI response:', mockResponse);
    return mockResponse;
  }

  generateMockResponse(query) {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('skill') || lowerQuery.includes('skills')) {
      return `Based on my analysis, here are the key skills in your team:
- SAP ABAP: 5 employees (3 Expert, 2 Advanced)
- JavaScript: 8 employees (2 Expert, 4 Advanced, 2 Intermediate)
- Python: 3 employees (1 Expert, 2 Advanced)
- SAP Fiori: 6 employees (2 Expert, 3 Advanced, 1 Intermediate)

Your team has strong capabilities in SAP and web technologies.`;
    }
    
    if (lowerQuery.includes('available') || lowerQuery.includes('availability')) {
      return `Team Availability Summary:
- 12 employees are currently available (< 6 hours/day utilization)
- 5 employees are at moderate utilization (6-7 hours/day)
- 3 employees are fully utilized (8 hours/day)

Available employees with key skills:
1. John Doe - SAP ABAP Expert, 4 hrs/day
2. Jane Smith - JavaScript Advanced, 3 hrs/day
3. Mike Johnson - Python Expert, 5 hrs/day`;
    }
    
    if (lowerQuery.includes('team') || lowerQuery.includes('members')) {
      return `Your team consists of 20 members with the following distribution:
- Seniors: 8 members
- Mid-level: 10 members
- Juniors: 2 members

Top performers this quarter:
1. John Doe - Completed 3 projects, 95% utilization
2. Jane Smith - Led 2 major initiatives
3. Mike Johnson - 5 certifications achieved

All team members are actively engaged in skill development.`;
    }
    
    if (lowerQuery.includes('project')) {
      return `Current Project Status:
- Active Projects: 15
- Completed This Quarter: 8
- Upcoming: 5

Resource allocation:
- 60% on client projects
- 25% on internal initiatives
- 15% on training/development

No overallocation detected. Team capacity is well-balanced.`;
    }

  if (lowerQuery.includes('certification') || lowerQuery.includes('certificate')) {
    return `Certification Summary:
- 14 active certifications across the team
- 5 employees hold advanced-level certifications
- 3 certifications are expiring in the next quarter

Recommended next step: prioritize renewals and map certifications to project demand.`;
  }

  if (lowerQuery.includes('utilization') || lowerQuery.includes('workload')) {
    return `Utilization Overview:
- Average utilization: 6.4 hours/day
- 3 employees are near full capacity
- 6 employees have available bandwidth

Recommendation: shift non-critical tasks from high-load to mid-load members.`;
  }
    
    // Default response
    return `I understand you're asking about: "${query}"

As your SkillSphere AI Assistant, I can help you with:
• Team skills analysis and gap identification
• Employee availability and utilization tracking
• Project allocation recommendations
• Team capability assessments

Please ask me a specific question about your team, skills, projects, or availability.`;
  }

  extractUserQuestion(promptText) {
    if (!promptText || typeof promptText !== 'string') {
      return '';
    }

    const patterns = [
      /USER QUESTION:\s*([\s\S]*?)\n\s*EMPLOYEE PROFILE:/i,
      /MANAGER QUESTION:\s*([\s\S]*?)\n\s*TEAM MEMBERS:/i,
      /SENIOR MANAGER QUESTION:\s*([\s\S]*?)\n\s*ORGANIZATIONAL STRUCTURE:/i
    ];

    for (const pattern of patterns) {
      const match = promptText.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return promptText.trim();
  }

  async getSkillSphereResponse(userQuery, contextData = null) {
    return await this.chatCompletion(userQuery);
  }
}

module.exports = MockAICoreClient;