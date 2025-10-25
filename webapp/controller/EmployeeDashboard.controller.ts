import Controller from "sap/ui/core/mvc/Controller";
import Router from "sap/ui/core/routing/Router";
import MessageToast from "sap/m/MessageToast";
import JSONModel from "sap/ui/model/json/JSONModel";
import Event from "sap/ui/base/Event";
import Dialog from "sap/m/Dialog";
import Fragment from "sap/ui/core/Fragment";
import { DataManager } from "../service/DataManager";

/**
 * @namespace skillsphere.controller
 */
export default class EmployeeDashboard extends Controller {

    private dataManager: DataManager;
    private addSkillDialog?: Dialog;
    private editSkillDialog?: Dialog;
    private addProjectDialog?: Dialog;
    private editProjectDialog?: Dialog;

    public onInit(): void {
        const router = this.getRouter();
        router.getRoute("EmployeeDashboard")?.attachPatternMatched(this.onRouteMatched, this);
        
        // Initialize DataManager
        this.dataManager = DataManager.getInstance();
        this.initializeLocalStorage();
    }
    
    // localStorage helper methods for data persistence
    private initializeLocalStorage(): void {
        try {
            if (!localStorage.getItem('skills')) {
                localStorage.setItem('skills', JSON.stringify([]));
            }
            if (!localStorage.getItem('projects')) {
                localStorage.setItem('projects', JSON.stringify([]));
            }
            if (!localStorage.getItem('employees')) {
                localStorage.setItem('employees', JSON.stringify([]));
            }
            console.log('LocalStorage initialized for data persistence');
        } catch (error) {
            console.error('Error initializing localStorage:', error);
        }
    }
    
