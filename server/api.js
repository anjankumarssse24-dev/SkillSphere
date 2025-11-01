/**
 * Backend API Server for SkillSphere
 * Provides RESTful endpoints for CRUD operations on CSV files
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const CSVWriter = require('./csvWriter');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Initialize CSV Writer
const csvWriter = new CSVWriter();

// Define CSV headers for each entity
const HEADERS = {
    users: ['id', 'name', 'password', 'role', 'team', 'subTeam', 'managerId'],
    employees: ['employeeId', 'name', 'team', 'subTeam', 'managerId', 'email', 'totalSkills', 'totalProjects', 'specialization', 'role', 'location', 'tLevel'],
    managers: ['managerId', 'name', 'team', 'subTeam', 'email', 'totalSkills', 'totalProjects', 'specialization'],
    skills: ['skillId', 'skillName', 'category', 'employeeId', 'proficiencyLevel', 'yearsExperience', 'certificationStatus'],
    projects: ['projectId', 'employeeId', 'projectName', 'role', 'startDate', 'endDate', 'status', 'description', 'duration', 'projectManager', 'accountExecutiveManager', 'lineManagerPOC', 'projectOrchestrator'],
    profiles: ['employeeId', 'specialization', 'role', 'location', 'tLevel', 'lastUpdated'],
    currentProjects: ['currentProjectId', 'employeeId', 'projectName', 'startDate', 'endDate', 'hoursPerDay', 'createdAt', 'lastUpdated'],
    caiaUtilization: ['caiaId', 'employeeId', 'taskName', 'startDate', 'endDate', 'hoursPerDay', 'createdAt', 'lastUpdated'],
    pocUtilization: ['pocId', 'employeeId', 'pocTitle', 'startDate', 'endDate', 'hoursPerDay', 'createdAt', 'lastUpdated']
};

// ============ SKILLS ENDPOINTS ============

/**
 * GET /api/skills - Get all skills
 */
