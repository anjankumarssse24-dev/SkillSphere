/// <reference types="@sapui5/types" />
import Controller from "sap/ui/core/mvc/Controller";
import Router from "sap/ui/core/routing/Router";
import MessageToast from "sap/m/MessageToast";
import MessageBox from "sap/m/MessageBox";
import JSONModel from "sap/ui/model/json/JSONModel";
import Event from "sap/ui/base/Event";
import Dialog from "sap/m/Dialog";
import Fragment from "sap/ui/core/Fragment";
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";
import HBox from "sap/m/HBox";
import VBox from "sap/m/VBox";
import Text from "sap/m/Text";
import FormattedText from "sap/m/FormattedText";

/**
 * @namespace skillsphere.controller
 */
export default class EmployeeDashboard extends Controller {

    private addSkillDialog?: Dialog;
    private editSkillDialog?: Dialog;
    private addProjectDialog?: Dialog;
    private editProjectDialog?: Dialog;
    private currentProjectDialog?: Dialog;
    private caiaDialog?: Dialog;
    private pocDialog?: Dialog;
    private currentEmployeeId?: string;
    private selfProfileSnapshot: any = null;

    public onInit(): void {
        const router = this.getRouter();
        router.getRoute("EmployeeDashboard")?.attachPatternMatched(this.onRouteMatched, this);
        this.getView()?.setModel(new JSONModel({ isEditing: false }), "profileUi");
        
    }

    private getRouter(): Router {
        return (this.getOwnerComponent() as any).getRouter();
    }

    private onRouteMatched(event: any): void {
        const args = event.getParameter("arguments");
        const employeeId = args.employeeId;
        
        this.currentEmployeeId = employeeId;
        
        // Load employee-specific data from OData
        this.loadEmployeeData(employeeId);
    }

    private async loadEmployeeData(employeeId: string): Promise<void> {
        try {
            
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            if (!oDataModel) {
                MessageToast.show("OData service not available");
                return;
            }

            // Load employee details from Employees entity
            const empBinding = oDataModel.bindList("/Employees");
            empBinding.filter([new Filter("employeeId", FilterOperator.EQ, employeeId)]);
            
            const empContexts = await empBinding.requestContexts(0, 1);
            
            let employeeRecord: any = null;
            let managerName = "";

            if (empContexts.length > 0) {
                const employee = empContexts[0].getObject();
                employeeRecord = employee;
                
                // Load manager name if managerId exists
                if (employee.managerId) {
                    try {
                        const mgrBinding = oDataModel.bindList("/Employees");
                        mgrBinding.filter([
                            new Filter("employeeId", FilterOperator.EQ, employee.managerId)
                        ]);
                        const mgrContexts = await mgrBinding.requestContexts(0, 1);
                        if (mgrContexts.length > 0) {
                            const manager = mgrContexts[0].getObject();
                            managerName = manager.name;
                        }
                    } catch (error) {
                        console.error('Error loading manager:', error);
                    }
                }
                
                // Update currentUser model with employee details
                const currentUserModel = this.getOwnerComponent()?.getModel("currentUser") as JSONModel;
                const currentData = currentUserModel?.getData() || {};
                currentUserModel?.setData({
                    ...currentData,
                    id: employee.employeeId,
                    name: employee.name,
                    role: employee.role || "Employee",
                    employeeId: employee.employeeId,
                    email: employee.email,
                    team: employee.team,
                    subTeam: employee.subTeam,
                    location: employee.location,
                    tLevel: employee.tLevel,
                    gradeLevel: employee.gradeLevel,
                    experience: employee.experience,
                    managerId: employee.managerId,
                    manager: managerName,
                    isLoggedIn: true
                });
                
            }

            // Load Skills for this employee
            await this.loadSkills(employeeId);
            
            // Load Projects for this employee
            await this.loadProjects(employeeId);
            
            // Load Certifications for this employee
            await this.loadCertifications(employeeId);
            
            // Load Profile
            const profile = await this.loadProfile(employeeId);

            // Merge master data + profile data into a single editable self-profile model.
            this.setSelfProfileModel(employeeRecord, profile, managerName);

            // Load manager options for self-service updates.
            await this.loadManagerOptions(employeeId);
            
            // Load Utilization data
            await this.loadCurrentProjects(employeeId);
            await this.loadInitiatives(employeeId);
            
        } catch (error) {
            console.error("Error loading employee data:", error);
            MessageToast.show("Failed to load employee data");
        }
    }

    // ============ ODATA LOAD METHODS ============

