import type { ChatCompletionTool } from 'openai/resources/chat/completions';

/**
 * The tool the model calls when the user requests a change to an
 * existing project (Milestone 5 - chat-based iterative editing).
 * Unlike the initial-generation tool (generate-project-tool.ts),
 * this one can create, update, AND delete files, since it's editing
 * an existing project rather than starting from nothing.
 */
export const EDIT_PROJECT_TOOL: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'apply_project_changes',
    description:
      "Apply the user's requested change to the project by creating, updating, or deleting files.",
    parameters: {
      type: 'object',
      properties: {
        summary: {
          type: 'string',
          description: 'One or two sentences describing what changed.',
        },
        operations: {
          type: 'array',
          description: 'The file operations needed to make the requested change.',
          items: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['create_file', 'update_file', 'delete_file'],
              },
              path: {
                type: 'string',
                description:
                  'Relative file path, e.g. "index.html". Never starts with / and never contains "..". Must match an existing file for update_file/delete_file.',
              },
              content: {
                type: 'string',
                description:
                  'Full new file content. Required for create_file and update_file, omitted for delete_file. Always the COMPLETE file, never a diff.',
              },
            },
            required: ['type', 'path'],
          },
        },
      },
      required: ['summary', 'operations'],
    },
  },
};
