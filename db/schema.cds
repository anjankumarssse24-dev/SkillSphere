namespace skillsphere;

using { cuid, managed } from '@sap/cds/common';

/**
 * Users entity - Authentication and authorization
 */
entity Users {
  key id : String;
  name : String;
  password : String;
  role : String;
  team : String;
  subTeam : String;
  managerId : String;
}

/**
 * Employees entity - Employee master data
 */
entity Employees {
  key employeeId : String;
  name : String;
  team : String;
  subTeam : String;
  managerId : String;
  email : String;
  experience : Decimal(5,2) default 0;
  totalSkills : Integer default 0;
  totalProjects : Integer default 0;
  role : String;
  location : String;
  tLevel : String;
  gradeLevel : String; // L1, L2, L3 for each T level
  skills : Composition of many Skills on skills.employeeId = $self.employeeId;
  projects : Composition of many Projects on projects.employeeId = $self.employeeId;
  currentProjects : Composition of many CurrentProjects on currentProjects.employeeId = $self.employeeId;
  initiatives : Composition of many Initiatives on initiatives.employeeId = $self.employeeId;
  caiaUtilization : Composition of many CAIAUtilization on caiaUtilization.employeeId = $self.employeeId;
  pocUtilization : Composition of many POCUtilization on pocUtilization.employeeId = $self.employeeId;
  certifications : Composition of many Certifications on certifications.employeeId = $self.employeeId;
  profile : Association to Profiles on profile.employeeId = $self.employeeId;
}

/**
 * Managers entity - Manager master data
 */
entity Managers {
  key managerId : String;
  name : String;
  team : String;
  subTeam : String;
  email : String;
  totalSkills : Integer default 0;
  totalProjects : Integer default 0;
  specialization : String;
}

/**
 * Skills entity - Employee skills and competencies
 */
entity Skills {
  key skillId : String;
  skillName : String;
  category : String;
  employeeId : String;
  proficiencyLevel : String;
  yearsExperience : Decimal(5,2) default 0;
  certificationStatus : String default 'None';
  employee : Association to Employees on employee.employeeId = employeeId;
}

/**
 * Projects entity - Employee project history
 */
entity Projects {
  key projectId : String;
  employeeId : String;
  projectName : String;
  role : String;
  startDate : Date;
  endDate : Date;
  status : String;
  description : String;
  duration : String;
  projectManager : String;
  accountExecutiveManager : String;
  lineManagerPOC : String;
  projectOrchestrator : String;
  addedByManager : String; // managerId if project was added by a manager
  employee : Association to Employees on employee.employeeId = employeeId;
}

/**
 * Profiles entity - Employee profile information
 */
entity Profiles {
  key employeeId : String;
  specialization : String;
  role : String;
  location : String;
  tLevel : String;
  gradeLevel : String; // L1, L2, L3 for each T level
  lastUpdated : DateTime;
  employee : Association to Employees on employee.employeeId = employeeId;
}

/**
 * CurrentProjects entity - Employee's current project allocations
 */
entity CurrentProjects {
  key currentProjectId : String;
  employeeId : String;
  projectName : String;
  projectManager : String;
  startDate : Date;
  endDate : Date;
  hoursPerDay : Decimal(5,2);
  createdAt : DateTime;
  lastUpdated : DateTime;
  employee : Association to Employees on employee.employeeId = employeeId;
}

/**
 * Initiatives entity - Strategic initiatives and organizational projects
 */
entity Initiatives {
  key initiativeId : String;
  employeeId : String;
  initiativeName : String;
  description : String;
  startDate : Date;
  endDate : Date;
  hoursPerDay : Decimal(5,2);
  status : String default 'Active';
  type : String default 'Initiative'; // Initiative, CAIA, or POC
  createdAt : DateTime;
  lastUpdated : DateTime;
  employee : Association to Employees on employee.employeeId = employeeId;
}

/**
 * CAIAUtilization entity - CAIA (Cross-account Internal Activities) time tracking
 */
entity CAIAUtilization {
  key caiaId : String;
  employeeId : String;
  taskName : String;
  startDate : Date;
  endDate : Date;
  hoursPerDay : Decimal(5,2);
  createdAt : DateTime;
  lastUpdated : DateTime;
  employee : Association to Employees on employee.employeeId = employeeId;
}

/**
 * POCUtilization entity - Proof of Concept time tracking
 */
entity POCUtilization {
  key pocId : String;
  employeeId : String;
  pocTitle : String;
  startDate : Date;
  endDate : Date;
  hoursPerDay : Decimal(5,2);
  createdAt : DateTime;
  lastUpdated : DateTime;
  employee : Association to Employees on employee.employeeId = employeeId;
}

/**
 * Certifications entity - Employee certifications and credentials
 */
entity Certifications {
  key certificationId : String;
  employeeId : String;
  name : String;
  code : String;
  dateOfCompletion : Date;
  description : String;
  level : String;
  createdAt : DateTime;
  lastUpdated : DateTime;
  employee : Association to Employees on employee.employeeId = employeeId;
}
