export class StatisticAggregates<TKey extends string | number, TValue> {
  readonly total: TValue | undefined;
  private readonly aggregates: Map<TKey, TValue>;

  constructor(aggregates: Map<TKey, TValue>, total: TValue | undefined) {
    this.aggregates = aggregates;
    this.total = total;
  }

  get(key: TKey): TValue | undefined {
    return this.aggregates.get(key);
  }
}

export abstract class StatisticAggregatesBuilder<
  TKey extends string | number,
  TValue,
> {
  private readonly aggregates = new Map<TKey, TValue>();

  protected abstract combine(left: TValue, right: TValue): TValue;

  get(key: TKey): TValue {
    return this.aggregates.get(key) ?? this.zero();
  }

  set(key: TKey, value: TValue): void {
    this.aggregates.set(key, value);
  }

  increment(key: TKey, amount: TValue): void {
    this.set(key, this.combine(this.get(key), amount));
  }

  getTotal(): TValue | undefined {
    if (this.aggregates.size === 0) return undefined;
    let total = this.zero();
    for (const value of this.aggregates.values()) {
      total = this.combine(total, value);
    }
    return total;
  }

  build(): StatisticAggregates<TKey, TValue> {
    return new StatisticAggregates(new Map(this.aggregates), this.getTotal());
  }

  protected abstract zero(): TValue;
}

export class CountsBuilder<TKey extends string | number> extends StatisticAggregatesBuilder<
  TKey,
  number
> {
  protected combine(left: number, right: number): number {
    return left + right;
  }

  protected zero(): number {
    return 0;
  }
}

export class AmountsBuilder<TKey extends string | number> extends StatisticAggregatesBuilder<
  TKey,
  number
> {
  protected combine(left: number, right: number): number {
    return left + right;
  }

  protected zero(): number {
    return 0;
  }
}
