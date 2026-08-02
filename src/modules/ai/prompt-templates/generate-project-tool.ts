import type { ChatCompletionTool } from 'openai/resources/chat/completions';

/**
 * The single tool the model is allowed to call when generating a new
 * project from a prompt. Constraining output to this schema (rather
 * than free-form text) is what makes the response parseable and
 * safe to apply programmatically - see file-op-parser.ts for the
 * validation that runs on whatever comes back.
 */
export const GENERATE_PROJECT_TOOL: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'create_project_files',
    description:
      'Create the initial set of files for a new project based on the user\'s description.',
    parameters: {
      type: 'object',
      properties: {
        designPlan: {
          type: 'string',
          description:
            'Written BEFORE any files, in this order: (1) app category and its ' +
            'typical design language (e.g. plant care = natural/organic/image-led, ' +
            'finance = minimal/trustworthy, fitness = bold/energetic, ecommerce = ' +
            'conversion-focused product presentation), (2) the target user and the ' +
            'single most important piece of information on the main screen, (3) if a ' +
            'design reference image was provided, a description of its concrete ' +
            'layout, color palette, spacing, and component choices to match - not just ' +
            'its general theme, (4) the color palette, type scale, spacing unit, and ' +
            'border-radius/shadow style you will use consistently across every file.',
        },
        summary: {
          type: 'string',
          description: 'One or two sentences describing what was built.',
        },
        files: {
          type: 'array',
          description: 'Every file to create, with its full path and content.',
          items: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description:
                  'Relative file path, e.g. "src/App.tsx". Never starts with / and never contains "..".',
              },
              content: {
                type: 'string',
                description: 'The complete file contents.',
              },
            },
            required: ['path', 'content'],
          },
        },
      },
      required: ['designPlan', 'summary', 'files'],
    },
  },
};
