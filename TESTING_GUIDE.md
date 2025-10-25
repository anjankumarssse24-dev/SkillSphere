# SkillSphere - Complete Testing Guide

## Prerequisites
- Node.js LTS installed
- npm 8.x or higher
- Project files properly set up

## Getting Started

### 1. Install Dependencies
```bash
cd c:\Users\anjan\Downloads\SkillSphere\SkillSphere-main
npm install
```

### 2. Start Development Server
```bash
npm start
```
The app will open at: http://localhost:8080

---

## Test Scenario 1: Beginner Proficiency Level Fix

### Objective
Verify that "Beginner" proficiency level now saves correctly when adding a new skill.

### Steps

#### Step 1: Login as Employee
1. On Landing page, click "Employee Login"
2. Enter credentials:
   - Employee ID: `EMP001`
   - Password: `password123`
3. Click "Login"
4. You should see Employee Dashboard for John Doe

#### Step 2: Navigate to Skills Section
1. Scroll down to "My Skills" section
2. Click "Add Skill" button
3. "Add New Skill" dialog should open

#### Step 3: Fill Skill Form with Beginner Level
1. **Skill Name**: Enter `Leadership`
2. **Category**: Enter `Soft Skills`
3. **Proficiency Level**: Click dropdown and **select "Beginner"** (this is the test!)
4. **Years of Experience**: Enter `1`
5. **Certification Status**: Select `None`
6. Click "Save" button

#### Expected Result ✅
- Dialog closes without error
- Toast message: "Skill added successfully"
- New skill appears in Skills table with "Beginner" proficiency
- Refresh page - skill still exists (persisted in localStorage)

#### Troubleshooting
| Issue | Solution |
|-------|----------|
| Form shows validation error | Check that all fields are filled, especially category |
| "Beginner" option not showing | Clear browser cache and reload |
| Toast says "Error saving skill" | Check browser console for errors |

---

## Test Scenario 2: Manager Field Display

### Objective
Verify that the Manager field displays correctly in the Employee Profile.

### Steps

#### Step 1: Login and View Profile
1. Go to Employee Dashboard (already logged in from Test 1)
2. Scroll to "Profile Information" section at top
3. You should see a card with employee details

#### Step 2: Check Manager Display
Look for the following fields in Profile Information:
- Employee ID: `EMP001`
- Team: `CSI`
- **Manager: `Alice Johnson`** ← This should be visible!
- Email: `john.doe@company.com`

#### Expected Result ✅
- Manager field shows: **"Alice Johnson"**
- Email field shows: **"john.doe@company.com"**
- Both fields have proper labels and styling

#### Test with Different Employees
1. Logout (click Logout button)
2. Login with different credentials:
   - **Employee ID**: `EMP002`
   - **Password**: `password123`
3. Check Profile Information → Manager should show: **"Bob Wilson"**
4. Logout and verify with EMP003 → Manager should show: **"Alice Johnson"**

#### Expected Results
| Employee | Manager |
|----------|---------|
| EMP001 (John Doe) | Alice Johnson |
| EMP002 (Jane Smith) | Bob Wilson |
| EMP003 (Mike Johnson) | Alice Johnson |

---

## Test Scenario 3: Skills Data Consistency

### Objective
Verify that both Employee and Manager dashboards see the same skills data.

### Steps

#### Step 1: View Employee Skills (Employee Perspective)
1. Login as Employee: EMP001 / password123
2. Go to Employee Dashboard
3. Scroll to "My Skills" section
4. Note the skills listed (should include):
   - JavaScript (Proficient)
   - SAP UI5 (Intermediate)
   - Node.js (Proficient)
   - HTML/CSS (Proficient)
   - SAP Fiori (Intermediate)

#### Step 2: View Manager Dashboard
1. Logout (click Logout button)
2. Go to Landing page, click "Manager Login"
3. Enter credentials:
   - Manager ID: `MGR001`
   - Password: `manager123`
4. Click "Login"
5. You should see Manager Dashboard

#### Step 3: View Team Member Skills (Manager Perspective)
1. In Manager Dashboard, scroll to "My Team" section
2. Find "John Doe" (EMP001) in the team table
3. Click "View" button for John Doe
4. In the "Employee Details" dialog, check "Skills Portfolio" section

