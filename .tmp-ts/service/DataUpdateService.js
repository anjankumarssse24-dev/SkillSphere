/**
 * Data Update Service
 * Provides methods to update data models and persist changes
 */
import { DataManager } from "./DataManager";
export class DataUpdateService {
    static instance;
    dataManager;
    constructor() {
        this.dataManager = DataManager.getInstance();
    }
    static getInstance() {
        if (!DataUpdateService.instance) {
            DataUpdateService.instance = new DataUpdateService();
        }
        return DataUpdateService.instance;
    }
    /**
     * Update users model and persist changes
     */
    updateUsersModel(component, newUsers) {
        const usersModel = component.getModel("users");
        if (usersModel) {
            usersModel.setData({ users: newUsers });
            this.dataManager.saveData({ users: newUsers });
            console.log("Users model updated and persisted");
        }
    }
    /**
     * Update employees model and persist changes
     */
    updateEmployeesModel(component, newEmployees) {
        const employeesModel = component.getModel("employees");
        if (employeesModel) {
            employeesModel.setData({ employees: newEmployees });
            this.dataManager.saveData({ employees: newEmployees });
            console.log("Employees model updated and persisted");
        }
    }
    /**
     * Update skills model and persist changes
     */
    updateSkillsModel(component, newSkills) {
        const skillsModel = component.getModel("skills");
        if (skillsModel) {
            skillsModel.setData({ skills: newSkills });
            this.dataManager.saveData({ skills: newSkills });
            console.log("Skills model updated and persisted");
        }
    }
    /**
     * Update projects model and persist changes
     */
    updateProjectsModel(component, newProjects) {
        const projectsModel = component.getModel("projects");
        if (projectsModel) {
            projectsModel.setData({ projects: newProjects });
            this.dataManager.saveData({ projects: newProjects });
            console.log("Projects model updated and persisted");
        }
    }
    /**
     * Add new user and update model
     */
    addUser(component, user) {
        this.dataManager.addUser(user);
        this.refreshUsersModel(component);
    }
    /**
     * Update existing user and refresh model
     */
    updateUser(component, userId, updatedUser) {
        this.dataManager.updateUser(userId, updatedUser);
        this.refreshUsersModel(component);
    }
    /**
     * Delete user and refresh model
     */
    deleteUser(component, userId) {
        this.dataManager.deleteUser(userId);
        this.refreshUsersModel(component);
    }
    /**
     * Add new skill and update model
     */
    addSkill(component, skill) {
        this.dataManager.addSkill(skill);
        this.refreshSkillsModel(component);
    }
    /**
     * Update existing skill and refresh model
     */
    updateSkill(component, skillId, updatedSkill) {
        this.dataManager.updateSkill(skillId, updatedSkill);
        this.refreshSkillsModel(component);
    }
    /**
     * Delete skill and refresh model
     */
    deleteSkill(component, skillId) {
        this.dataManager.deleteSkill(skillId);
        this.refreshSkillsModel(component);
    }
    /**
     * Add new project and update model
     */
    addProject(component, project) {
        this.dataManager.addProject(project);
        this.refreshProjectsModel(component);
    }
    /**
     * Update existing project and refresh model
     */
    updateProject(component, projectId, updatedProject) {
        this.dataManager.updateProject(projectId, updatedProject);
        this.refreshProjectsModel(component);
    }
    /**
     * Delete project and refresh model
     */
    deleteProject(component, projectId) {
        this.dataManager.deleteProject(projectId);
        this.refreshProjectsModel(component);
    }
    /**
     * Refresh users model from persistent data
     */
    refreshUsersModel(component) {
        const data = this.dataManager.loadData();
        if (data && data.users) {
            const usersModel = component.getModel("users");
            if (usersModel) {
                usersModel.setData({ users: data.users });
            }
        }
    }
    /**
     * Refresh employees model from persistent data
     */
    refreshEmployeesModel(component) {
        const data = this.dataManager.loadData();
        if (data && data.employees) {
            const employeesModel = component.getModel("employees");
            if (employeesModel) {
                employeesModel.setData({ employees: data.employees });
            }
        }
    }
    /**
     * Refresh skills model from persistent data
     */
    refreshSkillsModel(component) {
        const data = this.dataManager.loadData();
        if (data && data.skills) {
            const skillsModel = component.getModel("skills");
            if (skillsModel) {
                skillsModel.setData({ skills: data.skills });
            }
        }
    }
    /**
     * Refresh projects model from persistent data
     */
    refreshProjectsModel(component) {
        const data = this.dataManager.loadData();
        if (data && data.projects) {
            const projectsModel = component.getModel("projects");
            if (projectsModel) {
                projectsModel.setData({ projects: data.projects });
            }
        }
    }
    /**
     * Get all data for export
     */
    getAllData() {
        return this.dataManager.loadData();
    }
    /**
     * Clear all data
     */
    clearAllData() {
        this.dataManager.clearAllData();
    }
    /**
     * Export data to JSON file
     */
    exportData() {
        this.dataManager.exportData();
    }
    /**
     * Import data from JSON file
     */
    importData(file) {
        return this.dataManager.importData(file);
    }
    /**
     * Reload data from CSV files
     */
    async reloadFromCSV() {
        const csvData = await this.dataManager.reloadFromCSV();
        if (csvData) {
            this.updateAllModels(csvData);
        }
        return csvData;
    }
    /**
     * Update all models with new data
     */
    updateAllModels(data) {
        // This method will be called by the CSVManagement controller
        // to update all models when CSV data is reloaded
        console.log("Updating all models with new data:", data);
    }
}