    private async loadSkills(employeeId: string): Promise<void> {
        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            const skillsBinding = oDataModel.bindList("/Skills");
            skillsBinding.filter([new Filter("employeeId", FilterOperator.EQ, employeeId)]);
            
            const skillsContexts = await skillsBinding.requestContexts(0, 100);
            const skills = skillsContexts.map((ctx: any) => ctx.getObject());
            
            
            const skillsModel = new JSONModel({ skills: skills });
            this.getView()?.setModel(skillsModel, "skills");
        } catch (error) {
            console.error("Error loading skills:", error);
            this.getView()?.setModel(new JSONModel({ skills: [] }), "skills");
        }
    }

    private async loadProjects(employeeId: string): Promise<void> {
        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            const binding = oDataModel.bindList("/CurrentProjects");
            binding.filter([
                new Filter("employeeId", FilterOperator.EQ, employeeId),
                new Filter("assignmentStatus", FilterOperator.EQ, "Completed")
            ]);
            
            const contexts = await binding.requestContexts(0, 100);
            const projects = contexts.map((ctx: any) => {
                const obj = ctx.getObject();
                return {
                    ...obj,
                    startDate: this.formatDate(obj.startDate),
                    endDate: this.formatDate(obj.endDate)
                };
            });
            
            
            const projectsModel = new JSONModel({ projects: projects });
            this.getView()?.setModel(projectsModel, "completedProjects");
        } catch (error) {
            console.error("Error loading completed projects:", error);
            this.getView()?.setModel(new JSONModel({ projects: [] }), "completedProjects");
        }
    }

    private async loadProfile(employeeId: string): Promise<any> {
        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            const profilesBinding = oDataModel.bindList("/Profiles");
            profilesBinding.filter([new Filter("employeeId", FilterOperator.EQ, employeeId)]);
            
            const profilesContexts = await profilesBinding.requestContexts(0, 1);
            
            if (profilesContexts.length > 0) {
                const profile = profilesContexts[0].getObject();
                
                const profileModel = new JSONModel(profile);
                this.getView()?.setModel(profileModel, "profile");
                return profile;
            } else {
                // Initialize empty profile
                const emptyProfile = {
                    employeeId: employeeId,
                    specialization: "",
                    role: "",
                    location: "",
                    tLevel: "",
                    gradeLevel: ""
                };
                this.getView()?.setModel(new JSONModel(emptyProfile), "profile");
                return emptyProfile;
            }
        } catch (error) {
            console.error("Error loading profile:", error);
            const emptyProfile = {
                employeeId: employeeId,
                specialization: "",
                role: "",
                location: "",
                tLevel: "",
                gradeLevel: ""
            };
            this.getView()?.setModel(new JSONModel(emptyProfile), "profile");
            return emptyProfile;
        }
    }

    private async loadManagerOptions(currentEmployeeId: string): Promise<void> {
        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            const managersBinding = oDataModel.bindList("/Employees");
            managersBinding.filter([
                new Filter({
                    filters: [
                        new Filter("role", FilterOperator.EQ, "Manager"),
                        new Filter("role", FilterOperator.EQ, "manager"),
                        new Filter("role", FilterOperator.EQ, "SeniorManager"),
                        new Filter("role", FilterOperator.EQ, "seniormanager")
                    ],
                    and: false
                })
            ]);

            const managerContexts = await managersBinding.requestContexts(0, 200);
            const managers = managerContexts
                .map((context: any) => context.getObject())
                .filter((manager: any) => manager.employeeId !== currentEmployeeId)
                .filter((manager: any) => !!manager.employeeId)
                .sort((left: any, right: any) => (left.name || "").localeCompare(right.name || ""));

            this.getView()?.setModel(new JSONModel({ managers }), "managersList");
        } catch (error) {
            console.error("Error loading manager options:", error);
            this.getView()?.setModel(new JSONModel({ managers: [] }), "managersList");
        }
    }

    private setSelfProfileModel(employee: any, profile: any, managerName: string): void {
        const selfProfile = {
            employeeId: employee?.employeeId || this.currentEmployeeId || "",
            name: employee?.name || "",
            email: employee?.email || "",
            team: employee?.team || "",
            subTeam: employee?.subTeam || "",
            managerId: employee?.managerId || "",
            managerName: managerName || "",
            experience: Number(employee?.experience || 0),
            location: profile?.location || employee?.location || "",
            tLevel: profile?.tLevel || employee?.tLevel || "",
            gradeLevel: profile?.gradeLevel || employee?.gradeLevel || "",
            professionalRole: profile?.role || "",
            specialization: profile?.specialization || ""
        };

        this.getView()?.setModel(new JSONModel(selfProfile), "selfProfile");
    }

    private async getManagerNameById(managerId: string): Promise<string> {
        if (!managerId) {
            return "";
        }

        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            const managerBinding = oDataModel.bindList("/Employees");
            managerBinding.filter([new Filter("employeeId", FilterOperator.EQ, managerId)]);

            const managerContexts = await managerBinding.requestContexts(0, 1);
            if (managerContexts.length > 0) {
                return managerContexts[0].getObject().name || "";
            }
        } catch (error) {
            console.error("Error resolving manager name:", error);
        }

        return "";
    }

    private isValidEmail(email: string): boolean {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    private async loadCurrentProjects(employeeId: string): Promise<void> {
        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            
            // Load projects from CurrentProjects (only type=Project, not completed)
            const cpBinding = oDataModel.bindList("/CurrentProjects");
            cpBinding.filter([
                new Filter("employeeId", FilterOperator.EQ, employeeId),
                new Filter("type", FilterOperator.EQ, "Project"),
                new Filter("assignmentStatus", FilterOperator.NE, "Completed")
            ]);
            const cpContexts = await cpBinding.requestContexts(0, 100);
            const cpData = cpContexts.map((ctx: any) => {
                const obj = ctx.getObject();
                return {
                    ...obj,
                    startDate: this.formatDate(obj.startDate),
                    endDate: this.formatDate(obj.endDate),
                    _source: "CurrentProjects"
                };
            });

            const currentInitiativesBinding = oDataModel.bindList("/CurrentInitiatives");
            currentInitiativesBinding.filter([new Filter("employeeId", FilterOperator.EQ, employeeId)]);

            const currentEvaluationsBinding = oDataModel.bindList("/CurrentEvaluations");
            currentEvaluationsBinding.filter([new Filter("employeeId", FilterOperator.EQ, employeeId)]);

            const [initiativeContexts, evaluationContexts] = await Promise.all([
                currentInitiativesBinding.requestContexts(0, 100),
                currentEvaluationsBinding.requestContexts(0, 100)
            ]);

            const initiativeData = initiativeContexts.map((ctx: any) => {
                const obj = ctx.getObject();
                if (obj.status === "Completed") return null;
                return {
                    currentProjectId: obj.currentInitiativeId,
                    employeeId: obj.employeeId,
                    type: "Initiative",
                    projectName: obj.initiativeName,
                    role: "Contributor",
                    projectManager: "Self-Managed",
                    startDate: this.formatDate(obj.startDate),
                    endDate: this.formatDate(obj.endDate),
                    utilizationPercent: obj.utilizationPercent,
                    assignmentStatus: "Assigned",
                    description: obj.description,
                    _source: "CurrentInitiatives",
                    _initiativeId: obj.currentInitiativeId
                };
            }).filter((item: any) => item !== null);

            const evaluationData = evaluationContexts.map((ctx: any) => {
                const obj = ctx.getObject();
                if (obj.status === "Completed") return null;
                return {
                    currentProjectId: obj.currentEvaluationId,
                    employeeId: obj.employeeId,
                    type: "Evaluation",
                    projectName: obj.evaluationName,
                    role: "Evaluator",
                    projectManager: "Self-Managed",
                    startDate: this.formatDate(obj.startDate),
                    endDate: this.formatDate(obj.endDate),
                    utilizationPercent: obj.utilizationPercent,
                    assignmentStatus: "Assigned",
                    description: obj.description,
                    _source: "CurrentEvaluations",
                    _initiativeId: obj.currentEvaluationId
                };
            }).filter((item: any) => item !== null);

            const initData = [...initiativeData, ...evaluationData];

            const allData = [...cpData, ...initData];
            
            const model = new JSONModel({ data: allData });
            this.getView()?.setModel(model, "currentProjects");
        } catch (error) {
            console.error("Error loading current projects:", error);
            this.getView()?.setModel(new JSONModel({ data: [] }), "currentProjects");
        }
    }

    private async loadCAIAUtilization(employeeId: string): Promise<void> {
        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            const binding = oDataModel.bindList("/CAIAUtilization");
            binding.filter([new Filter("employeeId", FilterOperator.EQ, employeeId)]);
            
            const contexts = await binding.requestContexts(0, 100);
            const data = contexts.map((ctx: any) => {
                const obj = ctx.getObject();
                const formatted = {
                    ...obj,
                    startDate: this.formatDate(obj.startDate),
                    endDate: this.formatDate(obj.endDate)
                };
                return formatted;
            });
            
            
            const model = new JSONModel({ data: data });
            this.getView()?.setModel(model, "caia");
        } catch (error) {
            console.error("Error loading CAIA utilization:", error);
            this.getView()?.setModel(new JSONModel({ data: [] }), "caia");
        }
    }

    private async loadPOCUtilization(employeeId: string): Promise<void> {
        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            const binding = oDataModel.bindList("/POCUtilization");
            binding.filter([new Filter("employeeId", FilterOperator.EQ, employeeId)]);
            
            const contexts = await binding.requestContexts(0, 100);
            const data = contexts.map((ctx: any) => {
                const obj = ctx.getObject();
                const formatted = {
                    ...obj,
                    startDate: this.formatDate(obj.startDate),
                    endDate: this.formatDate(obj.endDate)
                };
                return formatted;
            });
            
            
            const model = new JSONModel({ data: data });
            this.getView()?.setModel(model, "poc");
        } catch (error) {
            console.error("Error loading POC utilization:", error);
            this.getView()?.setModel(new JSONModel({ data: [] }), "poc");
        }
    }

    private async loadInitiatives(employeeId: string): Promise<void> {
        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            const initiativesBinding = oDataModel.bindList("/CurrentInitiatives");
            initiativesBinding.filter([new Filter("employeeId", FilterOperator.EQ, employeeId)]);

            const evaluationsBinding = oDataModel.bindList("/CurrentEvaluations");
            evaluationsBinding.filter([new Filter("employeeId", FilterOperator.EQ, employeeId)]);

            const [initiativeContexts, evaluationContexts] = await Promise.all([
                initiativesBinding.requestContexts(0, 100),
                evaluationsBinding.requestContexts(0, 100)
            ]);

            const initiatives = initiativeContexts.map((ctx: any) => {
                const obj = ctx.getObject();
                return {
                    ...obj,
                    type: "Initiative",
                    initiativeId: obj.currentInitiativeId,
                    initiativeName: obj.initiativeName,
                    startDate: this.formatDate(obj.startDate),
                    endDate: this.formatDate(obj.endDate)
                };
            });

            const evaluations = evaluationContexts.map((ctx: any) => {
                const obj = ctx.getObject();
                return {
                    ...obj,
                    type: "Evaluation",
                    initiativeId: obj.currentEvaluationId,
                    initiativeName: obj.evaluationName,
                    startDate: this.formatDate(obj.startDate),
                    endDate: this.formatDate(obj.endDate)
                };
            });

            const data = [...initiatives, ...evaluations];
            
            
            const model = new JSONModel({ data: data });
            this.getView()?.setModel(model, "initiatives");
        } catch (error) {
            console.error("Error loading initiatives:", error);
            this.getView()?.setModel(new JSONModel({ data: [] }), "initiatives");
        }
    }

    // ==================== Initiative Methods ====================
    
    private initiativeDialog?: Dialog;

    private isManagerUser(): boolean {
        const currentUserModel = this.getOwnerComponent()?.getModel("currentUser") as JSONModel;
        const role = String(currentUserModel?.getProperty("/role") || "").toLowerCase();
        return role === "manager" || role === "seniormanager";
    }

    public async onAddInitiative(): Promise<void> {
        if (!this.isManagerUser()) {
            MessageToast.show("Only managers can create initiatives/evaluations");
            return;
        }

        if (!this.initiativeDialog) {
            this.initiativeDialog = await Fragment.load({
                id: this.getView()?.getId(),
                name: "skillsphere.view.dialogs.InitiativeDialog",
                controller: this
            }) as Dialog;
            this.getView()?.addDependent(this.initiativeDialog);
        }

        // Initialize dialog model with empty data
        const dialogModel = new JSONModel({
            initiativeName: "",
            description: "",
            startDate: null,
            endDate: null,
            utilizationPercent: 0,
            type: "Initiative",
            status: "Active"
        });
        this.getView()?.setModel(dialogModel, "initiativeDialog");
        
        this.initiativeDialog.open();
    }

    public async onSaveInitiative(): Promise<void> {
        if (!this.isManagerUser()) {
            MessageToast.show("Only managers can create or update initiatives/evaluations");
            return;
        }

        const dialogModel = this.getView()?.getModel("initiativeDialog") as JSONModel;
        const data = dialogModel.getData();
        const employeeId = this.currentEmployeeId;

        // Validation
        const utilizationPercent = parseInt(data.utilizationPercent);
        if (!data.initiativeName || !data.description || !data.startDate || !data.endDate || 
            isNaN(utilizationPercent) || utilizationPercent < 0 || utilizationPercent > 100) {
            MessageToast.show("Please fill all required fields. Utilization must be between 0-100%");
            return;
        }

        // Helper function to convert date
        const convertToISODate = (dateString: string): string | null => {
            if (!dateString) return null;
            try {
                const date = new Date(dateString);
                if (isNaN(date.getTime())) return null;
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            } catch (error) {
                console.error('Error converting date:', dateString, error);
                return null;
            }
        };

        const startDateISO = convertToISODate(data.startDate);
        const endDateISO = convertToISODate(data.endDate);

        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            const isEvaluation = (data.type || "Initiative") === "Evaluation";

            if (data.initiativeId) {
                const listBinding = oDataModel.bindList(isEvaluation ? "/CurrentEvaluations" : "/CurrentInitiatives");
                listBinding.filter([
                    new Filter(isEvaluation ? "currentEvaluationId" : "currentInitiativeId", FilterOperator.EQ, data.initiativeId)
                ]);

                const contexts = await listBinding.requestContexts(0, 1);
                if (contexts.length > 0) {
                    const context = contexts[0];
                    const currentObj = context.getObject() as any;
                    context.setProperty(isEvaluation ? "evaluationName" : "initiativeName", data.initiativeName);
                    context.setProperty("description", data.description);
                    context.setProperty("startDate", startDateISO);
                    context.setProperty("endDate", endDateISO);
                    context.setProperty("utilizationPercent", utilizationPercent);
                    context.setProperty("status", data.status || "Active");
                    context.setProperty("lastUpdated", new Date().toISOString());

                    const masterId = isEvaluation ? currentObj?.evaluationId : currentObj?.initiativeId;
                    if (masterId) {
                        const masterBinding = oDataModel.bindList(isEvaluation ? "/EvaluationsMaster" : "/InitiativesMaster");
                        masterBinding.filter([
                            new Filter(isEvaluation ? "evaluationId" : "initiativeId", FilterOperator.EQ, masterId)
                        ]);
                        const masterContexts = await masterBinding.requestContexts(0, 1);
                        if (masterContexts.length > 0) {
                            const masterContext = masterContexts[0];
                            masterContext.setProperty(isEvaluation ? "evaluationName" : "initiativeName", data.initiativeName);
                            masterContext.setProperty("description", data.description);
                            masterContext.setProperty("startDate", startDateISO);
                            masterContext.setProperty("endDate", endDateISO);
                            masterContext.setProperty("status", data.status || "Active");
                            masterContext.setProperty("lastUpdated", new Date().toISOString());
                        }
                    }

                    await oDataModel.submitBatch(oDataModel.getUpdateGroupId());
                    await new Promise(resolve => setTimeout(resolve, 300));

                    MessageToast.show("Initiative updated successfully");
                }
            } else {
                MessageToast.show("Please use manager assignment flow to add new initiative/evaluation");
                return;
            }
            
            this.initiativeDialog?.close();
            if (employeeId) {
                await this.loadInitiatives(employeeId);
            }
        } catch (error) {
            console.error("❌ Error saving initiative:", error);
            MessageToast.show("Error saving initiative");
        }
    }

    public onCloseInitiativeDialog(): void {
        this.initiativeDialog?.close();
    }

    public async onEditInitiative(event: Event): Promise<void> {
        if (!this.isManagerUser()) {
            MessageToast.show("Only managers can edit initiatives/evaluations");
            return;
        }

        const source = event.getSource() as any;
        const bindingContext = source.getBindingContext("initiatives");
        const initiative = bindingContext?.getObject();

        if (!this.initiativeDialog) {
            this.initiativeDialog = await Fragment.load({
                id: this.getView()?.getId(),
                name: "skillsphere.view.dialogs.InitiativeDialog",
                controller: this
            }) as Dialog;
            this.getView()?.addDependent(this.initiativeDialog);
        }

        const dialogModel = new JSONModel(initiative);
        this.getView()?.setModel(dialogModel, "initiativeDialog");
        
        this.initiativeDialog.open();
    }

    public async onDeleteInitiative(event: Event): Promise<void> {
        if (!this.isManagerUser()) {
            MessageToast.show("Only managers can delete initiatives/evaluations");
            return;
        }

        const source = event.getSource() as any;
        const bindingContext = source.getBindingContext("initiatives");
        const initiative = bindingContext?.getObject();

        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            const isEvaluation = initiative?.type === "Evaluation";
            const listBinding = oDataModel.bindList(isEvaluation ? "/CurrentEvaluations" : "/CurrentInitiatives");
            listBinding.filter([
                new Filter(isEvaluation ? "currentEvaluationId" : "currentInitiativeId", FilterOperator.EQ, initiative.initiativeId)
            ]);
            
            const contexts = await listBinding.requestContexts(0, 1);
            if (contexts.length > 0) {
                contexts[0].delete();
                await oDataModel.submitBatch(oDataModel.getUpdateGroupId());
                await new Promise(resolve => setTimeout(resolve, 300));
                listBinding.refresh();
                
                MessageToast.show("Initiative deleted successfully");
                const employeeId = this.currentEmployeeId;
                if (employeeId) {
                    await this.loadInitiatives(employeeId);
                }
            }
        } catch (error) {
            console.error("❌ Error deleting initiative:", error);
            MessageToast.show("Error deleting initiative");
        }
    }

    public async onReadMoreInitiative(event: Event): Promise<void> {
        const source = event.getSource() as any;
        const bindingContext = source.getBindingContext("initiatives");
        const initiative = bindingContext?.getObject();

        if (!initiative) {
            MessageToast.show("Could not load initiative details");
            return;
        }

        // Create a message box with the full description
        MessageBox.information(
            initiative.description,
            {
                title: `${initiative.initiativeName} - Details`,
                actions: [MessageBox.Action.CLOSE],
                onClose: () => {
                    // Dialog closed
                }
            }
        );
    }

    private async loadCertifications(employeeId: string): Promise<void> {
        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            const binding = oDataModel.bindList("/Certifications");
            binding.filter([new Filter("employeeId", FilterOperator.EQ, employeeId)]);
            
            const contexts = await binding.requestContexts(0, 100);
            let certifications = contexts.map((ctx: any) => {
                const obj = ctx.getObject();
                return {
                    ...obj,
                    dateOfCompletion: this.formatDate(obj.dateOfCompletion)
                };
            });
            
            // Sort by dateOfCompletion in descending order (newest first)
            certifications = certifications.sort((a: any, b: any) => {
                const dateA = new Date(a.dateOfCompletion || 0).getTime();
                const dateB = new Date(b.dateOfCompletion || 0).getTime();
                return dateB - dateA;
            });
            
            
            // Store all certs separately so year filter can always work from full list
            const model = new JSONModel({
                certifications: certifications,
                allCertifications: certifications,
                selectedYear: "all"
            });
            this.getView()?.setModel(model, "certifications");
        } catch (error) {
            console.error("Error loading certifications:", error);
            this.getView()?.setModel(new JSONModel({ certifications: [], allCertifications: [], selectedYear: "all" }), "certifications");
        }
    }

    // ============ FORMATTERS ============

    public formatProficiencyState(proficiency: string): string {
        switch (proficiency) {
            case "Expert":
            case "Advanced":
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

    public formatCertificationState(certification: string): string {
        switch (certification) {
            case "Certified":
                return "Success";
            case "In Progress":
                return "Warning";
            case "None":
                return "None";
            default:
                return "None";
        }
    }

    public formatUtilizationPercent(utilizationPercent: number): string {
        if (!utilizationPercent || utilizationPercent === 0) {
            return "0%";
        }
        
        return `${utilizationPercent}%`;
    }

    public formatAssignmentStatusState(status: string): string {
        const normalized = this.formatAssignmentStatusLabel(status);
        if (normalized === "Completed") return "Information";
        if (normalized === "Assigned" || normalized === "Self-Assigned") return "Success";
        return "None";
    }

    public formatAssignmentStatusLabel(status: string): string {
        if (!status) return "Assigned";
        if (status === "Pending" || status === "Accepted" || status === "Rejected") {
            return "Assigned";
        }
        return status;
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

            // Initialize skill catalog model with all available skills
            const skillCatalogModel = new JSONModel({
                skills: [] // Will be populated when category is selected
            });
            this.getView()?.setModel(skillCatalogModel, "skillCatalog");

            this.addSkillDialog.open();
        } catch (error) {
            console.error('Error opening add skill dialog:', error);
            MessageToast.show("Error opening add skill dialog");
        }
    }

    public async onSaveSkill(): Promise<void> {
        try {
            
            const employeeId = this.currentEmployeeId;

            if (!employeeId) {
                MessageToast.show("Employee ID not found");
                return;
            }

            // Get form data from the newSkill model
            const newSkillModel = this.getView()?.getModel("newSkill") as JSONModel;
            const formData = newSkillModel?.getData();
            

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
                employeeId,
                skillName: formData.skillName,
                category: formData.category,
                proficiencyLevel: formData.proficiency,
                yearsExperience: parseInt(formData.yearsExperience) || 0,
                certificationStatus: formData.certificationStatus || "None"
            };

            
            // Use OData to create skill
            try {
                const oDataModel = this.getOwnerComponent()?.getModel() as any;
                const listBinding = oDataModel.bindList("/Skills");
                
                
                // Create the skill - this adds it to the batch
                const context = listBinding.create(skillData);
                
                
                // Submit all pending changes
                const submitResult = await oDataModel.submitBatch(oDataModel.getUpdateGroupId());
                
                // Wait for backend to process
                await new Promise(resolve => setTimeout(resolve, 800));
                
                // Reload skills to get the updated list
                await this.loadSkills(this.currentEmployeeId!);
                
                MessageToast.show("Skill added successfully");
                this.onCloseAddSkillDialog();
            } catch (error) {
                console.error('❌ Error adding skill:', error);
                console.error('❌ Error stack:', (error as any).stack);
                MessageToast.show("Error adding skill. Check console for details.");
            }
            
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
        }
    }

    public onSkillCategoryChange(event: Event): void {
        const select = event.getSource() as any;
        const selectedCategory = select.getSelectedKey();
        
        
        // Define SAP skill catalog by category
        const sapSkillCatalog: { [key: string]: string[] } = {
            "Frontend": [
                "SAPUI5", "Fiori Elements", "SAP Fiori", "JavaScript", "TypeScript", 
                "React", "Angular", "Vue.js", "HTML5", "CSS3", "SCSS"
            ],
            "Backend": [
                "ABAP", "ABAP OO", "Java", "Node.js", "Python", "C#", ".NET", 
                "Spring Boot", "Express.js", "CAP (Cloud Application Programming)"
            ],
            "FullStack": [
                "SAP CAP", "MEAN Stack", "MERN Stack", "Full Stack JavaScript", 
                "SAP BTP Full Stack", "Microservices Architecture"
            ],
            "Database": [
                "SAP HANA", "HANA Cloud", "SQL", "HANA SQL", "HANA XS Advanced", 
                "PostgreSQL", "MongoDB", "SQLScript", "CDS (Core Data Services)"
            ],
            "Cloud": [
                "SAP BTP (Business Technology Platform)", "Cloud Foundry", "Kyma Runtime", 
                "AWS", "Azure", "Google Cloud Platform", "SAP HANA Cloud", 
                "Cloud Native Development", "Kubernetes", "Docker"
            ],
            "Integration": [
                "SAP PI/PO (Process Integration)", "SAP CPI (Cloud Platform Integration)", 
                "SAP Integration Suite", "REST API", "SOAP", "OData", "GraphQL", 
                "API Management", "Event-Driven Architecture", "Message Queuing"
            ],
            "Analytics": [
                "SAP Analytics Cloud (SAC)", "SAP BusinessObjects", "Power BI", 
                "Tableau", "SAP BW/4HANA", "Data Warehouse", "SAP Datasphere", 
                "Embedded Analytics", "Predictive Analytics", "Machine Learning"
            ],
            "Mobile": [
                "SAP Mobile Services", "SAP Fiori for Mobile", "iOS Development", 
                "Android Development", "React Native", "Flutter", "Progressive Web Apps (PWA)"
            ],
            "DevOps": [
                "CI/CD", "Jenkins", "Git", "GitHub Actions", "SAP Cloud Transport Management", 
                "Continuous Testing", "Infrastructure as Code", "Terraform", "Ansible"
            ],
            "Testing": [
                "SAP Test Automation", "Selenium", "Jest", "Mocha", "Jasmine", 
                "QUnit", "Postman", "JMeter", "Test-Driven Development (TDD)"
            ],
            "Security": [
                "SAP Security", "OAuth", "SAML", "Identity & Access Management", 
                "SAP Cloud Identity Services", "Data Privacy & Protection", 
                "Penetration Testing", "Security Compliance"
            ],
            "Procurement": [
                "SAP Ariba", "Ariba Procurement", "Ariba Sourcing", "Ariba Contracts", 
                "Ariba Integration", "Supplier Management", "Procurement Analytics"
            ]
        };
        
        // Get skills for selected category
        const categorySkills = sapSkillCatalog[selectedCategory] || [];
        
        // Update skill catalog model
        const skillCatalogModel = this.getView()?.getModel("skillCatalog") as JSONModel;
        if (skillCatalogModel) {
            // Prepend "-- Select Skill --" option to the list
            const skillsWithPlaceholder = [
                { name: "" },  // Empty key for placeholder
                ...categorySkills.map(skillName => ({ name: skillName }))
            ];
            skillCatalogModel.setData({
                skills: skillsWithPlaceholder
            });
        }
        
        // Reset skill name selection
        const newSkillModel = this.getView()?.getModel("newSkill") as JSONModel;
        if (newSkillModel) {
            const data = newSkillModel.getData();
            data.skillName = ""; // Clear previous selection
            data.category = selectedCategory; // Update category
            newSkillModel.setData(data);
        }
    }

    public onEditSkillCategoryChange(event: Event): void {
        const select = event.getSource() as any;
        const selectedCategory = select.getSelectedKey();
        
        
        // Populate the catalog for edit dialog
        this.populateEditSkillCatalog(selectedCategory);
        
        // Update the editSkill model with selected category
        const editSkillModel = this.getView()?.getModel("editSkill") as JSONModel;
        if (editSkillModel) {
            const data = editSkillModel.getData();
            data.category = selectedCategory;
            data.skillName = ""; // Reset skill name when category changes
            editSkillModel.setData(data);
        }
    }

    private populateEditSkillCatalog(selectedCategory: string): void {
        // Define SAP skill catalog by category (same as in onSkillCategoryChange)
        const sapSkillCatalog: { [key: string]: string[] } = {
            "Frontend": [
                "SAPUI5", "Fiori Elements", "SAP Fiori", "JavaScript", "TypeScript", 
                "React", "Angular", "Vue.js", "HTML5", "CSS3", "SCSS"
            ],
            "Backend": [
                "ABAP", "ABAP OO", "Java", "Node.js", "Python", "C#", ".NET", 
                "Spring Boot", "Express.js", "CAP (Cloud Application Programming)"
            ],
            "FullStack": [
                "SAP CAP", "MEAN Stack", "MERN Stack", "Full Stack JavaScript", 
                "SAP BTP Full Stack", "Microservices Architecture"
            ],
            "Database": [
                "SAP HANA", "HANA Cloud", "SQL", "HANA SQL", "HANA XS Advanced", 
                "PostgreSQL", "MongoDB", "SQLScript", "CDS (Core Data Services)"
            ],
            "Cloud": [
                "SAP BTP (Business Technology Platform)", "Cloud Foundry", "Kyma Runtime", 
                "AWS", "Azure", "Google Cloud Platform", "SAP HANA Cloud", 
                "Cloud Native Development", "Kubernetes", "Docker"
            ],
            "Integration": [
                "SAP PI/PO (Process Integration)", "SAP CPI (Cloud Platform Integration)", 
                "SAP Integration Suite", "REST API", "SOAP", "OData", "GraphQL", 
                "API Management", "Event-Driven Architecture", "Message Queuing"
            ],
            "Analytics": [
                "SAP Analytics Cloud (SAC)", "SAP BusinessObjects", "Power BI", 
                "Tableau", "SAP BW/4HANA", "Data Warehouse", "SAP Datasphere", 
                "Embedded Analytics", "Predictive Analytics", "Machine Learning"
            ],
            "Mobile": [
                "SAP Mobile Services", "SAP Fiori for Mobile", "iOS Development", 
                "Android Development", "React Native", "Flutter", "Progressive Web Apps (PWA)"
            ],
            "DevOps": [
                "CI/CD", "Jenkins", "Git", "GitHub Actions", "SAP Cloud Transport Management", 
                "Continuous Testing", "Infrastructure as Code", "Terraform", "Ansible"
            ],
            "Testing": [
                "SAP Test Automation", "Selenium", "Jest", "Mocha", "Jasmine", 
                "QUnit", "Postman", "JMeter", "Test-Driven Development (TDD)"
            ],
            "Security": [
                "SAP Security", "OAuth", "SAML", "Identity & Access Management", 
                "SAP Cloud Identity Services", "Data Privacy & Protection", 
                "Penetration Testing", "Security Compliance"
            ],
            "Procurement": [
                "SAP Ariba", "Ariba Procurement", "Ariba Sourcing", "Ariba Contracts", 
                "Ariba Integration", "Supplier Management", "Procurement Analytics"
            ]
        };
        
        // Get skills for selected category
        const categorySkills = sapSkillCatalog[selectedCategory] || [];
        
        // Update edit skill catalog model
        const editSkillCatalogModel = this.getView()?.getModel("editSkillCatalog") as JSONModel;
        if (editSkillCatalogModel) {
            // Prepend "-- Select Skill --" option to the list
            const skillsWithPlaceholder = [
                { name: "" },  // Empty key for placeholder
                ...categorySkills.map(skillName => ({ name: skillName }))
            ];
            editSkillCatalogModel.setData({
                skills: skillsWithPlaceholder
            });
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
            
            // Initialize skill catalog model for edit dialog (will be populated when category is loaded)
            const editSkillCatalogModel = new JSONModel({
                skills: []
            });
            this.getView()?.setModel(editSkillCatalogModel, "editSkillCatalog");
            
            // Destroy existing dialog to prevent duplicate IDs
            if (this.editSkillDialog) {
                this.editSkillDialog.destroy();
                this.editSkillDialog = undefined;
            }
            
            // Create new dialog WITHOUT id parameter to avoid duplicate ID issues
            this.editSkillDialog = await Fragment.load({
                name: "skillsphere.view.dialogs.EditSkillDialog",
                controller: this
            }) as Dialog;
            this.getView()?.addDependent(this.editSkillDialog);
            
            // Populate the skill catalog based on the current category
            if (editData.category) {
                this.populateEditSkillCatalog(editData.category);
            }
            
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
            
            
            // Use OData to delete skill
            try {
                const oDataModel = this.getOwnerComponent()?.getModel() as any;
                const listBinding = oDataModel.bindList("/Skills");
                listBinding.filter([new Filter("skillId", FilterOperator.EQ, skillId)]);
                
                const contexts = await listBinding.requestContexts(0, 1);
                if (contexts.length > 0) {
                    contexts[0].delete();
                    
                    // Submit batch with proper update group
                    await oDataModel.submitBatch(oDataModel.getUpdateGroupId());
                    
                    // Wait for backend
                    await new Promise(resolve => setTimeout(resolve, 300));
                    
                    // Force refresh
                    listBinding.refresh();
                    
                    // Reload skills
                    await this.loadSkills(this.currentEmployeeId!);
                    
                    MessageToast.show("Skill deleted successfully");
                } else {
                    MessageToast.show("Skill not found");
                }
            } catch (error) {
                console.error('❌ Error deleting skill:', error);
                MessageToast.show("Error deleting skill");
            }
        } catch (error: any) {
            console.error('Error in delete operation:', error);
        }
    }

    public async onSaveEditedSkill(): Promise<void> {
        try {
            const editSkillModel = this.getView()?.getModel("editSkill") as JSONModel;
            const skillData = editSkillModel.getData();
            
            
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
            
            // Use OData to update skill
            const skillId = normalizedData.skillId || normalizedData.id;
            
            try {
                const oDataModel = this.getOwnerComponent()?.getModel() as any;
                const listBinding = oDataModel.bindList("/Skills");
                listBinding.filter([new Filter("skillId", FilterOperator.EQ, skillId)]);
                
                const contexts = await listBinding.requestContexts(0, 1);
                if (contexts.length > 0) {
                    const context = contexts[0];
                    // Update properties
                    context.setProperty("skillName", normalizedData.skillName);
                    context.setProperty("category", normalizedData.category);
                    context.setProperty("proficiencyLevel", normalizedData.proficiencyLevel);
                    context.setProperty("yearsExperience", normalizedData.yearsExperience);
                    context.setProperty("certificationStatus", normalizedData.certificationStatus);
                    
                    
                    // Submit changes with proper update group
                    await oDataModel.submitBatch(oDataModel.getUpdateGroupId());
                    
                    // Wait for backend
                    await new Promise(resolve => setTimeout(resolve, 300));
                    
                    // Refresh binding
                    listBinding.refresh();
                    
                    // Reload skills
                    await this.loadSkills(this.currentEmployeeId!);
                    
                    MessageToast.show("Skill updated successfully");
                    this.editSkillDialog?.close();
                } else {
                    MessageToast.show("Skill not found");
                }
            } catch (error) {
                console.error('❌ Error updating skill:', error);
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
                description: "",
                projectManager: "",
                accountExecutiveManager: "",
                lineManagerPOC: "",
                projectOrchestrator: ""
            });
            this.getView()?.setModel(newProjectModel, "newProject");
            
            // Load add project dialog WITHOUT id to avoid duplicate IDs
            this.addProjectDialog = await Fragment.load({
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
            
            const employeeId = this.currentEmployeeId;
            
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
            
            // Helper function to convert date from M/D/YY or MM/DD/YYYY to YYYY-MM-DD
            const convertToISODate = (dateString: string): string | null => {
                if (!dateString) return null;
                
                try {
                    // Parse the date string
                    const date = new Date(dateString);
                    
                    // Check if date is valid
                    if (isNaN(date.getTime())) {
                        return null;
                    }
                    
                    // Convert to YYYY-MM-DD format
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    
                    return `${year}-${month}-${day}`;
                } catch (error) {
                    console.error('Error converting date:', dateString, error);
                    return null;
                }
            };
            
            // Helper function to calculate duration between two dates
            const calculateDuration = (startDate: string | null, endDate: string | null): string | null => {
                if (!startDate || !endDate) return null;
                
                try {
                    const start = new Date(startDate);
                    const end = new Date(endDate);
                    
                    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                        return null;
                    }
                    
                    // Calculate difference in milliseconds
                    const diffTime = Math.abs(end.getTime() - start.getTime());
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    
                    // Convert to months and days
                    if (diffDays < 30) {
                        return `${diffDays} days`;
                    } else if (diffDays < 365) {
                        const months = Math.floor(diffDays / 30);
                        const remainingDays = diffDays % 30;
                        if (remainingDays === 0) {
                            return `${months} ${months === 1 ? 'month' : 'months'}`;
                        } else {
                            return `${months} ${months === 1 ? 'month' : 'months'} ${remainingDays} days`;
                        }
                    } else {
                        const years = Math.floor(diffDays / 365);
                        const months = Math.floor((diffDays % 365) / 30);
                        if (months === 0) {
                            return `${years} ${years === 1 ? 'year' : 'years'}`;
                        } else {
                            return `${years} ${years === 1 ? 'year' : 'years'} ${months} ${months === 1 ? 'month' : 'months'}`;
                        }
                    }
                } catch (error) {
                    console.error('Error calculating duration:', error);
                    return null;
                }
            };
            
            const startDateISO = convertToISODate(projectData.startDate);
            const endDateISO = convertToISODate(projectData.endDate);
            const calculatedDuration = calculateDuration(startDateISO, endDateISO);
            
            const newProject = {
                employeeId: employeeId,
                projectName: projectData.projectName,
                role: projectData.role,
                startDate: startDateISO,
                endDate: endDateISO,
                status: projectData.status || "Active",
                description: projectData.description || null,
                duration: calculatedDuration,
                projectManager: projectData.projectManager || null,
                accountExecutiveManager: projectData.accountExecutiveManager || null,
                lineManagerPOC: projectData.lineManagerPOC || null,
                projectOrchestrator: projectData.projectOrchestrator || null
            };
            
            
            // Use OData to create project
            try {
                const oDataModel = this.getOwnerComponent()?.getModel() as any;
                const listBinding = oDataModel.bindList("/Projects");
                
                
                // Create the project - this adds it to the batch
                const context = listBinding.create(newProject);
                
                
                // Submit all pending changes
                const submitResult = await oDataModel.submitBatch(oDataModel.getUpdateGroupId());
                await context.created();
                
                // Wait for backend
                await new Promise(resolve => setTimeout(resolve, 800));
                
                // Reload projects
                await this.loadProjects(this.currentEmployeeId!);
                
                MessageToast.show("Project added successfully");
            } catch (error: any) {
                console.error('❌ Error creating project:', error);
                console.error('❌ Error message:', error.message);
                console.error('❌ Error details:', JSON.stringify(error, null, 2));
                console.error('❌ Error stack:', error.stack);
                
                // Try to get more details from the error
                if (error.error) {
                    console.error('❌ Inner error:', JSON.stringify(error.error, null, 2));
                }
                if (error.responseText) {
                    console.error('❌ Response text:', error.responseText);
                }
                
                MessageToast.show("Error adding project. Check console for details.");
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
                description: "",
                projectManager: "",
                accountExecutiveManager: "",
                lineManagerPOC: "",
                projectOrchestrator: ""
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
            
            // Create new dialog WITHOUT id to avoid duplicate IDs
            this.editProjectDialog = await Fragment.load({
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
            
            
            // Use OData to delete project
            try {
                const oDataModel = this.getOwnerComponent()?.getModel() as any;
                const listBinding = oDataModel.bindList("/Projects");
                listBinding.filter([new Filter("projectId", FilterOperator.EQ, projectId)]);
                
                const contexts = await listBinding.requestContexts(0, 1);
                if (contexts.length > 0) {
                    contexts[0].delete();
                    
                    // Submit batch with proper update group
                    await oDataModel.submitBatch(oDataModel.getUpdateGroupId());
                    
                    // Wait for backend
                    await new Promise(resolve => setTimeout(resolve, 300));
                    
                    // Force refresh
                    listBinding.refresh();
                    
                    // Reload projects
                    await this.loadProjects(this.currentEmployeeId!);
                    
                    MessageToast.show("Project deleted successfully");
                } else {
                    console.error('❌ Project not found with ID:', projectId);
                    MessageToast.show("Project not found");
                }
            } catch (error: any) {
                console.error('❌ Error deleting project:', error);
                console.error('❌ Error message:', error.message);
                console.error('❌ Error stack:', error.stack);
                MessageToast.show("Error deleting project. Check console for details.");
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
            
            
            // Validate required fields
            if (!projectData.projectName || !projectData.role) {
                MessageToast.show("Please fill in all required fields");
                return;
            }
            
            // Helper function to convert date from M/D/YY or MM/DD/YYYY to YYYY-MM-DD
            const convertToISODate = (dateString: string): string | null => {
                if (!dateString) return null;
                
                try {
                    const date = new Date(dateString);
                    if (isNaN(date.getTime())) {
                        return null;
                    }
                    
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    
                    return `${year}-${month}-${day}`;
                } catch (error) {
                    console.error('Error converting date:', dateString, error);
                    return null;
                }
            };
            
            // Helper function to calculate duration between two dates
            const calculateDuration = (startDate: string | null, endDate: string | null): string | null => {
                if (!startDate || !endDate) return null;
                
                try {
                    const start = new Date(startDate);
                    const end = new Date(endDate);
                    
                    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                        return null;
                    }
                    
                    const diffTime = Math.abs(end.getTime() - start.getTime());
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    
                    if (diffDays < 30) {
                        return `${diffDays} days`;
                    } else if (diffDays < 365) {
                        const months = Math.floor(diffDays / 30);
                        const remainingDays = diffDays % 30;
                        if (remainingDays === 0) {
                            return `${months} ${months === 1 ? 'month' : 'months'}`;
                        } else {
                            return `${months} ${months === 1 ? 'month' : 'months'} ${remainingDays} days`;
                        }
                    } else {
                        const years = Math.floor(diffDays / 365);
                        const months = Math.floor((diffDays % 365) / 30);
                        if (months === 0) {
                            return `${years} ${years === 1 ? 'year' : 'years'}`;
                        } else {
                            return `${years} ${years === 1 ? 'year' : 'years'} ${months} ${months === 1 ? 'month' : 'months'}`;
                        }
                    }
                } catch (error) {
                    console.error('Error calculating duration:', error);
                    return null;
                }
            };
            
            // Convert dates and calculate duration
            const startDateISO = convertToISODate(projectData.startDate);
            const endDateISO = convertToISODate(projectData.endDate);
            const calculatedDuration = calculateDuration(startDateISO, endDateISO);
            
            // Use OData to update project
            const projectId = projectData.projectId || projectData.id;
            
            try {
                const oDataModel = this.getOwnerComponent()?.getModel() as any;
                const listBinding = oDataModel.bindList("/Projects");
                listBinding.filter([new Filter("projectId", FilterOperator.EQ, projectId)]);
                
                const contexts = await listBinding.requestContexts(0, 1);
                if (contexts.length > 0) {
                    const context = contexts[0];
                    // Update properties
                    context.setProperty("projectName", projectData.projectName);
                    context.setProperty("role", projectData.role);
                    context.setProperty("startDate", startDateISO);
                    context.setProperty("endDate", endDateISO);
                    context.setProperty("status", projectData.status);
                    context.setProperty("description", projectData.description);
                    context.setProperty("duration", calculatedDuration);
                    context.setProperty("projectManager", projectData.projectManager);
                    context.setProperty("accountExecutiveManager", projectData.accountExecutiveManager);
                    context.setProperty("lineManagerPOC", projectData.lineManagerPOC);
                    context.setProperty("projectOrchestrator", projectData.projectOrchestrator);
                    
                    
                    // Submit changes with proper update group
                    await oDataModel.submitBatch(oDataModel.getUpdateGroupId());
                    
                    // Wait for backend
                    await new Promise(resolve => setTimeout(resolve, 300));
                    
                    // Refresh binding
                    listBinding.refresh();
                    
                    // Reload projects
                    await this.loadProjects(this.currentEmployeeId!);
                    
                    MessageToast.show("Project updated successfully");
                    this.editProjectDialog?.close();
                } else {
                    MessageToast.show("Project not found");
                }
            } catch (error) {
                console.error('❌ Error updating project:', error);
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
    public onEditProfile(): void {
        const selfProfileModel = this.getView()?.getModel("selfProfile") as JSONModel;
        this.selfProfileSnapshot = JSON.parse(JSON.stringify(selfProfileModel?.getData() || {}));
        
        const employeeId = String(this.currentEmployeeId || selfProfileModel?.getProperty("/employeeId") || "");
        if (employeeId) {
            // Refresh manager list each time edit mode opens so the latest options are visible.
            this.loadManagerOptions(employeeId);
        }

        const profileUiModel = this.getView()?.getModel("profileUi") as JSONModel;
        profileUiModel?.setProperty("/isEditing", true);
    }

    public onCancelProfileEdit(): void {
        const selfProfileModel = this.getView()?.getModel("selfProfile") as JSONModel;
        if (selfProfileModel && this.selfProfileSnapshot) {
            selfProfileModel.setData(JSON.parse(JSON.stringify(this.selfProfileSnapshot)));
        }

        const profileUiModel = this.getView()?.getModel("profileUi") as JSONModel;
        profileUiModel?.setProperty("/isEditing", false);
    }

    public async onSaveProfile(): Promise<void> {
        try {
            const employeeId = this.currentEmployeeId;
            
            if (!employeeId) {
                console.error("Employee ID not found in controller");
                MessageToast.show("Employee ID not found");
                return;
            }
            

            const selfProfileModel = this.getView()?.getModel("selfProfile") as JSONModel;
            const profileData = selfProfileModel?.getData();
            const managerSelect = this.byId("employeeReportingManagerSelect") as any;
            const selectedManagerId = String(
                managerSelect?.getSelectedKey?.() || profileData?.managerId || ""
            ).trim();

            if (profileData) {
                profileData.managerId = selectedManagerId;
            }

            if (!profileData?.name?.trim()) {
                MessageToast.show("Please enter your name");
                return;
            }
            
            if (!profileData?.email || !this.isValidEmail(profileData.email)) {
                MessageToast.show("Please enter a valid email address");
                return;
            }
            
            if (!profileData?.team?.trim()) {
                MessageToast.show("Please enter your team");
                return;
            }
            
            if (!profileData?.subTeam?.trim()) {
                MessageToast.show("Please enter your sub-team");
                return;
            }
            
            if (!selectedManagerId) {
                MessageToast.show("Please enter your reporting manager ID");
                return;
            }

            if (!profileData?.professionalRole?.trim()) {
                MessageToast.show("Please enter your professional role");
                return;
            }

            if (!profileData?.location?.trim()) {
                MessageToast.show("Please enter your location");
                return;
            }

            if (!profileData?.tLevel) {
                MessageToast.show("Please select your T Level");
                return;
            }

            if (!profileData?.gradeLevel) {
                MessageToast.show("Please select your Grade Level");
                return;
            }

            if (!profileData?.specialization?.trim()) {
                MessageToast.show("Please enter your specialization");
                return;
            }

            try {
                const oDataModel = this.getOwnerComponent()?.getModel() as any;
                const lastUpdated = new Date().toISOString();
                
                const employeeBinding = oDataModel.bindList("/Employees");
                employeeBinding.filter([new Filter("employeeId", FilterOperator.EQ, employeeId)]);
                const employeeContexts = await employeeBinding.requestContexts(0, 1);

                if (employeeContexts.length === 0) {
                    MessageToast.show("Employee record not found");
                    return;
                }

                const employeeContext = employeeContexts[0];
                employeeContext.setProperty("name", profileData.name.trim());
                employeeContext.setProperty("email", profileData.email.trim());
                employeeContext.setProperty("team", profileData.team.trim());
                employeeContext.setProperty("subTeam", profileData.subTeam.trim());
                employeeContext.setProperty("managerId", selectedManagerId);
                employeeContext.setProperty("experience", Number(profileData.experience || 0));
                employeeContext.setProperty("location", profileData.location.trim());
                employeeContext.setProperty("tLevel", profileData.tLevel);
                employeeContext.setProperty("gradeLevel", profileData.gradeLevel);
                
                const profileBinding = oDataModel.bindList("/Profiles");
                profileBinding.filter([new Filter("employeeId", FilterOperator.EQ, employeeId)]);
                
                const profileContexts = await profileBinding.requestContexts(0, 1);
                
                if (profileContexts.length > 0) {
                    const context = profileContexts[0];
                    
                    context.setProperty("role", profileData.professionalRole.trim());
                    context.setProperty("location", profileData.location.trim());
                    context.setProperty("tLevel", profileData.tLevel);
                    context.setProperty("gradeLevel", profileData.gradeLevel);
                    context.setProperty("specialization", profileData.specialization.trim());
                    context.setProperty("lastUpdated", lastUpdated);
                    
                } else {
                    const newProfile = {
                        employeeId: employeeId,
                        role: profileData.professionalRole.trim(),
                        location: profileData.location.trim(),
                        tLevel: profileData.tLevel,
                        gradeLevel: profileData.gradeLevel,
                        specialization: profileData.specialization.trim(),
                        lastUpdated: lastUpdated
                    };
                    
                    profileBinding.create(newProfile);
                }
                
                const result = await oDataModel.submitBatch(oDataModel.getUpdateGroupId());

                profileBinding.refresh();
                employeeBinding.refresh();

                const managerName = await this.getManagerNameById(selectedManagerId);
                const currentUserModel = this.getOwnerComponent()?.getModel("currentUser") as JSONModel;
                currentUserModel?.setData({
                    ...(currentUserModel?.getData() || {}),
                    id: employeeId,
                    employeeId: employeeId,
                    name: profileData.name.trim(),
                    email: profileData.email.trim(),
                    team: profileData.team.trim(),
                    subTeam: profileData.subTeam.trim(),
                    location: profileData.location.trim(),
                    tLevel: profileData.tLevel,
                    gradeLevel: profileData.gradeLevel,
                    experience: Number(profileData.experience || 0),
                    managerId: selectedManagerId,
                    manager: managerName,
                    isLoggedIn: true
                });

                await this.loadEmployeeData(employeeId);

                const profileUiModel = this.getView()?.getModel("profileUi") as JSONModel;
                profileUiModel?.setProperty("/isEditing", false);
                this.selfProfileSnapshot = null;
                
                MessageToast.show("Profile updated successfully!");
            } catch (error) {
                console.error('❌ Error updating profile:', error);
                MessageToast.show("Error saving profile");
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

    private formatDate(date: any): string {
        if (!date) {
            return "";
        }
        
        // If already a string in good format (contains /), return it
        if (typeof date === 'string' && date.includes('/')) {
            return date;
        }
        
        // If already a string in ISO format (YYYY-MM-DD)
        if (typeof date === 'string' && date.includes('-')) {
            try {
                const parts = date.split('T')[0].split('-');
                const formatted = `${parts[1]}/${parts[2]}/${parts[0]}`;
                return formatted;
            } catch (error) {
                console.error('formatDate: error parsing ISO string:', error);
                return date;
            }
        }
        
        // If it's a Date object or timestamp
        try {
            const dateObj = new Date(date);
            if (isNaN(dateObj.getTime())) {
                return "";
            }
            // Return in format: MM/DD/YYYY
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const day = String(dateObj.getDate()).padStart(2, '0');
            const year = dateObj.getFullYear();
            const formatted = `${month}/${day}/${year}`;
            return formatted;
        } catch (error) {
            console.error('formatDate: Error formatting date:', error);
            return "";
        }
    }

    private async loadEmployeeProfile(employeeId: string): Promise<void> {
        try {
            
            // Initialize profile model with default values
            const defaultProfile = {
                role: "",
                location: "",
                tLevel: "",
                specialization: "",
                working_on_project: false,
                project_start_date: null,
                project_end_date: null
            };

            // Load profile from OData - already loaded by loadProfile method in onInit
            // Just ensure the model is set
            
            // Set the profile model if not already set
            if (!this.getView()?.getModel("profile")) {
                const profileModel = new JSONModel(defaultProfile);
                this.getView()?.setModel(profileModel, "profile");
            }
        } catch (error: any) {
            console.error('❌ Error loading employee profile:', error);
            // Still set default profile on error
            const profileModel = new JSONModel({
                role: "",
                location: "",
                tLevel: "",
                specialization: ""
            });
            this.getView()?.setModel(profileModel, "profile");
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

    private showManagerOnlyAssignmentMessage(): void {
        MessageToast.show("Work assignments can only be created by your manager.");
    }

    // ==================== Current Project Utilization Methods ====================
    
    public async onMarkCurrentProject(): Promise<void> {
        this.showManagerOnlyAssignmentMessage();
        return;

        if (!this.currentProjectDialog) {
            this.currentProjectDialog = await Fragment.load({
                id: this.getView()?.getId(),
                name: "skillsphere.view.dialogs.CurrentProjectDialog",
                controller: this
            }) as Dialog;
            this.getView()?.addDependent(this.currentProjectDialog!);
        }

        // Load projects list from existing Projects entity
        await this.loadProjectsListForDropdown();
        
        // Load managers list
        await this.loadManagersListForDropdown();

        // Initialize dialog model with empty data
        const dialogModel = new JSONModel({
            projectName: "",
            role: "",
            projectManager: "",
            startDate: null,
            endDate: null,
            utilizationPercent: 100
        });
        this.getView()?.setModel(dialogModel, "currentProjectDialog");
        
        this.currentProjectDialog!.open();
    }

    private async loadProjectsListForDropdown(): Promise<void> {
        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            const projectsBinding = oDataModel.bindList("/Projects");
            
            const contexts = await projectsBinding.requestContexts(0, 1000);
            const allProjects = contexts.map((ctx: any) => ctx.getObject());
            
            // Store full project objects including project manager info
            const projectsModel = new JSONModel({ projects: allProjects });
            this.getView()?.setModel(projectsModel, "projectsList");
            
        } catch (error) {
            console.error("Error loading projects from master data:", error);
            this.getView()?.setModel(new JSONModel({ projects: [] }), "projectsList");
        }
    }

    private async loadManagersListForDropdown(): Promise<void> {
        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            const managersBinding = oDataModel.bindList("/Employees");
            managersBinding.filter([new Filter("role", FilterOperator.EQ, "Manager")]);
            
            const contexts = await managersBinding.requestContexts(0, 1000);
            const managers = contexts.map((ctx: any) => ctx.getObject())
                .map((m: any) => ({ name: m.name }));
            
            const managersModel = new JSONModel({ managers });
            this.getView()?.setModel(managersModel, "managersList");
            
        } catch (error) {
            console.error("Error loading managers list:", error);
            this.getView()?.setModel(new JSONModel({ managers: [] }), "managersList");
        }
    }

    public onProjectSelected(event: Event): void {
        const comboBox = event.getSource() as any;
        const selectedKey = comboBox.getSelectedKey();
        
        if (!selectedKey) return;
        
        // Find the selected project from master data
        const projectsModel = this.getView()?.getModel("projectsList") as JSONModel;
        const projects = projectsModel?.getProperty("/projects") || [];
        const selectedProject = projects.find((p: any) => p.projectName === selectedKey);
        
        if (selectedProject) {
            // Auto-populate Project Manager and other fields from master data
            const dialogModel = this.getView()?.getModel("currentProjectDialog") as JSONModel;
            dialogModel?.setProperty("/projectManager", selectedProject.projectManager || "");
            dialogModel?.setProperty("/startDate", selectedProject.startDate || null);
            dialogModel?.setProperty("/endDate", selectedProject.endDate || null);
            
        }
    }

    public async onSaveCurrentProject(): Promise<void> {
        const dialogModel = this.getView()?.getModel("currentProjectDialog") as JSONModel;
        const data = dialogModel.getData();
        const employeeId = this.currentEmployeeId;

        if (!data?.currentProjectId) {
            this.showManagerOnlyAssignmentMessage();
            this.currentProjectDialog?.close();
            return;
        }

        // Validation
        if (!data.projectName || !data.role || !data.projectManager || !data.startDate || !data.endDate || !data.utilizationPercent || data.utilizationPercent <= 0) {
            MessageToast.show("Please fill all required fields including Role");
            return;
        }

        // Helper function to convert date
        const convertToISODate = (dateString: string): string | null => {
            if (!dateString) return null;
            try {
                const date = new Date(dateString);
                if (isNaN(date.getTime())) return null;
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            } catch (error) {
                console.error('Error converting date:', dateString, error);
                return null;
            }
        };

        const startDateISO = convertToISODate(data.startDate);
        const endDateISO = convertToISODate(data.endDate);

        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            
            if (data.currentProjectId) {
                // Update existing record
                const listBinding = oDataModel.bindList("/CurrentProjects");
                listBinding.filter([new Filter("currentProjectId", FilterOperator.EQ, data.currentProjectId)]);
                
                const contexts = await listBinding.requestContexts(0, 1);
                if (contexts.length > 0) {
                    const context = contexts[0];
                    context.setProperty("projectName", data.projectName);
                    context.setProperty("role", data.role);
                    context.setProperty("projectManager", data.projectManager);
                    context.setProperty("startDate", startDateISO);
                    context.setProperty("endDate", endDateISO);
                    context.setProperty("utilizationPercent", parseInt(data.utilizationPercent));
                    context.setProperty("lastUpdated", new Date().toISOString());
                    
                    await oDataModel.submitBatch(oDataModel.getUpdateGroupId());
                    await new Promise(resolve => setTimeout(resolve, 300));
                    listBinding.refresh();
                    
                    MessageToast.show("Current project utilization updated successfully");
                }
            } else {
                // Add new record
                const listBinding = oDataModel.bindList("/CurrentProjects");
                const newData = {
                    employeeId: employeeId,
                    projectName: data.projectName,
                    role: data.role,
                    projectManager: data.projectManager,
                    startDate: startDateISO,
                    endDate: endDateISO,
                    utilizationPercent: parseInt(data.utilizationPercent),
                    createdAt: new Date().toISOString(),
                    lastUpdated: new Date().toISOString()
                };
                
                listBinding.create(newData);
                await oDataModel.submitBatch(oDataModel.getUpdateGroupId());
                await new Promise(resolve => setTimeout(resolve, 800));
                
                MessageToast.show("Current project utilization marked successfully");
            }
            
            this.currentProjectDialog?.close();
            if (employeeId) {
                await this.loadCurrentProjects(employeeId);
            }
        } catch (error) {
            console.error("❌ Error saving current project:", error);
            MessageToast.show("Error saving current project utilization");
        }
    }

    public onCloseCurrentProjectDialog(): void {
        this.currentProjectDialog?.close();
    }

    public async onEditCurrentProject(event: Event): Promise<void> {
        const source = event.getSource() as any;
        const bindingContext = source.getBindingContext("currentProjects");
        const currentProject = bindingContext?.getObject();

        if (!this.currentProjectDialog) {
            this.currentProjectDialog = await Fragment.load({
                id: this.getView()?.getId(),
                name: "skillsphere.view.dialogs.CurrentProjectDialog",
                controller: this
            }) as Dialog;
            this.getView()?.addDependent(this.currentProjectDialog);
        }

        // Load projects and managers for dropdowns
        await this.loadProjectsListForDropdown();
        await this.loadManagersListForDropdown();

        const dialogModel = new JSONModel(currentProject);
        this.getView()?.setModel(dialogModel, "currentProjectDialog");
        
        this.currentProjectDialog.open();
    }

    public async onDeleteCurrentProject(event: Event): Promise<void> {
        const source = event.getSource() as any;
        const bindingContext = source.getBindingContext("currentProjects");
        const currentProject = bindingContext?.getObject();

        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;

            if (currentProject._source === "CurrentInitiatives") {
                const listBinding = oDataModel.bindList("/CurrentInitiatives");
                listBinding.filter([new Filter("currentInitiativeId", FilterOperator.EQ, currentProject._initiativeId)]);
                const contexts = await listBinding.requestContexts(0, 1);
                if (contexts.length > 0) {
                    contexts[0].delete();
                    await oDataModel.submitBatch(oDataModel.getUpdateGroupId());
                    await new Promise(resolve => setTimeout(resolve, 300));
                    listBinding.refresh();
                }
            } else if (currentProject._source === "CurrentEvaluations") {
                const listBinding = oDataModel.bindList("/CurrentEvaluations");
                listBinding.filter([new Filter("currentEvaluationId", FilterOperator.EQ, currentProject._initiativeId)]);
                const contexts = await listBinding.requestContexts(0, 1);
                if (contexts.length > 0) {
                    contexts[0].delete();
                    await oDataModel.submitBatch(oDataModel.getUpdateGroupId());
                    await new Promise(resolve => setTimeout(resolve, 300));
                    listBinding.refresh();
                }
            } else {
                // Delete from CurrentProjects entity
                const listBinding = oDataModel.bindList("/CurrentProjects");
                listBinding.filter([new Filter("currentProjectId", FilterOperator.EQ, currentProject.currentProjectId)]);
                const contexts = await listBinding.requestContexts(0, 1);
                if (contexts.length > 0) {
                    contexts[0].delete();
                    await oDataModel.submitBatch(oDataModel.getUpdateGroupId());
                    await new Promise(resolve => setTimeout(resolve, 300));
                    listBinding.refresh();
                }
            }

            MessageToast.show("Work item deleted successfully");
            const employeeId = this.currentEmployeeId;
            if (employeeId) {
                await this.loadCurrentProjects(employeeId);
            }
        } catch (error) {
            console.error("❌ Error deleting work item:", error);
            MessageToast.show("Error deleting work item");
        }
    }

    /**
     * Mark a work assignment as Completed - moves it to Completed Projects
     */
    public async onCompleteWork(event: Event): Promise<void> {
        const source = event.getSource() as any;
        const bindingContext = source.getBindingContext("currentProjects");
        const currentProject = bindingContext?.getObject();

        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;

            if (currentProject._source === "CurrentInitiatives") {
                const listBinding = oDataModel.bindList("/CurrentInitiatives");
                listBinding.filter([new Filter("currentInitiativeId", FilterOperator.EQ, currentProject._initiativeId)]);
                const contexts = await listBinding.requestContexts(0, 1);
                if (contexts.length > 0) {
                    contexts[0].setProperty("status", "Completed");
                    contexts[0].setProperty("lastUpdated", new Date().toISOString());
                    await oDataModel.submitBatch(oDataModel.getUpdateGroupId());
                    await new Promise(resolve => setTimeout(resolve, 300));
                    listBinding.refresh();
                }
            } else if (currentProject._source === "CurrentEvaluations") {
                const listBinding = oDataModel.bindList("/CurrentEvaluations");
                listBinding.filter([new Filter("currentEvaluationId", FilterOperator.EQ, currentProject._initiativeId)]);
                const contexts = await listBinding.requestContexts(0, 1);
                if (contexts.length > 0) {
                    contexts[0].setProperty("status", "Completed");
                    contexts[0].setProperty("lastUpdated", new Date().toISOString());
                    await oDataModel.submitBatch(oDataModel.getUpdateGroupId());
                    await new Promise(resolve => setTimeout(resolve, 300));
                    listBinding.refresh();
                }
            } else {
                // Complete in CurrentProjects entity
                const listBinding = oDataModel.bindList("/CurrentProjects");
                listBinding.filter([new Filter("currentProjectId", FilterOperator.EQ, currentProject.currentProjectId)]);
                const contexts = await listBinding.requestContexts(0, 1);
                if (contexts.length > 0) {
                    contexts[0].setProperty("assignmentStatus", "Completed");
                    contexts[0].setProperty("lastUpdated", new Date().toISOString());
                    await oDataModel.submitBatch(oDataModel.getUpdateGroupId());
                    await new Promise(resolve => setTimeout(resolve, 300));
                    listBinding.refresh();
                }
            }

            MessageToast.show("Work marked as completed");
            const employeeId = this.currentEmployeeId;
            if (employeeId) {
                await this.loadCurrentProjects(employeeId);
                await this.loadProjects(employeeId);
            }
        } catch (error) {
            console.error("❌ Error completing work:", error);
            MessageToast.show("Error marking work as completed");
        }
    }

    // ==================== UNIFIED WORK MANAGEMENT ====================
    
    private unifiedWorkDialog?: Dialog;

    public async onOpenUnifiedWork(): Promise<void> {
        this.showManagerOnlyAssignmentMessage();
        return;

        if (!this.unifiedWorkDialog) {
            this.unifiedWorkDialog = await Fragment.load({
                id: this.getView()?.getId(),
                name: "skillsphere.view.dialogs.UnifiedWorkDialog",
                controller: this
            }) as Dialog;
            this.getView()?.addDependent(this.unifiedWorkDialog!);
        }

        await this.loadProjectsListForDropdown();
        await this.loadManagersListForDropdown();

        const dialogModel = new JSONModel({
            type: "Project",
            projectName: "",
            role: "",
            projectManager: "",
            startDate: null,
            endDate: null,
            utilizationPercent: 100,
            description: ""
        });
        this.getView()?.setModel(dialogModel, "unifiedWork");
        
        this.unifiedWorkDialog!.open();
    }

    public onUnifiedWorkTypeChange(event: Event): void {
        const select = event.getSource() as any;
        const selectedType = select.getSelectedKey();
    }

    public onUnifiedProjectSelected(event: Event): void {
        const comboBox = event.getSource() as any;
        const selectedKey = comboBox.getSelectedKey();
        
        if (!selectedKey) return;
        
        const projectsModel = this.getView()?.getModel("projectsList") as JSONModel;
        const projects = projectsModel?.getProperty("/projects") || [];
        const selectedProject = projects.find((p: any) => p.projectName === selectedKey);
        
        if (selectedProject) {
            const dialogModel = this.getView()?.getModel("unifiedWork") as JSONModel;
            const workType = dialogModel?.getProperty("/type");
            
            dialogModel?.setProperty("/projectManager", selectedProject.projectManager || "");
            
            if (workType === "Evaluation" && selectedProject.evaluationStartDate) {
                dialogModel?.setProperty("/startDate", selectedProject.evaluationStartDate);
                dialogModel?.setProperty("/endDate", selectedProject.evaluationEndDate);
            } else {
                dialogModel?.setProperty("/startDate", selectedProject.startDate || null);
                dialogModel?.setProperty("/endDate", selectedProject.endDate || null);
            }
        }
    }

    public async onSaveUnifiedWork(): Promise<void> {
        this.showManagerOnlyAssignmentMessage();
        this.unifiedWorkDialog?.close();
        return;

        const dialogModel = this.getView()?.getModel("unifiedWork") as JSONModel;
        const data = dialogModel.getData();
        const employeeId = this.currentEmployeeId;

        // Validation
        if (!data.projectName || !data.startDate || !data.endDate || !data.utilizationPercent) {
            MessageToast.show("Please fill all required fields");
            return;
        }

        if ((data.type === "Project" || data.type === "Evaluation") && !data.role) {
            MessageToast.show("Please select your role");
            return;
        }

        const convertToISODate = (dateString: string): string | null => {
            if (!dateString) return null;
            try {
                const date = new Date(dateString);
                if (isNaN(date.getTime())) return null;
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            } catch (error) {
                console.error('Error converting date:', dateString, error);
                return null;
            }
        };

        const startDateISO = convertToISODate(data.startDate);
        const endDateISO = convertToISODate(data.endDate);

        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;

            if (data.type === "Initiative" || data.type === "Evaluation") {
                const isEvaluation = data.type === "Evaluation";
                const listBinding = oDataModel.bindList(isEvaluation ? "/CurrentEvaluations" : "/CurrentInitiatives");
                if (isEvaluation) {
                    listBinding.create({
                        employeeId: employeeId,
                        evaluationId: null,
                        evaluationName: data.projectName,
                        description: data.description || "",
                        startDate: startDateISO,
                        endDate: endDateISO,
                        utilizationPercent: parseInt(data.utilizationPercent),
                        status: "Active",
                        assignedBy: null,
                        createdAt: new Date().toISOString(),
                        lastUpdated: new Date().toISOString()
                    });
                } else {
                    listBinding.create({
                        employeeId: employeeId,
                        initiativeId: null,
                        initiativeName: data.projectName,
                        description: data.description || "",
                        startDate: startDateISO,
                        endDate: endDateISO,
                        utilizationPercent: parseInt(data.utilizationPercent),
                        status: "Active",
                        assignedBy: null,
                        createdAt: new Date().toISOString(),
                        lastUpdated: new Date().toISOString()
                    });
                }
            } else {
                // Save Project/Evaluation to CurrentProjects entity
                const listBinding = oDataModel.bindList("/CurrentProjects");
                const newData: any = {
                    employeeId: employeeId,
                    type: data.type,
                    projectName: data.projectName,
                    role: data.role || "",
                    projectManager: data.projectManager || "",
                    startDate: startDateISO,
                    endDate: endDateISO,
                    utilizationPercent: parseInt(data.utilizationPercent),
                    assignmentStatus: "Self-Assigned",
                    assignedBy: null,
                    isEvaluation: data.type === "Evaluation",
                    createdAt: new Date().toISOString(),
                    lastUpdated: new Date().toISOString()
                };
                listBinding.create(newData);
            }

            await oDataModel.submitBatch(oDataModel.getUpdateGroupId());
            await new Promise(resolve => setTimeout(resolve, 800));
            
            MessageToast.show(`${data.type} assignment saved successfully`);
            this.unifiedWorkDialog?.close();
            
            if (employeeId) {
                await this.loadCurrentProjects(employeeId!);
            }
        } catch (error) {
            console.error("❌ Error saving work:", error);
            MessageToast.show("Error saving assignment");
        }
    }

    public onCloseUnifiedWorkDialog(): void {
        this.unifiedWorkDialog?.close();
    }

    public async onAcceptAssignment(_event: Event): Promise<void> {
        MessageToast.show("Manager assignments are final and do not require acceptance.");
        const employeeId = this.currentEmployeeId;
        if (employeeId) {
            await this.loadCurrentProjects(employeeId);
        }
    }

    public async onRejectAssignment(_event: Event): Promise<void> {
        MessageToast.show("Manager assignments are final and cannot be rejected.");
        const employeeId = this.currentEmployeeId;
        if (employeeId) {
            await this.loadCurrentProjects(employeeId);
        }
    }

    // ==================== WORK ASSIGNMENT (Projects/Evaluations) ====================
    
    private workAssignmentDialog?: Dialog;

    public async onOpenWorkAssignment(): Promise<void> {
        this.showManagerOnlyAssignmentMessage();
        return;

        if (!this.workAssignmentDialog) {
            this.workAssignmentDialog = await Fragment.load({
                id: this.getView()?.getId(),
                name: "skillsphere.view.dialogs.WorkAssignmentDialog",
                controller: this
            }) as Dialog;
            this.getView()?.addDependent(this.workAssignmentDialog!);
        }

        // Load projects list from master data
        await this.loadProjectsListForDropdown();
        await this.loadManagersListForDropdown();

        // Initialize dialog model
        const dialogModel = new JSONModel({
            isEvaluation: "false",
            projectName: "",
            role: "",
            projectManager: "",
            startDate: null,
            endDate: null,
            utilizationPercent: 100
        });
        this.getView()?.setModel(dialogModel, "workAssignment");
        
        this.workAssignmentDialog!.open();
    }

    public onWorkTypeChange(event: Event): void {
        const select = event.getSource() as any;
        const isEvaluation = select.getSelectedKey();
    }

    public onWorkProjectSelected(event: Event): void {
        const comboBox = event.getSource() as any;
        const selectedKey = comboBox.getSelectedKey();
        
        if (!selectedKey) return;
        
        // Find the selected project from master data
        const projectsModel = this.getView()?.getModel("projectsList") as JSONModel;
        const projects = projectsModel?.getProperty("/projects") || [];
        const selectedProject = projects.find((p: any) => p.projectName === selectedKey);
        
        if (selectedProject) {
            const dialogModel = this.getView()?.getModel("workAssignment") as JSONModel;
            const isEvaluation = dialogModel?.getProperty("/isEvaluation") === "true";
            
            // Auto-populate from master data
            dialogModel?.setProperty("/projectManager", selectedProject.projectManager || "");
            
            // Use evaluation dates if available and evaluation type selected
            if (isEvaluation && selectedProject.evaluationStartDate) {
                dialogModel?.setProperty("/startDate", selectedProject.evaluationStartDate);
                dialogModel?.setProperty("/endDate", selectedProject.evaluationEndDate);
            } else {
                dialogModel?.setProperty("/startDate", selectedProject.startDate || null);
                dialogModel?.setProperty("/endDate", selectedProject.endDate || null);
            }
            
        }
    }

    public async onSaveWorkAssignment(): Promise<void> {
        this.showManagerOnlyAssignmentMessage();
        this.workAssignmentDialog?.close();
        return;

        const dialogModel = this.getView()?.getModel("workAssignment") as JSONModel;
        const data = dialogModel.getData();
        const employeeId = this.currentEmployeeId;

        // Validation
        if (!data.projectName || !data.role || !data.startDate || !data.endDate || !data.utilizationPercent) {
            MessageToast.show("Please fill all required fields");
            return;
        }

        const convertToISODate = (dateString: string): string | null => {
            if (!dateString) return null;
            try {
                const date = new Date(dateString);
                if (isNaN(date.getTime())) return null;
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            } catch (error) {
                console.error('Error converting date:', dateString, error);
                return null;
            }
        };

        const startDateISO = convertToISODate(data.startDate);
        const endDateISO = convertToISODate(data.endDate);

        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            const listBinding = oDataModel.bindList("/CurrentProjects");
            
            const newData = {
                employeeId: employeeId,
                projectName: data.projectName,
                role: data.role,
                projectManager: data.projectManager,
                startDate: startDateISO,
                endDate: endDateISO,
                utilizationPercent: parseInt(data.utilizationPercent),
                isEvaluation: data.isEvaluation === "true",
                createdAt: new Date().toISOString(),
                lastUpdated: new Date().toISOString()
            };
            
            listBinding.create(newData);
            await oDataModel.submitBatch(oDataModel.getUpdateGroupId());
            await new Promise(resolve => setTimeout(resolve, 800));
            
            const assignmentType = data.isEvaluation === "true" ? "Evaluation" : "Project";
            MessageToast.show(`${assignmentType} assignment saved successfully`);
            this.workAssignmentDialog?.close();
            
            if (employeeId) {
                await this.loadCurrentProjects(employeeId!);
            }
        } catch (error) {
            console.error("❌ Error saving work assignment:", error);
            MessageToast.show("Error saving assignment");
        }
    }

    public onCloseWorkAssignmentDialog(): void {
        this.workAssignmentDialog?.close();
    }

    // ==================== UNIFIED ASSIGNMENT DIALOG ====================
    
    private assignmentDialog?: Dialog;

    public async onOpenUnifiedAssignment(): Promise<void> {
        if (!this.assignmentDialog) {
            this.assignmentDialog = await Fragment.load({
                id: this.getView()?.getId(),
                name: "skillsphere.view.dialogs.UnifiedAssignmentDialog",
                controller: this
            }) as Dialog;
            this.getView()?.addDependent(this.assignmentDialog);
        }

        // Load projects list from master data
        await this.loadProjectsListForDropdown();
        await this.loadManagersListForDropdown();

        // Initialize dialog model
        const dialogModel = new JSONModel({
            type: "Project",
            projectName: "",
            role: "",
            projectManager: "",
            startDate: null,
            endDate: null,
            utilizationPercent: 100,
            description: "",
            initiativeType: "Initiative"
        });
        this.getView()?.setModel(dialogModel, "assignmentDialog");
        
        this.assignmentDialog.open();
    }

    public onAssignmentTypeChange(event: Event): void {
        // Type change is handled by binding visibility
        const select = event.getSource() as any;
        const selectedType = select.getSelectedKey();
        
        // Reset fields when type changes
        const dialogModel = this.getView()?.getModel("assignmentDialog") as JSONModel;
        if (selectedType === "Initiative") {
            dialogModel?.setProperty("/projectManager", "");
            dialogModel?.setProperty("/role", "");
        }
        
    }

    public async onSaveAssignment(): Promise<void> {
        const dialogModel = this.getView()?.getModel("assignmentDialog") as JSONModel;
        const data = dialogModel.getData();
        const employeeId = this.currentEmployeeId;

        // Validation based on type
        if (data.type === "Project" || data.type === "Evaluation") {
            if (!data.projectName || !data.role || !data.startDate || !data.endDate || !data.utilizationPercent) {
                MessageToast.show("Please fill all required fields");
                return;
            }
        } else if (data.type === "Initiative") {
            if (!data.projectName || !data.startDate || !data.endDate || !data.utilizationPercent) {
                MessageToast.show("Please fill all required fields");
                return;
            }
        }

        const convertToISODate = (dateString: string): string | null => {
            if (!dateString) return null;
            try {
                const date = new Date(dateString);
                if (isNaN(date.getTime())) return null;
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            } catch (error) {
                console.error('Error converting date:', dateString, error);
                return null;
            }
        };

        const startDateISO = convertToISODate(data.startDate);
        const endDateISO = convertToISODate(data.endDate);

        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            const listBinding = oDataModel.bindList("/CurrentProjects");
            
            const newData: any = {
                employeeId: employeeId,
                type: data.type,
                projectName: data.projectName,
                startDate: startDateISO,
                endDate: endDateISO,
                utilizationPercent: parseInt(data.utilizationPercent),
                createdAt: new Date().toISOString(),
                lastUpdated: new Date().toISOString()
            };

            // Add fields specific to Project/Evaluation
            if (data.type === "Project" || data.type === "Evaluation") {
                newData.role = data.role;
                newData.projectManager = data.projectManager;
            }

            // Add description for Initiatives
            if (data.type === "Initiative") {
                newData.description = data.description || "";
            }
            
            listBinding.create(newData);
            await oDataModel.submitBatch(oDataModel.getUpdateGroupId());
            await new Promise(resolve => setTimeout(resolve, 800));
            
            MessageToast.show(`${data.type} assignment saved successfully`);
            this.assignmentDialog?.close();
            
            if (employeeId) {
                await this.loadCurrentProjects(employeeId);
            }
        } catch (error) {
            console.error("❌ Error saving assignment:", error);
            MessageToast.show("Error saving assignment");
        }
    }

    public onCloseAssignmentDialog(): void {
        this.assignmentDialog?.close();
    }

    // ==================== CAIA Utilization Methods ====================
    
    public async onMarkCAIA(): Promise<void> {
        this.showManagerOnlyAssignmentMessage();
        return;

        if (!this.caiaDialog) {
            this.caiaDialog = await Fragment.load({
                id: this.getView()?.getId(),
                name: "skillsphere.view.dialogs.CAIADialog",
                controller: this
            }) as Dialog;
            this.getView()?.addDependent(this.caiaDialog!);
        }

        // Initialize dialog model with empty data
        const dialogModel = new JSONModel({
            taskName: "",
            startDate: null,
            endDate: null,
            hoursPerDay: 0
        });
        this.getView()?.setModel(dialogModel, "caiaDialog");
        
        this.caiaDialog!.open();
    }

    public async onSaveCAIA(): Promise<void> {
        const dialogModel = this.getView()?.getModel("caiaDialog") as JSONModel;
        const data = dialogModel.getData();
        const employeeId = this.currentEmployeeId;

        if (!data?.caiaId) {
            this.showManagerOnlyAssignmentMessage();
            this.caiaDialog?.close();
            return;
        }

        // Validation
        if (!data.taskName || !data.startDate || !data.endDate || data.hoursPerDay <= 0) {
            MessageToast.show("Please fill all required fields");
            return;
        }

        // Helper function to convert date
        const convertToISODate = (dateString: string): string | null => {
            if (!dateString) return null;
            try {
                const date = new Date(dateString);
                if (isNaN(date.getTime())) return null;
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            } catch (error) {
                console.error('Error converting date:', dateString, error);
                return null;
            }
        };

        const startDateISO = convertToISODate(data.startDate);
        const endDateISO = convertToISODate(data.endDate);

        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            
            if (data.caiaId) {
                // Update existing record
                const listBinding = oDataModel.bindList("/CAIAUtilization");
                listBinding.filter([new Filter("caiaId", FilterOperator.EQ, data.caiaId)]);
                
                const contexts = await listBinding.requestContexts(0, 1);
                if (contexts.length > 0) {
                    const context = contexts[0];
                    context.setProperty("taskName", data.taskName);
                    context.setProperty("startDate", startDateISO);
                    context.setProperty("endDate", endDateISO);
                    context.setProperty("hoursPerDay", data.hoursPerDay);
                    context.setProperty("lastUpdated", new Date().toISOString());
                    
                    await oDataModel.submitBatch(oDataModel.getUpdateGroupId());
                    await new Promise(resolve => setTimeout(resolve, 300));
                    listBinding.refresh();
                    
                    MessageToast.show("CAIA utilization updated successfully");
                }
            } else {
                // Add new record
                const listBinding = oDataModel.bindList("/CAIAUtilization");
                const newData = {
                    employeeId: employeeId,
                    taskName: data.taskName,
                    startDate: startDateISO,
                    endDate: endDateISO,
                    hoursPerDay: data.hoursPerDay,
                    createdAt: new Date().toISOString(),
                    lastUpdated: new Date().toISOString()
                };
                
                listBinding.create(newData);
                await oDataModel.submitBatch(oDataModel.getUpdateGroupId());
                await new Promise(resolve => setTimeout(resolve, 800));
                
                MessageToast.show("CAIA utilization marked successfully");
            }
            
            this.caiaDialog?.close();
            if (employeeId) {
                await this.loadCAIAUtilization(employeeId);
            }
        } catch (error) {
            console.error("❌ Error saving CAIA:", error);
            MessageToast.show("Error saving CAIA utilization");
        }
    }

    public onCloseCAIADialog(): void {
        this.caiaDialog?.close();
    }

    public async onEditCAIA(event: Event): Promise<void> {
        const source = event.getSource() as any;
        const bindingContext = source.getBindingContext("caia");
        const caia = bindingContext?.getObject();

        if (!this.caiaDialog) {
            this.caiaDialog = await Fragment.load({
                id: this.getView()?.getId(),
                name: "skillsphere.view.dialogs.CAIADialog",
                controller: this
            }) as Dialog;
            this.getView()?.addDependent(this.caiaDialog);
        }

        const dialogModel = new JSONModel(caia);
        this.getView()?.setModel(dialogModel, "caiaDialog");
        
        this.caiaDialog.open();
    }

    public async onDeleteCAIA(event: Event): Promise<void> {
        const source = event.getSource() as any;
        const bindingContext = source.getBindingContext("caia");
        const caia = bindingContext?.getObject();

        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            const listBinding = oDataModel.bindList("/CAIAUtilization");
            listBinding.filter([new Filter("caiaId", FilterOperator.EQ, caia.caiaId)]);
            
            const contexts = await listBinding.requestContexts(0, 1);
            if (contexts.length > 0) {
                contexts[0].delete();
                await oDataModel.submitBatch(oDataModel.getUpdateGroupId());
                await new Promise(resolve => setTimeout(resolve, 300));
                listBinding.refresh();
                
                MessageToast.show("CAIA utilization deleted successfully");
                const employeeId = this.currentEmployeeId;
                if (employeeId) {
                    await this.loadCAIAUtilization(employeeId);
                }
            }
        } catch (error) {
            console.error("❌ Error deleting CAIA:", error);
            MessageToast.show("Error deleting CAIA utilization");
        }
    }

    private async loadCAIA(employeeId: string): Promise<void> {
        try {
            // CAIA data already loaded by loadCAIAUtilization method
            // This method is redundant but kept for backward compatibility
            await this.loadCAIAUtilization(employeeId);
        } catch (error) {
            console.error("Error loading CAIA:", error);
            this.getView()?.setModel(new JSONModel({ data: [] }), "caia");
        }
    }

    // ==================== POC Utilization Methods ====================
    
    public async onMarkPOC(): Promise<void> {
        this.showManagerOnlyAssignmentMessage();
        return;

        if (!this.pocDialog) {
            this.pocDialog = await Fragment.load({
                id: this.getView()?.getId(),
                name: "skillsphere.view.dialogs.POCDialog",
                controller: this
            }) as Dialog;
            this.getView()?.addDependent(this.pocDialog!);
        }

        // Initialize dialog model with empty data
        const dialogModel = new JSONModel({
            pocTitle: "",
            startDate: null,
            endDate: null,
            hoursPerDay: 0
        });
        this.getView()?.setModel(dialogModel, "pocDialog");
        
        this.pocDialog!.open();
    }

    public async onSavePOC(): Promise<void> {
        const dialogModel = this.getView()?.getModel("pocDialog") as JSONModel;
        const data = dialogModel.getData();
        const employeeId = this.currentEmployeeId;

        if (!data?.pocId) {
            this.showManagerOnlyAssignmentMessage();
            this.pocDialog?.close();
            return;
        }

        // Validation
        if (!data.pocTitle || !data.startDate || !data.endDate || data.hoursPerDay <= 0) {
            MessageToast.show("Please fill all required fields");
            return;
        }

        // Helper function to convert date
        const convertToISODate = (dateString: string): string | null => {
            if (!dateString) return null;
            try {
                const date = new Date(dateString);
                if (isNaN(date.getTime())) return null;
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            } catch (error) {
                console.error('Error converting date:', dateString, error);
                return null;
            }
        };

        const startDateISO = convertToISODate(data.startDate);
        const endDateISO = convertToISODate(data.endDate);

        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            
            if (data.pocId) {
                // Update existing record
                const listBinding = oDataModel.bindList("/POCUtilization");
                listBinding.filter([new Filter("pocId", FilterOperator.EQ, data.pocId)]);
                
                const contexts = await listBinding.requestContexts(0, 1);
                if (contexts.length > 0) {
                    const context = contexts[0];
                    context.setProperty("pocTitle", data.pocTitle);
                    context.setProperty("startDate", startDateISO);
                    context.setProperty("endDate", endDateISO);
                    context.setProperty("hoursPerDay", data.hoursPerDay);
                    context.setProperty("lastUpdated", new Date().toISOString());
                    
                    await oDataModel.submitBatch(oDataModel.getUpdateGroupId());
                    await new Promise(resolve => setTimeout(resolve, 300));
                    listBinding.refresh();
                    
                    MessageToast.show("POC utilization updated successfully");
                }
            } else {
                // Add new record
                const listBinding = oDataModel.bindList("/POCUtilization");
                const newData = {
                    employeeId: employeeId,
                    pocTitle: data.pocTitle,
                    startDate: startDateISO,
                    endDate: endDateISO,
                    hoursPerDay: data.hoursPerDay,
                    createdAt: new Date().toISOString(),
                    lastUpdated: new Date().toISOString()
                };
                
                listBinding.create(newData);
                await oDataModel.submitBatch(oDataModel.getUpdateGroupId());
                await new Promise(resolve => setTimeout(resolve, 800));
                
                MessageToast.show("POC utilization marked successfully");
            }
            
            this.pocDialog?.close();
            if (employeeId) {
                await this.loadPOCUtilization(employeeId);
            }
        } catch (error) {
            console.error("❌ Error saving POC:", error);
            MessageToast.show("Error saving POC utilization");
        }
    }

    public onClosePOCDialog(): void {
        this.pocDialog?.close();
    }

    public async onEditPOC(event: Event): Promise<void> {
        const source = event.getSource() as any;
        const bindingContext = source.getBindingContext("poc");
        const poc = bindingContext?.getObject();

        if (!this.pocDialog) {
            this.pocDialog = await Fragment.load({
                id: this.getView()?.getId(),
                name: "skillsphere.view.dialogs.POCDialog",
                controller: this
            }) as Dialog;
            this.getView()?.addDependent(this.pocDialog);
        }

        const dialogModel = new JSONModel(poc);
        this.getView()?.setModel(dialogModel, "pocDialog");
        
        this.pocDialog.open();
    }

    public async onDeletePOC(event: Event): Promise<void> {
        const source = event.getSource() as any;
        const bindingContext = source.getBindingContext("poc");
        const poc = bindingContext?.getObject();

        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            const listBinding = oDataModel.bindList("/POCUtilization");
            listBinding.filter([new Filter("pocId", FilterOperator.EQ, poc.pocId)]);
            
            const contexts = await listBinding.requestContexts(0, 1);
            if (contexts.length > 0) {
                contexts[0].delete();
                await oDataModel.submitBatch(oDataModel.getUpdateGroupId());
                await new Promise(resolve => setTimeout(resolve, 300));
                listBinding.refresh();
                
                MessageToast.show("POC utilization deleted successfully");
                const employeeId = this.currentEmployeeId;
                if (employeeId) {
                    await this.loadPOCUtilization(employeeId);
                }
            }
        } catch (error) {
            console.error("❌ Error deleting POC:", error);
            MessageToast.show("Error deleting POC utilization");
        }
    }

    private async loadPOC(employeeId: string): Promise<void> {
        try {
            // POC data already loaded by loadPOCUtilization method
            // This method is redundant but kept for backward compatibility
            await this.loadPOCUtilization(employeeId);
        } catch (error) {
            console.error("Error loading POC:", error);
            this.getView()?.setModel(new JSONModel({ data: [] }), "poc");
        }
    }

    // ==================== Certification Methods ====================

    private certificationDialog?: Dialog;

    public async onAddCertification(): Promise<void> {
        try {
            if (!this.certificationDialog) {
                this.certificationDialog = await Fragment.load({
                    id: this.getView()?.getId(),
                    name: "skillsphere.view.dialogs.CertificationDialog",
                    controller: this
                }) as Dialog;
                this.getView()?.addDependent(this.certificationDialog);
            }

            // Initialize with empty data
            const newCertModel = new JSONModel({
                certificationId: null,
                name: "",
                code: "",
                dateOfCompletion: "",
                description: "",
                level: "Associate"
            });
            this.getView()?.setModel(newCertModel, "certificationDialog");

            this.certificationDialog.open();
        } catch (error) {
            console.error("Error opening certification dialog:", error);
            MessageToast.show("Error opening dialog");
        }
    }

    public async onSaveCertification(): Promise<void> {
        const dialogModel = this.getView()?.getModel("certificationDialog") as JSONModel;
        const data = dialogModel.getData();
        const employeeId = this.currentEmployeeId;

        // Validation
        if (!data.name || !data.code || !data.dateOfCompletion || !data.level) {
            MessageToast.show("Please fill all required fields");
            return;
        }

        // Helper function to convert date to ISO format
        const convertToISODate = (dateString: string): string | null => {
            if (!dateString) return null;
            try {
                const date = new Date(dateString);
                if (isNaN(date.getTime())) return null;
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            } catch (error) {
                console.error('Error converting date:', dateString, error);
                return null;
            }
        };

        const dateOfCompletionISO = convertToISODate(data.dateOfCompletion);

        if (!dateOfCompletionISO) {
            MessageToast.show("Invalid date format");
            return;
        }

        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            
            if (data.certificationId) {
                // Update existing certification
                const listBinding = oDataModel.bindList("/Certifications");
                listBinding.filter([new Filter("certificationId", FilterOperator.EQ, data.certificationId)]);
                
                const contexts = await listBinding.requestContexts(0, 1);
                if (contexts.length > 0) {
                    const context = contexts[0];
                    context.setProperty("name", data.name);
                    context.setProperty("code", data.code);
                    context.setProperty("dateOfCompletion", dateOfCompletionISO);
                    context.setProperty("description", data.description || "");
                    context.setProperty("level", data.level);
                    context.setProperty("lastUpdated", new Date().toISOString());
                    
                    await oDataModel.submitBatch(oDataModel.getUpdateGroupId());
                    await new Promise(resolve => setTimeout(resolve, 300));
                    listBinding.refresh();
                    
                    MessageToast.show("Certification updated successfully");
                }
            } else {
                // Add new certification
                const listBinding = oDataModel.bindList("/Certifications");
                const newData = {
                    employeeId: employeeId,
                    name: data.name,
                    code: data.code,
                    dateOfCompletion: dateOfCompletionISO,
                    description: data.description || "",
                    level: data.level,
                    createdAt: new Date().toISOString(),
                    lastUpdated: new Date().toISOString()
                };
                
                listBinding.create(newData);
                await oDataModel.submitBatch(oDataModel.getUpdateGroupId());
                await new Promise(resolve => setTimeout(resolve, 800));
                
                MessageToast.show("Certification added successfully");
            }
            
            this.certificationDialog?.close();
            if (employeeId) {
                await this.loadCertifications(employeeId);
            }
        } catch (error) {
            console.error("❌ Error saving certification:", error);
            MessageToast.show("Error saving certification");
        }
    }

    public async onEditCertification(event: Event): Promise<void> {
        const source = event.getSource() as any;
        const bindingContext = source.getBindingContext("certifications");
        const certification = bindingContext?.getObject();

        if (!this.certificationDialog) {
            this.certificationDialog = await Fragment.load({
                id: this.getView()?.getId(),
                name: "skillsphere.view.dialogs.CertificationDialog",
                controller: this
            }) as Dialog;
            this.getView()?.addDependent(this.certificationDialog);
        }

        const dialogModel = new JSONModel(certification);
        this.getView()?.setModel(dialogModel, "certificationDialog");
        
        this.certificationDialog.open();
    }

    public async onDeleteCertification(event: Event): Promise<void> {
        const source = event.getSource() as any;
        const bindingContext = source.getBindingContext("certifications");
        const certification = bindingContext?.getObject();

        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            const listBinding = oDataModel.bindList("/Certifications");
            listBinding.filter([new Filter("certificationId", FilterOperator.EQ, certification.certificationId)]);
            
            const contexts = await listBinding.requestContexts(0, 1);
            if (contexts.length > 0) {
                contexts[0].delete();
                await oDataModel.submitBatch(oDataModel.getUpdateGroupId());
                await new Promise(resolve => setTimeout(resolve, 300));
                listBinding.refresh();
                
                MessageToast.show("Certification deleted successfully");
                const employeeId = this.currentEmployeeId;
                if (employeeId) {
                    await this.loadCertifications(employeeId);
                }
            }
        } catch (error) {
            console.error("Error deleting certification:", error);
            MessageToast.show("Error deleting certification");
        }
    }

    public onCloseCertificationDialog(): void {
        this.certificationDialog?.close();
    }

    // ==================== AI ASSISTANT METHODS ====================

    private employeeIdForAI: string = "";
    private aiInitialized: boolean = false;
    private typingIndicator: any = null;
