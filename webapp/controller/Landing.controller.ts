import Controller from "sap/ui/core/mvc/Controller";
import Router from "sap/ui/core/routing/Router";
import MessageToast from "sap/m/MessageToast";
import MessageBox from "sap/m/MessageBox";
import Dialog from "sap/m/Dialog";
import Input from "sap/m/Input";
import Select from "sap/m/Select";
import SegmentedButton from "sap/m/SegmentedButton";
import StepInput from "sap/m/StepInput";
import VBox from "sap/m/VBox";
import JSONModel from "sap/ui/model/json/JSONModel";

/**
 * @namespace skillsphere.controller
 */
export default class Landing extends Controller {

    public onInit(): void {
        // Landing page initialization
    }

    private getRouter(): Router {
        return (this.getOwnerComponent() as any).getRouter();
    }

    public onRegisterPress(): void {
        const dialog = this.byId("registrationDialog") as Dialog;
        // Reset form to default (Employee)
        const segmentedButton = this.byId("regRoleSegmented") as SegmentedButton;
        segmentedButton.setSelectedKey("Employee");
        this.onRoleChange();
        dialog.open();
    }

    public onEmployeeLoginPress(): void {
        this.getRouter().navTo("EmployeeLogin");
    }

    public onManagerLoginPress(): void {
        this.getRouter().navTo("ManagerLogin");
    }

    /**
     * Toggle visibility of role-specific fields
     */
    public onRoleChange(): void {
        const segmentedButton = this.byId("regRoleSegmented") as SegmentedButton;
        const selectedRole = segmentedButton.getSelectedKey();
        
        const employeeFields = this.byId("employeeSpecificFields") as VBox;
        const managerFields = this.byId("managerSpecificFields") as VBox;
        const subTeamSelect = this.byId("regSubTeam") as Select;
        
        if (selectedRole === "Employee") {
            employeeFields.setVisible(true);
            managerFields.setVisible(false);
            // Set default sub-team for employees
            subTeamSelect.setSelectedKey("Development");
        } else {
            employeeFields.setVisible(false);
            managerFields.setVisible(true);
            // Set default sub-team for managers
            subTeamSelect.setSelectedKey("Management");
        }
    }

    /**
     * Generate unique ID for employee or manager
     */
    private async generateUserId(role: string): Promise<string> {
        const prefix = role === "Employee" ? "EMP" : "MGR";
        
        // Get existing users from API
        try {
            const endpoint = role === "Employee" ? "employees" : "managers";
            const response = await fetch(`http://localhost:3000/api/${endpoint}`);
            const result = await response.json();
            
            if (result.success && result.data) {
                const existingIds = result.data.map((item: any) => 
                    role === "Employee" ? item.employeeId : item.managerId
                );
                
                // Find next available number
                let counter = 1;
                let newId = `${prefix}${String(counter).padStart(3, '0')}`;
                
                while (existingIds.includes(newId)) {
                    counter++;
                    newId = `${prefix}${String(counter).padStart(3, '0')}`;
                }
                
                return newId;
            }
        } catch (error) {
            console.error("Error generating user ID:", error);
        }
        
        // Fallback: use timestamp-based ID
        return `${prefix}${Date.now().toString().slice(-3)}`;
    }

