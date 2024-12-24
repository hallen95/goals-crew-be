import type { CallHandler } from '@nestjs/common';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { Test, type TestingModule } from '@nestjs/testing';
import { lastValueFrom, of } from 'rxjs';
import { createMock } from 'ts-auto-mock';

import type { User } from '../../user/entities/user.entity';
import { TokenInterceptor } from './token.interceptor';
import { AuthService } from '../auth.service';
import { Response } from 'express';

describe('TokenInterceptor', () => {
  let interceptor: TokenInterceptor;
  let mockedAuthService: jest.Mocked<AuthService>;
  let mockResponse: jest.Mocked<Response>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TokenInterceptor],
    })
      .useMocker(token => {
        if (Object.is(token, AuthService)) {
          return createMock<AuthService>();
        }
      })
      .compile();

    interceptor = module.get<TokenInterceptor>(TokenInterceptor);
    mockedAuthService = module.get<AuthService, jest.Mocked<AuthService>>(
      AuthService,
    );
    const headers: Record<string, string> = {};
    mockResponse = {
      cookie: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
      setHeader: jest.fn((key, value) => {
        headers[key] = value;
      }),
    } as unknown as jest.Mocked<Response>;
  });

  it('should add the token to the response', async () => {
    const user = createMock<User>();
    const context = new ExecutionContextHost([{}, mockResponse]);
    const next = createMock<CallHandler<User>>({
      handle: () => of(user),
    });

    mockedAuthService.signToken.mockReturnValueOnce('j.w.t');
    mockedAuthService.signRefreshToken.mockReturnValueOnce('refresh.j.w.t');

    await expect(
      lastValueFrom(interceptor.intercept(context, next)),
    ).resolves.toEqual(user);

    expect(mockResponse.setHeader).toHaveBeenCalledWith(
      'Authorization',
      'Bearer j.w.t',
    );
    expect(mockResponse.cookie).toHaveBeenCalledWith(
      'refreshToken',
      'refresh.j.w.t',
      expect.objectContaining({
        httpOnly: true,
        signed: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
      }),
    );
  });
});
