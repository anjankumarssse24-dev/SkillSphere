import Controller from "sap/ui/core/mvc/Controller";
import Router from "sap/ui/core/routing/Router";
import MessageToast from "sap/m/MessageToast";
import JSONModel from "sap/ui/model/json/JSONModel";
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";
import Table from "sap/m/Table";
import Column from "sap/m/Column";
import ColumnListItem from "sap/m/ColumnListItem";
import Text from "sap/m/Text";
import VBox from "sap/m/VBox";
import HBox from "sap/m/HBox";
import ListBinding from "sap/ui/model/ListBinding";
import OverflowToolbar from "sap/m/OverflowToolbar";
import ObjectStatus from "sap/m/ObjectStatus";
import Dialog from "sap/m/Dialog";

/**
 * @namespace skillsphere.controller
 */
export default class SeniorManagerWorkOverview extends Controller {

    private currentSeniorManagerId: string | null = null;
    private cachedWorkData: any = null;
    private cachedColumnConfig: any = null;
    private readonly maxColumnsPerSection: number = 4;
    private isLoadingWorkOverview: boolean = false;
    private workOverviewLoadSeq: number = 0;
    
    // AI Assistant Properties
    private seniorManagerId: string = "";
    private currentChatSeniorManagerId: string | null = null;
    private aiInitialized: boolean = false;
    private typingIndicator: any = null;
    private readonly debugLogStorageKey: string = "smWorkOverviewDebugLog";

    public onInit(): void {
        this.getRouter().getRoute("SeniorManagerWorkOverview")?.attachPatternMatched(this.onRouteMatched, this);
        this.logDebug("onInit", "Work Overview controller initialized");
    }

    public onExit(): void {
        this.getRouter().getRoute("SeniorManagerWorkOverview")?.detachPatternMatched(this.onRouteMatched, this);
    }

    private getRouter(): Router {
        return (this.getOwnerComponent() as any).getRouter();
    }

    public onNavBack(): void {
        if (!this.currentSeniorManagerId) {
            this.getRouter().navTo("Landing");
            return;
        }

        this.getRouter().navTo("SeniorManagerDashboard", {
            seniorManagerId: this.currentSeniorManagerId
        });
    }

    public onLogout(): void {
        this.logDebug("onLogout", "Logout triggered from Work Overview");
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
        this.cachedWorkData = null;
        this.cachedColumnConfig = null;
        this.isLoadingWorkOverview = false;
        this.getRouter().navTo("Landing");
        MessageToast.show("You have been logged out");
    }

    private async onRouteMatched(event: any): Promise<void> {
        const args: any = event.getParameter("arguments");
        const seniorManagerId = args?.seniorManagerId;
        const currentUserModel = this.getOwnerComponent()?.getModel("currentUser") as JSONModel;
        const currentUser = currentUserModel?.getData();

        this.logDebug("onRouteMatched", {
            routeSeniorManagerId: seniorManagerId || null,
            currentUserId: currentUser?.id || null,
            isLoggedIn: !!currentUser?.isLoggedIn,
            previousControllerSeniorManagerId: this.currentSeniorManagerId
        });

        if (!currentUser?.isLoggedIn && !seniorManagerId) {
            MessageToast.show("Please login to access the work overview");
            this.getRouter().navTo("Landing");
            return;
        }

        const resolvedSeniorManagerId = seniorManagerId || currentUser?.id;

        // If a different user logs in, clear cached view data to avoid stale state issues.
        if (this.currentSeniorManagerId && resolvedSeniorManagerId && this.currentSeniorManagerId !== resolvedSeniorManagerId) {
            this.cachedWorkData = null;
            this.cachedColumnConfig = null;
        }

        this.currentSeniorManagerId = resolvedSeniorManagerId;

        const loadSeq = ++this.workOverviewLoadSeq;
        this.logDebug("onRouteMatched", `Starting load sequence ${loadSeq}`);
        await this.loadWorkOverview(loadSeq);
    }

