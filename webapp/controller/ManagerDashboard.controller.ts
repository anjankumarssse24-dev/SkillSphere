import Controller from "sap/ui/core/mvc/Controller";
import Router from "sap/ui/core/routing/Router";
import MessageToast from "sap/m/MessageToast";
import JSONModel from "sap/ui/model/json/JSONModel";
import Event from "sap/ui/base/Event";
import Table from "sap/m/Table";
import MultiInput from "sap/m/MultiInput";
import Token from "sap/m/Token";
import Select from "sap/m/Select";

/**
 * @namespace skillsphere.controller
 */
export default class ManagerDashboard extends Controller {

    public onInit(): void {
        const router = this.getRouter();
        router.getRoute("ManagerDashboard")?.attachPatternMatched(this.onRouteMatched, this);
        
        // Ensure models are available - force load if needed
        this.ensureModelsAvailable();
        
        // Also try to load data immediately in case route matching fails
        setTimeout(() => {
            this.loadManagerData();
        }, 1000);
    }

    private ensureModelsAvailable(): void {
        const employeesModel = this.getOwnerComponent()?.getModel("employees") as JSONModel;
        if (!employeesModel || !employeesModel.getData() || !employeesModel.getData().employees) {
            console.log("Employees model not ready, setting fallback data");
            const fallbackEmployees = new JSONModel({
                employees: [
                    {
                        id: "EMP001",
                        name: "John Doe",
                        team: "CSI",
                        subTeam: "Development",
                        manager: "Alice Johnson",
                        totalSkills: 5,
                        totalProjects: 3,
                        specialization: "SAPUI5 Developer",
                        working_on_project: true
                    },
                    {
                        id: "EMP002",
                        name: "Jane Smith",
                        team: "CSI",
                        subTeam: "Development",
                        manager: "Alice Johnson",
                        totalSkills: 4,
                        totalProjects: 2,
                        specialization: "Data Science",
                        working_on_project: false
                    },
                    {
                        id: "EMP003",
                        name: "Bob Wilson",
                        team: "CSI",
                        subTeam: "Development",
                        manager: "Alice Johnson",
                        totalSkills: 6,
                        totalProjects: 4,
                        specialization: "SAP HANA Developer",
                        working_on_project: true
                    }
                ]
            });
            this.getOwnerComponent()?.setModel(fallbackEmployees, "employees");
        }
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

        // Navigate back to landing page
        this.getRouter().navTo("Landing");
        MessageToast.show("You have been logged out");
    }

    private onRouteMatched(event: Event): void {
        // Load manager-specific data
        this.loadManagerData();
    }

