import Controller from "sap/ui/core/mvc/Controller";
import Router from "sap/ui/core/routing/Router";
import MessageToast from "sap/m/MessageToast";
import Input from "sap/m/Input";
import JSONModel from "sap/ui/model/json/JSONModel";

/**
 * @namespace skillsphere.controller
 */
export default class ManagerLogin extends Controller {

    public onInit(): void {
        // Manager login initialization
        console.log("ManagerLogin controller initialized");
        
        // Check if users model is available after a short delay
        setTimeout(() => {
            const usersModel = this.getOwnerComponent()?.getModel("users") as JSONModel;
            console.log("Users model in ManagerLogin onInit:", usersModel?.getData());
            
            // Add test function to global scope for debugging
            (window as any).testManagerLogin = (id: string, password: string) => {
                console.log("Testing manager login with:", { id, password });
                const users = usersModel?.getData()?.users || [];
                console.log("Available users:", users);
                const user = users.find((u: any) => u.id === id && u.password === password && u.role === "Manager");
                console.log("Found user:", user);
                return user;
            };
        }, 1000);
    }

    private getRouter(): Router {
        return (this.getOwnerComponent() as any).getRouter();
    }

    public onNavBack(): void {
        this.getRouter().navTo("Landing");
    }

    public onManagerLogin(): void {
        const managerIdInput = this.byId("managerId") as Input;
        const passwordInput = this.byId("managerPassword") as Input;

        const managerId = managerIdInput.getValue();
        const password = passwordInput.getValue();

        if (!managerId || !password) {
            MessageToast.show("Please enter Manager ID and Password");
            return;
        }

        // Get users model and validate it's loaded
        const usersModel = this.getOwnerComponent()?.getModel("users") as JSONModel;
        if (!usersModel || !usersModel.getData() || !Array.isArray(usersModel.getData().users)) {
            MessageToast.show("User data not loaded yet. Please try again in a moment.");
            console.error('Users model not available or not loaded', usersModel?.getData());
            return;
        }
        const users = usersModel.getData().users;
        console.log('Available users:', users);
        console.log('Looking for manager:', { id: managerId, password: password, role: 'Manager' });

        // Find manager
        const manager = users.find((u: any) => {
            console.log('Checking user:', { id: u.id, role: u.role, passwordMatch: u.password === password });
            return u.id === managerId && 
                   u.password === password && 
                   u.role === "Manager";
        });

        if (!manager) {
            console.error('Manager not found. Available managers:', users.filter((u: any) => u.role === 'Manager'));
            MessageToast.show("Invalid Manager ID or Password");
            return;
        }

        console.log('Manager found:', manager);

        // Set current user
        const currentUserModel = this.getOwnerComponent()?.getModel("currentUser") as JSONModel;
        currentUserModel.setData({
            id: manager.id,
            name: manager.name,
            role: manager.role,
            team: manager.team,
            isLoggedIn: true
        });

        MessageToast.show(`Welcome ${manager.name}!`);

        // Navigate to Manager Dashboard
        const router = this.getRouter();
        
        // Use setTimeout to ensure the toast message is shown before navigation
        setTimeout(() => {
            router.navTo("ManagerDashboard", {
                managerId: manager.id
            });
        }, 500);
    }
}