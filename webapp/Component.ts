import BaseComponent from "sap/ui/core/UIComponent";
import { createDeviceModel } from "./model/models";
import JSONModel from "sap/ui/model/json/JSONModel";
import { DataManager } from "./service/DataManager";
import { CSVParser } from "./service/CSVParser";

/**
 * @namespace skillsphere
 */
export default class Component extends BaseComponent {

	public static metadata = {
		manifest: "json",
        interfaces: [
            "sap.ui.core.IAsyncContentCreation"
        ]
	};

	public init() : void {
		// call the base component's init function
		super.init();

        // set the device model
        this.setModel(createDeviceModel(), "device");

        // Initialize models from CSV and JSON sources
        this.initializeModels();

        // enable routing
        this.getRouter().initialize();
	}

    private async initializeModels(): Promise<void> {
        // Clear localStorage to force reload from CSV
        localStorage.clear();
        console.log("Cleared localStorage to force CSV reload");
        
        // Initialize current user model
        const currentUserModel = new JSONModel({
            id: null,
            name: null,
            role: null,
            isLoggedIn: false
        });
        this.setModel(currentUserModel, "currentUser");

        // Initialize view state model
        const viewStateModel = new JSONModel({
            busy: false,
            message: null
        });
        this.setModel(viewStateModel, "viewState");

        // Initialize DataManager
        const dataManager = DataManager.getInstance();
        
        // ALWAYS load fresh data from CSV files - don't use localStorage cache
        console.log("Loading fresh data from CSV files");
        let csvData = await this.loadDataFromCSV();
        
        if (csvData) {
            // Save to localStorage as backup only
            dataManager.saveData(csvData);
            console.log("CSV data loaded successfully");
        } else {
            console.log("CSV loading failed, using default data");
            csvData = dataManager.initializeDefaultData();
        }

        // Create models from CSV data
        const usersModel = new JSONModel({ users: csvData.users || [] });
        const employeesModel = new JSONModel({ employees: csvData.employees || [] });
        const managersModel = new JSONModel({ managers: csvData.managers || [] });
        const skillsModel = new JSONModel({ skills: csvData.skills || [] });
        const projectsModel = new JSONModel({ projects: csvData.projects || [] });

        // Set models
        this.setModel(usersModel, "users");
        this.setModel(employeesModel, "employees");
        this.setModel(managersModel, "managers");
        this.setModel(skillsModel, "skills");
        this.setModel(projectsModel, "projects");

        // Add DataManager to global scope for easy access
        (window as any).dataManager = dataManager;

        console.log("All models initialized from CSV");
        console.log("Users:", csvData.users?.length || 0);
        console.log("Employees:", csvData.employees?.length || 0);
        console.log("Managers:", csvData.managers?.length || 0);
        console.log("Skills:", csvData.skills?.length || 0);
        console.log("Projects:", csvData.projects?.length || 0);
    }

    private async waitForManifestModels(): Promise<void> {
        // Wait a bit for manifest models to load
        return new Promise(resolve => setTimeout(resolve, 100));
    }

    /**
     * Load data from CSV files
     */
    private async loadDataFromCSV(): Promise<any> {
        try {
            console.log("Loading data from CSV files...");
            
            // Load users from CSV
            const users = await this.loadUsersFromCSV();
            console.log("Users loaded from CSV:", users.length);
            
            // Load managers from CSV
            const managers = await this.loadManagersFromCSV();
            console.log("Managers loaded from CSV:", managers.length);
            
            // Load employees from CSV
            const employees = await this.loadEmployeesFromCSV();
            console.log("Employees loaded from CSV:", employees.length);
            
            // Merge employees and managers with manager name resolution
            const allEmployees = this.mergeEmployeesWithManagers(employees, managers);
            console.log("Total employees (with manager names):", allEmployees.length);
            
            // Load skills from CSV
            const skills = await this.loadSkillsFromCSV();
            console.log("Skills loaded from CSV:", skills.length);
            
            // Load projects from CSV
            const projects = await this.loadProjectsFromCSV();
            console.log("Projects loaded from CSV:", projects.length);
            
            return {
                users,
                employees: allEmployees,
                managers,
                skills,
                projects
            };
        } catch (error) {
            console.error("Failed to load data from CSV:", error);
            return null;
        }
    }

    /**
     * Merge employees with manager data - resolve managerId to manager name
     */
    private mergeEmployeesWithManagers(employees: any[], managers: any[]): any[] {
        return employees.map(emp => {
            const manager = managers.find(m => m.managerId === emp.managerId);
            return {
                ...emp,
                id: emp.employeeId, // Keep id for backward compatibility
                manager: manager ? manager.name : '', // Resolve manager name
                managerEmail: manager ? manager.email : ''
            };
        });
    }

