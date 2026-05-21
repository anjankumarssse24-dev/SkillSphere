using skillsphere from '../db/schema';
@path: 'skillsphere' 
@requires: 'authenticated-user'
/**
 * SkillSphere Service - Main OData V4 service
 * Exposes all entities and provides custom actions for authentication
 */
service SkillSphereService {

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
  function getEmployeeStats(employeeId: String) returns {
    employeeId: String;
    totalSkills: Integer;
    totalProjects: Integer;
    currentProjects: Integer;
  };
  
  /**
   * Get utilization summary
   * @param employeeId - Employee ID
   * @returns Current utilization hours breakdown
   */
  function getUtilizationSummary(employeeId: String) returns {
    employeeId: String;
    currentProjectHours: Decimal(5,2);
    caiaHours: Decimal(5,2);
    pocHours: Decimal(5,2);
    totalHours: Decimal(5,2);
  };
  
  // AI Assistant Actions
  @requires: 'authenticated-user'
  action askAIAssistant(
    query: String,
    employeeId: String  // ← Make sure this parameter exists!
  ) returns {
    answer: String;
    success: Boolean;
    error: String;
  };

  @requires: 'authenticated-user'
  action managerQuery(
    managerId: String,
    queryType: String,
    context: String
  ) returns {
    answer: String;
    data: String;
    success: Boolean;
  };

  @requires: 'authenticated-user'
  action seniorManagerQuery(
    seniorManagerId: String,
    queryType: String,
    context: String
  ) returns {
    answer: String;
    data: String;
    success: Boolean;
  };

  /**
   * Clear chat history for a specific user
   * @param userId - User ID (employeeId or managerId)
   * @returns Success status
   */
  action clearChat(userId: String) returns {
    success: Boolean;
    message: String;
  };
}

