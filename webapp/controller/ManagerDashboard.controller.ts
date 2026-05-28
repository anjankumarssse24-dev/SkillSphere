import Fragment from "sap/ui/core/Fragment";
import Controller from "sap/ui/core/mvc/Controller";
import Router from "sap/ui/core/routing/Router";
import MessageToast from "sap/m/MessageToast";
import MessageBox from "sap/m/MessageBox";
import JSONModel from "sap/ui/model/json/JSONModel";
import Event from "sap/ui/base/Event";
import Table from "sap/m/Table";
import MultiInput from "sap/m/MultiInput";
import Token from "sap/m/Token";
import Select from "sap/m/Select";
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";
import HTML from "sap/ui/core/HTML";
import Text from "sap/m/Text";
import VBox from "sap/m/VBox";
import HBox from "sap/m/HBox";
import ProgressIndicator from "sap/m/ProgressIndicator";
import Dialog from "sap/m/Dialog";
import FormattedText from "sap/m/FormattedText";

/**
 * @namespace skillsphere.controller
 */
export default class ManagerDashboard extends Controller {

    private currentManagerId: string | null = null;
    private currentDialogEmployeeId: string = "";
    private managerAddProjectDialog?: Dialog;
    private createMasterProjectDialog?: Dialog;
    private editMasterProjectDialog?: Dialog;
    private masterWorkItemDialog?: Dialog;
    private employeeProfileDialog?: Dialog;
    private addSkillDialog?: Dialog;
    private editSkillDialog?: Dialog;
    private certificationDialog?: Dialog;
    private managerWorkAssignmentDialog?: Dialog;
    private managerAssignWorkDialog?: Dialog;
    private managerProfileSnapshot: any = null;
    private pendingEmployeeIdToOpen: string | null = null;

    private buildSelectOptions(values: string[], allLabel: string): Array<{ key: string; text: string }> {
        const uniqueValues = Array.from(new Set(values.map((v) => String(v || "").trim()).filter(Boolean))).sort();
        return [
            { key: "", text: allLabel },
            ...uniqueValues.map((value) => ({ key: value, text: value }))
        ];
    }

    public onInit(): void {
        const router = this.getRouter();
        router.getRoute("ManagerDashboard")?.attachPatternMatched(this.onRouteMatched, this);
        this.getView()?.setModel(new JSONModel({ isEditing: false }), "managerProfileUi");
    }

    private getRouter(): Router {
        return (this.getOwnerComponent() as any).getRouter();
    }

    private generateUuid(): string {
        const cryptoObj: any = (globalThis as any).crypto;
        if (cryptoObj?.randomUUID) {
            return cryptoObj.randomUUID();
        }

        return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            const v = c === "x" ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    public onOpenWorkOverview(): void {
        if (!this.currentManagerId) {
            MessageToast.show("Manager information not found");
            return;
        }
        this.getRouter().navTo("ManagerWorkOverview", {
            managerId: this.currentManagerId
        });
    }

    public onLogout(): void {
        // Clear search results before logout
        this.clearSearchResults();

        // Clear current user data
        const currentUserModel = this.getOwnerComponent()?.getModel("currentUser") as JSONModel;
        if (currentUserModel) {
            currentUserModel.setData({
                id: null,
                name: null,
                role: null,
                team: null,
                subTeam: null,
                email: null,
                managerId: null,
                isLoggedIn: false
            });
        }

        this.currentManagerId = null;
        this.getRouter().navTo("Landing");
        MessageToast.show("You have been logged out");
    }

    private async onRouteMatched(event: any): Promise<void> {
        const args: any = event.getParameter("arguments");
        const managerId = args?.managerId;
        const targetEmployeeId = String(args?.["?query"]?.employeeId || "").trim();

        // Keep dashboard at top when route changes.
        window.scrollTo({ top: 0, behavior: "auto" });

        const currentUserModel = this.getOwnerComponent()?.getModel("currentUser") as JSONModel;
        const currentUser = currentUserModel?.getData();
        if (!currentUser?.isLoggedIn && !managerId) {
            MessageToast.show("Please login to access the dashboard");
            this.getRouter().navTo("Landing");
            return;
        }

        const managerAliasMap: Record<string, string> = {
            MGR003: "I042040"
        };
        const requestedManagerId = String(managerId || currentUser?.id || "").trim().toUpperCase();
        const resolvedManagerId = managerAliasMap[requestedManagerId] || requestedManagerId;
        this.currentManagerId = resolvedManagerId || null;
        this.pendingEmployeeIdToOpen = targetEmployeeId || null;
        if (!this.currentManagerId) {
            MessageToast.show("Manager information not found");
            this.getRouter().navTo("Landing");
            return;
        }

        await this.loadManagerData(this.currentManagerId);

        if (this.pendingEmployeeIdToOpen) {
            const employeeId = this.pendingEmployeeIdToOpen;
            const managerEmployeesModel = this.getView()?.getModel("managerEmployees") as JSONModel;
            const employees = managerEmployeesModel?.getProperty("/employees") || [];
            const targetEmployee = employees.find((emp: any) => emp.employeeId === employeeId);

            if (targetEmployee) {
                await this.openEmployeeDetailsDialog(targetEmployee, false);
            }

            this.pendingEmployeeIdToOpen = null;
        }
    }

    private async loadManagerData(currentManagerId?: string): Promise<void> {
        try {
            const managerId = String(currentManagerId || this.currentManagerId || "").trim().toUpperCase();
            if (!managerId) {
                return;
            }

            const oDataModel = this.getOwnerComponent()?.getModel() as any;

            const employeeBinding = oDataModel.bindList("/Employees");
            employeeBinding.filter([new Filter("managerId", FilterOperator.EQ, managerId)]);
            const employeeContexts = await employeeBinding.requestContexts(0, 500);
            const employees = employeeContexts.map((ctx: any) => ctx.getObject());

            const employeeIds = employees.map((e: any) => String(e.employeeId).trim()).filter(Boolean);

            const skillsBindings = employeeIds.map((id: string) => {
                const binding = oDataModel.bindList("/Skills");
                binding.filter([new Filter("employeeId", FilterOperator.EQ, id)]);
                return binding.requestContexts(0, 500).then((ctxs: any[]) => ctxs.map((c: any) => c.getObject()));
            });

            const [currentProjectContexts, currentInitiativeContexts, currentEvaluationContexts, ...skillsPerEmployee] = await Promise.all([
                oDataModel.bindList("/CurrentProjects").requestContexts(0, 5000),
                oDataModel.bindList("/CurrentInitiatives").requestContexts(0, 5000),
                oDataModel.bindList("/CurrentEvaluations").requestContexts(0, 5000),
                ...skillsBindings
            ]);

            const skillsByEmployeeId: { [id: string]: any[] } = {};
            employeeIds.forEach((id: string, idx: number) => {
                skillsByEmployeeId[id] = skillsPerEmployee[idx] || [];
            });

            const activeEmployees = new Set<string>();
            const utilizationByEmployee = new Map<string, number>();
            const markActive = (entry: any) => {
                const status = String(entry.assignmentStatus || entry.status || "").trim().toLowerCase();
                const employeeId = String(entry?.employeeId || "").trim();
                if (employeeId && status !== "completed") {
                    activeEmployees.add(employeeId);
                    const utilization = Math.max(0, Number(entry?.utilizationPercent) || 0);
                    utilizationByEmployee.set(employeeId, (utilizationByEmployee.get(employeeId) || 0) + utilization);
                }
            };
            currentProjectContexts.forEach((ctx: any) => markActive(ctx.getObject()));
            currentInitiativeContexts.forEach((ctx: any) => markActive(ctx.getObject()));
            currentEvaluationContexts.forEach((ctx: any) => markActive(ctx.getObject()));

            const enrichedEmployees = employees.map((employee: any) => ({
                ...employee,
                working_on_project: activeEmployees.has(employee.employeeId),
                totalUtilization: Math.round(utilizationByEmployee.get(employee.employeeId) || 0),
                skills: skillsByEmployeeId[String(employee.employeeId).trim()] || []
            }));

            enrichedEmployees.sort((a: any, b: any) => {
                const nameA = (a.name || "").toUpperCase();
                const nameB = (b.name || "").toUpperCase();
                return nameA.localeCompare(nameB);
            });

            this.getView()?.setModel(new JSONModel({ employees: enrichedEmployees }), "managerEmployees");
            this.updateAnalytics();
            await this.initializeVisualization();
            await this.loadAllManagers();
            await this.loadReportingManagers(managerId);
            await this.loadSelfProfile(managerId);
            await this.loadMasterProjects();
            await this.loadMasterWorkItems();
        } catch (error) {
            console.error("❌ Error loading manager data:", error);
            MessageToast.show("Error loading team data");
            this.getView()?.setModel(new JSONModel({ employees: [] }), "managerEmployees");
        }
    }

    public async onOpenAddEmployeeDialog(): Promise<void> {
        if (!this.currentManagerId) {
            MessageToast.show("Manager information not found");
            return;
        }

        const currentUserModel = this.getOwnerComponent()?.getModel("currentUser") as JSONModel;
        const currentUser = currentUserModel?.getData() || {};
        const selfProfileModel = this.getView()?.getModel("selfProfile") as JSONModel;
        const selfProfile = selfProfileModel?.getData() || {};

        const managerName = String(currentUser?.name || selfProfile?.name || "Current Manager").trim();
        const managerId = String(this.currentManagerId).trim().toUpperCase();
        const team = String(selfProfile?.team || "CIS").trim();
        const subTeam = String(selfProfile?.subTeam || "Team 1").trim();

        const editorModel = new JSONModel({
            mode: "create",
            employeeId: "",
            name: "",
            email: "",
            businessRole: "Employee",
            professionalRole: "Developer",
            team,
            subTeam,
            managerId,
            managerLabel: `${managerName} (${managerId})`,
            experience: 0,
            location: "",
            tLevel: "",
            gradeLevel: "",
            specialization: ""
        });

        this.getView()?.setModel(editorModel, "employeeEditor");
        this.getView()?.setModel(new JSONModel({ skills: [] }), "employeeEditorSkills");
        this.getView()?.setModel(new JSONModel({ certifications: [] }), "employeeEditorCertifications");

        if (!this.employeeProfileDialog) {
            this.employeeProfileDialog = await Fragment.load({
                id: this.getView()?.getId(),
                name: "skillsphere.view.dialogs.ManagerEmployeeProfileDialog",
                controller: this
            }) as Dialog;
            this.getView()?.addDependent(this.employeeProfileDialog);
        }

        this.employeeProfileDialog.open();
    }

    /**
     * Load all managers for the search dropdown
     */
    private async loadAllManagers(): Promise<void> {
        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            const listBinding = oDataModel.bindList("/Employees");
            listBinding.filter([new Filter("role", FilterOperator.EQ, "Manager")]);
            
            const contexts = await listBinding.requestContexts();
            const allManagers = contexts.map((context: any) => context.getObject());
            
            console.log(`✅ Loaded ${allManagers.length} managers for search dropdown`);
            
            // Create managers model for the dropdown
            const managersModel = new JSONModel({ managers: allManagers });
            this.getView()?.setModel(managersModel, "managers");
            
        } catch (error) {
            console.error("❌ Error loading managers:", error);
            // Set empty model on error
            const emptyManagersModel = new JSONModel({ managers: [] });
            this.getView()?.setModel(emptyManagersModel, "managers");
        }
    }