    private async loadWorkOverview(loadSeq: number): Promise<void> {
        this.isLoadingWorkOverview = true;
        this.logDebug("loadWorkOverview:start", {
            loadSeq,
            activeLoadSeq: this.workOverviewLoadSeq,
            hasCachedData: !!this.cachedWorkData,
            hasCachedColumnConfig: !!this.cachedColumnConfig
        });
        try {
            const page = this.getView()?.byId("seniorManagerWorkOverviewPage") as any;
            if (page?.setBusy) {
                page.setBusy(true);
            }

            // Reuse cached dataset on revisit to avoid repeated network and re-render stalls.
            if (this.cachedWorkData && this.cachedColumnConfig) {
                this.logDebug("loadWorkOverview:cache", "Using cached work overview data");
                this.getView()?.setModel(new JSONModel({
                    employees: this.cachedWorkData,
                    columnConfig: this.cachedColumnConfig
                }), "workOverview");

                this.rebuildWorkOverviewColumns(
                    this.cachedColumnConfig.projects,
                    this.cachedColumnConfig.evaluations,
                    this.cachedColumnConfig.initiatives
                );
                return;
            }

            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // STEP 1: Fetch ONLY T3/T4 profiles using OData filter
            console.log("📊 Step 1: Fetching T3/T4 profiles only...");
            this.logDebug("loadWorkOverview:step1", "Fetching T3/T4 profiles");
            const profilesBinding = oDataModel.bindList("/Profiles", undefined, [], [
                new Filter({
                    filters: [
                        new Filter("tLevel", FilterOperator.EQ, "T3"),
                        new Filter("tLevel", FilterOperator.EQ, "T4")
                    ],
                    and: false
                })
            ]);
            const profileContexts = await this.requestContextsWithTimeout(profilesBinding, 0, 100);
            if (loadSeq !== this.workOverviewLoadSeq) {
                return;
            }
            const profiles = profileContexts.map((ctx: any) => ctx.getObject());
            console.log(`✅ Fetched ${profiles.length} T3/T4 profiles`);

            if (profiles.length === 0) {
                this.logDebug("loadWorkOverview:step1", "No T3/T4 employees found");
                this.getView()?.setModel(new JSONModel({ employees: [], columnConfig: {} }), "workOverview");
                if (page?.setBusy) page.setBusy(false);
                MessageToast.show("No T3/T4 employees found");
                return;
            }

            // STEP 2: Get employee IDs for these profiles
            const seniorEmployeeIds = profiles.map((p: any) => p.employeeId);
            console.log(`📊 Step 2: Found ${seniorEmployeeIds.length} T3/T4 employee IDs to fetch details for`);

            // STEP 3: Fetch employee details for ONLY these IDs
            const employeeFilters = seniorEmployeeIds.map((id: string) =>
                new Filter("employeeId", FilterOperator.EQ, id)
            );
            const employeesBinding = oDataModel.bindList("/Employees", undefined, [], [
                new Filter({ filters: employeeFilters, and: false })
            ]);
            const employeeContexts = await this.requestContextsWithTimeout(employeesBinding, 0, 100);
            if (loadSeq !== this.workOverviewLoadSeq) {
                return;
            }
            const employees = employeeContexts
                .map((ctx: any) => ctx.getObject())
                .filter((emp: any) => emp.employeeId && !String(emp.employeeId).startsWith("MGR"));
            console.log(`✅ Fetched ${employees.length} employee details`);

            // Create profile map
            const profileMap = new Map(profiles.map((p: any) => [p.employeeId, p]));
            const seniorEmployeeIdSet = new Set(employees.map((emp: any) => emp.employeeId));

            // STEP 4: Fetch CurrentProjects for ONLY these employee IDs
            console.log("📊 Step 3: Fetching current work items...");
            const currentProjectsBinding = oDataModel.bindList("/CurrentProjects");
            const cpContexts = await this.requestContextsWithTimeout(currentProjectsBinding, 0, 2000);
            if (loadSeq !== this.workOverviewLoadSeq) {
                return;
            }
            const currentProjects = cpContexts
                .map((ctx: any) => ctx.getObject())
                .filter((cp: any) => seniorEmployeeIdSet.has(cp.employeeId));
            console.log(`✅ Fetched ${currentProjects.length} current projects`);

            // STEP 5: Fetch Projects for evaluations (only for these employees)
            const projectsBinding = oDataModel.bindList("/Projects");
            const projectContexts = await this.requestContextsWithTimeout(projectsBinding, 0, 2000);
            if (loadSeq !== this.workOverviewLoadSeq) {
                return;
            }
            const projects = projectContexts
                .map((ctx: any) => ctx.getObject())
                .filter((proj: any) => seniorEmployeeIdSet.has(proj.employeeId));
            console.log(`✅ Fetched ${projects.length} projects`);

            // STEP 6: Build work map - only active items
            const workByEmployee = new Map<string, any[]>();

            // Process current projects
            currentProjects.forEach((cp: any) => {
                if (!cp.startDate || !cp.endDate) return;
                const start = new Date(cp.startDate);
                const end = new Date(cp.endDate);
                start.setHours(0, 0, 0, 0);
                end.setHours(0, 0, 0, 0);

                if (today >= start && today <= end) {
                    if (!workByEmployee.has(cp.employeeId)) {
                        workByEmployee.set(cp.employeeId, []);
                    }
                    workByEmployee.get(cp.employeeId)?.push(cp);
                }
            });

            // Process evaluations
            projects.forEach((proj: any) => {
                if (!proj.employeeId || !proj.evaluationStartDate || !proj.evaluationEndDate) return;
                const start = new Date(proj.evaluationStartDate);
                const end = new Date(proj.evaluationEndDate);
                start.setHours(0, 0, 0, 0);
                end.setHours(0, 0, 0, 0);

                if (today >= start && today <= end) {
                    if (!workByEmployee.has(proj.employeeId)) {
                        workByEmployee.set(proj.employeeId, []);
                    }
                    workByEmployee.get(proj.employeeId)?.push({
                        type: "Evaluation",
                        projectName: proj.projectName,
                        technology: proj.technology,
                        utilizationPercent: proj.utilizationPercent || 0,
                        startDate: proj.evaluationStartDate,
                        endDate: proj.evaluationEndDate
                    });
                }
            });

            // STEP 7: Count max items per category
            let maxProjects = 0, maxEvaluations = 0, maxInitiatives = 0;

            const employeeWorkData = employees.map((emp: any) => {
                const profile = profileMap.get(emp.employeeId);
                const work = workByEmployee.get(emp.employeeId) || [];
                const projectList = work.filter((item: any) => item.type === "Project");
                const evalList = work.filter((item: any) => item.type === "Evaluation");
                const initList = work.filter((item: any) => item.type === "Initiative");

                maxProjects = Math.max(maxProjects, projectList.length);
                maxEvaluations = Math.max(maxEvaluations, evalList.length);
                maxInitiatives = Math.max(maxInitiatives, initList.length);

                return { emp, profile, projects: projectList, evaluations: evalList, initiatives: initList };
            });

            maxProjects = Math.max(1, Math.min(this.maxColumnsPerSection, maxProjects));
            maxEvaluations = Math.max(1, Math.min(this.maxColumnsPerSection, maxEvaluations));
            maxInitiatives = Math.max(1, Math.min(this.maxColumnsPerSection, maxInitiatives));

            // STEP 8: Build employee overview data
            const employeesOverview = employeeWorkData.map(({ emp, profile, projects: projList, evaluations: evalList, initiatives: initList }: any) => {
                const rowData: any = {
                    name: emp.name,
                    employeeId: emp.employeeId,
                    tLevel: profile?.tLevel || "-",
                    specialization: emp.specialization || profile?.specialization || "-",
                    projects: [],
                    evaluations: [],
                    initiatives: []
                };

                for (let i = 0; i < maxProjects; i++) {
                    rowData.projects.push({
                        name: projList[i]?.projectName || "-",
                        tech: projList[i]?.technology || "",
                        util: projList[i] ? `${projList[i].utilizationPercent}%` : ""
                    });
                }

                for (let i = 0; i < maxEvaluations; i++) {
                    rowData.evaluations.push({
                        name: evalList[i]?.projectName ? `${evalList[i]?.projectName} (Eval)` : "-",
                        tech: evalList[i]?.technology || "",
                        util: evalList[i] ? `${evalList[i].utilizationPercent}%` : ""
                    });
                }

                for (let i = 0; i < maxInitiatives; i++) {
                    rowData.initiatives.push({
                        name: initList[i]?.projectName || "-",
                        tech: initList[i]?.technology || "",
                        util: initList[i] ? `${initList[i].utilizationPercent}%` : ""
                    });
                }

                return rowData;
            });

            this.cachedWorkData = employeesOverview;
            this.cachedColumnConfig = { projects: maxProjects, evaluations: maxEvaluations, initiatives: maxInitiatives };

            this.getView()?.setModel(new JSONModel({
                employees: employeesOverview,
                columnConfig: this.cachedColumnConfig
            }), "workOverview");

            this.rebuildWorkOverviewColumns(maxProjects, maxEvaluations, maxInitiatives);
            this.logDebug("loadWorkOverview:success", {
                employees: employeesOverview.length,
                maxProjects,
                maxEvaluations,
                maxInitiatives
            });

            console.log(`✅ Work overview loaded: ${employeesOverview.length} T3/T4 employees`);
            if (page?.setBusy) page.setBusy(false);

        } catch (error) {
            console.error("❌ Error loading work overview:", error);
            this.logDebug("loadWorkOverview:error", String(error));
            MessageToast.show("Error loading work overview. Please try again.");
            const page = this.getView()?.byId("seniorManagerWorkOverviewPage") as any;
            if (page?.setBusy) page.setBusy(false);
        } finally {
            this.isLoadingWorkOverview = false;
            const page = this.getView()?.byId("seniorManagerWorkOverviewPage") as any;
            if (page?.setBusy) {
                page.setBusy(false);
            }
            this.logDebug("loadWorkOverview:end", { loadSeq, activeLoadSeq: this.workOverviewLoadSeq });
        }
    }

