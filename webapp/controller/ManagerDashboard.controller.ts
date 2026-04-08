import Fragment from "sap/ui/core/Fragment";
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
export default class ManagerDashboard extends Controller {

    private currentManagerId: string | null = null;
    private currentDialogEmployeeId: string = "";
    private managerAddProjectDialog?: Dialog;

    public onInit(): void {
        const router = this.getRouter();
        router.getRoute("ManagerDashboard")?.attachPatternMatched(this.onRouteMatched, this);
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
        
        console.log("Route matched for manager:", managerId);
        
        // ALWAYS scroll to top when dashboard loads
        window.scrollTo({ top: 0, behavior: 'auto' });
        
        // Clear previous search results when switching managers
        this.clearSearchResults();
        
        // Check if manager is already logged in
        const currentUserModel = this.getOwnerComponent()?.getModel("currentUser") as JSONModel;
        const currentUser = currentUserModel?.getData();
        
        // If no manager is logged in but we have a managerId from route, restore session
        if ((!currentUser?.isLoggedIn || !currentUser?.id) && managerId) {
            console.log("Restoring manager session from route parameter:", managerId);
            await this.restoreManagerSession(managerId);
        } else if (!currentUser?.isLoggedIn && !managerId) {
            // No session and no route parameter - redirect to login
            console.log("No manager session found, redirecting to login");
            MessageToast.show("Please login to access the dashboard");
            this.getRouter().navTo("Landing");
            return;
        }
        
        // Set current manager ID
        this.currentManagerId = managerId || currentUser?.id;
        
        // Load manager-specific data
        await this.loadManagerData();
    }

