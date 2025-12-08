/**
 * Email utility functions
 * Shared functions for sending emails from server-side code
 */
// feature-start: frontend-getapiurl-implementation
import { getApiUrl } from './get-api-url';
// feature-end: frontend-getapiurl-implementation

export async function sendWelcomeEmail(email: string, name?: string) {
  try {
    console.log(`📧 Attempting to send welcome email to ${email}`);
    // feature-start: frontend-getapiurl-implementation
    const backendUrl = getApiUrl();
    // feature-end: frontend-getapiurl-implementation
    const adminApiKey = process.env.KORTIX_ADMIN_API_KEY;

    if (!adminApiKey) {
      console.error('KORTIX_ADMIN_API_KEY not configured');
      return;
    }

    if (!backendUrl) {
      console.error('NEXT_PUBLIC_BACKEND_URL not configured');
      return;
    }

    // Remove trailing slash and ensure proper URL construction
    const baseUrl = backendUrl.replace(/\/$/, '');
    const emailEndpoint = `${baseUrl}/send-welcome-email`;
    console.log(`📡 Calling backend API: ${emailEndpoint}`);
    const response = await fetch(emailEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Api-Key': adminApiKey,
      },
      body: JSON.stringify({
        email,
        name,
      }),
    });

    if (response.ok) {
      console.log(`✅ Welcome email sent to ${email}`);
    } else {
      const errorData = await response.json().catch(() => ({}));
      console.error(`Failed to send welcome email for ${email}:`, errorData);
    }
  } catch (error) {
    console.error('Error sending welcome email:', error);
  }
}

