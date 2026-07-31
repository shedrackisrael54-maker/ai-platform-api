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

export interface GeneratedFile {
  path: string;
  content: string;
}

const MAX_FILE_COUNT = 30;
const MAX_FILE_SIZE_BYTES = 200_000;

/**
 * Validates the file list returned by the create_project_files tool
 * (used for initial project generation - see generate-project-tool.ts).
 * Same safety principles as parseAndValidateFileOps: untrusted model
 * output must never reach storage unchecked.
 */
export function validateGeneratedFiles(raw: unknown): GeneratedFile[] {
  if (!Array.isArray(raw)) {
    throw new Error('Expected an array of files from the model');
  }
  if (raw.length === 0) {
    throw new Error('Model returned no files');
  }
  if (raw.length > MAX_FILE_COUNT) {
    throw new Error(`Model returned too many files (${raw.length} > ${MAX_FILE_COUNT})`);
  }

  const files = raw as GeneratedFile[];
  const seenPaths = new Set<string>();

  for (const file of files) {
    if (typeof file.path !== 'string' || typeof file.content !== 'string') {
      throw new Error('Each file must have a string path and string content');
    }
    if (file.path.includes('..') || file.path.startsWith('/')) {
      throw new Error(`Rejected unsafe path: ${file.path}`);
    }
    if (file.path.trim().length === 0) {
      throw new Error('Rejected empty file path');
    }
    if (Buffer.byteLength(file.content, 'utf8') > MAX_FILE_SIZE_BYTES) {
      throw new Error(`File too large: ${file.path}`);
    }
    if (seenPaths.has(file.path)) {
      throw new Error(`Duplicate file path: ${file.path}`);
    }
    seenPaths.add(file.path);
  }

  return files;
}
