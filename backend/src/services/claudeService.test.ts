/**
 * Unit tests for Claude Service
 *
 * Tests JSON parsing from Claude API responses.
 * Claude sometimes wraps JSON in markdown code blocks or adds text around it.
 */

import { parseClaudeJSON } from './claudeService';

describe('parseClaudeJSON', () => {
  describe('plain JSON parsing', () => {
    it('parses plain JSON object', () => {
      const content = '{"name": "test", "value": 123}';
      const result = parseClaudeJSON<{ name: string; value: number }>(content);
      expect(result.name).toBe('test');
      expect(result.value).toBe(123);
    });

    it('parses JSON with whitespace', () => {
      const content = `
        {
          "address": "123 Main St",
          "price": 5000000
        }
      `;
      const result = parseClaudeJSON<{ address: string; price: number }>(content);
      expect(result.address).toBe('123 Main St');
      expect(result.price).toBe(5000000);
    });

    it('parses JSON array', () => {
      const content = '[1, 2, 3, 4, 5]';
      const result = parseClaudeJSON<number[]>(content);
      expect(result).toEqual([1, 2, 3, 4, 5]);
    });

    it('parses nested objects', () => {
      const content = JSON.stringify({
        property: {
          address: '456 Industrial Way',
          financials: {
            price: 10000000,
            noi: 500000,
            cap_rate: 5.0,
          },
        },
      });

      const result = parseClaudeJSON<{
        property: { address: string; financials: { price: number; noi: number; cap_rate: number } };
      }>(content);

      expect(result.property.address).toBe('456 Industrial Way');
      expect(result.property.financials.cap_rate).toBe(5.0);
    });
  });

  describe('markdown code block extraction', () => {
    it('extracts JSON from ```json code block', () => {
      const content = `Here's the data:

\`\`\`json
{"city": "Ontario", "state": "CA"}
\`\`\`

Hope this helps!`;

      const result = parseClaudeJSON<{ city: string; state: string }>(content);
      expect(result.city).toBe('Ontario');
      expect(result.state).toBe('CA');
    });

    it('extracts JSON from plain ``` code block', () => {
      const content = `\`\`\`
{"building_size": 50000, "lot_size": 2.5}
\`\`\``;

      const result = parseClaudeJSON<{ building_size: number; lot_size: number }>(content);
      expect(result.building_size).toBe(50000);
      expect(result.lot_size).toBe(2.5);
    });

    it('handles code block with extra whitespace', () => {
      const content = `
\`\`\`json

{
  "cap_rate": 5.5,
  "price_per_sqft": 200
}

\`\`\`
`;

      const result = parseClaudeJSON<{ cap_rate: number; price_per_sqft: number }>(content);
      expect(result.cap_rate).toBe(5.5);
      expect(result.price_per_sqft).toBe(200);
    });

    it('extracts first code block when multiple present', () => {
      const content = `First block:
\`\`\`json
{"value": 1}
\`\`\`

Second block:
\`\`\`json
{"value": 2}
\`\`\``;

      const result = parseClaudeJSON<{ value: number }>(content);
      expect(result.value).toBe(1);
    });
  });

  describe('complex extraction scenarios', () => {
    it('parses extracted property data format', () => {
      const content = `\`\`\`json
{
  "address": "1234 Industrial Blvd",
  "city": "Ontario",
  "state": "CA",
  "zip_code": "91761",
  "property_type": "industrial",
  "building_size": 75000,
  "price": 15000000,
  "cap_rate": 5.25,
  "noi": 787500,
  "confidence_scores": {
    "address": 95,
    "price": 90,
    "cap_rate": 85
  }
}
\`\`\``;

      interface ExtractedData {
        address: string;
        city: string;
        state: string;
        zip_code: string;
        property_type: string;
        building_size: number;
        price: number;
        cap_rate: number;
        noi: number;
        confidence_scores: Record<string, number>;
      }

      const result = parseClaudeJSON<ExtractedData>(content);

      expect(result.address).toBe('1234 Industrial Blvd');
      expect(result.building_size).toBe(75000);
      expect(result.cap_rate).toBe(5.25);
      expect(result.confidence_scores.address).toBe(95);
    });

    it('handles null values in JSON', () => {
      const content = JSON.stringify({
        address: '123 Main St',
        city: 'Ontario',
        year_built: null,
        parking_spaces: null,
      });

      interface PropertyData {
        address: string;
        city: string;
        year_built: number | null;
        parking_spaces: number | null;
      }

      const result = parseClaudeJSON<PropertyData>(content);
      expect(result.address).toBe('123 Main St');
      expect(result.year_built).toBeNull();
      expect(result.parking_spaces).toBeNull();
    });

    it('handles arrays of objects', () => {
      const content = `\`\`\`json
[
  {"name": "Tenant A", "sqft": 25000},
  {"name": "Tenant B", "sqft": 15000},
  {"name": "Tenant C", "sqft": 10000}
]
\`\`\``;

      interface Tenant {
        name: string;
        sqft: number;
      }

      const result = parseClaudeJSON<Tenant[]>(content);
      expect(result).toHaveLength(3);
      expect(result[0].name).toBe('Tenant A');
      expect(result[1].sqft).toBe(15000);
    });

    it('handles empty arrays', () => {
      const content = '{"items": []}';
      const result = parseClaudeJSON<{ items: unknown[] }>(content);
      expect(result.items).toEqual([]);
    });

    it('handles empty objects', () => {
      const content = '{}';
      const result = parseClaudeJSON<Record<string, unknown>>(content);
      expect(result).toEqual({});
    });
  });

  describe('special characters and encoding', () => {
    it('handles unicode characters', () => {
      const content = '{"note": "Property value: $5M — excellent investment"}';
      const result = parseClaudeJSON<{ note: string }>(content);
      expect(result.note).toContain('$5M');
      expect(result.note).toContain('—');
    });

    it('handles escaped quotes', () => {
      const content = '{"description": "Property has \\"excellent\\" condition"}';
      const result = parseClaudeJSON<{ description: string }>(content);
      expect(result.description).toContain('"excellent"');
    });

    it('handles newlines in strings', () => {
      const content = '{"notes": "Line 1\\nLine 2\\nLine 3"}';
      const result = parseClaudeJSON<{ notes: string }>(content);
      expect(result.notes).toContain('\n');
    });

    it('handles special regex characters in strings', () => {
      const content = '{"pattern": "Price: $100+/sqft (negotiable)"}';
      const result = parseClaudeJSON<{ pattern: string }>(content);
      expect(result.pattern).toContain('$100+/sqft');
    });
  });

  describe('error handling', () => {
    it('throws error for invalid JSON', () => {
      const content = '{invalid json}';
      expect(() => parseClaudeJSON(content)).toThrow();
    });

    it('throws error for empty string', () => {
      expect(() => parseClaudeJSON('')).toThrow();
    });

    it('throws error for non-JSON text', () => {
      const content = 'This is just regular text without any JSON';
      expect(() => parseClaudeJSON(content)).toThrow();
    });

    it('throws error for incomplete JSON', () => {
      const content = '{"address": "123 Main St"';
      expect(() => parseClaudeJSON(content)).toThrow();
    });

    it('throws error for malformed code block', () => {
      const content = '```json\n{invalid\n```';
      expect(() => parseClaudeJSON(content)).toThrow();
    });
  });

  describe('edge cases', () => {
    it('handles boolean values', () => {
      const content = '{"is_active": true, "is_vacant": false}';
      const result = parseClaudeJSON<{ is_active: boolean; is_vacant: boolean }>(content);
      expect(result.is_active).toBe(true);
      expect(result.is_vacant).toBe(false);
    });

    it('handles very large numbers', () => {
      const content = '{"price": 999999999999}';
      const result = parseClaudeJSON<{ price: number }>(content);
      expect(result.price).toBe(999999999999);
    });

    it('handles decimal precision', () => {
      const content = '{"cap_rate": 5.123456789}';
      const result = parseClaudeJSON<{ cap_rate: number }>(content);
      expect(result.cap_rate).toBeCloseTo(5.123456789, 9);
    });

    it('handles negative numbers', () => {
      const content = '{"cash_flow": -50000, "adjustment": -0.05}';
      const result = parseClaudeJSON<{ cash_flow: number; adjustment: number }>(content);
      expect(result.cash_flow).toBe(-50000);
      expect(result.adjustment).toBe(-0.05);
    });

    it('handles zero values', () => {
      const content = '{"vacancy": 0, "rate": 0.0}';
      const result = parseClaudeJSON<{ vacancy: number; rate: number }>(content);
      expect(result.vacancy).toBe(0);
      expect(result.rate).toBe(0);
    });
  });

  describe('real Claude response patterns', () => {
    it('handles typical extraction response', () => {
      const content = `Based on the document provided, I've extracted the following property information:

\`\`\`json
{
  "address": "9876 Logistics Lane",
  "city": "Fontana",
  "state": "CA",
  "zip_code": "92335",
  "apn": "0238-141-01",
  "property_type": "industrial",
  "subtype": "distribution_center",
  "building_size": 125000,
  "lot_size": 5.2,
  "year_built": 2019,
  "price": 31250000,
  "price_per_sqft": 250,
  "cap_rate": 4.8,
  "noi": 1500000,
  "gross_income": 1875000,
  "operating_expenses": 375000,
  "occupancy_rate": 100,
  "tenant_name": "Amazon Logistics",
  "lease_term_years": 10,
  "market": "Inland Empire",
  "submarket": "West Fontana",
  "zoning": "M-2",
  "parking_spaces": 150,
  "amenities": ["ESFR Sprinklers", "36ft Clear Height", "Cross-Dock"],
  "notes": "Single-tenant NNN lease with 2.5% annual escalations. Recent construction with LEED certification.",
  "confidence_scores": {
    "address": 98,
    "price": 95,
    "cap_rate": 90,
    "noi": 92,
    "tenant_name": 100,
    "building_size": 95
  }
}
\`\`\`

The confidence scores indicate high reliability for most fields as they were clearly stated in the offering memorandum.`;

      interface ExtractedData {
        address: string;
        city: string;
        state: string;
        building_size: number;
        price: number;
        cap_rate: number;
        tenant_name: string;
        amenities: string[];
        confidence_scores: Record<string, number>;
      }

      const result = parseClaudeJSON<ExtractedData>(content);

      expect(result.address).toBe('9876 Logistics Lane');
      expect(result.city).toBe('Fontana');
      expect(result.building_size).toBe(125000);
      expect(result.price).toBe(31250000);
      expect(result.cap_rate).toBe(4.8);
      expect(result.tenant_name).toBe('Amazon Logistics');
      expect(result.amenities).toContain('ESFR Sprinklers');
      expect(result.confidence_scores.address).toBe(98);
    });

    it('handles response with thinking before JSON', () => {
      const content = `Let me analyze this document carefully.

Looking at the offering memorandum, I can identify the following key information:
- The property is located in Ontario, CA
- It's a Class A industrial building
- Currently 100% leased

Here's the structured extraction:

\`\`\`json
{
  "address": "5555 Haven Ave",
  "city": "Ontario",
  "property_type": "industrial",
  "building_size": 80000,
  "price": 16000000
}
\`\`\``;

      const result = parseClaudeJSON<{
        address: string;
        city: string;
        property_type: string;
        building_size: number;
        price: number;
      }>(content);

      expect(result.address).toBe('5555 Haven Ave');
      expect(result.price).toBe(16000000);
    });
  });
});