private currentChatEmployeeId: string = ""; // Track which employee's chat is currently displayed

/**
 * Open AI Assistant Dialog
 */
public onOpenAIAssistant(): void {
    // ALWAYS fetch fresh user identity
    const currentUserModel = this.getOwnerComponent()
        ?.getModel("currentUser") as JSONModel;

    const userData = currentUserModel?.getData();

    if (!userData?.employeeId) {
        console.error("❌ No employeeId found in currentUser model");
        MessageToast.show("Please login first");
        return;
    }

    const newEmployeeId = userData.employeeId;

    // ✅ FIX: Clear chat if different employee
    if (this.currentChatEmployeeId !== newEmployeeId) {
        this.clearChatForNewEmployee();
        this.currentChatEmployeeId = newEmployeeId;
    }

    this.employeeIdForAI = newEmployeeId;

    // Initialize chat if empty (first time or after clear)
    const oContainer = this.byId("messagesContainerEmployee") as any;
    if (!oContainer || oContainer.getItems().length === 0) {
        this.initializeAIChat();
    }

    const oDialog = this.byId("aiAssistantDialogEmployee") as Dialog;
    oDialog?.open();
}

/**
 * Clear chat for new employee - called when employee ID changes
 */
private clearChatForNewEmployee(): void {
    const oContainer = this.byId("messagesContainerEmployee") as any;
    
    if (oContainer) {
        // Destroy all chat messages
        oContainer.destroyItems();
    }
    
    // Remove typing indicator if present
    if (this.typingIndicator) {
        this.typingIndicator.destroy();
        this.typingIndicator = null;
    }
    
    // Reset initialization flag
    this.aiInitialized = false;
}