    private async loadSelfProfile(managerId: string): Promise<void> {
        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;

            const employeeBinding = oDataModel.bindList("/Employees");
            employeeBinding.filter([new Filter("employeeId", FilterOperator.EQ, managerId)]);
            const employeeContexts = await employeeBinding.requestContexts(0, 1);

            if (employeeContexts.length === 0) {
                this.getView()?.setModel(new JSONModel({}), "selfProfile");
                return;
            }

            const employee = employeeContexts[0].getObject();
            const profile = await this.getEmployeeProfile(managerId);
            const reportingManagersModel = this.getView()?.getModel("reportingManagers") as JSONModel;
            const reportingManagers = reportingManagersModel?.getProperty("/managers") || [];
            const managerRecord = reportingManagers.find((item: any) => item.employeeId === employee.managerId);
            const selfProfile = {
                employeeId: employee.employeeId || managerId,
                name: employee.name || "",
                email: employee.email || "",
                managerId: employee.managerId || "",
                managerLabel: managerRecord ? `${managerRecord.name} (${managerRecord.employeeId})` : (employee.managerId || ""),
                team: "CIS",
                subTeam: employee.subTeam || "Team 1",
                experience: Number(employee.experience || 0),
                location: profile?.location || employee.location || "",
                tLevel: profile?.tLevel || employee.tLevel || "",
                gradeLevel: profile?.gradeLevel || employee.gradeLevel || "",
                professionalRole: "Manager",
                specialization: profile?.specialization || ""
            };

            this.getView()?.setModel(new JSONModel(selfProfile), "selfProfile");

            const currentUserModel = this.getOwnerComponent()?.getModel("currentUser") as JSONModel;
            currentUserModel?.setData({
                ...(currentUserModel?.getData() || {}),
                id: employee.employeeId,
                managerId: employee.employeeId,
                name: employee.name,
                role: employee.role || "Manager",
                team: "CIS",
                subTeam: employee.subTeam,
                email: employee.email,
                location: selfProfile.location,
                tLevel: selfProfile.tLevel,
                gradeLevel: selfProfile.gradeLevel,
                experience: selfProfile.experience,
                isLoggedIn: true
            });
        } catch (error) {
            console.error("❌ Error loading manager self profile:", error);
            this.getView()?.setModel(new JSONModel({}), "selfProfile");
        }
    }

    private isValidEmail(email: string): boolean {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    public onEditMyProfile(): void {
        const selfProfileModel = this.getView()?.getModel("selfProfile") as JSONModel;
        this.managerProfileSnapshot = JSON.parse(JSON.stringify(selfProfileModel?.getData() || {}));
        selfProfileModel?.setProperty("/team", "CIS");

        const managerProfileUiModel = this.getView()?.getModel("managerProfileUi") as JSONModel;
        managerProfileUiModel?.setProperty("/isEditing", true);
    }

    public onCancelMyProfileEdit(): void {
        const selfProfileModel = this.getView()?.getModel("selfProfile") as JSONModel;
        if (selfProfileModel && this.managerProfileSnapshot) {
            selfProfileModel.setData(JSON.parse(JSON.stringify(this.managerProfileSnapshot)));
        }

        const managerProfileUiModel = this.getView()?.getModel("managerProfileUi") as JSONModel;
        managerProfileUiModel?.setProperty("/isEditing", false);
    }

    public async onSaveMyProfile(): Promise<void> {
        try {
            const managerId = this.currentManagerId;
            if (!managerId) {
                MessageToast.show("Manager information not available");
                return;
            }

            const selfProfileModel = this.getView()?.getModel("selfProfile") as JSONModel;
            const profileData = selfProfileModel?.getData();
            const managerSelect = this.byId("managerReportingManagerSelect") as any;
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

            const rawSubTeam = String(profileData?.subTeam || "").trim();
            const normalizedSubTeam = /^Team\s*[1-9]$/i.test(rawSubTeam)
                ? rawSubTeam.replace(/\s+/g, " ")
                : (/^Nirmala Team$/i.test(rawSubTeam) ? "Nirmala Team" : "");

            if (!normalizedSubTeam) {
                MessageToast.show("Please select sub-team from Team 1 to Team 9 or Nirmala Team");
                return;
            }

            if (!selectedManagerId) {
                MessageToast.show("Please select your reporting manager");
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

            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            const lastUpdated = new Date().toISOString();

            const employeeBinding = oDataModel.bindList("/Employees");
            employeeBinding.filter([new Filter("employeeId", FilterOperator.EQ, managerId)]);
            const employeeContexts = await employeeBinding.requestContexts(0, 1);

            if (employeeContexts.length === 0) {
                MessageToast.show("Manager record not found");
                return;
            }

            const employeeContext = employeeContexts[0];
            employeeContext.setProperty("name", profileData.name.trim());
            employeeContext.setProperty("email", profileData.email.trim());
            employeeContext.setProperty("team", "CIS");
            employeeContext.setProperty("subTeam", normalizedSubTeam);
            employeeContext.setProperty("managerId", selectedManagerId);
            employeeContext.setProperty("experience", Number(profileData.experience || 0));
            employeeContext.setProperty("location", profileData.location.trim());
            employeeContext.setProperty("tLevel", profileData.tLevel);
            employeeContext.setProperty("gradeLevel", profileData.gradeLevel);

            const profileBinding = oDataModel.bindList("/Profiles");
            profileBinding.filter([new Filter("employeeId", FilterOperator.EQ, managerId)]);
            const profileContexts = await profileBinding.requestContexts(0, 1);

            if (profileContexts.length > 0) {
                const profileContext = profileContexts[0];
                profileContext.setProperty("role", "Manager");
                profileContext.setProperty("location", profileData.location.trim());
                profileContext.setProperty("tLevel", profileData.tLevel);
                profileContext.setProperty("gradeLevel", profileData.gradeLevel);
                profileContext.setProperty("specialization", profileData.specialization.trim());
                profileContext.setProperty("lastUpdated", lastUpdated);
            } else {
                profileBinding.create({
                    employeeId: managerId,
                    role: "Manager",
                    location: profileData.location.trim(),
                    tLevel: profileData.tLevel,
                    gradeLevel: profileData.gradeLevel,
                    specialization: profileData.specialization.trim(),
                    lastUpdated: lastUpdated
                });
            }

            await oDataModel.submitBatch(oDataModel.getUpdateGroupId());
            employeeBinding.refresh();
            profileBinding.refresh();

            const currentUserModel = this.getOwnerComponent()?.getModel("currentUser") as JSONModel;
            currentUserModel?.setData({
                ...(currentUserModel?.getData() || {}),
                id: managerId,
                managerId: managerId,
                name: profileData.name.trim(),
                role: "Manager",
                email: profileData.email.trim(),
                team: "CIS",
                subTeam: normalizedSubTeam,
                location: profileData.location.trim(),
                tLevel: profileData.tLevel,
                gradeLevel: profileData.gradeLevel,
                experience: Number(profileData.experience || 0),
                isLoggedIn: true
            });

            await this.loadSelfProfile(managerId);

            const managerProfileUiModel = this.getView()?.getModel("managerProfileUi") as JSONModel;
            managerProfileUiModel?.setProperty("/isEditing", false);
            this.managerProfileSnapshot = null;

            MessageToast.show("Profile updated successfully");
        } catch (error) {
            console.error("❌ Error saving manager profile:", error);
            MessageToast.show("Error saving profile");
        }
    }

    private async loadReportingManagers(currentManagerId: string): Promise<void> {
        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            const listBinding = oDataModel.bindList("/Employees");
            const roleFilter = new Filter({
                filters: [
                    new Filter("role", FilterOperator.EQ, "Manager"),
                    new Filter("role", FilterOperator.EQ, "SeniorManager")
                ],
                and: false
            });
            listBinding.filter([roleFilter]);

            const contexts = await listBinding.requestContexts(0, 200);
            const managers = contexts
                .map((context: any) => context.getObject())
                .filter((manager: any) => manager?.employeeId && manager.employeeId !== currentManagerId)
                .sort((a: any, b: any) => String(a.name || "").localeCompare(String(b.name || "")));

            this.getView()?.setModel(new JSONModel({ managers }), "reportingManagers");
        } catch (error) {
            console.error("❌ Error loading reporting managers:", error);
            this.getView()?.setModel(new JSONModel({ managers: [] }), "reportingManagers");
        }
    }

    /**
     * Get employee skills from OData
     */
    private async getEmployeeSkills(employeeId: string): Promise<any[]> {
        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            const listBinding = oDataModel.bindList("/Skills");
            listBinding.filter([new Filter("employeeId", FilterOperator.EQ, employeeId)]);
            
            const contexts = await listBinding.requestContexts();
            return contexts.map((context: any) => context.getObject());
        } catch (error) {
            console.error(`Error loading skills for ${employeeId}:`, error);
            return [];
        }
    }

    /**
     * Get employee projects from OData
     */
    private async getEmployeeProjects(employeeId: string): Promise<any[]> {
        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            const historyBinding = oDataModel.bindList("/Projects");
            historyBinding.filter([new Filter("employeeId", FilterOperator.EQ, employeeId)]);
            const allCurrentBinding = oDataModel.bindList("/CurrentProjects");
            allCurrentBinding.filter([new Filter("employeeId", FilterOperator.EQ, employeeId)]);

            const [historyContexts, currentContexts] = await Promise.all([
                historyBinding.requestContexts(0, 1000),
                allCurrentBinding.requestContexts(0, 1000)
            ]);

            const currentItems = currentContexts.map((ctx: any) => ctx.getObject()).map((obj: any) => ({
                projectName: obj.projectName,
                role: obj.role || "Team Member",
                startDate: obj.startDate,
                endDate: obj.endDate,
                duration: "",
                status: obj.assignmentStatus || "Assigned"
            }));

            const historyItems = historyContexts.map((ctx: any) => ctx.getObject());
            const combined = [...historyItems, ...currentItems];
            const seen = new Set<string>();
            return combined.filter((item: any) => {
                const key = [item.projectName || "", item.role || "", item.startDate || "", item.endDate || ""].join("|");
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
        } catch (error) {
            console.error(`Error loading projects for ${employeeId}:`, error);
            return [];
        }
    }

    private async hasExistingEmployeeAssignment(
        entityPath: string,
        employeeId: string,
        propertyName: string,
        propertyValue: string,
        extraFilters: Array<{ name: string; value: string }> = []
    ): Promise<boolean> {
        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            const listBinding = oDataModel.bindList(entityPath);
            const filters = [
                new Filter("employeeId", FilterOperator.EQ, employeeId),
                new Filter(propertyName, FilterOperator.EQ, propertyValue),
                ...extraFilters.map((item) => new Filter(item.name, FilterOperator.EQ, item.value))
            ];
            listBinding.filter(filters);

            const contexts = await listBinding.requestContexts(0, 1);
            return contexts.length > 0;
        } catch (error) {
            console.error(`Error checking duplicate assignment in ${entityPath}:`, error);
            return false;
        }
    }

    private async hasDuplicateProjectAssignment(employeeId: string, projectName: string): Promise<boolean> {
        const normalizedProjectName = String(projectName || "").trim();
        if (!normalizedProjectName) return false;

        return this.hasExistingEmployeeAssignment("/CurrentProjects", employeeId, "projectName", normalizedProjectName)
            || this.hasExistingEmployeeAssignment("/Projects", employeeId, "projectName", normalizedProjectName);
    }

    private async hasDuplicateMasterWorkAssignment(
        employeeId: string,
        type: "Initiative" | "Evaluation",
        selectedId: string,
        selectedName: string
    ): Promise<boolean> {
        const normalizedName = String(selectedName || "").trim();
        const entityPath = type === "Initiative" ? "/CurrentInitiatives" : "/CurrentEvaluations";
        const keyField = type === "Initiative" ? "initiativeId" : "evaluationId";
        const nameField = type === "Initiative" ? "initiativeName" : "evaluationName";
        const historyNameField = "initiativeName";
        const historyNameFilters = type === "Initiative"
            ? [{ name: "type", value: "Initiative" }]
            : [{ name: "type", value: "Evaluation" }];

        if (!selectedId && !normalizedName) return false;

        const [byId, byName] = await Promise.all([
            selectedId ? this.hasExistingEmployeeAssignment(entityPath, employeeId, keyField, String(selectedId)) : Promise.resolve(false),
            normalizedName ? this.hasExistingEmployeeAssignment(entityPath, employeeId, nameField, normalizedName) : Promise.resolve(false)
        ]);

        const historyByName = normalizedName
            ? await this.hasExistingEmployeeAssignment("/Initiatives", employeeId, historyNameField, normalizedName, historyNameFilters)
            : false;

        return byId || byName || historyByName;
    }

    /**
     * Get employee profile from OData
     */
    private async getEmployeeProfile(employeeId: string): Promise<any> {
        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            const listBinding = oDataModel.bindList("/Profiles");
            listBinding.filter([new Filter("employeeId", FilterOperator.EQ, employeeId)]);
            
            const contexts = await listBinding.requestContexts();
            const profiles = contexts.map((context: any) => context.getObject());
            return profiles.length > 0 ? profiles[0] : null;
        } catch (error) {
            console.error(`Error loading profile for ${employeeId}:`, error);
            return null;
        }
    }

    /**
     * Get current assignments (projects + initiatives + evaluations) for an employee
     */
    private async getCurrentProjects(employeeId: string): Promise<any[]> {
        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            const cpBinding = oDataModel.bindList("/CurrentProjects");
            cpBinding.filter([new Filter("employeeId", FilterOperator.EQ, employeeId)]);
            const ciBinding = oDataModel.bindList("/CurrentInitiatives");
            ciBinding.filter([new Filter("employeeId", FilterOperator.EQ, employeeId)]);
            const ceBinding = oDataModel.bindList("/CurrentEvaluations");
            ceBinding.filter([new Filter("employeeId", FilterOperator.EQ, employeeId)]);

            const [projectContexts, initiativeContexts, evaluationContexts] = await Promise.all([
                cpBinding.requestContexts(0, 1000),
                ciBinding.requestContexts(0, 1000),
                ceBinding.requestContexts(0, 1000)
            ]);

            const projects = projectContexts.map((ctx: any) => ctx.getObject()).map((obj: any) => ({
                ...obj,
                _source: "CurrentProjects"
            }));
            const initiatives = initiativeContexts.map((ctx: any) => ctx.getObject())
                .filter((obj: any) => obj.status !== "Completed")
                .map((obj: any) => ({
                    currentProjectId: obj.currentInitiativeId,
                    currentInitiativeId: obj.currentInitiativeId,
                    employeeId: obj.employeeId,
                    type: "Initiative",
                    projectName: obj.initiativeName,
                    startDate: obj.startDate,
                    endDate: obj.endDate,
                    utilizationPercent: obj.utilizationPercent,
                    description: obj.description,
                    assignmentStatus: "Assigned",
                    lastUpdated: obj.lastUpdated,
                    _source: "CurrentInitiatives"
                }));
            const evaluations = evaluationContexts.map((ctx: any) => ctx.getObject())
                .filter((obj: any) => obj.status !== "Completed")
                .map((obj: any) => ({
                    currentProjectId: obj.currentEvaluationId,
                    currentEvaluationId: obj.currentEvaluationId,
                    employeeId: obj.employeeId,
                    type: "Evaluation",
                    projectName: obj.evaluationName,
                    startDate: obj.startDate,
                    endDate: obj.endDate,
                    utilizationPercent: obj.utilizationPercent,
                    description: obj.description,
                    assignmentStatus: "Assigned",
                    lastUpdated: obj.lastUpdated,
                    _source: "CurrentEvaluations"
                }));

            const completedHistory = await this.getCompletedMasterWorkHistory(employeeId);
            return [...projects, ...initiatives, ...evaluations, ...completedHistory];
        } catch (error) {
            console.error(`Error loading current projects for ${employeeId}:`, error);
            return [];
        }
    }

    private async getCompletedMasterWorkHistory(employeeId: string): Promise<any[]> {
        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            const completedFilters = [
                new Filter("employeeId", FilterOperator.EQ, employeeId),
                new Filter("status", FilterOperator.EQ, "Completed")
            ];
            const initBinding = oDataModel.bindList("/CurrentInitiatives");
            initBinding.filter(completedFilters);
            const evalBinding = oDataModel.bindList("/CurrentEvaluations");
            evalBinding.filter(completedFilters);

            const [initContexts, evalContexts] = await Promise.all([
                initBinding.requestContexts(0, 1000),
                evalBinding.requestContexts(0, 1000)
            ]);

            const completedInitiatives = initContexts.map((ctx: any) => ctx.getObject()).map((obj: any) => ({
                employeeId: obj.employeeId,
                type: "Initiative",
                projectName: obj.initiativeName,
                startDate: obj.startDate,
                endDate: obj.endDate,
                utilizationPercent: obj.utilizationPercent,
                assignmentStatus: "Completed",
                _source: "InitiativesHistory"
            }));

            const completedEvaluations = evalContexts.map((ctx: any) => ctx.getObject()).map((obj: any) => ({
                employeeId: obj.employeeId,
                type: "Evaluation",
                projectName: obj.evaluationName,
                startDate: obj.startDate,
                endDate: obj.endDate,
                utilizationPercent: obj.utilizationPercent,
                assignmentStatus: "Completed",
                _source: "InitiativesHistory"
            }));

            return [...completedInitiatives, ...completedEvaluations];
        } catch (error) {
            console.error(`Error loading completed initiative/evaluation history for ${employeeId}:`, error);
            return [];
        }
    }

    private async getCompletedInitiativeEvaluationForTabs(employeeId: string): Promise<{ initiatives: any[]; evaluations: any[] }> {
        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            const completedFilters = [
                new Filter("employeeId", FilterOperator.EQ, employeeId),
                new Filter("status", FilterOperator.EQ, "Completed")
            ];
            const initBinding = oDataModel.bindList("/CurrentInitiatives");
            initBinding.filter(completedFilters);
            const evalBinding = oDataModel.bindList("/CurrentEvaluations");
            evalBinding.filter(completedFilters);

            const [initContexts, evalContexts] = await Promise.all([
                initBinding.requestContexts(0, 1000),
                evalBinding.requestContexts(0, 1000)
            ]);

            const initiatives = initContexts.map((ctx: any) => ctx.getObject()).map((obj: any) => ({
                projectName: obj.initiativeName,
                startDate: obj.startDate,
                endDate: obj.endDate,
                status: "Completed"
            }));

            const evaluations = evalContexts.map((ctx: any) => ctx.getObject()).map((obj: any) => ({
                projectName: obj.evaluationName,
                startDate: obj.startDate,
                endDate: obj.endDate,
                status: "Completed"
            }));

            return { initiatives, evaluations };
        } catch (error) {
            console.error(`Error loading initiative/evaluation tabs history for ${employeeId}:`, error);
            return { initiatives: [], evaluations: [] };
        }
    }

    private resetAssignmentPanelFields(): void {
        (this.byId("assignProjectComboBox") as any)?.setSelectedKey("");
        (this.byId("assignProjectRoleCombo") as any)?.setSelectedKey("Team Member");
        (this.byId("assignProjectAllocationInput") as any)?.setValue(100);

        (this.byId("assignInitiativeComboBox") as any)?.setSelectedKey("");
        (this.byId("assignInitiativeAllocationInput") as any)?.setValue(100);

        (this.byId("assignEvaluationComboBox") as any)?.setSelectedKey("");
        (this.byId("assignEvaluationAllocationInput") as any)?.setValue(100);
    }

    private updateAnalytics(): void {
        // Get employees from the manager-specific model (already filtered)
        const managerEmployeesModel = this.getView()?.getModel("managerEmployees") as JSONModel;
        const employees = managerEmployeesModel?.getData()?.employees || [];
        
        console.log("Updating analytics with manager's employees:", employees);
        
        if (employees.length === 0) {
            console.warn("No employees data available for analytics");
            // Set default values when no employees
            this.setAnalyticsDefaults();
            return;
        }
        
        // Calculate statistics for manager's team only
        const totalEmployees = employees.length;
        const availableEmployees = employees.filter((emp: any) => !emp.working_on_project).length;
        const busyEmployees = employees.filter((emp: any) => emp.working_on_project).length;
        const totalSkills = employees.reduce((sum: number, emp: any) => sum + ((emp.skills || []).length || emp.totalSkills || 0), 0);
        
        // Update statistics controls with error checking
        const updateControl = (id: string, value: number | string, method: string = 'setNumber') => {
            const control = this.byId(id) as any;
            if (control) {
                if (method === 'setNumber') {
                    control.setNumber(value);
                } else if (method === 'setText') {
                    control.setText(value.toString());
                } else if (method === 'setPercentValue') {
                    control.setPercentValue(value);
                }
            } else {
                console.warn(`Control ${id} not found`);
            }
        };
        
        updateControl("totalEmployeesCount", totalEmployees);
        updateControl("availableEmployeesCount", availableEmployees);
        updateControl("busyEmployeesCount", busyEmployees);
        updateControl("totalSkillsCount", totalSkills);
        
        // Calculate utilization rate
        const utilizationRate = totalEmployees > 0 ? Math.round((busyEmployees / totalEmployees) * 100) : 0;
        updateControl("utilizationRate", utilizationRate + "%", "setText");
        updateControl("utilizationProgress", utilizationRate, "setPercentValue");
        
        // Calculate average skills per employee
        const avgSkills = totalEmployees > 0 ? Math.round(totalSkills / totalEmployees) : 0;
        updateControl("avgSkillsPerEmployee", avgSkills.toString(), "setText");
        
        // Calculate most common skill level from the manager team dataset.
        const teamSkills = employees.flatMap((emp: any) => emp.skills || []);
        const commonLevel = this.getCommonSkillLevel(teamSkills);
        updateControl("commonSkillLevel", commonLevel, "setText");
        
        console.log("Analytics updated for manager's team:", { 
            totalEmployees, availableEmployees, busyEmployees, totalSkills, 
            utilizationRate, avgSkills, commonLevel 
        });
    }

    private setAnalyticsDefaults(): void {
        const updateControl = (id: string, value: number | string, method: string = 'setNumber') => {
            const control = this.byId(id) as any;
            if (control) {
                if (method === 'setNumber') {
                    control.setNumber(value);
                } else if (method === 'setText') {
                    control.setText(value.toString());
                } else if (method === 'setPercentValue') {
                    control.setPercentValue(value);
                }
            }
        };
        
        updateControl("totalEmployeesCount", 0);
        updateControl("availableEmployeesCount", 0);
        updateControl("busyEmployeesCount", 0);
        updateControl("totalSkillsCount", 0);
        updateControl("utilizationRate", "0%", "setText");
        updateControl("utilizationProgress", 0, "setPercentValue");
        updateControl("avgSkillsPerEmployee", "0", "setText");
        updateControl("commonSkillLevel", "N/A", "setText");
    }

    private getCommonSkillLevel(skills: any[]): string {
        if (skills.length === 0) return "N/A";
        
        const levelCounts: { [key: string]: number } = {};
        skills.forEach((skill: any) => {
            const level = skill.proficiencyLevel || "Beginner";
            levelCounts[level] = (levelCounts[level] || 0) + 1;
        });
        
        let maxLevel = "Beginner";
        let maxCount = 0;
        for (const [level, count] of Object.entries(levelCounts)) {
            if (count > maxCount) {
                maxCount = count;
                maxLevel = level;
            }
        }
        
        return maxLevel;
    }

    // ==================== DATA VISUALIZATION METHODS ====================

    /**
     * Initialize visualization data
     */
    private async initializeVisualization(): Promise<void> {
        console.log("📊 Initializing Data Visualization...");
        
        const currentYear = new Date().getFullYear();
        const visualizationModel = new JSONModel({
            selectedYear: currentYear.toString(),
            selectedQuarter: "ALL",
            availabilityForecast: [],
            utilizationData: {
                currentProjects: { utilized: 0, available: 0 },
                initiatives: { utilized: 0, available: 0 }
            },
            ganttData: []
        });
        
        this.getView()?.setModel(visualizationModel, "visualization");
        
        // Load visualization data
        await this.loadVisualizationData();
    }

    /**
     * Load all visualization data
     */
    private async loadVisualizationData(): Promise<void> {
        try {
            const managerEmployeesModel = this.getView()?.getModel("managerEmployees") as JSONModel;
            const employees = managerEmployeesModel?.getData()?.employees || [];
            
            if (employees.length === 0) {
                console.warn("No employees loaded for visualization");
                return;
            }

            console.log(`📊 Loading visualization data for ${employees.length} employees`);

            // Load utilization data for all employees
            const utilizationPromises = employees.map(async (emp: any) => ({
                employee: emp,
                currentProjects: await this.getCurrentProjects(emp.employeeId),
                projects: await this.getEmployeeProjects(emp.employeeId)
            }));

            const allUtilizationData = await Promise.all(utilizationPromises);

            // Calculate utilization percentages
            this.calculateUtilizationMetrics(allUtilizationData);

            // Generate availability forecast
            this.generateAvailabilityForecast(allUtilizationData);

            // Generate Gantt chart data
            this.generateGanttData(allUtilizationData);

            // Render charts
            this.renderUtilizationCharts();
            this.renderGanttChart();
            this.renderSkillsDistribution();

            console.log("✅ Visualization data loaded successfully");
        } catch (error) {
            console.error("❌ Error loading visualization data:", error);
        }
    }

    /**
     * Calculate utilization metrics as team-capacity percentages per employee-month.
     */
    private calculateUtilizationMetrics(allData: any[]): void {
        const totalEmployees = allData.length;
        
        // Get selected year and quarter from visualization model
        const visualizationModel = this.getView()?.getModel("visualization") as JSONModel;
        const selectedYear = Number(visualizationModel?.getProperty("/selectedYear") || new Date().getFullYear());
        const selectedQuarter = visualizationModel?.getProperty("/selectedQuarter") || "ALL";
        
        console.log(`📊 Calculating utilization for Year: ${selectedYear}, Quarter: ${selectedQuarter}`);
        
        // Determine which months to include based on quarter
        let monthsToInclude: number[] = [];
        if (selectedQuarter === "Q1") {
            monthsToInclude = [1, 2, 3]; // Jan, Feb, Mar
        } else if (selectedQuarter === "Q2") {
            monthsToInclude = [4, 5, 6]; // Apr, May, Jun
        } else if (selectedQuarter === "Q3") {
            monthsToInclude = [7, 8, 9]; // Jul, Aug, Sep
        } else if (selectedQuarter === "Q4") {
            monthsToInclude = [10, 11, 12]; // Oct, Nov, Dec
        } else {
            monthsToInclude = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]; // All months
        }
        
        // Team allocation must be average employee capacity usage (not month-weighted dilution).
        let currentProjectsTotal = 0;
        let currentProjectsCount = 0;
        let initiativesTotal = 0;
        let initiativesCount = 0;

        allData.forEach(empData => {
            let employeeProjectUtilization = 0;
            let employeeInitiativeUtilization = 0;

            const activeAssignments = (empData.currentProjects || []).filter((cp: any) => {
                if (cp.assignmentStatus === "Completed") return false;
                if (!cp.startDate || !cp.endDate) return true;
                return this.isActiveInPeriod(cp.startDate, cp.endDate, selectedYear, monthsToInclude);
            });

            const projects = activeAssignments.filter((cp: any) => cp.type === "Project");
            const initiatives = activeAssignments.filter((cp: any) =>
                cp.type === "Initiative" || cp.type === "Evaluation" || cp.type === "CAIA" || cp.type === "POC"
            );

            projects.forEach((cp: any) => {
                const utilizationPercent = Math.max(0, Number(cp.utilizationPercent) || 0);
                employeeProjectUtilization += utilizationPercent;
                currentProjectsCount++;
            });

            initiatives.forEach((initiative: any) => {
                const utilizationPercent = Math.max(0, Number(initiative.utilizationPercent) || 0);
                employeeInitiativeUtilization += utilizationPercent;
                initiativesCount++;
            });

            currentProjectsTotal += Math.min(100, employeeProjectUtilization);
            initiativesTotal += Math.min(100, employeeInitiativeUtilization);
        });

        const teamCapacity = Math.max(1, totalEmployees);
        const currentProjectsUtilized = Math.min(100, Math.round(currentProjectsTotal / teamCapacity));
        const initiativesUtilized = Math.min(100, Math.round(initiativesTotal / teamCapacity));

        console.log(`📊 Utilization: CP=${currentProjectsUtilized}% (${currentProjectsCount} assignments), Initiatives=${initiativesUtilized}% (${initiativesCount} assignments), Team=${totalEmployees}`);

        // Update visualization model
        const vizModel = this.getView()?.getModel("visualization") as JSONModel;
        vizModel?.setProperty("/utilizationData", {
            currentProjects: {
                utilized: currentProjectsUtilized,
                available: Math.max(0, 100 - currentProjectsUtilized),
                count: currentProjectsCount
            },
            initiatives: {
                utilized: initiativesUtilized,
                available: Math.max(0, 100 - initiativesUtilized),
                count: initiativesCount
            },
            teamSize: totalEmployees
        });
    }

    /**
     * Check if a date range is active in a specific month/year
     */
    private isActiveInMonth(startDate: string, endDate: string, year: number, month: number): boolean {
        if (!startDate || !endDate) return false;
        
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        // First day of the target month
        const monthStart = new Date(year, month - 1, 1);
        // Last day of the target month
        const monthEnd = new Date(year, month, 0);
        
        // Check if the date range overlaps with the month
        return start <= monthEnd && end >= monthStart;
    }

    /**
     * Check if a date range is active today
     */
    private isActiveToday(startDate: string, endDate: string, today: Date): boolean {
        if (!startDate || !endDate) return false;
        
        const start = new Date(startDate);
        const end = new Date(endDate);
        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);
        
        return today >= start && today <= end;
    }

    /**
     * Check if a date range is active in the selected period (year + months)
     */
    private isActiveInPeriod(startDate: string, endDate: string, year: number, months: number[]): boolean {
        if (!startDate || !endDate) return false;
        
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        // Check if the date range overlaps with any of the specified months in the year
        return months.some(month => {
            const monthStart = new Date(year, month - 1, 1);
            const monthEnd = new Date(year, month, 0);
            return start <= monthEnd && end >= monthStart;
        });
    }

    /**
     * Count how many months in the specified period the date range is active
     */
    private countActiveMonths(startDate: string, endDate: string, year: number, months: number[]): number {
        if (!startDate || !endDate) return 0;
        
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        let count = 0;
        months.forEach(month => {
            const monthStart = new Date(year, month - 1, 1);
            const monthEnd = new Date(year, month, 0);
            // Check if the date range overlaps with this month
            if (start <= monthEnd && end >= monthStart) {
                count++;
            }
        });
        
        return count;
    }

    /**
     * Generate availability forecast (next 6 months - 50% team capacity)
     */
    private generateAvailabilityForecast(allData: any[]): void {
        const totalEmployees = allData.length;
        const forecast: any[] = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Generate forecast for next 6 months
        for (let i = 0; i < 6; i++) {
            const targetDate = new Date(today);
            targetDate.setMonth(today.getMonth() + i + 1);
            targetDate.setDate(1); // First day of month
            const lastDayOfTargetMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);
            
            const monthName = targetDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
            
            // Find employees who will be available in this month
            // An employee is available if they have NO active projects during this month
            const availableEmployees = allData.filter(d => {
                // If employee has no current projects at all, they're available
                if (!d.currentProjects || d.currentProjects.length === 0) {
                    return true;
                }
                
                // Check if employee has any project active during the target month
                const hasActiveProjectInMonth = d.currentProjects.some((cp: any) => {
                    if (!cp.startDate || !cp.endDate) return false;
                    if (cp.assignmentStatus === "Completed") return false;
                    
                    const projectStart = new Date(cp.startDate);
                    const projectEnd = new Date(cp.endDate);
                    projectStart.setHours(0, 0, 0, 0);
                    projectEnd.setHours(0, 0, 0, 0);
                    
                    // Check if project overlaps with target month
                    // Project is active if: (projectStart <= lastDayOfMonth) AND (projectEnd >= firstDayOfMonth)
                    return projectStart <= lastDayOfTargetMonth && projectEnd >= targetDate;
                });
                
                // Employee is available if they have NO active projects in this month
                return !hasActiveProjectInMonth;
            });
            
            const availableCount = availableEmployees.length;
            const availablePercentage = totalEmployees > 0 ? Math.round((availableCount / totalEmployees) * 100) : 0;
            
            const employeeNames = availableEmployees
                .map((d: any) => d.employee.name)
                .join(", ") || "None";
            
            // Build employee details for dialog
            const employeeDetails = availableEmployees.map((d: any) => {
                // Find the last project ending date if any
                let lastProjectEndDate = "N/A";
                if (d.currentProjects && d.currentProjects.length > 0) {
                    const sortedProjects = d.currentProjects
                        .filter((cp: any) => cp.endDate)
                        .sort((a: any, b: any) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime());
                    if (sortedProjects.length > 0) {
                        lastProjectEndDate = new Date(sortedProjects[0].endDate).toLocaleDateString();
                    }
                }
                
                return {
                    employeeId: d.employee.employeeId,
                    name: d.employee.name,
                    projectEndDate: lastProjectEndDate
                };
            });
            
            forecast.push({
                month: monthName,
                availableCount: availableCount,
                availablePercentage: availablePercentage,
                employeeNames: employeeNames,
                employeeDetails: employeeDetails,
                status: availablePercentage >= 50 ? "High Capacity" : availablePercentage >= 25 ? "Moderate Capacity" : "Low Capacity"
            });
        }
        
        const visualizationModel = this.getView()?.getModel("visualization") as JSONModel;
        visualizationModel?.setProperty("/availabilityForecast", forecast);
        
        console.log("📅 Availability Forecast:", forecast);
    }

    /**
     * Generate Gantt chart data
     */
    private generateGanttData(allData: any[]): void {
        const visualizationModel = this.getView()?.getModel("visualization") as JSONModel;
        const selectedYear = parseInt(visualizationModel?.getProperty("/selectedYear") || new Date().getFullYear());
        const selectedQuarter = visualizationModel?.getProperty("/selectedQuarter") || "ALL";
        
        const ganttData: any[] = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        allData.forEach(d => {
            const employeeData: any = {
                employeeName: d.employee.name,
                employeeId: d.employee.employeeId,
                projects: []
            };

            const upsertProject = (item: any): void => {
                const normalizedType = item.type === "ProjectHistory" ? "Project" : (item.type || "Project");
                const key = [
                    normalizedType,
                    item.projectName || "",
                    item.startDate || "",
                    item.endDate || ""
                ].join("|");

                const existingIndex = employeeData.projects.findIndex((p: any) => {
                    const pType = p.type === "ProjectHistory" ? "Project" : (p.type || "Project");
                    const pKey = [pType, p.projectName || "", p.startDate || "", p.endDate || ""].join("|");
                    return pKey === key;
                });

                if (existingIndex === -1) {
                    employeeData.projects.push(item);
                    return;
                }

                const existing = employeeData.projects[existingIndex];
                const newIsFinished = item.status === "finished";
                const oldIsFinished = existing.status === "finished";

                if (newIsFinished && !oldIsFinished) {
                    employeeData.projects[existingIndex] = {
                        ...existing,
                        ...item,
                        status: "finished",
                        color: "#808080"
                    };
                }
            };
            
            // Separate CurrentProjects by type
            const projectsFromCP = d.currentProjects.filter((cp: any) => cp.type === 'Project');
            const initiativesFromCP = d.currentProjects.filter((cp: any) => 
                cp.type === 'Initiative' || cp.type === 'Evaluation' || cp.type === 'CAIA' || cp.type === 'POC'
            );
            
            // Include Projects from CurrentProjects
            projectsFromCP.forEach((cp: any) => {
                if (!cp.startDate || !cp.endDate) return;
                
                const startDate = new Date(cp.startDate);
                const endDate = new Date(cp.endDate);
                startDate.setHours(0, 0, 0, 0);
                endDate.setHours(0, 0, 0, 0);
                
                // Filter by year
                if (startDate.getFullYear() !== selectedYear && endDate.getFullYear() !== selectedYear) return;
                
                // Determine project status based on dates
                const explicitlyCompleted = String(cp.assignmentStatus || "").toLowerCase() === "completed";
                let status = explicitlyCompleted ? "finished" : "scheduled";
                if (!explicitlyCompleted && endDate < today) {
                    status = "finished"; // Completed projects
                } else if (!explicitlyCompleted && startDate <= today && endDate >= today) {
                    status = "ongoing"; // Ongoing projects
                } else if (!explicitlyCompleted && startDate > today) {
                    status = "scheduled"; // Scheduled/Future projects
                }
                
                upsertProject({
                    projectName: cp.projectName,
                    startDate: cp.startDate,
                    endDate: cp.endDate,
                    utilizationPercent: cp.utilizationPercent,
                    status: status,
                    type: "Project",
                    color: status === "finished" ? "#808080" : status === "ongoing" ? "#2ecc71" : "#0070f2"
                });
            });
            
            // Include Initiatives from CurrentProjects (Initiative, Evaluation, CAIA, POC types)
            initiativesFromCP.forEach((init: any) => {
                if (!init.startDate || !init.endDate) return;
                
                const startDate = new Date(init.startDate);
                const endDate = new Date(init.endDate);
                startDate.setHours(0, 0, 0, 0);
                endDate.setHours(0, 0, 0, 0);
                
                // Filter by year
                if (startDate.getFullYear() !== selectedYear && endDate.getFullYear() !== selectedYear) return;
                
                // Determine status based on dates
                const explicitlyCompleted = String(init.assignmentStatus || "").toLowerCase() === "completed";
                let status = explicitlyCompleted ? "finished" : "scheduled";
                if (!explicitlyCompleted && endDate < today) {
                    status = "finished";
                } else if (!explicitlyCompleted && startDate <= today && endDate >= today) {
                    status = "ongoing";
                } else if (!explicitlyCompleted && startDate > today) {
                    status = "scheduled";
                }
                
                const typeLabel = init.type || "Initiative";
                let color = "#f39c12";
                if (typeLabel === "Evaluation") {
                    color = "#8e44ad";
                } else if (typeLabel === "CAIA") {
                    color = "#16a085";
                } else if (typeLabel === "POC") {
                    color = "#d35400";
                }

                if (status === "finished") {
                    color = "#808080";
                }
                
                upsertProject({
                    projectName: init.projectName,
                    description: init.description,
                    startDate: init.startDate,
                    endDate: init.endDate,
                    utilizationPercent: init.utilizationPercent,
                    status: status,
                    type: init.type,
                    typeLabel: typeLabel,
                    color: color
                });
            });

            // Include historical Projects (project history)
            d.projects.forEach((proj: any) => {
                if (!proj.startDate || !proj.endDate) return;

                const startDate = new Date(proj.startDate);
                const endDate = new Date(proj.endDate);
                startDate.setHours(0, 0, 0, 0);
                endDate.setHours(0, 0, 0, 0);

                // Filter by year - include if either start or end year matches, or project spans it
                if (startDate.getFullYear() !== selectedYear && endDate.getFullYear() !== selectedYear &&
                    !(startDate.getFullYear() < selectedYear && endDate.getFullYear() > selectedYear)) return;

                // Historical projects are always "finished" unless still running
                const explicitCompleted = String(proj.status || "").toLowerCase() === "completed";
                const status = explicitCompleted ? "finished" : (endDate < today ? "finished" : (startDate <= today ? "ongoing" : "scheduled"));

                upsertProject({
                    projectName: proj.projectName,
                    startDate: proj.startDate,
                    endDate: proj.endDate,
                    status: status,
                    type: "Project",
                    typeLabel: "History",
                    color: status === "finished" ? "#808080" : status === "ongoing" ? "#2ecc71" : "#0070f2"
                });
            });

            // Only add employee to gantt data if they have projects/initiatives
            if (employeeData.projects.length > 0) {
                ganttData.push(employeeData);
            }
        });
        
        visualizationModel?.setProperty("/ganttData", ganttData);
        console.log("📊 Gantt Data Generated:", ganttData.length, "employees with projects/initiatives");
    }

    /**
     * Render utilization donut charts
     */
    private renderUtilizationCharts(): void {
        const visualizationModel = this.getView()?.getModel("visualization") as JSONModel;
        const utilizationData = visualizationModel?.getProperty("/utilizationData");
        
        console.log("📊 Rendering utilization charts with data:", utilizationData);
        
        if (!utilizationData) {
            console.error("❌ No utilization data found for rendering");
            return;
        }
        
        // Update percentage text
        const currentProjectsUtilized = utilizationData.currentProjects?.utilized || 0;
        const currentProjectsAvailable = utilizationData.currentProjects?.available || 100;
        const initiativesUtilized = utilizationData.initiatives?.utilized || 0;
        const initiativesAvailable = utilizationData.initiatives?.available || 100;
        
        (this.byId("currentProjectsUtilized") as any)?.setText(`${currentProjectsUtilized}%`);
        (this.byId("currentProjectsAvailable") as any)?.setText(`${currentProjectsAvailable}%`);
        (this.byId("initiativesUtilized") as any)?.setText(`${initiativesUtilized}%`);
        (this.byId("initiativesAvailable") as any)?.setText(`${initiativesAvailable}%`);
        
        console.log(`📊 Rendering charts - CP: ${currentProjectsUtilized}%, Initiatives: ${initiativesUtilized}%`);
        
        // Render SVG donut charts
        this.renderDonutChart("currentProjectsChart", currentProjectsUtilized, "#0070f2");
        this.renderDonutChart("initiativesChart", initiativesUtilized, "#2ecc71");
    }

    /**
     * Render a single donut chart using SVG
     */
    private renderDonutChart(containerId: string, percentage: number, color: string): void {
        const container = this.byId(containerId);
        if (!container) {
            console.warn(`⚠️ Container ${containerId} not found for donut chart`);
            return;
        }
        
        console.log(`📊 Rendering donut chart in ${containerId}: ${percentage}%`);
        
        // Ensure percentage is valid
        const validPercentage = Math.max(0, Math.min(100, percentage || 0));
        
        const size = 200;
        const strokeWidth = 20;
        const radius = (size - strokeWidth) / 2;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference - (validPercentage / 100) * circumference;
        
        const svg = `
            <svg width="${size}" height="${size}" class="donutChart">
                <!-- Background circle -->
                <circle
                    cx="${size / 2}"
                    cy="${size / 2}"
                    r="${radius}"
                    fill="none"
                    stroke="#e0e0e0"
                    stroke-width="${strokeWidth}"
                />
                <!-- Progress circle -->
                <circle
                    cx="${size / 2}"
                    cy="${size / 2}"
                    r="${radius}"
                    fill="none"
                    stroke="${color}"
                    stroke-width="${strokeWidth}"
                    stroke-dasharray="${circumference}"
                    stroke-dashoffset="${offset}"
                    stroke-linecap="round"
                    transform="rotate(-90 ${size / 2} ${size / 2})"
                    style="transition: stroke-dashoffset 0.5s ease;"
                />
                <!-- Center text -->
                <text
                    x="${size / 2}"
                    y="${size / 2}"
                    text-anchor="middle"
                    dominant-baseline="central"
                    font-size="32"
                    font-weight="bold"
                    fill="${color}"
                >
                    ${validPercentage}%
                </text>
            </svg>
        `;
        
        try {
            (container as any).removeAllItems();
            const html = new HTML({
                content: svg
            });
            (container as any).addItem(html);
            console.log(`✅ Chart rendered successfully in ${containerId}`);
        } catch (error) {
            console.error(`❌ Error rendering chart in ${containerId}:`, error);
        }
    }

    /**
     * Render Skills Distribution Chart
     */
    private renderSkillsDistribution(): void {
        const container = this.byId("skillsDistributionChart");
        if (!container) return;

        (container as any).removeAllItems();

        // Get all team members' skills
        const managerEmployeesModel = this.getView()?.getModel("managerEmployees") as JSONModel;
        const employees = managerEmployeesModel?.getData()?.employees || [];

        if (employees.length === 0) {
            (container as any).addItem(new Text({ text: "No team data available" }));
            return;
        }

        // Count skills across team
        const skillCounts: { [key: string]: { count: number, avgProficiency: number, totalProficiency: number } } = {};

        employees.forEach((emp: any) => {
            const skills = emp.skills || [];
            skills.forEach((skill: any) => {
                const skillName = skill.skillName;
                const proficiency = this.getProficiencyLevel(skill.proficiencyLevel);
                
                if (!skillCounts[skillName]) {
                    skillCounts[skillName] = { count: 0, totalProficiency: 0, avgProficiency: 0 };
                }
                skillCounts[skillName].count++;
                skillCounts[skillName].totalProficiency += proficiency;
            });
        });

        // Calculate averages and sort by count
        const skillsArray = Object.entries(skillCounts).map(([name, data]) => ({
            name,
            count: data.count,
            avgProficiency: Math.round((data.totalProficiency / data.count) * 10) / 10,
            percentage: Math.round((data.count / employees.length) * 100)
        })).sort((a, b) => b.count - a.count);

        if (skillsArray.length === 0) {
            (container as any).addItem(new Text({ text: "No skills found in team" }));
            return;
        }

        // Show top 10 skills
        const topSkills = skillsArray.slice(0, 10);

        topSkills.forEach(skill => {
            const skillName = new Text({ text: skill.name }).addStyleClass("sapUiSmallMarginEnd");
            const skillStats = new Text({ 
                text: `${skill.count}/${employees.length} (${skill.percentage}%) - Avg: ${skill.avgProficiency}/5`
            });
            
            const skillBox = new VBox({
                items: [
                    new HBox({
                        justifyContent: "SpaceBetween",
                        items: [skillName, skillStats]
                    }),
                    new ProgressIndicator({
                        percentValue: skill.percentage,
                        displayValue: `${skill.percentage}%`,
                        state: skill.percentage >= 75 ? "Success" : skill.percentage >= 50 ? "Warning" : "Information"
                    })
                ]
            }).addStyleClass("sapUiSmallMarginBottom");

            (container as any).addItem(skillBox);
        });
    }

    /**
     * Get numeric proficiency level
     */
    private getProficiencyLevel(level: string): number {
        const levels: { [key: string]: number } = {
            "Beginner": 1,
            "Intermediate": 2,
            "Advanced": 3,
            "Expert": 4,
            "Master": 5
        };
        return levels[level] || 2;
    }

    /**
     * Render Gantt chart
     */
    private renderGanttChart(): void {
        const visualizationModel = this.getView()?.getModel("visualization") as JSONModel;
        const ganttData = visualizationModel?.getProperty("/ganttData") || [];
        const selectedYear = parseInt(visualizationModel?.getProperty("/selectedYear") || new Date().getFullYear());
        const selectedQuarter = visualizationModel?.getProperty("/selectedQuarter") || "ALL";
        
        const container = this.byId("ganttChartContainer");
        if (!container) return;
        
        (container as any).removeAllItems();
        
        if (ganttData.length === 0) {
            const emptyText = new Text({
                text: "No project data available for the selected period"
            });
            (container as any).addItem(emptyText);
            return;
        }
        
        // Determine months to display
        let months: string[] = [];
        let monthNumbers: number[] = [];
        
        if (selectedQuarter === "ALL") {
            months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            monthNumbers = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
        } else {
            const quarterMonths: { [key: string]: { names: string[], numbers: number[] } } = {
                "Q1": { names: ["January", "February", "March"], numbers: [0, 1, 2] },
                "Q2": { names: ["April", "May", "June"], numbers: [3, 4, 5] },
                "Q3": { names: ["July", "August", "September"], numbers: [6, 7, 8] },
                "Q4": { names: ["October", "November", "December"], numbers: [9, 10, 11] }
            };
            months = quarterMonths[selectedQuarter].names;
            monthNumbers = quarterMonths[selectedQuarter].numbers;
        }
        
        // Create header
        const headerHtml = `
            <div class="ganttHeader">
                <div class="ganttHeaderLabel">Team Member</div>
                <div class="ganttHeaderMonths">
                    ${months.map(month => `<div class="ganttHeaderMonth">${month}</div>`).join('')}
                </div>
            </div>
        `;
        
        const header = new HTML({ content: headerHtml });
        (container as any).addItem(header);
        
        // Create rows for each employee
        ganttData.forEach((empData: any) => {
            const rowHtml = this.createGanttRow(empData, selectedYear, monthNumbers, months.length);
            const row = new HTML({ content: rowHtml });
            (container as any).addItem(row);
        });
    }

    /**
     * Create a Gantt chart row for an employee
     */
    private createGanttRow(empData: any, year: number, monthNumbers: number[], totalMonths: number): string {
        let barsHtml = '';
        
        // First, calculate positions for all projects to detect overlaps
        const projectsWithPositions: any[] = [];
        
        empData.projects.forEach((project: any) => {
            const startDate = new Date(project.startDate);
            const endDate = new Date(project.endDate);
            
            // Get month and day information
            const startMonth = startDate.getMonth();
            const endMonth = endDate.getMonth();
            const startYear = startDate.getFullYear();
            const endYear = endDate.getFullYear();
            const startDay = startDate.getDate();
            const endDay = endDate.getDate();
            
            // Check if project overlaps with selected months
            const startIndex = monthNumbers.indexOf(startMonth);
            const endIndex = monthNumbers.indexOf(endMonth);

            // Check if project completely spans the visible range
            // (starts before first visible month AND ends after last visible month)
            const firstVisibleMonth = monthNumbers[0];
            const lastVisibleMonth = monthNumbers[monthNumbers.length - 1];
            
            // Account for year differences when determining if project spans the range
            const startsBeforeRange = (startYear < year) || (startYear === year && startMonth < firstVisibleMonth);
            const endsAfterRange = (endYear > year) || (endYear === year && endMonth > lastVisibleMonth);
            const spansEntireRange = startsBeforeRange && endsAfterRange;

            if (startIndex === -1 && endIndex === -1 && !spansEntireRange) return; // Skip if not in range at all
            
            // Calculate precise position with day-level accuracy and year awareness
            let leftPercent = 0;
            let widthPercent = 0;
            
            if (spansEntireRange) {
                // Project covers entire visible range — full width bar
                leftPercent = 0;
                widthPercent = 100;
            } else if (startYear === year && endYear === year && startIndex !== -1 && endIndex !== -1) {
                // Both start and end are in the same visible year
                const daysInStartMonth = new Date(startDate.getFullYear(), startMonth + 1, 0).getDate();
                const daysInEndMonth = new Date(endDate.getFullYear(), endMonth + 1, 0).getDate();
                
                // Calculate left position: which month + day offset within that month
                const dayOffsetInStartMonth = (startDay - 1) / daysInStartMonth;
                leftPercent = ((startIndex + dayOffsetInStartMonth) / totalMonths) * 100;
                
                // Calculate width: number of months spanned + day fractions
                const monthsSpanned = endIndex - startIndex;
                const endDayFraction = endDay / daysInEndMonth;
                
                if (monthsSpanned === 0) {
                    // Same month - just calculate days between
                    const daysSpanned = endDay - startDay + 1;
                    widthPercent = ((daysSpanned / daysInStartMonth) / totalMonths) * 100;
                } else {
                    // Multiple months - calculate total width including partial months
                    const startDayFraction = (daysInStartMonth - startDay + 1) / daysInStartMonth;
                    widthPercent = ((startDayFraction + (monthsSpanned - 1) + endDayFraction) / totalMonths) * 100;
                }
            } else if (startYear === year && startIndex !== -1) {
                // Only start is in same year, extends beyond visible range
                const daysInStartMonth = new Date(startDate.getFullYear(), startMonth + 1, 0).getDate();
                const dayOffsetInStartMonth = (startDay - 1) / daysInStartMonth;
                leftPercent = ((startIndex + dayOffsetInStartMonth) / totalMonths) * 100;
                widthPercent = ((totalMonths - startIndex - dayOffsetInStartMonth) / totalMonths) * 100;
            } else if (endYear === year && endIndex !== -1) {
                // Only end is in same year, starts before visible range
                const daysInEndMonth = new Date(endDate.getFullYear(), endMonth + 1, 0).getDate();
                const endDayFraction = endDay / daysInEndMonth;
                leftPercent = 0;
                widthPercent = ((endIndex + endDayFraction) / totalMonths) * 100;
            }
            
            projectsWithPositions.push({
                ...project,
                leftPercent,
                widthPercent
            });
        });
        
        // Detect overlaps and assign stacking lanes
        const lanes: number[] = new Array(projectsWithPositions.length).fill(0);
        for (let i = 0; i < projectsWithPositions.length; i++) {
            const usedLanes = new Set<number>();
            for (let j = 0; j < i; j++) {
                const p1 = projectsWithPositions[i];
                const p2 = projectsWithPositions[j];
                const p1Left = p1.leftPercent;
                const p1Right = p1.leftPercent + p1.widthPercent;
                const p2Left = p2.leftPercent;
                const p2Right = p2.leftPercent + p2.widthPercent;
                if (!(p1Right <= p2Left || p2Right <= p1Left)) {
                    usedLanes.add(lanes[j]);
                }
            }
            let lane = 0;
            while (usedLanes.has(lane)) lane++;
            lanes[i] = lane;
        }
        const maxLane = Math.max(0, ...lanes);
        const laneHeight = 34; // px per lane
        const rowPadding = 4;

        // Generate bars for all types so initiatives/evaluations are clearly visible.
        projectsWithPositions.forEach((project: any, index: number) => {
            const lane = lanes[index];
            const color = project.color || "#2ecc71";
            const top = rowPadding + lane * (laneHeight + 2);

            // Create tooltip with all information
            let tooltipText = `${project.projectName} (${project.startDate} to ${project.endDate})`;
            if (project.typeLabel) {
                tooltipText += ` [${project.typeLabel}]`;
            }
            if (project.utilizationPercent) {
                tooltipText += ` - ${project.utilizationPercent}% utilization`;
            }
            if (project.description) {
                tooltipText += ` - ${project.description}`;
            }

            barsHtml += `
                <div class="ganttBar"
                     style="left: ${project.leftPercent}%; width: ${project.widthPercent}%; background-color: ${color}; top: ${top}px; height: 28px; z-index: 5; border: 1px solid rgba(0,0,0,0.15); opacity: 0.95;"
                     title="${tooltipText}"
                     data-project="${project.projectName}"
                     data-type="${project.type}"
                     data-dates="${project.startDate} to ${project.endDate}"
                     data-utilization="${project.utilizationPercent || 'N/A'}"
                     data-description="${project.description || ''}"
                     onmouseover="this.style.opacity='1'; this.style.boxShadow='0 2px 10px rgba(0,0,0,0.3)';"
                     onmouseout="this.style.opacity='0.95'; this.style.boxShadow='none';">
                    <span class="ganttBarLabel">${project.projectName}${project.typeLabel ? ` [${project.typeLabel}]` : ""}</span>
                </div>
            `;
        });

        const rowHeight = Math.max(40, rowPadding * 2 + (maxLane + 1) * (laneHeight + 2));
        const monthCells = monthNumbers.map(() => '<div class="ganttMonth"></div>').join('');
        
        return `
            <div class="ganttRow" style="height: ${rowHeight}px; min-height: ${rowHeight}px;">
                <div class="ganttLabel" title="${empData.employeeId}">${empData.employeeName}</div>
                <div class="ganttTimeline" style="height: ${rowHeight}px;">
                    ${monthCells}
                    ${barsHtml}
                </div>
            </div>
        `;
    }

    /**
     * Refresh visualization data
     */
    public async onRefreshVisualization(): Promise<void> {
        MessageToast.show("Refreshing visualization data...");
        await this.loadVisualizationData();
        MessageToast.show("Visualization refreshed successfully");
    }

    /**
     * Apply visualization filters (Year and Quarter)
     */
    public onApplyVisualizationFilters(): void {
        const yearSelect = this.byId("yearFilter") as Select;
        const quarterSelect = this.byId("quarterFilter") as Select;
        
        const selectedYear = parseInt(yearSelect?.getSelectedKey() || new Date().getFullYear().toString());
        const selectedQuarter = quarterSelect?.getSelectedKey() || "ALL";
        
        const visualizationModel = this.getView()?.getModel("visualization") as JSONModel;
        visualizationModel?.setProperty("/selectedYear", selectedYear);
        visualizationModel?.setProperty("/selectedQuarter", selectedQuarter);
        
        console.log(`📊 Filters applied: Year=${selectedYear}, Quarter=${selectedQuarter}`);
        
        // Reload visualization data with new filters
        this.loadVisualizationData();
        
        MessageToast.show("Filters applied successfully");
    }

    /**
     * Handle year filter change (removed auto-apply)
     */
    public onYearFilterChange(event: any): void {
        // Filter will be applied when user clicks Apply button
    }

    /**
     * Handle quarter filter change (removed auto-apply)
     */
    public onQuarterFilterChange(event: any): void {
        // Filter will be applied when user clicks Apply button
    }

    /**
     * Format capacity state for timeline
     */
    public formatCapacityState(percentage: number): string {
        if (percentage >= 50) return "Success";
        if (percentage >= 25) return "Warning";
        return "Error";
    }

    /**
     * Format capacity text
     */
    public formatCapacityText(percentage: number): string {
        if (percentage >= 50) return "High Capacity Available";
        if (percentage >= 25) return "Moderate Capacity";
        return "Low Capacity";
    }

    /**
     * Format utilization as percentage
     */
    public formatUtilizationPercent(utilizationPercent: number): string {
        if (!utilizationPercent || utilizationPercent === 0) {
            return "0%";
        }
        return `${utilizationPercent}%`;
    }

    /**
     * View available employees for a specific month
     */
    public async onViewAvailableEmployees(event: Event): Promise<void> {
        const source = event.getSource();
        const bindingContext = (source as any).getBindingContext("visualization");
        const monthData = bindingContext?.getObject();

        if (!monthData || !monthData.employeeDetails || monthData.employeeDetails.length === 0) {
            MessageToast.show("No employees becoming available this month");
            return;
        }

        // Create dialog model
        const dialogModel = new JSONModel({
            title: `Employees Becoming Available - ${monthData.month}`,
            subtitle: `${monthData.availableCount} employee(s) will have projects ending before this month`,
            employees: monthData.employeeDetails
        });

        this.getView()?.setModel(dialogModel, "availableEmployeesDialog");

        // Load and open dialog
        if (!this.availableEmployeesDialog) {
            this.availableEmployeesDialog = await this.loadFragment({
                name: "skillsphere.view.dialogs.AvailableEmployeesDialog"
            });
        }
        this.availableEmployeesDialog.open();
    }

    /**
     * Close available employees dialog
     */
    public onCloseAvailableEmployeesDialog(): void {
        this.availableEmployeesDialog?.close();
    }

    private availableEmployeesDialog: any;

    // ==================== END DATA VISUALIZATION METHODS ====================

    public onViewEmployeeDetails(event: Event): void {
        const source = event.getSource();
        // Try to get binding context from managerEmployees model first, fallback to employees
        let bindingContext = (source as any).getBindingContext("managerEmployees");
        if (!bindingContext) {
            bindingContext = (source as any).getBindingContext("employees");
        }
        
        if (!bindingContext) {
            MessageToast.show("Unable to load employee details");
            console.error("No binding context found for employee");
            return;
        }
        
        const employee = bindingContext.getObject();
        this.openEmployeeDetailsDialog(employee, false);
    }

    public onSkillTokenUpdate(event: Event): void {
        // Handle skill token updates
        const multiInput = event.getSource() as MultiInput;
        const tokens = multiInput.getTokens();
        console.log("Current skill tokens:", tokens.map(token => token.getText()));
    }

    public onSkillSubmit(event: Event): void {
        // Handle Enter key press to add skill as token
        const multiInput = event.getSource() as MultiInput;
        const value = multiInput.getValue().trim();
        
        if (value) {
            // Check if token already exists
            const existingTokens = multiInput.getTokens();
            const tokenExists = existingTokens.some(token => 
                token.getText().toLowerCase() === value.toLowerCase()
            );
            
            if (!tokenExists) {
                // Add new token
                const newToken = new Token({
                    text: value,
                    key: value.toLowerCase()
                });
                multiInput.addToken(newToken);
                multiInput.setValue(""); // Clear input
                
                MessageToast.show(`Added skill: ${value}`);
            } else {
                MessageToast.show(`Skill "${value}" already added`);
                multiInput.setValue(""); // Clear input
            }
        }
    }

    public onSkillLiveChange(event: Event): void {
        // Handle live change for validation or suggestions
        const multiInput = event.getSource() as MultiInput;
        const value = multiInput.getValue();
        
        // You can add skill suggestions or validation here
        // For now, just ensure proper formatting
        if (value && value.includes(',')) {
            // Handle comma-separated input
            const skills = value.split(',').map(skill => skill.trim()).filter(skill => skill);
            
            if (skills.length > 1) {
                // Add multiple skills as tokens
                skills.forEach(skill => {
                    if (skill) {
                        const existingTokens = multiInput.getTokens();
                        const tokenExists = existingTokens.some(token => 
                            token.getText().toLowerCase() === skill.toLowerCase()
                        );
                        
                        if (!tokenExists) {
                            const newToken = new Token({
                                text: skill,
                                key: skill.toLowerCase()
                            });
                            multiInput.addToken(newToken);
                        }
                    }
                });
                multiInput.setValue(""); // Clear input after adding tokens
            }
        }
    }

    /**
     * Handle search scope change - show/hide manager selector
     */
    public onSearchScopeChange(event: Event): void {
        const select = event.getSource() as Select;
        const selectedKey = select.getSelectedKey();
        
        const managerSelectorBox = this.byId("managerSelectorBox") as any;
        
        if (selectedKey === "ByManager") {
            // Show manager selector dropdown
            managerSelectorBox?.setVisible(true);
        } else {
            // Hide manager selector dropdown
            managerSelectorBox?.setVisible(false);
        }
    }

    public async onSearchEmployees(): Promise<void> {
        const multiInput = this.byId("skillsSearchInput") as MultiInput;
        const scopeSelect = this.byId("searchScope") as Select;
        const experienceSelect = this.byId("experienceLevel") as Select;
        const roleSelect = this.byId("roleFilter") as Select;
        const managerSelector = this.byId("managerSelector") as Select;
        
        if (!multiInput) {
            MessageToast.show("Search input not found");
            return;
        }

        const skillTokens = multiInput.getTokens();
        const searchSkills = skillTokens.map(token => token.getText().toLowerCase());
        const searchScope = scopeSelect?.getSelectedKey() || "MyTeam";
        const experienceLevel = experienceSelect?.getSelectedKey() || "";
        const roleFilter = roleSelect?.getSelectedKey() || "";

        // Validate: At least one search criterion must be provided
        if (searchSkills.length === 0 && !roleFilter && !experienceLevel) {
            MessageToast.show("Please enter at least one search criterion (Skills, Role, or Experience Level)");
            return;
        }

        // Get current manager's ID
        const currentUserModel = this.getOwnerComponent()?.getModel("currentUser") as JSONModel;
        const currentUser = currentUserModel?.getData();
        const currentManagerId = currentUser?.id;

        console.log("Search parameters:", { searchSkills, searchScope, experienceLevel, roleFilter });

        try {
            let allEmployees: any[] = [];
            
            // Load employees based on search scope from OData
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            
            if (searchScope === "MyTeam") {
                // Load only current manager's team employees
                const listBinding = oDataModel.bindList("/Employees");
                listBinding.filter([new Filter("managerId", FilterOperator.EQ, currentManagerId)]);
                
                const contexts = await listBinding.requestContexts();
                allEmployees = contexts.map((context: any) => context.getObject());
                console.log(`Searching in My Team (${currentManagerId}): ${allEmployees.length} employees`);
                
            } else if (searchScope === "ByManager") {
                // Load selected manager's team
                const selectedManagerId = managerSelector?.getSelectedKey();
                
                if (!selectedManagerId) {
                    MessageToast.show("Please select a manager to search their team");
                    return;
                }
                
                const listBinding = oDataModel.bindList("/Employees");
                listBinding.filter([new Filter("managerId", FilterOperator.EQ, selectedManagerId)]);
                
                const contexts = await listBinding.requestContexts();
                allEmployees = contexts.map((context: any) => context.getObject());
                console.log(`Searching in Manager ${selectedManagerId}'s Team: ${allEmployees.length} employees`);
                
            } else if (searchScope === "EntireOrganization") {
                // Load all employees (exclude managers)
                const listBinding = oDataModel.bindList("/Employees");
                
                const contexts = await listBinding.requestContexts(0, 9999);
                allEmployees = contexts.map((context: any) => context.getObject())
                    .filter((emp: any) => emp.employeeId && !emp.employeeId.startsWith("MGR"));
                console.log(`Searching in Entire Organization: ${allEmployees.length} employees`);
            }

            // Load skills and profiles for all employees
            const enrichedEmployees = await Promise.all(allEmployees.map(async (emp: any) => {
                const empSkills = await this.getEmployeeSkills(emp.employeeId);
                const empProfile = await this.getEmployeeProfile(emp.employeeId);
                return {
                    ...emp,
                    skills: empSkills,
                    role: empProfile?.role || ""
                };
            }));

            console.log("Employees loaded with skills and profiles:", enrichedEmployees);

            // Perform skill-based and role-based search
            const searchResults = this.performSkillSearch(enrichedEmployees, searchSkills, experienceLevel, roleFilter);
            console.log("Search results generated:", searchResults);

            // Mark ownership: only employees belonging to THIS manager get full detail popup
            searchResults.forEach((result: any) => {
                result.isOwnEmployee = result.managerId === currentManagerId;
            });

            // Display results
            this.displaySearchResults(searchResults);
        } catch (error) {
            console.error("❌ Error searching employees:", error);
            MessageToast.show("Error performing search");
        }
    }

    private performSkillSearch(employees: any[], searchSkills: string[], experienceLevel: string, roleFilter: string): any[] {
        console.log("Searching employees - Skills:", searchSkills, "Role:", roleFilter, "Experience:", experienceLevel);
        
        // Flexible search: filter employees based on provided criteria
        const results = employees.filter(emp => {
            let passesFilter = true;
            
            // 1. Apply role filter if specified
            if (roleFilter) {
                if (!emp.role || emp.role !== roleFilter) {
                    return false; // Role doesn't match
                }
            }
            
            // Get this employee's skills (already loaded with employee)
            const empSkills = emp.skills || [];
            
            // 2. Apply skill filter if skills are provided
            if (searchSkills.length > 0) {
                // Check if employee has any of the searched skills
                const matchingSkills = empSkills.filter((skill: any) => 
                    searchSkills.some(searchSkill => 
                        skill.skillName.toLowerCase().includes(searchSkill)
                    )
                );
                
                if (matchingSkills.length === 0) {
                    return false; // No skill match
                }
                
                // 3. Apply experience filter if specified (only check on matched skills)
                if (experienceLevel) {
                    const meetsExperience = matchingSkills.some((skill: any) => 
                        this.matchesExperienceRequirement(skill.proficiencyLevel, experienceLevel)
                    );
                    
                    if (!meetsExperience) {
                        return false; // Experience level not met
                    }
                }
            } else if (experienceLevel) {
                // If no skills specified but experience level is set, check if any skill meets experience
                const meetsExperience = empSkills.some((skill: any) => 
                    this.matchesExperienceRequirement(skill.proficiencyLevel, experienceLevel)
                );
                
                if (!meetsExperience) {
                    return false; // Experience level not met
                }
            }
            
            return passesFilter;
        }).map(emp => {
            // Build result object based on what was searched
            const empSkills = emp.skills || [];
            let matchingSkills = "";
            let totalMatchingSkills = 0;
            let matchScore = 0;
            
            if (searchSkills.length > 0) {
                // Skill-based search: show matching skills
                const matchingSkillsArray = this.getMatchingSkills(emp, searchSkills);
                totalMatchingSkills = matchingSkillsArray.length;
                
                const matchedSkillDetails = empSkills
                    .filter((s: any) => 
                        matchingSkillsArray.some((ms: string) => s.skillName.toLowerCase() === ms.toLowerCase())
                    )
                    .map((s: any) => `${s.skillName} (${s.proficiencyLevel})`)
                    .join(", ");
                
                matchingSkills = matchedSkillDetails || matchingSkillsArray.join(", ");
                matchScore = this.calculateMatchScore(emp, searchSkills);
            } else {
                // Role/Experience only search: show all skills or relevant info
                if (roleFilter) {
                    matchingSkills = `Role: ${emp.role}`;
                }
                if (experienceLevel) {
                    const qualifiedSkills = empSkills.filter((s: any) => 
                        this.matchesExperienceRequirement(s.proficiencyLevel, experienceLevel)
                    ).map((s: any) => `${s.skillName} (${s.proficiencyLevel})`);
                    
                    if (qualifiedSkills.length > 0) {
                        matchingSkills = matchingSkills 
                            ? `${matchingSkills} | Skills: ${qualifiedSkills.join(", ")}`
                            : qualifiedSkills.join(", ");
                        totalMatchingSkills = qualifiedSkills.length;
                    }
                }
                // For role-only search, give a base score
                matchScore = roleFilter ? 75 : 50;
            }
            
            const result = {
                ...emp,
                matchingSkills: matchingSkills || "N/A",
                totalMatchingSkills: totalMatchingSkills,
                matchScore: matchScore
            };
            console.log(`Employee ${emp.employeeId} match score: ${matchScore}%`);
            return result;
        });

        // Sort by match score (highest first)
        return results.sort((a, b) => b.matchScore - a.matchScore);
    }

    private matchesExperienceRequirement(proficiencyLevel: string, requiredLevel: string): boolean {
        const levels: { [key: string]: number } = {
            "Beginner": 1,
            "Intermediate": 2,
            "Proficient": 3,
            "Advanced": 4,
            "Expert": 5
        };
        
        const skillLevel = levels[proficiencyLevel] || 1;
        const reqLevel = levels[requiredLevel] || 1;
        
        return skillLevel >= reqLevel;
    }

    private getMatchingSkills(employee: any, searchSkills: string[]): string[] {
        const empSkills = employee.skills || [];
        const skillNames = empSkills.map((s: any) => s.skillName);
        return skillNames.filter((skill: string) => 
            searchSkills.some(searchSkill => 
                skill.toLowerCase().includes(searchSkill.toLowerCase())
            )
        );
    }

    /**
     * Calculate match score based on proficiency levels
     * Proficient = 100%, Intermediate = 75%, Beginner = 50%, Advanced = 90%, Expert = 100%
     */
    private calculateMatchScore(employee: any, searchSkills: string[]): number {
        // Get employee's skills that match search criteria
        const empSkills = employee.skills || [];
        const matchedSkills = empSkills.filter((skill: any) => 
            searchSkills.some(searchSkill => 
                skill.skillName.toLowerCase().includes(searchSkill.toLowerCase())
            )
        );
        
        if (matchedSkills.length === 0) {
            return 0;
        }
        
        // Map proficiency levels to percentage scores
        const proficiencyScores: { [key: string]: number } = {
            "Beginner": 50,
            "Intermediate": 75,
            "Proficient": 100,
            "Advanced": 90,
            "Expert": 100
        };
        
        // Calculate total score for matched skills
        let totalScore = 0;
        matchedSkills.forEach((skill: any) => {
            const proficiency = skill.proficiencyLevel || "Beginner";
            totalScore += proficiencyScores[proficiency] || 50;
        });
        
        // Average score across all searched skills (not just matched ones)
        // This ensures employees with partial matches get lower scores
        const averageScore = totalScore / searchSkills.length;
        
        // If employee has all skills searched for, give bonus
        if (matchedSkills.length >= searchSkills.length) {
            return Math.min(100, Math.round(averageScore * 1.1)); // 10% bonus for complete match
        }
        
        return Math.round(averageScore);
    }

    private displaySearchResults(results: any[]): void {
        const searchResultsPanel = this.byId("searchResultsPanel") as any;
        const searchResultsTable = this.byId("searchResultsTable") as Table;

        if (!searchResultsTable || !searchResultsPanel) {
            MessageToast.show("Search results components not found");
            return;
        }

        if (results.length === 0) {
            MessageToast.show("No employees found matching your search criteria");
            searchResultsPanel.setVisible(false);
            return;
        }

        // Create and set search results model with named model
        const resultsModel = new JSONModel({ results });
        this.getView()?.setModel(resultsModel, "searchResults");

        console.log("Search results data set:", results);

        // Show search results panel
        searchResultsPanel.setVisible(true);
        searchResultsPanel.setHeaderText(`Search Results (${results.length} employees found)`);

        MessageToast.show(`Found ${results.length} employees matching your criteria`);

        // Scroll to results
        setTimeout(() => {
            searchResultsPanel.getDomRef()?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    }

    /**
     * Clear search results and reset search inputs
     */
    private clearSearchResults(): void {
        console.log("Clearing previous search results");
        
        // Hide search results panel
        const searchResultsPanel = this.byId("searchResultsPanel") as any;
        if (searchResultsPanel) {
            searchResultsPanel.setVisible(false);
        }

        // Clear search results model
        const resultsModel = new JSONModel({ results: [] });
        this.getView()?.setModel(resultsModel, "searchResults");

        // Clear search input tokens
        const multiInput = this.byId("skillsSearchInput") as MultiInput;
        if (multiInput) {
            multiInput.removeAllTokens();
            multiInput.setValue("");
        }

        // Reset search scope to default (My Team)
        const scopeSelect = this.byId("searchScope") as Select;
        if (scopeSelect) {
            scopeSelect.setSelectedKey("MyTeam");
        }

        // Hide manager selector box
        const managerSelectorBox = this.byId("managerSelectorBox") as any;
        if (managerSelectorBox) {
            managerSelectorBox.setVisible(false);
        }

        // Reset experience level to default (empty)
        const experienceSelect = this.byId("experienceLevel") as Select;
        if (experienceSelect) {
            experienceSelect.setSelectedKey("");
        }
        
        console.log("✅ Search results cleared successfully");
    }

    public onViewSearchResult(event: Event): void {
        const source = event.getSource();
        let bindingContext = (source as any).getBindingContext("searchResults");
        
        if (!bindingContext) {
            // Fallback: try to get the context from the list item
            const listItem = (source as any).getParent ? (source as any).getParent() : source;
            bindingContext = (listItem as any).getBindingContext("searchResults");
            
            if (!bindingContext) {
                MessageToast.show("Unable to get employee details. Please try again.");
                console.error("No binding context found for search result");
                return;
            }
        }
        
        const result = bindingContext.getObject();
        console.log("Search result from binding context:", result);
        if (!result.isOwnEmployee) {
            // Non-own employees are displayed in the table for reference only — no detail popup
            return;
        }
        this.openEmployeeDetailsDialog(result, true);
    }

    private async openEmployeeDetailsDialog(employee: any, isSearchResult: boolean): Promise<void> {
        // Get dialog reference
        const dialog = this.byId("employeeDetailsDialog") as any;
        if (!dialog) {
            MessageToast.show("Dialog not found");
            return;
        }

        // Use employeeId or id for backward compatibility
        const empId = employee.employeeId || employee.id;

        console.log(`📋 Loading comprehensive details for employee: ${empId}`);

        try {
            // Refresh master catalogs so assign dropdowns are always up to date
            await Promise.all([this.loadMasterProjects(), this.loadMasterWorkItems()]);

            // Load all data from OData in parallel
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            
            const [employeeData, profileData, skills, projects, currentProjects, certifications, completedMasterWork] = await Promise.all([
                this.loadEmployeeData(empId),
                this.loadProfileData(empId),
                this.getEmployeeSkills(empId),
                this.getEmployeeProjects(empId),
                this.getCurrentProjects(empId),
                this.getCertifications(empId),
                this.getCompletedInitiativeEvaluationForTabs(empId)
            ]);

            console.log("✅ All employee data loaded successfully");

            const activeCurrentProjects = currentProjects
                .filter((cp: any) => cp.assignmentStatus !== "Completed")
                .map((cp: any) => ({
                    ...cp,
                    isUtilizationEditing: false
                }));

            // Merge all data
            const completeData = {
                ...employeeData,
                ...profileData,
                skills: skills,
                projects: projects,
                initiativesHistory: completedMasterWork.initiatives,
                evaluationsHistory: completedMasterWork.evaluations,
                currentProjects: activeCurrentProjects,
                certifications: certifications,
                assignments: currentProjects
            };

            // Create model for employee details
            const detailsModel = new JSONModel(completeData);
            this.getView()?.setModel(detailsModel, "employeeDetails");

            // Populate basic information fields
            (this.byId("dialogEmployeeName") as any)?.setText(employeeData.name || '');
            (this.byId("dialogEmployeeId") as any)?.setText(employeeData.employeeId || '');
            (this.byId("dialogEmployeeEmail") as any)?.setText(employeeData.email || '');
            (this.byId("dialogEmployeeTeam") as any)?.setText(employeeData.team || '');
            (this.byId("dialogEmployeeSpecialization") as any)?.setText(employeeData.specialization || '');
            (this.byId("dialogEmployeeManager") as any)?.setText(employeeData.managerId || '');

            // Populate professional details
            (this.byId("dialogEmployeeRole") as any)?.setText(profileData.role || 'N/A');
            (this.byId("dialogEmployeeLocation") as any)?.setText(profileData.location || 'N/A');
            (this.byId("dialogEmployeeTLevel") as any)?.setText(profileData.tLevel || 'N/A');
            (this.byId("dialogEmployeeGradeLevel") as any)?.setText(profileData.gradeLevel || 'N/A');
            (this.byId("dialogEmployeeLastUpdated") as any)?.setText(profileData.lastUpdated ? new Date(profileData.lastUpdated).toLocaleDateString() : 'N/A');

            // Store current dialog employee ID for manager actions (e.g., Add Project)
            this.currentDialogEmployeeId = empId;

            // Active current work excludes only completed assignments.
            const activeProjects = currentProjects.filter((cp: any) => cp.assignmentStatus !== "Completed");

            // Populate current status from fresh assignment data.
            const isWorking = activeProjects.length > 0;
            const statusText = this.formatWorkingStatus(isWorking);
            const statusState = this.formatWorkingStatusState(isWorking);
            (this.byId("dialogWorkStatus") as any)?.setText(statusText);
            (this.byId("dialogWorkStatus") as any)?.setState(statusState);

            (this.byId("dialogActiveProjects") as any)?.setNumber(activeProjects.length);
            (this.byId("dialogActiveProjects") as any)?.setUnit(activeProjects.length === 1 ? "project" : "projects");

            // Update skills count
            (this.byId("dialogTotalSkills") as any)?.setNumber(skills.length);
            (this.byId("dialogTotalSkills") as any)?.setUnit(skills.length === 1 ? "skill" : "skills");

            // Update projects count
            (this.byId("dialogTotalProjects") as any)?.setNumber(projects.length);
            (this.byId("dialogTotalProjects") as any)?.setUnit(projects.length === 1 ? "project" : "projects");

            // Update certifications count (in Certifications tab)
            (this.byId("dialogTotalCertificationsTab") as any)?.setNumber(certifications.length);
            (this.byId("dialogTotalCertificationsTab") as any)?.setUnit(certifications.length === 1 ? "certification" : "certifications");

            this.resetAssignmentPanelFields();

            // Handle match information for search results
            const matchTab = this.byId("dialogMatchTab") as any;
            if (isSearchResult && employee.matchScore !== undefined) {
                matchTab?.setVisible(true);
                
                // Set match score progress indicator
                const matchScoreControl = this.byId("dialogMatchScore") as any;
                if (matchScoreControl) {
                    matchScoreControl.setPercentValue(employee.matchScore);
                    matchScoreControl.setDisplayValue(employee.matchScore + "%");
                    matchScoreControl.setState(this.formatMatchScoreState(employee.matchScore));
                }
                
                // Set match level text (Excellent/Good/Partial/Low Match)
                const matchLevelControl = this.byId("dialogMatchLevel") as any;
                if (matchLevelControl) {
                    const matchLevelText = this.formatMatchScoreText(employee.matchScore);
                    matchLevelControl.setText(matchLevelText);
                    matchLevelControl.setState(this.formatMatchScoreState(employee.matchScore));
                }
                
                // Set matching skills text
                (this.byId("dialogMatchingSkills") as any)?.setText(employee.matchingSkills || "N/A");
            } else {
                matchTab?.setVisible(false);
            }

            // Open dialog
            dialog.open();
            
        } catch (error) {
            console.error("❌ Error loading employee details:", error);
            MessageToast.show("Error loading employee details");
        }
    }

    /**
     * Load employee master data from OData
     */
    private async loadEmployeeData(employeeId: string): Promise<any> {
        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            const listBinding = oDataModel.bindList("/Employees");
            listBinding.filter([new Filter("employeeId", FilterOperator.EQ, employeeId)]);
            
            const contexts = await listBinding.requestContexts(0, 1);
            if (contexts.length > 0) {
                return contexts[0].getObject();
            }
            return {};
        } catch (error) {
            console.error(`Error loading employee data for ${employeeId}:`, error);
            return {};
        }
    }

    /**
     * Load profile data from OData
     */
    private async loadProfileData(employeeId: string): Promise<any> {
        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            const listBinding = oDataModel.bindList("/Profiles");
            listBinding.filter([new Filter("employeeId", FilterOperator.EQ, employeeId)]);
            
            const contexts = await listBinding.requestContexts(0, 1);
            if (contexts.length > 0) {
                return contexts[0].getObject();
            }
            return {};
        } catch (error) {
            console.error(`Error loading profile data for ${employeeId}:`, error);
            return {};
        }
    }

    /**
     * Get initiatives records for an employee
     */
    private async getInitiatives(employeeId: string): Promise<any[]> {
        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            const currentInitiativesBinding = oDataModel.bindList("/CurrentInitiatives");
            currentInitiativesBinding.filter([new Filter("employeeId", FilterOperator.EQ, employeeId)]);

            const currentEvaluationsBinding = oDataModel.bindList("/CurrentEvaluations");
            currentEvaluationsBinding.filter([new Filter("employeeId", FilterOperator.EQ, employeeId)]);

            const [initiativeContexts, evaluationContexts] = await Promise.all([
                currentInitiativesBinding.requestContexts(),
                currentEvaluationsBinding.requestContexts()
            ]);

            const initiatives = initiativeContexts.map((context: any) => {
                const obj = context.getObject();
                return {
                    ...obj,
                    type: "Initiative",
                    initiativeId: obj.currentInitiativeId,
                    initiativeName: obj.initiativeName
                };
            });

            const evaluations = evaluationContexts.map((context: any) => {
                const obj = context.getObject();
                return {
                    ...obj,
                    type: "Evaluation",
                    initiativeId: obj.currentEvaluationId,
                    initiativeName: obj.evaluationName
                };
            });

            return [...initiatives, ...evaluations];
        } catch (error) {
            console.error(`Error loading initiatives for ${employeeId}:`, error);
            return [];
        }
    }

    /**
     * Get certifications for an employee
     */
    private async getCertifications(employeeId: string): Promise<any[]> {
        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            const listBinding = oDataModel.bindList("/Certifications");
            listBinding.filter([new Filter("employeeId", FilterOperator.EQ, employeeId)]);
            
            const contexts = await listBinding.requestContexts();
            return contexts.map((context: any) => context.getObject());
        } catch (error) {
            console.error(`Error loading certifications for ${employeeId}:`, error);
            return [];
        }
    }



    public onContactEmployee(event: Event): void {
        // Get employee name from dialog
        const employeeName = (this.byId("dialogEmployeeName") as any).getText();
        MessageToast.show(`Contacting ${employeeName}...`);
        // TODO: Implement actual contact functionality (email, teams, etc.)
    }

    public onCloseEmployeeDialog(): void {
        const dialog = this.byId("employeeDetailsDialog") as any;
        if (dialog) {
            dialog.close();
        }
    }

    private async openManagerWorkAssignmentDialog(defaultType: "Initiative" | "Evaluation"): Promise<void> {
        if (!this.currentDialogEmployeeId) {
            MessageToast.show("Select an employee first");
            return;
        }

        if (!this.managerWorkAssignmentDialog) {
            this.managerWorkAssignmentDialog = await Fragment.load({
                name: "skillsphere.view.dialogs.ManagerWorkAssignmentDialog",
                controller: this
            }) as Dialog;
            this.getView()?.addDependent(this.managerWorkAssignmentDialog);
        }

        const dialogModel = new JSONModel({
            type: defaultType,
            name: "",
            description: "",
            startDate: null,
            endDate: null,
            utilizationPercent: 100
        });
        this.getView()?.setModel(dialogModel, "managerWork");
        this.managerWorkAssignmentDialog.open();
    }

    public async onManagerAddWorkAssignment(): Promise<void> {
        await this.openManagerWorkAssignmentDialog("Initiative");
    }

    public async onManagerAddInitiative(): Promise<void> {
        await this.openManagerWorkAssignmentDialog("Initiative");
    }

    public async onManagerAddEvaluation(): Promise<void> {
        await this.openManagerWorkAssignmentDialog("Evaluation");
    }

    private async loadManagerWorkCatalog(type: "Initiative" | "Evaluation"): Promise<any[]> {
        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            const listBinding = oDataModel.bindList(type === "Initiative" ? "/InitiativesMaster" : "/EvaluationsMaster");
            if (this.currentManagerId) {
                listBinding.filter([new Filter("addedByManager", FilterOperator.EQ, this.currentManagerId)]);
            }

            const contexts = await listBinding.requestContexts(0, 1000);
            const items = contexts
                .map((ctx: any) => ctx.getObject())
                .filter((item: any) => {
                    const status = String(item?.status || "Active").toLowerCase();
                    return status === "active";
                });

            const deduped = new Map<string, any>();
            for (const item of items) {
                const itemName = type === "Initiative" ? item.initiativeName : item.evaluationName;
                const itemId = type === "Initiative" ? item.initiativeId : item.evaluationId;
                const key = `${type}::${String(itemId || "")}`;
                if (!itemId) {
                    continue;
                }
                if (!deduped.has(key)) {
                    deduped.set(key, {
                        id: itemId,
                        name: itemName,
                        description: item.description,
                        startDate: item.startDate,
                        endDate: item.endDate,
                        status: item.status,
                        type
                    });
                }
            }

            return Array.from(deduped.values());
        } catch (error) {
            console.error("Error loading work catalog:", error);
            return [];
        }
    }

    private async openManagerAssignWorkDialog(type: "Initiative" | "Evaluation"): Promise<void> {
        if (!this.currentDialogEmployeeId) {
            MessageToast.show("Select an employee first");
            return;
        }

        if (!this.managerAssignWorkDialog) {
            this.managerAssignWorkDialog = await Fragment.load({
                name: "skillsphere.view.dialogs.ManagerAssignWorkDialog",
                controller: this
            }) as Dialog;
            this.getView()?.addDependent(this.managerAssignWorkDialog);
        }

        const catalogItems = await this.loadManagerWorkCatalog(type);
        this.getView()?.setModel(new JSONModel({ items: catalogItems }), "managerWorkCatalog");

        const assignModel = new JSONModel({
            type,
            selectedId: "",
            name: "",
            description: "",
            startDate: null,
            endDate: null,
            utilizationPercent: 100
        });
        this.getView()?.setModel(assignModel, "managerAssignWork");
        this.managerAssignWorkDialog.open();
    }

    public async onManagerAssignInitiative(): Promise<void> {
        await this.openManagerAssignWorkDialog("Initiative");
    }

    public async onManagerAssignEvaluation(): Promise<void> {
        await this.openManagerAssignWorkDialog("Evaluation");
    }

    public onManagerAssignWorkSelectionChange(event: Event): void {
        const source = event.getSource() as any;
        const selectedKey = source.getSelectedKey();
        if (!selectedKey) return;

        const catalogModel = this.getView()?.getModel("managerWorkCatalog") as JSONModel;
        const items = catalogModel?.getProperty("/items") || [];
        const selected = items.find((item: any) => item.id === selectedKey);
        if (!selected) return;

        const model = this.getView()?.getModel("managerAssignWork") as JSONModel;
        model?.setProperty("/name", selected.name || "");
        model?.setProperty("/description", selected.description || "");
        model?.setProperty("/startDate", selected.startDate || null);
        model?.setProperty("/endDate", selected.endDate || null);
        model?.setProperty("/utilizationPercent", Number(selected.utilizationPercent) || 100);
    }

    public onCloseManagerAssignWork(): void {
        this.managerAssignWorkDialog?.close();
    }

    public async onSaveManagerAssignWork(): Promise<void> {
        const employeeId = this.currentDialogEmployeeId;
        if (!employeeId) {
            MessageToast.show("Employee not selected");
            return;
        }

        const model = this.getView()?.getModel("managerAssignWork") as JSONModel;
        const data = model?.getData() || {};

        if (!data.selectedId || !data.name || !data.startDate || !data.endDate || !data.utilizationPercent) {
            MessageToast.show("Please select and complete required fields");
            return;
        }

        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            const isInitiative = (data.type || "Initiative") === "Initiative";
            const listBinding = oDataModel.bindList(isInitiative ? "/CurrentInitiatives" : "/CurrentEvaluations");
            let createdContext: any;

            if (isInitiative) {
                createdContext = listBinding.create({
                    employeeId,
                    initiativeId: data.selectedId,
                    initiativeName: String(data.name).trim(),
                    description: String(data.description || "").trim(),
                    startDate: data.startDate,
                    endDate: data.endDate,
                    utilizationPercent: Number(data.utilizationPercent) || 0,
                    status: "Active",
                    assignedBy: this.currentManagerId,
                    createdAt: new Date().toISOString(),
                    lastUpdated: new Date().toISOString()
                });
            } else {
                createdContext = listBinding.create({
                    employeeId,
                    evaluationId: data.selectedId,
                    evaluationName: String(data.name).trim(),
                    description: String(data.description || "").trim(),
                    startDate: data.startDate,
                    endDate: data.endDate,
                    utilizationPercent: Number(data.utilizationPercent) || 0,
                    status: "Active",
                    assignedBy: this.currentManagerId,
                    createdAt: new Date().toISOString(),
                    lastUpdated: new Date().toISOString()
                });
            }

            await oDataModel.submitBatch(oDataModel.getUpdateGroupId());
            await createdContext?.created?.();
            this.managerAssignWorkDialog?.close();
            await this.refreshCurrentDialogData();
            await this.refreshEmployeeAssignments(employeeId);
            await this.loadManagerData();
            MessageToast.show(`${data.type || "Work"} assigned from master catalog`);
        } catch (error) {
            console.error("❌ Error assigning work from catalog:", error);
            MessageToast.show("Error assigning selected work item");
        }
    }

    public onCloseManagerWorkAssignment(): void {
        this.managerWorkAssignmentDialog?.close();
    }

    public async onSaveManagerWorkAssignment(): Promise<void> {
        const employeeId = this.currentDialogEmployeeId;
        if (!employeeId) {
            MessageToast.show("Employee not selected");
            return;
        }

        const model = this.getView()?.getModel("managerWork") as JSONModel;
        const data = model?.getData() || {};

        if (!data.name || !data.startDate || !data.endDate || !data.utilizationPercent) {
            MessageToast.show("Please fill all required fields");
            return;
        }

        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            const isInitiative = (data.type || "Initiative") === "Initiative";
            const masterBinding = oDataModel.bindList(isInitiative ? "/InitiativesMaster" : "/EvaluationsMaster");
            const masterCtx = isInitiative
                ? masterBinding.create({
                    initiativeName: String(data.name).trim(),
                    description: String(data.description || "").trim(),
                    startDate: data.startDate,
                    endDate: data.endDate,
                    status: "Active",
                    addedByManager: this.currentManagerId || "",
                    createdAt: new Date().toISOString(),
                    lastUpdated: new Date().toISOString()
                })
                : masterBinding.create({
                    evaluationName: String(data.name).trim(),
                    description: String(data.description || "").trim(),
                    startDate: data.startDate,
                    endDate: data.endDate,
                    status: "Active",
                    addedByManager: this.currentManagerId || "",
                    createdAt: new Date().toISOString(),
                    lastUpdated: new Date().toISOString()
                });

            await oDataModel.submitBatch(oDataModel.getUpdateGroupId());
            await masterCtx.created();
            const createdMaster = masterCtx.getObject();

            const currentBinding = oDataModel.bindList(isInitiative ? "/CurrentInitiatives" : "/CurrentEvaluations");
            let currentCtx: any;
            if (isInitiative) {
                currentCtx = currentBinding.create({
                    employeeId,
                    initiativeId: createdMaster?.initiativeId,
                    initiativeName: String(data.name).trim(),
                    description: String(data.description || "").trim(),
                    startDate: data.startDate,
                    endDate: data.endDate,
                    utilizationPercent: Number(data.utilizationPercent) || 0,
                    status: "Active",
                    assignedBy: this.currentManagerId,
                    createdAt: new Date().toISOString(),
                    lastUpdated: new Date().toISOString()
                });
            } else {
                currentCtx = currentBinding.create({
                    employeeId,
                    evaluationId: createdMaster?.evaluationId,
                    evaluationName: String(data.name).trim(),
                    description: String(data.description || "").trim(),
                    startDate: data.startDate,
                    endDate: data.endDate,
                    utilizationPercent: Number(data.utilizationPercent) || 0,
                    status: "Active",
                    assignedBy: this.currentManagerId,
                    createdAt: new Date().toISOString(),
                    lastUpdated: new Date().toISOString()
                });
            }

            await oDataModel.submitBatch(oDataModel.getUpdateGroupId());
            await currentCtx?.created?.();
            this.managerWorkAssignmentDialog?.close();
            await this.loadMasterWorkItems();
            await this.refreshCurrentDialogData();
            await this.refreshEmployeeAssignments(employeeId);
            await this.loadManagerData();
            MessageToast.show(`${data.type || "Work"} assigned successfully`);
        } catch (error) {
            console.error("❌ Error saving manager work assignment:", error);
            MessageToast.show("Error saving work assignment");
        }
    }

    public async onManagerCompleteCurrentProject(event: Event): Promise<void> {
        const source = event.getSource() as any;
        const bindingContext = source.getBindingContext("employeeDetails");
        const currentProject = bindingContext?.getObject();

        if (currentProject?.type === "Initiative" || currentProject?._source === "CurrentInitiatives" || currentProject?.type === "Evaluation" || currentProject?._source === "CurrentEvaluations") {
            await this.onManagerCompleteInitiative(event);
            return;
        }

        if (!currentProject?.currentProjectId) {
            MessageToast.show("Project not found");
            return;
        }

        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            const listBinding = oDataModel.bindList("/CurrentProjects");
            listBinding.filter([new Filter("currentProjectId", FilterOperator.EQ, currentProject.currentProjectId)]);
            const contexts = await listBinding.requestContexts(0, 1);

            if (contexts.length > 0) {
                contexts[0].setProperty("assignmentStatus", "Completed");
                contexts[0].setProperty("lastUpdated", new Date().toISOString());
                await oDataModel.submitBatch(oDataModel.getUpdateGroupId());
                await new Promise(resolve => setTimeout(resolve, 600));

                if (this.currentDialogEmployeeId) {
                    await this.refreshCurrentDialogData();
                    await this.refreshEmployeeAssignments(this.currentDialogEmployeeId);
                    await this.loadManagerData();
                    // Navigate to Projects tab so the user can see the completed entry
                    (this.byId("detailsIconTabBar") as any)?.setSelectedKey("projects");
                }
                MessageToast.show("Project status updated to Completed");
            }
        } catch (error) {
            console.error("❌ Error completing project:", error);
            MessageToast.show("Error marking project as completed");
        }
    }

    public async onManagerCompleteInitiative(event: Event): Promise<void> {
        const source = event.getSource() as any;
        const bindingContext = source.getBindingContext("employeeDetails");
        const initiative = bindingContext?.getObject();

        const isEvaluation = initiative?.type === "Evaluation" || initiative?._source === "CurrentEvaluations";
        const currentAssignmentId = isEvaluation
            ? (initiative?.currentEvaluationId || initiative?.currentProjectId)
            : (initiative?.currentInitiativeId || initiative?.currentProjectId);

        if (!currentAssignmentId) {
            MessageToast.show("Assignment ID not found");
            return;
        }

        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            const entityPath = isEvaluation ? "/CurrentEvaluations" : "/CurrentInitiatives";
            const keyField = isEvaluation ? "currentEvaluationId" : "currentInitiativeId";

            const listBinding = oDataModel.bindList(entityPath);
            listBinding.filter([new Filter(keyField, FilterOperator.EQ, currentAssignmentId)]);
            const contexts = await listBinding.requestContexts(0, 1);

            if (contexts.length === 0) {
                MessageToast.show("Assignment not found");
                return;
            }

            contexts[0].setProperty("status", "Completed");
            contexts[0].setProperty("lastUpdated", new Date().toISOString());
            await oDataModel.submitBatch(oDataModel.getUpdateGroupId());
            await new Promise(resolve => setTimeout(resolve, 400));

            if (this.currentDialogEmployeeId) {
                await this.refreshCurrentDialogData();
                await this.refreshEmployeeAssignments(this.currentDialogEmployeeId);
                await this.loadManagerData();
            }
            MessageToast.show("Marked as completed");
        } catch (error) {
            console.error("❌ Error completing initiative/evaluation:", error);
            MessageToast.show("Error marking as completed");
        }
    }

        /**
         * Mark master project as completed and cascade to all current assignments.
         */
        public async onMarkMasterProjectCompleted(oEvent: Event): Promise<void> {
            const oSource = (oEvent.getSource() as any);
            const oContext = oSource.getBindingContext("masterProjects");
            const projectData = oContext?.getObject();
            if (!projectData?.projectId) return;

            try {
                const oDataModel = this.getOwnerComponent()?.getModel() as any;

                // CurrentProjects has no projectId; cascade by project name.
                const currentProjectsBinding = oDataModel.bindList("/CurrentProjects");
                currentProjectsBinding.filter([
                    new Filter("type", FilterOperator.EQ, "Project"),
                    new Filter("projectName", FilterOperator.EQ, projectData.projectName)
                ]);
                const currentProjectContexts = await currentProjectsBinding.requestContexts(0, 9999);
                for (const ctx of currentProjectContexts) {
                    ctx.setProperty("assignmentStatus", "Completed");
                    ctx.setProperty("lastUpdated", new Date().toISOString());
                }

                // Mark master project status as completed.
                const masterProjectsBinding = oDataModel.bindList("/Projects");
                masterProjectsBinding.filter([new Filter("projectId", FilterOperator.EQ, projectData.projectId)]);
                const masterContexts = await masterProjectsBinding.requestContexts(0, 1);
                if (masterContexts.length > 0) {
                    masterContexts[0].setProperty("status", "Completed");
                }

                await oDataModel.submitBatch(oDataModel.getUpdateGroupId());
                await new Promise(resolve => setTimeout(resolve, 600));
                MessageToast.show(`Project marked as completed for ${currentProjectContexts.length} employee(s)`);
                await this.loadMasterProjects();
                await this.loadManagerData();
                await this.refreshCurrentDialogData();
            } catch (error) {
                console.error("❌ Error marking project as completed:", error);
                MessageToast.show("Error marking project as completed");
            }
        }

        /**
         * Mark master initiative as completed and cascade to all current assignments.
         */
        public async onMarkMasterInitiativeCompleted(oEvent: Event): Promise<void> {
            const oSource = (oEvent.getSource() as any);
            const oContext = oSource.getBindingContext("masterInitiatives");
            const initiativeData = oContext?.getObject();
            if (!initiativeData?.initiativeId) return;

            try {
                const oDataModel = this.getOwnerComponent()?.getModel() as any;

                const currentInitiativesBinding = oDataModel.bindList("/CurrentInitiatives");
                currentInitiativesBinding.filter([new Filter("initiativeId", FilterOperator.EQ, initiativeData.initiativeId)]);
                const currentInitiativeContexts = await currentInitiativesBinding.requestContexts(0, 9999);

                const initiativesBinding = oDataModel.bindList("/Initiatives");
                for (const ctx of currentInitiativeContexts) {
                    const currentInitiativeData = ctx.getObject();
                    initiativesBinding.create({
                        employeeId: currentInitiativeData.employeeId,
                        initiativeName: currentInitiativeData.initiativeName,
                        description: currentInitiativeData.description,
                        startDate: currentInitiativeData.startDate,
                        endDate: currentInitiativeData.endDate,
                        utilizationPercent: currentInitiativeData.utilizationPercent,
                        status: "Completed",
                        type: "Initiative",
                        createdAt: new Date().toISOString(),
                        lastUpdated: new Date().toISOString()
                    });
                    ctx.delete();
                }

                const masterInitiativesBinding = oDataModel.bindList("/InitiativesMaster");
                masterInitiativesBinding.filter([new Filter("initiativeId", FilterOperator.EQ, initiativeData.initiativeId)]);
                const masterContexts = await masterInitiativesBinding.requestContexts(0, 1);
                if (masterContexts.length > 0) {
                    masterContexts[0].setProperty("status", "Completed");
                }

                await oDataModel.submitBatch(oDataModel.getUpdateGroupId());
                MessageToast.show(`Initiative marked as completed for ${currentInitiativeContexts.length} employee(s)`);
                await this.loadMasterWorkItems();
                await this.loadManagerData();
                await this.refreshCurrentDialogData();
            } catch (error) {
                console.error("❌ Error marking initiative as completed:", error);
                MessageToast.show("Error marking initiative as completed");
            }
        }

        /**
         * Mark master evaluation as completed and cascade to all current assignments.
         */
        public async onMarkMasterEvaluationCompleted(oEvent: Event): Promise<void> {
            const oSource = (oEvent.getSource() as any);
            const oContext = oSource.getBindingContext("masterEvaluations");
            const evaluationData = oContext?.getObject();
            if (!evaluationData?.evaluationId) return;

            try {
                const oDataModel = this.getOwnerComponent()?.getModel() as any;

                const currentEvaluationsBinding = oDataModel.bindList("/CurrentEvaluations");
                currentEvaluationsBinding.filter([new Filter("evaluationId", FilterOperator.EQ, evaluationData.evaluationId)]);
                const currentEvaluationContexts = await currentEvaluationsBinding.requestContexts(0, 9999);

                const initiativesBinding = oDataModel.bindList("/Initiatives");
                for (const ctx of currentEvaluationContexts) {
                    const currentEvaluationData = ctx.getObject();
                    initiativesBinding.create({
                        employeeId: currentEvaluationData.employeeId,
                        initiativeName: currentEvaluationData.evaluationName,
                        description: currentEvaluationData.description,
                        startDate: currentEvaluationData.startDate,
                        endDate: currentEvaluationData.endDate,
                        utilizationPercent: currentEvaluationData.utilizationPercent,
                        status: "Completed",
                        type: "Evaluation",
                        createdAt: new Date().toISOString(),
                        lastUpdated: new Date().toISOString()
                    });
                    ctx.delete();
                }

                const masterEvaluationsBinding = oDataModel.bindList("/EvaluationsMaster");
                masterEvaluationsBinding.filter([new Filter("evaluationId", FilterOperator.EQ, evaluationData.evaluationId)]);
                const masterContexts = await masterEvaluationsBinding.requestContexts(0, 1);
                if (masterContexts.length > 0) {
                    masterContexts[0].setProperty("status", "Completed");
                }

                await oDataModel.submitBatch(oDataModel.getUpdateGroupId());
                MessageToast.show(`Evaluation marked as completed for ${currentEvaluationContexts.length} employee(s)`);
                await this.loadMasterWorkItems();
                await this.loadManagerData();
                await this.refreshCurrentDialogData();
            } catch (error) {
                console.error("❌ Error marking evaluation as completed:", error);
                MessageToast.show("Error marking evaluation as completed");
            }
        }

        /**
         * Close edit master project dialog
         */
        public onCloseEditMasterProjectDialog(): void {
            this.editMasterProjectDialog?.close();
        }

    public async onEditEmployeeFromDialog(): Promise<void> {
        const detailsModel = this.getView()?.getModel("employeeDetails") as JSONModel;
        const details = detailsModel?.getData() || {};
        const employee = this.findTeamEmployeeById(details.employeeId || this.currentDialogEmployeeId || "");
        const currentUserModel = this.getOwnerComponent()?.getModel("currentUser") as JSONModel;
        const currentUser = currentUserModel?.getData() || {};
        const effectiveManagerId = details.managerId || this.currentManagerId || "";
        const effectiveManagerName = currentUser?.name || "Current Manager";

        const editorModel = new JSONModel({
            mode: "edit",
            employeeId: details.employeeId || this.currentDialogEmployeeId,
            name: details.name || "",
            email: details.email || "",
            businessRole: employee?.role || "Employee",
            professionalRole: details.role || "Developer",
            team: details.team || "",
            subTeam: details.subTeam || "",
            managerId: effectiveManagerId,
            managerLabel: `${effectiveManagerName} (${effectiveManagerId})`,
            experience: Number(details.experience || 0),
            location: details.location || "",
            tLevel: details.tLevel || "",
            gradeLevel: details.gradeLevel || "",
            specialization: details.specialization || "General"
        });
        this.getView()?.setModel(editorModel, "employeeEditor");
        this.getView()?.setModel(new JSONModel({ skills: details.skills || [] }), "employeeEditorSkills");
        this.getView()?.setModel(new JSONModel({ certifications: details.certifications || [] }), "employeeEditorCertifications");

        if (!this.employeeProfileDialog) {
            this.employeeProfileDialog = await Fragment.load({
                id: this.getView()?.getId(),
                name: "skillsphere.view.dialogs.ManagerEmployeeProfileDialog",
                controller: this
            }) as Dialog;
            this.getView()?.addDependent(this.employeeProfileDialog);
        }

        this.employeeProfileDialog.open();
    }

    public onCloseEmployeeProfileDialog(): void {
        this.employeeProfileDialog?.close();
    }

    public async onSaveEmployeeProfileFromManager(): Promise<void> {
        try {
            const editorModel = this.getView()?.getModel("employeeEditor") as JSONModel;
            const data = editorModel?.getData() || {};
            const mode = data.mode || "create";
            const employeeId = String(data.employeeId || "").trim().toUpperCase();
            const managerId = mode === "create"
                ? String(this.currentManagerId || "").trim().toUpperCase()
                : String(data.managerId || this.currentManagerId || "").trim().toUpperCase();
            const managerSubTeam = String(data.subTeam || "").trim();
            const normalizedSubTeam = /^Team\s*[1-9]$/i.test(managerSubTeam)
                ? managerSubTeam.replace(/\s+/g, " ")
                : (/^Nirmala Team$/i.test(managerSubTeam) ? "Nirmala Team" : "Team 1");

            if (mode === "create" && !managerId) {
                MessageToast.show("Current manager context not found. Please re-login and try again.");
                return;
            }

            if (!employeeId || !data.name || !data.email || !data.team || !normalizedSubTeam || !data.location || !data.tLevel || !data.gradeLevel) {
                MessageToast.show("Please fill all required fields");
                return;
            }

            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            const employeesBinding = oDataModel.bindList("/Employees");
            employeesBinding.filter([new Filter("employeeId", FilterOperator.EQ, employeeId)]);
            const employeeContexts = await employeesBinding.requestContexts(0, 1);

            if (mode === "create" && employeeContexts.length > 0) {
                MessageToast.show(`Employee ${employeeId} already exists`);
                return;
            }

            if (mode === "create") {
                employeesBinding.create({
                    employeeId,
                    name: data.name.trim(),
                    role: "Employee",
                    team: data.team.trim(),
                    subTeam: normalizedSubTeam,
                    managerId,
                    email: data.email.trim(),
                    experience: Number(data.experience || 0),
                    totalSkills: 0,
                    totalProjects: 0,
                    location: data.location.trim(),
                    tLevel: data.tLevel,
                    gradeLevel: data.gradeLevel
                });
            } else if (employeeContexts.length > 0) {
                const employeeContext = employeeContexts[0];
                employeeContext.setProperty("name", data.name.trim());
                employeeContext.setProperty("role", data.businessRole || "Employee");
                employeeContext.setProperty("team", data.team.trim());
                employeeContext.setProperty("subTeam", normalizedSubTeam);
                employeeContext.setProperty("managerId", managerId);
                employeeContext.setProperty("email", data.email.trim());
                employeeContext.setProperty("experience", Number(data.experience || 0));
                employeeContext.setProperty("location", data.location.trim());
                employeeContext.setProperty("tLevel", data.tLevel);
                employeeContext.setProperty("gradeLevel", data.gradeLevel);
            } else {
                MessageToast.show("Employee not found for update");
                return;
            }

            const profileBinding = oDataModel.bindList("/Profiles");
            profileBinding.filter([new Filter("employeeId", FilterOperator.EQ, employeeId)]);
            const profileContexts = await profileBinding.requestContexts(0, 1);
            const lastUpdated = new Date().toISOString();

            if (profileContexts.length > 0) {
                const profileContext = profileContexts[0];
                profileContext.setProperty("specialization", String(data.specialization || "General").trim());
                profileContext.setProperty("role", data.professionalRole || "Developer");
                profileContext.setProperty("location", data.location.trim());
                profileContext.setProperty("tLevel", data.tLevel);
                profileContext.setProperty("gradeLevel", data.gradeLevel);
                profileContext.setProperty("lastUpdated", lastUpdated);
            } else {
                profileBinding.create({
                    employeeId,
                    specialization: String(data.specialization || "General").trim(),
                    role: data.professionalRole || "Developer",
                    location: data.location.trim(),
                    tLevel: data.tLevel,
                    gradeLevel: data.gradeLevel,
                    lastUpdated
                });
            }

            await oDataModel.submitBatch(oDataModel.getUpdateGroupId());
            await this.loadManagerData();

            this.currentDialogEmployeeId = employeeId;

            if (mode === "create") {
                this.employeeProfileDialog?.close();
                MessageToast.show("Employee added successfully");
                return;
            }

            this.employeeProfileDialog?.close();
            await this.refreshCurrentDialogData();
            await this.refreshEmployeeEditorCollections(employeeId);
            MessageToast.show("Employee updated successfully");
        } catch (error) {
            console.error("❌ Error saving employee from manager dialog:", error);
            MessageToast.show("Error saving employee");
        }
    }

    private async refreshCurrentDialogData(): Promise<void> {
        if (!this.currentDialogEmployeeId) return;
        const dialog = this.byId("employeeDetailsDialog") as any;
        if (!dialog || (typeof dialog.isOpen === "function" && !dialog.isOpen())) return;
        const employee = this.findTeamEmployeeById(this.currentDialogEmployeeId) || {
            employeeId: this.currentDialogEmployeeId,
            working_on_project: false
        };
        await this.openEmployeeDetailsDialog(employee, false);
    }

    private async refreshEmployeeEditorCollections(employeeId: string): Promise<void> {
        const [skills, certifications] = await Promise.all([
            this.getEmployeeSkills(employeeId),
            this.getCertifications(employeeId)
        ]);

        this.getView()?.setModel(new JSONModel({ skills: skills || [] }), "employeeEditorSkills");
        this.getView()?.setModel(new JSONModel({ certifications: certifications || [] }), "employeeEditorCertifications");
    }

    private getEventObjectFromModels(event: Event, modelNames: string[]): any {
        const source = event.getSource() as any;
        for (const modelName of modelNames) {
            const context = source.getBindingContext(modelName);
            if (context) return context.getObject();
        }
        return null;
    }

    private findTeamEmployeeById(employeeId: string): any | null {
        const teamModel = this.getView()?.getModel("managerEmployees") as JSONModel;
        const employees = teamModel?.getProperty("/employees") || [];
        return employees.find((emp: any) => emp.employeeId === employeeId) || null;
    }

    private getSkillCatalogByCategory(category: string): string[] {
        const catalog: Record<string, string[]> = {
            Frontend: ["SAPUI5", "Fiori Elements", "JavaScript", "TypeScript", "React", "HTML5", "CSS3"],
            Backend: ["ABAP", "Java", "Node.js", "Python", "CAP (Cloud Application Programming)"],
            FullStack: ["SAP CAP", "MEAN Stack", "MERN Stack", "Microservices Architecture"],
            Database: ["SAP HANA", "HANA Cloud", "SQL", "PostgreSQL", "MongoDB"],
            Cloud: ["SAP BTP (Business Technology Platform)", "Cloud Foundry", "Kyma Runtime", "Kubernetes", "Docker"],
            Integration: ["SAP CPI (Cloud Platform Integration)", "SAP Integration Suite", "REST API", "SOAP", "OData"],
            Analytics: ["SAP Analytics Cloud (SAC)", "Power BI", "Tableau", "SAP BW/4HANA"],
            Mobile: ["SAP Mobile Services", "iOS Development", "Android Development", "Flutter"],
            DevOps: ["CI/CD", "Jenkins", "Git", "GitHub Actions", "Terraform"],
            Testing: ["SAP Test Automation", "Selenium", "Jest", "QUnit", "Postman"],
            Security: ["SAP Security", "OAuth", "SAML", "Identity & Access Management"],
            Procurement: ["SAP Ariba", "Ariba Procurement", "Supplier Management"]
        };
        return catalog[category] || [];
    }

    public async onManagerAddSkill(): Promise<void> {
        if (!this.currentDialogEmployeeId) {
            MessageToast.show("Select an employee first");
            return;
        }

        if (this.addSkillDialog) {
            this.addSkillDialog.destroy();
            this.addSkillDialog = undefined;
        }

        this.addSkillDialog = await Fragment.load({
            name: "skillsphere.view.dialogs.AddSkillDialog",
            controller: this
        }) as Dialog;
        this.getView()?.addDependent(this.addSkillDialog);

        this.getView()?.setModel(new JSONModel({
            skillName: "",
            category: "",
            proficiency: "",
            yearsExperience: 0,
            certificationStatus: ""
        }), "newSkill");
        this.getView()?.setModel(new JSONModel({ skills: [] }), "skillCatalog");

        this.addSkillDialog.open();
    }

    public onCloseAddSkillDialog(): void {
        if (!this.addSkillDialog) return;
        this.addSkillDialog.close();
        this.addSkillDialog.attachAfterClose(() => {
            this.addSkillDialog?.destroy();
            this.addSkillDialog = undefined;
        });
    }

    public onSkillCategoryChange(event: Event): void {
        const select = event.getSource() as any;
        const selectedCategory = select.getSelectedKey();
        const categorySkills = this.getSkillCatalogByCategory(selectedCategory);
        const skillsWithPlaceholder = [{ name: "" }, ...categorySkills.map(name => ({ name }))];

        const catalogModel = this.getView()?.getModel("skillCatalog") as JSONModel;
        catalogModel?.setData({ skills: skillsWithPlaceholder });

        const newSkillModel = this.getView()?.getModel("newSkill") as JSONModel;
        if (newSkillModel) {
            const data = newSkillModel.getData();
            data.category = selectedCategory;
            data.skillName = "";
            newSkillModel.setData(data);
        }
    }

    public onProficiencyChange(event: Event): void {
        const select = event.getSource() as any;
        const selectedKey = select.getSelectedKey();
        const newSkillModel = this.getView()?.getModel("newSkill") as JSONModel;
        if (!newSkillModel) return;
        const data = newSkillModel.getData();
        data.proficiency = selectedKey;
        newSkillModel.setData(data);
    }

    public onCertificationChange(event: Event): void {
        const select = event.getSource() as any;
        const selectedKey = select.getSelectedKey();
        const newSkillModel = this.getView()?.getModel("newSkill") as JSONModel;
        if (!newSkillModel) return;
        const data = newSkillModel.getData();
        data.certificationStatus = selectedKey;
        newSkillModel.setData(data);
    }

    public async onSaveSkill(): Promise<void> {
        const employeeId = this.currentDialogEmployeeId;
        if (!employeeId) {
            MessageToast.show("Employee ID not found");
            return;
        }

        const newSkillModel = this.getView()?.getModel("newSkill") as JSONModel;
        const formData = newSkillModel?.getData();

        if (!formData?.skillName || !formData?.category || !formData?.proficiency) {
            MessageToast.show("Please fill all required skill fields");
            return;
        }

        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            const listBinding = oDataModel.bindList("/Skills");
            listBinding.create({
                employeeId,
                skillName: formData.skillName,
                category: formData.category,
                proficiencyLevel: formData.proficiency,
                yearsExperience: parseInt(formData.yearsExperience) || 0,
                certificationStatus: formData.certificationStatus || "None"
            });

            await oDataModel.submitBatch(oDataModel.getUpdateGroupId());
            await this.refreshCurrentDialogData();
            await this.refreshEmployeeEditorCollections(employeeId);
            this.onCloseAddSkillDialog();
            MessageToast.show("Skill added successfully");
        } catch (error) {
            console.error("❌ Error adding skill from manager dialog:", error);
            MessageToast.show("Error adding skill");
        }
    }

    public onEditSkillCategoryChange(event: Event): void {
        const select = event.getSource() as any;
        const selectedCategory = select.getSelectedKey();
        const categorySkills = this.getSkillCatalogByCategory(selectedCategory);
        const skillsWithPlaceholder = [{ name: "" }, ...categorySkills.map(name => ({ name }))];

        const catalogModel = this.getView()?.getModel("editSkillCatalog") as JSONModel;
        catalogModel?.setData({ skills: skillsWithPlaceholder });

        const editSkillModel = this.getView()?.getModel("editSkill") as JSONModel;
        if (editSkillModel) {
            const data = editSkillModel.getData();
            data.category = selectedCategory;
            data.skillName = "";
            editSkillModel.setData(data);
        }
    }

    public onEditProficiencyChange(event: Event): void {
        const select = event.getSource() as any;
        const selectedKey = select.getSelectedKey();
        const editSkillModel = this.getView()?.getModel("editSkill") as JSONModel;
        if (!editSkillModel) return;
        const data = editSkillModel.getData();
        data.proficiency = selectedKey;
        editSkillModel.setData(data);
    }

    public onEditCertificationChange(event: Event): void {
        const select = event.getSource() as any;
        const selectedKey = select.getSelectedKey();
        const editSkillModel = this.getView()?.getModel("editSkill") as JSONModel;
        if (!editSkillModel) return;
        const data = editSkillModel.getData();
        data.certificationStatus = selectedKey;
        editSkillModel.setData(data);
    }

    public async onManagerEditSkill(event: Event): Promise<void> {
        const skillData = this.getEventObjectFromModels(event, ["employeeDetails", "employeeEditorSkills"]);
        if (!skillData) return;

        if (this.editSkillDialog) {
            this.editSkillDialog.destroy();
            this.editSkillDialog = undefined;
        }

        this.getView()?.setModel(new JSONModel({
            ...skillData,
            proficiency: skillData.proficiencyLevel
        }), "editSkill");
        this.getView()?.setModel(new JSONModel({ skills: [] }), "editSkillCatalog");

        this.editSkillDialog = await Fragment.load({
            name: "skillsphere.view.dialogs.EditSkillDialog",
            controller: this
        }) as Dialog;
        this.getView()?.addDependent(this.editSkillDialog);

        if (skillData.category) {
            const skillsWithPlaceholder = [{ name: "" }, ...this.getSkillCatalogByCategory(skillData.category).map(name => ({ name }))];
            const catalogModel = this.getView()?.getModel("editSkillCatalog") as JSONModel;
            catalogModel?.setData({ skills: skillsWithPlaceholder });
        }

        this.editSkillDialog.open();
    }

    public onCloseEditSkillDialog(): void {
        if (!this.editSkillDialog) return;
        this.editSkillDialog.close();
        this.editSkillDialog.attachAfterClose(() => {
            this.editSkillDialog?.destroy();
            this.editSkillDialog = undefined;
        });
    }

    public async onSaveEditedSkill(): Promise<void> {
        const editSkillModel = this.getView()?.getModel("editSkill") as JSONModel;
        const skillData = editSkillModel?.getData() || {};
        const skillId = skillData.skillId || skillData.id;

        if (!skillId || !skillData.skillName || !skillData.proficiency) {
            MessageToast.show("Please fill all required skill fields");
            return;
        }

        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            const listBinding = oDataModel.bindList("/Skills");
            listBinding.filter([new Filter("skillId", FilterOperator.EQ, skillId)]);
            const contexts = await listBinding.requestContexts(0, 1);

            if (contexts.length === 0) {
                MessageToast.show("Skill not found");
                return;
            }

            const context = contexts[0];
            context.setProperty("skillName", skillData.skillName);
            context.setProperty("category", skillData.category);
            context.setProperty("proficiencyLevel", skillData.proficiency);
            context.setProperty("yearsExperience", skillData.yearsExperience || 0);
            context.setProperty("certificationStatus", skillData.certificationStatus || "None");

            await oDataModel.submitBatch(oDataModel.getUpdateGroupId());
            await this.refreshCurrentDialogData();
            if (this.currentDialogEmployeeId) {
                await this.refreshEmployeeEditorCollections(this.currentDialogEmployeeId);
            }
            this.onCloseEditSkillDialog();
            MessageToast.show("Skill updated successfully");
        } catch (error) {
            console.error("❌ Error updating skill:", error);
            MessageToast.show("Error updating skill");
        }
    }

    public async onManagerDeleteSkill(event: Event): Promise<void> {
        const skillData = this.getEventObjectFromModels(event, ["employeeDetails", "employeeEditorSkills"]);
        const skillId = skillData?.skillId || skillData?.id;

        if (!skillId) {
            MessageToast.show("Skill not found");
            return;
        }

        const confirmed = await new Promise<boolean>((resolve) => {
            MessageBox.confirm("Delete this skill?", {
                actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                onClose: (action: string) => resolve(action === MessageBox.Action.OK)
            });
        });

        if (!confirmed) return;

        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            const listBinding = oDataModel.bindList("/Skills");
            listBinding.filter([new Filter("skillId", FilterOperator.EQ, skillId)]);
            const contexts = await listBinding.requestContexts(0, 1);

            if (contexts.length === 0) {
                MessageToast.show("Skill not found");
                return;
            }

            contexts[0].delete();
            await oDataModel.submitBatch(oDataModel.getUpdateGroupId());
            await this.refreshCurrentDialogData();
            if (this.currentDialogEmployeeId) {
                await this.refreshEmployeeEditorCollections(this.currentDialogEmployeeId);
            }
            MessageToast.show("Skill deleted successfully");
        } catch (error) {
            console.error("❌ Error deleting skill:", error);
            MessageToast.show("Error deleting skill");
        }
    }

    public async onManagerAddCertification(): Promise<void> {
        if (!this.currentDialogEmployeeId) {
            MessageToast.show("Select an employee first");
            return;
        }

        if (!this.certificationDialog) {
            this.certificationDialog = await Fragment.load({
                id: this.getView()?.getId(),
                name: "skillsphere.view.dialogs.CertificationDialog",
                controller: this
            }) as Dialog;
            this.getView()?.addDependent(this.certificationDialog);
        }

        this.getView()?.setModel(new JSONModel({
            certificationId: null,
            name: "",
            code: "",
            dateOfCompletion: "",
            description: "",
            level: "Associate"
        }), "certificationDialog");

        this.certificationDialog.open();
    }

    public async onManagerEditCertification(event: Event): Promise<void> {
        const certification = this.getEventObjectFromModels(event, ["employeeDetails", "employeeEditorCertifications"]);
        if (!certification) return;

        if (!this.certificationDialog) {
            this.certificationDialog = await Fragment.load({
                id: this.getView()?.getId(),
                name: "skillsphere.view.dialogs.CertificationDialog",
                controller: this
            }) as Dialog;
            this.getView()?.addDependent(this.certificationDialog);
        }

        this.getView()?.setModel(new JSONModel(certification), "certificationDialog");
        this.certificationDialog.open();
    }

    public async onSaveCertification(): Promise<void> {
        const dialogModel = this.getView()?.getModel("certificationDialog") as JSONModel;
        const data = dialogModel?.getData() || {};
        const employeeId = this.currentDialogEmployeeId;

        if (!employeeId) {
            MessageToast.show("Employee ID not found");
            return;
        }

        if (!data.name || !data.code || !data.dateOfCompletion || !data.level) {
            MessageToast.show("Please fill all required certification fields");
            return;
        }

        const convertToISODate = (dateString: string): string | null => {
            if (!dateString) return null;
            const date = new Date(dateString);
            if (Number.isNaN(date.getTime())) return null;
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, "0");
            const day = String(date.getDate()).padStart(2, "0");
            return `${year}-${month}-${day}`;
        };

        const dateOfCompletionISO = convertToISODate(data.dateOfCompletion);
        if (!dateOfCompletionISO) {
            MessageToast.show("Invalid date");
            return;
        }

        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            const listBinding = oDataModel.bindList("/Certifications");

            if (data.certificationId) {
                listBinding.filter([new Filter("certificationId", FilterOperator.EQ, data.certificationId)]);
                const contexts = await listBinding.requestContexts(0, 1);
                if (contexts.length === 0) {
                    MessageToast.show("Certification not found");
                    return;
                }

                const ctx = contexts[0];
                ctx.setProperty("name", data.name);
                ctx.setProperty("code", data.code);
                ctx.setProperty("dateOfCompletion", dateOfCompletionISO);
                ctx.setProperty("description", data.description || "");
                ctx.setProperty("level", data.level);
                ctx.setProperty("lastUpdated", new Date().toISOString());
            } else {
                listBinding.create({
                    employeeId,
                    name: data.name,
                    code: data.code,
                    dateOfCompletion: dateOfCompletionISO,
                    description: data.description || "",
                    level: data.level,
                    createdAt: new Date().toISOString(),
                    lastUpdated: new Date().toISOString()
                });
            }

            await oDataModel.submitBatch(oDataModel.getUpdateGroupId());
            this.certificationDialog?.close();
            await this.refreshCurrentDialogData();
            await this.refreshEmployeeEditorCollections(employeeId);
            MessageToast.show(data.certificationId ? "Certification updated successfully" : "Certification added successfully");
        } catch (error) {
            console.error("❌ Error saving certification:", error);
            MessageToast.show("Error saving certification");
        }
    }

    public async onManagerDeleteCertification(event: Event): Promise<void> {
        const certification = this.getEventObjectFromModels(event, ["employeeDetails", "employeeEditorCertifications"]);
        const certificationId = certification?.certificationId;

        if (!certificationId) {
            MessageToast.show("Certification not found");
            return;
        }

        const confirmed = await new Promise<boolean>((resolve) => {
            MessageBox.confirm("Delete this certification?", {
                actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                onClose: (action: string) => resolve(action === MessageBox.Action.OK)
            });
        });

        if (!confirmed) return;

        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            const listBinding = oDataModel.bindList("/Certifications");
            listBinding.filter([new Filter("certificationId", FilterOperator.EQ, certificationId)]);
            const contexts = await listBinding.requestContexts(0, 1);

            if (contexts.length === 0) {
                MessageToast.show("Certification not found");
                return;
            }

            contexts[0].delete();
            await oDataModel.submitBatch(oDataModel.getUpdateGroupId());
            await this.refreshCurrentDialogData();
            if (this.currentDialogEmployeeId) {
                await this.refreshEmployeeEditorCollections(this.currentDialogEmployeeId);
            }
            MessageToast.show("Certification deleted successfully");
        } catch (error) {
            console.error("❌ Error deleting certification:", error);
            MessageToast.show("Error deleting certification");
        }
    }

    public onCloseCertificationDialog(): void {
        this.certificationDialog?.close();
    }

    /**
     * View all team members
     */
    public onViewTotalEmployees(): void {
        const managerEmployeesModel = this.getView()?.getModel("managerEmployees") as JSONModel;
        const allEmployees = managerEmployeesModel?.getData()?.employees || [];
        
        console.log(`📊 Showing all ${allEmployees.length} team members`);
        
        this.openAnalyticsListDialog("All Team Members", allEmployees);
    }

    /**
     * View available employees from Team Analytics (not working on project)
     */
    public onViewAvailableEmployeesFromAnalytics(): void {
        const managerEmployeesModel = this.getView()?.getModel("managerEmployees") as JSONModel;
        const allEmployees = managerEmployeesModel?.getData()?.employees || [];
        
        const availableEmployees = allEmployees.filter((emp: any) => !emp.working_on_project);
        
        console.log(`📊 Showing ${availableEmployees.length} available employees`);
        
        this.openAnalyticsListDialog("Available Resources", availableEmployees);
    }

    /**
     * View busy employees (working on project)
     */
    public onViewBusyEmployees(): void {
        const managerEmployeesModel = this.getView()?.getModel("managerEmployees") as JSONModel;
        const allEmployees = managerEmployeesModel?.getData()?.employees || [];
        
        const busyEmployees = allEmployees.filter((emp: any) => emp.working_on_project);
        
        console.log(`📊 Showing ${busyEmployees.length} employees on projects`);
        
        this.openAnalyticsListDialog("Employees Working on Projects", busyEmployees);
    }

    /**
     * Open analytics list dialog with filtered employees
     */
    private openAnalyticsListDialog(title: string, employees: any[]): void {
        const dialog = this.byId("analyticsListDialog") as any;
        if (!dialog) {
            MessageToast.show("Dialog not found");
            return;
        }

        // Set dialog title
        dialog.setTitle(title + ` (${employees.length})`);

        // Create model for analytics list
        const analyticsModel = new JSONModel({ employees: employees });
        this.getView()?.setModel(analyticsModel, "analyticsList");

        // Open dialog
        dialog.open();
    }

    /**
     * View employee details from analytics dialog
     */
    public onViewEmployeeDetailsFromAnalytics(event: Event): void {
        const source = event.getSource();
        const bindingContext = (source as any).getBindingContext("analyticsList");
        
        if (!bindingContext) {
            MessageToast.show("Unable to load employee details");
            return;
        }
        
        const employee = bindingContext.getObject();
        
        // Close analytics dialog first
        const analyticsDialog = this.byId("analyticsListDialog") as any;
        if (analyticsDialog) {
            analyticsDialog.close();
        }
        
        // Open employee details dialog
        this.openEmployeeDetailsDialog(employee, false);
    }

    /**
     * Close analytics list dialog
     */
    public onCloseAnalyticsDialog(): void {
        const dialog = this.byId("analyticsListDialog") as any;
        if (dialog) {
            dialog.close();
        }
    }

    // Enhanced formatter methods
    public formatWorkingStatus(workingOnProject: boolean): string {
        return workingOnProject ? "Working on Project" : "Available";
    }

    public formatWorkingStatusState(workingOnProject: boolean): string {
        return workingOnProject ? "Error" : "Success";
    }

    public formatSkillCount(totalMatchingSkills: number): string {
        return totalMatchingSkills ? `${totalMatchingSkills} matching skills` : "";
    }

    public formatMatchScoreState(matchScore: number): string {
        if (matchScore >= 80) return "Success";
        if (matchScore >= 60) return "Warning";
        return "Error";
    }

    public formatMatchScoreText(matchScore: number): string {
        if (matchScore >= 80) return "Excellent Match";
        if (matchScore >= 60) return "Good Match";
        if (matchScore >= 40) return "Partial Match";
        return "Low Match";
    }

    public formatProficiencyState(proficiencyLevel: string): string {
        const stateMap: { [key: string]: string } = {
            "Expert": "Success",
            "Advanced": "Success",
            "Proficient": "Information",
            "Intermediate": "Warning",
            "Beginner": "None"
        };
        return stateMap[proficiencyLevel] || "None";
    }

    public formatCertificationState(certificationStatus: string): string {
        const stateMap: { [key: string]: string } = {
            "Certified": "Success",
            "In Progress": "Warning",
            "Not Certified": "None",
            "None": "None"
        };
        return stateMap[certificationStatus] || "None";
    }

    public formatTypeState(type: string): string {
        const stateMap: { [key: string]: string } = {
            "Project": "Success",
            "Evaluation": "Warning",
            "Initiative": "Information",
            "CAIA": "Error",
            "POC": "Information"
        };
        return stateMap[type] || "None";
    }

    public formatAssignmentStatusState(status: string): string {
        const stateMap: { [key: string]: string } = {
            "Accepted": "Success",
            "Self-Assigned": "Success",
            "Assigned": "Success",
            "Completed": "Information",
            "Pending": "Warning",
            "Rejected": "Error"
        };
        return stateMap[status] || "None";
    }

    public formatAssignmentStatusLabel(status: string): string {
        if (!status) return "Assigned";
        if (status === "Pending" || status === "Accepted" || status === "Rejected") {
            return "Assigned";
        }
        return status;
    }

    // ==================== AI ASSISTANT METHODS ====================

    private managerId: string = "";
