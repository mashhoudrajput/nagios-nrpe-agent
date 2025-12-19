#!/bin/bash

# Apache configuration for the web GUI
cat > /etc/apache2/sites-available/nagios-gui.conf <<'EOF'
<VirtualHost *:80>
    ServerAdmin admin@localhost
    DocumentRoot /var/www/nagios-gui

    # Serve the modern GUI at root
    <Directory "/var/www/nagios-gui">
        Options Indexes FollowSymLinks
        AllowOverride None
        Require all granted
    </Directory>

    # Proxy API requests to Node.js backend
    ProxyPreserveHost On
    ProxyPass /api http://localhost:8080/api
    ProxyPassReverse /api http://localhost:8080/api

    ErrorLog ${APACHE_LOG_DIR}/nagios-gui-error.log
    CustomLog ${APACHE_LOG_DIR}/nagios-gui-access.log combined
</VirtualHost>
EOF

# Enable the site
a2ensite nagios-gui.conf

# Disable default site
a2dissite 000-default.conf

echo "Apache configuration for Web GUI created successfully"
