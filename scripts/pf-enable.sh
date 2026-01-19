#!/bin/bash
# ポートフォワーディングを有効化（80→8080, 443→8443）

echo "rdr pass on lo0 inet proto tcp from any to 127.0.0.1 port 80 -> 127.0.0.1 port 8080
rdr pass on lo0 inet proto tcp from any to 127.0.0.1 port 443 -> 127.0.0.1 port 8443" | sudo pfctl -ef -

echo "Port forwarding enabled: 80→8080, 443→8443"
