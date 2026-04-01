/**
 * SkillSphere Service Implementation
 * Handles business logic, validations, and custom actions
 */
const cds = require('@sap/cds');
const AICoreClient = require('./utils/aicore-client-orchestration');

module.exports = cds.service.impl(async function() {
  const { 
    Users, Employees, Managers, Skills, Projects, Profiles,
    CurrentProjects, CAIAUtilization, POCUtilization, Certifications
  } = this.entities;

  console.log('🚀 Initializing SkillSphere...');
  let aiClient = null;

  function _extractBearerToken(req) {
    const authHeader =
      req?.headers?.authorization ||
      req?.http?.req?.headers?.authorization ||
      req?.req?.headers?.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.slice('Bearer '.length);
  }
  
  async function getAIClient(req) {
    const jwt = _extractBearerToken(req);

    // Prefer request-scoped resolution first to support subscriber destinations.
    if (jwt) {
      try {
        return await AICoreClient.create({ jwt });
      } catch (error) {
        const expectedAuthNoneError = error.message?.includes('XSUAA service binding matching the token');
        if (expectedAuthNoneError) {
          console.log('ℹ️ Request-scoped destination lookup skipped (no XSUAA binding for token).');
        } else {
          console.warn('⚠️ Request-scoped AI Core initialization failed:', error.message);
        }
      }
    }

    if (!aiClient) {
      try {
        aiClient = await AICoreClient.create();
      } catch (error) {
        console.warn('⚠️ AI Core initialization failed:', error.message);
        console.warn('⚠️ AI features will be unavailable');
        aiClient = null;
      }
    }
    return aiClient;
  }

  /**
   * AI Assistant for EMPLOYEES - with personal context
   */
  this.on('askAIAssistant', async req => {
    try {
      const { query, employeeId } = req.data;

      console.log('🧪 askAIAssistant runtime:', { employeeId });

      if (!employeeId || !query) {
        return req.reject(400, 'employeeId and query are required');
      }

      const employee = await SELECT.one.from(Employees).where({ employeeId });
      if (!employee) {
        return req.reject(404, 'Employee not found');
      }

      const skills = await SELECT.from(Skills).where({ employeeId });
      const projects = await SELECT.from(CurrentProjects).where({ employeeId });

      const systemPrompt = `
You are an AI assistant for SkillSphere.

SECURITY RULES:
- You ONLY answer using data provided in THIS request
- You do NOT remember past conversations
- You do NOT infer missing data
- If information is missing, say so clearly

Request-scoped identity:
- Employee ID: ${employeeId}
- Employee Name: ${employee.name}
`;

      const userPrompt = `
USER QUESTION:
${query}

EMPLOYEE PROFILE:
- Name: ${employee.name}
- Role: ${employee.role || 'N/A'}
- Experience: ${employee.experience} years

SKILLS:
${skills.length ? skills.map(s =>
    `- ${s.skillName} (${s.proficiencyLevel})`).join('\n') : 'No skills data'}

CURRENT PROJECTS:
${projects.length ? projects.map(p =>
    `- ${p.projectName} (${p.role}, ${p.hoursPerDay} hrs/day)`).join('\n') : 'No active projects'}
`;

      console.log('📤 Sending employee AI request...');
      const aiClient = await getAIClient(req);
      if (!aiClient) {
        return req.reject(503, 'AI Core service unavailable');
      }
      
      const answer = await aiClient.chatCompletion({
        systemPrompt,
        userPrompt
      });

      console.log('✅ Employee AI response received');
      return { answer, success: true };
    } catch (error) {
      console.error('❌ askAIAssistant error:', error);
      return req.reject(500, `AI query failed: ${error.message}`);
    }
  });

  /**
   * AI Assistant for MANAGERS - with team context
   */
  this.on('managerQuery', async req => {
    try {
      const { managerId, queryType, context } = req.data;

      console.log('🧪 managerQuery runtime:', { managerId });

      if (!managerId || !context) {
        return req.reject(400, 'managerId and query are required');
      }

      const team = await SELECT.from(Employees).where({ managerId });

      const teamIds = team.map(e => e.employeeId);

      const skills = teamIds.length > 0
        ? await SELECT.from(Skills).where({ employeeId: { in: teamIds } })
        : [];

      const projects = teamIds.length > 0
        ? await SELECT.from(CurrentProjects).where({ employeeId: { in: teamIds } })
        : [];

      console.log(`📊 Manager data: ${team.length} team members, ${skills.length} skills, ${projects.length} projects`);

      const systemPrompt = `
You are an AI assistant for SkillSphere helping a manager.

SECURITY RULES:
- You ONLY answer using data in THIS request
- You do NOT assume access to other teams
- You do NOT remember previous requests

Request-scoped identity:
- Manager ID: ${managerId}
- Team Size: ${team.length}
`;

      const userPrompt = `
MANAGER QUESTION:
${context}

TEAM MEMBERS:
${team.map(e =>
  `- ${e.name} (${e.employeeId}, ${e.role || 'N/A'})`).join('\n')}

SKILLS:
${skills.map(s =>
  `- ${s.skillName} (${s.proficiencyLevel}) - ${s.employeeId}`).join('\n')}

CURRENT PROJECTS:
${projects.map(p =>
  `- ${p.projectName} (${p.role}) - ${p.employeeId}`).join('\n')}
`;

      console.log('📤 Sending manager AI request...');
      const aiClient = await getAIClient(req);
      if (!aiClient) {
        return req.reject(503, 'AI Core service unavailable');
      }
      
      const answer = await aiClient.chatCompletion({
        systemPrompt,
        userPrompt
      });

      console.log('✅ Manager AI response received');
      return { answer, success: true };
    } catch (error) {
      console.error('❌ managerQuery error:', error);
      return req.reject(500, `AI query failed: ${error.message}`);
    }
  });

  /**
   * AI Assistant for SENIOR MANAGERS - with organization-wide context
   */
  this.on('seniorManagerQuery', async req => {
    try {
      const { seniorManagerId, queryType, context } = req.data;

      console.log('🧪 seniorManagerQuery runtime:', { seniorManagerId });

      if (!seniorManagerId || !context) {
        return req.reject(400, 'seniorManagerId and query are required');
      }

      // Get all manager users reporting to the senior manager
      // In Users table, managers have role='Manager' and their managerId field points to SMGR
      const managerUsers = await SELECT.from(Users).where({ 
        role: 'Manager', 
        managerId: seniorManagerId 
      });
      
      console.log(`Found ${managerUsers.length} manager users reporting to ${seniorManagerId}`);
      
      // Get manager IDs from the user records
      const managerIds = managerUsers.map(mu => mu.id);
      
      // Get full manager details from Managers table
      const managers = managerIds.length > 0 
        ? await SELECT.from(Managers).where({ managerId: { in: managerIds } })
        : [];
      
      // Get all employees (both direct and indirect reports)
      const allEmployees = await SELECT.from(Employees);
      
      // Filter employees under this senior manager's organization
      const orgEmployees = allEmployees.filter(e => 
        managerIds.includes(e.managerId) || e.managerId === seniorManagerId
      );

      const employeeIds = orgEmployees.map(e => e.employeeId);

      // Get skills for all employees in the organization
      const skills = employeeIds.length > 0
        ? await SELECT.from(Skills).where({ employeeId: { in: employeeIds } })
        : [];

      // Get all projects for the organization
      const projects = employeeIds.length > 0
        ? await SELECT.from(CurrentProjects).where({ employeeId: { in: employeeIds } })
        : [];

      // Get certifications
      const certifications = employeeIds.length > 0
        ? await SELECT.from(Certifications).where({ employeeId: { in: employeeIds } })
        : [];

      console.log(`📊 Data loaded: ${managers.length} managers, ${orgEmployees.length} employees, ${skills.length} skills, ${projects.length} projects, ${certifications.length} certifications`);

      const systemPrompt = `
You are an AI assistant for SkillSphere helping a senior manager/VP.

SECURITY RULES:
- You ONLY answer using data in THIS request
- You do NOT assume access to other organizations
- You do NOT remember previous requests

Request-scoped identity:
- Senior Manager ID: ${seniorManagerId}
- Managers in Organization: ${managers.length}
- Total Employees: ${orgEmployees.length}
`;

      const userPrompt = `
SENIOR MANAGER QUESTION:
${context}

ORGANIZATIONAL STRUCTURE:
Managers (${managers.length}):
${managers.map(m =>
  `- ${m.name} (${m.managerId}, ${m.team} - ${m.subTeam})`).join('\n')}

Employees (${orgEmployees.length}):
${orgEmployees.slice(0, 50).map(e =>
  `- ${e.name} (${e.employeeId}, ${e.role || 'N/A'}) - Manager: ${e.managerId}`).join('\n')}
${orgEmployees.length > 50 ? `... and ${orgEmployees.length - 50} more employees` : ''}

SKILLS SUMMARY (${skills.length} total):
${skills.slice(0, 100).map(s =>
  `- ${s.skillName} (${s.proficiencyLevel}) - ${s.employeeId}`).join('\n')}
${skills.length > 100 ? `... and ${skills.length - 100} more skills` : ''}

ACTIVE PROJECTS (${projects.length} total):
${projects.slice(0, 50).map(p =>
  `- ${p.projectName} (${p.role}) - ${p.employeeId}, Status: ${p.status}`).join('\n')}
${projects.length > 50 ? `... and ${projects.length - 50} more projects` : ''}

CERTIFICATIONS (${certifications.length} total):
${certifications.slice(0, 30).map(c =>
  `- ${c.name} (${c.level || 'N/A'}) - ${c.employeeId}`).join('\n')}
${certifications.length > 30 ? `... and ${certifications.length - 30} more certifications` : ''}
`;

      console.log('📤 Sending request to AI...');
      const aiClient = await getAIClient(req);
      if (!aiClient) {
        return req.reject(503, 'AI Core service unavailable');
      }
      
      const answer = await aiClient.chatCompletion({
        systemPrompt,
        userPrompt
      });

      console.log('✅ AI response received successfully');
      return { answer, success: true };
    } catch (error) {
      console.error('❌ seniorManagerQuery error:', error);
      return req.reject(500, `AI query failed: ${error.message}`);
    }
  });


  /**
   * Login Action - Authenticate user credentials
   * Clear any existing chat history for this user on login
   */
  this.on('login', async (req) => {
    const { username, password } = req.data;
    const user = await SELECT.one.from(Users).where({ username, password });
    
    if (user) {
      // Clear chat history for this user on login to start fresh
      const userId = user.role === 'Employee' ? user.username : user.username;
      try { getAIClient().clearUserChat(userId); } catch(_) {}
      console.log(`🔐 User logged in: ${user.username} (${user.role}), chat cleared`);
      
      return { success: true, user, message: 'Login successful' };
    }
    return { success: false, user: null, message: 'Invalid credentials' };
  });

  /**
   * Clear Chat Action - Clear chat history for a specific user
   */
  this.on('clearChat', async (req) => {
    const { userId } = req.data;
    
    if (!userId) {
      return { success: false, message: 'User ID is required' };
    }
    
    try {
      getAIClient().clearUserChat(userId);
      console.log(`🗑️ Chat cleared for user: ${userId}`);
      return { success: true, message: 'Chat history cleared successfully' };
    } catch (error) {
      console.error('❌ Error clearing chat:', error.message);
      return { success: false, message: `Error clearing chat: ${error.message}` };
    }
  });

  /**
   * Get Employee Statistics Function
   */
  this.on('getEmployeeStats', async (req) => {
    const { employeeId } = req.data;
    const skills = await SELECT.from(Skills).where({ employeeId });
    const projects = await SELECT.from(Projects).where({ employeeId });
    const currentProjects = await SELECT.from(CurrentProjects).where({ employeeId });

    return {
      employeeId,
      totalSkills: skills.length,
      totalProjects: projects.length,
      currentProjects: currentProjects.length
    };
  });

  /**
   * Get Utilization Summary Function
   */
  this.on('getUtilizationSummary', async (req) => {
    const { employeeId } = req.data;
    const currentProj = await SELECT.one.from(CurrentProjects).where({ employeeId });
    const caia = await SELECT.one.from(CAIAUtilization).where({ employeeId });
    const poc = await SELECT.one.from(POCUtilization).where({ employeeId });

    return {
      employeeId,
      currentProjectHours: currentProj?.hoursPerDay || 0,
      caiaHours: caia?.hoursPerDay || 0,
      pocHours: poc?.hoursPerDay || 0,
      totalHours: (currentProj?.hoursPerDay || 0) + (caia?.hoursPerDay || 0) + (poc?.hoursPerDay || 0)
    };
  });

  // ============ BEFORE CREATE VALIDATIONS ============

  /**
   * Skills - Generate ID and validate before creation
   */
  this.before('CREATE', 'Skills', async (req) => {
    const skills = await SELECT.from(Skills);
    req.data.skillId = `SKL${String(skills.length + 1).padStart(3, '0')}`;
  });

  /**
   * Projects - Generate ID and validate before creation
   */
  this.before('CREATE', 'Projects', async (req) => {
    const projects = await SELECT.from(Projects);
    req.data.projectId = `PRJ${String(projects.length + 1).padStart(3, '0')}`;
  });

  /**
   * CurrentProjects - Generate ID and timestamps
   */
  this.before('CREATE', 'CurrentProjects', async (req) => {
    const currentProjects = await SELECT.from(CurrentProjects);
    req.data.currentProjectId = `CP${String(currentProjects.length + 1).padStart(4, '0')}`;
    req.data.assignedDate = new Date().toISOString().split('T')[0];
  });

  /**
   * CAIAUtilization - Generate ID and timestamps
   */
  this.before('CREATE', 'CAIAUtilization', async (req) => {
    const caiaRecords = await SELECT.from(CAIAUtilization);
    req.data.caiaId = `CAIA${String(caiaRecords.length + 1).padStart(3, '0')}`;
    req.data.startDate = new Date().toISOString().split('T')[0];
  });

  /**
   * POCUtilization - Generate ID and timestamps
   */
  this.before('CREATE', 'POCUtilization', async (req) => {
    const pocRecords = await SELECT.from(POCUtilization);
    req.data.pocId = `POC${String(pocRecords.length + 1).padStart(3, '0')}`;
    req.data.startDate = new Date().toISOString().split('T')[0];
  });

  // ============ BEFORE UPDATE HANDLERS ============

  /**
   * Log and track Employee profile updates
   */
  this.before('UPDATE', 'Employees', async (req) => {
    console.log('📝 Updating Employee profile:', req.data);
    req.data.lastUpdated = new Date().toISOString();
  });

  /**
   * Log and track Skills updates
   */
  this.before('UPDATE', 'Skills', async (req) => {
    console.log('📝 Updating Skill:', req.data);
    req.data.lastUpdated = new Date().toISOString();
  });

  /**
   * Log and track Projects updates
   */
  this.before('UPDATE', 'Projects', async (req) => {
    console.log('📝 Updating Project:', req.data);
    req.data.lastUpdated = new Date().toISOString();
  });

  /**
   * Update lastUpdated timestamp for time-tracked entities
   */
  this.before('UPDATE', 'CurrentProjects', async (req) => {
    req.data.lastUpdated = new Date().toISOString();
  });

  this.before('UPDATE', 'CAIAUtilization', async (req) => {
    req.data.lastUpdated = new Date().toISOString();
  });

  this.before('UPDATE', 'POCUtilization', async (req) => {
    req.data.lastUpdated = new Date().toISOString();
  });

  this.before('UPDATE', 'Profiles', async (req) => {
    req.data.lastUpdated = new Date().toISOString();
  });

  // ============ AFTER READ HANDLERS ============

  /**
   * Log successful reads (optional - can be removed for production)
   */
  this.after('READ', 'Skills', (skills) => {
    if (Array.isArray(skills)) {
      console.log(`📖 Retrieved ${skills.length} skills`);
    }
  });

  this.after('READ', 'Projects', (projects) => {
    if (Array.isArray(projects)) {
      console.log(`📖 Retrieved ${projects.length} projects`);
    }
  });

  this.after('READ', 'Employees', (employees) => {
    if (Array.isArray(employees)) {
      console.log(`📖 Retrieved ${employees.length} employees`);
    }
  });

  // ============ AFTER CREATE/UPDATE/DELETE HANDLERS ============

  /**
   * Update employee statistics after skill changes
   */
  this.after(['CREATE', 'DELETE'], 'Skills', async (data, req) => {
    const employeeId = data.employeeId || req.data?.employeeId;
    
    if (employeeId) {
      const skills = await SELECT.from(Skills).where({ employeeId });
      await UPDATE(Employees).set({ totalSkills: skills.length }).where({ employeeId });
      console.log(`✅ Updated skill count for employee ${employeeId}: ${skills.length} skills`);
    }
  });

  /**
   * Update employee statistics after project changes
   */
  this.after(['CREATE', 'DELETE'], 'Projects', async (data, req) => {
    const employeeId = data.employeeId || req.data?.employeeId;
    
    if (employeeId) {
      const projects = await SELECT.from(Projects).where({ employeeId });
      await UPDATE(Employees).set({ totalProjects: projects.length }).where({ employeeId });
      console.log(`✅ Updated project count for employee ${employeeId}: ${projects.length} projects`);
    }
  });

  /**
   * Success logging for creates
   */
  this.after('CREATE', 'Skills', (skill) => {
    console.log(`✅ Skill created successfully:`, skill.skillId);
  });

  this.after('CREATE', 'Projects', (project) => {
    console.log(`✅ Project created successfully:`, project.projectId);
  });

  this.after('CREATE', 'Employees', (employee) => {
    console.log(`✅ Employee created successfully:`, employee.employeeId);
  });

  /**
   * Success logging for updates
   */
  this.after('UPDATE', 'Employees', (employee) => {
    console.log(`✅ Employee updated successfully:`, employee);
  });

  this.after('UPDATE', 'Skills', (skill) => {
    console.log(`✅ Skill updated successfully:`, skill);
  });

  this.after('UPDATE', 'Projects', (project) => {
    console.log(`✅ Project updated successfully:`, project);
  });

  // ============ ERROR HANDLING ============

 this.on('error', (err) => {
  console.error('❌ Service Error:', err.message || err);
});


  console.log('🚀 SkillSphere Service initialized successfully');
});