#### Step 4: Compare Skills Lists
Compare skills from Step 1 and Step 3:

**Expected Match ✅**
| Skill | Employee Dashboard | Manager Dashboard |
|-------|-------------------|-------------------|
| JavaScript | ✓ Proficient | ✓ Proficient |
| SAP UI5 | ✓ Intermediate | ✓ Intermediate |
| Node.js | ✓ Proficient | ✓ Proficient |
| HTML/CSS | ✓ Proficient | ✓ Proficient |
| SAP Fiori | ✓ Intermediate | ✓ Intermediate |

**Old Behavior (BEFORE FIXES)** ❌
- Employee saw: [model skills]
- Manager saw: [hardcoded mock skills]
- Skills didn't match!

#### Step 5: Test Another Employee
1. Close the dialog
2. Find "Jane Smith" (EMP002) in team table
3. Click "View" button
4. Skills should show: Python, SAP HANA, SQL, Machine Learning, Tableau
5. These should match what EMP002 would see in Employee Dashboard

#### Step 6: Test Search Functionality
1. Close the dialog
2. Scroll to "Employee Search" section
3. In "Skills" input, type: `Python`
4. Click "Search Employees"
5. Results should show: "Jane Smith" (EMP002) with matching skill
6. Click on result to verify Python skill is displayed

---

## Test Scenario 4: Add New Skill and Verify Sync

### Objective
Verify that new skills added by employees appear correctly in both dashboards.

### Steps

#### Step 1: Add New Skill as Employee
1. Login as Employee: EMP001 / password123
2. Go to Employee Dashboard
3. Scroll to "My Skills" section
4. Click "Add Skill"
5. Fill form:
   - Skill Name: `React`
   - Category: `Frontend`
   - Proficiency Level: `Intermediate`
   - Years of Experience: `2`
   - Certification Status: `In Progress`
6. Click "Save"

#### Expected Result
- Toast: "Skill added successfully"
- New skill appears in Employee's Skills table
- Skill has correct proficiency level color

#### Step 2: Verify Persistence
1. Refresh the page (F5 or Ctrl+R)
2. Navigate back to Employee Dashboard
3. Check Skills section

#### Expected Result ✅
- New "React" skill still visible after refresh
- Proves data persisted in localStorage

#### Step 3: Check if Manager Sees New Skill
1. Logout
2. Login as Manager: MGR001 / manager123
3. Go to Manager Dashboard
4. Find EMP001 (John Doe) in team
5. Click "View" button
6. Check Employee Details dialog

#### Expected Result
**IMPORTANT**: New skills added locally appear in Employee Dashboard immediately but may NOT appear in Manager Dashboard (only model/default skills appear to manager). This is by design:
- Employee can see: Model skills + Local additions
- Manager can see: Model skills (consistent baseline)
- To sync new skills to manager view, export/import mechanism would be needed

---

## Test Scenario 5: Edit and Delete Skills

### Objective
Verify editing and deleting skills works correctly.

### Steps

#### Step 1: Edit a Skill
1. Login as Employee: EMP001 / password123
2. Go to Employee Dashboard → My Skills
3. Find "JavaScript" skill in the table
4. Click "Edit" button (pencil icon)
5. In the edit dialog:
   - Change Proficiency Level from "Proficient" to "Intermediate"
   - Change Years of Experience from "5" to "4"
6. Click "Save"

#### Expected Result ✅
- Dialog closes
- Toast: "Skill updated successfully"
- Updated skill appears in table with new values

#### Step 2: Delete a Skill
1. Find "SAP Fiori" skill in the table
2. Click "Delete" button (trash icon)

#### Expected Result ✅
- Toast: "Skill deleted successfully"
- Skill removed from table
- Refresh page - still deleted (persisted)

#### Step 3: Verify Manager Sees Original Skills
1. Logout and login as Manager (MGR001)
2. View EMP001 employee details
3. Check if "SAP Fiori" is still listed (it should be, manager sees model skills)

#### Expected Result ✅
- Manager still sees original model skills
- Employee sees model skills minus deleted ones

---

## Test Scenario 6: Cross-Browser Testing

### Objective
Verify responsive design works across different screen sizes.

