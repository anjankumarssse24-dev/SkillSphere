import Controller from "sap/ui/core/mvc/Controller";
import MessageToast from "sap/m/MessageToast";
import { DataUpdateService } from "../service/DataUpdateService";

/**
 * Data Management Controller
 * Demonstrates how to use the persistent data storage system
 */
export default class DataManagement extends Controller {

    private dataUpdateService: DataUpdateService;

    public onInit(): void {
        this.dataUpdateService = DataUpdateService.getInstance();
        console.log("DataManagement controller initialized");
    }

    /**
     * Add a new user
     */
    public onAddUser(): void {
        const newUser = {
            id: "EMP" + Date.now(),
            name: "New Employee",
            password: "password123",
            role: "Employee",
            team: "S4HANA",
            subTeam: "Development",
            manager: "Alice Johnson"
        };

        this.dataUpdateService.addUser(this.getOwnerComponent(), newUser);
        MessageToast.show("New user added successfully!");
    }

    /**
     * Add a new skill
     */
    public onAddSkill(): void {
        const newSkill = {
            id: "SKILL" + Date.now(),
            employeeId: "EMP001",
            skillName: "New Skill",
            proficiencyLevel: "Beginner",
            category: "Technical",
            yearsExperience: 1
        };

        this.dataUpdateService.addSkill(this.getOwnerComponent(), newSkill);
        MessageToast.show("New skill added successfully!");
    }

    /**
     * Add a new project
     */
    public onAddProject(): void {
        const newProject = {
            id: "PROJ" + Date.now(),
            name: "New Project",
            description: "Project description",
            status: "Active",
            teamLead: "Alice Johnson",
            startDate: new Date().toISOString().split('T')[0],
            endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        };

        this.dataUpdateService.addProject(this.getOwnerComponent(), newProject);
        MessageToast.show("New project added successfully!");
    }

    /**
     * Update user information
     */
    public onUpdateUser(): void {
        const updatedUser = {
            name: "Updated Name",
            team: "New Team"
        };

        this.dataUpdateService.updateUser(this.getOwnerComponent(), "EMP001", updatedUser);
        MessageToast.show("User updated successfully!");
    }

    /**
     * Delete user
     */
    public onDeleteUser(): void {
        this.dataUpdateService.deleteUser(this.getOwnerComponent(), "EMP001");
        MessageToast.show("User deleted successfully!");
    }

    /**
     * Export all data
     */
    public onExportData(): void {
        this.dataUpdateService.exportData();
        MessageToast.show("Data exported successfully!");
    }

    /**
     * Clear all data
     */
    public onClearData(): void {
        if (confirm("Are you sure you want to clear all data? This action cannot be undone.")) {
            this.dataUpdateService.clearAllData();
            MessageToast.show("All data cleared successfully!");
        }
    }

    /**
     * Get current data for debugging
     */
    public onGetData(): void {
        const data = this.dataUpdateService.getAllData();
        console.log("Current data:", data);
        MessageToast.show("Data logged to console. Check developer tools.");
    }
}
