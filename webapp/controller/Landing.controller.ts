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
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";

/**
 * @namespace skillsphere.controller
 */
export default class Landing extends Controller {

    public onInit(): void {
        // Landing page initialization
        this.loadManagers();
    }

    private getRouter(): Router {
        return (this.getOwnerComponent() as any).getRouter();
    }

    /**
     * Load all managers from OData for registration dropdown
     */
    private async loadManagers(): Promise<void> {
        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            const listBinding = oDataModel.bindList("/Managers");
            
            const contexts = await listBinding.requestContexts();
            const managers = contexts.map((context: any) => context.getObject());
            
            console.log(`✅ Loaded ${managers.length} managers for registration`);
            
            // Create local model for managers dropdown
            const managersModel = new JSONModel({ managers: managers });
            this.getView()?.setModel(managersModel, "managers");
        } catch (error) {
            console.error("❌ Error loading managers:", error);
            // Set empty model on error
            const emptyModel = new JSONModel({ managers: [] });
            this.getView()?.setModel(emptyModel, "managers");
        }
    }

    public async onRegisterPress(): Promise<void> {
        // Load latest managers data
        await this.loadManagers();
        
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
        // Navigate directly to Manager Login (handles both Manager and Senior Manager)
        this.getRouter().navTo("ManagerLogin");
    }

    public onSelectManagerRole(): void {
        // Close dialog and navigate to Manager Login
        const dialog = this.byId("managerRoleDialog") as Dialog;
        dialog.close();
        this.getRouter().navTo("ManagerLogin");
    }

    public onSelectSeniorManagerRole(): void {
        // Close dialog and navigate to Senior Manager Login
        const dialog = this.byId("managerRoleDialog") as Dialog;
        dialog.close();
        this.getRouter().navTo("SeniorManagerLogin");
    }

    public onCloseManagerRoleDialog(): void {
        const dialog = this.byId("managerRoleDialog") as Dialog;
        dialog.close();
    }

    /**
     * Toggle visibility of role-specific fields
     */
    public onRoleChange(): void {
        const segmentedButton = this.byId("regRoleSegmented") as SegmentedButton;
        const selectedRole = segmentedButton.getSelectedKey();
        
        const employeeIdSection = this.byId("employeeIdSection") as VBox;
        const employeeFields = this.byId("employeeSpecificFields") as VBox;
        const managerFields = this.byId("managerSpecificFields") as VBox;
        const subTeamSelect = this.byId("regSubTeam") as Select;
        
        if (selectedRole === "Employee") {
            employeeIdSection.setVisible(true);
            employeeFields.setVisible(true);
            managerFields.setVisible(false);
            // Set default sub-team for employees
            subTeamSelect.setSelectedKey("Team1");
        } else {
            employeeIdSection.setVisible(false);
            employeeFields.setVisible(false);
            managerFields.setVisible(true);
            // Set default sub-team for managers  
            subTeamSelect.setSelectedKey("Team1");
        }
    }

    /**
     * Generate unique ID for employee or manager using OData
     */
    private async generateUserId(role: string): Promise<string> {
        const prefix = role === "Employee" ? "EMP" : "MGR";
        
        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            const entitySet = role === "Employee" ? "/Employees" : "/Managers";
            const listBinding = oDataModel.bindList(entitySet);
            
            const contexts = await listBinding.requestContexts();
            const existingIds = contexts.map((context: any) => {
                const data = context.getObject();
                return role === "Employee" ? data.employeeId : data.managerId;
            });
            
            // Find next available number
            let counter = 1;
            let newId = `${prefix}${String(counter).padStart(3, '0')}`;
            
            while (existingIds.includes(newId)) {
                counter++;
                newId = `${prefix}${String(counter).padStart(3, '0')}`;
            }
            
            console.log("Generated new ID:", newId);
            return newId;
        } catch (error) {
            console.error("Error generating user ID:", error);
            // Fallback: use timestamp-based ID
            return `${prefix}${Date.now().toString().slice(-3)}`;
        }
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
        const experienceInput = this.byId("regExperience") as StepInput;
        const teamSelect = this.byId("regTeam") as Select;
        const subTeamSelect = this.byId("regSubTeam") as Select;
        const passwordInput = this.byId("regPassword") as Input;
        const confirmPasswordInput = this.byId("regConfirmPassword") as Input;

        const role = segmentedButton.getSelectedKey();
        const name = nameInput.getValue().trim();
        const email = emailInput.getValue().trim();
        const experience = experienceInput.getValue();
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
        let userId = "";
        let managerId = "";
        let managementArea = "";
        let managerExperience = 0;

        if (role === "Employee") {
            const employeeIdInput = this.byId("regEmployeeId") as Input;
            const managerSelect = this.byId("regManager") as Select;
            
            userId = employeeIdInput.getValue().trim();
            managerId = managerSelect.getSelectedKey();
            
            if (!userId || !managerId) {
                MessageBox.error("Please fill all employee fields");
                return;
            }
            
            // Validate employee ID format (optional: can add specific pattern validation)
            if (userId.length < 3) {
                MessageBox.error("Employee ID must be at least 3 characters long");
                return;
            }
        } else {
            const managementAreaInput = this.byId("regManagementArea") as Input;
            const managerExperienceInput = this.byId("regManagerExperience") as StepInput;
            
            managementArea = managementAreaInput.getValue().trim();
            managerExperience = managerExperienceInput.getValue();
            
            if (!managementArea) {
                MessageBox.error("Please fill all manager fields");
                return;
            }
            
            // Generate unique ID for managers only
            userId = await this.generateUserId(role);
        }

        try {
            console.log("User ID:", userId);

            // Register based on role
            if (role === "Employee") {
                await this.registerEmployee(userId, name, email, team, subTeam, managerId, experience, password);
            } else {
                await this.registerManager(userId, name, email, team, subTeam, managementArea, managerExperience, password);
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
     * Register new employee using OData
     */
    private async registerEmployee(
        employeeId: string,
        name: string,
        email: string,
        team: string,
        subTeam: string,
        managerId: string,
        experience: number,
        password: string
    ): Promise<void> {
        console.log("Registering employee:", { employeeId, name, email, team, subTeam, managerId, experience });

        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            
            // 1. Add to Users
            const usersBinding = oDataModel.bindList("/Users");
            const userData = {
                id: employeeId,
                name: name,
                password: password,
                role: 'Employee',
                team: team,
                subTeam: subTeam,
                managerId: managerId
            };
            usersBinding.create(userData);
            console.log("✅ User created");

            // 2. Add to Employees
            const employeesBinding = oDataModel.bindList("/Employees");
            const employeeData = {
                employeeId: employeeId,
                name: name,
                team: team,
                subTeam: subTeam,
                managerId: managerId,
                email: email,
                experience: experience,
                totalSkills: 0,
                totalProjects: 0,
                role: 'Employee',
                location: 'Bangalore',
                tLevel: 'T1'
            };
            employeesBinding.create(employeeData);
            console.log("✅ Employee created");

            // 3. Add to Profiles
            const profilesBinding = oDataModel.bindList("/Profiles");
            const profileData = {
                employeeId: employeeId,
                specialization: '',
                role: 'Employee',
                location: 'Bangalore',
                tLevel: 'T1',
                lastUpdated: new Date().toISOString()
            };
            profilesBinding.create(profileData);
            console.log("✅ Profile created");

            // Submit all changes in batch
            await oDataModel.submitBatch(oDataModel.getUpdateGroupId());
            console.log("✅ Employee registered successfully in database");
            
            // Wait for backend to process
            await new Promise(resolve => setTimeout(resolve, 500));
            
        } catch (error) {
            console.error("❌ Error registering employee:", error);
            throw new Error('Failed to register employee');
        }
    }

    /**
     * Register new manager using OData
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

        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            
            // 1. Add to Users
            const usersBinding = oDataModel.bindList("/Users");
            const userData = {
                id: managerId,
                name: name,
                password: password,
                role: 'Manager',
                team: team,
                subTeam: subTeam,
                managerId: '' // Managers don't have managers
            };
            usersBinding.create(userData);
            console.log("✅ User created");

            // 2. Add to Managers
            const managersBinding = oDataModel.bindList("/Managers");
            const managerData = {
                managerId: managerId,
                name: name,
                team: team,
                subTeam: subTeam,
                email: email,
                totalSkills: experience * 2, // Estimate based on experience
                totalProjects: experience, // Estimate based on experience
                specialization: managementArea
            };
            managersBinding.create(managerData);
            console.log("✅ Manager created");

            // Submit all changes in batch
            await oDataModel.submitBatch(oDataModel.getUpdateGroupId());
            console.log("✅ Manager registered successfully in database");
            
            // Wait for backend to process
            await new Promise(resolve => setTimeout(resolve, 500));
            
        } catch (error) {
            console.error("❌ Error registering manager:", error);
            throw new Error('Failed to register manager');
        }
    }

    /**
     * Reload all models from database (no longer needed with OData)
     */
    private async reloadModels(): Promise<void> {
        try {
            console.log("Models auto-refresh with OData");
        } catch (error) {
            console.error("Error reloading models:", error);
        }
    }

    public onCloseRegisterDialog(): void {
        const dialog = this.byId("registrationDialog") as Dialog;
        dialog.close();
        
        // Clear all form fields
        (this.byId("regEmployeeId") as Input).setValue("");
        (this.byId("regName") as Input).setValue("");
        (this.byId("regEmail") as Input).setValue("");
        (this.byId("regExperience") as StepInput).setValue(0);
        (this.byId("regTeam") as Select).setSelectedKey("");
        (this.byId("regSubTeam") as Select).setSelectedKey("");
        (this.byId("regPassword") as Input).setValue("");
        (this.byId("regConfirmPassword") as Input).setValue("");
        
        // Employee fields
        const managerSelect = this.byId("regManager") as Select;
        if (managerSelect) managerSelect.setSelectedKey("");
        
        // Manager fields
        const managementAreaInput = this.byId("regManagementArea") as Input;
        if (managementAreaInput) managementAreaInput.setValue("");
        const managerExperienceInput = this.byId("regManagerExperience") as StepInput;
        if (managerExperienceInput) managerExperienceInput.setValue(0);
        
        // Reset to Employee mode
        const segmentedButton = this.byId("regRoleSegmented") as SegmentedButton;
        if (segmentedButton) segmentedButton.setSelectedKey("Employee");
        this.onRoleChange();
    }
}