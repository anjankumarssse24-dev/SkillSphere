import Controller from "sap/ui/core/mvc/Controller";
import MessageToast from "sap/m/MessageToast";
import JSONModel from "sap/ui/model/json/JSONModel";
import Token from "sap/m/Token";
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";
import HTML from "sap/ui/core/HTML";
import Text from "sap/m/Text";
import VBox from "sap/m/VBox";
import HBox from "sap/m/HBox";
import ProgressIndicator from "sap/m/ProgressIndicator";
/**
 * @namespace skillsphere.controller
 */
export default class ManagerTeamView extends Controller {
    currentManagerId = null;
    seniorManagerId = null;
    onInit() {
        const router = this.getRouter();
        router.getRoute("ManagerTeamView")?.attachPatternMatched(this.onRouteMatched, this);
    }
    getRouter() {
        return this.getOwnerComponent().getRouter();
    }
    onLogout() {
        // Clear search results before logout
        this.clearSearchResults();
        // Clear current user data
        const currentUserModel = this.getOwnerComponent()?.getModel("currentUser");
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
    async onRouteMatched(event) {
        // Get route parameters
        const args = event.getParameter("arguments");
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
        const currentUserModel = this.getOwnerComponent()?.getModel("currentUser");
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
    async loadManagerInfo(managerId) {
        console.log("📊 Loading manager information for:", managerId);
        try {
            const oDataModel = this.getOwnerComponent()?.getModel();
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
            }
            else {
                console.error("Manager not found:", managerId);
                MessageToast.show("Manager information not found");
            }
        }
        catch (error) {
            console.error("❌ Error loading manager info:", error);
            MessageToast.show("Error loading manager information");
        }
    }
    /**
     * Navigate back to Senior Manager Dashboard
     */
    onBackToDashboard() {
        const currentUserModel = this.getOwnerComponent()?.getModel("currentUser");
        const currentUser = currentUserModel?.getData();
        const seniorMgrId = this.seniorManagerId || currentUser?.id;
        console.log("📌 Navigating back to Senior Manager Dashboard:", seniorMgrId);
        if (seniorMgrId) {
            this.getRouter().navTo("SeniorManagerDashboard", { seniorManagerId: seniorMgrId });
        }
        else {
            // Fallback to landing page if no senior manager ID
            this.getRouter().navTo("Landing");
        }
    }
    async loadManagerData() {
        // Get current manager's information
        const currentUserModel = this.getOwnerComponent()?.getModel("currentUser");
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
            const oDataModel = this.getOwnerComponent()?.getModel();
            const listBinding = oDataModel.bindList("/Employees");
            listBinding.filter([new Filter("managerId", FilterOperator.EQ, currentManagerId)]);
            const contexts = await listBinding.requestContexts();
            const employees = contexts.map((context) => context.getObject());
            console.log(`✅ Loaded ${employees.length} employees from OData for manager ${currentManagerId}`);
            console.log("📊 Sample employee data:", employees[0]); // Debug: Check what fields are loaded
            // Load skills, profile and current projects for each employee
            const enrichedEmployees = await Promise.all(employees.map(async (emp) => {
                const empSkills = await this.getEmployeeSkills(emp.employeeId);
                const empProjects = await this.getEmployeeProjects(emp.employeeId);
                const currentProjects = await this.getCurrentProjects(emp.employeeId);
                const empProfile = await this.getEmployeeProfile(emp.employeeId);
                // Check if employee is working on a project TODAY
                const today = new Date();
                today.setHours(0, 0, 0, 0); // Reset time to midnight for date comparison
                const workingOnProject = currentProjects.some((cp) => {
                    if (!cp.startDate || !cp.endDate)
                        return false;
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
            enrichedEmployees.sort((a, b) => {
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
        }
        catch (error) {
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
    async loadAllManagers() {
        try {
            const oDataModel = this.getOwnerComponent()?.getModel();
            const listBinding = oDataModel.bindList("/Managers");
            const contexts = await listBinding.requestContexts();
            const allManagers = contexts.map((context) => context.getObject());
            console.log(`✅ Loaded ${allManagers.length} managers for search dropdown`);
            // Create managers model for the dropdown
            const managersModel = new JSONModel({ managers: allManagers });
            this.getView()?.setModel(managersModel, "managers");
        }
        catch (error) {
            console.error("❌ Error loading managers:", error);
            // Set empty model on error
            const emptyManagersModel = new JSONModel({ managers: [] });
            this.getView()?.setModel(emptyManagersModel, "managers");
        }
    }
    /**
     * Get employee skills from OData
     */
    async getEmployeeSkills(employeeId) {
        try {
            const oDataModel = this.getOwnerComponent()?.getModel();
            const listBinding = oDataModel.bindList("/Skills");
            listBinding.filter([new Filter("employeeId", FilterOperator.EQ, employeeId)]);
            const contexts = await listBinding.requestContexts();
            return contexts.map((context) => context.getObject());
        }
        catch (error) {
            console.error(`Error loading skills for ${employeeId}:`, error);
            return [];
        }
    }
    /**
     * Get employee projects from OData
     */
    async getEmployeeProjects(employeeId) {
        try {
            const oDataModel = this.getOwnerComponent()?.getModel();
            const listBinding = oDataModel.bindList("/Projects");
            listBinding.filter([new Filter("employeeId", FilterOperator.EQ, employeeId)]);
            const contexts = await listBinding.requestContexts();
            return contexts.map((context) => context.getObject());
        }
        catch (error) {
            console.error(`Error loading projects for ${employeeId}:`, error);
            return [];
        }
    }
    /**
     * Get employee profile from OData
     */
    async getEmployeeProfile(employeeId) {
        try {
            const oDataModel = this.getOwnerComponent()?.getModel();
            const listBinding = oDataModel.bindList("/Profiles");
            listBinding.filter([new Filter("employeeId", FilterOperator.EQ, employeeId)]);
            const contexts = await listBinding.requestContexts();
            const profiles = contexts.map((context) => context.getObject());
            return profiles.length > 0 ? profiles[0] : null;
        }
        catch (error) {
            console.error(`Error loading profile for ${employeeId}:`, error);
            return null;
        }
    }
    /**
     * Get current projects (utilization) for an employee
     */
    async getCurrentProjects(employeeId) {
        try {
            const oDataModel = this.getOwnerComponent()?.getModel();
            const listBinding = oDataModel.bindList("/CurrentProjects");
            listBinding.filter([new Filter("employeeId", FilterOperator.EQ, employeeId)]);
            const contexts = await listBinding.requestContexts();
            return contexts.map((context) => context.getObject());
        }
        catch (error) {
            console.error(`Error loading current projects for ${employeeId}:`, error);
            return [];
        }
    }
    updateAnalytics() {
        // Get employees from the manager-specific model (already filtered)
        const managerEmployeesModel = this.getView()?.getModel("managerEmployees");
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
        const availableEmployees = employees.filter((emp) => !emp.working_on_project).length;
        const busyEmployees = employees.filter((emp) => emp.working_on_project).length;
        const totalSkills = employees.reduce((sum, emp) => sum + (emp.totalSkills || 0), 0);
        // Update statistics controls with error checking
        const updateControl = (id, value, method = 'setNumber') => {
            const control = this.byId(id);
            if (control) {
                if (method === 'setNumber') {
                    control.setNumber(value);
                }
                else if (method === 'setText') {
                    control.setText(value.toString());
                }
                else if (method === 'setPercentValue') {
                    control.setPercentValue(value);
                }
            }
            else {
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
        const skillsModel = this.getOwnerComponent()?.getModel("skills");
        const allSkills = skillsModel?.getData()?.skills || [];
        const teamSkills = allSkills.filter((skill) => employees.some((emp) => emp.id === skill.employeeId));
        const commonLevel = this.getCommonSkillLevel(teamSkills);
        updateControl("commonSkillLevel", commonLevel, "setText");
        console.log("Analytics updated for manager's team:", {
            totalEmployees, availableEmployees, busyEmployees, totalSkills,
            utilizationRate, avgSkills, commonLevel
        });
    }
    setAnalyticsDefaults() {
        const updateControl = (id, value, method = 'setNumber') => {
            const control = this.byId(id);
            if (control) {
                if (method === 'setNumber') {
                    control.setNumber(value);
                }
                else if (method === 'setText') {
                    control.setText(value.toString());
                }
                else if (method === 'setPercentValue') {
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
    getCommonSkillLevel(skills) {
        if (skills.length === 0)
            return "N/A";
        const levelCounts = {};
        skills.forEach((skill) => {
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
    async initializeVisualization() {
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
    async loadVisualizationData() {
        try {
            const managerEmployeesModel = this.getView()?.getModel("managerEmployees");
            const employees = managerEmployeesModel?.getData()?.employees || [];
            if (employees.length === 0) {
                console.warn("No employees loaded for visualization");
                return;
            }
            console.log(`📊 Loading visualization data for ${employees.length} employees`);
            // Load utilization data for all employees
            const utilizationPromises = employees.map(async (emp) => ({
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
        }
        catch (error) {
            console.error("❌ Error loading visualization data:", error);
        }
    }
    /**
     * Calculate utilization metrics based on actual hours
     * Standard: 8 hours/day, 20 days/month = 160 hours/month per employee
     */
    calculateUtilizationMetrics(allData) {
        const totalEmployees = allData.length;
        const STANDARD_HOURS_PER_MONTH = 160; // 8 hours * 20 days
        // Get selected year and quarter from visualization model
        const visualizationModel = this.getView()?.getModel("visualization");
        const selectedYear = visualizationModel?.getProperty("/selectedYear") || new Date().getFullYear();
        const selectedQuarter = visualizationModel?.getProperty("/selectedQuarter") || "ALL";
        console.log(`📊 Calculating utilization for Year: ${selectedYear}, Quarter: ${selectedQuarter}`);
        console.log("📊 All employee data:", allData);
        // Determine which months to include based on quarter
        let monthsToInclude = [];
        if (selectedQuarter === "Q1") {
            monthsToInclude = [1, 2, 3]; // Jan, Feb, Mar
        }
        else if (selectedQuarter === "Q2") {
            monthsToInclude = [4, 5, 6]; // Apr, May, Jun
        }
        else if (selectedQuarter === "Q3") {
            monthsToInclude = [7, 8, 9]; // Jul, Aug, Sep
        }
        else if (selectedQuarter === "Q4") {
            monthsToInclude = [10, 11, 12]; // Oct, Nov, Dec
        }
        else {
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
            empData.currentProjects.forEach((cp) => {
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
            empData.caiaUtilization.forEach((caia) => {
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
            empData.pocUtilization.forEach((poc) => {
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
        const vizModel = this.getView()?.getModel("visualization");
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
    isActiveInMonth(startDate, endDate, year, month) {
        if (!startDate || !endDate)
            return false;
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
    isActiveToday(startDate, endDate, today) {
        if (!startDate || !endDate)
            return false;
        const start = new Date(startDate);
        const end = new Date(endDate);
        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);
        return today >= start && today <= end;
    }
    /**
     * Check if a date range is active in the selected period (year + months)
     */
    isActiveInPeriod(startDate, endDate, year, months) {
        if (!startDate || !endDate)
            return false;
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
    countActiveMonths(startDate, endDate, year, months) {
        if (!startDate || !endDate)
            return 0;
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
    generateAvailabilityForecast(allData) {
        const totalEmployees = allData.length;
        const forecast = [];
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
                const hasActiveProjectInMonth = d.currentProjects.some((cp) => {
                    if (!cp.startDate || !cp.endDate)
                        return false;
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
                .map((d) => d.employee.name)
                .join(", ") || "None";
            // Build employee details for dialog
            const employeeDetails = availableEmployees.map((d) => {
                // Find the last project ending date if any
                let lastProjectEndDate = "N/A";
                if (d.currentProjects && d.currentProjects.length > 0) {
                    const sortedProjects = d.currentProjects
                        .filter((cp) => cp.endDate)
                        .sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime());
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
        const visualizationModel = this.getView()?.getModel("visualization");
        visualizationModel?.setProperty("/availabilityForecast", forecast);
        console.log("📅 Availability Forecast:", forecast);
    }
    /**
     * Generate Gantt chart data
     */
    generateGanttData(allData) {
        const visualizationModel = this.getView()?.getModel("visualization");
        const selectedYear = parseInt(visualizationModel?.getProperty("/selectedYear") || new Date().getFullYear());
        const selectedQuarter = visualizationModel?.getProperty("/selectedQuarter") || "ALL";
        const ganttData = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        allData.forEach(d => {
            const employeeData = {
                employeeName: d.employee.name,
                employeeId: d.employee.employeeId,
                projects: []
            };
            // Only show Current Projects (Utilization data)
            d.currentProjects.forEach((cp) => {
                if (!cp.startDate || !cp.endDate)
                    return;
                const startDate = new Date(cp.startDate);
                const endDate = new Date(cp.endDate);
                startDate.setHours(0, 0, 0, 0);
                endDate.setHours(0, 0, 0, 0);
                // Filter by year
                if (startDate.getFullYear() !== selectedYear && endDate.getFullYear() !== selectedYear)
                    return;
                // Determine project status based on dates
                let status = "scheduled";
                if (endDate < today) {
                    status = "finished"; // Completed projects - Blue
                }
                else if (startDate <= today && endDate >= today) {
                    status = "ongoing"; // Ongoing projects - Green
                }
                else if (startDate > today) {
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
    renderUtilizationCharts() {
        const visualizationModel = this.getView()?.getModel("visualization");
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
        this.byId("mtvCurrentProjectsUtilized")?.setText(`${currentProjectsUtilized}%`);
        this.byId("mtvCurrentProjectsAvailable")?.setText(`${currentProjectsAvailable}%`);
        this.byId("mtvCaiaUtilized")?.setText(`${caiaUtilized}%`);
        this.byId("mtvCaiaAvailable")?.setText(`${caiaAvailable}%`);
        this.byId("mtvPocUtilized")?.setText(`${pocUtilized}%`);
        this.byId("mtvPocAvailable")?.setText(`${pocAvailable}%`);
        console.log(`📊 Rendering charts - CP: ${currentProjectsUtilized}%, CAIA: ${caiaUtilized}%, POC: ${pocUtilized}%`);
        // Render SVG donut charts
        this.renderDonutChart("mtvCurrentProjectsChart", currentProjectsUtilized, "#0070f2");
        this.renderDonutChart("mtvCaiaChart", caiaUtilized, "#f39c12");
        this.renderDonutChart("mtvPocChart", pocUtilized, "#2ecc71");
    }
    /**
     * Render a single donut chart using SVG
     */
    renderDonutChart(containerId, percentage, color) {
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
            container.removeAllItems();
            const html = new HTML({
                content: svg
            });
            container.addItem(html);
            console.log(`✅ Chart rendered successfully in ${containerId}`);
        }
        catch (error) {
            console.error(`❌ Error rendering chart in ${containerId}:`, error);
        }
    }
    /**
     * Render Skills Distribution Chart
     */
    renderSkillsDistribution() {
        const container = this.byId("mtvSkillsDistributionChart");
        if (!container)
            return;
        container.removeAllItems();
        // Get all team members' skills
        const managerEmployeesModel = this.getView()?.getModel("managerEmployees");
        const employees = managerEmployeesModel?.getData()?.employees || [];
        if (employees.length === 0) {
            container.addItem(new Text({ text: "No team data available" }));
            return;
        }
        // Count skills across team
        const skillCounts = {};
        employees.forEach((emp) => {
            const skills = emp.skills || [];
            skills.forEach((skill) => {
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
            container.addItem(new Text({ text: "No skills found in team" }));
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
            container.addItem(skillBox);
        });
    }
    /**
     * Get numeric proficiency level
     */
    getProficiencyLevel(level) {
        const levels = {
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
    renderGanttChart() {
        const visualizationModel = this.getView()?.getModel("visualization");
        const ganttData = visualizationModel?.getProperty("/ganttData") || [];
        const selectedYear = parseInt(visualizationModel?.getProperty("/selectedYear") || new Date().getFullYear());
        const selectedQuarter = visualizationModel?.getProperty("/selectedQuarter") || "ALL";
        const container = this.byId("mtvGanttChartContainer");
        if (!container)
            return;
        container.removeAllItems();
        if (ganttData.length === 0) {
            const emptyText = new Text({
                text: "No project data available for the selected period"
            });
            container.addItem(emptyText);
            return;
        }
        // Determine months to display
        let months = [];
        let monthNumbers = [];
        if (selectedQuarter === "ALL") {
            months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            monthNumbers = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
        }
        else {
            const quarterMonths = {
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
        container.addItem(header);
        // Create rows for each employee
        ganttData.forEach((empData) => {
            const rowHtml = this.createGanttRow(empData, selectedYear, monthNumbers, months.length);
            const row = new HTML({ content: rowHtml });
            container.addItem(row);
        });
    }
    /**
     * Create a Gantt chart row for an employee
     */
    createGanttRow(empData, year, monthNumbers, totalMonths) {
        let barsHtml = '';
        empData.projects.forEach((project) => {
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
            if (startIndex === -1 && endIndex === -1)
                return; // Skip if not in range
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
                }
                else {
                    // Multiple months - calculate total width including partial months
                    // Width = (remaining days in start month + full months between + days in end month) / total months
                    const startDayFraction = (daysInStartMonth - startDay + 1) / daysInStartMonth;
                    widthPercent = ((startDayFraction + (monthsSpanned - 1) + endDayFraction) / totalMonths) * 100;
                }
            }
            else if (startIndex !== -1) {
                // Only start is visible, extends beyond visible range
                const daysInStartMonth = new Date(startDate.getFullYear(), startMonth + 1, 0).getDate();
                const dayOffsetInStartMonth = (startDay - 1) / daysInStartMonth;
                leftPercent = ((startIndex + dayOffsetInStartMonth) / totalMonths) * 100;
                widthPercent = ((totalMonths - startIndex - dayOffsetInStartMonth) / totalMonths) * 100;
            }
            else if (endIndex !== -1) {
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
    async onRefreshVisualization() {
        MessageToast.show("Refreshing visualization data...");
        await this.loadVisualizationData();
        MessageToast.show("Visualization refreshed successfully");
    }
    /**
     * Apply visualization filters (Year and Quarter)
     */
    onApplyVisualizationFilters() {
        const yearSelect = this.byId("mtvYearFilter");
        const quarterSelect = this.byId("mtvQuarterFilter");
        const selectedYear = parseInt(yearSelect?.getSelectedKey() || new Date().getFullYear().toString());
        const selectedQuarter = quarterSelect?.getSelectedKey() || "ALL";
        const visualizationModel = this.getView()?.getModel("visualization");
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
    onYearFilterChange(event) {
        // Filter will be applied when user clicks Apply button
    }
    /**
     * Handle quarter filter change (removed auto-apply)
     */
    onQuarterFilterChange(event) {
        // Filter will be applied when user clicks Apply button
    }
    /**
     * Format capacity state for timeline
     */
    formatCapacityState(percentage) {
        if (percentage >= 50)
            return "Success";
        if (percentage >= 25)
            return "Warning";
        return "Error";
    }
    /**
     * Format capacity text
     */
    formatCapacityText(percentage) {
        if (percentage >= 50)
            return "High Capacity Available";
        if (percentage >= 25)
            return "Moderate Capacity";
        return "Low Capacity";
    }
    /**
     * Format utilization as percentage
     */
    formatUtilizationPercent(hoursPerDay) {
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
    async onViewAvailableEmployees(event) {
        const source = event.getSource();
        const bindingContext = source.getBindingContext("visualization");
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
    onCloseAvailableEmployeesDialog() {
        this.availableEmployeesDialog?.close();
    }
    availableEmployeesDialog;
    // ==================== END DATA VISUALIZATION METHODS ====================
    onViewEmployeeDetails(event) {
        const source = event.getSource();
        // Try to get binding context from managerEmployees model first, fallback to employees
        let bindingContext = source.getBindingContext("managerEmployees");
        if (!bindingContext) {
            bindingContext = source.getBindingContext("employees");
        }
        if (!bindingContext) {
            MessageToast.show("Unable to load employee details");
            console.error("No binding context found for employee");
            return;
        }
        const employee = bindingContext.getObject();
        this.openEmployeeDetailsDialog(employee, false);
    }
    onSkillTokenUpdate(event) {
        // Handle skill token updates
        const multiInput = event.getSource();
        const tokens = multiInput.getTokens();
        console.log("Current skill tokens:", tokens.map(token => token.getText()));
    }
    onSkillSubmit(event) {
        // Handle Enter key press to add skill as token
        const multiInput = event.getSource();
        const value = multiInput.getValue().trim();
        if (value) {
            // Check if token already exists
            const existingTokens = multiInput.getTokens();
            const tokenExists = existingTokens.some(token => token.getText().toLowerCase() === value.toLowerCase());
            if (!tokenExists) {
                // Add new token
                const newToken = new Token({
                    text: value,
                    key: value.toLowerCase()
                });
                multiInput.addToken(newToken);
                multiInput.setValue(""); // Clear input
                MessageToast.show(`Added skill: ${value}`);
            }
            else {
                MessageToast.show(`Skill "${value}" already added`);
                multiInput.setValue(""); // Clear input
            }
        }
    }
    onSkillLiveChange(event) {
        // Handle live change for validation or suggestions
        const multiInput = event.getSource();
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
                        const tokenExists = existingTokens.some(token => token.getText().toLowerCase() === skill.toLowerCase());
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
    onSearchScopeChange(event) {
        const select = event.getSource();
        const selectedKey = select.getSelectedKey();
        const managerSelectorBox = this.byId("mtvManagerSelectorBox");
        if (selectedKey === "ByManager") {
            // Show manager selector dropdown
            managerSelectorBox?.setVisible(true);
        }
        else {
            // Hide manager selector dropdown
            managerSelectorBox?.setVisible(false);
        }
    }
    async onSearchEmployees() {
        const multiInput = this.byId("mtvSkillsSearchInput");
        const scopeSelect = this.byId("mtvSearchScope");
        const experienceSelect = this.byId("mtvExperienceLevel");
        const roleSelect = this.byId("mtvRoleFilter");
        const managerSelector = this.byId("mtvManagerSelector");
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
        const currentUserModel = this.getOwnerComponent()?.getModel("currentUser");
        const currentUser = currentUserModel?.getData();
        console.log("Search parameters:", { searchSkills, searchScope, experienceLevel, roleFilter, viewedManagerId });
        try {
            let allEmployees = [];
            // Load employees based on search scope from OData
            const oDataModel = this.getOwnerComponent()?.getModel();
            if (searchScope === "MyTeam") {
                // Load only the viewed manager's team employees
                const listBinding = oDataModel.bindList("/Employees");
                listBinding.filter([new Filter("managerId", FilterOperator.EQ, viewedManagerId)]);
                const contexts = await listBinding.requestContexts();
                allEmployees = contexts.map((context) => context.getObject());
                console.log(`Searching in My Team (${viewedManagerId}): ${allEmployees.length} employees`);
            }
            else if (searchScope === "ByManager") {
                // Load selected manager's team
                const selectedManagerId = managerSelector?.getSelectedKey();
                if (!selectedManagerId) {
                    MessageToast.show("Please select a manager to search their team");
                    return;
                }
                const listBinding = oDataModel.bindList("/Employees");
                listBinding.filter([new Filter("managerId", FilterOperator.EQ, selectedManagerId)]);
                const contexts = await listBinding.requestContexts();
                allEmployees = contexts.map((context) => context.getObject());
                console.log(`Searching in Manager ${selectedManagerId}'s Team: ${allEmployees.length} employees`);
            }
            else if (searchScope === "EntireOrganization") {
                // Load all employees (exclude managers)
                const listBinding = oDataModel.bindList("/Employees");
                const contexts = await listBinding.requestContexts(0, 9999);
                allEmployees = contexts.map((context) => context.getObject())
                    .filter((emp) => emp.employeeId && !emp.employeeId.startsWith("MGR"));
                console.log(`Searching in Entire Organization: ${allEmployees.length} employees`);
            }
            // Load skills and profiles for all employees
            const enrichedEmployees = await Promise.all(allEmployees.map(async (emp) => {
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
        }
        catch (error) {
            console.error("❌ Error searching employees:", error);
            MessageToast.show("Error performing search");
        }
    }
    performSkillSearch(employees, searchSkills, experienceLevel, roleFilter) {
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
                const matchingSkills = empSkills.filter((skill) => searchSkills.some(searchSkill => skill.skillName.toLowerCase().includes(searchSkill)));
                if (matchingSkills.length === 0) {
                    return false; // No skill match
                }
                // 3. Apply experience filter if specified (only check on matched skills)
                if (experienceLevel) {
                    const meetsExperience = matchingSkills.some((skill) => this.matchesExperienceRequirement(skill.proficiencyLevel, experienceLevel));
                    if (!meetsExperience) {
                        return false; // Experience level not met
                    }
                }
            }
            else if (experienceLevel) {
                // If no skills specified but experience level is set, check if any skill meets experience
                const meetsExperience = empSkills.some((skill) => this.matchesExperienceRequirement(skill.proficiencyLevel, experienceLevel));
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
                    .filter((s) => matchingSkillsArray.some((ms) => s.skillName.toLowerCase() === ms.toLowerCase()))
                    .map((s) => `${s.skillName} (${s.proficiencyLevel})`)
                    .join(", ");
                matchingSkills = matchedSkillDetails || matchingSkillsArray.join(", ");
                matchScore = this.calculateMatchScore(emp, searchSkills);
            }
            else {
                // Role/Experience only search: show all skills or relevant info
                if (roleFilter) {
                    matchingSkills = `Role: ${emp.role}`;
                }
                if (experienceLevel) {
                    const qualifiedSkills = empSkills.filter((s) => this.matchesExperienceRequirement(s.proficiencyLevel, experienceLevel)).map((s) => `${s.skillName} (${s.proficiencyLevel})`);
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
    matchesExperienceRequirement(proficiencyLevel, requiredLevel) {
        const levels = {
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
    getMatchingSkills(employee, searchSkills) {
        const empSkills = employee.skills || [];
        const skillNames = empSkills.map((s) => s.skillName);
        return skillNames.filter((skill) => searchSkills.some(searchSkill => skill.toLowerCase().includes(searchSkill.toLowerCase())));
    }
    /**
     * Calculate match score based on proficiency levels
     * Proficient = 100%, Intermediate = 75%, Beginner = 50%, Advanced = 90%, Expert = 100%
     */
    calculateMatchScore(employee, searchSkills) {
        // Get employee's skills that match search criteria
        const empSkills = employee.skills || [];
        const matchedSkills = empSkills.filter((skill) => searchSkills.some(searchSkill => skill.skillName.toLowerCase().includes(searchSkill.toLowerCase())));
        if (matchedSkills.length === 0) {
            return 0;
        }
        // Map proficiency levels to percentage scores
        const proficiencyScores = {
            "Beginner": 50,
            "Intermediate": 75,
            "Proficient": 100,
            "Advanced": 90,
            "Expert": 100
        };
        // Calculate total score for matched skills
        let totalScore = 0;
        matchedSkills.forEach((skill) => {
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
    displaySearchResults(results) {
        const searchResultsPanel = this.byId("mtvSearchResultsPanel");
        const searchResultsTable = this.byId("mtvSearchResultsTable");
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
    clearSearchResults() {
        console.log("Clearing previous search results");
        // Hide search results panel
        const searchResultsPanel = this.byId("mtvSearchResultsPanel");
        if (searchResultsPanel) {
            searchResultsPanel.setVisible(false);
        }
        // Clear search results model
        const resultsModel = new JSONModel({ results: [] });
        this.getView()?.setModel(resultsModel, "searchResults");
        // Clear search input tokens
        const multiInput = this.byId("mtvSkillsSearchInput");
        if (multiInput) {
            multiInput.removeAllTokens();
            multiInput.setValue("");
        }
        // Reset search scope to default (My Team)
        const scopeSelect = this.byId("mtvSearchScope");
        if (scopeSelect) {
            scopeSelect.setSelectedKey("MyTeam");
        }
        // Hide manager selector box
        const managerSelectorBox = this.byId("mtvManagerSelectorBox");
        if (managerSelectorBox) {
            managerSelectorBox.setVisible(false);
        }
        // Reset experience level to default (empty)
        const experienceSelect = this.byId("mtvExperienceLevel");
        if (experienceSelect) {
            experienceSelect.setSelectedKey("");
        }
        console.log("✅ Search results cleared successfully");
    }
    onViewSearchResult(event) {
        const source = event.getSource();
        let bindingContext = source.getBindingContext("searchResults");
        if (!bindingContext) {
            // Fallback: try to get the context from the list item
            const listItem = source.getParent ? source.getParent() : source;
            bindingContext = listItem.getBindingContext("searchResults");
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
    async openEmployeeDetailsDialog(employee, isSearchResult) {
        // Get dialog reference
        const dialog = this.byId("mtvEmployeeDetailsDialog");
        if (!dialog) {
            MessageToast.show("Dialog not found");
            return;
        }
        // Use employeeId or id for backward compatibility
        const empId = employee.employeeId || employee.id;
        console.log(`📋 Loading comprehensive details for employee: ${empId}`);
        try {
            // Load all data from OData in parallel
            const oDataModel = this.getOwnerComponent()?.getModel();
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
            this.byId("mtvDialogEmployeeName")?.setText(employeeData.name || '');
            this.byId("mtvDialogEmployeeId")?.setText(employeeData.employeeId || '');
            this.byId("mtvDialogEmployeeEmail")?.setText(employeeData.email || '');
            this.byId("mtvDialogEmployeeTeam")?.setText(employeeData.team || '');
            this.byId("mtvDialogEmployeeSpecialization")?.setText(employeeData.specialization || '');
            this.byId("mtvDialogEmployeeManager")?.setText(employeeData.managerId || '');
            // Populate professional details
            this.byId("mtvDialogEmployeeRole")?.setText(profileData.role || 'N/A');
            this.byId("mtvDialogEmployeeLocation")?.setText(profileData.location || 'N/A');
            this.byId("mtvDialogEmployeeTLevel")?.setText(profileData.tLevel || 'N/A');
            this.byId("mtvDialogEmployeeLastUpdated")?.setText(profileData.lastUpdated ? new Date(profileData.lastUpdated).toLocaleDateString() : 'N/A');
            // Populate current status
            const statusText = this.formatWorkingStatus(employee.working_on_project);
            const statusState = this.formatWorkingStatusState(employee.working_on_project);
            this.byId("mtvDialogWorkStatus")?.setText(statusText);
            this.byId("mtvDialogWorkStatus")?.setState(statusState);
            // Count active current projects (with today's date in range)
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const activeProjects = currentProjects.filter((cp) => {
                if (!cp.startDate || !cp.endDate)
                    return false;
                const startDate = new Date(cp.startDate);
                const endDate = new Date(cp.endDate);
                startDate.setHours(0, 0, 0, 0);
                endDate.setHours(0, 0, 0, 0);
                return today >= startDate && today <= endDate;
            });
            this.byId("mtvDialogActiveProjects")?.setNumber(activeProjects.length);
            this.byId("mtvDialogActiveProjects")?.setUnit(activeProjects.length === 1 ? "project" : "projects");
            // Update skills count
            this.byId("mtvDialogTotalSkills")?.setNumber(skills.length);
            this.byId("mtvDialogTotalSkills")?.setUnit(skills.length === 1 ? "skill" : "skills");
            // Update projects count
            this.byId("mtvDialogTotalProjects")?.setNumber(projects.length);
            this.byId("mtvDialogTotalProjects")?.setUnit(projects.length === 1 ? "project" : "projects");
            // Update certifications count (in Skills tab)
            this.byId("mtvDialogTotalCertifications")?.setNumber(certifications.length);
            this.byId("mtvDialogTotalCertifications")?.setUnit(certifications.length === 1 ? "certification" : "certifications");
            // Update certifications count (in Certifications tab)
            this.byId("mtvDialogTotalCertificationsTab")?.setNumber(certifications.length);
            this.byId("mtvDialogTotalCertificationsTab")?.setUnit(certifications.length === 1 ? "certification" : "certifications");
            // Handle match information for search results
            const matchTab = this.byId("mtvDialogMatchTab");
            if (isSearchResult && employee.matchScore !== undefined) {
                matchTab?.setVisible(true);
                // Set match score progress indicator
                const matchScoreControl = this.byId("mtvDialogMatchScore");
                if (matchScoreControl) {
                    matchScoreControl.setPercentValue(employee.matchScore);
                    matchScoreControl.setDisplayValue(employee.matchScore + "%");
                    matchScoreControl.setState(this.formatMatchScoreState(employee.matchScore));
                }
                // Set match level text (Excellent/Good/Partial/Low Match)
                const matchLevelControl = this.byId("mtvDialogMatchLevel");
                if (matchLevelControl) {
                    const matchLevelText = this.formatMatchScoreText(employee.matchScore);
                    matchLevelControl.setText(matchLevelText);
                    matchLevelControl.setState(this.formatMatchScoreState(employee.matchScore));
                }
                // Set matching skills text
                this.byId("mtvDialogMatchingSkills")?.setText(employee.matchingSkills || "N/A");
            }
            else {
                matchTab?.setVisible(false);
            }
            // Open dialog
            dialog.open();
        }
        catch (error) {
            console.error("❌ Error loading employee details:", error);
            MessageToast.show("Error loading employee details");
        }
    }
    /**
     * Load employee master data from OData
     */
    async loadEmployeeData(employeeId) {
        try {
            const oDataModel = this.getOwnerComponent()?.getModel();
            const listBinding = oDataModel.bindList("/Employees");
            listBinding.filter([new Filter("employeeId", FilterOperator.EQ, employeeId)]);
            const contexts = await listBinding.requestContexts(0, 1);
            if (contexts.length > 0) {
                return contexts[0].getObject();
            }
            return {};
        }
        catch (error) {
            console.error(`Error loading employee data for ${employeeId}:`, error);
            return {};
        }
    }
    /**
     * Load profile data from OData
     */
    async loadProfileData(employeeId) {
        try {
            const oDataModel = this.getOwnerComponent()?.getModel();
            const listBinding = oDataModel.bindList("/Profiles");
            listBinding.filter([new Filter("employeeId", FilterOperator.EQ, employeeId)]);
            const contexts = await listBinding.requestContexts(0, 1);
            if (contexts.length > 0) {
                return contexts[0].getObject();
            }
            return {};
        }
        catch (error) {
            console.error(`Error loading profile data for ${employeeId}:`, error);
            return {};
        }
    }
    /**
     * Get CAIA utilization records for an employee
     */
    async getCAIAUtilization(employeeId) {
        try {
            const oDataModel = this.getOwnerComponent()?.getModel();
            const listBinding = oDataModel.bindList("/CAIAUtilization");
            listBinding.filter([new Filter("employeeId", FilterOperator.EQ, employeeId)]);
            const contexts = await listBinding.requestContexts();
            return contexts.map((context) => context.getObject());
        }
        catch (error) {
            console.error(`Error loading CAIA utilization for ${employeeId}:`, error);
            return [];
        }
    }
    /**
     * Get POC utilization records for an employee
     */
    async getPOCUtilization(employeeId) {
        try {
            const oDataModel = this.getOwnerComponent()?.getModel();
            const listBinding = oDataModel.bindList("/POCUtilization");
            listBinding.filter([new Filter("employeeId", FilterOperator.EQ, employeeId)]);
            const contexts = await listBinding.requestContexts();
            return contexts.map((context) => context.getObject());
        }
        catch (error) {
            console.error(`Error loading POC utilization for ${employeeId}:`, error);
            return [];
        }
    }
    /**
     * Get certifications for an employee
     */
    async getCertifications(employeeId) {
        try {
            const oDataModel = this.getOwnerComponent()?.getModel();
            const listBinding = oDataModel.bindList("/Certifications");
            listBinding.filter([new Filter("employeeId", FilterOperator.EQ, employeeId)]);
            const contexts = await listBinding.requestContexts();
            return contexts.map((context) => context.getObject());
        }
        catch (error) {
            console.error(`Error loading certifications for ${employeeId}:`, error);
            return [];
        }
    }
    onContactEmployee(event) {
        // Get employee name from dialog
        const employeeName = this.byId("mtvDialogEmployeeName").getText();
        MessageToast.show(`Contacting ${employeeName}...`);
        // TODO: Implement actual contact functionality (email, teams, etc.)
    }
    onCloseEmployeeDialog() {
        const dialog = this.byId("mtvEmployeeDetailsDialog");
        if (dialog) {
            dialog.close();
        }
    }
    /**
     * View all team members
     */
    onViewTotalEmployees() {
        const managerEmployeesModel = this.getView()?.getModel("managerEmployees");
        const allEmployees = managerEmployeesModel?.getData()?.employees || [];
        console.log(`📊 Showing all ${allEmployees.length} team members`);
        this.openAnalyticsListDialog("All Team Members", allEmployees);
    }
    /**
     * View available employees from Team Analytics (not working on project)
     */
    onViewAvailableEmployeesFromAnalytics() {
        const managerEmployeesModel = this.getView()?.getModel("managerEmployees");
        const allEmployees = managerEmployeesModel?.getData()?.employees || [];
        const availableEmployees = allEmployees.filter((emp) => !emp.working_on_project);
        console.log(`📊 Showing ${availableEmployees.length} available employees`);
        this.openAnalyticsListDialog("Available Resources", availableEmployees);
    }
    /**
     * View busy employees (working on project)
     */
    onViewBusyEmployees() {
        const managerEmployeesModel = this.getView()?.getModel("managerEmployees");
        const allEmployees = managerEmployeesModel?.getData()?.employees || [];
        const busyEmployees = allEmployees.filter((emp) => emp.working_on_project);
        console.log(`📊 Showing ${busyEmployees.length} employees on projects`);
        this.openAnalyticsListDialog("Employees Working on Projects", busyEmployees);
    }
    /**
     * Open analytics list dialog with filtered employees
     */
    openAnalyticsListDialog(title, employees) {
        const dialog = this.byId("mtvAnalyticsListDialog");
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
    onViewEmployeeDetailsFromAnalytics(event) {
        const source = event.getSource();
        const bindingContext = source.getBindingContext("analyticsList");
        if (!bindingContext) {
            MessageToast.show("Unable to load employee details");
            return;
        }
        const employee = bindingContext.getObject();
        // Close analytics dialog first
        const analyticsDialog = this.byId("mtvAnalyticsListDialog");
        if (analyticsDialog) {
            analyticsDialog.close();
        }
        // Open employee details dialog
        this.openEmployeeDetailsDialog(employee, false);
    }
    /**
     * Close analytics list dialog
     */
    onCloseAnalyticsDialog() {
        const dialog = this.byId("mtvAnalyticsListDialog");
        if (dialog) {
            dialog.close();
        }
    }
    // Enhanced formatter methods
    formatWorkingStatus(workingOnProject) {
        return workingOnProject ? "Working on Project" : "Available";
    }
    formatWorkingStatusState(workingOnProject) {
        return workingOnProject ? "Error" : "Success";
    }
    formatSkillCount(totalMatchingSkills) {
        return totalMatchingSkills ? `${totalMatchingSkills} matching skills` : "";
    }
    formatMatchScoreState(matchScore) {
        if (matchScore >= 80)
            return "Success";
        if (matchScore >= 60)
            return "Warning";
        return "Error";
    }
    formatMatchScoreText(matchScore) {
        if (matchScore >= 80)
            return "Excellent Match";
        if (matchScore >= 60)
            return "Good Match";
        if (matchScore >= 40)
            return "Partial Match";
        return "Low Match";
    }
    formatProficiencyState(proficiencyLevel) {
        const stateMap = {
            "Expert": "Success",
            "Advanced": "Success",
            "Proficient": "Information",
            "Intermediate": "Warning",
            "Beginner": "None"
        };
        return stateMap[proficiencyLevel] || "None";
    }
    formatCertificationState(certificationStatus) {
        const stateMap = {
            "Certified": "Success",
            "In Progress": "Warning",
            "Not Certified": "None",
            "None": "None"
        };
        return stateMap[certificationStatus] || "None";
    }
    // ==================== AI ASSISTANT METHODS ====================
    managerId = "";
    aiInitialized = false;
    typingIndicator = null;
    // REQUIRED to track login switch (same pattern as employee)
    currentChatManagerId = "";
    /**
     * Open AI Assistant Dialog
     */
    onOpenAIAssistant() {
        const currentUserModel = this.getOwnerComponent()
            ?.getModel("currentUser");
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
            console.log(`🔄 Different manager detected (was: ${this.currentChatManagerId}, now: ${newManagerId})`);
            this.clearChatForNewManager();
            this.currentChatManagerId = newManagerId;
        }
        this.managerId = newManagerId;
        // Initialize chat only once per manager
        const oContainer = this.byId("messagesContainerManager");
        if (!oContainer || oContainer.getItems().length === 0) {
            this.initializeAIChat();
        }
        const oDialog = this.byId("aiAssistantDialogManager");
        oDialog?.open();
    }
    /**
     * Close AI Assistant Dialog
     */
    onCloseAIDialog() {
        const oDialog = this.byId("aiAssistantDialogManager");
        oDialog?.close();
        // ❗ Do NOT clear chat here
    }
    clearChatForNewManager() {
        console.log("🧹 Clearing chat for new manager");
        const oContainer = this.byId("messagesContainerManager");
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
    initializeAIChat() {
        if (this.aiInitialized) {
            console.log("ℹ️ Manager AI chat already initialized");
            return;
        }
        const currentUserModel = this.getOwnerComponent()
            ?.getModel("currentUser");
        const userData = currentUserModel?.getData();
        const managerName = userData?.name || "Manager";
        this.addBotMessage(`👋 Hello ${managerName}! I'm your AI assistant.\n\n` +
            "I can help you with:\n" +
            "• Finding team members with specific skills\n" +
            "• Checking team availability\n" +
            "• Analyzing skill gaps\n" +
            "• Project allocations\n\n" +
            "What would you like to do?");
        this.aiInitialized = true;
    }
    /**
     * Handle quick action buttons
     */
    onQuickAction(oEvent) {
        const button = oEvent.getSource();
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
        const input = this.byId("messageInputManager");
        input?.setValue(query);
        this.onSendMessage();
    }
    /**
     * Send message to AI
     */
    onSendMessage() {
        const oInput = this.byId("messageInputManager");
        const sMessage = oInput?.getValue().trim();
        if (!sMessage) {
            MessageToast.show("Please enter a message");
            return;
        }
        // Ensure managerId exists
        if (!this.managerId) {
            const currentUserModel = this.getOwnerComponent()
                ?.getModel("currentUser");
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
    async queryAI(query) {
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
            }
            else if (result.value?.answer) {
                this.addBotMessage(result.value.answer);
            }
            else {
                this.addBotMessage("⚠️ Received an unexpected response format.");
                console.log("Response:", result);
            }
        }
        catch (error) {
            this.removeTypingIndicator();
            this.addBotMessage("⚠️ Connection error. Please try again.");
            console.error("AI Query Error:", error);
        }
    }
    /**
     * Add user message to chat
     */
    addUserMessage(message) {
        const oContainer = this.byId("messagesContainerManager");
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
    addBotMessage(message) {
        const oContainer = this.byId("messagesContainerManager");
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
    showTypingIndicator() {
        const oContainer = this.byId("messagesContainerManager");
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
    removeTypingIndicator() {
        if (this.typingIndicator) {
            const oContainer = this.byId("messagesContainerManager");
            oContainer?.removeItem(this.typingIndicator);
            this.typingIndicator.destroy();
            this.typingIndicator = null;
        }
    }
    /**
     * Scroll chat to bottom
     */
    scrollToBottom() {
        setTimeout(() => {
            const oScrollContainer = this.byId("chatContainerManager");
            if (oScrollContainer) {
                oScrollContainer.scrollTo(0, 10000);
            }
        }, 100);
    }
}