/**
 * Initialize chat with personalized welcome message
 */
private initializeAIChat(): void {
    if (this.aiInitialized) {
        return;
    }

    const currentUserModel = this.getOwnerComponent()
        ?.getModel("currentUser") as JSONModel;
    const userData = currentUserModel?.getData();
    const employeeName = userData?.name || "there";


    this.addBotMessage(
        `👋 Hello ${employeeName}! I'm your AI assistant.\n\n` +
        "I can help you with:\n" +
        "• Your skill profile and certifications\n" +
        "• Available training opportunities\n" +
        "• Your project assignments and workload\n" +
        "• Career development questions\n\n" +
        "What would you like to know?"
    );

    this.aiInitialized = true;
}

/**
 * Close AI Assistant Dialog
 */
public onCloseAIDialog(): void {
    const oDialog = this.byId("aiAssistantDialogEmployee") as Dialog;
    oDialog?.close();
    // Note: We DON'T clear chat on close - only when employee changes
}

/**
 * Clear chat manually (button action)
 */
public onClearChat(): void {
    const oContainer = this.byId("messagesContainerEmployee") as any;
    oContainer?.destroyItems();
    
    // Remove typing indicator
    if (this.typingIndicator) {
        this.typingIndicator.destroy();
        this.typingIndicator = null;
    }
    
    this.aiInitialized = false;
    this.initializeAIChat();
}

