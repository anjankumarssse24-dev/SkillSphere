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
        // For demo purposes, show all employees
        // In real app, filter by manager's team
        const employeesModel = this.getOwnerComponent()?.getModel("employees") as JSONModel;
        
        // Check if employees model is loaded
        if (!employeesModel || !employeesModel.getData() || !employeesModel.getData().employees) {
            // If not loaded, wait and try again
            setTimeout(() => {
                this.loadManagerData();
            }, 500);
            return;
        }
        
        const employeesData = employeesModel.getData();
        let employees = employeesData.employees || [];
        
        // Enhance employees data with computed properties
        employees = employees.map((emp: any) => {
            const empSkills = this.getEmployeeSkills(emp);
            return {
                ...emp,
                totalSkills: empSkills.length,
                totalProjects: emp.totalProjects || Math.floor(Math.random() * 5) + 1,
                skills: empSkills
            };
        });
        
        // Update the model with enhanced data
        employeesModel.setData({ employees });
        
        // Set the model on the view
        this.getView()?.setModel(employeesModel, "employees");
        
        // Update analytics with enhanced data
        this.updateAnalytics();
        
        console.log("Loaded employees data:", employees);
    }

    private updateAnalytics(): void {
        const employeesModel = this.getOwnerComponent()?.getModel("employees") as JSONModel;
        const employees = employeesModel?.getData()?.employees || [];
        
        console.log("Updating analytics with employees:", employees);
        
        if (employees.length === 0) {
            console.warn("No employees data available for analytics");
            return;
        }
        
        // Calculate statistics
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
        
        // Calculate most common skill level (mock)
        const skillLevels = ["Beginner", "Intermediate", "Proficient", "Expert"];
        const randomLevel = skillLevels[Math.floor(Math.random() * skillLevels.length)];
        updateControl("commonSkillLevel", randomLevel, "setText");
        
        console.log("Analytics updated:", { totalEmployees, availableEmployees, busyEmployees, totalSkills, utilizationRate, avgSkills });
    }

    public onViewEmployeeDetails(event: Event): void {
        const source = event.getSource();
        const bindingContext = (source as any).getBindingContext("employees");
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

        // Get employee data for search
        const employeesModel = this.getOwnerComponent()?.getModel("employees") as JSONModel;
        const allEmployees = employeesModel?.getData()?.employees || [];

        console.log("Search parameters:", { searchSkills, searchScope, experienceLevel });
        console.log("Available employees for search:", allEmployees);

        // Simulate search results with matching logic
        const searchResults = this.performSkillSearch(allEmployees, searchSkills, searchScope, experienceLevel);
        console.log("Search results generated:", searchResults);

        // Display results
        this.displaySearchResults(searchResults);
    }

    private performSkillSearch(employees: any[], searchSkills: string[], scope: string, experienceLevel: string): any[] {
        // This is a mock implementation - in real scenario, you'd call a backend service
        const results = employees.filter(emp => {
            // Apply scope filter (simplified for demo)
            if (scope === "MyTeam" && emp.team !== "CSI") {
                return false; // Assume current manager manages CSI team
            }
            
            // Simulate skill matching (in real app, you'd check emp.skills array)
            const empSkills = this.getEmployeeSkills(emp);
            const matchingSkills = empSkills.filter(skill => 
                searchSkills.some(searchSkill => 
                    skill.toLowerCase().includes(searchSkill)
                )
            );
            
            // Apply experience filter if specified
            if (experienceLevel && !this.matchesExperienceLevel(emp, experienceLevel)) {
                return false;
            }
            
            return matchingSkills.length > 0;
        }).map(emp => {
            const matchingSkillsArray = this.getMatchingSkills(emp, searchSkills);
            const result = {
                ...emp,
                matchingSkills: matchingSkillsArray.join(", "),
                totalMatchingSkills: matchingSkillsArray.length,
                matchScore: this.calculateMatchScore(emp, searchSkills)
            };
            console.log("Processed search result:", result);
            return result;
        });

        // Sort by match score
        return results.sort((a, b) => b.matchScore - a.matchScore);
    }

    private getEmployeeSkills(employee: any): string[] {
        // Get skills from the centralized skills model
        const skillsModel = this.getOwnerComponent()?.getModel("skills") as JSONModel;
        const allSkills = skillsModel?.getData()?.skills || [];
        
        // Filter skills for this employee
        const employeeSkills = allSkills
            .filter((skill: any) => skill.employeeId === employee.id)
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
        const skillDepth = matchingSkills.length / empSkills.length;
        
        // Calculate score based on match ratio and skill depth
        return Math.round((matchRatio * 0.7 + skillDepth * 0.3) * 100);
    }

    private matchesExperienceLevel(employee: any, experienceLevel: string): boolean {
        // Mock experience level matching based on totalSkills
        const skillCount = employee.totalSkills || 0;
        switch (experienceLevel) {
            case "Beginner":
                return skillCount <= 3;
            case "Intermediate":
                return skillCount >= 4 && skillCount <= 6;
            case "Proficient":
                return skillCount >= 7;
            default:
                return true;
        }
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

        // Populate basic information
        (this.byId("dialogEmployeeName") as any).setText(employee.name);
        (this.byId("dialogEmployeeId") as any).setText(employee.id);
        (this.byId("dialogEmployeeTeam") as any).setText(employee.team);
        (this.byId("dialogEmployeeSpecialization") as any).setText(employee.specialization);

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