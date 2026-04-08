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

/**
 * @namespace skillsphere.controller
 */
export default class SeniorManagerWorkOverview extends Controller {

    private currentSeniorManagerId: string | null = null;

    public onInit(): void {
        this.getRouter().getRoute("SeniorManagerWorkOverview")?.attachPatternMatched(this.onRouteMatched, this);
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
        this.getRouter().navTo("Landing");
        MessageToast.show("You have been logged out");
    }

    private async onRouteMatched(event: any): Promise<void> {
        const args: any = event.getParameter("arguments");
        const seniorManagerId = args?.seniorManagerId;
        const currentUserModel = this.getOwnerComponent()?.getModel("currentUser") as JSONModel;
        const currentUser = currentUserModel?.getData();

        if (!currentUser?.isLoggedIn && !seniorManagerId) {
            MessageToast.show("Please login to access the work overview");
            this.getRouter().navTo("Landing");
            return;
        }

        this.currentSeniorManagerId = seniorManagerId || currentUser?.id;
        await this.loadWorkOverview();
    }

    private async loadWorkOverview(): Promise<void> {
        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;

            const employeesBinding = oDataModel.bindList("/Employees");
            const employeeContexts = await employeesBinding.requestContexts(0, 9999);
            const allEmployees = employeeContexts.map((ctx: any) => ctx.getObject())
                .filter((emp: any) => emp.employeeId && !emp.employeeId.startsWith("MGR"));

            const profilesBinding = oDataModel.bindList("/Profiles");
            const profileContexts = await profilesBinding.requestContexts(0, 9999);
            const profiles = profileContexts.map((ctx: any) => ctx.getObject());
            const profileMap = new Map(profiles.map((profile: any) => [profile.employeeId, profile]));

            const seniorEmployees = allEmployees.filter((emp: any) => {
                const profile: any = profileMap.get(emp.employeeId);
                return profile?.tLevel === "T3" || profile?.tLevel === "T4";
            });

            const currentProjectsBinding = oDataModel.bindList("/CurrentProjects");
            const currentProjectContexts = await currentProjectsBinding.requestContexts(0, 9999);
            const projectsBinding = oDataModel.bindList("/Projects");
            const projectContexts = await projectsBinding.requestContexts(0, 9999);
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const workByEmployee = new Map<string, any[]>();
            currentProjectContexts.map((ctx: any) => ctx.getObject()).forEach((project: any) => {
                if (!project.startDate || !project.endDate) {
                    return;
                }

                const startDate = new Date(project.startDate);
                const endDate = new Date(project.endDate);
                startDate.setHours(0, 0, 0, 0);
                endDate.setHours(0, 0, 0, 0);

                if (today >= startDate && today <= endDate) {
                    if (!workByEmployee.has(project.employeeId)) {
                        workByEmployee.set(project.employeeId, []);
                    }

                    workByEmployee.get(project.employeeId)?.push(project);
                }
            });

            // Include active evaluation windows from Projects master data
            projectContexts.map((ctx: any) => ctx.getObject()).forEach((project: any) => {
                if (!project.employeeId || !project.evaluationStartDate || !project.evaluationEndDate) {
                    return;
                }

                const evalStartDate = new Date(project.evaluationStartDate);
                const evalEndDate = new Date(project.evaluationEndDate);
                evalStartDate.setHours(0, 0, 0, 0);
                evalEndDate.setHours(0, 0, 0, 0);

                if (today >= evalStartDate && today <= evalEndDate) {
                    if (!workByEmployee.has(project.employeeId)) {
                        workByEmployee.set(project.employeeId, []);
                    }

                    workByEmployee.get(project.employeeId)?.push({
                        type: "Evaluation",
                        projectName: project.projectName,
                        technology: project.technology,
                        utilizationPercent: project.utilizationPercent || 0,
                        startDate: project.evaluationStartDate,
                        endDate: project.evaluationEndDate
                    });
                }
            });

            let maxProjects = 0;
            let maxEvaluations = 0;
            let maxInitiatives = 0;

            const employeeWorkData = seniorEmployees.map((employee: any) => {
                const profile: any = profileMap.get(employee.employeeId);
                const work = workByEmployee.get(employee.employeeId) || [];
                const projects = work.filter((item: any) => item.type === "Project");
                const evaluations = work.filter((item: any) => item.type === "Evaluation");
                const initiatives = work.filter((item: any) => item.type === "Initiative");

                maxProjects = Math.max(maxProjects, projects.length);
                maxEvaluations = Math.max(maxEvaluations, evaluations.length);
                maxInitiatives = Math.max(maxInitiatives, initiatives.length);

                return { employee, profile, projects, evaluations, initiatives };
            });

            // Keep table structure stable even when there is no active work in a category.
            maxProjects = Math.max(1, maxProjects);
            maxEvaluations = Math.max(1, maxEvaluations);
            maxInitiatives = Math.max(1, maxInitiatives);

            const employeesOverview = employeeWorkData.map(({ employee, profile, projects, evaluations, initiatives }: any) => {
                const rowData: any = {
                    name: employee.name,
                    employeeId: employee.employeeId,
                    tLevel: profile?.tLevel || "-",
                    specialization: employee.specialization || profile?.specialization || "-",
                    projects: [],
                    evaluations: [],
                    initiatives: []
                };

                for (let i = 0; i < maxProjects; i++) {
                    rowData.projects.push({
                        name: projects[i]?.projectName || "-",
                        tech: projects[i]?.technology || "",
                        util: projects[i] ? `${projects[i].utilizationPercent}%` : ""
                    });
                }

                for (let i = 0; i < maxEvaluations; i++) {
                    rowData.evaluations.push({
                        name: evaluations[i]?.projectName ? `${evaluations[i]?.projectName} (Evaluation)` : "-",
                        tech: evaluations[i]?.technology || "",
                        util: evaluations[i] ? `${evaluations[i].utilizationPercent}%` : ""
                    });
                }

                for (let i = 0; i < maxInitiatives; i++) {
                    rowData.initiatives.push({
                        name: initiatives[i]?.projectName || "-",
                        tech: initiatives[i]?.technology || "",
                        util: initiatives[i] ? `${initiatives[i].utilizationPercent}%` : ""
                    });
                }

                return rowData;
            });

            this.getView()?.setModel(new JSONModel({
                employees: employeesOverview,
                columnConfig: {
                    projects: maxProjects,
                    evaluations: maxEvaluations,
                    initiatives: maxInitiatives
                }
            }), "workOverview");

            this.rebuildWorkOverviewColumns(maxProjects, maxEvaluations, maxInitiatives);
        } catch (error) {
            console.error("❌ Error loading work overview:", error);
            MessageToast.show("Error loading work overview");
        }
    }

    private rebuildWorkOverviewColumns(maxProjects: number, maxEvaluations: number, maxInitiatives: number): void {
        const table = this.byId("workOverviewTable") as Table;
        if (!table) {
            return;
        }

        if (table.isBound("items")) {
            table.unbindItems();
        }

        const existingColumns = table.getColumns();
        while (existingColumns.length > 3) {
            table.removeColumn(existingColumns[existingColumns.length - 1]);
        }

        const columns: Column[] = [];
        const cellTemplates: any[] = [];

        cellTemplates.push(
            new VBox({
                items: [
                    new Text({ text: "{workOverview>name}", wrapping: false }).addStyleClass("sapUiTinyMarginBottom"),
                    new Text({ text: "{workOverview>employeeId}" }).addStyleClass("sapThemeTextSubtle-asColor")
                ]
            }),
            new ObjectStatus({ text: "{workOverview>tLevel}", state: "Information" }),
            new Text({ text: "{workOverview>specialization}", wrapping: true, maxLines: 2 })
        );

        for (let i = 0; i < maxProjects; i++) {
            columns.push(new Column({
                width: "320px",
                hAlign: "Left",
                header: new Text({ text: `Project ${i + 1}` })
            }));

            cellTemplates.push(
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
            columns.push(new Column({
                width: "320px",
                hAlign: "Left",
                header: new Text({ text: maxEvaluations > 1 ? `Evaluation ${i + 1}` : "Evaluation" })
            }));

            cellTemplates.push(
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
            columns.push(new Column({
                width: "320px",
                hAlign: "Left",
                header: new Text({ text: maxInitiatives > 1 ? `Initiative ${i + 1}` : "Initiative" })
            }));

            cellTemplates.push(
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

        columns.forEach((column) => table.addColumn(column));

        // Force table width so horizontal scroll is always available for wide dynamic datasets
        const staticWidth = 250 + 120 + 260;
        const dynamicWidth = (maxProjects + maxEvaluations + maxInitiatives) * 320;
        const totalWidth = Math.max(1200, staticWidth + dynamicWidth);
        table.setWidth(`${totalWidth}px`);

        table.bindItems({
            path: "workOverview>/employees",
            template: new ColumnListItem({
                cells: cellTemplates
            })
        });
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

        if (!binding) {
            return;
        }

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

        binding.filter(filters.length > 0 ? filters : []);
    }
}