    private async requestContextsWithTimeout(binding: any, start: number, length: number, timeoutMs: number = 12000): Promise<any[]> {
        return await Promise.race([
            binding.requestContexts(start, length),
            new Promise<any[]>((_, reject) => {
                setTimeout(() => reject(new Error(`Request timeout after ${timeoutMs}ms`)), timeoutMs);
            })
        ]);
    }

    private rebuildWorkOverviewColumns(maxProjects: number, maxEvaluations: number, maxInitiatives: number): void {
        const table = this.byId("workOverviewTable") as Table;
        if (!table) {
            this.logDebug("rebuildWorkOverviewColumns", "Table not found");
            return;
        }

        // Unbind existing items to clear templates
        if (table.isBound("items")) {
            table.unbindItems();
        }

        // Remove dynamic columns (keep only first 3 static columns)
        let safetyCounter = 0;
        while (table.getColumns().length > 3) {
            const columnsNow = table.getColumns();
            table.removeColumn(columnsNow[columnsNow.length - 1]);
            safetyCounter++;

            // Safety break to avoid UI freeze in case table metadata gets inconsistent.
            if (safetyCounter > 1000) {
                this.logDebug("rebuildWorkOverviewColumns", "Safety break triggered while removing dynamic columns");
                break;
            }
        }
        this.logDebug("rebuildWorkOverviewColumns", {
            remainingStaticColumns: table.getColumns().length,
            targetProjects: maxProjects,
            targetEvaluations: maxEvaluations,
            targetInitiatives: maxInitiatives
        });

        // Create column headers only - UI5 will manage cell creation
        for (let i = 0; i < maxProjects; i++) {
            table.addColumn(new Column({
                width: "320px",
                hAlign: "Left",
                header: new Text({ text: `Project ${i + 1}` })
            }));
        }

        for (let i = 0; i < maxEvaluations; i++) {
            table.addColumn(new Column({
                width: "320px",
                hAlign: "Left",
                header: new Text({ text: maxEvaluations > 1 ? `Evaluation ${i + 1}` : "Evaluation" })
            }));
        }

        for (let i = 0; i < maxInitiatives; i++) {
            table.addColumn(new Column({
                width: "320px",
                hAlign: "Left",
                header: new Text({ text: maxInitiatives > 1 ? `Initiative ${i + 1}` : "Initiative" })
            }));
        }

        // Build cell templates efficiently
        const staticCellTemplates: any[] = [
            new VBox({
                items: [
                    new Text({ text: "{workOverview>name}", wrapping: false }).addStyleClass("sapUiTinyMarginBottom"),
                    new Text({ text: "{workOverview>employeeId}" }).addStyleClass("sapThemeTextSubtle-asColor")
                ]
            }),
            new ObjectStatus({ text: "{workOverview>tLevel}", state: "Information" }),
            new Text({ text: "{workOverview>specialization}", wrapping: true, maxLines: 2 })
        ];

        // Dynamic column templates - reuse same structure for all
        const dynamicCellTemplates: any[] = [];

        for (let i = 0; i < maxProjects; i++) {
            dynamicCellTemplates.push(
                new VBox({
                    items: [
                        new Text({ text: `{workOverview>projects/${i}/name}`, wrapping: false, maxLines: 1 }),
                        new HBox({
                            items: [
                                new ObjectStatus({ text: `{workOverview>projects/${i}/tech}`, state: "Success" }).addStyleClass("sapUiTinyMarginEnd"),
                                new ObjectStatus({ text: `{workOverview>projects/${i}/util}`, state: "Success" })
                            ]
                        }).addStyleClass("sapUiTinyMarginTop")
                    ]
                })
            );
        }

        for (let i = 0; i < maxEvaluations; i++) {
            dynamicCellTemplates.push(
                new VBox({
                    items: [
                        new Text({ text: `{workOverview>evaluations/${i}/name}`, wrapping: false, maxLines: 1 }),
                        new HBox({
                            items: [
                                new ObjectStatus({ text: `{workOverview>evaluations/${i}/tech}`, state: "Warning" }).addStyleClass("sapUiTinyMarginEnd"),
                                new ObjectStatus({ text: `{workOverview>evaluations/${i}/util}`, state: "Warning" })
                            ]
                        }).addStyleClass("sapUiTinyMarginTop")
                    ]
                })
            );
        }

        for (let i = 0; i < maxInitiatives; i++) {
            dynamicCellTemplates.push(
                new VBox({
                    items: [
                        new Text({ text: `{workOverview>initiatives/${i}/name}`, wrapping: false, maxLines: 1 }),
                        new HBox({
                            items: [
                                new ObjectStatus({ text: `{workOverview>initiatives/${i}/tech}`, state: "Information" }).addStyleClass("sapUiTinyMarginEnd"),
                                new ObjectStatus({ text: `{workOverview>initiatives/${i}/util}`, state: "Information" })
                            ]
                        }).addStyleClass("sapUiTinyMarginTop")
                    ]
                })
            );
        }

        const allCellTemplates = [...staticCellTemplates, ...dynamicCellTemplates];

        // Calculate and set table width only once
        const staticWidth = 250 + 120 + 260;
        const dynamicWidth = (maxProjects + maxEvaluations + maxInitiatives) * 320;
        const totalWidth = Math.max(1200, staticWidth + dynamicWidth);
        table.setWidth(`${totalWidth}px`);

        // Bind items with all templates
        table.bindItems({
            path: "workOverview>/employees",
            template: new ColumnListItem({
                cells: allCellTemplates
            })
        });
    }

