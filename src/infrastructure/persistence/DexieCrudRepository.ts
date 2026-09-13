import type { IndexableType, Table } from 'dexie';

/** The generic CRUD behind every Dexie repository in this app - findAll/findById/save/delete/
 * deleteAll were byte-identical across all five aggregates, differing only in which Dexie `Table`
 * they wrap. Each concrete repository extends this for the shared behavior and adds only its own
 * aggregate-specific finders (findByBranch, findByEmployee, findByBranchAndWeek, ...).
 *
 * Not every port interface declares `findById` yet (Absence and ShiftTemplate don't) - extending
 * this base class gives their concrete classes the method anyway, ready for the port interfaces to
 * catch up later, rather than each repository re-deciding whether to expose it. */
export class DexieCrudRepository<T, TId extends IndexableType> {
  protected constructor(private readonly table: Table<T, TId>) {}

  async findAll(): Promise<T[]> {
    return this.table.toArray();
  }

  async findById(id: TId): Promise<T | null> {
    return (await this.table.get(id)) ?? null;
  }

  async save(entity: T): Promise<void> {
    await this.table.put(entity);
  }

  async delete(id: TId): Promise<void> {
    await this.table.delete(id);
  }

  async deleteAll(): Promise<void> {
    await this.table.clear();
  }
}
