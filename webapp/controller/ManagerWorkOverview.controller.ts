import Controller from "sap/ui/core/mvc/Controller";
import Router from "sap/ui/core/routing/Router";
import MessageToast from "sap/m/MessageToast";
import JSONModel from "sap/ui/model/json/JSONModel";
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";
import Table from "sap/ui/table/Table";
import Column from "sap/ui/table/Column";
import Text from "sap/m/Text";
import VBox from "sap/m/VBox";
import HBox from "sap/m/HBox";
import MultiComboBox from "sap/m/MultiComboBox";
import ObjectIdentifier from "sap/m/ObjectIdentifier";
import ObjectStatus from "sap/m/ObjectStatus";
import Dialog from "sap/m/Dialog";
import Label from "sap/m/Label";
import FormattedText from "sap/m/FormattedText";
import HTML from "sap/ui/core/HTML";

/**
 * @namespace skillsphere.controller
 */
export default class ManagerWorkOverview extends Controller {

    private currentManagerId: string | null = null;
    private allWorkOverviewRows: any[] = [];
    private maxPrj: number = 1;
    private maxEvl: number = 1;
    private maxInit: number = 1;
    private isLoadingWorkOverview: boolean = false;
    private workOverviewLoadSeq: number = 0;

    // AI Assistant Properties
    private managerId: string = "";
    private currentChatManagerId: string | null = null;
    private aiInitialized: boolean = false;
    private typingIndicator: any = null;

    public onInit(): void {
        this.getRouter().getRoute("ManagerWorkOverview")?.attachPatternMatched(this.onRouteMatched, this);
    }

    public onExit(): void {
        this.getRouter().getRoute("ManagerWorkOverview")?.detachPatternMatched(this.onRouteMatched, this);
    }

    private getRouter(): Router {
        return (this.getOwnerComponent() as any).getRouter();
    }

    public onNavBack(): void {
        if (!this.currentManagerId) {
            this.getRouter().navTo("Landing");
            return;
        }

        this.getRouter().navTo("ManagerDashboard", {
            managerId: this.currentManagerId
        });
    }

    public onLogout(): void {
        const currentUserModel = this.getOwnerComponent()?.getModel("currentUser") as JSONModel;
        if (currentUserModel) {
            currentUserModel.setData({
                id: null,
                name: null,
                role: null,
                isLoggedIn: false
            });
        }

        this.currentManagerId = null;
        this.allWorkOverviewRows = [];
        this.isLoadingWorkOverview = false;
        this.getRouter().navTo("Landing");
        MessageToast.show("You have been logged out");
    }

    private async onRouteMatched(event: any): Promise<void> {
        const args: any = event.getParameter("arguments");
        const managerId = args?.managerId;
        const currentUserModel = this.getOwnerComponent()?.getModel("currentUser") as JSONModel;
        const currentUser = currentUserModel?.getData();

        if (!currentUser?.isLoggedIn && !managerId) {
            MessageToast.show("Please login to access the work overview");
            this.getRouter().navTo("Landing");
            return;
        }

        const resolvedManagerId = managerId || currentUser?.id;

        if (this.currentManagerId && resolvedManagerId && this.currentManagerId !== resolvedManagerId) {
            this.allWorkOverviewRows = [];
        }

        this.currentManagerId = resolvedManagerId;

        const loadSeq = ++this.workOverviewLoadSeq;
        await this.loadWorkOverview(loadSeq);
    }