    private logDebug(stage: string, data?: any): void {
        const timestamp = new Date().toISOString();
        const payload = typeof data === "string" ? data : JSON.stringify(data ?? {});
        const line = `[${timestamp}] ${stage}: ${payload}`;

        try {
            console.log(`[SM-WORK-OVERVIEW] ${line}`);
        } catch {
            // Ignore console failures.
        }

        try {
            const win = window as any;
            const existingRaw = sessionStorage.getItem(this.debugLogStorageKey);
            const existing = existingRaw ? JSON.parse(existingRaw) : [];
            const next = [...existing, line].slice(-250);
            sessionStorage.setItem(this.debugLogStorageKey, JSON.stringify(next));
            win.__smWorkOverviewDebugLog = next;
        } catch {
            // Ignore storage failures.
        }
    }

    public onSearchWorkOverview(event: any): void {
        const query = event.getParameter("query") || event.getParameter("newValue") || "";
        this.applyWorkOverviewFilters(query);
    }

    public onFilterWorkOverview(): void {
        const table = this.byId("workOverviewTable") as Table;
        const toolbar = table?.getHeaderToolbar() as OverflowToolbar;
        const searchField = toolbar?.getContent()
            .find((control: any) => control.getMetadata().getName() === "sap.m.SearchField") as any;
        const query = searchField?.getValue() || "";
        this.applyWorkOverviewFilters(query);
    }

