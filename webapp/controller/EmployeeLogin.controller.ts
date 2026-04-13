import Controller from "sap/ui/core/mvc/Controller";
import Router from "sap/ui/core/routing/Router";
import MessageToast from "sap/m/MessageToast";
import JSONModel from "sap/ui/model/json/JSONModel";

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
        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            if (!oDataModel) {
                MessageToast.show("Service not available. Please try again.");
                return;
            }

            const actionBinding = oDataModel.bindContext("/currentUserContext(...)");
            await actionBinding.execute();
            const userContext = actionBinding.getBoundContext()?.getObject();

            console.log("[EmployeeLogin] currentUserContext response:", userContext);

            if (!userContext?.authorized || userContext.role !== "Employee") {
                console.warn("[EmployeeLogin] Access denied details:", {
                    authorized: userContext?.authorized,
                    role: userContext?.role,
                    email: userContext?.email,
                    employeeId: userContext?.employeeId,
                    message: userContext?.message
                });
                MessageToast.show(userContext?.message || "Access denied. Employee role required.");
                return;
            }

            const currentUserModel = this.getOwnerComponent()?.getModel("currentUser") as JSONModel;
            const userData = {
                id: userContext.employeeId,
                name: userContext.name,
                role: userContext.role,
                employeeId: userContext.employeeId,
                email: userContext.email,
                isLoggedIn: true
            };
            currentUserModel.setData(userData);

            MessageToast.show("Welcome, " + userContext.name + "!");
            this.getRouter().navTo("EmployeeDashboard", {
                employeeId: userContext.employeeId
            });
        } catch (error) {
            console.error("Login error:", error);
            MessageToast.show("Login failed. Please try again.");
        }
    }
}
