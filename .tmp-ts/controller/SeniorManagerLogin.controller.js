import Controller from "sap/ui/core/mvc/Controller";
import MessageToast from "sap/m/MessageToast";
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";
/**
 * @namespace skillsphere.controller
 */
export default class SeniorManagerLogin extends Controller {
    onInit() {
        console.log("SeniorManagerLogin controller initialized");
    }
    getRouter() {
        return this.getOwnerComponent().getRouter();
    }
    onNavBack() {
        this.getRouter().navTo("Landing");
    }
    async onSeniorManagerLogin() {
        const managerIdInput = this.byId("seniorManagerId");
        const passwordInput = this.byId("seniorManagerPassword");
        const managerId = managerIdInput.getValue();
        const password = passwordInput.getValue();
        if (!managerId || !password) {
            MessageToast.show("Please enter Manager ID and Password");
            return;
        }
        try {
            const oDataModel = this.getOwnerComponent()?.getModel();
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
            }
            catch (contextError) {
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
            console.log("Password match:", user.password === password, "Role check:", user.role);
            // Allow Manager role to access Senior Manager dashboard (in real scenario, you'd have a separate role)
            if (user.password !== password || user.role !== "Manager") {
                console.error("Authentication failed - password or role mismatch");
                MessageToast.show("Invalid Manager ID or Password");
                return;
            }
            console.log("Senior Manager authenticated successfully:", user);
            // Find manager details
            console.log("Looking for manager with managerId:", user.id);
            const mgrBinding = oDataModel.bindList("/Managers");
            const allMgrContexts = await mgrBinding.requestContexts(0, 100);
            console.log("Total managers in database:", allMgrContexts.length);
            let manager = null;
            for (const ctx of allMgrContexts) {
                const mgr = ctx.getObject();
                if (mgr.managerId === user.id || mgr.managerId === managerIdUpper) {
                    manager = mgr;
                    break;
                }
            }
            if (!manager) {
                console.error("❌ Manager profile not found for ID:", managerIdUpper);
                MessageToast.show("Manager profile not found. Please contact administrator.");
                return;
            }
            console.log("✅ Manager profile found:", manager);
            // Set current user in global model
            const currentUserModel = this.getOwnerComponent()?.getModel("currentUser");
            if (currentUserModel) {
                currentUserModel.setData({
                    id: user.id,
                    name: manager.name || user.name,
                    role: "Senior Manager",
                    team: manager.team || user.team,
                    isLoggedIn: true
                });
                console.log("✅ Current user model set:", currentUserModel.getData());
            }
            else {
                console.warn("⚠️ currentUser model not found");
            }
            // Navigate to Senior Manager Dashboard
            MessageToast.show(`Welcome ${manager.name}!`);
            this.getRouter().navTo("SeniorManagerDashboard", {
                seniorManagerId: user.id
            });
        }
        catch (error) {
            console.error("❌ Senior Manager login error:", error);
            MessageToast.show("Login failed. Please try again.");
        }
    }
}