    public onJumpToProjects(): void {
        this.scrollToWorkSection("projects");
    }

    public onJumpToEvaluations(): void {
        this.scrollToWorkSection("evaluations");
    }

    public onJumpToInitiatives(): void {
        this.scrollToWorkSection("initiatives");
    }

    private scrollToWorkSection(section: "projects" | "evaluations" | "initiatives"): void {
        const model = this.getView()?.getModel("workOverview") as JSONModel;
        const config = model?.getProperty("/columnConfig") || { projects: 0, evaluations: 0, initiatives: 0 };
        const staticWidth = 250 + 120 + 260;

        let x = staticWidth;
        if (section === "evaluations") {
            x = staticWidth + (config.projects || 0) * 320;
        } else if (section === "initiatives") {
            x = staticWidth + ((config.projects || 0) + (config.evaluations || 0)) * 320;
        }

        const scrollContainer = this.byId("workOverviewHorizontalScroll") as any;
        if (scrollContainer?.scrollTo) {
            scrollContainer.scrollTo(x, 0, 300);
        }
    }

    private applyWorkOverviewFilters(searchQuery: string = ""): void {
        const table = this.byId("workOverviewTable") as Table;
        const binding = table.getBinding("items") as ListBinding;

        if (!binding || !this.cachedWorkData) {
            return;
        }

        // Apply filters in-memory using cached data for instant response
        const filters: Filter[] = [];

        const tLevelFilter = this.byId("tLevelFilter") as any;
        const selectedTLevel = tLevelFilter?.getSelectedKey();
        if (selectedTLevel) {
            filters.push(new Filter("tLevel", FilterOperator.EQ, selectedTLevel));
        }

        const specializationFilter = this.byId("specializationFilter") as any;
        const selectedSpecialization = specializationFilter?.getSelectedKey();
        if (selectedSpecialization) {
            filters.push(new Filter("specialization", FilterOperator.EQ, selectedSpecialization));
        }

        if (searchQuery) {
            filters.push(new Filter({
                filters: [
                    new Filter("name", FilterOperator.Contains, searchQuery),
                    new Filter("employeeId", FilterOperator.Contains, searchQuery)
                ],
                and: false
            }));
        }

        // Apply combined filters
        binding.filter(filters.length > 0 ? filters : []);
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
        const oContainer = this.byId("messagesContainerWorkOverview") as any;
        if (!oContainer || oContainer.getItems().length === 0) {
            this.initializeAIChat();
        }

        const oDialog = this.byId("aiAssistantDialogWorkOverview") as Dialog;
        oDialog?.open();
    }

