export const ADDRESS_PLACEHOLDERS = {
  street: '[Straße und Hausnummer]',
  zip: '[PLZ]',
  city: '[Ort]',
} as const;

export interface AddressInput {
  street?: string | undefined;
  zip?: string | undefined;
  city?: string | undefined;
}

export interface Address {
  street: string;
  zip: string;
  city: string;
  /** True when at least one value was missing and a placeholder is shown instead. */
  isPlaceholder: boolean;
}

/**
 * The postal address comes from build variables (never from the repository).
 * Missing or blank values fall back to placeholders so local and CI builds still work.
 * The production build fails earlier (see astro.config.mjs) when the variables are missing.
 */
export function resolveAddress(input: AddressInput): Address {
  const street = clean(input.street);
  const zip = clean(input.zip);
  const city = clean(input.city);

  return {
    street: street ?? ADDRESS_PLACEHOLDERS.street,
    zip: zip ?? ADDRESS_PLACEHOLDERS.zip,
    city: city ?? ADDRESS_PLACEHOLDERS.city,
    isPlaceholder: street === undefined || zip === undefined || city === undefined,
  };
}

/** Trimmed value, or undefined when it is missing or blank. */
function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed === '' ? undefined : trimmed;
}
