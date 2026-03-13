# 🎯 SkillSphere - Enterprise Skill Matrix Management System# 🎯 SkillSphere - Employee Skill Matrix Management System# 🎯 SkillSphere - Employee Skill Matrix Management System



> A comprehensive enterprise-grade skill management platform built with **SAP Cloud Application Programming Model (CAP)** and **SAP UI5/Fiori**, designed for modern workforce skill tracking, team analytics, and resource planning.



[![SAP CAP](https://img.shields.io/badge/SAP%20CAP-8.x-blue)](https://cap.cloud.sap/)> A comprehensive enterprise-grade skill management platform built with **SAP Cloud Application Programming Model (CAP)** and **SAP UI5/Fiori**, designed for modern workforce skill tracking and team analytics.> A comprehensive enterprise-grade skill management platform built with **SAP UI5/Fiori** frontend and **Flask** backend, designed for modern workforce skill tracking and team analytics.

[![SAP UI5](https://img.shields.io/badge/SAP%20UI5-1.140.0-blue)](https://ui5.sap.com/)

[![TypeScript](https://img.shields.io/badge/TypeScript-5.1.6-blue)](https://www.typescriptlang.org/)

[![OData V4](https://img.shields.io/badge/OData-V4-green)](https://www.odata.org/)

[![SQLite](https://img.shields.io/badge/SQLite-Database-orange)](https://www.sqlite.org/)[![SAP CAP](https://img.shields.io/badge/SAP%20CAP-8.x-blue)](https://cap.cloud.sap/)[![SAP UI5](https://img.shields.io/badge/SAP%20UI5-1.140.0-blue)](https://ui5.sap.com/)

[![Node.js](https://img.shields.io/badge/Node.js-18+-green)](https://nodejs.org/)

[![SAP UI5](https://img.shields.io/badge/SAP%20UI5-1.140.0-blue)](https://ui5.sap.com/)[![TypeScript](https://img.shields.io/badge/TypeScript-5.1.6-blue)](https://www.typescriptlang.org/)

## 📋 Table of Contents

[![TypeScript](https://img.shields.io/badge/TypeScript-5.1.6-blue)](https://www.typescriptlang.org/)[![Flask](https://img.shields.io/badge/Flask-Latest-green)](https://flask.palletsprojects.com/)

- [✨ Features](#-features)

- [🏗️ Architecture](#️-architecture)[![OData V4](https://img.shields.io/badge/OData-V4-green)](https://www.odata.org/)[![SQLite](https://img.shields.io/badge/SQLite-Database-orange)](https://www.sqlite.org/)

- [🚀 Quick Start](#-quick-start)

- [👥 User Roles](#-user-roles)[![SQLite](https://img.shields.io/badge/SQLite-Development-orange)](https://www.sqlite.org/)

- [📂 Project Structure](#-project-structure)

- [💾 Data Model](#-data-model)## 📋 Table of Contents

- [🎨 UI Components](#-ui-components)

- [🔧 Development](#-development)## 📋 Table of Contents- [✨ Features](#-features)

- [🧪 Testing](#-testing)

- [🚀 Deployment](#-deployment)- [✨ Features](#-features)- [🏗️ Architecture](#️-architecture)

- [🤝 Contributing](#-contributing)

- [🏗️ Architecture](#️-architecture)- [🚀 Quick Start](#-quick-start)

## ✨ Features

- [🚀 Quick Start](#-quick-start)- [👥 User Roles](#-user-roles)

### 🧑‍💼 **Employee Dashboard**

- [📂 Project Structure](#-project-structure)- [🎨 UI Components](#-ui-components)

- ✅ **Profile Management**: Update name, email, team, specialization, role, location, and T-Level

- ✅ **Skills Portfolio**: Full CRUD operations for technical skills with proficiency levels and date tracking- [👥 User Roles](#-user-roles)- [💾 Data Management](#-data-management)

- ✅ **Project Tracking**: Comprehensive project history with automatic duration calculation

- ✅ **Utilization Management**: Track three types of activities:- [💾 Data Model](#-data-model)- [🔧 Development](#-development)

  - **Current Projects**: Active project work with hours per day tracking

  - **CAIA Activities**: Innovation and automation initiatives- [🔧 Development](#-development)- [📱 Screenshots](#-screenshots)

  - **POC Projects**: Proof of concept development tracking

- ✅ **Real-time Updates**: All changes persist to SQLite database via OData V4- [🚀 Deployment](#-deployment)- [🤝 Contributing](#-contributing)

- ✅ **Date Management**: Automatic date format handling (YYYY-MM-DD)

- ✅ **Responsive Design**: Optimized for desktop, tablet, and mobile devices- [🧪 Testing](#-testing)



### 👨‍💼 **Manager Dashboard**## ✨ Features



- ✅ **Team Overview**: Visual dashboard showing all team members with real-time status## ✨ Features

- ✅ **Smart Status Tracking**: 

  - 🟢 **Available**: No active projects with today's date### 🧑‍💼 **Employee Dashboard**

  - 🔴 **Working on Project**: Has current project with date range including today

- ✅ **Advanced Search**: OData-powered skill search with:### 🧑‍💼 **Employee Dashboard**- **Profile Management**: Update specialization, project status, and timeline

  - Multi-skill matching

  - Team and specialization filtering- **Profile Management**: Update specialization, role, location, and T-Level- **Skills Portfolio**: Add, edit, and manage technical skills with proficiency levels

  - Match score calculation

  - Skills enrichment for each employee- **Skills Portfolio**: Add, edit, and manage technical skills with proficiency levels- **Project Tracking**: Maintain project history with roles and durations

- ✅ **Resource Planning**: Real-time team availability overview

- ✅ **Analytics Dashboard**: Team performance metrics and skill distribution- **Project Tracking**: Maintain comprehensive project history- **Current Status**: Toggle working status with project start/end dates

- ✅ **Employee Details**: Comprehensive employee profile with skills and project history

- **Utilization Management**: Track Current Projects, CAIA, and POC activities- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile

### 🔐 **Authentication & Registration**

- **Responsive Design**: Optimized for desktop, tablet, and mobile devices

- ✅ **Employee Login**: Secure authentication with OData V4 queries

- ✅ **Manager Login**: Role-based access with manager-specific features### 👨‍💼 **Manager Dashboard**

- ✅ **User Registration**: New user creation with:

  - Auto-generated Employee/Manager IDs (EMP001, EMP002, MGR001, etc.)### 👨‍💼 **Manager Dashboard**- **Team Overview**: Visual dashboard with team member status

  - Manager assignment dropdown (loaded from database)

  - Automatic User, Employee/Manager, and Profile entity creation- **Team Overview**: Visual dashboard with team member status- **Skill Search**: Advanced search by skills, teams, and specializations

  - Batch submission to SQLite database

- **Skill Search**: Advanced OData-powered search by skills, teams, and specializations- **Resource Planning**: Color-coded availability status (🟢 Available | 🔴 Busy)

### 🎯 **Key Capabilities**

- **Resource Planning**: Real-time availability tracking- **Analytics**: Team performance metrics and skill distribution

- ✅ **OData V4 API**: RESTful services with advanced querying capabilities

- ✅ **Real-time Data**: Live updates using CAP service layer and SQLite persistence- **Analytics**: Team performance metrics and skill distribution- **Real-time Updates**: Live status updates for better resource allocation

- ✅ **Advanced Filtering**: $filter, $expand, $select, $orderby support

- ✅ **Data Validation**: Server-side validation with CAP handlers and client-side checks- **Export Capabilities**: Download team data in multiple formats

- ✅ **Enterprise Security**: Built-in CAP authentication and authorization

- ✅ **Cloud-Ready**: Designed for SAP Business Technology Platform (BTP)### 🎯 **Key Capabilities**

- ✅ **12+ Specialization Areas**: ABAP, Data Science, AI/ML, UI5, HANA, BTP, Integration, and more

### 🎯 **Key Capabilities**- **12 Specialization Areas**: ABAP, Data Science, AI/ML, UI5, HANA, BTP, and more

## 🏗️ Architecture

- **OData V4 API**: RESTful services with advanced querying capabilities- **Visual Status Indicators**: Instant team availability overview

### **Technology Stack**

- **Real-time Data**: Live updates using CAP service layer- **Advanced Search**: Multi-criteria employee search functionality

```

┌─────────────────────────────────────────┐- **Advanced Filtering**: $filter, $expand, $select, $orderby support- **Data Validation**: Comprehensive form validation and error handling

│         SAP UI5/Fiori Frontend          │

│    (TypeScript, XML Views, i18n)        │- **Data Validation**: Server-side validation with CAP handlers- **Enterprise Security**: Role-based authentication system

│  • Employee Dashboard (Full CRUD)       │

│  • Manager Dashboard (Analytics)        │- **Enterprise Security**: Built-in CAP authentication and authorization

│  • Authentication System                │

│  • Registration System                  │- **Cloud-Ready**: Designed for SAP Business Technology Platform (BTP)## 🏗️ Architecture

└─────────────────┬───────────────────────┘

                  │ OData V4

┌─────────────────▼───────────────────────┐

│      SAP Cloud Application Model        │## 🏗️ Architecture```

│         (CAP Service Layer)             │

│  • Business Logic (srv/)                │SkillSphere/

│  • Custom Actions & Functions           │

│  • Auto-generated CRUD Operations       │### **Technology Stack**├── 🖥️  Frontend (SAP UI5/Fiori)

│  • Filter & Query Processing            │

└─────────────────┬───────────────────────┘│   ├── Employee Dashboard

                  │ CDS

┌─────────────────▼───────────────────────┐```│   ├── Manager Dashboard  

│          Data Model (CDS)               │

│  • 9 Entity Definitions (db/schema.cds) │┌─────────────────────────────────────────┐│   ├── Authentication System

│  • Associations & Compositions          │

│  • Type Safety & Constraints            ││         SAP UI5/Fiori Frontend          ││   └── Responsive Components

│  • Auto-generated Keys                  │

└─────────────────┬───────────────────────┘│    (TypeScript, XML Views, i18n)        │├── ⚙️  Backend (Flask + SQLite)

                  │ SQLite (Dev) / HANA (Prod)

┌─────────────────▼───────────────────────┐└─────────────────┬───────────────────────┘│   ├── REST API Endpoints

│      Persistent Storage (db.sqlite)     │

│  • Employee Master Data                 │                  │ OData V4│   ├── Database Models

│  • Manager Master Data                  │

│  • Skills & Projects                    │┌─────────────────▼───────────────────────┐│   ├── Authentication Logic

│  • Utilization Records                  │

│  • User Credentials                     ││      SAP Cloud Application Model        ││   └── Business Logic

└─────────────────────────────────────────┘

```│         (CAP Service Layer)             │└── 📊 Data Layer



### **CAP Service Endpoints**│  • Business Logic                       │    ├── Employee Profiles



```│  • Custom Actions & Functions           │    ├── Skills Matrix

/odata/v4/skill-sphere/

├── Users                  (Authentication & Authorization)│  • Auto-generated CRUD                  │    ├── Project Records

├── Employees              (Employee Master Data)

├── Managers               (Manager Master Data)└─────────────────┬───────────────────────┘    └── User Management

├── Skills                 (Skills & Competencies)

├── Projects               (Project History)                  │ CDS```

├── Profiles               (Professional Profiles)

├── CurrentProjects        (Active Project Utilization)┌─────────────────▼───────────────────────┐

├── CAIAUtilization        (CAIA Activities)

├── POCUtilization         (POC Activities)│          Data Model (CDS)               │## 🚀 Quick Start

├── login()                (Custom Authentication Action)

├── getEmployeeStats()     (Employee Statistics Function)│  • 9 Entity Definitions                 │

└── getUtilizationSummary() (Utilization Summary Function)

```│  • Associations & Compositions          │### Prerequisites



## 🚀 Quick Start│  • Type Safety                          │- **Node.js** LTS (18.x or higher)



### **Prerequisites**└─────────────────┬───────────────────────┘- **Python** 3.8+



- **Node.js** 18.x or higher                  │- **npm** 8.x or higher

- **npm** 10.x or higher

- **@sap/cds-dk** installed globally: `npm install -g @sap/cds-dk`┌─────────────────▼───────────────────────┐- **Git** (for version control)

- **Git** for version control

│      SQLite (Dev) / HANA (Prod)         │

### **Installation**

│         Persistent Storage              │### 🖥️ Frontend Setup (UI5/Fiori)

```bash

# Clone the repository└─────────────────────────────────────────┘```bash

git clone <repository-url>

cd SkillSphere-main```# Navigate to UI5 project



# Install dependenciescd project1

npm install

### **CAP Service Endpoints**

# Deploy database (first time only)

npm run deploy# Install dependencies

# This creates db.sqlite and loads initial data from CSV files

```npm install

# Start the CAP backend server (Terminal 1)

npm start/odata/v4/skill-sphere/

# Backend runs on: http://localhost:4004

├── Users                  (Authentication)# Start development server

# Start the UI5 frontend server (Terminal 2 - separate terminal)

npm run start-ui├── Employees              (Employee Master Data)npm start

# Frontend runs on: http://localhost:8080

```├── Managers               (Manager Master Data)```



### **Access the Application**├── Skills                 (Skills & Competencies)**Access**: http://localhost:8080



- **UI5 Frontend**: http://localhost:8080├── Projects               (Project History)

- **CAP Backend**: http://localhost:4004

- **OData Metadata**: http://localhost:4004/odata/v4/skill-sphere/$metadata├── Profiles               (Professional Profiles)### ⚙️ Backend Setup (Flask)

- **Service Endpoints**: http://localhost:4004/odata/v4/skill-sphere/

├── CurrentProjects        (Active Projects)```bash

### **Default Credentials**

├── CAIAUtilization        (CAIA Activities)# Navigate to Flask backend

**Employees:**

```├── POCUtilization         (POC Activities)cd SkillSphere-main

EMP001 / password123  (John Doe - SAPUI5 Developer)

EMP002 / password123  (Jane Smith - Data Scientist)├── login()                (Custom Action)

EMP003 / password123  (Mike Johnson - HANA Developer)

```├── getEmployeeStats()     (Function)# Create virtual environment



**Managers:**└── getUtilizationSummary() (Function)python -m venv venv

```

MGR001 / manager123  (Alice Johnson - CSI Team)```venv\Scripts\activate  # Windows

MGR002 / manager123  (Bob Wilson - HANA Team)

```# source venv/bin/activate  # macOS/Linux



## 👥 User Roles## 🚀 Quick Start



### 🧑‍💼 **Employee Users**# Install dependencies



- **Login**: Use Employee ID (EMP001, EMP002, EMP003)### **Prerequisites**pip install -r requirements.txt

- **Default Password**: `password123`

- **Capabilities**:- Node.js 18.x or higher

  - View and update personal profile

  - Add/Edit/Delete skills with proficiency tracking- npm 10.x or higher# Initialize database

  - Add/Edit/Delete project history

  - Manage Current Projects utilization- @sap/cds-dk installed globallypython models.py

  - Manage CAIA activities

  - Manage POC projects

  - All changes persist to database immediately

### **Installation**# Start Flask server

### 👨‍💼 **Manager Users**

python app.py

- **Login**: Use Manager ID (MGR001, MGR002)

- **Default Password**: `manager123````bash```

- **Capabilities**:

  - View all team members (filtered by managerId)# Clone the repository**Access**: http://localhost:5000

  - Real-time status tracking (Available vs Working on Project)

  - Advanced skill-based employee searchgit clone <repository-url>

  - Team analytics and metrics

  - Resource planning with availability indicatorscd SkillSphere-main## 👥 User Roles

  - View employee details with complete profile



## 📂 Project Structure

# Install dependencies### 🧑‍💼 **Employee Users**

```

SkillSphere-main/npm install- **Login**: Use Employee ID (EMP001, EMP002, EMP003)

├── db/                          # Database & Data Model

│   ├── schema.cds              # CDS entity definitions (9 entities)- **Default Password**: `password123`

│   └── data/                   # CSV seed data (initial deployment only)

│       ├── skillsphere-Users.csv# Deploy database (first time only)- **Capabilities**: Profile management, skills tracking, project updates

│       ├── skillsphere-Employees.csv

│       ├── skillsphere-Managers.csvnpm run deploy

│       ├── skillsphere-Skills.csv

│       ├── skillsphere-Projects.csv### 👨‍💼 **Manager Users**  

│       ├── skillsphere-Profiles.csv

│       ├── skillsphere-CurrentProjects.csv# Start the application- **Login**: Use Manager ID (MGR001, MGR002)

│       ├── skillsphere-CAIAUtilization.csv

│       └── skillsphere-POCUtilization.csvnpm start- **Default Password**: `manager123`

│

├── srv/                        # Service Layer (CAP Backend)```- **Capabilities**: Team overview, advanced search, resource planning

│   ├── skillsphere-service.cds # Service definitions & annotations

│   └── skillsphere-service.js  # Business logic & custom handlers

│

├── webapp/                     # SAP UI5 FrontendThe application will be available at:### 🔐 **Sample Credentials**

│   ├── controller/            # UI Controllers (TypeScript)

│   │   ├── EmployeeLogin.controller.ts      # Employee authentication- **CAP Backend**: http://localhost:4004```

│   │   ├── ManagerLogin.controller.ts       # Manager authentication

│   │   ├── Landing.controller.ts            # Registration system- **UI5 Frontend**: http://localhost:8080 (run `npm run start-ui` in separate terminal)Employees:

│   │   ├── EmployeeDashboard.controller.ts  # Employee CRUD operations

│   │   ├── ManagerDashboard.controller.ts   # Manager analytics & search- EMP001 / password123 (John Doe - SAPUI5 Developer)

│   │   └── App.controller.ts                # Root controller

│   │### **Default Credentials**- EMP002 / password123 (Jane Smith - Data Scientist)

│   ├── view/                  # XML Views (Fiori Design)

│   │   ├── EmployeeLogin.view.xml- EMP003 / password123 (Mike Johnson - HANA Developer)

│   │   ├── ManagerLogin.view.xml

│   │   ├── Landing.view.xml**Employees:**

│   │   ├── EmployeeDashboard.view.xml

│   │   ├── ManagerDashboard.view.xml- Username: `EMP001` / Password: `password123`Managers:

│   │   ├── App.view.xml

│   │   └── dialogs/                         # Fragment Dialogs- Username: `EMP002` / Password: `password123`- MGR001 / manager123 (Alice Johnson - CSI Team)

│   │       ├── AddSkillDialog.fragment.xml

│   │       ├── EditSkillDialog.fragment.xml- MGR002 / manager123 (Bob Wilson - HANA Team)

│   │       ├── AddProjectDialog.fragment.xml

│   │       ├── EditProjectDialog.fragment.xml**Managers:**```

│   │       ├── CurrentProjectDialog.fragment.xml

│   │       ├── CAIADialog.fragment.xml- Username: `MGR001` / Password: `manager123`

│   │       └── POCDialog.fragment.xml

│   │- Username: `MGR002` / Password: `manager123`## 🎨 UI Components

│   ├── service/               # Data Services

│   │   ├── DataManager.ts                   # Legacy data service

│   │   ├── DataUpdateService.ts             # Update utilities

│   │   └── CSVParser.ts                     # CSV parsing## 📂 Project Structure### **SAP Fiori Design System**

│   │

│   ├── model/                 # Models & Data- **ObjectPageLayout**: Professional dashboard structure

│   │   ├── models.ts                        # Model initialization

│   │   └── projects.json                    # Project metadata```- **IconTabBar**: Organized content sections  

│   │

│   ├── css/                   # StylesheetsSkillSphere-main/- **ObjectStatus**: Color-coded status indicators

│   │   ├── style.css                        # Custom styles

│   │   └── responsive.css                   # Responsive design├── db/                          # Database & Data Model- **Cards & Panels**: Modern card-based UI

│   │

│   ├── i18n/                  # Internationalization│   ├── schema.cds              # CDS entity definitions- **Responsive Tables**: Mobile-optimized data display

│   │   └── i18n.properties                  # Text resources

│   ││   └── data/                   # CSV seed data- **Fragment Dialogs**: Reusable modal components

│   ├── Component.ts           # Root UI Component

│   ├── manifest.json          # App configuration & OData model│       ├── skillsphere-Users.csv

│   └── index.html             # Entry point

││       ├── skillsphere-Employees.csv### **Color Coding Standards**

├── .cdsrc.json                # CAP configuration

├── package.json               # Dependencies & scripts│       ├── skillsphere-Skills.csv- 🟢 **Green**: Available for new projects

├── tsconfig.json              # TypeScript configuration

├── ui5.yaml                   # UI5 tooling configuration│       └── ... (9 files total)- 🔴 **Red**: Currently working on project

├── ui5-local.yaml            # Local UI5 settings

├── db.sqlite                  # SQLite database (generated)│- 🟡 **Orange**: Progress indicators

│

└── Documentation/             # Project Documentation├── srv/                        # Service Layer- 🔵 **Blue**: Information status

    ├── START_HERE.md                        # Getting started guide

    ├── SAP_FIORI_ARCHITECTURE.md           # Architecture overview│   ├── skillsphere-service.cds # Service definitions

    ├── DATABASE_STRUCTURE.md               # Database schema

    ├── DATA_STORAGE_GUIDE.md               # Data persistence guide│   └── skillsphere-service.js  # Business logic & handlers## 💾 Data Management

    ├── DATA_MIGRATION_GUIDE.md             # Migration instructions

    ├── CSV_COMPLETE_FIX.md                 # CSV fixes│

    ├── CSV_MANAGEMENT_GUIDE.md             # CSV guidelines

    ├── CSV_PERSISTENCE_GUIDE.md            # Persistence details├── webapp/                     # SAP UI5 Frontend### **Database Schema**

    ├── DEBUG_LOGIN.md                      # Login debugging

    ├── TESTING_GUIDE.md                    # Testing procedures│   ├── controller/            # UI Controllers```sql

    ├── IMPLEMENTATION_SUMMARY.md           # Implementation details

    ├── FIX_SUMMARY.md                      # Bug fixes│   ├── view/                  # XML ViewsEmployees: id, name, team, specialization, working_on_project, dates

    ├── FIXES_IMPLEMENTED.md                # Complete fix log

    ├── QUICK_FIX_SUMMARY.md                # Quick reference│   ├── model/                 # Models & helpersSkills: employee_id, skill_name, proficiency_level, category

    ├── VISUAL_SUMMARY.md                   # Visual documentation

    └── DOCUMENTATION_INDEX.md              # Documentation index│   ├── service/               # DataManager & servicesProjects: employee_id, project_name, role, duration, status

```

│   ├── css/                   # StylesheetsUsers: id, username, password, role, team

## 💾 Data Model

│   ├── i18n/                  # Internationalization```

### **Core Entities**

│   ├── Component.ts           # Root component

| Entity | Description | Key Fields | CRUD Operations |

|--------|-------------|------------|-----------------|│   ├── manifest.json          # App configuration### **Data Services**

| **Users** | Authentication credentials | id, username, password, role | Read, Create (Registration) |

| **Employees** | Employee master data | employeeId, name, email, team, specialization, managerId | Read, Create, Update |│   └── index.html             # Entry point- **IntegratedDataService**: Unified data access layer

| **Managers** | Manager master data | managerId, name, team, specialization | Read, Create |

| **Skills** | Skill inventory with proficiency | skillId, employeeId, skillName, proficiencyLevel, dateAcquired | Full CRUD |│- **SQLiteDataService**: Database operations

| **Projects** | Project history tracking | projectId, employeeId, projectName, role, startDate, endDate, duration | Full CRUD |

| **Profiles** | Professional profiles | employeeId, specialization, role, location, tLevel | Read, Update |├── .cdsrc.json                # CAP configuration- **CSVDataService**: Import/export functionality

| **CurrentProjects** | Active project utilization | currentProjectId, employeeId, projectName, startDate, endDate, hoursPerDay | Full CRUD |

| **CAIAUtilization** | CAIA activities tracking | caiaId, employeeId, taskName, startDate, endDate, hoursPerDay | Full CRUD |├── package.json               # Dependencies & scripts- **BackendAPIService**: REST API integration

| **POCUtilization** | POC project tracking | pocId, employeeId, pocTitle, startDate, endDate, hoursPerDay | Full CRUD |

├── tsconfig.json              # TypeScript config

### **Relationships & Associations**

├── ui5.yaml                   # UI5 tooling config## 🔧 Development

```

Employee (1) ──< (N) Skills           [Composition]└── db.sqlite                  # SQLite database (dev)

Employee (1) ──< (N) Projects         [Composition]

Employee (1) ──< (1) Profile          [Association]```### **Technology Stack**

Employee (1) ──< (N) CurrentProjects  [Composition]

Employee (1) ──< (N) CAIAUtilization  [Composition]- **Frontend**: SAP UI5 1.140.0, TypeScript 5.1.6, Fiori Components

Employee (1) ──< (N) POCUtilization   [Composition]

Manager (1)  ──< (N) Employees        [Association via managerId]## 💾 Data Model- **Backend**: Flask, SQLAlchemy, SQLite

User (1)     ──< (1) Employee/Manager [Association via id]

```- **Tools**: ESLint, UI5 CLI, VS Code Extensions



### **Auto-generated Fields**### **Core Entities**- **Testing**: QUnit, OPA5 Integration Tests



- **IDs**: Auto-generated unique identifiers

  - Skills: `SKL_${timestamp}_${random}`

  - Projects: `PROJ_${timestamp}_${random}`| Entity | Description | Key Fields |### **Project Structure**

  - Current Projects: `CP_${timestamp}_${random}`

  - CAIA: `CAIA_${timestamp}_${random}`|--------|-------------|------------|```

  - POC: `POC_${timestamp}_${random}`

  | **Users** | Authentication | id, name, password, role |project1/                          # SAP UI5 Frontend

- **Timestamps**: Auto-updated

  - `lastUpdated`: Automatically set on create/update operations| **Employees** | Employee master | employeeId, name, email, team |├── webapp/

  

- **Counters**: Automatically maintained| **Managers** | Manager master | managerId, name, team |│   ├── controller/               # Business logic controllers

  - `totalSkills`: Updated on skill add/delete

  - `totalProjects`: Updated on project add/delete| **Skills** | Skill inventory | skillId, employeeId, skillName, proficiencyLevel |│   ├── view/                     # XML view definitions  



### **Data Validation**| **Projects** | Project history | projectId, employeeId, projectName, role |│   ├── model/                    # Data models (JSON)



- Required fields enforced at CDS level| **Profiles** | Professional profiles | employeeId, specialization, role, tLevel |│   ├── service/                  # Data service layer

- Date format validation (YYYY-MM-DD)

- Proficiency level constraints (1-5)| **CurrentProjects** | Active projects | currentProjectId, employeeId, hoursPerDay |│   └── manifest.json             # App configuration

- Hours per day validation (0-24)

- Unique key constraints on IDs| **CAIAUtilization** | CAIA activities | caiaId, employeeId, taskName, hoursPerDay |



## 🎨 UI Components| **POCUtilization** | POC tracking | pocId, employeeId, pocTitle, hoursPerDay |SkillSphere-main/                 # Flask Backend  



### **SAP Fiori Design System**├── routes/                       # API endpoints



- ✅ **ObjectPageLayout**: Professional dashboard structure### **Relationships**├── static/                       # Frontend assets

- ✅ **IconTabBar**: Organized content sections (Profile, Skills, Projects, Utilization)

- ✅ **ObjectStatus**: Color-coded status indicators- Employee ↔ Skills (1:N Composition)├── templates/                    # HTML templates

- ✅ **Cards & Panels**: Modern card-based UI with headers

- ✅ **Responsive Tables**: Mobile-optimized data display with column configuration- Employee ↔ Projects (1:N Composition)├── instance/                     # Database files

- ✅ **Fragment Dialogs**: Reusable modal components for CRUD operations

- ✅ **Smart Filters**: Advanced search with multi-criteria- Employee ↔ Profile (1:1 Association)└── app.py                        # Main application

- ✅ **Message Handling**: Toast notifications for user feedback

- Employee ↔ CurrentProjects (1:N Composition)```

### **Color Coding Standards**

- Employee ↔ CAIAUtilization (1:N Composition)

- 🟢 **Green (Success)**: Available employees, successful operations

- 🔴 **Red (Error)**: Working on project, errors, required fields- Employee ↔ POCUtilization (1:N Composition)### **Build & Deployment**

- 🟡 **Orange (Warning)**: Progress indicators, warnings

- 🔵 **Blue (Information)**: Information status, counts```bash



### **Responsive Design**## 🔧 Development# Build for production



- **Desktop**: Full feature set with multi-column layoutsnpm run build

- **Tablet**: Optimized column visibility and touch targets

- **Mobile**: Simplified views with essential information### **Available Scripts**



## 🔧 Development# Type checking



### **Available Scripts**```bashnpm run ts-typecheck



```bash# Start CAP server (OData backend)

# Start CAP backend server (with auto-reload)

npm startnpm start# Linting

# Runs on: http://localhost:4004

npm run lint

# Start UI5 frontend development server

npm run start-ui# Start UI5 development server

# Runs on: http://localhost:8080

npm run start-ui# Testing  

# Build for production

npm run buildnpm run unit-test



# Deploy/redeploy database# Build for productionnpm run int-test

npm run deploy

npm run build```

# Type checking

npm run ts-typecheck



# Run tests# Deploy database## 📱 Screenshots

npm run int-test    # Integration tests

npm run unit-test   # Unit testsnpm run deploy



# Linting### Employee Dashboard

npm run lint

```# Type checking- Profile management with specialization selection



### **Development Workflow**npm run ts-typecheck- Skills matrix with proficiency indicators  



1. **Backend Development** (`srv/` folder)- Project timeline tracking

   - Modify `skillsphere-service.cds` for service changes

   - Update `skillsphere-service.js` for business logic# Run tests- Current working status toggle

   - Use `cds watch` (or `npm start`) for hot-reload

npm run int-test    # Integration tests

2. **Frontend Development** (`webapp/` folder)

   - Controllers: `webapp/controller/` (TypeScript)npm run unit-test   # Unit tests### Manager Dashboard  

   - Views: `webapp/view/` (XML)

   - Run `npm run start-ui` for live preview```- Team overview with visual status indicators

   - Changes auto-reload in browser

- Advanced search by skills and specialization

3. **Data Model Changes** (`db/` folder)

   - Update `schema.cds` for entity changes### **Development Workflow**- Resource allocation planning

   - Modify CSV files in `db/data/` for seed data

   - Redeploy: `npm run deploy`- Analytics and reporting

   - **Note**: CSV files only used for initial deployment

1. **Backend Development** (`srv/` folder)

### **OData V4 Features**

   - Modify `skillsphere-service.cds` for service changes## 🌟 Key Achievements

```javascript

// Filter by employee ID   - Update `skillsphere-service.js` for business logic

/Skills?$filter=employeeId eq 'EMP001'

   - Use `cds watch` for hot-reload✅ **Complete CRUD Operations** for skills and projects  

// Expand related entities

/Employees('EMP001')?$expand=skills,projects,profile✅ **Real-time Status Updates** for team management  



// Select specific fields2. **Frontend Development** (`webapp/` folder)✅ **Enterprise-grade Security** with role-based access  

/Employees?$select=employeeId,name,team,specialization

   - Controllers: `webapp/controller/`✅ **Responsive Design** for all device types  

// Order results

/Skills?$orderby=dateAcquired desc   - Views: `webapp/view/`✅ **SAP Design Standards** compliance  



// Search by name   - Services: `webapp/service/DataManager.ts`✅ **Advanced Search** with multi-criteria filtering  

/Employees?$filter=contains(name,'John')

   - Run `npm run start-ui` for live preview✅ **Data Validation** and error handling throughout  

// Complex filters

/Skills?$filter=employeeId eq 'EMP001' and proficiencyLevel ge 4✅ **Professional UI/UX** with Fiori design principles  

```

3. **Data Model Changes** (`db/` folder)

### **CRUD Operation Pattern**

   - Update `schema.cds`## 🤝 Contributing

All CRUD operations follow this pattern in controllers:

   - Modify CSV files in `db/data/`

```typescript

// CREATE   - Redeploy: `npm run deploy`1. **Fork the repository**

const listBinding = oDataModel.bindList("/Skills");

const context = listBinding.create(newData);2. **Create feature branch**: `git checkout -b feature/amazing-feature`

await oDataModel.submitBatch(oDataModel.getUpdateGroupId());

await new Promise(resolve => setTimeout(resolve, 300));## 🚀 Deployment3. **Commit changes**: `git commit -m 'Add amazing feature'`

listBinding.refresh();

4. **Push to branch**: `git push origin feature/amazing-feature`

// READ

const listBinding = oDataModel.bindList("/Skills");### **Deploy to SAP BTP**5. **Open Pull Request**

listBinding.filter([new Filter("employeeId", FilterOperator.EQ, empId)]);

const contexts = await listBinding.requestContexts();

const skills = contexts.map(c => c.getObject());

```bash## 📞 Support

// UPDATE

context.setProperty("skillName", newValue);# Add HANA support

await oDataModel.submitBatch(oDataModel.getUpdateGroupId());

listBinding.refresh();cds add hanaFor support and questions:



// DELETE- **Repository**: https://github.tools.sap/I770144/SkillSphere  

context.delete();

await oDataModel.submitBatch(oDataModel.getUpdateGroupId());# Add MTA build support- **Issues**: Create GitHub issues for bugs and feature requests

listBinding.refresh();

```cds add mta- **Documentation**: Check inline code comments and JSDoc



## 🧪 Testing



### **OData Endpoint Testing**# Build MTA archive---



Test endpoints in browser or Postman:npm run build



```mbt build -t ./## Application Generation Details

# Metadata

http://localhost:4004/odata/v4/skill-sphere/$metadata|               |



# Get all employees# Deploy to Cloud Foundry| ------------- |

http://localhost:4004/odata/v4/skill-sphere/Employees

cf login|**Generation Date**<br>Thu Sep 18 2025 11:50:58 GMT+0530 (India Standard Time)|

# Get employee with skills

http://localhost:4004/odata/v4/skill-sphere/Employees('EMP001')?$expand=skillscf deploy mta_archives/SkillSphere_1.0.0.mtar|**App Generator**<br>SAP Fiori Application Generator|



# Filter by team```|**Template**<br>Basic|

http://localhost:4004/odata/v4/skill-sphere/Employees?$filter=team eq 'CSI'

|**UI5 Version**<br>1.140.0|

# Get skills for employee

http://localhost:4004/odata/v4/skill-sphere/Skills?$filter=employeeId eq 'EMP001'### **Environment Variables**|**TypeScript**<br>Enabled|

```



### **Manual Testing Checklist**

Create `.env` file for production:---

**Employee Dashboard:**

- [ ] Login with valid credentials```

- [ ] Update profile information

- [ ] Add new skill with proficiencyNODE_ENV=production**Built with ❤️ using SAP UI5/Fiori and Flask** | **© 2025 SkillSphere Project**

- [ ] Edit existing skill

- [ ] Delete skillPORT=4004

- [ ] Add new project with dates

- [ ] Edit project with duration calculationDATABASE_URL=<your-database-url>

- [ ] Delete project

- [ ] Add current project utilization```

- [ ] Add CAIA activity

- [ ] Add POC project## 🧪 Testing

- [ ] Verify data persistence after refresh

### **OData Endpoint Testing**

**Manager Dashboard:**

- [ ] Login with manager credentialsTest endpoints in browser:

- [ ] View team members list```

- [ ] Check status indicators (Available/Working)http://localhost:4004/odata/v4/skill-sphere/Employees

- [ ] Search employees by skillhttp://localhost:4004/odata/v4/skill-sphere/Skills?$filter=employeeId eq 'EMP001'

- [ ] Filter by team/specializationhttp://localhost:4004/odata/v4/skill-sphere/$metadata

- [ ] View employee details```

- [ ] Verify real-time status updates

### **Query Examples**

**Registration:**

- [ ] Open registration dialog```odata

- [ ] Select Employee role# Get all skills for employee EMP001

- [ ] Verify manager dropdown populatedGET /Skills?$filter=employeeId eq 'EMP001'

- [ ] Submit registration

- [ ] Login with new credentials# Get employee with expanded skills

GET /Employees('EMP001')?$expand=skills

### **Test Data**

# Search employees by name

Sample test data is available in `db/data/` CSV files:GET /Employees?$filter=contains(name,'John')

- 3 Employees with complete profiles

- 2 Managers with teams# Get profiles with specific role

- Multiple skills per employeeGET /Profiles?$filter=role eq 'Architect'

- Project history records```

- Utilization records (Current, CAIA, POC)

## 📝 Key Features

## 🚀 Deployment

### **Custom CAP Actions & Functions**

### **Deploy to SAP BTP**

```javascript

```bash// Login action

# Add HANA supportPOST /odata/v4/skill-sphere/login

cds add hana{ "username": "EMP001", "password": "password123" }



# Add MTA build support// Get employee statistics

cds add mtaGET /odata/v4/skill-sphere/getEmployeeStats(employeeId='EMP001')



# Build MTA archive// Get utilization summary

npm run buildGET /odata/v4/skill-sphere/getUtilizationSummary(employeeId='EMP001')

mbt build -t ./```



# Deploy to Cloud Foundry### **Auto-generated IDs**

cf login- Skills: `SKL_${timestamp}_${random}`

cf deploy mta_archives/SkillSphere_1.0.0.mtar- Projects: `PROJ_${timestamp}_${random}`

```- Current Projects: `CP_${timestamp}_${random}`

- CAIA: `CAIA_${timestamp}_${random}`

### **Environment Configuration**- POC: `POC_${timestamp}_${random}`



Create `.env` file for production:### **Automatic Counters**

- `totalSkills` - Updated when skills are added/deleted

```- `totalProjects` - Updated when projects are added/deleted

NODE_ENV=production- `lastUpdated` - Auto-timestamp on profile/utilization updates

PORT=4004

DATABASE_URL=<your-hana-database-url>## 🎨 UI Features

```

- **Responsive Design**: Mobile-first approach

### **Production Checklist**- **Fiori Design Guidelines**: SAP Fiori 3.0 compliant

- **i18n Support**: Multi-language ready

- [ ] Update to HANA database- **Theme Support**: Light/Dark/SAP themes

- [ ] Configure authentication (XSUAA/IAS)- **Accessibility**: WCAG 2.1 AA compliant

- [ ] Set up authorization roles

- [ ] Enable HTTPS/SSL## 🤝 Contributing

- [ ] Configure logging

- [ ] Set up monitoring1. Fork the repository

- [ ] Performance optimization2. Create feature branch (`git checkout -b feature/AmazingFeature`)

- [ ] Security scan3. Commit changes (`git commit -m 'Add AmazingFeature'`)

4. Push to branch (`git push origin feature/AmazingFeature`)

## 🌟 Key Achievements5. Open Pull Request



✅ **Complete OData V4 Migration** - Fully migrated from Express/CSV to CAP/SQLite  ## 📄 License

✅ **Full CRUD Operations** - All entities support create, read, update, delete  

✅ **Real-time Status Tracking** - Manager dashboard shows live employee availability  This project is licensed under the MIT License.

✅ **Smart Date Handling** - Automatic format conversion and duration calculation  

✅ **Advanced Search** - Multi-criteria employee search with skill matching  ## 🔗 Resources

✅ **Persistent Storage** - All data saved to SQLite database  

✅ **Enterprise Security** - Role-based authentication system  - [SAP CAP Documentation](https://cap.cloud.sap/docs/)

✅ **Responsive Design** - Mobile-first Fiori design principles  - [SAP UI5 Documentation](https://ui5.sap.com/)

✅ **Professional UI/UX** - SAP Fiori 3.0 compliant interface  - [OData V4 Specification](https://www.odata.org/documentation/)

✅ **Comprehensive Documentation** - 15+ documentation files  - [SAP BTP Documentation](https://help.sap.com/docs/btp)



## 🤝 Contributing---



1. **Fork the repository****Built with ❤️ using SAP Cloud Application Programming Model**

2. **Create feature branch**: `git checkout -b feature/amazing-feature`
3. **Commit changes**: `git commit -m 'Add amazing feature'`
4. **Push to branch**: `git push origin feature/amazing-feature`
5. **Open Pull Request**

### **Coding Standards**

- Follow TypeScript best practices
- Use meaningful variable names
- Add JSDoc comments for functions
- Follow SAP Fiori design guidelines
- Write unit tests for new features
- Update documentation

## 📞 Support & Resources

### **Documentation**

- **Getting Started**: See `START_HERE.md`
- **Architecture**: See `SAP_FIORI_ARCHITECTURE.md`
- **Database**: See `DATABASE_STRUCTURE.md`
- **Testing**: See `TESTING_GUIDE.md`
- **Complete Index**: See `DOCUMENTATION_INDEX.md`

### **External Resources**

- [SAP CAP Documentation](https://cap.cloud.sap/docs/)
- [SAP UI5 Documentation](https://ui5.sap.com/)
- [OData V4 Specification](https://www.odata.org/documentation/)
- [SAP BTP Documentation](https://help.sap.com/docs/btp)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

### **Support**

- **Issues**: Create GitHub issues for bugs and feature requests
- **Documentation**: Check inline code comments and JSDoc
- **Questions**: Review documentation files in the project

## 📄 License

This project is licensed under the MIT License.

---

## 📊 Project Statistics

- **Total Files**: 50+
- **Lines of Code**: 10,000+
- **Entities**: 9
- **Controllers**: 6
- **Views**: 7
- **Dialogs**: 7
- **Documentation Files**: 15+
- **Test Files**: Multiple
- **Languages**: TypeScript, JavaScript, XML, CDS

---

**Built with ❤️ using SAP Cloud Application Programming Model and SAP UI5/Fiori**

**© 2025 SkillSphere Project** | **Version 2.0** | **OData V4 Powered**
