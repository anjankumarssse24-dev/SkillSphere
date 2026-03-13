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
            
            console.log("Password match:", user.password === password, "Role check:", user.role === "Manager");
            
            if (user.password !== password || user.role !== "Manager") {
                console.error("Authentication failed - password or role mismatch");
                MessageToast.show("Invalid Manager ID or Password");
                return;
            }

            console.log("Manager authenticated successfully:", user);

            // Find manager details by matching managerId with user.id
            console.log("Looking for manager with managerId:", user.id);
            const mgrBinding = oDataModel.bindList("/Managers");
            const allMgrContexts = await mgrBinding.requestContexts(0, 100);
            console.log("Total managers in database:", allMgrContexts.length);
            
            let manager = null;
            for (const ctx of allMgrContexts) {
                const mgr = ctx.getObject();
                console.log("Checking manager:", mgr.managerId, "against user:", user.id);
                if (mgr.managerId === user.id || mgr.managerId === managerIdUpper) {
                    manager = mgr;
                    break;
                }
            }
            
            console.log("Manager details found:", manager);

            const currentUserModel = this.getOwnerComponent()?.getModel("currentUser") as JSONModel;
            const userData = {
                id: user.id,
                name: user.name,
                role: user.role,
                team: user.team || (manager?.team || ""),
                subTeam: user.subTeam || (manager?.subTeam || ""),
                managerId: manager?.managerId || user.id,
                email: manager?.email || `${user.id}@company.com`,
                isLoggedIn: true
            };
            console.log("Setting currentUser model:", userData);
            currentUserModel.setData(userData);

            MessageToast.show("Welcome, " + user.name + "!");
            
            // Check if user ID starts with 'SMGR' for Senior Manager Dashboard routing
            if (user.id.toUpperCase().startsWith("SMGR")) {
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
