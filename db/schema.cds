namespace skillsphere;

/**
 * Users entity - Identity and authorization only
 */
entity Users {
  key id : String;
  password : String;
  role : String;
  isActive : Boolean default true;
}

/**
 * Employees entity - Unified people master data
 * Contains employees, managers, and senior managers.
 */
entity Employees {
  key employeeId : String;
  name : String;
  role : String;
  team : String;
  subTeam : String;
  managerId : String;
  email : String;
  experience : Decimal(5,2) default 0;
  totalSkills : Integer default 0;
  totalProjects : Integer default 0;
  location : String;
  tLevel : String;
  gradeLevel : String;

  user : Association to one Users on user.id = $self.employeeId;
  manager : Association to one Employees on manager.employeeId = $self.managerId; //ask if keep
  reports : Composition of many Employees on reports.managerId = $self.employeeId;

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
  evaluationStartDate : Date;
  evaluationEndDate : Date;
  status : String;
  description : String;
  duration : String;
  projectManager : String;
  region : String; // APAC, EMEA, AMERICAS
  technology : String; // S/4HANA, BTP, Data Science, AI/ML, etc.
  accountExecutiveManager : String;
  lineManagerPOC : String;
  projectOrchestrator : String;
  addedByManager : String;
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
  gradeLevel : String;
  lastUpdated : DateTime;
  employee : Association to Employees on employee.employeeId = employeeId;
}


/**
 * CurrentProjects entity - Unified work assignments (Projects, Evaluations, Initiatives)
 */
entity CurrentProjects {
  key currentProjectId : String;
  employeeId : String;
  type : String default 'Project'; // Project, Evaluation, Initiative, CAIA, POC
  projectName : String;
  role : String;
  projectManager : String;
  region : String; // APAC, EMEA, AMERICAS
  technology : String; // S/4HANA, BTP, Data Science, AI/ML, etc.
  startDate : Date;
  endDate : Date;
  utilizationPercent : Integer;
  description : String;
  assignmentStatus : String default 'Self-Assigned'; // Self-Assigned, Pending, Accepted, Rejected
  assignedBy : String; // Manager ID who assigned (if manager-assigned)
  isEvaluation : Boolean default false;
  createdAt : DateTime;
  lastUpdated : DateTime;
  employee : Association to Employees on employee.employeeId = employeeId;
}

/**
 * Initiatives entity - Strategic initiatives, CAIA, POC, and other employee-driven work
 */
entity Initiatives {
  key initiativeId : String;
  employeeId : String;
  initiativeName : String;
  description : String;
  startDate : Date;
  endDate : Date;
  utilizationPercent : Integer;
  status : String default 'Active';
  type : String default 'Initiative'; // Initiative, CAIA, POC, Evaluation, Other
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
