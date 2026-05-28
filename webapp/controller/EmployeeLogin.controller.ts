import Controller from "sap/ui/core/mvc/Controller";
import Router from "sap/ui/core/routing/Router";
import MessageToast from "sap/m/MessageToast";
import JSONModel from "sap/ui/model/json/JSONModel";
import Input from "sap/m/Input";
import LocalAuth from "../service/LocalAuth";

export default class EmployeeLogin extends Controller {

    public onInit(): void {
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

            if (LocalAuth.isLocalMode()) {
                const employeeId = (this.byId("employeeId") as Input)?.getValue().trim();
                const password = (this.byId("employeePassword") as Input)?.getValue().trim();
                const result = await LocalAuth.authenticate("Employee", employeeId, password, oDataModel);

                if (!result.success || !result.user || !result.navigation) {
                    MessageToast.show(result.message || "Login failed. Please try again.");
                    return;
                }

                const currentUserModel = this.getOwnerComponent()?.getModel("currentUser") as JSONModel;
                currentUserModel.setData(result.user);
                MessageToast.show("Welcome, " + result.user.name + "!");
                this.getRouter().navTo(result.navigation.routeName, result.navigation.parameters);
                return;
            }

            const actionBinding = oDataModel.bindContext("/currentUserContext(...)");
            await actionBinding.execute();
            const userContext = actionBinding.getBoundContext()?.getObject();


            if (!userContext?.authorized || userContext.role !== "Employee") {
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
