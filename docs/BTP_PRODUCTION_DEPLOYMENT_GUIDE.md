# SkillSphere - BTP Production Deployment Guide with SSO

## Enabling SAP IAS Authentication & Role-Based Access Control

**Version:** 2.0.0  
**Last Updated:** April 2026  
**Author:** SkillSphere Development Team

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Target Architecture](#2-target-architecture)
3. [Step 1: Configure Trust (BTP + IAS)](#3-step-1-configure-trust-btp--ias)
4. [Step 2: Define Real XSUAA Security](#4-step-2-define-real-xsuaa-security)
5. [Step 3: Bind XSUAA to CAP Service](#5-step-3-bind-xsuaa-to-cap-service)
6. [Step 4: Protect Routes in Managed App Router](#6-step-4-protect-routes-in-managed-app-router)
7. [Step 5: Use User-Token Destination for Backend](#7-step-5-use-user-token-destination-for-backend)
8. [Step 6: CAP Runtime Auth Mode](#8-step-6-cap-runtime-auth-mode)
9. [Step 7: Build and Deploy](#9-step-7-build-and-deploy)
10. [Step 8: Assign Roles to Users](#10-step-8-assign-roles-to-users)
11. [Step 9: Update App Logic for JWT Identity](#11-step-9-update-app-logic-for-jwt-identity)
12. [Step 10: Validate End-to-End](#12-step-10-validate-end-to-end)
13. [Complete File Changes Summary](#13-complete-file-changes-summary)

---

## 1. Current State Analysis

### 1.1 What We Have Now

Your project currently has authentication **DISABLED**:

| File | Current State | Issue |
|------|---------------|-------|
| `xs-security.json` | Empty arrays `[]` | No scopes/roles defined |
| `webapp/xs-app.json` | `authenticationType: "none"` | No login required |
| `mta.yaml` | `skillsphere-auth` commented out | XSUAA not bound to service |
| `package.json` | `auth: "dummy"` in production | No real auth |
| Destination | `Authentication: NoAuthentication` | No token forwarding |

### 1.2 Current Files

**xs-security.json (EMPTY):**
```json
{
  "scopes": [],
  "attributes": [],
  "role-templates": []
}
```

**webapp/xs-app.json (NO AUTH):**
```json
{
  "routes": [
    {
      "source": "^/odata/v4/skillsphere/(.*)$",
      "authenticationType": "none"  // ❌ No auth!
    },
    {
      "source": "^(.*)$",
      "authenticationType": "none"  // ❌ No auth!
    }
  ]
}
```

**mta.yaml (AUTH COMMENTED OUT):**
```yaml
- name: skillsphere-srv
  requires:
    - name: skillsphere-db
    # - name: skillsphere-auth  # ❌ Commented out!
```

**package.json (DUMMY AUTH):**
```json
"[production]": {
  "auth": "dummy"  // ❌ No real auth!
}
```

---

## 2. Target Architecture

### 2.1 Authentication Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    TARGET SSO AUTHENTICATION FLOW                        │
└─────────────────────────────────────────────────────────────────────────┘

1. User opens app URL
         │
         ▼
2. Managed App Router (HTML5 Runtime) checks authentication
         │
    NOT AUTHENTICATED
         │
         ▼
3. Redirect to SAP IAS login page
         │
         ▼
4. User clicks "Sign In with SAP Account"
         │
         ▼
5. IAS authenticates user (via SAP Universal ID or Corporate IdP)
         │
         ▼
6. XSUAA issues JWT token with:
   - User email
   - User scopes (Employee, Manager, Admin)
         │
         ▼
7. Redirect back to app with JWT
         │
         ▼
8. App loads, CAP backend validates JWT on every request
         │
         ▼
9. Role-based access enforced:
   - Employee → Own data only
   - Manager → Team data
   - Admin → All data
```

### 2.2 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PRODUCTION ARCHITECTURE                               │
└─────────────────────────────────────────────────────────────────────────┘

    User Browser
         │
         │ 1. Access app URL
         ▼
    ┌─────────────────────────────────────────────────────────────────┐
    │                    MANAGED APP ROUTER                            │
    │                    (HTML5 Runtime)                               │
    │                                                                  │
    │  xs-app.json: authenticationType: "xsuaa"                       │
    │  → Enforces login before serving any content                    │
    └─────────────────────────────────────────────────────────────────┘
         │
         │ 2. Not authenticated? Redirect to IAS
         ▼
    ┌─────────────────┐
    │    SAP IAS      │
    │  (Identity      │
    │  Authentication │
    │  Service)       │
    │                 │
    │  "Sign In with  │
    │  SAP Account"   │
    └────────┬────────┘
             │
             │ 3. User authenticated
             ▼
    ┌─────────────────┐
    │     XSUAA       │
    │                 │
    │  Issues JWT:    │
    │  - user email   │
    │  - scopes       │
    └────────┬────────┘
             │
             │ 4. JWT token
             ▼
    ┌─────────────────────────────────────────────────────────────────┐
    │                    DESTINATION SERVICE                           │
    │                                                                  │
    │  skillsphere-srv-api:                                           │
    │  - Authentication: OAuth2UserTokenExchange                      │
    │  - HTML5.ForwardAuthToken: true                                 │
    │  → Forwards JWT to backend                                      │
    └─────────────────────────────────────────────────────────────────┘
             │
             │ 5. Request + JWT
             ▼
    ┌─────────────────┐     ┌─────────────────┐
    │ skillsphere-srv │────▶│  HANA Cloud     │
    │  (CAP Backend)  │     │  (Database)     │
    │                 │     │                 │
    │  Validates JWT  │     │  - Employees    │
    │  Checks scopes  │     │  - Skills       │
    │  Returns data   │     │  - Projects     │
    └─────────────────┘     └─────────────────┘
```

---

## 3. Step 1: Configure Trust (BTP + IAS)

### 3.1 Access BTP Cockpit

```
1. Open BTP Cockpit: https://cockpit.btp.cloud.sap/
2. Navigate to your Global Account
3. Select your Subaccount (e.g., skillsphere-prod)
```

### 3.2 Establish Trust with IAS

```
BTP Cockpit → Subaccount → Security → Trust Configuration

1. Click "Establish Trust"

2. Select your IAS tenant:
   - If you have one: Select from dropdown
   - If not: You may need to request one from your BTP admin

3. Click "Establish Trust"

4. Wait for trust to be established (may take a few minutes)

5. Verify: Your IAS tenant should appear under 
   "Custom Identity Provider for Applications"
```

### 3.3 Enable SAP Account Login in IAS

```
IAS Admin Console: https://<your-tenant>.accounts.ondemand.com/admin

1. Go to: Applications & Resources → Applications
2. Find or create "SkillSphere" application
3. Go to: Authentication & Access → Authenticating Identity Provider
4. Ensure "SAP Universal ID" or "accounts.sap.com" is enabled
5. Save

This allows users to "Sign In with SAP Account"
```

---

## 4. Step 2: Define Real XSUAA Security

### 4.1 Update xs-security.json

Replace the **entire contents** of `xs-security.json`:

```json
{
  "xsappname": "skillsphere",
  "tenant-mode": "dedicated",
  "scopes": [
    {
      "name": "$XSAPPNAME.Employee",
      "description": "Employee Access - View and edit own data"
    },
    {
      "name": "$XSAPPNAME.Manager",
      "description": "Manager Access - View and manage team data"
    },
    {
      "name": "$XSAPPNAME.Admin",
      "description": "Admin Access - Full system access"
    }
  ],
  "attributes": [],
  "role-templates": [
    {
      "name": "Employee",
      "description": "Employee Role",
      "scope-references": [
        "$XSAPPNAME.Employee"
      ]
    },
    {
      "name": "Manager",
      "description": "Manager Role",
      "scope-references": [
        "$XSAPPNAME.Employee",
        "$XSAPPNAME.Manager"
      ]
    },
    {
      "name": "Admin",
      "description": "Admin Role",
      "scope-references": [
        "$XSAPPNAME.Employee",
        "$XSAPPNAME.Manager",
        "$XSAPPNAME.Admin"
      ]
    }
  ],
  "role-collections": [
    {
      "name": "SkillSphere_Employee",
      "description": "SkillSphere Employee Access",
      "role-template-references": [
        "$XSAPPNAME.Employee"
      ]
    },
    {
      "name": "SkillSphere_Manager",
      "description": "SkillSphere Manager Access",
      "role-template-references": [
        "$XSAPPNAME.Manager"
      ]
    },
    {
      "name": "SkillSphere_Admin",
      "description": "SkillSphere Admin Access",
      "role-template-references": [
        "$XSAPPNAME.Admin"
      ]
    }
  ]
}
```

### 4.2 What This Creates

After deployment, BTP will have these role collections:

| Role Collection | Scopes Included | Access Level |
|-----------------|-----------------|--------------|
| `SkillSphere_Employee` | Employee | Own data only |
| `SkillSphere_Manager` | Employee + Manager | Team data |
| `SkillSphere_Admin` | Employee + Manager + Admin | All data |

---

## 5. Step 3: Bind XSUAA to CAP Service

### 5.1 Update mta.yaml

In `mta.yaml`, **uncomment** the `skillsphere-auth` line in the `skillsphere-srv` module:

**BEFORE:**
```yaml
- name: skillsphere-srv
  requires:
    - name: skillsphere-db
    # - name: skillsphere-auth  # ❌ Commented out
    - name: skillsphere-destination
```

**AFTER:**
```yaml
- name: skillsphere-srv
  requires:
    - name: skillsphere-db
    - name: skillsphere-auth      # ✅ Uncommented!
    - name: skillsphere-destination
```

### 5.2 Full mta.yaml skillsphere-srv Module

```yaml
# CAP Service Module
- name: skillsphere-srv
  type: nodejs
  path: srv
  parameters:
    buildpack: nodejs_buildpack
    memory: 256M
    disk-quota: 1024M
  build-parameters:
    builder: npm
    ignore:
      - "node_modules/"
  provides:
    - name: srv-api
      properties:
        srv-url: ${default-url}
  requires:
    - name: skillsphere-db
    - name: skillsphere-auth      # ✅ XSUAA binding
    - name: skillsphere-destination
    - name: skillsphere-connectivity
```

---

## 6. Step 4: Protect Routes in Managed App Router

### 6.1 Update webapp/xs-app.json

Change `authenticationType` from `"none"` to `"xsuaa"`:

**BEFORE:**
```json
{
  "welcomeFile": "/index.html",
  "authenticationMethod": "route",
  "routes": [
    {
      "source": "^/odata/v4/skillsphere/(.*)$",
      "target": "/odata/v4/skillsphere/$1",
      "destination": "skillsphere-srv-api",
      "authenticationType": "none",        // ❌ No auth
      "csrfProtection": true
    },
    {
      "source": "^(.*)$",
      "target": "$1",
      "service": "html5-apps-repo-rt",
      "authenticationType": "none"         // ❌ No auth
    }
  ]
}
```

**AFTER:**
```json
{
  "welcomeFile": "/index.html",
  "authenticationMethod": "route",
  "routes": [
    {
      "source": "^/odata/v4/skillsphere/(.*)$",
      "target": "/odata/v4/skillsphere/$1",
      "destination": "skillsphere-srv-api",
      "authenticationType": "xsuaa",       // ✅ XSUAA auth
      "csrfProtection": true
    },
    {
      "source": "^(.*)$",
      "target": "$1",
      "service": "html5-apps-repo-rt",
      "authenticationType": "xsuaa"        // ✅ XSUAA auth
    }
  ]
}
```

### 6.2 What This Does

- **Before:** Anyone can access the app without logging in
- **After:** User must authenticate via IAS before seeing any content

---

## 7. Step 5: Use User-Token Destination for Backend

### 7.1 Update Destination in mta.yaml

Change the destination from `NoAuthentication` to use token forwarding:

**BEFORE:**
```yaml
- name: skillsphere-destination
  parameters:
    config:
      init_data:
        instance:
          destinations:
            - Name: skillsphere-srv-api
              URL: ~{srv-api/srv-url}
              Authentication: NoAuthentication    # ❌ No auth
              Type: HTTP
              ProxyType: Internet
              HTML5.ForwardAuthToken: true
```

**AFTER:**
```yaml
- name: skillsphere-destination
  parameters:
    config:
      HTML5Runtime_enabled: true
      init_data:
        instance:
          destinations:
            - Name: skillsphere-srv-api
              URL: ~{srv-api/srv-url}
              Authentication: NoAuthentication    # Keep as NoAuthentication
              Type: HTTP
              ProxyType: Internet
              HTML5.ForwardAuthToken: true        # ✅ This forwards the JWT!
              HTML5.DynamicDestination: true
          existing_destinations_policy: update
```

**Note:** `Authentication: NoAuthentication` is correct here because the managed app router handles authentication. The key is `HTML5.ForwardAuthToken: true` which forwards the JWT to the backend.

---

## 8. Step 6: CAP Runtime Auth Mode

### 8.1 Update package.json

Change the production auth from `"dummy"` to `"xsuaa"` and db to `"hana"`:

**BEFORE:**
```json
"cds": {
  "requires": {
    "db": {
      "kind": "sqlite",
      "model": "db"
    },
    "[production]": {
      "db": {
        "kind": "sqlite"      // ❌ Should be hana
      },
      "auth": "dummy"         // ❌ No real auth
    }
  }
}
```

**AFTER:**
```json
"cds": {
  "requires": {
    "db": {
      "kind": "sqlite",
      "model": "db"
    },
    "[production]": {
      "db": {
        "kind": "hana"        // ✅ HANA for production
      },
      "auth": {
        "kind": "xsuaa"       // ✅ Real XSUAA auth
      }
    }
  }
}
```

### 8.2 What This Does

- **Development:** Uses SQLite and no auth (for local testing)
- **Production:** Uses HANA Cloud and XSUAA (real auth)

---

## 9. Step 7: Build and Deploy

### 9.1 Build Commands

```bash
# Clean previous builds
rm -rf gen/ mta_archives/ node_modules/

# Install dependencies
npm ci

# Build for production
npx cds build --production

# Build MTA archive
mbt build

# The archive will be at: mta_archives/skillsphere_1.0.0.mtar
```

### 9.2 Deploy to Cloud Foundry

```bash
# Login to Cloud Foundry
cf login -a https://api.cf.eu12.hana.ondemand.com

# Select your org and space
cf target -o your-org -s your-space

# Deploy
cf deploy mta_archives/skillsphere_1.0.0.mtar

# Or with retries
cf deploy mta_archives/skillsphere_1.0.0.mtar --retries 3
```

### 9.3 Verify Deployment

```bash
# Check apps
cf apps

# Expected output:
# name                      state     instances
# skillsphere-srv           started   1/1
# skillsphere-db-deployer   stopped   0/1

# Check services
cf services

# Expected output:
# name                          service
# skillsphere-db                hana
# skillsphere-auth              xsuaa        # ✅ Should exist
# skillsphere-destination       destination
# skillsphere-html5-repo-host   html5-apps-repo
```

---

## 10. Step 8: Assign Roles to Users

### 10.1 Access Role Collections

```
BTP Cockpit → Subaccount → Security → Role Collections
```

### 10.2 Verify Role Collections Exist

After deployment, you should see:
- `SkillSphere_Employee`
- `SkillSphere_Manager`
- `SkillSphere_Admin`

If they don't exist, they will be created from `xs-security.json` on first deployment.

### 10.3 Assign Users to Role Collections

```
BTP Cockpit → Subaccount → Security → Users

For each user:
1. Click on user email (or "Create" for new user)
2. Click "Assign Role Collection"
3. Select the appropriate role:
   - SkillSphere_Employee → For regular employees
   - SkillSphere_Manager → For team managers
   - SkillSphere_Admin → For administrators
4. Click "Assign"
```

### 10.4 Example Assignments

| User Email | Role Collection | Access |
|------------|-----------------|--------|
| john.doe@company.com | SkillSphere_Employee | Own data only |
| jane.manager@company.com | SkillSphere_Manager | Team data |
| admin@company.com | SkillSphere_Admin | All data |

**IMPORTANT:** Without role assignment, users can login but will get authorization errors!

---

## 11. Step 9: Update App Logic for JWT Identity

### 11.1 Current State

Your app currently uses password-based login in the UI:
- Landing page has login form
- Controllers check password against Users table
- No JWT validation

### 11.2 For SSO Mode

With SSO enabled, the user is already authenticated when they reach the app. You need to:

1. **Read user from JWT** instead of password login
2. **Map JWT email to Employees table** to get user details
3. **Check scopes** to determine role

### 11.3 Create Auth Handler

Create file `srv/auth-handler.js`:

```javascript
/**
 * Authentication Handler for SSO
 * Reads user info from JWT token
 */
class AuthHandler {
  
  /**
   * Get current user from JWT token
   */
  static getCurrentUser(req) {
    if (req.user) {
      return {
        id: req.user.id,
        email: req.user.email || req.user.id,
        name: req.user.name || req.user.email?.split('@')[0] || 'Unknown',
        scopes: req.user.scopes || req.user._roles || [],
        isAuthenticated: true
      };
    }
    return {
      id: 'anonymous',
      email: 'anonymous@local.dev',
      name: 'Anonymous',
      scopes: [],
      isAuthenticated: false
    };
  }
  
  /**
   * Check if user has a specific scope
   */
  static hasScope(req, scope) {
    const user = this.getCurrentUser(req);
    return user.scopes.includes(scope) || 
           user.scopes.includes(`skillsphere.${scope}`) ||
           user.scopes.some(s => s.endsWith(`.${scope}`));
  }
  
  /**
   * Check if user is Employee
   */
  static isEmployee(req) {
    return this.hasScope(req, 'Employee');
  }
  
  /**
   * Check if user is Manager
   */
  static isManager(req) {
    return this.hasScope(req, 'Manager');
  }
  
  /**
   * Check if user is Admin
   */
  static isAdmin(req) {
    return this.hasScope(req, 'Admin');
  }
  
  /**
   * Get user's highest role
   */
  static getRole(req) {
    if (this.isAdmin(req)) return 'Admin';
    if (this.isManager(req)) return 'Manager';
    if (this.isEmployee(req)) return 'Employee';
    return 'None';
  }
}

module.exports = AuthHandler;
```

### 11.4 Update Service to Use JWT

In `srv/skillsphere-service.js`, add a `getCurrentUser` action:

```javascript
const AuthHandler = require('./auth-handler');

// Add this action to get current user info
this.on('getCurrentUser', async (req) => {
  const user = AuthHandler.getCurrentUser(req);
  
  if (!user.isAuthenticated) {
    return { success: false, message: 'Not authenticated' };
  }
  
  const role = AuthHandler.getRole(req);
  
  // Look up user in Employees table by email
  const employee = await SELECT.one.from('skillsphere.Employees')
    .where({ email: user.email });
  
  // Or look up in Users table
  const dbUser = await SELECT.one.from('skillsphere.Users')
    .where({ id: user.email.split('@')[0] });
  
  return {
    success: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: role,
      scopes: user.scopes
    },
    employee: employee,
    dbUser: dbUser
  };
});
```

### 11.5 Frontend: Skip Password Login

In your frontend, instead of showing a login form:

```typescript
// In Component.ts or App.controller.ts

async onInit() {
  // Call getCurrentUser to get JWT user info
  const oDataModel = this.getModel();
  const context = oDataModel.bindContext("/getCurrentUser(...)");
  await context.execute();
  const result = context.getBoundContext().getObject();
  
  if (result.success) {
    // User is authenticated via SSO
    const role = result.user.role;
    
    // Route based on role
    if (role === 'Admin') {
      this.getRouter().navTo("AdminDashboard");
    } else if (role === 'Manager') {
      this.getRouter().navTo("ManagerDashboard");
    } else {
      this.getRouter().navTo("EmployeeDashboard");
    }
  }
}
```

### 11.6 Temporary: Keep Login Pages

You can keep the existing login pages temporarily for:
- Local development (where SSO isn't available)
- Fallback scenarios

But the final SSO UX should skip manual password forms entirely.

---

## 12. Step 10: Validate End-to-End

### 12.1 Test SSO Flow

```
1. Open app URL in INCOGNITO browser window
   https://<your-app>.cfapps.eu12.hana.ondemand.com

2. You should be redirected to IAS login page
   - Look for "Sign In with SAP Account" button

3. Click "Sign In with SAP Account"
   - Enter your SAP Universal ID credentials
   - Or corporate credentials if SSO is configured

4. After login, you should be redirected back to the app

5. Open browser DevTools → Network tab
   - Check OData calls return 200 (not 401/403)
   - Check requests include Authorization header with JWT
```

### 12.2 Test Role-Based Access

```
Test as Employee:
1. Login as user with SkillSphere_Employee role
2. Verify: Can see own data
3. Verify: Cannot see other employees' data
4. Verify: Cannot access manager features

Test as Manager:
1. Login as user with SkillSphere_Manager role
2. Verify: Can see own data
3. Verify: Can see team members' data
4. Verify: Cannot see employees outside team

Test as Admin:
1. Login as user with SkillSphere_Admin role
2. Verify: Can see all data
3. Verify: Can access all features
```

### 12.3 Verify JWT Token

```
In browser DevTools:

1. Go to Application → Cookies
2. Look for JWT token cookie

3. Or in Network tab:
   - Find an OData request
   - Check Headers → Authorization
   - Should see: Bearer <jwt-token>

4. Decode JWT at jwt.io:
   - Paste the token
   - Check payload for:
     - email
     - scope (should include Employee/Manager/Admin)
```

---

## 13. Complete File Changes Summary

### 13.1 Files to Modify

| File | Change |
|------|--------|
| `xs-security.json` | Add scopes, role-templates, role-collections |
| `mta.yaml` | Uncomment `skillsphere-auth` in srv requires |
| `webapp/xs-app.json` | Change `authenticationType` to `"xsuaa"` |
| `package.json` | Change production auth to `"xsuaa"`, db to `"hana"` |

### 13.2 Files to Create

| File | Purpose |
|------|---------|
| `srv/auth-handler.js` | JWT user extraction and role checking |

### 13.3 Quick Copy-Paste Changes

**xs-security.json:**
```json
{
  "xsappname": "skillsphere",
  "tenant-mode": "dedicated",
  "scopes": [
    { "name": "$XSAPPNAME.Employee", "description": "Employee Access" },
    { "name": "$XSAPPNAME.Manager", "description": "Manager Access" },
    { "name": "$XSAPPNAME.Admin", "description": "Admin Access" }
  ],
  "role-templates": [
    { "name": "Employee", "scope-references": ["$XSAPPNAME.Employee"] },
    { "name": "Manager", "scope-references": ["$XSAPPNAME.Employee", "$XSAPPNAME.Manager"] },
    { "name": "Admin", "scope-references": ["$XSAPPNAME.Employee", "$XSAPPNAME.Manager", "$XSAPPNAME.Admin"] }
  ],
  "role-collections": [
    { "name": "SkillSphere_Employee", "role-template-references": ["$XSAPPNAME.Employee"] },
    { "name": "SkillSphere_Manager", "role-template-references": ["$XSAPPNAME.Manager"] },
    { "name": "SkillSphere_Admin", "role-template-references": ["$XSAPPNAME.Admin"] }
  ]
}
```

**webapp/xs-app.json:**
```json
{
  "welcomeFile": "/index.html",
  "authenticationMethod": "route",
  "routes": [
    {
      "source": "^/odata/v4/skillsphere/(.*)$",
      "target": "/odata/v4/skillsphere/$1",
      "destination": "skillsphere-srv-api",
      "authenticationType": "xsuaa",
      "csrfProtection": true
    },
    {
      "source": "^(.*)$",
      "target": "$1",
      "service": "html5-apps-repo-rt",
      "authenticationType": "xsuaa"
    }
  ]
}
```

**package.json (cds section only):**
```json
"cds": {
  "requires": {
    "db": { "kind": "sqlite", "model": "db" },
    "[production]": {
      "db": { "kind": "hana" },
      "auth": { "kind": "xsuaa" }
    }
  }
}
```

**mta.yaml (skillsphere-srv requires):**
```yaml
requires:
  - name: skillsphere-db
  - name: skillsphere-auth      # Uncomment this line!
  - name: skillsphere-destination
  - name: skillsphere-connectivity
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | April 2026 | SkillSphere Team | Initial version |
| 2.0.0 | April 2026 | SkillSphere Team | SSO/IAS configuration based on actual project |

---

**End of Document**