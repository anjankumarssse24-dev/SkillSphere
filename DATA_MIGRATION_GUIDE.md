# Data Storage Migration Guide

## Current Status
Your SkillSphere application currently uses JSON files for data storage. Here are two migration options:

## Option 1: CSV Files (Recommended for simplicity)

### ✅ Advantages:
- Easy to edit with Excel/text editors
- Lightweight and portable
- No additional dependencies
- Easy backup and version control

### 📁 Files Created:
- `webapp/data/users.csv` - User authentication data
- `webapp/data/employees.csv` - Employee profiles
- `webapp/data/skills.csv` - Skills and proficiency data
- `webapp/service/CSVDataService.ts` - CSV handling service

### 🔧 To Use CSV Files:

1. **Update your controllers to use CSV service:**
```typescript
import { CSVDataService } from "../service/CSVDataService";

// In your controller onInit:
const csvData = await CSVDataService.loadAllData();
this.getView().setModel(new JSONModel(csvData.users), "users");
this.getView().setModel(new JSONModel(csvData.employees), "employees");
```

2. **Update manifest.json models section:**
```json
"models": {
  "": {
    "dataSource": "mainService",
    "type": "sap.ui.model.json.JSONModel"
  }
}
```

## Option 2: SQLite Database (Advanced)

### ✅ Advantages:
- SQL queries and relationships
- Better data integrity
- Transaction support
- More scalable

### 📦 Required Dependencies:
```bash
npm install sql.js
npm install @types/sql.js --save-dev
```

### 📁 Files Created:
- `webapp/data/skillsphere.sql` - Database schema and sample data
- `webapp/service/SQLiteDataService.ts` - SQLite handling service

### 🔧 To Use SQLite:

1. **Install dependencies:**
```bash
cd /path/to/project1
npm install sql.js @types/sql.js
```

2. **Update controller:**
```typescript
import { SQLiteDataService } from "../service/SQLiteDataService";

// In your controller onInit:
const dbService = new SQLiteDataService();
await dbService.initDatabase();
const users = dbService.getUsers();
this.getView().setModel(new JSONModel({users}), "users");
```

## Migration Steps

### For CSV Migration:
1. Your CSV files are ready in `webapp/data/`
2. Use `CSVDataService.ts` to load data
3. Replace JSON model loading with CSV loading
4. Test the application

### For SQLite Migration:
1. Install dependencies: `npm install sql.js @types/sql.js`
2. Use `SQLiteDataService.ts` for database operations
3. Initialize database on app startup
4. Replace JSON models with SQLite queries

## Data Persistence

### Current (JSON):
- ❌ Changes lost on refresh
- ✅ Easy development/testing

### CSV:
- ✅ Manual persistence (save CSV files)
- ✅ Excel-compatible editing
- ❌ Requires server-side saving for auto-persistence

### SQLite:
- ✅ Automatic persistence via localStorage
- ✅ ACID transactions
- ✅ Complex queries and relationships

## Recommendation

**For Development/Demo**: Use CSV files (simpler setup)
**For Production**: Use SQLite + backend API

Would you like me to help you implement either option?

## Notes about sql.js and UI5

If you use the SQLite option with `sql.js`, this project includes a small AMD shim at `webapp/resources/sql.js.js` which helps the UI5 loader resolve the `sql.js` module by loading the `sql-wasm.js` bundle from the official CDN.

For fully offline/local development you can copy the `sql-wasm.wasm` file into `webapp/resources/` so the wasm binary is served from the local UI5 server. Steps:

1. Install the package locally: `npm install sql.js`
2. Copy `node_modules/sql.js/dist/sql-wasm.wasm` into `project1/webapp/resources/sql-wasm.wasm`.
3. Reload the UI5 app. The `SQLiteDataService` locateFile will prefer `./resources/` and the shim will load the local wasm when available.

If you prefer CDN usage the shim will automatically load `https://sql.js.org/dist/sql-wasm.js` and fetch the wasm from the CDN.