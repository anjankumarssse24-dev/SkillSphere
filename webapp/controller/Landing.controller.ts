import Controller from "sap/ui/core/mvc/Controller";
import Router from "sap/ui/core/routing/Router";
import MessageToast from "sap/m/MessageToast";
import Dialog from "sap/m/Dialog";
import Input from "sap/m/Input";
import Select from "sap/m/Select";
import JSONModel from "sap/ui/model/json/JSONModel";

/**
 * @namespace skillsphere.controller
 */
export default class Landing extends Controller {

    public onInit(): void {
        // Landing page initialization
    }

    private getRouter(): Router {
        return (this.getOwnerComponent() as any).getRouter();
    }

    public onRegisterPress(): void {
        const dialog = this.byId("registrationDialog") as Dialog;
        dialog.open();
    }

    public onEmployeeLoginPress(): void {
        this.getRouter().navTo("EmployeeLogin");
    }

    public onManagerLoginPress(): void {
        this.getRouter().navTo("ManagerLogin");
    }

    public onEmployeeRegisterPress(): void {
        const dialog = this.byId("registrationDialog") as Dialog;
        const roleSelect = this.byId("regRole") as Select;
        roleSelect.setSelectedKey("Employee");
        dialog.open();
    }

    public onManagerRegisterPress(): void {
        const dialog = this.byId("registrationDialog") as Dialog;
        const roleSelect = this.byId("regRole") as Select;
        roleSelect.setSelectedKey("Manager");
        dialog.open();
    }

    public onRegisterUser(): void {
        const userIdInput = this.byId("regUserId") as Input;
        const nameInput = this.byId("regName") as Input;
        const roleSelect = this.byId("regRole") as Select;
        const teamSelect = this.byId("regTeam") as Select;
        const passwordInput = this.byId("regPassword") as Input;

        const userId = userIdInput.getValue();
        const name = nameInput.getValue();
        const role = roleSelect.getSelectedKey();
        const team = teamSelect.getSelectedKey();
        const password = passwordInput.getValue();

        // Validate inputs
        if (!userId || !name || !role || !team || !password) {
            MessageToast.show("Please fill all fields");
            return;
        }

        // Get users model
        const usersModel = this.getOwnerComponent()?.getModel("users") as JSONModel;
        const users = usersModel.getData().users;

        // Check if user already exists
        const existingUser = users.find((user: any) => user.id === userId);
        if (existingUser) {
            MessageToast.show("User ID already exists");
            return;
        }

        // Add new user
        const newUser = {
            id: userId,
            name: name,
            password: password,
            role: role,
            team: team,
            subTeam: role === "Employee" ? "Development" : null,
            manager: role === "Employee" ? "Alice Johnson" : null
        };

        users.push(newUser);
        usersModel.setData({ users: users });

        MessageToast.show("User registered successfully!");
        this.onCloseRegisterDialog();
    }

    public onCloseRegisterDialog(): void {
        const dialog = this.byId("registrationDialog") as Dialog;
        dialog.close();
        
        // Clear form
        (this.byId("regUserId") as Input).setValue("");
        (this.byId("regName") as Input).setValue("");
        (this.byId("regRole") as Select).setSelectedKey("");
        (this.byId("regTeam") as Select).setSelectedKey("");
        (this.byId("regPassword") as Input).setValue("");
    }
}