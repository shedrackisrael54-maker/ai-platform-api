import { Injectable } from '@nestjs/common';
import type {
  ExecResult,
  ISandboxProvider,
  SandboxStatus,
} from './sandbox-provider.interface';

/**
 * E2B-backed implementation of ISandboxProvider. All E2B SDK calls
 * live in this file and nowhere else in the codebase.
 */
@Injectable()
export class E2bProvider implements ISandboxProvider {
  async createSandbox(_projectId: string): Promise<SandboxStatus> {
    // TODO: call E2B SDK to create a sandbox, clone the project repo
    // into it, run install, expose the dev server port.
    throw new Error('Not implemented');
  }

  async destroySandbox(_projectId: string): Promise<void> {
    throw new Error('Not implemented');
  }

  async getStatus(_projectId: string): Promise<SandboxStatus> {
    throw new Error('Not implemented');
  }

  async exec(_projectId: string, _command: string): Promise<ExecResult> {
    throw new Error('Not implemented');
  }

  async writeFile(
    _projectId: string,
    _path: string,
    _content: string,
  ): Promise<void> {
    throw new Error('Not implemented');
  }

  async readFile(_projectId: string, _path: string): Promise<string> {
    throw new Error('Not implemented');
  }

  async deleteFile(_projectId: string, _path: string): Promise<void> {
    throw new Error('Not implemented');
  }
}
