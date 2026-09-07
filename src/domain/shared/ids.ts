export type FilialId = string & { readonly __brand: 'FilialId' };
export type MitarbeiterId = string & { readonly __brand: 'MitarbeiterId' };
export type WochenplanId = string & { readonly __brand: 'WochenplanId' };
export type AbwesenheitId = string & { readonly __brand: 'AbwesenheitId' };

export function neueId<T extends string>(): T {
  return crypto.randomUUID() as T;
}
