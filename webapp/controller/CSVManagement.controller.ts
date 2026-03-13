import Controller from "sap/ui/core/mvc/Controller";
import MessageToast from "sap/m/MessageToast";
import { DataManager } from "../service/DataManager";

/**
 * CSV Management Controller
 * Handles CSV data loading and management
 */
export default class CSVManagement extends Controller {

    private dataManager: DataManager;

    public onInit(): void {
        this.dataManager = DataManager.getInstance();
        console.log("CSVManagement controller initialized");
    }

    /**
     * Reload data from CSV files
     */
    public async onReloadFromCSV(): Promise<void> {
        try {
            MessageToast.show("Reloading data from CSV files...");
            
            const csvData = await this.dataManager.reloadFromCSV();
            
            if (csvData) {
                // Update all models with new CSV data
                this.updateAllModels(csvData);
                MessageToast.show("Data successfully reloaded from CSV files!");
            } else {
                MessageToast.show("Failed to reload data from CSV files");
            }
        } catch (error) {
            console.error("Error reloading from CSV:", error);
            MessageToast.show("Error reloading data from CSV files");
        }
    }

    /**
     * Clear persistent data and reload from CSV
     */
    public async onResetToCSV(): Promise<void> {
        if (confirm("Are you sure you want to reset all data and reload from CSV files? This will clear all current data.")) {
            try {
                MessageToast.show("Resetting data and reloading from CSV...");
                
                // Clear all persistent data
                this.dataManager.clearAllData();
                
                // Reload from CSV
                const csvData = await this.dataManager.reloadFromCSV();
                
                if (csvData) {
                    this.updateAllModels(csvData);
                    MessageToast.show("Data reset and reloaded from CSV files!");
                } else {
                    MessageToast.show("Failed to reload data from CSV files");
                }
            } catch (error) {
                console.error("Error resetting to CSV:", error);
                MessageToast.show("Error resetting data to CSV");
            }
        }
    }

    /**
     * Export current data to CSV format
     */
    public onExportToCSV(): void {
        try {
            const data = this.dataManager.loadData();
            if (data) {
                this.exportUsersToCSV(data.users);
                this.exportEmployeesToCSV(data.employees);
                this.exportSkillsToCSV(data.skills);
                MessageToast.show("Data exported to CSV files!");
            } else {
                MessageToast.show("No data to export");
            }
        } catch (error) {
            console.error("Error exporting to CSV:", error);
            MessageToast.show("Error exporting data to CSV");
        }
    }

    /**
     * Check CSV file status
     */
    public async onCheckCSVStatus(): Promise<any> {
        try {
            const status = await this.checkCSVFiles();
            console.log("CSV file status:", status);
            MessageToast.show("CSV status checked. See console for details.");
            return status;
        } catch (error) {
            console.error("Error checking CSV status:", error);
            MessageToast.show("Error checking CSV file status");
            throw error;
        }
    }

    /**
     * Update all models with new data
     */
    private updateAllModels(data: any): void {
        const component = this.getOwnerComponent();
        if (!component) {
            console.warn('Owner component not available - cannot update models');
            return;
        }

        // Update users model
        const usersModel = component.getModel("users") as any;
        if (usersModel && typeof usersModel.setData === 'function') {
            usersModel.setData({ users: data.users || [] });
        }

        // Update employees model
        const employeesModel = component.getModel("employees") as any;
        if (employeesModel && typeof employeesModel.setData === 'function') {
            employeesModel.setData({ employees: data.employees || [] });
        }

        // Update skills model
        const skillsModel = component.getModel("skills") as any;
        if (skillsModel && typeof skillsModel.setData === 'function') {
            skillsModel.setData({ skills: data.skills || [] });
        }

        // Update projects model
        const projectsModel = component.getModel("projects") as any;
        if (projectsModel && typeof projectsModel.setData === 'function') {
            projectsModel.setData({ projects: data.projects || [] });
        }
        
        console.log("All models updated with CSV data");
    }

    /**
     * Check if CSV files are accessible
     */
    private async checkCSVFiles(): Promise<any> {
        const status = {
            users: false,
            employees: false,
            skills: false,
            projects: false
        };
        
        try {
            // Check users.csv
            const usersResponse = await fetch("data/users.csv");
            status.users = usersResponse.ok;
        } catch (error) {
            console.error("Users CSV not accessible:", error);
        }
        
        try {
            // Check employees.csv
            const employeesResponse = await fetch("data/employees.csv");
            status.employees = employeesResponse.ok;
        } catch (error) {
            console.error("Employees CSV not accessible:", error);
        }
        
        try {
            // Check skills.csv
            const skillsResponse = await fetch("data/skills.csv");
            status.skills = skillsResponse.ok;
        } catch (error) {
            console.error("Skills CSV not accessible:", error);
        }
        
        try {
            // Check projects.json
            const projectsResponse = await fetch("model/projects.json");
            status.projects = projectsResponse.ok;
        } catch (error) {
            console.error("Projects JSON not accessible:", error);
        }
        
        return status;
    }

    /**
     * Export users to CSV format
     */
    private exportUsersToCSV(users: any[]): void {
        if (!users || users.length === 0) return;
        
        const headers = ["id", "name", "password", "role", "team", "subTeam", "manager"];
        const csvContent = [
            headers.join(","),
            ...users.map(user => headers.map(header => user[header] || "").join(","))
        ].join("\n");
        
        this.downloadCSV(csvContent, "users.csv");
    }

    /**
     * Export employees to CSV format
     */
    private exportEmployeesToCSV(employees: any[]): void {
        if (!employees || employees.length === 0) return;
        
        const headers = ["id", "name", "team", "subTeam", "manager", "email", "totalSkills", "totalProjects", "specialization"];
        const csvContent = [
            headers.join(","),
            ...employees.map(employee => headers.map(header => employee[header] || "").join(","))
        ].join("\n");
        
        this.downloadCSV(csvContent, "employees.csv");
    }

    /**
     * Export skills to CSV format
     */
    private exportSkillsToCSV(skills: any[]): void {
        if (!skills || skills.length === 0) return;
        
        const headers = ["skillId", "skillName", "category", "employeeId", "proficiencyLevel", "yearsExperience", "certificationStatus"];
        const csvContent = [
            headers.join(","),
            ...skills.map(skill => headers.map(header => skill[header] || "").join(","))
        ].join("\n");
        
        this.downloadCSV(csvContent, "skills.csv");
    }

    /**
     * Download CSV content as file
     */
    private downloadCSV(content: string, filename: string): void {
        const blob = new Blob([content], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
    }
}