private aiInitialized: boolean = false;
private typingIndicator: any = null;

// REQUIRED to track login switch (same pattern as employee)
private currentChatManagerId: string = "";


    /**
     * Open AI Assistant Dialog
     */
  public onOpenAIAssistant(): void {
    const currentUserModel = this.getOwnerComponent()
        ?.getModel("currentUser") as JSONModel;

    const userData = currentUserModel?.getData();

    if (!userData?.managerId) {
        console.error("❌ No managerId found in currentUser model");
        MessageToast.show("Please login first");
        return;
    }

    const newManagerId = userData.managerId;
    console.log("🔑 Manager ID for AI (fresh):", newManagerId);

    // ✅ Clear chat ONLY if manager changes
    if (this.currentChatManagerId !== newManagerId) {
        console.log(
            `🔄 Different manager detected (was: ${this.currentChatManagerId}, now: ${newManagerId})`
        );
        this.clearChatForNewManager();
        this.currentChatManagerId = newManagerId;
    }

    this.managerId = newManagerId;

    // Initialize chat only once per manager
    const oContainer = this.byId("messagesContainerManager") as any;
    if (!oContainer || oContainer.getItems().length === 0) {
        this.initializeAIChat();
    }

    const oDialog = this.byId("aiAssistantDialogManager") as Dialog;
    oDialog?.open();
}


