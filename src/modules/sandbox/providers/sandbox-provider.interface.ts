export interface SandboxStatus {
  state: 'provisioning' | 'running' | 'stopped' | 'error';
  previewUrl?: string;
}

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Abstraction over "a place that can run this project's code."
 * E2bProvider is the initial implementation; a future self-hosted
 * Firecracker/gVisor-based provider implements the same interface,
 * validated in parallel (see architecture doc, milestone M11) before
 * cutover.
 */
export interface ISandboxProvider {
  createSandbox(projectId: string): Promise<SandboxStatus>;
  destroySandbox(projectId: string): Promise<void>;
  getStatus(projectId: string): Promise<SandboxStatus>;
  exec(projectId: string, command: string): Promise<ExecResult>;
  writeFile(projectId: string, path: string, content: string): Promise<void>;
  readFile(projectId: string, path: string): Promise<string>;
  deleteFile(projectId: string, path: string): Promise<void>;
}
