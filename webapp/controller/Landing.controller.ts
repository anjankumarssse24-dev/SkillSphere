import Controller from "sap/ui/core/mvc/Controller";
import Router from "sap/ui/core/routing/Router";
import JSONModel from "sap/ui/model/json/JSONModel";
import LocalAuth from "../service/LocalAuth";

/**
 * @namespace skillsphere.controller
 */
export default class Landing extends Controller {

    public onInit(): void {
        const accessModel = new JSONModel({
            showUnauthorized: false,
            email: "",
            message: "",
            contact: "Please contact your SkillSphere administrator."
        });
        this.getView()?.setModel(accessModel, "access");

        if (!LocalAuth.isLocalMode()) {
            void this.loadAuthorizationState();
        }
    }

    private async loadAuthorizationState(): Promise<void> {
        try {
            const oDataModel = this.getOwnerComponent()?.getModel() as any;
            const accessModel = this.getView()?.getModel("access") as JSONModel;

            if (!oDataModel || !accessModel) {
                return;
            }

            const actionBinding = oDataModel.bindContext("/currentUserContext(...)");
            await actionBinding.execute();
            const userContext = actionBinding.getBoundContext()?.getObject();

            const unauthorized = !!userContext?.authenticated && !userContext?.authorized;
            accessModel.setData({
                showUnauthorized: unauthorized,
                email: userContext?.email || "",
                message: unauthorized
                    ? (userContext?.message || "You are signed in but not assigned a SkillSphere role.")
                    : "",
                contact: "Please contact your SkillSphere administrator."
            });
        } catch (error) {
        }
    }

    private getRouter(): Router {
        return (this.getOwnerComponent() as any).getRouter();
    }

    public onEmployeeLoginPress(): void {
        this.getRouter().navTo("EmployeeLogin");
    }

    public onManagerLoginPress(): void {
        this.getRouter().navTo("ManagerLogin");
    }

    public onSeniorManagerLoginPress(): void {
        this.getRouter().navTo("SeniorManagerLogin");
    }
}