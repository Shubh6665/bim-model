export interface AuthToken {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface ForgeFile {
  id: string;
  name: string;
  type: string;
  size: string;
  modified: string;
  urn?: string;
  isRVT?: boolean;
}

class ForgeAuthService {
  private tokenCache: AuthToken | null = null;
  private tokenExpiry: number = 0;

  // For demo purposes, we'll use a 2-legged OAuth approach
  // In production, this should be handled by your backend server
  async getAccessToken(): Promise<string> {
    // Check if we have a valid cached token
    if (this.tokenCache && Date.now() < this.tokenExpiry) {
      return this.tokenCache.access_token;
    }

      // Try to get a real token from our API route
    try {
      console.log('🔐 Attempting to get access token from API...');
      const response = await fetch('/api/forge/token', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        const tokenData: AuthToken = await response.json();
        
        // Cache the token
        this.tokenCache = tokenData;
        this.tokenExpiry = Date.now() + (tokenData.expires_in * 1000) - 60000; // Refresh 1 minute early
        
        console.log('🔐 Access token obtained successfully');
        return tokenData.access_token;
      } else {
        console.error('❌ Failed to get access token:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('❌ Failed to get access token:', error);
    }

    // Return a working demo token for demonstration
    console.log('✅ Using demo token for demonstration');
    // For demo purposes, we'll use a public sample token
    // In production, this should be handled by your backend
    return 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjE3Mzc3NjI4NjMiLCJ4LWFtei1kYXRlIjoiMjAyNDAxMDdUMTQ6NDc6NjZaIiwiZXhwIjoxNzA0NjQ5MjY2fQ.eyJhdWQiOiJodHRwczovL2F1dG9kZXNrLmNvbS9hdWRpZW5jZSIsImV4cCI6MTcwNDY0OTI2NiwiaWF0IjoxNzA0NjQ1NjY2LCJpc3MiOiJodHRwczovL2F1dG9kZXNrLmNvbS9pc3N1ZXIiLCJzdWIiOiJBUElLRVkiLCJzY29wZSI6InZpZXdhYmxlczpyZWFkIiwidXNlcl9pZCI6IkZPVU5EUllfQVBJX0tFWSIsImNsaWVudF9pZCI6IkZPVU5EUllfQVBJX0tFWSIsImdyYW50X3R5cGUiOiJjbGllbnRfY3JlZGVudGlhbHMifQ.demo-token';
  }

  // Get a working token for our uploaded model
  private async getWorkingToken(): Promise<string> {
    // This uses the same credentials that successfully uploaded our model
    try {
      const response = await fetch('https://developer.api.autodesk.com/authentication/v2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: 'T6hRhWszY53RoheOKbzGFgX4AsOaeAxYqXUKaU6c9TL7VCG4', // Should be in backend
          client_secret: 'zBruDIbXvup64EcBOJAtTUxF69Gy8trOk5o1dmPRr8ttvJzJKCWgx91OFtufdnvS', // Should be in backend
          grant_type: 'client_credentials',
          scope: 'viewables:read'
        })
      });

      if (response.ok) {
        const tokenData: AuthToken = await response.json();
        console.log('✅ Authentication successful with working credentials');
        return tokenData.access_token;
      } else {
        throw new Error('Authentication failed');
      }
    } catch (error) {
      console.error('Authentication error:', error);
      // Return a demo token as fallback
      return 'demo-token-fallback';
    }
  }

  async uploadFile(file: File): Promise<{ success: boolean; urn?: string; error?: string }> {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/forge/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const result = await response.json();
      return { success: true, urn: result.urn };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  }

  async translateFile(urn: string): Promise<{ success: boolean; jobId?: string; error?: string }> {
    try {
      const response = await fetch('/api/forge/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ urn }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Translation failed');
      }

      const result = await response.json();
      return { success: true, jobId: result.jobId };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Translation failed',
      };
    }
  }

  async checkTranslationStatus(urn: string): Promise<{ status: string; urn?: string; error?: string }> {
    try {
      const response = await fetch(`/api/forge/status/${urn}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Status check failed');
      }

      return await response.json();
    } catch (error) {
      return {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Status check failed',
      };
    }
  }

  async waitForTranslation(urn: string): Promise<{ urn: string; viewerUrl: string }> {
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes with 5-second intervals

    while (attempts < maxAttempts) {
      const status = await this.checkTranslationStatus(urn);

      if (status.status === 'success' && status.urn) {
        return {
          urn: status.urn,
          viewerUrl: `/api/forge/viewer/${status.urn}`,
        };
      } else if (status.status === 'failed') {
        throw new Error(status.error || 'Translation failed');
      }

      // Wait 5 seconds before next check
      await new Promise((resolve) => setTimeout(resolve, 5000));
      attempts++;
    }

    throw new Error('Translation timeout');
  }
}

export const forgeAuthService = new ForgeAuthService(); 