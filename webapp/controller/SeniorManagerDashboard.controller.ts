import Controller from "sap/ui/core/mvc/Controller";
import XMLView from "sap/ui/core/mvc/XMLView";
import Router from "sap/ui/core/routing/Router";
import MessageToast from "sap/m/MessageToast";
import JSONModel from "sap/ui/model/json/JSONModel";
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";
import Dialog from "sap/m/Dialog";
import Fragment from "sap/ui/core/Fragment";
import Table from "sap/m/Table";
import Column from "sap/m/Column";
import ColumnListItem from "sap/m/ColumnListItem";
import MultiInput from "sap/m/MultiInput";
import Token from "sap/m/Token";
import Event from "sap/ui/base/Event";
import Select from "sap/m/Select";
import Item from "sap/ui/core/Item";
import Text from "sap/m/Text";
import VBox from "sap/m/VBox";
import HBox from "sap/m/HBox";
import HTML from "sap/ui/core/HTML";
import ListBinding from "sap/ui/model/ListBinding";
import FormattedText from "sap/m/FormattedText";
import OverflowToolbar from "sap/m/OverflowToolbar";
import ObjectStatus from "sap/m/ObjectStatus";

/**
 * @namespace skillsphere.controller
 */
export default class SeniorManagerDashboard extends Controller {

    private currentSeniorManagerId: string | null = null;
    private seniorManagerId: string = "";
    private currentChatSeniorManagerId: string = "";
    private aiInitialized: boolean = false;
    private typingIndicator: HTML | null = null;
    private employeeProfileDialog?: Dialog;
    private sharedManagerView?: XMLView;
    private sharedManagerController?: any;

    public onInit(): void {
        const router = this.getRouter();
        router.getRoute("SeniorManagerDashboard")?.attachPatternMatched(this.onRouteMatched, this);
    }

    private getRouter(): Router {
        return (this.getOwnerComponent() as any).getRouter();
    }

    public onLogout(): void {
        // Clear current user data
        const currentUserModel = this.getOwnerComponent()?.getModel("currentUser") as JSONModel;
        if (currentUserModel) {
            currentUserModel.setData({
                id: null,
                name: null,
                role: null,
                isLoggedIn: false
            });
        }

        this.currentSeniorManagerId = null;
        
        // Navigate back to landing page
        this.getRouter().navTo("Landing");
        MessageToast.show("You have been logged out");
    }

    public onOpenWorkOverview(): void {
        if (!this.currentSeniorManagerId) {
            MessageToast.show("Senior manager information not found");
            return;
        }

        this.getRouter().navTo("SeniorManagerWorkOverview", {
            seniorManagerId: this.currentSeniorManagerId
        });
    }

    public async onOpenAddEmployeeDialog(): Promise<void> {
        const currentUserModel = this.getOwnerComponent()?.getModel("currentUser") as JSONModel;
        const currentUser = currentUserModel?.getData() || {};
        const seniorManagerId = String(this.currentSeniorManagerId || currentUser?.id || "").trim().toUpperCase();

        if (!seniorManagerId) {
            MessageToast.show("Senior manager information not found");
            return;
        }

        const allManagersModel = this.getView()?.getModel("allManagers") as JSONModel;
        const directEmployees = allManagersModel?.getProperty("/individualEmployees") || [];
        const defaultTeam = String(directEmployees[0]?.team || "CIS").trim();
        const defaultSubTeam = String(directEmployees[0]?.subTeam || "Team 1").trim() || "Team 1";
        const managerName = String(currentUser?.name || "Senior Manager").trim();

        const editorModel = new JSONModel({
            mode: "create",
            employeeId: "",
            name: "",
            email: "",
            businessRole: "Employee",
            professionalRole: "Developer",
            team: defaultTeam,
            subTeam: defaultSubTeam,
            managerId: seniorManagerId,
            managerLabel: `${managerName} (${seniorManagerId})`,
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

    public onCloseEmployeeProfileDialog(): void {
        this.employeeProfileDialog?.close();
    }

    public async onSaveEmployeeProfileFromManager(): Promise<void> {
        try {
            const editorModel = this.getView()?.getModel("employeeEditor") as JSONModel;
            const data = editorModel?.getData() || {};
            const employeeId = String(data.employeeId || "").trim().toUpperCase();
            const managerId = String(data.managerId || this.currentSeniorManagerId || "").trim().toUpperCase();
            const subTeamRaw = String(data.subTeam || "").trim();
            const normalizedSubTeam = /^Team\s*[1-9]$/i.test(subTeamRaw)
                ? subTeamRaw.replace(/\s+/g, " ")
                : "Team 1";

            if (!employeeId || !data.name || !data.email || !data.team || !normalizedSubTeam || !data.location || !data.tLevel || !data.gradeLevel || !managerId) {
                MessageToast.show("Please fill all required fields");
                return;
            }

            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            const employeesBinding = oDataModel.bindList("/Employees");
            employeesBinding.filter([new Filter("employeeId", FilterOperator.EQ, employeeId)]);
            const existingEmployee = await employeesBinding.requestContexts(0, 1);

            if (existingEmployee.length > 0) {
                MessageToast.show(`Employee ${employeeId} already exists`);
                return;
            }

            employeesBinding.create({
                employeeId,
                name: String(data.name).trim(),
                role: "Employee",
                team: String(data.team).trim(),
                subTeam: normalizedSubTeam,
                managerId,
                email: String(data.email).trim(),
                experience: Number(data.experience || 0),
                totalSkills: 0,
                totalProjects: 0,
                location: String(data.location).trim(),
                tLevel: data.tLevel,
                gradeLevel: data.gradeLevel
            });

            const profileBinding = oDataModel.bindList("/Profiles");
            profileBinding.create({
                employeeId,
                specialization: String(data.specialization || "General").trim(),
                role: data.professionalRole || "Developer",
                location: String(data.location).trim(),
                tLevel: data.tLevel,
                gradeLevel: data.gradeLevel,
                lastUpdated: new Date().toISOString()
            });

            await oDataModel.submitBatch(oDataModel.getUpdateGroupId());
            this.employeeProfileDialog?.close();
            await this.loadDashboardData();
            MessageToast.show("Employee added successfully");
        } catch (error) {
            console.error("❌ Error saving employee from senior manager dialog:", error);
            MessageToast.show("Error saving employee");
        }
    }

    private async onRouteMatched(event: any): Promise<void> {
        const args: any = event.getParameter("arguments");
        const seniorManagerId = args?.seniorManagerId;
        
        console.log("Route matched for Senior Manager:", seniorManagerId);
        
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'auto' });
        
        // Check if senior manager is logged in
        const currentUserModel = this.getOwnerComponent()?.getModel("currentUser") as JSONModel;
        const currentUser = currentUserModel?.getData();
        
        if (!currentUser?.isLoggedIn && !seniorManagerId) {
            console.log("No senior manager session found, redirecting to login");
            MessageToast.show("Please login to access the dashboard");
            this.getRouter().navTo("Landing");
            return;
        }
        
        // Set current senior manager ID
        this.currentSeniorManagerId = seniorManagerId || currentUser?.id;
        
        // Load dashboard data
        await this.loadDashboardData();
    }

    private async loadDashboardData(): Promise<void> {
        try {
            console.log("📊 Loading Senior Manager dashboard data...");
            
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            
            // Load all managers
            await this.loadAllManagers();
            
            // Load organization metrics
            await this.loadOrganizationMetrics();

            // Load master work catalogs used in employee modal assign tab
            await this.loadMasterWorkItems();
            
            MessageToast.show("Dashboard data loaded successfully");
        } catch (error) {
            console.error("❌ Error loading dashboard data:", error);
            MessageToast.show("Error loading dashboard data");
        }
    }

    private async loadMasterWorkItems(): Promise<void> {
        try {
            const [initiativesResponse, evaluationsResponse] = await Promise.all([
                fetch("/odata/v4/skillsphere/InitiativesMaster", {
                    credentials: "same-origin",
                    headers: { Accept: "application/json" }
                }),
                fetch("/odata/v4/skillsphere/EvaluationsMaster", {
                    credentials: "same-origin",
                    headers: { Accept: "application/json" }
                })
            ]);

            const [initiativesData, evaluationsData] = await Promise.all([
                initiativesResponse.ok ? initiativesResponse.json() : { value: [] },
                evaluationsResponse.ok ? evaluationsResponse.json() : { value: [] }
            ]);

            const initiativesItems = (initiativesData.value || []).map((row: any) => ({
                initiativeId: row.initiativeId,
                initiativeName: row.initiativeName,
                status: row.status
            }));

            const evaluationsItems = (evaluationsData.value || []).map((row: any) => ({
                evaluationId: row.evaluationId,
                evaluationName: row.evaluationName,
                status: row.status
            }));

            this.getView()?.setModel(new JSONModel({ items: initiativesItems }), "masterInitiatives");
            this.getView()?.setModel(new JSONModel({ items: evaluationsItems }), "masterEvaluations");
        } catch (error) {
            console.error("❌ Error loading master work items:", error);
            this.getView()?.setModel(new JSONModel({ items: [] }), "masterInitiatives");
            this.getView()?.setModel(new JSONModel({ items: [] }), "masterEvaluations");
        }
    }

    private async loadAllManagers(): Promise<void> {
        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            const currentUserModel = this.getOwnerComponent()?.getModel("currentUser") as JSONModel;
            const currentUser = currentUserModel?.getData();
            const seniorMgrId = this.currentSeniorManagerId || currentUser?.id;

            if (!seniorMgrId) {
                console.warn("⚠️ Senior manager ID missing, cannot load team overview");
                this.getView()?.setModel(new JSONModel({ managers: [], individualEmployees: [] }), "allManagers");
                return;
            }

            // Load all direct reports under this senior manager, then split by role.
            const directReportsBinding = oDataModel.bindList("/Employees");
            directReportsBinding.filter([
                new Filter("managerId", FilterOperator.EQ, seniorMgrId)
            ]);

            const directReportContexts = await directReportsBinding.requestContexts(0, 500);
            const directReports = directReportContexts.map((context: any) => context.getObject());

            const managers = directReports
                .filter((person: any) => String(person.role || "").toLowerCase().includes("manager"))
                .map((mgr: any) => ({
                    ...mgr,
                    managerId: mgr.employeeId
                }));

            console.log(`✅ Loaded ${directReports.length} direct reports for ${seniorMgrId} (${managers.length} managers)`);

            // Load team size for each direct-report manager
            const managersWithTeamSize = await Promise.all(managers.map(async (mgr: any) => {
                const teamSize = await this.getManagerTeamSize(mgr.managerId);
                return {
                    ...mgr,
                    teamSize: teamSize,
                    working_on_project: (mgr.totalProjects || 0) > 0
                };
            }));
            
            // Keep all direct-report managers, even if they currently have zero direct reports.
            const managersOnly = managersWithTeamSize;

            // Employee Overview should show direct reports that are not managers.
            const individualEmployees = directReports
                .filter((person: any) => !String(person.role || "").toLowerCase().includes("manager"))
                .map((person: any) => ({
                    ...person,
                    displayExperience: (person.experience && Number(person.experience) > 0)
                        ? person.experience
                        : 0
                }));

            // Create model for manager overview section
            const managersModel = new JSONModel({
                managers: managersOnly,
                individualEmployees: individualEmployees
            });
            this.getView()?.setModel(managersModel, "allManagers");
            
            // Populate manager dropdown for search
            const managerSelect = this.byId("orgManagerFilter") as Select;
            if (managerSelect) {
                managerSelect.removeAllItems();
                managerSelect.addItem(new Item({ key: "", text: "All Managers" }));

                managersOnly.forEach((mgr: any) => {
                    managerSelect.addItem(
                        new Item({
                            key: mgr.managerId,
                            text: `${mgr.name} (${mgr.team})`
                        })
                    );
                });
            }

            console.log(`✅ Team overview split for ${seniorMgrId}: ${managersOnly.length} managers, ${individualEmployees.length} direct employees`);
            
        } catch (error) {
            console.error("❌ Error loading managers:", error);
        }
    }

