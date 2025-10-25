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
    users: ['id', 'name', 'password', 'role', 'team', 'subTeam', 'manager'],
    employees: ['id', 'name', 'team', 'subTeam', 'manager', 'email', 'totalSkills', 'totalProjects', 'specialization'],
    skills: ['skillId', 'skillName', 'category', 'employeeId', 'proficiencyLevel', 'yearsExperience', 'certificationStatus'],
    projects: ['projectId', 'employeeId', 'projectName', 'role', 'startDate', 'endDate', 'status', 'description', 'duration'],
    profiles: ['employeeId', 'specialization', 'working_on_project', 'project_start_date', 'project_end_date', 'lastUpdated']
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
        
        const newProject = await csvWriter.addRecord('projects.csv', projectData, HEADERS.projects);
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
    console.log(`   - GET/POST/PUT/DELETE /api/users`);
    console.log(`   - GET/PUT /api/profiles/:employeeId`);
    console.log(`   - GET /api/health`);
    console.log(`===========================================\n`);
});

module.exports = app;
