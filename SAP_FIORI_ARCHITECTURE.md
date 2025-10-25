# SAP UI5 Fiori Architecture - SkillSphere Project

## Overview
SkillSphere is built using **SAP UI5 1.140.0** with the **Fiori Design System**. This document explains the framework, components, and data architecture.

---

## SAP UI5 Framework Components Used

### 1. **UI5 Core Libraries**
```
sap.m (Mobile/Main UI library)
├─ Button, Input, Select, Label
├─ Dialog, MessageToast
├─ Table, ColumnListItem
├─ VBox, HBox (Layout containers)
└─ Other UI controls

sap.ui.core
├─ mvc.Controller, mvc.View
├─ routing.Router
├─ Fragment, JSONModel
└─ BaseComponent

sap.f (Fiori components)
├─ Card
├─ DynamicPageLayout
└─ FlexibleColumnLayout

sap.uxap (UX Analytical components)
├─ ObjectPageLayout (Main dashboard layout)
├─ ObjectPageSection
├─ ObjectPageSubSection
└─ ObjectPageHeader
```

### 2. **Design Patterns Used**

#### MVC Pattern (Model-View-Controller)
```
View (XML)
  ↓
  └─ Controller (TypeScript)
     ↓
     └─ Model (JSONModel/ODataModel)
        ↓
        └─ Data (JSON files/API)
```

#### Component Architecture
```
Component.ts (Entry point)
├─ Initialize all models
├─ Set up routing
└─ Create UI5 application
```

---

## Data Binding in SkillSphere

### 1. **One-Way Data Binding**
```xml
<!-- Display only -->
<m:Text text="{currentUser>/name}"/>
<m:ObjectNumber number="{path: 'employees>totalSkills'}"/>
```

### 2. **Two-Way Data Binding**
```xml
<!-- Input controls update model -->
<m:Input value="{newSkill>/skillName}"/>
<m:Select selectedKey="{newSkill>/proficiency}"/>
```

### 3. **Computed Binding with Formatter**
```xml
<m:ObjectStatus 
    text="{path: 'employees>working_on_project', formatter: '.formatWorkingStatus'}"
    state="{path: 'employees>working_on_project', formatter: '.formatWorkingStatusState'}"/>
```

Formatter method in controller:
```typescript
public formatWorkingStatus(workingOnProject: boolean): string {
    return workingOnProject ? "Working on Project" : "Available";
}
```

---

## Routing Architecture

### Manifest Configuration (manifest.json)
```json
"routing": {
    "config": {
        "controlAggregation": "pages",
        "viewType": "XML",
        "async": true
    },
    "routes": [
        {
            "name": "EmployeeDashboard",
            "pattern": "employee-dashboard/{employeeId}",
            "target": ["TargetEmployeeDashboard"]
        }
    ]
}
```

### Route Navigation
```typescript
// In Controller
const router = this.getRouter();

// Navigation with parameters
router.navTo("EmployeeDashboard", {
    employeeId: "EMP001"
});

// Route matching
router.getRoute("EmployeeDashboard")?.attachPatternMatched(
    this.onRouteMatched, 
    this
);
```

---

## Component & Model Lifecycle

### 1. **Application Start**
```
1. Component.ts init()
   ↓
2. Load manifest configuration
   ↓
3. Create UI5 Component
   ↓
4. Initialize models (users, employees, skills, projects)
   ↓
5. Set up routing
   ↓
6. Render Root View (App.view.xml)
```

### 2. **Model Initialization Pattern**
```typescript
// Global models created in Component
const skillsModel = new JSONModel();

// Try to load from file
skillsModel.loadData("./model/skills.json")
    .then(() => console.log("Loaded"))
    .catch(() => {
        // Fallback to default data
        skillsModel.setData({ skills: defaultData });
    });

// Register with component (accessible to all controllers)
this.setModel(skillsModel, "skills");
```

### 3. **Model Access in Controllers**
```typescript
// Get named model
const skillsModel = this.getOwnerComponent()?.getModel("skills") as JSONModel;

// Get data
const allSkills = skillsModel?.getData()?.skills || [];

// Update model (triggers UI re-render)
skillsModel?.setData({ skills: newSkills });
```

---

## View Hierarchy - EmployeeDashboard Example

```
ObjectPageLayout (uxap)
│
├─ headerTitle
│  └─ ObjectPageHeader
│     └─ Actions: Logout button
│
└─ sections (uxap:sections - multiple ObjectPageSection)
   │
   ├─ Section 1: Profile Information
   │  └─ ObjectPageSubSection
   │     └─ Card
   │        └─ VBox + HBox (Profile data display)
   │
   ├─ Section 2: Skills Management
   │  └─ ObjectPageSubSection
   │     └─ Table (skills list)
   │        ├─ Add Skill button (opens dialog)
   │        ├─ Edit button (per row)
   │        └─ Delete button (per row)
   │
   └─ Section 3: Projects Management
      └─ ObjectPageSubSection
         └─ Table (projects list)

+ Fragments (dialogs):
  ├─ AddSkillDialog.fragment.xml
  ├─ EditSkillDialog.fragment.xml
  ├─ AddProjectDialog.fragment.xml
  └─ EditProjectDialog.fragment.xml
```

---

## Event Handling Pattern

