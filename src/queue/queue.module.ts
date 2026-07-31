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
      useFactory: (config: ConfigService) => {
        // Railway (and most hosts) provide a single REDIS_URL for
        // their managed Redis add-on. Local dev instead uses separate
        // REDIS_HOST/REDIS_PORT values. Support both so the same code
        // runs unmodified in either environment.
        const redisUrl = config.get<string>('redis.url');
        if (redisUrl) {
          const parsed = new URL(redisUrl);
          return {
            connection: {
              host: parsed.hostname,
              port: Number(parsed.port),
              username: parsed.username || undefined,
              password: parsed.password || undefined,
              tls: parsed.protocol === 'rediss:' ? {} : undefined,
            },
          };
        }
        return {
          connection: {
            host: config.get('redis.host'),
            port: config.get('redis.port'),
          },
        };
      },
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

