/**
 * CSV Writer Service
 * Handles reading and writing CSV files with proper formatting
 */

const fs = require('fs').promises;
const path = require('path');

class CSVWriter {
    constructor(dataDir) {
        this.dataDir = dataDir || path.join(__dirname, '../webapp/data');
    }

    /**
     * Read CSV file and parse to array of objects
     */
    async readCSV(filename) {
        try {
            const filePath = path.join(this.dataDir, filename);
            const content = await fs.readFile(filePath, 'utf-8');
            
            // Remove BOM if present
            let cleanContent = content.charCodeAt(0) === 0xFEFF ? content.slice(1) : content;
            
            // Split into lines
            const lines = cleanContent.split('\n').filter(line => line.trim());
            if (lines.length === 0) return [];
            
            // Parse header
            const headers = lines[0].split(',').map(h => h.trim());
            
            // Parse rows
            const data = [];
            for (let i = 1; i < lines.length; i++) {
                const values = this.parseCSVLine(lines[i]);
                if (values.length === headers.length) {
                    const row = {};
                    headers.forEach((header, index) => {
                        row[header] = values[index];
                    });
                    data.push(row);
                }
            }
            
            return data;
        } catch (error) {
            console.error(`Error reading CSV file ${filename}:`, error);
            throw error;
        }
    }

    /**
     * Parse a single CSV line handling quoted values
     */
    parseCSVLine(line) {
        const values = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        
        values.push(current.trim());
        return values;
    }

    /**
     * Write array of objects to CSV file
     */
    async writeCSV(filename, data, headers) {
        try {
            if (!data || data.length === 0) {
                console.warn(`No data to write to ${filename}`);
                return;
            }
            
            const filePath = path.join(this.dataDir, filename);
            
            // Use provided headers or extract from first object
            const csvHeaders = headers || Object.keys(data[0]);
            
            console.log(`📊 Writing ${filename} with headers:`, csvHeaders);
            console.log(`📊 Last row data:`, data[data.length - 1]);
            
            // Build CSV content
            let csvContent = csvHeaders.join(',') + '\n';
            
            // Add data rows
            data.forEach((row, index) => {
                const values = csvHeaders.map(header => {
                    let value = row[header] !== undefined ? row[header] : '';
                    // Quote values that contain commas or quotes
                    if (String(value).includes(',') || String(value).includes('"')) {
                        value = `"${String(value).replace(/"/g, '""')}"`;
                    }
                    return value;
                });
                csvContent += values.join(',') + '\n';
                
                // Log the last row to debug
                if (index === data.length - 1) {
                    console.log(`📊 Last row CSV values:`, values);
                }
            });
            
            // Write to file
            await fs.writeFile(filePath, csvContent, 'utf-8');
            console.log(`CSV file ${filename} written successfully with ${data.length} rows`);
        } catch (error) {
            console.error(`Error writing CSV file ${filename}:`, error);
            throw error;
        }
    }

    /**
     * Add a new record to CSV file
     */
    async addRecord(filename, record, headers) {
        const data = await this.readCSV(filename);
        data.push(record);
        await this.writeCSV(filename, data, headers);
        return record;
    }

    /**
     * Update a record in CSV file by ID
     */
    async updateRecord(filename, id, updatedRecord, headers) {
        const data = await this.readCSV(filename);
        const index = data.findIndex(record => 
            record.id === id || 
            record.skillId === id || 
            record.projectId === id ||
            record.employeeId === id ||
            record.managerId === id
        );
        
        if (index === -1) {
            throw new Error(`Record with id ${id} not found in ${filename}`);
        }
        
        // Merge updated fields with existing record
        data[index] = { ...data[index], ...updatedRecord };
        await this.writeCSV(filename, data, headers);
        return data[index];
    }

    /**
     * Delete a record from CSV file by ID
     */
    async deleteRecord(filename, id, headers) {
        const data = await this.readCSV(filename);
        const filteredData = data.filter(record => 
            record.id !== id && 
            record.skillId !== id && 
            record.projectId !== id &&
            record.employeeId !== id &&
            record.managerId !== id
        );
        
        if (filteredData.length === data.length) {
            throw new Error(`Record with id ${id} not found in ${filename}`);
        }
        
        await this.writeCSV(filename, filteredData, headers);
        return { success: true, deletedId: id };
    }

    /**
     * Get all records from CSV file
     */
    async getRecords(filename) {
        return await this.readCSV(filename);
    }
}

module.exports = CSVWriter;