    private async loadWorkOverview(loadSeq: number): Promise<void> {
        this.isLoadingWorkOverview = true;
        try {
            const page = this.getView()?.byId("managerWorkOverviewPage") as any;
            if (page?.setBusy) page.setBusy(true);

            const oDataModel = this.getOwnerComponent()?.getModel() as any;

            // Load all employees so managers get org-wide current work visibility.
            const empBinding = oDataModel.bindList("/Employees");
            const empContexts = await empBinding.requestContexts(0, 500);
            const employees = empContexts.map((ctx: any) => ctx.getObject());

            if (loadSeq !== this.workOverviewLoadSeq) return;

            // Load all profiles
            const profBinding = oDataModel.bindList("/Profiles");
            const profContexts = await profBinding.requestContexts(0, 500);
            const profiles = profContexts.map((ctx: any) => ctx.getObject());
            const profileMap: any = {};
            profiles.forEach((p: any) => { profileMap[p.employeeId] = p; });

            if (loadSeq !== this.workOverviewLoadSeq) return;

            // Load all current projects
            const cpBinding = oDataModel.bindList("/CurrentProjects");
            const cpContexts = await cpBinding.requestContexts(0, 1000);
            const currentProjects = cpContexts.map((ctx: any) => ctx.getObject());

            if (loadSeq !== this.workOverviewLoadSeq) return;

            // Load all current initiatives and evaluations
            const currentInitiativesBinding = oDataModel.bindList("/CurrentInitiatives");
            const currentInitiativesContexts = await currentInitiativesBinding.requestContexts(0, 1000);
            const currentInitiatives = currentInitiativesContexts.map((ctx: any) => ctx.getObject());

            if (loadSeq !== this.workOverviewLoadSeq) return;

            const currentEvaluationsBinding = oDataModel.bindList("/CurrentEvaluations");
            const currentEvaluationsContexts = await currentEvaluationsBinding.requestContexts(0, 1000);
            const currentEvaluations = currentEvaluationsContexts.map((ctx: any) => ctx.getObject());

            if (loadSeq !== this.workOverviewLoadSeq) return;

            // Group current projects by employee - only Projects from CurrentProjects
            const empProjects: any = {};
            currentProjects.forEach((cp: any) => {
                if (cp.assignmentStatus === "Completed" || cp.assignmentStatus === "Rejected") return;
                const eid = cp.employeeId;
                if (cp.type === "Project") {
                    if (!empProjects[eid]) empProjects[eid] = [];
                    empProjects[eid].push(cp);
                }
            });

            // Group evaluations and initiatives from current work entities
            const empEvaluations: any = {};
            const empInitiatives: any = {};
            currentEvaluations.forEach((evaluation: any) => {
                if (evaluation.status === "Completed") return;
                const eid = evaluation.employeeId;
                if (!eid) return;
                if (!empEvaluations[eid]) empEvaluations[eid] = [];
                empEvaluations[eid].push(evaluation);
            });

            currentInitiatives.forEach((initiative: any) => {
                if (initiative.status === "Completed") return;
                const eid = initiative.employeeId;
                if (!eid) return;
                if (!empInitiatives[eid]) empInitiatives[eid] = [];
                empInitiatives[eid].push(initiative);
            });

            const formatEntry = (name: string, pct: any) => {
                return pct ? `${name} (${pct}%)` : name;
            };

            const rows: any[] = [];
            employees.forEach((emp: any) => {
                const profile = profileMap[emp.employeeId] || {};
                const tLevel = profile.tLevel || emp.tLevel || "";
                const specialization = profile.specialization || "";
                let techCategory = this.mapTechCategory(specialization);

                const projectsList = empProjects[emp.employeeId] || [];
                const evaluations = empEvaluations[emp.employeeId] || [];
                const inits = empInitiatives[emp.employeeId] || [];

                if (!techCategory && emp.role) {
                    techCategory = this.mapTechCategory(emp.role);
                }
                if (!techCategory && projectsList.length > 0 && projectsList[0].technology) {
                    techCategory = this.mapTechCategory(projectsList[0].technology);
                }

                const projectsUtil = projectsList.reduce((sum: number, p: any) => sum + (p.utilizationPercent || 0), 0);
                const evaluationsUtil = evaluations.reduce((sum: number, e: any) => sum + (e.utilizationPercent || 0), 0);
                const initiativesUtil = inits.reduce((sum: number, i: any) => sum + (i.utilizationPercent || 0), 0);
                const totalAllocation = projectsUtil + evaluationsUtil + initiativesUtil;

                const row: any = {
                    name: emp.name,
                    employeeId: emp.employeeId,
                    tLevel: tLevel,
                    techCategory: techCategory,
                    totalAllocation: totalAllocation,
                    projects: projectsList.map((p: any) => formatEntry(p.projectName, p.utilizationPercent)),
                    evaluations: evaluations.map((e: any) => formatEntry(e.evaluationName || e.initiativeName || e.description || "Evaluation", e.utilizationPercent)),
                    initiatives: inits.map((i: any) => formatEntry(i.initiativeName || i.description || "Initiative", i.utilizationPercent))
                };
                rows.push(row);
            });

            rows.sort((a: any, b: any) => {
                if (a.techCategory !== b.techCategory) {
                    if (!a.techCategory) return 1;
                    if (!b.techCategory) return -1;
                    return a.techCategory.localeCompare(b.techCategory);
                }
                return a.name.localeCompare(b.name);
            });

            this.allWorkOverviewRows = rows;

            const tLevelFilter = this.byId("woTLevelFilter") as MultiComboBox;
            if (tLevelFilter) {
                tLevelFilter.setSelectedKeys([]);
            }

            this.buildWorkOverviewTable(rows);

            if (page?.setBusy) page.setBusy(false);
        } catch (error) {
            console.error("❌ Error loading manager work overview:", error);
            MessageToast.show("Error loading work overview. Please try again.");
            const page = this.getView()?.byId("managerWorkOverviewPage") as any;
            if (page?.setBusy) page.setBusy(false);
        } finally {
            this.isLoadingWorkOverview = false;
            const page = this.getView()?.byId("managerWorkOverviewPage") as any;
            if (page?.setBusy) page.setBusy(false);
        }
    }

