"""
Test Script: Verify if networkAllowList works at Tier 1/2

This script creates a sandbox with a specific IP whitelisted,
then tests if connections to that IP work while others are blocked.

Run from: d:\Homelab\suna\backend
Command: python -m scripts.test_network_allowlist
"""

import asyncio
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from daytona_sdk import AsyncDaytona, DaytonaConfig, CreateSandboxFromSnapshotParams
from core.utils.config import config, Configuration
from core.utils.logger import logger


# Test IPs
# These are well-known IPs we can test connectivity to
TEST_ALLOWED_IP = "1.1.1.1"  # Cloudflare DNS - fast, reliable
TEST_BLOCKED_IP = "93.184.216.34"  # example.com - should be blocked


async def test_network_allowlist():
    """Test if networkAllowList works at current Daytona tier."""
    
    print("\n" + "="*60)
    print("  DAYTONA networkAllowList TEST")
    print("="*60)
    
    # Initialize Daytona client
    daytona_config = DaytonaConfig(
        api_key=config.DAYTONA_API_KEY,
        api_url=config.DAYTONA_SERVER_URL,
        target=config.DAYTONA_TARGET,
    )
    
    daytona = AsyncDaytona(daytona_config)
    
    print(f"\n📍 Daytona API URL: {config.DAYTONA_SERVER_URL}")
    print(f"📍 Daytona Target: {config.DAYTONA_TARGET}")
    
    sandbox = None
    
    try:
        # Step 1: Create sandbox WITH networkAllowList
        print(f"\n🔧 Creating sandbox with networkAllowList: {TEST_ALLOWED_IP}/32")
        
        params = CreateSandboxFromSnapshotParams(
            snapshot=Configuration.SANDBOX_SNAPSHOT_NAME,
            public=True,
            network_allow_list=f"{TEST_ALLOWED_IP}/32",  # <-- THE KEY PARAMETER
            env_vars={
                "TEST_MODE": "true"
            },
            auto_stop_interval=5,  # Short timeout for test
            auto_archive_interval=10,
        )
        
        sandbox = await daytona.create(params)
        print(f"✅ Sandbox created: {sandbox.id}")
        
        # Step 2: Wait for sandbox to be ready
        print("\n⏳ Waiting for sandbox to start...")
        await asyncio.sleep(5)
        
        # Step 3: Test connectivity to ALLOWED IP
        print(f"\n🌐 TEST 1: Connecting to WHITELISTED IP ({TEST_ALLOWED_IP})...")
        
        curl_allowed = f"curl -s -o /dev/null -w '%{{http_code}}' --connect-timeout 10 http://{TEST_ALLOWED_IP}"
        result1 = await sandbox.process.exec(curl_allowed, timeout=15)
        
        allowed_works = result1.exit_code == 0 and result1.result.strip() in ["200", "301", "302", "403"]
        
        if allowed_works:
            print(f"   ✅ SUCCESS: Connection to {TEST_ALLOWED_IP} worked! (HTTP {result1.result.strip()})")
        else:
            print(f"   ❌ FAILED: Could not connect to {TEST_ALLOWED_IP}")
            print(f"      Exit code: {result1.exit_code}")
            print(f"      Result: {result1.result}")
        
        # Step 4: Test connectivity to NON-WHITELISTED IP
        print(f"\n🌐 TEST 2: Connecting to NON-WHITELISTED IP ({TEST_BLOCKED_IP})...")
        
        curl_blocked = f"curl -s -o /dev/null -w '%{{http_code}}' --connect-timeout 10 http://{TEST_BLOCKED_IP}"
        result2 = await sandbox.process.exec(curl_blocked, timeout=15)
        
        blocked_works = result2.exit_code == 0 and result2.result.strip() in ["200", "301", "302"]
        
        if blocked_works:
            print(f"   ⚠️  UNEXPECTED: Connection to {TEST_BLOCKED_IP} ALSO worked!")
            print(f"      This means networkAllowList might not be enforced at your tier")
        else:
            print(f"   ✅ EXPECTED: Connection to {TEST_BLOCKED_IP} was blocked")
        
        # Step 5: Test connectivity to essential services (should always work)
        print(f"\n🌐 TEST 3: Connecting to ESSENTIAL SERVICE (github.com)...")
        
        curl_essential = "curl -s -o /dev/null -w '%{http_code}' --connect-timeout 10 https://github.com"
        result3 = await sandbox.process.exec(curl_essential, timeout=15)
        
        essential_works = result3.exit_code == 0 and result3.result.strip() in ["200", "301", "302"]
        
        if essential_works:
            print(f"   ✅ SUCCESS: github.com is accessible (essential service)")
        else:
            print(f"   ❌ UNEXPECTED: github.com should always work")
        
        # Step 6: Summary
        print("\n" + "="*60)
        print("  RESULTS SUMMARY")
        print("="*60)
        
        if allowed_works and not blocked_works:
            print("\n🎉 GREAT NEWS! networkAllowList WORKS at your tier!")
            print("\n   You can use the VPS proxy approach:")
            print("   1. Set up a VPS with static IP")
            print("   2. Run a proxy server (Squid) on the VPS")
            print("   3. Add VPS IP to networkAllowList when creating sandboxes")
            print("   4. Configure browsers to use the proxy")
            print("   5. Full internet access through VPS!")
            
        elif allowed_works and blocked_works:
            print("\n⚠️  networkAllowList may not be working as expected")
            print("   Both allowed and blocked IPs were accessible")
            print("   Possible reasons:")
            print("   - You're already on Tier 3+ with full internet access")
            print("   - networkAllowList adds to (not replaces) existing access")
            
        elif not allowed_works and not blocked_works:
            print("\n❌ NEITHER IP was accessible")
            print("   Possible reasons:")
            print("   - networkAllowList is ignored at your tier")
            print("   - Network issues in sandbox")
            print("   - Firewall is very restrictive")
            
        else:
            print("\n🤔 Unexpected results - need manual investigation")
        
        print("\n")
        
    except Exception as e:
        print(f"\n❌ Error during test: {e}")
        import traceback
        traceback.print_exc()
        
    finally:
        # Cleanup: Delete the test sandbox
        if sandbox:
            print(f"🧹 Cleaning up: Deleting test sandbox {sandbox.id}...")
            try:
                await daytona.delete(sandbox)
                print("✅ Sandbox deleted")
            except Exception as e:
                print(f"⚠️  Could not delete sandbox: {e}")


