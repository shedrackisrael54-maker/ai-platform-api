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
      required: ['summary', 'files'],
    },
  },
};
