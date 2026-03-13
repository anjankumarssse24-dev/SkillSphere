/**
 * CSV Parser Utility
 * Converts CSV text to JSON arrays for SkillSphere data models
 */

export class CSVParser {
    /**
     * Parse CSV text into JSON array
     * Assumes first row is header
     */
    static parseCSV(csvText: string): any[] {
        try {
            // Remove BOM if present (UTF-8 BOM is \ufeff)
            let cleanText = csvText;
            if (csvText.charCodeAt(0) === 0xFEFF) {
                cleanText = csvText.slice(1);
            }
            
            const lines = cleanText.trim().split('\n');
            if (lines.length < 2) {
                console.warn('CSV file is empty or has no data rows');
                return [];
            }

            // Parse header - remove carriage returns
            const headerLine = lines[0].replace(/\r/g, '');
            let headers = this.parseCSVLine(headerLine);
            // Normalize headers: remove BOM, trim whitespace, and normalize common variants
            headers = headers.map((h: string) => {
                if (!h) return h;
                // Remove any leading BOM or zero-width chars and trim
                return h.replace(/^[\uFEFF\u200B\s]+|[\u200B\s]+$/g, '').trim();
            });

            // Parse data rows
            const data: any[] = [];
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].replace(/\r/g, '').trim();
                if (!line) continue; // Skip empty lines

                const values = this.parseCSVLine(line);
                const row: any = {};

                headers.forEach((header, index) => {
                    row[header] = values[index] || '';
                });

                data.push(row);
            }

            return data;
        } catch (error) {
            console.error('Error parsing CSV:', error);
            return [];
        }
    }

    /**
     * Parse a single CSV line handling quoted values
     */
    private static parseCSVLine(line: string): string[] {
        const result: string[] = [];
        let current = '';
        let insideQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];

            if (char === '"') {
                if (insideQuotes && nextChar === '"') {
                    // Escaped quote
                    current += '"';
                    i++; // Skip next quote
                } else {
                    // Toggle quote state
                    insideQuotes = !insideQuotes;
                }
            } else if (char === ',' && !insideQuotes) {
                // Field separator
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }

        // Add last field
        result.push(current.trim());
        return result;
    }

    /**
     * Convert CSV data to skills format
     */
    static parseSkillsCSV(csvData: any[]): any[] {
        return csvData.map((row: any) => ({
            id: row.skillId || '',
            skillName: row.skillName || '',
            category: row.category || '',
            employeeId: row.employeeId || '',
            proficiencyLevel: row.proficiencyLevel || 'Beginner',
            yearsExperience: parseInt(row.yearsExperience) || 0,
            certificationStatus: row.certificationStatus || 'None'
        }));
    }

    /**
     * Convert CSV data to employees format
     */
    static parseEmployeesCSV(csvData: any[]): any[] {
        return csvData.map((row: any) => ({
            id: row.id || '',
            name: row.name || '',
            team: row.team || '',
            subTeam: row.subTeam || '',
            manager: row.manager || '',
            email: row.email || `${row.id}@company.com`,
            totalSkills: parseInt(row.totalSkills) || 0,
            totalProjects: parseInt(row.totalProjects) || 0,
            specialization: row.specialization || row.name || '',
            working_on_project: row.working_on_project === 'true' || row.working_on_project === '1'
        }));
    }

    /**
     * Convert CSV data to users format
     */
    static parseUsersCSV(csvData: any[]): any[] {
        // Robust mapping to handle header variants and hidden characters (BOM)
        return csvData.map((row: any) => {
            const keys = Object.keys(row || {});
            // Try common variants for id
            const idCandidates = ['id', 'ID', 'Id', '\uFEFFid', keys[0]];
            let id = '';
            for (const k of idCandidates) {
                if (k && row[k]) { id = row[k]; break; }
            }

            return {
                id: id || '',
                name: row.name || row.Name || '',
                password: row.password || row.Password || '',
                role: row.role || row.Role || 'Employee',
                team: row.team || row.Team || '',
                subTeam: row.subTeam || row.SubTeam || row.subteam || '',
                manager: row.manager || row.Manager || '',
                email: row.email || row.Email || ''
            };
        });
    }

    /**
     * Convert CSV data to projects format
     */
    static parseProjectsCSV(csvData: any[]): any[] {
        return csvData.map((row: any) => ({
            id: row.id || '',
            name: row.name || '',
            description: row.description || '',
            status: row.status || 'Active',
            teamLead: row.teamLead || '',
            startDate: row.startDate || '',
            endDate: row.endDate || ''
        }));
    }
}