    /**
     * Close AI Assistant Dialog
     */
    public onCloseAIDialog(): void {
        const oDialog = this.byId("aiAssistantDialogWorkOverview") as Dialog;
        oDialog?.close();
        // ❗ Do NOT clear chat here
    }

    private clearChatForNewSeniorManager(): void {
        console.log("🧹 Clearing chat for new senior manager");

        const oContainer = this.byId("messagesContainerWorkOverview") as any;
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
            "You're on Current Work Overview, so I can answer using this page context:\n" +
            "• Who is currently available\n" +
            "• Who is active on projects/evaluations/initiatives\n" +
            "• T3/T4 allocation snapshot\n" +
            "• Resource balancing recommendations\n\n" +
            "Try these chart-focused prompts:\n" +
            "1. How many people are available right now in this chart?\n" +
            "2. Give the allocation of everyone shown in this chart.\n" +
            "3. Give a detailed summary for everyone."
        );

        this.aiInitialized = true;
    }

    /**
     * Handle quick action buttons
     */
    public onQuickAction(oEvent: any): void {
        const button = oEvent.getSource() as any;
        const sButtonText = button.getText();
        let query = sButtonText || "";

        switch (sButtonText) {
            case "Availability?":
                query = "How many people are available right now in this chart?";
                break;
            case "Allocation":
                query = "Give the allocation of everyone shown in this chart.";
                break;
            case "Team Summary":
                query = "Give a detailed summary for everyone";
                break;
            default:
                // Keep fallback behavior for any future button labels.
                query = sButtonText || "";
                break;
        }

        const input = this.byId("messageInputWorkOverview") as any;
        input?.setValue(query);
        this.onSendMessage();
    }

    /**
     * Clear chat manually (button action)
     */
    public onClearChat(): void {
        console.log("🧹 Manual chat clear requested");
        this.clearChatForNewSeniorManager();
        this.initializeAIChat();
    }

    /**
     * Send message to AI
     */
    public onSendMessage(): void {
        const input = this.byId("messageInputWorkOverview") as any;
        const userMessage = input?.getValue() || "";

        if (!userMessage.trim()) {
            return;
        }

        // Add user message to chat
        this.addUserMessage(userMessage);
        input?.setValue("");

        // Show typing indicator
        this.addTypingIndicator();

        // Query AI endpoint
        this.queryAIAssistant(userMessage);
    }

    /**
     * Add user message to chat UI
     */
    private addUserMessage(message: string): void {
        const container = this.byId("messagesContainerWorkOverview") as any;
        if (!container) {
            return;
        }

        const userBox = new HBox({
            justifyContent: "End"
        }).addStyleClass("aiUserMessage");

        const msgText = new Text({ text: message, wrapping: true }).addStyleClass("aiUserText");
        userBox.addItem(msgText);
        container.addItem(userBox);

        this.scrollChatToBottom();
    }

    /**
     * Add bot message to chat UI
     */
    private addBotMessage(message: string): void {
        const container = this.byId("messagesContainerWorkOverview") as any;
        if (!container) {
            return;
        }

        const botBox = new HBox({
            justifyContent: "Start"
        }).addStyleClass("aiBotMessage");

        const msgText = new Text({ text: message, wrapping: true }).addStyleClass("aiBotText");
        botBox.addItem(msgText);
        container.addItem(botBox);

        this.scrollChatToBottom();
    }

    /**
     * Add typing indicator
     */
    private addTypingIndicator(): void {
        const container = this.byId("messagesContainerWorkOverview") as any;
        if (!container) {
            return;
        }

        const typingBox = new HBox({
            justifyContent: "Start"
        }).addStyleClass("aiTypingIndicator");

        typingBox.addItem(new Text({ text: "AI is typing..." }).addStyleClass("aiTypingText"));
        container.addItem(typingBox);

        this.typingIndicator = typingBox;
        this.scrollChatToBottom();
    }

    /**
     * Remove typing indicator
     */
    private removeTypingIndicator(): void {
        if (this.typingIndicator) {
            const container = this.byId("messagesContainerWorkOverview") as any;
            if (container) {
                container.removeItem(this.typingIndicator);
            }
            this.typingIndicator.destroy();
            this.typingIndicator = null;
        }
    }

    /**
     * Query AI Assistant endpoint
     */
    private async queryAIAssistant(userMessage: string): Promise<void> {
        try {
            console.log("🤖 Querying AI Assistant");

            if (!this.seniorManagerId) {
                const currentUserModel = this.getOwnerComponent()?.getModel("currentUser") as JSONModel;
                const userData = currentUserModel?.getData();
                this.seniorManagerId = userData?.id || "";
            }

            if (!this.seniorManagerId) {
                this.removeTypingIndicator();
                this.addBotMessage("Unable to identify senior manager session. Please login again.");
                return;
            }

            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            const oAction = oDataModel.bindContext("/seniorManagerQuery(...)");
            oAction.setParameter("seniorManagerId", this.seniorManagerId);
            oAction.setParameter("queryType", "work_overview");
            oAction.setParameter("context", this.buildWorkOverviewContext(userMessage));
            await oAction.execute("$auto");

            this.removeTypingIndicator();

            const result = oAction.getBoundContext()?.getObject();
            if (result?.answer) {
                this.addBotMessage(result.answer);
            } else if (result?.value?.answer) {
                this.addBotMessage(result.value.answer);
            } else {
                this.addBotMessage("I apologize, but I couldn't generate a response. Please try again.");
            }
        } catch (error) {
            console.error("❌ AI Query Error:", error);
            this.removeTypingIndicator();
            this.addBotMessage("Sorry, I encountered an error. Please try again later.");
        }
    }

    private buildWorkOverviewContext(userMessage: string): string {
        const rows = this.getVisibleWorkRows();
        const total = rows.length;

        const hasRealItem = (item: any): boolean => {
            if (!item) {
                return false;
            }
            const name = String(item.name || "").trim();
            return !!name && name !== "-";
        };

        const hasProject = (row: any): boolean => (row.projects || []).some((p: any) => hasRealItem(p));
        const hasEvaluation = (row: any): boolean => (row.evaluations || []).some((e: any) => hasRealItem(e));
        const hasInitiative = (row: any): boolean => (row.initiatives || []).some((i: any) => hasRealItem(i));

        const availableRows = rows.filter((row: any) => !hasProject(row) && !hasEvaluation(row) && !hasInitiative(row));
        const availableNames = availableRows.slice(0, 20).map((row: any) => `${row.name} (${row.employeeId})`);

        const projectCount = rows.filter((row: any) => hasProject(row)).length;
        const evaluationCount = rows.filter((row: any) => hasEvaluation(row)).length;
        const initiativeCount = rows.filter((row: any) => hasInitiative(row)).length;

        const t3Count = rows.filter((row: any) => row.tLevel === "T3").length;
        const t4Count = rows.filter((row: any) => row.tLevel === "T4").length;

        const overloaded = rows
            .filter((row: any) => {
                const allItems = [...(row.projects || []), ...(row.evaluations || []), ...(row.initiatives || [])];
                return allItems.some((item: any) => {
                    const util = Number(String(item?.util || "").replace("%", ""));
                    return !Number.isNaN(util) && util >= 80;
                });
            })
            .slice(0, 20)
            .map((row: any) => `${row.name} (${row.employeeId})`);

        const tLevelFilter = (this.byId("tLevelFilter") as any)?.getSelectedKey() || "All";
        const specializationFilter = (this.byId("specializationFilter") as any)?.getSelectedKey() || "All";

        const formatItemList = (items: any[] = []): string => {
            const formatted = items
                .filter((item: any) => hasRealItem(item))
                .map((item: any) => {
                    const name = String(item?.name || "").trim();
                    const util = String(item?.util || "").trim();
                    return util ? `${name} (${util})` : name;
                });

            return formatted.length ? formatted.join(", ") : "None";
        };

        const employeeDetails = rows.map((row: any) => {
            const employeeName = String(row?.name || "Unknown").trim();
            const employeeId = String(row?.employeeId || "-").trim();
            const projectsText = formatItemList(row?.projects || []);
            const evaluationsText = formatItemList(row?.evaluations || []);
            const initiativesText = formatItemList(row?.initiatives || []);

            return `${employeeName} (${employeeId}) - Projects: ${projectsText}; Evaluations: ${evaluationsText}; Initiatives: ${initiativesText}`;
        });

        return [
            `User question: ${userMessage}`,
            "",
            "PAGE: Current Work Overview (visible/filtered rows)",
            `Visible employees: ${total}`,
            `T3 count: ${t3Count}`,
            `T4 count: ${t4Count}`,
            `Employees with active projects: ${projectCount}`,
            `Employees with active evaluations: ${evaluationCount}`,
            `Employees with active initiatives: ${initiativeCount}`,
            `Currently available (no active work): ${availableRows.length}`,
            `T-Level filter: ${tLevelFilter}`,
            `Specialization filter: ${specializationFilter}`,
            "",
            `Available employees (up to 20): ${availableNames.length ? availableNames.join(", ") : "None"}`,
            `Potentially overloaded (util >= 80%, up to 20): ${overloaded.length ? overloaded.join(", ") : "None"}`,
            "",
            "RESPONSE REQUIREMENT FOR SUMMARY/ALLOCATION QUESTIONS:",
            "Use actual data from the employee details below.",
            "Output as points for readability.",
            "For each employee, follow this format:",
            "- Employee Name",
            "  Projects: Name (X%), Name (Y%) or None",
            "  Evaluations: Name (Z%) or None",
            "  Initiatives: Name (A%) or None",
            "",
            "EMPLOYEE DETAILS (VISIBLE ROWS):",
            ...(employeeDetails.length ? employeeDetails : ["None"])
        ].join("\n");
    }

    private getVisibleWorkRows(): any[] {
        const table = this.byId("workOverviewTable") as Table;
        const binding = table?.getBinding("items") as any;
        if (binding?.getContexts) {
            const visibleContexts = binding.getContexts(0, 1000) || [];
            const visibleRows = visibleContexts.map((ctx: any) => ctx.getObject()).filter(Boolean);
            if (visibleRows.length > 0) {
                return visibleRows;
            }
        }

        return this.cachedWorkData || [];
    }

    /**
     * Scroll chat to bottom
     */
    private scrollChatToBottom(): void {
        setTimeout(() => {
            const scrollContainer = this.byId("chatContainerWorkOverview") as any;
            if (scrollContainer && scrollContainer.scrollTo) {
                const container = this.byId("messagesContainerWorkOverview") as any;
                if (container) {
                    const scrollHeight = container.getDomRef()?.scrollHeight || 0;
                    scrollContainer.scrollTo(0, scrollHeight);
                }
            }
        }, 100);
    }
}