/**
 * Handle quick action buttons
 */
public onQuickAction(oEvent: Event): void {
    const button = oEvent.getSource() as any;
    const sButtonText = button.getText();
    let query = "";

    switch(sButtonText) {
        case "My Skills":
            query = "Show me a summary of my current skills";
            break;
        case "Training":
            query = "What training would help me advance in my career?";
            break;
        case "Projects":
            query = "What are my current project assignments and workload?";
            break;
    }

    const input = this.byId("messageInputEmployee") as any;
    input?.setValue(query);
    this.onSendMessage();
}

/**
 * Send message to AI
 */
public onSendMessage(): void {
    const oInput = this.byId("messageInputEmployee") as any;
    const sMessage = oInput?.getValue().trim();
    
    if (!sMessage) {
        MessageToast.show("Please enter a message");
        return;
    }

    // Ensure we have the current employee ID
    if (!this.employeeIdForAI) {
        const currentUserModel = this.getOwnerComponent()?.getModel("currentUser") as JSONModel;
        const userData = currentUserModel?.getData();
        this.employeeIdForAI = userData?.employeeId || "";
    }

    if (!this.employeeIdForAI) {
        MessageToast.show("Employee ID not found. Please login again.");
        return;
    }


    this.addUserMessage(sMessage);
    oInput.setValue("");
    this.showTypingIndicator();
    this.queryAI(sMessage);
}

