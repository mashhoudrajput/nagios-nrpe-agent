const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mysql = require('mysql2/promise');
const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');

const execPromise = util.promisify(exec);

const app = express();
const PORT = process.env.PORT || 8080;

// Database Configuration
const DB_CONFIG = {
    host: process.env.DB_HOST || 'mysql',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'nagios_user',
    password: process.env.DB_PASS || 'nagios_pass',
    database: process.env.DB_NAME || 'nagios_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    reconnect: true
};

// Create connection pool
let pool;

async function initDatabase() {
    try {
        pool = mysql.createPool(DB_CONFIG);
        // Test connection
        const connection = await pool.getConnection();
        console.log('✅ Database connected successfully');
        connection.release();
        return true;
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        // Retry after 5 seconds
        setTimeout(initDatabase, 5000);
        return false;
    }
}

// Nagios Configuration
const NAGIOS_HOME = '/usr/local/nagios';
const CONFIG_DIR = path.join(NAGIOS_HOME, 'etc');
const HOSTS_DIR = path.join(CONFIG_DIR, 'objects', 'hosts');
const SERVICES_DIR = path.join(CONFIG_DIR, 'objects', 'services');
const STATUS_FILE = path.join(NAGIOS_HOME, 'var', 'status.dat');
const MANAGE_SCRIPT = '/opt/scripts/manage_nagios.sh';

// Middleware
app.use(helmet({
    contentSecurityPolicy: false,
}));
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('combined'));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000
});
app.use('/api/', limiter);

// Helper Functions
async function executeCommand(command) {
    try {
        const { stdout, stderr } = await execPromise(command);
        return { success: true, stdout, stderr };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function syncToNagiosConfig() {
    try {
        // Sync hosts from database to Nagios config files
        const [hosts] = await pool.execute(
            'SELECT * FROM hosts WHERE enabled = TRUE'
        );
        
        // Clear existing config files
        await fs.ensureDir(HOSTS_DIR);
        await fs.ensureDir(SERVICES_DIR);
        
        // Write host configs
        for (const host of hosts) {
            const hostFile = path.join(HOSTS_DIR, `${host.hostname}.cfg`);
            const hostContent = `define host {
    use                     linux-server
    host_name               ${host.hostname}
    alias                   ${host.alias || host.hostname}
    address                 ${host.ip_address}
    max_check_attempts      ${host.max_check_attempts}
    check_interval          ${host.check_interval}
    retry_interval          ${host.retry_interval}
    check_period            ${host.check_period}
    notification_interval   ${host.notification_interval}
    notification_period     ${host.notification_period}
}
`;
            await fs.writeFile(hostFile, hostContent);
            await fs.chown(hostFile, 1000, 1000);
        }
        
        // Sync services from database to Nagios config files
        const [services] = await pool.execute(
            'SELECT s.* FROM services s INNER JOIN hosts h ON s.hostname = h.hostname WHERE s.enabled = TRUE AND h.enabled = TRUE'
        );
        
        for (const service of services) {
            const serviceFile = path.join(SERVICES_DIR, `${service.hostname}_${service.service_name.replace(/\s+/g, '_')}.cfg`);
            const serviceContent = `define service {
    use                     generic-service
    host_name               ${service.hostname}
    service_description     ${service.service_name}
    check_command           ${service.check_command}
    max_check_attempts      ${service.max_check_attempts}
    check_interval           ${service.check_interval}
    retry_interval           ${service.retry_interval}
    check_period            ${service.check_period}
    notification_interval   ${service.notification_interval}
    notification_period     ${service.notification_period}
}
`;
            await fs.writeFile(serviceFile, serviceContent);
            await fs.chown(serviceFile, 1000, 1000);
        }
        
        // Reload Nagios
        await executeCommand(`${MANAGE_SCRIPT} reload`);
        return { success: true };
    } catch (error) {
        console.error('Error syncing to Nagios config:', error);
        return { success: false, error: error.message };
    }
}

function parseStatusFile() {
    try {
        if (!fs.existsSync(STATUS_FILE)) {
            return { hosts: [], services: [] };
        }
        
        const content = fs.readFileSync(STATUS_FILE, 'utf8');
        const hosts = [];
        const services = [];
        
        const hostMatches = content.match(/hoststatus \{[^}]+\}/g) || [];
        const serviceMatches = content.match(/servicestatus \{[^}]+\}/g) || [];
        
        hostMatches.forEach(match => {
            const nameMatch = match.match(/host_name=([^\n]+)/);
            const statusMatch = match.match(/current_state=(\d+)/);
            if (nameMatch && statusMatch) {
                hosts.push({
                    name: nameMatch[1].trim(),
                    status: parseInt(statusMatch[1])
                });
            }
        });
        
        serviceMatches.forEach(match => {
            const hostMatch = match.match(/host_name=([^\n]+)/);
            const serviceMatch = match.match(/service_description=([^\n]+)/);
            const statusMatch = match.match(/current_state=(\d+)/);
            if (hostMatch && serviceMatch && statusMatch) {
                services.push({
                    host: hostMatch[1].trim(),
                    service: serviceMatch[1].trim(),
                    status: parseInt(statusMatch[1])
                });
            }
        });
        
        return { hosts, services };
    } catch (error) {
        console.error('Error parsing status file:', error);
        return { hosts: [], services: [] };
    }
}

