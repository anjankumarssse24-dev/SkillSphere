import Controller from "sap/ui/core/mvc/Controller";
import Router from "sap/ui/core/routing/Router";
import MessageToast from "sap/m/MessageToast";
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

/**
 * @namespace skillsphere.controller
 */
export default class ManagerTeamView extends Controller {

    private currentManagerId: string | null = null;
    private seniorManagerId: string | null = null;

    public onInit(): void {
        const router = this.getRouter();
        router.getRoute("ManagerTeamView")?.attachPatternMatched(this.onRouteMatched, this);
    }

    private getRouter(): Router {
        return (this.getOwnerComponent() as any).getRouter();
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
                isLoggedIn: false
            });
        }

        this.currentManagerId = null;
        
        // Navigate back to landing page
        this.getRouter().navTo("Landing");
        MessageToast.show("You have been logged out");
    }

    private async onRouteMatched(event: any): Promise<void> {
        // Get route parameters
        const args: any = event.getParameter("arguments");
        const managerId = args?.managerId;
        const seniorManagerId = args?.seniorManagerId;
        
        console.log("Route matched for viewing manager team:", managerId, "by senior manager:", seniorManagerId);
        
        // ALWAYS scroll to top when dashboard loads
        window.scrollTo({ top: 0, behavior: 'auto' });
        
        // Clear previous search results when switching managers
        this.clearSearchResults();
        
        // Store senior manager ID for back navigation
        this.seniorManagerId = seniorManagerId;
        
        // Check if senior manager is logged in (they should be viewing this)
        const currentUserModel = this.getOwnerComponent()?.getModel("currentUser") as JSONModel;
        const currentUser = currentUserModel?.getData();
        
        if (!managerId) {
            // No manager ID provided - go back
            console.error("No manager ID provided in route");
            MessageToast.show("Invalid navigation - no manager specified");
            this.getRouter().navTo("SeniorManagerDashboard", { seniorManagerId: seniorManagerId || currentUser?.id });
            return;
        }
        
        // Set current manager ID (the manager whose team we're viewing)
        this.currentManagerId = managerId;
        
        // Load manager information and set it in a model
        await this.loadManagerInfo(managerId);
        
        // Load manager-specific team data
        await this.loadManagerData();
    }

    /**
     * Load manager information to display in header
     */
    private async loadManagerInfo(managerId: string): Promise<void> {
        console.log("📊 Loading manager information for:", managerId);
        
        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            const listBinding = oDataModel.bindList("/Managers");
            listBinding.filter([new Filter("managerId", FilterOperator.EQ, managerId)]);
            
            const contexts = await listBinding.requestContexts(0, 1);
            
            if (contexts.length > 0) {
                const manager = contexts[0].getObject();
                console.log("✅ Manager info loaded:", manager);
                
                // Create a model for manager team info to display in the header
                const managerTeamInfoModel = new JSONModel({
                    managerId: manager.managerId,
                    managerName: manager.name,
                    team: manager.team,
                    specialization: manager.specialization
                });
                
                this.getView()?.setModel(managerTeamInfoModel, "managerTeamInfo");
            } else {
                console.error("Manager not found:", managerId);
                MessageToast.show("Manager information not found");
            }
        } catch (error) {
            console.error("❌ Error loading manager info:", error);
            MessageToast.show("Error loading manager information");
        }
    }
    
    /**
     * Navigate back to Senior Manager Dashboard
     */
    public onBackToDashboard(): void {
        const currentUserModel = this.getOwnerComponent()?.getModel("currentUser") as JSONModel;
        const currentUser = currentUserModel?.getData();
        const seniorMgrId = this.seniorManagerId || currentUser?.id;
        
        console.log("📌 Navigating back to Senior Manager Dashboard:", seniorMgrId);
        
        if (seniorMgrId) {
            this.getRouter().navTo("SeniorManagerDashboard", { seniorManagerId: seniorMgrId });
        } else {
            // Fallback to landing page if no senior manager ID
            this.getRouter().navTo("Landing");
        }
    }

    private async loadManagerData(): Promise<void> {
        // Get current manager's information
        const currentUserModel = this.getOwnerComponent()?.getModel("currentUser") as JSONModel;
        const currentUser = currentUserModel?.getData();
        const currentManagerId = this.currentManagerId || currentUser?.id;
        const currentManagerName = currentUser?.name;

        console.log("📊 Loading data for manager:", currentManagerId, currentManagerName);

        if (!currentManagerId) {
            console.error("Manager ID not found");
            MessageToast.show("Manager information not available. Please login again.");
            return;
        }

        try {
            // Load employees reporting to this manager from OData
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            const listBinding = oDataModel.bindList("/Employees");
            listBinding.filter([new Filter("managerId", FilterOperator.EQ, currentManagerId)]);
            
            const contexts = await listBinding.requestContexts();
            const employees = contexts.map((context: any) => context.getObject());
            
            console.log(`✅ Loaded ${employees.length} employees from OData for manager ${currentManagerId}`);
            console.log("📊 Sample employee data:", employees[0]); // Debug: Check what fields are loaded
            
            // Load skills, profile and current projects for each employee
            const enrichedEmployees = await Promise.all(employees.map(async (emp: any) => {
                const empSkills = await this.getEmployeeSkills(emp.employeeId);
                const empProjects = await this.getEmployeeProjects(emp.employeeId);
                const currentProjects = await this.getCurrentProjects(emp.employeeId);
                const empProfile = await this.getEmployeeProfile(emp.employeeId);
                
                // Check if employee is working on a project TODAY
                const today = new Date();
                today.setHours(0, 0, 0, 0); // Reset time to midnight for date comparison
                
                const workingOnProject = currentProjects.some((cp: any) => {
                    if (!cp.startDate || !cp.endDate) return false;
                    
                    const startDate = new Date(cp.startDate);
                    const endDate = new Date(cp.endDate);
                    startDate.setHours(0, 0, 0, 0);
                    endDate.setHours(0, 0, 0, 0);
                    
                    // Check if today is between start and end dates (inclusive)
                    return today >= startDate && today <= endDate;
                });
                
                return {
                    ...emp,
                    experience: emp.experience || 0,
                    specialization: empProfile?.specialization || '',
                    skills: empSkills, // Include full skill objects for search
                    totalSkills: empSkills.length,
                    totalProjects: empProjects.length,
                    working_on_project: workingOnProject
                };
            }));
            
            // Sort employees by name alphabetically
            enrichedEmployees.sort((a: any, b: any) => {
                const nameA = (a.name || '').toUpperCase();
                const nameB = (b.name || '').toUpperCase();
                return nameA.localeCompare(nameB);
            });

            console.log("✅ Employees with enriched data (sorted):", enrichedEmployees);

            // Create local model for employees
            const localEmployeesModel = new JSONModel({ employees: enrichedEmployees });
            this.getView()?.setModel(localEmployeesModel, "managerEmployees");

            // Update analytics for this manager's team
            this.updateAnalytics();
            
            // Initialize visualization after data is loaded
            await this.initializeVisualization();
            
            // Load all managers for the search dropdown
            await this.loadAllManagers();
            
        } catch (error) {
            console.error("❌ Error loading manager data:", error);
            MessageToast.show("Error loading team data");
            
            // Set empty model on error
            const emptyModel = new JSONModel({ employees: [] });
            this.getView()?.setModel(emptyModel, "managerEmployees");
        }
    }

    /**
     * Load all managers for the search dropdown
     */
    private async loadAllManagers(): Promise<void> {
        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            const listBinding = oDataModel.bindList("/Managers");
            
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
            const listBinding = oDataModel.bindList("/Projects");
            listBinding.filter([new Filter("employeeId", FilterOperator.EQ, employeeId)]);
            
            const contexts = await listBinding.requestContexts();
            return contexts.map((context: any) => context.getObject());
        } catch (error) {
            console.error(`Error loading projects for ${employeeId}:`, error);
            return [];
        }
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
     * Get current projects (utilization) for an employee
     */
    private async getCurrentProjects(employeeId: string): Promise<any[]> {
        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            const listBinding = oDataModel.bindList("/CurrentProjects");
            listBinding.filter([new Filter("employeeId", FilterOperator.EQ, employeeId)]);
            
            const contexts = await listBinding.requestContexts();
            return contexts.map((context: any) => context.getObject());
        } catch (error) {
            console.error(`Error loading current projects for ${employeeId}:`, error);
            return [];
        }
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
        const totalSkills = employees.reduce((sum: number, emp: any) => sum + (emp.totalSkills || 0), 0);
        
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
        
        updateControl("mtvTotalEmployeesCount", totalEmployees);
        updateControl("mtvAvailableEmployeesCount", availableEmployees);
        updateControl("mtvBusyEmployeesCount", busyEmployees);
        updateControl("totalSkillsCount", totalSkills);
        
        // Calculate utilization rate
        const utilizationRate = totalEmployees > 0 ? Math.round((busyEmployees / totalEmployees) * 100) : 0;
        updateControl("utilizationRate", utilizationRate + "%", "setText");
        updateControl("utilizationProgress", utilizationRate, "setPercentValue");
        
        // Calculate average skills per employee
        const avgSkills = totalEmployees > 0 ? Math.round(totalSkills / totalEmployees) : 0;
        updateControl("avgSkillsPerEmployee", avgSkills.toString(), "setText");
        
        // Calculate most common skill level based on actual skill data
        const skillsModel = this.getOwnerComponent()?.getModel("skills") as JSONModel;
        const allSkills = skillsModel?.getData()?.skills || [];
        const teamSkills = allSkills.filter((skill: any) => 
            employees.some((emp: any) => emp.id === skill.employeeId)
        );
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
        
        updateControl("mtvTotalEmployeesCount", 0);
        updateControl("mtvAvailableEmployeesCount", 0);
        updateControl("mtvBusyEmployeesCount", 0);
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
                caia: { utilized: 0, available: 0 },
                poc: { utilized: 0, available: 0 }
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
                caiaUtilization: await this.getCAIAUtilization(emp.employeeId),
                pocUtilization: await this.getPOCUtilization(emp.employeeId),
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
     * Calculate utilization metrics based on actual hours
     * Standard: 8 hours/day, 20 days/month = 160 hours/month per employee
     */
    private calculateUtilizationMetrics(allData: any[]): void {
        const totalEmployees = allData.length;
        const STANDARD_HOURS_PER_MONTH = 160; // 8 hours * 20 days
        
        // Get selected year and quarter from visualization model
        const visualizationModel = this.getView()?.getModel("visualization") as JSONModel;
        const selectedYear = visualizationModel?.getProperty("/selectedYear") || new Date().getFullYear();
        const selectedQuarter = visualizationModel?.getProperty("/selectedQuarter") || "ALL";
        
        console.log(`📊 Calculating utilization for Year: ${selectedYear}, Quarter: ${selectedQuarter}`);
        console.log("📊 All employee data:", allData);
        
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
        
        const monthsCount = monthsToInclude.length;
        const totalAvailableHours = totalEmployees * STANDARD_HOURS_PER_MONTH * monthsCount;
        
        console.log(`📊 Team: ${totalEmployees} employees, Months: ${monthsCount}, Available: ${totalAvailableHours} hours total`);

        // Calculate total hours utilized in current month for each type
        let currentProjectsHours = 0;
        let caiaHours = 0;
        let pocHours = 0;

        allData.forEach(empData => {
            console.log(`📊 Processing ${empData.employee?.employeeId}:`, {
                currentProjects: empData.currentProjects?.length || 0,
                caia: empData.caiaUtilization?.length || 0,
                poc: empData.pocUtilization?.length || 0
            });
            
            // Current Projects - convert hoursPerDay to monthly hours (hoursPerDay * 20 working days)
            empData.currentProjects.forEach((cp: any) => {
                const isActive = this.isActiveInPeriod(cp.startDate, cp.endDate, selectedYear, monthsToInclude);
                const hoursPerDay = parseFloat(cp.hoursPerDay) || 0;
                const activeMonths = this.countActiveMonths(cp.startDate, cp.endDate, selectedYear, monthsToInclude);
                const totalHours = hoursPerDay * 20 * activeMonths; // hours per active month
                console.log(`  📘 Current Project: ${cp.projectName}, Active: ${isActive}, Months: ${activeMonths}, Hours/Day: ${hoursPerDay}, Total Hours: ${totalHours}`);
                if (isActive) {
                    currentProjectsHours += totalHours;
                }
            });

            // CAIA Utilization - convert hoursPerDay to monthly hours
            empData.caiaUtilization.forEach((caia: any) => {
                const isActive = this.isActiveInPeriod(caia.startDate, caia.endDate, selectedYear, monthsToInclude);
                const hoursPerDay = parseFloat(caia.hoursPerDay) || 0;
                const activeMonths = this.countActiveMonths(caia.startDate, caia.endDate, selectedYear, monthsToInclude);
                const totalHours = hoursPerDay * 20 * activeMonths;
                console.log(`  🔬 CAIA: ${caia.taskName}, Active: ${isActive}, Months: ${activeMonths}, Hours/Day: ${hoursPerDay}, Total Hours: ${totalHours}`);
                if (isActive) {
                    caiaHours += totalHours;
                }
            });

            // POC Utilization - convert hoursPerDay to monthly hours
            empData.pocUtilization.forEach((poc: any) => {
                const isActive = this.isActiveInPeriod(poc.startDate, poc.endDate, selectedYear, monthsToInclude);
                const hoursPerDay = parseFloat(poc.hoursPerDay) || 0;
                const activeMonths = this.countActiveMonths(poc.startDate, poc.endDate, selectedYear, monthsToInclude);
                const totalHours = hoursPerDay * 20 * activeMonths;
                console.log(`  💡 POC: ${poc.pocTitle}, Active: ${isActive}, Months: ${activeMonths}, Hours/Day: ${hoursPerDay}, Total Hours: ${totalHours}`);
                if (isActive) {
                    pocHours += totalHours;
                }
            });
        });

        // Calculate percentages based on total available hours
        const currentProjectsUtilized = Math.min(100, Math.round((currentProjectsHours / totalAvailableHours) * 100));
        const caiaUtilized = Math.min(100, Math.round((caiaHours / totalAvailableHours) * 100));
        const pocUtilized = Math.min(100, Math.round((pocHours / totalAvailableHours) * 100));

        console.log(`📊 Hours: CP=${currentProjectsHours}h (${currentProjectsUtilized}%), CAIA=${caiaHours}h (${caiaUtilized}%), POC=${pocHours}h (${pocUtilized}%) of ${totalAvailableHours}h total`);

        // Update visualization model
        const vizModel = this.getView()?.getModel("visualization") as JSONModel;
        vizModel?.setProperty("/utilizationData", {
            currentProjects: {
                utilized: currentProjectsUtilized,
                available: 100 - currentProjectsUtilized,
                hours: currentProjectsHours
            },
            caia: {
                utilized: caiaUtilized,
                available: 100 - caiaUtilized,
                hours: caiaHours
            },
            poc: {
                utilized: pocUtilized,
                available: 100 - pocUtilized,
                hours: pocHours
            },
            totalAvailableHours: totalAvailableHours
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
            
            // Only show Current Projects (Utilization data)
            d.currentProjects.forEach((cp: any) => {
                if (!cp.startDate || !cp.endDate) return;
                
                const startDate = new Date(cp.startDate);
                const endDate = new Date(cp.endDate);
                startDate.setHours(0, 0, 0, 0);
                endDate.setHours(0, 0, 0, 0);
                
                // Filter by year
                if (startDate.getFullYear() !== selectedYear && endDate.getFullYear() !== selectedYear) return;
                
                // Determine project status based on dates
                let status = "scheduled";
                if (endDate < today) {
                    status = "finished"; // Completed projects - Blue
                } else if (startDate <= today && endDate >= today) {
                    status = "ongoing"; // Ongoing projects - Green
                } else if (startDate > today) {
                    status = "scheduled"; // Scheduled/Future projects - Orange
                }
                
                employeeData.projects.push({
                    projectName: cp.projectName,
                    startDate: cp.startDate,
                    endDate: cp.endDate,
                    status: status,
                    type: "Current Project"
                });
            });
            
            // Only add employee to gantt data if they have current projects
            if (employeeData.projects.length > 0) {
                ganttData.push(employeeData);
            }
        });
        
        visualizationModel?.setProperty("/ganttData", ganttData);
        console.log("📊 Gantt Data Generated:", ganttData.length, "employees with current projects");
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
        const caiaUtilized = utilizationData.caia?.utilized || 0;
        const caiaAvailable = utilizationData.caia?.available || 100;
        const pocUtilized = utilizationData.poc?.utilized || 0;
        const pocAvailable = utilizationData.poc?.available || 100;
        
        (this.byId("mtvCurrentProjectsUtilized") as any)?.setText(`${currentProjectsUtilized}%`);
        (this.byId("mtvCurrentProjectsAvailable") as any)?.setText(`${currentProjectsAvailable}%`);
        (this.byId("mtvCaiaUtilized") as any)?.setText(`${caiaUtilized}%`);
        (this.byId("mtvCaiaAvailable") as any)?.setText(`${caiaAvailable}%`);
        (this.byId("mtvPocUtilized") as any)?.setText(`${pocUtilized}%`);
        (this.byId("mtvPocAvailable") as any)?.setText(`${pocAvailable}%`);
        
        console.log(`📊 Rendering charts - CP: ${currentProjectsUtilized}%, CAIA: ${caiaUtilized}%, POC: ${pocUtilized}%`);
        
        // Render SVG donut charts
        this.renderDonutChart("mtvCurrentProjectsChart", currentProjectsUtilized, "#0070f2");
        this.renderDonutChart("mtvCaiaChart", caiaUtilized, "#f39c12");
        this.renderDonutChart("mtvPocChart", pocUtilized, "#2ecc71");
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
        const container = this.byId("mtvSkillsDistributionChart");
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
        
        const container = this.byId("mtvGanttChartContainer");
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
        
        empData.projects.forEach((project: any) => {
            const startDate = new Date(project.startDate);
            const endDate = new Date(project.endDate);
            
            // Get month and day information
            const startMonth = startDate.getMonth();
            const endMonth = endDate.getMonth();
            const startDay = startDate.getDate();
            const endDay = endDate.getDate();
            
            // Check if project overlaps with selected months
            const startIndex = monthNumbers.indexOf(startMonth);
            const endIndex = monthNumbers.indexOf(endMonth);
            
            if (startIndex === -1 && endIndex === -1) return; // Skip if not in range
            
            // Calculate precise position with day-level accuracy
            let leftPercent = 0;
            let widthPercent = 0;
            
            if (startIndex !== -1 && endIndex !== -1) {
                // Both start and end are in visible range
                const daysInStartMonth = new Date(startDate.getFullYear(), startMonth + 1, 0).getDate();
                const daysInEndMonth = new Date(endDate.getFullYear(), endMonth + 1, 0).getDate();
                
                // Calculate left position: which month + day offset within that month
                const dayOffsetInStartMonth = (startDay - 1) / daysInStartMonth; // 0 to 1
                leftPercent = ((startIndex + dayOffsetInStartMonth) / totalMonths) * 100;
                
                // Calculate width: number of months spanned + day fractions
                const monthsSpanned = endIndex - startIndex;
                const endDayFraction = endDay / daysInEndMonth; // 0 to 1
                
                if (monthsSpanned === 0) {
                    // Same month - just calculate days between
                    const daysSpanned = endDay - startDay + 1;
                    widthPercent = ((daysSpanned / daysInStartMonth) / totalMonths) * 100;
                } else {
                    // Multiple months - calculate total width including partial months
                    // Width = (remaining days in start month + full months between + days in end month) / total months
                    const startDayFraction = (daysInStartMonth - startDay + 1) / daysInStartMonth;
                    widthPercent = ((startDayFraction + (monthsSpanned - 1) + endDayFraction) / totalMonths) * 100;
                }
            } else if (startIndex !== -1) {
                // Only start is visible, extends beyond visible range
                const daysInStartMonth = new Date(startDate.getFullYear(), startMonth + 1, 0).getDate();
                const dayOffsetInStartMonth = (startDay - 1) / daysInStartMonth;
                leftPercent = ((startIndex + dayOffsetInStartMonth) / totalMonths) * 100;
                widthPercent = ((totalMonths - startIndex - dayOffsetInStartMonth) / totalMonths) * 100;
            } else if (endIndex !== -1) {
                // Only end is visible, starts before visible range
                const daysInEndMonth = new Date(endDate.getFullYear(), endMonth + 1, 0).getDate();
                const endDayFraction = endDay / daysInEndMonth;
                leftPercent = 0;
                widthPercent = ((endIndex + endDayFraction) / totalMonths) * 100;
            }
            
            const colorClass = project.status; // ongoing, finished, scheduled
            
            barsHtml += `
                <div class="ganttBar ${colorClass}" 
                     style="left: ${leftPercent}%; width: ${widthPercent}%;"
                     title="${project.projectName} (${project.startDate} to ${project.endDate})">
                    <span class="ganttBarLabel">${project.projectName}</span>
                </div>
            `;
        });
        
        const monthCells = monthNumbers.map(() => '<div class="ganttMonth"></div>').join('');
        
        return `
            <div class="ganttRow">
                <div class="ganttLabel" title="${empData.employeeId}">${empData.employeeName}</div>
                <div class="ganttTimeline">
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
        const yearSelect = this.byId("mtvYearFilter") as Select;
        const quarterSelect = this.byId("mtvQuarterFilter") as Select;
        
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
    public formatUtilizationPercent(hoursPerDay: number): string {
        if (!hoursPerDay || hoursPerDay === 0) {
            return "0%";
        }
        
        // Calculate utilization percentage: (hours worked / 8 hours) * 100
        const percentage = Math.round((hoursPerDay / 8) * 100);
        return `${percentage}%`;
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
        
        const managerSelectorBox = this.byId("mtvManagerSelectorBox") as any;
        
        if (selectedKey === "ByManager") {
            // Show manager selector dropdown
            managerSelectorBox?.setVisible(true);
        } else {
            // Hide manager selector dropdown
            managerSelectorBox?.setVisible(false);
        }
    }

    public async onSearchEmployees(): Promise<void> {
        const multiInput = this.byId("mtvSkillsSearchInput") as MultiInput;
        const scopeSelect = this.byId("mtvSearchScope") as Select;
        const experienceSelect = this.byId("mtvExperienceLevel") as Select;
        const roleSelect = this.byId("mtvRoleFilter") as Select;
        const managerSelector = this.byId("mtvManagerSelector") as Select;
        
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

        // Use the viewed manager's ID (not the currently logged-in senior manager)
        const viewedManagerId = this.currentManagerId;
        const currentUserModel = this.getOwnerComponent()?.getModel("currentUser") as JSONModel;
        const currentUser = currentUserModel?.getData();

        console.log("Search parameters:", { searchSkills, searchScope, experienceLevel, roleFilter, viewedManagerId });

        try {
            let allEmployees: any[] = [];
            
            // Load employees based on search scope from OData
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            
            if (searchScope === "MyTeam") {
                // Load only the viewed manager's team employees
                const listBinding = oDataModel.bindList("/Employees");
                listBinding.filter([new Filter("managerId", FilterOperator.EQ, viewedManagerId)]);
                
                const contexts = await listBinding.requestContexts();
                allEmployees = contexts.map((context: any) => context.getObject());
                console.log(`Searching in My Team (${viewedManagerId}): ${allEmployees.length} employees`);
                
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
            console.log(`Employee ${emp.employeeId} match score: ${matchScore}%`, result);
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
        const searchResultsPanel = this.byId("mtvSearchResultsPanel") as any;
        const searchResultsTable = this.byId("mtvSearchResultsTable") as Table;

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
        const searchResultsPanel = this.byId("mtvSearchResultsPanel") as any;
        if (searchResultsPanel) {
            searchResultsPanel.setVisible(false);
        }

        // Clear search results model
        const resultsModel = new JSONModel({ results: [] });
        this.getView()?.setModel(resultsModel, "searchResults");

        // Clear search input tokens
        const multiInput = this.byId("mtvSkillsSearchInput") as MultiInput;
        if (multiInput) {
            multiInput.removeAllTokens();
            multiInput.setValue("");
        }

        // Reset search scope to default (My Team)
        const scopeSelect = this.byId("mtvSearchScope") as Select;
        if (scopeSelect) {
            scopeSelect.setSelectedKey("MyTeam");
        }

        // Hide manager selector box
        const managerSelectorBox = this.byId("mtvManagerSelectorBox") as any;
        if (managerSelectorBox) {
            managerSelectorBox.setVisible(false);
        }

        // Reset experience level to default (empty)
        const experienceSelect = this.byId("mtvExperienceLevel") as Select;
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
        this.openEmployeeDetailsDialog(result, true);
    }

    private async openEmployeeDetailsDialog(employee: any, isSearchResult: boolean): Promise<void> {
        // Get dialog reference
        const dialog = this.byId("mtvEmployeeDetailsDialog") as any;
        if (!dialog) {
            MessageToast.show("Dialog not found");
            return;
        }

        // Use employeeId or id for backward compatibility
        const empId = employee.employeeId || employee.id;

        console.log(`📋 Loading comprehensive details for employee: ${empId}`);

        try {
            // Load all data from OData in parallel
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            
            const [employeeData, profileData, skills, projects, currentProjects, caiaUtilization, pocUtilization, certifications] = await Promise.all([
                this.loadEmployeeData(empId),
                this.loadProfileData(empId),
                this.getEmployeeSkills(empId),
                this.getEmployeeProjects(empId),
                this.getCurrentProjects(empId),
                this.getCAIAUtilization(empId),
                this.getPOCUtilization(empId),
                this.getCertifications(empId)
            ]);

            console.log("✅ All employee data loaded:", { employeeData, profileData, skills, projects, currentProjects, caiaUtilization, pocUtilization, certifications });

            // Merge all data
            const completeData = {
                ...employeeData,
                ...profileData,
                skills: skills,
                projects: projects,
                currentProjects: currentProjects,
                caiaUtilization: caiaUtilization,
                pocUtilization: pocUtilization,
                certifications: certifications
            };

            // Create model for employee details
            const detailsModel = new JSONModel(completeData);
            this.getView()?.setModel(detailsModel, "employeeDetails");

            // Populate basic information fields
            (this.byId("mtvDialogEmployeeName") as any)?.setText(employeeData.name || '');
            (this.byId("mtvDialogEmployeeId") as any)?.setText(employeeData.employeeId || '');
            (this.byId("mtvDialogEmployeeEmail") as any)?.setText(employeeData.email || '');
            (this.byId("mtvDialogEmployeeTeam") as any)?.setText(employeeData.team || '');
            (this.byId("mtvDialogEmployeeSpecialization") as any)?.setText(employeeData.specialization || '');
            (this.byId("mtvDialogEmployeeManager") as any)?.setText(employeeData.managerId || '');

            // Populate professional details
            (this.byId("mtvDialogEmployeeRole") as any)?.setText(profileData.role || 'N/A');
            (this.byId("mtvDialogEmployeeLocation") as any)?.setText(profileData.location || 'N/A');
            (this.byId("mtvDialogEmployeeTLevel") as any)?.setText(profileData.tLevel || 'N/A');
            (this.byId("mtvDialogEmployeeLastUpdated") as any)?.setText(profileData.lastUpdated ? new Date(profileData.lastUpdated).toLocaleDateString() : 'N/A');

            // Populate current status
            const statusText = this.formatWorkingStatus(employee.working_on_project);
            const statusState = this.formatWorkingStatusState(employee.working_on_project);
            (this.byId("mtvDialogWorkStatus") as any)?.setText(statusText);
            (this.byId("mtvDialogWorkStatus") as any)?.setState(statusState);

            // Count active current projects (with today's date in range)
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const activeProjects = currentProjects.filter((cp: any) => {
                if (!cp.startDate || !cp.endDate) return false;
                const startDate = new Date(cp.startDate);
                const endDate = new Date(cp.endDate);
                startDate.setHours(0, 0, 0, 0);
                endDate.setHours(0, 0, 0, 0);
                return today >= startDate && today <= endDate;
            });

            (this.byId("mtvDialogActiveProjects") as any)?.setNumber(activeProjects.length);
            (this.byId("mtvDialogActiveProjects") as any)?.setUnit(activeProjects.length === 1 ? "project" : "projects");

            // Update skills count
            (this.byId("mtvDialogTotalSkills") as any)?.setNumber(skills.length);
            (this.byId("mtvDialogTotalSkills") as any)?.setUnit(skills.length === 1 ? "skill" : "skills");

            // Update projects count
            (this.byId("mtvDialogTotalProjects") as any)?.setNumber(projects.length);
            (this.byId("mtvDialogTotalProjects") as any)?.setUnit(projects.length === 1 ? "project" : "projects");

            // Update certifications count (in Skills tab)
            (this.byId("mtvDialogTotalCertifications") as any)?.setNumber(certifications.length);
            (this.byId("mtvDialogTotalCertifications") as any)?.setUnit(certifications.length === 1 ? "certification" : "certifications");

            // Update certifications count (in Certifications tab)
            (this.byId("mtvDialogTotalCertificationsTab") as any)?.setNumber(certifications.length);
            (this.byId("mtvDialogTotalCertificationsTab") as any)?.setUnit(certifications.length === 1 ? "certification" : "certifications");

            // Handle match information for search results
            const matchTab = this.byId("mtvDialogMatchTab") as any;
            if (isSearchResult && employee.matchScore !== undefined) {
                matchTab?.setVisible(true);
                
                // Set match score progress indicator
                const matchScoreControl = this.byId("mtvDialogMatchScore") as any;
                if (matchScoreControl) {
                    matchScoreControl.setPercentValue(employee.matchScore);
                    matchScoreControl.setDisplayValue(employee.matchScore + "%");
                    matchScoreControl.setState(this.formatMatchScoreState(employee.matchScore));
                }
                
                // Set match level text (Excellent/Good/Partial/Low Match)
                const matchLevelControl = this.byId("mtvDialogMatchLevel") as any;
                if (matchLevelControl) {
                    const matchLevelText = this.formatMatchScoreText(employee.matchScore);
                    matchLevelControl.setText(matchLevelText);
                    matchLevelControl.setState(this.formatMatchScoreState(employee.matchScore));
                }
                
                // Set matching skills text
                (this.byId("mtvDialogMatchingSkills") as any)?.setText(employee.matchingSkills || "N/A");
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
     * Get CAIA utilization records for an employee
     */
    private async getCAIAUtilization(employeeId: string): Promise<any[]> {
        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            const listBinding = oDataModel.bindList("/CAIAUtilization");
            listBinding.filter([new Filter("employeeId", FilterOperator.EQ, employeeId)]);
            
            const contexts = await listBinding.requestContexts();
            return contexts.map((context: any) => context.getObject());
        } catch (error) {
            console.error(`Error loading CAIA utilization for ${employeeId}:`, error);
            return [];
        }
    }

    /**
     * Get POC utilization records for an employee
     */
    private async getPOCUtilization(employeeId: string): Promise<any[]> {
        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            const listBinding = oDataModel.bindList("/POCUtilization");
            listBinding.filter([new Filter("employeeId", FilterOperator.EQ, employeeId)]);
            
            const contexts = await listBinding.requestContexts();
            return contexts.map((context: any) => context.getObject());
        } catch (error) {
            console.error(`Error loading POC utilization for ${employeeId}:`, error);
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
        const employeeName = (this.byId("mtvDialogEmployeeName") as any).getText();
        MessageToast.show(`Contacting ${employeeName}...`);
        // TODO: Implement actual contact functionality (email, teams, etc.)
    }

    public onCloseEmployeeDialog(): void {
        const dialog = this.byId("mtvEmployeeDetailsDialog") as any;
        if (dialog) {
            dialog.close();
        }
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
        const dialog = this.byId("mtvAnalyticsListDialog") as any;
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
        const analyticsDialog = this.byId("mtvAnalyticsListDialog") as any;
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
        const dialog = this.byId("mtvAnalyticsListDialog") as any;
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

        const response = await fetch("/odata/v4/skillsphere/managerQuery", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify({
                managerId: this.managerId,
                queryType: "general",
                context: query
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("❌ Server response:", errorText);
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
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
        
        const oMessageBox = new HBox({
            justifyContent: "Start",
            items: [
                new VBox({
                    items: [
                        new Text({
                            text: message,
                            renderWhitespace: true
                        }).addStyleClass("botMessage sapUiSmallMargin")
                    ]
                }).addStyleClass("messageBox botMessageBox")
            ]
        }).addStyleClass("sapUiTinyMarginTop");
        
        oContainer?.addItem(oMessageBox);
        this.scrollToBottom();
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
    
}
