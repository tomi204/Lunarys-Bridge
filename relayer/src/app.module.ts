import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: 'database.sqlite',
      synchronize: true, 
      autoLoadEntities: true,
      logging: ['error', 'warn'],
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
