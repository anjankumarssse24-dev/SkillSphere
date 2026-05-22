/**
 * SkillSphere Service Implementation
 * Handles business logic, validations, and custom actions
 */
const cds = require('@sap/cds');
const AICoreClient = require('./utils/aicore-client-orchestration');

module.exports = cds.service.impl(async function() {
  const { 
    Users, Employees, Skills, Projects, Profiles,
    CurrentProjects, InitiativesMaster, EvaluationsMaster, CurrentInitiatives, CurrentEvaluations,
    Initiatives, CAIAUtilization, POCUtilization, Certifications
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

  function _toScopeList(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value.filter(Boolean);
    if (value instanceof Set) return Array.from(value).filter(Boolean);
    if (typeof value === 'string' && value.includes(' ')) {
      return value.split(' ').map(v => v.trim()).filter(Boolean);
    }
    if (typeof value === 'string') return [value];
    if (typeof value === 'object') return Object.keys(value).filter(Boolean);
    return [];
  }

  function _getRolesFromRequest(req) {
    const tokenInfo = req.user?.authInfo?.getTokenInfo?.() || req.user?.tokenInfo;
    const jwtPayload = tokenInfo?.getPayload?.() || req.user?.authInfo?.token || {};

    const roleCollections = _toScopeList(jwtPayload?.['xs.system.attributes']?.['xs.rolecollections']);
    const grantedScopes = [
      ..._toScopeList(req.user?._roles),
      ..._toScopeList(req.user?.scopes),
      ..._toScopeList(req.user?.roles),
      ..._toScopeList(req.user?.attr?.scope),
      ..._toScopeList(req.user?.attr?.scopes),
      ..._toScopeList(req.user?.attr?.authorities),
      ..._toScopeList(jwtPayload?.scope),
      ..._toScopeList(jwtPayload?.scp),
      ..._toScopeList(jwtPayload?.authorities)
    ].filter(Boolean);

    return {
      scopes: Array.from(new Set(grantedScopes)),
      roleCollections: Array.from(new Set(roleCollections))
    };
  }

  function _hasRole(req, roleName) {
    if (req.user?.is?.(roleName)) return true;

    const { scopes, roleCollections } = _getRolesFromRequest(req);
    const normalize = value => String(value || '').trim().toLowerCase();
    const tokenize = value => normalize(value).split(/[^a-z0-9]+/).filter(Boolean);
    const normalizedRole = normalize(roleName);

    const fromScopes = scopes.some(scope => {
      const normalizedScope = normalize(scope);
      return (
        normalizedScope === normalizedRole ||
        normalizedScope.endsWith(`.${normalizedRole}`)
      );
    });

    if (fromScopes) return true;

    return roleCollections.some(collection => {
      const normalizedCollection = normalize(collection);
      if (
        normalizedCollection === normalizedRole ||
        normalizedCollection.endsWith(`.${normalizedRole}`)
      ) {
        return true;
      }

      // Handle naming styles like Skillsphere_Senior_Manager by stripping separators.
      const compactCollection = normalizedCollection.replace(/[^a-z0-9]/g, '');
      if (
        compactCollection === normalizedRole ||
        compactCollection.endsWith(normalizedRole)
      ) {
        return true;
      }

      const tokens = tokenize(collection);
      return tokens.includes(normalizedRole);
    });
  }

  function _requireAnyRole(req, allowedRoles) {
    return allowedRoles.some(role => _hasRole(req, role));
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
      aiClient = await AICoreClient.create();
      console.log('🤖 Using SAP AI Core client');
    }
    return aiClient;
  }

  this.on('currentUserContext', async req => {
    const principalId = req.user?.id || '';
    const principalEmail = req.user?.attr?.email || req.user?.attr?.mail || principalId;
    const tokenInfo = req.user?.authInfo?.getTokenInfo?.() || req.user?.tokenInfo;
    const jwtPayload =
      tokenInfo?.getPayload?.() ||
      req.user?.authInfo?.token ||
      {};

    const toScopeList = value => {
      if (!value) return [];
      if (Array.isArray(value)) return value.filter(Boolean);
      if (value instanceof Set) return Array.from(value).filter(Boolean);
      if (typeof value === 'string' && value.includes(' ')) {
        return value.split(' ').map(v => v.trim()).filter(Boolean);
      }
      if (typeof value === 'string') return [value];
      if (typeof value === 'object') return Object.keys(value).filter(Boolean);
      return [];
    };

    const displayName =
      jwtPayload?.given_name ||
      jwtPayload?.name ||
      principalEmail?.split('@')[0] ||
      principalId;

    const { scopes: uniqueScopes, roleCollections: uniqueRoleCollections } = _getRolesFromRequest(req);

    const hasSeniorManagerRole = _hasRole(req, 'SeniorManager');
    const hasManagerRole = _hasRole(req, 'Manager');
    const hasEmployeeRole = _hasRole(req, 'Employee');

    console.log('🪪 currentUserContext role summary:', {
      principalId,
      principalEmail,
      userIsEmployee: req.user?.is?.('Employee') || false,
      userIsManager: req.user?.is?.('Manager') || false,
      userIsSeniorManager: req.user?.is?.('SeniorManager') || false,
      scopeCount: uniqueScopes.length,
      roleCollectionCount: uniqueRoleCollections.length,
      firstScopes: uniqueScopes.slice(0, 5),
      firstRoleCollections: uniqueRoleCollections.slice(0, 5),
      hasSeniorManagerRole,
      hasManagerRole,
      hasEmployeeRole
    });

    let resolvedRole = '';
    let targetDashboard = '';

    if (hasSeniorManagerRole) {
      resolvedRole = 'SeniorManager';
      targetDashboard = 'SeniorManagerDashboard';
    } else if (hasManagerRole) {
      resolvedRole = 'Manager';
      targetDashboard = 'ManagerDashboard';
    } else if (hasEmployeeRole) {
      resolvedRole = 'Employee';
      targetDashboard = 'EmployeeDashboard';
    }

    if (!resolvedRole) {
      console.warn('⛔ currentUserContext authorization failed: no supported role found', {
        principalId,
        principalEmail,
        grantedScopes: uniqueScopes,
        roleCollections: uniqueRoleCollections
      });
      return {
        authenticated: true,
        authorized: false,
        email: principalEmail,
        employeeId: '',
        name: '',
        role: '',
        targetDashboard: '',
        message: 'No business role assigned. Please contact administrator.'
      };
    }

    let employee = null;
    if (principalEmail) {
      employee = await SELECT.one.from(Employees).where({ email: principalEmail });
    }
    if (!employee && principalId) {
      employee = await SELECT.one.from(Employees).where({ employeeId: principalId });
    }

    if (!employee) {
      console.log('ℹ️ No employee master record found; routing to first-time setup');
      return {
        authenticated: true,
        authorized: true,
        email: principalEmail,
        employeeId: '',
        name: displayName || principalId,
        role: resolvedRole,
        targetDashboard: 'firstTimeSetup',
        isFirstTime: true,
        message: 'First time login - profile setup needed'
      };
    }

    console.log('✅ currentUserContext resolved:', {
      principalId,
      principalEmail,
      resolvedRole,
      targetDashboard,
      employeeFound: !!employee,
      employeeId: employee?.employeeId || principalId,
      employeeName: employee?.name || principalEmail || principalId,
      isFirstTime: !employee?.team && !employee?.location
    });

    // Check if this is a first-time user (no team/location filled yet)
    const isFirstTime = !employee?.team || !employee?.location;

    return {
      authenticated: true,
      authorized: true,
      email: employee?.email || principalEmail || principalId,
      employeeId: employee?.employeeId || '',
      name: employee?.name || principalEmail?.split('@')[0] || principalId,
      role: resolvedRole,
      targetDashboard: isFirstTime ? 'firstTimeSetup' : targetDashboard,
      isFirstTime: isFirstTime,
      message: isFirstTime ? 'First time login - profile setup needed' : 'Authenticated'
    };
  });

  /**
   * Complete First-Time Employee Profile Setup
   * Called when new employee fills in their details
   */
  this.on('completeFirstTimeSetup', async req => {
    try {
      const {
        loginEmployeeId,
        employeeId,
        name,
        team,
        subTeam,
        location,
        gradeLevel,
        tLevel,
        experience,
        managerId
      } = req.data;

      const normalizedLoginEmployeeId = String(loginEmployeeId || '').trim();
      const normalizedEmployeeId = String(employeeId || '').trim().toUpperCase();
      const normalizedManagerId = String(managerId || '').trim().toUpperCase();

      console.log('📝 Completing first-time setup for:', normalizedEmployeeId, 'from login ID:', normalizedLoginEmployeeId);

      if (!normalizedEmployeeId || !team || !location) {
        return req.reject(400, 'employeeId, team, and location are required');
      }

      if (!/^I\d+$/i.test(normalizedEmployeeId)) {
        return req.reject(400, 'employeeId must be a valid I-number (example: I774156)');
      }

      if (normalizedManagerId && !/^I\d+$/i.test(normalizedManagerId)) {
        return req.reject(400, 'managerId must be a valid I-number (example: I749085)');
      }

      if (normalizedManagerId && normalizedManagerId === normalizedEmployeeId) {
        return req.reject(400, 'managerId cannot be same as employeeId');
      }

      let existingEmployee = null;
      if (normalizedLoginEmployeeId) {
        existingEmployee = await SELECT.one.from(Employees).where({ employeeId: normalizedLoginEmployeeId });
      }

      if (!existingEmployee) {
        existingEmployee = await SELECT.one.from(Employees).where({ employeeId: normalizedEmployeeId });
      }

      if (!existingEmployee) {
        const principalEmail = req.user?.attr?.email || req.user?.attr?.mail || '';
        if (principalEmail) {
          existingEmployee = await SELECT.one.from(Employees).where({ email: principalEmail });
        }
      }

      if (normalizedManagerId) {
        const managerRecord = await SELECT.one.from(Employees).where({
          employeeId: normalizedManagerId,
          role: { in: ['Manager', 'SeniorManager'] }
        });

        if (!managerRecord) {
          return req.reject(400, 'managerId not found as a Manager/SeniorManager');
        }
      }

      const tx = cds.transaction(req);
      let oldEmployeeId = existingEmployee?.employeeId || '';

      if (existingEmployee && normalizedEmployeeId !== oldEmployeeId) {
        const duplicateEmployee = await SELECT.one.from(Employees).where({ employeeId: normalizedEmployeeId });
        if (duplicateEmployee) {
          return req.reject(409, `Employee ID ${normalizedEmployeeId} already exists`);
        }
      }

      if (!existingEmployee) {
        const duplicateEmployee = await SELECT.one.from(Employees).where({ employeeId: normalizedEmployeeId });
        if (duplicateEmployee) {
          return req.reject(409, `Employee ID ${normalizedEmployeeId} already exists`);
        }

        const principalEmail = req.user?.attr?.email || req.user?.attr?.mail || '';
        const displayName = principalEmail?.split('@')[0] || normalizedEmployeeId;

        // Use the same role resolution logic as currentUserContext
        const { scopes: uniqueScopes, roleCollections: uniqueRoleCollections } = _getRolesFromRequest(req);
        const hasSeniorManagerRole = _hasRole(req, 'SeniorManager');
        const hasManagerRole = _hasRole(req, 'Manager');
        const hasEmployeeRole = _hasRole(req, 'Employee');
        let resolvedRole = '';
        if (hasSeniorManagerRole) {
          resolvedRole = 'SeniorManager';
        } else if (hasManagerRole) {
          resolvedRole = 'Manager';
        } else if (hasEmployeeRole) {
          resolvedRole = 'Employee';
        } else {
          resolvedRole = 'Employee'; // fallback
        }

        await tx.run(INSERT.into(Employees).entries([{
          employeeId: normalizedEmployeeId,
          name: name || displayName,
          role: resolvedRole,
          team: team,
          subTeam: subTeam || '',
          managerId: normalizedManagerId || '',
          email: principalEmail,
          experience: experience || 0,
          totalSkills: 0,
          totalProjects: 0,
          location: location,
          tLevel: tLevel || '',
          gradeLevel: gradeLevel || ''
        }]));

        oldEmployeeId = normalizedEmployeeId;
      }

      if (existingEmployee && normalizedEmployeeId !== oldEmployeeId) {
        await tx.run(UPDATE(Employees).set({ managerId: normalizedEmployeeId }).where({ managerId: oldEmployeeId }));
        await tx.run(UPDATE(Skills).set({ employeeId: normalizedEmployeeId }).where({ employeeId: oldEmployeeId }));
        await tx.run(UPDATE(Projects).set({ employeeId: normalizedEmployeeId }).where({ employeeId: oldEmployeeId }));
        await tx.run(UPDATE(CurrentProjects).set({ employeeId: normalizedEmployeeId }).where({ employeeId: oldEmployeeId }));
        await tx.run(UPDATE(Initiatives).set({ employeeId: normalizedEmployeeId }).where({ employeeId: oldEmployeeId }));
        await tx.run(UPDATE(CAIAUtilization).set({ employeeId: normalizedEmployeeId }).where({ employeeId: oldEmployeeId }));
        await tx.run(UPDATE(POCUtilization).set({ employeeId: normalizedEmployeeId }).where({ employeeId: oldEmployeeId }));
        await tx.run(UPDATE(Certifications).set({ employeeId: normalizedEmployeeId }).where({ employeeId: oldEmployeeId }));
        await tx.run(UPDATE(Profiles).set({ employeeId: normalizedEmployeeId }).where({ employeeId: oldEmployeeId }));
      }

      if (existingEmployee) {
        // Update employee record with provided data
        await tx.run(UPDATE(Employees).set({
          employeeId: normalizedEmployeeId,
          name: name || undefined,
          team: team,
          subTeam: subTeam || '',
          location: location,
          gradeLevel: gradeLevel || '',
          tLevel: tLevel || '',
          experience: experience || 0,
          managerId: normalizedManagerId || ''
        }).where({ employeeId: oldEmployeeId }));
      }

      // Also create profile entry if not exists
      const existingProfile = await tx.run(SELECT.one.from(Profiles).where({ employeeId: normalizedEmployeeId }));
      if (!existingProfile) {
        // Get employee's actual role (not hardcoded)
        const employee = await tx.run(SELECT.one.from(Employees).where({ employeeId: normalizedEmployeeId }));
        const employeeRole = employee?.role || 'Employee';

        await tx.run(INSERT.into(Profiles).entries([{
          employeeId: normalizedEmployeeId,
          specialization: '',
          role: employeeRole,
          location: location,
          tLevel: tLevel || '',
          gradeLevel: gradeLevel || '',
          lastUpdated: new Date()
        }]));
      }

      console.log('✅ First-time setup completed for:', normalizedEmployeeId);

      return {
        success: true,
        message: 'Profile setup completed successfully!',
        employeeId: normalizedEmployeeId
      };
    } catch (error) {
      console.error('❌ completeFirstTimeSetup error:', error);
      return req.reject(500, `Profile setup failed: ${error.message}`);
    }
  });

  /**
   * AI Assistant for EMPLOYEES - with personal context
   */
  this.on('askAIAssistant', async req => {
    try {
      const { query, employeeId } = req.data;

      if (!_requireAnyRole(req, ['Employee', 'Manager', 'SeniorManager'])) {
        return req.reject(403, 'Forbidden');
      }

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

      if (!_requireAnyRole(req, ['Manager', 'SeniorManager'])) {
        return req.reject(403, 'Forbidden');
      }

      console.log('🧪 managerQuery runtime:', { managerId });

      if (!managerId || !context) {
        return req.reject(400, 'managerId and query are required');
      }

      //CHECK:- check how the AI assistant will work for Nirmala 
      const team = await SELECT.from(Employees).where({
        managerId,
        role: 'Employee'
      });

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

      if (!_requireAnyRole(req, ['SeniorManager'])) {
        return req.reject(403, 'Forbidden');
      }

      console.log('🧪 seniorManagerQuery runtime:', { seniorManagerId });

      if (!seniorManagerId || !context) {
        return req.reject(400, 'seniorManagerId and query are required');
      }

      // Managers directly reporting to this senior manager
      const managers = await SELECT.from(Employees).where({
        managerId: seniorManagerId,
        role: 'Manager'
      });

      const managerIds = managers.map(m => m.employeeId);

      // Employees directly under senior manager + employees under child managers
      const directEmployees = await SELECT.from(Employees).where({
        managerId: seniorManagerId,
        role: 'Employee'
      });

      const indirectEmployees = managerIds.length > 0
        ? await SELECT.from(Employees).where({
            managerId: { in: managerIds },
            role: 'Employee'
          })
        : [];

      const orgEmployees = [...directEmployees, ...indirectEmployees];

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
  `- ${m.name} (${m.employeeId}, ${m.team} - ${m.subTeam})`).join('\n')}

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
   * Clear Chat Action - Clear chat history for a specific user
   */
  this.on('clearChat', async (req) => {
    const { userId } = req.data;
    
    if (!userId) {
      return { success: false, message: 'User ID is required' };
    }
    
    try {
      const aiClient = await getAIClient(req);
      await aiClient.clearUserChat(userId);
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
    const currentProjects = await SELECT.from(CurrentProjects).where({ employeeId });
    const caiaRows = await SELECT.from(CAIAUtilization).where({ employeeId });
    const pocRows = await SELECT.from(POCUtilization).where({ employeeId });

    const activeCurrentProjects = currentProjects.filter(p => p.assignmentStatus !== 'Completed');
    const currentProjectUtilizationPercent = activeCurrentProjects.reduce(
      (sum, p) => sum + (Number(p.utilizationPercent) || 0),
      0
    );

    // Convert utilization percentage to hour-equivalent assuming 8 hours/day capacity.
    const currentProjectHours = Number(((currentProjectUtilizationPercent / 100) * 8).toFixed(2));
    const caiaHours = Number(caiaRows.reduce((sum, row) => sum + (Number(row.hoursPerDay) || 0), 0).toFixed(2));
    const pocHours = Number(pocRows.reduce((sum, row) => sum + (Number(row.hoursPerDay) || 0), 0).toFixed(2));
    const totalHours = Number((currentProjectHours + caiaHours + pocHours).toFixed(2));

    return {
      employeeId,
      currentProjectHours,
      currentProjectUtilizationPercent,
      caiaHours,
      pocHours,
      totalHours
    };
  });

  // ============ BEFORE CREATE VALIDATIONS ============

  const ensureUuidKey = (req, keyField) => {
    req.data[keyField] = cds.utils.uuid();
  };

  /**
   * Skills - Assign collision-safe UUID key
   */
  this.before('CREATE', 'Skills', async (req) => {
    ensureUuidKey(req, 'skillId');
  });

  /**
   * Projects - Assign collision-safe UUID key
   */
  this.before('CREATE', 'Projects', async (req) => {
    ensureUuidKey(req, 'projectId');
  });

  /**
   * CurrentProjects - Assign collision-safe UUID key and timestamps
   */
  this.before('CREATE', 'CurrentProjects', async (req) => {
    ensureUuidKey(req, 'currentProjectId');
    req.data.createdAt = req.data.createdAt || new Date().toISOString();
    req.data.lastUpdated = new Date().toISOString();
  });

  /**
   * Initiatives - Assign collision-safe UUID key and timestamps
   */
  this.before('CREATE', 'Initiatives', async (req) => {
    ensureUuidKey(req, 'initiativeId');
    req.data.createdAt = req.data.createdAt || new Date().toISOString();
    req.data.lastUpdated = new Date().toISOString();
  });

  /**
   * CAIAUtilization - Assign collision-safe UUID key and timestamps
   */
  this.before('CREATE', 'CAIAUtilization', async (req) => {
    ensureUuidKey(req, 'caiaId');
    req.data.createdAt = req.data.createdAt || new Date().toISOString();
    req.data.lastUpdated = new Date().toISOString();
  });

  /**
   * POCUtilization - Assign collision-safe UUID key and timestamps
   */
  this.before('CREATE', 'POCUtilization', async (req) => {
    ensureUuidKey(req, 'pocId');
    req.data.createdAt = req.data.createdAt || new Date().toISOString();
    req.data.lastUpdated = new Date().toISOString();
  });

  /**
   * Certifications - Assign collision-safe UUID key and timestamps
   */
  this.before('CREATE', 'Certifications', async (req) => {
    ensureUuidKey(req, 'certificationId');
    req.data.createdAt = req.data.createdAt || new Date().toISOString();
    req.data.lastUpdated = new Date().toISOString();
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