async def test_without_allowlist():
    """Baseline test: What happens WITHOUT networkAllowList?"""
    
    print("\n" + "="*60)
    print("  BASELINE TEST (without networkAllowList)")
    print("="*60)
    
    daytona_config = DaytonaConfig(
        api_key=config.DAYTONA_API_KEY,
        api_url=config.DAYTONA_SERVER_URL,
        target=config.DAYTONA_TARGET,
    )
    
    daytona = AsyncDaytona(daytona_config)
    sandbox = None
    
    try:
        print("\n🔧 Creating sandbox WITHOUT networkAllowList...")
        
        params = CreateSandboxFromSnapshotParams(
            snapshot=Configuration.SANDBOX_SNAPSHOT_NAME,
            public=True,
            # NO network_allow_list parameter
            env_vars={"TEST_MODE": "true"},
            auto_stop_interval=5,
            auto_archive_interval=10,
        )
        
        sandbox = await daytona.create(params)
        print(f"✅ Sandbox created: {sandbox.id}")
        
        await asyncio.sleep(5)
        
        # Test random website
        print(f"\n🌐 Testing connectivity to example.com (random site)...")
        
        result = await sandbox.process.exec(
            "curl -s -o /dev/null -w '%{http_code}' --connect-timeout 10 http://example.com",
            timeout=15
        )
        
        if result.exit_code == 0 and result.result.strip() in ["200", "301", "302"]:
            print(f"   ✅ example.com is ACCESSIBLE")
            print("   → You might already have full internet access (Tier 3+)?")
        else:
            print(f"   ❌ example.com is BLOCKED")
            print("   → Confirms you're on restricted tier (Tier 1/2)")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        
    finally:
        if sandbox:
            print(f"\n🧹 Cleaning up...")
            try:
                await daytona.delete(sandbox)
            except:
                pass


if __name__ == "__main__":
    print("\n" + "🧪"*30)
    print("  DAYTONA NETWORK ALLOWLIST VERIFICATION TEST")
    print("🧪"*30)
    
    # Run baseline test first
    asyncio.run(test_without_allowlist())
    
    # Then run allowlist test
    asyncio.run(test_network_allowlist())