    private mapTechCategory(specialization: string): string {
        if (!specialization) return "";
        const s = specialization.toLowerCase();
        if (s.includes("s/4") || s.includes("s4") || s.includes("abap") || s.includes("hana") || s.includes("procurement") || s.includes("ariba") || s.includes("fico") || s.includes("mm ") || s.includes("sd ") || s.includes("successfactor") || s.includes("erp")) return "S/4HANA";
        if (s.includes("btp") || s.includes("fiori") || s.includes("ui5") || s.includes("sapui5") || s.includes("cap") || s.includes("integration") || s.includes("cloud foundry") || s.includes("innovation") || s.includes("full stack") || s.includes("frontend") || s.includes("devops") || s.includes("backend")) return "BTP";
        if (s.includes("data sci") || s.includes("data scientist") || s.includes("ai") || s.includes("ml") || s.includes("machine learning") || s.includes("analytics") || s.includes("sac")) return "Data Science";
        if (s.includes("developer") || s.includes("architect") || s.includes("engineer") || s.includes("test") || s.includes("qa")) return "BTP";
        return "";
    }

    private buildWorkOverviewTable(rows: any[]): void {
        const container = this.byId("workOverviewTableContainer") as VBox;
        if (!container) return;
        container.destroyItems();

        let maxP = 0, maxE = 0, maxI = 0;
        rows.forEach((r: any) => {
            if (r.projects.length > maxP) maxP = r.projects.length;
            if (r.evaluations.length > maxE) maxE = r.evaluations.length;
            if (r.initiatives.length > maxI) maxI = r.initiatives.length;
        });
        this.maxPrj = Math.min(maxP, 5) || 1;
        this.maxEvl = Math.min(maxE, 5) || 1;
        this.maxInit = Math.min(maxI, 5) || 1;

        const oTableModel = new JSONModel({ rows: rows });

        const oTable = new Table({
            visibleRowCount: Math.min(rows.length, 20),
            enableColumnReordering: true,
            selectionMode: "None",
            alternateRowColors: true,
            columnHeaderVisible: true,
            width: "100%",
            noData: new Text({ text: "No employees found for selected filters" })
        }).addStyleClass("workforceOverviewDynTable");

        oTable.setModel(oTableModel);
        oTable.bindRows({ path: "/rows" });

        oTable.addColumn(new Column({
            width: "12rem",
            label: new Label({ text: "Employee" }),
            template: new ObjectIdentifier({
                title: "{name}",
                text: "{employeeId}"
            })
        }));

        oTable.addColumn(new Column({
            width: "6rem",
            label: new Label({ text: "Alloc%" }),
            hAlign: "Center",
            template: new ObjectStatus({
                text: "{totalAllocation}%",
                state: {
                    path: "totalAllocation",
                    formatter: function (alloc: number) {
                        return alloc > 100 ? "Error" : alloc > 80 ? "Warning" : "Success";
                    }
                }
            })
        }));

        oTable.addColumn(new Column({
            width: "6rem",
            label: new Label({ text: "Tech" }),
            hAlign: "Center",
            template: new ObjectStatus({
                text: "{techCategory}",
                state: {
                    path: "techCategory",
                    formatter: function (tech: string) {
                        return tech === "S/4HANA" ? "Error" : tech === "BTP" ? "Success" : tech === "Data Science" ? "Information" : "None";
                    }
                }
            })
        }));

        for (let i = 0; i < this.maxPrj; i++) {
            oTable.addColumn(new Column({
                width: "10rem",
                label: new Label({ text: `Prj ${i + 1}` }),
                template: new Text({
                    text: {
                        path: `projects/${i}`,
                        formatter: function (val: string) {
                            return val || "-";
                        }
                    },
                    wrapping: true,
                    maxLines: 2
                })
            }));
        }

        for (let i = 0; i < this.maxEvl; i++) {
            oTable.addColumn(new Column({
                width: "10rem",
                label: new Label({ text: `Evl ${i + 1}` }),
                template: new Text({
                    text: {
                        path: `evaluations/${i}`,
                        formatter: function (val: string) {
                            return val || "-";
                        }
                    },
                    wrapping: true,
                    maxLines: 2
                })
            }));
        }

        for (let i = 0; i < this.maxInit; i++) {
            oTable.addColumn(new Column({
                width: "10rem",
                label: new Label({ text: `Init ${i + 1}` }),
                template: new Text({
                    text: {
                        path: `initiatives/${i}`,
                        formatter: function (val: string) {
                            return val || "-";
                        }
                    },
                    wrapping: true,
                    maxLines: 2
                })
            }));
        }

        container.addItem(oTable);
    }