app.get('/api/skills', async (req, res) => {
    try {
        const skills = await csvWriter.getRecords('skills.csv');
        res.json({ success: true, data: skills });
    } catch (error) {
        console.error('Error getting skills:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/skills/:employeeId - Get skills for specific employee
 */
app.get('/api/skills/:employeeId', async (req, res) => {
    try {
        const { employeeId } = req.params;
        const allSkills = await csvWriter.getRecords('skills.csv');
        const employeeSkills = allSkills.filter(skill => skill.employeeId === employeeId);
        res.json({ success: true, data: employeeSkills });
    } catch (error) {
        console.error('Error getting employee skills:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/skills - Add a new skill
 */
app.post('/api/skills', async (req, res) => {
    try {
        const skillData = req.body;
        
        // Generate unique skillId if not provided
        if (!skillData.skillId) {
            skillData.skillId = `SKL_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }
        
        // Ensure all required fields are present
        const requiredFields = ['employeeId', 'skillName', 'category', 'proficiencyLevel'];
        for (const field of requiredFields) {
            if (!skillData[field]) {
                return res.status(400).json({ 
                    success: false, 
                    error: `Missing required field: ${field}` 
                });
            }
        }
        
        // Set defaults for optional fields
        skillData.yearsExperience = skillData.yearsExperience || 0;
        skillData.certificationStatus = skillData.certificationStatus || 'None';
        
        const newSkill = await csvWriter.addRecord('skills.csv', skillData, HEADERS.skills);
        res.json({ success: true, data: newSkill });
    } catch (error) {
        console.error('Error adding skill:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * PUT /api/skills/:skillId - Update an existing skill
 */
app.put('/api/skills/:skillId', async (req, res) => {
    try {
        const { skillId } = req.params;
        const updatedData = req.body;
        
        const updatedSkill = await csvWriter.updateRecord('skills.csv', skillId, updatedData, HEADERS.skills);
        res.json({ success: true, data: updatedSkill });
    } catch (error) {
        console.error('Error updating skill:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * DELETE /api/skills/:skillId - Delete a skill
 */
app.delete('/api/skills/:skillId', async (req, res) => {
    try {
        const { skillId } = req.params;
        const result = await csvWriter.deleteRecord('skills.csv', skillId, HEADERS.skills);
        res.json(result);
    } catch (error) {
        console.error('Error deleting skill:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============ EMPLOYEES ENDPOINTS ============

/**
 * GET /api/employees - Get all employees
 */
app.get('/api/employees', async (req, res) => {
    try {
        const employees = await csvWriter.getRecords('employees.csv');
        res.json({ success: true, data: employees });
    } catch (error) {
        console.error('Error getting employees:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/employees/:id - Get specific employee
 */
app.get('/api/employees/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const employees = await csvWriter.getRecords('employees.csv');
        const employee = employees.find(emp => emp.id === id);
        
        if (!employee) {
            return res.status(404).json({ success: false, error: 'Employee not found' });
        }
        
        res.json({ success: true, data: employee });
    } catch (error) {
        console.error('Error getting employee:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/employees - Add a new employee
 */
app.post('/api/employees', async (req, res) => {
    try {
        const employeeData = req.body;
        
        // Set defaults
        employeeData.totalSkills = employeeData.totalSkills || 0;
        employeeData.totalProjects = employeeData.totalProjects || 0;
        
        const newEmployee = await csvWriter.addRecord('employees.csv', employeeData, HEADERS.employees);
        res.json({ success: true, data: newEmployee });
    } catch (error) {
        console.error('Error adding employee:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * PUT /api/employees/:id - Update an employee
 */
app.put('/api/employees/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updatedData = req.body;
        
        const updatedEmployee = await csvWriter.updateRecord('employees.csv', id, updatedData, HEADERS.employees);
        res.json({ success: true, data: updatedEmployee });
    } catch (error) {
        console.error('Error updating employee:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * DELETE /api/employees/:id - Delete an employee
 */
app.delete('/api/employees/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await csvWriter.deleteRecord('employees.csv', id, HEADERS.employees);
        res.json(result);
    } catch (error) {
        console.error('Error deleting employee:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============ PROJECTS ENDPOINTS ============

/**
 * GET /api/projects - Get all projects
 */
app.get('/api/projects', async (req, res) => {
    try {
        const projects = await csvWriter.getRecords('projects.csv');
        res.json({ success: true, data: projects });
    } catch (error) {
        console.error('Error getting projects:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/projects/:employeeId - Get projects for specific employee
 */
app.get('/api/projects/employee/:employeeId', async (req, res) => {
    try {
        const { employeeId } = req.params;
        const allProjects = await csvWriter.getRecords('projects.csv');
        const employeeProjects = allProjects.filter(project => project.employeeId === employeeId);
        res.json({ success: true, data: employeeProjects });
    } catch (error) {
        console.error('Error getting employee projects:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/projects - Add a new project
 */
app.post('/api/projects', async (req, res) => {
    try {
        const projectData = req.body;
        
        console.log('📝 POST /api/projects - Received project data:', projectData);
        
        // Generate unique projectId if not provided
        if (!projectData.projectId) {
            projectData.projectId = `PROJ_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }
        
        // Ensure required fields are present
        const requiredFields = ['employeeId', 'projectName', 'role'];
        for (const field of requiredFields) {
            if (!projectData[field]) {
                return res.status(400).json({ 
                    success: false, 
                    error: `Missing required field: ${field}` 
                });
            }
        }
        
        // Set defaults for optional fields
        projectData.status = projectData.status || 'Active';
        projectData.description = projectData.description || '';
        projectData.duration = projectData.duration || '';
        projectData.projectManager = projectData.projectManager || '';
        projectData.accountExecutiveManager = projectData.accountExecutiveManager || '';
        projectData.lineManagerPOC = projectData.lineManagerPOC || '';
        projectData.projectOrchestrator = projectData.projectOrchestrator || '';
        
        console.log('💾 Saving project with data:', projectData);
        
        const newProject = await csvWriter.addRecord('projects.csv', projectData, HEADERS.projects);
        
        console.log('✅ Project saved successfully:', newProject);
        
        res.json({ success: true, data: newProject });
    } catch (error) {
        console.error('Error adding project:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * PUT /api/projects/:projectId - Update an existing project
 */
app.put('/api/projects/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params;
        const updatedData = req.body;
        
        const updatedProject = await csvWriter.updateRecord('projects.csv', projectId, updatedData, HEADERS.projects);
        res.json({ success: true, data: updatedProject });
    } catch (error) {
        console.error('Error updating project:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * DELETE /api/projects/:projectId - Delete a project
 */
app.delete('/api/projects/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params;
        const result = await csvWriter.deleteRecord('projects.csv', projectId, HEADERS.projects);
        res.json(result);
    } catch (error) {
        console.error('Error deleting project:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============ PROFILES ENDPOINTS ============

/**
 * GET /api/profiles/:employeeId - Get profile for specific employee
 */
app.get('/api/profiles/:employeeId', async (req, res) => {
    try {
        const { employeeId } = req.params;
        console.log(`📋 GET /api/profiles/${employeeId} - Loading profile...`);
        
        const allProfiles = await csvWriter.getRecords('profiles.csv');
        console.log(`Total profiles in CSV: ${allProfiles.length}`);
        
        const profile = allProfiles.find(p => p.employeeId === employeeId);
        console.log(`Profile found:`, profile);
        
        if (!profile) {
            console.log(`❌ Profile not found for employee ${employeeId}`);
            return res.status(404).json({ success: false, error: 'Profile not found' });
        }
        
        console.log(`✅ Returning profile for ${employeeId}:`, profile);
        res.json({ success: true, data: profile });
    } catch (error) {
        console.error('Error getting profile:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * PUT /api/profiles/:employeeId - Update employee profile
 */
app.put('/api/profiles/:employeeId', async (req, res) => {
    try {
        const { employeeId } = req.params;
        const profileData = req.body;
        
        // Add employeeId and timestamp
        profileData.employeeId = employeeId;
        profileData.lastUpdated = new Date().toISOString();
        
        const allProfiles = await csvWriter.getRecords('profiles.csv');
        const existingProfile = allProfiles.find(p => p.employeeId === employeeId);
        
        let updatedProfile;
        if (existingProfile) {
            // Update existing profile
            updatedProfile = await csvWriter.updateRecord('profiles.csv', employeeId, profileData, HEADERS.profiles);
        } else {
            // Create new profile
            updatedProfile = await csvWriter.addRecord('profiles.csv', profileData, HEADERS.profiles);
        }
        
        res.json({ success: true, data: updatedProfile });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============ USERS ENDPOINTS ============

/**
 * GET /api/users - Get all users
 */
app.get('/api/users', async (req, res) => {
    try {
        const users = await csvWriter.getRecords('users.csv');
        res.json({ success: true, data: users });
    } catch (error) {
        console.error('Error getting users:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/users - Add a new user
 */
app.post('/api/users', async (req, res) => {
    try {
        const userData = req.body;
        const newUser = await csvWriter.addRecord('users.csv', userData, HEADERS.users);
        res.json({ success: true, data: newUser });
    } catch (error) {
        console.error('Error adding user:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * PUT /api/users/:id - Update a user
 */
app.put('/api/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updatedData = req.body;
        
        const updatedUser = await csvWriter.updateRecord('users.csv', id, updatedData, HEADERS.users);
        res.json({ success: true, data: updatedUser });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * DELETE /api/users/:id - Delete a user
 */
app.delete('/api/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await csvWriter.deleteRecord('users.csv', id, HEADERS.users);
        res.json(result);
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============ MANAGERS ENDPOINTS ============

/**
 * GET /api/managers - Get all managers
 */
app.get('/api/managers', async (req, res) => {
    try {
        const managers = await csvWriter.getRecords('managers.csv');
        res.json({ success: true, data: managers });
    } catch (error) {
        console.error('Error getting managers:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/managers/:managerId - Get specific manager
 */
app.get('/api/managers/:managerId', async (req, res) => {
    try {
        const { managerId } = req.params;
        const allManagers = await csvWriter.getRecords('managers.csv');
        const manager = allManagers.find(m => m.managerId === managerId);
        
        if (!manager) {
            return res.status(404).json({ success: false, error: 'Manager not found' });
        }
        
        res.json({ success: true, data: manager });
    } catch (error) {
        console.error('Error getting manager:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/managers - Add a new manager
 */
app.post('/api/managers', async (req, res) => {
    try {
        const managerData = req.body;
        const newManager = await csvWriter.addRecord('managers.csv', managerData, HEADERS.managers);
        res.json({ success: true, data: newManager });
    } catch (error) {
        console.error('Error adding manager:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * PUT /api/managers/:managerId - Update a manager
 */
app.put('/api/managers/:managerId', async (req, res) => {
    try {
        const { managerId } = req.params;
        const updatedData = req.body;
        
        const updatedManager = await csvWriter.updateRecord('managers.csv', managerId, updatedData, HEADERS.managers);
        res.json({ success: true, data: updatedManager });
    } catch (error) {
        console.error('Error updating manager:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * DELETE /api/managers/:managerId - Delete a manager
 */
app.delete('/api/managers/:managerId', async (req, res) => {
    try {
        const { managerId } = req.params;
        const result = await csvWriter.deleteRecord('managers.csv', managerId, HEADERS.managers);
        res.json(result);
    } catch (error) {
        console.error('Error deleting manager:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============ CURRENT PROJECTS UTILIZATION ENDPOINTS ============

/**
 * GET /api/currentProjects/:employeeId - Get current projects for specific employee
 */
app.get('/api/currentProjects/:employeeId', async (req, res) => {
    try {
        const { employeeId } = req.params;
        const allProjects = await csvWriter.getRecords('currentProjects.csv');
        const employeeProjects = allProjects.filter(p => p.employeeId === employeeId);
        res.json({ success: true, data: employeeProjects });
    } catch (error) {
        console.error('Error getting current projects:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/currentProjects - Add new current project utilization
 */
app.post('/api/currentProjects', async (req, res) => {
    try {
        const projectData = req.body;
        
        if (!projectData.currentProjectId) {
            projectData.currentProjectId = `CP_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }
        
        projectData.createdAt = new Date().toISOString();
        projectData.lastUpdated = new Date().toISOString();
        
        const newProject = await csvWriter.addRecord('currentProjects.csv', projectData, HEADERS.currentProjects);
        res.json({ success: true, data: newProject });
    } catch (error) {
        console.error('Error adding current project:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * PUT /api/currentProjects/:id - Update current project utilization
 */
app.put('/api/currentProjects/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updatedData = req.body;
        updatedData.lastUpdated = new Date().toISOString();
        
        const updated = await csvWriter.updateRecord('currentProjects.csv', id, updatedData, HEADERS.currentProjects);
        res.json({ success: true, data: updated });
    } catch (error) {
        console.error('Error updating current project:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * DELETE /api/currentProjects/:id - Delete current project utilization
 */
app.delete('/api/currentProjects/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await csvWriter.deleteRecord('currentProjects.csv', id, HEADERS.currentProjects);
        res.json(result);
    } catch (error) {
        console.error('Error deleting current project:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============ CAIA UTILIZATION ENDPOINTS ============

/**
 * GET /api/caia/:employeeId - Get CAIA utilization for specific employee
 */
app.get('/api/caia/:employeeId', async (req, res) => {
    try {
        const { employeeId } = req.params;
        const allCaia = await csvWriter.getRecords('caiaUtilization.csv');
        const employeeCaia = allCaia.filter(c => c.employeeId === employeeId);
        res.json({ success: true, data: employeeCaia });
    } catch (error) {
        console.error('Error getting CAIA utilization:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/caia - Add new CAIA utilization
 */
app.post('/api/caia', async (req, res) => {
    try {
        const caiaData = req.body;
        
        if (!caiaData.caiaId) {
            caiaData.caiaId = `CAIA_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }
        
        caiaData.createdAt = new Date().toISOString();
        caiaData.lastUpdated = new Date().toISOString();
        
        const newCaia = await csvWriter.addRecord('caiaUtilization.csv', caiaData, HEADERS.caiaUtilization);
        res.json({ success: true, data: newCaia });
    } catch (error) {
        console.error('Error adding CAIA utilization:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * PUT /api/caia/:id - Update CAIA utilization
 */
app.put('/api/caia/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updatedData = req.body;
        updatedData.lastUpdated = new Date().toISOString();
        
        const updated = await csvWriter.updateRecord('caiaUtilization.csv', id, updatedData, HEADERS.caiaUtilization);
        res.json({ success: true, data: updated });
    } catch (error) {
        console.error('Error updating CAIA utilization:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * DELETE /api/caia/:id - Delete CAIA utilization
 */
app.delete('/api/caia/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await csvWriter.deleteRecord('caiaUtilization.csv', id, HEADERS.caiaUtilization);
        res.json(result);
    } catch (error) {
        console.error('Error deleting CAIA utilization:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============ POC UTILIZATION ENDPOINTS ============

/**
 * GET /api/poc/:employeeId - Get POC utilization for specific employee
 */
app.get('/api/poc/:employeeId', async (req, res) => {
    try {
        const { employeeId } = req.params;
        const allPoc = await csvWriter.getRecords('pocUtilization.csv');
        const employeePoc = allPoc.filter(p => p.employeeId === employeeId);
        res.json({ success: true, data: employeePoc });
    } catch (error) {
        console.error('Error getting POC utilization:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/poc - Add new POC utilization
 */
app.post('/api/poc', async (req, res) => {
    try {
        const pocData = req.body;
        
        if (!pocData.pocId) {
            pocData.pocId = `POC_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }
        
        pocData.createdAt = new Date().toISOString();
        pocData.lastUpdated = new Date().toISOString();
        
        const newPoc = await csvWriter.addRecord('pocUtilization.csv', pocData, HEADERS.pocUtilization);
        res.json({ success: true, data: newPoc });
    } catch (error) {
        console.error('Error adding POC utilization:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * PUT /api/poc/:id - Update POC utilization
 */
app.put('/api/poc/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updatedData = req.body;
        updatedData.lastUpdated = new Date().toISOString();
        
        const updated = await csvWriter.updateRecord('pocUtilization.csv', id, updatedData, HEADERS.pocUtilization);
        res.json({ success: true, data: updated });
    } catch (error) {
        console.error('Error updating POC utilization:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * DELETE /api/poc/:id - Delete POC utilization
 */
app.delete('/api/poc/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await csvWriter.deleteRecord('pocUtilization.csv', id, HEADERS.pocUtilization);
        res.json(result);
    } catch (error) {
        console.error('Error deleting POC utilization:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============ HEALTH CHECK ============

app.get('/api/health', (req, res) => {
    res.json({ 
        success: true, 
        message: 'SkillSphere API is running',
        timestamp: new Date().toISOString()
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`\n===========================================`);
    console.log(`🚀 SkillSphere API Server running on port ${PORT}`);
    console.log(`🔗 API Base URL: http://localhost:${PORT}/api`);
    console.log(`📊 Available endpoints:`);
    console.log(`   - GET/POST/PUT/DELETE /api/skills`);
    console.log(`   - GET/POST/PUT/DELETE /api/projects`);
    console.log(`   - GET/POST/PUT/DELETE /api/employees`);
    console.log(`   - GET/POST/PUT/DELETE /api/managers`);
    console.log(`   - GET/POST/PUT/DELETE /api/users`);
    console.log(`   - GET/PUT /api/profiles/:employeeId`);
    console.log(`   - GET/POST/PUT/DELETE /api/currentProjects`);
    console.log(`   - GET/POST/PUT/DELETE /api/caia`);
    console.log(`   - GET/POST/PUT/DELETE /api/poc`);
    console.log(`   - GET /api/health`);
    console.log(`===========================================\n`);
});

module.exports = app;
