# Nagios Monitoring System - Production Ready

Production-ready Nagios monitoring with MySQL/RDS persistence, modern web GUI, and Docker deployment.

## Features

- **MySQL/RDS Database** - Persistent storage for hosts and services
- **Modern Web GUI** - Simple interface with bulk service selection via checkboxes
- **REST API** - Full CRUD operations with validation
- **Auto-sync** - Database automatically syncs to Nagios configuration
- **Production Ready** - Error handling, validation, redundancy

## Quick Start

### Local Testing (with Docker Compose)

```bash
# Start with MySQL and Nagios on same server
docker-compose up -d

# Access
# Web GUI: http://localhost/
# API: http://localhost:8080/api/health
```

### Production Deployment

**Choose one of the following deployment options:**

- **Option A:** MySQL and Nagios on the same server (recommended for single-server deployments)
- **Option B:** Nagios with external RDS (recommended for production with high availability)

#### Option A: MySQL and Nagios on Same Server

**1. Build Docker Images:**

```bash
# Build server image
cd nagios-server
docker build -t nagios-server:latest .
cd ..
```

**2. Run MySQL and Nagios Server Together:**

**Using Script (Recommended):**
```bash
./RUN_SERVER_WITH_MYSQL.sh [DB_ROOT_PASS] [DB_USER] [DB_PASS] [DB_NAME]

# Example with default values:
./RUN_SERVER_WITH_MYSQL.sh

# Example with custom values:
./RUN_SERVER_WITH_MYSQL.sh SecureRootPass123! nagios_user SecurePass123! nagios_db
```

**Manual Commands:**
```bash
# 1. Create network
docker network create nagios-network

# 2. Start MySQL
docker run -d \
  --name nagios-mysql \
  --restart unless-stopped \
  -p 3306:3306 \
  -v nagios-mysql-data:/var/lib/mysql \
  -v $(pwd)/nagios-server/db/init.sql:/docker-entrypoint-initdb.d/init.sql \
  -e MYSQL_ROOT_PASSWORD=nagios_root_pass \
  -e MYSQL_DATABASE=nagios_db \
  -e MYSQL_USER=nagios_user \
  -e MYSQL_PASSWORD=nagios_pass \
  --network nagios-network \
  mysql:8.0

# Wait for MySQL to be ready (about 30 seconds)
sleep 30

# 3. Start Nagios Server
docker run -d \
  --name nagios-server \
  --restart unless-stopped \
  -p 80:80 \
  -p 443:443 \
  -p 8080:8080 \
  -p 5666:5666 \
  -v nagios-config:/usr/local/nagios/etc \
  -v nagios-var:/usr/local/nagios/var \
  -v nagios-logs:/var/log/supervisor \
  -e NAGIOS_TIMEZONE=UTC \
  -e NAGIOSADMIN_USER=nagiosadmin \
  -e NAGIOSADMIN_PASS=nagiosadmin \
  -e DB_HOST=nagios-mysql \
  -e DB_PORT=3306 \
  -e DB_NAME=nagios_db \
  -e DB_USER=nagios_user \
  -e DB_PASS=nagios_pass \
  --network nagios-network \
  nagios-server:latest
```

**Access Points:**
- Web GUI: `http://<server-ip>/`
- API: `http://<server-ip>:8080/api/health`
- MySQL: `localhost:3306`
- NRPE Port: `5666`

#### Option B: Nagios with External RDS

**1. Build Docker Images:**

**Build Server Image:**
```bash
cd nagios-server
docker build -t nagios-server:latest .
cd ..
```

**Build Client Image:**
```bash
cd nagios-nrpe-agent
docker build -t nagios-nrpe-agent:latest .
cd ..
```

**2. Initialize RDS Database**

**Important:** Before running the server, initialize the database schema on your RDS instance:

```bash
# Import schema to RDS
mysql -h your-rds-endpoint.region.rds.amazonaws.com -u nagios_user -p nagios_db < nagios-server/db/init.sql
```

**3. Run Nagios Server (with RDS)

**Using Script (Recommended):**
```bash
./RUN_SERVER.sh <RDS_ENDPOINT> <DB_USER> <DB_PASS> <DB_NAME> <DB_PORT>

# Example:
./RUN_SERVER.sh my-rds.region.rds.amazonaws.com nagios_user SecurePass123! nagios_db 3306
```

**Manual Command:**
```bash
docker run -d \
  --name nagios-server \
  --restart unless-stopped \
  -p 80:80 \
  -p 443:443 \
  -p 8080:8080 \
  -p 5666:5666 \
  -v nagios-config:/usr/local/nagios/etc \
  -v nagios-var:/usr/local/nagios/var \
  -v nagios-logs:/var/log/supervisor \
  -e DB_HOST=your-rds-endpoint.region.rds.amazonaws.com \
  -e DB_PORT=3306 \
  -e DB_NAME=nagios_db \
  -e DB_USER=nagios_user \
  -e DB_PASS=your_secure_password \
  -e NAGIOSADMIN_USER=nagiosadmin \
  -e NAGIOSADMIN_PASS=nagiosadmin \
  nagios-server:latest
```

**Access Points:**
- Web GUI: `http://<server-ip>/`
- API: `http://<server-ip>:8080/api/health`
- NRPE Port: `5666`

#### 4. Run Client on Monitored Servers

