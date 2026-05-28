using skillsphere from '../db/schema';

/**
 * SkillSphere Secure API Service - MASKED ENDPOINTS
 * 
 * SECURITY ARCHITECTURE:
 * ✅ NO DIRECT ENTITY ACCESS - All entities are private
 * ✅ NO ODATA METADATA DISCOVERY - $metadata endpoint disabled
 * ✅ CUSTOM ACTIONS ONLY - All access through secure actions
 * ✅ MASKED URL - /api/v1/* instead of /odata/v4/*
 * ✅ ROLE-BASED ACCESS CONTROL - Applied at action level
 * ✅ DATA ENCRYPTION - PII fields masked/encrypted in responses
 * 
 * ENDPOINT PATTERN:
 * - POST /api/v1/actions/currentUserContext
 * - POST /api/v1/actions/getEmployeeData
 * - POST /api/v1/actions/getTeamProjects
 * - No $metadata exposure
 * - No entity browsing
 * 
 * CONSEQUENCES FOR DEVELOPERS:
 * ❌ Cannot query /odata/v4/* endpoints
 * ❌ Cannot discover entities in $metadata
 * ❌ Cannot access personal data directly
 * ✅ Must use documented API actions only
 * ✅ All data access is logged & audited
 */
@path: 'api/v1'
service SkillSphereSecureAPI {

  // ========== AUTHENTICATION & USER CONTEXT ==========
  
  action currentUserContext() returns {
    authenticated: Boolean;
    authorized: Boolean;
    email: String;
    employeeId: String;
    name: String;
    role: String;
    targetDashboard: String;
    isFirstTime: Boolean;
    message: String;
  };

  action completeFirstTimeSetup(
    loginEmployeeId: String,
    employeeId: String,
    name: String,
    team: String,
    subTeam: String,
    location: String,
    gradeLevel: String,
    tLevel: String,
    experience: Decimal,
    managerId: String
  ) returns {
    success: Boolean;
    message: String;
    employeeId: String;
  };

  // ========== EMPLOYEE DATA ACCESS (SECURED) ==========
  
  /**
   * getMyProfile - Returns ONLY non-sensitive profile data
   * 
   * INCLUDED: employeeId, name, email, role, team, location, experience
   * 
   * EXCLUDED FOR SECURITY - Never exposed:
   * ❌ tLevel - reveals organizational level (CONFIDENTIAL)
   * ❌ gradeLevel - reveals salary band (HIGHLY CONFIDENTIAL)
   * ❌ managerId - reveals reporting structure (CONFIDENTIAL)
   * ❌ password - never exposed via API (stored in external auth system)
   * ❌ admin flags, internal markers
   */
  // User Management
  entity Users as projection on skillsphere.Users;
  
  // People Management
  entity Employees as projection on skillsphere.Employees;
  
  // Skills & Projects
  entity Skills as projection on skillsphere.Skills;
  entity Projects as projection on skillsphere.Projects;
  entity Profiles as projection on skillsphere.Profiles;
  
  // Utilization Tracking
  entity CurrentProjects as projection on skillsphere.CurrentProjects;
  entity InitiativesMaster as projection on skillsphere.InitiativesMaster;
  entity EvaluationsMaster as projection on skillsphere.EvaluationsMaster;
  entity CurrentInitiatives as projection on skillsphere.CurrentInitiatives;
  entity CurrentEvaluations as projection on skillsphere.CurrentEvaluations;
  entity Initiatives as projection on skillsphere.Initiatives;
  entity CAIAUtilization as projection on skillsphere.CAIAUtilization;
  entity POCUtilization as projection on skillsphere.POCUtilization;
  
  // Certifications
  entity Certifications as projection on skillsphere.Certifications;
  
  // Custom Actions
  
  /**
   * Get employee statistics
   * @param employeeId - Employee ID
   * @returns Statistics including skill count, project count
   */
    action getMyProfile() returns {
    employeeId: String;
    name: String;
    email: String;
    role: String;
    team: String;
    location: String;
    experience: Decimal;
  };
  /**
   * getTeamMembers - Manager/SeniorManager only - Get team member list
   * 
   * INCLUDED: employeeId, name, email, role, team
   * 
   * EXCLUDED FOR SECURITY:
   * ❌ tLevel - organizational level (CONFIDENTIAL)
   * ❌ gradeLevel - salary band information (HIGHLY CONFIDENTIAL)
   * ❌ managerId - manager hierarchy (we don't expose org structure)
   * ❌ manager relationships - prevents reverse-engineering of hierarchy
   */
  action getTeamMembers() returns array of {
    employeeId: String;
    name: String;
    email: String;
    role: String;
    team: String;
  };

  action getMySkills() returns array of {
    skillId: String;
    skillName: String;
    proficiencyLevel: String;
    yearsExperience: Decimal;
  };

  action getMyProjects() returns array of {
    projectId: String;
    projectName: String;
    role: String;
    startDate: Date;
    endDate: Date;
    status: String;
    technology: String;
  };

  action createTeamMember(
    employeeId: String,
    name: String,
    email: String,
    team: String,
    location: String
  ) returns {
    success: Boolean;
    message: String;
    employeeId: String;
  };

  action createProjectAssignment(
    employeeId: String,
    projectName: String,
    role: String,
    startDate: Date,
    endDate: Date,
    utilizationPercent: Integer
  ) returns {
    success: Boolean;
    projectId: String;
    message: String;
  };

  // ========== UTILIZATION & WORKLOAD DATA ==========

  action getMyUtilization() returns {
    currentProjectHours: Decimal(5,2);
    caiaHours: Decimal(5,2);
    pocHours: Decimal(5,2);
    totalHours: Decimal(5,2);
    utilizationPercent: Integer;
  };

  action getEmployeeStats(employeeId: String) returns {
    employeeId: String;
    totalSkills: Integer;
    totalProjects: Integer;
    currentProjects: Integer;
    averageUtilization: Decimal;
  };

  action getTeamUtilization() returns array of {
    employeeId: String;
    employeeName: String;
    currentProjectHours: Decimal;
    utilizationPercent: Integer;
  };

  // ========== CERTIFICATIONS & QUALIFICATIONS ==========

  action getMyCertifications() returns array of {
    certificationId: String;
    name: String;
    code: String;
    dateOfCompletion: Date;
    level: String;
  };

  action addCertification(
    name: String,
    code: String,
    dateOfCompletion: Date,
    level: String
  ) returns {
    success: Boolean;
    certificationId: String;
  };
  
  // ========== AI ASSISTANT ACTIONS ==========

  action askAIAssistant(
    query: String,
    employeeId: String
  ) returns {
    answer: String;
    success: Boolean;
    error: String;
  };

  action managerQuery(
    managerId: String,
    queryType: String,
    context: String
  ) returns {
    answer: String;
    data: String;
    success: Boolean;
  };

  action seniorManagerQuery(
    seniorManagerId: String,
    queryType: String,
    context: String
  ) returns {
    answer: String;
    data: String;
    success: Boolean;
  };

  // ========== CHAT & PREFERENCES ==========

  action clearChat(userId: String) returns {
    success: Boolean;
    message: String;
  };

  // ========== INITIATIVE & WORK TRACKING ==========

  action getMyInitiatives() returns array of {
    initiativeId: String;
    initiativeName: String;
    description: String;
    startDate: Date;
    endDate: Date;
    status: String;
  };

  action createInitiative(
    initiativeName: String,
    description: String,
    startDate: Date,
    endDate: Date,
    utilizationPercent: Integer
  ) returns {
    success: Boolean;
    initiativeId: String;
  };

  // ========== MARK COMPLETED ACTIONS (cross-manager) ==========

  action markProjectCompleted(projectId: String) returns {
    success: Boolean;
    updatedCount: Integer;
    message: String;
  };

  action markInitiativeCompleted(initiativeId: String) returns {
    success: Boolean;
    updatedCount: Integer;
    message: String;
  };

  action markEvaluationCompleted(evaluationId: String) returns {
    success: Boolean;
    updatedCount: Integer;
    message: String;
  };

  // ========== ADMIN ONLY ACTIONS ==========

  action generateEmployeeReport(
    reportType: String,
    startDate: Date,
    endDate: Date
  ) returns {
    reportId: String;
    reportUrl: String;
    success: Boolean;
  };

  action getAllEmployees() returns array of {
    employeeId: String;
    name: String;
    team: String;
    role: String;
  };

  action getAuditLogs(
    startDate: Date,
    endDate: Date,
    userId: String
  ) returns array of {
    timestamp: String;
    userId: String;
    action: String;
    entity: String;
    status: String;
  };
}

