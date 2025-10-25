/**
 * Data Update Service
 * Provides methods to update data models and persist changes
 */

import JSONModel from "sap/ui/model/json/JSONModel";
import { DataManager } from "./DataManager";

export class DataUpdateService {
    private static instance: DataUpdateService;
    private dataManager: DataManager;

    private constructor() {
        this.dataManager = DataManager.getInstance();
    }

    public static getInstance(): DataUpdateService {
        if (!DataUpdateService.instance) {
            DataUpdateService.instance = new DataUpdateService();
        }
        return DataUpdateService.instance;
    }

    /**
     * Update users model and persist changes
     */
    public updateUsersModel(component: any, newUsers: any[]): void {
        const usersModel = component.getModel("users") as JSONModel;
        if (usersModel) {
            usersModel.setData({ users: newUsers });
            this.dataManager.saveData({ users: newUsers });
            console.log("Users model updated and persisted");
        }
    }

    /**
     * Update employees model and persist changes
     */
    public updateEmployeesModel(component: any, newEmployees: any[]): void {
        const employeesModel = component.getModel("employees") as JSONModel;
        if (employeesModel) {
            employeesModel.setData({ employees: newEmployees });
            this.dataManager.saveData({ employees: newEmployees });
            console.log("Employees model updated and persisted");
        }
    }

    /**
     * Update skills model and persist changes
     */
    public updateSkillsModel(component: any, newSkills: any[]): void {
        const skillsModel = component.getModel("skills") as JSONModel;
        if (skillsModel) {
            skillsModel.setData({ skills: newSkills });
            this.dataManager.saveData({ skills: newSkills });
            console.log("Skills model updated and persisted");
        }
    }

    /**
     * Update projects model and persist changes
     */
    public updateProjectsModel(component: any, newProjects: any[]): void {
        const projectsModel = component.getModel("projects") as JSONModel;
        if (projectsModel) {
            projectsModel.setData({ projects: newProjects });
            this.dataManager.saveData({ projects: newProjects });
            console.log("Projects model updated and persisted");
        }
    }

    /**
     * Add new user and update model
     */
    public addUser(component: any, user: any): void {
        this.dataManager.addUser(user);
        this.refreshUsersModel(component);
    }

    /**
     * Update existing user and refresh model
     */
    public updateUser(component: any, userId: string, updatedUser: any): void {
        this.dataManager.updateUser(userId, updatedUser);
        this.refreshUsersModel(component);
    }

    /**
     * Delete user and refresh model
     */
    public deleteUser(component: any, userId: string): void {
        this.dataManager.deleteUser(userId);
        this.refreshUsersModel(component);
    }

    /**
     * Add new skill and update model
     */
    public addSkill(component: any, skill: any): void {
        this.dataManager.addSkill(skill);
        this.refreshSkillsModel(component);
    }

    /**
     * Update existing skill and refresh model
     */
    public updateSkill(component: any, skillId: string, updatedSkill: any): void {
        this.dataManager.updateSkill(skillId, updatedSkill);
        this.refreshSkillsModel(component);
    }

    /**
     * Delete skill and refresh model
     */
    public deleteSkill(component: any, skillId: string): void {
        this.dataManager.deleteSkill(skillId);
        this.refreshSkillsModel(component);
    }

    /**
     * Add new project and update model
     */
    public addProject(component: any, project: any): void {
        this.dataManager.addProject(project);
        this.refreshProjectsModel(component);
    }

    /**
     * Update existing project and refresh model
     */
    public updateProject(component: any, projectId: string, updatedProject: any): void {
        this.dataManager.updateProject(projectId, updatedProject);
        this.refreshProjectsModel(component);
    }

    /**
     * Delete project and refresh model
     */
    public deleteProject(component: any, projectId: string): void {
        this.dataManager.deleteProject(projectId);
        this.refreshProjectsModel(component);
    }

    /**
     * Refresh users model from persistent data
     */
    private refreshUsersModel(component: any): void {
        const data = this.dataManager.loadData();
        if (data && data.users) {
            const usersModel = component.getModel("users") as JSONModel;
            if (usersModel) {
                usersModel.setData({ users: data.users });
            }
        }
    }

    /**
     * Refresh employees model from persistent data
     */
    private refreshEmployeesModel(component: any): void {
        const data = this.dataManager.loadData();
        if (data && data.employees) {
            const employeesModel = component.getModel("employees") as JSONModel;
            if (employeesModel) {
                employeesModel.setData({ employees: data.employees });
            }
        }
    }

    /**
     * Refresh skills model from persistent data
     */
    private refreshSkillsModel(component: any): void {
        const data = this.dataManager.loadData();
        if (data && data.skills) {
            const skillsModel = component.getModel("skills") as JSONModel;
            if (skillsModel) {
                skillsModel.setData({ skills: data.skills });
            }
        }
    }

    /**
     * Refresh projects model from persistent data
     */
    private refreshProjectsModel(component: any): void {
        const data = this.dataManager.loadData();
        if (data && data.projects) {
            const projectsModel = component.getModel("projects") as JSONModel;
            if (projectsModel) {
                projectsModel.setData({ projects: data.projects });
            }
        }
    }

    /**
     * Get all data for export
     */
    public getAllData(): any {
        return this.dataManager.loadData();
    }

    /**
     * Clear all data
     */
    public clearAllData(): void {
        this.dataManager.clearAllData();
    }

    /**
     * Export data to JSON file
     */
    public exportData(): void {
        this.dataManager.exportData();
    }

    /**
     * Import data from JSON file
     */
    public importData(file: File): Promise<void> {
        return this.dataManager.importData(file);
    }

    /**
     * Reload data from CSV files
     */
    public async reloadFromCSV(): Promise<any> {
        const csvData = await this.dataManager.reloadFromCSV();
        if (csvData) {
            this.updateAllModels(csvData);
        }
        return csvData;
    }

    /**
     * Update all models with new data
     */
    private updateAllModels(data: any): void {
        // This method will be called by the CSVManagement controller
        // to update all models when CSV data is reloaded
        console.log("Updating all models with new data:", data);
    }
}
