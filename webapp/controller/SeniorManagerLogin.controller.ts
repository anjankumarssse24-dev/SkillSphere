import Controller from "sap/ui/core/mvc/Controller";
import Router from "sap/ui/core/routing/Router";
import MessageToast from "sap/m/MessageToast";
import Input from "sap/m/Input";
import JSONModel from "sap/ui/model/json/JSONModel";
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";

/**
 * @namespace skillsphere.controller
 */
export default class SeniorManagerLogin extends Controller {

    public onInit(): void {
        console.log("SeniorManagerLogin controller initialized");
    }

    private getRouter(): Router {
        return (this.getOwnerComponent() as any).getRouter();
    }

    public onNavBack(): void {
        this.getRouter().navTo("Landing");
    }

    public async onSeniorManagerLogin(): Promise<void> {
        const managerIdInput = this.byId("seniorManagerId") as Input;
        const passwordInput = this.byId("seniorManagerPassword") as Input;

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
            console.log("Searching for Senior Manager with ID:", managerIdUpper);
            
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

            if (user.role !== "SeniorManager") {
                console.error("Authentication failed - password or role mismatch");
                MessageToast.show("Invalid Manager ID or Password");
                return;
            }

            console.log("Senior Manager authenticated successfully:", user);

            // Find profile in unified Employees table
            console.log("Looking for senior manager with employeeId:", user.id);
            const mgrBinding = oDataModel.bindList("/Employees");
            mgrBinding.filter([
                new Filter("employeeId", FilterOperator.EQ, managerIdUpper)
            ]);
            const allMgrContexts = await mgrBinding.requestContexts(0, 1);
            const manager = allMgrContexts.length > 0 ? allMgrContexts[0].getObject() : null;

            if (!manager) {
                console.error("❌ Manager profile not found for ID:", managerIdUpper);
                MessageToast.show("Manager profile not found. Please contact administrator.");
                return;
            }

            console.log("✅ Manager profile found:", manager);

            // Set current user in global model
            const currentUserModel = this.getOwnerComponent()?.getModel("currentUser") as JSONModel;
            if (currentUserModel) {
                currentUserModel.setData({
                    id: user.id,
                    name: manager.name || user.id,
                    role: "Senior Manager",
                    team: manager.team || "",
                    isLoggedIn: true
                });
                console.log("✅ Current user model set:", currentUserModel.getData());
            } else {
                console.warn("⚠️ currentUser model not found");
            }

            // Navigate to Senior Manager Dashboard
            MessageToast.show(`Welcome ${manager.name}!`);
            this.getRouter().navTo("SeniorManagerDashboard", {
                seniorManagerId: user.id
            });

        } catch (error) {
            console.error("❌ Senior Manager login error:", error);
            MessageToast.show("Login failed. Please try again.");
        }
    }
}