    /**
     * Restore manager session from managerId using OData
     */
    private async restoreManagerSession(managerId: string): Promise<void> {
        console.log("📊 Restoring manager session for:", managerId);
        
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
                console.log("✅ Manager data loaded from OData:", manager);
                
                // Restore currentUser model
                const currentUserModel = this.getOwnerComponent()?.getModel("currentUser") as JSONModel;
                currentUserModel?.setData({
                    id: manager.employeeId,
                    name: manager.name,
                    role: 'Manager',
                    team: manager.team,
                    subTeam: manager.subTeam,
                    email: manager.email,
                    managerId: manager.employeeId,
                    isLoggedIn: true
                });
                
                console.log("✅ Manager session restored successfully");
            } else {
                console.error("Manager not found:", managerId);
                MessageToast.show("Manager information not found. Please login again.");
                this.getRouter().navTo("Landing");
            }
        } catch (error) {
            console.error("❌ Error restoring manager session:", error);
            MessageToast.show("Error loading manager data. Please login again.");
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

        // Calculate average utilization percentages for each type
        let currentProjectsTotal = 0;
        let currentProjectsCount = 0;
        let initiativesTotal = 0;
        let initiativesCount = 0;

        allData.forEach(empData => {
            console.log(`📊 Processing ${empData.employee?.employeeId}:`, {
                currentProjects: empData.currentProjects?.length || 0
            });
            
            // Separate by type from CurrentProjects
            const projects = empData.currentProjects.filter((cp: any) => cp.type === 'Project');
            const initiatives = empData.currentProjects.filter((cp: any) => 
                cp.type === 'Initiative' || cp.type === 'Evaluation' || cp.type === 'CAIA' || cp.type === 'POC'
            );
            
            // Projects - use utilizationPercent directly
            projects.forEach((cp: any) => {
                const isActive = this.isActiveInPeriod(cp.startDate, cp.endDate, selectedYear, monthsToInclude);
                const utilizationPercent = parseInt(cp.utilizationPercent) || 0;
                const activeMonths = this.countActiveMonths(cp.startDate, cp.endDate, selectedYear, monthsToInclude);
                console.log(`  📘 Project: ${cp.projectName}, Active: ${isActive}, Months: ${activeMonths}, Utilization: ${utilizationPercent}%`);
                if (isActive && utilizationPercent > 0) {
                    currentProjectsTotal += utilizationPercent;
                    currentProjectsCount++;
                }
            });

            // Initiatives - use utilizationPercent directly
            initiatives.forEach((initiative: any) => {
                const isActive = this.isActiveInPeriod(initiative.startDate, initiative.endDate, selectedYear, monthsToInclude);
                const utilizationPercent = parseInt(initiative.utilizationPercent) || 0;
                const activeMonths = this.countActiveMonths(initiative.startDate, initiative.endDate, selectedYear, monthsToInclude);
                console.log(`  🎯 Initiative: ${initiative.projectName}, Active: ${isActive}, Months: ${activeMonths}, Utilization: ${utilizationPercent}%`);
                if (isActive && utilizationPercent > 0) {
                    initiativesTotal += utilizationPercent;
                    initiativesCount++;
                }
            });
        });

        // Calculate average percentages
        const currentProjectsUtilized = currentProjectsCount > 0 ? Math.round(currentProjectsTotal / currentProjectsCount) : 0;
        const initiativesUtilized = initiativesCount > 0 ? Math.round(initiativesTotal / initiativesCount) : 0;

        console.log(`📊 Utilization: CP=${currentProjectsUtilized}% (${currentProjectsCount} projects), Initiatives=${initiativesUtilized}% (${initiativesCount} initiatives)`);

        // Update visualization model
        const vizModel = this.getView()?.getModel("visualization") as JSONModel;
        vizModel?.setProperty("/utilizationData", {
            currentProjects: {
                utilized: currentProjectsUtilized,
                available: 100 - currentProjectsUtilized,
                count: currentProjectsCount
            },
            initiatives: {
                utilized: initiativesUtilized,
                available: 100 - initiativesUtilized,
                count: initiativesCount
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
                let status = "scheduled";
                if (endDate < today) {
                    status = "finished"; // Completed projects
                } else if (startDate <= today && endDate >= today) {
                    status = "ongoing"; // Ongoing projects
                } else if (startDate > today) {
                    status = "scheduled"; // Scheduled/Future projects
                }
                
                employeeData.projects.push({
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
                let status = "scheduled";
                if (endDate < today) {
                    status = "finished";
                } else if (startDate <= today && endDate >= today) {
                    status = "ongoing";
                } else if (startDate > today) {
                    status = "scheduled";
                }
                
                // All initiatives/evaluations — always orange regardless of status
                const color = "#f39c12";
                const typeLabel = init.type || "Initiative";
                
                employeeData.projects.push({
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
                const status = endDate < today ? "finished" : (startDate <= today ? "ongoing" : "scheduled");

                employeeData.projects.push({
                    projectName: proj.projectName,
                    startDate: proj.startDate,
                    endDate: proj.endDate,
                    status: status,
                    type: "ProjectHistory",
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

        // Generate bar HTML — keep status-based color, stack overlapping bars vertically
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
                    <span class="ganttBarLabel">${project.projectName}</span>
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
            // Load all data from OData in parallel
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            
            const [employeeData, profileData, skills, projects, currentProjects, initiatives, certifications] = await Promise.all([
                this.loadEmployeeData(empId),
                this.loadProfileData(empId),
                this.getEmployeeSkills(empId),
                this.getEmployeeProjects(empId),
                this.getCurrentProjects(empId),
                this.getInitiatives(empId),
                this.getCertifications(empId)
            ]);

            console.log("✅ All employee data loaded:", { employeeData, profileData, skills, projects, currentProjects, initiatives, certifications });

            // Merge all data
            const completeData = {
                ...employeeData,
                ...profileData,
                skills: skills,
                projects: projects,
                currentProjects: currentProjects,
                initiatives: initiatives,
                certifications: certifications,
                assignments: currentProjects // Assignments are the current projects (includes all statuses)
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

            // Populate current status
            const statusText = this.formatWorkingStatus(employee.working_on_project);
            const statusState = this.formatWorkingStatusState(employee.working_on_project);
            (this.byId("dialogWorkStatus") as any)?.setText(statusText);
            (this.byId("dialogWorkStatus") as any)?.setState(statusState);

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

            (this.byId("dialogActiveProjects") as any)?.setNumber(activeProjects.length);
            (this.byId("dialogActiveProjects") as any)?.setUnit(activeProjects.length === 1 ? "project" : "projects");

            // Update skills count
            (this.byId("dialogTotalSkills") as any)?.setNumber(skills.length);
            (this.byId("dialogTotalSkills") as any)?.setUnit(skills.length === 1 ? "skill" : "skills");

            // Update projects count
            (this.byId("dialogTotalProjects") as any)?.setNumber(projects.length);
            (this.byId("dialogTotalProjects") as any)?.setUnit(projects.length === 1 ? "project" : "projects");

            // Update certifications count (in Skills tab)
            (this.byId("dialogTotalCertifications") as any)?.setNumber(certifications.length);
            (this.byId("dialogTotalCertifications") as any)?.setUnit(certifications.length === 1 ? "certification" : "certifications");

            // Update certifications count (in Certifications tab)
            (this.byId("dialogTotalCertificationsTab") as any)?.setNumber(certifications.length);
            (this.byId("dialogTotalCertificationsTab") as any)?.setUnit(certifications.length === 1 ? "certification" : "certifications");

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
            const listBinding = oDataModel.bindList("/Initiatives");
            listBinding.filter([new Filter("employeeId", FilterOperator.EQ, employeeId)]);
            
            const contexts = await listBinding.requestContexts();
            return contexts.map((context: any) => context.getObject());
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
            "Pending": "Warning",
            "Rejected": "Error"
        };
        return stateMap[status] || "None";
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
            const managersBinding = oDataModel.bindList("/Managers");
            managersBinding.filter([new Filter("managerId", FilterOperator.EQ, this.currentManagerId)]);
            
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
            const managersBinding = oDataModel.bindList("/Managers");
            
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
            const projectId = `PROJ_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // Create project in Projects master data
            const listBinding = oDataModel.bindList("/Projects");
            listBinding.create({
                projectId: projectId,
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
            });

            // Also create assignment in CurrentProjects for Gantt Chart visibility
            const currentProjectsBinding = oDataModel.bindList("/CurrentProjects");
            currentProjectsBinding.create({
                currentProjectId: `CP_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                employeeId: employeeId,
                type: "Project",
                projectName: data.projectName,
                role: data.role || "Team Member",
                projectManager: data.projectManager || "",
                startDate: startDateISO,
                endDate: endDateISO,
                utilizationPercent: data.utilizationPercent || 100,
                description: data.description || "",
                assignmentStatus: "Accepted", // Directly assigned by manager
                assignedBy: this.currentManagerId,
                isEvaluation: false,
                technology: data.technology || "",
                createdAt: new Date().toISOString(),
                lastUpdated: new Date().toISOString()
            });

            await oDataModel.submitBatch(oDataModel.getUpdateGroupId());
            await new Promise(resolve => setTimeout(resolve, 600));

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

    public async onAssignProjectToEmployee(employeeId: string, projectId: string): Promise<void> {
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
            
            // Create assignment in CurrentProjects with Pending status
            const currentProjectsBinding = oDataModel.bindList("/CurrentProjects");
            currentProjectsBinding.create({
                currentProjectId: `ASSIGN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                employeeId: employeeId,
                type: "Project",
                projectName: project.projectName,
                role: "", // Employee will set this when accepting
                projectManager: project.projectManager || "",
                startDate: project.startDate,
                endDate: project.endDate,
                utilizationPercent: 100, // Default, employee can change
                description: project.description || "",
                assignmentStatus: "Pending",
                assignedBy: this.currentManagerId,
                isEvaluation: false,
                createdAt: new Date().toISOString(),
                lastUpdated: new Date().toISOString()
            });
            
            await oDataModel.submitBatch(oDataModel.getUpdateGroupId());
            await new Promise(resolve => setTimeout(resolve, 500));
            
            MessageToast.show(`Project "${project.projectName}" assigned to employee. Status: Pending acceptance.`);
            
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
        
        // Call the assignment method
        await this.onAssignProjectToEmployee(this.currentDialogEmployeeId, selectedKey);
        
        // Clear the selection
        comboBox.setSelectedKey("");
        
        // Refresh the assignments table
        await this.refreshEmployeeAssignments(this.currentDialogEmployeeId);
    }

    // Refresh assignments table in employee details dialog
    private async refreshEmployeeAssignments(employeeId: string): Promise<void> {
        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            
            // Get all assignments for this employee
            const binding = oDataModel.bindList("/CurrentProjects");
            binding.filter([new Filter("employeeId", FilterOperator.EQ, employeeId)]);
            const contexts = await binding.requestContexts();
            const assignments = contexts.map((ctx: any) => ctx.getObject());
            
            // Update the model
            const detailsModel = this.getView()?.getModel("employeeDetails") as JSONModel;
            if (detailsModel) {
                detailsModel.setProperty("/assignments", assignments);
            }
            
        } catch (error) {
            console.error("❌ Error refreshing assignments:", error);
        }
    }

}
