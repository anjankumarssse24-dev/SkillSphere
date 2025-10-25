# SkillSphere Database Structure

## Overview
SkillSphere uses a normalized CSV database structure with proper foreign key relationships for data integrity and scalability.

## Database Schema

### 1. **managers.csv** (Manager Master Table)
**Purpose**: Stores manager information with managerId as primary key

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| managerId | STRING (PK) | Unique manager identifier | MGR001 |
| name | STRING | Manager's full name | Alice Johnson |
| team | STRING | Team name | S4HANA |
| subTeam | STRING | Sub-team/Department | Management |
| email | STRING | Manager's email | alice.johnson@company.com |
| totalSkills | NUMBER | Number of skills | 10 |
| totalProjects | NUMBER | Number of projects managed | 5 |
| specialization | STRING | Manager's area of expertise | S4HANA Expert |

**Sample Data:**
```csv
managerId,name,team,subTeam,email,totalSkills,totalProjects,specialization
MGR001,Alice Johnson,S4HANA,Management,alice.johnson@company.com,10,5,S4HANA Expert
MGR002,Bob Wilson,SuccessFactors,Management,bob.wilson@company.com,12,6,SuccessFactors Lead
```

---

### 2. **employees.csv** (Employee Master Table)
**Purpose**: Stores employee information with employeeId as primary key and managerId as foreign key

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| employeeId | STRING (PK) | Unique employee identifier | EMP001 |
| name | STRING | Employee's full name | John Doe |
| team | STRING | Team name | S4HANA |
| subTeam | STRING | Sub-team/Department | Development |
| **managerId** | STRING (FK) | **Foreign key to managers.managerId** | **MGR001** |
| email | STRING | Employee's email | john.doe@company.com |
| totalSkills | NUMBER | Number of skills | 5 |
| totalProjects | NUMBER | Number of projects | 3 |
| specialization | STRING | Employee's specialization | SAPUI5 Developer |

**Sample Data:**
```csv
employeeId,name,team,subTeam,managerId,email,totalSkills,totalProjects,specialization
EMP001,John Doe,S4HANA,Development,MGR001,john.doe@company.com,5,3,SAPUI5 Developer
EMP002,Jane Smith,SuccessFactors,Analytics,MGR002,jane.smith@company.com,7,2,Data Scientist
EMP003,Mike Johnson,CIS,Development,MGR001,mike.johnson@company.com,4,4,HANA Developer
```

**Relationship**: `employees.managerId → managers.managerId` (Many-to-One)

---

### 3. **users.csv** (Authentication Table)
**Purpose**: Stores user credentials and roles with managerId reference

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| id | STRING (PK) | User ID (EMP/MGR) | EMP001 |
| name | STRING | User's full name | John Doe |
| password | STRING | User password (hashed in production) | password123 |
| role | STRING | User role (Employee/Manager) | Employee |
| team | STRING | Team name | S4HANA |
| subTeam | STRING | Sub-team | Development |
| **managerId** | STRING (FK) | **Foreign key to managers.managerId** | **MGR001** |

**Sample Data:**
```csv
id,name,password,role,team,subTeam,managerId
EMP001,John Doe,password123,Employee,S4HANA,Development,MGR001
MGR001,Alice Johnson,manager123,Manager,S4HANA,Management,
```

**Note**: Managers have empty managerId since they don't report to anyone

---

### 4. **skills.csv** (Skills Transaction Table)
**Purpose**: Stores employee skills with employeeId as foreign key

| Column | Type | Description |
|--------|------|-------------|
| skillId | STRING (PK) | Unique skill identifier |
| skillName | STRING | Name of the skill |
| category | STRING | Skill category |
| **employeeId** | STRING (FK) | **Foreign key to employees.employeeId** |
| proficiencyLevel | STRING | Skill level (Beginner/Intermediate/Advanced/Expert) |
| yearsExperience | NUMBER | Years of experience |
| certificationStatus | BOOLEAN | Certification obtained |

**Relationship**: `skills.employeeId → employees.employeeId` (Many-to-One)

---

### 5. **projects.csv** (Projects Transaction Table)
**Purpose**: Stores project assignments with employeeId as foreign key

| Column | Type | Description |
|--------|------|-------------|
| projectId | STRING (PK) | Unique project identifier |
| **employeeId** | STRING (FK) | **Foreign key to employees.employeeId** |
| projectName | STRING | Project name |
| role | STRING | Employee's role in project |
| startDate | DATE | Project start date |
| endDate | DATE | Project end date |
| status | STRING | Project status |
| description | STRING | Project description |
| duration | STRING | Project duration |

**Relationship**: `projects.employeeId → employees.employeeId` (Many-to-One)

---

### 6. **profiles.csv** (Employee Profiles Table)
**Purpose**: Stores employee profile preferences and current project status

| Column | Type | Description |
|--------|------|-------------|
| **employeeId** | STRING (PK/FK) | **Foreign key to employees.employeeId** |
| specialization | STRING | Current specialization |
| working_on_project | BOOLEAN | Currently working on project |
| project_start_date | DATE | Current project start |
| project_end_date | DATE | Current project end |
| lastUpdated | TIMESTAMP | Last profile update |

**Relationship**: `profiles.employeeId → employees.employeeId` (One-to-One)

---

## Entity Relationship Diagram

