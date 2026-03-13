import Controller from "sap/ui/core/mvc/Controller";
import Router from "sap/ui/core/routing/Router";
import MessageToast from "sap/m/MessageToast";
import Input from "sap/m/Input";
import JSONModel from "sap/ui/model/json/JSONModel";
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";

export default class EmployeeLogin extends Controller {

    public onInit(): void {
        console.log("EmployeeLogin controller initialized");
    }

    private getRouter(): Router {
        return (this.getOwnerComponent() as any).getRouter();
    }

    public onNavBack(): void {
        this.getRouter().navTo("Landing");
    }

    public async onEmployeeLogin(): Promise<void> {
        const employeeIdInput = this.byId("employeeId") as Input;
        const passwordInput = this.byId("employeePassword") as Input;

        const employeeId = employeeIdInput.getValue();
        const password = passwordInput.getValue();

        console.log("Login attempt:", { employeeId, password: password ? "***" : "empty" });

        if (!employeeId || !password) {
            MessageToast.show("Please enter Employee ID and Password");
            return;
        }

        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            console.log("OData Model:", oDataModel);
            console.log("OData Service URL:", oDataModel?.sServiceUrl);
            
            if (!oDataModel) {
                MessageToast.show("Service not available. Please try again.");
                console.error("OData model not available");
                return;
            }

            // Convert to uppercase to match CSV data format
            const employeeIdUpper = employeeId.toUpperCase();
            console.log("Searching for user with ID:", employeeIdUpper);
            
            // Create a list binding for Users entity
            const usersPath = "/Users";
            console.log("Creating list binding for:", usersPath);
            
            const listBinding = oDataModel.bindList(usersPath);
            listBinding.filter([new Filter("id", FilterOperator.EQ, employeeIdUpper)]);
            
            console.log("List binding created, requesting contexts...");
            console.log("Binding details - Path:", listBinding.getPath(), "Model:", listBinding.getModel());
            
            // Request contexts with promise handling
            let userContexts;
            try {
                userContexts = await listBinding.requestContexts(0, 10);
                console.log("✅ Contexts received:", userContexts ? userContexts.length : 0);
            } catch (contextError) {
                console.error("❌ Error requesting contexts:", contextError);
                MessageToast.show("Failed to fetch user data. Please try again.");
                return;
            }
            
            if (userContexts.length === 0) {
                console.error("No user found with ID:", employeeIdUpper);
                MessageToast.show("Invalid Employee ID or Password");
                return;
            }

            const user = userContexts[0].getObject();
            console.log("User data from OData:", user);
            
            if (!user) {
                console.error("User object is null/undefined");
                MessageToast.show("Invalid Employee ID or Password");
                return;
            }
            
            console.log("Password match:", user.password === password, "Role check:", user.role === "Employee");
            
            if (user.password !== password || user.role !== "Employee") {
                console.error("Authentication failed - password or role mismatch");
                MessageToast.show("Invalid Employee ID or Password");
                return;
            }

            console.log("Employee found:", user);

            // Find employee details - try both employeeId and id fields
            console.log("Looking for employee with userId:", user.id);
            const empBinding = oDataModel.bindList("/Employees");
            const allEmpContexts = await empBinding.requestContexts(0, 100);
            console.log("Total employees in database:", allEmpContexts.length);
            
            let employee = null;
            for (const ctx of allEmpContexts) {
                const emp = ctx.getObject();
                console.log("Checking employee:", emp.employeeId, "against user:", user.id);
                if (emp.employeeId === user.id || emp.employeeId === employeeIdUpper) {
                    employee = emp;
                    break;
                }
            }
            
            console.log("Employee details found:", employee);

            const currentUserModel = this.getOwnerComponent()?.getModel("currentUser") as JSONModel;
            const userData = {
                id: user.id,
                name: user.name,
                role: user.role,
                team: user.team || (employee?.team || ""),
                subTeam: user.subTeam || (employee?.subTeam || ""),
                employeeId: employee?.employeeId || user.id,
                email: employee?.email || `${user.id}@company.com`,
                isLoggedIn: true
            };
            console.log("Setting currentUser model:", userData);
            currentUserModel.setData(userData);

            MessageToast.show("Welcome, " + user.name + "!");
            console.log("Navigating to EmployeeDashboard with employeeId:", user.id);
            this.getRouter().navTo("EmployeeDashboard", {
                employeeId: user.id
            });
        } catch (error) {
            console.error("Login error:", error);
            MessageToast.show("Login failed. Please try again.");
        }
    }
}
