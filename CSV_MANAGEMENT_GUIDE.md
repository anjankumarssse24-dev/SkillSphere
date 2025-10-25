# SkillSphere CSV Management Guide

## 📊 **CSV Data Loading System**

The SkillSphere application now supports **both CSV and persistent data storage**. Here's how the system works:

## 🔄 **Data Loading Priority**

### **1. First Time Loading**
1. **Check localStorage** for existing persistent data
2. **If no persistent data** → Load from CSV files
3. **Save CSV data** to localStorage for persistence
4. **If CSV loading fails** → Use default data

### **2. Subsequent Loading**
1. **Load from localStorage** (persistent data)
2. **Skip CSV loading** (unless manually triggered)

## 🛠️ **CSV File Structure**

### **Required CSV Files**
- `webapp/data/users.csv` - User authentication data
- `webapp/data/employees.csv` - Employee details
- `webapp/data/skills.csv` - Skills information

### **CSV File Format**

#### **users.csv**
```csv
id,name,password,role,team,subTeam,manager
EMP001,John Doe,password123,Employee,S4HANA,Development,Alice Johnson
EMP002,Jane Smith,password123,Employee,SuccessFactors,Analytics,Bob Wilson
MGR001,Alice Johnson,manager123,Manager,S4HANA,Management,
```

#### **employees.csv**
```csv
id,name,team,subTeam,manager,email,totalSkills,totalProjects,specialization
EMP001,John Doe,S4HANA,Development,Alice Johnson,john.doe@company.com,5,3,SAPUI5 Developer
EMP002,Jane Smith,SuccessFactors,Analytics,Bob Wilson,jane.smith@company.com,7,2,Data Scientist
```

#### **skills.csv**
```csv
skillId,skillName,category,employeeId,proficiencyLevel,yearsExperience,certificationStatus
SKILL001,SAPUI5,Frontend Development,EMP001,Advanced,6,Certified
SKILL002,HANA,Database,EMP003,Advanced,8,Certified
```

## 🚀 **CSV Management Features**

### **1. Automatic CSV Loading**
- ✅ **First run**: Loads from CSV files automatically
- ✅ **Data persistence**: Saves CSV data to localStorage
- ✅ **Fallback**: Uses default data if CSV fails

### **2. Manual CSV Reloading**
```javascript
// Reload data from CSV files
dataManager.reloadFromCSV();

// Reset all data and reload from CSV
dataManager.clearAllData();
dataManager.reloadFromCSV();
```

### **3. CSV Export**
```javascript
// Export current data to CSV format
csvManagement.onExportToCSV();
```

## 🔧 **CSV Management Controller**

### **Available Methods**
- `onReloadFromCSV()` - Reload data from CSV files
- `onResetToCSV()` - Clear data and reload from CSV
- `onExportToCSV()` - Export current data to CSV
- `onCheckCSVStatus()` - Check CSV file accessibility

### **Usage in Controllers**
```typescript
import { CSVManagement } from "../controller/CSVManagement";

export default class MyController extends Controller {
    private csvManagement: CSVManagement;

    public onInit(): void {
        this.csvManagement = new CSVManagement();
    }

    public onReloadData(): void {
        this.csvManagement.onReloadFromCSV();
    }
}
```

## 📁 **CSV File Management**

### **1. Adding New CSV Data**
1. **Edit CSV files** in `webapp/data/` directory
2. **Use CSV Management** to reload data
3. **Data persists** in localStorage automatically

### **2. Updating CSV Files**
1. **Modify CSV files** with new data
2. **Reload from CSV** using management controller
3. **Changes are saved** to persistent storage

### **3. CSV File Validation**
- ✅ **Required headers** must be present
- ✅ **Data format** must match expected structure
- ✅ **File encoding** should be UTF-8
- ✅ **Line endings** should be consistent

## 🐛 **Troubleshooting CSV Issues**

### **Common Issues**

#### **1. CSV Files Not Found**
```
Error: Failed to load users from CSV: 404 Not Found
```
**Solution**: Ensure CSV files exist in `webapp/data/` directory

#### **2. CSV Parsing Errors**
```
Error: Failed to parse CSV data
```
**Solution**: Check CSV format and encoding

#### **3. Empty Data After CSV Load**
```
Users loaded from CSV: 0
```
**Solution**: Verify CSV file content and headers

### **Debug Commands**
```javascript
// Check CSV file status
csvManagement.onCheckCSVStatus();

// View current data
console.log(dataManager.loadData());

// Reload from CSV
dataManager.reloadFromCSV();
```

## 🔍 **CSV Data Flow**

### **1. Application Startup**
```
Component.ts → Check localStorage → Load CSV if needed → Save to localStorage
```

### **2. Manual CSV Reload**
```
User Action → CSVManagement → DataManager → Load CSV → Update Models
```

### **3. Data Persistence**
```
CSV Data → localStorage → Models → UI Updates
```

## 📝 **CSV Best Practices**

### **1. File Organization**
- ✅ **Consistent naming**: Use descriptive file names
- ✅ **Proper encoding**: Use UTF-8 encoding
- ✅ **Header consistency**: Keep headers consistent
- ✅ **Data validation**: Ensure data quality

### **2. Data Management**
- ✅ **Regular backups**: Export data regularly
- ✅ **Version control**: Track CSV file changes
- ✅ **Testing**: Test CSV loading before deployment
- ✅ **Documentation**: Document CSV structure

### **3. Performance**
- ✅ **File size**: Keep CSV files reasonably sized
- ✅ **Loading**: Use async loading for large files
- ✅ **Caching**: Leverage localStorage for performance
- ✅ **Error handling**: Implement proper error handling

## 🎯 **CSV Management Examples**

### **1. Reload Data from CSV**
```javascript
// In browser console
dataManager.reloadFromCSV().then(data => {
    console.log("CSV data reloaded:", data);
});
```

### **2. Export Current Data**
```javascript
// Export all data to CSV files
csvManagement.onExportToCSV();
```

### **3. Check CSV Status**
```javascript
// Check if CSV files are accessible
csvManagement.onCheckCSVStatus();
```

### **4. Reset to CSV Data**
```javascript
// Clear all data and reload from CSV
csvManagement.onResetToCSV();
```

## 🚀 **Advanced CSV Features**

### **1. Custom CSV Parsing**
```typescript
// Custom CSV parser for specific format
const customData = CSVParser.parseCSV(csvText);
const processedData = customData.map(row => ({
    // Custom processing logic
}));
```

### **2. CSV Validation**
```typescript
// Validate CSV data before processing
const isValid = this.validateCSVData(csvData);
if (!isValid) {
    throw new Error("Invalid CSV data format");
}
```

### **3. CSV Export with Custom Format**
```typescript
// Export data with custom CSV format
const customCSV = this.generateCustomCSV(data);
this.downloadCSV(customCSV, "custom_data.csv");
```

## 📊 **Summary**

The SkillSphere application now has a complete CSV management system that:

- ✅ **Loads CSV data** on first run
- ✅ **Persists data** in localStorage
- ✅ **Supports manual reloading** from CSV
- ✅ **Exports data** to CSV format
- ✅ **Validates CSV files** for errors
- ✅ **Provides fallback** to default data

Your CSV files are now properly integrated with the persistent data storage system!