```
┌─────────────────┐
│   managers.csv  │
│ ─────────────── │
│ managerId (PK)  │◄─────┐
│ name            │      │
│ team            │      │
│ email           │      │
└─────────────────┘      │
                         │
                         │ managerId (FK)
                         │
                    ┌────┴──────────┐
                    │               │
            ┌───────▼─────────┐ ┌──▼──────────┐
            │  employees.csv  │ │  users.csv  │
            │ ─────────────── │ │ ─────────── │
            │ employeeId (PK) │ │ id (PK)     │
            │ name            │ │ name        │
            │ managerId (FK)  │ │ managerId   │
            │ email           │ │ role        │
            └────────┬────────┘ └─────────────┘
                     │
         ┌───────────┼───────────┐
         │           │           │
    ┌────▼────┐ ┌───▼─────┐ ┌───▼─────────┐
    │skills   │ │projects │ │  profiles   │
    │.csv     │ │.csv     │ │  .csv       │
    │─────────│ │─────────│ │─────────────│
    │skillId  │ │projectId│ │employeeId   │
    │empId(FK)│ │empId(FK)│ │(PK/FK)      │
    └─────────┘ └─────────┘ └─────────────┘
```

---

## Key Benefits of This Structure

### ✅ **Normalized Database Design**
- Eliminates data redundancy (manager names stored once)
- Reduces storage and update anomalies
- Follows Third Normal Form (3NF)

### ✅ **Data Integrity**
- Foreign key constraints ensure valid relationships
- Manager changes update in one place
- Orphaned records easily identified

### ✅ **Scalability**
- Easy to add new managers without updating all employee records
- Manager information changes propagate automatically
- Supports organizational hierarchy changes

### ✅ **Query Efficiency**
- Manager dashboard: Filter employees by `managerId = MGR001`
- Employee details: Join with managers to get manager name
- Team analytics: Aggregate employees by manager

---

## How It Works in the Application

### **1. Component.ts - Data Loading**
```typescript
// Load managers and employees separately
const managers = await loadManagersFromCSV();
const employees = await loadEmployeesFromCSV();

// Merge employees with manager names (JOIN operation)
const allEmployees = mergeEmployeesWithManagers(employees, managers);
// Result: Each employee gets manager.name from managers table
```

### **2. Manager Dashboard - Team Filtering**
```typescript
// Filter employees by managerId (not manager name)
const currentManagerId = "MGR001";
const teamMembers = allEmployees.filter(emp => 
    emp.employeeId.startsWith("EMP") && 
    emp.managerId === currentManagerId
);
// Result: Only employees reporting to MGR001
```

### **3. Employee Dashboard - Display Manager**
```typescript
// Employee record has managerId = "MGR001"
// Look up manager name from managers table
const manager = managers.find(m => m.managerId === emp.managerId);
const managerName = manager?.name; // "Alice Johnson"
```

---

## Migration from Old Structure

### **Old Structure** (DEPRECATED)
```csv
# employees.csv - Mixed employees and managers
id,name,team,manager,email
EMP001,John Doe,S4HANA,Alice Johnson,john@company.com
MGR001,Alice Johnson,S4HANA,,alice@company.com  ❌ manager field empty
```

**Problems:**
- Managers and employees mixed in same file
- Manager identified by empty manager field
- Manager name changes require updating all employees
- No way to link manager details to employees

### **New Structure** (CURRENT)
```csv
# managers.csv
managerId,name,team,email
MGR001,Alice Johnson,S4HANA,alice@company.com

# employees.csv
employeeId,name,team,managerId,email
EMP001,John Doe,S4HANA,MGR001,john@company.com  ✅ Uses managerId
```

**Benefits:**
- Separate tables for different entities
- Foreign key relationship (managerId)
- Manager changes don't affect employee records
- Can query manager details separately

---

## API Endpoints

### Managers API
- `GET /api/managers` - Get all managers
- `GET /api/managers/:managerId` - Get specific manager
- `POST /api/managers` - Create new manager
- `PUT /api/managers/:managerId` - Update manager
- `DELETE /api/managers/:managerId` - Delete manager

### Employees API
- `GET /api/employees` - Get all employees
- `GET /api/employees/:employeeId` - Get specific employee
- `POST /api/employees` - Create new employee
- `PUT /api/employees/:employeeId` - Update employee
- `DELETE /api/employees/:employeeId` - Delete employee

---

## Best Practices

### ✅ **DO**
- Use managerId to link employees to managers
- Query managers table for manager details
- Filter employees by managerId for team operations
- Validate managerId exists before assigning to employee

### ❌ **DON'T**
- Store manager names in employee records (use managerId)
- Mix managers and employees in same table
- Filter by manager name (use managerId instead)
- Allow invalid managerId in employee records

---

## Example Queries

### Get All Employees for Manager MGR001
```javascript
const employees = allEmployees.filter(emp => emp.managerId === "MGR001");
```

### Get Manager Details for Employee
```javascript
const employee = employees.find(e => e.employeeId === "EMP001");
const manager = managers.find(m => m.managerId === employee.managerId);
```

### Get Team Statistics
```javascript
const managerId = "MGR001";
const teamMembers = employees.filter(e => e.managerId === managerId);
const teamSize = teamMembers.length;
const avgSkills = teamMembers.reduce((sum, e) => sum + e.totalSkills, 0) / teamSize;
```

---

## Conclusion

The new normalized database structure with separate `managers.csv` and `employees.csv` files linked by `managerId` provides:
- **Better data integrity** - No redundant manager names
- **Easier maintenance** - Manager changes in one place
- **Clearer relationships** - Explicit foreign key links
- **Scalable design** - Ready for organizational growth

All SkillSphere controllers now use this structure for consistent, reliable data operations.