    private loadManagerData(): void {
        // Get current manager's information
        const currentUserModel = this.getOwnerComponent()?.getModel("currentUser") as JSONModel;
        const currentUser = currentUserModel?.getData();
        const currentManagerId = currentUser?.id; // Now using manager ID
        const currentManagerName = currentUser?.name;

        console.log("Current manager ID:", currentManagerId, "Name:", currentManagerName);

        if (!currentManagerId) {
            console.error("Manager ID not found in currentUser model");
            MessageToast.show("Manager information not available. Please login again.");
            return;
        }

        // Get all employees and filter by managerId
        const employeesModel = this.getOwnerComponent()?.getModel("employees") as JSONModel;
        const employeesData = employeesModel?.getData();
        
        console.log("Loading manager data...", employeesData);
        
        let allEmployees = employeesData?.employees || [];
        
        // Filter employees who belong to this manager using managerId
        let employees = allEmployees.filter((emp: any) => {
            const isEmployee = emp.employeeId && emp.employeeId.startsWith("EMP");
            const hasManagerId = emp.managerId && emp.managerId.trim() !== "";
            const reportsToThisManager = emp.managerId === currentManagerId;
            
            console.log(`Checking ${emp.employeeId} (${emp.name}): isEmployee=${isEmployee}, hasManagerId=${hasManagerId}, managerId=${emp.managerId}, match=${reportsToThisManager}`);
            
            return isEmployee && hasManagerId && reportsToThisManager;
        });

        console.log(`Employees reporting to ${currentManagerName} (${currentManagerId}):`, employees);

        // Add totalSkills count from skills model
        employees = employees.map((emp: any) => {
            const empSkills = this.getEmployeeSkills(emp);
            return {
                ...emp,
                totalSkills: empSkills.length
            };
        });

        // Sort employees by name alphabetically
        employees.sort((a: any, b: any) => {
            const nameA = (a.name || '').toUpperCase();
            const nameB = (b.name || '').toUpperCase();
            return nameA.localeCompare(nameB);
        });

        console.log("Employees with skill counts (sorted):", employees);

        // Create local model for employees
        const localEmployeesModel = new JSONModel({ employees });
        this.getView()?.setModel(localEmployeesModel, "managerEmployees");

        // Update analytics for this manager's team
        this.updateAnalytics();
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

    public onSearchEmployees(): void {
        const multiInput = this.byId("skillsSearchInput") as MultiInput;
        const scopeSelect = this.byId("searchScope") as Select;
        const experienceSelect = this.byId("experienceLevel") as Select;
        
        if (!multiInput) {
            MessageToast.show("Search input not found");
            return;
        }

        const skillTokens = multiInput.getTokens();
        const searchSkills = skillTokens.map(token => token.getText().toLowerCase());
        const searchScope = scopeSelect?.getSelectedKey() || "MyTeam";
        const experienceLevel = experienceSelect?.getSelectedKey() || "";

        if (searchSkills.length === 0) {
            MessageToast.show("Please enter at least one skill to search");
            return;
        }

        // Get current manager's name for filtering
        const currentUserModel = this.getOwnerComponent()?.getModel("currentUser") as JSONModel;
        const currentUser = currentUserModel?.getData();
        const currentManagerId = currentUser?.id;

        // Get employee data for search - filter by manager if scope is MyTeam
        const employeesModel = this.getOwnerComponent()?.getModel("employees") as JSONModel;
        let allEmployees = employeesModel?.getData()?.employees || [];
        
        // Filter by scope - ensure only actual employees (no managers)
        if (searchScope === "MyTeam" && currentManagerId) {
            allEmployees = allEmployees.filter((emp: any) => {
                const isEmployee = emp.employeeId && emp.employeeId.startsWith("EMP");
                const hasManagerId = emp.managerId && emp.managerId.trim() !== "";
                const reportsToThisManager = emp.managerId === currentManagerId;
                return isEmployee && hasManagerId && reportsToThisManager;
            });
        } else {
            // For "All" scope, only show actual employees
            allEmployees = allEmployees.filter((emp: any) => 
                emp.employeeId && emp.employeeId.startsWith("EMP")
            );
        }

        console.log("Search parameters:", { searchSkills, searchScope, experienceLevel, currentManagerId });
        console.log("Available employees for search:", allEmployees);

        // Perform skill-based search using CSV data
        const searchResults = this.performSkillSearch(allEmployees, searchSkills, experienceLevel);
        console.log("Search results generated:", searchResults);

        // Display results
        this.displaySearchResults(searchResults);
    }

    private performSkillSearch(employees: any[], searchSkills: string[], experienceLevel: string): any[] {
        // Get all skills from the skills model (loaded from CSV)
        const skillsModel = this.getOwnerComponent()?.getModel("skills") as JSONModel;
        const allSkills = skillsModel?.getData()?.skills || [];
        
        console.log("Searching with skills model:", allSkills);
        
        // Search employees who have matching skills in skills.csv
        const results = employees.filter(emp => {
            // Get this employee's skills from the skills CSV
            const empSkills = this.getEmployeeSkills(emp);
            
            // Check if employee has any of the searched skills
            const matchingSkills = empSkills.filter(skill => 
                searchSkills.some(searchSkill => 
                    skill.toLowerCase().includes(searchSkill)
                )
            );
            
            if (matchingSkills.length === 0) {
                return false; // No skill match
            }
            
            // Apply experience filter if specified
            if (experienceLevel) {
                // Get the proficiency levels for matched skills
                const empSkillObjects = allSkills.filter((s: any) => 
                    s.employeeId === emp.id && 
                    matchingSkills.some(ms => s.skillName.toLowerCase().includes(ms.toLowerCase()))
                );
                
                // Check if any matched skill meets the experience requirement
                const meetsExperience = empSkillObjects.some((skill: any) => 
                    this.matchesExperienceRequirement(skill.proficiencyLevel, experienceLevel)
                );
                
                return meetsExperience;
            }
            
            return true; // Has matching skills
        }).map(emp => {
            const matchingSkillsArray = this.getMatchingSkills(emp, searchSkills);
            
            // Get proficiency levels for matched skills
            const matchedSkillDetails = allSkills
                .filter((s: any) => 
                    s.employeeId === emp.id && 
                    matchingSkillsArray.some(ms => s.skillName.toLowerCase() === ms.toLowerCase())
                )
                .map((s: any) => `${s.skillName} (${s.proficiencyLevel})`)
                .join(", ");
            
            const result = {
                ...emp,
                matchingSkills: matchedSkillDetails || matchingSkillsArray.join(", "),
                totalMatchingSkills: matchingSkillsArray.length,
                matchScore: this.calculateMatchScore(emp, searchSkills)
            };
            console.log("Processed search result:", result);
            return result;
        });

        // Sort by match score
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

    private getEmployeeSkills(employee: any): string[] {
        // Get skills from the centralized skills model
        const skillsModel = this.getOwnerComponent()?.getModel("skills") as JSONModel;
        const allSkills = skillsModel?.getData()?.skills || [];
        
        // Filter skills for this employee - use employeeId or id
        const empId = employee.employeeId || employee.id;
        const employeeSkills = allSkills
            .filter((skill: any) => skill.employeeId === empId)
            .map((skill: any) => skill.skillName);
        
        // Return unique skills
        return Array.from(new Set(employeeSkills));
    }

    private getMatchingSkills(employee: any, searchSkills: string[]): string[] {
        const empSkills = this.getEmployeeSkills(employee);
        return empSkills.filter(skill => 
            searchSkills.some(searchSkill => 
                skill.toLowerCase().includes(searchSkill.toLowerCase())
            )
        );
    }

    private calculateMatchScore(employee: any, searchSkills: string[]): number {
        const empSkills = this.getEmployeeSkills(employee);
        const matchingSkills = this.getMatchingSkills(employee, searchSkills);
        const matchRatio = matchingSkills.length / searchSkills.length;
        const skillDepth = empSkills.length > 0 ? matchingSkills.length / empSkills.length : 0;
        
        // Calculate score based on match ratio and skill depth
        return Math.round((matchRatio * 0.7 + skillDepth * 0.3) * 100);
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

    private openEmployeeDetailsDialog(employee: any, isSearchResult: boolean): void {
        // Get dialog reference
        const dialog = this.byId("employeeDetailsDialog") as any;
        if (!dialog) {
            MessageToast.show("Dialog not found");
            return;
        }

        // Use employeeId or id for backward compatibility
        const empId = employee.employeeId || employee.id;
        const empName = employee.name || '';
        const empTeam = employee.team || '';
        const empSpecialization = employee.specialization || '';

        // Populate basic information
        (this.byId("dialogEmployeeName") as any).setText(empName);
        (this.byId("dialogEmployeeId") as any).setText(empId);
        (this.byId("dialogEmployeeTeam") as any).setText(empTeam);
        (this.byId("dialogEmployeeSpecialization") as any).setText(empSpecialization);

        // Populate skills information
        const skillsContainer = this.byId("dialogEmployeeSkills") as any;
        if (skillsContainer) {
            skillsContainer.removeAllItems();
            
            const employeeSkills = this.getEmployeeSkills(employee);
            employeeSkills.forEach(skill => {
                const skillToken = new Token({
                    text: skill
                });
                skillToken.addStyleClass("sapUiTinyMargin");
                skillsContainer.addItem(skillToken);
            });
            
            (this.byId("dialogTotalSkills") as any)?.setText(employeeSkills.length.toString());
        }

        // Populate current status
        const statusText = this.formatWorkingStatus(employee.working_on_project);
        const statusState = this.formatWorkingStatusState(employee.working_on_project);
        const statusControl = this.byId("dialogWorkStatus") as any;
        if (statusControl) {
            statusControl.setText(statusText);
            statusControl.setState(statusState);
        }
        
        // Update active projects using ObjectNumber
        const activeProjectsControl = this.byId("dialogActiveProjects") as any;
        if (activeProjectsControl) {
            activeProjectsControl.setNumber(employee.totalProjects || 0);
            activeProjectsControl.setUnit("projects");
        }

        // Handle match information for search results
        const matchPanel = this.byId("dialogMatchPanel") as any;
        if (isSearchResult && employee.matchScore !== undefined) {
            matchPanel.setVisible(true);
            (this.byId("dialogMatchScore") as any)
                .setPercentValue(employee.matchScore)
                .setDisplayValue(employee.matchScore + "%")
                .setState(this.formatMatchScoreState(employee.matchScore));
            (this.byId("dialogMatchingSkills") as any).setText(employee.matchingSkills || "N/A");
        } else {
            matchPanel.setVisible(false);
        }

        // Open dialog
        dialog.open();
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
}