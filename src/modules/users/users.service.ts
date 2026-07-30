import { Injectable } from '@nestjs/common';

@Injectable()
export class UsersService {
  // TODO: CRUD against the `profiles` table via Supabase client.
  async findById(_id: string) {
    throw new Error('Not implemented');
  }
}