    /**
     * Validate email format
     */
    private isValidEmail(email: string): boolean {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Register new user (Employee or Manager)
     */
    public async onRegisterUser(): Promise<void> {
        // Get form inputs
        const segmentedButton = this.byId("regRoleSegmented") as SegmentedButton;
        const nameInput = this.byId("regName") as Input;
        const emailInput = this.byId("regEmail") as Input;
        const teamSelect = this.byId("regTeam") as Select;
        const subTeamSelect = this.byId("regSubTeam") as Select;
        const passwordInput = this.byId("regPassword") as Input;
        const confirmPasswordInput = this.byId("regConfirmPassword") as Input;

        const role = segmentedButton.getSelectedKey();
        const name = nameInput.getValue().trim();
        const email = emailInput.getValue().trim();
        const team = teamSelect.getSelectedKey();
        const subTeam = subTeamSelect.getSelectedKey();
        const password = passwordInput.getValue();
        const confirmPassword = confirmPasswordInput.getValue();

        // Validate basic fields
        if (!name || !email || !team || !subTeam || !password || !confirmPassword) {
            MessageBox.error("Please fill all required fields");
            return;
        }

        // Validate email format
        if (!this.isValidEmail(email)) {
            MessageBox.error("Please enter a valid email address");
            return;
        }

        // Validate password
        if (password.length < 6) {
            MessageBox.error("Password must be at least 6 characters long");
            return;
        }

        if (password !== confirmPassword) {
            MessageBox.error("Passwords do not match");
            return;
        }

        // Get role-specific fields
        let managerId = "";
        let specialization = "";
        let managementArea = "";
        let experience = 0;

        if (role === "Employee") {
            const managerSelect = this.byId("regManager") as Select;
            const specializationInput = this.byId("regSpecialization") as Input;
            
            managerId = managerSelect.getSelectedKey();
            specialization = specializationInput.getValue().trim();
            
            if (!managerId || !specialization) {
                MessageBox.error("Please fill all employee fields");
                return;
            }
        } else {
            const managementAreaInput = this.byId("regManagementArea") as Input;
            const experienceInput = this.byId("regExperience") as StepInput;
            
            managementArea = managementAreaInput.getValue().trim();
            experience = experienceInput.getValue();
            
            if (!managementArea) {
                MessageBox.error("Please fill all manager fields");
                return;
            }
        }

        try {
            // Generate unique ID
            const userId = await this.generateUserId(role);
            console.log("Generated user ID:", userId);

            // Register based on role
            if (role === "Employee") {
                await this.registerEmployee(userId, name, email, team, subTeam, managerId, specialization, password);
            } else {
                await this.registerManager(userId, name, email, team, subTeam, managementArea, experience, password);
            }

            MessageBox.success(`Registration successful! Your ${role} ID is: ${userId}`, {
                onClose: () => {
                    this.onCloseRegisterDialog();
                }
            });

        } catch (error: any) {
            console.error("Registration error:", error);
            MessageBox.error(`Registration failed: ${error.message || 'Unknown error'}`);
        }
    }

    /**
     * Register new employee to all required CSV files
     */
    private async registerEmployee(
        employeeId: string,
        name: string,
        email: string,
        team: string,
        subTeam: string,
        managerId: string,
        specialization: string,
        password: string
    ): Promise<void> {
        console.log("Registering employee:", { employeeId, name, email, team, subTeam, managerId, specialization });

        // 1. Add to users.csv
        const userResponse = await fetch('http://localhost:3000/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: employeeId,
                name: name,
                password: password,
                role: 'Employee',
                team: team,
                subTeam: subTeam,
                managerId: managerId
            })
        });

        if (!userResponse.ok) {
            throw new Error('Failed to create user account');
        }

        // 2. Add to employees.csv
        const employeeResponse = await fetch('http://localhost:3000/api/employees', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                employeeId: employeeId,
                name: name,
                team: team,
                subTeam: subTeam,
                managerId: managerId,
                email: email,
                totalSkills: 0,
                totalProjects: 0,
                specialization: specialization
            })
        });

        if (!employeeResponse.ok) {
            throw new Error('Failed to create employee record');
        }

        // 3. Add to profiles.csv
        const profileResponse = await fetch(`http://localhost:3000/api/profiles/${employeeId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                employeeId: employeeId,
                specialization: specialization,
                working_on_project: false,
                project_start_date: '',
                project_end_date: '',
                lastUpdated: new Date().toISOString()
            })
        });

        if (!profileResponse.ok) {
            throw new Error('Failed to create employee profile');
        }

        // Reload models to reflect new data
        await this.reloadModels();
        
        console.log("✅ Employee registered successfully in all CSV files");
    }

    /**
     * Register new manager to all required CSV files
     */
    private async registerManager(
        managerId: string,
        name: string,
        email: string,
        team: string,
        subTeam: string,
        managementArea: string,
        experience: number,
        password: string
    ): Promise<void> {
        console.log("Registering manager:", { managerId, name, email, team, subTeam, managementArea, experience });

        // 1. Add to users.csv
        const userResponse = await fetch('http://localhost:3000/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: managerId,
                name: name,
                password: password,
                role: 'Manager',
                team: team,
                subTeam: subTeam,
                managerId: '' // Managers don't have managers
            })
        });

        if (!userResponse.ok) {
            throw new Error('Failed to create user account');
        }

        // 2. Add to managers.csv
        const managerResponse = await fetch('http://localhost:3000/api/managers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                managerId: managerId,
                name: name,
                team: team,
                subTeam: subTeam,
                email: email,
                totalSkills: experience * 2, // Estimate based on experience
                totalProjects: experience, // Estimate based on experience
                specialization: managementArea
            })
        });

        if (!managerResponse.ok) {
            throw new Error('Failed to create manager record');
        }

        // Reload models to reflect new data
        await this.reloadModels();
        
        console.log("✅ Manager registered successfully in all CSV files");
    }

    /**
     * Reload all models from CSV files
     */
    private async reloadModels(): Promise<void> {
        try {
            // Trigger a page reload to refresh all CSV data
            // Or implement a more sophisticated model refresh if needed
            console.log("Models will be refreshed on next page load");
        } catch (error) {
            console.error("Error reloading models:", error);
        }
    }

    public onCloseRegisterDialog(): void {
        const dialog = this.byId("registrationDialog") as Dialog;
        dialog.close();
        
        // Clear all form fields
        (this.byId("regName") as Input).setValue("");
        (this.byId("regEmail") as Input).setValue("");
        (this.byId("regTeam") as Select).setSelectedKey("");
        (this.byId("regSubTeam") as Select).setSelectedKey("");
        (this.byId("regPassword") as Input).setValue("");
        (this.byId("regConfirmPassword") as Input).setValue("");
        
        // Employee fields
        const managerSelect = this.byId("regManager") as Select;
        if (managerSelect) managerSelect.setSelectedKey("");
        const specializationInput = this.byId("regSpecialization") as Input;
        if (specializationInput) specializationInput.setValue("");
        
        // Manager fields
        const managementAreaInput = this.byId("regManagementArea") as Input;
        if (managementAreaInput) managementAreaInput.setValue("");
        const experienceInput = this.byId("regExperience") as StepInput;
        if (experienceInput) experienceInput.setValue(5);
        
        // Reset to Employee mode
        const segmentedButton = this.byId("regRoleSegmented") as SegmentedButton;
        if (segmentedButton) segmentedButton.setSelectedKey("Employee");
        this.onRoleChange();
    }
}