**Using Script (Recommended):**
```bash
./RUN_CLIENT.sh <NAGIOS_SERVER_IP> [HOSTNAME]

# Example:
./RUN_CLIENT.sh 10.0.1.100
# Or with custom hostname:
./RUN_CLIENT.sh 10.0.1.100 web-server-01
```

**Manual Command:**
```bash
docker run -d \
  --name nagios-client \
  --restart unless-stopped \
  --hostname $(hostname) \
  -p 5666:5666 \
  -v /proc:/host/proc:ro \
  -v /sys:/host/sys:ro \
  -v /:/host:ro \
  -e NAGIOS_SERVER_IP=<NAGIOS_SERVER_IP> \
  -e ALLOWED_HOSTS=<NAGIOS_SERVER_IP> \
  -e HOSTNAME=$(hostname) \
  nagios-nrpe-agent:latest
```

**Note:** The client will automatically register with the Nagios server when it starts.

#### 5. Run Client on Monitored Servers (Same for Both Options)

## Usage

### Add Host

1. Go to **Hosts** page
2. Click **+ Add Host**
3. Enter hostname, IP address, and alias
4. Click **Add Host**

### Add Multiple Services (Checkbox Selection)

1. Go to **Services** page
2. Click **+ Add Services**
3. Select a host
4. **Check multiple services** from the list
5. Click **Add Selected Services**

Available services: HTTP, HTTPS, Ping, SSH, Disk, Memory, Load, CPU, Processes, TCP Port

### Edit/Delete

Click **Edit** or **Delete** buttons next to any host or service.

## API Endpoints

- `GET /api/health` - Health check
- `GET /api/hosts` - List hosts
- `POST /api/hosts` - Add host
- `PUT /api/hosts/:hostname` - Update host
- `DELETE /api/hosts/:hostname` - Delete host
- `GET /api/services` - List services
- `POST /api/services` - Add service(s) - supports array
- `PUT /api/services/:id` - Update service
- `DELETE /api/services/:id` - Delete service
- `GET /api/templates` - Get service templates
- `GET /api/status` - Get monitoring status

## RDS Setup

### 1. Create RDS MySQL Instance

- Engine: MySQL 8.0
- Instance class: db.t3.micro (minimum)
- Storage: 20GB (minimum)
- Enable public access if needed
- Create security group allowing port 3306 from Nagios server

### 2. Initialize Database

```bash
# Connect to RDS
mysql -h your-rds-endpoint.region.rds.amazonaws.com -u admin -p

# Create database and user
CREATE DATABASE nagios_db;
CREATE USER 'nagios_user'@'%' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON nagios_db.* TO 'nagios_user'@'%';
FLUSH PRIVILEGES;

# Import schema
mysql -h your-rds-endpoint -u nagios_user -p nagios_db < nagios-server/db/init.sql
```

### 3. Run Nagios Server

See [Production Deployment](#production-deployment) section above for complete commands.

## Environment Variables

**Nagios Server:**
- `DB_HOST` - Database host (RDS endpoint or local MySQL)
- `DB_PORT` - Database port (default: 3306)
- `DB_NAME` - Database name (default: nagios_db)
- `DB_USER` - Database user
- `DB_PASS` - Database password
- `NAGIOSADMIN_USER` - Web GUI username (default: nagiosadmin)
- `NAGIOSADMIN_PASS` - Web GUI password (default: nagiosadmin)

**Nagios Client:**
- `NAGIOS_SERVER_IP` - Nagios server IP address
- `ALLOWED_HOSTS` - Allowed Nagios servers (IP or CIDR)
- `HOSTNAME` - Client hostname

## Production Checklist

- [ ] Change default passwords
- [ ] Use RDS for database
- [ ] Configure HTTPS/SSL
- [ ] Set up firewall rules
- [ ] Configure email notifications
- [ ] Set up RDS backups
- [ ] Monitor disk space
- [ ] Review security groups
- [ ] Test disaster recovery

## Troubleshooting

### Check Logs
```bash
docker logs nagios-server
docker logs nagios-client
```

### Test API
```bash
curl http://localhost:8080/api/health
```

### Verify Database Connection
```bash
docker exec nagios-server curl http://localhost:8080/api/health
# Should show: {"status":"ok","database":"connected"}
```

### Restart Services
```bash
docker restart nagios-server
docker restart nagios-client
```

### Check Container Status
```bash
docker ps | grep nagios
docker logs -f nagios-server
docker logs -f nagios-client
```

### Stop/Remove Containers
```bash
# Stop containers
docker stop nagios-server
docker stop nagios-client

# Remove containers
docker rm -f nagios-server
docker rm -f nagios-client
```

## File Structure

```
Nagios/
├── nagios-server/          # Server Docker image
│   ├── Dockerfile
│   ├── api/               # REST API
│   ├── webapp/            # Web GUI
│   ├── db/                # Database schema
│   └── config/            # Nagios configs
├── nagios-nrpe-agent/     # Client Docker image
│   ├── Dockerfile
│   └── entrypoint.sh
├── docker-compose.yml          # Local testing (MySQL + Nagios)
├── RUN_SERVER.sh               # Production server with RDS
├── RUN_SERVER_WITH_MYSQL.sh    # Production server with local MySQL
├── RUN_CLIENT.sh               # Production client run
└── README.md
```

## License

MIT License
