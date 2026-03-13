import BaseComponent from "sap/ui/core/UIComponent";
import { createDeviceModel } from "./model/models";
import JSONModel from "sap/ui/model/json/JSONModel";
import { DataManager } from "./service/DataManager";

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
}

    private initializeModels(): void {
        // Initialize current user model
        const currentUserModel = new JSONModel({
            id: null,
            name: null,
            role: null,
            isLoggedIn: false
        });
        this.setModel(currentUserModel, "currentUser");

        // Initialize view state model
        const viewStateModel = new JSONModel({
            busy: false,
            message: null
        });
        this.setModel(viewStateModel, "viewState");

        // Add DataManager to global scope for easy access
        (window as any).dataManager = DataManager.getInstance();

        console.log("Models initialized - using OData service for data");
    }
}