// API Routes

// Health check
app.get('/api/health', async (req, res) => {
    try {
        if (!pool) {
            return res.status(503).json({ status: 'error', message: 'Database not connected' });
        }
        await pool.execute('SELECT 1');
        res.json({ status: 'ok', timestamp: new Date().toISOString(), database: 'connected' });
    } catch (error) {
        res.status(503).json({ status: 'error', message: error.message });
    }
});

// Get all hosts
app.get('/api/hosts', async (req, res) => {
    try {
        const [rows] = await pool.execute(
            'SELECT * FROM hosts ORDER BY created_at DESC'
        );
        res.json(rows);
    } catch (error) {
        console.error('Error fetching hosts:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get single host
app.get('/api/hosts/:hostname', async (req, res) => {
    try {
        const { hostname } = req.params;
        const [rows] = await pool.execute(
            'SELECT * FROM hosts WHERE hostname = ?',
            [hostname]
        );
        
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Host not found' });
        }
        
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add new host
app.post('/api/hosts', async (req, res) => {
    try {
        const { hostname, ip_address, alias, max_check_attempts, check_interval, retry_interval } = req.body;
        
        if (!hostname || !ip_address) {
            return res.status(400).json({ error: 'Hostname and IP address are required' });
        }
        
        // Validate IP address format
        const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        if (!ipRegex.test(ip_address)) {
            return res.status(400).json({ error: 'Invalid IP address format' });
        }
        
        await pool.execute(
            `INSERT INTO hosts (hostname, ip_address, alias, max_check_attempts, check_interval, retry_interval)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
             ip_address = VALUES(ip_address),
             alias = VALUES(alias),
             max_check_attempts = VALUES(max_check_attempts),
             check_interval = VALUES(check_interval),
             retry_interval = VALUES(retry_interval)`,
            [
                hostname,
                ip_address,
                alias || hostname,
                max_check_attempts || 5,
                check_interval || 5,
                retry_interval || 1
            ]
        );
        
        await syncToNagiosConfig();
        res.json({ success: true, message: `Host ${hostname} added successfully` });
    } catch (error) {
        console.error('Error adding host:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update host
app.put('/api/hosts/:hostname', async (req, res) => {
    try {
        const { hostname } = req.params;
        const { ip_address, alias, max_check_attempts, check_interval, retry_interval } = req.body;
        
        const updateFields = [];
        const updateValues = [];
        
        if (ip_address) {
            const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
            if (!ipRegex.test(ip_address)) {
                return res.status(400).json({ error: 'Invalid IP address format' });
            }
            updateFields.push('ip_address = ?');
            updateValues.push(ip_address);
        }
        
        if (alias !== undefined) {
            updateFields.push('alias = ?');
            updateValues.push(alias);
        }
        if (max_check_attempts !== undefined) {
            updateFields.push('max_check_attempts = ?');
            updateValues.push(max_check_attempts);
        }
        if (check_interval !== undefined) {
            updateFields.push('check_interval = ?');
            updateValues.push(check_interval);
        }
        if (retry_interval !== undefined) {
            updateFields.push('retry_interval = ?');
            updateValues.push(retry_interval);
        }
        
        if (updateFields.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }
        
        updateValues.push(hostname);
        
        await pool.execute(
            `UPDATE hosts SET ${updateFields.join(', ')} WHERE hostname = ?`,
            updateValues
        );
        
        await syncToNagiosConfig();
        res.json({ success: true, message: 'Host updated successfully' });
    } catch (error) {
        console.error('Error updating host:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete host
app.delete('/api/hosts/:hostname', async (req, res) => {
    try {
        const { hostname } = req.params;
        
        const [result] = await pool.execute(
            'DELETE FROM hosts WHERE hostname = ?',
            [hostname]
        );
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Host not found' });
        }
        
        await syncToNagiosConfig();
        res.json({ success: true, message: `Host ${hostname} deleted successfully` });
    } catch (error) {
        console.error('Error deleting host:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get all services
app.get('/api/services', async (req, res) => {
    try {
        const { hostname } = req.query;
        let query = 'SELECT * FROM services';
        const params = [];
        
        if (hostname) {
            query += ' WHERE hostname = ?';
            params.push(hostname);
        }
        
        query += ' ORDER BY created_at DESC';
        
        const [rows] = await pool.execute(query, params);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching services:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get single service
app.get('/api/services/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.execute(
            'SELECT * FROM services WHERE id = ?',
            [id]
        );
        
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Service not found' });
        }
        
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add new service(s) - supports bulk insert
app.post('/api/services', async (req, res) => {
    try {
        const services = Array.isArray(req.body) ? req.body : [req.body];
        const errors = [];
        const success = [];
        
        for (const service of services) {
            const { hostname, service_name, check_command, max_check_attempts, check_interval, retry_interval } = service;
            
            if (!hostname || !service_name || !check_command) {
                errors.push({ service, error: 'Hostname, service name, and check command are required' });
                continue;
            }
            
            // Verify host exists
            const [hosts] = await pool.execute('SELECT hostname FROM hosts WHERE hostname = ?', [hostname]);
            if (hosts.length === 0) {
                errors.push({ service, error: `Host ${hostname} does not exist` });
                continue;
            }
            
            try {
                await pool.execute(
                    `INSERT INTO services (hostname, service_name, check_command, max_check_attempts, check_interval, retry_interval)
                     VALUES (?, ?, ?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE
                     check_command = VALUES(check_command),
                     max_check_attempts = VALUES(max_check_attempts),
                     check_interval = VALUES(check_interval),
                     retry_interval = VALUES(retry_interval)`,
                    [
                        hostname,
                        service_name,
                        check_command,
                        max_check_attempts || 4,
                        check_interval || 5,
                        retry_interval || 1
                    ]
                );
                success.push({ hostname, service_name });
            } catch (error) {
                errors.push({ service, error: error.message });
            }
        }
        
        if (success.length > 0) {
            await syncToNagiosConfig();
        }
        
        res.json({
            success: success.length > 0,
            added: success.length,
            errors: errors.length,
            details: { success, errors }
        });
    } catch (error) {
        console.error('Error adding services:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update service
app.put('/api/services/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { service_name, check_command, max_check_attempts, check_interval, retry_interval } = req.body;
        
        const updateFields = [];
        const updateValues = [];
        
        if (service_name) {
            updateFields.push('service_name = ?');
            updateValues.push(service_name);
        }
        if (check_command) {
            updateFields.push('check_command = ?');
            updateValues.push(check_command);
        }
        if (max_check_attempts !== undefined) {
            updateFields.push('max_check_attempts = ?');
            updateValues.push(max_check_attempts);
        }
        if (check_interval !== undefined) {
            updateFields.push('check_interval = ?');
            updateValues.push(check_interval);
        }
        if (retry_interval !== undefined) {
            updateFields.push('retry_interval = ?');
            updateValues.push(retry_interval);
        }
        
        if (updateFields.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }
        
        updateValues.push(id);
        
        const [result] = await pool.execute(
            `UPDATE services SET ${updateFields.join(', ')} WHERE id = ?`,
            updateValues
        );
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Service not found' });
        }
        
        await syncToNagiosConfig();
        res.json({ success: true, message: 'Service updated successfully' });
    } catch (error) {
        console.error('Error updating service:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete service
app.delete('/api/services/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const [result] = await pool.execute('DELETE FROM services WHERE id = ?', [id]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Service not found' });
        }
        
        await syncToNagiosConfig();
        res.json({ success: true, message: 'Service deleted successfully' });
    } catch (error) {
        console.error('Error deleting service:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get service templates
app.get('/api/templates', async (req, res) => {
    try {
        const [rows] = await pool.execute(
            'SELECT * FROM service_templates WHERE enabled = TRUE ORDER BY template_name'
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get available check commands
app.get('/api/commands', async (req, res) => {
    try {
        const [templates] = await pool.execute(
            'SELECT template_name as name, check_command, description FROM service_templates WHERE enabled = TRUE'
        );
        
        const commands = templates.map(t => ({
            name: t.check_command,
            description: t.description || t.template_name
        }));
        
        res.json(commands);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get monitoring status
app.get('/api/status', async (req, res) => {
    try {
        const status = parseStatusFile();
        res.json(status);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Reload Nagios configuration
app.post('/api/reload', async (req, res) => {
    try {
        const result = await syncToNagiosConfig();
        
        if (result.success) {
            res.json({ success: true, message: 'Nagios configuration reloaded' });
        } else {
            res.status(500).json({ success: false, error: result.error });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
async function startServer() {
    await initDatabase();
    
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`✅ Nagios API server running on port ${PORT}`);
        console.log(`📊 Database: ${DB_CONFIG.host}:${DB_CONFIG.port}/${DB_CONFIG.database}`);
    });
}

startServer().catch(console.error);
