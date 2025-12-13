/**
 * Unit tests for Valuation Service
 *
 * Tests the parsing of Claude API responses for property valuations.
 * Critical because users make investment decisions based on these outputs.
 */

// We need to test the parseValuationResponse function
// Since it's not exported, we'll test through the module or extract it

// For now, let's create a testable version and test the JSON parsing logic

interface ValuationResult {
  estimated_value: number;
  value_range: {
    low: number;
    high: number;
  };
  confidence_level: string;
  price_per_sqft_estimate?: number | null;
  analysis: string;
  comparable_analysis: Array<{
    comp_id: string;
    comp_address: string;
    sale_price: number;
    adjustments: string;
    adjusted_value: number;
  }>;
  key_findings: string[];
  recommendations: string[];
  market_insights: string;
}

/**
 * Parse Claude's valuation response (extracted for testing)
 */
function parseValuationResponse(responseText: string): ValuationResult {
  // Extract JSON from response (Claude might add explanation text)
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in response');
  }

  const parsed = JSON.parse(jsonMatch[0]);

  // Validate required fields
  if (typeof parsed.estimated_value !== 'number') {
    throw new Error('Missing or invalid estimated_value');
  }

  return {
    estimated_value: parsed.estimated_value,
    value_range: parsed.value_range || {
      low: parsed.estimated_value * 0.9,
      high: parsed.estimated_value * 1.1,
    },
    confidence_level: parsed.confidence_level || 'Medium',
    price_per_sqft_estimate: parsed.price_per_sqft_estimate || null,
    analysis: parsed.analysis || 'Analysis not provided',
    comparable_analysis: parsed.comparable_analysis || [],
    key_findings: parsed.key_findings || [],
    recommendations: parsed.recommendations || [],
    market_insights: parsed.market_insights || 'Market insights not provided',
  };
}