    private async getManagerTeamSize(managerId: string): Promise<number> {
        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            const employeesBinding = oDataModel.bindList("/Employees");
            employeesBinding.filter([new Filter("managerId", FilterOperator.EQ, managerId)]);
            
            const contexts = await employeesBinding.requestContexts(0, 1000);
            return contexts.length;
        } catch (error) {
            console.error(`Error getting team size for ${managerId}:`, error);
            return 0;
        }
    }

    private async loadOrganizationMetrics(): Promise<void> {
        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;

            // Load all managers
            const managersBinding = oDataModel.bindList("/Employees");
            managersBinding.filter([new Filter("role", FilterOperator.EQ, "Manager")]);
            const managerContexts = await managersBinding.requestContexts(0, 1000);
            const totalManagers = managerContexts
                .map((ctx: any) => ctx.getObject()).length;

            // Load all employees (exclude manager rows)
            const employeesBinding = oDataModel.bindList("/Employees");
            const employeeContexts = await employeesBinding.requestContexts(0, 1000);
            const allEmployees = employeeContexts.map((ctx: any) => ctx.getObject())
                .filter((emp: any) => emp.employeeId && !emp.employeeId.startsWith("MGR"));
            const totalEmployees = allEmployees.length;

            // Average experience
            const experienceValues = allEmployees
                .map((emp: any) => Number(emp.experience))
                .filter((value: number) => Number.isFinite(value));
            const totalExperience = experienceValues.reduce((sum: number, value: number) => sum + value, 0);
            const avgExperience = experienceValues.length > 0
                ? Number((totalExperience / experienceValues.length).toFixed(1))
                : 0;

            // Load all skills — unique count + top skills by frequency
            const skillsBinding = oDataModel.bindList("/Skills");
            const skillContexts = await skillsBinding.requestContexts(0, 2000);
            const allSkills = skillContexts.map((ctx: any) => ctx.getObject());
            const uniqueSkillsCount = new Set(allSkills.map((s: any) => s.skillName)).size;

            const skillFreq: { [key: string]: number } = {};
            allSkills.forEach((s: any) => {
                if (s.skillName) { skillFreq[s.skillName] = (skillFreq[s.skillName] || 0) + 1; }
            });
            const topSkills = Object.entries(skillFreq)
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .slice(0, 10)
                .map(([skillName, count], idx) => ({ rank: idx + 1, skillName, count }));

            // Active current projects — determine who is on project today
            const cpBinding = oDataModel.bindList("/CurrentProjects");
            const cpContexts = await cpBinding.requestContexts(0, 1000);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const activeEmployeeIds = new Set<string>();
            cpContexts.map((ctx: any) => ctx.getObject()).forEach((cp: any) => {
                if (!cp.startDate || !cp.endDate) return;
                const start = new Date(cp.startDate); start.setHours(0, 0, 0, 0);
                const end = new Date(cp.endDate); end.setHours(0, 0, 0, 0);
                if (today >= start && today <= end) { activeEmployeeIds.add(cp.employeeId); }
            });

            const onProjectCount = allEmployees.filter((emp: any) => activeEmployeeIds.has(emp.employeeId)).length;
            const onBenchCount = totalEmployees - onProjectCount;

            // Build bench employees list
            const skillCountByEmp: { [id: string]: number } = {};
            allSkills.forEach((s: any) => {
                if (s.employeeId) { skillCountByEmp[s.employeeId] = (skillCountByEmp[s.employeeId] || 0) + 1; }
            });
            const benchEmployees = allEmployees
                .filter((emp: any) => !activeEmployeeIds.has(emp.employeeId))
                .map((emp: any) => ({ ...emp, skillCount: skillCountByEmp[emp.employeeId] || 0 }));

            // Update metric cards
            (this.byId("totalManagersCount") as any)?.setNumber(totalManagers);
            (this.byId("orgTotalEmployeesCount") as any)?.setNumber(totalEmployees);
            (this.byId("uniqueSkillsCount") as any)?.setNumber(uniqueSkillsCount);
            (this.byId("avgExperienceCount") as any)?.setNumber(avgExperience);
            (this.byId("onProjectCount") as any)?.setNumber(onProjectCount);
            (this.byId("onBenchCount") as any)?.setNumber(onBenchCount);
            (this.byId("benchCountText") as any)?.setText(
                `${onBenchCount} employee${onBenchCount !== 1 ? 's' : ''} are currently available (not assigned to any active project)`
            );

            // Set models
            this.getView()?.setModel(new JSONModel({ topSkills }), "orgMetrics");
            this.getView()?.setModel(new JSONModel({ employees: benchEmployees }), "benchReport");

            // Cache everything for View All dialogs
            const allManagersRaw = managerContexts
                .map((ctx: any) => {
                    const m = ctx.getObject();
                    return {
                        ...m,
                        managerId: m.employeeId
                    };
                });
            const onProjectEmployees = allEmployees
                .filter((emp: any) => activeEmployeeIds.has(emp.employeeId))
                .map((emp: any) => ({ ...emp, skillCount: skillCountByEmp[emp.employeeId] || 0 }));
            const allSkillsRanked = Object.entries(skillFreq)
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .map(([skillName, count], idx) => ({
                    rank: idx + 1,
                    skillName,
                    category: allSkills.find((s: any) => s.skillName === skillName)?.category || '',
                    count
                }));
            const allEmployeesWithSkillCount = allEmployees.map((emp: any) => ({
                ...emp, skillCount: skillCountByEmp[emp.employeeId] || 0
            }));
            this.getView()?.setModel(new JSONModel({
                managers: allManagersRaw,
                allEmployees: allEmployeesWithSkillCount,
                onProjectEmployees,
                availableEmployees: benchEmployees,
                allSkills: allSkillsRanked
            }), "orgMetricsCache");

            console.log(`✅ Metrics — Managers: ${totalManagers}, Employees: ${totalEmployees}, On Project: ${onProjectCount}, On Bench: ${onBenchCount}, Skills: ${uniqueSkillsCount}`);

        } catch (error) {
            console.error("❌ Error loading organization metrics:", error);
        }
    }

    private async loadWorkOverview(): Promise<void> {
        try {
            console.log("📊 Loading work overview...");
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            
            // Load all employees
            const employeesBinding = oDataModel.bindList("/Employees");
            const employeeContexts = await employeesBinding.requestContexts(0, 1000);
            const allEmployees = employeeContexts.map((ctx: any) => ctx.getObject())
                .filter((emp: any) => emp.employeeId && !emp.employeeId.startsWith("MGR"));
            
            // Load all profiles for T-Level (filter only T3 and T4)
            const profilesBinding = oDataModel.bindList("/Profiles");
            const profileContexts = await profilesBinding.requestContexts(0, 1000);
            const profiles = profileContexts.map((ctx: any) => ctx.getObject());
            const profileMap = new Map(profiles.map((p: any) => [p.employeeId, p]));
            
            // Filter only T3 and T4 employees
            const seniorEmployees = allEmployees.filter((emp: any) => {
                const profile: any = profileMap.get(emp.employeeId);
                return profile?.tLevel === 'T3' || profile?.tLevel === 'T4';
            });
            
            // Load all current projects
            const cpBinding = oDataModel.bindList("/CurrentProjects");
            const cpContexts = await cpBinding.requestContexts(0, 1000);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            // Load all initiatives (evaluations + initiatives stored here)
            const initBinding = oDataModel.bindList("/Initiatives");
            const initContexts = await initBinding.requestContexts(0, 1000);
            
            // Group projects by employee (only Projects from CurrentProjects)
            const workByEmployee = new Map<string, any[]>();
            cpContexts.map((ctx: any) => ctx.getObject()).forEach((cp: any) => {
                if (!cp.startDate || !cp.endDate) return;
                if (cp.type !== "Project") return;
                const start = new Date(cp.startDate); start.setHours(0, 0, 0, 0);
                const end = new Date(cp.endDate); end.setHours(0, 0, 0, 0);
                
                if (today >= start && today <= end) {
                    if (!workByEmployee.has(cp.employeeId)) {
                        workByEmployee.set(cp.employeeId, []);
                    }
                    workByEmployee.get(cp.employeeId)!.push(cp);
                }
            });
            
            // Group evaluations and initiatives by employee (from Initiatives entity)
            const evalsByEmployee = new Map<string, any[]>();
            const initsByEmployee = new Map<string, any[]>();
            initContexts.map((ctx: any) => ctx.getObject()).forEach((init: any) => {
                if (init.status === "Completed") return;
                if (!init.startDate || !init.endDate) return;
                const start = new Date(init.startDate); start.setHours(0, 0, 0, 0);
                const end = new Date(init.endDate); end.setHours(0, 0, 0, 0);
                
                if (today >= start && today <= end) {
                    if (init.type === "Evaluation") {
                        if (!evalsByEmployee.has(init.employeeId)) {
                            evalsByEmployee.set(init.employeeId, []);
                        }
                        evalsByEmployee.get(init.employeeId)!.push(init);
                    } else if (init.type === "Initiative") {
                        if (!initsByEmployee.has(init.employeeId)) {
                            initsByEmployee.set(init.employeeId, []);
                        }
                        initsByEmployee.get(init.employeeId)!.push(init);
                    }
                }
            });
            
            // Calculate max counts for dynamic columns
            let maxProjects = 0;
            let maxEvaluations = 0;
            let maxInitiatives = 0;
            
            const employeeWorkData = seniorEmployees.map((emp: any) => {
                const profile: any = profileMap.get(emp.employeeId);
                const projects = workByEmployee.get(emp.employeeId) || [];
                const evaluations = evalsByEmployee.get(emp.employeeId) || [];
                const initiatives = initsByEmployee.get(emp.employeeId) || [];
                
                // Update max counts
                maxProjects = Math.max(maxProjects, projects.length);
                maxEvaluations = Math.max(maxEvaluations, evaluations.length);
                maxInitiatives = Math.max(maxInitiatives, initiatives.length);
                
                return { emp, profile, projects, evaluations, initiatives };
            });
            
            console.log(`📊 Dynamic columns: ${maxProjects} projects, ${maxEvaluations} evaluations, ${maxInitiatives} initiatives`);
            
            // Build overview data with dynamic columns
            const employeesOverview = employeeWorkData.map(({ emp, profile, projects, evaluations, initiatives }: any) => {
                const rowData: any = {
                    name: emp.name,
                    employeeId: emp.employeeId,
                    tLevel: profile?.tLevel || '-',
                    specialization: emp.specialization || profile?.specialization || '-',
                    projects: [],
                    evaluations: [],
                    initiatives: []
                };
                
                // Add projects dynamically
                for (let i = 0; i < maxProjects; i++) {
                    rowData.projects.push({
                        name: projects[i]?.projectName || '-',
                        tech: projects[i]?.technology || '',
                        util: projects[i] ? `${projects[i].utilizationPercent}%` : ''
                    });
                }
                
                // Add evaluations dynamically (from Initiatives entity)
                for (let i = 0; i < maxEvaluations; i++) {
                    rowData.evaluations.push({
                        name: evaluations[i]?.initiativeName || '-',
                        tech: '',
                        util: evaluations[i] ? `${evaluations[i].utilizationPercent}%` : ''
                    });
                }
                
                // Add initiatives dynamically (from Initiatives entity)
                for (let i = 0; i < maxInitiatives; i++) {
                    rowData.initiatives.push({
                        name: initiatives[i]?.initiativeName || '-',
                        tech: '',
                        util: initiatives[i] ? `${initiatives[i].utilizationPercent}%` : ''
                    });
                }
                
                return rowData;
            });
            
            // Set model with column configuration
            this.getView()?.setModel(new JSONModel({ 
                employees: employeesOverview,
                columnConfig: {
                    projects: maxProjects,
                    evaluations: maxEvaluations,
                    initiatives: maxInitiatives
                }
            }), "workOverview");
            
            // Rebuild table columns dynamically
            this.rebuildWorkOverviewColumns(maxProjects, maxEvaluations, maxInitiatives);
            
            console.log(`✅ Work overview loaded for ${employeesOverview.length} senior employees (T3/T4 only)`);
            
        } catch (error) {
            console.error("❌ Error loading work overview:", error);
        }
    }

    private rebuildWorkOverviewColumns(maxProjects: number, maxEvaluations: number, maxInitiatives: number): void {
        const table = this.byId("workOverviewTable") as Table;
        if (!table) {
            console.warn("⚠️ workOverviewTable not found");
            return;
        }

        // Unbind any existing items first
        if (table.isBound("items")) {
            table.unbindItems();
        }

        // Clear existing columns (keep first 3: Name, T-Level, Specialization)
        const existingColumns = table.getColumns();
        while (existingColumns.length > 3) {
            table.removeColumn(existingColumns[existingColumns.length - 1]);
        }

        // Create dynamic columns
        const columns: Column[] = [];
        const cellTemplates: any[] = [];
        
        // Add static cells for Name, T-Level, Specialization
        cellTemplates.push(
            new VBox({
                items: [
                    new Text({ text: "{workOverview>name}", wrapping: false }).addStyleClass("sapUiTinyMarginBottom"),
                    new Text({ text: "{workOverview>employeeId}" }).addStyleClass("sapThemeTextSubtle-asColor")
                ]
            }),
            new ObjectStatus({ text: "{workOverview>tLevel}", state: "Information" }),
            new ObjectStatus({ text: "{workOverview>specialization}", state: "None" })
        );

        // Add Project columns
        for (let i = 0; i < maxProjects; i++) {
            columns.push(new Column({
                width: "320px",
                hAlign: "Left",
                header: new Text({ text: `Project ${i + 1}` })
            }));
            
            cellTemplates.push(
                new VBox({
                    items: [
                        new Text({ 
                            text: `{workOverview>projects/${i}/name}`, 
                            wrapping: false, 
                            maxLines: 1 
                        }),
                        new HBox({
                            items: [
                                new ObjectStatus({ 
                                    text: `{workOverview>projects/${i}/tech}`, 
                                    state: "Success" 
                                }).addStyleClass("sapUiTinyMarginEnd"),
                                new ObjectStatus({ 
                                    text: `{workOverview>projects/${i}/util}`, 
                                    state: "Success" 
                                })
                            ]
                        }).addStyleClass("sapUiTinyMarginTop")
                    ]
                })
            );
        }

        // Add Evaluation columns
        for (let i = 0; i < maxEvaluations; i++) {
            columns.push(new Column({
                width: "320px",
                hAlign: "Left",
                header: new Text({ text: maxEvaluations > 1 ? `Evaluation ${i + 1}` : "Evaluation" })
            }));
            
            cellTemplates.push(
                new VBox({
                    items: [
                        new Text({ 
                            text: `{workOverview>evaluations/${i}/name}`, 
                            wrapping: false, 
                            maxLines: 1 
                        }),
                        new HBox({
                            items: [
                                new ObjectStatus({ 
                                    text: `{workOverview>evaluations/${i}/tech}`, 
                                    state: "Warning" 
                                }).addStyleClass("sapUiTinyMarginEnd"),
                                new ObjectStatus({ 
                                    text: `{workOverview>evaluations/${i}/util}`, 
                                    state: "Warning" 
                                })
                            ]
                        }).addStyleClass("sapUiTinyMarginTop")
                    ]
                })
            );
        }

        // Add Initiative columns
        for (let i = 0; i < maxInitiatives; i++) {
            columns.push(new Column({
                width: "320px",
                hAlign: "Left",
                header: new Text({ text: maxInitiatives > 1 ? `Initiative ${i + 1}` : "Initiative" })
            }));
            
            cellTemplates.push(
                new VBox({
                    items: [
                        new Text({ 
                            text: `{workOverview>initiatives/${i}/name}`, 
                            wrapping: false, 
                            maxLines: 1 
                        }),
                        new HBox({
                            items: [
                                new ObjectStatus({ 
                                    text: `{workOverview>initiatives/${i}/tech}`, 
                                    state: "Information" 
                                }).addStyleClass("sapUiTinyMarginEnd"),
                                new ObjectStatus({ 
                                    text: `{workOverview>initiatives/${i}/util}`, 
                                    state: "Information" 
                                })
                            ]
                        }).addStyleClass("sapUiTinyMarginTop")
                    ]
                })
            );
        }

        // Add new columns to table
        columns.forEach(col => table.addColumn(col));

        // Create new template for items
        const template = new ColumnListItem({
            cells: cellTemplates
        });

        // Rebind items with new template
        table.bindItems({
            path: "workOverview>/employees",
            template: template
        });

        console.log(`✅ Rebuilt table with ${columns.length} dynamic columns`);
    }

    public onSearchWorkOverview(event: any): void {
        const query = event.getParameter("query") || event.getParameter("newValue") || "";
        this.applyWorkOverviewFilters(query);
    }

    public onFilterWorkOverview(event: any): void {
        // Get current search query if any
        const table = this.byId("workOverviewTable") as Table;
        const toolbar = table?.getHeaderToolbar() as OverflowToolbar;
        const searchField = toolbar?.getContent()
            .find((c: any) => c.getMetadata().getName() === "sap.m.SearchField") as any;
        const query = searchField?.getValue() || "";
        this.applyWorkOverviewFilters(query);
    }

    private applyWorkOverviewFilters(searchQuery: string = ""): void {
        const table = this.byId("workOverviewTable") as Table;
        const binding = table.getBinding("items") as ListBinding;
        
        if (!binding) return;

        const filters: Filter[] = [];

        // T-Level filter
        const tLevelFilter = this.byId("tLevelFilter") as any;
        const selectedTLevel = tLevelFilter?.getSelectedKey();
        if (selectedTLevel) {
            filters.push(new Filter("tLevel", FilterOperator.EQ, selectedTLevel));
        }

        // Specialization filter
        const specializationFilter = this.byId("specializationFilter") as any;
        const selectedSpecialization = specializationFilter?.getSelectedKey();
        if (selectedSpecialization) {
            filters.push(new Filter("specialization", FilterOperator.EQ, selectedSpecialization));
        }

        // Search filter
        if (searchQuery) {
            const searchFilters = [
                new Filter("name", FilterOperator.Contains, searchQuery),
                new Filter("employeeId", FilterOperator.Contains, searchQuery)
            ];
            filters.push(new Filter({ filters: searchFilters, and: false }));
        }

        // Apply all filters (combined with AND)
        binding.filter(filters.length > 0 ? filters : []);
    }

    public async onViewManagerTeam(event: any): Promise<void> {
        const source = event.getSource();
        const bindingContext = source.getBindingContext("allManagers");
        const manager = bindingContext.getObject();
        
        console.log("📋 Navigating to team view for manager:", manager.managerId);
        
        // Get the current senior manager ID
        const currentUserModel = this.getOwnerComponent()?.getModel("currentUser") as JSONModel;
        const currentUser = currentUserModel?.getData();
        const seniorMgrId = this.currentSeniorManagerId || currentUser?.id;
        
        // Navigate to the new Manager Team View page
        this.getRouter().navTo("ManagerTeamView", {
            managerId: manager.managerId,
            seniorManagerId: seniorMgrId
        });
        
        MessageToast.show(`Loading ${manager.name}'s team dashboard...`);
    }

    public onCloseManagerTeamDialog(): void {
        const dialog = this.byId("managerTeamDialog") as Dialog;
        dialog.close();
    }

    private openOrgMetricsDialog(title: string, type: string, rows: any[]): void {
        (this.byId("orgMetricsDialogTitle") as any)?.setText(title);
        this.getView()?.setModel(new JSONModel({ type, rows }), "orgMetricsDetail");
        (this.byId("orgMetricsDetailDialog") as any)?.open();
    }

    public onCloseOrgMetricsDialog(): void {
        (this.byId("orgMetricsDetailDialog") as any)?.close();
    }

    public onViewAllManagers(): void {
        const cache = (this.getView()?.getModel("orgMetricsCache") as JSONModel)?.getData();
        const rows = cache?.managers || [];
        this.openOrgMetricsDialog(`All Managers (${rows.length})`, "managers", rows);
    }

    public onViewAllEmployees(): void {
        const cache = (this.getView()?.getModel("orgMetricsCache") as JSONModel)?.getData();
        const rows = cache?.allEmployees || [];
        this.openOrgMetricsDialog(`All Employees (${rows.length})`, "employees", rows);
    }

    public onViewAllSkills(): void {
        const cache = (this.getView()?.getModel("orgMetricsCache") as JSONModel)?.getData();
        const rows = cache?.allSkills || [];
        this.openOrgMetricsDialog(`All Unique Skills (${rows.length})`, "skills", rows);
    }

    public onViewOnProjectEmployees(): void {
        const cache = (this.getView()?.getModel("orgMetricsCache") as JSONModel)?.getData();
        const rows = cache?.onProjectEmployees || [];
        this.openOrgMetricsDialog(`Working on Project Today (${rows.length})`, "employees", rows);
    }

    public onViewAvailableEmployees(): void {
        const cache = (this.getView()?.getModel("orgMetricsCache") as JSONModel)?.getData();
        const rows = cache?.availableEmployees || [];
        this.openOrgMetricsDialog(`Available Employees (${rows.length})`, "employees", rows);
    }

    public onOrgSkillTokenUpdate(event: Event): void {
        const multiInput = event.getSource() as MultiInput;
        const tokens = multiInput.getTokens();
        console.log("Current org skill tokens:", tokens.map(token => token.getText()));
    }

    public onOrgSkillSubmit(event: Event): void {
        const multiInput = event.getSource() as MultiInput;
        const value = multiInput.getValue().trim();
        if (value) {
            const existingTokens = multiInput.getTokens();
            const tokenExists = existingTokens.some(token =>
                token.getText().toLowerCase() === value.toLowerCase()
            );
            if (!tokenExists) {
                const newToken = new Token({ text: value, key: value.toLowerCase() });
                multiInput.addToken(newToken);
                multiInput.setValue("");
                MessageToast.show(`Added skill: ${value}`);
            } else {
                MessageToast.show(`Skill "${value}" already added`);
                multiInput.setValue("");
            }
        }
    }

    public onOrgSkillLiveChange(event: Event): void {
        const multiInput = event.getSource() as MultiInput;
        const value = multiInput.getValue();
        if (value && value.includes(',')) {
            const skills = value.split(',').map((s: string) => s.trim()).filter((s: string) => s);
            if (skills.length > 1) {
                skills.forEach((skill: string) => {
                    const existingTokens = multiInput.getTokens();
                    const tokenExists = existingTokens.some(token =>
                        token.getText().toLowerCase() === skill.toLowerCase()
                    );
                    if (!tokenExists) {
                        multiInput.addToken(new Token({ text: skill, key: skill.toLowerCase() }));
                    }
                });
                multiInput.setValue("");
            }
        }
    }

    public async onOrgSearch(): Promise<void> {
        const multiInput = this.byId("orgSkillsSearch") as MultiInput;
        const managerFilter = this.byId("orgManagerFilter") as Select;
        const teamFilter = this.byId("orgTeamFilter") as Select;
        const experienceSelect = this.byId("orgExperienceLevel") as Select;
        
        const skillTokens = multiInput.getTokens();
        const searchSkills = skillTokens.map(token => token.getText().toLowerCase());
        const selectedManager = managerFilter?.getSelectedKey() || "";
        const selectedTeam = teamFilter?.getSelectedKey() || "";
        const experienceLevel = experienceSelect?.getSelectedKey() || "";
        
        console.log("Organization search:", { searchSkills, selectedManager, selectedTeam, experienceLevel });
        
        if (searchSkills.length === 0 && !selectedManager && !selectedTeam && !experienceLevel) {
            MessageToast.show("Please enter at least one search criterion");
            return;
        }
        
        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            
            // Load all employees
            const employeesBinding = oDataModel.bindList("/Employees");
            let filters: any[] = [];
            
            // Apply manager filter if selected
            if (selectedManager) {
                filters.push(new Filter("managerId", FilterOperator.EQ, selectedManager));
            }
            
            // Apply sub-team filter if selected (support Team1 and Team 1 variants)
            if (selectedTeam) {
                const compactSubTeam = selectedTeam.replace(/\s+/g, "");
                const spacedSubTeam = compactSubTeam.replace(/(\D+)(\d+)/, "$1 $2");
                filters.push(new Filter({
                    filters: [
                        new Filter("subTeam", FilterOperator.EQ, selectedTeam),
                        new Filter("subTeam", FilterOperator.EQ, compactSubTeam),
                        new Filter("subTeam", FilterOperator.EQ, spacedSubTeam),
                        new Filter("subTeam", FilterOperator.EQ, compactSubTeam.toLowerCase()),
                        new Filter("subTeam", FilterOperator.EQ, spacedSubTeam.toLowerCase())
                    ],
                    and: false
                }));
            }
            
            if (filters.length > 0) {
                employeesBinding.filter(filters);
            }
            
            const contexts = await employeesBinding.requestContexts(0, 1000);
            const allEmployees = contexts.map((ctx: any) => ctx.getObject())
                .filter((emp: any) => emp.employeeId && !emp.employeeId.startsWith("MGR"));
            
            console.log(`Found ${allEmployees.length} employees matching filters`);
            
            // Load skills and profiles for matching employees
            const enrichedEmployees = await Promise.all(allEmployees.map(async (emp: any) => {
                const skills = await this.getEmployeeSkills(emp.employeeId);
                const profile = await this.getEmployeeProfile(emp.employeeId);
                const managerName = await this.getManagerName(emp.managerId);
                return {
                    ...emp,
                    skills: skills,
                    role: profile?.role || '',
                    managerName: managerName
                };
            }));
            
            // Perform search filtering
            const searchResults = this.performOrgSearch(enrichedEmployees, searchSkills, experienceLevel);
            
            console.log(`Search complete: ${searchResults.length} results`);
            
            // Display results
            this.displayOrgSearchResults(searchResults);
            
        } catch (error) {
            console.error("❌ Error performing organization search:", error);
            MessageToast.show("Error performing search");
        }
    }

    private performOrgSearch(employees: any[], searchSkills: string[], experienceLevel: string): any[] {
        return employees.filter(emp => {
            const empSkills = emp.skills || [];
            
            // If no skills specified, return all
            if (searchSkills.length === 0 && !experienceLevel) {
                return true;
            }
            
            // Check skill match
            if (searchSkills.length > 0) {
                const matchingSkills = empSkills.filter((skill: any) => 
                    searchSkills.some(searchSkill => 
                        skill.skillName.toLowerCase().includes(searchSkill)
                    )
                );
                
                if (matchingSkills.length === 0) {
                    return false;
                }
                
                // Check experience level
                if (experienceLevel) {
                    const meetsExperience = matchingSkills.some((skill: any) => 
                        this.matchesExperienceRequirement(skill.proficiencyLevel, experienceLevel)
                    );
                    if (!meetsExperience) {
                        return false;
                    }
                }
            }
            
            return true;
        }).map(emp => {
            const empSkills = emp.skills || [];
            const matchingSkills = empSkills
                .filter((s: any) => 
                    searchSkills.some(searchSkill => 
                        s.skillName.toLowerCase().includes(searchSkill)
                    )
                )
                .map((s: any) => `${s.skillName} (${s.proficiencyLevel})`)
                .join(", ");
            
            const matchScore = this.calculateMatchScore(emp.skills, searchSkills);
            const matchState = matchScore >= 80 ? "Success" : matchScore >= 50 ? "Warning" : "Error";
            
            return {
                ...emp,
                matchingSkills: matchingSkills || "All Skills",
                matchScore: matchScore,
                matchState: matchState
            };
        }).sort((a, b) => b.matchScore - a.matchScore);
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

    private calculateMatchScore(empSkills: any[], searchSkills: string[]): number {
        if (searchSkills.length === 0) {
            return 100;
        }
        
        const matchedSkills = empSkills.filter((skill: any) => 
            searchSkills.some(searchSkill => 
                skill.skillName.toLowerCase().includes(searchSkill)
            )
        );
        
        if (matchedSkills.length === 0) {
            return 0;
        }
        
        const proficiencyScores: { [key: string]: number } = {
            "Beginner": 50,
            "Intermediate": 75,
            "Proficient": 100,
            "Advanced": 90,
            "Expert": 100
        };
        
        let totalScore = 0;
        matchedSkills.forEach((skill: any) => {
            const proficiency = skill.proficiencyLevel || "Beginner";
            totalScore += proficiencyScores[proficiency] || 50;
        });
        
        const averageScore = totalScore / searchSkills.length;
        
        if (matchedSkills.length >= searchSkills.length) {
            return Math.min(100, Math.round(averageScore * 1.1));
        }
        
        return Math.round(averageScore);
    }

    private displayOrgSearchResults(results: any[]): void {
        const searchResultsSection = this.byId("orgSearchResultsSection") as any;
        const searchResultsPanel = this.byId("orgSearchResultsPanel") as any;
        
        if (!searchResultsSection) {
            MessageToast.show("Search results components not found");
            return;
        }
        
        if (results.length === 0) {
            MessageToast.show("No employees found matching your search criteria");
            searchResultsSection.setVisible(false);
            return;
        }
        
        // Create and set search results model
        const resultsModel = new JSONModel({ results });
        this.getView()?.setModel(resultsModel, "orgSearchResults");
        
        // Update panel header
        searchResultsPanel?.setHeaderText(`Search Results (${results.length} employees found)`);
        
        // Show results section
        searchResultsSection.setVisible(true);
        
        MessageToast.show(`Found ${results.length} employees`);
        
        // Scroll to results
        setTimeout(() => {
            searchResultsSection.getDomRef()?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    }

    public onManagerSelect(event: any): void {
        const table = event.getSource();
        const selectedItem = table.getSelectedItem();
        
        if (selectedItem) {
            const bindingContext = selectedItem.getBindingContext("allManagers");
            const manager = bindingContext.getObject();
            console.log("Manager selected:", manager);
        }
    }

    public onViewIndividualEmployeeDetails(event: any): void {
        const source = event.getSource();
        const bindingContext = source.getBindingContext("allManagers");
        if (!bindingContext) {
            MessageToast.show("Unable to load employee details");
            return;
        }

        const employee = bindingContext.getObject();
        this.openManagerSharedEmployeeDialog(employee);
    }

    // Helper methods
    private async getEmployeeSkills(employeeId: string): Promise<any[]> {
        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            const listBinding = oDataModel.bindList("/Skills");
            listBinding.filter([new Filter("employeeId", FilterOperator.EQ, employeeId)]);
            
            const contexts = await listBinding.requestContexts(0, 1000);
            return contexts.map((context: any) => context.getObject());
        } catch (error) {
            console.error(`Error loading skills for ${employeeId}:`, error);
            return [];
        }
    }

    private async getEmployeeProfile(employeeId: string): Promise<any> {
        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            const listBinding = oDataModel.bindList("/Profiles");
            listBinding.filter([new Filter("employeeId", FilterOperator.EQ, employeeId)]);
            
            const contexts = await listBinding.requestContexts(0, 1);
            const profiles = contexts.map((context: any) => context.getObject());
            return profiles.length > 0 ? profiles[0] : null;
        } catch (error) {
            console.error(`Error loading profile for ${employeeId}:`, error);
            return null;
        }
    }

    private async getManagerName(managerId: string): Promise<string> {
        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            const listBinding = oDataModel.bindList("/Employees");
            listBinding.filter([
                new Filter("employeeId", FilterOperator.EQ, managerId),
                new Filter("role", FilterOperator.EQ, "Manager")
            ]);
            
            const contexts = await listBinding.requestContexts(0, 1);
            if (contexts.length > 0) {
                const manager = contexts[0].getObject();
                return manager.name || managerId;
            }
            return managerId;
        } catch (error) {
            console.error(`Error loading manager name for ${managerId}:`, error);
            return managerId;
        }
    }

    // ==================== ORG SEARCH RESULT DETAIL POPUP ====================

    public onViewOrgSearchResult(event: Event): void {
        const source = event.getSource();
        let bindingContext = (source as any).getBindingContext("orgSearchResults");
        if (!bindingContext) {
            const parent = (source as any).getParent ? (source as any).getParent() : source;
            bindingContext = (parent as any).getBindingContext("orgSearchResults");
        }
        if (!bindingContext) {
            MessageToast.show("Unable to get employee details. Please try again.");
            return;
        }
        const result = bindingContext.getObject();
        this.openManagerSharedEmployeeDialog(result);
    }

    private async openManagerSharedEmployeeDialog(employee: any): Promise<void> {
        try {
            const managerId = String(employee?.managerId || "").trim().toUpperCase();
            const employeeId = String(employee?.employeeId || employee?.id || "").trim();

            if (!managerId || !employeeId) {
                MessageToast.show("Unable to open employee details");
                return;
            }

            if (!this.sharedManagerView) {
                const owner = this.getOwnerComponent() as any;
                if (owner?.runAsOwner) {
                    let createdViewPromise: Promise<XMLView> | undefined;
                    owner.runAsOwner(() => {
                        createdViewPromise = XMLView.create({ viewName: "skillsphere.view.ManagerDashboard" });
                    });
                    this.sharedManagerView = await (createdViewPromise as Promise<XMLView>);
                } else {
                    this.sharedManagerView = await XMLView.create({ viewName: "skillsphere.view.ManagerDashboard" });
                }
                this.getView()?.addDependent(this.sharedManagerView);
                this.sharedManagerController = (this.sharedManagerView as any).getController();
            }

            // Reuse the exact manager-side employee dialog flow without modifying manager code.
            this.sharedManagerController.currentManagerId = managerId;
            await this.sharedManagerController.loadManagerData(managerId);
            await this.sharedManagerController.openEmployeeDetailsDialog({ employeeId }, false);
        } catch (error) {
            console.error("❌ Error opening shared manager employee dialog:", error);
            MessageToast.show("Unable to open employee details");
        }
    }

    private async openEmployeeDetailsDialog(employee: any): Promise<void> {
        const dialog = this.byId("smgrEmpDetailsDialog") as any;
        if (!dialog) {
            MessageToast.show("Dialog not found");
            return;
        }

        const empId = employee.employeeId || employee.id;

        try {
            const [employeeData, profileData, skills, projects, currentProjects, caiaUtilization, pocUtilization, certifications, completedMasterWork] = await Promise.all([
                this.loadEmployeeData(empId),
                this.loadProfileData(empId),
                this.getEmployeeSkills(empId),
                this.getEmployeeProjects(empId),
                this.getCurrentProjects(empId),
                this.getCAIAUtilization(empId),
                this.getPOCUtilization(empId),
                this.getCertifications(empId),
                this.getCompletedInitiativeEvaluationForTabs(empId)
            ]);

            const activeCurrentProjects = currentProjects
                .filter((cp: any) => cp.assignmentStatus !== "Completed")
                .map((cp: any) => ({
                    ...cp,
                    isUtilizationEditing: false
                }));

            const completeData = {
                ...employeeData,
                ...profileData,
                skills,
                projects,
                initiativesHistory: completedMasterWork.initiatives,
                evaluationsHistory: completedMasterWork.evaluations,
                currentProjects: activeCurrentProjects,
                caiaUtilization,
                pocUtilization,
                certifications,
                assignments: currentProjects
            };

            this.getView()?.setModel(new JSONModel(completeData), "employeeDetails");

            (this.byId("smgrDialogEmployeeName") as any)?.setText(employeeData.name || '');
            (this.byId("smgrDialogEmployeeId") as any)?.setText(employeeData.employeeId || '');
            (this.byId("smgrDialogEmployeeEmail") as any)?.setText(employeeData.email || '');
            (this.byId("smgrDialogEmployeeTeam") as any)?.setText(employeeData.team || '');
            (this.byId("smgrDialogEmployeeSpecialization") as any)?.setText(employeeData.specialization || '');
            (this.byId("smgrDialogEmployeeManager") as any)?.setText(employeeData.managerId || '');
            (this.byId("smgrDialogEmployeeRole") as any)?.setText(profileData.role || 'N/A');
            (this.byId("smgrDialogEmployeeLocation") as any)?.setText(profileData.location || 'N/A');
            (this.byId("smgrDialogEmployeeTLevel") as any)?.setText(profileData.tLevel || 'N/A');
            (this.byId("smgrDialogEmployeeGradeLevel") as any)?.setText(profileData.gradeLevel || 'N/A');
            (this.byId("smgrDialogEmployeeLastUpdated") as any)?.setText(
                profileData.lastUpdated ? new Date(profileData.lastUpdated).toLocaleDateString() : 'N/A'
            );

            const statusControl = this.byId("smgrDialogWorkStatus") as any;
            statusControl?.setText(this.formatWorkingStatus(employee.working_on_project));
            statusControl?.setIcon(this.formatWorkingStatusIcon(employee.working_on_project));
            statusControl?.setState(this.formatWorkingStatusState(employee.working_on_project));

            const today = new Date(); today.setHours(0, 0, 0, 0);
            const activeCount = currentProjects.filter((cp: any) => cp.assignmentStatus !== "Completed").length;
            (this.byId("smgrDialogActiveProjects") as any)?.setNumber(activeCount);
            (this.byId("smgrDialogActiveProjects") as any)?.setUnit(activeCount === 1 ? "project" : "projects");
            (this.byId("smgrDialogTotalSkills") as any)?.setNumber(skills.length);
            (this.byId("smgrDialogTotalSkills") as any)?.setUnit(skills.length === 1 ? "skill" : "skills");
            (this.byId("smgrDialogTotalProjects") as any)?.setNumber(projects.length);
            (this.byId("smgrDialogTotalProjects") as any)?.setUnit(projects.length === 1 ? "project" : "projects");
            (this.byId("smgrDialogTotalCertifications") as any)?.setNumber(certifications.length);
            (this.byId("smgrDialogTotalCertifications") as any)?.setUnit(certifications.length === 1 ? "certification" : "certifications");

            // Match tab
            const matchTab = this.byId("smgrDialogMatchTab") as any;
            if (employee.matchScore !== undefined) {
                matchTab?.setVisible(true);
                const ms = this.byId("smgrDialogMatchScore") as any;
                ms?.setPercentValue(employee.matchScore);
                ms?.setDisplayValue(employee.matchScore + "%");
                ms?.setState(this.formatMatchScoreState(employee.matchScore));
                const ml = this.byId("smgrDialogMatchLevel") as any;
                ml?.setText(this.formatMatchScoreText(employee.matchScore));
                ml?.setState(this.formatMatchScoreState(employee.matchScore));
                (this.byId("smgrDialogMatchingSkills") as any)?.setText(employee.matchingSkills || "N/A");
            } else {
                matchTab?.setVisible(false);
            }

            dialog.open();
        } catch (error) {
            console.error("❌ Error loading employee details:", error);
            MessageToast.show("Error loading employee details");
        }
    }

    public onCloseEmployeeDialog(): void {
        (this.byId("smgrEmpDetailsDialog") as any)?.close();
    }

    public onContactEmployee(): void {
        const name = (this.byId("dialogEmployeeName") as any)?.getText();
        MessageToast.show(`Contacting ${name}...`);
    }

    private async loadEmployeeData(employeeId: string): Promise<any> {
        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            const binding = oDataModel.bindList("/Employees");
            binding.filter([new Filter("employeeId", FilterOperator.EQ, employeeId)]);
            const contexts = await binding.requestContexts(0, 1);
            return contexts.length > 0 ? contexts[0].getObject() : {};
        } catch { return {}; }
    }

    private async loadProfileData(employeeId: string): Promise<any> {
        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            const binding = oDataModel.bindList("/Profiles");
            binding.filter([new Filter("employeeId", FilterOperator.EQ, employeeId)]);
            const contexts = await binding.requestContexts(0, 1);
            return contexts.length > 0 ? contexts[0].getObject() : {};
        } catch { return {}; }
    }

    private async getEmployeeProjects(employeeId: string): Promise<any[]> {
        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            const binding = oDataModel.bindList("/Projects");
            binding.filter([new Filter("employeeId", FilterOperator.EQ, employeeId)]);
            const contexts = await binding.requestContexts();
            return contexts.map((c: any) => c.getObject());
        } catch { return []; }
    }

    private async getCurrentProjects(employeeId: string): Promise<any[]> {
        try {
            const escapedEmployeeId = employeeId.replace(/'/g, "''");
            const filter = encodeURIComponent(`employeeId eq '${escapedEmployeeId}'`);

            const [projectRes, initiativeRes, evaluationRes] = await Promise.all([
                fetch(`/odata/v4/skillsphere/CurrentProjects?$filter=${filter}`, { credentials: "same-origin", headers: { Accept: "application/json" } }),
                fetch(`/odata/v4/skillsphere/CurrentInitiatives?$filter=${filter}`, { credentials: "same-origin", headers: { Accept: "application/json" } }),
                fetch(`/odata/v4/skillsphere/CurrentEvaluations?$filter=${filter}`, { credentials: "same-origin", headers: { Accept: "application/json" } })
            ]);

            const [projectData, initiativeData, evaluationData] = await Promise.all([
                projectRes.ok ? projectRes.json() : { value: [] },
                initiativeRes.ok ? initiativeRes.json() : { value: [] },
                evaluationRes.ok ? evaluationRes.json() : { value: [] }
            ]);

            const projects = (projectData.value || []).map((obj: any) => ({
                ...obj,
                assignmentStatus: obj.assignmentStatus || obj.status || "Assigned",
                _source: "CurrentProjects"
            }));

            const initiatives = (initiativeData.value || []).map((obj: any) => ({
                currentProjectId: obj.currentInitiativeId,
                currentInitiativeId: obj.currentInitiativeId,
                employeeId: obj.employeeId,
                type: "Initiative",
                projectName: obj.initiativeName,
                startDate: obj.startDate,
                endDate: obj.endDate,
                utilizationPercent: obj.utilizationPercent,
                assignmentStatus: obj.status === "Completed" ? "Completed" : "Assigned",
                _source: "CurrentInitiatives"
            }));

            const evaluations = (evaluationData.value || []).map((obj: any) => ({
                currentProjectId: obj.currentEvaluationId,
                currentEvaluationId: obj.currentEvaluationId,
                employeeId: obj.employeeId,
                type: "Evaluation",
                projectName: obj.evaluationName,
                startDate: obj.startDate,
                endDate: obj.endDate,
                utilizationPercent: obj.utilizationPercent,
                assignmentStatus: obj.status === "Completed" ? "Completed" : "Assigned",
                _source: "CurrentEvaluations"
            }));

            const completedHistory = await this.getCompletedMasterWorkHistory(employeeId);
            return [...projects, ...initiatives, ...evaluations, ...completedHistory];
        } catch { return []; }
    }

    private async getCompletedMasterWorkHistory(employeeId: string): Promise<any[]> {
        try {
            const escapedEmployeeId = employeeId.replace(/'/g, "''");
            const filter = encodeURIComponent(`employeeId eq '${escapedEmployeeId}' and status eq 'Completed'`);
            const response = await fetch(`/odata/v4/skillsphere/Initiatives?$filter=${filter}`, {
                credentials: "same-origin",
                headers: { Accept: "application/json" }
            });

            if (!response.ok) return [];
            const data = await response.json();

            return (data.value || []).map((obj: any) => {
                const isEvaluation = String(obj.type || "").toLowerCase() === "evaluation";
                return {
                    employeeId: obj.employeeId,
                    type: isEvaluation ? "Evaluation" : "Initiative",
                    projectName: obj.initiativeName,
                    startDate: obj.startDate,
                    endDate: obj.endDate,
                    utilizationPercent: obj.utilizationPercent,
                    assignmentStatus: "Completed",
                    _source: "InitiativesHistory"
                };
            });
        } catch {
            return [];
        }
    }

    private async getCompletedInitiativeEvaluationForTabs(employeeId: string): Promise<{ initiatives: any[]; evaluations: any[] }> {
        try {
            const escapedEmployeeId = employeeId.replace(/'/g, "''");
            const filter = encodeURIComponent(`employeeId eq '${escapedEmployeeId}' and status eq 'Completed'`);
            const response = await fetch(`/odata/v4/skillsphere/Initiatives?$filter=${filter}`, {
                credentials: "same-origin",
                headers: { Accept: "application/json" }
            });

            if (!response.ok) return { initiatives: [], evaluations: [] };
            const data = await response.json();

            const initiatives = (data.value || [])
                .filter((obj: any) => String(obj.type || "").toLowerCase() !== "evaluation")
                .map((obj: any) => ({
                    projectName: obj.initiativeName,
                    startDate: obj.startDate,
                    endDate: obj.endDate,
                    status: "Completed"
                }));

            const evaluations = (data.value || [])
                .filter((obj: any) => String(obj.type || "").toLowerCase() === "evaluation")
                .map((obj: any) => ({
                    projectName: obj.initiativeName,
                    startDate: obj.startDate,
                    endDate: obj.endDate,
                    status: "Completed"
                }));

            return { initiatives, evaluations };
        } catch {
            return { initiatives: [], evaluations: [] };
        }
    }

    private async getCAIAUtilization(employeeId: string): Promise<any[]> {
        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            const binding = oDataModel.bindList("/CAIAUtilization");
            binding.filter([new Filter("employeeId", FilterOperator.EQ, employeeId)]);
            const contexts = await binding.requestContexts();
            return contexts.map((c: any) => c.getObject());
        } catch { return []; }
    }

    private async getPOCUtilization(employeeId: string): Promise<any[]> {
        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            const binding = oDataModel.bindList("/POCUtilization");
            binding.filter([new Filter("employeeId", FilterOperator.EQ, employeeId)]);
            const contexts = await binding.requestContexts();
            return contexts.map((c: any) => c.getObject());
        } catch { return []; }
    }

    private async getCertifications(employeeId: string): Promise<any[]> {
        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            const binding = oDataModel.bindList("/Certifications");
            binding.filter([new Filter("employeeId", FilterOperator.EQ, employeeId)]);
            const contexts = await binding.requestContexts();
            return contexts.map((c: any) => c.getObject());
        } catch { return []; }
    }

    // Formatters
    public formatWorkingStatus(workingOnProject: boolean): string {
        return workingOnProject ? "Working on Project" : "Available";
    }

    public formatWorkingStatusWithArrow(workingOnProject: boolean): string {
        return workingOnProject ? "Working on Project >" : "Available";
    }

    public formatWorkingStatusIcon(workingOnProject: boolean): string {
        return workingOnProject ? "sap-icon://navigation-right-arrow" : "sap-icon://accept";
    }

    public formatWorkingStatusState(workingOnProject: boolean): string {
        return workingOnProject ? "Error" : "Success";
    }

    public formatProficiencyState(proficiencyLevel: string): string {
        const map: { [k: string]: string } = {
            "Expert": "Success", "Advanced": "Success",
            "Proficient": "Information", "Intermediate": "Warning", "Beginner": "None"
        };
        return map[proficiencyLevel] || "None";
    }

    public formatCertificationState(certificationStatus: string): string {
        const map: { [k: string]: string } = {
            "Certified": "Success", "In Progress": "Warning",
            "Not Certified": "None", "None": "None"
        };
        return map[certificationStatus] || "None";
    }

    public formatTypeState(type: string): string {
        const normalizedType = String(type || "").toLowerCase();
        if (normalizedType === "project") return "Success";
        if (normalizedType === "evaluation") return "Warning";
        if (normalizedType === "initiative") return "Information";
        if (normalizedType === "caia" || normalizedType === "poc") return "None";
        return "None";
    }

    public formatAssignmentStatusLabel(status: string): string {
        const normalizedStatus = String(status || "").trim();
        return normalizedStatus || "Assigned";
    }

    public formatAssignmentStatusState(status: string): string {
        const normalizedStatus = String(status || "").trim().toLowerCase();
        if (normalizedStatus === "completed") return "Success";
        if (normalizedStatus === "rejected") return "Error";
        if (normalizedStatus === "pending") return "Warning";
        return "Information";
    }

    public formatUtilizationPercent(hoursPerDay: number): string {
        if (!hoursPerDay || hoursPerDay === 0) return "0%";
        return `${Math.round((hoursPerDay / 8) * 100)}%`;
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

    // ==================== AI Assistant Methods ====================

    /**
     * Open AI Assistant Dialog
     */
    public onOpenAIAssistant(): void {
        const currentUserModel = this.getOwnerComponent()
            ?.getModel("currentUser") as JSONModel;

        const userData = currentUserModel?.getData();

        if (!userData?.id) {
            console.error("❌ No seniorManagerId found in currentUser model");
            MessageToast.show("Please login first");
            return;
        }

        const newSeniorManagerId = userData.id;
        console.log("🔑 Senior Manager ID for AI (fresh):", newSeniorManagerId);

        // ✅ Clear chat ONLY if senior manager changes
        if (this.currentChatSeniorManagerId !== newSeniorManagerId) {
            console.log(
                `🔄 Different senior manager detected (was: ${this.currentChatSeniorManagerId}, now: ${newSeniorManagerId})`
            );
            this.clearChatForNewSeniorManager();
            this.currentChatSeniorManagerId = newSeniorManagerId;
        }

        this.seniorManagerId = newSeniorManagerId;

        // Initialize chat only once per senior manager
        const oContainer = this.byId("messagesContainerSeniorManager") as any;
        if (!oContainer || oContainer.getItems().length === 0) {
            this.initializeAIChat();
        }

        const oDialog = this.byId("aiAssistantDialogSeniorManager") as Dialog;
        oDialog?.open();
    }

    /**
     * Close AI Assistant Dialog
     */
    public onCloseAIDialog(): void {
        const oDialog = this.byId("aiAssistantDialogSeniorManager") as Dialog;
        oDialog?.close();
        // ❗ Do NOT clear chat here
    }

    private clearChatForNewSeniorManager(): void {
        console.log("🧹 Clearing chat for new senior manager");

        const oContainer = this.byId("messagesContainerSeniorManager") as any;
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
            console.log("ℹ️ Senior Manager AI chat already initialized");
            return;
        }

        const currentUserModel = this.getOwnerComponent()
            ?.getModel("currentUser") as JSONModel;

        const userData = currentUserModel?.getData();
        const seniorManagerName = userData?.name || "Senior Manager";

        this.addBotMessage(
            `👋 Hello ${seniorManagerName}! I'm your AI assistant.\n\n` +
            "I can help you with:\n" +
            "• Organization-wide talent insights\n" +
            "• Resource allocation across teams\n" +
            "• Identifying skill gaps and training needs\n" +
            "• Strategic workforce planning\n" +
            "• Cross-team collaboration opportunities\n\n" +
            "What would you like to know?"
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
            case "Org Insights":
                query = "Give me an overview of our organization's current talent and skill distribution";
                break;
            case "Resource Plan":
                query = "Help me plan resource allocation across my teams";
                break;
            case "Skill Gaps":
                query = "What are the key skill gaps across our organization?";
                break;
        }

        const input = this.byId("messageInputSeniorManager") as any;
        input?.setValue(query);
        this.onSendMessage();
    }

    /**
     * Clear chat manually (button action)
     */
    public onClearChat(): void {
        console.log("🧹 Manual chat clear requested");
        const oContainer = this.byId("messagesContainerSeniorManager") as any;
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
     * Send message to AI
     */
    public onSendMessage(): void {
        const oInput = this.byId("messageInputSeniorManager") as any;
        const sMessage = oInput?.getValue().trim();

        if (!sMessage) {
            MessageToast.show("Please enter a message");
            return;
        }

        // Ensure seniorManagerId exists
        if (!this.seniorManagerId) {
            const currentUserModel = this.getOwnerComponent()
                ?.getModel("currentUser") as JSONModel;
            const userData = currentUserModel?.getData();
            this.seniorManagerId = userData?.id || "";
        }

        if (!this.seniorManagerId) {
            MessageToast.show("Senior Manager ID not found. Please login again.");
            return;
        }

        this.addUserMessage(sMessage);
        oInput.setValue("");
        this.showTypingIndicator();
        this.queryAI(sMessage);
    }

    /**
     * Query AI service
     */
    private async queryAI(query: string): Promise<void> {
        try {
            console.log("🤖 Querying AI");
            console.log("  - Senior Manager ID:", this.seniorManagerId);
            console.log("  - Query:", query);

            if (!this.seniorManagerId) {
                throw new Error("Senior Manager ID is required");
            }

            // Use OData V4 model action binding — handles CSRF automatically
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            const oAction = oDataModel.bindContext("/seniorManagerQuery(...)");
            oAction.setParameter("seniorManagerId", this.seniorManagerId);
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
        const oContainer = this.byId("messagesContainerSeniorManager") as any;

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
        const oContainer = this.byId("messagesContainerSeniorManager") as any;

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
        const oContainer = this.byId("messagesContainerSeniorManager") as any;

        this.typingIndicator = new HTML({
            id: this.createId("typingIndicator"),
            content: '<div class="typing-indicator"><span></span><span></span><span></span></div>'
        });

        const oMessageBox = new HBox({
            justifyContent: "Start",
            items: [
                new VBox({
                    items: [this.typingIndicator]
                }).addStyleClass("messageBox botMessageBox")
            ]
        }).addStyleClass("sapUiTinyMarginTop");

        oContainer?.addItem(oMessageBox);
        this.scrollToBottom();
    }

    /**
     * Remove typing indicator
     */
    private removeTypingIndicator(): void {
        if (this.typingIndicator) {
            const oContainer = this.byId("messagesContainerSeniorManager") as any;
            const items = oContainer?.getItems() || [];
            
            // Find and remove the parent HBox containing the typing indicator
            for (let i = items.length - 1; i >= 0; i--) {
                const item = items[i];
                if (item instanceof HBox) {
                    const vbox = item.getItems()[0];
                    if (vbox instanceof VBox) {
                        const innerItems = vbox.getItems();
                        if (innerItems.some((inner: any) => inner === this.typingIndicator)) {
                            oContainer.removeItem(item);
                            item.destroy();
                            break;
                        }
                    }
                }
            }
            
            this.typingIndicator.destroy();
            this.typingIndicator = null;
        }
    }

    /**
     * Scroll chat to bottom
     */
    private scrollToBottom(): void {
        setTimeout(() => {
            const oScrollContainer = this.byId("chatContainerSeniorManager") as any;
            if (oScrollContainer) {
                oScrollContainer.scrollTo(0, 10000);
            }
        }, 100);
    }
}
