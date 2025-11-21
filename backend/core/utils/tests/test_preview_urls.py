import pytest
from core.utils.preview_urls import get_proxy_preview_url, get_vnc_preview_url, get_website_preview_url
from core.utils.config import config

def test_get_proxy_preview_url_basic():
    """Test basic proxy URL generation."""
    # Mock config.WEBHOOK_BASE_URL
    original_url = config.WEBHOOK_BASE_URL
    config.WEBHOOK_BASE_URL = "https://test.com"
    
    try:
        url = get_proxy_preview_url("sandbox-123", 8080)
        assert url == "https://test.com/api/sandboxes/sandbox-123/proxy/8080"
    finally:
        config.WEBHOOK_BASE_URL = original_url

def test_get_proxy_preview_url_with_path():
    """Test proxy URL generation with path."""
    original_url = config.WEBHOOK_BASE_URL
    config.WEBHOOK_BASE_URL = "https://test.com"
    
    try:
        # Path without leading slash
        url = get_proxy_preview_url("sandbox-123", 8080, "index.html")
        assert url == "https://test.com/api/sandboxes/sandbox-123/proxy/8080/index.html"
        
        # Path with leading slash
        url = get_proxy_preview_url("sandbox-123", 8080, "/index.html")
        assert url == "https://test.com/api/sandboxes/sandbox-123/proxy/8080/index.html"
    finally:
        config.WEBHOOK_BASE_URL = original_url

def test_get_proxy_preview_url_fallback():
    """Test fallback when WEBHOOK_BASE_URL is not set."""
    original_url = config.WEBHOOK_BASE_URL
    config.WEBHOOK_BASE_URL = None
    
    try:
        url = get_proxy_preview_url("sandbox-123", 8080)
        assert url == "http://localhost:8000/api/sandboxes/sandbox-123/proxy/8080"
    finally:
        config.WEBHOOK_BASE_URL = original_url

def test_get_vnc_preview_url():
    """Test VNC preview URL helper."""
    original_url = config.WEBHOOK_BASE_URL
    config.WEBHOOK_BASE_URL = "https://test.com"
    
    try:
        url = get_vnc_preview_url("sandbox-123")
        assert url == "https://test.com/api/sandboxes/sandbox-123/proxy/6080"
    finally:
        config.WEBHOOK_BASE_URL = original_url

def test_get_website_preview_url():
    """Test website preview URL helper."""
    original_url = config.WEBHOOK_BASE_URL
    config.WEBHOOK_BASE_URL = "https://test.com"
    
    try:
        url = get_website_preview_url("sandbox-123")
        assert url == "https://test.com/api/sandboxes/sandbox-123/proxy/8080"
    finally:
        config.WEBHOOK_BASE_URL = original_url