    public onWorkOverviewFilterChange(): void {
        const filtered = this.getVisibleWorkRows();
        this.buildWorkOverviewTable(filtered);
    }

    public onSearchWorkOverview(): void {
        this.onWorkOverviewFilterChange();
    }

    // ==================== AI Assistant Methods ====================

    public onOpenAIAssistant(): void {
        const currentUserModel = this.getOwnerComponent()?.getModel("currentUser") as JSONModel;
        const userData = currentUserModel?.getData();

        if (!userData?.id) {
            MessageToast.show("Please login first");
            return;
        }

        const newManagerId = userData.id;

        if (this.currentChatManagerId !== newManagerId) {
            this.clearChatForNewManager();
            this.currentChatManagerId = newManagerId;
        }

        this.managerId = newManagerId;

        const oContainer = this.byId("messagesContainerWorkOverview") as any;
        if (!oContainer || oContainer.getItems().length === 0) {
            this.initializeAIChat();
        }

        const oDialog = this.byId("aiAssistantDialogWorkOverview") as Dialog;
        oDialog?.open();
    }

    public onCloseAIDialog(): void {
        const oDialog = this.byId("aiAssistantDialogWorkOverview") as Dialog;
        oDialog?.close();
    }

    private clearChatForNewManager(): void {
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

    private initializeAIChat(): void {
        if (this.aiInitialized) return;

        const currentUserModel = this.getOwnerComponent()?.getModel("currentUser") as JSONModel;
        const userData = currentUserModel?.getData();
        const managerName = userData?.name || "Manager";

        this.addBotMessage(
            `👋 Hello ${managerName}! I'm your AI assistant.\n\n` +
            "You're on Current Work Overview for your team:\n" +
            "• Who is currently available\n" +
            "• Who is active on projects/evaluations/initiatives\n" +
            "• T3/T4 allocation snapshot\n" +
            "• Resource balancing recommendations\n\n" +
            "Try these prompts:\n" +
            "1. How many people are available right now?\n" +
            "2. Give the allocation of everyone in my team.\n" +
            "3. Give a detailed summary for everyone."
        );

        this.aiInitialized = true;
    }

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
                query = sButtonText || "";
                break;
        }