### Test on Different Devices/Sizes

#### Desktop (1920x1080)
1. Login as Employee
2. All sections should display in full width
3. Tables should be fully visible
4. Buttons and inputs should be properly sized

#### Tablet (768x1024) - Use Browser DevTools
1. Press F12 to open DevTools
2. Click device toolbar (mobile icon)
3. Select iPad dimensions (768x1024)
4. Refresh and test:
   - Can scroll vertically through sections ✓
   - Tables are readable with popup columns ✓
   - Dialog boxes fit on screen ✓

#### Mobile (375x667)
1. Select iPhone dimensions in DevTools (375x667)
2. Refresh and test:
   - All controls accessible on mobile ✓
   - Forms are touch-friendly ✓
   - Buttons easily clickable ✓

---

## Test Scenario 7: Error Handling

### Objective
Verify the app handles errors gracefully.

### Step 1: Validation Errors
1. Open "Add Skill" dialog
2. Leave "Skill Name" empty
3. Click "Save"

#### Expected Result ✅
- Toast shows: "Please fill all required fields: Skill Name, Category, and Proficiency Level"
- Dialog stays open for correction

### Step 2: Missing Selection
1. Fill Skill Name: "Python"
2. Fill Category: "Programming"
3. Leave "Proficiency Level" empty
4. Click "Save"

#### Expected Result ✅
- Same validation error
- Dialog stays open

---

## Test Data Reference

### Test Accounts

| ID | Name | Password | Role | Team | Manager |
|----|------|----------|------|------|---------|
| EMP001 | John Doe | password123 | Employee | CSI | Alice Johnson |
| EMP002 | Jane Smith | password123 | Employee | HANA | Bob Wilson |
| EMP003 | Mike Johnson | password123 | Employee | CSI | Alice Johnson |
| MGR001 | Alice Johnson | manager123 | Manager | CSI | - |
| MGR002 | Bob Wilson | manager123 | Manager | HANA | - |

### Sample Skills by Employee

**EMP001 (John Doe - SAPUI5 Developer)**
- JavaScript (Proficient)
- SAP UI5 (Intermediate)
- Node.js (Proficient)
- HTML/CSS (Proficient)
- SAP Fiori (Intermediate)

**EMP002 (Jane Smith - Data Science)**
- Python (Proficient)
- SAP HANA (Proficient)
- SQL (Proficient)
- Machine Learning (Intermediate)
- Tableau (Intermediate)

**EMP003 (Mike Johnson - HANA Developer)**
- Java (Intermediate)
- SAP HANA (Proficient)
- SQL (Proficient)
- Data Modeling (Intermediate)

---

## Troubleshooting

### Common Issues and Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| Page won't load | npm not started | Run `npm start` |
| Models not loading | JSON files not found | Check path is relative to webapp/ |
| Skills not showing | localStorage cleared | Log in again and add skill |
| Proficiency dropdown empty | Browser cache | Clear cache (Ctrl+Shift+Del) |
| Manager field empty | Data not loaded | Check employees.json has manager field |
| Dialogs not opening | Fragment not found | Check fragment path matches controllerName namespace |

### Console Debugging

Open Developer Tools (F12) → Console tab to check for:
- Model loading logs: "Skills model loaded successfully"
- Employee data logs: "Loaded employees data:"
- Errors: Red error messages indicate problems

---

## Test Completion Checklist

- [ ] **Beginner Proficiency**: Can add skill with "Beginner" level
- [ ] **Manager Display**: Manager field shows correctly (Alice Johnson, Bob Wilson)
- [ ] **Skills Consistency**: Employee and Manager see same default skills
- [ ] **Add Skill**: Can add new skills successfully
- [ ] **Edit Skill**: Can modify existing skill proficiency levels
- [ ] **Delete Skill**: Can remove skills from list
- [ ] **Persistence**: Skills persist after page refresh
- [ ] **Multiple Employees**: Different employees show correct managers
- [ ] **Responsive Design**: Works on desktop, tablet, mobile
- [ ] **Search**: Manager can search employees by skills
- [ ] **Logout**: Can logout and login again without issues

---

## Sign Off

All tests passed: ______________________  Date: ____________

Project ready for: [ ] Further development [ ] Testing [ ] Deployment
