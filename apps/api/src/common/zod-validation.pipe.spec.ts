import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe.js';

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe(
    z.object({ name: z.string().trim().min(1), size: z.number().default(1) }),
  );

  it('returns the parsed value with defaults applied', () => {
    expect(pipe.transform({ name: ' flow ' })).toEqual({
      name: 'flow',
      size: 1,
    });
  });

  it('throws a 400 listing every issue path', () => {
    try {
      pipe.transform({ name: '', size: 'big' });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      const body = (error as BadRequestException).getResponse() as {
        message: string;
        issues: { path: unknown[] }[];
      };
      expect(body.message).toBe('Validation failed');
      expect(body.issues.map((issue) => issue.path)).toEqual([
        ['name'],
        ['size'],
      ]);
    }
  });
});
