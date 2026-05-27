import Controller from "sap/ui/core/mvc/Controller";
import XMLView from "sap/ui/core/mvc/XMLView";
import Router from "sap/ui/core/routing/Router";
import MessageToast from "sap/m/MessageToast";
import MessageBox from "sap/m/MessageBox";
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
import Label from "sap/m/Label";
import Input from "sap/m/Input";
import Button from "sap/m/Button";
import DatePicker from "sap/m/DatePicker";
import TextArea from "sap/m/TextArea";

/**
 * @namespace skillsphere.controller
 */
export default class SeniorManagerDashboard extends Controller {

    private currentSeniorManagerId: string | null = null;
    private currentDialogEmployeeId: string = "";
    private seniorManagerId: string = "";
    private currentManagerId: string = "";
    private currentChatSeniorManagerId: string = "";
    private aiInitialized: boolean = false;
    private typingIndicator: HTML | null = null;
    private employeeProfileDialog?: Dialog;
    private sharedManagerView?: XMLView;
    private sharedManagerController?: any;

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

    public onInit(): void {
        const router = this.getRouter();
        router.getRoute("SeniorManagerDashboard")?.attachPatternMatched(this.onRouteMatched, this);

        // Auto-refresh when the user tabs back in (cross-tab data sync)
        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible" && this.currentSeniorManagerId) {
                this.loadAllManagers().catch(() => undefined);
                this.loadMasterProjects().catch(() => undefined);
            }
        });
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
        
        // Set current senior manager ID (with backward-compatible alias mapping)
        const seniorManagerAliasMap: Record<string, string> = {
            SMGR01: "I305034"
        };
        const requestedSeniorManagerId = String(seniorManagerId || currentUser?.id || "").trim().toUpperCase();
        this.currentSeniorManagerId = seniorManagerAliasMap[requestedSeniorManagerId] || requestedSeniorManagerId;
        
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

            // Load master work catalogs and projects used in employee assign tab
            await this.loadMasterWorkItems();
            await this.loadMasterProjects();
            
            MessageToast.show("Dashboard data loaded successfully");
        } catch (error) {
            console.error("❌ Error loading dashboard data:", error);
            MessageToast.show("Error loading dashboard data");
        }
    }

    private async loadMasterWorkItems(): Promise<void> {
        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            const initiativesBinding = oDataModel.bindList("/InitiativesMaster");
            const evaluationsBinding = oDataModel.bindList("/EvaluationsMaster");

            const [initiativeContexts, evaluationContexts] = await Promise.all([
                initiativesBinding.requestContexts(0, 1000),
                evaluationsBinding.requestContexts(0, 1000)
            ]);

            const initiativesItems = initiativeContexts
                .map((ctx: any) => ctx.getObject())
                .filter((row: any) => row && row.status !== "Completed")
                .map((row: any) => ({
                    initiativeId: row.initiativeId,
                    initiativeName: row.initiativeName,
                    description: row.description || "",
                    startDate: row.startDate,
                    endDate: row.endDate,
                    status: row.status
                }));

            const evaluationsItems = evaluationContexts
                .map((ctx: any) => ctx.getObject())
                .filter((row: any) => row && row.status !== "Completed")
                .map((row: any) => ({
                    evaluationId: row.evaluationId,
                    evaluationName: row.evaluationName,
                    description: row.description || "",
                    startDate: row.startDate,
                    endDate: row.endDate,
                    status: row.status
                }));

            initiativesItems.sort((a: any, b: any) => String(a.initiativeName || "").localeCompare(String(b.initiativeName || "")));
            evaluationsItems.sort((a: any, b: any) => String(a.evaluationName || "").localeCompare(String(b.evaluationName || "")));

            this.getView()?.setModel(new JSONModel({ items: initiativesItems }), "masterInitiatives");
            this.getView()?.setModel(new JSONModel({ items: evaluationsItems }), "masterEvaluations");

            console.log(`✅ Loaded master work items for senior manager assign tab: ${initiativesItems.length} initiatives, ${evaluationsItems.length} evaluations`);
        } catch (error) {
            console.error("❌ Error loading master work items:", error);
            this.getView()?.setModel(new JSONModel({ items: [] }), "masterInitiatives");
            this.getView()?.setModel(new JSONModel({ items: [] }), "masterEvaluations");
        }
    }

    public async loadMasterProjects(): Promise<void> {
        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            const listBinding = oDataModel.bindList("/Projects");
            const contexts = await listBinding.requestContexts(0, 1000);
            const projects = contexts.map((ctx: any) => ctx.getObject())
                .filter((p: any) => String(p.status || "").toLowerCase() !== "completed");

            projects.sort((a: any, b: any) => String(a.projectName || "").localeCompare(String(b.projectName || "")));
            this.getView()?.setModel(new JSONModel({ projects }), "masterProjects");
            console.log(`✅ SM loaded ${projects.length} master projects for assign dropdown`);
        } catch (error) {
            console.error("❌ Error loading master projects for senior manager:", error);
            this.getView()?.setModel(new JSONModel({ projects: [] }), "masterProjects");
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
                    managerId: String(mgr.employeeId || "").trim().toUpperCase()
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
            const allEmployees = employeeContexts
                .map((ctx: any) => ctx.getObject())
                .filter((emp: any) => !!emp.employeeId);
            
            // Load all profiles for T-Level and specialization display
            const profilesBinding = oDataModel.bindList("/Profiles");
            const profileContexts = await profilesBinding.requestContexts(0, 1000);
            const profiles = profileContexts.map((ctx: any) => ctx.getObject());
            const profileMap = new Map(profiles.map((p: any) => [p.employeeId, p]));
            
            // Load all current projects
            const cpBinding = oDataModel.bindList("/CurrentProjects");
            const cpContexts = await cpBinding.requestContexts(0, 1000);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            // Load current initiatives and current evaluations
            const currentInitiativesBinding = oDataModel.bindList("/CurrentInitiatives");
            const currentEvaluationsBinding = oDataModel.bindList("/CurrentEvaluations");
            const [currentInitiativeContexts, currentEvaluationContexts] = await Promise.all([
                currentInitiativesBinding.requestContexts(0, 1000),
                currentEvaluationsBinding.requestContexts(0, 1000)
            ]);
            
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
            
            // Group evaluations and initiatives by employee (from current work entities)
            const evalsByEmployee = new Map<string, any[]>();
            const initsByEmployee = new Map<string, any[]>();
            currentEvaluationContexts.map((ctx: any) => ctx.getObject()).forEach((evaluation: any) => {
                if (evaluation.status === "Completed") return;
                if (!evaluation.startDate || !evaluation.endDate) return;
                const start = new Date(evaluation.startDate); start.setHours(0, 0, 0, 0);
                const end = new Date(evaluation.endDate); end.setHours(0, 0, 0, 0);

                if (today >= start && today <= end) {
                    if (!evalsByEmployee.has(evaluation.employeeId)) {
                        evalsByEmployee.set(evaluation.employeeId, []);
                    }
                    evalsByEmployee.get(evaluation.employeeId)!.push(evaluation);
                }
            });

            currentInitiativeContexts.map((ctx: any) => ctx.getObject()).forEach((initiative: any) => {
                if (initiative.status === "Completed") return;
                if (!initiative.startDate || !initiative.endDate) return;
                const start = new Date(initiative.startDate); start.setHours(0, 0, 0, 0);
                const end = new Date(initiative.endDate); end.setHours(0, 0, 0, 0);

                if (today >= start && today <= end) {
                    if (!initsByEmployee.has(initiative.employeeId)) {
                        initsByEmployee.set(initiative.employeeId, []);
                    }
                    initsByEmployee.get(initiative.employeeId)!.push(initiative);
                }
            });
            
            // Calculate max counts for dynamic columns
            let maxProjects = 0;
            let maxEvaluations = 0;
            let maxInitiatives = 0;
            
            const employeeWorkData = allEmployees.map((emp: any) => {
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
                
                // Add evaluations dynamically
                for (let i = 0; i < maxEvaluations; i++) {
                    rowData.evaluations.push({
                        name: evaluations[i]?.evaluationName || evaluations[i]?.initiativeName || '-',
                        tech: '',
                        util: evaluations[i] ? `${evaluations[i].utilizationPercent}%` : ''
                    });
                }
                
                // Add initiatives dynamically
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
            
            console.log(`✅ Work overview loaded for ${employeesOverview.length} employees`);
            
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

    public async onRefreshTeamData(): Promise<void> {
        const btn = this.byId("refreshTeamBtn") as Button;
        if (btn) { btn.setEnabled(false); }
        try {
            await this.loadAllManagers();
            await this.loadMasterProjects();
            MessageToast.show("Team data refreshed");
        } catch (error) {
            console.error("❌ Error refreshing team data:", error);
        } finally {
            if (btn) { btn.setEnabled(true); }
        }
    }

    public async onViewManagerTeam(event: any): Promise<void> {
        const source = event.getSource();
        const bindingContext = source.getBindingContext("allManagers");
        const manager = bindingContext?.getObject();

        if (!manager?.managerId) {
            MessageToast.show("Manager information not found");
            return;
        }

        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            const employeesBinding = oDataModel.bindList("/Employees");
            employeesBinding.filter([new Filter("managerId", FilterOperator.EQ, manager.managerId)]);
            const teamContexts = await employeesBinding.requestContexts(0, 1000);
            const teamMembers = teamContexts.map((ctx: any) => ctx.getObject());

            // Keep the table's teamSize in sync with live data
            const allManagersModel = this.getView()?.getModel("allManagers") as JSONModel;
            const managers: any[] = allManagersModel?.getProperty("/managers") || [];
            const idx = managers.findIndex((m: any) => m.managerId === manager.managerId);
            if (idx !== -1) {
                allManagersModel.setProperty(`/managers/${idx}/teamSize`, teamMembers.length);
            }

            this.getView()?.setModel(new JSONModel({
                managerName: manager.name || "Manager",
                managerId: manager.managerId,
                employees: teamMembers
            }), "managerTeamDetails");

            const dialog = this.byId("managerTeamDialog") as Dialog;
            dialog?.open();

            MessageToast.show(`Loaded ${teamMembers.length} team member(s) for ${manager.name}`);
        } catch (error) {
            console.error("❌ Error loading manager team details:", error);
            MessageToast.show("Error loading manager team details");
        }
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
        this.openEmployeeDetailsDialog(employee);
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
        this.openEmployeeDetailsDialog(result);
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

        const empId = String(employee.employeeId || employee.id || "").trim();
        this.currentDialogEmployeeId = empId;

        try {
            // Ensure assign-work dropdowns always use the latest master catalogs.
            await this.loadMasterWorkItems();
            await this.loadMasterProjects();

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
        this.currentDialogEmployeeId = "";
        (this.byId("smgrEmpDetailsDialog") as any)?.close();
    }

    private async assignMasterWorkFromPanel(type: "Initiative" | "Evaluation"): Promise<void> {
        if (!this.currentDialogEmployeeId) {
            MessageToast.show("Select an employee first");
            return;
        }

        const isInitiative = type === "Initiative";
        const comboBox = this.byId(isInitiative ? "smgrAssignInitiativeComboBox" : "smgrAssignEvaluationComboBox") as any;
        const allocationInput = this.byId(isInitiative ? "smgrAssignInitiativeAllocationInput" : "smgrAssignEvaluationAllocationInput") as any;
        const modelName = isInitiative ? "masterInitiatives" : "masterEvaluations";
        const idField = isInitiative ? "initiativeId" : "evaluationId";
        const nameField = isInitiative ? "initiativeName" : "evaluationName";

        const selectedKey = String(comboBox?.getSelectedKey?.() || "").trim();
        if (!selectedKey) {
            MessageToast.show(`Please select a ${type.toLowerCase()} to assign`);
            return;
        }

        const allocationValue = Number(allocationInput?.getValue?.() ?? 100);
        const utilizationPercent = Math.max(1, Math.min(100, Math.round(allocationValue || 0)));

        const workModel = this.getView()?.getModel(modelName) as JSONModel;
        const items = workModel?.getProperty("/items") || [];
        const selected = items.find((item: any) => String(item[idField] || "") === selectedKey);

        if (!selected) {
            MessageToast.show(`${type} not found`);
            return;
        }

        if (String(selected.status || "").toLowerCase() === "completed") {
            MessageToast.show(`Completed ${type.toLowerCase()}s cannot be assigned`);
            return;
        }

        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;

            const existingBinding = oDataModel.bindList(isInitiative ? "/CurrentInitiatives" : "/CurrentEvaluations");
            existingBinding.filter([
                new Filter("employeeId", FilterOperator.EQ, this.currentDialogEmployeeId),
                new Filter(idField, FilterOperator.EQ, selectedKey)
            ]);
            const existingContexts = await existingBinding.requestContexts(0, 1);
            if (existingContexts.length > 0) {
                MessageToast.show(`This ${type.toLowerCase()} is already assigned to this employee`);
                return;
            }

            const listBinding = oDataModel.bindList(isInitiative ? "/CurrentInitiatives" : "/CurrentEvaluations");
            const now = new Date().toISOString();
            let createdContext: any;

            if (isInitiative) {
                createdContext = listBinding.create({
                    currentInitiativeId: this.generateUuid(),
                    employeeId: this.currentDialogEmployeeId,
                    initiativeId: selected.initiativeId,
                    initiativeName: selected.initiativeName,
                    description: selected.description || "",
                    startDate: selected.startDate,
                    endDate: selected.endDate,
                    utilizationPercent,
                    status: "Active",
                    assignedBy: this.currentSeniorManagerId || "",
                    createdAt: now,
                    lastUpdated: now
                }, true);
            } else {
                createdContext = listBinding.create({
                    currentEvaluationId: this.generateUuid(),
                    employeeId: this.currentDialogEmployeeId,
                    evaluationId: selected.evaluationId,
                    evaluationName: selected.evaluationName,
                    description: selected.description || "",
                    startDate: selected.startDate,
                    endDate: selected.endDate,
                    utilizationPercent,
                    status: "Active",
                    assignedBy: this.currentSeniorManagerId || "",
                    createdAt: now,
                    lastUpdated: now
                }, true);
            }

            await oDataModel.submitBatch(oDataModel.getUpdateGroupId());
            await createdContext?.created?.();

            comboBox?.setSelectedKey("");
            allocationInput?.setValue(100);

            await this.refreshEmployeeAssignments(this.currentDialogEmployeeId);
            await this.openEmployeeDetailsDialog({ employeeId: this.currentDialogEmployeeId });
            MessageToast.show(`${type} assigned successfully`);
        } catch (error) {
            console.error(`❌ Error assigning ${type.toLowerCase()} from senior manager panel:`, error);
            MessageToast.show(`Error assigning ${type.toLowerCase()}`);
        }
    }

    public async onAssignProjectFromPanel(): Promise<void> {
        if (!this.currentDialogEmployeeId) {
            MessageToast.show("Select an employee first");
            return;
        }

        const projectCombo = this.byId("smgrAssignProjectComboBox") as any;
        const roleCombo = this.byId("smgrAssignProjectRoleCombo") as any;
        const allocationInput = this.byId("smgrAssignProjectAllocationInput") as any;

        const projectId = String(projectCombo?.getSelectedKey?.() || "").trim();
        if (!projectId) {
            MessageToast.show("Please select a project to assign");
            return;
        }

        const role = String(roleCombo?.getSelectedKey?.() || "Team Member");
        const allocationValue = Number(allocationInput?.getValue?.() ?? 100);
        const utilizationPercent = Math.max(1, Math.min(100, Math.round(allocationValue || 0)));

        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;

            const projectsBinding = oDataModel.bindList("/Projects");
            projectsBinding.filter([new Filter("projectId", FilterOperator.EQ, projectId)]);
            const projectContexts = await projectsBinding.requestContexts(0, 1);
            if (projectContexts.length === 0) {
                MessageToast.show("Project not found");
                return;
            }

            const project = projectContexts[0].getObject();
            if (String(project.status || "").toLowerCase() === "completed") {
                MessageToast.show("Completed projects cannot be assigned");
                return;
            }

            const duplicateBinding = oDataModel.bindList("/CurrentProjects");
            duplicateBinding.filter([
                new Filter("employeeId", FilterOperator.EQ, this.currentDialogEmployeeId),
                new Filter("projectName", FilterOperator.EQ, project.projectName)
            ]);
            const dupContexts = await duplicateBinding.requestContexts(0, 1);
            if (dupContexts.length > 0) {
                MessageToast.show("This project is already assigned to this employee");
                return;
            }

            const currentProjectsBinding = oDataModel.bindList("/CurrentProjects");
            const createdContext = currentProjectsBinding.create({
                currentProjectId: this.generateUuid(),
                employeeId: this.currentDialogEmployeeId,
                type: "Project",
                projectName: project.projectName,
                role,
                projectManager: project.projectManager || "",
                region: project.region || "",
                technology: project.technology || "",
                startDate: project.startDate,
                endDate: project.endDate,
                utilizationPercent,
                description: project.description || "",
                assignmentStatus: "Assigned",
                assignedBy: this.currentSeniorManagerId || "",
                isEvaluation: false,
                createdAt: new Date().toISOString(),
                lastUpdated: new Date().toISOString()
            }, true);

            await oDataModel.submitBatch(oDataModel.getUpdateGroupId());
            await createdContext?.created?.();

            projectCombo?.setSelectedKey("");
            roleCombo?.setSelectedKey("Team Member");
            allocationInput?.setValue(100);

            await this.refreshEmployeeAssignments(this.currentDialogEmployeeId);
            await this.openEmployeeDetailsDialog({ employeeId: this.currentDialogEmployeeId });
            MessageToast.show("Project assigned successfully");
        } catch (error) {
            console.error("❌ Error assigning project from senior manager panel:", error);
            MessageToast.show("Error assigning project");
        }
    }

    public async onAssignInitiativeFromPanel(): Promise<void> {
        await this.assignMasterWorkFromPanel("Initiative");
    }

    public async onAssignEvaluationFromPanel(): Promise<void> {
        await this.assignMasterWorkFromPanel("Evaluation");
    }

    private async refreshEmployeeAssignments(employeeId: string): Promise<void> {
        const detailsModel = this.getView()?.getModel("employeeDetails") as JSONModel;
        if (!detailsModel) return;

        const assignments = await this.getCurrentProjects(employeeId);
        detailsModel.setProperty("/assignments", assignments);
        detailsModel.setProperty(
            "/currentProjects",
            assignments
                .filter((cp: any) => cp.assignmentStatus !== "Completed")
                .map((cp: any) => ({ ...cp, isUtilizationEditing: false }))
        );
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
                assignmentStatus: obj.assignmentStatus || obj.status || "Assigned",
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
                    assignmentStatus: "Assigned",
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
                    assignmentStatus: "Assigned",
                    _source: "CurrentEvaluations"
                }));

            const completedHistory = await this.getCompletedMasterWorkHistory(employeeId);
            return [...projects, ...initiatives, ...evaluations, ...completedHistory];
        } catch { return []; }
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
        } catch {
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

    // ==================== SKILL MANAGEMENT METHODS ====================

    /**
     * Add a new skill for the employee
     */
    public async onSMgrAddSkill(): Promise<void> {
        if (!this.currentDialogEmployeeId) {
            MessageToast.show("No employee selected");
            return;
        }

        // Create a simple dialog for adding skill
        const dialogContent = new VBox({
            items: [
                new Label({ text: "Skill Name", required: true }),
                new Input({ id: this.createId("smgrNewSkillName"), placeholder: "Enter skill name" }),
                new Label({ text: "Proficiency Level" }).addStyleClass("sapUiSmallMarginTop"),
                new Select({
                    id: this.createId("smgrNewSkillProficiency"),
                    items: [
                        new Item({ key: "Beginner", text: "Beginner" }),
                        new Item({ key: "Intermediate", text: "Intermediate" }),
                        new Item({ key: "Proficient", text: "Proficient" }),
                        new Item({ key: "Advanced", text: "Advanced" }),
                        new Item({ key: "Expert", text: "Expert" })
                    ]
                }),
                new Label({ text: "Category" }).addStyleClass("sapUiSmallMarginTop"),
                new Input({ id: this.createId("smgrNewSkillCategory"), placeholder: "e.g., Programming, Cloud, Database" }),
                new Label({ text: "Years of Experience" }).addStyleClass("sapUiSmallMarginTop"),
                new Input({ id: this.createId("smgrNewSkillYears"), type: "Number", value: "1" })
            ]
        }).addStyleClass("sapUiSmallMargin");

        const dialog = new Dialog({
            title: "Add Skill",
            contentWidth: "400px",
            content: [dialogContent],
            beginButton: new Button({
                text: "Add",
                type: "Emphasized",
                press: async () => {
                    const skillName = (this.byId("smgrNewSkillName") as any)?.getValue();
                    const proficiency = (this.byId("smgrNewSkillProficiency") as any)?.getSelectedKey();
                    const category = (this.byId("smgrNewSkillCategory") as any)?.getValue();
                    const years = (this.byId("smgrNewSkillYears") as any)?.getValue();

                    if (!skillName) {
                        MessageToast.show("Please enter a skill name");
                        return;
                    }

                    try {
                        const oDataModel = this.getOwnerComponent()?.getModel() as any;
                        const listBinding = oDataModel.bindList("/Skills");
                        
                        listBinding.create({
                            employeeId: this.currentDialogEmployeeId,
                            skillName: skillName,
                            proficiencyLevel: proficiency || "Beginner",
                            category: category || "General",
                            yearsExperience: parseFloat(years) || 1
                        });

                        await oDataModel.submitBatch("updateGroup");
                        MessageToast.show("Skill added successfully");
                        dialog.close();
                        
                        // Refresh the employee details
                        const employeeDetailsModel = this.getView()?.getModel("employeeDetails") as JSONModel;
                        const skills = await this.getEmployeeSkills(this.currentDialogEmployeeId);
                        employeeDetailsModel.setProperty("/skills", skills);
                        (this.byId("smgrDialogTotalSkills") as any)?.setNumber(skills.length);
                    } catch (error) {
                        console.error("Error adding skill:", error);
                        MessageToast.show("Error adding skill");
                    }
                }
            }),
            endButton: new Button({
                text: "Cancel",
                press: () => dialog.close()
            }),
            afterClose: () => dialog.destroy()
        });

        dialog.open();
    }

    /**
     * Edit an existing skill
     */
    public onSMgrEditSkill(event: Event): void {
        const source = event.getSource() as any;
        const bindingContext = source.getBindingContext("employeeDetails");
        if (!bindingContext) {
            MessageToast.show("Unable to get skill details");
            return;
        }

        const skill = bindingContext.getObject();
        const skillPath = bindingContext.getPath();

        const editDialogContent = new VBox({
            items: [
                new Label({ text: "Skill Name", required: true }),
                new Input({ id: this.createId("smgrEditSkillName"), value: skill.skillName }),
                new Label({ text: "Proficiency Level" }).addStyleClass("sapUiSmallMarginTop"),
                new Select({
                    id: this.createId("smgrEditSkillProficiency"),
                    selectedKey: skill.proficiencyLevel,
                    items: [
                        new Item({ key: "Beginner", text: "Beginner" }),
                        new Item({ key: "Intermediate", text: "Intermediate" }),
                        new Item({ key: "Proficient", text: "Proficient" }),
                        new Item({ key: "Advanced", text: "Advanced" }),
                        new Item({ key: "Expert", text: "Expert" })
                    ]
                }),
                new Label({ text: "Category" }).addStyleClass("sapUiSmallMarginTop"),
                new Input({ id: this.createId("smgrEditSkillCategory"), value: skill.category }),
                new Label({ text: "Years of Experience" }).addStyleClass("sapUiSmallMarginTop"),
                new Input({ id: this.createId("smgrEditSkillYears"), type: "Number", value: String(skill.yearsExperience || 1) })
            ]
        }).addStyleClass("sapUiSmallMargin");

        const dialog = new Dialog({
            title: "Edit Skill",
            contentWidth: "400px",
            content: [editDialogContent],
            beginButton: new Button({
                text: "Save",
                type: "Emphasized",
                press: async () => {
                    const skillName = (this.byId("smgrEditSkillName") as any)?.getValue();
                    const proficiency = (this.byId("smgrEditSkillProficiency") as any)?.getSelectedKey();
                    const category = (this.byId("smgrEditSkillCategory") as any)?.getValue();
                    const years = (this.byId("smgrEditSkillYears") as any)?.getValue();

                    if (!skillName) {
                        MessageToast.show("Please enter a skill name");
                        return;
                    }

                    try {
                        const oDataModel = this.getOwnerComponent()?.getModel() as any;
                        const skillBinding = oDataModel.bindContext(`/Skills(ID=${skill.ID},IsActiveEntity=true)`);
                        await skillBinding.requestObject();
                        const skillContext = skillBinding.getBoundContext();
                        
                        skillContext.setProperty("skillName", skillName);
                        skillContext.setProperty("proficiencyLevel", proficiency);
                        skillContext.setProperty("category", category);
                        skillContext.setProperty("yearsExperience", parseFloat(years) || 1);

                        await oDataModel.submitBatch("updateGroup");
                        MessageToast.show("Skill updated successfully");
                        dialog.close();
                        
                        // Refresh the employee details
                        const employeeDetailsModel = this.getView()?.getModel("employeeDetails") as JSONModel;
                        const skills = await this.getEmployeeSkills(this.currentDialogEmployeeId);
                        employeeDetailsModel.setProperty("/skills", skills);
                    } catch (error) {
                        console.error("Error updating skill:", error);
                        MessageToast.show("Error updating skill");
                    }
                }
            }),
            endButton: new Button({
                text: "Cancel",
                press: () => dialog.close()
            }),
            afterClose: () => dialog.destroy()
        });

        dialog.open();
    }

    /**
     * Delete a skill
     */
    public onSMgrDeleteSkill(event: Event): void {
        const source = event.getSource() as any;
        const bindingContext = source.getBindingContext("employeeDetails");
        if (!bindingContext) {
            MessageToast.show("Unable to get skill details");
            return;
        }

        const skill = bindingContext.getObject();

        MessageBox.confirm(`Are you sure you want to delete the skill "${skill.skillName}"?`, {
            title: "Confirm Delete",
            onClose: async (action: string) => {
                if (action === "OK") {
                    try {
                        const oDataModel = this.getOwnerComponent()?.getModel() as any;
                        const skillBinding = oDataModel.bindContext(`/Skills(ID=${skill.ID},IsActiveEntity=true)`);
                        await skillBinding.requestObject();
                        const skillContext = skillBinding.getBoundContext();
                        await skillContext.delete();

                        MessageToast.show("Skill deleted successfully");
                        
                        // Refresh the employee details
                        const employeeDetailsModel = this.getView()?.getModel("employeeDetails") as JSONModel;
                        const skills = await this.getEmployeeSkills(this.currentDialogEmployeeId);
                        employeeDetailsModel.setProperty("/skills", skills);
                        (this.byId("smgrDialogTotalSkills") as any)?.setNumber(skills.length);
                    } catch (error) {
                        console.error("Error deleting skill:", error);
                        MessageToast.show("Error deleting skill");
                    }
                }
            }
        });
    }

    // ==================== CERTIFICATION MANAGEMENT METHODS ====================

    /**
     * Add a new certification for the employee
     */
    public async onSMgrAddCertification(): Promise<void> {
        if (!this.currentDialogEmployeeId) {
            MessageToast.show("No employee selected");
            return;
        }

        const certDialogContent = new VBox({
            items: [
                new Label({ text: "Certification Name", required: true }),
                new Input({ id: this.createId("smgrNewCertName"), placeholder: "Enter certification name" }),
                new Label({ text: "Certification Code" }).addStyleClass("sapUiSmallMarginTop"),
                new Input({ id: this.createId("smgrNewCertCode"), placeholder: "e.g., AWS-SAA-C03" }),
                new Label({ text: "Date of Completion" }).addStyleClass("sapUiSmallMarginTop"),
                new DatePicker({ id: this.createId("smgrNewCertDate"), displayFormat: "yyyy-MM-dd", valueFormat: "yyyy-MM-dd" }),
                new Label({ text: "Level" }).addStyleClass("sapUiSmallMarginTop"),
                new Select({
                    id: this.createId("smgrNewCertLevel"),
                    items: [
                        new Item({ key: "Associate", text: "Associate" }),
                        new Item({ key: "Professional", text: "Professional" }),
                        new Item({ key: "Expert", text: "Expert" }),
                        new Item({ key: "Specialty", text: "Specialty" })
                    ]
                }),
                new Label({ text: "Description" }).addStyleClass("sapUiSmallMarginTop"),
                new TextArea({ id: this.createId("smgrNewCertDesc"), rows: 3, width: "100%" })
            ]
        }).addStyleClass("sapUiSmallMargin");

        const dialog = new Dialog({
            title: "Add Certification",
            contentWidth: "450px",
            content: [certDialogContent],
            beginButton: new Button({
                text: "Add",
                type: "Emphasized",
                press: async () => {
                    const name = (this.byId("smgrNewCertName") as any)?.getValue();
                    const code = (this.byId("smgrNewCertCode") as any)?.getValue();
                    const date = (this.byId("smgrNewCertDate") as any)?.getValue();
                    const level = (this.byId("smgrNewCertLevel") as any)?.getSelectedKey();
                    const description = (this.byId("smgrNewCertDesc") as any)?.getValue();

                    if (!name) {
                        MessageToast.show("Please enter a certification name");
                        return;
                    }

                    try {
                        const oDataModel = this.getOwnerComponent()?.getModel() as any;
                        const listBinding = oDataModel.bindList("/Certifications");
                        
                        listBinding.create({
                            employeeId: this.currentDialogEmployeeId,
                            name: name,
                            code: code || "",
                            dateOfCompletion: date || new Date().toISOString().split('T')[0],
                            level: level || "Associate",
                            description: description || ""
                        });

                        await oDataModel.submitBatch("updateGroup");
                        MessageToast.show("Certification added successfully");
                        dialog.close();
                        
                        // Refresh the employee details
                        const employeeDetailsModel = this.getView()?.getModel("employeeDetails") as JSONModel;
                        const certifications = await this.getCertifications(this.currentDialogEmployeeId);
                        employeeDetailsModel.setProperty("/certifications", certifications);
                        (this.byId("smgrDialogTotalCertifications") as any)?.setNumber(certifications.length);
                    } catch (error) {
                        console.error("Error adding certification:", error);
                        MessageToast.show("Error adding certification");
                    }
                }
            }),
            endButton: new Button({
                text: "Cancel",
                press: () => dialog.close()
            }),
            afterClose: () => dialog.destroy()
        });

        dialog.open();
    }

    /**
     * Edit an existing certification
     */
    public onSMgrEditCertification(event: Event): void {
        const source = event.getSource() as any;
        const bindingContext = source.getBindingContext("employeeDetails");
        if (!bindingContext) {
            MessageToast.show("Unable to get certification details");
            return;
        }

        const cert = bindingContext.getObject();

        const editCertDialogContent = new VBox({
            items: [
                new Label({ text: "Certification Name", required: true }),
                new Input({ id: this.createId("smgrEditCertName"), value: cert.name }),
                new Label({ text: "Certification Code" }).addStyleClass("sapUiSmallMarginTop"),
                new Input({ id: this.createId("smgrEditCertCode"), value: cert.code }),
                new Label({ text: "Date of Completion" }).addStyleClass("sapUiSmallMarginTop"),
                new DatePicker({ id: this.createId("smgrEditCertDate"), value: cert.dateOfCompletion, displayFormat: "yyyy-MM-dd", valueFormat: "yyyy-MM-dd" }),
                new Label({ text: "Level" }).addStyleClass("sapUiSmallMarginTop"),
                new Select({
                    id: this.createId("smgrEditCertLevel"),
                    selectedKey: cert.level,
                    items: [
                        new Item({ key: "Associate", text: "Associate" }),
                        new Item({ key: "Professional", text: "Professional" }),
                        new Item({ key: "Expert", text: "Expert" }),
                        new Item({ key: "Specialty", text: "Specialty" })
                    ]
                }),
                new Label({ text: "Description" }).addStyleClass("sapUiSmallMarginTop"),
                new TextArea({ id: this.createId("smgrEditCertDesc"), value: cert.description, rows: 3, width: "100%" })
            ]
        }).addStyleClass("sapUiSmallMargin");

        const dialog = new Dialog({
            title: "Edit Certification",
            contentWidth: "450px",
            content: [editCertDialogContent],
            beginButton: new Button({
                text: "Save",
                type: "Emphasized",
                press: async () => {
                    const name = (this.byId("smgrEditCertName") as any)?.getValue();
                    const code = (this.byId("smgrEditCertCode") as any)?.getValue();
                    const date = (this.byId("smgrEditCertDate") as any)?.getValue();
                    const level = (this.byId("smgrEditCertLevel") as any)?.getSelectedKey();
                    const description = (this.byId("smgrEditCertDesc") as any)?.getValue();

                    if (!name) {
                        MessageToast.show("Please enter a certification name");
                        return;
                    }

                    try {
                        const oDataModel = this.getOwnerComponent()?.getModel() as any;
                        const certBinding = oDataModel.bindContext(`/Certifications(ID=${cert.ID},IsActiveEntity=true)`);
                        await certBinding.requestObject();
                        const certContext = certBinding.getBoundContext();
                        
                        certContext.setProperty("name", name);
                        certContext.setProperty("code", code);
                        certContext.setProperty("dateOfCompletion", date);
                        certContext.setProperty("level", level);
                        certContext.setProperty("description", description);

                        await oDataModel.submitBatch("updateGroup");
                        MessageToast.show("Certification updated successfully");
                        dialog.close();
                        
                        // Refresh the employee details
                        const employeeDetailsModel = this.getView()?.getModel("employeeDetails") as JSONModel;
                        const certifications = await this.getCertifications(this.currentDialogEmployeeId);
                        employeeDetailsModel.setProperty("/certifications", certifications);
                    } catch (error) {
                        console.error("Error updating certification:", error);
                        MessageToast.show("Error updating certification");
                    }
                }
            }),
            endButton: new Button({
                text: "Cancel",
                press: () => dialog.close()
            }),
            afterClose: () => dialog.destroy()
        });

        dialog.open();
    }

    /**
     * Delete a certification
     */
    public onSMgrDeleteCertification(event: Event): void {
        const source = event.getSource() as any;
        const bindingContext = source.getBindingContext("employeeDetails");
        if (!bindingContext) {
            MessageToast.show("Unable to get certification details");
            return;
        }

        const cert = bindingContext.getObject();

        MessageBox.confirm(`Are you sure you want to delete the certification "${cert.name}"?`, {
            title: "Confirm Delete",
            onClose: async (action: string) => {
                if (action === "OK") {
                    try {
                        const oDataModel = this.getOwnerComponent()?.getModel() as any;
                        const certBinding = oDataModel.bindContext(`/Certifications(ID=${cert.ID},IsActiveEntity=true)`);
                        await certBinding.requestObject();
                        const certContext = certBinding.getBoundContext();
                        await certContext.delete();

                        MessageToast.show("Certification deleted successfully");
                        
                        // Refresh the employee details
                        const employeeDetailsModel = this.getView()?.getModel("employeeDetails") as JSONModel;
                        const certifications = await this.getCertifications(this.currentDialogEmployeeId);
                        employeeDetailsModel.setProperty("/certifications", certifications);
                        (this.byId("smgrDialogTotalCertifications") as any)?.setNumber(certifications.length);
                    } catch (error) {
                        console.error("Error deleting certification:", error);
                        MessageToast.show("Error deleting certification");
                    }
                }
            }
        });
    }

    // ==================== UTILIZATION MANAGEMENT ====================

    /**
     * Edit utilization - toggle editing mode
     */
    public onSMgrEditUtilization(event: Event): void {
        const source = event.getSource() as any;
        const bindingContext = source.getBindingContext("employeeDetails");
        if (!bindingContext) {
            return;
        }
        bindingContext.setProperty("isUtilizationEditing", true);
    }

    /**
     * Save utilization changes
     */
    public async onSMgrSaveUtilization(event: Event): Promise<void> {
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

            await this.refreshSMgrCurrentDialogData();
            MessageToast.show("Utilization updated successfully");
        } catch (error) {
            console.error("❌ Error updating utilization:", error);
            MessageToast.show("Error updating utilization");
        }
    }

    /**
     * Mark current project/work as completed
     */
    public async onSMgrCompleteCurrentProject(event: Event): Promise<void> {
        const source = event.getSource() as any;
        const bindingContext = source.getBindingContext("employeeDetails");
        const row = bindingContext?.getObject();

        if (!row || !this.currentDialogEmployeeId) {
            MessageToast.show("Unable to complete assignment");
            return;
        }

        MessageBox.confirm(`Mark "${row.projectName}" as completed?`, {
            title: "Confirm Completion",
            onClose: async (action: string) => {
                if (action === "OK") {
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

                        contexts[0].setProperty("assignmentStatus", "Completed");
                        contexts[0].setProperty("status", "Completed");
                        contexts[0].setProperty("lastUpdated", new Date().toISOString());
                        await oDataModel.submitBatch(oDataModel.getUpdateGroupId());

                        await this.refreshSMgrCurrentDialogData();
                        MessageToast.show("Assignment marked as completed");
                    } catch (error) {
                        console.error("❌ Error completing assignment:", error);
                        MessageToast.show("Error completing assignment");
                    }
                }
            }
        });
    }

    /**
     * Assign project to employee from Senior Manager dialog
     */
    public async onSMgrAssignProject(): Promise<void> {
        const comboBox = this.byId("smgrAssignProjectComboBox") as any;
        const roleComboBox = this.byId("smgrAssignProjectRoleCombo") as any;
        const allocationInput = this.byId("smgrAssignProjectAllocationInput") as any;
        
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

        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            
            // Get project details from Projects master data
            const projectsBinding = oDataModel.bindList("/Projects");
            projectsBinding.filter([new Filter("projectId", FilterOperator.EQ, selectedKey)]);
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

            // Create assignment in CurrentProjects
            const currentProjectsBinding = oDataModel.bindList("/CurrentProjects");
            currentProjectsBinding.create({
                employeeId: this.currentDialogEmployeeId,
                type: "Project",
                projectName: project.projectName,
                role: selectedRole,
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
            });
            
            await oDataModel.submitBatch(oDataModel.getUpdateGroupId());
            await new Promise(resolve => setTimeout(resolve, 500));
            
            MessageToast.show(`Project "${project.projectName}" assigned successfully.`);
            
            // Clear the selection
            comboBox.setSelectedKey("");
            roleComboBox?.setSelectedKey("Team Member");
            allocationInput?.setValue(100);
            
            // Refresh the dialog data
            await this.refreshSMgrCurrentDialogData();
        } catch (error) {
            console.error("❌ Error assigning project:", error);
            MessageToast.show("Error assigning project to employee");
        }
    }

    /**
     * Refresh current dialog data after changes
     */
    private async refreshSMgrCurrentDialogData(): Promise<void> {
        if (!this.currentDialogEmployeeId) return;

        try {
            const employeeDetailsModel = this.getView()?.getModel("employeeDetails") as JSONModel;
            if (!employeeDetailsModel) return;

            // Refresh current projects/work
            const currentProjects = await this.getCurrentProjects(this.currentDialogEmployeeId);
            const activeCurrentProjects = currentProjects
                .filter((cp: any) => cp.assignmentStatus !== "Completed")
                .map((cp: any) => ({ ...cp, isUtilizationEditing: false }));
            employeeDetailsModel.setProperty("/currentProjects", activeCurrentProjects);

            // Refresh assignments (all current work including completed)
            employeeDetailsModel.setProperty("/assignments", currentProjects);
        } catch (error) {
            console.error("Error refreshing dialog data:", error);
        }
    }
}