    private saveToLocalStorage(key: string, data: any): void {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            console.log(`Data saved to localStorage key: ${key}`);
        } catch (error) {
            console.error(`Error saving to localStorage key ${key}:`, error);
        }
    }
    
    private loadFromLocalStorage(key: string): any[] {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error(`Error loading from localStorage key ${key}:`, error);
            return [];
        }
    }
    
    // Method to register current employee to localStorage if not already there
    private ensureEmployeeRegistered(employeeId: string): void {
        try {
            const employees = this.loadFromLocalStorage('employees');
            const existingEmployee = employees.find((emp: any) => emp.id === employeeId);
            
            if (!existingEmployee) {
                // Get current user data
                const currentUserModel = this.getOwnerComponent()?.getModel("currentUser") as JSONModel;
                const currentUser = currentUserModel?.getData();
                
                const newEmployee = {
                    id: employeeId,
                    name: currentUser?.name || `Employee ${employeeId}`,
                    email: currentUser?.email || `${employeeId}@company.com`,
                    team: currentUser?.team || "General",
                    role: "Employee",
                    registeredAt: new Date().toISOString()
                };
                
                employees.push(newEmployee);
                this.saveToLocalStorage('employees', employees);
                
                console.log(`Employee ${employeeId} registered to localStorage:`, newEmployee);
            }
        } catch (error) {
            console.error('Error ensuring employee registration:', error);
        }
    }

    private getRouter(): Router {
        return (this.getOwnerComponent() as any).getRouter();
    }

    private onRouteMatched(event: any): void {
        const args = event.getParameter("arguments");
        const employeeId = args.employeeId;
        
        // Load employee-specific data
        this.loadEmployeeData(employeeId);
    }

    private async loadEmployeeData(employeeId: string): Promise<void> {
        try {
            console.log('Loading employee data for:', employeeId);
            
            // Load employee details from employees CSV and update currentUser model
            const employeesModel = this.getOwnerComponent()?.getModel("employees") as JSONModel;
            const allEmployees = employeesModel?.getData()?.employees || [];
            const employee = allEmployees.find((e: any) => e.id === employeeId);
            
            if (employee) {
                console.log('Employee details from CSV:', employee);
                // Update currentUser model with employee details from CSV
                const currentUserModel = this.getOwnerComponent()?.getModel("currentUser") as JSONModel;
                const currentUserData = currentUserModel?.getData() || {};
                currentUserModel?.setData({
                    ...currentUserData,
                    id: employee.id,
                    name: employee.name,
                    email: employee.email,
                    team: employee.team,
                    subTeam: employee.subTeam,
                    manager: employee.manager,
                    role: 'Employee',
                    employeeId: employee.id,
                    isLoggedIn: true
                });
                console.log('✅ Updated currentUser model with employee details');
            } else {
                console.warn('Employee not found in employees.csv:', employeeId);
            }
            
            // Ensure employee is registered in localStorage for manager dashboard visibility
            this.ensureEmployeeRegistered(employeeId);
            
            // Load skills from the centralized skills model (loaded from CSV)
            const skillsModel = this.getOwnerComponent()?.getModel("skills") as JSONModel;
            const allModelSkills = skillsModel?.getData()?.skills || [];
            
            // Filter skills for current employee
            const employeeSkills = allModelSkills.filter((skill: any) => skill.employeeId === employeeId);
            console.log(`Loaded ${employeeSkills.length} skills from CSV for employee ${employeeId}`, employeeSkills);
            
            // Load projects from the centralized projects model (loaded from CSV)
            const projectsModelGlobal = this.getOwnerComponent()?.getModel("projects") as JSONModel;
            const allProjects = projectsModelGlobal?.getData()?.projects || [];
            const employeeProjects = allProjects.filter((project: any) => project.employeeId === employeeId);
            console.log(`Loaded ${employeeProjects.length} projects from CSV for employee ${employeeId}`, employeeProjects);
            
            // Set up models with CSV data
            const skillsModelView = new JSONModel({ skills: employeeSkills });
            this.getView()?.setModel(skillsModelView, "skills");
            
            const projectsModel = new JSONModel({ projects: employeeProjects });
            this.getView()?.setModel(projectsModel, "projects");
            
            // Store current employee ID
            const currentEmployeeModel = new JSONModel({ employeeId: employeeId });
            this.getView()?.setModel(currentEmployeeModel, "currentEmployee");

            // Load employee profile from CSV via DataManager
            await this.loadEmployeeProfile(employeeId);
            
        } catch (error: any) {
            console.error('Failed to load employee data:', error);
            MessageToast.show("Failed to load employee data");
        }
    }

    public formatProficiencyState(proficiency: string): string {
        switch (proficiency) {
            case "Proficient":
                return "Success";
            case "Intermediate":
                return "Warning";
            case "Beginner":
                return "Error";
            default:
                return "None";
        }
    }

    public onLogout(): void {
        // Clear current user
        const currentUserModel = this.getOwnerComponent()?.getModel("currentUser") as JSONModel;
        currentUserModel.setData({
            id: null,
            name: null,
            role: null,
            isLoggedIn: false
        });

        MessageToast.show("Logged out successfully");
        this.getRouter().navTo("Landing");
    }

    public async onAddSkill(): Promise<void> {
        try {
            // Destroy existing dialog to prevent duplicate IDs
            if (this.addSkillDialog) {
                this.addSkillDialog.destroy();
                this.addSkillDialog = undefined;
            }

            // Load the dialog fragment
            this.addSkillDialog = await Fragment.load({
                name: "skillsphere.view.dialogs.AddSkillDialog",
                controller: this
            }) as Dialog;
            this.getView()?.addDependent(this.addSkillDialog);

            // Initialize empty skill model
            const newSkillModel = new JSONModel({
                skillName: "",
                category: "",
                proficiency: "",
                yearsExperience: 0,
                certificationStatus: ""
            });
            this.getView()?.setModel(newSkillModel, "newSkill");

            this.addSkillDialog.open();
        } catch (error) {
            console.error('Error opening add skill dialog:', error);
            MessageToast.show("Error opening add skill dialog");
        }
    }

    public async onSaveSkill(): Promise<void> {
        try {
            console.log("onSaveSkill called");
            
            const currentEmployeeModel = this.getView()?.getModel("currentEmployee") as JSONModel;
            const employeeId = currentEmployeeModel?.getData()?.employeeId;

            if (!employeeId) {
                MessageToast.show("Employee ID not found");
                return;
            }

            // Get form data from the newSkill model
            const newSkillModel = this.getView()?.getModel("newSkill") as JSONModel;
            const formData = newSkillModel?.getData();
            
            console.log("Form data from newSkill model:", formData);

            // Validate required fields
            if (!formData || !formData.skillName || !formData.category) {
                MessageToast.show("Please fill all required fields: Skill Name and Category");
                return;
            }
            
            if (!formData.proficiency || formData.proficiency === "") {
                MessageToast.show("Please select a Proficiency Level (Beginner, Intermediate, or Proficient)");
                return;
            }

            const skillData = {
                id: `SKL_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                skillId: `SKL_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                employeeId,
                skillName: formData.skillName,
                category: formData.category,
                proficiencyLevel: formData.proficiency,
                yearsExperience: parseInt(formData.yearsExperience) || 0,
                certificationStatus: formData.certificationStatus || "None",
                dateAdded: new Date().toISOString().split('T')[0]
            };

            console.log('Adding skill data:', skillData);
            
            // Use DataManager to save (will persist to CSV via backend API)
            const result = await this.dataManager.addSkill(skillData);
            
            if (result.success) {
                // Update the skills model immediately
                const skillsModel = this.getView()?.getModel("skills") as JSONModel;
                const currentSkills = skillsModel?.getData()?.skills || [];
                currentSkills.push(result.data);
                skillsModel?.setData({ skills: currentSkills });
                console.log('Skills model updated with new skill');
                
                MessageToast.show("Skill added successfully and saved to CSV");
            } else {
                MessageToast.show(result.fallback ? "Skill added to local storage only" : "Error adding skill");
            }
            
            this.onCloseAddSkillDialog();
            
        } catch (error: any) {
            console.error('Error saving skill:', error);
            MessageToast.show("Error saving skill");
        }
    }

    public onCloseAddSkillDialog(): void {
        if (this.addSkillDialog) {
            this.addSkillDialog.close();
            
            // We'll destroy in onAfterClose to prevent UI issues
            this.addSkillDialog.attachAfterClose(() => {
                this.addSkillDialog?.destroy();
                this.addSkillDialog = undefined;
            });
        }
    }

    public onProficiencyChange(event: Event): void {
        const select = event.getSource() as any;
        const selectedKey = select.getSelectedKey();
        const newSkillModel = this.getView()?.getModel("newSkill") as JSONModel;
        if (newSkillModel) {
            const data = newSkillModel.getData();
            data.proficiency = selectedKey;
            newSkillModel.setData(data);
            console.log("Proficiency updated to:", selectedKey);
        }
    }

    public onCertificationChange(event: Event): void {
        const select = event.getSource() as any;
        const selectedKey = select.getSelectedKey();
        const newSkillModel = this.getView()?.getModel("newSkill") as JSONModel;
        if (newSkillModel) {
            const data = newSkillModel.getData();
            data.certificationStatus = selectedKey;
            newSkillModel.setData(data);
            console.log("Certification Status updated to:", selectedKey);
        }
    }

    public onEditProficiencyChange(event: Event): void {
        const select = event.getSource() as any;
        const selectedKey = select.getSelectedKey();
        const editSkillModel = this.getView()?.getModel("editSkill") as JSONModel;
        if (editSkillModel) {
            const data = editSkillModel.getData();
            data.proficiency = selectedKey;
            editSkillModel.setData(data);
            console.log("Edit Proficiency updated to:", selectedKey);
        }
    }

    public onEditCertificationChange(event: Event): void {
        const select = event.getSource() as any;
        const selectedKey = select.getSelectedKey();
        const editSkillModel = this.getView()?.getModel("editSkill") as JSONModel;
        if (editSkillModel) {
            const data = editSkillModel.getData();
            data.certificationStatus = selectedKey;
            editSkillModel.setData(data);
            console.log("Edit Certification Status updated to:", selectedKey);
        }
    }

    public async onEditSkill(event: Event): Promise<void> {
        try {
            const context = (event.getSource() as any).getBindingContext("skills");
            const skillData = context.getProperty();
            
            // Normalize data for editing - convert proficiencyLevel back to proficiency for UI consistency
            const editData = {
                ...skillData,
                proficiency: skillData.proficiencyLevel // Map for the edit dialog Select binding
            };
            
            // Set skill data for editing
            const editSkillModel = new JSONModel(editData);
            this.getView()?.setModel(editSkillModel, "editSkill");
            
            // Destroy existing dialog to prevent duplicate IDs
            if (this.editSkillDialog) {
                this.editSkillDialog.destroy();
                this.editSkillDialog = undefined;
            }
            
            // Create new dialog
            this.editSkillDialog = await Fragment.load({
                id: this.getView()?.getId(),
                name: "skillsphere.view.dialogs.EditSkillDialog",
                controller: this
            }) as Dialog;
            this.getView()?.addDependent(this.editSkillDialog);
            
            this.editSkillDialog.open();
        } catch (error) {
            console.error('Error opening edit skill dialog:', error);
            MessageToast.show("Error opening edit dialog");
        }
    }

    public async onDeleteSkill(event: Event): Promise<void> {
        try {
            const context = (event.getSource() as any).getBindingContext("skills");
            const skillData = context.getProperty();
            const skillId = skillData.id || skillData.skillId;
            
            console.log("Deleting skill:", skillData);
            
            // Use DataManager to delete (will remove from CSV via backend API)
            const result = await this.dataManager.deleteSkill(skillId);
            
            if (result.success || result.fallback) {
                MessageToast.show(result.success ? "Skill deleted from CSV" : "Skill deleted locally");
                
                // Update the skills model immediately
                const skillsModel = this.getView()?.getModel("skills") as JSONModel;
                const currentSkills = skillsModel?.getData()?.skills || [];
                const filteredSkills = currentSkills.filter((skill: any) => 
                    skill.id !== skillId && skill.skillId !== skillId
                );
                skillsModel?.setData({ skills: filteredSkills });
            } else {
                MessageToast.show("Error deleting skill");
            }
            
        } catch (error: any) {
            console.error('Error deleting skill:', error);
            MessageToast.show("Error deleting skill");
        }
    }

    public async onSaveEditedSkill(): Promise<void> {
        try {
            const editSkillModel = this.getView()?.getModel("editSkill") as JSONModel;
            const skillData = editSkillModel.getData();
            
            console.log('Updating skill data:', skillData);
            
            // Validate required fields
            if (!skillData.skillName || !skillData.proficiency) {
                MessageToast.show("Please fill in all required fields");
                return;
            }
            
            // Normalize the data - map proficiency to proficiencyLevel for storage
            const normalizedData = {
                id: skillData.id,
                skillId: skillData.skillId || skillData.id,
                employeeId: skillData.employeeId,
                skillName: skillData.skillName,
                category: skillData.category,
                proficiencyLevel: skillData.proficiency,
                yearsExperience: skillData.yearsExperience || 0,
                certificationStatus: skillData.certificationStatus || "None",
                dateAdded: skillData.dateAdded || new Date().toISOString().split('T')[0]
            };
            
            // Use DataManager to update (will persist to CSV via backend API)
            const skillId = normalizedData.skillId || normalizedData.id;
            const result = await this.dataManager.updateSkill(skillId, normalizedData);
            
            if (result.success || result.fallback) {
                MessageToast.show(result.success ? "Skill updated in CSV" : "Skill updated locally");
                this.editSkillDialog?.close();
                
                // Update the skills model immediately
                const skillsModel = this.getView()?.getModel("skills") as JSONModel;
                const currentSkills = skillsModel?.getData()?.skills || [];
                const updatedSkills = currentSkills.map((skill: any) => 
                    (skill.id === normalizedData.id || skill.skillId === skillId) ? { ...normalizedData } : skill
                );
                skillsModel?.setData({ skills: updatedSkills });
            } else {
                MessageToast.show("Error updating skill");
            }
            
        } catch (error: any) {
            console.error('Error updating skill:', error);
            MessageToast.show("Error updating skill");
        }
    }

    public onCloseEditSkillDialog(): void {
        if (this.editSkillDialog) {
            this.editSkillDialog.close();
            
            // We'll destroy in onAfterClose to prevent UI issues
            this.editSkillDialog.attachAfterClose(() => {
                this.editSkillDialog?.destroy();
                this.editSkillDialog = undefined;
            });
        }
    }

    public async onAddProject(): Promise<void> {
        try {
            // Destroy existing dialog to prevent duplicate IDs
            if (this.addProjectDialog) {
                this.addProjectDialog.destroy();
                this.addProjectDialog = undefined;
            }

            // Initialize empty project data
            const newProjectModel = new JSONModel({
                projectName: "",
                role: "",
                startDate: null,
                endDate: null,
                status: "Active",
                description: ""
            });
            this.getView()?.setModel(newProjectModel, "newProject");
            
            // Load add project dialog with unique ID
            this.addProjectDialog = await Fragment.load({
                id: this.getView()?.getId(),
                name: "skillsphere.view.dialogs.AddProjectDialog",
                controller: this
            }) as Dialog;
            this.getView()?.addDependent(this.addProjectDialog);
            
            this.addProjectDialog.open();
        } catch (error) {
            console.error('Error opening add project dialog:', error);
            MessageToast.show("Error opening add project dialog");
        }
    }

    public async onSaveProject(): Promise<void> {
        try {
            console.log("onSaveProject called");
            
            const currentEmployeeModel = this.getView()?.getModel("currentEmployee") as JSONModel;
            const employeeId = currentEmployeeModel?.getData()?.employeeId;
            
            if (!employeeId) {
                MessageToast.show("Employee ID not found");
                return;
            }
            
            const newProjectModel = this.getView()?.getModel("newProject") as JSONModel;
            const projectData = newProjectModel?.getData();
            
            // Validate required fields
            if (!projectData || !projectData.projectName || !projectData.role) {
                MessageToast.show("Please fill in all required fields: Project Name and Role");
                return;
            }
            
            const newProject = {
                id: `PROJ_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                projectId: `PROJ_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                employeeId: employeeId,
                projectName: projectData.projectName,
                role: projectData.role,
                startDate: projectData.startDate || new Date().toISOString().split('T')[0],
                endDate: projectData.endDate || "",
                status: projectData.status || "Active",
                description: projectData.description || "",
                duration: this.calculateDuration(projectData.startDate, projectData.endDate)
            };
            
            console.log('Adding project data:', newProject);
            
            // Use DataManager to save (will persist to CSV via backend API)
            const result = await this.dataManager.addProject(newProject);
            
            if (result.success || result.fallback) {
                // Update the projects model immediately
                const projectsModel = this.getView()?.getModel("projects") as JSONModel;
                const currentProjects = projectsModel?.getData()?.projects || [];
                currentProjects.push(result.data || newProject);
                projectsModel?.setData({ projects: currentProjects });
                
                MessageToast.show(result.success ? "Project added to CSV" : "Project added locally");
            } else {
                MessageToast.show("Error adding project");
            }
            
            this.onCloseAddProjectDialog();
            
        } catch (error: any) {
            console.error('Error adding project:', error);
            MessageToast.show("Error adding project");
        }
    }

    public onCloseAddProjectDialog(): void {
        if (this.addProjectDialog) {
            this.addProjectDialog.close();
            
            // We'll destroy in onAfterClose to prevent UI issues
            this.addProjectDialog.attachAfterClose(() => {
                this.addProjectDialog?.destroy();
                this.addProjectDialog = undefined;
            });
            
            // Reset the model instead of clearing individual fields
            const emptyProject = {
                projectName: "",
                role: "",
                startDate: null,
                endDate: null,
                status: "Active",
                description: ""
            };
            this.getView()?.setModel(new JSONModel(emptyProject), "newProject");
        }
        (this.byId("statusSelect") as any)?.setSelectedKey("Active");
        (this.byId("descriptionInput") as any)?.setValue("");
    }

    public async onEditProject(event: Event): Promise<void> {
        try {
            const context = (event.getSource() as any).getBindingContext("projects");
            const projectData = context.getProperty();
            
            // Set project data for editing
            const editProjectModel = new JSONModel(projectData);
            this.getView()?.setModel(editProjectModel, "editProject");
            
            // Destroy existing dialog to prevent duplicate IDs
            if (this.editProjectDialog) {
                this.editProjectDialog.destroy();
                this.editProjectDialog = undefined;
            }
            
            // Create new dialog with correct namespace
            this.editProjectDialog = await Fragment.load({
                id: this.getView()?.getId(),
                name: "skillsphere.view.dialogs.EditProjectDialog",
                controller: this
            }) as Dialog;
            this.getView()?.addDependent(this.editProjectDialog);
            
            this.editProjectDialog.open();
        } catch (error) {
            console.error('Error opening edit project dialog:', error);
            MessageToast.show("Error opening edit project dialog");
        }
    }

    public async onDeleteProject(event: Event): Promise<void> {
        try {
            const context = (event.getSource() as any).getBindingContext("projects");
            const projectData = context.getProperty();
            const projectId = projectData.id || projectData.projectId;
            
            console.log("Deleting project:", projectData);
            
            // Use DataManager to delete (will remove from CSV via backend API)
            const result = await this.dataManager.deleteProject(projectId);
            
            if (result.success || result.fallback) {
                MessageToast.show(result.success ? "Project deleted from CSV" : "Project deleted locally");
                
                // Update the projects model immediately
                const projectsModel = this.getView()?.getModel("projects") as JSONModel;
                const currentProjects = projectsModel?.getData()?.projects || [];
                const filteredProjects = currentProjects.filter((project: any) => 
                    project.id !== projectId && project.projectId !== projectId
                );
                projectsModel?.setData({ projects: filteredProjects });
            } else {
                MessageToast.show("Error deleting project");
            }
            
        } catch (error: any) {
            console.error('Error deleting project:', error);
            MessageToast.show("Error deleting project");
        }
    }

    public async onSaveEditedProject(): Promise<void> {
        try {
            const editProjectModel = this.getView()?.getModel("editProject") as JSONModel;
            const projectData = editProjectModel.getData();
            
            console.log('Updating project data:', projectData);
            
            // Validate required fields
            if (!projectData.projectName || !projectData.role) {
                MessageToast.show("Please fill in all required fields");
                return;
            }
            
            // Use DataManager to update (will persist to CSV via backend API)
            const projectId = projectData.projectId || projectData.id;
            const result = await this.dataManager.updateProject(projectId, projectData);
            
            if (result.success || result.fallback) {
                MessageToast.show(result.success ? "Project updated in CSV" : "Project updated locally");
                this.editProjectDialog?.close();
                
                // Update the projects model immediately
                const projectsModel = this.getView()?.getModel("projects") as JSONModel;
                const currentProjects = projectsModel?.getData()?.projects || [];
                const updatedProjects = currentProjects.map((project: any) => 
                    (project.id === projectId || project.projectId === projectId) ? { ...projectData } : project
                );
                projectsModel?.setData({ projects: updatedProjects });
            } else {
                MessageToast.show("Error updating project");
            }
            
        } catch (error: any) {
            console.error('Error updating project:', error);
            MessageToast.show("Error updating project");
        }
    }

    public onCloseEditProjectDialog(): void {
        if (this.editProjectDialog) {
            this.editProjectDialog.close();
            
            // We'll destroy in onAfterClose to prevent UI issues
            this.editProjectDialog.attachAfterClose(() => {
                this.editProjectDialog?.destroy();
                this.editProjectDialog = undefined;
            });
        }
    }

    // Profile Management Methods
    public onToggleProjectStatus(): void {
        // This method is called when the working project checkbox is toggled
        // The binding will automatically update the model
        const profileModel = this.getView()?.getModel("profile") as JSONModel;
        const profileData = profileModel?.getData();
        
        // If project status is set to false, clear the dates
        if (profileData && !profileData.working_on_project) {
            profileData.project_start_date = null;
            profileData.project_end_date = null;
            profileModel.setData(profileData);
        }
    }

    public async onSaveProfile(): Promise<void> {
        try {
            const currentEmployeeModel = this.getView()?.getModel("currentEmployee") as JSONModel;
            const employeeId = currentEmployeeModel?.getData()?.employeeId;
            
            if (!employeeId) {
                MessageToast.show("Employee ID not found");
                return;
            }

            const profileModel = this.getView()?.getModel("profile") as JSONModel;
            const profileData = profileModel?.getData();

            // Validate required fields
            if (!profileData?.specialization) {
                MessageToast.show("Please select your specialization");
                return;
            }

            // Validate dates if working on project
            if (profileData.working_on_project) {
                if (!profileData.project_start_date) {
                    MessageToast.show("Please enter project start date");
                    return;
                }
                if (!profileData.project_end_date) {
                    MessageToast.show("Please enter project end date");
                    return;
                }
                
                // Validate that start date is before end date
                const startDate = new Date(profileData.project_start_date);
                const endDate = new Date(profileData.project_end_date);
                
                if (startDate >= endDate) {
                    MessageToast.show("Project start date must be before end date");
                    return;
                }
            }

            // Format dates for saving
            if (profileData.project_start_date) {
                profileData.project_start_date = this.formatDateForSaving(profileData.project_start_date);
            }
            if (profileData.project_end_date) {
                profileData.project_end_date = this.formatDateForSaving(profileData.project_end_date);
            }

            // Add employeeId to profile data
            const profileToSave = {
                ...profileData,
                employeeId: employeeId,
                lastUpdated: new Date().toISOString()
            };

            // Save to CSV via DataManager
            const result = await this.dataManager.updateEmployeeProfile(employeeId, profileToSave);
            
            if (result.success) {
                MessageToast.show("Profile updated successfully in CSV!");
            } else {
                MessageToast.show("Profile updated locally (server unavailable)");
            }
        } catch (error) {
            console.error('Error saving profile:', error);
            MessageToast.show("Error saving profile");
        }
    }

    private formatDateForSaving(date: any): string {
        if (!date) return "";
        
        // If it's already a string in correct format, return as is
        if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
            return date;
        }
        
        // Convert to ISO date format (YYYY-MM-DD)
        const dateObj = new Date(date);
        return dateObj.toISOString().split('T')[0];
    }

    private async loadEmployeeProfile(employeeId: string): Promise<void> {
        try {
            console.log('=== Loading Profile for Employee:', employeeId);
            
            // Initialize profile model with default values
            const defaultProfile = {
                specialization: "",
                working_on_project: false,
                project_start_date: null,
                project_end_date: null
            };

            // Load profile from CSV via DataManager
            console.log('Calling DataManager.getEmployeeProfile...');
            const profile = await this.dataManager.getEmployeeProfile(employeeId);
            console.log('Profile received from DataManager:', profile);
            
            if (profile) {
                // Parse boolean value from CSV string
                if (typeof profile.working_on_project === 'string') {
                    profile.working_on_project = profile.working_on_project === 'true';
                }
                
                // Parse dates if they're strings
                if (profile.project_start_date === '') {
                    profile.project_start_date = null;
                }
                if (profile.project_end_date === '') {
                    profile.project_end_date = null;
                }
                
                Object.assign(defaultProfile, profile);
                console.log('✅ Profile loaded from CSV successfully:', defaultProfile);
            } else {
                console.log('⚠️ No profile found in CSV, using defaults');
            }

            // Set the profile model
            const profileModel = new JSONModel(defaultProfile);
            this.getView()?.setModel(profileModel, "profile");
            console.log('Profile model set on view');
        } catch (error: any) {
            console.error('❌ Error loading employee profile:', error);
            // Still set default profile on error
            const profileModel = new JSONModel({
                specialization: "",
                working_on_project: false,
                project_start_date: null,
                project_end_date: null
            });
            this.getView()?.setModel(profileModel, "profile");
        }
    }

    // Profile localStorage helper methods
    private saveProfileToLocalStorage(employeeId: string, profileData: any): void {
        try {
            const profiles = this.loadFromLocalStorage('profiles');
            const existingIndex = profiles.findIndex((p: any) => p.employeeId === employeeId);
            
            if (existingIndex !== -1) {
                profiles[existingIndex] = profileData;
            } else {
                profiles.push(profileData);
            }
            
            this.saveToLocalStorage('profiles', profiles);
        } catch (error) {
            console.error('Error saving profile to localStorage:', error);
        }
    }

    private loadProfileFromLocalStorage(employeeId: string): any {
        try {
            const profiles = this.loadFromLocalStorage('profiles');
            return profiles.find((p: any) => p.employeeId === employeeId);
        } catch (error) {
            console.error('Error loading profile from localStorage:', error);
            return null;
        }
    }

    private calculateDuration(startDate: string, endDate: string): string {
        if (!startDate) return "N/A";
        
        const start = new Date(startDate);
        const end = endDate ? new Date(endDate) : new Date();
        
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays < 30) {
            return `${diffDays} days`;
        } else if (diffDays < 365) {
            const months = Math.floor(diffDays / 30);
            return `${months} month${months > 1 ? 's' : ''}`;
        } else {
            const years = Math.floor(diffDays / 365);
            const remainingMonths = Math.floor((diffDays % 365) / 30);
            if (remainingMonths > 0) {
                return `${years} year${years > 1 ? 's' : ''}, ${remainingMonths} month${remainingMonths > 1 ? 's' : ''}`;
            } else {
                return `${years} year${years > 1 ? 's' : ''}`;
            }
        }
    }
}