import { isCheckViolation, isDuplicateKeyError } from '../db';

// Turns MySQL constraint errors into clear 4xx responses for the admin forms.
//   ER_DUP_ENTRY                 → 409 (a UNIQUE value such as a reference number is taken)
//   ER_CHECK_CONSTRAINT_VIOLATED → 422 (a business rule enforced by a CHECK failed)
// Returns null for any other error so the caller can rethrow it.
export function dbConflict(
  err: unknown,
): { status: number; body: { error: string; fields?: Record<string, string[]> } } | null {
  if (isDuplicateKeyError(err)) {
    const msg = String((err as { cause?: { sqlMessage?: string } })?.cause?.sqlMessage ?? '');
    if (msg.includes('reference_number')) {
      return {
        status: 409,
        body: {
          error: 'Reference number is already used by another unit',
          fields: { referenceNumber: ['Already used by another unit'] },
        },
      };
    }
    return { status: 409, body: { error: 'A record with the same unique value already exists' } };
  }
  if (isCheckViolation(err)) {
    return { status: 422, body: { error: 'The data breaks a database rule (CHECK constraint)' } };
  }
  return null;
}