    /**
     * Load managers from CSV file
     */
    private async loadManagersFromCSV(): Promise<any[]> {
        try {
            const csvPath = window.location.pathname.includes('/test/') 
                ? '../data/managers.csv' 
                : 'data/managers.csv';
            console.log("Loading managers from:", csvPath);
            
            const response = await fetch(csvPath);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const csvText = await response.text();
            
            const csvData = CSVParser.parseCSV(csvText);
            const managers = csvData.map((row: any) => ({
                managerId: row.managerId,
                id: row.managerId, // For backward compatibility
                name: row.name,
                team: row.team,
                subTeam: row.subTeam,
                email: row.email,
                totalSkills: parseInt(row.totalSkills) || 0,
                totalProjects: parseInt(row.totalProjects) || 0,
                specialization: row.specialization,
                role: 'Manager'
            }));
            
            return managers;
        } catch (error) {
            console.error("Failed to load managers from CSV:", error);
            return [];
        }
    }

    /**
     * Load users from CSV file
     */
    private async loadUsersFromCSV(): Promise<any[]> {
        try {
            // Get the base path - go up from test context
            const csvPath = window.location.pathname.includes('/test/') 
                ? '../data/users.csv' 
                : 'data/users.csv';
            
            console.log("Attempting to load users from:", csvPath);
            
            const response = await fetch(csvPath);
            console.log("Fetch response status:", response.status, response.statusText);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const csvText = await response.text();
            console.log("Raw CSV text (first 200 chars):", csvText.substring(0, 200));
            
            const csvData = CSVParser.parseCSV(csvText);
            console.log("Parsed CSV data:", csvData);
            
            const users = CSVParser.parseUsersCSV(csvData);
            console.log("Processed users:", users);
            
            return users;
        } catch (error) {
            console.error("Failed to load users from CSV:", error);
            return [];
        }
    }

    /**
     * Load employees from CSV file
     */
    private async loadEmployeesFromCSV(): Promise<any[]> {
        try {
            const csvPath = window.location.pathname.includes('/test/') 
                ? '../data/employees.csv' 
                : 'data/employees.csv';
            console.log("Loading employees from:", csvPath);
            
            const response = await fetch(csvPath);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const csvText = await response.text();
            
            const csvData = CSVParser.parseCSV(csvText);
            const employees = csvData.map((row: any) => ({
                employeeId: row.employeeId,
                id: row.employeeId, // For backward compatibility
                name: row.name,
                team: row.team,
                subTeam: row.subTeam,
                managerId: row.managerId,
                email: row.email,
                totalSkills: parseInt(row.totalSkills) || 0,
                totalProjects: parseInt(row.totalProjects) || 0,
                specialization: row.specialization,
                role: 'Employee'
            }));
            
            return employees;
        } catch (error) {
            console.error("Failed to load employees from CSV:", error);
            return [];
        }
    }

    /**
     * Load skills from CSV file
     */
    private async loadSkillsFromCSV(): Promise<any[]> {
        try {
            const csvPath = window.location.pathname.includes('/test/') 
                ? '../data/skills.csv' 
                : 'data/skills.csv';
            console.log("Loading skills from:", csvPath);
            
            const response = await fetch(csvPath);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const csvText = await response.text();
            
            const csvData = CSVParser.parseCSV(csvText);
            const skills = CSVParser.parseSkillsCSV(csvData);
            
            return skills;
        } catch (error) {
            console.error("Failed to load skills from CSV:", error);
            return [];
        }
    }

    /**
     * Load projects from CSV file
     */
    private async loadProjectsFromCSV(): Promise<any[]> {
        try {
            const csvPath = window.location.pathname.includes('/test/') 
                ? '../data/projects.csv' 
                : 'data/projects.csv';
            console.log("Loading projects from:", csvPath);
            
            const response = await fetch(csvPath);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const csvText = await response.text();
            
            const csvData = CSVParser.parseCSV(csvText);
            // Projects CSV has different structure - parse manually
            const projects = csvData.map((row: any) => ({
                id: row.projectId,
                projectId: row.projectId,
                employeeId: row.employeeId,
                projectName: row.projectName,
                role: row.role,
                startDate: row.startDate,
                endDate: row.endDate,
                status: row.status,
                description: row.description,
                duration: row.duration,
                projectManager: row.projectManager || "",
                accountExecutiveManager: row.accountExecutiveManager || "",
                lineManagerPOC: row.lineManagerPOC || "",
                projectOrchestrator: row.projectOrchestrator || ""
            }));
            
            return projects;
        } catch (error) {
            console.error("Failed to load projects from CSV:", error);
            return [];
        }
    }
}