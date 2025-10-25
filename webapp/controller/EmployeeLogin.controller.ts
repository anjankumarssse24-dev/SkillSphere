import Controller from "sap/ui/core/mvc/Controller";
import Router from "sap/ui/core/routing/Router";
import MessageToast from "sap/m/MessageToast";
import Input from "sap/m/Input";
import JSONModel from "sap/ui/model/json/JSONModel";

/**
 * @namespace skillsphere.controller
 */
export default class EmployeeLogin extends Controller {

    public onInit(): void {
        // Employee login initialization
        console.log("EmployeeLogin controller initialized");
        
        // Check if users model is available after a short delay
        setTimeout(() => {
            const usersModel = this.getOwnerComponent()?.getModel("users") as JSONModel;
            console.log("Users model in EmployeeLogin onInit:", usersModel?.getData());
            
            // Add test function to global scope for debugging
            (window as any).testEmployeeLogin = (id: string, password: string) => {
                console.log("Testing employee login with:", { id, password });
                const users = usersModel?.getData()?.users || [];
                console.log("Available users:", users);
                const user = users.find((u: any) => u.id === id && u.password === password && u.role === "Employee");
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

    public onEmployeeLogin(): void {
        const employeeIdInput = this.byId("employeeId") as Input;
        const passwordInput = this.byId("employeePassword") as Input;

        const employeeId = employeeIdInput.getValue();
        const password = passwordInput.getValue();

        if (!employeeId || !password) {
            MessageToast.show("Please enter Employee ID and Password");
            return;
        }

        // Get users model and validate it's loaded
        const usersModel = this.getOwnerComponent()?.getModel("users") as JSONModel;
        if (!usersModel || !usersModel.getData() || !Array.isArray(usersModel.getData().users)) {
            MessageToast.show("User data not loaded yet. Please try again in a moment.");
            // eslint-disable-next-line no-console
            console.error('Users model not available or not loaded', usersModel?.getData());
            return;
        }
        const users = usersModel.getData().users;
        console.log('Available users in EmployeeLogin:', users);
        console.log('Looking for employee:', { id: employeeId, password: password, role: 'Employee' });
        
        // Debug: Log the first user to see the structure
        if (users.length > 0) {
            console.log('First user structure:', users[0]);
            console.log('All user IDs:', users.map((u: any) => u.id));
            console.log('All user roles:', users.map((u: any) => u.role));
        }

        // Find user
        const user = users.find((u: any) => {
            console.log('Checking user in EmployeeLogin:', { id: u.id, role: u.role, passwordMatch: u.password === password });
            return u.id === employeeId && 
                   u.password === password && 
                   u.role === "Employee";
        });

        if (!user) {
            console.error('Employee not found. Available employees:', users.filter((u: any) => u.role === 'Employee'));
            MessageToast.show("Invalid Employee ID or Password");
            return;
        }

        console.log('Employee found:', user);

        // Get employee details including manager from employees model
        const employeesModel = this.getOwnerComponent()?.getModel("employees") as JSONModel;
        const employees = employeesModel?.getData()?.employees || [];
        const employee = employees.find((e: any) => e.id === user.id);

        // Set current user
        const currentUserModel = this.getOwnerComponent()?.getModel("currentUser") as JSONModel;
        currentUserModel.setData({
            id: user.id,
            name: user.name,
            role: user.role,
            team: employee?.team || user.team,
            subTeam: employee?.subTeam || user.subTeam,
            manager: employee?.manager || "",
            employeeId: user.id,
            isLoggedIn: true
        });

        MessageToast.show(`Welcome ${user.name}!`);

        // Navigate to Employee Dashboard - ensure router is initialized and route exists
        const router = this.getRouter();
        try {
            router.initialize();
        } catch (e) {
            // initialize may throw if already initialized in some UI5 versions - ignore
        }
        const route = router.getRoute("EmployeeDashboard");
        if (!route) {
            MessageToast.show("Route 'EmployeeDashboard' not found - check manifest routing configuration");
            // Log available routes to console for debugging
            // eslint-disable-next-line no-console
            try {
                const routeNames = (router as any).oRoutes ? Object.keys((router as any).oRoutes) : [];
                console.error("Available routes:", routeNames);
            } catch (err) {
                console.error("Unable to list routes on router", err);
            }
            return;
        }

        router.navTo("EmployeeDashboard", {
            employeeId: user.id
        });
    }
}