/**
 * Query AI service - WITH EMPLOYEE ID FOR PERSONALIZED RESPONSES
 */
private async queryAI(query: string): Promise<void> {
    try {
        
        if (!this.employeeIdForAI) {
            throw new Error("Employee ID is required");
        }

        // Use OData V4 model action binding — handles CSRF automatically
        const oDataModel = this.getOwnerComponent()?.getModel() as any;
        const oAction = oDataModel.bindContext("/askAIAssistant(...)");
        oAction.setParameter("query", query);
        oAction.setParameter("employeeId", this.employeeIdForAI);
        await oAction.execute("$auto");
        const result = oAction.getBoundContext().getObject();

        this.removeTypingIndicator();

        // Handle the response structure
        if (result.answer) {
            this.addBotMessage(result.answer);
        } else if (result.value?.answer) {
            this.addBotMessage(result.value.answer);
        } else {
            this.addBotMessage("⚠️ Sorry, I encountered an error: " + (result.value?.error || "Unknown error"));
        }
    } catch (error: any) {
        this.removeTypingIndicator();
        this.addBotMessage("⚠️ Sorry, I'm having trouble connecting. Please try again.");
        console.error("❌ AI Query Error:", error);
    }
}

// ... rest of your methods (addUserMessage, addBotMessage, etc.) stay the same ...

    /**
     * Add user message to chat
     */
    private addUserMessage(message: string): void {
        const oContainer = this.byId("messagesContainerEmployee") as any;
        
        const oMessageBox = new HBox({
            justifyContent: "End",
            items: [
                new VBox({
                    items: [
                        new Text({
                            text: message
                        }).addStyleClass("userMessage sapUiSmallMargin")
                    ]
                }).addStyleClass("messageBox userMessageBox")
            ]
        }).addStyleClass("sapUiTinyMarginTop");
        
        oContainer?.addItem(oMessageBox);
        this.scrollToBottom();
    }

    /**
     * Add bot message to chat - with markdown formatting support
     */
    private addBotMessage(message: string): void {
        const oContainer = this.byId("messagesContainerEmployee") as any;
        
        // Parse markdown and convert to HTML-friendly format
        const formattedHtml = this.parseMarkdown(message);
        
        const oMessageBox = new HBox({
            justifyContent: "Start",
            width: "100%",
            items: [
                new VBox({
                    width: "100%",
                    items: [
                        new FormattedText({
                            htmlText: formattedHtml
                        }).addStyleClass("botMessage sapUiSmallMargin")
                    ]
                }).addStyleClass("messageBox botMessageBox")
            ]
        }).addStyleClass("sapUiTinyMarginTop");
        
        oContainer?.addItem(oMessageBox);
        this.scrollToBottom();
    }

    /**
     * Parse markdown to HTML for better formatting
     */
    private parseMarkdown(text: string): string {
        let html = text;
        
        // Escape HTML special characters first
        html = html
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
        
        // Convert markdown bold **text** to <strong>text</strong>
        html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
        
        // Convert markdown italic *text* to <em>text</em>
        html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
        
        // Convert markdown code `text` to <code>text</code>
        html = html.replace(/`(.+?)`/g, "<code>$1</code>");
        
        // Convert line breaks to <br>
        html = html.replace(/\n/g, "<br>");
        
        // Convert bullet points - lines starting with * or -
        html = html.replace(/^[\s]*[\*\-]\s+(.+?)(?=<br>|$)/gm, 
            (match, content) => "&nbsp;&nbsp;&nbsp;• " + content.trim());
        
        // Convert numbered lists - lines starting with number.
        html = html.replace(/^[\s]*(\d+)\.\s+(.+?)(?=<br>|$)/gm, 
            (match, num, content) => "&nbsp;&nbsp;&nbsp;" + num + ". " + content.trim());
        
        // Convert headers - lines starting with #
        html = html.replace(/^#+\s+(.+?)(?=<br>|$)/gm, 
            (match, content) => "<strong style=\"font-size: 1.1em; color: #0070f2;\">" + content.trim() + "</strong>");
        
        return html;
    }

    /**
     * Show typing indicator
     */
    private showTypingIndicator(): void {
        const oContainer = this.byId("messagesContainerEmployee") as any;
        
        this.typingIndicator = new HBox({
            id: this.createId("typingIndicator"),
            justifyContent: "Start",
            items: [
                new VBox({
                    items: [
                        new Text({
                            text: "AI is typing..."
                        }).addStyleClass("typingIndicator sapUiSmallMargin")
                    ]
                }).addStyleClass("messageBox botMessageBox")
            ]
        }).addStyleClass("sapUiTinyMarginTop");
        
        oContainer?.addItem(this.typingIndicator);
        this.scrollToBottom();
    }

    /**
     * Remove typing indicator
     */
    private removeTypingIndicator(): void {
        if (this.typingIndicator) {
            const oContainer = this.byId("messagesContainerEmployee") as any;
            oContainer?.removeItem(this.typingIndicator);
            this.typingIndicator.destroy();
            this.typingIndicator = null;
        }
    }

    /**
     * Scroll chat to bottom
     */
    private scrollToBottom(): void {
        setTimeout(() => {
            const oScrollContainer = this.byId("chatContainerEmployee") as any;
            if (oScrollContainer) {
                oScrollContainer.scrollTo(0, 10000);
            }
        }, 100);
    }

    /**
     * Clear chat
     */
    
    /**
     * Handle T-Level change event
     */
    public onTLevelChange(event: Event): void {
        const source = event.getSource() as any;
        const selectedTLevel = source.getSelectedKey();
        
        if (selectedTLevel) {
        }
    }

    /**
     * Handle Certification Year Filter change
     */
    public onCertificationYearFilterChange(event: Event): void {
        const source = event.getSource() as any;
        const selectedYear = source.getSelectedKey();
        const certModel = this.getView()?.getModel("certifications") as JSONModel;
        // Always filter from the original full list
        const allCertifications = certModel?.getProperty("/allCertifications") || [];
        
        let filteredCertifications = allCertifications;

        if (selectedYear !== "all") {
            const yearNumber = parseInt(selectedYear, 10);
            filteredCertifications = allCertifications.filter((cert: any) => {
                if (!cert.dateOfCompletion) return false;
                const certDate = new Date(cert.dateOfCompletion);
                return certDate.getFullYear() === yearNumber;
            });
        }
        
        certModel?.setProperty("/selectedYear", selectedYear);
        certModel?.setProperty("/certifications", filteredCertifications);
        
    }
}
