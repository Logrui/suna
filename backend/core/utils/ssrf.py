"""SSRF (Server-Side Request Forgery) protection utilities.

Extracted as a standalone module to avoid circular imports — this module
has no dependencies on the MCP module chain.
"""

import ipaddress
import socket
from urllib.parse import urlparse
from core.utils.logger import logger


# Blocked hostnames
BLOCKED_HOSTNAMES = {
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '::1',
    'metadata.google.internal',
    'metadata.goog',
    '169.254.169.254',  # AWS/GCP metadata service
    'metadata.azure.com',
    'kubernetes.default.svc',
}

# Private IP ranges that should be blocked
PRIVATE_IP_RANGES = [
    ipaddress.ip_network('10.0.0.0/8'),
    ipaddress.ip_network('172.16.0.0/12'),
    ipaddress.ip_network('192.168.0.0/16'),
    ipaddress.ip_network('127.0.0.0/8'),
    ipaddress.ip_network('169.254.0.0/16'),  # Link-local
    ipaddress.ip_network('::1/128'),          # IPv6 loopback
    ipaddress.ip_network('fc00::/7'),         # IPv6 private
    ipaddress.ip_network('fe80::/10'),        # IPv6 link-local
]


def is_safe_url(url: str) -> tuple[bool, str]:
    """
    Validate URL to prevent SSRF attacks.

    Returns:
        tuple: (is_safe: bool, error_message: str)
    """
    try:
        parsed = urlparse(url)

        # Only allow http and https
        if parsed.scheme not in ('http', 'https'):
            return False, f"Invalid URL scheme: {parsed.scheme}. Only http/https allowed."

        hostname = parsed.hostname
        if not hostname:
            return False, "Invalid URL: no hostname"

        # Check against blocked hostnames
        hostname_lower = hostname.lower()
        if hostname_lower in BLOCKED_HOSTNAMES:
            logger.warning(f"SSRF blocked: attempt to connect to blocked hostname {hostname}")
            return False, "Connection to this host is not allowed"

        # Try to resolve hostname and check IP
        try:
            addr_infos = socket.getaddrinfo(hostname, None, socket.AF_UNSPEC, socket.SOCK_STREAM)

            for family, _, _, _, sockaddr in addr_infos:
                ip_str = sockaddr[0]
                try:
                    ip = ipaddress.ip_address(ip_str)

                    for private_range in PRIVATE_IP_RANGES:
                        if ip in private_range:
                            logger.warning(f"SSRF blocked: {hostname} resolves to private IP {ip_str}")
                            return False, "Connection to private/internal networks is not allowed"

                except ValueError:
                    continue

        except socket.gaierror:
            logger.debug(f"DNS resolution failed for {hostname}, allowing connection")
            pass

        return True, ""

    except Exception as e:
        logger.error(f"URL validation error: {str(e)}")
        return False, "Invalid URL format"
