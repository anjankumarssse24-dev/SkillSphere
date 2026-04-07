import Controller from "sap/ui/core/mvc/Controller";
import Router from "sap/ui/core/routing/Router";
import MessageToast from "sap/m/MessageToast";
import Input from "sap/m/Input";
import JSONModel from "sap/ui/model/json/JSONModel";
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";

export default class ManagerLogin extends Controller {

    public onInit(): void {
        console.log("ManagerLogin controller initialized");
    }

    private getRouter(): Router {
        return (this.getOwnerComponent() as any).getRouter();
    }

    public onNavBack(): void {
        this.getRouter().navTo("Landing");
    }

    public async onManagerLogin(): Promise<void> {
        const managerIdInput = this.byId("managerId") as Input;
        const passwordInput = this.byId("managerPassword") as Input;

        const managerId = managerIdInput.getValue();
        const password = passwordInput.getValue();

        if (!managerId || !password) {
            MessageToast.show("Please enter Manager ID and Password");
            return;
        }

        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            console.log("OData Model:", oDataModel);
            
            if (!oDataModel) {
                MessageToast.show("Service not available. Please try again.");
                console.error("OData model not available");
                return;
            }

            // Convert to uppercase to match CSV data format
            const managerIdUpper = managerId.toUpperCase();
            console.log("Searching for user with ID:", managerIdUpper);
            
            const userBinding = oDataModel.bindList("/Users");
            userBinding.filter([new Filter("id", FilterOperator.EQ, managerIdUpper)]);
            
            let userContexts;
            try {
                userContexts = await userBinding.requestContexts(0, 2);
                console.log("✅ User contexts received:", userContexts ? userContexts.length : 0);
            } catch (contextError) {
                console.error("❌ Error requesting user contexts:", contextError);
                MessageToast.show("Failed to fetch user data. Please try again.");
                return;
            }
            
            if (userContexts.length === 0) {
                console.error("No user found with ID:", managerIdUpper);
                MessageToast.show("Invalid Manager ID or Password");
                return;
            }

            const user = userContexts[0].getObject();
            console.log("User data from OData:", user);
            
            if (!user) {
                console.error("User object is null/undefined");
                MessageToast.show("Invalid Manager ID or Password");
                return;
            }
            
            console.log("Role check:", user.role);

            if (user.role !== "Manager" && user.role !== "SeniorManager") {
                console.error("Authentication failed - password or role mismatch");
                MessageToast.show("Invalid Manager ID or Password");
                return;
            }

            console.log("Manager authenticated successfully:", user);

            // Find manager/senior manager profile in unified Employees table
            console.log("Looking for manager profile with employeeId:", user.id);
            const mgrBinding = oDataModel.bindList("/Employees");
            mgrBinding.filter([
                new Filter("employeeId", FilterOperator.EQ, managerIdUpper)
            ]);
            const allMgrContexts = await mgrBinding.requestContexts(0, 1);
            const manager = allMgrContexts.length > 0 ? allMgrContexts[0].getObject() : null;
            
            console.log("Manager details found:", manager);

            const currentUserModel = this.getOwnerComponent()?.getModel("currentUser") as JSONModel;
            const userData = {
                id: user.id,
                name: manager?.name || user.id,
                role: user.role,
                team: manager?.team || "",
                subTeam: manager?.subTeam || "",
                managerId: manager?.employeeId || user.id,
                email: manager?.email || `${user.id}@company.com`,
                isLoggedIn: true
            };
            console.log("Setting currentUser model:", userData);
            currentUserModel.setData(userData);

            MessageToast.show("Welcome, " + (manager?.name || user.id) + "!");
            
            if (user.role === "SeniorManager") {
                console.log("Navigating to SeniorManagerDashboard with seniorManagerId:", user.id);
                this.getRouter().navTo("SeniorManagerDashboard", {
                    seniorManagerId: user.id
                });
            } else {
                console.log("Navigating to ManagerDashboard with managerId:", user.id);
                this.getRouter().navTo("ManagerDashboard", {
                    managerId: user.id
                });
            }
        } catch (error) {
            console.error("Login error:", error);
            MessageToast.show("Login failed. Please try again.");
        }
    }
}
