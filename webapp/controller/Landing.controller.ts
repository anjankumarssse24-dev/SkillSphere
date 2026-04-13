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
import LocalAuth from "../service/LocalAuth";

/**
 * @namespace skillsphere.controller
 */
export default class Landing extends Controller {

    public onInit(): void {
        const accessModel = new JSONModel({
            showUnauthorized: false,
            email: "",
            message: "",
            contact: "Please contact your SkillSphere administrator."
        });
        this.getView()?.setModel(accessModel, "access");

        if (!LocalAuth.isLocalMode()) {
            this.loadManagers();
            void this.loadAuthorizationState();
        }
    }

    private async loadAuthorizationState(): Promise<void> {
        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            const accessModel = this.getView()?.getModel("access") as JSONModel;

            if (!oDataModel || !accessModel) {
                return;
            }

            const actionBinding = oDataModel.bindContext("/currentUserContext(...)");
            await actionBinding.execute();
            const userContext = actionBinding.getBoundContext()?.getObject();

            const unauthorized = !!userContext?.authenticated && !userContext?.authorized;
            accessModel.setData({
                showUnauthorized: unauthorized,
                email: userContext?.email || "",
                message: unauthorized
                    ? (userContext?.message || "You are signed in but not assigned a SkillSphere role.")
                    : "",
                contact: "Please contact your SkillSphere administrator."
            });
        } catch (error) {
            console.warn("Authorization state check skipped:", error);
        }
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
            const listBinding = oDataModel.bindList("/Employees");
            listBinding.filter([new Filter("role", FilterOperator.EQ, "Manager")]);
            
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
        
        const dialog = this.byId("landingRegistrationDialog") as Dialog;
        // Reset form to default (Employee)
        const segmentedButton = this.byId("landingRegRoleSegmented") as SegmentedButton;
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

    public onSeniorManagerLoginPress(): void {
        this.getRouter().navTo("SeniorManagerLogin");
    }

    public onSelectManagerRole(): void {
        // Close dialog and navigate to Manager Login
        const dialog = this.byId("landingManagerRoleDialog") as Dialog;
        dialog.close();
        this.getRouter().navTo("ManagerLogin");
    }

    public onSelectSeniorManagerRole(): void {
        // Close dialog and navigate to Senior Manager Login
        const dialog = this.byId("landingManagerRoleDialog") as Dialog;
        dialog.close();
        this.getRouter().navTo("SeniorManagerLogin");
    }

    public onCloseManagerRoleDialog(): void {
        const dialog = this.byId("landingManagerRoleDialog") as Dialog;
        dialog.close();
    }

    /**
     * Toggle visibility of role-specific fields
     */
    public onRoleChange(): void {
        const segmentedButton = this.byId("landingRegRoleSegmented") as SegmentedButton;
        const selectedRole = segmentedButton.getSelectedKey();
        
        const employeeIdSection = this.byId("landingEmployeeIdSection") as VBox;
        const employeeFields = this.byId("landingEmployeeSpecificFields") as VBox;
        const managerFields = this.byId("landingManagerSpecificFields") as VBox;
        const subTeamSelect = this.byId("landingRegSubTeam") as Select;
        
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
            const listBinding = oDataModel.bindList("/Employees");
            
            const contexts = await listBinding.requestContexts();
            const existingIds = contexts.map((context: any) => {
                const data = context.getObject();
                return data.employeeId;
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
        const segmentedButton = this.byId("landingRegRoleSegmented") as SegmentedButton;
        const nameInput = this.byId("landingRegName") as Input;
        const emailInput = this.byId("landingRegEmail") as Input;
        const experienceInput = this.byId("landingRegExperience") as StepInput;
        const teamSelect = this.byId("landingRegTeam") as Select;
        const subTeamSelect = this.byId("landingRegSubTeam") as Select;

        const role = segmentedButton.getSelectedKey();
        const name = nameInput.getValue().trim();
        const email = emailInput.getValue().trim();
        const experience = experienceInput.getValue();
        const team = teamSelect.getSelectedKey();
        const subTeam = subTeamSelect.getSelectedKey();
        // Validate basic fields
        if (!name || !email || !team || !subTeam) {
            MessageBox.error("Please fill all required fields");
            return;
        }

        // Validate email format
        if (!this.isValidEmail(email)) {
            MessageBox.error("Please enter a valid email address");
            return;
        }

        // Get role-specific fields
        let userId = "";
        let managerId = "";
        let managementArea = "";
        let managerExperience = 0;

        if (role === "Employee") {
            const employeeIdInput = this.byId("landingRegEmployeeId") as Input;
            const managerSelect = this.byId("landingRegManager") as Select;
            
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
            const managementAreaInput = this.byId("landingRegManagementArea") as Input;
            const managerExperienceInput = this.byId("landingRegManagerExperience") as StepInput;
            
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
                await this.registerEmployee(userId, name, email, team, subTeam, managerId, experience);
            } else {
                await this.registerManager(userId, name, email, team, subTeam, managementArea, managerExperience);
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
        experience: number
    ): Promise<void> {
        console.log("Registering employee:", { employeeId, name, email, team, subTeam, managerId, experience });

        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            
            // 1. Add to Users
            const usersBinding = oDataModel.bindList("/Users");
            const userData = {
                id: employeeId,
                role: 'Employee',
                isActive: true
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
        experience: number
    ): Promise<void> {
        console.log("Registering manager:", { managerId, name, email, team, subTeam, managementArea, experience });

        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            
            // 1. Add to Users
            const usersBinding = oDataModel.bindList("/Users");
            const userData = {
                id: managerId,
                role: 'Manager',
                isActive: true
            };
            usersBinding.create(userData);
            console.log("✅ User created");

            // 2. Add manager as a row in unified Employees entity
            const managersBinding = oDataModel.bindList("/Employees");
            const managerData = {
                employeeId: managerId,
                name: name,
                role: 'Manager',
                team: team,
                subTeam: subTeam,
                managerId: '',
                email: email,
                experience: experience,
                totalSkills: experience * 2,
                totalProjects: experience,
                location: 'Bangalore',
                tLevel: 'T3',
                gradeLevel: 'L1'
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
        const dialog = this.byId("landingRegistrationDialog") as Dialog;
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