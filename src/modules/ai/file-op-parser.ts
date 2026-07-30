/**
 * Parses the structured tool-call output returned by OpenAI into a
 * typed, validated list of file operations. This is the boundary
 * between "untrusted model output" and "operations the SandboxService
 * is allowed to execute."
 */

export type FileOperation =
  | { type: 'create_file'; path: string; content: string }
  | { type: 'update_file'; path: string; content: string }
  | { type: 'delete_file'; path: string }
  | { type: 'run_command'; command: string; timeoutMs: number };

const DISALLOWED_COMMAND_PATTERNS = [/rm\s+-rf\s+\//, /curl.*\|\s*sh/, /:\(\)\{/];

export function parseAndValidateFileOps(raw: unknown): FileOperation[] {
  // TODO: implement real parsing from the OpenAI tool-call schema.
  const ops = raw as FileOperation[];

  for (const op of ops) {
    if ('path' in op && (op.path.includes('..') || op.path.startsWith('/'))) {
      throw new Error(`Rejected unsafe path: ${op.path}`);
    }
    if (op.type === 'run_command') {
      if (DISALLOWED_COMMAND_PATTERNS.some((p) => p.test(op.command))) {
        throw new Error(`Rejected disallowed command: ${op.command}`);
      }
    }
  }

  return ops;
}
