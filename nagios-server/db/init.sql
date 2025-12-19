-- Nagios Database Schema
-- Production-ready database structure

CREATE DATABASE IF NOT EXISTS nagios_db;
USE nagios_db;

-- Hosts table
CREATE TABLE IF NOT EXISTS hosts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    hostname VARCHAR(255) NOT NULL UNIQUE,
    ip_address VARCHAR(45) NOT NULL,
    alias VARCHAR(255),
    max_check_attempts INT DEFAULT 5,
    check_interval INT DEFAULT 5,
    retry_interval INT DEFAULT 1,
    check_period VARCHAR(50) DEFAULT '24x7',
    notification_interval INT DEFAULT 30,
    notification_period VARCHAR(50) DEFAULT '24x7',
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_hostname (hostname),
    INDEX idx_enabled (enabled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Services table
CREATE TABLE IF NOT EXISTS services (
    id INT AUTO_INCREMENT PRIMARY KEY,
    hostname VARCHAR(255) NOT NULL,
    service_name VARCHAR(255) NOT NULL,
    check_command VARCHAR(255) NOT NULL,
    max_check_attempts INT DEFAULT 4,
    check_interval INT DEFAULT 5,
    retry_interval INT DEFAULT 1,
    check_period VARCHAR(50) DEFAULT '24x7',
    notification_interval INT DEFAULT 30,
    notification_period VARCHAR(50) DEFAULT '24x7',
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_service (hostname, service_name),
    INDEX idx_hostname (hostname),
    INDEX idx_enabled (enabled),
    FOREIGN KEY (hostname) REFERENCES hosts(hostname) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Service templates for quick selection
CREATE TABLE IF NOT EXISTS service_templates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    template_name VARCHAR(255) NOT NULL UNIQUE,
    check_command VARCHAR(255) NOT NULL,
    description TEXT,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default service templates
INSERT INTO service_templates (template_name, check_command, description) VALUES
('HTTP Check', 'check_http', 'Check HTTP service availability'),
('HTTPS Check', 'check_http!-S', 'Check HTTPS service availability'),
('Ping Check', 'check_ping', 'Check host reachability via ping'),
('SSH Check', 'check_ssh', 'Check SSH service availability'),
('Disk Usage', 'check_nrpe!check_disk', 'Check disk space usage'),
('Memory Usage', 'check_nrpe!check_mem', 'Check memory usage'),
('System Load', 'check_nrpe!check_load', 'Check system load average'),
('CPU Usage', 'check_nrpe!check_load', 'Check CPU usage'),
('Process Count', 'check_nrpe!check_procs', 'Check running processes'),
('TCP Port', 'check_tcp', 'Check TCP port connectivity')
ON DUPLICATE KEY UPDATE template_name=template_name;

