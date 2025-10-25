/**
 * Data Manager Service
 * Handles persistent data storage and retrieval for SkillSphere
 */

import { CSVParser } from "./CSVParser";

export class DataManager {
    private static instance: DataManager;
    private dataKey = 'skillsphere_data';
    private apiBaseUrl = 'http://localhost:3000/api';

    private constructor() {}

    public static getInstance(): DataManager {
        if (!DataManager.instance) {
            DataManager.instance = new DataManager();
        }
        return DataManager.instance;
    }

    /**
     * Save data to localStorage
     */
    public saveData(data: any): void {
        try {
            localStorage.setItem(this.dataKey, JSON.stringify(data));
            console.log('Data saved to localStorage:', data);
        } catch (error) {
            console.error('Failed to save data to localStorage:', error);
        }
    }

    /**
     * Load data from localStorage
     */
    public loadData(): any {
        try {
            const data = localStorage.getItem(this.dataKey);
            if (data) {
                const parsedData = JSON.parse(data);
                console.log('Data loaded from localStorage:', parsedData);
                return parsedData;
            }
        } catch (error) {
            console.error('Failed to load data from localStorage:', error);
        }
        return null;
    }

    /**
     * Initialize with default data if no data exists
     */
    public initializeDefaultData(): any {
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
    public addUser(user: any): void {
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
    public updateUser(userId: string, updatedUser: any): void {
        const data = this.loadData() || this.initializeDefaultData();
        if (data.users) {
            const index = data.users.findIndex((u: any) => u.id === userId);
            if (index !== -1) {
                data.users[index] = { ...data.users[index], ...updatedUser };
                this.saveData(data);
            }
        }
    }

    /**
     * Delete user
     */
    public deleteUser(userId: string): void {
        const data = this.loadData() || this.initializeDefaultData();
        if (data.users) {
            data.users = data.users.filter((u: any) => u.id !== userId);
            this.saveData(data);
        }
    }

    /**
     * Add new skill
     */
    public async addSkill(skill: any): Promise<any> {
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
            } else {
                throw new Error(result.error || 'Failed to add skill');
            }
        } catch (error: any) {
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
    public async updateSkill(skillId: string, updatedSkill: any): Promise<any> {
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
                    const index = data.skills.findIndex((s: any) => s.id === skillId || s.skillId === skillId);
                    if (index !== -1) {
                        data.skills[index] = { ...data.skills[index], ...result.data };
                        this.saveData(data);
                    }
                }
                
                console.log('Skill updated in CSV and localStorage:', result.data);
                return result;
            } else {
                throw new Error(result.error || 'Failed to update skill');
            }
        } catch (error: any) {
            console.error('Error updating skill in backend:', error);
            
            // Fallback: update only localStorage
            const data = this.loadData() || this.initializeDefaultData();
            if (data.skills) {
                const index = data.skills.findIndex((s: any) => s.id === skillId);
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
    public async deleteSkill(skillId: string): Promise<any> {
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
                    data.skills = data.skills.filter((s: any) => s.id !== skillId && s.skillId !== skillId);
                    this.saveData(data);
                }
                
                console.log('Skill deleted from CSV and localStorage:', skillId);
                return result;
            } else {
                throw new Error(result.error || 'Failed to delete skill');
            }
        } catch (error: any) {
            console.error('Error deleting skill from backend:', error);
            
            // Fallback: delete only from localStorage
            const data = this.loadData() || this.initializeDefaultData();
            if (data.skills) {
                data.skills = data.skills.filter((s: any) => s.id !== skillId);
                this.saveData(data);
            }
            
            return { success: false, error: error.message, fallback: true };
        }
    }

    /**
     * Add new project
     */
    public async addProject(project: any): Promise<any> {
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
                    duration: project.duration || ''
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
            } else {
                throw new Error(result.error || 'Failed to add project');
            }
        } catch (error: any) {
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
    public async updateProject(projectId: string, updatedProject: any): Promise<any> {
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
                    employeeId: updatedProject.employeeId
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                // Also update localStorage
                const data = this.loadData() || this.initializeDefaultData();
                if (data.projects) {
                    const index = data.projects.findIndex((p: any) => p.id === projectId || p.projectId === projectId);
                    if (index !== -1) {
                        data.projects[index] = { ...data.projects[index], ...result.data };
                        this.saveData(data);
                    }
                }
                
                console.log('Project updated in CSV and localStorage:', result.data);
                return result;
            } else {
                throw new Error(result.error || 'Failed to update project');
            }
        } catch (error: any) {
            console.error('Error updating project in backend:', error);
            
            // Fallback: update only localStorage
            const data = this.loadData() || this.initializeDefaultData();
            if (data.projects) {
                const index = data.projects.findIndex((p: any) => p.id === projectId);
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
    public async deleteProject(projectId: string): Promise<any> {
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
                    data.projects = data.projects.filter((p: any) => p.id !== projectId && p.projectId !== projectId);
                    this.saveData(data);
                }
                
                console.log('Project deleted from CSV and localStorage:', projectId);
                return result;
            } else {
                throw new Error(result.error || 'Failed to delete project');
            }
        } catch (error: any) {
            console.error('Error deleting project from backend:', error);
            
            // Fallback: delete only from localStorage
            const data = this.loadData() || this.initializeDefaultData();
            if (data.projects) {
                data.projects = data.projects.filter((p: any) => p.id !== projectId);
                this.saveData(data);
            }
            
            return { success: false, error: error.message, fallback: true };
        }
    }

    /**
     * Update employee profile
     */
    public async updateEmployeeProfile(employeeId: string, profileData: any): Promise<any> {
        try {
            // Call backend API to persist to CSV
            const response = await fetch(`${this.apiBaseUrl}/profiles/${employeeId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(profileData)
            });
            
            const result = await response.json();
            
            if (result.success) {
                console.log('Profile updated in CSV:', result.data);
                return result;
            } else {
                throw new Error(result.error || 'Failed to update profile');
            }
        } catch (error: any) {
            console.error('Error updating profile in backend:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get employee profile
     */
    public async getEmployeeProfile(employeeId: string): Promise<any> {
        try {
            const response = await fetch(`${this.apiBaseUrl}/profiles/${employeeId}`);
            
            // Handle 404 as "no profile found" - not an error
            if (response.status === 404) {
                console.log(`No profile found for employee ${employeeId}`);
                return null;
            }
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                console.log('Profile retrieved from CSV:', result.data);
                return result.data;
            } else {
                console.warn('Profile API returned success=false:', result);
                return null;
            }
        } catch (error: any) {
            console.error('Error getting profile from backend:', error);
            return null;
        }
    }

    /**
     * Clear all data
     */
    public clearAllData(): void {
        localStorage.removeItem(this.dataKey);
        console.log('All data cleared from localStorage');
    }

    /**
     * Export data to JSON file
     */
    public exportData(): void {
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
    public importData(file: File): Promise<void> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target?.result as string);
                    this.saveData(data);
                    console.log('Data imported successfully:', data);
                    resolve();
                } catch (error) {
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
    public async reloadFromCSV(): Promise<any> {
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
        } catch (error) {
            console.error('Failed to reload data from CSV:', error);
            return null;
        }
    }
}
