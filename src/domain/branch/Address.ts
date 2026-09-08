export interface Address {
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
}

export function emptyAddress(): Address {
  return { street: '', houseNumber: '', postalCode: '', city: '' };
}
