/**
 * Data Manager Service
 * Handles persistent data storage and retrieval for SkillSphere
 */
import { CSVParser } from "./CSVParser";
export class DataManager {
    static instance;
    dataKey = 'skillsphere_data';
    apiBaseUrl = 'http://localhost:4004/odata/v4/skill-sphere';
    constructor() { }
    static getInstance() {
        if (!DataManager.instance) {
            DataManager.instance = new DataManager();
        }
        return DataManager.instance;
    }
    /**
     * Save data to localStorage
     */
    saveData(data) {
        try {
            localStorage.setItem(this.dataKey, JSON.stringify(data));
            console.log('Data saved to localStorage:', data);
        }
        catch (error) {
            console.error('Failed to save data to localStorage:', error);
        }
    }
    /**
     * Load data from localStorage
     */
    loadData() {
        try {
            const data = localStorage.getItem(this.dataKey);
            if (data) {
                const parsedData = JSON.parse(data);
                console.log('Data loaded from localStorage:', parsedData);
                return parsedData;
            }
        }
        catch (error) {
            console.error('Failed to load data from localStorage:', error);
        }
        return null;
    }
    /**
     * Initialize with default data if no data exists
     */
    initializeDefaultData() {
        const defaultData = {
            users: [
                {
                    id: "EMP001",
                    name: "John Doe",
                    password: "password123",
                    role: "Employee",
                    team: "S4HANA",
                    subTeam: "Development",
                    manager: "Alice Johnson"
                },
                {
                    id: "EMP002",
                    name: "Jane Smith",
                    password: "password123",
                    role: "Employee",
                    team: "SuccessFactors",
                    subTeam: "Analytics",
                    manager: "Bob Wilson"
                },
                {
                    id: "EMP003",
                    name: "Mike Johnson",
                    password: "password123",
                    role: "Employee",
                    team: "CIS",
                    subTeam: "Development",
                    manager: "Alice Johnson"
                },
                {
                    id: "MGR001",
                    name: "Alice Johnson",
                    password: "manager123",
                    role: "Manager",
                    team: "S4HANA",
                    subTeam: "Management",
                    manager: ""
                },
                {
                    id: "MGR002",
                    name: "Bob Wilson",
                    password: "manager123",
                    role: "Manager",
                    team: "SuccessFactors",
                    subTeam: "Management",
                    manager: ""
                },
                {
                    id: "EMP004",
                    name: "Sarah Brown",
                    password: "password123",
                    role: "Employee",
                    team: "Ariba",
                    subTeam: "Development",
                    manager: "Alice Johnson"
                },
                {
                    id: "EMP005",
                    name: "David Lee",
                    password: "password123",
                    role: "Employee",
                    team: "BTP",
                    subTeam: "Analytics",
                    manager: "Bob Wilson"
                },
                {
                    id: "EMP006",
                    name: "Tom Harris",
                    password: "password123",
                    role: "Employee",
                    team: "S4HANA",
                    subTeam: "Testing",
                    manager: "Alice Johnson"
                }
            ],
            employees: [
                {
                    id: "EMP001",
                    name: "John Doe",
                    team: "S4HANA",
                    subTeam: "Development",
                    manager: "Alice Johnson",
                    email: "john.doe@company.com",
                    totalSkills: 5,
                    totalProjects: 3,
                    specialization: "SAPUI5 Developer",
                    working_on_project: true,
                    project_start_date: "2024-01-15",
                    project_end_date: "2024-06-30"
                },
                {
                    id: "EMP002",
                    name: "Jane Smith",
                    team: "SuccessFactors",
                    subTeam: "Analytics",
                    manager: "Bob Wilson",
                    email: "jane.smith@company.com",
                    totalSkills: 7,
                    totalProjects: 2,
                    specialization: "Data Scientist",
                    working_on_project: false,
                    project_start_date: null,
                    project_end_date: null
                }
            ],
            skills: [],
            projects: []
        };
        this.saveData(defaultData);
        return defaultData;
    }
    /**
     * Add new user
     */
    addUser(user) {
        const data = this.loadData() || this.initializeDefaultData();
        if (!data.users) {
            data.users = [];
        }
        data.users.push(user);
        this.saveData(data);
    }
    /**
     * Update existing user
     */
    updateUser(userId, updatedUser) {
        const data = this.loadData() || this.initializeDefaultData();
        if (data.users) {
            const index = data.users.findIndex((u) => u.id === userId);
            if (index !== -1) {
                data.users[index] = { ...data.users[index], ...updatedUser };
                this.saveData(data);
            }
        }
    }
    /**
     * Delete user
     */
    deleteUser(userId) {
        const data = this.loadData() || this.initializeDefaultData();
        if (data.users) {
            data.users = data.users.filter((u) => u.id !== userId);
            this.saveData(data);
        }
    }
    /**
     * Add new skill
     */
    async addSkill(skill) {
        try {
            // Call backend API to persist to CSV
            const response = await fetch(`${this.apiBaseUrl}/skills`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    skillId: skill.id || skill.skillId,
                    employeeId: skill.employeeId,
                    skillName: skill.skillName,
                    category: skill.category,
                    proficiencyLevel: skill.proficiencyLevel,
                    yearsExperience: skill.yearsExperience || 0,
                    certificationStatus: skill.certificationStatus || 'None'
                })
            });
            const result = await response.json();
            if (result.success) {
                // Also update localStorage
                const data = this.loadData() || this.initializeDefaultData();
                if (!data.skills) {
                    data.skills = [];
                }
                data.skills.push(result.data);
                this.saveData(data);
                console.log('Skill added to CSV and localStorage:', result.data);
                return result;
            }
            else {
                throw new Error(result.error || 'Failed to add skill');
            }
        }
        catch (error) {
            console.error('Error adding skill to backend:', error);
            // Fallback: save only to localStorage
            const data = this.loadData() || this.initializeDefaultData();
            if (!data.skills) {
                data.skills = [];
            }
            data.skills.push(skill);
            this.saveData(data);
            return { success: false, error: error.message, fallback: true };
        }
    }
    /**
     * Update existing skill
     */
    async updateSkill(skillId, updatedSkill) {
        try {
            // Call backend API to persist to CSV
            const response = await fetch(`${this.apiBaseUrl}/skills/${skillId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    skillName: updatedSkill.skillName,
                    category: updatedSkill.category,
                    proficiencyLevel: updatedSkill.proficiencyLevel,
                    yearsExperience: updatedSkill.yearsExperience,
                    certificationStatus: updatedSkill.certificationStatus,
                    employeeId: updatedSkill.employeeId
                })
            });
            const result = await response.json();
            if (result.success) {
                // Also update localStorage
                const data = this.loadData() || this.initializeDefaultData();
                if (data.skills) {
                    const index = data.skills.findIndex((s) => s.id === skillId || s.skillId === skillId);
                    if (index !== -1) {
                        data.skills[index] = { ...data.skills[index], ...result.data };
                        this.saveData(data);
                    }
                }
                console.log('Skill updated in CSV and localStorage:', result.data);
                return result;
            }
            else {
                throw new Error(result.error || 'Failed to update skill');
            }
        }
        catch (error) {
            console.error('Error updating skill in backend:', error);
            // Fallback: update only localStorage
            const data = this.loadData() || this.initializeDefaultData();
            if (data.skills) {
                const index = data.skills.findIndex((s) => s.id === skillId);
                if (index !== -1) {
                    data.skills[index] = { ...data.skills[index], ...updatedSkill };
                    this.saveData(data);
                }
            }
            return { success: false, error: error.message, fallback: true };
        }
    }
    /**
     * Delete skill
     */
    async deleteSkill(skillId) {
        try {
            // Call backend API to delete from CSV
            const response = await fetch(`${this.apiBaseUrl}/skills/${skillId}`, {
                method: 'DELETE'
            });
            const result = await response.json();
            if (result.success) {
                // Also delete from localStorage
                const data = this.loadData() || this.initializeDefaultData();
                if (data.skills) {
                    data.skills = data.skills.filter((s) => s.id !== skillId && s.skillId !== skillId);
                    this.saveData(data);
                }
                console.log('Skill deleted from CSV and localStorage:', skillId);
                return result;
            }
            else {
                throw new Error(result.error || 'Failed to delete skill');
            }
        }
        catch (error) {
            console.error('Error deleting skill from backend:', error);
            // Fallback: delete only from localStorage
            const data = this.loadData() || this.initializeDefaultData();
            if (data.skills) {
                data.skills = data.skills.filter((s) => s.id !== skillId);
                this.saveData(data);
            }
            return { success: false, error: error.message, fallback: true };
        }
    }
    /**
     * Add new project
     */
    async addProject(project) {
        try {
            // Call backend API to persist to CSV
            const response = await fetch(`${this.apiBaseUrl}/projects`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    projectId: project.id || project.projectId,
                    employeeId: project.employeeId,
                    projectName: project.projectName,
                    role: project.role,
                    startDate: project.startDate || '',
                    endDate: project.endDate || '',
                    status: project.status || 'Active',
                    description: project.description || '',
                    duration: project.duration || '',
                    projectManager: project.projectManager || '',
                    accountExecutiveManager: project.accountExecutiveManager || '',
                    lineManagerPOC: project.lineManagerPOC || '',
                    projectOrchestrator: project.projectOrchestrator || ''
                })
            });
            const result = await response.json();
            if (result.success) {
                // Also update localStorage
                const data = this.loadData() || this.initializeDefaultData();
                if (!data.projects) {
                    data.projects = [];
                }
                data.projects.push(result.data);
                this.saveData(data);
                console.log('Project added to CSV and localStorage:', result.data);
                return result;
            }
            else {
                throw new Error(result.error || 'Failed to add project');
            }
        }
        catch (error) {
            console.error('Error adding project to backend:', error);
            // Fallback: save only to localStorage
            const data = this.loadData() || this.initializeDefaultData();
            if (!data.projects) {
                data.projects = [];
            }
            data.projects.push(project);
            this.saveData(data);
            return { success: false, error: error.message, fallback: true };
        }
    }
    /**
     * Update existing project
     */
    async updateProject(projectId, updatedProject) {
        try {
            // Call backend API to persist to CSV
            const response = await fetch(`${this.apiBaseUrl}/projects/${projectId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    projectName: updatedProject.projectName,
                    role: updatedProject.role,
                    startDate: updatedProject.startDate,
                    endDate: updatedProject.endDate,
                    status: updatedProject.status,
                    description: updatedProject.description,
                    duration: updatedProject.duration,
                    employeeId: updatedProject.employeeId,
                    projectManager: updatedProject.projectManager || '',
                    accountExecutiveManager: updatedProject.accountExecutiveManager || '',
                    lineManagerPOC: updatedProject.lineManagerPOC || '',
                    projectOrchestrator: updatedProject.projectOrchestrator || ''
                })
            });
            const result = await response.json();
            if (result.success) {
                // Also update localStorage
                const data = this.loadData() || this.initializeDefaultData();
                if (data.projects) {
                    const index = data.projects.findIndex((p) => p.id === projectId || p.projectId === projectId);
                    if (index !== -1) {
                        data.projects[index] = { ...data.projects[index], ...result.data };
                        this.saveData(data);
                    }
                }
                console.log('Project updated in CSV and localStorage:', result.data);
                return result;
            }
            else {
                throw new Error(result.error || 'Failed to update project');
            }
        }
        catch (error) {
            console.error('Error updating project in backend:', error);
            // Fallback: update only localStorage
            const data = this.loadData() || this.initializeDefaultData();
            if (data.projects) {
                const index = data.projects.findIndex((p) => p.id === projectId);
                if (index !== -1) {
                    data.projects[index] = { ...data.projects[index], ...updatedProject };
                    this.saveData(data);
                }
            }
            return { success: false, error: error.message, fallback: true };
        }
    }
    /**
     * Delete project
     */
    async deleteProject(projectId) {
        try {
            // Call backend API to delete from CSV
            const response = await fetch(`${this.apiBaseUrl}/projects/${projectId}`, {
                method: 'DELETE'
            });
            const result = await response.json();
            if (result.success) {
                // Also delete from localStorage
                const data = this.loadData() || this.initializeDefaultData();
                if (data.projects) {
                    data.projects = data.projects.filter((p) => p.id !== projectId && p.projectId !== projectId);
                    this.saveData(data);
                }
                console.log('Project deleted from CSV and localStorage:', projectId);
                return result;
            }
            else {
                throw new Error(result.error || 'Failed to delete project');
            }
        }
        catch (error) {
            console.error('Error deleting project from backend:', error);
            // Fallback: delete only from localStorage
            const data = this.loadData() || this.initializeDefaultData();
            if (data.projects) {
                data.projects = data.projects.filter((p) => p.id !== projectId);
                this.saveData(data);
            }
            return { success: false, error: error.message, fallback: true };
        }
    }
    /**
     * Update employee profile
     */
    async updateEmployeeProfile(employeeId, profileData) {
        try {
            // First check if profile exists
            const existingProfile = await this.getEmployeeProfile(employeeId);
            // Prepare profile data
            const profile = {
                employeeId: employeeId,
                specialization: profileData.specialization || '',
                role: profileData.role || '',
                location: profileData.location || '',
                tLevel: profileData.tLevel || '',
                lastUpdated: new Date().toISOString()
            };
            let response;
            if (existingProfile) {
                // UPDATE existing profile using PATCH
                response = await fetch(`${this.apiBaseUrl}/Profiles('${employeeId}')`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(profile)
                });
            }
            else {
                // CREATE new profile using POST
                response = await fetch(`${this.apiBaseUrl}/Profiles`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(profile)
                });
            }
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            const result = await response.json();
            console.log('Profile updated in CAP:', result);
            return { success: true, data: result };
        }
        catch (error) {
            console.error('Error updating profile in backend:', error);
            return { success: false, error: error.message };
        }
    }
    /**
     * Get employee profile
     */
    async getEmployeeProfile(employeeId) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/Profiles?$filter=employeeId eq '${employeeId}'`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const result = await response.json();
            // OData returns results in 'value' array
            if (result.value && result.value.length > 0) {
                console.log('Profile retrieved from CAP:', result.value[0]);
                return result.value[0];
            }
            else {
                console.log(`No profile found for employee ${employeeId}`);
                return null;
            }
        }
        catch (error) {
            console.error('Error getting profile from backend:', error);
            return null;
        }
    }
    /**
     * Clear all data
     */
    clearAllData() {
        localStorage.removeItem(this.dataKey);
        console.log('All data cleared from localStorage');
    }
    /**
     * Export data to JSON file
     */
    exportData() {
        const data = this.loadData();
        if (data) {
            const dataStr = JSON.stringify(data, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'skillsphere_data.json';
            link.click();
            URL.revokeObjectURL(url);
        }
    }
    /**
     * Import data from JSON file
     */
    importData(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target?.result);
                    this.saveData(data);
                    console.log('Data imported successfully:', data);
                    resolve();
                }
                catch (error) {
                    console.error('Failed to import data:', error);
                    reject(error);
                }
            };
            reader.readAsText(file);
        });
    }
    /**
     * Reload data from CSV files
     */
    async reloadFromCSV() {
        try {
            console.log('Reloading data from CSV files...');
            const isTestContext = window.location.pathname.includes('/test/');
            const pathPrefix = isTestContext ? '../' : '';
            // Load users from CSV
            const usersResponse = await fetch(`${pathPrefix}data/users.csv`);
            const usersCsvText = await usersResponse.text();
            const usersCsvData = CSVParser.parseCSV(usersCsvText);
            const users = CSVParser.parseUsersCSV(usersCsvData);
            // Load employees from CSV
            const employeesResponse = await fetch(`${pathPrefix}data/employees.csv`);
            const employeesCsvText = await employeesResponse.text();
            const employeesCsvData = CSVParser.parseCSV(employeesCsvText);
            const employees = CSVParser.parseEmployeesCSV(employeesCsvData);
            // Load skills from CSV
            const skillsResponse = await fetch(`${pathPrefix}data/skills.csv`);
            const skillsCsvText = await skillsResponse.text();
            const skillsCsvData = CSVParser.parseCSV(skillsCsvText);
            const skills = CSVParser.parseSkillsCSV(skillsCsvData);
            // Load projects from JSON
            const projectsResponse = await fetch(`${pathPrefix}model/projects.json`);
            const projectsData = await projectsResponse.json();
            const projects = projectsData.projects || [];
            const csvData = {
                users,
                employees,
                skills,
                projects
            };
            this.saveData(csvData);
            console.log('Data reloaded from CSV files:', csvData);
            return csvData;
        }
        catch (error) {
            console.error('Failed to reload data from CSV:', error);
            return null;
        }
    }
    // ==================== Current Project Utilization Methods ====================
    async addCurrentProject(data) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/CurrentProjects`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
            }
            const result = await response.json();
            console.log('Current project added:', result);
            return { success: true, data: result };
        }
        catch (error) {
            console.error('Error adding current project:', error);
            throw error;
        }
    }
    async updateCurrentProject(currentProjectId, data) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/CurrentProjects('${currentProjectId}')`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
            }
            const result = await response.json();
            console.log('Current project updated:', result);
            return { success: true, data: result };
        }
        catch (error) {
            console.error('Error updating current project:', error);
            throw error;
        }
    }
    async deleteCurrentProject(currentProjectId) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/CurrentProjects('${currentProjectId}')`, {
                method: 'DELETE'
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
            }
            console.log('Current project deleted');
            return { success: true };
        }
        catch (error) {
            console.error('Error deleting current project:', error);
            throw error;
        }
    }
    async getCurrentProjectsByEmployee(employeeId) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/CurrentProjects?$filter=employeeId eq '${employeeId}'`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            console.log('Current projects retrieved:', result.value);
            return result.value || [];
        }
        catch (error) {
            console.error('Error getting current projects:', error);
            return [];
        }
    }
    // ==================== CAIA Utilization Methods ====================
    async addCAIA(data) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/CAIAUtilization`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
            }
            const result = await response.json();
            console.log('CAIA added:', result);
            return { success: true, data: result };
        }
        catch (error) {
            console.error('Error adding CAIA:', error);
            throw error;
        }
    }
    async updateCAIA(caiaId, data) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/CAIAUtilization('${caiaId}')`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
            }
            const result = await response.json();
            console.log('CAIA updated:', result);
            return { success: true, data: result };
        }
        catch (error) {
            console.error('Error updating CAIA:', error);
            throw error;
        }
    }
    async deleteCAIA(caiaId) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/CAIAUtilization('${caiaId}')`, {
                method: 'DELETE'
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
            }
            console.log('CAIA deleted');
            return { success: true };
        }
        catch (error) {
            console.error('Error deleting CAIA:', error);
            throw error;
        }
    }
    async getCAIAByEmployee(employeeId) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/CAIAUtilization?$filter=employeeId eq '${employeeId}'`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            console.log('CAIA retrieved:', result.value);
            return result.value || [];
        }
        catch (error) {
            console.error('Error getting CAIA:', error);
            return [];
        }
    }
    // ==================== POC Utilization Methods ====================
    async addPOC(data) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/POCUtilization`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
            }
            const result = await response.json();
            console.log('POC added:', result);
            return { success: true, data: result };
        }
        catch (error) {
            console.error('Error adding POC:', error);
            throw error;
        }
    }
    async updatePOC(pocId, data) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/POCUtilization('${pocId}')`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
            }
            const result = await response.json();
            console.log('POC updated:', result);
            return { success: true, data: result };
        }
        catch (error) {
            console.error('Error updating POC:', error);
            throw error;
        }
    }
    async deletePOC(pocId) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/POCUtilization('${pocId}')`, {
                method: 'DELETE'
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
            }
            console.log('POC deleted');
            return { success: true };
        }
        catch (error) {
            console.error('Error deleting POC:', error);
            throw error;
        }
    }
    async getPOCByEmployee(employeeId) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/POCUtilization?$filter=employeeId eq '${employeeId}'`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            console.log('POC retrieved:', result.value);
            return result.value || [];
        }
        catch (error) {
            console.error('Error getting POC:', error);
            return [];
        }
    }
}
