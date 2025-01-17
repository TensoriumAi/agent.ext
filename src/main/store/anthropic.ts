import Anthropic from '@anthropic-ai/sdk';
import { BetaMessageParam } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import dotenv from 'dotenv';
import { serviceRegistry } from '../serviceRegistry';

dotenv.config();

export interface AnthropicService {
  createVisionMessage: (
    systemPrompt: string,
    messages: BetaMessageParam[],
    tools: any[],
    getAiScaledScreenDimensions: () => { width: number; height: number }
  ) => Promise<any>;
  createMessage: (
    systemPrompt: string,
    messages: BetaMessageParam[]
  ) => Promise<any>;
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const anthropicService: AnthropicService = {
  createVisionMessage: async (
    systemPrompt: string,
    messages: BetaMessageParam[],
    tools: any[],
    getAiScaledScreenDimensions: () => { width: number; height: number }
  ) => {
    return await anthropic.beta.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages,
      tools: [
        {
          type: 'computer_20241022',
          name: 'computer',
          display_width_px: getAiScaledScreenDimensions().width,
          display_height_px: getAiScaledScreenDimensions().height,
          display_number: 1,
        },
        {
          name: 'finish_run',
          description:
            'Call this function when you have achieved the goal of the task.',
          input_schema: {
            type: 'object',
            properties: {
              success: {
                type: 'boolean',
                description: 'Whether the task was successful',
              },
              error: {
                type: 'string',
                description: 'The error message if the task was not successful',
              },
            },
            required: ['success'],
          },
        },
        ...tools,
      ],
      betas: ['computer-use-2024-10-22'],
    });
  },
  createMessage: async (
    systemPrompt: string,
    messages: BetaMessageParam[]
  ) => {
    return await anthropic.beta.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages,
    });
  },
};

// Register the anthropic service with the service registry
serviceRegistry.register('anthropic', anthropicService);
