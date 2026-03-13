using skillsphere from '../db/schema';
@path: 'skillsphere' 
/**
 * SkillSphere Service - Main OData V4 service
 * Exposes all entities and provides custom actions for authentication
 */
service SkillSphereService {
  
  // User Management
  entity Users as projection on skillsphere.Users;
  
  // Employee & Manager Management
  entity Employees as projection on skillsphere.Employees;
  entity Managers as projection on skillsphere.Managers;
  
  // Skills & Projects
  entity Skills as projection on skillsphere.Skills;
  entity Projects as projection on skillsphere.Projects;
  entity Profiles as projection on skillsphere.Profiles;
  
  // Utilization Tracking
  entity CurrentProjects as projection on skillsphere.CurrentProjects;
  entity CAIAUtilization as projection on skillsphere.CAIAUtilization;
  entity POCUtilization as projection on skillsphere.POCUtilization;
  
  // Certifications
  entity Certifications as projection on skillsphere.Certifications;
  
  // Custom Actions
  
  /**
   * Login action - Authenticate user credentials
   * @param username - User's login name
   * @param password - User's password
   * @returns Authentication result with user data
   */
  action login(username: String, password: String) returns {
    success: Boolean;
    user: {
      id: String;
      name: String;
      role: String;
      team: String;
    };
    message: String;
  };
  
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
  action askAIAssistant(
    query: String,
    employeeId: String  // ← Make sure this parameter exists!
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

