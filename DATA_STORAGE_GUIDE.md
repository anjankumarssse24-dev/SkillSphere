# SkillSphere Data Storage Guide

## 📊 **Current Data Storage System**

The SkillSphere application now uses a **persistent data storage system** that saves all changes to the browser's localStorage. This means your data will persist between browser sessions and page refreshes.

## 🔧 **How Data Storage Works**

### **1. Data Storage Location**
- **Primary Storage**: Browser's localStorage
- **Key**: `skillsphere_data`
- **Format**: JSON object containing all application data

### **2. Data Structure**
```json
{
  "users": [
    {
      "id": "EMP001",
      "name": "John Doe",
      "password": "password123",
      "role": "Employee",
      "team": "S4HANA",
      "subTeam": "Development",
      "manager": "Alice Johnson"
    }
  ],
  "employees": [...],
  "skills": [...],
  "projects": [...]
}
```

### **3. Data Persistence**
- ✅ **Automatic**: Changes are saved immediately
- ✅ **Persistent**: Data survives browser restarts
- ✅ **Real-time**: Models update instantly
- ✅ **Cross-session**: Data persists between sessions

## 🚀 **How to Use the Data Storage System**

### **1. Adding New Data**
```javascript
// Add new user
dataManager.addUser({
  id: "EMP007",
  name: "New Employee",
  password: "password123",
  role: "Employee",
  team: "S4HANA",
  subTeam: "Development",
  manager: "Alice Johnson"
});

// Add new skill
dataManager.addSkill({
  id: "SKILL001",
  employeeId: "EMP001",
  skillName: "JavaScript",
  proficiencyLevel: "Expert",
  category: "Programming",
  yearsExperience: 5
});
```

### **2. Updating Existing Data**
```javascript
// Update user
dataManager.updateUser("EMP001", {
  name: "John Updated",
  team: "New Team"
});

// Update skill
dataManager.updateSkill("SKILL001", {
  proficiencyLevel: "Advanced",
  yearsExperience: 6
});
```

### **3. Deleting Data**
```javascript
// Delete user
dataManager.deleteUser("EMP001");

// Delete skill
dataManager.deleteSkill("SKILL001");
```

## 🛠️ **Available Data Management Methods**

### **DataManager Methods**
- `addUser(user)` - Add new user
- `updateUser(userId, updatedUser)` - Update existing user
- `deleteUser(userId)` - Delete user
- `addSkill(skill)` - Add new skill
- `updateSkill(skillId, updatedSkill)` - Update existing skill
- `deleteSkill(skillId)` - Delete skill
- `addProject(project)` - Add new project
- `updateProject(projectId, updatedProject)` - Update existing project
- `deleteProject(projectId)` - Delete project
- `clearAllData()` - Clear all data
- `exportData()` - Export data to JSON file
- `importData(file)` - Import data from JSON file

### **DataUpdateService Methods**
- `addUser(component, user)` - Add user and update model
- `updateUser(component, userId, updatedUser)` - Update user and refresh model
- `deleteUser(component, userId)` - Delete user and refresh model
- `addSkill(component, skill)` - Add skill and update model
- `updateSkill(component, skillId, updatedSkill)` - Update skill and refresh model
- `deleteSkill(component, skillId)` - Delete skill and refresh model
- `addProject(component, project)` - Add project and update model
- `updateProject(component, projectId, updatedProject)` - Update project and refresh model
- `deleteProject(component, projectId)` - Delete project and refresh model

## 📁 **Data Export/Import**

### **Export Data**
```javascript
// Export all data to JSON file
dataManager.exportData();
```

### **Import Data**
```javascript
// Import data from JSON file
const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.accept = '.json';
fileInput.onchange = (e) => {
  const file = e.target.files[0];
  dataManager.importData(file);
};
fileInput.click();
```

## 🔍 **Debugging Data Storage**

### **Check Current Data**
```javascript
// In browser console
console.log(dataManager.loadData());
```

### **View All Data**
```javascript
// Get all data
const allData = dataManager.loadData();
console.log('Users:', allData.users);
console.log('Skills:', allData.skills);
console.log('Projects:', allData.projects);
```

### **Clear All Data**
```javascript
// Clear all data and reset to default
dataManager.clearAllData();
```

## ⚠️ **Important Notes**

### **Data Limitations**
- **Browser-specific**: Data is stored per browser
- **Storage limit**: localStorage has size limits (usually 5-10MB)
- **No server sync**: Data is not synchronized across devices
- **No backup**: Data is only stored locally

### **Data Security**
- **Local only**: Data never leaves your browser
- **No encryption**: Data is stored in plain text
- **Browser access**: Data can be accessed through browser dev tools

## 🚀 **Future Enhancements**

### **Potential Improvements**
1. **Server Integration**: Connect to backend database
2. **Cloud Sync**: Synchronize data across devices
3. **Data Encryption**: Encrypt sensitive data
4. **Backup System**: Automatic data backups
5. **Version Control**: Track data changes over time

### **Backend Integration Options**
- **REST API**: Connect to RESTful backend
- **GraphQL**: Use GraphQL for data queries
- **Database**: Connect to SQL/NoSQL database
- **Cloud Storage**: Use cloud storage services

## 📝 **Example Usage in Controllers**

```typescript
// In any controller
import { DataUpdateService } from "../service/DataUpdateService";

export default class MyController extends Controller {
    private dataUpdateService: DataUpdateService;

    public onInit(): void {
        this.dataUpdateService = DataUpdateService.getInstance();
    }

    public onAddSkill(): void {
        const newSkill = {
            id: "SKILL" + Date.now(),
            employeeId: "EMP001",
            skillName: "New Skill",
            proficiencyLevel: "Beginner",
            category: "Technical",
            yearsExperience: 1
        };
        
        this.dataUpdateService.addSkill(this.getOwnerComponent(), newSkill);
    }
}
```

## 🎯 **Summary**

The SkillSphere application now has a complete persistent data storage system that:
- ✅ Saves all changes automatically
- ✅ Persists data between sessions
- ✅ Provides easy data management methods
- ✅ Supports data export/import
- ✅ Updates UI models in real-time

Your data will now be saved and available every time you use the application!