describe('parseValuationResponse', () => {
  describe('valid JSON parsing', () => {
    it('parses complete valid response', () => {
      const response = JSON.stringify({
        estimated_value: 5000000,
        value_range: { low: 4500000, high: 5500000 },
        confidence_level: 'High',
        price_per_sqft_estimate: 200,
        analysis: 'Based on comparable sales analysis...',
        comparable_analysis: [
          {
            comp_id: 'Comparable 1',
            comp_address: '123 Industrial Way',
            sale_price: 4800000,
            adjustments: '+5% for size, -2% for age',
            adjusted_value: 4944000,
          },
        ],
        key_findings: ['Strong market demand', 'Well-maintained property'],
        recommendations: ['Consider negotiating to $4.8M'],
        market_insights: 'Industrial market remains strong',
      });

      const result = parseValuationResponse(response);

      expect(result.estimated_value).toBe(5000000);
      expect(result.value_range.low).toBe(4500000);
      expect(result.value_range.high).toBe(5500000);
      expect(result.confidence_level).toBe('High');
      expect(result.price_per_sqft_estimate).toBe(200);
      expect(result.comparable_analysis).toHaveLength(1);
      expect(result.key_findings).toHaveLength(2);
    });

    it('parses response with only required fields', () => {
      const response = JSON.stringify({
        estimated_value: 3000000,
      });

      const result = parseValuationResponse(response);

      expect(result.estimated_value).toBe(3000000);
      // Check defaults are applied
      expect(result.value_range.low).toBeCloseTo(2700000, 0); // 90% of 3M
      expect(result.value_range.high).toBeCloseTo(3300000, 0); // 110% of 3M
      expect(result.confidence_level).toBe('Medium');
      expect(result.analysis).toBe('Analysis not provided');
      expect(result.comparable_analysis).toEqual([]);
      expect(result.key_findings).toEqual([]);
      expect(result.recommendations).toEqual([]);
    });

    it('parses JSON embedded in markdown code block', () => {
      const response = `Here is my analysis:

\`\`\`json
{
  "estimated_value": 4500000,
  "confidence_level": "High"
}
\`\`\`

Let me explain the methodology...`;

      const result = parseValuationResponse(response);
      expect(result.estimated_value).toBe(4500000);
    });

    it('parses JSON with surrounding text', () => {
      const response = `Based on my analysis, here is the valuation:

{
  "estimated_value": 6000000,
  "value_range": {
    "low": 5500000,
    "high": 6500000
  }
}

This valuation reflects current market conditions.`;

      const result = parseValuationResponse(response);
      expect(result.estimated_value).toBe(6000000);
      expect(result.value_range.low).toBe(5500000);
    });

    it('handles null price_per_sqft_estimate', () => {
      const response = JSON.stringify({
        estimated_value: 5000000,
        price_per_sqft_estimate: null,
      });

      const result = parseValuationResponse(response);
      expect(result.price_per_sqft_estimate).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('handles very large property values', () => {
      const response = JSON.stringify({
        estimated_value: 150000000, // $150M
        value_range: { low: 140000000, high: 160000000 },
      });

      const result = parseValuationResponse(response);
      expect(result.estimated_value).toBe(150000000);
    });

    it('handles decimal values', () => {
      const response = JSON.stringify({
        estimated_value: 5250000.50,
        price_per_sqft_estimate: 175.25,
      });

      const result = parseValuationResponse(response);
      expect(result.estimated_value).toBe(5250000.50);
      expect(result.price_per_sqft_estimate).toBe(175.25);
    });

    it('handles empty comparable_analysis array', () => {
      const response = JSON.stringify({
        estimated_value: 4000000,
        comparable_analysis: [],
      });

      const result = parseValuationResponse(response);
      expect(result.comparable_analysis).toEqual([]);
    });

    it('handles multiple comparables', () => {
      const response = JSON.stringify({
        estimated_value: 5000000,
        comparable_analysis: [
          {
            comp_id: 'Comp 1',
            comp_address: '100 Main St',
            sale_price: 4800000,
            adjustments: 'Size +5%',
            adjusted_value: 5040000,
          },
          {
            comp_id: 'Comp 2',
            comp_address: '200 Industrial Ave',
            sale_price: 5200000,
            adjustments: 'Age -3%',
            adjusted_value: 5044000,
          },
          {
            comp_id: 'Comp 3',
            comp_address: '300 Warehouse Blvd',
            sale_price: 4900000,
            adjustments: 'Location +2%',
            adjusted_value: 4998000,
          },
        ],
      });

      const result = parseValuationResponse(response);
      expect(result.comparable_analysis).toHaveLength(3);
      expect(result.comparable_analysis[0].comp_address).toBe('100 Main St');
      expect(result.comparable_analysis[1].adjusted_value).toBe(5044000);
    });

    it('handles special characters in analysis text', () => {
      const response = JSON.stringify({
        estimated_value: 5000000,
        analysis: 'Property at 123 Main St. has "excellent" condition & great location (A+)',
        market_insights: "Market's doing well - cap rates are compressing!",
      });

      const result = parseValuationResponse(response);
      expect(result.analysis).toContain('excellent');
      expect(result.market_insights).toContain("Market's doing");
    });

    it('handles unicode characters', () => {
      const response = JSON.stringify({
        estimated_value: 5000000,
        analysis: 'Property value: $5M — a solid investment',
        key_findings: ['Located near major thoroughfare', 'Recently renovated'],
      });

      const result = parseValuationResponse(response);
      expect(result.analysis).toContain('$5M');
    });
  });

  describe('invalid inputs', () => {
    it('throws error when no JSON found', () => {
      const response = 'This is just plain text with no JSON';

      expect(() => parseValuationResponse(response)).toThrow('No JSON found');
    });

    it('throws error for invalid JSON syntax', () => {
      const response = '{ "estimated_value": 5000000, invalid }';

      expect(() => parseValuationResponse(response)).toThrow();
    });

    it('throws error when estimated_value is missing', () => {
      const response = JSON.stringify({
        value_range: { low: 4500000, high: 5500000 },
        confidence_level: 'High',
      });

      expect(() => parseValuationResponse(response)).toThrow(
        'Missing or invalid estimated_value'
      );
    });

    it('throws error when estimated_value is not a number', () => {
      const response = JSON.stringify({
        estimated_value: '5000000', // String instead of number
      });

      expect(() => parseValuationResponse(response)).toThrow(
        'Missing or invalid estimated_value'
      );
    });

    it('throws error when estimated_value is null', () => {
      const response = JSON.stringify({
        estimated_value: null,
      });

      expect(() => parseValuationResponse(response)).toThrow(
        'Missing or invalid estimated_value'
      );
    });

    it('throws error for empty string', () => {
      expect(() => parseValuationResponse('')).toThrow('No JSON found');
    });

    it('throws error for incomplete JSON', () => {
      const response = '{ "estimated_value": ';

      expect(() => parseValuationResponse(response)).toThrow();
    });
  });

  describe('real-world Claude response patterns', () => {
    it('handles typical Claude response with preamble', () => {
      const response = `I'll analyze this property based on the comparable sales data provided.

{
  "estimated_value": 7500000,
  "value_range": {
    "low": 7000000,
    "high": 8000000
  },
  "confidence_level": "Medium",
  "price_per_sqft_estimate": 185,
  "analysis": "Based on the three comparable sales provided, the subject property's estimated market value is approximately $7.5 million. The comparables show a range of $175-195 per square foot, with adjustments made for size, age, and location differences.",
  "comparable_analysis": [
    {
      "comp_id": "Comparable 1",
      "comp_address": "1234 Industrial Way, Ontario, CA",
      "sale_price": 7200000,
      "adjustments": "+3% for superior location, -2% for older vintage",
      "adjusted_value": 7272000
    }
  ],
  "key_findings": [
    "Subject property is competitively priced relative to recent sales",
    "Building size is optimal for current market demand",
    "Location provides good access to major transportation routes"
  ],
  "recommendations": [
    "Consider offering at $7.25M to account for deferred maintenance",
    "Request rent rolls to verify NOI calculations",
    "Conduct Phase I environmental due diligence"
  ],
  "market_insights": "The Inland Empire industrial market remains strong with vacancy rates below 2%. Cap rates have compressed to the 4.5-5.5% range for Class A properties. Distribution center demand continues to drive absorption."
}`;

      const result = parseValuationResponse(response);

      expect(result.estimated_value).toBe(7500000);
      expect(result.confidence_level).toBe('Medium');
      expect(result.price_per_sqft_estimate).toBe(185);
      expect(result.comparable_analysis).toHaveLength(1);
      expect(result.key_findings).toHaveLength(3);
      expect(result.recommendations).toHaveLength(3);
      expect(result.market_insights).toContain('Inland Empire');
    });

    it('handles Claude response with thinking text after JSON', () => {
      const response = `{
  "estimated_value": 4200000,
  "value_range": {
    "low": 3900000,
    "high": 4500000
  },
  "confidence_level": "High"
}

Note: This valuation assumes the property is in good condition and all financial data provided is accurate. A physical inspection may reveal factors that could affect value.`;

      const result = parseValuationResponse(response);
      expect(result.estimated_value).toBe(4200000);
      expect(result.confidence_level).toBe('High');
    });

    it('handles response with nested JSON in analysis', () => {
      const response = JSON.stringify({
        estimated_value: 5500000,
        analysis:
          'Based on the data: {"noi": 275000, "cap": 5.0}, the value is supported.',
        key_findings: ['NOI is verified at $275K'],
      });

      const result = parseValuationResponse(response);
      expect(result.estimated_value).toBe(5500000);
      // The inner JSON should just be part of the string
      expect(result.analysis).toContain('{"noi": 275000');
    });
  });

  describe('confidence level variations', () => {
    it('accepts High confidence', () => {
      const response = JSON.stringify({
        estimated_value: 5000000,
        confidence_level: 'High',
      });
      const result = parseValuationResponse(response);
      expect(result.confidence_level).toBe('High');
    });

    it('accepts Medium confidence', () => {
      const response = JSON.stringify({
        estimated_value: 5000000,
        confidence_level: 'Medium',
      });
      const result = parseValuationResponse(response);
      expect(result.confidence_level).toBe('Medium');
    });

    it('accepts Low confidence', () => {
      const response = JSON.stringify({
        estimated_value: 5000000,
        confidence_level: 'Low',
      });
      const result = parseValuationResponse(response);
      expect(result.confidence_level).toBe('Low');
    });

    it('defaults to Medium when missing', () => {
      const response = JSON.stringify({
        estimated_value: 5000000,
      });
      const result = parseValuationResponse(response);
      expect(result.confidence_level).toBe('Medium');
    });
  });

  describe('value range calculations', () => {
    it('uses provided value range', () => {
      const response = JSON.stringify({
        estimated_value: 10000000,
        value_range: { low: 9000000, high: 11000000 },
      });

      const result = parseValuationResponse(response);
      expect(result.value_range.low).toBe(9000000);
      expect(result.value_range.high).toBe(11000000);
    });

    it('calculates default 10% range when missing', () => {
      const response = JSON.stringify({
        estimated_value: 10000000,
      });

      const result = parseValuationResponse(response);
      expect(result.value_range.low).toBe(9000000); // 90%
      expect(result.value_range.high).toBe(11000000); // 110%
    });

    it('handles asymmetric value ranges', () => {
      const response = JSON.stringify({
        estimated_value: 5000000,
        value_range: { low: 4000000, high: 6500000 },
      });

      const result = parseValuationResponse(response);
      expect(result.value_range.low).toBe(4000000); // -20%
      expect(result.value_range.high).toBe(6500000); // +30%
    });
  });
});

describe('integration with real property data', () => {
  it('processes typical industrial property valuation', () => {
    const response = JSON.stringify({
      estimated_value: 12500000,
      value_range: { low: 11500000, high: 13500000 },
      confidence_level: 'High',
      price_per_sqft_estimate: 250,
      analysis:
        'This 50,000 SF Class A industrial property in Ontario, CA is well-positioned in the market. The $250/SF valuation is supported by three recent comparable sales ranging from $235-$270/SF.',
      comparable_analysis: [
        {
          comp_id: 'Comp 1',
          comp_address: '4567 Industrial Blvd, Ontario, CA',
          sale_price: 11800000,
          adjustments: 'Inferior loading (+5%), smaller lot (-2%)',
          adjusted_value: 12154000,
        },
        {
          comp_id: 'Comp 2',
          comp_address: '8901 Commerce Dr, Rancho Cucamonga, CA',
          sale_price: 13200000,
          adjustments: 'Superior HVAC (-3%), better frontage (-2%)',
          adjusted_value: 12540000,
        },
      ],
      key_findings: [
        'Property cap rate of 5.2% is in line with market',
        'Clear height of 32 feet meets modern logistics requirements',
        'ESFR fire suppression is a value-add feature',
        '100% occupied with credit tenant on 5-year lease',
      ],
      recommendations: [
        'Target acquisition price of $12M for 5.5% cap rate',
        'Verify HVAC condition - may need replacement in 3-5 years',
        'Review lease escalations and renewal probability',
      ],
      market_insights:
        'The Inland Empire industrial market continues to outperform with <2% vacancy. E-commerce and last-mile logistics are driving demand. Cap rate compression has slowed but prices remain elevated.',
    });

    const result = parseValuationResponse(response);

    // Verify all key metrics are captured
    expect(result.estimated_value).toBe(12500000);
    expect(result.price_per_sqft_estimate).toBe(250);
    expect(result.confidence_level).toBe('High');

    // Verify value range makes sense
    expect(result.value_range.low).toBeLessThan(result.estimated_value);
    expect(result.value_range.high).toBeGreaterThan(result.estimated_value);

    // Verify comparables are parsed correctly
    expect(result.comparable_analysis).toHaveLength(2);
    expect(result.comparable_analysis[0].adjusted_value).toBe(12154000);
    expect(result.comparable_analysis[1].comp_address).toContain(
      'Rancho Cucamonga'
    );

    // Verify findings and recommendations
    expect(result.key_findings.length).toBeGreaterThan(0);
    expect(result.recommendations.length).toBeGreaterThan(0);

    // Verify market insights
    expect(result.market_insights).toContain('Inland Empire');
  });
});