### 1. **User Interaction Flow**
```xml
<!-- View -->
<m:Button text="Save" press="onSaveSkill"/>
```

```typescript
// Controller method
public async onSaveSkill(): Promise<void> {
    try {
        // 1. Get form data from model
        const newSkillModel = this.getView()?.getModel("newSkill") as JSONModel;
        const formData = newSkillModel?.getData();
        
        // 2. Validate
        if (!formData.skillName) {
            MessageToast.show("Required field missing");
            return;
        }
        
        // 3. Process (save to localStorage + model)
        const skillData = { ...formData, id: Date.now() };
        const existingSkills = this.loadFromLocalStorage('skills');
        existingSkills.push(skillData);
        this.saveToLocalStorage('skills', existingSkills);
        
        // 4. Update UI (refresh model)
        const skillsModel = this.getView()?.getModel("skills") as JSONModel;
        skillsModel?.setData({ skills: existingSkills });
        
        // 5. Notify user
        MessageToast.show("Skill saved successfully");
        
    } catch (error) {
        MessageToast.show("Error: " + error);
    }
}
```

---

## Data Model Architecture (After Fixes)

### Models Defined in Component.ts

```typescript
// 1. Current User Model
const currentUserModel = new JSONModel({
    id: "EMP001",
    name: "John Doe",
    role: "Employee",
    team: "CSI",
    manager: "Alice Johnson",
    email: "john.doe@company.com",
    isLoggedIn: true
});
this.setModel(currentUserModel, "currentUser");

// 2. Users Model (for authentication)
const usersModel = new JSONModel();
usersModel.loadData("./model/users.json");
this.setModel(usersModel, "users");

// 3. Employees Model (master data)
const employeesModel = new JSONModel();
employeesModel.loadData("./model/employees.json");
this.setModel(employeesModel, "employees");

// 4. Skills Model (UNIFIED SOURCE)
const skillsModel = new JSONModel();
skillsModel.loadData("./model/skills.json");
this.setModel(skillsModel, "skills");

// 5. Projects Model
const projectsModel = new JSONModel();
projectsModel.loadData("./model/projects.json");
this.setModel(projectsModel, "projects");
```

### Model Binding in Views

```xml
<!-- Binding to different models -->

<!-- Current user data -->
<m:Text text="{currentUser>/name}"/>
<m:Text text="{currentUser>/manager}"/>

<!-- Employees collection binding -->
<m:Table items="{employees>/employees}">
    <m:ColumnListItem>
        <m:Text text="{employees>name}"/>
        <m:Text text="{employees>manager}"/>
    </m:ColumnListItem>
</m:Table>

<!-- Skills collection binding -->
<m:Table items="{skills>/skills}">
    <m:ColumnListItem>
        <m:Text text="{skills>skillName}"/>
        <m:Text text="{skills>proficiencyLevel}"/>
    </m:ColumnListItem>
</m:Table>
```

---

## Key UI5 Features Used

### 1. **Fragment (Reusable Dialog Components)**
```typescript
// Define once (XML file)
// Use multiple times (any controller)

const dialog = await Fragment.load({
    id: this.getView()?.getId(),
    name: "skillsphere.view.dialogs.AddSkillDialog",
    controller: this
}) as Dialog;

this.getView()?.addDependent(dialog);
dialog.open();
```

### 2. **LocalStorage Integration**
```typescript
// Persist data locally
private saveToLocalStorage(key: string, data: any): void {
    localStorage.setItem(key, JSON.stringify(data));
}

private loadFromLocalStorage(key: string): any[] {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
}
```

### 3. **Async Routing**
```typescript
// Route configuration (manifest.json)
{
    "async": true,  // Load views asynchronously
    "viewType": "XML"
}

// Route matching with parameters
router.getRoute("EmployeeDashboard")?.attachPatternMatched(
    (event: Event) => {
        const args = event.getParameter("arguments");
        const employeeId = args.employeeId;
        this.loadEmployeeData(employeeId);
    },
    this
);
```

---

## Best Practices Implemented

✅ **Separation of Concerns**
- Views (XML) - UI structure
- Controllers (TS) - Business logic
- Models (JSON) - Data

✅ **Consistent Data Source**
- Single source of truth: JSON models
- localStorage for additions
- No conflicting data sources (SQLite, CSV)

✅ **Error Handling**
- Try-catch blocks for async operations
- Fallback data when loading fails
- User feedback with MessageToast

✅ **Model Management**
- Central initialization in Component
- Named models for different concerns
- Proper model updates trigger UI re-render

✅ **Fragment Reusability**
- Dialogs defined once, used multiple times
- Same controller for related fragments
- Proper cleanup (destroy) after use

---

## Performance Considerations

1. **Lazy Loading**: Views loaded asynchronously (routing async: true)
2. **Model Size**: Keep models reasonable size (not loading entire database)
3. **Binding**: Use one-way binding where possible
4. **Fragment Lifecycle**: Destroy fragments after use to free memory

---

## Conclusion

SkillSphere demonstrates professional use of:
- **SAP UI5 1.140.0** framework
- **Fiori Design Patterns** (ObjectPageLayout)
- **TypeScript** for type safety
- **Modern component architecture**
- **Responsive design** (Tablet, Phone, Desktop)

The architecture is clean, maintainable, and ready for backend integration! 🚀
