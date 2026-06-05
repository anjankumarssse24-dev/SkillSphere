import Controller from "sap/ui/core/mvc/Controller";
import JSONModel from "sap/ui/model/json/JSONModel";
import MessageToast from "sap/m/MessageToast";
import MessageBox from "sap/m/MessageBox";
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";

/**
 * @namespace skillsphere.controller
 */
export default class FirstTimeSetup extends Controller {
  private oDataModel: any;
  private model: JSONModel;
  private userContext: any;

  onInit(): void {
    const oComponent = this.getOwnerComponent();
    const oRouter = (oComponent as any)?.getRouter?.();
    
    if (oRouter) {
      oRouter.getRoute("firstTimeSetup")?.attachPatternMatched(this.onRouteMatched, this);
    }

    this.oDataModel = oComponent?.getModel() as any;
    
    // Initialize local model with default values
    this.model = new JSONModel({
      employeeId: "",
      name: "",
      email: "",
      team: "CIS Engineering APAC Build",
      subTeam: "",
      location: "",
      gradeLevel: "",
      tLevel: "",
      experience: 0,
      managerId: "",
      termsAccepted: false,
      subTeamList: [
        { key: "Team 1 - Sachin Muralidhar Tadse", text: "Team 1 - Sachin Muralidhar Tadse" },
        { key: "Team 2 - Fazal Ilahi", text: "Team 2 - Fazal Ilahi" },
        { key: "Team 3 - Deepak", text: "Team 3 - Deepak" },
        { key: "Team 4 - Abhishek Garg", text: "Team 4 - Abhishek Garg" },
        { key: "Team 5 - Hemlata Janawa", text: "Team 5 - Hemlata Janawa" },
        { key: "Team 7 - Pawan Jain", text: "Team 7 - Pawan Jain" },
        { key: "Team 8 - Puja K", text: "Team 8 - Puja K" },
        { key: "Team 9 - Agya Pal Singh", text: "Team 9 - Agya Pal Singh" }
      ],
      locationsList: [
        { key: "Whitefield, Bangalore", text: "Whitefield, Bangalore" },
        { key: "Devanahalli, Bangalore", text: "Devanahalli, Bangalore" },
        { key: "Gurgaon", text: "Gurgaon" },
        { key: "Pune", text: "Pune" }
      ],
      gradeLevelList: [
        { key: "L1", text: "L1" },
        { key: "L2", text: "L2" },
        { key: "L3", text: "L3" }
      ],
      tLevelList: [
        { key: "T1", text: "T1" },
        { key: "T2", text: "T2" },
        { key: "T3", text: "T3" },
        { key: "T4", text: "T4" },
        { key: "T5", text: "T5" }
      ],
      managerList: [
        { key: "", text: "Select later" }
      ]
    });

    this.getView()?.setModel(this.model, "model");
    this.loadUserContext();
    this.loadManagers();
  }

  private onRouteMatched(): void {
    this.loadUserContext();
    this.loadManagers();
  }

  private async loadManagers(): Promise<void> {
    try {
      if (!this.oDataModel) {
        return;
      }

      const roleFilter = new Filter({
        filters: [
          new Filter("role", FilterOperator.EQ, "Manager"),
          new Filter("role", FilterOperator.EQ, "SeniorManager")
        ],
        and: false
      });

      const listBinding = this.oDataModel.bindList("/Employees", undefined, undefined, [roleFilter]);
      const contexts = await listBinding.requestContexts(0, 200);

      const managerList = [
        { key: "", text: "Select later" },
        ...contexts
          .map((ctx: any) => ctx?.getObject?.())
          .filter((data: any) => !!data?.employeeId)
          .map((data: any) => ({
            key: data.employeeId,
            text: data?.name
              ? `${data.name} (${data.role || "Manager"})`
              : `${data.employeeId} (${data.role || "Manager"})`,
            email: data?.email || ""
          }))
      ];

      this.model.setProperty("/managerList", managerList);
    } catch (error) {
      this.model.setProperty("/managerList", [{ key: "", text: "Select later" }]);
    }
  }

  private async loadUserContext(): Promise<void> {
    try {
      if (!this.oDataModel) {
        return;
      }

      const actionBinding = this.oDataModel.bindContext("/currentUserContext(...)");
      await actionBinding.execute();

      const context = actionBinding.getBoundContext();
      this.userContext = context?.getObject() || actionBinding.getObject?.() || null;

      if (this.userContext) {
        this.model.setProperty("/email", this.userContext.email || "");
        const contextEmployeeId = String(this.userContext.employeeId || "").trim().toUpperCase();
        this.model.setProperty("/employeeId", /^I\d+$/.test(contextEmployeeId) ? contextEmployeeId : "");
        this.model.setProperty("/name", this.userContext.name || this.userContext.email?.split("@")[0] || "");
      }
    } catch (error) {
      console.error("Failed to load user context:", error);
      MessageToast.show("Could not pre-fill user information. Please fill in manually.");
    }
  }

