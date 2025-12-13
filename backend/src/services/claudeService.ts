import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config/env';
import { AppError } from '../middleware/errorHandler';

/**
 * Claude API client
 */
const anthropic = new Anthropic({
  apiKey: config.anthropic.apiKey,
});

/**
 * Claude API request parameters
 */
export interface ClaudeRequest {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
}

/**
 * Claude API response
 */
export interface ClaudeResponse {
  content: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

/**
 * Call Claude API for text generation
 *
 * @param params - Request parameters
 * @returns Claude's response
 */
export const callClaude = async (params: ClaudeRequest): Promise<ClaudeResponse> => {
  try {
    // Check if API key is configured
    if (!config.anthropic.apiKey) {
      console.error('[ClaudeService] ANTHROPIC_API_KEY is not configured');
      throw new AppError(500, 'AI extraction is not configured. Please contact support.');
    }

    const {
      prompt,
      systemPrompt = 'You are a commercial real estate data extraction assistant.',
      maxTokens = 4096,
      temperature = 0,
    } = params;

    console.log(`[ClaudeService] Calling Claude API with model: ${config.anthropic.model}`);

    const message = await anthropic.messages.create({
      model: config.anthropic.model,
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    console.log(`[ClaudeService] Claude API response received, tokens: ${message.usage.input_tokens} in, ${message.usage.output_tokens} out`);

    // Extract text content from response
    const textContent = message.content.find((block) => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new AppError(500, 'No text content in Claude response');
    }

    return {
      content: textContent.text,
      usage: {
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
      },
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    // Handle Anthropic API errors
    if (error instanceof Anthropic.APIError) {
      console.error('Claude API error:', error.status, error.message);
      throw new AppError(500, `Claude API error: ${error.message}`);
    }

    console.error('Claude service error:', error);
    throw new AppError(500, 'Failed to call Claude API');
  }
};

/**
 * Parse JSON from Claude's response
 * Handles both plain JSON and JSON wrapped in markdown code blocks
 */
export const parseClaudeJSON = <T>(content: string): T => {
  try {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    const jsonString = jsonMatch ? jsonMatch[1].trim() : content.trim();

    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Failed to parse Claude JSON response:', error);
    throw new AppError(500, 'Failed to parse Claude response as JSON');
  }
};
