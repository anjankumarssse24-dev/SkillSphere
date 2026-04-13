import BaseComponent from "sap/ui/core/UIComponent";
import { createDeviceModel } from "./model/models";
import JSONModel from "sap/ui/model/json/JSONModel";
import { DataManager } from "./service/DataManager";
import MessageToast from "sap/m/MessageToast";
import LocalAuth from "./service/LocalAuth";

/**
 * @namespace skillsphere
 */
export default class Component extends BaseComponent {

public static metadata = {
manifest: "json",
        interfaces: [
            "sap.ui.core.IAsyncContentCreation"
        ]
};

public init() : void {
// call the base component's init function
super.init();

        // set the device model
        this.setModel(createDeviceModel(), "device");

        // Initialize local models (OData model is loaded from manifest.json)
        this.initializeModels();

        // enable routing
        this.getRouter().initialize();

        // Resolve authenticated user and redirect to role-based dashboard.
        void this.redirectAuthenticatedUser();
}

    private async redirectAuthenticatedUser(): Promise<void> {
        try {
            if (LocalAuth.isLocalMode()) {
                this.getRouter().navTo("Landing", {}, undefined, true);
                return;
            }

            const oDataModel = this.getModel() as any;
            if (!oDataModel) {
                return;
            }

            const actionBinding = oDataModel.bindContext("/currentUserContext(...)");
            await actionBinding.execute();
            const context = actionBinding.getBoundContext();
            const userContext = context?.getObject();

            if (!userContext || !userContext.authorized) {
                if (userContext?.authenticated && userContext?.message) {
                    MessageToast.show(userContext.message);
                }
                this.getRouter().navTo("Landing", {}, undefined, true);
                return;
            }

            const currentUserModel = this.getModel("currentUser") as JSONModel;
            currentUserModel.setData({
                id: userContext.employeeId,
                name: userContext.name,
                role: userContext.role,
                email: userContext.email,
                isLoggedIn: true
            });

            if (userContext.targetDashboard === "SeniorManagerDashboard") {
                this.getRouter().navTo("SeniorManagerDashboard", {
                    seniorManagerId: userContext.employeeId
                }, undefined, true);
                return;
            }

            if (userContext.targetDashboard === "ManagerDashboard") {
                this.getRouter().navTo("ManagerDashboard", {
                    managerId: userContext.employeeId
                }, undefined, true);
                return;
            }

            if (userContext.targetDashboard === "EmployeeDashboard") {
                this.getRouter().navTo("EmployeeDashboard", {
                    employeeId: userContext.employeeId
                }, undefined, true);
            }
        } catch (error) {
            console.warn("Auto-redirect skipped:", error);
        }
    }

    private initializeModels(): void {
        // Initialize current user model
        const currentUserModel = new JSONModel({
            id: null,
            name: null,
            role: null,
            email: null,
            isLoggedIn: false
        });
        this.setModel(currentUserModel, "currentUser");

        // Initialize view state model
        const viewStateModel = new JSONModel({
            busy: false,
            message: null
        });
        this.setModel(viewStateModel, "viewState");

        const appConfigModel = new JSONModel({
            isLocalMode: LocalAuth.isLocalMode(),
            mockUsers: LocalAuth.getMockUsers()
        });
        this.setModel(appConfigModel, "appConfig");

        // Add DataManager to global scope for easy access
        (window as any).dataManager = DataManager.getInstance();

        console.log("Models initialized - using OData service for data");
    }
}
