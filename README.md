# 🎯 SkillSphere - Employee Skill Matrix Management System

> A comprehensive enterprise-grade skill management platform built with **SAP UI5/Fiori** frontend and **Flask** backend, designed for modern workforce skill tracking and team analytics.

[![SAP UI5](https://img.shields.io/badge/SAP%20UI5-1.140.0-blue)](https://ui5.sap.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.1.6-blue)](https://www.typescriptlang.org/)
[![Flask](https://img.shields.io/badge/Flask-Latest-green)](https://flask.palletsprojects.com/)
[![SQLite](https://img.shields.io/badge/SQLite-Database-orange)](https://www.sqlite.org/)

## 📋 Table of Contents
- [✨ Features](#-features)
- [🏗️ Architecture](#️-architecture)
- [🚀 Quick Start](#-quick-start)
- [👥 User Roles](#-user-roles)
- [🎨 UI Components](#-ui-components)
- [💾 Data Management](#-data-management)
- [🔧 Development](#-development)
- [📱 Screenshots](#-screenshots)
- [🤝 Contributing](#-contributing)

## ✨ Features

### 🧑‍💼 **Employee Dashboard**
- **Profile Management**: Update specialization, project status, and timeline
- **Skills Portfolio**: Add, edit, and manage technical skills with proficiency levels
- **Project Tracking**: Maintain project history with roles and durations
- **Current Status**: Toggle working status with project start/end dates
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile

### 👨‍💼 **Manager Dashboard**
- **Team Overview**: Visual dashboard with team member status
- **Skill Search**: Advanced search by skills, teams, and specializations
- **Resource Planning**: Color-coded availability status (🟢 Available | 🔴 Busy)
- **Analytics**: Team performance metrics and skill distribution
- **Real-time Updates**: Live status updates for better resource allocation

### 🎯 **Key Capabilities**
- **12 Specialization Areas**: ABAP, Data Science, AI/ML, UI5, HANA, BTP, and more
- **Visual Status Indicators**: Instant team availability overview
- **Advanced Search**: Multi-criteria employee search functionality
- **Data Validation**: Comprehensive form validation and error handling
- **Enterprise Security**: Role-based authentication system

## 🏗️ Architecture

```
SkillSphere/
├── 🖥️  Frontend (SAP UI5/Fiori)
│   ├── Employee Dashboard
│   ├── Manager Dashboard  
│   ├── Authentication System
│   └── Responsive Components
├── ⚙️  Backend (Flask + SQLite)
│   ├── REST API Endpoints
│   ├── Database Models
│   ├── Authentication Logic
│   └── Business Logic
└── 📊 Data Layer
    ├── Employee Profiles
    ├── Skills Matrix
    ├── Project Records
    └── User Management
```

## 🚀 Quick Start

### Prerequisites
- **Node.js** LTS (18.x or higher)
- **Python** 3.8+
- **npm** 8.x or higher
- **Git** (for version control)

### 🖥️ Frontend Setup (UI5/Fiori)
```bash
# Navigate to UI5 project
cd project1

# Install dependencies
npm install

# Start development server
npm start
```
**Access**: http://localhost:8080

### ⚙️ Backend Setup (Flask)
```bash
# Navigate to Flask backend
cd SkillSphere-main

# Create virtual environment
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Initialize database
python models.py

# Start Flask server
python app.py
```
**Access**: http://localhost:5000

## 👥 User Roles

### 🧑‍💼 **Employee Users**
- **Login**: Use Employee ID (EMP001, EMP002, EMP003)
- **Default Password**: `password123`
- **Capabilities**: Profile management, skills tracking, project updates

### 👨‍💼 **Manager Users**  
- **Login**: Use Manager ID (MGR001, MGR002)
- **Default Password**: `manager123`
- **Capabilities**: Team overview, advanced search, resource planning

### 🔐 **Sample Credentials**
```
Employees:
- EMP001 / password123 (John Doe - SAPUI5 Developer)
- EMP002 / password123 (Jane Smith - Data Scientist)
- EMP003 / password123 (Mike Johnson - HANA Developer)

Managers:
- MGR001 / manager123 (Alice Johnson - CSI Team)
- MGR002 / manager123 (Bob Wilson - HANA Team)
```

## 🎨 UI Components

### **SAP Fiori Design System**
- **ObjectPageLayout**: Professional dashboard structure
- **IconTabBar**: Organized content sections  
- **ObjectStatus**: Color-coded status indicators
- **Cards & Panels**: Modern card-based UI
- **Responsive Tables**: Mobile-optimized data display
- **Fragment Dialogs**: Reusable modal components

### **Color Coding Standards**
- 🟢 **Green**: Available for new projects
- 🔴 **Red**: Currently working on project
- 🟡 **Orange**: Progress indicators
- 🔵 **Blue**: Information status

## 💾 Data Management

### **Database Schema**
```sql
Employees: id, name, team, specialization, working_on_project, dates
Skills: employee_id, skill_name, proficiency_level, category
Projects: employee_id, project_name, role, duration, status
Users: id, username, password, role, team
```

### **Data Services**
- **IntegratedDataService**: Unified data access layer
- **SQLiteDataService**: Database operations
- **CSVDataService**: Import/export functionality
- **BackendAPIService**: REST API integration

## 🔧 Development

### **Technology Stack**
- **Frontend**: SAP UI5 1.140.0, TypeScript 5.1.6, Fiori Components
- **Backend**: Flask, SQLAlchemy, SQLite
- **Tools**: ESLint, UI5 CLI, VS Code Extensions
- **Testing**: QUnit, OPA5 Integration Tests

### **Project Structure**
```
project1/                          # SAP UI5 Frontend
├── webapp/
│   ├── controller/               # Business logic controllers
│   ├── view/                     # XML view definitions  
│   ├── model/                    # Data models (JSON)
│   ├── service/                  # Data service layer
│   └── manifest.json             # App configuration

SkillSphere-main/                 # Flask Backend  
├── routes/                       # API endpoints
├── static/                       # Frontend assets
├── templates/                    # HTML templates
├── instance/                     # Database files
└── app.py                        # Main application
```

### **Build & Deployment**
```bash
# Build for production
npm run build

# Type checking
npm run ts-typecheck

# Linting
npm run lint

# Testing  
npm run unit-test
npm run int-test
```

## 📱 Screenshots

### Employee Dashboard
- Profile management with specialization selection
- Skills matrix with proficiency indicators  
- Project timeline tracking
- Current working status toggle

### Manager Dashboard  
- Team overview with visual status indicators
- Advanced search by skills and specialization
- Resource allocation planning
- Analytics and reporting

## 🌟 Key Achievements

✅ **Complete CRUD Operations** for skills and projects  
✅ **Real-time Status Updates** for team management  
✅ **Enterprise-grade Security** with role-based access  
✅ **Responsive Design** for all device types  
✅ **SAP Design Standards** compliance  
✅ **Advanced Search** with multi-criteria filtering  
✅ **Data Validation** and error handling throughout  
✅ **Professional UI/UX** with Fiori design principles  

## 🤝 Contributing

1. **Fork the repository**
2. **Create feature branch**: `git checkout -b feature/amazing-feature`
3. **Commit changes**: `git commit -m 'Add amazing feature'`
4. **Push to branch**: `git push origin feature/amazing-feature`
5. **Open Pull Request**

## 📞 Support

For support and questions:
- **Repository**: https://github.tools.sap/I770144/SkillSphere  
- **Issues**: Create GitHub issues for bugs and feature requests
- **Documentation**: Check inline code comments and JSDoc

---

## Application Generation Details
|               |
| ------------- |
|**Generation Date**<br>Thu Sep 18 2025 11:50:58 GMT+0530 (India Standard Time)|
|**App Generator**<br>SAP Fiori Application Generator|
|**Template**<br>Basic|
|**UI5 Version**<br>1.140.0|
|**TypeScript**<br>Enabled|

---

**Built with ❤️ using SAP UI5/Fiori and Flask** | **© 2025 SkillSphere Project**


