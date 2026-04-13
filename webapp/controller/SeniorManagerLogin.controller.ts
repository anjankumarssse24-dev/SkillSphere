import Controller from "sap/ui/core/mvc/Controller";
import Router from "sap/ui/core/routing/Router";
import MessageToast from "sap/m/MessageToast";
import JSONModel from "sap/ui/model/json/JSONModel";

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
        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            
            if (!oDataModel) {
                MessageToast.show("Service not available. Please try again.");
                return;
            }

            const actionBinding = oDataModel.bindContext("/currentUserContext(...)");
            await actionBinding.execute();
            const userContext = actionBinding.getBoundContext()?.getObject();

            if (!userContext?.authorized || userContext.role !== "SeniorManager") {
                MessageToast.show(userContext?.message || "Access denied. Senior Manager role required.");
                return;
            }

            // Set current user in global model
            const currentUserModel = this.getOwnerComponent()?.getModel("currentUser") as JSONModel;
            if (currentUserModel) {
                currentUserModel.setData({
                    id: userContext.employeeId,
                    name: userContext.name,
                    role: "SeniorManager",
                    email: userContext.email,
                    isLoggedIn: true
                });
            } else {
                console.warn("⚠️ currentUser model not found");
            }

            // Navigate to Senior Manager Dashboard
            MessageToast.show(`Welcome ${userContext.name}!`);
            this.getRouter().navTo("SeniorManagerDashboard", {
                seniorManagerId: userContext.employeeId
            });

        } catch (error) {
            console.error("❌ Senior Manager login error:", error);
            MessageToast.show("Login failed. Please try again.");
        }
    }
}
