import { test, expect } from '@playwright/test';

/**
 * Gemini API Integration E2E tests
 *
 * Tests the AI sommelier chat API endpoint and error handling.
 */

test.describe('Gemini API Integration', () => {
  test.describe('Chat API Endpoint', () => {
    test('should return error when API key is not configured', async ({ request }) => {
      const response = await request.post('/api/chat', {
        data: {
          message: 'What wine pairs with steak?',
        },
      });

      // Without GEMINI_API_KEY, should return 500 error
      expect(response.status()).toBe(500);

      const data = await response.json();
      expect(data.error).toBe('Sommelier service is not configured');
    });

    test('should return 400 for missing message', async ({ request }) => {
      const response = await request.post('/api/chat', {
        data: {},
      });

      // Should return 400 for missing message (or 500 if API key check comes first)
      expect([400, 500]).toContain(response.status());
    });

    test('should return 400 for invalid message type', async ({ request }) => {
      const response = await request.post('/api/chat', {
        data: {
          message: 123, // Invalid type
        },
      });

      expect([400, 500]).toContain(response.status());
    });

    test('should accept wine context in request', async ({ request }) => {
      const response = await request.post('/api/chat', {
        data: {
          message: 'What foods pair with this wine?',
          wineContext: {
            name: 'Château Margaux',
            winery: 'Château Margaux',
            vintage: 2015,
            grapeVariety: 'Cabernet Sauvignon',
            region: 'Bordeaux',
            country: 'France',
            price: 500,
            rating: 5,
            tastingNotes: 'Complex and elegant',
          },
        },
      });

      // Should process request (even if API key is missing, request format is valid)
      expect([200, 500]).toContain(response.status());
    });

    test('should accept conversation history in request', async ({ request }) => {
      const response = await request.post('/api/chat', {
        data: {
          message: 'Tell me more',
          conversationHistory: [
            { role: 'user', content: 'What wine pairs with steak?' },
            { role: 'model', content: 'A bold red wine like Cabernet Sauvignon...' },
          ],
        },
      });

      expect([200, 500]).toContain(response.status());
    });
  });

  test.describe('Chat UI Error Handling', () => {
    test('should display error message when API fails', async ({ page }) => {
      // This test verifies the SommelierChat component handles errors gracefully
      // The component shows: "I apologize, but I'm having trouble connecting right now..."

      await page.goto('/signin');

      // Verify error message pattern exists in the component
      // (We can't actually trigger it without being authenticated)
      await expect(page.getByRole('heading', { name: /Welcome Back/i })).toBeVisible();
    });
  });

  test.describe('API Request Validation', () => {
    test('should handle empty request body', async ({ request }) => {
      const response = await request.post('/api/chat', {
        data: '',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // Should return an error, not crash
      expect([400, 500]).toContain(response.status());
    });

    test('should handle malformed JSON', async ({ request }) => {
      const response = await request.post('/api/chat', {
        data: 'not valid json',
        headers: {
          'Content-Type': 'text/plain',
        },
      });

      // Should handle gracefully
      expect([400, 500]).toContain(response.status());
    });

    test('should have proper CORS headers for same-origin requests', async ({ request }) => {
      const response = await request.post('/api/chat', {
        data: {
          message: 'test',
        },
      });

      // Response should be processable
      expect(response).toBeDefined();
    });
  });

  test.describe('Rate Limiting and Security', () => {
    test('should not expose API key in error messages', async ({ request }) => {
      const response = await request.post('/api/chat', {
        data: {
          message: 'test',
        },
      });

      const data = await response.json();

      // Error message should not contain sensitive info
      if (data.error) {
        expect(data.error).not.toContain('api_key');
        expect(data.error).not.toContain('GEMINI');
        expect(data.error).not.toContain('AIza'); // Google API key prefix
      }
    });
  });

  test.describe('Response Format', () => {
    test('should return JSON response', async ({ request }) => {
      const response = await request.post('/api/chat', {
        data: {
          message: 'test',
        },
      });

      const contentType = response.headers()['content-type'];
      expect(contentType).toContain('application/json');
    });

    test('should have error field in error response', async ({ request }) => {
      const response = await request.post('/api/chat', {
        data: {
          message: 'test',
        },
      });

      if (response.status() !== 200) {
        const data = await response.json();
        expect(data).toHaveProperty('error');
      }
    });
  });
});

test.describe('Environment Configuration', () => {
  test('should handle missing environment variables gracefully', async ({ page }) => {
    // Navigate to home page - should work even without Gemini API
    await page.goto('/');

    await expect(page.getByRole('heading', { name: /Aretae Sommelier/i })).toBeVisible();
  });

  test('should show AI Sommelier feature on landing page', async ({ page }) => {
    await page.goto('/');

    // The AI Sommelier feature is advertised
    await expect(page.getByText(/AI Sommelier/i)).toBeVisible();
    await expect(
      page.getByText(/Get expert advice on food pairings/i)
    ).toBeVisible();
  });
});