  onCompleteSetup(): void {
    // Validate required fields
    const requiredFields = ["employeeId", "name", "location", "gradeLevel", "tLevel"];
    const invalidFields: string[] = [];

    requiredFields.forEach(field => {
      if (!this.model.getProperty(`/${field}`)) {
        invalidFields.push(field);
      }
    });

    if (invalidFields.length > 0) {
      MessageBox.error(`Please fill in required fields: ${invalidFields.join(", ")}`);
      return;
    }

    const employeeId = String(this.model.getProperty("/employeeId") || "").trim().toUpperCase();
    if (!/^I\d+$/.test(employeeId)) {
      MessageBox.error("Employee ID must be in I-number format (example: I774156).");
      return;
    }

    const managerId = String(this.model.getProperty("/managerId") || "").trim().toUpperCase();
    if (managerId && !/^I\d+$/.test(managerId)) {
      MessageBox.error("Manager ID must be in I-number format (example: I749085).");
      return;
    }

    if (managerId && managerId === employeeId) {
      MessageBox.error("Manager ID cannot be the same as Employee ID.");
      return;
    }

    if (!this.model.getProperty("/termsAccepted")) {
      MessageBox.error("Please accept the consent terms to continue.");
      return;
    }

    this.saveProfile();
  }

  private async saveProfile(): Promise<void> {
    try {
      const employeeId = String(this.model.getProperty("/employeeId") || "").trim().toUpperCase();
      const managerId = String(this.model.getProperty("/managerId") || "").trim().toUpperCase();

      const payload = {
        loginEmployeeId: this.userContext?.employeeId,
        employeeId,
        name: this.model.getProperty("/name"),
        team: "CIS Engineering APAC Build",
        subTeam: this.model.getProperty("/subTeam"),
        location: this.model.getProperty("/location"),
        gradeLevel: this.model.getProperty("/gradeLevel"),
        tLevel: this.model.getProperty("/tLevel"),
        experience: this.model.getProperty("/experience"),
        managerId
      };

      if (!payload.employeeId) {
        MessageBox.error("Employee ID not found. Please refresh and try again.");
        return;
      }

      // Call the completeFirstTimeSetup action
      const functionContext = this.oDataModel.bindContext("/completeFirstTimeSetup(...)", null, {
        $$patchWithoutSideEffects: true
      });

      functionContext.setParameter("loginEmployeeId", payload.loginEmployeeId);
      functionContext.setParameter("employeeId", payload.employeeId);
      functionContext.setParameter("name", payload.name);
      functionContext.setParameter("team", payload.team);
      functionContext.setParameter("subTeam", payload.subTeam);
      functionContext.setParameter("location", payload.location);
      functionContext.setParameter("gradeLevel", payload.gradeLevel);
      functionContext.setParameter("tLevel", payload.tLevel);
      functionContext.setParameter("experience", payload.experience);
      functionContext.setParameter("managerId", payload.managerId);

      await functionContext.execute();

      // Keep runtime context aligned if employeeId changed from email/principal to I-number.
      this.userContext = {
        ...(this.userContext || {}),
        employeeId: payload.employeeId
      };

      MessageToast.show("Profile setup completed successfully!");

      // Navigate to appropriate dashboard based on role
      setTimeout(() => {
        this.navigateToDashboard();
      }, 1000);
    } catch (error) {
      console.error("Error saving profile:", error);
      MessageBox.error(`Failed to save profile: ${error}`);
    }
  }

  private navigateToDashboard(): void {
    const oComponent = this.getOwnerComponent();
    const oRouter = (oComponent as any)?.getRouter?.();
    
    if (!oRouter) {
      MessageBox.error("Navigation error. Please refresh the page.");
      return;
    }

    const role = this.userContext?.role || "Employee";
    
    switch (role.toLowerCase()) {
      case "manager":
        oRouter.navTo("ManagerDashboard", { managerId: this.userContext?.employeeId }, undefined, true);
        break;
      case "seniormanager":
        oRouter.navTo("SeniorManagerDashboard", { seniorManagerId: this.userContext?.employeeId }, undefined, true);
        break;
      default:
        oRouter.navTo("EmployeeDashboard", { employeeId: this.userContext?.employeeId }, undefined, true);
    }
  }
}

