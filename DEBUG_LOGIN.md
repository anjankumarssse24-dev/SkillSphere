# SkillSphere Login Debugging Guide

## Current Status
The application is running and data is being loaded (9 users), but login is failing. This guide will help you debug and fix the issue.

## Debugging Steps

### 1. Check Console Logs
Open browser developer tools (F12) and look for these logs:

**Component.ts logs:**
- "Raw CSV text" - Should show the CSV content
- "Parsed CSV data" - Should show parsed rows
- "First CSV row" - Should show the first user data
- "Processed users" - Should show final user objects

**CSVParser.ts logs:**
- "Parsing users CSV data" - Should show raw CSV data
- "First CSV row keys" - Should show: id, name, password, role, team, subTeam, manager
- "First CSV row values" - Should show actual values
- "Processing row X" - Should show each user being processed

**Login Controller logs:**
- "Available users in EmployeeLogin" - Should show 9 users
- "First user structure" - Should show the structure of the first user
- "All user IDs" - Should show: EMP001, EMP002, EMP003, MGR001, MGR002, EMP004, EMP005, EMP006
- "All user roles" - Should show: Employee, Employee, Employee, Manager, Manager, Employee, Employee, Employee

### 2. Test Login Functions
In the browser console, you can test the login functions:

**For Employee Login:**
```javascript
// Test with valid credentials
testEmployeeLogin("EMP001", "password123")
testEmployeeLogin("EMP002", "password123")

// Test with invalid credentials
testEmployeeLogin("EMP001", "wrongpassword")
```

**For Manager Login:**
```javascript
// Test with valid credentials
testManagerLogin("MGR001", "manager123")
testManagerLogin("MGR002", "manager123")

// Test with invalid credentials
testManagerLogin("MGR001", "wrongpassword")
```

### 3. Expected Results
If everything is working correctly, you should see:

1. **CSV Loading:** Raw CSV text should show the file content
2. **CSV Parsing:** Parsed data should show 8 user objects
3. **User Structure:** Each user should have: id, name, password, role, team, subTeam, manager
4. **Login Test:** testEmployeeLogin("EMP001", "password123") should return a user object
5. **Login Test:** testManagerLogin("MGR001", "manager123") should return a user object

### 4. Common Issues and Solutions

**Issue: Empty user IDs**
- Check if CSV parsing is working correctly
- Verify the CSV file path is correct
- Check if the CSV file has the right format

**Issue: Users not found**
- Check if the user data structure matches what the login function expects
- Verify that the role field is correctly set
- Check if the password comparison is working

**Issue: Model not loaded**
- Check if the Component.ts is being executed
- Verify that the CSV loading is not failing
- Check if there are any JavaScript errors

### 5. Manual Testing
1. Navigate to the employee login page
2. Try logging in with:
   - ID: EMP001, Password: password123
   - ID: EMP002, Password: password123
3. Navigate to the manager login page
4. Try logging in with:
   - ID: MGR001, Password: manager123
   - ID: MGR002, Password: manager123

### 6. If Login Still Fails
Check the console logs and look for:
- Any error messages
- Missing user data
- Incorrect user structure
- Failed CSV parsing

## Valid Test Credentials

**Employees:**
- EMP001 / password123 (John Doe)
- EMP002 / password123 (Jane Smith)
- EMP003 / password123 (Mike Johnson)
- EMP004 / password123 (Sarah Brown)
- EMP005 / password123 (David Lee)
- EMP006 / password123 (Tom Harris)

**Managers:**
- MGR001 / manager123 (Alice Johnson)
- MGR002 / manager123 (Bob Wilson)
