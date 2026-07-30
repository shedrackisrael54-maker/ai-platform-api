import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SandboxBootProcessor } from './processors/sandbox-boot.processor';
import { AiGenerationProcessor } from './processors/ai-generation.processor';
import { DeploymentProcessor } from './processors/deployment.processor';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get('redis.host'),
          port: config.get('redis.port'),
        },
      }),
    }),
    BullModule.registerQueue(
      { name: 'sandbox-boot' },
      { name: 'ai-generation' },
      { name: 'deployment' },
    ),
  ],
  providers: [
    SandboxBootProcessor,
    AiGenerationProcessor,
    DeploymentProcessor,
  ],
  exports: [BullModule],
})
export class QueueModule {}