/**
 * Close AI Assistant Dialog
 */
public onCloseAIDialog(): void {
    const oDialog = this.byId("aiAssistantDialogManager") as Dialog;
    oDialog?.close();
    // ❗ Do NOT clear chat here
}

private clearChatForNewManager(): void {
    console.log("🧹 Clearing chat for new manager");

    const oContainer = this.byId("messagesContainerManager") as any;
    if (oContainer) {
        oContainer.destroyItems();
    }

    if (this.typingIndicator) {
        this.typingIndicator.destroy();
        this.typingIndicator = null;
    }

    this.aiInitialized = false;
}

/**
 * Initialize chat with welcome message
 */
private initializeAIChat(): void {
    if (this.aiInitialized) {
        console.log("ℹ️ Manager AI chat already initialized");
        return;
    }

    const currentUserModel = this.getOwnerComponent()
        ?.getModel("currentUser") as JSONModel;

    const userData = currentUserModel?.getData();
    const managerName = userData?.name || "Manager";

    this.addBotMessage(
        `👋 Hello ${managerName}! I'm your AI assistant.\n\n` +
        "I can help you with:\n" +
        "• Finding team members with specific skills\n" +
        "• Checking team availability\n" +
        "• Analyzing skill gaps\n" +
        "• Project allocations\n\n" +
        "What would you like to do?"
    );

    this.aiInitialized = true;
}



    /**
     * Handle quick action buttons
     */
   public onQuickAction(oEvent: Event): void {
    const button = oEvent.getSource() as any;
    const sButtonText = button.getText();
    let query = "";

    switch (sButtonText) {
        case "Team Skills":
            query = "Show me a summary of all skills in my team";
            break;
        case "Availability":
            query = "Who is available in my team this week?";
            break;
        case "Team Members":
            query = "List all members in my team with their current status";
            break;
    }

    const input = this.byId("messageInputManager") as any;
    input?.setValue(query);
    this.onSendMessage();
}


    /**
     * Send message to AI
     */
   public onSendMessage(): void {
    const oInput = this.byId("messageInputManager") as any;
    const sMessage = oInput?.getValue().trim();

    if (!sMessage) {
        MessageToast.show("Please enter a message");
        return;
    }

    // Ensure managerId exists
    if (!this.managerId) {
        const currentUserModel = this.getOwnerComponent()
            ?.getModel("currentUser") as JSONModel;
        const userData = currentUserModel?.getData();
        this.managerId = userData?.managerId || "";
    }

    if (!this.managerId) {
        MessageToast.show("Manager ID not found. Please login again.");
        return;
    }

    this.addUserMessage(sMessage);
    oInput.setValue("");
    this.showTypingIndicator();
    this.queryAI(sMessage);
}


    /**
     * Query AI service - CORRECTED for OData V4 Unbound Actions
     */
   private async queryAI(query: string): Promise<void> {
    try {
        console.log("🤖 Querying AI");
        console.log("  - Manager ID:", this.managerId);
        console.log("  - Query:", query);

        if (!this.managerId) {
            throw new Error("Manager ID is required");
        }

        // Use OData V4 model action binding — handles CSRF automatically
        const oDataModel = this.getOwnerComponent()?.getModel() as any;
        const oAction = oDataModel.bindContext("/managerQuery(...)");
        oAction.setParameter("managerId", this.managerId);
        oAction.setParameter("queryType", "general");
        oAction.setParameter("context", query);
        await oAction.execute("$auto");
        const result = oAction.getBoundContext().getObject();
        this.removeTypingIndicator();

        if (result.answer) {
            this.addBotMessage(result.answer);
        } else if (result.value?.answer) {
            this.addBotMessage(result.value.answer);
        } else {
            this.addBotMessage("⚠️ Received an unexpected response format.");
            console.log("Response:", result);
        }
    } catch (error: any) {
        this.removeTypingIndicator();
        this.addBotMessage("⚠️ Connection error. Please try again.");
        console.error("AI Query Error:", error);
    }
}

    /**
     * Add user message to chat
     */
    private addUserMessage(message: string): void {
        const oContainer = this.byId("messagesContainerManager") as any;
        
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
     * Add bot message to chat
     */
    private addBotMessage(message: string): void {
        const oContainer = this.byId("messagesContainerManager") as any;
        
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
        const oContainer = this.byId("messagesContainerManager") as any;
        
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
            const oContainer = this.byId("messagesContainerManager") as any;
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
            const oScrollContainer = this.byId("chatContainerManager") as any;
            if (oScrollContainer) {
                oScrollContainer.scrollTo(0, 10000);
            }
        }, 100);
    }

    /**
     * Clear chat
     */
    public onClearChat(): void {
        console.log("🧹 Manual chat clear requested");
        const oContainer = this.byId("messagesContainerManager") as any;
        oContainer?.destroyItems();

        // Remove typing indicator
        if (this.typingIndicator) {
            this.typingIndicator.destroy();
            this.typingIndicator = null;
        }

        this.aiInitialized = false;
        this.initializeAIChat();
    }

    // ==================== MANAGER ADD PROJECT ====================

    private async getCurrentManagerName(): Promise<string> {
        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            const managersBinding = oDataModel.bindList("/Employees");
            managersBinding.filter([
                new Filter("employeeId", FilterOperator.EQ, this.currentManagerId),
                new Filter("role", FilterOperator.EQ, "Manager")
            ]);
            
            const contexts = await managersBinding.requestContexts(0, 1);
            if (contexts.length > 0) {
                const manager = contexts[0].getObject();
                return manager.name || "";
            }
            return "";
        } catch (error) {
            console.error("Error getting current manager name:", error);
            return "";
        }
    }

    private async loadManagersForProjectDialog(): Promise<void> {
        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            const managersBinding = oDataModel.bindList("/Employees");
            managersBinding.filter([new Filter("role", FilterOperator.EQ, "Manager")]);
            
            const contexts = await managersBinding.requestContexts(0, 1000);
            const managers = contexts.map((ctx: any) => ctx.getObject())
                .map((m: any) => ({ name: m.name }));
            
            // Set models for both PM and LM dropdowns
            this.getView()?.setModel(new JSONModel({ managers }), "pmList");
            this.getView()?.setModel(new JSONModel({ managers }), "lmList");
            
            console.log(`Loaded ${managers.length} managers for project dialog dropdowns`);
        } catch (error) {
            console.error("Error loading managers for project dialog:", error);
            this.getView()?.setModel(new JSONModel({ managers: [] }), "pmList");
            this.getView()?.setModel(new JSONModel({ managers: [] }), "lmList");
        }
    }

    private async loadProjectManagerCandidates(): Promise<void> {
        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;

            // Load T3/T4/T5 employees from Employees entity
            const empBinding = oDataModel.bindList("/Employees");
            empBinding.filter([new Filter({
                filters: [
                    new Filter("tLevel", FilterOperator.EQ, "T3"),
                    new Filter("tLevel", FilterOperator.EQ, "T4"),
                    new Filter("tLevel", FilterOperator.EQ, "T5")
                ],
                and: false
            })]);
            const empContexts = await empBinding.requestContexts(0, 500);
            const employees = empContexts.map((ctx: any) => ctx.getObject())
                .filter((e: any) => !String(e.employeeId).startsWith("MGR"));

            // Also include all managers (role=Manager)
            const mgrBinding = oDataModel.bindList("/Employees");
            mgrBinding.filter([new Filter("role", FilterOperator.EQ, "Manager")]);
            const mgrContexts = await mgrBinding.requestContexts(0, 100);
            const managers = mgrContexts.map((ctx: any) => ctx.getObject());

            // Merge without duplicates
            const seen = new Set<string>();
            const candidates: any[] = [];

            // Add the current manager first
            const currentManagerId = this.currentManagerId;
            const currentMgr = managers.find((m: any) => m.employeeId === currentManagerId);
            if (currentMgr) {
                seen.add(currentMgr.employeeId);
                candidates.push({ employeeId: currentMgr.employeeId, name: currentMgr.name });
            }

            // Add all managers
            managers.forEach((m: any) => {
                if (!seen.has(m.employeeId)) {
                    seen.add(m.employeeId);
                    candidates.push({ employeeId: m.employeeId, name: m.name });
                }
            });

            // Add T3/T4/T5 employees
            employees.forEach((e: any) => {
                if (!seen.has(e.employeeId)) {
                    seen.add(e.employeeId);
                    candidates.push({ employeeId: e.employeeId, name: e.name });
                }
            });

            // Sort: current manager first, then alphabetically
            candidates.sort((a: any, b: any) => {
                if (a.employeeId === currentManagerId) return -1;
                if (b.employeeId === currentManagerId) return 1;
                return a.name.localeCompare(b.name);
            });

            this.getView()?.setModel(new JSONModel({ managers: candidates }), "projectManagerList");
            console.log(`✅ Loaded ${candidates.length} project manager candidates (T3/T4/T5 + managers)`);
        } catch (error) {
            console.error("Error loading project manager candidates:", error);
            this.getView()?.setModel(new JSONModel({ managers: [] }), "projectManagerList");
        }
    }

    // ==================== MASTER PROJECT MANAGEMENT ====================

    /**
     * Load master projects for this manager from Projects entity
     */
    public async loadMasterProjects(): Promise<void> {
        if (!this.currentManagerId) return;

        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            const listBinding = oDataModel.bindList("/Projects");

            const contexts = await listBinding.requestContexts(0, 500);
            const projects = contexts.map((ctx: any) => ctx.getObject())
                .filter((p: any) => String(p.status || "").toLowerCase() !== "completed");

            console.log(`✅ Loaded ${projects.length} master projects for manager ${this.currentManagerId}`);

            const masterProjectsModel = new JSONModel({ projects: projects, allProjects: projects });
            this.getView()?.setModel(masterProjectsModel, "masterProjects");
            this.getView()?.setModel(new JSONModel({
                technologies: this.buildSelectOptions(projects.map((p: any) => String(p.technology || "")), "All Tech"),
                creators: this.buildSelectOptions(projects.map((p: any) => String(p.projectCreator || "")), "All Creators"),
                statuses: this.buildSelectOptions(projects.map((p: any) => String(p.status || "")), "All Status")
            }), "masterProjectFilterOptions");

            this.applyMasterProjectFilters();

            // Refresh the OData /Projects binding so the assign ComboBox picks up new/edited/deleted projects
            const assignComboBox = this.byId("assignProjectComboBox") as any;
            if (assignComboBox) {
                const binding = assignComboBox.getBinding("items");
                if (binding) {
                    binding.refresh();
                }
            }
        } catch (error) {
            console.error("❌ Error loading master projects:", error);
            this.getView()?.setModel(new JSONModel({ projects: [], allProjects: [] }), "masterProjects");
        }
    }

    /**
     * Search/filter master projects
     */
    public onMasterProjectSearch(event: Event): void {
        this.applyMasterProjectFilters();
    }

    public onMasterProjectFilterChange(): void {
        this.applyMasterProjectFilters();
    }

    private applyMasterProjectFilters(): void {
        const model = this.getView()?.getModel("masterProjects") as JSONModel;
        if (!model) return;

        const query = String((this.byId("masterProjectSearch") as any)?.getValue?.() || "").toLowerCase();
        const selectedTech = String((this.byId("masterProjectTechFilter") as any)?.getSelectedKey?.() || "").trim();
        const selectedCreator = String((this.byId("masterProjectCreatorFilter") as any)?.getSelectedKey?.() || "").trim();
        const selectedStatus = String((this.byId("masterProjectStatusFilter") as any)?.getSelectedKey?.() || "").trim();

        const allProjects = model.getProperty("/allProjects") || [];

        const filtered = allProjects.filter((p: any) => {
            const matchesText = !query
                || (p.projectName || "").toLowerCase().includes(query)
                || (p.technology || "").toLowerCase().includes(query)
                || (p.status || "").toLowerCase().includes(query)
                || (p.projectCreator || "").toLowerCase().includes(query);
            const matchesTech = !selectedTech || String(p.technology || "").trim() === selectedTech;
            const matchesCreator = !selectedCreator || String(p.projectCreator || "").trim() === selectedCreator;
            const matchesStatus = !selectedStatus || String(p.status || "").trim() === selectedStatus;
            return matchesText && matchesTech && matchesCreator && matchesStatus;
        });

        model.setProperty("/projects", filtered);
    }

    /**
     * Open Create Master Project dialog
     */
    public async onCreateMasterProject(): Promise<void> {
        if (this.createMasterProjectDialog) {
            this.createMasterProjectDialog.destroy();
            this.createMasterProjectDialog = undefined;
        }

        const currentManagerName = await this.getCurrentManagerName();
        const currentManagerLabel = [currentManagerName, this.currentManagerId]
            .filter((value) => Boolean(String(value || "").trim()))
            .join(" (")
            .replace(/\($/, "")
            .concat(currentManagerName && this.currentManagerId ? ")" : "");
        await this.loadProjectManagerCandidates();

        const newProjectModel = new JSONModel({
            projectName: "",
            technology: "",
            startDate: null,
            endDate: null,
            status: "Active",
            description: "",
            accountExecutiveManager: "",
            projectOrchestrator: "",
            projectManager: currentManagerName,
            projectCreator: currentManagerLabel || currentManagerName || this.currentManagerId || "",
            region: ""
        });
        this.getView()?.setModel(newProjectModel, "newMasterProject");

        this.createMasterProjectDialog = await Fragment.load({
            name: "skillsphere.view.dialogs.CreateMasterProjectDialog",
            controller: this
        }) as Dialog;
        this.getView()?.addDependent(this.createMasterProjectDialog);
        this.createMasterProjectDialog.open();
    }

    public onCloseMasterProjectDialog(): void {
        this.createMasterProjectDialog?.close();
    }

    /**
     * Save a new master project
     */
    public async onSaveMasterProject(): Promise<void> {
        const model = this.getView()?.getModel("newMasterProject") as JSONModel;
        const data = model?.getData();

        if (!data?.projectName) {
            MessageToast.show("Please enter a project name");
            return;
        }
        if (!data?.technology) {
            MessageToast.show("Please select a technology");
            return;
        }

        const convertToISODate = (dateString: string): string | null => {
            if (!dateString) return null;
            try {
                const date = new Date(dateString);
                if (isNaN(date.getTime())) return null;
                return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
            } catch { return null; }
        };

        const startDateISO = convertToISODate(data.startDate);
        const endDateISO = convertToISODate(data.endDate);

        let duration = "";
        if (startDateISO && endDateISO) {
            const diffDays = Math.ceil(Math.abs(new Date(endDateISO).getTime() - new Date(startDateISO).getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays < 30) {
                duration = `${diffDays} days`;
            } else if (diffDays < 365) {
                const mo = Math.floor(diffDays / 30);
                duration = `${mo} months`;
            } else {
                const yr = Math.floor(diffDays / 365);
                const mo = Math.floor((diffDays % 365) / 30);
                duration = mo > 0 ? `${yr} years ${mo} months` : `${yr} years`;
            }
        }

        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;

            const listBinding = oDataModel.bindList("/Projects");
            const createdProjectCtx = listBinding.create({
                projectId: this.generateUuid(),
                employeeId: "",
                projectCreator: data.projectCreator || "",
                projectName: data.projectName,
                role: "",
                startDate: startDateISO,
                endDate: endDateISO,
                evaluationStartDate: null,
                evaluationEndDate: null,
                status: data.status || "Active",
                description: data.description || "",
                duration: duration,
                projectManager: data.projectManager || "",
                region: data.region || "",
                accountExecutiveManager: data.accountExecutiveManager || "",
                lineManagerPOC: await this.getCurrentManagerName() || "",
                projectOrchestrator: data.projectOrchestrator || "",
                technology: data.technology || "",
                addedByManager: this.currentManagerId || ""
            }, true);

            await oDataModel.submitBatch(oDataModel.getUpdateGroupId());
            await createdProjectCtx.created();

            MessageToast.show("Project created successfully");
            this.createMasterProjectDialog?.close();

            // Refresh master projects list
            await this.loadMasterProjects();
        } catch (error) {
            console.error("❌ Error creating master project:", error);
            MessageToast.show("Error creating project");
        }
    }

    /**
     * Format project status state
     */
    public formatProjectStatusState(status: string): string {
        switch (status) {
            case "Active": return "Success";
            case "Completed": return "None";
            case "On Hold": return "Warning";
            default: return "None";
        }
    }

    /**
     * Edit a master project
     */
    public async onEditMasterProject(oEvent: Event): Promise<void> {
        const oSource = (oEvent.getSource() as any);
        const oContext = oSource.getBindingContext("masterProjects");
        const projectData = oContext.getObject();

        await this.loadProjectManagerCandidates();

        const editModel = new JSONModel({
            projectId: projectData.projectId,
            projectName: projectData.projectName,
            technology: projectData.technology,
            startDate: projectData.startDate,
            endDate: projectData.endDate,
            status: projectData.status,
            description: projectData.description || "",
            projectManager: projectData.projectManager || "",
            projectCreator: projectData.projectCreator || "",
            region: projectData.region || ""
        });
        this.getView()?.setModel(editModel, "editMasterProject");

        if (!this.editMasterProjectDialog) {
            this.editMasterProjectDialog = await Fragment.load({
                id: this.getView()?.getId(),
                name: "skillsphere.view.dialogs.EditMasterProjectDialog",
                controller: this
            }) as Dialog;
            this.getView()?.addDependent(this.editMasterProjectDialog);
        }
        this.editMasterProjectDialog.open();
    }

    /**
     * Save edited master project
     */
    public async onSaveEditMasterProject(): Promise<void> {
        const editModel = this.getView()?.getModel("editMasterProject") as JSONModel;
        const data = editModel.getData();

        if (!data.projectName || !data.technology) {
            MessageToast.show("Please fill in required fields");
            return;
        }

        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;

            // Calculate duration
            let duration = "";
            if (data.startDate && data.endDate) {
                const start = new Date(data.startDate);
                const end = new Date(data.endDate);
                const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                if (diffDays < 30) {
                    duration = `${diffDays} days`;
                } else if (diffDays < 365) {
                    const mo = Math.floor(diffDays / 30);
                    duration = `${mo} months`;
                } else {
                    const yr = Math.floor(diffDays / 365);
                    const mo = Math.floor((diffDays % 365) / 30);
                    duration = mo > 0 ? `${yr} years ${mo} months` : `${yr} years`;
                }
            }

            const listBinding = oDataModel.bindList("/Projects");
            listBinding.filter([new Filter("projectId", FilterOperator.EQ, data.projectId)]);
            const contexts = await listBinding.requestContexts(0, 1);

            if (contexts.length > 0) {
                const ctx = contexts[0];
                ctx.setProperty("projectName", data.projectName);
                ctx.setProperty("technology", data.technology);
                ctx.setProperty("startDate", data.startDate || null);
                ctx.setProperty("endDate", data.endDate || null);
                ctx.setProperty("status", data.status || "Active");
                ctx.setProperty("description", data.description || "");
                ctx.setProperty("duration", duration);
                ctx.setProperty("projectManager", data.projectManager || "");
                ctx.setProperty("region", data.region || "");

                await oDataModel.submitBatch(oDataModel.getUpdateGroupId());
                await new Promise(resolve => setTimeout(resolve, 600));

                MessageToast.show("Project updated successfully");
                this.editMasterProjectDialog?.close();
                await this.loadMasterProjects();
            } else {
                MessageToast.show("Project not found");
            }
        } catch (error) {
            console.error("❌ Error updating master project:", error);
            MessageToast.show("Error updating project");
        }
    }

    /**
     * Delete a master project
     */
    public async onDeleteMasterProject(oEvent: Event): Promise<void> {
        const oSource = (oEvent.getSource() as any);
        const oContext = oSource.getBindingContext("masterProjects");
        const projectData = oContext.getObject();

        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            const listBinding = oDataModel.bindList("/Projects");
            listBinding.filter([new Filter("projectId", FilterOperator.EQ, projectData.projectId)]);

            const contexts = await listBinding.requestContexts(0, 1);
            if (contexts.length > 0) {
                contexts[0].delete();
                await oDataModel.submitBatch(oDataModel.getUpdateGroupId());
                await new Promise(resolve => setTimeout(resolve, 600));

                MessageToast.show("Project deleted successfully");
                await this.loadMasterProjects();
            } else {
                MessageToast.show("Project not found");
            }
        } catch (error) {
            console.error("❌ Error deleting master project:", error);
            MessageToast.show("Error deleting project");
        }
    }

    
    public async loadMasterWorkItems(): Promise<void> {
        if (!this.currentManagerId) return;

        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;

            // Fetch ALL initiatives and evaluations (not filtered by manager) — same as Projects
            const allInitiativesBinding = oDataModel.bindList("/InitiativesMaster");
            const allEvaluationsBinding = oDataModel.bindList("/EvaluationsMaster");

            let [initiativeContexts, evaluationContexts] = await Promise.all([
                allInitiativesBinding.requestContexts(0, 1000),
                allEvaluationsBinding.requestContexts(0, 1000)
            ]);

            const initiatives = initiativeContexts.map((ctx: any) => ctx.getObject());
            const evaluations = evaluationContexts.map((ctx: any) => ctx.getObject());

            initiatives.sort((a: any, b: any) => String(a?.initiativeName || "").localeCompare(String(b?.initiativeName || "")));
            evaluations.sort((a: any, b: any) => String(a?.evaluationName || "").localeCompare(String(b?.evaluationName || "")));

            const assignInitiatives = initiatives
                .filter((item: any) => String(item?.status || "").toLowerCase() !== "completed");
            const assignEvaluations = evaluations
                .filter((item: any) => String(item?.status || "").toLowerCase() !== "completed");

            this.getView()?.setModel(new JSONModel({
                items: initiatives,
                allItems: initiatives,
                assignItems: assignInitiatives
            }), "masterInitiatives");
            this.getView()?.setModel(new JSONModel({
                items: evaluations,
                allItems: evaluations,
                assignItems: assignEvaluations
            }), "masterEvaluations");

            this.getView()?.setModel(new JSONModel({
                creators: this.buildSelectOptions(initiatives.map((i: any) => String(i.addedByManager || "")), "All Creators"),
                statuses: this.buildSelectOptions(initiatives.map((i: any) => String(i.status || "")), "All Status")
            }), "masterInitiativeFilterOptions");

            this.getView()?.setModel(new JSONModel({
                creators: this.buildSelectOptions(evaluations.map((e: any) => String(e.addedByManager || "")), "All Creators"),
                statuses: this.buildSelectOptions(evaluations.map((e: any) => String(e.status || "")), "All Status")
            }), "masterEvaluationFilterOptions");

            this.applyMasterInitiativeFilters();
            this.applyMasterEvaluationFilters();
        } catch (error) {
            console.error("❌ Error loading master work items:", error);
            this.getView()?.setModel(new JSONModel({ items: [], allItems: [] }), "masterInitiatives");
            this.getView()?.setModel(new JSONModel({ items: [], allItems: [] }), "masterEvaluations");
        }
    }

    public onMasterInitiativeSearch(event: Event): void {
        this.applyMasterInitiativeFilters();
    }

    public onMasterInitiativeFilterChange(): void {
        this.applyMasterInitiativeFilters();
    }

    private applyMasterInitiativeFilters(): void {
        const model = this.getView()?.getModel("masterInitiatives") as JSONModel;
        if (!model) return;

        const query = String((this.byId("masterInitiativeSearch") as any)?.getValue?.() || "").toLowerCase();
        const selectedCreator = String((this.byId("masterInitiativeCreatorFilter") as any)?.getSelectedKey?.() || "").trim();
        const selectedStatus = String((this.byId("masterInitiativeStatusFilter") as any)?.getSelectedKey?.() || "").trim();

        const allItems = model.getProperty("/allItems") || [];

        const filtered = allItems.filter((item: any) => {
            const matchesText = !query
                || (item.initiativeName || "").toLowerCase().includes(query)
                || (item.description || "").toLowerCase().includes(query)
                || (item.status || "").toLowerCase().includes(query)
                || (item.addedByManager || "").toLowerCase().includes(query);
            const matchesCreator = !selectedCreator || String(item.addedByManager || "").trim() === selectedCreator;
            const matchesStatus = !selectedStatus || String(item.status || "").trim() === selectedStatus;
            return matchesText && matchesCreator && matchesStatus;
        });

        model.setProperty("/items", filtered);
    }

    public onMasterEvaluationSearch(event: Event): void {
        this.applyMasterEvaluationFilters();
    }

    public onMasterEvaluationFilterChange(): void {
        this.applyMasterEvaluationFilters();
    }

    private applyMasterEvaluationFilters(): void {
        const model = this.getView()?.getModel("masterEvaluations") as JSONModel;
        if (!model) return;

        const query = String((this.byId("masterEvaluationSearch") as any)?.getValue?.() || "").toLowerCase();
        const selectedCreator = String((this.byId("masterEvaluationCreatorFilter") as any)?.getSelectedKey?.() || "").trim();
        const selectedStatus = String((this.byId("masterEvaluationStatusFilter") as any)?.getSelectedKey?.() || "").trim();

        const allItems = model.getProperty("/allItems") || [];

        const filtered = allItems.filter((item: any) => {
            const matchesText = !query
                || (item.evaluationName || "").toLowerCase().includes(query)
                || (item.description || "").toLowerCase().includes(query)
                || (item.status || "").toLowerCase().includes(query)
                || (item.addedByManager || "").toLowerCase().includes(query);
            const matchesCreator = !selectedCreator || String(item.addedByManager || "").trim() === selectedCreator;
            const matchesStatus = !selectedStatus || String(item.status || "").trim() === selectedStatus;
            return matchesText && matchesCreator && matchesStatus;
        });

        model.setProperty("/items", filtered);
    }

    private async openMasterWorkItemDialog(type: "Initiative" | "Evaluation", existing?: any): Promise<void> {
        if (!this.masterWorkItemDialog) {
            this.masterWorkItemDialog = await Fragment.load({
                name: "skillsphere.view.dialogs.MasterWorkItemDialog",
                controller: this
            }) as Dialog;
            this.getView()?.addDependent(this.masterWorkItemDialog);
        }

        const isEdit = !!(type === "Initiative" ? existing?.initiativeId : existing?.evaluationId);
        const model = new JSONModel({
            mode: isEdit ? "edit" : "create",
            dialogTitle: isEdit ? `Edit ${type}` : `Create New ${type}`,
            itemId: type === "Initiative" ? (existing?.initiativeId || "") : (existing?.evaluationId || ""),
            type,
            name: type === "Initiative" ? (existing?.initiativeName || "") : (existing?.evaluationName || ""),
            description: existing?.description || "",
            startDate: existing?.startDate || null,
            endDate: existing?.endDate || null,
            status: existing?.status || "Active"
        });
        this.getView()?.setModel(model, "masterWorkItemEditor");
        this.masterWorkItemDialog.open();
    }

    public async onCreateMasterInitiative(): Promise<void> {
        await this.openMasterWorkItemDialog("Initiative");
    }

    public async onCreateMasterEvaluation(): Promise<void> {
        await this.openMasterWorkItemDialog("Evaluation");
    }

    public async onEditMasterInitiative(event: Event): Promise<void> {
        const source = event.getSource() as any;
        const context = source.getBindingContext("masterInitiatives");
        const item = context?.getObject();
        if (!item) return;

        await this.openMasterWorkItemDialog("Initiative", item);
    }

    public async onEditMasterEvaluation(event: Event): Promise<void> {
        const source = event.getSource() as any;
        const context = source.getBindingContext("masterEvaluations");
        const item = context?.getObject();
        if (!item) return;

        await this.openMasterWorkItemDialog("Evaluation", item);
    }

    public onCloseMasterWorkItemDialog(): void {
        this.masterWorkItemDialog?.close();
    }

    public async onSaveMasterWorkItem(): Promise<void> {
        const editorModel = this.getView()?.getModel("masterWorkItemEditor") as JSONModel;
        const data = editorModel?.getData() || {};

        if (!data.name) {
            MessageToast.show("Please enter a name");
            return;
        }

        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            const isInitiative = (data.type || "Initiative") === "Initiative";
            const listPath = isInitiative ? "/InitiativesMaster" : "/EvaluationsMaster";
            const keyField = isInitiative ? "initiativeId" : "evaluationId";
            const nameField = isInitiative ? "initiativeName" : "evaluationName";

            if (data.mode === "edit" && data.itemId) {
                const listBinding = oDataModel.bindList(listPath);
                listBinding.filter([new Filter(keyField, FilterOperator.EQ, data.itemId)]);
                const contexts = await listBinding.requestContexts(0, 1);

                if (contexts.length === 0) {
                    MessageToast.show("Work item not found");
                    return;
                }

                const ctx = contexts[0];
                ctx.setProperty(nameField, String(data.name).trim());
                ctx.setProperty("description", String(data.description || "").trim());
                ctx.setProperty("startDate", data.startDate || null);
                ctx.setProperty("endDate", data.endDate || null);
                ctx.setProperty("status", data.status || "Active");
                ctx.setProperty("lastUpdated", new Date().toISOString());
            } else {
                const listBinding = oDataModel.bindList(listPath);
                const payload: any = {
                    description: String(data.description || "").trim(),
                    startDate: data.startDate || null,
                    endDate: data.endDate || null,
                    status: data.status || "Active",
                    addedByManager: this.currentManagerId || "",
                    createdAt: new Date().toISOString(),
                    lastUpdated: new Date().toISOString()
                };
                payload[nameField] = String(data.name).trim();
                listBinding.create(payload);
            }

            await oDataModel.submitBatch(oDataModel.getUpdateGroupId());
            this.masterWorkItemDialog?.close();
            await this.loadMasterWorkItems();
            MessageToast.show("Master work item saved successfully");
        } catch (error) {
            console.error("❌ Error saving master work item:", error);
            MessageToast.show("Error saving work item");
        }
    }

    private async deleteMasterWorkItem(type: "Initiative" | "Evaluation", itemId: string): Promise<void> {
        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;

            const currentBinding = oDataModel.bindList(type === "Initiative" ? "/CurrentInitiatives" : "/CurrentEvaluations");
            currentBinding.filter([
                new Filter(type === "Initiative" ? "initiativeId" : "evaluationId", FilterOperator.EQ, itemId)
            ]);
            const activeAssignmentContexts = await currentBinding.requestContexts(0, 1);
            if (activeAssignmentContexts.length > 0) {
                MessageToast.show(`Cannot delete ${type.toLowerCase()} master item with existing assignments`);
                return;
            }

            const listBinding = oDataModel.bindList(type === "Initiative" ? "/InitiativesMaster" : "/EvaluationsMaster");
            listBinding.filter([
                new Filter(type === "Initiative" ? "initiativeId" : "evaluationId", FilterOperator.EQ, itemId)
            ]);
            const contexts = await listBinding.requestContexts(0, 1);

            if (contexts.length === 0) {
                MessageToast.show("Work item not found");
                return;
            }

            contexts[0].delete();
            await oDataModel.submitBatch(oDataModel.getUpdateGroupId());
            await this.loadMasterWorkItems();
            MessageToast.show("Master work item deleted successfully");
        } catch (error) {
            console.error("❌ Error deleting master work item:", error);
            MessageToast.show("Error deleting work item");
        }
    }

    public async onDeleteMasterInitiative(event: Event): Promise<void> {
        const source = event.getSource() as any;
        const context = source.getBindingContext("masterInitiatives");
        const item = context?.getObject();
        if (!item?.initiativeId) return;

        await this.deleteMasterWorkItem("Initiative", item.initiativeId);
    }

    public async onDeleteMasterEvaluation(event: Event): Promise<void> {
        const source = event.getSource() as any;
        const context = source.getBindingContext("masterEvaluations");
        const item = context?.getObject();
        if (!item?.evaluationId) return;

        await this.deleteMasterWorkItem("Evaluation", item.evaluationId);
    }

    public async onManagerAddProject(): Promise<void> {
        if (!this.currentDialogEmployeeId) {
            MessageToast.show("No employee selected");
            return;
        }

        if (this.managerAddProjectDialog) {
            this.managerAddProjectDialog.destroy();
            this.managerAddProjectDialog = undefined;
        }

        // Get current manager's name for default Line Manager
        const currentManagerName = await this.getCurrentManagerName();

        const newProjectModel = new JSONModel({
            projectName: "",
            startDate: null,
            endDate: null,
            evaluationStartDate: null,
            evaluationEndDate: null,
            status: "Active",
            description: "",
            technology: "",
            role: "Team Member",
            utilizationPercent: 100,
            projectManager: "",
            accountExecutiveManager: "",
            lineManagerPOC: currentManagerName || "",
            projectOrchestrator: ""
        });
        this.getView()?.setModel(newProjectModel, "managerNewProject");
        
        // Load managers list for dropdowns
        await this.loadManagersForProjectDialog();

        this.managerAddProjectDialog = await Fragment.load({
            name: "skillsphere.view.dialogs.ManagerAddProjectDialog",
            controller: this
        }) as Dialog;
        this.getView()?.addDependent(this.managerAddProjectDialog);
        this.managerAddProjectDialog.open();
    }

    public onManagerCloseProjectDialog(): void {
        this.managerAddProjectDialog?.close();
    }

    public async onManagerSaveProject(): Promise<void> {
        const employeeId = this.currentDialogEmployeeId;
        if (!employeeId) {
            MessageToast.show("Employee ID not found");
            return;
        }

        const projectModel = this.getView()?.getModel("managerNewProject") as JSONModel;
        const data = projectModel?.getData();

        if (!data?.projectName) {
            MessageToast.show("Please fill in required field: Project Name");
            return;
        }

        const convertToISODate = (dateString: string): string | null => {
            if (!dateString) return null;
            try {
                const date = new Date(dateString);
                if (isNaN(date.getTime())) return null;
                const y = date.getFullYear();
                const m = String(date.getMonth() + 1).padStart(2, "0");
                const d = String(date.getDate()).padStart(2, "0");
                return `${y}-${m}-${d}`;
            } catch { return null; }
        };

        const startDateISO = convertToISODate(data.startDate);
        const endDateISO = convertToISODate(data.endDate);

        let duration = "";
        if (startDateISO && endDateISO) {
            const diffDays = Math.ceil(Math.abs(new Date(endDateISO).getTime() - new Date(startDateISO).getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays < 30) {
                duration = `${diffDays} days`;
            } else if (diffDays < 365) {
                const mo = Math.floor(diffDays / 30);
                const dy = diffDays % 30;
                duration = dy > 0 ? `${mo} months ${dy} days` : `${mo} months`;
            } else {
                const yr = Math.floor(diffDays / 365);
                const mo = Math.floor((diffDays % 365) / 30);
                duration = mo > 0 ? `${yr} years ${mo} months` : `${yr} years`;
            }
        }

        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;

            if (await this.hasDuplicateProjectAssignment(employeeId, data.projectName)) {
                MessageToast.show("This project is already assigned to this employee");
                return;
            }
            
            // Create project in Projects master data
            const listBinding = oDataModel.bindList("/Projects");
            const createdProjectCtx = listBinding.create({
                projectId: this.generateUuid(),
                employeeId: employeeId,
                projectName: data.projectName,
                role: "",
                startDate: startDateISO,
                endDate: endDateISO,
                evaluationStartDate: convertToISODate(data.evaluationStartDate),
                evaluationEndDate: convertToISODate(data.evaluationEndDate),
                status: data.status || "Active",
                description: data.description || "",
                duration: duration,
                projectManager: data.projectManager || "",
                accountExecutiveManager: data.accountExecutiveManager || "",
                lineManagerPOC: data.lineManagerPOC || "",
                projectOrchestrator: data.projectOrchestrator || "",
                technology: data.technology || "",
                addedByManager: this.currentManagerId || "Manager"
            }, true);

            // Also create assignment in CurrentProjects for Gantt Chart visibility
            const currentProjectsBinding = oDataModel.bindList("/CurrentProjects");
            const createdCurrentProjectCtx = currentProjectsBinding.create({
                currentProjectId: this.generateUuid(),
                employeeId: employeeId,
                type: "Project",
                projectName: data.projectName,
                role: data.role || "Team Member",
                projectManager: data.projectManager || "",
                startDate: startDateISO,
                endDate: endDateISO,
                utilizationPercent: data.utilizationPercent || 100,
                description: data.description || "",
                assignmentStatus: "Assigned",
                assignedBy: this.currentManagerId,
                isEvaluation: false,
                technology: data.technology || "",
                createdAt: new Date().toISOString(),
                lastUpdated: new Date().toISOString()
            }, true);

            await oDataModel.submitBatch(oDataModel.getUpdateGroupId());
            await createdProjectCtx.created();
            await createdCurrentProjectCtx.created();

            MessageToast.show("Project added successfully");
            this.managerAddProjectDialog?.close();

            // Refresh project list in the dialog
            const projects = await this.getEmployeeProjects(employeeId);
            const detailsModel = this.getView()?.getModel("employeeDetails") as JSONModel;
            detailsModel?.setProperty("/projects", projects);
            (this.byId("dialogTotalProjects") as any)?.setNumber(projects.length);
            (this.byId("dialogTotalProjects") as any)?.setUnit(projects.length === 1 ? "project" : "projects");

            // Refresh Gantt Chart and all visualizations
            await this.loadVisualizationData();
        } catch (error) {
            console.error("❌ Error saving project:", error);
            MessageToast.show("Error saving project");
        }
    }

    // ==================== ASSIGN PROJECT TO EMPLOYEE ====================

    public async onAssignProjectToEmployee(employeeId: string, projectId: string, role: string, utilizationPercent: number): Promise<void> {
        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            
            // Get project details from Projects master data
            const projectsBinding = oDataModel.bindList("/Projects");
            projectsBinding.filter([new Filter("projectId", FilterOperator.EQ, projectId)]);
            const projectContexts = await projectsBinding.requestContexts(0, 1);
            
            if (projectContexts.length === 0) {
                MessageToast.show("Project not found");
                return;
            }
            
            const project = projectContexts[0].getObject();

            if (String(project.status || "").trim().toLowerCase() === "completed") {
                MessageToast.show("Completed projects cannot be assigned");
                return;
            }

            if (await this.hasDuplicateProjectAssignment(employeeId, project.projectName)) {
                MessageToast.show("This project is already assigned to this employee");
                return;
            }
            
            // Manager assignment is final and immediately active for the employee.
            const currentProjectsBinding = oDataModel.bindList("/CurrentProjects");
            const createdAssignmentCtx = currentProjectsBinding.create({
                currentProjectId: this.generateUuid(),
                employeeId: employeeId,
                type: "Project",
                projectName: project.projectName,
                role: role || "Team Member",
                projectManager: project.projectManager || "",
                region: project.region || "",
                startDate: project.startDate,
                endDate: project.endDate,
                utilizationPercent: utilizationPercent,
                description: project.description || "",
                assignmentStatus: "Assigned",
                assignedBy: this.currentManagerId,
                isEvaluation: false,
                createdAt: new Date().toISOString(),
                lastUpdated: new Date().toISOString()
            }, true);
            
            await oDataModel.submitBatch(oDataModel.getUpdateGroupId());
            await createdAssignmentCtx.created();
            
            MessageToast.show(`Project "${project.projectName}" assigned successfully.`);
            
            // Refresh Gantt Chart and all visualizations
            await this.loadVisualizationData();
        } catch (error) {
            console.error("❌ Error assigning project:", error);
            MessageToast.show("Error assigning project to employee");
        }
    }

    // Manager assigns project from UI button in employee details dialog
    public async onAssignProject(): Promise<void> {
        const comboBox = this.byId("assignProjectComboBox") as any;
        const roleComboBox = this.byId("assignProjectRoleCombo") as any;
        const allocationInput = this.byId("assignProjectAllocationInput") as any;
        if (!comboBox) {
            MessageToast.show("Project selection not found");
            return;
        }
        
        const selectedKey = comboBox.getSelectedKey();
        if (!selectedKey) {
            MessageToast.show("Please select a project to assign");
            return;
        }
        
        if (!this.currentDialogEmployeeId) {
            MessageToast.show("Employee information not found");
            return;
        }

        const selectedRole = roleComboBox?.getSelectedKey() || "Team Member";
        const allocationValue = Number(allocationInput?.getValue?.() ?? 100);
        const utilizationPercent = Math.max(1, Math.min(100, Math.round(allocationValue)));
        
        // Call the assignment method
        await this.onAssignProjectToEmployee(this.currentDialogEmployeeId, selectedKey, selectedRole, utilizationPercent);
        
        // Clear the selection
        comboBox.setSelectedKey("");
        roleComboBox?.setSelectedKey("Team Member");
        allocationInput?.setValue(100);
        
        // Refresh the assignments table and team data to update status immediately
        await this.refreshEmployeeAssignments(this.currentDialogEmployeeId);
        await this.refreshCurrentDialogData();
        await this.loadManagerData();
    }

    public onManagerEditUtilization(event: Event): void {
        const source = event.getSource() as any;
        const bindingContext = source.getBindingContext("employeeDetails");
        if (!bindingContext) {
            return;
        }

        bindingContext.setProperty("isUtilizationEditing", true);
    }

    private async assignMasterWorkFromPanel(type: "Initiative" | "Evaluation"): Promise<void> {
        if (!this.currentDialogEmployeeId) {
            MessageToast.show("Employee information not found");
            return;
        }

        const isInitiative = type === "Initiative";
        const comboId = isInitiative ? "assignInitiativeComboBox" : "assignEvaluationComboBox";
        const allocationId = isInitiative ? "assignInitiativeAllocationInput" : "assignEvaluationAllocationInput";
        const modelName = isInitiative ? "masterInitiatives" : "masterEvaluations";
        const keyField = isInitiative ? "initiativeId" : "evaluationId";
        const nameField = isInitiative ? "initiativeName" : "evaluationName";

        const comboBox = this.byId(comboId) as any;
        const allocationInput = this.byId(allocationId) as any;
        if (!comboBox) {
            MessageToast.show("Assignment selection not found");
            return;
        }

        const selectedKey = comboBox.getSelectedKey();
        if (!selectedKey) {
            MessageToast.show(`Please select a ${type.toLowerCase()} to assign`);
            return;
        }

        const allocationValue = Number(allocationInput?.getValue?.() ?? 100);
        const utilizationPercent = Math.max(1, Math.min(100, Math.round(allocationValue || 0)));

        const workModel = this.getView()?.getModel(modelName) as JSONModel;
        const items = workModel?.getProperty("/items") || [];
        const selected = items.find((item: any) => String(item[keyField]) === String(selectedKey));
        if (!selected) {
            MessageToast.show(`${type} not found`);
            return;
        }

        if (String(selected.status || "").trim().toLowerCase() === "completed") {
            MessageToast.show(`Completed ${type.toLowerCase()}s cannot be assigned`);
            return;
        }

        if (await this.hasDuplicateMasterWorkAssignment(this.currentDialogEmployeeId, type, selectedKey, selected[nameField])) {
            MessageToast.show(`This ${type.toLowerCase()} is already assigned to this employee`);
            return;
        }

        // Extra guard for legacy rows where IDs may be missing/mismatched.
        const oDataModel = this.getOwnerComponent()?.getModel() as any;
        const currentListBinding = oDataModel.bindList(isInitiative ? "/CurrentInitiatives" : "/CurrentEvaluations");
        currentListBinding.filter([new Filter("employeeId", FilterOperator.EQ, this.currentDialogEmployeeId)]);
        const currentContexts = await currentListBinding.requestContexts(0, 2000);
        const normalizedSelectedName = String(selected[nameField] || "").trim().toLowerCase();

        const alreadyAssigned = currentContexts.some((ctx: any) => {
            const row = ctx.getObject();
            const rowId = String(row[keyField] || "").trim();
            const rowName = String(row[nameField] || "").trim().toLowerCase();
            return (selectedKey && rowId && rowId === String(selectedKey).trim())
                || (normalizedSelectedName && rowName === normalizedSelectedName);
        });

        if (alreadyAssigned) {
            MessageToast.show(`This ${type.toLowerCase()} is already assigned to this employee`);
            return;
        }

        try {
            const listBinding = oDataModel.bindList(isInitiative ? "/CurrentInitiatives" : "/CurrentEvaluations");
            const now = new Date().toISOString();

            let createdCtx: any;
            if (isInitiative) {
                createdCtx = listBinding.create({
                    currentInitiativeId: this.generateUuid(),
                    employeeId: this.currentDialogEmployeeId,
                    initiativeId: selected.initiativeId,
                    initiativeName: String(selected[nameField] || "").trim(),
                    description: String(selected.description || "").trim(),
                    startDate: selected.startDate,
                    endDate: selected.endDate,
                    utilizationPercent,
                    status: "Active",
                    assignedBy: this.currentManagerId,
                    createdAt: now,
                    lastUpdated: now
                }, true);
            } else {
                createdCtx = listBinding.create({
                    currentEvaluationId: this.generateUuid(),
                    employeeId: this.currentDialogEmployeeId,
                    evaluationId: selected.evaluationId,
                    evaluationName: String(selected[nameField] || "").trim(),
                    description: String(selected.description || "").trim(),
                    startDate: selected.startDate,
                    endDate: selected.endDate,
                    utilizationPercent,
                    status: "Active",
                    assignedBy: this.currentManagerId,
                    createdAt: now,
                    lastUpdated: now
                }, true);
            }

            await oDataModel.submitBatch(oDataModel.getUpdateGroupId());
            await createdCtx.created();

            comboBox.setSelectedKey("");
            allocationInput?.setValue(100);

            await this.loadVisualizationData();
            await this.refreshEmployeeAssignments(this.currentDialogEmployeeId);
            await this.refreshCurrentDialogData();
            await this.loadManagerData();
            MessageToast.show(`${type} assigned successfully.`);
        } catch (error) {
            console.error(`❌ Error assigning ${type.toLowerCase()} from panel:`, error);
            MessageToast.show(`Error assigning ${type.toLowerCase()}`);
        }
    }

    public async onAssignInitiativeFromPanel(): Promise<void> {
        await this.assignMasterWorkFromPanel("Initiative");
    }

    public async onAssignEvaluationFromPanel(): Promise<void> {
        await this.assignMasterWorkFromPanel("Evaluation");
    }

    public async onManagerSaveUtilization(event: Event): Promise<void> {
        const source = event.getSource() as any;
        const bindingContext = source.getBindingContext("employeeDetails");
        const row = bindingContext?.getObject();

        if (!row || !this.currentDialogEmployeeId) {
            MessageToast.show("Unable to update utilization");
            return;
        }

        const utilizationValue = Number(row.utilizationPercent);
        const utilizationPercent = Math.max(1, Math.min(100, Math.round(utilizationValue || 0)));

        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;

            let entityPath = "/CurrentProjects";
            let keyField = "currentProjectId";
            let keyValue = row.currentProjectId;

            if (row.type === "Initiative" || row._source === "CurrentInitiatives") {
                entityPath = "/CurrentInitiatives";
                keyField = "currentInitiativeId";
                keyValue = row.currentInitiativeId || row.currentProjectId;
            } else if (row.type === "Evaluation" || row._source === "CurrentEvaluations") {
                entityPath = "/CurrentEvaluations";
                keyField = "currentEvaluationId";
                keyValue = row.currentEvaluationId || row.currentProjectId;
            }

            if (!keyValue) {
                MessageToast.show("Assignment identifier not found");
                return;
            }

            const listBinding = oDataModel.bindList(entityPath);
            listBinding.filter([new Filter(keyField, FilterOperator.EQ, keyValue)]);
            const contexts = await listBinding.requestContexts(0, 1);

            if (contexts.length === 0) {
                MessageToast.show("Assignment not found");
                return;
            }

            contexts[0].setProperty("utilizationPercent", utilizationPercent);
            contexts[0].setProperty("lastUpdated", new Date().toISOString());
            await oDataModel.submitBatch(oDataModel.getUpdateGroupId());

            bindingContext.setProperty("isUtilizationEditing", false);

            await this.refreshCurrentDialogData();
            await this.refreshEmployeeAssignments(this.currentDialogEmployeeId);
            MessageToast.show("Utilization updated successfully");
        } catch (error) {
            console.error("❌ Error updating utilization:", error);
            MessageToast.show("Error updating utilization");
        }
    }

    // Refresh assignments table in employee details dialog
    private async refreshEmployeeAssignments(employeeId: string): Promise<void> {
        try {
            const assignments = await this.getCurrentProjects(employeeId);

            const detailsModel = this.getView()?.getModel("employeeDetails") as JSONModel;
            if (detailsModel) {
                detailsModel.setProperty("/assignments", assignments);
                const activeCurrentProjects = assignments
                    .filter((cp: any) => cp.assignmentStatus !== "Completed")
                    .map((cp: any) => ({
                        ...cp,
                        isUtilizationEditing: false
                    }));
                detailsModel.setProperty("/currentProjects", activeCurrentProjects);
            }
            
        } catch (error) {
            console.error("❌ Error refreshing assignments:", error);
        }
    }

}