        const input = this.byId("messageInputWorkOverview") as any;
        input?.setValue(query);
        this.onSendMessage();
    }

    public onClearChat(): void {
        this.clearChatForNewManager();
        this.initializeAIChat();
    }

    public onSendMessage(): void {
        const input = this.byId("messageInputWorkOverview") as any;
        const userMessage = input?.getValue() || "";

        if (!userMessage.trim()) return;

        this.addUserMessage(userMessage);
        input?.setValue("");
        this.showTypingIndicator();
        this.queryAIAssistant(userMessage);
    }

    private addUserMessage(message: string): void {
        const oContainer = this.byId("messagesContainerWorkOverview") as any;

        const oMessageBox = new HBox({
            justifyContent: "End",
            items: [
                new VBox({
                    items: [
                        new Text({ text: message }).addStyleClass("userMessage sapUiSmallMargin")
                    ]
                }).addStyleClass("messageBox userMessageBox")
            ]
        }).addStyleClass("sapUiTinyMarginTop");

        oContainer?.addItem(oMessageBox);
        this.scrollChatToBottom();
    }

    private addBotMessage(message: string): void {
        const oContainer = this.byId("messagesContainerWorkOverview") as any;

        const formattedHtml = this.parseMarkdown(message);

        const oMessageBox = new HBox({
            justifyContent: "Start",
            width: "100%",
            items: [
                new VBox({
                    width: "100%",
                    items: [
                        new FormattedText({ htmlText: formattedHtml }).addStyleClass("botMessage sapUiSmallMargin")
                    ]
                }).addStyleClass("messageBox botMessageBox")
            ]
        }).addStyleClass("sapUiTinyMarginTop");

        oContainer?.addItem(oMessageBox);
        this.scrollChatToBottom();
    }

    private parseMarkdown(text: string): string {
        let html = text;

        html = html
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

        html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
        html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
        html = html.replace(/`(.+?)`/g, "<code>$1</code>");
        html = html.replace(/\n/g, "<br>");
        html = html.replace(/^[\s]*[\*\-]\s+(.+?)(?=<br>|$)/gm,
            (match, content) => "&nbsp;&nbsp;&nbsp;• " + content.trim());
        html = html.replace(/^[\s]*(\d+)\.\s+(.+?)(?=<br>|$)/gm,
            (match, num, content) => "&nbsp;&nbsp;&nbsp;" + num + ". " + content.trim());
        html = html.replace(/^#+\s+(.+?)(?=<br>|$)/gm,
            (match, content) => "<strong style=\"font-size: 1.1em; color: #0070f2;\">" + content.trim() + "</strong>");

        return html;
    }

    private showTypingIndicator(): void {
        const oContainer = this.byId("messagesContainerWorkOverview") as any;

        this.typingIndicator = new HTML({
            id: this.createId("typingIndicatorWorkOverview"),
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
        this.scrollChatToBottom();
    }

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

    private async queryAIAssistant(userMessage: string): Promise<void> {
        try {
            if (!this.managerId) {
                const currentUserModel = this.getOwnerComponent()?.getModel("currentUser") as JSONModel;
                const userData = currentUserModel?.getData();
                this.managerId = userData?.id || "";
            }

            if (!this.managerId) {
                this.removeTypingIndicator();
                this.addBotMessage("Unable to identify manager session. Please login again.");
                return;
            }

            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            const oAction = oDataModel.bindContext("/managerQuery(...)");
            oAction.setParameter("managerId", this.managerId);
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

        const hasItems = (arr: string[]): boolean => arr && arr.length > 0 && arr.some((s: string) => !!s);

        const availableRows = rows.filter((row: any) => !hasItems(row.projects) && !hasItems(row.evaluations) && !hasItems(row.initiatives));
        const availableNames = availableRows.slice(0, 20).map((row: any) => `${row.name}`);

        const projectCount = rows.filter((row: any) => hasItems(row.projects)).length;
        const evaluationCount = rows.filter((row: any) => hasItems(row.evaluations)).length;
        const initiativeCount = rows.filter((row: any) => hasItems(row.initiatives)).length;

        const t3Count = rows.filter((row: any) => row.tLevel === "T3").length;
        const t4Count = rows.filter((row: any) => row.tLevel === "T4").length;

        const tLevelFilterKeys = ((this.byId("woTLevelFilter") as any)?.getSelectedKeys?.() || []) as string[];
        const techFilterKeys = ((this.byId("woTechFilter") as any)?.getSelectedKeys?.() || []) as string[];
        const tLevelFilter = tLevelFilterKeys.length > 0 ? tLevelFilterKeys.join(", ") : "All";
        const techFilter = techFilterKeys.length > 0 ? techFilterKeys.join(", ") : "All";

        const employeeDetails = rows.map((row: any) => {
            const projectsText = (row.projects || []).filter((s: string) => !!s).join(", ") || "None";
            const evaluationsText = (row.evaluations || []).filter((s: string) => !!s).join(", ") || "None";
            const initiativesText = (row.initiatives || []).filter((s: string) => !!s).join(", ") || "None";
            return `${row.name} - Projects: ${projectsText}; Evaluations: ${evaluationsText}; Initiatives: ${initiativesText}`;
        });

        return [
            `User question: ${userMessage}`,
            "",
            "PAGE: Current Work Overview - Manager's Team (visible/filtered rows)",
            `Visible employees: ${total}`,
            `T3 count: ${t3Count}`,
            `T4 count: ${t4Count}`,
            `Employees with active projects: ${projectCount}`,
            `Employees with active evaluations: ${evaluationCount}`,
            `Employees with active initiatives: ${initiativeCount}`,
            `Currently available (no active work): ${availableRows.length}`,
            `T-Level filter: ${tLevelFilter}`,
            `Technology filter: ${techFilter}`,
            "",
            `Available employees (up to 20): ${availableNames.length ? availableNames.join(", ") : "None"}`,
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
        const tLevelMulti = this.byId("woTLevelFilter") as MultiComboBox;
        const selectedTLevels = tLevelMulti?.getSelectedKeys() || [];
        const techMulti = this.byId("woTechFilter") as MultiComboBox;
        const selectedTechs = techMulti?.getSelectedKeys() || [];
        const searchField = this.byId("woSearchField") as any;
        const searchQuery = (searchField?.getValue() || "").trim().toLowerCase();

        let filtered = this.allWorkOverviewRows || [];

        if (selectedTLevels.length > 0) {
            filtered = filtered.filter((r: any) => selectedTLevels.includes(r.tLevel));
        }

        if (selectedTechs.length > 0) {
            filtered = filtered.filter((r: any) => selectedTechs.includes(r.techCategory));
        }

        if (searchQuery) {
            filtered = filtered.filter((r: any) =>
                (r.name && r.name.toLowerCase().includes(searchQuery)) ||
                (r.employeeId && r.employeeId.toLowerCase().includes(searchQuery))
            );
        }

        return filtered;
    }

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
