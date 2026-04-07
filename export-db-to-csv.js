/**
 * Export SQLite database to CSV files
 * This script exports all tables from db.sqlite to CSV files in db/data/ folder
 * Uses CAP's built-in database connection
 */

const cds = require('@sap/cds');
const fs = require('fs');
const path = require('path');

// CSV directory
const csvDir = path.join(__dirname, 'db', 'data');

// Ensure CSV directory exists
if (!fs.existsSync(csvDir)) {
    fs.mkdirSync(csvDir, { recursive: true });
}

// Entity to CSV file mapping
const entityMappings = [
    { entity: 'skillsphere.Users', file: 'skillsphere-Users.csv', columns: ['id', 'role', 'isActive'] },
    { entity: 'skillsphere.Employees', file: 'skillsphere-Employees.csv', columns: ['employeeId', 'name', 'role', 'team', 'subTeam', 'managerId', 'email', 'experience', 'totalSkills', 'totalProjects', 'location', 'tLevel', 'gradeLevel'] },
    { entity: 'skillsphere.Skills', file: 'skillsphere-Skills.csv', columns: ['skillId', 'skillName', 'category', 'employeeId', 'proficiencyLevel', 'yearsExperience', 'certificationStatus'] },
    { entity: 'skillsphere.Projects', file: 'skillsphere-Projects.csv', columns: ['projectId', 'employeeId', 'projectName', 'role', 'startDate', 'endDate', 'status', 'description', 'duration', 'projectManager', 'accountExecutiveManager', 'lineManagerPOC', 'projectOrchestrator', 'addedByManager'] },
    { entity: 'skillsphere.Profiles', file: 'skillsphere-Profiles.csv', columns: ['employeeId', 'specialization', 'role', 'location', 'tLevel', 'gradeLevel', 'lastUpdated'] },
    { entity: 'skillsphere.CurrentProjects', file: 'skillsphere-CurrentProjects.csv', columns: ['currentProjectId', 'employeeId', 'projectName', 'projectManager', 'startDate', 'endDate', 'hoursPerDay', 'createdAt', 'lastUpdated'] },
    { entity: 'skillsphere.Initiatives', file: 'skillsphere-Initiatives.csv', columns: ['initiativeId', 'employeeId', 'initiativeName', 'description', 'startDate', 'endDate', 'hoursPerDay', 'status', 'type', 'createdAt', 'lastUpdated'] },
    { entity: 'skillsphere.CAIAUtilization', file: 'skillsphere-CAIAUtilization.csv', columns: ['caiaId', 'employeeId', 'taskName', 'startDate', 'endDate', 'hoursPerDay', 'createdAt', 'lastUpdated'] },
    { entity: 'skillsphere.POCUtilization', file: 'skillsphere-POCUtilization.csv', columns: ['pocId', 'employeeId', 'pocTitle', 'startDate', 'endDate', 'hoursPerDay', 'createdAt', 'lastUpdated'] },
    { entity: 'skillsphere.Certifications', file: 'skillsphere-Certifications.csv', columns: ['certificationId', 'employeeId', 'name', 'code', 'dateOfCompletion', 'description', 'level', 'createdAt', 'lastUpdated'] }
];

// Function to escape CSV fields
function escapeCSV(value) {
    if (value === null || value === undefined) {
        return '';
    }
    const stringValue = String(value);
    // If the value contains comma, newline, or double quote, wrap it in quotes
    if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
        return '"' + stringValue.replace(/"/g, '""') + '"';
    }
    return stringValue;
}

// Function to export an entity to CSV
async function exportEntityToCSV(db, entityConfig) {
    const { entity, file, columns } = entityConfig;
    const csvPath = path.join(csvDir, file);

    console.log(`\n📊 Exporting ${entity}...`);

    try {
        // Query all data from the entity
        const rows = await db.run(SELECT.from(entity));

        if (!rows || rows.length === 0) {
            console.log(`⚠️  Entity ${entity} is empty, skipping...`);
            return;
        }

        // Create CSV header
        const header = columns.join(',');
        
        // Create CSV rows
        const csvRows = rows.map(row => {
            return columns.map(col => escapeCSV(row[col])).join(',');
        });

        // Combine header and rows
        const csvContent = [header, ...csvRows].join('\n');

        // Write to file
        fs.writeFileSync(csvPath, csvContent, 'utf8');
        console.log(`✅ Exported ${rows.length} rows to ${file}`);

    } catch (error) {
        console.error(`❌ Error exporting ${entity}:`, error.message);
        throw error;
    }
}

// Main export function
async function exportAll() {
    console.log('🚀 Starting database export to CSV...\n');
    
    try {
        // Connect to database
        const db = await cds.connect.to('db');
        console.log('✅ Connected to database\n');

        // Export all entities
        for (const entityConfig of entityMappings) {
            await exportEntityToCSV(db, entityConfig);
        }
        
        console.log('\n✅ All entities exported successfully!');
        console.log(`📁 CSV files are in: ${csvDir}`);
        
    } catch (error) {
        console.error('\n❌ Export failed:', error.message);
        process.exit(1);
    }
}

// Run the export
exportAll();
