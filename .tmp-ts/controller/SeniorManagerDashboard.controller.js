import Controller from "sap/ui/core/mvc/Controller";
import MessageToast from "sap/m/MessageToast";
import JSONModel from "sap/ui/model/json/JSONModel";
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";
import Token from "sap/m/Token";
import Item from "sap/ui/core/Item";
import Text from "sap/m/Text";
import VBox from "sap/m/VBox";
import HBox from "sap/m/HBox";
import HTML from "sap/ui/core/HTML";
/**
 * @namespace skillsphere.controller
 */
export default class SeniorManagerDashboard extends Controller {
    currentSeniorManagerId = null;
    seniorManagerId = "";
    currentChatSeniorManagerId = "";
    aiInitialized = false;
    typingIndicator = null;
    onInit() {
        const router = this.getRouter();
        router.getRoute("SeniorManagerDashboard")?.attachPatternMatched(this.onRouteMatched, this);
    }
    getRouter() {
        return this.getOwnerComponent().getRouter();
    }
    onLogout() {
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
        this.currentSeniorManagerId = null;
        // Navigate back to landing page
        this.getRouter().navTo("Landing");
        MessageToast.show("You have been logged out");
    }
    async onRouteMatched(event) {
        const args = event.getParameter("arguments");
        const seniorManagerId = args?.seniorManagerId;
        console.log("Route matched for Senior Manager:", seniorManagerId);
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'auto' });
        // Check if senior manager is logged in
        const currentUserModel = this.getOwnerComponent()?.getModel("currentUser");
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
    async loadDashboardData() {
        try {
            console.log("📊 Loading Senior Manager dashboard data...");
            const oDataModel = this.getOwnerComponent()?.getModel();
            // Load all managers
            await this.loadAllManagers();
            // Load organization metrics
            await this.loadOrganizationMetrics();
            MessageToast.show("Dashboard data loaded successfully");
        }
        catch (error) {
            console.error("❌ Error loading dashboard data:", error);
            MessageToast.show("Error loading dashboard data");
        }
    }
    async loadAllManagers() {
        try {
            const oDataModel = this.getOwnerComponent()?.getModel();
            const managersBinding = oDataModel.bindList("/Managers");
            const contexts = await managersBinding.requestContexts(0, 100);
            const managers = contexts
                .map((context) => context.getObject())
                .filter((mgr) => !mgr.managerId?.startsWith("SMGR"));
            console.log(`✅ Loaded ${managers.length} managers`);
            // Load team size for each manager
            const managersWithTeamSize = await Promise.all(managers.map(async (mgr) => {
                const teamSize = await this.getManagerTeamSize(mgr.managerId);
                return {
                    ...mgr,
                    teamSize: teamSize
                };
            }));
            // Create model for managers
            const managersModel = new JSONModel({ managers: managersWithTeamSize });
            this.getView()?.setModel(managersModel, "allManagers");
            // Populate manager dropdown for search
            const managerSelect = this.byId("orgManagerFilter");
            if (managerSelect) {
                managersWithTeamSize.forEach((mgr) => {
                    managerSelect.addItem(new Item({
                        key: mgr.managerId,
                        text: `${mgr.name} (${mgr.team})`
                    }));
                });
            }
        }
        catch (error) {
            console.error("❌ Error loading managers:", error);
        }
    }
    async getManagerTeamSize(managerId) {
        try {
            const oDataModel = this.getOwnerComponent()?.getModel();
            const employeesBinding = oDataModel.bindList("/Employees");
            employeesBinding.filter([new Filter("managerId", FilterOperator.EQ, managerId)]);
            const contexts = await employeesBinding.requestContexts(0, 1000);
            return contexts.length;
        }
        catch (error) {
            console.error(`Error getting team size for ${managerId}:`, error);
            return 0;
        }
    }
    async loadOrganizationMetrics() {
        try {
            const oDataModel = this.getOwnerComponent()?.getModel();
            // Load all managers (exclude SMGR)
            const managersBinding = oDataModel.bindList("/Managers");
            const managerContexts = await managersBinding.requestContexts(0, 1000);
            const totalManagers = managerContexts
                .map((ctx) => ctx.getObject())
                .filter((m) => !m.managerId?.startsWith("SMGR")).length;
            // Load all employees (exclude manager rows)
            const employeesBinding = oDataModel.bindList("/Employees");
            const employeeContexts = await employeesBinding.requestContexts(0, 9999);
            const allEmployees = employeeContexts.map((ctx) => ctx.getObject())
                .filter((emp) => emp.employeeId && !emp.employeeId.startsWith("MGR"));
            const totalEmployees = allEmployees.length;
            // Average experience
            const totalExperience = allEmployees.reduce((sum, emp) => sum + (emp.experience || 0), 0);
            const avgExperience = totalEmployees > 0 ? (totalExperience / totalEmployees).toFixed(1) : 0;
            // Load all skills — unique count + top skills by frequency
            const skillsBinding = oDataModel.bindList("/Skills");
            const skillContexts = await skillsBinding.requestContexts(0, 9999);
            const allSkills = skillContexts.map((ctx) => ctx.getObject());
            const uniqueSkillsCount = new Set(allSkills.map((s) => s.skillName)).size;
            const skillFreq = {};
            allSkills.forEach((s) => {
                if (s.skillName) {
                    skillFreq[s.skillName] = (skillFreq[s.skillName] || 0) + 1;
                }
            });
            const topSkills = Object.entries(skillFreq)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 10)
                .map(([skillName, count], idx) => ({ rank: idx + 1, skillName, count }));
            // Active current projects — determine who is on project today
            const cpBinding = oDataModel.bindList("/CurrentProjects");
            const cpContexts = await cpBinding.requestContexts(0, 9999);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const activeEmployeeIds = new Set();
            cpContexts.map((ctx) => ctx.getObject()).forEach((cp) => {
                if (!cp.startDate || !cp.endDate)
                    return;
                const start = new Date(cp.startDate);
                start.setHours(0, 0, 0, 0);
                const end = new Date(cp.endDate);
                end.setHours(0, 0, 0, 0);
                if (today >= start && today <= end) {
                    activeEmployeeIds.add(cp.employeeId);
                }
            });
            const onProjectCount = allEmployees.filter((emp) => activeEmployeeIds.has(emp.employeeId)).length;
            const onBenchCount = totalEmployees - onProjectCount;
            // Build bench employees list
            const skillCountByEmp = {};
            allSkills.forEach((s) => {
                if (s.employeeId) {
                    skillCountByEmp[s.employeeId] = (skillCountByEmp[s.employeeId] || 0) + 1;
                }
            });
            const benchEmployees = allEmployees
                .filter((emp) => !activeEmployeeIds.has(emp.employeeId))
                .map((emp) => ({ ...emp, skillCount: skillCountByEmp[emp.employeeId] || 0 }));
            // Update metric cards
            this.byId("totalManagersCount")?.setNumber(totalManagers);
            this.byId("orgTotalEmployeesCount")?.setNumber(totalEmployees);
            this.byId("uniqueSkillsCount")?.setNumber(uniqueSkillsCount);
            this.byId("avgExperienceCount")?.setNumber(avgExperience);
            this.byId("onProjectCount")?.setNumber(onProjectCount);
            this.byId("onBenchCount")?.setNumber(onBenchCount);
            this.byId("benchCountText")?.setText(`${onBenchCount} employee${onBenchCount !== 1 ? 's' : ''} are currently available (not assigned to any active project)`);
            // Set models
            this.getView()?.setModel(new JSONModel({ topSkills }), "orgMetrics");
            this.getView()?.setModel(new JSONModel({ employees: benchEmployees }), "benchReport");
            // Cache everything for View All dialogs
            const allManagersRaw = managerContexts
                .map((ctx) => ctx.getObject())
                .filter((m) => !m.managerId?.startsWith("SMGR"));
            const onProjectEmployees = allEmployees
                .filter((emp) => activeEmployeeIds.has(emp.employeeId))
                .map((emp) => ({ ...emp, skillCount: skillCountByEmp[emp.employeeId] || 0 }));
            const allSkillsRanked = Object.entries(skillFreq)
                .sort(([, a], [, b]) => b - a)
                .map(([skillName, count], idx) => ({
                rank: idx + 1,
                skillName,
                category: allSkills.find((s) => s.skillName === skillName)?.category || '',
                count
            }));
            const allEmployeesWithSkillCount = allEmployees.map((emp) => ({
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
        }
        catch (error) {
            console.error("❌ Error loading organization metrics:", error);
        }
    }
    async onViewManagerTeam(event) {
        const source = event.getSource();
        const bindingContext = source.getBindingContext("allManagers");
        const manager = bindingContext.getObject();
        console.log("📋 Navigating to team view for manager:", manager.managerId);
        // Get the current senior manager ID
        const currentUserModel = this.getOwnerComponent()?.getModel("currentUser");
        const currentUser = currentUserModel?.getData();
        const seniorMgrId = this.currentSeniorManagerId || currentUser?.id;
        // Navigate to the new Manager Team View page
        this.getRouter().navTo("ManagerTeamView", {
            managerId: manager.managerId,
            seniorManagerId: seniorMgrId
        });
        MessageToast.show(`Loading ${manager.name}'s team dashboard...`);
    }
    onCloseManagerTeamDialog() {
        const dialog = this.byId("managerTeamDialog");
        dialog.close();
    }
    openOrgMetricsDialog(title, type, rows) {
        this.byId("orgMetricsDialogTitle")?.setText(title);
        this.getView()?.setModel(new JSONModel({ type, rows }), "orgMetricsDetail");
        this.byId("orgMetricsDetailDialog")?.open();
    }
    onCloseOrgMetricsDialog() {
        this.byId("orgMetricsDetailDialog")?.close();
    }
    onViewAllManagers() {
        const cache = this.getView()?.getModel("orgMetricsCache")?.getData();
        const rows = cache?.managers || [];
        this.openOrgMetricsDialog(`All Managers (${rows.length})`, "managers", rows);
    }
    onViewAllEmployees() {
        const cache = this.getView()?.getModel("orgMetricsCache")?.getData();
        const rows = cache?.allEmployees || [];
        this.openOrgMetricsDialog(`All Employees (${rows.length})`, "employees", rows);
    }
    onViewAllSkills() {
        const cache = this.getView()?.getModel("orgMetricsCache")?.getData();
        const rows = cache?.allSkills || [];
        this.openOrgMetricsDialog(`All Unique Skills (${rows.length})`, "skills", rows);
    }
    onViewOnProjectEmployees() {
        const cache = this.getView()?.getModel("orgMetricsCache")?.getData();
        const rows = cache?.onProjectEmployees || [];
        this.openOrgMetricsDialog(`Working on Project Today (${rows.length})`, "employees", rows);
    }
    onViewAvailableEmployees() {
        const cache = this.getView()?.getModel("orgMetricsCache")?.getData();
        const rows = cache?.availableEmployees || [];
        this.openOrgMetricsDialog(`Available Employees (${rows.length})`, "employees", rows);
    }
    onOrgSkillTokenUpdate(event) {
        const multiInput = event.getSource();
        const tokens = multiInput.getTokens();
        console.log("Current org skill tokens:", tokens.map(token => token.getText()));
    }
    onOrgSkillSubmit(event) {
        const multiInput = event.getSource();
        const value = multiInput.getValue().trim();
        if (value) {
            const existingTokens = multiInput.getTokens();
            const tokenExists = existingTokens.some(token => token.getText().toLowerCase() === value.toLowerCase());
            if (!tokenExists) {
                const newToken = new Token({ text: value, key: value.toLowerCase() });
                multiInput.addToken(newToken);
                multiInput.setValue("");
                MessageToast.show(`Added skill: ${value}`);
            }
            else {
                MessageToast.show(`Skill "${value}" already added`);
                multiInput.setValue("");
            }
        }
    }
    onOrgSkillLiveChange(event) {
        const multiInput = event.getSource();
        const value = multiInput.getValue();
        if (value && value.includes(',')) {
            const skills = value.split(',').map((s) => s.trim()).filter((s) => s);
            if (skills.length > 1) {
                skills.forEach((skill) => {
                    const existingTokens = multiInput.getTokens();
                    const tokenExists = existingTokens.some(token => token.getText().toLowerCase() === skill.toLowerCase());
                    if (!tokenExists) {
                        multiInput.addToken(new Token({ text: skill, key: skill.toLowerCase() }));
                    }
                });
                multiInput.setValue("");
            }
        }
    }
    async onOrgSearch() {
        const multiInput = this.byId("orgSkillsSearch");
        const managerFilter = this.byId("orgManagerFilter");
        const teamFilter = this.byId("orgTeamFilter");
        const experienceSelect = this.byId("orgExperienceLevel");
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
            const oDataModel = this.getOwnerComponent()?.getModel();
            // Load all employees
            const employeesBinding = oDataModel.bindList("/Employees");
            let filters = [];
            // Apply manager filter if selected
            if (selectedManager) {
                filters.push(new Filter("managerId", FilterOperator.EQ, selectedManager));
            }
            // Apply team filter if selected
            if (selectedTeam) {
                filters.push(new Filter("team", FilterOperator.EQ, selectedTeam));
            }
            if (filters.length > 0) {
                employeesBinding.filter(filters);
            }
            const contexts = await employeesBinding.requestContexts(0, 9999);
            const allEmployees = contexts.map((ctx) => ctx.getObject())
                .filter((emp) => emp.employeeId && !emp.employeeId.startsWith("MGR"));
            console.log(`Found ${allEmployees.length} employees matching filters`);
            // Load skills and profiles for matching employees
            const enrichedEmployees = await Promise.all(allEmployees.map(async (emp) => {
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
        }
        catch (error) {
            console.error("❌ Error performing organization search:", error);
            MessageToast.show("Error performing search");
        }
    }
    performOrgSearch(employees, searchSkills, experienceLevel) {
        return employees.filter(emp => {
            const empSkills = emp.skills || [];
            // If no skills specified, return all
            if (searchSkills.length === 0 && !experienceLevel) {
                return true;
            }
            // Check skill match
            if (searchSkills.length > 0) {
                const matchingSkills = empSkills.filter((skill) => searchSkills.some(searchSkill => skill.skillName.toLowerCase().includes(searchSkill)));
                if (matchingSkills.length === 0) {
                    return false;
                }
                // Check experience level
                if (experienceLevel) {
                    const meetsExperience = matchingSkills.some((skill) => this.matchesExperienceRequirement(skill.proficiencyLevel, experienceLevel));
                    if (!meetsExperience) {
                        return false;
                    }
                }
            }
            return true;
        }).map(emp => {
            const empSkills = emp.skills || [];
            const matchingSkills = empSkills
                .filter((s) => searchSkills.some(searchSkill => s.skillName.toLowerCase().includes(searchSkill)))
                .map((s) => `${s.skillName} (${s.proficiencyLevel})`)
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
    calculateMatchScore(empSkills, searchSkills) {
        if (searchSkills.length === 0) {
            return 100;
        }
        const matchedSkills = empSkills.filter((skill) => searchSkills.some(searchSkill => skill.skillName.toLowerCase().includes(searchSkill)));
        if (matchedSkills.length === 0) {
            return 0;
        }
        const proficiencyScores = {
            "Beginner": 50,
            "Intermediate": 75,
            "Proficient": 100,
            "Advanced": 90,
            "Expert": 100
        };
        let totalScore = 0;
        matchedSkills.forEach((skill) => {
            const proficiency = skill.proficiencyLevel || "Beginner";
            totalScore += proficiencyScores[proficiency] || 50;
        });
        const averageScore = totalScore / searchSkills.length;
        if (matchedSkills.length >= searchSkills.length) {
            return Math.min(100, Math.round(averageScore * 1.1));
        }
        return Math.round(averageScore);
    }
    displayOrgSearchResults(results) {
        const searchResultsSection = this.byId("orgSearchResultsSection");
        const searchResultsPanel = this.byId("orgSearchResultsPanel");
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
    onManagerSelect(event) {
        const table = event.getSource();
        const selectedItem = table.getSelectedItem();
        if (selectedItem) {
            const bindingContext = selectedItem.getBindingContext("allManagers");
            const manager = bindingContext.getObject();
            console.log("Manager selected:", manager);
        }
    }
    // Helper methods
    async getEmployeeSkills(employeeId) {
        try {
            const oDataModel = this.getOwnerComponent()?.getModel();
            const listBinding = oDataModel.bindList("/Skills");
            listBinding.filter([new Filter("employeeId", FilterOperator.EQ, employeeId)]);
            const contexts = await listBinding.requestContexts(0, 1000);
            return contexts.map((context) => context.getObject());
        }
        catch (error) {
            console.error(`Error loading skills for ${employeeId}:`, error);
            return [];
        }
    }
    async getEmployeeProfile(employeeId) {
        try {
            const oDataModel = this.getOwnerComponent()?.getModel();
            const listBinding = oDataModel.bindList("/Profiles");
            listBinding.filter([new Filter("employeeId", FilterOperator.EQ, employeeId)]);
            const contexts = await listBinding.requestContexts(0, 1);
            const profiles = contexts.map((context) => context.getObject());
            return profiles.length > 0 ? profiles[0] : null;
        }
        catch (error) {
            console.error(`Error loading profile for ${employeeId}:`, error);
            return null;
        }
    }
    async getManagerName(managerId) {
        try {
            const oDataModel = this.getOwnerComponent()?.getModel();
            const listBinding = oDataModel.bindList("/Managers");
            listBinding.filter([new Filter("managerId", FilterOperator.EQ, managerId)]);
            const contexts = await listBinding.requestContexts(0, 1);
            if (contexts.length > 0) {
                const manager = contexts[0].getObject();
                return manager.name || managerId;
            }
            return managerId;
        }
        catch (error) {
            console.error(`Error loading manager name for ${managerId}:`, error);
            return managerId;
        }
    }
    // ==================== ORG SEARCH RESULT DETAIL POPUP ====================
    onViewOrgSearchResult(event) {
        const source = event.getSource();
        let bindingContext = source.getBindingContext("orgSearchResults");
        if (!bindingContext) {
            const parent = source.getParent ? source.getParent() : source;
            bindingContext = parent.getBindingContext("orgSearchResults");
        }
        if (!bindingContext) {
            MessageToast.show("Unable to get employee details. Please try again.");
            return;
        }
        const result = bindingContext.getObject();
        this.openEmployeeDetailsDialog(result);
    }
    async openEmployeeDetailsDialog(employee) {
        const dialog = this.byId("smgrEmpDetailsDialog");
        if (!dialog) {
            MessageToast.show("Dialog not found");
            return;
        }
        const empId = employee.employeeId || employee.id;
        try {
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
            const completeData = {
                ...employeeData,
                ...profileData,
                skills,
                projects,
                currentProjects,
                caiaUtilization,
                pocUtilization,
                certifications
            };
            this.getView()?.setModel(new JSONModel(completeData), "employeeDetails");
            this.byId("smgrDialogEmployeeName")?.setText(employeeData.name || '');
            this.byId("smgrDialogEmployeeId")?.setText(employeeData.employeeId || '');
            this.byId("smgrDialogEmployeeEmail")?.setText(employeeData.email || '');
            this.byId("smgrDialogEmployeeTeam")?.setText(employeeData.team || '');
            this.byId("smgrDialogEmployeeSpecialization")?.setText(employeeData.specialization || '');
            this.byId("smgrDialogEmployeeManager")?.setText(employeeData.managerId || '');
            this.byId("smgrDialogEmployeeRole")?.setText(profileData.role || 'N/A');
            this.byId("smgrDialogEmployeeLocation")?.setText(profileData.location || 'N/A');
            this.byId("smgrDialogEmployeeTLevel")?.setText(profileData.tLevel || 'N/A');
            this.byId("smgrDialogEmployeeLastUpdated")?.setText(profileData.lastUpdated ? new Date(profileData.lastUpdated).toLocaleDateString() : 'N/A');
            const statusControl = this.byId("smgrDialogWorkStatus");
            statusControl?.setText(this.formatWorkingStatus(employee.working_on_project));
            statusControl?.setState(this.formatWorkingStatusState(employee.working_on_project));
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const activeCount = currentProjects.filter((cp) => {
                if (!cp.startDate || !cp.endDate)
                    return false;
                const s = new Date(cp.startDate);
                const e = new Date(cp.endDate);
                s.setHours(0, 0, 0, 0);
                e.setHours(0, 0, 0, 0);
                return today >= s && today <= e;
            }).length;
            this.byId("smgrDialogActiveProjects")?.setNumber(activeCount);
            this.byId("smgrDialogActiveProjects")?.setUnit(activeCount === 1 ? "project" : "projects");
            this.byId("smgrDialogTotalSkills")?.setNumber(skills.length);
            this.byId("smgrDialogTotalSkills")?.setUnit(skills.length === 1 ? "skill" : "skills");
            this.byId("smgrDialogTotalProjects")?.setNumber(projects.length);
            this.byId("smgrDialogTotalProjects")?.setUnit(projects.length === 1 ? "project" : "projects");
            this.byId("smgrDialogTotalCertifications")?.setNumber(certifications.length);
            this.byId("smgrDialogTotalCertifications")?.setUnit(certifications.length === 1 ? "certification" : "certifications");
            // Match tab
            const matchTab = this.byId("smgrDialogMatchTab");
            if (employee.matchScore !== undefined) {
                matchTab?.setVisible(true);
                const ms = this.byId("smgrDialogMatchScore");
                ms?.setPercentValue(employee.matchScore);
                ms?.setDisplayValue(employee.matchScore + "%");
                ms?.setState(this.formatMatchScoreState(employee.matchScore));
                const ml = this.byId("smgrDialogMatchLevel");
                ml?.setText(this.formatMatchScoreText(employee.matchScore));
                ml?.setState(this.formatMatchScoreState(employee.matchScore));
                this.byId("smgrDialogMatchingSkills")?.setText(employee.matchingSkills || "N/A");
            }
            else {
                matchTab?.setVisible(false);
            }
            dialog.open();
        }
        catch (error) {
            console.error("❌ Error loading employee details:", error);
            MessageToast.show("Error loading employee details");
        }
    }
    onCloseEmployeeDialog() {
        this.byId("smgrEmpDetailsDialog")?.close();
    }
    onContactEmployee() {
        const name = this.byId("dialogEmployeeName")?.getText();
        MessageToast.show(`Contacting ${name}...`);
    }
    async loadEmployeeData(employeeId) {
        try {
            const oDataModel = this.getOwnerComponent()?.getModel();
            const binding = oDataModel.bindList("/Employees");
            binding.filter([new Filter("employeeId", FilterOperator.EQ, employeeId)]);
            const contexts = await binding.requestContexts(0, 1);
            return contexts.length > 0 ? contexts[0].getObject() : {};
        }
        catch {
            return {};
        }
    }
    async loadProfileData(employeeId) {
        try {
            const oDataModel = this.getOwnerComponent()?.getModel();
            const binding = oDataModel.bindList("/Profiles");
            binding.filter([new Filter("employeeId", FilterOperator.EQ, employeeId)]);
            const contexts = await binding.requestContexts(0, 1);
            return contexts.length > 0 ? contexts[0].getObject() : {};
        }
        catch {
            return {};
        }
    }
    async getEmployeeProjects(employeeId) {
        try {
            const oDataModel = this.getOwnerComponent()?.getModel();
            const binding = oDataModel.bindList("/Projects");
            binding.filter([new Filter("employeeId", FilterOperator.EQ, employeeId)]);
            const contexts = await binding.requestContexts();
            return contexts.map((c) => c.getObject());
        }
        catch {
            return [];
        }
    }
    async getCurrentProjects(employeeId) {
        try {
            const oDataModel = this.getOwnerComponent()?.getModel();
            const binding = oDataModel.bindList("/CurrentProjects");
            binding.filter([new Filter("employeeId", FilterOperator.EQ, employeeId)]);
            const contexts = await binding.requestContexts();
            return contexts.map((c) => c.getObject());
        }
        catch {
            return [];
        }
    }
    async getCAIAUtilization(employeeId) {
        try {
            const oDataModel = this.getOwnerComponent()?.getModel();
            const binding = oDataModel.bindList("/CAIAUtilization");
            binding.filter([new Filter("employeeId", FilterOperator.EQ, employeeId)]);
            const contexts = await binding.requestContexts();
            return contexts.map((c) => c.getObject());
        }
        catch {
            return [];
        }
    }
    async getPOCUtilization(employeeId) {
        try {
            const oDataModel = this.getOwnerComponent()?.getModel();
            const binding = oDataModel.bindList("/POCUtilization");
            binding.filter([new Filter("employeeId", FilterOperator.EQ, employeeId)]);
            const contexts = await binding.requestContexts();
            return contexts.map((c) => c.getObject());
        }
        catch {
            return [];
        }
    }
    async getCertifications(employeeId) {
        try {
            const oDataModel = this.getOwnerComponent()?.getModel();
            const binding = oDataModel.bindList("/Certifications");
            binding.filter([new Filter("employeeId", FilterOperator.EQ, employeeId)]);
            const contexts = await binding.requestContexts();
            return contexts.map((c) => c.getObject());
        }
        catch {
            return [];
        }
    }
    // Formatters
    formatWorkingStatus(workingOnProject) {
        return workingOnProject ? "Working on Project" : "Available";
    }
    formatWorkingStatusState(workingOnProject) {
        return workingOnProject ? "Error" : "Success";
    }
    formatProficiencyState(proficiencyLevel) {
        const map = {
            "Expert": "Success", "Advanced": "Success",
            "Proficient": "Information", "Intermediate": "Warning", "Beginner": "None"
        };
        return map[proficiencyLevel] || "None";
    }
    formatCertificationState(certificationStatus) {
        const map = {
            "Certified": "Success", "In Progress": "Warning",
            "Not Certified": "None", "None": "None"
        };
        return map[certificationStatus] || "None";
    }
    formatUtilizationPercent(hoursPerDay) {
        if (!hoursPerDay || hoursPerDay === 0)
            return "0%";
        return `${Math.round((hoursPerDay / 8) * 100)}%`;
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
    // ==================== AI Assistant Methods ====================
    /**
     * Open AI Assistant Dialog
     */
    onOpenAIAssistant() {
        const currentUserModel = this.getOwnerComponent()
            ?.getModel("currentUser");
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
            console.log(`🔄 Different senior manager detected (was: ${this.currentChatSeniorManagerId}, now: ${newSeniorManagerId})`);
            this.clearChatForNewSeniorManager();
            this.currentChatSeniorManagerId = newSeniorManagerId;
        }
        this.seniorManagerId = newSeniorManagerId;
        // Initialize chat only once per senior manager
        const oContainer = this.byId("messagesContainerSeniorManager");
        if (!oContainer || oContainer.getItems().length === 0) {
            this.initializeAIChat();
        }
        const oDialog = this.byId("aiAssistantDialogSeniorManager");
        oDialog?.open();
    }
    /**
     * Close AI Assistant Dialog
     */
    onCloseAIDialog() {
        const oDialog = this.byId("aiAssistantDialogSeniorManager");
        oDialog?.close();
        // ❗ Do NOT clear chat here
    }
    clearChatForNewSeniorManager() {
        console.log("🧹 Clearing chat for new senior manager");
        const oContainer = this.byId("messagesContainerSeniorManager");
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
            console.log("ℹ️ Senior Manager AI chat already initialized");
            return;
        }
        const currentUserModel = this.getOwnerComponent()
            ?.getModel("currentUser");
        const userData = currentUserModel?.getData();
        const seniorManagerName = userData?.name || "Senior Manager";
        this.addBotMessage(`👋 Hello ${seniorManagerName}! I'm your AI assistant.\n\n` +
            "I can help you with:\n" +
            "• Organization-wide talent insights\n" +
            "• Resource allocation across teams\n" +
            "• Identifying skill gaps and training needs\n" +
            "• Strategic workforce planning\n" +
            "• Cross-team collaboration opportunities\n\n" +
            "What would you like to know?");
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
        const input = this.byId("messageInputSeniorManager");
        input?.setValue(query);
        this.onSendMessage();
    }
    /**
     * Clear chat manually (button action)
     */
    onClearChat() {
        console.log("🧹 Manual chat clear requested");
        const oContainer = this.byId("messagesContainerSeniorManager");
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
    onSendMessage() {
        const oInput = this.byId("messageInputSeniorManager");
        const sMessage = oInput?.getValue().trim();
        if (!sMessage) {
            MessageToast.show("Please enter a message");
            return;
        }
        // Ensure seniorManagerId exists
        if (!this.seniorManagerId) {
            const currentUserModel = this.getOwnerComponent()
                ?.getModel("currentUser");
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
    async queryAI(query) {
        try {
            console.log("🤖 Querying AI");
            console.log("  - Senior Manager ID:", this.seniorManagerId);
            console.log("  - Query:", query);
            if (!this.seniorManagerId) {
                throw new Error("Senior Manager ID is required");
            }
            const response = await fetch("/odata/v4/skillsphere/seniorManagerQuery", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify({
                    seniorManagerId: this.seniorManagerId,
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
        const oContainer = this.byId("messagesContainerSeniorManager");
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
        const oContainer = this.byId("messagesContainerSeniorManager");
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
        const oContainer = this.byId("messagesContainerSeniorManager");
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
    removeTypingIndicator() {
        if (this.typingIndicator) {
            const oContainer = this.byId("messagesContainerSeniorManager");
            const items = oContainer?.getItems() || [];
            // Find and remove the parent HBox containing the typing indicator
            for (let i = items.length - 1; i >= 0; i--) {
                const item = items[i];
                if (item instanceof HBox) {
                    const vbox = item.getItems()[0];
                    if (vbox instanceof VBox) {
                        const innerItems = vbox.getItems();
                        if (innerItems.some((inner) => inner === this.typingIndicator)) {
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
    scrollToBottom() {
        setTimeout(() => {
            const oScrollContainer = this.byId("chatContainerSeniorManager");
            if (oScrollContainer) {
                oScrollContainer.scrollTo(0, 10000);
            }
        }, 100);
    }
}
