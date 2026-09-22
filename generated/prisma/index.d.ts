
/**
 * Client
**/

import * as runtime from './runtime/library.js';
import $Types = runtime.Types // general types
import $Public = runtime.Types.Public
import $Utils = runtime.Types.Utils
import $Extensions = runtime.Types.Extensions
import $Result = runtime.Types.Result

export type PrismaPromise<T> = $Public.PrismaPromise<T>


/**
 * Model Department
 * Admin-configured production department (constitution VI: data, not an enum).
 */
export type Department = $Result.DefaultSelection<Prisma.$DepartmentPayload>
/**
 * Model Customer
 * 
 */
export type Customer = $Result.DefaultSelection<Prisma.$CustomerPayload>
/**
 * Model Order
 * 
 */
export type Order = $Result.DefaultSelection<Prisma.$OrderPayload>
/**
 * Model WorkItem
 * 
 */
export type WorkItem = $Result.DefaultSelection<Prisma.$WorkItemPayload>
/**
 * Model WorkItemTransition
 * Immutable — application code never updates or deletes a row here (constitution III).
 */
export type WorkItemTransition = $Result.DefaultSelection<Prisma.$WorkItemTransitionPayload>
/**
 * Model PhaseTiming
 * Timestamped segments, not a stopwatch (constitution III, FR-009).
 */
export type PhaseTiming = $Result.DefaultSelection<Prisma.$PhaseTimingPayload>
/**
 * Model NotificationEvent
 * Outbox — polymorphic via entityType/entityId, not a Prisma relation.
 */
export type NotificationEvent = $Result.DefaultSelection<Prisma.$NotificationEventPayload>
/**
 * Model User
 * 
 */
export type User = $Result.DefaultSelection<Prisma.$UserPayload>
/**
 * Model Session
 * 
 */
export type Session = $Result.DefaultSelection<Prisma.$SessionPayload>
/**
 * Model Account
 * 
 */
export type Account = $Result.DefaultSelection<Prisma.$AccountPayload>
/**
 * Model Verification
 * 
 */
export type Verification = $Result.DefaultSelection<Prisma.$VerificationPayload>

/**
 * Enums
 */
export namespace $Enums {
  export const WorkItemState: {
  NEW: 'NEW',
  ASSIGNED: 'ASSIGNED',
  IN_DESIGN: 'IN_DESIGN',
  DESIGN_COMPLETED: 'DESIGN_COMPLETED',
  WAITING_REVIEW: 'WAITING_REVIEW',
  REWORK_REQUIRED: 'REWORK_REQUIRED',
  APPROVED: 'APPROVED',
  WAITING_PRICING: 'WAITING_PRICING',
  READY_FOR_PRODUCTION: 'READY_FOR_PRODUCTION',
  IN_PRODUCTION: 'IN_PRODUCTION',
  PRODUCTION_COMPLETED: 'PRODUCTION_COMPLETED',
  READY_FOR_COLLECTION: 'READY_FOR_COLLECTION',
  DELIVERED: 'DELIVERED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED'
};

export type WorkItemState = (typeof WorkItemState)[keyof typeof WorkItemState]


export const OrderChannel: {
  WALK_IN: 'WALK_IN',
  WHATSAPP: 'WHATSAPP',
  PHONE: 'PHONE',
  RETURNING: 'RETURNING',
  DIRECT_TO_DESIGNER: 'DIRECT_TO_DESIGNER'
};

export type OrderChannel = (typeof OrderChannel)[keyof typeof OrderChannel]


export const OrderPriority: {
  NORMAL: 'NORMAL',
  URGENT: 'URGENT'
};

export type OrderPriority = (typeof OrderPriority)[keyof typeof OrderPriority]


export const OrderMode: {
  GROUPED: 'GROUPED',
  SEPARATE: 'SEPARATE'
};

export type OrderMode = (typeof OrderMode)[keyof typeof OrderMode]


export const PhaseTimingKind: {
  QUEUE: 'QUEUE',
  ACTIVE: 'ACTIVE'
};

export type PhaseTimingKind = (typeof PhaseTimingKind)[keyof typeof PhaseTimingKind]


export const RejectionCategory: {
  DESIGN_ISSUE: 'DESIGN_ISSUE',
  DIMENSION_ISSUE: 'DIMENSION_ISSUE',
  CUSTOMER_CHANGE: 'CUSTOMER_CHANGE',
  PRICING_ISSUE: 'PRICING_ISSUE',
  ACCOUNTING_ISSUE: 'ACCOUNTING_ISSUE',
  PRODUCTION_ISSUE: 'PRODUCTION_ISSUE',
  MISSING_INFORMATION: 'MISSING_INFORMATION',
  OTHER: 'OTHER'
};

export type RejectionCategory = (typeof RejectionCategory)[keyof typeof RejectionCategory]

}

export type WorkItemState = $Enums.WorkItemState

export const WorkItemState: typeof $Enums.WorkItemState

export type OrderChannel = $Enums.OrderChannel

export const OrderChannel: typeof $Enums.OrderChannel

export type OrderPriority = $Enums.OrderPriority

export const OrderPriority: typeof $Enums.OrderPriority

export type OrderMode = $Enums.OrderMode

export const OrderMode: typeof $Enums.OrderMode

export type PhaseTimingKind = $Enums.PhaseTimingKind

export const PhaseTimingKind: typeof $Enums.PhaseTimingKind

export type RejectionCategory = $Enums.RejectionCategory

export const RejectionCategory: typeof $Enums.RejectionCategory

/**
 * ##  Prisma Client ʲˢ
 *
 * Type-safe database client for TypeScript & Node.js
 * @example
 * ```
 * const prisma = new PrismaClient()
 * // Fetch zero or more Departments
 * const departments = await prisma.department.findMany()
 * ```
 *
 *
 * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
 */
export class PrismaClient<
  ClientOptions extends Prisma.PrismaClientOptions = Prisma.PrismaClientOptions,
  const U = 'log' extends keyof ClientOptions ? ClientOptions['log'] extends Array<Prisma.LogLevel | Prisma.LogDefinition> ? Prisma.GetEvents<ClientOptions['log']> : never : never,
  ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs
> {
  [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['other'] }

    /**
   * ##  Prisma Client ʲˢ
   *
   * Type-safe database client for TypeScript & Node.js
   * @example
   * ```
   * const prisma = new PrismaClient()
   * // Fetch zero or more Departments
   * const departments = await prisma.department.findMany()
   * ```
   *
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
   */

  constructor(optionsArg ?: Prisma.Subset<ClientOptions, Prisma.PrismaClientOptions>);
  $on<V extends U>(eventType: V, callback: (event: V extends 'query' ? Prisma.QueryEvent : Prisma.LogEvent) => void): PrismaClient;

  /**
   * Connect with the database
   */
  $connect(): $Utils.JsPromise<void>;

  /**
   * Disconnect from the database
   */
  $disconnect(): $Utils.JsPromise<void>;

/**
   * Executes a prepared raw query and returns the number of affected rows.
   * @example
   * ```
   * const result = await prisma.$executeRaw`UPDATE User SET cool = ${true} WHERE email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Executes a raw query and returns the number of affected rows.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$executeRawUnsafe('UPDATE User SET cool = $1 WHERE email = $2 ;', true, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Performs a prepared raw query and returns the `SELECT` data.
   * @example
   * ```
   * const result = await prisma.$queryRaw`SELECT * FROM User WHERE id = ${1} OR email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<T>;

  /**
   * Performs a raw query and returns the `SELECT` data.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$queryRawUnsafe('SELECT * FROM User WHERE id = $1 OR email = $2;', 1, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<T>;


  /**
   * Allows the running of a sequence of read/write operations that are guaranteed to either succeed or fail as a whole.
   * @example
   * ```
   * const [george, bob, alice] = await prisma.$transaction([
   *   prisma.user.create({ data: { name: 'George' } }),
   *   prisma.user.create({ data: { name: 'Bob' } }),
   *   prisma.user.create({ data: { name: 'Alice' } }),
   * ])
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/concepts/components/prisma-client/transactions).
   */
  $transaction<P extends Prisma.PrismaPromise<any>[]>(arg: [...P], options?: { isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<runtime.Types.Utils.UnwrapTuple<P>>

  $transaction<R>(fn: (prisma: Omit<PrismaClient, runtime.ITXClientDenyList>) => $Utils.JsPromise<R>, options?: { maxWait?: number, timeout?: number, isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<R>


  $extends: $Extensions.ExtendsHook<"extends", Prisma.TypeMapCb<ClientOptions>, ExtArgs, $Utils.Call<Prisma.TypeMapCb<ClientOptions>, {
    extArgs: ExtArgs
  }>>

      /**
   * `prisma.department`: Exposes CRUD operations for the **Department** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Departments
    * const departments = await prisma.department.findMany()
    * ```
    */
  get department(): Prisma.DepartmentDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.customer`: Exposes CRUD operations for the **Customer** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Customers
    * const customers = await prisma.customer.findMany()
    * ```
    */
  get customer(): Prisma.CustomerDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.order`: Exposes CRUD operations for the **Order** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Orders
    * const orders = await prisma.order.findMany()
    * ```
    */
  get order(): Prisma.OrderDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.workItem`: Exposes CRUD operations for the **WorkItem** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more WorkItems
    * const workItems = await prisma.workItem.findMany()
    * ```
    */
  get workItem(): Prisma.WorkItemDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.workItemTransition`: Exposes CRUD operations for the **WorkItemTransition** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more WorkItemTransitions
    * const workItemTransitions = await prisma.workItemTransition.findMany()
    * ```
    */
  get workItemTransition(): Prisma.WorkItemTransitionDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.phaseTiming`: Exposes CRUD operations for the **PhaseTiming** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more PhaseTimings
    * const phaseTimings = await prisma.phaseTiming.findMany()
    * ```
    */
  get phaseTiming(): Prisma.PhaseTimingDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.notificationEvent`: Exposes CRUD operations for the **NotificationEvent** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more NotificationEvents
    * const notificationEvents = await prisma.notificationEvent.findMany()
    * ```
    */
  get notificationEvent(): Prisma.NotificationEventDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.user`: Exposes CRUD operations for the **User** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Users
    * const users = await prisma.user.findMany()
    * ```
    */
  get user(): Prisma.UserDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.session`: Exposes CRUD operations for the **Session** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Sessions
    * const sessions = await prisma.session.findMany()
    * ```
    */
  get session(): Prisma.SessionDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.account`: Exposes CRUD operations for the **Account** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Accounts
    * const accounts = await prisma.account.findMany()
    * ```
    */
  get account(): Prisma.AccountDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.verification`: Exposes CRUD operations for the **Verification** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Verifications
    * const verifications = await prisma.verification.findMany()
    * ```
    */
  get verification(): Prisma.VerificationDelegate<ExtArgs, ClientOptions>;
}

export namespace Prisma {
  export import DMMF = runtime.DMMF

  export type PrismaPromise<T> = $Public.PrismaPromise<T>

  /**
   * Validator
   */
  export import validator = runtime.Public.validator

  /**
   * Prisma Errors
   */
  export import PrismaClientKnownRequestError = runtime.PrismaClientKnownRequestError
  export import PrismaClientUnknownRequestError = runtime.PrismaClientUnknownRequestError
  export import PrismaClientRustPanicError = runtime.PrismaClientRustPanicError
  export import PrismaClientInitializationError = runtime.PrismaClientInitializationError
  export import PrismaClientValidationError = runtime.PrismaClientValidationError

  /**
   * Re-export of sql-template-tag
   */
  export import sql = runtime.sqltag
  export import empty = runtime.empty
  export import join = runtime.join
  export import raw = runtime.raw
  export import Sql = runtime.Sql



  /**
   * Decimal.js
   */
  export import Decimal = runtime.Decimal

  export type DecimalJsLike = runtime.DecimalJsLike

  /**
   * Metrics
   */
  export type Metrics = runtime.Metrics
  export type Metric<T> = runtime.Metric<T>
  export type MetricHistogram = runtime.MetricHistogram
  export type MetricHistogramBucket = runtime.MetricHistogramBucket

  /**
  * Extensions
  */
  export import Extension = $Extensions.UserArgs
  export import getExtensionContext = runtime.Extensions.getExtensionContext
  export import Args = $Public.Args
  export import Payload = $Public.Payload
  export import Result = $Public.Result
  export import Exact = $Public.Exact

  /**
   * Prisma Client JS version: 6.19.3
   * Query Engine version: c2990dca591cba766e3b7ef5d9e8a84796e47ab7
   */
  export type PrismaVersion = {
    client: string
  }

  export const prismaVersion: PrismaVersion

  /**
   * Utility Types
   */


  export import Bytes = runtime.Bytes
  export import JsonObject = runtime.JsonObject
  export import JsonArray = runtime.JsonArray
  export import JsonValue = runtime.JsonValue
  export import InputJsonObject = runtime.InputJsonObject
  export import InputJsonArray = runtime.InputJsonArray
  export import InputJsonValue = runtime.InputJsonValue

  /**
   * Types of the values used to represent different kinds of `null` values when working with JSON fields.
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  namespace NullTypes {
    /**
    * Type of `Prisma.DbNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.DbNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class DbNull {
      private DbNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.JsonNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.JsonNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class JsonNull {
      private JsonNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.AnyNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.AnyNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class AnyNull {
      private AnyNull: never
      private constructor()
    }
  }

  /**
   * Helper for filtering JSON entries that have `null` on the database (empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const DbNull: NullTypes.DbNull

  /**
   * Helper for filtering JSON entries that have JSON `null` values (not empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const JsonNull: NullTypes.JsonNull

  /**
   * Helper for filtering JSON entries that are `Prisma.DbNull` or `Prisma.JsonNull`
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const AnyNull: NullTypes.AnyNull

  type SelectAndInclude = {
    select: any
    include: any
  }

  type SelectAndOmit = {
    select: any
    omit: any
  }

  /**
   * Get the type of the value, that the Promise holds.
   */
  export type PromiseType<T extends PromiseLike<any>> = T extends PromiseLike<infer U> ? U : T;

  /**
   * Get the return type of a function which returns a Promise.
   */
  export type PromiseReturnType<T extends (...args: any) => $Utils.JsPromise<any>> = PromiseType<ReturnType<T>>

  /**
   * From T, pick a set of properties whose keys are in the union K
   */
  type Prisma__Pick<T, K extends keyof T> = {
      [P in K]: T[P];
  };


  export type Enumerable<T> = T | Array<T>;

  export type RequiredKeys<T> = {
    [K in keyof T]-?: {} extends Prisma__Pick<T, K> ? never : K
  }[keyof T]

  export type TruthyKeys<T> = keyof {
    [K in keyof T as T[K] extends false | undefined | null ? never : K]: K
  }

  export type TrueKeys<T> = TruthyKeys<Prisma__Pick<T, RequiredKeys<T>>>

  /**
   * Subset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection
   */
  export type Subset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never;
  };

  /**
   * SelectSubset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection.
   * Additionally, it validates, if both select and include are present. If the case, it errors.
   */
  export type SelectSubset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    (T extends SelectAndInclude
      ? 'Please either choose `select` or `include`.'
      : T extends SelectAndOmit
        ? 'Please either choose `select` or `omit`.'
        : {})

  /**
   * Subset + Intersection
   * @desc From `T` pick properties that exist in `U` and intersect `K`
   */
  export type SubsetIntersection<T, U, K> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    K

  type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };

  /**
   * XOR is needed to have a real mutually exclusive union type
   * https://stackoverflow.com/questions/42123407/does-typescript-support-mutually-exclusive-types
   */
  type XOR<T, U> =
    T extends object ?
    U extends object ?
      (Without<T, U> & U) | (Without<U, T> & T)
    : U : T


  /**
   * Is T a Record?
   */
  type IsObject<T extends any> = T extends Array<any>
  ? False
  : T extends Date
  ? False
  : T extends Uint8Array
  ? False
  : T extends BigInt
  ? False
  : T extends object
  ? True
  : False


  /**
   * If it's T[], return T
   */
  export type UnEnumerate<T extends unknown> = T extends Array<infer U> ? U : T

  /**
   * From ts-toolbelt
   */

  type __Either<O extends object, K extends Key> = Omit<O, K> &
    {
      // Merge all but K
      [P in K]: Prisma__Pick<O, P & keyof O> // With K possibilities
    }[K]

  type EitherStrict<O extends object, K extends Key> = Strict<__Either<O, K>>

  type EitherLoose<O extends object, K extends Key> = ComputeRaw<__Either<O, K>>

  type _Either<
    O extends object,
    K extends Key,
    strict extends Boolean
  > = {
    1: EitherStrict<O, K>
    0: EitherLoose<O, K>
  }[strict]

  type Either<
    O extends object,
    K extends Key,
    strict extends Boolean = 1
  > = O extends unknown ? _Either<O, K, strict> : never

  export type Union = any

  type PatchUndefined<O extends object, O1 extends object> = {
    [K in keyof O]: O[K] extends undefined ? At<O1, K> : O[K]
  } & {}

  /** Helper Types for "Merge" **/
  export type IntersectOf<U extends Union> = (
    U extends unknown ? (k: U) => void : never
  ) extends (k: infer I) => void
    ? I
    : never

  export type Overwrite<O extends object, O1 extends object> = {
      [K in keyof O]: K extends keyof O1 ? O1[K] : O[K];
  } & {};

  type _Merge<U extends object> = IntersectOf<Overwrite<U, {
      [K in keyof U]-?: At<U, K>;
  }>>;

  type Key = string | number | symbol;
  type AtBasic<O extends object, K extends Key> = K extends keyof O ? O[K] : never;
  type AtStrict<O extends object, K extends Key> = O[K & keyof O];
  type AtLoose<O extends object, K extends Key> = O extends unknown ? AtStrict<O, K> : never;
  export type At<O extends object, K extends Key, strict extends Boolean = 1> = {
      1: AtStrict<O, K>;
      0: AtLoose<O, K>;
  }[strict];

  export type ComputeRaw<A extends any> = A extends Function ? A : {
    [K in keyof A]: A[K];
  } & {};

  export type OptionalFlat<O> = {
    [K in keyof O]?: O[K];
  } & {};

  type _Record<K extends keyof any, T> = {
    [P in K]: T;
  };

  // cause typescript not to expand types and preserve names
  type NoExpand<T> = T extends unknown ? T : never;

  // this type assumes the passed object is entirely optional
  type AtLeast<O extends object, K extends string> = NoExpand<
    O extends unknown
    ? | (K extends keyof O ? { [P in K]: O[P] } & O : O)
      | {[P in keyof O as P extends K ? P : never]-?: O[P]} & O
    : never>;

  type _Strict<U, _U = U> = U extends unknown ? U & OptionalFlat<_Record<Exclude<Keys<_U>, keyof U>, never>> : never;

  export type Strict<U extends object> = ComputeRaw<_Strict<U>>;
  /** End Helper Types for "Merge" **/

  export type Merge<U extends object> = ComputeRaw<_Merge<Strict<U>>>;

  /**
  A [[Boolean]]
  */
  export type Boolean = True | False

  // /**
  // 1
  // */
  export type True = 1

  /**
  0
  */
  export type False = 0

  export type Not<B extends Boolean> = {
    0: 1
    1: 0
  }[B]

  export type Extends<A1 extends any, A2 extends any> = [A1] extends [never]
    ? 0 // anything `never` is false
    : A1 extends A2
    ? 1
    : 0

  export type Has<U extends Union, U1 extends Union> = Not<
    Extends<Exclude<U1, U>, U1>
  >

  export type Or<B1 extends Boolean, B2 extends Boolean> = {
    0: {
      0: 0
      1: 1
    }
    1: {
      0: 1
      1: 1
    }
  }[B1][B2]

  export type Keys<U extends Union> = U extends unknown ? keyof U : never

  type Cast<A, B> = A extends B ? A : B;

  export const type: unique symbol;



  /**
   * Used by group by
   */

  export type GetScalarType<T, O> = O extends object ? {
    [P in keyof T]: P extends keyof O
      ? O[P]
      : never
  } : never

  type FieldPaths<
    T,
    U = Omit<T, '_avg' | '_sum' | '_count' | '_min' | '_max'>
  > = IsObject<T> extends True ? U : T

  type GetHavingFields<T> = {
    [K in keyof T]: Or<
      Or<Extends<'OR', K>, Extends<'AND', K>>,
      Extends<'NOT', K>
    > extends True
      ? // infer is only needed to not hit TS limit
        // based on the brilliant idea of Pierre-Antoine Mills
        // https://github.com/microsoft/TypeScript/issues/30188#issuecomment-478938437
        T[K] extends infer TK
        ? GetHavingFields<UnEnumerate<TK> extends object ? Merge<UnEnumerate<TK>> : never>
        : never
      : {} extends FieldPaths<T[K]>
      ? never
      : K
  }[keyof T]

  /**
   * Convert tuple to union
   */
  type _TupleToUnion<T> = T extends (infer E)[] ? E : never
  type TupleToUnion<K extends readonly any[]> = _TupleToUnion<K>
  type MaybeTupleToUnion<T> = T extends any[] ? TupleToUnion<T> : T

  /**
   * Like `Pick`, but additionally can also accept an array of keys
   */
  type PickEnumerable<T, K extends Enumerable<keyof T> | keyof T> = Prisma__Pick<T, MaybeTupleToUnion<K>>

  /**
   * Exclude all keys with underscores
   */
  type ExcludeUnderscoreKeys<T extends string> = T extends `_${string}` ? never : T


  export type FieldRef<Model, FieldType> = runtime.FieldRef<Model, FieldType>

  type FieldRefInputType<Model, FieldType> = Model extends never ? never : FieldRef<Model, FieldType>


  export const ModelName: {
    Department: 'Department',
    Customer: 'Customer',
    Order: 'Order',
    WorkItem: 'WorkItem',
    WorkItemTransition: 'WorkItemTransition',
    PhaseTiming: 'PhaseTiming',
    NotificationEvent: 'NotificationEvent',
    User: 'User',
    Session: 'Session',
    Account: 'Account',
    Verification: 'Verification'
  };

  export type ModelName = (typeof ModelName)[keyof typeof ModelName]


  export type Datasources = {
    db?: Datasource
  }

  interface TypeMapCb<ClientOptions = {}> extends $Utils.Fn<{extArgs: $Extensions.InternalArgs }, $Utils.Record<string, any>> {
    returns: Prisma.TypeMap<this['params']['extArgs'], ClientOptions extends { omit: infer OmitOptions } ? OmitOptions : {}>
  }

  export type TypeMap<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> = {
    globalOmitOptions: {
      omit: GlobalOmitOptions
    }
    meta: {
      modelProps: "department" | "customer" | "order" | "workItem" | "workItemTransition" | "phaseTiming" | "notificationEvent" | "user" | "session" | "account" | "verification"
      txIsolationLevel: Prisma.TransactionIsolationLevel
    }
    model: {
      Department: {
        payload: Prisma.$DepartmentPayload<ExtArgs>
        fields: Prisma.DepartmentFieldRefs
        operations: {
          findUnique: {
            args: Prisma.DepartmentFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DepartmentPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.DepartmentFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DepartmentPayload>
          }
          findFirst: {
            args: Prisma.DepartmentFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DepartmentPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.DepartmentFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DepartmentPayload>
          }
          findMany: {
            args: Prisma.DepartmentFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DepartmentPayload>[]
          }
          create: {
            args: Prisma.DepartmentCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DepartmentPayload>
          }
          createMany: {
            args: Prisma.DepartmentCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.DepartmentCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DepartmentPayload>[]
          }
          delete: {
            args: Prisma.DepartmentDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DepartmentPayload>
          }
          update: {
            args: Prisma.DepartmentUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DepartmentPayload>
          }
          deleteMany: {
            args: Prisma.DepartmentDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.DepartmentUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.DepartmentUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DepartmentPayload>[]
          }
          upsert: {
            args: Prisma.DepartmentUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DepartmentPayload>
          }
          aggregate: {
            args: Prisma.DepartmentAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateDepartment>
          }
          groupBy: {
            args: Prisma.DepartmentGroupByArgs<ExtArgs>
            result: $Utils.Optional<DepartmentGroupByOutputType>[]
          }
          count: {
            args: Prisma.DepartmentCountArgs<ExtArgs>
            result: $Utils.Optional<DepartmentCountAggregateOutputType> | number
          }
        }
      }
      Customer: {
        payload: Prisma.$CustomerPayload<ExtArgs>
        fields: Prisma.CustomerFieldRefs
        operations: {
          findUnique: {
            args: Prisma.CustomerFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CustomerPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.CustomerFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CustomerPayload>
          }
          findFirst: {
            args: Prisma.CustomerFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CustomerPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.CustomerFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CustomerPayload>
          }
          findMany: {
            args: Prisma.CustomerFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CustomerPayload>[]
          }
          create: {
            args: Prisma.CustomerCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CustomerPayload>
          }
          createMany: {
            args: Prisma.CustomerCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.CustomerCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CustomerPayload>[]
          }
          delete: {
            args: Prisma.CustomerDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CustomerPayload>
          }
          update: {
            args: Prisma.CustomerUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CustomerPayload>
          }
          deleteMany: {
            args: Prisma.CustomerDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.CustomerUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.CustomerUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CustomerPayload>[]
          }
          upsert: {
            args: Prisma.CustomerUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CustomerPayload>
          }
          aggregate: {
            args: Prisma.CustomerAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateCustomer>
          }
          groupBy: {
            args: Prisma.CustomerGroupByArgs<ExtArgs>
            result: $Utils.Optional<CustomerGroupByOutputType>[]
          }
          count: {
            args: Prisma.CustomerCountArgs<ExtArgs>
            result: $Utils.Optional<CustomerCountAggregateOutputType> | number
          }
        }
      }
      Order: {
        payload: Prisma.$OrderPayload<ExtArgs>
        fields: Prisma.OrderFieldRefs
        operations: {
          findUnique: {
            args: Prisma.OrderFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OrderPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.OrderFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OrderPayload>
          }
          findFirst: {
            args: Prisma.OrderFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OrderPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.OrderFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OrderPayload>
          }
          findMany: {
            args: Prisma.OrderFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OrderPayload>[]
          }
          create: {
            args: Prisma.OrderCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OrderPayload>
          }
          createMany: {
            args: Prisma.OrderCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.OrderCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OrderPayload>[]
          }
          delete: {
            args: Prisma.OrderDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OrderPayload>
          }
          update: {
            args: Prisma.OrderUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OrderPayload>
          }
          deleteMany: {
            args: Prisma.OrderDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.OrderUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.OrderUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OrderPayload>[]
          }
          upsert: {
            args: Prisma.OrderUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OrderPayload>
          }
          aggregate: {
            args: Prisma.OrderAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateOrder>
          }
          groupBy: {
            args: Prisma.OrderGroupByArgs<ExtArgs>
            result: $Utils.Optional<OrderGroupByOutputType>[]
          }
          count: {
            args: Prisma.OrderCountArgs<ExtArgs>
            result: $Utils.Optional<OrderCountAggregateOutputType> | number
          }
        }
      }
      WorkItem: {
        payload: Prisma.$WorkItemPayload<ExtArgs>
        fields: Prisma.WorkItemFieldRefs
        operations: {
          findUnique: {
            args: Prisma.WorkItemFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$WorkItemPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.WorkItemFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$WorkItemPayload>
          }
          findFirst: {
            args: Prisma.WorkItemFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$WorkItemPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.WorkItemFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$WorkItemPayload>
          }
          findMany: {
            args: Prisma.WorkItemFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$WorkItemPayload>[]
          }
          create: {
            args: Prisma.WorkItemCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$WorkItemPayload>
          }
          createMany: {
            args: Prisma.WorkItemCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.WorkItemCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$WorkItemPayload>[]
          }
          delete: {
            args: Prisma.WorkItemDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$WorkItemPayload>
          }
          update: {
            args: Prisma.WorkItemUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$WorkItemPayload>
          }
          deleteMany: {
            args: Prisma.WorkItemDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.WorkItemUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.WorkItemUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$WorkItemPayload>[]
          }
          upsert: {
            args: Prisma.WorkItemUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$WorkItemPayload>
          }
          aggregate: {
            args: Prisma.WorkItemAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateWorkItem>
          }
          groupBy: {
            args: Prisma.WorkItemGroupByArgs<ExtArgs>
            result: $Utils.Optional<WorkItemGroupByOutputType>[]
          }
          count: {
            args: Prisma.WorkItemCountArgs<ExtArgs>
            result: $Utils.Optional<WorkItemCountAggregateOutputType> | number
          }
        }
      }
      WorkItemTransition: {
        payload: Prisma.$WorkItemTransitionPayload<ExtArgs>
        fields: Prisma.WorkItemTransitionFieldRefs
        operations: {
          findUnique: {
            args: Prisma.WorkItemTransitionFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$WorkItemTransitionPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.WorkItemTransitionFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$WorkItemTransitionPayload>
          }
          findFirst: {
            args: Prisma.WorkItemTransitionFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$WorkItemTransitionPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.WorkItemTransitionFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$WorkItemTransitionPayload>
          }
          findMany: {
            args: Prisma.WorkItemTransitionFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$WorkItemTransitionPayload>[]
          }
          create: {
            args: Prisma.WorkItemTransitionCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$WorkItemTransitionPayload>
          }
          createMany: {
            args: Prisma.WorkItemTransitionCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.WorkItemTransitionCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$WorkItemTransitionPayload>[]
          }
          delete: {
            args: Prisma.WorkItemTransitionDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$WorkItemTransitionPayload>
          }
          update: {
            args: Prisma.WorkItemTransitionUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$WorkItemTransitionPayload>
          }
          deleteMany: {
            args: Prisma.WorkItemTransitionDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.WorkItemTransitionUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.WorkItemTransitionUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$WorkItemTransitionPayload>[]
          }
          upsert: {
            args: Prisma.WorkItemTransitionUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$WorkItemTransitionPayload>
          }
          aggregate: {
            args: Prisma.WorkItemTransitionAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateWorkItemTransition>
          }
          groupBy: {
            args: Prisma.WorkItemTransitionGroupByArgs<ExtArgs>
            result: $Utils.Optional<WorkItemTransitionGroupByOutputType>[]
          }
          count: {
            args: Prisma.WorkItemTransitionCountArgs<ExtArgs>
            result: $Utils.Optional<WorkItemTransitionCountAggregateOutputType> | number
          }
        }
      }
      PhaseTiming: {
        payload: Prisma.$PhaseTimingPayload<ExtArgs>
        fields: Prisma.PhaseTimingFieldRefs
        operations: {
          findUnique: {
            args: Prisma.PhaseTimingFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PhaseTimingPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.PhaseTimingFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PhaseTimingPayload>
          }
          findFirst: {
            args: Prisma.PhaseTimingFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PhaseTimingPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.PhaseTimingFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PhaseTimingPayload>
          }
          findMany: {
            args: Prisma.PhaseTimingFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PhaseTimingPayload>[]
          }
          create: {
            args: Prisma.PhaseTimingCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PhaseTimingPayload>
          }
          createMany: {
            args: Prisma.PhaseTimingCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.PhaseTimingCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PhaseTimingPayload>[]
          }
          delete: {
            args: Prisma.PhaseTimingDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PhaseTimingPayload>
          }
          update: {
            args: Prisma.PhaseTimingUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PhaseTimingPayload>
          }
          deleteMany: {
            args: Prisma.PhaseTimingDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.PhaseTimingUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.PhaseTimingUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PhaseTimingPayload>[]
          }
          upsert: {
            args: Prisma.PhaseTimingUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PhaseTimingPayload>
          }
          aggregate: {
            args: Prisma.PhaseTimingAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregatePhaseTiming>
          }
          groupBy: {
            args: Prisma.PhaseTimingGroupByArgs<ExtArgs>
            result: $Utils.Optional<PhaseTimingGroupByOutputType>[]
          }
          count: {
            args: Prisma.PhaseTimingCountArgs<ExtArgs>
            result: $Utils.Optional<PhaseTimingCountAggregateOutputType> | number
          }
        }
      }
      NotificationEvent: {
        payload: Prisma.$NotificationEventPayload<ExtArgs>
        fields: Prisma.NotificationEventFieldRefs
        operations: {
          findUnique: {
            args: Prisma.NotificationEventFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$NotificationEventPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.NotificationEventFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$NotificationEventPayload>
          }
          findFirst: {
            args: Prisma.NotificationEventFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$NotificationEventPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.NotificationEventFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$NotificationEventPayload>
          }
          findMany: {
            args: Prisma.NotificationEventFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$NotificationEventPayload>[]
          }
          create: {
            args: Prisma.NotificationEventCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$NotificationEventPayload>
          }
          createMany: {
            args: Prisma.NotificationEventCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.NotificationEventCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$NotificationEventPayload>[]
          }
          delete: {
            args: Prisma.NotificationEventDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$NotificationEventPayload>
          }
          update: {
            args: Prisma.NotificationEventUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$NotificationEventPayload>
          }
          deleteMany: {
            args: Prisma.NotificationEventDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.NotificationEventUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.NotificationEventUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$NotificationEventPayload>[]
          }
          upsert: {
            args: Prisma.NotificationEventUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$NotificationEventPayload>
          }
          aggregate: {
            args: Prisma.NotificationEventAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateNotificationEvent>
          }
          groupBy: {
            args: Prisma.NotificationEventGroupByArgs<ExtArgs>
            result: $Utils.Optional<NotificationEventGroupByOutputType>[]
          }
          count: {
            args: Prisma.NotificationEventCountArgs<ExtArgs>
            result: $Utils.Optional<NotificationEventCountAggregateOutputType> | number
          }
        }
      }
      User: {
        payload: Prisma.$UserPayload<ExtArgs>
        fields: Prisma.UserFieldRefs
        operations: {
          findUnique: {
            args: Prisma.UserFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.UserFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          findFirst: {
            args: Prisma.UserFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.UserFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          findMany: {
            args: Prisma.UserFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>[]
          }
          create: {
            args: Prisma.UserCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          createMany: {
            args: Prisma.UserCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.UserCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>[]
          }
          delete: {
            args: Prisma.UserDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          update: {
            args: Prisma.UserUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          deleteMany: {
            args: Prisma.UserDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.UserUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.UserUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>[]
          }
          upsert: {
            args: Prisma.UserUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          aggregate: {
            args: Prisma.UserAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateUser>
          }
          groupBy: {
            args: Prisma.UserGroupByArgs<ExtArgs>
            result: $Utils.Optional<UserGroupByOutputType>[]
          }
          count: {
            args: Prisma.UserCountArgs<ExtArgs>
            result: $Utils.Optional<UserCountAggregateOutputType> | number
          }
        }
      }
      Session: {
        payload: Prisma.$SessionPayload<ExtArgs>
        fields: Prisma.SessionFieldRefs
        operations: {
          findUnique: {
            args: Prisma.SessionFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SessionPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.SessionFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SessionPayload>
          }
          findFirst: {
            args: Prisma.SessionFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SessionPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.SessionFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SessionPayload>
          }
          findMany: {
            args: Prisma.SessionFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SessionPayload>[]
          }
          create: {
            args: Prisma.SessionCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SessionPayload>
          }
          createMany: {
            args: Prisma.SessionCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.SessionCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SessionPayload>[]
          }
          delete: {
            args: Prisma.SessionDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SessionPayload>
          }
          update: {
            args: Prisma.SessionUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SessionPayload>
          }
          deleteMany: {
            args: Prisma.SessionDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.SessionUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.SessionUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SessionPayload>[]
          }
          upsert: {
            args: Prisma.SessionUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SessionPayload>
          }
          aggregate: {
            args: Prisma.SessionAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateSession>
          }
          groupBy: {
            args: Prisma.SessionGroupByArgs<ExtArgs>
            result: $Utils.Optional<SessionGroupByOutputType>[]
          }
          count: {
            args: Prisma.SessionCountArgs<ExtArgs>
            result: $Utils.Optional<SessionCountAggregateOutputType> | number
          }
        }
      }
      Account: {
        payload: Prisma.$AccountPayload<ExtArgs>
        fields: Prisma.AccountFieldRefs
        operations: {
          findUnique: {
            args: Prisma.AccountFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AccountPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.AccountFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AccountPayload>
          }
          findFirst: {
            args: Prisma.AccountFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AccountPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.AccountFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AccountPayload>
          }
          findMany: {
            args: Prisma.AccountFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AccountPayload>[]
          }
          create: {
            args: Prisma.AccountCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AccountPayload>
          }
          createMany: {
            args: Prisma.AccountCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.AccountCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AccountPayload>[]
          }
          delete: {
            args: Prisma.AccountDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AccountPayload>
          }
          update: {
            args: Prisma.AccountUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AccountPayload>
          }
          deleteMany: {
            args: Prisma.AccountDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.AccountUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.AccountUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AccountPayload>[]
          }
          upsert: {
            args: Prisma.AccountUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AccountPayload>
          }
          aggregate: {
            args: Prisma.AccountAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateAccount>
          }
          groupBy: {
            args: Prisma.AccountGroupByArgs<ExtArgs>
            result: $Utils.Optional<AccountGroupByOutputType>[]
          }
          count: {
            args: Prisma.AccountCountArgs<ExtArgs>
            result: $Utils.Optional<AccountCountAggregateOutputType> | number
          }
        }
      }
      Verification: {
        payload: Prisma.$VerificationPayload<ExtArgs>
        fields: Prisma.VerificationFieldRefs
        operations: {
          findUnique: {
            args: Prisma.VerificationFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$VerificationPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.VerificationFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$VerificationPayload>
          }
          findFirst: {
            args: Prisma.VerificationFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$VerificationPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.VerificationFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$VerificationPayload>
          }
          findMany: {
            args: Prisma.VerificationFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$VerificationPayload>[]
          }
          create: {
            args: Prisma.VerificationCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$VerificationPayload>
          }
          createMany: {
            args: Prisma.VerificationCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.VerificationCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$VerificationPayload>[]
          }
          delete: {
            args: Prisma.VerificationDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$VerificationPayload>
          }
          update: {
            args: Prisma.VerificationUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$VerificationPayload>
          }
          deleteMany: {
            args: Prisma.VerificationDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.VerificationUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.VerificationUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$VerificationPayload>[]
          }
          upsert: {
            args: Prisma.VerificationUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$VerificationPayload>
          }
          aggregate: {
            args: Prisma.VerificationAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateVerification>
          }
          groupBy: {
            args: Prisma.VerificationGroupByArgs<ExtArgs>
            result: $Utils.Optional<VerificationGroupByOutputType>[]
          }
          count: {
            args: Prisma.VerificationCountArgs<ExtArgs>
            result: $Utils.Optional<VerificationCountAggregateOutputType> | number
          }
        }
      }
    }
  } & {
    other: {
      payload: any
      operations: {
        $executeRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $executeRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
        $queryRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $queryRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
      }
    }
  }
  export const defineExtension: $Extensions.ExtendsHook<"define", Prisma.TypeMapCb, $Extensions.DefaultArgs>
  export type DefaultPrismaClient = PrismaClient
  export type ErrorFormat = 'pretty' | 'colorless' | 'minimal'
  export interface PrismaClientOptions {
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasources?: Datasources
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasourceUrl?: string
    /**
     * @default "colorless"
     */
    errorFormat?: ErrorFormat
    /**
     * @example
     * ```
     * // Shorthand for `emit: 'stdout'`
     * log: ['query', 'info', 'warn', 'error']
     * 
     * // Emit as events only
     * log: [
     *   { emit: 'event', level: 'query' },
     *   { emit: 'event', level: 'info' },
     *   { emit: 'event', level: 'warn' }
     *   { emit: 'event', level: 'error' }
     * ]
     * 
     * / Emit as events and log to stdout
     * og: [
     *  { emit: 'stdout', level: 'query' },
     *  { emit: 'stdout', level: 'info' },
     *  { emit: 'stdout', level: 'warn' }
     *  { emit: 'stdout', level: 'error' }
     * 
     * ```
     * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/logging#the-log-option).
     */
    log?: (LogLevel | LogDefinition)[]
    /**
     * The default values for transactionOptions
     * maxWait ?= 2000
     * timeout ?= 5000
     */
    transactionOptions?: {
      maxWait?: number
      timeout?: number
      isolationLevel?: Prisma.TransactionIsolationLevel
    }
    /**
     * Instance of a Driver Adapter, e.g., like one provided by `@prisma/adapter-planetscale`
     */
    adapter?: runtime.SqlDriverAdapterFactory | null
    /**
     * Global configuration for omitting model fields by default.
     * 
     * @example
     * ```
     * const prisma = new PrismaClient({
     *   omit: {
     *     user: {
     *       password: true
     *     }
     *   }
     * })
     * ```
     */
    omit?: Prisma.GlobalOmitConfig
  }
  export type GlobalOmitConfig = {
    department?: DepartmentOmit
    customer?: CustomerOmit
    order?: OrderOmit
    workItem?: WorkItemOmit
    workItemTransition?: WorkItemTransitionOmit
    phaseTiming?: PhaseTimingOmit
    notificationEvent?: NotificationEventOmit
    user?: UserOmit
    session?: SessionOmit
    account?: AccountOmit
    verification?: VerificationOmit
  }

  /* Types for Logging */
  export type LogLevel = 'info' | 'query' | 'warn' | 'error'
  export type LogDefinition = {
    level: LogLevel
    emit: 'stdout' | 'event'
  }

  export type CheckIsLogLevel<T> = T extends LogLevel ? T : never;

  export type GetLogType<T> = CheckIsLogLevel<
    T extends LogDefinition ? T['level'] : T
  >;

  export type GetEvents<T extends any[]> = T extends Array<LogLevel | LogDefinition>
    ? GetLogType<T[number]>
    : never;

  export type QueryEvent = {
    timestamp: Date
    query: string
    params: string
    duration: number
    target: string
  }

  export type LogEvent = {
    timestamp: Date
    message: string
    target: string
  }
  /* End Types for Logging */


  export type PrismaAction =
    | 'findUnique'
    | 'findUniqueOrThrow'
    | 'findMany'
    | 'findFirst'
    | 'findFirstOrThrow'
    | 'create'
    | 'createMany'
    | 'createManyAndReturn'
    | 'update'
    | 'updateMany'
    | 'updateManyAndReturn'
    | 'upsert'
    | 'delete'
    | 'deleteMany'
    | 'executeRaw'
    | 'queryRaw'
    | 'aggregate'
    | 'count'
    | 'runCommandRaw'
    | 'findRaw'
    | 'groupBy'

  // tested in getLogLevel.test.ts
  export function getLogLevel(log: Array<LogLevel | LogDefinition>): LogLevel | undefined;

  /**
   * `PrismaClient` proxy available in interactive transactions.
   */
  export type TransactionClient = Omit<Prisma.DefaultPrismaClient, runtime.ITXClientDenyList>

  export type Datasource = {
    url?: string
  }

  /**
   * Count Types
   */


  /**
   * Count Type DepartmentCountOutputType
   */

  export type DepartmentCountOutputType = {
    workItems: number
  }

  export type DepartmentCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    workItems?: boolean | DepartmentCountOutputTypeCountWorkItemsArgs
  }

  // Custom InputTypes
  /**
   * DepartmentCountOutputType without action
   */
  export type DepartmentCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DepartmentCountOutputType
     */
    select?: DepartmentCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * DepartmentCountOutputType without action
   */
  export type DepartmentCountOutputTypeCountWorkItemsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: WorkItemWhereInput
  }


  /**
   * Count Type CustomerCountOutputType
   */

  export type CustomerCountOutputType = {
    orders: number
  }

  export type CustomerCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    orders?: boolean | CustomerCountOutputTypeCountOrdersArgs
  }

  // Custom InputTypes
  /**
   * CustomerCountOutputType without action
   */
  export type CustomerCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CustomerCountOutputType
     */
    select?: CustomerCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * CustomerCountOutputType without action
   */
  export type CustomerCountOutputTypeCountOrdersArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: OrderWhereInput
  }


  /**
   * Count Type OrderCountOutputType
   */

  export type OrderCountOutputType = {
    workItems: number
  }

  export type OrderCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    workItems?: boolean | OrderCountOutputTypeCountWorkItemsArgs
  }

  // Custom InputTypes
  /**
   * OrderCountOutputType without action
   */
  export type OrderCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the OrderCountOutputType
     */
    select?: OrderCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * OrderCountOutputType without action
   */
  export type OrderCountOutputTypeCountWorkItemsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: WorkItemWhereInput
  }


  /**
   * Count Type WorkItemCountOutputType
   */

  export type WorkItemCountOutputType = {
    transitions: number
    phaseTimings: number
  }

  export type WorkItemCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    transitions?: boolean | WorkItemCountOutputTypeCountTransitionsArgs
    phaseTimings?: boolean | WorkItemCountOutputTypeCountPhaseTimingsArgs
  }

  // Custom InputTypes
  /**
   * WorkItemCountOutputType without action
   */
  export type WorkItemCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the WorkItemCountOutputType
     */
    select?: WorkItemCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * WorkItemCountOutputType without action
   */
  export type WorkItemCountOutputTypeCountTransitionsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: WorkItemTransitionWhereInput
  }

  /**
   * WorkItemCountOutputType without action
   */
  export type WorkItemCountOutputTypeCountPhaseTimingsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PhaseTimingWhereInput
  }


  /**
   * Count Type UserCountOutputType
   */

  export type UserCountOutputType = {
    sessions: number
    accounts: number
    createdOrders: number
    assignedWorkItems: number
    workItemTransitions: number
    phaseTimings: number
  }

  export type UserCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    sessions?: boolean | UserCountOutputTypeCountSessionsArgs
    accounts?: boolean | UserCountOutputTypeCountAccountsArgs
    createdOrders?: boolean | UserCountOutputTypeCountCreatedOrdersArgs
    assignedWorkItems?: boolean | UserCountOutputTypeCountAssignedWorkItemsArgs
    workItemTransitions?: boolean | UserCountOutputTypeCountWorkItemTransitionsArgs
    phaseTimings?: boolean | UserCountOutputTypeCountPhaseTimingsArgs
  }

  // Custom InputTypes
  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserCountOutputType
     */
    select?: UserCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountSessionsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: SessionWhereInput
  }

  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountAccountsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: AccountWhereInput
  }

  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountCreatedOrdersArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: OrderWhereInput
  }

  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountAssignedWorkItemsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: WorkItemWhereInput
  }

  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountWorkItemTransitionsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: WorkItemTransitionWhereInput
  }

  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountPhaseTimingsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PhaseTimingWhereInput
  }


  /**
   * Models
   */

  /**
   * Model Department
   */

  export type AggregateDepartment = {
    _count: DepartmentCountAggregateOutputType | null
    _min: DepartmentMinAggregateOutputType | null
    _max: DepartmentMaxAggregateOutputType | null
  }

  export type DepartmentMinAggregateOutputType = {
    id: string | null
    name: string | null
    isActive: boolean | null
    createdAt: Date | null
  }

  export type DepartmentMaxAggregateOutputType = {
    id: string | null
    name: string | null
    isActive: boolean | null
    createdAt: Date | null
  }

  export type DepartmentCountAggregateOutputType = {
    id: number
    name: number
    isActive: number
    createdAt: number
    _all: number
  }


  export type DepartmentMinAggregateInputType = {
    id?: true
    name?: true
    isActive?: true
    createdAt?: true
  }

  export type DepartmentMaxAggregateInputType = {
    id?: true
    name?: true
    isActive?: true
    createdAt?: true
  }

  export type DepartmentCountAggregateInputType = {
    id?: true
    name?: true
    isActive?: true
    createdAt?: true
    _all?: true
  }

  export type DepartmentAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Department to aggregate.
     */
    where?: DepartmentWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Departments to fetch.
     */
    orderBy?: DepartmentOrderByWithRelationInput | DepartmentOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: DepartmentWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Departments from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Departments.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Departments
    **/
    _count?: true | DepartmentCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: DepartmentMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: DepartmentMaxAggregateInputType
  }

  export type GetDepartmentAggregateType<T extends DepartmentAggregateArgs> = {
        [P in keyof T & keyof AggregateDepartment]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateDepartment[P]>
      : GetScalarType<T[P], AggregateDepartment[P]>
  }




  export type DepartmentGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: DepartmentWhereInput
    orderBy?: DepartmentOrderByWithAggregationInput | DepartmentOrderByWithAggregationInput[]
    by: DepartmentScalarFieldEnum[] | DepartmentScalarFieldEnum
    having?: DepartmentScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: DepartmentCountAggregateInputType | true
    _min?: DepartmentMinAggregateInputType
    _max?: DepartmentMaxAggregateInputType
  }

  export type DepartmentGroupByOutputType = {
    id: string
    name: string
    isActive: boolean
    createdAt: Date
    _count: DepartmentCountAggregateOutputType | null
    _min: DepartmentMinAggregateOutputType | null
    _max: DepartmentMaxAggregateOutputType | null
  }

  type GetDepartmentGroupByPayload<T extends DepartmentGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<DepartmentGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof DepartmentGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], DepartmentGroupByOutputType[P]>
            : GetScalarType<T[P], DepartmentGroupByOutputType[P]>
        }
      >
    >


  export type DepartmentSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    isActive?: boolean
    createdAt?: boolean
    workItems?: boolean | Department$workItemsArgs<ExtArgs>
    _count?: boolean | DepartmentCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["department"]>

  export type DepartmentSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    isActive?: boolean
    createdAt?: boolean
  }, ExtArgs["result"]["department"]>

  export type DepartmentSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    isActive?: boolean
    createdAt?: boolean
  }, ExtArgs["result"]["department"]>

  export type DepartmentSelectScalar = {
    id?: boolean
    name?: boolean
    isActive?: boolean
    createdAt?: boolean
  }

  export type DepartmentOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "name" | "isActive" | "createdAt", ExtArgs["result"]["department"]>
  export type DepartmentInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    workItems?: boolean | Department$workItemsArgs<ExtArgs>
    _count?: boolean | DepartmentCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type DepartmentIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}
  export type DepartmentIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}

  export type $DepartmentPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Department"
    objects: {
      workItems: Prisma.$WorkItemPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      name: string
      isActive: boolean
      createdAt: Date
    }, ExtArgs["result"]["department"]>
    composites: {}
  }

  type DepartmentGetPayload<S extends boolean | null | undefined | DepartmentDefaultArgs> = $Result.GetResult<Prisma.$DepartmentPayload, S>

  type DepartmentCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<DepartmentFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: DepartmentCountAggregateInputType | true
    }

  export interface DepartmentDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Department'], meta: { name: 'Department' } }
    /**
     * Find zero or one Department that matches the filter.
     * @param {DepartmentFindUniqueArgs} args - Arguments to find a Department
     * @example
     * // Get one Department
     * const department = await prisma.department.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends DepartmentFindUniqueArgs>(args: SelectSubset<T, DepartmentFindUniqueArgs<ExtArgs>>): Prisma__DepartmentClient<$Result.GetResult<Prisma.$DepartmentPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Department that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {DepartmentFindUniqueOrThrowArgs} args - Arguments to find a Department
     * @example
     * // Get one Department
     * const department = await prisma.department.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends DepartmentFindUniqueOrThrowArgs>(args: SelectSubset<T, DepartmentFindUniqueOrThrowArgs<ExtArgs>>): Prisma__DepartmentClient<$Result.GetResult<Prisma.$DepartmentPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Department that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DepartmentFindFirstArgs} args - Arguments to find a Department
     * @example
     * // Get one Department
     * const department = await prisma.department.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends DepartmentFindFirstArgs>(args?: SelectSubset<T, DepartmentFindFirstArgs<ExtArgs>>): Prisma__DepartmentClient<$Result.GetResult<Prisma.$DepartmentPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Department that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DepartmentFindFirstOrThrowArgs} args - Arguments to find a Department
     * @example
     * // Get one Department
     * const department = await prisma.department.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends DepartmentFindFirstOrThrowArgs>(args?: SelectSubset<T, DepartmentFindFirstOrThrowArgs<ExtArgs>>): Prisma__DepartmentClient<$Result.GetResult<Prisma.$DepartmentPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Departments that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DepartmentFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Departments
     * const departments = await prisma.department.findMany()
     * 
     * // Get first 10 Departments
     * const departments = await prisma.department.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const departmentWithIdOnly = await prisma.department.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends DepartmentFindManyArgs>(args?: SelectSubset<T, DepartmentFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$DepartmentPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Department.
     * @param {DepartmentCreateArgs} args - Arguments to create a Department.
     * @example
     * // Create one Department
     * const Department = await prisma.department.create({
     *   data: {
     *     // ... data to create a Department
     *   }
     * })
     * 
     */
    create<T extends DepartmentCreateArgs>(args: SelectSubset<T, DepartmentCreateArgs<ExtArgs>>): Prisma__DepartmentClient<$Result.GetResult<Prisma.$DepartmentPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Departments.
     * @param {DepartmentCreateManyArgs} args - Arguments to create many Departments.
     * @example
     * // Create many Departments
     * const department = await prisma.department.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends DepartmentCreateManyArgs>(args?: SelectSubset<T, DepartmentCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Departments and returns the data saved in the database.
     * @param {DepartmentCreateManyAndReturnArgs} args - Arguments to create many Departments.
     * @example
     * // Create many Departments
     * const department = await prisma.department.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Departments and only return the `id`
     * const departmentWithIdOnly = await prisma.department.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends DepartmentCreateManyAndReturnArgs>(args?: SelectSubset<T, DepartmentCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$DepartmentPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Department.
     * @param {DepartmentDeleteArgs} args - Arguments to delete one Department.
     * @example
     * // Delete one Department
     * const Department = await prisma.department.delete({
     *   where: {
     *     // ... filter to delete one Department
     *   }
     * })
     * 
     */
    delete<T extends DepartmentDeleteArgs>(args: SelectSubset<T, DepartmentDeleteArgs<ExtArgs>>): Prisma__DepartmentClient<$Result.GetResult<Prisma.$DepartmentPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Department.
     * @param {DepartmentUpdateArgs} args - Arguments to update one Department.
     * @example
     * // Update one Department
     * const department = await prisma.department.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends DepartmentUpdateArgs>(args: SelectSubset<T, DepartmentUpdateArgs<ExtArgs>>): Prisma__DepartmentClient<$Result.GetResult<Prisma.$DepartmentPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Departments.
     * @param {DepartmentDeleteManyArgs} args - Arguments to filter Departments to delete.
     * @example
     * // Delete a few Departments
     * const { count } = await prisma.department.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends DepartmentDeleteManyArgs>(args?: SelectSubset<T, DepartmentDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Departments.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DepartmentUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Departments
     * const department = await prisma.department.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends DepartmentUpdateManyArgs>(args: SelectSubset<T, DepartmentUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Departments and returns the data updated in the database.
     * @param {DepartmentUpdateManyAndReturnArgs} args - Arguments to update many Departments.
     * @example
     * // Update many Departments
     * const department = await prisma.department.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Departments and only return the `id`
     * const departmentWithIdOnly = await prisma.department.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends DepartmentUpdateManyAndReturnArgs>(args: SelectSubset<T, DepartmentUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$DepartmentPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Department.
     * @param {DepartmentUpsertArgs} args - Arguments to update or create a Department.
     * @example
     * // Update or create a Department
     * const department = await prisma.department.upsert({
     *   create: {
     *     // ... data to create a Department
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Department we want to update
     *   }
     * })
     */
    upsert<T extends DepartmentUpsertArgs>(args: SelectSubset<T, DepartmentUpsertArgs<ExtArgs>>): Prisma__DepartmentClient<$Result.GetResult<Prisma.$DepartmentPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Departments.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DepartmentCountArgs} args - Arguments to filter Departments to count.
     * @example
     * // Count the number of Departments
     * const count = await prisma.department.count({
     *   where: {
     *     // ... the filter for the Departments we want to count
     *   }
     * })
    **/
    count<T extends DepartmentCountArgs>(
      args?: Subset<T, DepartmentCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], DepartmentCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Department.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DepartmentAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends DepartmentAggregateArgs>(args: Subset<T, DepartmentAggregateArgs>): Prisma.PrismaPromise<GetDepartmentAggregateType<T>>

    /**
     * Group by Department.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DepartmentGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends DepartmentGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: DepartmentGroupByArgs['orderBy'] }
        : { orderBy?: DepartmentGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, DepartmentGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetDepartmentGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Department model
   */
  readonly fields: DepartmentFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Department.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__DepartmentClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    workItems<T extends Department$workItemsArgs<ExtArgs> = {}>(args?: Subset<T, Department$workItemsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$WorkItemPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Department model
   */
  interface DepartmentFieldRefs {
    readonly id: FieldRef<"Department", 'String'>
    readonly name: FieldRef<"Department", 'String'>
    readonly isActive: FieldRef<"Department", 'Boolean'>
    readonly createdAt: FieldRef<"Department", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * Department findUnique
   */
  export type DepartmentFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Department
     */
    select?: DepartmentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Department
     */
    omit?: DepartmentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DepartmentInclude<ExtArgs> | null
    /**
     * Filter, which Department to fetch.
     */
    where: DepartmentWhereUniqueInput
  }

  /**
   * Department findUniqueOrThrow
   */
  export type DepartmentFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Department
     */
    select?: DepartmentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Department
     */
    omit?: DepartmentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DepartmentInclude<ExtArgs> | null
    /**
     * Filter, which Department to fetch.
     */
    where: DepartmentWhereUniqueInput
  }

  /**
   * Department findFirst
   */
  export type DepartmentFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Department
     */
    select?: DepartmentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Department
     */
    omit?: DepartmentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DepartmentInclude<ExtArgs> | null
    /**
     * Filter, which Department to fetch.
     */
    where?: DepartmentWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Departments to fetch.
     */
    orderBy?: DepartmentOrderByWithRelationInput | DepartmentOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Departments.
     */
    cursor?: DepartmentWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Departments from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Departments.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Departments.
     */
    distinct?: DepartmentScalarFieldEnum | DepartmentScalarFieldEnum[]
  }

  /**
   * Department findFirstOrThrow
   */
  export type DepartmentFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Department
     */
    select?: DepartmentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Department
     */
    omit?: DepartmentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DepartmentInclude<ExtArgs> | null
    /**
     * Filter, which Department to fetch.
     */
    where?: DepartmentWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Departments to fetch.
     */
    orderBy?: DepartmentOrderByWithRelationInput | DepartmentOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Departments.
     */
    cursor?: DepartmentWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Departments from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Departments.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Departments.
     */
    distinct?: DepartmentScalarFieldEnum | DepartmentScalarFieldEnum[]
  }

  /**
   * Department findMany
   */
  export type DepartmentFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Department
     */
    select?: DepartmentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Department
     */
    omit?: DepartmentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DepartmentInclude<ExtArgs> | null
    /**
     * Filter, which Departments to fetch.
     */
    where?: DepartmentWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Departments to fetch.
     */
    orderBy?: DepartmentOrderByWithRelationInput | DepartmentOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Departments.
     */
    cursor?: DepartmentWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Departments from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Departments.
     */
    skip?: number
    distinct?: DepartmentScalarFieldEnum | DepartmentScalarFieldEnum[]
  }

  /**
   * Department create
   */
  export type DepartmentCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Department
     */
    select?: DepartmentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Department
     */
    omit?: DepartmentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DepartmentInclude<ExtArgs> | null
    /**
     * The data needed to create a Department.
     */
    data: XOR<DepartmentCreateInput, DepartmentUncheckedCreateInput>
  }

  /**
   * Department createMany
   */
  export type DepartmentCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Departments.
     */
    data: DepartmentCreateManyInput | DepartmentCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Department createManyAndReturn
   */
  export type DepartmentCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Department
     */
    select?: DepartmentSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Department
     */
    omit?: DepartmentOmit<ExtArgs> | null
    /**
     * The data used to create many Departments.
     */
    data: DepartmentCreateManyInput | DepartmentCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Department update
   */
  export type DepartmentUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Department
     */
    select?: DepartmentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Department
     */
    omit?: DepartmentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DepartmentInclude<ExtArgs> | null
    /**
     * The data needed to update a Department.
     */
    data: XOR<DepartmentUpdateInput, DepartmentUncheckedUpdateInput>
    /**
     * Choose, which Department to update.
     */
    where: DepartmentWhereUniqueInput
  }

  /**
   * Department updateMany
   */
  export type DepartmentUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Departments.
     */
    data: XOR<DepartmentUpdateManyMutationInput, DepartmentUncheckedUpdateManyInput>
    /**
     * Filter which Departments to update
     */
    where?: DepartmentWhereInput
    /**
     * Limit how many Departments to update.
     */
    limit?: number
  }

  /**
   * Department updateManyAndReturn
   */
  export type DepartmentUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Department
     */
    select?: DepartmentSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Department
     */
    omit?: DepartmentOmit<ExtArgs> | null
    /**
     * The data used to update Departments.
     */
    data: XOR<DepartmentUpdateManyMutationInput, DepartmentUncheckedUpdateManyInput>
    /**
     * Filter which Departments to update
     */
    where?: DepartmentWhereInput
    /**
     * Limit how many Departments to update.
     */
    limit?: number
  }

  /**
   * Department upsert
   */
  export type DepartmentUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Department
     */
    select?: DepartmentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Department
     */
    omit?: DepartmentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DepartmentInclude<ExtArgs> | null
    /**
     * The filter to search for the Department to update in case it exists.
     */
    where: DepartmentWhereUniqueInput
    /**
     * In case the Department found by the `where` argument doesn't exist, create a new Department with this data.
     */
    create: XOR<DepartmentCreateInput, DepartmentUncheckedCreateInput>
    /**
     * In case the Department was found with the provided `where` argument, update it with this data.
     */
    update: XOR<DepartmentUpdateInput, DepartmentUncheckedUpdateInput>
  }

  /**
   * Department delete
   */
  export type DepartmentDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Department
     */
    select?: DepartmentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Department
     */
    omit?: DepartmentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DepartmentInclude<ExtArgs> | null
    /**
     * Filter which Department to delete.
     */
    where: DepartmentWhereUniqueInput
  }

  /**
   * Department deleteMany
   */
  export type DepartmentDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Departments to delete
     */
    where?: DepartmentWhereInput
    /**
     * Limit how many Departments to delete.
     */
    limit?: number
  }

  /**
   * Department.workItems
   */
  export type Department$workItemsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the WorkItem
     */
    select?: WorkItemSelect<ExtArgs> | null
    /**
     * Omit specific fields from the WorkItem
     */
    omit?: WorkItemOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: WorkItemInclude<ExtArgs> | null
    where?: WorkItemWhereInput
    orderBy?: WorkItemOrderByWithRelationInput | WorkItemOrderByWithRelationInput[]
    cursor?: WorkItemWhereUniqueInput
    take?: number
    skip?: number
    distinct?: WorkItemScalarFieldEnum | WorkItemScalarFieldEnum[]
  }

  /**
   * Department without action
   */
  export type DepartmentDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Department
     */
    select?: DepartmentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Department
     */
    omit?: DepartmentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DepartmentInclude<ExtArgs> | null
  }


  /**
   * Model Customer
   */

  export type AggregateCustomer = {
    _count: CustomerCountAggregateOutputType | null
    _min: CustomerMinAggregateOutputType | null
    _max: CustomerMaxAggregateOutputType | null
  }

  export type CustomerMinAggregateOutputType = {
    id: string | null
    name: string | null
    isCashCustomer: boolean | null
    createdAt: Date | null
  }

  export type CustomerMaxAggregateOutputType = {
    id: string | null
    name: string | null
    isCashCustomer: boolean | null
    createdAt: Date | null
  }

  export type CustomerCountAggregateOutputType = {
    id: number
    name: number
    isCashCustomer: number
    createdAt: number
    _all: number
  }


  export type CustomerMinAggregateInputType = {
    id?: true
    name?: true
    isCashCustomer?: true
    createdAt?: true
  }

  export type CustomerMaxAggregateInputType = {
    id?: true
    name?: true
    isCashCustomer?: true
    createdAt?: true
  }

  export type CustomerCountAggregateInputType = {
    id?: true
    name?: true
    isCashCustomer?: true
    createdAt?: true
    _all?: true
  }

  export type CustomerAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Customer to aggregate.
     */
    where?: CustomerWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Customers to fetch.
     */
    orderBy?: CustomerOrderByWithRelationInput | CustomerOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: CustomerWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Customers from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Customers.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Customers
    **/
    _count?: true | CustomerCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: CustomerMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: CustomerMaxAggregateInputType
  }

  export type GetCustomerAggregateType<T extends CustomerAggregateArgs> = {
        [P in keyof T & keyof AggregateCustomer]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateCustomer[P]>
      : GetScalarType<T[P], AggregateCustomer[P]>
  }




  export type CustomerGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: CustomerWhereInput
    orderBy?: CustomerOrderByWithAggregationInput | CustomerOrderByWithAggregationInput[]
    by: CustomerScalarFieldEnum[] | CustomerScalarFieldEnum
    having?: CustomerScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: CustomerCountAggregateInputType | true
    _min?: CustomerMinAggregateInputType
    _max?: CustomerMaxAggregateInputType
  }

  export type CustomerGroupByOutputType = {
    id: string
    name: string
    isCashCustomer: boolean
    createdAt: Date
    _count: CustomerCountAggregateOutputType | null
    _min: CustomerMinAggregateOutputType | null
    _max: CustomerMaxAggregateOutputType | null
  }

  type GetCustomerGroupByPayload<T extends CustomerGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<CustomerGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof CustomerGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], CustomerGroupByOutputType[P]>
            : GetScalarType<T[P], CustomerGroupByOutputType[P]>
        }
      >
    >


  export type CustomerSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    isCashCustomer?: boolean
    createdAt?: boolean
    orders?: boolean | Customer$ordersArgs<ExtArgs>
    _count?: boolean | CustomerCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["customer"]>

  export type CustomerSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    isCashCustomer?: boolean
    createdAt?: boolean
  }, ExtArgs["result"]["customer"]>

  export type CustomerSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    isCashCustomer?: boolean
    createdAt?: boolean
  }, ExtArgs["result"]["customer"]>

  export type CustomerSelectScalar = {
    id?: boolean
    name?: boolean
    isCashCustomer?: boolean
    createdAt?: boolean
  }

  export type CustomerOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "name" | "isCashCustomer" | "createdAt", ExtArgs["result"]["customer"]>
  export type CustomerInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    orders?: boolean | Customer$ordersArgs<ExtArgs>
    _count?: boolean | CustomerCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type CustomerIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}
  export type CustomerIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}

  export type $CustomerPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Customer"
    objects: {
      orders: Prisma.$OrderPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      name: string
      /**
       * Exactly one row has this true (seeded, not user-creatable).
       */
      isCashCustomer: boolean
      createdAt: Date
    }, ExtArgs["result"]["customer"]>
    composites: {}
  }

  type CustomerGetPayload<S extends boolean | null | undefined | CustomerDefaultArgs> = $Result.GetResult<Prisma.$CustomerPayload, S>

  type CustomerCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<CustomerFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: CustomerCountAggregateInputType | true
    }

  export interface CustomerDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Customer'], meta: { name: 'Customer' } }
    /**
     * Find zero or one Customer that matches the filter.
     * @param {CustomerFindUniqueArgs} args - Arguments to find a Customer
     * @example
     * // Get one Customer
     * const customer = await prisma.customer.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends CustomerFindUniqueArgs>(args: SelectSubset<T, CustomerFindUniqueArgs<ExtArgs>>): Prisma__CustomerClient<$Result.GetResult<Prisma.$CustomerPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Customer that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {CustomerFindUniqueOrThrowArgs} args - Arguments to find a Customer
     * @example
     * // Get one Customer
     * const customer = await prisma.customer.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends CustomerFindUniqueOrThrowArgs>(args: SelectSubset<T, CustomerFindUniqueOrThrowArgs<ExtArgs>>): Prisma__CustomerClient<$Result.GetResult<Prisma.$CustomerPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Customer that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CustomerFindFirstArgs} args - Arguments to find a Customer
     * @example
     * // Get one Customer
     * const customer = await prisma.customer.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends CustomerFindFirstArgs>(args?: SelectSubset<T, CustomerFindFirstArgs<ExtArgs>>): Prisma__CustomerClient<$Result.GetResult<Prisma.$CustomerPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Customer that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CustomerFindFirstOrThrowArgs} args - Arguments to find a Customer
     * @example
     * // Get one Customer
     * const customer = await prisma.customer.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends CustomerFindFirstOrThrowArgs>(args?: SelectSubset<T, CustomerFindFirstOrThrowArgs<ExtArgs>>): Prisma__CustomerClient<$Result.GetResult<Prisma.$CustomerPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Customers that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CustomerFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Customers
     * const customers = await prisma.customer.findMany()
     * 
     * // Get first 10 Customers
     * const customers = await prisma.customer.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const customerWithIdOnly = await prisma.customer.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends CustomerFindManyArgs>(args?: SelectSubset<T, CustomerFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CustomerPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Customer.
     * @param {CustomerCreateArgs} args - Arguments to create a Customer.
     * @example
     * // Create one Customer
     * const Customer = await prisma.customer.create({
     *   data: {
     *     // ... data to create a Customer
     *   }
     * })
     * 
     */
    create<T extends CustomerCreateArgs>(args: SelectSubset<T, CustomerCreateArgs<ExtArgs>>): Prisma__CustomerClient<$Result.GetResult<Prisma.$CustomerPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Customers.
     * @param {CustomerCreateManyArgs} args - Arguments to create many Customers.
     * @example
     * // Create many Customers
     * const customer = await prisma.customer.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends CustomerCreateManyArgs>(args?: SelectSubset<T, CustomerCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Customers and returns the data saved in the database.
     * @param {CustomerCreateManyAndReturnArgs} args - Arguments to create many Customers.
     * @example
     * // Create many Customers
     * const customer = await prisma.customer.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Customers and only return the `id`
     * const customerWithIdOnly = await prisma.customer.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends CustomerCreateManyAndReturnArgs>(args?: SelectSubset<T, CustomerCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CustomerPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Customer.
     * @param {CustomerDeleteArgs} args - Arguments to delete one Customer.
     * @example
     * // Delete one Customer
     * const Customer = await prisma.customer.delete({
     *   where: {
     *     // ... filter to delete one Customer
     *   }
     * })
     * 
     */
    delete<T extends CustomerDeleteArgs>(args: SelectSubset<T, CustomerDeleteArgs<ExtArgs>>): Prisma__CustomerClient<$Result.GetResult<Prisma.$CustomerPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Customer.
     * @param {CustomerUpdateArgs} args - Arguments to update one Customer.
     * @example
     * // Update one Customer
     * const customer = await prisma.customer.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends CustomerUpdateArgs>(args: SelectSubset<T, CustomerUpdateArgs<ExtArgs>>): Prisma__CustomerClient<$Result.GetResult<Prisma.$CustomerPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Customers.
     * @param {CustomerDeleteManyArgs} args - Arguments to filter Customers to delete.
     * @example
     * // Delete a few Customers
     * const { count } = await prisma.customer.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends CustomerDeleteManyArgs>(args?: SelectSubset<T, CustomerDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Customers.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CustomerUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Customers
     * const customer = await prisma.customer.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends CustomerUpdateManyArgs>(args: SelectSubset<T, CustomerUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Customers and returns the data updated in the database.
     * @param {CustomerUpdateManyAndReturnArgs} args - Arguments to update many Customers.
     * @example
     * // Update many Customers
     * const customer = await prisma.customer.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Customers and only return the `id`
     * const customerWithIdOnly = await prisma.customer.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends CustomerUpdateManyAndReturnArgs>(args: SelectSubset<T, CustomerUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CustomerPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Customer.
     * @param {CustomerUpsertArgs} args - Arguments to update or create a Customer.
     * @example
     * // Update or create a Customer
     * const customer = await prisma.customer.upsert({
     *   create: {
     *     // ... data to create a Customer
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Customer we want to update
     *   }
     * })
     */
    upsert<T extends CustomerUpsertArgs>(args: SelectSubset<T, CustomerUpsertArgs<ExtArgs>>): Prisma__CustomerClient<$Result.GetResult<Prisma.$CustomerPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Customers.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CustomerCountArgs} args - Arguments to filter Customers to count.
     * @example
     * // Count the number of Customers
     * const count = await prisma.customer.count({
     *   where: {
     *     // ... the filter for the Customers we want to count
     *   }
     * })
    **/
    count<T extends CustomerCountArgs>(
      args?: Subset<T, CustomerCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], CustomerCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Customer.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CustomerAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends CustomerAggregateArgs>(args: Subset<T, CustomerAggregateArgs>): Prisma.PrismaPromise<GetCustomerAggregateType<T>>

    /**
     * Group by Customer.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CustomerGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends CustomerGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: CustomerGroupByArgs['orderBy'] }
        : { orderBy?: CustomerGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, CustomerGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetCustomerGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Customer model
   */
  readonly fields: CustomerFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Customer.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__CustomerClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    orders<T extends Customer$ordersArgs<ExtArgs> = {}>(args?: Subset<T, Customer$ordersArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$OrderPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Customer model
   */
  interface CustomerFieldRefs {
    readonly id: FieldRef<"Customer", 'String'>
    readonly name: FieldRef<"Customer", 'String'>
    readonly isCashCustomer: FieldRef<"Customer", 'Boolean'>
    readonly createdAt: FieldRef<"Customer", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * Customer findUnique
   */
  export type CustomerFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Customer
     */
    select?: CustomerSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Customer
     */
    omit?: CustomerOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CustomerInclude<ExtArgs> | null
    /**
     * Filter, which Customer to fetch.
     */
    where: CustomerWhereUniqueInput
  }

  /**
   * Customer findUniqueOrThrow
   */
  export type CustomerFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Customer
     */
    select?: CustomerSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Customer
     */
    omit?: CustomerOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CustomerInclude<ExtArgs> | null
    /**
     * Filter, which Customer to fetch.
     */
    where: CustomerWhereUniqueInput
  }

  /**
   * Customer findFirst
   */
  export type CustomerFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Customer
     */
    select?: CustomerSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Customer
     */
    omit?: CustomerOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CustomerInclude<ExtArgs> | null
    /**
     * Filter, which Customer to fetch.
     */
    where?: CustomerWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Customers to fetch.
     */
    orderBy?: CustomerOrderByWithRelationInput | CustomerOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Customers.
     */
    cursor?: CustomerWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Customers from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Customers.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Customers.
     */
    distinct?: CustomerScalarFieldEnum | CustomerScalarFieldEnum[]
  }

  /**
   * Customer findFirstOrThrow
   */
  export type CustomerFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Customer
     */
    select?: CustomerSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Customer
     */
    omit?: CustomerOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CustomerInclude<ExtArgs> | null
    /**
     * Filter, which Customer to fetch.
     */
    where?: CustomerWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Customers to fetch.
     */
    orderBy?: CustomerOrderByWithRelationInput | CustomerOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Customers.
     */
    cursor?: CustomerWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Customers from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Customers.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Customers.
     */
    distinct?: CustomerScalarFieldEnum | CustomerScalarFieldEnum[]
  }

  /**
   * Customer findMany
   */
  export type CustomerFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Customer
     */
    select?: CustomerSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Customer
     */
    omit?: CustomerOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CustomerInclude<ExtArgs> | null
    /**
     * Filter, which Customers to fetch.
     */
    where?: CustomerWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Customers to fetch.
     */
    orderBy?: CustomerOrderByWithRelationInput | CustomerOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Customers.
     */
    cursor?: CustomerWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Customers from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Customers.
     */
    skip?: number
    distinct?: CustomerScalarFieldEnum | CustomerScalarFieldEnum[]
  }

  /**
   * Customer create
   */
  export type CustomerCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Customer
     */
    select?: CustomerSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Customer
     */
    omit?: CustomerOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CustomerInclude<ExtArgs> | null
    /**
     * The data needed to create a Customer.
     */
    data: XOR<CustomerCreateInput, CustomerUncheckedCreateInput>
  }

  /**
   * Customer createMany
   */
  export type CustomerCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Customers.
     */
    data: CustomerCreateManyInput | CustomerCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Customer createManyAndReturn
   */
  export type CustomerCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Customer
     */
    select?: CustomerSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Customer
     */
    omit?: CustomerOmit<ExtArgs> | null
    /**
     * The data used to create many Customers.
     */
    data: CustomerCreateManyInput | CustomerCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Customer update
   */
  export type CustomerUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Customer
     */
    select?: CustomerSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Customer
     */
    omit?: CustomerOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CustomerInclude<ExtArgs> | null
    /**
     * The data needed to update a Customer.
     */
    data: XOR<CustomerUpdateInput, CustomerUncheckedUpdateInput>
    /**
     * Choose, which Customer to update.
     */
    where: CustomerWhereUniqueInput
  }

  /**
   * Customer updateMany
   */
  export type CustomerUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Customers.
     */
    data: XOR<CustomerUpdateManyMutationInput, CustomerUncheckedUpdateManyInput>
    /**
     * Filter which Customers to update
     */
    where?: CustomerWhereInput
    /**
     * Limit how many Customers to update.
     */
    limit?: number
  }

  /**
   * Customer updateManyAndReturn
   */
  export type CustomerUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Customer
     */
    select?: CustomerSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Customer
     */
    omit?: CustomerOmit<ExtArgs> | null
    /**
     * The data used to update Customers.
     */
    data: XOR<CustomerUpdateManyMutationInput, CustomerUncheckedUpdateManyInput>
    /**
     * Filter which Customers to update
     */
    where?: CustomerWhereInput
    /**
     * Limit how many Customers to update.
     */
    limit?: number
  }

  /**
   * Customer upsert
   */
  export type CustomerUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Customer
     */
    select?: CustomerSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Customer
     */
    omit?: CustomerOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CustomerInclude<ExtArgs> | null
    /**
     * The filter to search for the Customer to update in case it exists.
     */
    where: CustomerWhereUniqueInput
    /**
     * In case the Customer found by the `where` argument doesn't exist, create a new Customer with this data.
     */
    create: XOR<CustomerCreateInput, CustomerUncheckedCreateInput>
    /**
     * In case the Customer was found with the provided `where` argument, update it with this data.
     */
    update: XOR<CustomerUpdateInput, CustomerUncheckedUpdateInput>
  }

  /**
   * Customer delete
   */
  export type CustomerDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Customer
     */
    select?: CustomerSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Customer
     */
    omit?: CustomerOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CustomerInclude<ExtArgs> | null
    /**
     * Filter which Customer to delete.
     */
    where: CustomerWhereUniqueInput
  }

  /**
   * Customer deleteMany
   */
  export type CustomerDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Customers to delete
     */
    where?: CustomerWhereInput
    /**
     * Limit how many Customers to delete.
     */
    limit?: number
  }

  /**
   * Customer.orders
   */
  export type Customer$ordersArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Order
     */
    select?: OrderSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Order
     */
    omit?: OrderOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrderInclude<ExtArgs> | null
    where?: OrderWhereInput
    orderBy?: OrderOrderByWithRelationInput | OrderOrderByWithRelationInput[]
    cursor?: OrderWhereUniqueInput
    take?: number
    skip?: number
    distinct?: OrderScalarFieldEnum | OrderScalarFieldEnum[]
  }

  /**
   * Customer without action
   */
  export type CustomerDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Customer
     */
    select?: CustomerSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Customer
     */
    omit?: CustomerOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CustomerInclude<ExtArgs> | null
  }


  /**
   * Model Order
   */

  export type AggregateOrder = {
    _count: OrderCountAggregateOutputType | null
    _avg: OrderAvgAggregateOutputType | null
    _sum: OrderSumAggregateOutputType | null
    _min: OrderMinAggregateOutputType | null
    _max: OrderMaxAggregateOutputType | null
  }

  export type OrderAvgAggregateOutputType = {
    number: number | null
  }

  export type OrderSumAggregateOutputType = {
    number: number | null
  }

  export type OrderMinAggregateOutputType = {
    id: string | null
    number: number | null
    customerId: string | null
    channel: $Enums.OrderChannel | null
    priority: $Enums.OrderPriority | null
    mode: $Enums.OrderMode | null
    createdById: string | null
    createdAt: Date | null
  }

  export type OrderMaxAggregateOutputType = {
    id: string | null
    number: number | null
    customerId: string | null
    channel: $Enums.OrderChannel | null
    priority: $Enums.OrderPriority | null
    mode: $Enums.OrderMode | null
    createdById: string | null
    createdAt: Date | null
  }

  export type OrderCountAggregateOutputType = {
    id: number
    number: number
    customerId: number
    channel: number
    priority: number
    mode: number
    createdById: number
    createdAt: number
    _all: number
  }


  export type OrderAvgAggregateInputType = {
    number?: true
  }

  export type OrderSumAggregateInputType = {
    number?: true
  }

  export type OrderMinAggregateInputType = {
    id?: true
    number?: true
    customerId?: true
    channel?: true
    priority?: true
    mode?: true
    createdById?: true
    createdAt?: true
  }

  export type OrderMaxAggregateInputType = {
    id?: true
    number?: true
    customerId?: true
    channel?: true
    priority?: true
    mode?: true
    createdById?: true
    createdAt?: true
  }

  export type OrderCountAggregateInputType = {
    id?: true
    number?: true
    customerId?: true
    channel?: true
    priority?: true
    mode?: true
    createdById?: true
    createdAt?: true
    _all?: true
  }

  export type OrderAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Order to aggregate.
     */
    where?: OrderWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Orders to fetch.
     */
    orderBy?: OrderOrderByWithRelationInput | OrderOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: OrderWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Orders from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Orders.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Orders
    **/
    _count?: true | OrderCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: OrderAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: OrderSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: OrderMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: OrderMaxAggregateInputType
  }

  export type GetOrderAggregateType<T extends OrderAggregateArgs> = {
        [P in keyof T & keyof AggregateOrder]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateOrder[P]>
      : GetScalarType<T[P], AggregateOrder[P]>
  }




  export type OrderGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: OrderWhereInput
    orderBy?: OrderOrderByWithAggregationInput | OrderOrderByWithAggregationInput[]
    by: OrderScalarFieldEnum[] | OrderScalarFieldEnum
    having?: OrderScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: OrderCountAggregateInputType | true
    _avg?: OrderAvgAggregateInputType
    _sum?: OrderSumAggregateInputType
    _min?: OrderMinAggregateInputType
    _max?: OrderMaxAggregateInputType
  }

  export type OrderGroupByOutputType = {
    id: string
    number: number
    customerId: string
    channel: $Enums.OrderChannel
    priority: $Enums.OrderPriority
    mode: $Enums.OrderMode
    createdById: string
    createdAt: Date
    _count: OrderCountAggregateOutputType | null
    _avg: OrderAvgAggregateOutputType | null
    _sum: OrderSumAggregateOutputType | null
    _min: OrderMinAggregateOutputType | null
    _max: OrderMaxAggregateOutputType | null
  }

  type GetOrderGroupByPayload<T extends OrderGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<OrderGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof OrderGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], OrderGroupByOutputType[P]>
            : GetScalarType<T[P], OrderGroupByOutputType[P]>
        }
      >
    >


  export type OrderSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    number?: boolean
    customerId?: boolean
    channel?: boolean
    priority?: boolean
    mode?: boolean
    createdById?: boolean
    createdAt?: boolean
    customer?: boolean | CustomerDefaultArgs<ExtArgs>
    createdBy?: boolean | UserDefaultArgs<ExtArgs>
    workItems?: boolean | Order$workItemsArgs<ExtArgs>
    _count?: boolean | OrderCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["order"]>

  export type OrderSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    number?: boolean
    customerId?: boolean
    channel?: boolean
    priority?: boolean
    mode?: boolean
    createdById?: boolean
    createdAt?: boolean
    customer?: boolean | CustomerDefaultArgs<ExtArgs>
    createdBy?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["order"]>

  export type OrderSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    number?: boolean
    customerId?: boolean
    channel?: boolean
    priority?: boolean
    mode?: boolean
    createdById?: boolean
    createdAt?: boolean
    customer?: boolean | CustomerDefaultArgs<ExtArgs>
    createdBy?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["order"]>

  export type OrderSelectScalar = {
    id?: boolean
    number?: boolean
    customerId?: boolean
    channel?: boolean
    priority?: boolean
    mode?: boolean
    createdById?: boolean
    createdAt?: boolean
  }

  export type OrderOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "number" | "customerId" | "channel" | "priority" | "mode" | "createdById" | "createdAt", ExtArgs["result"]["order"]>
  export type OrderInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    customer?: boolean | CustomerDefaultArgs<ExtArgs>
    createdBy?: boolean | UserDefaultArgs<ExtArgs>
    workItems?: boolean | Order$workItemsArgs<ExtArgs>
    _count?: boolean | OrderCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type OrderIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    customer?: boolean | CustomerDefaultArgs<ExtArgs>
    createdBy?: boolean | UserDefaultArgs<ExtArgs>
  }
  export type OrderIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    customer?: boolean | CustomerDefaultArgs<ExtArgs>
    createdBy?: boolean | UserDefaultArgs<ExtArgs>
  }

  export type $OrderPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Order"
    objects: {
      customer: Prisma.$CustomerPayload<ExtArgs>
      createdBy: Prisma.$UserPayload<ExtArgs>
      workItems: Prisma.$WorkItemPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      /**
       * DB sequence, ever-increasing, no reset, no prefix (FR-008a).
       */
      number: number
      customerId: string
      channel: $Enums.OrderChannel
      priority: $Enums.OrderPriority
      mode: $Enums.OrderMode
      createdById: string
      createdAt: Date
    }, ExtArgs["result"]["order"]>
    composites: {}
  }

  type OrderGetPayload<S extends boolean | null | undefined | OrderDefaultArgs> = $Result.GetResult<Prisma.$OrderPayload, S>

  type OrderCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<OrderFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: OrderCountAggregateInputType | true
    }

  export interface OrderDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Order'], meta: { name: 'Order' } }
    /**
     * Find zero or one Order that matches the filter.
     * @param {OrderFindUniqueArgs} args - Arguments to find a Order
     * @example
     * // Get one Order
     * const order = await prisma.order.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends OrderFindUniqueArgs>(args: SelectSubset<T, OrderFindUniqueArgs<ExtArgs>>): Prisma__OrderClient<$Result.GetResult<Prisma.$OrderPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Order that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {OrderFindUniqueOrThrowArgs} args - Arguments to find a Order
     * @example
     * // Get one Order
     * const order = await prisma.order.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends OrderFindUniqueOrThrowArgs>(args: SelectSubset<T, OrderFindUniqueOrThrowArgs<ExtArgs>>): Prisma__OrderClient<$Result.GetResult<Prisma.$OrderPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Order that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OrderFindFirstArgs} args - Arguments to find a Order
     * @example
     * // Get one Order
     * const order = await prisma.order.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends OrderFindFirstArgs>(args?: SelectSubset<T, OrderFindFirstArgs<ExtArgs>>): Prisma__OrderClient<$Result.GetResult<Prisma.$OrderPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Order that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OrderFindFirstOrThrowArgs} args - Arguments to find a Order
     * @example
     * // Get one Order
     * const order = await prisma.order.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends OrderFindFirstOrThrowArgs>(args?: SelectSubset<T, OrderFindFirstOrThrowArgs<ExtArgs>>): Prisma__OrderClient<$Result.GetResult<Prisma.$OrderPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Orders that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OrderFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Orders
     * const orders = await prisma.order.findMany()
     * 
     * // Get first 10 Orders
     * const orders = await prisma.order.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const orderWithIdOnly = await prisma.order.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends OrderFindManyArgs>(args?: SelectSubset<T, OrderFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$OrderPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Order.
     * @param {OrderCreateArgs} args - Arguments to create a Order.
     * @example
     * // Create one Order
     * const Order = await prisma.order.create({
     *   data: {
     *     // ... data to create a Order
     *   }
     * })
     * 
     */
    create<T extends OrderCreateArgs>(args: SelectSubset<T, OrderCreateArgs<ExtArgs>>): Prisma__OrderClient<$Result.GetResult<Prisma.$OrderPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Orders.
     * @param {OrderCreateManyArgs} args - Arguments to create many Orders.
     * @example
     * // Create many Orders
     * const order = await prisma.order.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends OrderCreateManyArgs>(args?: SelectSubset<T, OrderCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Orders and returns the data saved in the database.
     * @param {OrderCreateManyAndReturnArgs} args - Arguments to create many Orders.
     * @example
     * // Create many Orders
     * const order = await prisma.order.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Orders and only return the `id`
     * const orderWithIdOnly = await prisma.order.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends OrderCreateManyAndReturnArgs>(args?: SelectSubset<T, OrderCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$OrderPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Order.
     * @param {OrderDeleteArgs} args - Arguments to delete one Order.
     * @example
     * // Delete one Order
     * const Order = await prisma.order.delete({
     *   where: {
     *     // ... filter to delete one Order
     *   }
     * })
     * 
     */
    delete<T extends OrderDeleteArgs>(args: SelectSubset<T, OrderDeleteArgs<ExtArgs>>): Prisma__OrderClient<$Result.GetResult<Prisma.$OrderPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Order.
     * @param {OrderUpdateArgs} args - Arguments to update one Order.
     * @example
     * // Update one Order
     * const order = await prisma.order.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends OrderUpdateArgs>(args: SelectSubset<T, OrderUpdateArgs<ExtArgs>>): Prisma__OrderClient<$Result.GetResult<Prisma.$OrderPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Orders.
     * @param {OrderDeleteManyArgs} args - Arguments to filter Orders to delete.
     * @example
     * // Delete a few Orders
     * const { count } = await prisma.order.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends OrderDeleteManyArgs>(args?: SelectSubset<T, OrderDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Orders.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OrderUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Orders
     * const order = await prisma.order.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends OrderUpdateManyArgs>(args: SelectSubset<T, OrderUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Orders and returns the data updated in the database.
     * @param {OrderUpdateManyAndReturnArgs} args - Arguments to update many Orders.
     * @example
     * // Update many Orders
     * const order = await prisma.order.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Orders and only return the `id`
     * const orderWithIdOnly = await prisma.order.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends OrderUpdateManyAndReturnArgs>(args: SelectSubset<T, OrderUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$OrderPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Order.
     * @param {OrderUpsertArgs} args - Arguments to update or create a Order.
     * @example
     * // Update or create a Order
     * const order = await prisma.order.upsert({
     *   create: {
     *     // ... data to create a Order
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Order we want to update
     *   }
     * })
     */
    upsert<T extends OrderUpsertArgs>(args: SelectSubset<T, OrderUpsertArgs<ExtArgs>>): Prisma__OrderClient<$Result.GetResult<Prisma.$OrderPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Orders.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OrderCountArgs} args - Arguments to filter Orders to count.
     * @example
     * // Count the number of Orders
     * const count = await prisma.order.count({
     *   where: {
     *     // ... the filter for the Orders we want to count
     *   }
     * })
    **/
    count<T extends OrderCountArgs>(
      args?: Subset<T, OrderCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], OrderCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Order.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OrderAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends OrderAggregateArgs>(args: Subset<T, OrderAggregateArgs>): Prisma.PrismaPromise<GetOrderAggregateType<T>>

    /**
     * Group by Order.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OrderGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends OrderGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: OrderGroupByArgs['orderBy'] }
        : { orderBy?: OrderGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, OrderGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetOrderGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Order model
   */
  readonly fields: OrderFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Order.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__OrderClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    customer<T extends CustomerDefaultArgs<ExtArgs> = {}>(args?: Subset<T, CustomerDefaultArgs<ExtArgs>>): Prisma__CustomerClient<$Result.GetResult<Prisma.$CustomerPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    createdBy<T extends UserDefaultArgs<ExtArgs> = {}>(args?: Subset<T, UserDefaultArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    workItems<T extends Order$workItemsArgs<ExtArgs> = {}>(args?: Subset<T, Order$workItemsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$WorkItemPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Order model
   */
  interface OrderFieldRefs {
    readonly id: FieldRef<"Order", 'String'>
    readonly number: FieldRef<"Order", 'Int'>
    readonly customerId: FieldRef<"Order", 'String'>
    readonly channel: FieldRef<"Order", 'OrderChannel'>
    readonly priority: FieldRef<"Order", 'OrderPriority'>
    readonly mode: FieldRef<"Order", 'OrderMode'>
    readonly createdById: FieldRef<"Order", 'String'>
    readonly createdAt: FieldRef<"Order", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * Order findUnique
   */
  export type OrderFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Order
     */
    select?: OrderSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Order
     */
    omit?: OrderOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrderInclude<ExtArgs> | null
    /**
     * Filter, which Order to fetch.
     */
    where: OrderWhereUniqueInput
  }

  /**
   * Order findUniqueOrThrow
   */
  export type OrderFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Order
     */
    select?: OrderSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Order
     */
    omit?: OrderOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrderInclude<ExtArgs> | null
    /**
     * Filter, which Order to fetch.
     */
    where: OrderWhereUniqueInput
  }

  /**
   * Order findFirst
   */
  export type OrderFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Order
     */
    select?: OrderSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Order
     */
    omit?: OrderOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrderInclude<ExtArgs> | null
    /**
     * Filter, which Order to fetch.
     */
    where?: OrderWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Orders to fetch.
     */
    orderBy?: OrderOrderByWithRelationInput | OrderOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Orders.
     */
    cursor?: OrderWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Orders from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Orders.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Orders.
     */
    distinct?: OrderScalarFieldEnum | OrderScalarFieldEnum[]
  }

  /**
   * Order findFirstOrThrow
   */
  export type OrderFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Order
     */
    select?: OrderSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Order
     */
    omit?: OrderOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrderInclude<ExtArgs> | null
    /**
     * Filter, which Order to fetch.
     */
    where?: OrderWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Orders to fetch.
     */
    orderBy?: OrderOrderByWithRelationInput | OrderOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Orders.
     */
    cursor?: OrderWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Orders from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Orders.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Orders.
     */
    distinct?: OrderScalarFieldEnum | OrderScalarFieldEnum[]
  }

  /**
   * Order findMany
   */
  export type OrderFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Order
     */
    select?: OrderSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Order
     */
    omit?: OrderOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrderInclude<ExtArgs> | null
    /**
     * Filter, which Orders to fetch.
     */
    where?: OrderWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Orders to fetch.
     */
    orderBy?: OrderOrderByWithRelationInput | OrderOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Orders.
     */
    cursor?: OrderWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Orders from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Orders.
     */
    skip?: number
    distinct?: OrderScalarFieldEnum | OrderScalarFieldEnum[]
  }

  /**
   * Order create
   */
  export type OrderCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Order
     */
    select?: OrderSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Order
     */
    omit?: OrderOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrderInclude<ExtArgs> | null
    /**
     * The data needed to create a Order.
     */
    data: XOR<OrderCreateInput, OrderUncheckedCreateInput>
  }

  /**
   * Order createMany
   */
  export type OrderCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Orders.
     */
    data: OrderCreateManyInput | OrderCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Order createManyAndReturn
   */
  export type OrderCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Order
     */
    select?: OrderSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Order
     */
    omit?: OrderOmit<ExtArgs> | null
    /**
     * The data used to create many Orders.
     */
    data: OrderCreateManyInput | OrderCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrderIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * Order update
   */
  export type OrderUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Order
     */
    select?: OrderSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Order
     */
    omit?: OrderOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrderInclude<ExtArgs> | null
    /**
     * The data needed to update a Order.
     */
    data: XOR<OrderUpdateInput, OrderUncheckedUpdateInput>
    /**
     * Choose, which Order to update.
     */
    where: OrderWhereUniqueInput
  }

  /**
   * Order updateMany
   */
  export type OrderUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Orders.
     */
    data: XOR<OrderUpdateManyMutationInput, OrderUncheckedUpdateManyInput>
    /**
     * Filter which Orders to update
     */
    where?: OrderWhereInput
    /**
     * Limit how many Orders to update.
     */
    limit?: number
  }

  /**
   * Order updateManyAndReturn
   */
  export type OrderUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Order
     */
    select?: OrderSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Order
     */
    omit?: OrderOmit<ExtArgs> | null
    /**
     * The data used to update Orders.
     */
    data: XOR<OrderUpdateManyMutationInput, OrderUncheckedUpdateManyInput>
    /**
     * Filter which Orders to update
     */
    where?: OrderWhereInput
    /**
     * Limit how many Orders to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrderIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * Order upsert
   */
  export type OrderUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Order
     */
    select?: OrderSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Order
     */
    omit?: OrderOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrderInclude<ExtArgs> | null
    /**
     * The filter to search for the Order to update in case it exists.
     */
    where: OrderWhereUniqueInput
    /**
     * In case the Order found by the `where` argument doesn't exist, create a new Order with this data.
     */
    create: XOR<OrderCreateInput, OrderUncheckedCreateInput>
    /**
     * In case the Order was found with the provided `where` argument, update it with this data.
     */
    update: XOR<OrderUpdateInput, OrderUncheckedUpdateInput>
  }

  /**
   * Order delete
   */
  export type OrderDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Order
     */
    select?: OrderSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Order
     */
    omit?: OrderOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrderInclude<ExtArgs> | null
    /**
     * Filter which Order to delete.
     */
    where: OrderWhereUniqueInput
  }

  /**
   * Order deleteMany
   */
  export type OrderDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Orders to delete
     */
    where?: OrderWhereInput
    /**
     * Limit how many Orders to delete.
     */
    limit?: number
  }

  /**
   * Order.workItems
   */
  export type Order$workItemsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the WorkItem
     */
    select?: WorkItemSelect<ExtArgs> | null
    /**
     * Omit specific fields from the WorkItem
     */
    omit?: WorkItemOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: WorkItemInclude<ExtArgs> | null
    where?: WorkItemWhereInput
    orderBy?: WorkItemOrderByWithRelationInput | WorkItemOrderByWithRelationInput[]
    cursor?: WorkItemWhereUniqueInput
    take?: number
    skip?: number
    distinct?: WorkItemScalarFieldEnum | WorkItemScalarFieldEnum[]
  }

  /**
   * Order without action
   */
  export type OrderDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Order
     */
    select?: OrderSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Order
     */
    omit?: OrderOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrderInclude<ExtArgs> | null
  }


  /**
   * Model WorkItem
   */

  export type AggregateWorkItem = {
    _count: WorkItemCountAggregateOutputType | null
    _min: WorkItemMinAggregateOutputType | null
    _max: WorkItemMaxAggregateOutputType | null
  }

  export type WorkItemMinAggregateOutputType = {
    id: string | null
    orderId: string | null
    productTypeId: string | null
    departmentId: string | null
    state: $Enums.WorkItemState | null
    requiresDesign: boolean | null
    requiresReview: boolean | null
    assigneeId: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type WorkItemMaxAggregateOutputType = {
    id: string | null
    orderId: string | null
    productTypeId: string | null
    departmentId: string | null
    state: $Enums.WorkItemState | null
    requiresDesign: boolean | null
    requiresReview: boolean | null
    assigneeId: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type WorkItemCountAggregateOutputType = {
    id: number
    orderId: number
    productTypeId: number
    departmentId: number
    state: number
    requiresDesign: number
    requiresReview: number
    assigneeId: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type WorkItemMinAggregateInputType = {
    id?: true
    orderId?: true
    productTypeId?: true
    departmentId?: true
    state?: true
    requiresDesign?: true
    requiresReview?: true
    assigneeId?: true
    createdAt?: true
    updatedAt?: true
  }

  export type WorkItemMaxAggregateInputType = {
    id?: true
    orderId?: true
    productTypeId?: true
    departmentId?: true
    state?: true
    requiresDesign?: true
    requiresReview?: true
    assigneeId?: true
    createdAt?: true
    updatedAt?: true
  }

  export type WorkItemCountAggregateInputType = {
    id?: true
    orderId?: true
    productTypeId?: true
    departmentId?: true
    state?: true
    requiresDesign?: true
    requiresReview?: true
    assigneeId?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type WorkItemAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which WorkItem to aggregate.
     */
    where?: WorkItemWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of WorkItems to fetch.
     */
    orderBy?: WorkItemOrderByWithRelationInput | WorkItemOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: WorkItemWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` WorkItems from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` WorkItems.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned WorkItems
    **/
    _count?: true | WorkItemCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: WorkItemMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: WorkItemMaxAggregateInputType
  }

  export type GetWorkItemAggregateType<T extends WorkItemAggregateArgs> = {
        [P in keyof T & keyof AggregateWorkItem]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateWorkItem[P]>
      : GetScalarType<T[P], AggregateWorkItem[P]>
  }




  export type WorkItemGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: WorkItemWhereInput
    orderBy?: WorkItemOrderByWithAggregationInput | WorkItemOrderByWithAggregationInput[]
    by: WorkItemScalarFieldEnum[] | WorkItemScalarFieldEnum
    having?: WorkItemScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: WorkItemCountAggregateInputType | true
    _min?: WorkItemMinAggregateInputType
    _max?: WorkItemMaxAggregateInputType
  }

  export type WorkItemGroupByOutputType = {
    id: string
    orderId: string
    productTypeId: string | null
    departmentId: string | null
    state: $Enums.WorkItemState
    requiresDesign: boolean
    requiresReview: boolean
    assigneeId: string | null
    createdAt: Date
    updatedAt: Date
    _count: WorkItemCountAggregateOutputType | null
    _min: WorkItemMinAggregateOutputType | null
    _max: WorkItemMaxAggregateOutputType | null
  }

  type GetWorkItemGroupByPayload<T extends WorkItemGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<WorkItemGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof WorkItemGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], WorkItemGroupByOutputType[P]>
            : GetScalarType<T[P], WorkItemGroupByOutputType[P]>
        }
      >
    >


  export type WorkItemSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    orderId?: boolean
    productTypeId?: boolean
    departmentId?: boolean
    state?: boolean
    requiresDesign?: boolean
    requiresReview?: boolean
    assigneeId?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    order?: boolean | OrderDefaultArgs<ExtArgs>
    department?: boolean | WorkItem$departmentArgs<ExtArgs>
    assignee?: boolean | WorkItem$assigneeArgs<ExtArgs>
    transitions?: boolean | WorkItem$transitionsArgs<ExtArgs>
    phaseTimings?: boolean | WorkItem$phaseTimingsArgs<ExtArgs>
    _count?: boolean | WorkItemCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["workItem"]>

  export type WorkItemSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    orderId?: boolean
    productTypeId?: boolean
    departmentId?: boolean
    state?: boolean
    requiresDesign?: boolean
    requiresReview?: boolean
    assigneeId?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    order?: boolean | OrderDefaultArgs<ExtArgs>
    department?: boolean | WorkItem$departmentArgs<ExtArgs>
    assignee?: boolean | WorkItem$assigneeArgs<ExtArgs>
  }, ExtArgs["result"]["workItem"]>

  export type WorkItemSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    orderId?: boolean
    productTypeId?: boolean
    departmentId?: boolean
    state?: boolean
    requiresDesign?: boolean
    requiresReview?: boolean
    assigneeId?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    order?: boolean | OrderDefaultArgs<ExtArgs>
    department?: boolean | WorkItem$departmentArgs<ExtArgs>
    assignee?: boolean | WorkItem$assigneeArgs<ExtArgs>
  }, ExtArgs["result"]["workItem"]>

  export type WorkItemSelectScalar = {
    id?: boolean
    orderId?: boolean
    productTypeId?: boolean
    departmentId?: boolean
    state?: boolean
    requiresDesign?: boolean
    requiresReview?: boolean
    assigneeId?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type WorkItemOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "orderId" | "productTypeId" | "departmentId" | "state" | "requiresDesign" | "requiresReview" | "assigneeId" | "createdAt" | "updatedAt", ExtArgs["result"]["workItem"]>
  export type WorkItemInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    order?: boolean | OrderDefaultArgs<ExtArgs>
    department?: boolean | WorkItem$departmentArgs<ExtArgs>
    assignee?: boolean | WorkItem$assigneeArgs<ExtArgs>
    transitions?: boolean | WorkItem$transitionsArgs<ExtArgs>
    phaseTimings?: boolean | WorkItem$phaseTimingsArgs<ExtArgs>
    _count?: boolean | WorkItemCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type WorkItemIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    order?: boolean | OrderDefaultArgs<ExtArgs>
    department?: boolean | WorkItem$departmentArgs<ExtArgs>
    assignee?: boolean | WorkItem$assigneeArgs<ExtArgs>
  }
  export type WorkItemIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    order?: boolean | OrderDefaultArgs<ExtArgs>
    department?: boolean | WorkItem$departmentArgs<ExtArgs>
    assignee?: boolean | WorkItem$assigneeArgs<ExtArgs>
  }

  export type $WorkItemPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "WorkItem"
    objects: {
      order: Prisma.$OrderPayload<ExtArgs>
      department: Prisma.$DepartmentPayload<ExtArgs> | null
      assignee: Prisma.$UserPayload<ExtArgs> | null
      transitions: Prisma.$WorkItemTransitionPayload<ExtArgs>[]
      phaseTimings: Prisma.$PhaseTimingPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      orderId: string
      /**
       * Catalog owned by 011 — FK reference only, no relation declared here.
       */
      productTypeId: string | null
      departmentId: string | null
      /**
       * Written only by transitionWorkItem().
       */
      state: $Enums.WorkItemState
      requiresDesign: boolean
      requiresReview: boolean
      assigneeId: string | null
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["workItem"]>
    composites: {}
  }

  type WorkItemGetPayload<S extends boolean | null | undefined | WorkItemDefaultArgs> = $Result.GetResult<Prisma.$WorkItemPayload, S>

  type WorkItemCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<WorkItemFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: WorkItemCountAggregateInputType | true
    }

  export interface WorkItemDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['WorkItem'], meta: { name: 'WorkItem' } }
    /**
     * Find zero or one WorkItem that matches the filter.
     * @param {WorkItemFindUniqueArgs} args - Arguments to find a WorkItem
     * @example
     * // Get one WorkItem
     * const workItem = await prisma.workItem.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends WorkItemFindUniqueArgs>(args: SelectSubset<T, WorkItemFindUniqueArgs<ExtArgs>>): Prisma__WorkItemClient<$Result.GetResult<Prisma.$WorkItemPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one WorkItem that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {WorkItemFindUniqueOrThrowArgs} args - Arguments to find a WorkItem
     * @example
     * // Get one WorkItem
     * const workItem = await prisma.workItem.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends WorkItemFindUniqueOrThrowArgs>(args: SelectSubset<T, WorkItemFindUniqueOrThrowArgs<ExtArgs>>): Prisma__WorkItemClient<$Result.GetResult<Prisma.$WorkItemPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first WorkItem that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {WorkItemFindFirstArgs} args - Arguments to find a WorkItem
     * @example
     * // Get one WorkItem
     * const workItem = await prisma.workItem.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends WorkItemFindFirstArgs>(args?: SelectSubset<T, WorkItemFindFirstArgs<ExtArgs>>): Prisma__WorkItemClient<$Result.GetResult<Prisma.$WorkItemPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first WorkItem that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {WorkItemFindFirstOrThrowArgs} args - Arguments to find a WorkItem
     * @example
     * // Get one WorkItem
     * const workItem = await prisma.workItem.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends WorkItemFindFirstOrThrowArgs>(args?: SelectSubset<T, WorkItemFindFirstOrThrowArgs<ExtArgs>>): Prisma__WorkItemClient<$Result.GetResult<Prisma.$WorkItemPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more WorkItems that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {WorkItemFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all WorkItems
     * const workItems = await prisma.workItem.findMany()
     * 
     * // Get first 10 WorkItems
     * const workItems = await prisma.workItem.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const workItemWithIdOnly = await prisma.workItem.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends WorkItemFindManyArgs>(args?: SelectSubset<T, WorkItemFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$WorkItemPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a WorkItem.
     * @param {WorkItemCreateArgs} args - Arguments to create a WorkItem.
     * @example
     * // Create one WorkItem
     * const WorkItem = await prisma.workItem.create({
     *   data: {
     *     // ... data to create a WorkItem
     *   }
     * })
     * 
     */
    create<T extends WorkItemCreateArgs>(args: SelectSubset<T, WorkItemCreateArgs<ExtArgs>>): Prisma__WorkItemClient<$Result.GetResult<Prisma.$WorkItemPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many WorkItems.
     * @param {WorkItemCreateManyArgs} args - Arguments to create many WorkItems.
     * @example
     * // Create many WorkItems
     * const workItem = await prisma.workItem.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends WorkItemCreateManyArgs>(args?: SelectSubset<T, WorkItemCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many WorkItems and returns the data saved in the database.
     * @param {WorkItemCreateManyAndReturnArgs} args - Arguments to create many WorkItems.
     * @example
     * // Create many WorkItems
     * const workItem = await prisma.workItem.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many WorkItems and only return the `id`
     * const workItemWithIdOnly = await prisma.workItem.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends WorkItemCreateManyAndReturnArgs>(args?: SelectSubset<T, WorkItemCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$WorkItemPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a WorkItem.
     * @param {WorkItemDeleteArgs} args - Arguments to delete one WorkItem.
     * @example
     * // Delete one WorkItem
     * const WorkItem = await prisma.workItem.delete({
     *   where: {
     *     // ... filter to delete one WorkItem
     *   }
     * })
     * 
     */
    delete<T extends WorkItemDeleteArgs>(args: SelectSubset<T, WorkItemDeleteArgs<ExtArgs>>): Prisma__WorkItemClient<$Result.GetResult<Prisma.$WorkItemPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one WorkItem.
     * @param {WorkItemUpdateArgs} args - Arguments to update one WorkItem.
     * @example
     * // Update one WorkItem
     * const workItem = await prisma.workItem.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends WorkItemUpdateArgs>(args: SelectSubset<T, WorkItemUpdateArgs<ExtArgs>>): Prisma__WorkItemClient<$Result.GetResult<Prisma.$WorkItemPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more WorkItems.
     * @param {WorkItemDeleteManyArgs} args - Arguments to filter WorkItems to delete.
     * @example
     * // Delete a few WorkItems
     * const { count } = await prisma.workItem.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends WorkItemDeleteManyArgs>(args?: SelectSubset<T, WorkItemDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more WorkItems.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {WorkItemUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many WorkItems
     * const workItem = await prisma.workItem.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends WorkItemUpdateManyArgs>(args: SelectSubset<T, WorkItemUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more WorkItems and returns the data updated in the database.
     * @param {WorkItemUpdateManyAndReturnArgs} args - Arguments to update many WorkItems.
     * @example
     * // Update many WorkItems
     * const workItem = await prisma.workItem.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more WorkItems and only return the `id`
     * const workItemWithIdOnly = await prisma.workItem.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends WorkItemUpdateManyAndReturnArgs>(args: SelectSubset<T, WorkItemUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$WorkItemPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one WorkItem.
     * @param {WorkItemUpsertArgs} args - Arguments to update or create a WorkItem.
     * @example
     * // Update or create a WorkItem
     * const workItem = await prisma.workItem.upsert({
     *   create: {
     *     // ... data to create a WorkItem
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the WorkItem we want to update
     *   }
     * })
     */
    upsert<T extends WorkItemUpsertArgs>(args: SelectSubset<T, WorkItemUpsertArgs<ExtArgs>>): Prisma__WorkItemClient<$Result.GetResult<Prisma.$WorkItemPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of WorkItems.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {WorkItemCountArgs} args - Arguments to filter WorkItems to count.
     * @example
     * // Count the number of WorkItems
     * const count = await prisma.workItem.count({
     *   where: {
     *     // ... the filter for the WorkItems we want to count
     *   }
     * })
    **/
    count<T extends WorkItemCountArgs>(
      args?: Subset<T, WorkItemCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], WorkItemCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a WorkItem.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {WorkItemAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends WorkItemAggregateArgs>(args: Subset<T, WorkItemAggregateArgs>): Prisma.PrismaPromise<GetWorkItemAggregateType<T>>

    /**
     * Group by WorkItem.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {WorkItemGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends WorkItemGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: WorkItemGroupByArgs['orderBy'] }
        : { orderBy?: WorkItemGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, WorkItemGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetWorkItemGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the WorkItem model
   */
  readonly fields: WorkItemFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for WorkItem.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__WorkItemClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    order<T extends OrderDefaultArgs<ExtArgs> = {}>(args?: Subset<T, OrderDefaultArgs<ExtArgs>>): Prisma__OrderClient<$Result.GetResult<Prisma.$OrderPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    department<T extends WorkItem$departmentArgs<ExtArgs> = {}>(args?: Subset<T, WorkItem$departmentArgs<ExtArgs>>): Prisma__DepartmentClient<$Result.GetResult<Prisma.$DepartmentPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>
    assignee<T extends WorkItem$assigneeArgs<ExtArgs> = {}>(args?: Subset<T, WorkItem$assigneeArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>
    transitions<T extends WorkItem$transitionsArgs<ExtArgs> = {}>(args?: Subset<T, WorkItem$transitionsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$WorkItemTransitionPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    phaseTimings<T extends WorkItem$phaseTimingsArgs<ExtArgs> = {}>(args?: Subset<T, WorkItem$phaseTimingsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PhaseTimingPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the WorkItem model
   */
  interface WorkItemFieldRefs {
    readonly id: FieldRef<"WorkItem", 'String'>
    readonly orderId: FieldRef<"WorkItem", 'String'>
    readonly productTypeId: FieldRef<"WorkItem", 'String'>
    readonly departmentId: FieldRef<"WorkItem", 'String'>
    readonly state: FieldRef<"WorkItem", 'WorkItemState'>
    readonly requiresDesign: FieldRef<"WorkItem", 'Boolean'>
    readonly requiresReview: FieldRef<"WorkItem", 'Boolean'>
    readonly assigneeId: FieldRef<"WorkItem", 'String'>
    readonly createdAt: FieldRef<"WorkItem", 'DateTime'>
    readonly updatedAt: FieldRef<"WorkItem", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * WorkItem findUnique
   */
  export type WorkItemFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the WorkItem
     */
    select?: WorkItemSelect<ExtArgs> | null
    /**
     * Omit specific fields from the WorkItem
     */
    omit?: WorkItemOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: WorkItemInclude<ExtArgs> | null
    /**
     * Filter, which WorkItem to fetch.
     */
    where: WorkItemWhereUniqueInput
  }

  /**
   * WorkItem findUniqueOrThrow
   */
  export type WorkItemFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the WorkItem
     */
    select?: WorkItemSelect<ExtArgs> | null
    /**
     * Omit specific fields from the WorkItem
     */
    omit?: WorkItemOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: WorkItemInclude<ExtArgs> | null
    /**
     * Filter, which WorkItem to fetch.
     */
    where: WorkItemWhereUniqueInput
  }

  /**
   * WorkItem findFirst
   */
  export type WorkItemFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the WorkItem
     */
    select?: WorkItemSelect<ExtArgs> | null
    /**
     * Omit specific fields from the WorkItem
     */
    omit?: WorkItemOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: WorkItemInclude<ExtArgs> | null
    /**
     * Filter, which WorkItem to fetch.
     */
    where?: WorkItemWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of WorkItems to fetch.
     */
    orderBy?: WorkItemOrderByWithRelationInput | WorkItemOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for WorkItems.
     */
    cursor?: WorkItemWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` WorkItems from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` WorkItems.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of WorkItems.
     */
    distinct?: WorkItemScalarFieldEnum | WorkItemScalarFieldEnum[]
  }

  /**
   * WorkItem findFirstOrThrow
   */
  export type WorkItemFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the WorkItem
     */
    select?: WorkItemSelect<ExtArgs> | null
    /**
     * Omit specific fields from the WorkItem
     */
    omit?: WorkItemOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: WorkItemInclude<ExtArgs> | null
    /**
     * Filter, which WorkItem to fetch.
     */
    where?: WorkItemWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of WorkItems to fetch.
     */
    orderBy?: WorkItemOrderByWithRelationInput | WorkItemOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for WorkItems.
     */
    cursor?: WorkItemWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` WorkItems from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` WorkItems.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of WorkItems.
     */
    distinct?: WorkItemScalarFieldEnum | WorkItemScalarFieldEnum[]
  }

  /**
   * WorkItem findMany
   */
  export type WorkItemFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the WorkItem
     */
    select?: WorkItemSelect<ExtArgs> | null
    /**
     * Omit specific fields from the WorkItem
     */
    omit?: WorkItemOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: WorkItemInclude<ExtArgs> | null
    /**
     * Filter, which WorkItems to fetch.
     */
    where?: WorkItemWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of WorkItems to fetch.
     */
    orderBy?: WorkItemOrderByWithRelationInput | WorkItemOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing WorkItems.
     */
    cursor?: WorkItemWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` WorkItems from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` WorkItems.
     */
    skip?: number
    distinct?: WorkItemScalarFieldEnum | WorkItemScalarFieldEnum[]
  }

  /**
   * WorkItem create
   */
  export type WorkItemCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the WorkItem
     */
    select?: WorkItemSelect<ExtArgs> | null
    /**
     * Omit specific fields from the WorkItem
     */
    omit?: WorkItemOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: WorkItemInclude<ExtArgs> | null
    /**
     * The data needed to create a WorkItem.
     */
    data: XOR<WorkItemCreateInput, WorkItemUncheckedCreateInput>
  }

  /**
   * WorkItem createMany
   */
  export type WorkItemCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many WorkItems.
     */
    data: WorkItemCreateManyInput | WorkItemCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * WorkItem createManyAndReturn
   */
  export type WorkItemCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the WorkItem
     */
    select?: WorkItemSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the WorkItem
     */
    omit?: WorkItemOmit<ExtArgs> | null
    /**
     * The data used to create many WorkItems.
     */
    data: WorkItemCreateManyInput | WorkItemCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: WorkItemIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * WorkItem update
   */
  export type WorkItemUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the WorkItem
     */
    select?: WorkItemSelect<ExtArgs> | null
    /**
     * Omit specific fields from the WorkItem
     */
    omit?: WorkItemOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: WorkItemInclude<ExtArgs> | null
    /**
     * The data needed to update a WorkItem.
     */
    data: XOR<WorkItemUpdateInput, WorkItemUncheckedUpdateInput>
    /**
     * Choose, which WorkItem to update.
     */
    where: WorkItemWhereUniqueInput
  }

  /**
   * WorkItem updateMany
   */
  export type WorkItemUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update WorkItems.
     */
    data: XOR<WorkItemUpdateManyMutationInput, WorkItemUncheckedUpdateManyInput>
    /**
     * Filter which WorkItems to update
     */
    where?: WorkItemWhereInput
    /**
     * Limit how many WorkItems to update.
     */
    limit?: number
  }

  /**
   * WorkItem updateManyAndReturn
   */
  export type WorkItemUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the WorkItem
     */
    select?: WorkItemSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the WorkItem
     */
    omit?: WorkItemOmit<ExtArgs> | null
    /**
     * The data used to update WorkItems.
     */
    data: XOR<WorkItemUpdateManyMutationInput, WorkItemUncheckedUpdateManyInput>
    /**
     * Filter which WorkItems to update
     */
    where?: WorkItemWhereInput
    /**
     * Limit how many WorkItems to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: WorkItemIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * WorkItem upsert
   */
  export type WorkItemUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the WorkItem
     */
    select?: WorkItemSelect<ExtArgs> | null
    /**
     * Omit specific fields from the WorkItem
     */
    omit?: WorkItemOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: WorkItemInclude<ExtArgs> | null
    /**
     * The filter to search for the WorkItem to update in case it exists.
     */
    where: WorkItemWhereUniqueInput
    /**
     * In case the WorkItem found by the `where` argument doesn't exist, create a new WorkItem with this data.
     */
    create: XOR<WorkItemCreateInput, WorkItemUncheckedCreateInput>
    /**
     * In case the WorkItem was found with the provided `where` argument, update it with this data.
     */
    update: XOR<WorkItemUpdateInput, WorkItemUncheckedUpdateInput>
  }

  /**
   * WorkItem delete
   */
  export type WorkItemDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the WorkItem
     */
    select?: WorkItemSelect<ExtArgs> | null
    /**
     * Omit specific fields from the WorkItem
     */
    omit?: WorkItemOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: WorkItemInclude<ExtArgs> | null
    /**
     * Filter which WorkItem to delete.
     */
    where: WorkItemWhereUniqueInput
  }

  /**
   * WorkItem deleteMany
   */
  export type WorkItemDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which WorkItems to delete
     */
    where?: WorkItemWhereInput
    /**
     * Limit how many WorkItems to delete.
     */
    limit?: number
  }

  /**
   * WorkItem.department
   */
  export type WorkItem$departmentArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Department
     */
    select?: DepartmentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Department
     */
    omit?: DepartmentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DepartmentInclude<ExtArgs> | null
    where?: DepartmentWhereInput
  }

  /**
   * WorkItem.assignee
   */
  export type WorkItem$assigneeArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    where?: UserWhereInput
  }

  /**
   * WorkItem.transitions
   */
  export type WorkItem$transitionsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the WorkItemTransition
     */
    select?: WorkItemTransitionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the WorkItemTransition
     */
    omit?: WorkItemTransitionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: WorkItemTransitionInclude<ExtArgs> | null
    where?: WorkItemTransitionWhereInput
    orderBy?: WorkItemTransitionOrderByWithRelationInput | WorkItemTransitionOrderByWithRelationInput[]
    cursor?: WorkItemTransitionWhereUniqueInput
    take?: number
    skip?: number
    distinct?: WorkItemTransitionScalarFieldEnum | WorkItemTransitionScalarFieldEnum[]
  }

  /**
   * WorkItem.phaseTimings
   */
  export type WorkItem$phaseTimingsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PhaseTiming
     */
    select?: PhaseTimingSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PhaseTiming
     */
    omit?: PhaseTimingOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PhaseTimingInclude<ExtArgs> | null
    where?: PhaseTimingWhereInput
    orderBy?: PhaseTimingOrderByWithRelationInput | PhaseTimingOrderByWithRelationInput[]
    cursor?: PhaseTimingWhereUniqueInput
    take?: number
    skip?: number
    distinct?: PhaseTimingScalarFieldEnum | PhaseTimingScalarFieldEnum[]
  }

  /**
   * WorkItem without action
   */
  export type WorkItemDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the WorkItem
     */
    select?: WorkItemSelect<ExtArgs> | null
    /**
     * Omit specific fields from the WorkItem
     */
    omit?: WorkItemOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: WorkItemInclude<ExtArgs> | null
  }


  /**
   * Model WorkItemTransition
   */

  export type AggregateWorkItemTransition = {
    _count: WorkItemTransitionCountAggregateOutputType | null
    _min: WorkItemTransitionMinAggregateOutputType | null
    _max: WorkItemTransitionMaxAggregateOutputType | null
  }

  export type WorkItemTransitionMinAggregateOutputType = {
    id: string | null
    workItemId: string | null
    from: $Enums.WorkItemState | null
    to: $Enums.WorkItemState | null
    actorId: string | null
    at: Date | null
    reason: string | null
    rejectionCategory: $Enums.RejectionCategory | null
  }

  export type WorkItemTransitionMaxAggregateOutputType = {
    id: string | null
    workItemId: string | null
    from: $Enums.WorkItemState | null
    to: $Enums.WorkItemState | null
    actorId: string | null
    at: Date | null
    reason: string | null
    rejectionCategory: $Enums.RejectionCategory | null
  }

  export type WorkItemTransitionCountAggregateOutputType = {
    id: number
    workItemId: number
    from: number
    to: number
    actorId: number
    at: number
    reason: number
    rejectionCategory: number
    meta: number
    _all: number
  }


  export type WorkItemTransitionMinAggregateInputType = {
    id?: true
    workItemId?: true
    from?: true
    to?: true
    actorId?: true
    at?: true
    reason?: true
    rejectionCategory?: true
  }

  export type WorkItemTransitionMaxAggregateInputType = {
    id?: true
    workItemId?: true
    from?: true
    to?: true
    actorId?: true
    at?: true
    reason?: true
    rejectionCategory?: true
  }

  export type WorkItemTransitionCountAggregateInputType = {
    id?: true
    workItemId?: true
    from?: true
    to?: true
    actorId?: true
    at?: true
    reason?: true
    rejectionCategory?: true
    meta?: true
    _all?: true
  }

  export type WorkItemTransitionAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which WorkItemTransition to aggregate.
     */
    where?: WorkItemTransitionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of WorkItemTransitions to fetch.
     */
    orderBy?: WorkItemTransitionOrderByWithRelationInput | WorkItemTransitionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: WorkItemTransitionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` WorkItemTransitions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` WorkItemTransitions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned WorkItemTransitions
    **/
    _count?: true | WorkItemTransitionCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: WorkItemTransitionMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: WorkItemTransitionMaxAggregateInputType
  }

  export type GetWorkItemTransitionAggregateType<T extends WorkItemTransitionAggregateArgs> = {
        [P in keyof T & keyof AggregateWorkItemTransition]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateWorkItemTransition[P]>
      : GetScalarType<T[P], AggregateWorkItemTransition[P]>
  }




  export type WorkItemTransitionGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: WorkItemTransitionWhereInput
    orderBy?: WorkItemTransitionOrderByWithAggregationInput | WorkItemTransitionOrderByWithAggregationInput[]
    by: WorkItemTransitionScalarFieldEnum[] | WorkItemTransitionScalarFieldEnum
    having?: WorkItemTransitionScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: WorkItemTransitionCountAggregateInputType | true
    _min?: WorkItemTransitionMinAggregateInputType
    _max?: WorkItemTransitionMaxAggregateInputType
  }

  export type WorkItemTransitionGroupByOutputType = {
    id: string
    workItemId: string
    from: $Enums.WorkItemState
    to: $Enums.WorkItemState
    actorId: string
    at: Date
    reason: string | null
    rejectionCategory: $Enums.RejectionCategory | null
    meta: JsonValue | null
    _count: WorkItemTransitionCountAggregateOutputType | null
    _min: WorkItemTransitionMinAggregateOutputType | null
    _max: WorkItemTransitionMaxAggregateOutputType | null
  }

  type GetWorkItemTransitionGroupByPayload<T extends WorkItemTransitionGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<WorkItemTransitionGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof WorkItemTransitionGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], WorkItemTransitionGroupByOutputType[P]>
            : GetScalarType<T[P], WorkItemTransitionGroupByOutputType[P]>
        }
      >
    >


  export type WorkItemTransitionSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    workItemId?: boolean
    from?: boolean
    to?: boolean
    actorId?: boolean
    at?: boolean
    reason?: boolean
    rejectionCategory?: boolean
    meta?: boolean
    workItem?: boolean | WorkItemDefaultArgs<ExtArgs>
    actor?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["workItemTransition"]>

  export type WorkItemTransitionSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    workItemId?: boolean
    from?: boolean
    to?: boolean
    actorId?: boolean
    at?: boolean
    reason?: boolean
    rejectionCategory?: boolean
    meta?: boolean
    workItem?: boolean | WorkItemDefaultArgs<ExtArgs>
    actor?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["workItemTransition"]>

  export type WorkItemTransitionSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    workItemId?: boolean
    from?: boolean
    to?: boolean
    actorId?: boolean
    at?: boolean
    reason?: boolean
    rejectionCategory?: boolean
    meta?: boolean
    workItem?: boolean | WorkItemDefaultArgs<ExtArgs>
    actor?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["workItemTransition"]>

  export type WorkItemTransitionSelectScalar = {
    id?: boolean
    workItemId?: boolean
    from?: boolean
    to?: boolean
    actorId?: boolean
    at?: boolean
    reason?: boolean
    rejectionCategory?: boolean
    meta?: boolean
  }

  export type WorkItemTransitionOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "workItemId" | "from" | "to" | "actorId" | "at" | "reason" | "rejectionCategory" | "meta", ExtArgs["result"]["workItemTransition"]>
  export type WorkItemTransitionInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    workItem?: boolean | WorkItemDefaultArgs<ExtArgs>
    actor?: boolean | UserDefaultArgs<ExtArgs>
  }
  export type WorkItemTransitionIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    workItem?: boolean | WorkItemDefaultArgs<ExtArgs>
    actor?: boolean | UserDefaultArgs<ExtArgs>
  }
  export type WorkItemTransitionIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    workItem?: boolean | WorkItemDefaultArgs<ExtArgs>
    actor?: boolean | UserDefaultArgs<ExtArgs>
  }

  export type $WorkItemTransitionPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "WorkItemTransition"
    objects: {
      workItem: Prisma.$WorkItemPayload<ExtArgs>
      actor: Prisma.$UserPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      workItemId: string
      from: $Enums.WorkItemState
      to: $Enums.WorkItemState
      actorId: string
      at: Date
      /**
       * Required by the caller for REWORK_REQUIRED and CANCELLED edges
       * (enforced in transitionWorkItem, not the schema).
       */
      reason: string | null
      /**
       * Set only on edges landing in REWORK_REQUIRED; drives the landing-state
       * choice (FR-003b).
       */
      rejectionCategory: $Enums.RejectionCategory | null
      meta: Prisma.JsonValue | null
    }, ExtArgs["result"]["workItemTransition"]>
    composites: {}
  }

  type WorkItemTransitionGetPayload<S extends boolean | null | undefined | WorkItemTransitionDefaultArgs> = $Result.GetResult<Prisma.$WorkItemTransitionPayload, S>

  type WorkItemTransitionCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<WorkItemTransitionFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: WorkItemTransitionCountAggregateInputType | true
    }

  export interface WorkItemTransitionDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['WorkItemTransition'], meta: { name: 'WorkItemTransition' } }
    /**
     * Find zero or one WorkItemTransition that matches the filter.
     * @param {WorkItemTransitionFindUniqueArgs} args - Arguments to find a WorkItemTransition
     * @example
     * // Get one WorkItemTransition
     * const workItemTransition = await prisma.workItemTransition.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends WorkItemTransitionFindUniqueArgs>(args: SelectSubset<T, WorkItemTransitionFindUniqueArgs<ExtArgs>>): Prisma__WorkItemTransitionClient<$Result.GetResult<Prisma.$WorkItemTransitionPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one WorkItemTransition that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {WorkItemTransitionFindUniqueOrThrowArgs} args - Arguments to find a WorkItemTransition
     * @example
     * // Get one WorkItemTransition
     * const workItemTransition = await prisma.workItemTransition.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends WorkItemTransitionFindUniqueOrThrowArgs>(args: SelectSubset<T, WorkItemTransitionFindUniqueOrThrowArgs<ExtArgs>>): Prisma__WorkItemTransitionClient<$Result.GetResult<Prisma.$WorkItemTransitionPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first WorkItemTransition that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {WorkItemTransitionFindFirstArgs} args - Arguments to find a WorkItemTransition
     * @example
     * // Get one WorkItemTransition
     * const workItemTransition = await prisma.workItemTransition.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends WorkItemTransitionFindFirstArgs>(args?: SelectSubset<T, WorkItemTransitionFindFirstArgs<ExtArgs>>): Prisma__WorkItemTransitionClient<$Result.GetResult<Prisma.$WorkItemTransitionPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first WorkItemTransition that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {WorkItemTransitionFindFirstOrThrowArgs} args - Arguments to find a WorkItemTransition
     * @example
     * // Get one WorkItemTransition
     * const workItemTransition = await prisma.workItemTransition.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends WorkItemTransitionFindFirstOrThrowArgs>(args?: SelectSubset<T, WorkItemTransitionFindFirstOrThrowArgs<ExtArgs>>): Prisma__WorkItemTransitionClient<$Result.GetResult<Prisma.$WorkItemTransitionPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more WorkItemTransitions that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {WorkItemTransitionFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all WorkItemTransitions
     * const workItemTransitions = await prisma.workItemTransition.findMany()
     * 
     * // Get first 10 WorkItemTransitions
     * const workItemTransitions = await prisma.workItemTransition.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const workItemTransitionWithIdOnly = await prisma.workItemTransition.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends WorkItemTransitionFindManyArgs>(args?: SelectSubset<T, WorkItemTransitionFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$WorkItemTransitionPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a WorkItemTransition.
     * @param {WorkItemTransitionCreateArgs} args - Arguments to create a WorkItemTransition.
     * @example
     * // Create one WorkItemTransition
     * const WorkItemTransition = await prisma.workItemTransition.create({
     *   data: {
     *     // ... data to create a WorkItemTransition
     *   }
     * })
     * 
     */
    create<T extends WorkItemTransitionCreateArgs>(args: SelectSubset<T, WorkItemTransitionCreateArgs<ExtArgs>>): Prisma__WorkItemTransitionClient<$Result.GetResult<Prisma.$WorkItemTransitionPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many WorkItemTransitions.
     * @param {WorkItemTransitionCreateManyArgs} args - Arguments to create many WorkItemTransitions.
     * @example
     * // Create many WorkItemTransitions
     * const workItemTransition = await prisma.workItemTransition.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends WorkItemTransitionCreateManyArgs>(args?: SelectSubset<T, WorkItemTransitionCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many WorkItemTransitions and returns the data saved in the database.
     * @param {WorkItemTransitionCreateManyAndReturnArgs} args - Arguments to create many WorkItemTransitions.
     * @example
     * // Create many WorkItemTransitions
     * const workItemTransition = await prisma.workItemTransition.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many WorkItemTransitions and only return the `id`
     * const workItemTransitionWithIdOnly = await prisma.workItemTransition.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends WorkItemTransitionCreateManyAndReturnArgs>(args?: SelectSubset<T, WorkItemTransitionCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$WorkItemTransitionPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a WorkItemTransition.
     * @param {WorkItemTransitionDeleteArgs} args - Arguments to delete one WorkItemTransition.
     * @example
     * // Delete one WorkItemTransition
     * const WorkItemTransition = await prisma.workItemTransition.delete({
     *   where: {
     *     // ... filter to delete one WorkItemTransition
     *   }
     * })
     * 
     */
    delete<T extends WorkItemTransitionDeleteArgs>(args: SelectSubset<T, WorkItemTransitionDeleteArgs<ExtArgs>>): Prisma__WorkItemTransitionClient<$Result.GetResult<Prisma.$WorkItemTransitionPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one WorkItemTransition.
     * @param {WorkItemTransitionUpdateArgs} args - Arguments to update one WorkItemTransition.
     * @example
     * // Update one WorkItemTransition
     * const workItemTransition = await prisma.workItemTransition.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends WorkItemTransitionUpdateArgs>(args: SelectSubset<T, WorkItemTransitionUpdateArgs<ExtArgs>>): Prisma__WorkItemTransitionClient<$Result.GetResult<Prisma.$WorkItemTransitionPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more WorkItemTransitions.
     * @param {WorkItemTransitionDeleteManyArgs} args - Arguments to filter WorkItemTransitions to delete.
     * @example
     * // Delete a few WorkItemTransitions
     * const { count } = await prisma.workItemTransition.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends WorkItemTransitionDeleteManyArgs>(args?: SelectSubset<T, WorkItemTransitionDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more WorkItemTransitions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {WorkItemTransitionUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many WorkItemTransitions
     * const workItemTransition = await prisma.workItemTransition.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends WorkItemTransitionUpdateManyArgs>(args: SelectSubset<T, WorkItemTransitionUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more WorkItemTransitions and returns the data updated in the database.
     * @param {WorkItemTransitionUpdateManyAndReturnArgs} args - Arguments to update many WorkItemTransitions.
     * @example
     * // Update many WorkItemTransitions
     * const workItemTransition = await prisma.workItemTransition.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more WorkItemTransitions and only return the `id`
     * const workItemTransitionWithIdOnly = await prisma.workItemTransition.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends WorkItemTransitionUpdateManyAndReturnArgs>(args: SelectSubset<T, WorkItemTransitionUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$WorkItemTransitionPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one WorkItemTransition.
     * @param {WorkItemTransitionUpsertArgs} args - Arguments to update or create a WorkItemTransition.
     * @example
     * // Update or create a WorkItemTransition
     * const workItemTransition = await prisma.workItemTransition.upsert({
     *   create: {
     *     // ... data to create a WorkItemTransition
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the WorkItemTransition we want to update
     *   }
     * })
     */
    upsert<T extends WorkItemTransitionUpsertArgs>(args: SelectSubset<T, WorkItemTransitionUpsertArgs<ExtArgs>>): Prisma__WorkItemTransitionClient<$Result.GetResult<Prisma.$WorkItemTransitionPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of WorkItemTransitions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {WorkItemTransitionCountArgs} args - Arguments to filter WorkItemTransitions to count.
     * @example
     * // Count the number of WorkItemTransitions
     * const count = await prisma.workItemTransition.count({
     *   where: {
     *     // ... the filter for the WorkItemTransitions we want to count
     *   }
     * })
    **/
    count<T extends WorkItemTransitionCountArgs>(
      args?: Subset<T, WorkItemTransitionCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], WorkItemTransitionCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a WorkItemTransition.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {WorkItemTransitionAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends WorkItemTransitionAggregateArgs>(args: Subset<T, WorkItemTransitionAggregateArgs>): Prisma.PrismaPromise<GetWorkItemTransitionAggregateType<T>>

    /**
     * Group by WorkItemTransition.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {WorkItemTransitionGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends WorkItemTransitionGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: WorkItemTransitionGroupByArgs['orderBy'] }
        : { orderBy?: WorkItemTransitionGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, WorkItemTransitionGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetWorkItemTransitionGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the WorkItemTransition model
   */
  readonly fields: WorkItemTransitionFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for WorkItemTransition.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__WorkItemTransitionClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    workItem<T extends WorkItemDefaultArgs<ExtArgs> = {}>(args?: Subset<T, WorkItemDefaultArgs<ExtArgs>>): Prisma__WorkItemClient<$Result.GetResult<Prisma.$WorkItemPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    actor<T extends UserDefaultArgs<ExtArgs> = {}>(args?: Subset<T, UserDefaultArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the WorkItemTransition model
   */
  interface WorkItemTransitionFieldRefs {
    readonly id: FieldRef<"WorkItemTransition", 'String'>
    readonly workItemId: FieldRef<"WorkItemTransition", 'String'>
    readonly from: FieldRef<"WorkItemTransition", 'WorkItemState'>
    readonly to: FieldRef<"WorkItemTransition", 'WorkItemState'>
    readonly actorId: FieldRef<"WorkItemTransition", 'String'>
    readonly at: FieldRef<"WorkItemTransition", 'DateTime'>
    readonly reason: FieldRef<"WorkItemTransition", 'String'>
    readonly rejectionCategory: FieldRef<"WorkItemTransition", 'RejectionCategory'>
    readonly meta: FieldRef<"WorkItemTransition", 'Json'>
  }
    

  // Custom InputTypes
  /**
   * WorkItemTransition findUnique
   */
  export type WorkItemTransitionFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the WorkItemTransition
     */
    select?: WorkItemTransitionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the WorkItemTransition
     */
    omit?: WorkItemTransitionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: WorkItemTransitionInclude<ExtArgs> | null
    /**
     * Filter, which WorkItemTransition to fetch.
     */
    where: WorkItemTransitionWhereUniqueInput
  }

  /**
   * WorkItemTransition findUniqueOrThrow
   */
  export type WorkItemTransitionFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the WorkItemTransition
     */
    select?: WorkItemTransitionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the WorkItemTransition
     */
    omit?: WorkItemTransitionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: WorkItemTransitionInclude<ExtArgs> | null
    /**
     * Filter, which WorkItemTransition to fetch.
     */
    where: WorkItemTransitionWhereUniqueInput
  }

  /**
   * WorkItemTransition findFirst
   */
  export type WorkItemTransitionFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the WorkItemTransition
     */
    select?: WorkItemTransitionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the WorkItemTransition
     */
    omit?: WorkItemTransitionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: WorkItemTransitionInclude<ExtArgs> | null
    /**
     * Filter, which WorkItemTransition to fetch.
     */
    where?: WorkItemTransitionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of WorkItemTransitions to fetch.
     */
    orderBy?: WorkItemTransitionOrderByWithRelationInput | WorkItemTransitionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for WorkItemTransitions.
     */
    cursor?: WorkItemTransitionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` WorkItemTransitions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` WorkItemTransitions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of WorkItemTransitions.
     */
    distinct?: WorkItemTransitionScalarFieldEnum | WorkItemTransitionScalarFieldEnum[]
  }

  /**
   * WorkItemTransition findFirstOrThrow
   */
  export type WorkItemTransitionFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the WorkItemTransition
     */
    select?: WorkItemTransitionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the WorkItemTransition
     */
    omit?: WorkItemTransitionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: WorkItemTransitionInclude<ExtArgs> | null
    /**
     * Filter, which WorkItemTransition to fetch.
     */
    where?: WorkItemTransitionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of WorkItemTransitions to fetch.
     */
    orderBy?: WorkItemTransitionOrderByWithRelationInput | WorkItemTransitionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for WorkItemTransitions.
     */
    cursor?: WorkItemTransitionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` WorkItemTransitions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` WorkItemTransitions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of WorkItemTransitions.
     */
    distinct?: WorkItemTransitionScalarFieldEnum | WorkItemTransitionScalarFieldEnum[]
  }

  /**
   * WorkItemTransition findMany
   */
  export type WorkItemTransitionFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the WorkItemTransition
     */
    select?: WorkItemTransitionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the WorkItemTransition
     */
    omit?: WorkItemTransitionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: WorkItemTransitionInclude<ExtArgs> | null
    /**
     * Filter, which WorkItemTransitions to fetch.
     */
    where?: WorkItemTransitionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of WorkItemTransitions to fetch.
     */
    orderBy?: WorkItemTransitionOrderByWithRelationInput | WorkItemTransitionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing WorkItemTransitions.
     */
    cursor?: WorkItemTransitionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` WorkItemTransitions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` WorkItemTransitions.
     */
    skip?: number
    distinct?: WorkItemTransitionScalarFieldEnum | WorkItemTransitionScalarFieldEnum[]
  }

  /**
   * WorkItemTransition create
   */
  export type WorkItemTransitionCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the WorkItemTransition
     */
    select?: WorkItemTransitionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the WorkItemTransition
     */
    omit?: WorkItemTransitionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: WorkItemTransitionInclude<ExtArgs> | null
    /**
     * The data needed to create a WorkItemTransition.
     */
    data: XOR<WorkItemTransitionCreateInput, WorkItemTransitionUncheckedCreateInput>
  }

  /**
   * WorkItemTransition createMany
   */
  export type WorkItemTransitionCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many WorkItemTransitions.
     */
    data: WorkItemTransitionCreateManyInput | WorkItemTransitionCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * WorkItemTransition createManyAndReturn
   */
  export type WorkItemTransitionCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the WorkItemTransition
     */
    select?: WorkItemTransitionSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the WorkItemTransition
     */
    omit?: WorkItemTransitionOmit<ExtArgs> | null
    /**
     * The data used to create many WorkItemTransitions.
     */
    data: WorkItemTransitionCreateManyInput | WorkItemTransitionCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: WorkItemTransitionIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * WorkItemTransition update
   */
  export type WorkItemTransitionUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the WorkItemTransition
     */
    select?: WorkItemTransitionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the WorkItemTransition
     */
    omit?: WorkItemTransitionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: WorkItemTransitionInclude<ExtArgs> | null
    /**
     * The data needed to update a WorkItemTransition.
     */
    data: XOR<WorkItemTransitionUpdateInput, WorkItemTransitionUncheckedUpdateInput>
    /**
     * Choose, which WorkItemTransition to update.
     */
    where: WorkItemTransitionWhereUniqueInput
  }

  /**
   * WorkItemTransition updateMany
   */
  export type WorkItemTransitionUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update WorkItemTransitions.
     */
    data: XOR<WorkItemTransitionUpdateManyMutationInput, WorkItemTransitionUncheckedUpdateManyInput>
    /**
     * Filter which WorkItemTransitions to update
     */
    where?: WorkItemTransitionWhereInput
    /**
     * Limit how many WorkItemTransitions to update.
     */
    limit?: number
  }

  /**
   * WorkItemTransition updateManyAndReturn
   */
  export type WorkItemTransitionUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the WorkItemTransition
     */
    select?: WorkItemTransitionSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the WorkItemTransition
     */
    omit?: WorkItemTransitionOmit<ExtArgs> | null
    /**
     * The data used to update WorkItemTransitions.
     */
    data: XOR<WorkItemTransitionUpdateManyMutationInput, WorkItemTransitionUncheckedUpdateManyInput>
    /**
     * Filter which WorkItemTransitions to update
     */
    where?: WorkItemTransitionWhereInput
    /**
     * Limit how many WorkItemTransitions to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: WorkItemTransitionIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * WorkItemTransition upsert
   */
  export type WorkItemTransitionUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the WorkItemTransition
     */
    select?: WorkItemTransitionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the WorkItemTransition
     */
    omit?: WorkItemTransitionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: WorkItemTransitionInclude<ExtArgs> | null
    /**
     * The filter to search for the WorkItemTransition to update in case it exists.
     */
    where: WorkItemTransitionWhereUniqueInput
    /**
     * In case the WorkItemTransition found by the `where` argument doesn't exist, create a new WorkItemTransition with this data.
     */
    create: XOR<WorkItemTransitionCreateInput, WorkItemTransitionUncheckedCreateInput>
    /**
     * In case the WorkItemTransition was found with the provided `where` argument, update it with this data.
     */
    update: XOR<WorkItemTransitionUpdateInput, WorkItemTransitionUncheckedUpdateInput>
  }

  /**
   * WorkItemTransition delete
   */
  export type WorkItemTransitionDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the WorkItemTransition
     */
    select?: WorkItemTransitionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the WorkItemTransition
     */
    omit?: WorkItemTransitionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: WorkItemTransitionInclude<ExtArgs> | null
    /**
     * Filter which WorkItemTransition to delete.
     */
    where: WorkItemTransitionWhereUniqueInput
  }

  /**
   * WorkItemTransition deleteMany
   */
  export type WorkItemTransitionDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which WorkItemTransitions to delete
     */
    where?: WorkItemTransitionWhereInput
    /**
     * Limit how many WorkItemTransitions to delete.
     */
    limit?: number
  }

  /**
   * WorkItemTransition without action
   */
  export type WorkItemTransitionDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the WorkItemTransition
     */
    select?: WorkItemTransitionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the WorkItemTransition
     */
    omit?: WorkItemTransitionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: WorkItemTransitionInclude<ExtArgs> | null
  }


  /**
   * Model PhaseTiming
   */

  export type AggregatePhaseTiming = {
    _count: PhaseTimingCountAggregateOutputType | null
    _min: PhaseTimingMinAggregateOutputType | null
    _max: PhaseTimingMaxAggregateOutputType | null
  }

  export type PhaseTimingMinAggregateOutputType = {
    id: string | null
    workItemId: string | null
    phase: $Enums.WorkItemState | null
    userId: string | null
    kind: $Enums.PhaseTimingKind | null
    startedAt: Date | null
    endedAt: Date | null
  }

  export type PhaseTimingMaxAggregateOutputType = {
    id: string | null
    workItemId: string | null
    phase: $Enums.WorkItemState | null
    userId: string | null
    kind: $Enums.PhaseTimingKind | null
    startedAt: Date | null
    endedAt: Date | null
  }

  export type PhaseTimingCountAggregateOutputType = {
    id: number
    workItemId: number
    phase: number
    userId: number
    kind: number
    startedAt: number
    endedAt: number
    _all: number
  }


  export type PhaseTimingMinAggregateInputType = {
    id?: true
    workItemId?: true
    phase?: true
    userId?: true
    kind?: true
    startedAt?: true
    endedAt?: true
  }

  export type PhaseTimingMaxAggregateInputType = {
    id?: true
    workItemId?: true
    phase?: true
    userId?: true
    kind?: true
    startedAt?: true
    endedAt?: true
  }

  export type PhaseTimingCountAggregateInputType = {
    id?: true
    workItemId?: true
    phase?: true
    userId?: true
    kind?: true
    startedAt?: true
    endedAt?: true
    _all?: true
  }

  export type PhaseTimingAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which PhaseTiming to aggregate.
     */
    where?: PhaseTimingWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PhaseTimings to fetch.
     */
    orderBy?: PhaseTimingOrderByWithRelationInput | PhaseTimingOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: PhaseTimingWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PhaseTimings from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PhaseTimings.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned PhaseTimings
    **/
    _count?: true | PhaseTimingCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: PhaseTimingMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: PhaseTimingMaxAggregateInputType
  }

  export type GetPhaseTimingAggregateType<T extends PhaseTimingAggregateArgs> = {
        [P in keyof T & keyof AggregatePhaseTiming]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregatePhaseTiming[P]>
      : GetScalarType<T[P], AggregatePhaseTiming[P]>
  }




  export type PhaseTimingGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PhaseTimingWhereInput
    orderBy?: PhaseTimingOrderByWithAggregationInput | PhaseTimingOrderByWithAggregationInput[]
    by: PhaseTimingScalarFieldEnum[] | PhaseTimingScalarFieldEnum
    having?: PhaseTimingScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: PhaseTimingCountAggregateInputType | true
    _min?: PhaseTimingMinAggregateInputType
    _max?: PhaseTimingMaxAggregateInputType
  }

  export type PhaseTimingGroupByOutputType = {
    id: string
    workItemId: string
    phase: $Enums.WorkItemState
    userId: string | null
    kind: $Enums.PhaseTimingKind
    startedAt: Date
    endedAt: Date | null
    _count: PhaseTimingCountAggregateOutputType | null
    _min: PhaseTimingMinAggregateOutputType | null
    _max: PhaseTimingMaxAggregateOutputType | null
  }

  type GetPhaseTimingGroupByPayload<T extends PhaseTimingGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<PhaseTimingGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof PhaseTimingGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], PhaseTimingGroupByOutputType[P]>
            : GetScalarType<T[P], PhaseTimingGroupByOutputType[P]>
        }
      >
    >


  export type PhaseTimingSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    workItemId?: boolean
    phase?: boolean
    userId?: boolean
    kind?: boolean
    startedAt?: boolean
    endedAt?: boolean
    workItem?: boolean | WorkItemDefaultArgs<ExtArgs>
    user?: boolean | PhaseTiming$userArgs<ExtArgs>
  }, ExtArgs["result"]["phaseTiming"]>

  export type PhaseTimingSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    workItemId?: boolean
    phase?: boolean
    userId?: boolean
    kind?: boolean
    startedAt?: boolean
    endedAt?: boolean
    workItem?: boolean | WorkItemDefaultArgs<ExtArgs>
    user?: boolean | PhaseTiming$userArgs<ExtArgs>
  }, ExtArgs["result"]["phaseTiming"]>

  export type PhaseTimingSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    workItemId?: boolean
    phase?: boolean
    userId?: boolean
    kind?: boolean
    startedAt?: boolean
    endedAt?: boolean
    workItem?: boolean | WorkItemDefaultArgs<ExtArgs>
    user?: boolean | PhaseTiming$userArgs<ExtArgs>
  }, ExtArgs["result"]["phaseTiming"]>

  export type PhaseTimingSelectScalar = {
    id?: boolean
    workItemId?: boolean
    phase?: boolean
    userId?: boolean
    kind?: boolean
    startedAt?: boolean
    endedAt?: boolean
  }

  export type PhaseTimingOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "workItemId" | "phase" | "userId" | "kind" | "startedAt" | "endedAt", ExtArgs["result"]["phaseTiming"]>
  export type PhaseTimingInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    workItem?: boolean | WorkItemDefaultArgs<ExtArgs>
    user?: boolean | PhaseTiming$userArgs<ExtArgs>
  }
  export type PhaseTimingIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    workItem?: boolean | WorkItemDefaultArgs<ExtArgs>
    user?: boolean | PhaseTiming$userArgs<ExtArgs>
  }
  export type PhaseTimingIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    workItem?: boolean | WorkItemDefaultArgs<ExtArgs>
    user?: boolean | PhaseTiming$userArgs<ExtArgs>
  }

  export type $PhaseTimingPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "PhaseTiming"
    objects: {
      workItem: Prisma.$WorkItemPayload<ExtArgs>
      user: Prisma.$UserPayload<ExtArgs> | null
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      workItemId: string
      /**
       * Which state this timing segment belongs to.
       */
      phase: $Enums.WorkItemState
      /**
       * Null for QUEUE segments (nobody "actively" queues).
       */
      userId: string | null
      kind: $Enums.PhaseTimingKind
      startedAt: Date
      /**
       * Null while the segment is open; pausing sets this, resuming starts a
       * new segment (spec FR-009).
       */
      endedAt: Date | null
    }, ExtArgs["result"]["phaseTiming"]>
    composites: {}
  }

  type PhaseTimingGetPayload<S extends boolean | null | undefined | PhaseTimingDefaultArgs> = $Result.GetResult<Prisma.$PhaseTimingPayload, S>

  type PhaseTimingCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<PhaseTimingFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: PhaseTimingCountAggregateInputType | true
    }

  export interface PhaseTimingDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['PhaseTiming'], meta: { name: 'PhaseTiming' } }
    /**
     * Find zero or one PhaseTiming that matches the filter.
     * @param {PhaseTimingFindUniqueArgs} args - Arguments to find a PhaseTiming
     * @example
     * // Get one PhaseTiming
     * const phaseTiming = await prisma.phaseTiming.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends PhaseTimingFindUniqueArgs>(args: SelectSubset<T, PhaseTimingFindUniqueArgs<ExtArgs>>): Prisma__PhaseTimingClient<$Result.GetResult<Prisma.$PhaseTimingPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one PhaseTiming that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {PhaseTimingFindUniqueOrThrowArgs} args - Arguments to find a PhaseTiming
     * @example
     * // Get one PhaseTiming
     * const phaseTiming = await prisma.phaseTiming.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends PhaseTimingFindUniqueOrThrowArgs>(args: SelectSubset<T, PhaseTimingFindUniqueOrThrowArgs<ExtArgs>>): Prisma__PhaseTimingClient<$Result.GetResult<Prisma.$PhaseTimingPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first PhaseTiming that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PhaseTimingFindFirstArgs} args - Arguments to find a PhaseTiming
     * @example
     * // Get one PhaseTiming
     * const phaseTiming = await prisma.phaseTiming.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends PhaseTimingFindFirstArgs>(args?: SelectSubset<T, PhaseTimingFindFirstArgs<ExtArgs>>): Prisma__PhaseTimingClient<$Result.GetResult<Prisma.$PhaseTimingPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first PhaseTiming that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PhaseTimingFindFirstOrThrowArgs} args - Arguments to find a PhaseTiming
     * @example
     * // Get one PhaseTiming
     * const phaseTiming = await prisma.phaseTiming.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends PhaseTimingFindFirstOrThrowArgs>(args?: SelectSubset<T, PhaseTimingFindFirstOrThrowArgs<ExtArgs>>): Prisma__PhaseTimingClient<$Result.GetResult<Prisma.$PhaseTimingPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more PhaseTimings that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PhaseTimingFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all PhaseTimings
     * const phaseTimings = await prisma.phaseTiming.findMany()
     * 
     * // Get first 10 PhaseTimings
     * const phaseTimings = await prisma.phaseTiming.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const phaseTimingWithIdOnly = await prisma.phaseTiming.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends PhaseTimingFindManyArgs>(args?: SelectSubset<T, PhaseTimingFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PhaseTimingPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a PhaseTiming.
     * @param {PhaseTimingCreateArgs} args - Arguments to create a PhaseTiming.
     * @example
     * // Create one PhaseTiming
     * const PhaseTiming = await prisma.phaseTiming.create({
     *   data: {
     *     // ... data to create a PhaseTiming
     *   }
     * })
     * 
     */
    create<T extends PhaseTimingCreateArgs>(args: SelectSubset<T, PhaseTimingCreateArgs<ExtArgs>>): Prisma__PhaseTimingClient<$Result.GetResult<Prisma.$PhaseTimingPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many PhaseTimings.
     * @param {PhaseTimingCreateManyArgs} args - Arguments to create many PhaseTimings.
     * @example
     * // Create many PhaseTimings
     * const phaseTiming = await prisma.phaseTiming.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends PhaseTimingCreateManyArgs>(args?: SelectSubset<T, PhaseTimingCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many PhaseTimings and returns the data saved in the database.
     * @param {PhaseTimingCreateManyAndReturnArgs} args - Arguments to create many PhaseTimings.
     * @example
     * // Create many PhaseTimings
     * const phaseTiming = await prisma.phaseTiming.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many PhaseTimings and only return the `id`
     * const phaseTimingWithIdOnly = await prisma.phaseTiming.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends PhaseTimingCreateManyAndReturnArgs>(args?: SelectSubset<T, PhaseTimingCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PhaseTimingPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a PhaseTiming.
     * @param {PhaseTimingDeleteArgs} args - Arguments to delete one PhaseTiming.
     * @example
     * // Delete one PhaseTiming
     * const PhaseTiming = await prisma.phaseTiming.delete({
     *   where: {
     *     // ... filter to delete one PhaseTiming
     *   }
     * })
     * 
     */
    delete<T extends PhaseTimingDeleteArgs>(args: SelectSubset<T, PhaseTimingDeleteArgs<ExtArgs>>): Prisma__PhaseTimingClient<$Result.GetResult<Prisma.$PhaseTimingPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one PhaseTiming.
     * @param {PhaseTimingUpdateArgs} args - Arguments to update one PhaseTiming.
     * @example
     * // Update one PhaseTiming
     * const phaseTiming = await prisma.phaseTiming.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends PhaseTimingUpdateArgs>(args: SelectSubset<T, PhaseTimingUpdateArgs<ExtArgs>>): Prisma__PhaseTimingClient<$Result.GetResult<Prisma.$PhaseTimingPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more PhaseTimings.
     * @param {PhaseTimingDeleteManyArgs} args - Arguments to filter PhaseTimings to delete.
     * @example
     * // Delete a few PhaseTimings
     * const { count } = await prisma.phaseTiming.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends PhaseTimingDeleteManyArgs>(args?: SelectSubset<T, PhaseTimingDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more PhaseTimings.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PhaseTimingUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many PhaseTimings
     * const phaseTiming = await prisma.phaseTiming.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends PhaseTimingUpdateManyArgs>(args: SelectSubset<T, PhaseTimingUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more PhaseTimings and returns the data updated in the database.
     * @param {PhaseTimingUpdateManyAndReturnArgs} args - Arguments to update many PhaseTimings.
     * @example
     * // Update many PhaseTimings
     * const phaseTiming = await prisma.phaseTiming.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more PhaseTimings and only return the `id`
     * const phaseTimingWithIdOnly = await prisma.phaseTiming.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends PhaseTimingUpdateManyAndReturnArgs>(args: SelectSubset<T, PhaseTimingUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PhaseTimingPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one PhaseTiming.
     * @param {PhaseTimingUpsertArgs} args - Arguments to update or create a PhaseTiming.
     * @example
     * // Update or create a PhaseTiming
     * const phaseTiming = await prisma.phaseTiming.upsert({
     *   create: {
     *     // ... data to create a PhaseTiming
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the PhaseTiming we want to update
     *   }
     * })
     */
    upsert<T extends PhaseTimingUpsertArgs>(args: SelectSubset<T, PhaseTimingUpsertArgs<ExtArgs>>): Prisma__PhaseTimingClient<$Result.GetResult<Prisma.$PhaseTimingPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of PhaseTimings.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PhaseTimingCountArgs} args - Arguments to filter PhaseTimings to count.
     * @example
     * // Count the number of PhaseTimings
     * const count = await prisma.phaseTiming.count({
     *   where: {
     *     // ... the filter for the PhaseTimings we want to count
     *   }
     * })
    **/
    count<T extends PhaseTimingCountArgs>(
      args?: Subset<T, PhaseTimingCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], PhaseTimingCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a PhaseTiming.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PhaseTimingAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends PhaseTimingAggregateArgs>(args: Subset<T, PhaseTimingAggregateArgs>): Prisma.PrismaPromise<GetPhaseTimingAggregateType<T>>

    /**
     * Group by PhaseTiming.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PhaseTimingGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends PhaseTimingGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: PhaseTimingGroupByArgs['orderBy'] }
        : { orderBy?: PhaseTimingGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, PhaseTimingGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetPhaseTimingGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the PhaseTiming model
   */
  readonly fields: PhaseTimingFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for PhaseTiming.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__PhaseTimingClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    workItem<T extends WorkItemDefaultArgs<ExtArgs> = {}>(args?: Subset<T, WorkItemDefaultArgs<ExtArgs>>): Prisma__WorkItemClient<$Result.GetResult<Prisma.$WorkItemPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    user<T extends PhaseTiming$userArgs<ExtArgs> = {}>(args?: Subset<T, PhaseTiming$userArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the PhaseTiming model
   */
  interface PhaseTimingFieldRefs {
    readonly id: FieldRef<"PhaseTiming", 'String'>
    readonly workItemId: FieldRef<"PhaseTiming", 'String'>
    readonly phase: FieldRef<"PhaseTiming", 'WorkItemState'>
    readonly userId: FieldRef<"PhaseTiming", 'String'>
    readonly kind: FieldRef<"PhaseTiming", 'PhaseTimingKind'>
    readonly startedAt: FieldRef<"PhaseTiming", 'DateTime'>
    readonly endedAt: FieldRef<"PhaseTiming", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * PhaseTiming findUnique
   */
  export type PhaseTimingFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PhaseTiming
     */
    select?: PhaseTimingSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PhaseTiming
     */
    omit?: PhaseTimingOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PhaseTimingInclude<ExtArgs> | null
    /**
     * Filter, which PhaseTiming to fetch.
     */
    where: PhaseTimingWhereUniqueInput
  }

  /**
   * PhaseTiming findUniqueOrThrow
   */
  export type PhaseTimingFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PhaseTiming
     */
    select?: PhaseTimingSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PhaseTiming
     */
    omit?: PhaseTimingOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PhaseTimingInclude<ExtArgs> | null
    /**
     * Filter, which PhaseTiming to fetch.
     */
    where: PhaseTimingWhereUniqueInput
  }

  /**
   * PhaseTiming findFirst
   */
  export type PhaseTimingFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PhaseTiming
     */
    select?: PhaseTimingSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PhaseTiming
     */
    omit?: PhaseTimingOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PhaseTimingInclude<ExtArgs> | null
    /**
     * Filter, which PhaseTiming to fetch.
     */
    where?: PhaseTimingWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PhaseTimings to fetch.
     */
    orderBy?: PhaseTimingOrderByWithRelationInput | PhaseTimingOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for PhaseTimings.
     */
    cursor?: PhaseTimingWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PhaseTimings from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PhaseTimings.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PhaseTimings.
     */
    distinct?: PhaseTimingScalarFieldEnum | PhaseTimingScalarFieldEnum[]
  }

  /**
   * PhaseTiming findFirstOrThrow
   */
  export type PhaseTimingFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PhaseTiming
     */
    select?: PhaseTimingSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PhaseTiming
     */
    omit?: PhaseTimingOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PhaseTimingInclude<ExtArgs> | null
    /**
     * Filter, which PhaseTiming to fetch.
     */
    where?: PhaseTimingWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PhaseTimings to fetch.
     */
    orderBy?: PhaseTimingOrderByWithRelationInput | PhaseTimingOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for PhaseTimings.
     */
    cursor?: PhaseTimingWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PhaseTimings from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PhaseTimings.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PhaseTimings.
     */
    distinct?: PhaseTimingScalarFieldEnum | PhaseTimingScalarFieldEnum[]
  }

  /**
   * PhaseTiming findMany
   */
  export type PhaseTimingFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PhaseTiming
     */
    select?: PhaseTimingSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PhaseTiming
     */
    omit?: PhaseTimingOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PhaseTimingInclude<ExtArgs> | null
    /**
     * Filter, which PhaseTimings to fetch.
     */
    where?: PhaseTimingWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PhaseTimings to fetch.
     */
    orderBy?: PhaseTimingOrderByWithRelationInput | PhaseTimingOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing PhaseTimings.
     */
    cursor?: PhaseTimingWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PhaseTimings from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PhaseTimings.
     */
    skip?: number
    distinct?: PhaseTimingScalarFieldEnum | PhaseTimingScalarFieldEnum[]
  }

  /**
   * PhaseTiming create
   */
  export type PhaseTimingCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PhaseTiming
     */
    select?: PhaseTimingSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PhaseTiming
     */
    omit?: PhaseTimingOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PhaseTimingInclude<ExtArgs> | null
    /**
     * The data needed to create a PhaseTiming.
     */
    data: XOR<PhaseTimingCreateInput, PhaseTimingUncheckedCreateInput>
  }

  /**
   * PhaseTiming createMany
   */
  export type PhaseTimingCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many PhaseTimings.
     */
    data: PhaseTimingCreateManyInput | PhaseTimingCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * PhaseTiming createManyAndReturn
   */
  export type PhaseTimingCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PhaseTiming
     */
    select?: PhaseTimingSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the PhaseTiming
     */
    omit?: PhaseTimingOmit<ExtArgs> | null
    /**
     * The data used to create many PhaseTimings.
     */
    data: PhaseTimingCreateManyInput | PhaseTimingCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PhaseTimingIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * PhaseTiming update
   */
  export type PhaseTimingUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PhaseTiming
     */
    select?: PhaseTimingSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PhaseTiming
     */
    omit?: PhaseTimingOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PhaseTimingInclude<ExtArgs> | null
    /**
     * The data needed to update a PhaseTiming.
     */
    data: XOR<PhaseTimingUpdateInput, PhaseTimingUncheckedUpdateInput>
    /**
     * Choose, which PhaseTiming to update.
     */
    where: PhaseTimingWhereUniqueInput
  }

  /**
   * PhaseTiming updateMany
   */
  export type PhaseTimingUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update PhaseTimings.
     */
    data: XOR<PhaseTimingUpdateManyMutationInput, PhaseTimingUncheckedUpdateManyInput>
    /**
     * Filter which PhaseTimings to update
     */
    where?: PhaseTimingWhereInput
    /**
     * Limit how many PhaseTimings to update.
     */
    limit?: number
  }

  /**
   * PhaseTiming updateManyAndReturn
   */
  export type PhaseTimingUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PhaseTiming
     */
    select?: PhaseTimingSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the PhaseTiming
     */
    omit?: PhaseTimingOmit<ExtArgs> | null
    /**
     * The data used to update PhaseTimings.
     */
    data: XOR<PhaseTimingUpdateManyMutationInput, PhaseTimingUncheckedUpdateManyInput>
    /**
     * Filter which PhaseTimings to update
     */
    where?: PhaseTimingWhereInput
    /**
     * Limit how many PhaseTimings to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PhaseTimingIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * PhaseTiming upsert
   */
  export type PhaseTimingUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PhaseTiming
     */
    select?: PhaseTimingSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PhaseTiming
     */
    omit?: PhaseTimingOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PhaseTimingInclude<ExtArgs> | null
    /**
     * The filter to search for the PhaseTiming to update in case it exists.
     */
    where: PhaseTimingWhereUniqueInput
    /**
     * In case the PhaseTiming found by the `where` argument doesn't exist, create a new PhaseTiming with this data.
     */
    create: XOR<PhaseTimingCreateInput, PhaseTimingUncheckedCreateInput>
    /**
     * In case the PhaseTiming was found with the provided `where` argument, update it with this data.
     */
    update: XOR<PhaseTimingUpdateInput, PhaseTimingUncheckedUpdateInput>
  }

  /**
   * PhaseTiming delete
   */
  export type PhaseTimingDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PhaseTiming
     */
    select?: PhaseTimingSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PhaseTiming
     */
    omit?: PhaseTimingOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PhaseTimingInclude<ExtArgs> | null
    /**
     * Filter which PhaseTiming to delete.
     */
    where: PhaseTimingWhereUniqueInput
  }

  /**
   * PhaseTiming deleteMany
   */
  export type PhaseTimingDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which PhaseTimings to delete
     */
    where?: PhaseTimingWhereInput
    /**
     * Limit how many PhaseTimings to delete.
     */
    limit?: number
  }

  /**
   * PhaseTiming.user
   */
  export type PhaseTiming$userArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    where?: UserWhereInput
  }

  /**
   * PhaseTiming without action
   */
  export type PhaseTimingDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PhaseTiming
     */
    select?: PhaseTimingSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PhaseTiming
     */
    omit?: PhaseTimingOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PhaseTimingInclude<ExtArgs> | null
  }


  /**
   * Model NotificationEvent
   */

  export type AggregateNotificationEvent = {
    _count: NotificationEventCountAggregateOutputType | null
    _min: NotificationEventMinAggregateOutputType | null
    _max: NotificationEventMaxAggregateOutputType | null
  }

  export type NotificationEventMinAggregateOutputType = {
    id: string | null
    type: string | null
    entityType: string | null
    entityId: string | null
    createdAt: Date | null
    deliveredAt: Date | null
    deliveryStatus: string | null
  }

  export type NotificationEventMaxAggregateOutputType = {
    id: string | null
    type: string | null
    entityType: string | null
    entityId: string | null
    createdAt: Date | null
    deliveredAt: Date | null
    deliveryStatus: string | null
  }

  export type NotificationEventCountAggregateOutputType = {
    id: number
    type: number
    entityType: number
    entityId: number
    recipientUserIds: number
    recipientRoles: number
    recipientDepartmentIds: number
    payload: number
    createdAt: number
    deliveredAt: number
    deliveryStatus: number
    _all: number
  }


  export type NotificationEventMinAggregateInputType = {
    id?: true
    type?: true
    entityType?: true
    entityId?: true
    createdAt?: true
    deliveredAt?: true
    deliveryStatus?: true
  }

  export type NotificationEventMaxAggregateInputType = {
    id?: true
    type?: true
    entityType?: true
    entityId?: true
    createdAt?: true
    deliveredAt?: true
    deliveryStatus?: true
  }

  export type NotificationEventCountAggregateInputType = {
    id?: true
    type?: true
    entityType?: true
    entityId?: true
    recipientUserIds?: true
    recipientRoles?: true
    recipientDepartmentIds?: true
    payload?: true
    createdAt?: true
    deliveredAt?: true
    deliveryStatus?: true
    _all?: true
  }

  export type NotificationEventAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which NotificationEvent to aggregate.
     */
    where?: NotificationEventWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of NotificationEvents to fetch.
     */
    orderBy?: NotificationEventOrderByWithRelationInput | NotificationEventOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: NotificationEventWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` NotificationEvents from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` NotificationEvents.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned NotificationEvents
    **/
    _count?: true | NotificationEventCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: NotificationEventMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: NotificationEventMaxAggregateInputType
  }

  export type GetNotificationEventAggregateType<T extends NotificationEventAggregateArgs> = {
        [P in keyof T & keyof AggregateNotificationEvent]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateNotificationEvent[P]>
      : GetScalarType<T[P], AggregateNotificationEvent[P]>
  }




  export type NotificationEventGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: NotificationEventWhereInput
    orderBy?: NotificationEventOrderByWithAggregationInput | NotificationEventOrderByWithAggregationInput[]
    by: NotificationEventScalarFieldEnum[] | NotificationEventScalarFieldEnum
    having?: NotificationEventScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: NotificationEventCountAggregateInputType | true
    _min?: NotificationEventMinAggregateInputType
    _max?: NotificationEventMaxAggregateInputType
  }

  export type NotificationEventGroupByOutputType = {
    id: string
    type: string
    entityType: string
    entityId: string
    recipientUserIds: string[]
    recipientRoles: string[]
    recipientDepartmentIds: string[]
    payload: JsonValue | null
    createdAt: Date
    deliveredAt: Date | null
    deliveryStatus: string | null
    _count: NotificationEventCountAggregateOutputType | null
    _min: NotificationEventMinAggregateOutputType | null
    _max: NotificationEventMaxAggregateOutputType | null
  }

  type GetNotificationEventGroupByPayload<T extends NotificationEventGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<NotificationEventGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof NotificationEventGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], NotificationEventGroupByOutputType[P]>
            : GetScalarType<T[P], NotificationEventGroupByOutputType[P]>
        }
      >
    >


  export type NotificationEventSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    type?: boolean
    entityType?: boolean
    entityId?: boolean
    recipientUserIds?: boolean
    recipientRoles?: boolean
    recipientDepartmentIds?: boolean
    payload?: boolean
    createdAt?: boolean
    deliveredAt?: boolean
    deliveryStatus?: boolean
  }, ExtArgs["result"]["notificationEvent"]>

  export type NotificationEventSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    type?: boolean
    entityType?: boolean
    entityId?: boolean
    recipientUserIds?: boolean
    recipientRoles?: boolean
    recipientDepartmentIds?: boolean
    payload?: boolean
    createdAt?: boolean
    deliveredAt?: boolean
    deliveryStatus?: boolean
  }, ExtArgs["result"]["notificationEvent"]>

  export type NotificationEventSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    type?: boolean
    entityType?: boolean
    entityId?: boolean
    recipientUserIds?: boolean
    recipientRoles?: boolean
    recipientDepartmentIds?: boolean
    payload?: boolean
    createdAt?: boolean
    deliveredAt?: boolean
    deliveryStatus?: boolean
  }, ExtArgs["result"]["notificationEvent"]>

  export type NotificationEventSelectScalar = {
    id?: boolean
    type?: boolean
    entityType?: boolean
    entityId?: boolean
    recipientUserIds?: boolean
    recipientRoles?: boolean
    recipientDepartmentIds?: boolean
    payload?: boolean
    createdAt?: boolean
    deliveredAt?: boolean
    deliveryStatus?: boolean
  }

  export type NotificationEventOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "type" | "entityType" | "entityId" | "recipientUserIds" | "recipientRoles" | "recipientDepartmentIds" | "payload" | "createdAt" | "deliveredAt" | "deliveryStatus", ExtArgs["result"]["notificationEvent"]>

  export type $NotificationEventPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "NotificationEvent"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: string
      /**
       * Event type discriminator, e.g. "work_item.rejected".
       */
      type: string
      entityType: string
      entityId: string
      recipientUserIds: string[]
      recipientRoles: string[]
      recipientDepartmentIds: string[]
      payload: Prisma.JsonValue | null
      createdAt: Date
      /**
       * Left null; written by 053.
       */
      deliveredAt: Date | null
      /**
       * Left null; written by 053.
       */
      deliveryStatus: string | null
    }, ExtArgs["result"]["notificationEvent"]>
    composites: {}
  }

  type NotificationEventGetPayload<S extends boolean | null | undefined | NotificationEventDefaultArgs> = $Result.GetResult<Prisma.$NotificationEventPayload, S>

  type NotificationEventCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<NotificationEventFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: NotificationEventCountAggregateInputType | true
    }

  export interface NotificationEventDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['NotificationEvent'], meta: { name: 'NotificationEvent' } }
    /**
     * Find zero or one NotificationEvent that matches the filter.
     * @param {NotificationEventFindUniqueArgs} args - Arguments to find a NotificationEvent
     * @example
     * // Get one NotificationEvent
     * const notificationEvent = await prisma.notificationEvent.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends NotificationEventFindUniqueArgs>(args: SelectSubset<T, NotificationEventFindUniqueArgs<ExtArgs>>): Prisma__NotificationEventClient<$Result.GetResult<Prisma.$NotificationEventPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one NotificationEvent that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {NotificationEventFindUniqueOrThrowArgs} args - Arguments to find a NotificationEvent
     * @example
     * // Get one NotificationEvent
     * const notificationEvent = await prisma.notificationEvent.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends NotificationEventFindUniqueOrThrowArgs>(args: SelectSubset<T, NotificationEventFindUniqueOrThrowArgs<ExtArgs>>): Prisma__NotificationEventClient<$Result.GetResult<Prisma.$NotificationEventPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first NotificationEvent that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {NotificationEventFindFirstArgs} args - Arguments to find a NotificationEvent
     * @example
     * // Get one NotificationEvent
     * const notificationEvent = await prisma.notificationEvent.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends NotificationEventFindFirstArgs>(args?: SelectSubset<T, NotificationEventFindFirstArgs<ExtArgs>>): Prisma__NotificationEventClient<$Result.GetResult<Prisma.$NotificationEventPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first NotificationEvent that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {NotificationEventFindFirstOrThrowArgs} args - Arguments to find a NotificationEvent
     * @example
     * // Get one NotificationEvent
     * const notificationEvent = await prisma.notificationEvent.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends NotificationEventFindFirstOrThrowArgs>(args?: SelectSubset<T, NotificationEventFindFirstOrThrowArgs<ExtArgs>>): Prisma__NotificationEventClient<$Result.GetResult<Prisma.$NotificationEventPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more NotificationEvents that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {NotificationEventFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all NotificationEvents
     * const notificationEvents = await prisma.notificationEvent.findMany()
     * 
     * // Get first 10 NotificationEvents
     * const notificationEvents = await prisma.notificationEvent.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const notificationEventWithIdOnly = await prisma.notificationEvent.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends NotificationEventFindManyArgs>(args?: SelectSubset<T, NotificationEventFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$NotificationEventPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a NotificationEvent.
     * @param {NotificationEventCreateArgs} args - Arguments to create a NotificationEvent.
     * @example
     * // Create one NotificationEvent
     * const NotificationEvent = await prisma.notificationEvent.create({
     *   data: {
     *     // ... data to create a NotificationEvent
     *   }
     * })
     * 
     */
    create<T extends NotificationEventCreateArgs>(args: SelectSubset<T, NotificationEventCreateArgs<ExtArgs>>): Prisma__NotificationEventClient<$Result.GetResult<Prisma.$NotificationEventPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many NotificationEvents.
     * @param {NotificationEventCreateManyArgs} args - Arguments to create many NotificationEvents.
     * @example
     * // Create many NotificationEvents
     * const notificationEvent = await prisma.notificationEvent.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends NotificationEventCreateManyArgs>(args?: SelectSubset<T, NotificationEventCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many NotificationEvents and returns the data saved in the database.
     * @param {NotificationEventCreateManyAndReturnArgs} args - Arguments to create many NotificationEvents.
     * @example
     * // Create many NotificationEvents
     * const notificationEvent = await prisma.notificationEvent.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many NotificationEvents and only return the `id`
     * const notificationEventWithIdOnly = await prisma.notificationEvent.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends NotificationEventCreateManyAndReturnArgs>(args?: SelectSubset<T, NotificationEventCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$NotificationEventPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a NotificationEvent.
     * @param {NotificationEventDeleteArgs} args - Arguments to delete one NotificationEvent.
     * @example
     * // Delete one NotificationEvent
     * const NotificationEvent = await prisma.notificationEvent.delete({
     *   where: {
     *     // ... filter to delete one NotificationEvent
     *   }
     * })
     * 
     */
    delete<T extends NotificationEventDeleteArgs>(args: SelectSubset<T, NotificationEventDeleteArgs<ExtArgs>>): Prisma__NotificationEventClient<$Result.GetResult<Prisma.$NotificationEventPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one NotificationEvent.
     * @param {NotificationEventUpdateArgs} args - Arguments to update one NotificationEvent.
     * @example
     * // Update one NotificationEvent
     * const notificationEvent = await prisma.notificationEvent.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends NotificationEventUpdateArgs>(args: SelectSubset<T, NotificationEventUpdateArgs<ExtArgs>>): Prisma__NotificationEventClient<$Result.GetResult<Prisma.$NotificationEventPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more NotificationEvents.
     * @param {NotificationEventDeleteManyArgs} args - Arguments to filter NotificationEvents to delete.
     * @example
     * // Delete a few NotificationEvents
     * const { count } = await prisma.notificationEvent.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends NotificationEventDeleteManyArgs>(args?: SelectSubset<T, NotificationEventDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more NotificationEvents.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {NotificationEventUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many NotificationEvents
     * const notificationEvent = await prisma.notificationEvent.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends NotificationEventUpdateManyArgs>(args: SelectSubset<T, NotificationEventUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more NotificationEvents and returns the data updated in the database.
     * @param {NotificationEventUpdateManyAndReturnArgs} args - Arguments to update many NotificationEvents.
     * @example
     * // Update many NotificationEvents
     * const notificationEvent = await prisma.notificationEvent.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more NotificationEvents and only return the `id`
     * const notificationEventWithIdOnly = await prisma.notificationEvent.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends NotificationEventUpdateManyAndReturnArgs>(args: SelectSubset<T, NotificationEventUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$NotificationEventPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one NotificationEvent.
     * @param {NotificationEventUpsertArgs} args - Arguments to update or create a NotificationEvent.
     * @example
     * // Update or create a NotificationEvent
     * const notificationEvent = await prisma.notificationEvent.upsert({
     *   create: {
     *     // ... data to create a NotificationEvent
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the NotificationEvent we want to update
     *   }
     * })
     */
    upsert<T extends NotificationEventUpsertArgs>(args: SelectSubset<T, NotificationEventUpsertArgs<ExtArgs>>): Prisma__NotificationEventClient<$Result.GetResult<Prisma.$NotificationEventPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of NotificationEvents.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {NotificationEventCountArgs} args - Arguments to filter NotificationEvents to count.
     * @example
     * // Count the number of NotificationEvents
     * const count = await prisma.notificationEvent.count({
     *   where: {
     *     // ... the filter for the NotificationEvents we want to count
     *   }
     * })
    **/
    count<T extends NotificationEventCountArgs>(
      args?: Subset<T, NotificationEventCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], NotificationEventCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a NotificationEvent.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {NotificationEventAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends NotificationEventAggregateArgs>(args: Subset<T, NotificationEventAggregateArgs>): Prisma.PrismaPromise<GetNotificationEventAggregateType<T>>

    /**
     * Group by NotificationEvent.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {NotificationEventGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends NotificationEventGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: NotificationEventGroupByArgs['orderBy'] }
        : { orderBy?: NotificationEventGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, NotificationEventGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetNotificationEventGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the NotificationEvent model
   */
  readonly fields: NotificationEventFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for NotificationEvent.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__NotificationEventClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the NotificationEvent model
   */
  interface NotificationEventFieldRefs {
    readonly id: FieldRef<"NotificationEvent", 'String'>
    readonly type: FieldRef<"NotificationEvent", 'String'>
    readonly entityType: FieldRef<"NotificationEvent", 'String'>
    readonly entityId: FieldRef<"NotificationEvent", 'String'>
    readonly recipientUserIds: FieldRef<"NotificationEvent", 'String[]'>
    readonly recipientRoles: FieldRef<"NotificationEvent", 'String[]'>
    readonly recipientDepartmentIds: FieldRef<"NotificationEvent", 'String[]'>
    readonly payload: FieldRef<"NotificationEvent", 'Json'>
    readonly createdAt: FieldRef<"NotificationEvent", 'DateTime'>
    readonly deliveredAt: FieldRef<"NotificationEvent", 'DateTime'>
    readonly deliveryStatus: FieldRef<"NotificationEvent", 'String'>
  }
    

  // Custom InputTypes
  /**
   * NotificationEvent findUnique
   */
  export type NotificationEventFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the NotificationEvent
     */
    select?: NotificationEventSelect<ExtArgs> | null
    /**
     * Omit specific fields from the NotificationEvent
     */
    omit?: NotificationEventOmit<ExtArgs> | null
    /**
     * Filter, which NotificationEvent to fetch.
     */
    where: NotificationEventWhereUniqueInput
  }

  /**
   * NotificationEvent findUniqueOrThrow
   */
  export type NotificationEventFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the NotificationEvent
     */
    select?: NotificationEventSelect<ExtArgs> | null
    /**
     * Omit specific fields from the NotificationEvent
     */
    omit?: NotificationEventOmit<ExtArgs> | null
    /**
     * Filter, which NotificationEvent to fetch.
     */
    where: NotificationEventWhereUniqueInput
  }

  /**
   * NotificationEvent findFirst
   */
  export type NotificationEventFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the NotificationEvent
     */
    select?: NotificationEventSelect<ExtArgs> | null
    /**
     * Omit specific fields from the NotificationEvent
     */
    omit?: NotificationEventOmit<ExtArgs> | null
    /**
     * Filter, which NotificationEvent to fetch.
     */
    where?: NotificationEventWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of NotificationEvents to fetch.
     */
    orderBy?: NotificationEventOrderByWithRelationInput | NotificationEventOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for NotificationEvents.
     */
    cursor?: NotificationEventWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` NotificationEvents from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` NotificationEvents.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of NotificationEvents.
     */
    distinct?: NotificationEventScalarFieldEnum | NotificationEventScalarFieldEnum[]
  }

  /**
   * NotificationEvent findFirstOrThrow
   */
  export type NotificationEventFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the NotificationEvent
     */
    select?: NotificationEventSelect<ExtArgs> | null
    /**
     * Omit specific fields from the NotificationEvent
     */
    omit?: NotificationEventOmit<ExtArgs> | null
    /**
     * Filter, which NotificationEvent to fetch.
     */
    where?: NotificationEventWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of NotificationEvents to fetch.
     */
    orderBy?: NotificationEventOrderByWithRelationInput | NotificationEventOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for NotificationEvents.
     */
    cursor?: NotificationEventWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` NotificationEvents from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` NotificationEvents.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of NotificationEvents.
     */
    distinct?: NotificationEventScalarFieldEnum | NotificationEventScalarFieldEnum[]
  }

  /**
   * NotificationEvent findMany
   */
  export type NotificationEventFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the NotificationEvent
     */
    select?: NotificationEventSelect<ExtArgs> | null
    /**
     * Omit specific fields from the NotificationEvent
     */
    omit?: NotificationEventOmit<ExtArgs> | null
    /**
     * Filter, which NotificationEvents to fetch.
     */
    where?: NotificationEventWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of NotificationEvents to fetch.
     */
    orderBy?: NotificationEventOrderByWithRelationInput | NotificationEventOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing NotificationEvents.
     */
    cursor?: NotificationEventWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` NotificationEvents from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` NotificationEvents.
     */
    skip?: number
    distinct?: NotificationEventScalarFieldEnum | NotificationEventScalarFieldEnum[]
  }

  /**
   * NotificationEvent create
   */
  export type NotificationEventCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the NotificationEvent
     */
    select?: NotificationEventSelect<ExtArgs> | null
    /**
     * Omit specific fields from the NotificationEvent
     */
    omit?: NotificationEventOmit<ExtArgs> | null
    /**
     * The data needed to create a NotificationEvent.
     */
    data: XOR<NotificationEventCreateInput, NotificationEventUncheckedCreateInput>
  }

  /**
   * NotificationEvent createMany
   */
  export type NotificationEventCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many NotificationEvents.
     */
    data: NotificationEventCreateManyInput | NotificationEventCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * NotificationEvent createManyAndReturn
   */
  export type NotificationEventCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the NotificationEvent
     */
    select?: NotificationEventSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the NotificationEvent
     */
    omit?: NotificationEventOmit<ExtArgs> | null
    /**
     * The data used to create many NotificationEvents.
     */
    data: NotificationEventCreateManyInput | NotificationEventCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * NotificationEvent update
   */
  export type NotificationEventUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the NotificationEvent
     */
    select?: NotificationEventSelect<ExtArgs> | null
    /**
     * Omit specific fields from the NotificationEvent
     */
    omit?: NotificationEventOmit<ExtArgs> | null
    /**
     * The data needed to update a NotificationEvent.
     */
    data: XOR<NotificationEventUpdateInput, NotificationEventUncheckedUpdateInput>
    /**
     * Choose, which NotificationEvent to update.
     */
    where: NotificationEventWhereUniqueInput
  }

  /**
   * NotificationEvent updateMany
   */
  export type NotificationEventUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update NotificationEvents.
     */
    data: XOR<NotificationEventUpdateManyMutationInput, NotificationEventUncheckedUpdateManyInput>
    /**
     * Filter which NotificationEvents to update
     */
    where?: NotificationEventWhereInput
    /**
     * Limit how many NotificationEvents to update.
     */
    limit?: number
  }

  /**
   * NotificationEvent updateManyAndReturn
   */
  export type NotificationEventUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the NotificationEvent
     */
    select?: NotificationEventSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the NotificationEvent
     */
    omit?: NotificationEventOmit<ExtArgs> | null
    /**
     * The data used to update NotificationEvents.
     */
    data: XOR<NotificationEventUpdateManyMutationInput, NotificationEventUncheckedUpdateManyInput>
    /**
     * Filter which NotificationEvents to update
     */
    where?: NotificationEventWhereInput
    /**
     * Limit how many NotificationEvents to update.
     */
    limit?: number
  }

  /**
   * NotificationEvent upsert
   */
  export type NotificationEventUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the NotificationEvent
     */
    select?: NotificationEventSelect<ExtArgs> | null
    /**
     * Omit specific fields from the NotificationEvent
     */
    omit?: NotificationEventOmit<ExtArgs> | null
    /**
     * The filter to search for the NotificationEvent to update in case it exists.
     */
    where: NotificationEventWhereUniqueInput
    /**
     * In case the NotificationEvent found by the `where` argument doesn't exist, create a new NotificationEvent with this data.
     */
    create: XOR<NotificationEventCreateInput, NotificationEventUncheckedCreateInput>
    /**
     * In case the NotificationEvent was found with the provided `where` argument, update it with this data.
     */
    update: XOR<NotificationEventUpdateInput, NotificationEventUncheckedUpdateInput>
  }

  /**
   * NotificationEvent delete
   */
  export type NotificationEventDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the NotificationEvent
     */
    select?: NotificationEventSelect<ExtArgs> | null
    /**
     * Omit specific fields from the NotificationEvent
     */
    omit?: NotificationEventOmit<ExtArgs> | null
    /**
     * Filter which NotificationEvent to delete.
     */
    where: NotificationEventWhereUniqueInput
  }

  /**
   * NotificationEvent deleteMany
   */
  export type NotificationEventDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which NotificationEvents to delete
     */
    where?: NotificationEventWhereInput
    /**
     * Limit how many NotificationEvents to delete.
     */
    limit?: number
  }

  /**
   * NotificationEvent without action
   */
  export type NotificationEventDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the NotificationEvent
     */
    select?: NotificationEventSelect<ExtArgs> | null
    /**
     * Omit specific fields from the NotificationEvent
     */
    omit?: NotificationEventOmit<ExtArgs> | null
  }


  /**
   * Model User
   */

  export type AggregateUser = {
    _count: UserCountAggregateOutputType | null
    _min: UserMinAggregateOutputType | null
    _max: UserMaxAggregateOutputType | null
  }

  export type UserMinAggregateOutputType = {
    id: string | null
    name: string | null
    email: string | null
    emailVerified: boolean | null
    image: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type UserMaxAggregateOutputType = {
    id: string | null
    name: string | null
    email: string | null
    emailVerified: boolean | null
    image: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type UserCountAggregateOutputType = {
    id: number
    name: number
    email: number
    emailVerified: number
    image: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type UserMinAggregateInputType = {
    id?: true
    name?: true
    email?: true
    emailVerified?: true
    image?: true
    createdAt?: true
    updatedAt?: true
  }

  export type UserMaxAggregateInputType = {
    id?: true
    name?: true
    email?: true
    emailVerified?: true
    image?: true
    createdAt?: true
    updatedAt?: true
  }

  export type UserCountAggregateInputType = {
    id?: true
    name?: true
    email?: true
    emailVerified?: true
    image?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type UserAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which User to aggregate.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Users
    **/
    _count?: true | UserCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: UserMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: UserMaxAggregateInputType
  }

  export type GetUserAggregateType<T extends UserAggregateArgs> = {
        [P in keyof T & keyof AggregateUser]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateUser[P]>
      : GetScalarType<T[P], AggregateUser[P]>
  }




  export type UserGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: UserWhereInput
    orderBy?: UserOrderByWithAggregationInput | UserOrderByWithAggregationInput[]
    by: UserScalarFieldEnum[] | UserScalarFieldEnum
    having?: UserScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: UserCountAggregateInputType | true
    _min?: UserMinAggregateInputType
    _max?: UserMaxAggregateInputType
  }

  export type UserGroupByOutputType = {
    id: string
    name: string
    email: string
    emailVerified: boolean
    image: string | null
    createdAt: Date
    updatedAt: Date
    _count: UserCountAggregateOutputType | null
    _min: UserMinAggregateOutputType | null
    _max: UserMaxAggregateOutputType | null
  }

  type GetUserGroupByPayload<T extends UserGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<UserGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof UserGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], UserGroupByOutputType[P]>
            : GetScalarType<T[P], UserGroupByOutputType[P]>
        }
      >
    >


  export type UserSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    email?: boolean
    emailVerified?: boolean
    image?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    sessions?: boolean | User$sessionsArgs<ExtArgs>
    accounts?: boolean | User$accountsArgs<ExtArgs>
    createdOrders?: boolean | User$createdOrdersArgs<ExtArgs>
    assignedWorkItems?: boolean | User$assignedWorkItemsArgs<ExtArgs>
    workItemTransitions?: boolean | User$workItemTransitionsArgs<ExtArgs>
    phaseTimings?: boolean | User$phaseTimingsArgs<ExtArgs>
    _count?: boolean | UserCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["user"]>

  export type UserSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    email?: boolean
    emailVerified?: boolean
    image?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["user"]>

  export type UserSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    email?: boolean
    emailVerified?: boolean
    image?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["user"]>

  export type UserSelectScalar = {
    id?: boolean
    name?: boolean
    email?: boolean
    emailVerified?: boolean
    image?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type UserOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "name" | "email" | "emailVerified" | "image" | "createdAt" | "updatedAt", ExtArgs["result"]["user"]>
  export type UserInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    sessions?: boolean | User$sessionsArgs<ExtArgs>
    accounts?: boolean | User$accountsArgs<ExtArgs>
    createdOrders?: boolean | User$createdOrdersArgs<ExtArgs>
    assignedWorkItems?: boolean | User$assignedWorkItemsArgs<ExtArgs>
    workItemTransitions?: boolean | User$workItemTransitionsArgs<ExtArgs>
    phaseTimings?: boolean | User$phaseTimingsArgs<ExtArgs>
    _count?: boolean | UserCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type UserIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}
  export type UserIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}

  export type $UserPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "User"
    objects: {
      sessions: Prisma.$SessionPayload<ExtArgs>[]
      accounts: Prisma.$AccountPayload<ExtArgs>[]
      createdOrders: Prisma.$OrderPayload<ExtArgs>[]
      assignedWorkItems: Prisma.$WorkItemPayload<ExtArgs>[]
      workItemTransitions: Prisma.$WorkItemTransitionPayload<ExtArgs>[]
      phaseTimings: Prisma.$PhaseTimingPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      name: string
      email: string
      emailVerified: boolean
      image: string | null
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["user"]>
    composites: {}
  }

  type UserGetPayload<S extends boolean | null | undefined | UserDefaultArgs> = $Result.GetResult<Prisma.$UserPayload, S>

  type UserCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<UserFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: UserCountAggregateInputType | true
    }

  export interface UserDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['User'], meta: { name: 'User' } }
    /**
     * Find zero or one User that matches the filter.
     * @param {UserFindUniqueArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends UserFindUniqueArgs>(args: SelectSubset<T, UserFindUniqueArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one User that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {UserFindUniqueOrThrowArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends UserFindUniqueOrThrowArgs>(args: SelectSubset<T, UserFindUniqueOrThrowArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first User that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserFindFirstArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends UserFindFirstArgs>(args?: SelectSubset<T, UserFindFirstArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first User that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserFindFirstOrThrowArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends UserFindFirstOrThrowArgs>(args?: SelectSubset<T, UserFindFirstOrThrowArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Users that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Users
     * const users = await prisma.user.findMany()
     * 
     * // Get first 10 Users
     * const users = await prisma.user.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const userWithIdOnly = await prisma.user.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends UserFindManyArgs>(args?: SelectSubset<T, UserFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a User.
     * @param {UserCreateArgs} args - Arguments to create a User.
     * @example
     * // Create one User
     * const User = await prisma.user.create({
     *   data: {
     *     // ... data to create a User
     *   }
     * })
     * 
     */
    create<T extends UserCreateArgs>(args: SelectSubset<T, UserCreateArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Users.
     * @param {UserCreateManyArgs} args - Arguments to create many Users.
     * @example
     * // Create many Users
     * const user = await prisma.user.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends UserCreateManyArgs>(args?: SelectSubset<T, UserCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Users and returns the data saved in the database.
     * @param {UserCreateManyAndReturnArgs} args - Arguments to create many Users.
     * @example
     * // Create many Users
     * const user = await prisma.user.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Users and only return the `id`
     * const userWithIdOnly = await prisma.user.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends UserCreateManyAndReturnArgs>(args?: SelectSubset<T, UserCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a User.
     * @param {UserDeleteArgs} args - Arguments to delete one User.
     * @example
     * // Delete one User
     * const User = await prisma.user.delete({
     *   where: {
     *     // ... filter to delete one User
     *   }
     * })
     * 
     */
    delete<T extends UserDeleteArgs>(args: SelectSubset<T, UserDeleteArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one User.
     * @param {UserUpdateArgs} args - Arguments to update one User.
     * @example
     * // Update one User
     * const user = await prisma.user.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends UserUpdateArgs>(args: SelectSubset<T, UserUpdateArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Users.
     * @param {UserDeleteManyArgs} args - Arguments to filter Users to delete.
     * @example
     * // Delete a few Users
     * const { count } = await prisma.user.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends UserDeleteManyArgs>(args?: SelectSubset<T, UserDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Users.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Users
     * const user = await prisma.user.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends UserUpdateManyArgs>(args: SelectSubset<T, UserUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Users and returns the data updated in the database.
     * @param {UserUpdateManyAndReturnArgs} args - Arguments to update many Users.
     * @example
     * // Update many Users
     * const user = await prisma.user.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Users and only return the `id`
     * const userWithIdOnly = await prisma.user.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends UserUpdateManyAndReturnArgs>(args: SelectSubset<T, UserUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one User.
     * @param {UserUpsertArgs} args - Arguments to update or create a User.
     * @example
     * // Update or create a User
     * const user = await prisma.user.upsert({
     *   create: {
     *     // ... data to create a User
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the User we want to update
     *   }
     * })
     */
    upsert<T extends UserUpsertArgs>(args: SelectSubset<T, UserUpsertArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Users.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserCountArgs} args - Arguments to filter Users to count.
     * @example
     * // Count the number of Users
     * const count = await prisma.user.count({
     *   where: {
     *     // ... the filter for the Users we want to count
     *   }
     * })
    **/
    count<T extends UserCountArgs>(
      args?: Subset<T, UserCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], UserCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a User.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends UserAggregateArgs>(args: Subset<T, UserAggregateArgs>): Prisma.PrismaPromise<GetUserAggregateType<T>>

    /**
     * Group by User.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends UserGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: UserGroupByArgs['orderBy'] }
        : { orderBy?: UserGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, UserGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetUserGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the User model
   */
  readonly fields: UserFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for User.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__UserClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    sessions<T extends User$sessionsArgs<ExtArgs> = {}>(args?: Subset<T, User$sessionsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$SessionPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    accounts<T extends User$accountsArgs<ExtArgs> = {}>(args?: Subset<T, User$accountsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$AccountPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    createdOrders<T extends User$createdOrdersArgs<ExtArgs> = {}>(args?: Subset<T, User$createdOrdersArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$OrderPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    assignedWorkItems<T extends User$assignedWorkItemsArgs<ExtArgs> = {}>(args?: Subset<T, User$assignedWorkItemsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$WorkItemPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    workItemTransitions<T extends User$workItemTransitionsArgs<ExtArgs> = {}>(args?: Subset<T, User$workItemTransitionsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$WorkItemTransitionPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    phaseTimings<T extends User$phaseTimingsArgs<ExtArgs> = {}>(args?: Subset<T, User$phaseTimingsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PhaseTimingPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the User model
   */
  interface UserFieldRefs {
    readonly id: FieldRef<"User", 'String'>
    readonly name: FieldRef<"User", 'String'>
    readonly email: FieldRef<"User", 'String'>
    readonly emailVerified: FieldRef<"User", 'Boolean'>
    readonly image: FieldRef<"User", 'String'>
    readonly createdAt: FieldRef<"User", 'DateTime'>
    readonly updatedAt: FieldRef<"User", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * User findUnique
   */
  export type UserFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User findUniqueOrThrow
   */
  export type UserFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User findFirst
   */
  export type UserFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Users.
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Users.
     */
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
  }

  /**
   * User findFirstOrThrow
   */
  export type UserFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Users.
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Users.
     */
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
  }

  /**
   * User findMany
   */
  export type UserFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which Users to fetch.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Users.
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
  }

  /**
   * User create
   */
  export type UserCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * The data needed to create a User.
     */
    data: XOR<UserCreateInput, UserUncheckedCreateInput>
  }

  /**
   * User createMany
   */
  export type UserCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Users.
     */
    data: UserCreateManyInput | UserCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * User createManyAndReturn
   */
  export type UserCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * The data used to create many Users.
     */
    data: UserCreateManyInput | UserCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * User update
   */
  export type UserUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * The data needed to update a User.
     */
    data: XOR<UserUpdateInput, UserUncheckedUpdateInput>
    /**
     * Choose, which User to update.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User updateMany
   */
  export type UserUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Users.
     */
    data: XOR<UserUpdateManyMutationInput, UserUncheckedUpdateManyInput>
    /**
     * Filter which Users to update
     */
    where?: UserWhereInput
    /**
     * Limit how many Users to update.
     */
    limit?: number
  }

  /**
   * User updateManyAndReturn
   */
  export type UserUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * The data used to update Users.
     */
    data: XOR<UserUpdateManyMutationInput, UserUncheckedUpdateManyInput>
    /**
     * Filter which Users to update
     */
    where?: UserWhereInput
    /**
     * Limit how many Users to update.
     */
    limit?: number
  }

  /**
   * User upsert
   */
  export type UserUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * The filter to search for the User to update in case it exists.
     */
    where: UserWhereUniqueInput
    /**
     * In case the User found by the `where` argument doesn't exist, create a new User with this data.
     */
    create: XOR<UserCreateInput, UserUncheckedCreateInput>
    /**
     * In case the User was found with the provided `where` argument, update it with this data.
     */
    update: XOR<UserUpdateInput, UserUncheckedUpdateInput>
  }

  /**
   * User delete
   */
  export type UserDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter which User to delete.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User deleteMany
   */
  export type UserDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Users to delete
     */
    where?: UserWhereInput
    /**
     * Limit how many Users to delete.
     */
    limit?: number
  }

  /**
   * User.sessions
   */
  export type User$sessionsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Session
     */
    select?: SessionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Session
     */
    omit?: SessionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SessionInclude<ExtArgs> | null
    where?: SessionWhereInput
    orderBy?: SessionOrderByWithRelationInput | SessionOrderByWithRelationInput[]
    cursor?: SessionWhereUniqueInput
    take?: number
    skip?: number
    distinct?: SessionScalarFieldEnum | SessionScalarFieldEnum[]
  }

  /**
   * User.accounts
   */
  export type User$accountsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Account
     */
    select?: AccountSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Account
     */
    omit?: AccountOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AccountInclude<ExtArgs> | null
    where?: AccountWhereInput
    orderBy?: AccountOrderByWithRelationInput | AccountOrderByWithRelationInput[]
    cursor?: AccountWhereUniqueInput
    take?: number
    skip?: number
    distinct?: AccountScalarFieldEnum | AccountScalarFieldEnum[]
  }

  /**
   * User.createdOrders
   */
  export type User$createdOrdersArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Order
     */
    select?: OrderSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Order
     */
    omit?: OrderOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrderInclude<ExtArgs> | null
    where?: OrderWhereInput
    orderBy?: OrderOrderByWithRelationInput | OrderOrderByWithRelationInput[]
    cursor?: OrderWhereUniqueInput
    take?: number
    skip?: number
    distinct?: OrderScalarFieldEnum | OrderScalarFieldEnum[]
  }

  /**
   * User.assignedWorkItems
   */
  export type User$assignedWorkItemsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the WorkItem
     */
    select?: WorkItemSelect<ExtArgs> | null
    /**
     * Omit specific fields from the WorkItem
     */
    omit?: WorkItemOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: WorkItemInclude<ExtArgs> | null
    where?: WorkItemWhereInput
    orderBy?: WorkItemOrderByWithRelationInput | WorkItemOrderByWithRelationInput[]
    cursor?: WorkItemWhereUniqueInput
    take?: number
    skip?: number
    distinct?: WorkItemScalarFieldEnum | WorkItemScalarFieldEnum[]
  }

  /**
   * User.workItemTransitions
   */
  export type User$workItemTransitionsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the WorkItemTransition
     */
    select?: WorkItemTransitionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the WorkItemTransition
     */
    omit?: WorkItemTransitionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: WorkItemTransitionInclude<ExtArgs> | null
    where?: WorkItemTransitionWhereInput
    orderBy?: WorkItemTransitionOrderByWithRelationInput | WorkItemTransitionOrderByWithRelationInput[]
    cursor?: WorkItemTransitionWhereUniqueInput
    take?: number
    skip?: number
    distinct?: WorkItemTransitionScalarFieldEnum | WorkItemTransitionScalarFieldEnum[]
  }

  /**
   * User.phaseTimings
   */
  export type User$phaseTimingsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PhaseTiming
     */
    select?: PhaseTimingSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PhaseTiming
     */
    omit?: PhaseTimingOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PhaseTimingInclude<ExtArgs> | null
    where?: PhaseTimingWhereInput
    orderBy?: PhaseTimingOrderByWithRelationInput | PhaseTimingOrderByWithRelationInput[]
    cursor?: PhaseTimingWhereUniqueInput
    take?: number
    skip?: number
    distinct?: PhaseTimingScalarFieldEnum | PhaseTimingScalarFieldEnum[]
  }

  /**
   * User without action
   */
  export type UserDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
  }


  /**
   * Model Session
   */

  export type AggregateSession = {
    _count: SessionCountAggregateOutputType | null
    _min: SessionMinAggregateOutputType | null
    _max: SessionMaxAggregateOutputType | null
  }

  export type SessionMinAggregateOutputType = {
    id: string | null
    expiresAt: Date | null
    token: string | null
    createdAt: Date | null
    updatedAt: Date | null
    ipAddress: string | null
    userAgent: string | null
    userId: string | null
  }

  export type SessionMaxAggregateOutputType = {
    id: string | null
    expiresAt: Date | null
    token: string | null
    createdAt: Date | null
    updatedAt: Date | null
    ipAddress: string | null
    userAgent: string | null
    userId: string | null
  }

  export type SessionCountAggregateOutputType = {
    id: number
    expiresAt: number
    token: number
    createdAt: number
    updatedAt: number
    ipAddress: number
    userAgent: number
    userId: number
    _all: number
  }


  export type SessionMinAggregateInputType = {
    id?: true
    expiresAt?: true
    token?: true
    createdAt?: true
    updatedAt?: true
    ipAddress?: true
    userAgent?: true
    userId?: true
  }

  export type SessionMaxAggregateInputType = {
    id?: true
    expiresAt?: true
    token?: true
    createdAt?: true
    updatedAt?: true
    ipAddress?: true
    userAgent?: true
    userId?: true
  }

  export type SessionCountAggregateInputType = {
    id?: true
    expiresAt?: true
    token?: true
    createdAt?: true
    updatedAt?: true
    ipAddress?: true
    userAgent?: true
    userId?: true
    _all?: true
  }

  export type SessionAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Session to aggregate.
     */
    where?: SessionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Sessions to fetch.
     */
    orderBy?: SessionOrderByWithRelationInput | SessionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: SessionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Sessions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Sessions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Sessions
    **/
    _count?: true | SessionCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: SessionMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: SessionMaxAggregateInputType
  }

  export type GetSessionAggregateType<T extends SessionAggregateArgs> = {
        [P in keyof T & keyof AggregateSession]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateSession[P]>
      : GetScalarType<T[P], AggregateSession[P]>
  }




  export type SessionGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: SessionWhereInput
    orderBy?: SessionOrderByWithAggregationInput | SessionOrderByWithAggregationInput[]
    by: SessionScalarFieldEnum[] | SessionScalarFieldEnum
    having?: SessionScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: SessionCountAggregateInputType | true
    _min?: SessionMinAggregateInputType
    _max?: SessionMaxAggregateInputType
  }

  export type SessionGroupByOutputType = {
    id: string
    expiresAt: Date
    token: string
    createdAt: Date
    updatedAt: Date
    ipAddress: string | null
    userAgent: string | null
    userId: string
    _count: SessionCountAggregateOutputType | null
    _min: SessionMinAggregateOutputType | null
    _max: SessionMaxAggregateOutputType | null
  }

  type GetSessionGroupByPayload<T extends SessionGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<SessionGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof SessionGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], SessionGroupByOutputType[P]>
            : GetScalarType<T[P], SessionGroupByOutputType[P]>
        }
      >
    >


  export type SessionSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    expiresAt?: boolean
    token?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    ipAddress?: boolean
    userAgent?: boolean
    userId?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["session"]>

  export type SessionSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    expiresAt?: boolean
    token?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    ipAddress?: boolean
    userAgent?: boolean
    userId?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["session"]>

  export type SessionSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    expiresAt?: boolean
    token?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    ipAddress?: boolean
    userAgent?: boolean
    userId?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["session"]>

  export type SessionSelectScalar = {
    id?: boolean
    expiresAt?: boolean
    token?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    ipAddress?: boolean
    userAgent?: boolean
    userId?: boolean
  }

  export type SessionOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "expiresAt" | "token" | "createdAt" | "updatedAt" | "ipAddress" | "userAgent" | "userId", ExtArgs["result"]["session"]>
  export type SessionInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }
  export type SessionIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }
  export type SessionIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }

  export type $SessionPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Session"
    objects: {
      user: Prisma.$UserPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      expiresAt: Date
      token: string
      createdAt: Date
      updatedAt: Date
      ipAddress: string | null
      userAgent: string | null
      userId: string
    }, ExtArgs["result"]["session"]>
    composites: {}
  }

  type SessionGetPayload<S extends boolean | null | undefined | SessionDefaultArgs> = $Result.GetResult<Prisma.$SessionPayload, S>

  type SessionCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<SessionFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: SessionCountAggregateInputType | true
    }

  export interface SessionDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Session'], meta: { name: 'Session' } }
    /**
     * Find zero or one Session that matches the filter.
     * @param {SessionFindUniqueArgs} args - Arguments to find a Session
     * @example
     * // Get one Session
     * const session = await prisma.session.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends SessionFindUniqueArgs>(args: SelectSubset<T, SessionFindUniqueArgs<ExtArgs>>): Prisma__SessionClient<$Result.GetResult<Prisma.$SessionPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Session that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {SessionFindUniqueOrThrowArgs} args - Arguments to find a Session
     * @example
     * // Get one Session
     * const session = await prisma.session.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends SessionFindUniqueOrThrowArgs>(args: SelectSubset<T, SessionFindUniqueOrThrowArgs<ExtArgs>>): Prisma__SessionClient<$Result.GetResult<Prisma.$SessionPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Session that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SessionFindFirstArgs} args - Arguments to find a Session
     * @example
     * // Get one Session
     * const session = await prisma.session.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends SessionFindFirstArgs>(args?: SelectSubset<T, SessionFindFirstArgs<ExtArgs>>): Prisma__SessionClient<$Result.GetResult<Prisma.$SessionPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Session that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SessionFindFirstOrThrowArgs} args - Arguments to find a Session
     * @example
     * // Get one Session
     * const session = await prisma.session.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends SessionFindFirstOrThrowArgs>(args?: SelectSubset<T, SessionFindFirstOrThrowArgs<ExtArgs>>): Prisma__SessionClient<$Result.GetResult<Prisma.$SessionPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Sessions that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SessionFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Sessions
     * const sessions = await prisma.session.findMany()
     * 
     * // Get first 10 Sessions
     * const sessions = await prisma.session.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const sessionWithIdOnly = await prisma.session.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends SessionFindManyArgs>(args?: SelectSubset<T, SessionFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$SessionPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Session.
     * @param {SessionCreateArgs} args - Arguments to create a Session.
     * @example
     * // Create one Session
     * const Session = await prisma.session.create({
     *   data: {
     *     // ... data to create a Session
     *   }
     * })
     * 
     */
    create<T extends SessionCreateArgs>(args: SelectSubset<T, SessionCreateArgs<ExtArgs>>): Prisma__SessionClient<$Result.GetResult<Prisma.$SessionPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Sessions.
     * @param {SessionCreateManyArgs} args - Arguments to create many Sessions.
     * @example
     * // Create many Sessions
     * const session = await prisma.session.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends SessionCreateManyArgs>(args?: SelectSubset<T, SessionCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Sessions and returns the data saved in the database.
     * @param {SessionCreateManyAndReturnArgs} args - Arguments to create many Sessions.
     * @example
     * // Create many Sessions
     * const session = await prisma.session.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Sessions and only return the `id`
     * const sessionWithIdOnly = await prisma.session.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends SessionCreateManyAndReturnArgs>(args?: SelectSubset<T, SessionCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$SessionPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Session.
     * @param {SessionDeleteArgs} args - Arguments to delete one Session.
     * @example
     * // Delete one Session
     * const Session = await prisma.session.delete({
     *   where: {
     *     // ... filter to delete one Session
     *   }
     * })
     * 
     */
    delete<T extends SessionDeleteArgs>(args: SelectSubset<T, SessionDeleteArgs<ExtArgs>>): Prisma__SessionClient<$Result.GetResult<Prisma.$SessionPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Session.
     * @param {SessionUpdateArgs} args - Arguments to update one Session.
     * @example
     * // Update one Session
     * const session = await prisma.session.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends SessionUpdateArgs>(args: SelectSubset<T, SessionUpdateArgs<ExtArgs>>): Prisma__SessionClient<$Result.GetResult<Prisma.$SessionPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Sessions.
     * @param {SessionDeleteManyArgs} args - Arguments to filter Sessions to delete.
     * @example
     * // Delete a few Sessions
     * const { count } = await prisma.session.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends SessionDeleteManyArgs>(args?: SelectSubset<T, SessionDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Sessions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SessionUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Sessions
     * const session = await prisma.session.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends SessionUpdateManyArgs>(args: SelectSubset<T, SessionUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Sessions and returns the data updated in the database.
     * @param {SessionUpdateManyAndReturnArgs} args - Arguments to update many Sessions.
     * @example
     * // Update many Sessions
     * const session = await prisma.session.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Sessions and only return the `id`
     * const sessionWithIdOnly = await prisma.session.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends SessionUpdateManyAndReturnArgs>(args: SelectSubset<T, SessionUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$SessionPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Session.
     * @param {SessionUpsertArgs} args - Arguments to update or create a Session.
     * @example
     * // Update or create a Session
     * const session = await prisma.session.upsert({
     *   create: {
     *     // ... data to create a Session
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Session we want to update
     *   }
     * })
     */
    upsert<T extends SessionUpsertArgs>(args: SelectSubset<T, SessionUpsertArgs<ExtArgs>>): Prisma__SessionClient<$Result.GetResult<Prisma.$SessionPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Sessions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SessionCountArgs} args - Arguments to filter Sessions to count.
     * @example
     * // Count the number of Sessions
     * const count = await prisma.session.count({
     *   where: {
     *     // ... the filter for the Sessions we want to count
     *   }
     * })
    **/
    count<T extends SessionCountArgs>(
      args?: Subset<T, SessionCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], SessionCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Session.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SessionAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends SessionAggregateArgs>(args: Subset<T, SessionAggregateArgs>): Prisma.PrismaPromise<GetSessionAggregateType<T>>

    /**
     * Group by Session.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SessionGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends SessionGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: SessionGroupByArgs['orderBy'] }
        : { orderBy?: SessionGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, SessionGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetSessionGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Session model
   */
  readonly fields: SessionFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Session.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__SessionClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    user<T extends UserDefaultArgs<ExtArgs> = {}>(args?: Subset<T, UserDefaultArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Session model
   */
  interface SessionFieldRefs {
    readonly id: FieldRef<"Session", 'String'>
    readonly expiresAt: FieldRef<"Session", 'DateTime'>
    readonly token: FieldRef<"Session", 'String'>
    readonly createdAt: FieldRef<"Session", 'DateTime'>
    readonly updatedAt: FieldRef<"Session", 'DateTime'>
    readonly ipAddress: FieldRef<"Session", 'String'>
    readonly userAgent: FieldRef<"Session", 'String'>
    readonly userId: FieldRef<"Session", 'String'>
  }
    

  // Custom InputTypes
  /**
   * Session findUnique
   */
  export type SessionFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Session
     */
    select?: SessionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Session
     */
    omit?: SessionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SessionInclude<ExtArgs> | null
    /**
     * Filter, which Session to fetch.
     */
    where: SessionWhereUniqueInput
  }

  /**
   * Session findUniqueOrThrow
   */
  export type SessionFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Session
     */
    select?: SessionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Session
     */
    omit?: SessionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SessionInclude<ExtArgs> | null
    /**
     * Filter, which Session to fetch.
     */
    where: SessionWhereUniqueInput
  }

  /**
   * Session findFirst
   */
  export type SessionFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Session
     */
    select?: SessionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Session
     */
    omit?: SessionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SessionInclude<ExtArgs> | null
    /**
     * Filter, which Session to fetch.
     */
    where?: SessionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Sessions to fetch.
     */
    orderBy?: SessionOrderByWithRelationInput | SessionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Sessions.
     */
    cursor?: SessionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Sessions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Sessions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Sessions.
     */
    distinct?: SessionScalarFieldEnum | SessionScalarFieldEnum[]
  }

  /**
   * Session findFirstOrThrow
   */
  export type SessionFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Session
     */
    select?: SessionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Session
     */
    omit?: SessionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SessionInclude<ExtArgs> | null
    /**
     * Filter, which Session to fetch.
     */
    where?: SessionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Sessions to fetch.
     */
    orderBy?: SessionOrderByWithRelationInput | SessionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Sessions.
     */
    cursor?: SessionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Sessions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Sessions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Sessions.
     */
    distinct?: SessionScalarFieldEnum | SessionScalarFieldEnum[]
  }

  /**
   * Session findMany
   */
  export type SessionFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Session
     */
    select?: SessionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Session
     */
    omit?: SessionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SessionInclude<ExtArgs> | null
    /**
     * Filter, which Sessions to fetch.
     */
    where?: SessionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Sessions to fetch.
     */
    orderBy?: SessionOrderByWithRelationInput | SessionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Sessions.
     */
    cursor?: SessionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Sessions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Sessions.
     */
    skip?: number
    distinct?: SessionScalarFieldEnum | SessionScalarFieldEnum[]
  }

  /**
   * Session create
   */
  export type SessionCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Session
     */
    select?: SessionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Session
     */
    omit?: SessionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SessionInclude<ExtArgs> | null
    /**
     * The data needed to create a Session.
     */
    data: XOR<SessionCreateInput, SessionUncheckedCreateInput>
  }

  /**
   * Session createMany
   */
  export type SessionCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Sessions.
     */
    data: SessionCreateManyInput | SessionCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Session createManyAndReturn
   */
  export type SessionCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Session
     */
    select?: SessionSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Session
     */
    omit?: SessionOmit<ExtArgs> | null
    /**
     * The data used to create many Sessions.
     */
    data: SessionCreateManyInput | SessionCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SessionIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * Session update
   */
  export type SessionUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Session
     */
    select?: SessionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Session
     */
    omit?: SessionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SessionInclude<ExtArgs> | null
    /**
     * The data needed to update a Session.
     */
    data: XOR<SessionUpdateInput, SessionUncheckedUpdateInput>
    /**
     * Choose, which Session to update.
     */
    where: SessionWhereUniqueInput
  }

  /**
   * Session updateMany
   */
  export type SessionUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Sessions.
     */
    data: XOR<SessionUpdateManyMutationInput, SessionUncheckedUpdateManyInput>
    /**
     * Filter which Sessions to update
     */
    where?: SessionWhereInput
    /**
     * Limit how many Sessions to update.
     */
    limit?: number
  }

  /**
   * Session updateManyAndReturn
   */
  export type SessionUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Session
     */
    select?: SessionSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Session
     */
    omit?: SessionOmit<ExtArgs> | null
    /**
     * The data used to update Sessions.
     */
    data: XOR<SessionUpdateManyMutationInput, SessionUncheckedUpdateManyInput>
    /**
     * Filter which Sessions to update
     */
    where?: SessionWhereInput
    /**
     * Limit how many Sessions to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SessionIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * Session upsert
   */
  export type SessionUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Session
     */
    select?: SessionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Session
     */
    omit?: SessionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SessionInclude<ExtArgs> | null
    /**
     * The filter to search for the Session to update in case it exists.
     */
    where: SessionWhereUniqueInput
    /**
     * In case the Session found by the `where` argument doesn't exist, create a new Session with this data.
     */
    create: XOR<SessionCreateInput, SessionUncheckedCreateInput>
    /**
     * In case the Session was found with the provided `where` argument, update it with this data.
     */
    update: XOR<SessionUpdateInput, SessionUncheckedUpdateInput>
  }

  /**
   * Session delete
   */
  export type SessionDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Session
     */
    select?: SessionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Session
     */
    omit?: SessionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SessionInclude<ExtArgs> | null
    /**
     * Filter which Session to delete.
     */
    where: SessionWhereUniqueInput
  }

  /**
   * Session deleteMany
   */
  export type SessionDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Sessions to delete
     */
    where?: SessionWhereInput
    /**
     * Limit how many Sessions to delete.
     */
    limit?: number
  }

  /**
   * Session without action
   */
  export type SessionDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Session
     */
    select?: SessionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Session
     */
    omit?: SessionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SessionInclude<ExtArgs> | null
  }


  /**
   * Model Account
   */

  export type AggregateAccount = {
    _count: AccountCountAggregateOutputType | null
    _min: AccountMinAggregateOutputType | null
    _max: AccountMaxAggregateOutputType | null
  }

  export type AccountMinAggregateOutputType = {
    id: string | null
    accountId: string | null
    providerId: string | null
    userId: string | null
    accessToken: string | null
    refreshToken: string | null
    idToken: string | null
    accessTokenExpiresAt: Date | null
    refreshTokenExpiresAt: Date | null
    scope: string | null
    password: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type AccountMaxAggregateOutputType = {
    id: string | null
    accountId: string | null
    providerId: string | null
    userId: string | null
    accessToken: string | null
    refreshToken: string | null
    idToken: string | null
    accessTokenExpiresAt: Date | null
    refreshTokenExpiresAt: Date | null
    scope: string | null
    password: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type AccountCountAggregateOutputType = {
    id: number
    accountId: number
    providerId: number
    userId: number
    accessToken: number
    refreshToken: number
    idToken: number
    accessTokenExpiresAt: number
    refreshTokenExpiresAt: number
    scope: number
    password: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type AccountMinAggregateInputType = {
    id?: true
    accountId?: true
    providerId?: true
    userId?: true
    accessToken?: true
    refreshToken?: true
    idToken?: true
    accessTokenExpiresAt?: true
    refreshTokenExpiresAt?: true
    scope?: true
    password?: true
    createdAt?: true
    updatedAt?: true
  }

  export type AccountMaxAggregateInputType = {
    id?: true
    accountId?: true
    providerId?: true
    userId?: true
    accessToken?: true
    refreshToken?: true
    idToken?: true
    accessTokenExpiresAt?: true
    refreshTokenExpiresAt?: true
    scope?: true
    password?: true
    createdAt?: true
    updatedAt?: true
  }

  export type AccountCountAggregateInputType = {
    id?: true
    accountId?: true
    providerId?: true
    userId?: true
    accessToken?: true
    refreshToken?: true
    idToken?: true
    accessTokenExpiresAt?: true
    refreshTokenExpiresAt?: true
    scope?: true
    password?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type AccountAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Account to aggregate.
     */
    where?: AccountWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Accounts to fetch.
     */
    orderBy?: AccountOrderByWithRelationInput | AccountOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: AccountWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Accounts from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Accounts.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Accounts
    **/
    _count?: true | AccountCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: AccountMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: AccountMaxAggregateInputType
  }

  export type GetAccountAggregateType<T extends AccountAggregateArgs> = {
        [P in keyof T & keyof AggregateAccount]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateAccount[P]>
      : GetScalarType<T[P], AggregateAccount[P]>
  }




  export type AccountGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: AccountWhereInput
    orderBy?: AccountOrderByWithAggregationInput | AccountOrderByWithAggregationInput[]
    by: AccountScalarFieldEnum[] | AccountScalarFieldEnum
    having?: AccountScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: AccountCountAggregateInputType | true
    _min?: AccountMinAggregateInputType
    _max?: AccountMaxAggregateInputType
  }

  export type AccountGroupByOutputType = {
    id: string
    accountId: string
    providerId: string
    userId: string
    accessToken: string | null
    refreshToken: string | null
    idToken: string | null
    accessTokenExpiresAt: Date | null
    refreshTokenExpiresAt: Date | null
    scope: string | null
    password: string | null
    createdAt: Date
    updatedAt: Date
    _count: AccountCountAggregateOutputType | null
    _min: AccountMinAggregateOutputType | null
    _max: AccountMaxAggregateOutputType | null
  }

  type GetAccountGroupByPayload<T extends AccountGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<AccountGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof AccountGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], AccountGroupByOutputType[P]>
            : GetScalarType<T[P], AccountGroupByOutputType[P]>
        }
      >
    >


  export type AccountSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    accountId?: boolean
    providerId?: boolean
    userId?: boolean
    accessToken?: boolean
    refreshToken?: boolean
    idToken?: boolean
    accessTokenExpiresAt?: boolean
    refreshTokenExpiresAt?: boolean
    scope?: boolean
    password?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["account"]>

  export type AccountSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    accountId?: boolean
    providerId?: boolean
    userId?: boolean
    accessToken?: boolean
    refreshToken?: boolean
    idToken?: boolean
    accessTokenExpiresAt?: boolean
    refreshTokenExpiresAt?: boolean
    scope?: boolean
    password?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["account"]>

  export type AccountSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    accountId?: boolean
    providerId?: boolean
    userId?: boolean
    accessToken?: boolean
    refreshToken?: boolean
    idToken?: boolean
    accessTokenExpiresAt?: boolean
    refreshTokenExpiresAt?: boolean
    scope?: boolean
    password?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["account"]>

  export type AccountSelectScalar = {
    id?: boolean
    accountId?: boolean
    providerId?: boolean
    userId?: boolean
    accessToken?: boolean
    refreshToken?: boolean
    idToken?: boolean
    accessTokenExpiresAt?: boolean
    refreshTokenExpiresAt?: boolean
    scope?: boolean
    password?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type AccountOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "accountId" | "providerId" | "userId" | "accessToken" | "refreshToken" | "idToken" | "accessTokenExpiresAt" | "refreshTokenExpiresAt" | "scope" | "password" | "createdAt" | "updatedAt", ExtArgs["result"]["account"]>
  export type AccountInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }
  export type AccountIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }
  export type AccountIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }

  export type $AccountPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Account"
    objects: {
      user: Prisma.$UserPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      accountId: string
      providerId: string
      userId: string
      accessToken: string | null
      refreshToken: string | null
      idToken: string | null
      accessTokenExpiresAt: Date | null
      refreshTokenExpiresAt: Date | null
      scope: string | null
      password: string | null
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["account"]>
    composites: {}
  }

  type AccountGetPayload<S extends boolean | null | undefined | AccountDefaultArgs> = $Result.GetResult<Prisma.$AccountPayload, S>

  type AccountCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<AccountFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: AccountCountAggregateInputType | true
    }

  export interface AccountDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Account'], meta: { name: 'Account' } }
    /**
     * Find zero or one Account that matches the filter.
     * @param {AccountFindUniqueArgs} args - Arguments to find a Account
     * @example
     * // Get one Account
     * const account = await prisma.account.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends AccountFindUniqueArgs>(args: SelectSubset<T, AccountFindUniqueArgs<ExtArgs>>): Prisma__AccountClient<$Result.GetResult<Prisma.$AccountPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Account that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {AccountFindUniqueOrThrowArgs} args - Arguments to find a Account
     * @example
     * // Get one Account
     * const account = await prisma.account.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends AccountFindUniqueOrThrowArgs>(args: SelectSubset<T, AccountFindUniqueOrThrowArgs<ExtArgs>>): Prisma__AccountClient<$Result.GetResult<Prisma.$AccountPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Account that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AccountFindFirstArgs} args - Arguments to find a Account
     * @example
     * // Get one Account
     * const account = await prisma.account.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends AccountFindFirstArgs>(args?: SelectSubset<T, AccountFindFirstArgs<ExtArgs>>): Prisma__AccountClient<$Result.GetResult<Prisma.$AccountPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Account that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AccountFindFirstOrThrowArgs} args - Arguments to find a Account
     * @example
     * // Get one Account
     * const account = await prisma.account.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends AccountFindFirstOrThrowArgs>(args?: SelectSubset<T, AccountFindFirstOrThrowArgs<ExtArgs>>): Prisma__AccountClient<$Result.GetResult<Prisma.$AccountPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Accounts that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AccountFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Accounts
     * const accounts = await prisma.account.findMany()
     * 
     * // Get first 10 Accounts
     * const accounts = await prisma.account.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const accountWithIdOnly = await prisma.account.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends AccountFindManyArgs>(args?: SelectSubset<T, AccountFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$AccountPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Account.
     * @param {AccountCreateArgs} args - Arguments to create a Account.
     * @example
     * // Create one Account
     * const Account = await prisma.account.create({
     *   data: {
     *     // ... data to create a Account
     *   }
     * })
     * 
     */
    create<T extends AccountCreateArgs>(args: SelectSubset<T, AccountCreateArgs<ExtArgs>>): Prisma__AccountClient<$Result.GetResult<Prisma.$AccountPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Accounts.
     * @param {AccountCreateManyArgs} args - Arguments to create many Accounts.
     * @example
     * // Create many Accounts
     * const account = await prisma.account.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends AccountCreateManyArgs>(args?: SelectSubset<T, AccountCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Accounts and returns the data saved in the database.
     * @param {AccountCreateManyAndReturnArgs} args - Arguments to create many Accounts.
     * @example
     * // Create many Accounts
     * const account = await prisma.account.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Accounts and only return the `id`
     * const accountWithIdOnly = await prisma.account.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends AccountCreateManyAndReturnArgs>(args?: SelectSubset<T, AccountCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$AccountPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Account.
     * @param {AccountDeleteArgs} args - Arguments to delete one Account.
     * @example
     * // Delete one Account
     * const Account = await prisma.account.delete({
     *   where: {
     *     // ... filter to delete one Account
     *   }
     * })
     * 
     */
    delete<T extends AccountDeleteArgs>(args: SelectSubset<T, AccountDeleteArgs<ExtArgs>>): Prisma__AccountClient<$Result.GetResult<Prisma.$AccountPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Account.
     * @param {AccountUpdateArgs} args - Arguments to update one Account.
     * @example
     * // Update one Account
     * const account = await prisma.account.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends AccountUpdateArgs>(args: SelectSubset<T, AccountUpdateArgs<ExtArgs>>): Prisma__AccountClient<$Result.GetResult<Prisma.$AccountPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Accounts.
     * @param {AccountDeleteManyArgs} args - Arguments to filter Accounts to delete.
     * @example
     * // Delete a few Accounts
     * const { count } = await prisma.account.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends AccountDeleteManyArgs>(args?: SelectSubset<T, AccountDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Accounts.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AccountUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Accounts
     * const account = await prisma.account.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends AccountUpdateManyArgs>(args: SelectSubset<T, AccountUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Accounts and returns the data updated in the database.
     * @param {AccountUpdateManyAndReturnArgs} args - Arguments to update many Accounts.
     * @example
     * // Update many Accounts
     * const account = await prisma.account.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Accounts and only return the `id`
     * const accountWithIdOnly = await prisma.account.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends AccountUpdateManyAndReturnArgs>(args: SelectSubset<T, AccountUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$AccountPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Account.
     * @param {AccountUpsertArgs} args - Arguments to update or create a Account.
     * @example
     * // Update or create a Account
     * const account = await prisma.account.upsert({
     *   create: {
     *     // ... data to create a Account
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Account we want to update
     *   }
     * })
     */
    upsert<T extends AccountUpsertArgs>(args: SelectSubset<T, AccountUpsertArgs<ExtArgs>>): Prisma__AccountClient<$Result.GetResult<Prisma.$AccountPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Accounts.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AccountCountArgs} args - Arguments to filter Accounts to count.
     * @example
     * // Count the number of Accounts
     * const count = await prisma.account.count({
     *   where: {
     *     // ... the filter for the Accounts we want to count
     *   }
     * })
    **/
    count<T extends AccountCountArgs>(
      args?: Subset<T, AccountCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], AccountCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Account.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AccountAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends AccountAggregateArgs>(args: Subset<T, AccountAggregateArgs>): Prisma.PrismaPromise<GetAccountAggregateType<T>>

    /**
     * Group by Account.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AccountGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends AccountGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: AccountGroupByArgs['orderBy'] }
        : { orderBy?: AccountGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, AccountGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetAccountGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Account model
   */
  readonly fields: AccountFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Account.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__AccountClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    user<T extends UserDefaultArgs<ExtArgs> = {}>(args?: Subset<T, UserDefaultArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Account model
   */
  interface AccountFieldRefs {
    readonly id: FieldRef<"Account", 'String'>
    readonly accountId: FieldRef<"Account", 'String'>
    readonly providerId: FieldRef<"Account", 'String'>
    readonly userId: FieldRef<"Account", 'String'>
    readonly accessToken: FieldRef<"Account", 'String'>
    readonly refreshToken: FieldRef<"Account", 'String'>
    readonly idToken: FieldRef<"Account", 'String'>
    readonly accessTokenExpiresAt: FieldRef<"Account", 'DateTime'>
    readonly refreshTokenExpiresAt: FieldRef<"Account", 'DateTime'>
    readonly scope: FieldRef<"Account", 'String'>
    readonly password: FieldRef<"Account", 'String'>
    readonly createdAt: FieldRef<"Account", 'DateTime'>
    readonly updatedAt: FieldRef<"Account", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * Account findUnique
   */
  export type AccountFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Account
     */
    select?: AccountSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Account
     */
    omit?: AccountOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AccountInclude<ExtArgs> | null
    /**
     * Filter, which Account to fetch.
     */
    where: AccountWhereUniqueInput
  }

  /**
   * Account findUniqueOrThrow
   */
  export type AccountFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Account
     */
    select?: AccountSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Account
     */
    omit?: AccountOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AccountInclude<ExtArgs> | null
    /**
     * Filter, which Account to fetch.
     */
    where: AccountWhereUniqueInput
  }

  /**
   * Account findFirst
   */
  export type AccountFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Account
     */
    select?: AccountSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Account
     */
    omit?: AccountOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AccountInclude<ExtArgs> | null
    /**
     * Filter, which Account to fetch.
     */
    where?: AccountWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Accounts to fetch.
     */
    orderBy?: AccountOrderByWithRelationInput | AccountOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Accounts.
     */
    cursor?: AccountWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Accounts from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Accounts.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Accounts.
     */
    distinct?: AccountScalarFieldEnum | AccountScalarFieldEnum[]
  }

  /**
   * Account findFirstOrThrow
   */
  export type AccountFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Account
     */
    select?: AccountSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Account
     */
    omit?: AccountOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AccountInclude<ExtArgs> | null
    /**
     * Filter, which Account to fetch.
     */
    where?: AccountWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Accounts to fetch.
     */
    orderBy?: AccountOrderByWithRelationInput | AccountOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Accounts.
     */
    cursor?: AccountWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Accounts from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Accounts.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Accounts.
     */
    distinct?: AccountScalarFieldEnum | AccountScalarFieldEnum[]
  }

  /**
   * Account findMany
   */
  export type AccountFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Account
     */
    select?: AccountSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Account
     */
    omit?: AccountOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AccountInclude<ExtArgs> | null
    /**
     * Filter, which Accounts to fetch.
     */
    where?: AccountWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Accounts to fetch.
     */
    orderBy?: AccountOrderByWithRelationInput | AccountOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Accounts.
     */
    cursor?: AccountWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Accounts from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Accounts.
     */
    skip?: number
    distinct?: AccountScalarFieldEnum | AccountScalarFieldEnum[]
  }

  /**
   * Account create
   */
  export type AccountCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Account
     */
    select?: AccountSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Account
     */
    omit?: AccountOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AccountInclude<ExtArgs> | null
    /**
     * The data needed to create a Account.
     */
    data: XOR<AccountCreateInput, AccountUncheckedCreateInput>
  }

  /**
   * Account createMany
   */
  export type AccountCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Accounts.
     */
    data: AccountCreateManyInput | AccountCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Account createManyAndReturn
   */
  export type AccountCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Account
     */
    select?: AccountSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Account
     */
    omit?: AccountOmit<ExtArgs> | null
    /**
     * The data used to create many Accounts.
     */
    data: AccountCreateManyInput | AccountCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AccountIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * Account update
   */
  export type AccountUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Account
     */
    select?: AccountSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Account
     */
    omit?: AccountOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AccountInclude<ExtArgs> | null
    /**
     * The data needed to update a Account.
     */
    data: XOR<AccountUpdateInput, AccountUncheckedUpdateInput>
    /**
     * Choose, which Account to update.
     */
    where: AccountWhereUniqueInput
  }

  /**
   * Account updateMany
   */
  export type AccountUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Accounts.
     */
    data: XOR<AccountUpdateManyMutationInput, AccountUncheckedUpdateManyInput>
    /**
     * Filter which Accounts to update
     */
    where?: AccountWhereInput
    /**
     * Limit how many Accounts to update.
     */
    limit?: number
  }

  /**
   * Account updateManyAndReturn
   */
  export type AccountUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Account
     */
    select?: AccountSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Account
     */
    omit?: AccountOmit<ExtArgs> | null
    /**
     * The data used to update Accounts.
     */
    data: XOR<AccountUpdateManyMutationInput, AccountUncheckedUpdateManyInput>
    /**
     * Filter which Accounts to update
     */
    where?: AccountWhereInput
    /**
     * Limit how many Accounts to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AccountIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * Account upsert
   */
  export type AccountUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Account
     */
    select?: AccountSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Account
     */
    omit?: AccountOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AccountInclude<ExtArgs> | null
    /**
     * The filter to search for the Account to update in case it exists.
     */
    where: AccountWhereUniqueInput
    /**
     * In case the Account found by the `where` argument doesn't exist, create a new Account with this data.
     */
    create: XOR<AccountCreateInput, AccountUncheckedCreateInput>
    /**
     * In case the Account was found with the provided `where` argument, update it with this data.
     */
    update: XOR<AccountUpdateInput, AccountUncheckedUpdateInput>
  }

  /**
   * Account delete
   */
  export type AccountDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Account
     */
    select?: AccountSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Account
     */
    omit?: AccountOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AccountInclude<ExtArgs> | null
    /**
     * Filter which Account to delete.
     */
    where: AccountWhereUniqueInput
  }

  /**
   * Account deleteMany
   */
  export type AccountDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Accounts to delete
     */
    where?: AccountWhereInput
    /**
     * Limit how many Accounts to delete.
     */
    limit?: number
  }

  /**
   * Account without action
   */
  export type AccountDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Account
     */
    select?: AccountSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Account
     */
    omit?: AccountOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AccountInclude<ExtArgs> | null
  }


  /**
   * Model Verification
   */

  export type AggregateVerification = {
    _count: VerificationCountAggregateOutputType | null
    _min: VerificationMinAggregateOutputType | null
    _max: VerificationMaxAggregateOutputType | null
  }

  export type VerificationMinAggregateOutputType = {
    id: string | null
    identifier: string | null
    value: string | null
    expiresAt: Date | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type VerificationMaxAggregateOutputType = {
    id: string | null
    identifier: string | null
    value: string | null
    expiresAt: Date | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type VerificationCountAggregateOutputType = {
    id: number
    identifier: number
    value: number
    expiresAt: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type VerificationMinAggregateInputType = {
    id?: true
    identifier?: true
    value?: true
    expiresAt?: true
    createdAt?: true
    updatedAt?: true
  }

  export type VerificationMaxAggregateInputType = {
    id?: true
    identifier?: true
    value?: true
    expiresAt?: true
    createdAt?: true
    updatedAt?: true
  }

  export type VerificationCountAggregateInputType = {
    id?: true
    identifier?: true
    value?: true
    expiresAt?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type VerificationAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Verification to aggregate.
     */
    where?: VerificationWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Verifications to fetch.
     */
    orderBy?: VerificationOrderByWithRelationInput | VerificationOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: VerificationWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Verifications from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Verifications.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Verifications
    **/
    _count?: true | VerificationCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: VerificationMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: VerificationMaxAggregateInputType
  }

  export type GetVerificationAggregateType<T extends VerificationAggregateArgs> = {
        [P in keyof T & keyof AggregateVerification]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateVerification[P]>
      : GetScalarType<T[P], AggregateVerification[P]>
  }




  export type VerificationGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: VerificationWhereInput
    orderBy?: VerificationOrderByWithAggregationInput | VerificationOrderByWithAggregationInput[]
    by: VerificationScalarFieldEnum[] | VerificationScalarFieldEnum
    having?: VerificationScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: VerificationCountAggregateInputType | true
    _min?: VerificationMinAggregateInputType
    _max?: VerificationMaxAggregateInputType
  }

  export type VerificationGroupByOutputType = {
    id: string
    identifier: string
    value: string
    expiresAt: Date
    createdAt: Date
    updatedAt: Date
    _count: VerificationCountAggregateOutputType | null
    _min: VerificationMinAggregateOutputType | null
    _max: VerificationMaxAggregateOutputType | null
  }

  type GetVerificationGroupByPayload<T extends VerificationGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<VerificationGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof VerificationGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], VerificationGroupByOutputType[P]>
            : GetScalarType<T[P], VerificationGroupByOutputType[P]>
        }
      >
    >


  export type VerificationSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    identifier?: boolean
    value?: boolean
    expiresAt?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["verification"]>

  export type VerificationSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    identifier?: boolean
    value?: boolean
    expiresAt?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["verification"]>

  export type VerificationSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    identifier?: boolean
    value?: boolean
    expiresAt?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["verification"]>

  export type VerificationSelectScalar = {
    id?: boolean
    identifier?: boolean
    value?: boolean
    expiresAt?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type VerificationOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "identifier" | "value" | "expiresAt" | "createdAt" | "updatedAt", ExtArgs["result"]["verification"]>

  export type $VerificationPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Verification"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: string
      identifier: string
      value: string
      expiresAt: Date
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["verification"]>
    composites: {}
  }

  type VerificationGetPayload<S extends boolean | null | undefined | VerificationDefaultArgs> = $Result.GetResult<Prisma.$VerificationPayload, S>

  type VerificationCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<VerificationFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: VerificationCountAggregateInputType | true
    }

  export interface VerificationDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Verification'], meta: { name: 'Verification' } }
    /**
     * Find zero or one Verification that matches the filter.
     * @param {VerificationFindUniqueArgs} args - Arguments to find a Verification
     * @example
     * // Get one Verification
     * const verification = await prisma.verification.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends VerificationFindUniqueArgs>(args: SelectSubset<T, VerificationFindUniqueArgs<ExtArgs>>): Prisma__VerificationClient<$Result.GetResult<Prisma.$VerificationPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Verification that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {VerificationFindUniqueOrThrowArgs} args - Arguments to find a Verification
     * @example
     * // Get one Verification
     * const verification = await prisma.verification.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends VerificationFindUniqueOrThrowArgs>(args: SelectSubset<T, VerificationFindUniqueOrThrowArgs<ExtArgs>>): Prisma__VerificationClient<$Result.GetResult<Prisma.$VerificationPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Verification that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {VerificationFindFirstArgs} args - Arguments to find a Verification
     * @example
     * // Get one Verification
     * const verification = await prisma.verification.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends VerificationFindFirstArgs>(args?: SelectSubset<T, VerificationFindFirstArgs<ExtArgs>>): Prisma__VerificationClient<$Result.GetResult<Prisma.$VerificationPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Verification that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {VerificationFindFirstOrThrowArgs} args - Arguments to find a Verification
     * @example
     * // Get one Verification
     * const verification = await prisma.verification.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends VerificationFindFirstOrThrowArgs>(args?: SelectSubset<T, VerificationFindFirstOrThrowArgs<ExtArgs>>): Prisma__VerificationClient<$Result.GetResult<Prisma.$VerificationPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Verifications that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {VerificationFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Verifications
     * const verifications = await prisma.verification.findMany()
     * 
     * // Get first 10 Verifications
     * const verifications = await prisma.verification.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const verificationWithIdOnly = await prisma.verification.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends VerificationFindManyArgs>(args?: SelectSubset<T, VerificationFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$VerificationPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Verification.
     * @param {VerificationCreateArgs} args - Arguments to create a Verification.
     * @example
     * // Create one Verification
     * const Verification = await prisma.verification.create({
     *   data: {
     *     // ... data to create a Verification
     *   }
     * })
     * 
     */
    create<T extends VerificationCreateArgs>(args: SelectSubset<T, VerificationCreateArgs<ExtArgs>>): Prisma__VerificationClient<$Result.GetResult<Prisma.$VerificationPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Verifications.
     * @param {VerificationCreateManyArgs} args - Arguments to create many Verifications.
     * @example
     * // Create many Verifications
     * const verification = await prisma.verification.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends VerificationCreateManyArgs>(args?: SelectSubset<T, VerificationCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Verifications and returns the data saved in the database.
     * @param {VerificationCreateManyAndReturnArgs} args - Arguments to create many Verifications.
     * @example
     * // Create many Verifications
     * const verification = await prisma.verification.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Verifications and only return the `id`
     * const verificationWithIdOnly = await prisma.verification.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends VerificationCreateManyAndReturnArgs>(args?: SelectSubset<T, VerificationCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$VerificationPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Verification.
     * @param {VerificationDeleteArgs} args - Arguments to delete one Verification.
     * @example
     * // Delete one Verification
     * const Verification = await prisma.verification.delete({
     *   where: {
     *     // ... filter to delete one Verification
     *   }
     * })
     * 
     */
    delete<T extends VerificationDeleteArgs>(args: SelectSubset<T, VerificationDeleteArgs<ExtArgs>>): Prisma__VerificationClient<$Result.GetResult<Prisma.$VerificationPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Verification.
     * @param {VerificationUpdateArgs} args - Arguments to update one Verification.
     * @example
     * // Update one Verification
     * const verification = await prisma.verification.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends VerificationUpdateArgs>(args: SelectSubset<T, VerificationUpdateArgs<ExtArgs>>): Prisma__VerificationClient<$Result.GetResult<Prisma.$VerificationPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Verifications.
     * @param {VerificationDeleteManyArgs} args - Arguments to filter Verifications to delete.
     * @example
     * // Delete a few Verifications
     * const { count } = await prisma.verification.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends VerificationDeleteManyArgs>(args?: SelectSubset<T, VerificationDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Verifications.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {VerificationUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Verifications
     * const verification = await prisma.verification.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends VerificationUpdateManyArgs>(args: SelectSubset<T, VerificationUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Verifications and returns the data updated in the database.
     * @param {VerificationUpdateManyAndReturnArgs} args - Arguments to update many Verifications.
     * @example
     * // Update many Verifications
     * const verification = await prisma.verification.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Verifications and only return the `id`
     * const verificationWithIdOnly = await prisma.verification.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends VerificationUpdateManyAndReturnArgs>(args: SelectSubset<T, VerificationUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$VerificationPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Verification.
     * @param {VerificationUpsertArgs} args - Arguments to update or create a Verification.
     * @example
     * // Update or create a Verification
     * const verification = await prisma.verification.upsert({
     *   create: {
     *     // ... data to create a Verification
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Verification we want to update
     *   }
     * })
     */
    upsert<T extends VerificationUpsertArgs>(args: SelectSubset<T, VerificationUpsertArgs<ExtArgs>>): Prisma__VerificationClient<$Result.GetResult<Prisma.$VerificationPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Verifications.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {VerificationCountArgs} args - Arguments to filter Verifications to count.
     * @example
     * // Count the number of Verifications
     * const count = await prisma.verification.count({
     *   where: {
     *     // ... the filter for the Verifications we want to count
     *   }
     * })
    **/
    count<T extends VerificationCountArgs>(
      args?: Subset<T, VerificationCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], VerificationCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Verification.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {VerificationAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends VerificationAggregateArgs>(args: Subset<T, VerificationAggregateArgs>): Prisma.PrismaPromise<GetVerificationAggregateType<T>>

    /**
     * Group by Verification.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {VerificationGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends VerificationGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: VerificationGroupByArgs['orderBy'] }
        : { orderBy?: VerificationGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, VerificationGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetVerificationGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Verification model
   */
  readonly fields: VerificationFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Verification.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__VerificationClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Verification model
   */
  interface VerificationFieldRefs {
    readonly id: FieldRef<"Verification", 'String'>
    readonly identifier: FieldRef<"Verification", 'String'>
    readonly value: FieldRef<"Verification", 'String'>
    readonly expiresAt: FieldRef<"Verification", 'DateTime'>
    readonly createdAt: FieldRef<"Verification", 'DateTime'>
    readonly updatedAt: FieldRef<"Verification", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * Verification findUnique
   */
  export type VerificationFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Verification
     */
    select?: VerificationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Verification
     */
    omit?: VerificationOmit<ExtArgs> | null
    /**
     * Filter, which Verification to fetch.
     */
    where: VerificationWhereUniqueInput
  }

  /**
   * Verification findUniqueOrThrow
   */
  export type VerificationFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Verification
     */
    select?: VerificationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Verification
     */
    omit?: VerificationOmit<ExtArgs> | null
    /**
     * Filter, which Verification to fetch.
     */
    where: VerificationWhereUniqueInput
  }

  /**
   * Verification findFirst
   */
  export type VerificationFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Verification
     */
    select?: VerificationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Verification
     */
    omit?: VerificationOmit<ExtArgs> | null
    /**
     * Filter, which Verification to fetch.
     */
    where?: VerificationWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Verifications to fetch.
     */
    orderBy?: VerificationOrderByWithRelationInput | VerificationOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Verifications.
     */
    cursor?: VerificationWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Verifications from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Verifications.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Verifications.
     */
    distinct?: VerificationScalarFieldEnum | VerificationScalarFieldEnum[]
  }

  /**
   * Verification findFirstOrThrow
   */
  export type VerificationFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Verification
     */
    select?: VerificationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Verification
     */
    omit?: VerificationOmit<ExtArgs> | null
    /**
     * Filter, which Verification to fetch.
     */
    where?: VerificationWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Verifications to fetch.
     */
    orderBy?: VerificationOrderByWithRelationInput | VerificationOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Verifications.
     */
    cursor?: VerificationWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Verifications from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Verifications.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Verifications.
     */
    distinct?: VerificationScalarFieldEnum | VerificationScalarFieldEnum[]
  }

  /**
   * Verification findMany
   */
  export type VerificationFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Verification
     */
    select?: VerificationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Verification
     */
    omit?: VerificationOmit<ExtArgs> | null
    /**
     * Filter, which Verifications to fetch.
     */
    where?: VerificationWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Verifications to fetch.
     */
    orderBy?: VerificationOrderByWithRelationInput | VerificationOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Verifications.
     */
    cursor?: VerificationWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Verifications from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Verifications.
     */
    skip?: number
    distinct?: VerificationScalarFieldEnum | VerificationScalarFieldEnum[]
  }

  /**
   * Verification create
   */
  export type VerificationCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Verification
     */
    select?: VerificationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Verification
     */
    omit?: VerificationOmit<ExtArgs> | null
    /**
     * The data needed to create a Verification.
     */
    data: XOR<VerificationCreateInput, VerificationUncheckedCreateInput>
  }

  /**
   * Verification createMany
   */
  export type VerificationCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Verifications.
     */
    data: VerificationCreateManyInput | VerificationCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Verification createManyAndReturn
   */
  export type VerificationCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Verification
     */
    select?: VerificationSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Verification
     */
    omit?: VerificationOmit<ExtArgs> | null
    /**
     * The data used to create many Verifications.
     */
    data: VerificationCreateManyInput | VerificationCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Verification update
   */
  export type VerificationUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Verification
     */
    select?: VerificationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Verification
     */
    omit?: VerificationOmit<ExtArgs> | null
    /**
     * The data needed to update a Verification.
     */
    data: XOR<VerificationUpdateInput, VerificationUncheckedUpdateInput>
    /**
     * Choose, which Verification to update.
     */
    where: VerificationWhereUniqueInput
  }

  /**
   * Verification updateMany
   */
  export type VerificationUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Verifications.
     */
    data: XOR<VerificationUpdateManyMutationInput, VerificationUncheckedUpdateManyInput>
    /**
     * Filter which Verifications to update
     */
    where?: VerificationWhereInput
    /**
     * Limit how many Verifications to update.
     */
    limit?: number
  }

  /**
   * Verification updateManyAndReturn
   */
  export type VerificationUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Verification
     */
    select?: VerificationSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Verification
     */
    omit?: VerificationOmit<ExtArgs> | null
    /**
     * The data used to update Verifications.
     */
    data: XOR<VerificationUpdateManyMutationInput, VerificationUncheckedUpdateManyInput>
    /**
     * Filter which Verifications to update
     */
    where?: VerificationWhereInput
    /**
     * Limit how many Verifications to update.
     */
    limit?: number
  }

  /**
   * Verification upsert
   */
  export type VerificationUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Verification
     */
    select?: VerificationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Verification
     */
    omit?: VerificationOmit<ExtArgs> | null
    /**
     * The filter to search for the Verification to update in case it exists.
     */
    where: VerificationWhereUniqueInput
    /**
     * In case the Verification found by the `where` argument doesn't exist, create a new Verification with this data.
     */
    create: XOR<VerificationCreateInput, VerificationUncheckedCreateInput>
    /**
     * In case the Verification was found with the provided `where` argument, update it with this data.
     */
    update: XOR<VerificationUpdateInput, VerificationUncheckedUpdateInput>
  }

  /**
   * Verification delete
   */
  export type VerificationDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Verification
     */
    select?: VerificationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Verification
     */
    omit?: VerificationOmit<ExtArgs> | null
    /**
     * Filter which Verification to delete.
     */
    where: VerificationWhereUniqueInput
  }

  /**
   * Verification deleteMany
   */
  export type VerificationDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Verifications to delete
     */
    where?: VerificationWhereInput
    /**
     * Limit how many Verifications to delete.
     */
    limit?: number
  }

  /**
   * Verification without action
   */
  export type VerificationDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Verification
     */
    select?: VerificationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Verification
     */
    omit?: VerificationOmit<ExtArgs> | null
  }


  /**
   * Enums
   */

  export const TransactionIsolationLevel: {
    ReadUncommitted: 'ReadUncommitted',
    ReadCommitted: 'ReadCommitted',
    RepeatableRead: 'RepeatableRead',
    Serializable: 'Serializable'
  };

  export type TransactionIsolationLevel = (typeof TransactionIsolationLevel)[keyof typeof TransactionIsolationLevel]


  export const DepartmentScalarFieldEnum: {
    id: 'id',
    name: 'name',
    isActive: 'isActive',
    createdAt: 'createdAt'
  };

  export type DepartmentScalarFieldEnum = (typeof DepartmentScalarFieldEnum)[keyof typeof DepartmentScalarFieldEnum]


  export const CustomerScalarFieldEnum: {
    id: 'id',
    name: 'name',
    isCashCustomer: 'isCashCustomer',
    createdAt: 'createdAt'
  };

  export type CustomerScalarFieldEnum = (typeof CustomerScalarFieldEnum)[keyof typeof CustomerScalarFieldEnum]


  export const OrderScalarFieldEnum: {
    id: 'id',
    number: 'number',
    customerId: 'customerId',
    channel: 'channel',
    priority: 'priority',
    mode: 'mode',
    createdById: 'createdById',
    createdAt: 'createdAt'
  };

  export type OrderScalarFieldEnum = (typeof OrderScalarFieldEnum)[keyof typeof OrderScalarFieldEnum]


  export const WorkItemScalarFieldEnum: {
    id: 'id',
    orderId: 'orderId',
    productTypeId: 'productTypeId',
    departmentId: 'departmentId',
    state: 'state',
    requiresDesign: 'requiresDesign',
    requiresReview: 'requiresReview',
    assigneeId: 'assigneeId',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type WorkItemScalarFieldEnum = (typeof WorkItemScalarFieldEnum)[keyof typeof WorkItemScalarFieldEnum]


  export const WorkItemTransitionScalarFieldEnum: {
    id: 'id',
    workItemId: 'workItemId',
    from: 'from',
    to: 'to',
    actorId: 'actorId',
    at: 'at',
    reason: 'reason',
    rejectionCategory: 'rejectionCategory',
    meta: 'meta'
  };

  export type WorkItemTransitionScalarFieldEnum = (typeof WorkItemTransitionScalarFieldEnum)[keyof typeof WorkItemTransitionScalarFieldEnum]


  export const PhaseTimingScalarFieldEnum: {
    id: 'id',
    workItemId: 'workItemId',
    phase: 'phase',
    userId: 'userId',
    kind: 'kind',
    startedAt: 'startedAt',
    endedAt: 'endedAt'
  };

  export type PhaseTimingScalarFieldEnum = (typeof PhaseTimingScalarFieldEnum)[keyof typeof PhaseTimingScalarFieldEnum]


  export const NotificationEventScalarFieldEnum: {
    id: 'id',
    type: 'type',
    entityType: 'entityType',
    entityId: 'entityId',
    recipientUserIds: 'recipientUserIds',
    recipientRoles: 'recipientRoles',
    recipientDepartmentIds: 'recipientDepartmentIds',
    payload: 'payload',
    createdAt: 'createdAt',
    deliveredAt: 'deliveredAt',
    deliveryStatus: 'deliveryStatus'
  };

  export type NotificationEventScalarFieldEnum = (typeof NotificationEventScalarFieldEnum)[keyof typeof NotificationEventScalarFieldEnum]


  export const UserScalarFieldEnum: {
    id: 'id',
    name: 'name',
    email: 'email',
    emailVerified: 'emailVerified',
    image: 'image',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type UserScalarFieldEnum = (typeof UserScalarFieldEnum)[keyof typeof UserScalarFieldEnum]


  export const SessionScalarFieldEnum: {
    id: 'id',
    expiresAt: 'expiresAt',
    token: 'token',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    ipAddress: 'ipAddress',
    userAgent: 'userAgent',
    userId: 'userId'
  };

  export type SessionScalarFieldEnum = (typeof SessionScalarFieldEnum)[keyof typeof SessionScalarFieldEnum]


  export const AccountScalarFieldEnum: {
    id: 'id',
    accountId: 'accountId',
    providerId: 'providerId',
    userId: 'userId',
    accessToken: 'accessToken',
    refreshToken: 'refreshToken',
    idToken: 'idToken',
    accessTokenExpiresAt: 'accessTokenExpiresAt',
    refreshTokenExpiresAt: 'refreshTokenExpiresAt',
    scope: 'scope',
    password: 'password',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type AccountScalarFieldEnum = (typeof AccountScalarFieldEnum)[keyof typeof AccountScalarFieldEnum]


  export const VerificationScalarFieldEnum: {
    id: 'id',
    identifier: 'identifier',
    value: 'value',
    expiresAt: 'expiresAt',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type VerificationScalarFieldEnum = (typeof VerificationScalarFieldEnum)[keyof typeof VerificationScalarFieldEnum]


  export const SortOrder: {
    asc: 'asc',
    desc: 'desc'
  };

  export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder]


  export const NullableJsonNullValueInput: {
    DbNull: typeof DbNull,
    JsonNull: typeof JsonNull
  };

  export type NullableJsonNullValueInput = (typeof NullableJsonNullValueInput)[keyof typeof NullableJsonNullValueInput]


  export const QueryMode: {
    default: 'default',
    insensitive: 'insensitive'
  };

  export type QueryMode = (typeof QueryMode)[keyof typeof QueryMode]


  export const NullsOrder: {
    first: 'first',
    last: 'last'
  };

  export type NullsOrder = (typeof NullsOrder)[keyof typeof NullsOrder]


  export const JsonNullValueFilter: {
    DbNull: typeof DbNull,
    JsonNull: typeof JsonNull,
    AnyNull: typeof AnyNull
  };

  export type JsonNullValueFilter = (typeof JsonNullValueFilter)[keyof typeof JsonNullValueFilter]


  /**
   * Field references
   */


  /**
   * Reference to a field of type 'String'
   */
  export type StringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String'>
    


  /**
   * Reference to a field of type 'String[]'
   */
  export type ListStringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String[]'>
    


  /**
   * Reference to a field of type 'Boolean'
   */
  export type BooleanFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Boolean'>
    


  /**
   * Reference to a field of type 'DateTime'
   */
  export type DateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime'>
    


  /**
   * Reference to a field of type 'DateTime[]'
   */
  export type ListDateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime[]'>
    


  /**
   * Reference to a field of type 'Int'
   */
  export type IntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int'>
    


  /**
   * Reference to a field of type 'Int[]'
   */
  export type ListIntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int[]'>
    


  /**
   * Reference to a field of type 'OrderChannel'
   */
  export type EnumOrderChannelFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'OrderChannel'>
    


  /**
   * Reference to a field of type 'OrderChannel[]'
   */
  export type ListEnumOrderChannelFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'OrderChannel[]'>
    


  /**
   * Reference to a field of type 'OrderPriority'
   */
  export type EnumOrderPriorityFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'OrderPriority'>
    


  /**
   * Reference to a field of type 'OrderPriority[]'
   */
  export type ListEnumOrderPriorityFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'OrderPriority[]'>
    


  /**
   * Reference to a field of type 'OrderMode'
   */
  export type EnumOrderModeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'OrderMode'>
    


  /**
   * Reference to a field of type 'OrderMode[]'
   */
  export type ListEnumOrderModeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'OrderMode[]'>
    


  /**
   * Reference to a field of type 'WorkItemState'
   */
  export type EnumWorkItemStateFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'WorkItemState'>
    


  /**
   * Reference to a field of type 'WorkItemState[]'
   */
  export type ListEnumWorkItemStateFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'WorkItemState[]'>
    


  /**
   * Reference to a field of type 'RejectionCategory'
   */
  export type EnumRejectionCategoryFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'RejectionCategory'>
    


  /**
   * Reference to a field of type 'RejectionCategory[]'
   */
  export type ListEnumRejectionCategoryFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'RejectionCategory[]'>
    


  /**
   * Reference to a field of type 'Json'
   */
  export type JsonFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Json'>
    


  /**
   * Reference to a field of type 'QueryMode'
   */
  export type EnumQueryModeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'QueryMode'>
    


  /**
   * Reference to a field of type 'PhaseTimingKind'
   */
  export type EnumPhaseTimingKindFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'PhaseTimingKind'>
    


  /**
   * Reference to a field of type 'PhaseTimingKind[]'
   */
  export type ListEnumPhaseTimingKindFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'PhaseTimingKind[]'>
    


  /**
   * Reference to a field of type 'Float'
   */
  export type FloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float'>
    


  /**
   * Reference to a field of type 'Float[]'
   */
  export type ListFloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float[]'>
    
  /**
   * Deep Input Types
   */


  export type DepartmentWhereInput = {
    AND?: DepartmentWhereInput | DepartmentWhereInput[]
    OR?: DepartmentWhereInput[]
    NOT?: DepartmentWhereInput | DepartmentWhereInput[]
    id?: StringFilter<"Department"> | string
    name?: StringFilter<"Department"> | string
    isActive?: BoolFilter<"Department"> | boolean
    createdAt?: DateTimeFilter<"Department"> | Date | string
    workItems?: WorkItemListRelationFilter
  }

  export type DepartmentOrderByWithRelationInput = {
    id?: SortOrder
    name?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    workItems?: WorkItemOrderByRelationAggregateInput
  }

  export type DepartmentWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    name?: string
    AND?: DepartmentWhereInput | DepartmentWhereInput[]
    OR?: DepartmentWhereInput[]
    NOT?: DepartmentWhereInput | DepartmentWhereInput[]
    isActive?: BoolFilter<"Department"> | boolean
    createdAt?: DateTimeFilter<"Department"> | Date | string
    workItems?: WorkItemListRelationFilter
  }, "id" | "name">

  export type DepartmentOrderByWithAggregationInput = {
    id?: SortOrder
    name?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    _count?: DepartmentCountOrderByAggregateInput
    _max?: DepartmentMaxOrderByAggregateInput
    _min?: DepartmentMinOrderByAggregateInput
  }

  export type DepartmentScalarWhereWithAggregatesInput = {
    AND?: DepartmentScalarWhereWithAggregatesInput | DepartmentScalarWhereWithAggregatesInput[]
    OR?: DepartmentScalarWhereWithAggregatesInput[]
    NOT?: DepartmentScalarWhereWithAggregatesInput | DepartmentScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"Department"> | string
    name?: StringWithAggregatesFilter<"Department"> | string
    isActive?: BoolWithAggregatesFilter<"Department"> | boolean
    createdAt?: DateTimeWithAggregatesFilter<"Department"> | Date | string
  }

  export type CustomerWhereInput = {
    AND?: CustomerWhereInput | CustomerWhereInput[]
    OR?: CustomerWhereInput[]
    NOT?: CustomerWhereInput | CustomerWhereInput[]
    id?: StringFilter<"Customer"> | string
    name?: StringFilter<"Customer"> | string
    isCashCustomer?: BoolFilter<"Customer"> | boolean
    createdAt?: DateTimeFilter<"Customer"> | Date | string
    orders?: OrderListRelationFilter
  }

  export type CustomerOrderByWithRelationInput = {
    id?: SortOrder
    name?: SortOrder
    isCashCustomer?: SortOrder
    createdAt?: SortOrder
    orders?: OrderOrderByRelationAggregateInput
  }

  export type CustomerWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: CustomerWhereInput | CustomerWhereInput[]
    OR?: CustomerWhereInput[]
    NOT?: CustomerWhereInput | CustomerWhereInput[]
    name?: StringFilter<"Customer"> | string
    isCashCustomer?: BoolFilter<"Customer"> | boolean
    createdAt?: DateTimeFilter<"Customer"> | Date | string
    orders?: OrderListRelationFilter
  }, "id">

  export type CustomerOrderByWithAggregationInput = {
    id?: SortOrder
    name?: SortOrder
    isCashCustomer?: SortOrder
    createdAt?: SortOrder
    _count?: CustomerCountOrderByAggregateInput
    _max?: CustomerMaxOrderByAggregateInput
    _min?: CustomerMinOrderByAggregateInput
  }

  export type CustomerScalarWhereWithAggregatesInput = {
    AND?: CustomerScalarWhereWithAggregatesInput | CustomerScalarWhereWithAggregatesInput[]
    OR?: CustomerScalarWhereWithAggregatesInput[]
    NOT?: CustomerScalarWhereWithAggregatesInput | CustomerScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"Customer"> | string
    name?: StringWithAggregatesFilter<"Customer"> | string
    isCashCustomer?: BoolWithAggregatesFilter<"Customer"> | boolean
    createdAt?: DateTimeWithAggregatesFilter<"Customer"> | Date | string
  }

  export type OrderWhereInput = {
    AND?: OrderWhereInput | OrderWhereInput[]
    OR?: OrderWhereInput[]
    NOT?: OrderWhereInput | OrderWhereInput[]
    id?: StringFilter<"Order"> | string
    number?: IntFilter<"Order"> | number
    customerId?: StringFilter<"Order"> | string
    channel?: EnumOrderChannelFilter<"Order"> | $Enums.OrderChannel
    priority?: EnumOrderPriorityFilter<"Order"> | $Enums.OrderPriority
    mode?: EnumOrderModeFilter<"Order"> | $Enums.OrderMode
    createdById?: StringFilter<"Order"> | string
    createdAt?: DateTimeFilter<"Order"> | Date | string
    customer?: XOR<CustomerScalarRelationFilter, CustomerWhereInput>
    createdBy?: XOR<UserScalarRelationFilter, UserWhereInput>
    workItems?: WorkItemListRelationFilter
  }

  export type OrderOrderByWithRelationInput = {
    id?: SortOrder
    number?: SortOrder
    customerId?: SortOrder
    channel?: SortOrder
    priority?: SortOrder
    mode?: SortOrder
    createdById?: SortOrder
    createdAt?: SortOrder
    customer?: CustomerOrderByWithRelationInput
    createdBy?: UserOrderByWithRelationInput
    workItems?: WorkItemOrderByRelationAggregateInput
  }

  export type OrderWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    number?: number
    AND?: OrderWhereInput | OrderWhereInput[]
    OR?: OrderWhereInput[]
    NOT?: OrderWhereInput | OrderWhereInput[]
    customerId?: StringFilter<"Order"> | string
    channel?: EnumOrderChannelFilter<"Order"> | $Enums.OrderChannel
    priority?: EnumOrderPriorityFilter<"Order"> | $Enums.OrderPriority
    mode?: EnumOrderModeFilter<"Order"> | $Enums.OrderMode
    createdById?: StringFilter<"Order"> | string
    createdAt?: DateTimeFilter<"Order"> | Date | string
    customer?: XOR<CustomerScalarRelationFilter, CustomerWhereInput>
    createdBy?: XOR<UserScalarRelationFilter, UserWhereInput>
    workItems?: WorkItemListRelationFilter
  }, "id" | "number">

  export type OrderOrderByWithAggregationInput = {
    id?: SortOrder
    number?: SortOrder
    customerId?: SortOrder
    channel?: SortOrder
    priority?: SortOrder
    mode?: SortOrder
    createdById?: SortOrder
    createdAt?: SortOrder
    _count?: OrderCountOrderByAggregateInput
    _avg?: OrderAvgOrderByAggregateInput
    _max?: OrderMaxOrderByAggregateInput
    _min?: OrderMinOrderByAggregateInput
    _sum?: OrderSumOrderByAggregateInput
  }

  export type OrderScalarWhereWithAggregatesInput = {
    AND?: OrderScalarWhereWithAggregatesInput | OrderScalarWhereWithAggregatesInput[]
    OR?: OrderScalarWhereWithAggregatesInput[]
    NOT?: OrderScalarWhereWithAggregatesInput | OrderScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"Order"> | string
    number?: IntWithAggregatesFilter<"Order"> | number
    customerId?: StringWithAggregatesFilter<"Order"> | string
    channel?: EnumOrderChannelWithAggregatesFilter<"Order"> | $Enums.OrderChannel
    priority?: EnumOrderPriorityWithAggregatesFilter<"Order"> | $Enums.OrderPriority
    mode?: EnumOrderModeWithAggregatesFilter<"Order"> | $Enums.OrderMode
    createdById?: StringWithAggregatesFilter<"Order"> | string
    createdAt?: DateTimeWithAggregatesFilter<"Order"> | Date | string
  }

  export type WorkItemWhereInput = {
    AND?: WorkItemWhereInput | WorkItemWhereInput[]
    OR?: WorkItemWhereInput[]
    NOT?: WorkItemWhereInput | WorkItemWhereInput[]
    id?: StringFilter<"WorkItem"> | string
    orderId?: StringFilter<"WorkItem"> | string
    productTypeId?: StringNullableFilter<"WorkItem"> | string | null
    departmentId?: StringNullableFilter<"WorkItem"> | string | null
    state?: EnumWorkItemStateFilter<"WorkItem"> | $Enums.WorkItemState
    requiresDesign?: BoolFilter<"WorkItem"> | boolean
    requiresReview?: BoolFilter<"WorkItem"> | boolean
    assigneeId?: StringNullableFilter<"WorkItem"> | string | null
    createdAt?: DateTimeFilter<"WorkItem"> | Date | string
    updatedAt?: DateTimeFilter<"WorkItem"> | Date | string
    order?: XOR<OrderScalarRelationFilter, OrderWhereInput>
    department?: XOR<DepartmentNullableScalarRelationFilter, DepartmentWhereInput> | null
    assignee?: XOR<UserNullableScalarRelationFilter, UserWhereInput> | null
    transitions?: WorkItemTransitionListRelationFilter
    phaseTimings?: PhaseTimingListRelationFilter
  }

  export type WorkItemOrderByWithRelationInput = {
    id?: SortOrder
    orderId?: SortOrder
    productTypeId?: SortOrderInput | SortOrder
    departmentId?: SortOrderInput | SortOrder
    state?: SortOrder
    requiresDesign?: SortOrder
    requiresReview?: SortOrder
    assigneeId?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    order?: OrderOrderByWithRelationInput
    department?: DepartmentOrderByWithRelationInput
    assignee?: UserOrderByWithRelationInput
    transitions?: WorkItemTransitionOrderByRelationAggregateInput
    phaseTimings?: PhaseTimingOrderByRelationAggregateInput
  }

  export type WorkItemWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: WorkItemWhereInput | WorkItemWhereInput[]
    OR?: WorkItemWhereInput[]
    NOT?: WorkItemWhereInput | WorkItemWhereInput[]
    orderId?: StringFilter<"WorkItem"> | string
    productTypeId?: StringNullableFilter<"WorkItem"> | string | null
    departmentId?: StringNullableFilter<"WorkItem"> | string | null
    state?: EnumWorkItemStateFilter<"WorkItem"> | $Enums.WorkItemState
    requiresDesign?: BoolFilter<"WorkItem"> | boolean
    requiresReview?: BoolFilter<"WorkItem"> | boolean
    assigneeId?: StringNullableFilter<"WorkItem"> | string | null
    createdAt?: DateTimeFilter<"WorkItem"> | Date | string
    updatedAt?: DateTimeFilter<"WorkItem"> | Date | string
    order?: XOR<OrderScalarRelationFilter, OrderWhereInput>
    department?: XOR<DepartmentNullableScalarRelationFilter, DepartmentWhereInput> | null
    assignee?: XOR<UserNullableScalarRelationFilter, UserWhereInput> | null
    transitions?: WorkItemTransitionListRelationFilter
    phaseTimings?: PhaseTimingListRelationFilter
  }, "id">

  export type WorkItemOrderByWithAggregationInput = {
    id?: SortOrder
    orderId?: SortOrder
    productTypeId?: SortOrderInput | SortOrder
    departmentId?: SortOrderInput | SortOrder
    state?: SortOrder
    requiresDesign?: SortOrder
    requiresReview?: SortOrder
    assigneeId?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: WorkItemCountOrderByAggregateInput
    _max?: WorkItemMaxOrderByAggregateInput
    _min?: WorkItemMinOrderByAggregateInput
  }

  export type WorkItemScalarWhereWithAggregatesInput = {
    AND?: WorkItemScalarWhereWithAggregatesInput | WorkItemScalarWhereWithAggregatesInput[]
    OR?: WorkItemScalarWhereWithAggregatesInput[]
    NOT?: WorkItemScalarWhereWithAggregatesInput | WorkItemScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"WorkItem"> | string
    orderId?: StringWithAggregatesFilter<"WorkItem"> | string
    productTypeId?: StringNullableWithAggregatesFilter<"WorkItem"> | string | null
    departmentId?: StringNullableWithAggregatesFilter<"WorkItem"> | string | null
    state?: EnumWorkItemStateWithAggregatesFilter<"WorkItem"> | $Enums.WorkItemState
    requiresDesign?: BoolWithAggregatesFilter<"WorkItem"> | boolean
    requiresReview?: BoolWithAggregatesFilter<"WorkItem"> | boolean
    assigneeId?: StringNullableWithAggregatesFilter<"WorkItem"> | string | null
    createdAt?: DateTimeWithAggregatesFilter<"WorkItem"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"WorkItem"> | Date | string
  }

  export type WorkItemTransitionWhereInput = {
    AND?: WorkItemTransitionWhereInput | WorkItemTransitionWhereInput[]
    OR?: WorkItemTransitionWhereInput[]
    NOT?: WorkItemTransitionWhereInput | WorkItemTransitionWhereInput[]
    id?: StringFilter<"WorkItemTransition"> | string
    workItemId?: StringFilter<"WorkItemTransition"> | string
    from?: EnumWorkItemStateFilter<"WorkItemTransition"> | $Enums.WorkItemState
    to?: EnumWorkItemStateFilter<"WorkItemTransition"> | $Enums.WorkItemState
    actorId?: StringFilter<"WorkItemTransition"> | string
    at?: DateTimeFilter<"WorkItemTransition"> | Date | string
    reason?: StringNullableFilter<"WorkItemTransition"> | string | null
    rejectionCategory?: EnumRejectionCategoryNullableFilter<"WorkItemTransition"> | $Enums.RejectionCategory | null
    meta?: JsonNullableFilter<"WorkItemTransition">
    workItem?: XOR<WorkItemScalarRelationFilter, WorkItemWhereInput>
    actor?: XOR<UserScalarRelationFilter, UserWhereInput>
  }

  export type WorkItemTransitionOrderByWithRelationInput = {
    id?: SortOrder
    workItemId?: SortOrder
    from?: SortOrder
    to?: SortOrder
    actorId?: SortOrder
    at?: SortOrder
    reason?: SortOrderInput | SortOrder
    rejectionCategory?: SortOrderInput | SortOrder
    meta?: SortOrderInput | SortOrder
    workItem?: WorkItemOrderByWithRelationInput
    actor?: UserOrderByWithRelationInput
  }

  export type WorkItemTransitionWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: WorkItemTransitionWhereInput | WorkItemTransitionWhereInput[]
    OR?: WorkItemTransitionWhereInput[]
    NOT?: WorkItemTransitionWhereInput | WorkItemTransitionWhereInput[]
    workItemId?: StringFilter<"WorkItemTransition"> | string
    from?: EnumWorkItemStateFilter<"WorkItemTransition"> | $Enums.WorkItemState
    to?: EnumWorkItemStateFilter<"WorkItemTransition"> | $Enums.WorkItemState
    actorId?: StringFilter<"WorkItemTransition"> | string
    at?: DateTimeFilter<"WorkItemTransition"> | Date | string
    reason?: StringNullableFilter<"WorkItemTransition"> | string | null
    rejectionCategory?: EnumRejectionCategoryNullableFilter<"WorkItemTransition"> | $Enums.RejectionCategory | null
    meta?: JsonNullableFilter<"WorkItemTransition">
    workItem?: XOR<WorkItemScalarRelationFilter, WorkItemWhereInput>
    actor?: XOR<UserScalarRelationFilter, UserWhereInput>
  }, "id">

  export type WorkItemTransitionOrderByWithAggregationInput = {
    id?: SortOrder
    workItemId?: SortOrder
    from?: SortOrder
    to?: SortOrder
    actorId?: SortOrder
    at?: SortOrder
    reason?: SortOrderInput | SortOrder
    rejectionCategory?: SortOrderInput | SortOrder
    meta?: SortOrderInput | SortOrder
    _count?: WorkItemTransitionCountOrderByAggregateInput
    _max?: WorkItemTransitionMaxOrderByAggregateInput
    _min?: WorkItemTransitionMinOrderByAggregateInput
  }

  export type WorkItemTransitionScalarWhereWithAggregatesInput = {
    AND?: WorkItemTransitionScalarWhereWithAggregatesInput | WorkItemTransitionScalarWhereWithAggregatesInput[]
    OR?: WorkItemTransitionScalarWhereWithAggregatesInput[]
    NOT?: WorkItemTransitionScalarWhereWithAggregatesInput | WorkItemTransitionScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"WorkItemTransition"> | string
    workItemId?: StringWithAggregatesFilter<"WorkItemTransition"> | string
    from?: EnumWorkItemStateWithAggregatesFilter<"WorkItemTransition"> | $Enums.WorkItemState
    to?: EnumWorkItemStateWithAggregatesFilter<"WorkItemTransition"> | $Enums.WorkItemState
    actorId?: StringWithAggregatesFilter<"WorkItemTransition"> | string
    at?: DateTimeWithAggregatesFilter<"WorkItemTransition"> | Date | string
    reason?: StringNullableWithAggregatesFilter<"WorkItemTransition"> | string | null
    rejectionCategory?: EnumRejectionCategoryNullableWithAggregatesFilter<"WorkItemTransition"> | $Enums.RejectionCategory | null
    meta?: JsonNullableWithAggregatesFilter<"WorkItemTransition">
  }

  export type PhaseTimingWhereInput = {
    AND?: PhaseTimingWhereInput | PhaseTimingWhereInput[]
    OR?: PhaseTimingWhereInput[]
    NOT?: PhaseTimingWhereInput | PhaseTimingWhereInput[]
    id?: StringFilter<"PhaseTiming"> | string
    workItemId?: StringFilter<"PhaseTiming"> | string
    phase?: EnumWorkItemStateFilter<"PhaseTiming"> | $Enums.WorkItemState
    userId?: StringNullableFilter<"PhaseTiming"> | string | null
    kind?: EnumPhaseTimingKindFilter<"PhaseTiming"> | $Enums.PhaseTimingKind
    startedAt?: DateTimeFilter<"PhaseTiming"> | Date | string
    endedAt?: DateTimeNullableFilter<"PhaseTiming"> | Date | string | null
    workItem?: XOR<WorkItemScalarRelationFilter, WorkItemWhereInput>
    user?: XOR<UserNullableScalarRelationFilter, UserWhereInput> | null
  }

  export type PhaseTimingOrderByWithRelationInput = {
    id?: SortOrder
    workItemId?: SortOrder
    phase?: SortOrder
    userId?: SortOrderInput | SortOrder
    kind?: SortOrder
    startedAt?: SortOrder
    endedAt?: SortOrderInput | SortOrder
    workItem?: WorkItemOrderByWithRelationInput
    user?: UserOrderByWithRelationInput
  }

  export type PhaseTimingWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: PhaseTimingWhereInput | PhaseTimingWhereInput[]
    OR?: PhaseTimingWhereInput[]
    NOT?: PhaseTimingWhereInput | PhaseTimingWhereInput[]
    workItemId?: StringFilter<"PhaseTiming"> | string
    phase?: EnumWorkItemStateFilter<"PhaseTiming"> | $Enums.WorkItemState
    userId?: StringNullableFilter<"PhaseTiming"> | string | null
    kind?: EnumPhaseTimingKindFilter<"PhaseTiming"> | $Enums.PhaseTimingKind
    startedAt?: DateTimeFilter<"PhaseTiming"> | Date | string
    endedAt?: DateTimeNullableFilter<"PhaseTiming"> | Date | string | null
    workItem?: XOR<WorkItemScalarRelationFilter, WorkItemWhereInput>
    user?: XOR<UserNullableScalarRelationFilter, UserWhereInput> | null
  }, "id">

  export type PhaseTimingOrderByWithAggregationInput = {
    id?: SortOrder
    workItemId?: SortOrder
    phase?: SortOrder
    userId?: SortOrderInput | SortOrder
    kind?: SortOrder
    startedAt?: SortOrder
    endedAt?: SortOrderInput | SortOrder
    _count?: PhaseTimingCountOrderByAggregateInput
    _max?: PhaseTimingMaxOrderByAggregateInput
    _min?: PhaseTimingMinOrderByAggregateInput
  }

  export type PhaseTimingScalarWhereWithAggregatesInput = {
    AND?: PhaseTimingScalarWhereWithAggregatesInput | PhaseTimingScalarWhereWithAggregatesInput[]
    OR?: PhaseTimingScalarWhereWithAggregatesInput[]
    NOT?: PhaseTimingScalarWhereWithAggregatesInput | PhaseTimingScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"PhaseTiming"> | string
    workItemId?: StringWithAggregatesFilter<"PhaseTiming"> | string
    phase?: EnumWorkItemStateWithAggregatesFilter<"PhaseTiming"> | $Enums.WorkItemState
    userId?: StringNullableWithAggregatesFilter<"PhaseTiming"> | string | null
    kind?: EnumPhaseTimingKindWithAggregatesFilter<"PhaseTiming"> | $Enums.PhaseTimingKind
    startedAt?: DateTimeWithAggregatesFilter<"PhaseTiming"> | Date | string
    endedAt?: DateTimeNullableWithAggregatesFilter<"PhaseTiming"> | Date | string | null
  }

  export type NotificationEventWhereInput = {
    AND?: NotificationEventWhereInput | NotificationEventWhereInput[]
    OR?: NotificationEventWhereInput[]
    NOT?: NotificationEventWhereInput | NotificationEventWhereInput[]
    id?: StringFilter<"NotificationEvent"> | string
    type?: StringFilter<"NotificationEvent"> | string
    entityType?: StringFilter<"NotificationEvent"> | string
    entityId?: StringFilter<"NotificationEvent"> | string
    recipientUserIds?: StringNullableListFilter<"NotificationEvent">
    recipientRoles?: StringNullableListFilter<"NotificationEvent">
    recipientDepartmentIds?: StringNullableListFilter<"NotificationEvent">
    payload?: JsonNullableFilter<"NotificationEvent">
    createdAt?: DateTimeFilter<"NotificationEvent"> | Date | string
    deliveredAt?: DateTimeNullableFilter<"NotificationEvent"> | Date | string | null
    deliveryStatus?: StringNullableFilter<"NotificationEvent"> | string | null
  }

  export type NotificationEventOrderByWithRelationInput = {
    id?: SortOrder
    type?: SortOrder
    entityType?: SortOrder
    entityId?: SortOrder
    recipientUserIds?: SortOrder
    recipientRoles?: SortOrder
    recipientDepartmentIds?: SortOrder
    payload?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    deliveredAt?: SortOrderInput | SortOrder
    deliveryStatus?: SortOrderInput | SortOrder
  }

  export type NotificationEventWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: NotificationEventWhereInput | NotificationEventWhereInput[]
    OR?: NotificationEventWhereInput[]
    NOT?: NotificationEventWhereInput | NotificationEventWhereInput[]
    type?: StringFilter<"NotificationEvent"> | string
    entityType?: StringFilter<"NotificationEvent"> | string
    entityId?: StringFilter<"NotificationEvent"> | string
    recipientUserIds?: StringNullableListFilter<"NotificationEvent">
    recipientRoles?: StringNullableListFilter<"NotificationEvent">
    recipientDepartmentIds?: StringNullableListFilter<"NotificationEvent">
    payload?: JsonNullableFilter<"NotificationEvent">
    createdAt?: DateTimeFilter<"NotificationEvent"> | Date | string
    deliveredAt?: DateTimeNullableFilter<"NotificationEvent"> | Date | string | null
    deliveryStatus?: StringNullableFilter<"NotificationEvent"> | string | null
  }, "id">

  export type NotificationEventOrderByWithAggregationInput = {
    id?: SortOrder
    type?: SortOrder
    entityType?: SortOrder
    entityId?: SortOrder
    recipientUserIds?: SortOrder
    recipientRoles?: SortOrder
    recipientDepartmentIds?: SortOrder
    payload?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    deliveredAt?: SortOrderInput | SortOrder
    deliveryStatus?: SortOrderInput | SortOrder
    _count?: NotificationEventCountOrderByAggregateInput
    _max?: NotificationEventMaxOrderByAggregateInput
    _min?: NotificationEventMinOrderByAggregateInput
  }

  export type NotificationEventScalarWhereWithAggregatesInput = {
    AND?: NotificationEventScalarWhereWithAggregatesInput | NotificationEventScalarWhereWithAggregatesInput[]
    OR?: NotificationEventScalarWhereWithAggregatesInput[]
    NOT?: NotificationEventScalarWhereWithAggregatesInput | NotificationEventScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"NotificationEvent"> | string
    type?: StringWithAggregatesFilter<"NotificationEvent"> | string
    entityType?: StringWithAggregatesFilter<"NotificationEvent"> | string
    entityId?: StringWithAggregatesFilter<"NotificationEvent"> | string
    recipientUserIds?: StringNullableListFilter<"NotificationEvent">
    recipientRoles?: StringNullableListFilter<"NotificationEvent">
    recipientDepartmentIds?: StringNullableListFilter<"NotificationEvent">
    payload?: JsonNullableWithAggregatesFilter<"NotificationEvent">
    createdAt?: DateTimeWithAggregatesFilter<"NotificationEvent"> | Date | string
    deliveredAt?: DateTimeNullableWithAggregatesFilter<"NotificationEvent"> | Date | string | null
    deliveryStatus?: StringNullableWithAggregatesFilter<"NotificationEvent"> | string | null
  }

  export type UserWhereInput = {
    AND?: UserWhereInput | UserWhereInput[]
    OR?: UserWhereInput[]
    NOT?: UserWhereInput | UserWhereInput[]
    id?: StringFilter<"User"> | string
    name?: StringFilter<"User"> | string
    email?: StringFilter<"User"> | string
    emailVerified?: BoolFilter<"User"> | boolean
    image?: StringNullableFilter<"User"> | string | null
    createdAt?: DateTimeFilter<"User"> | Date | string
    updatedAt?: DateTimeFilter<"User"> | Date | string
    sessions?: SessionListRelationFilter
    accounts?: AccountListRelationFilter
    createdOrders?: OrderListRelationFilter
    assignedWorkItems?: WorkItemListRelationFilter
    workItemTransitions?: WorkItemTransitionListRelationFilter
    phaseTimings?: PhaseTimingListRelationFilter
  }

  export type UserOrderByWithRelationInput = {
    id?: SortOrder
    name?: SortOrder
    email?: SortOrder
    emailVerified?: SortOrder
    image?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    sessions?: SessionOrderByRelationAggregateInput
    accounts?: AccountOrderByRelationAggregateInput
    createdOrders?: OrderOrderByRelationAggregateInput
    assignedWorkItems?: WorkItemOrderByRelationAggregateInput
    workItemTransitions?: WorkItemTransitionOrderByRelationAggregateInput
    phaseTimings?: PhaseTimingOrderByRelationAggregateInput
  }

  export type UserWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    email?: string
    AND?: UserWhereInput | UserWhereInput[]
    OR?: UserWhereInput[]
    NOT?: UserWhereInput | UserWhereInput[]
    name?: StringFilter<"User"> | string
    emailVerified?: BoolFilter<"User"> | boolean
    image?: StringNullableFilter<"User"> | string | null
    createdAt?: DateTimeFilter<"User"> | Date | string
    updatedAt?: DateTimeFilter<"User"> | Date | string
    sessions?: SessionListRelationFilter
    accounts?: AccountListRelationFilter
    createdOrders?: OrderListRelationFilter
    assignedWorkItems?: WorkItemListRelationFilter
    workItemTransitions?: WorkItemTransitionListRelationFilter
    phaseTimings?: PhaseTimingListRelationFilter
  }, "id" | "email">

  export type UserOrderByWithAggregationInput = {
    id?: SortOrder
    name?: SortOrder
    email?: SortOrder
    emailVerified?: SortOrder
    image?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: UserCountOrderByAggregateInput
    _max?: UserMaxOrderByAggregateInput
    _min?: UserMinOrderByAggregateInput
  }

  export type UserScalarWhereWithAggregatesInput = {
    AND?: UserScalarWhereWithAggregatesInput | UserScalarWhereWithAggregatesInput[]
    OR?: UserScalarWhereWithAggregatesInput[]
    NOT?: UserScalarWhereWithAggregatesInput | UserScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"User"> | string
    name?: StringWithAggregatesFilter<"User"> | string
    email?: StringWithAggregatesFilter<"User"> | string
    emailVerified?: BoolWithAggregatesFilter<"User"> | boolean
    image?: StringNullableWithAggregatesFilter<"User"> | string | null
    createdAt?: DateTimeWithAggregatesFilter<"User"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"User"> | Date | string
  }

  export type SessionWhereInput = {
    AND?: SessionWhereInput | SessionWhereInput[]
    OR?: SessionWhereInput[]
    NOT?: SessionWhereInput | SessionWhereInput[]
    id?: StringFilter<"Session"> | string
    expiresAt?: DateTimeFilter<"Session"> | Date | string
    token?: StringFilter<"Session"> | string
    createdAt?: DateTimeFilter<"Session"> | Date | string
    updatedAt?: DateTimeFilter<"Session"> | Date | string
    ipAddress?: StringNullableFilter<"Session"> | string | null
    userAgent?: StringNullableFilter<"Session"> | string | null
    userId?: StringFilter<"Session"> | string
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
  }

  export type SessionOrderByWithRelationInput = {
    id?: SortOrder
    expiresAt?: SortOrder
    token?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    ipAddress?: SortOrderInput | SortOrder
    userAgent?: SortOrderInput | SortOrder
    userId?: SortOrder
    user?: UserOrderByWithRelationInput
  }

  export type SessionWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    token?: string
    AND?: SessionWhereInput | SessionWhereInput[]
    OR?: SessionWhereInput[]
    NOT?: SessionWhereInput | SessionWhereInput[]
    expiresAt?: DateTimeFilter<"Session"> | Date | string
    createdAt?: DateTimeFilter<"Session"> | Date | string
    updatedAt?: DateTimeFilter<"Session"> | Date | string
    ipAddress?: StringNullableFilter<"Session"> | string | null
    userAgent?: StringNullableFilter<"Session"> | string | null
    userId?: StringFilter<"Session"> | string
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
  }, "id" | "token">

  export type SessionOrderByWithAggregationInput = {
    id?: SortOrder
    expiresAt?: SortOrder
    token?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    ipAddress?: SortOrderInput | SortOrder
    userAgent?: SortOrderInput | SortOrder
    userId?: SortOrder
    _count?: SessionCountOrderByAggregateInput
    _max?: SessionMaxOrderByAggregateInput
    _min?: SessionMinOrderByAggregateInput
  }

  export type SessionScalarWhereWithAggregatesInput = {
    AND?: SessionScalarWhereWithAggregatesInput | SessionScalarWhereWithAggregatesInput[]
    OR?: SessionScalarWhereWithAggregatesInput[]
    NOT?: SessionScalarWhereWithAggregatesInput | SessionScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"Session"> | string
    expiresAt?: DateTimeWithAggregatesFilter<"Session"> | Date | string
    token?: StringWithAggregatesFilter<"Session"> | string
    createdAt?: DateTimeWithAggregatesFilter<"Session"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"Session"> | Date | string
    ipAddress?: StringNullableWithAggregatesFilter<"Session"> | string | null
    userAgent?: StringNullableWithAggregatesFilter<"Session"> | string | null
    userId?: StringWithAggregatesFilter<"Session"> | string
  }

  export type AccountWhereInput = {
    AND?: AccountWhereInput | AccountWhereInput[]
    OR?: AccountWhereInput[]
    NOT?: AccountWhereInput | AccountWhereInput[]
    id?: StringFilter<"Account"> | string
    accountId?: StringFilter<"Account"> | string
    providerId?: StringFilter<"Account"> | string
    userId?: StringFilter<"Account"> | string
    accessToken?: StringNullableFilter<"Account"> | string | null
    refreshToken?: StringNullableFilter<"Account"> | string | null
    idToken?: StringNullableFilter<"Account"> | string | null
    accessTokenExpiresAt?: DateTimeNullableFilter<"Account"> | Date | string | null
    refreshTokenExpiresAt?: DateTimeNullableFilter<"Account"> | Date | string | null
    scope?: StringNullableFilter<"Account"> | string | null
    password?: StringNullableFilter<"Account"> | string | null
    createdAt?: DateTimeFilter<"Account"> | Date | string
    updatedAt?: DateTimeFilter<"Account"> | Date | string
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
  }

  export type AccountOrderByWithRelationInput = {
    id?: SortOrder
    accountId?: SortOrder
    providerId?: SortOrder
    userId?: SortOrder
    accessToken?: SortOrderInput | SortOrder
    refreshToken?: SortOrderInput | SortOrder
    idToken?: SortOrderInput | SortOrder
    accessTokenExpiresAt?: SortOrderInput | SortOrder
    refreshTokenExpiresAt?: SortOrderInput | SortOrder
    scope?: SortOrderInput | SortOrder
    password?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    user?: UserOrderByWithRelationInput
  }

  export type AccountWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: AccountWhereInput | AccountWhereInput[]
    OR?: AccountWhereInput[]
    NOT?: AccountWhereInput | AccountWhereInput[]
    accountId?: StringFilter<"Account"> | string
    providerId?: StringFilter<"Account"> | string
    userId?: StringFilter<"Account"> | string
    accessToken?: StringNullableFilter<"Account"> | string | null
    refreshToken?: StringNullableFilter<"Account"> | string | null
    idToken?: StringNullableFilter<"Account"> | string | null
    accessTokenExpiresAt?: DateTimeNullableFilter<"Account"> | Date | string | null
    refreshTokenExpiresAt?: DateTimeNullableFilter<"Account"> | Date | string | null
    scope?: StringNullableFilter<"Account"> | string | null
    password?: StringNullableFilter<"Account"> | string | null
    createdAt?: DateTimeFilter<"Account"> | Date | string
    updatedAt?: DateTimeFilter<"Account"> | Date | string
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
  }, "id">

  export type AccountOrderByWithAggregationInput = {
    id?: SortOrder
    accountId?: SortOrder
    providerId?: SortOrder
    userId?: SortOrder
    accessToken?: SortOrderInput | SortOrder
    refreshToken?: SortOrderInput | SortOrder
    idToken?: SortOrderInput | SortOrder
    accessTokenExpiresAt?: SortOrderInput | SortOrder
    refreshTokenExpiresAt?: SortOrderInput | SortOrder
    scope?: SortOrderInput | SortOrder
    password?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: AccountCountOrderByAggregateInput
    _max?: AccountMaxOrderByAggregateInput
    _min?: AccountMinOrderByAggregateInput
  }

  export type AccountScalarWhereWithAggregatesInput = {
    AND?: AccountScalarWhereWithAggregatesInput | AccountScalarWhereWithAggregatesInput[]
    OR?: AccountScalarWhereWithAggregatesInput[]
    NOT?: AccountScalarWhereWithAggregatesInput | AccountScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"Account"> | string
    accountId?: StringWithAggregatesFilter<"Account"> | string
    providerId?: StringWithAggregatesFilter<"Account"> | string
    userId?: StringWithAggregatesFilter<"Account"> | string
    accessToken?: StringNullableWithAggregatesFilter<"Account"> | string | null
    refreshToken?: StringNullableWithAggregatesFilter<"Account"> | string | null
    idToken?: StringNullableWithAggregatesFilter<"Account"> | string | null
    accessTokenExpiresAt?: DateTimeNullableWithAggregatesFilter<"Account"> | Date | string | null
    refreshTokenExpiresAt?: DateTimeNullableWithAggregatesFilter<"Account"> | Date | string | null
    scope?: StringNullableWithAggregatesFilter<"Account"> | string | null
    password?: StringNullableWithAggregatesFilter<"Account"> | string | null
    createdAt?: DateTimeWithAggregatesFilter<"Account"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"Account"> | Date | string
  }

  export type VerificationWhereInput = {
    AND?: VerificationWhereInput | VerificationWhereInput[]
    OR?: VerificationWhereInput[]
    NOT?: VerificationWhereInput | VerificationWhereInput[]
    id?: StringFilter<"Verification"> | string
    identifier?: StringFilter<"Verification"> | string
    value?: StringFilter<"Verification"> | string
    expiresAt?: DateTimeFilter<"Verification"> | Date | string
    createdAt?: DateTimeFilter<"Verification"> | Date | string
    updatedAt?: DateTimeFilter<"Verification"> | Date | string
  }

  export type VerificationOrderByWithRelationInput = {
    id?: SortOrder
    identifier?: SortOrder
    value?: SortOrder
    expiresAt?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type VerificationWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: VerificationWhereInput | VerificationWhereInput[]
    OR?: VerificationWhereInput[]
    NOT?: VerificationWhereInput | VerificationWhereInput[]
    identifier?: StringFilter<"Verification"> | string
    value?: StringFilter<"Verification"> | string
    expiresAt?: DateTimeFilter<"Verification"> | Date | string
    createdAt?: DateTimeFilter<"Verification"> | Date | string
    updatedAt?: DateTimeFilter<"Verification"> | Date | string
  }, "id">

  export type VerificationOrderByWithAggregationInput = {
    id?: SortOrder
    identifier?: SortOrder
    value?: SortOrder
    expiresAt?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: VerificationCountOrderByAggregateInput
    _max?: VerificationMaxOrderByAggregateInput
    _min?: VerificationMinOrderByAggregateInput
  }

  export type VerificationScalarWhereWithAggregatesInput = {
    AND?: VerificationScalarWhereWithAggregatesInput | VerificationScalarWhereWithAggregatesInput[]
    OR?: VerificationScalarWhereWithAggregatesInput[]
    NOT?: VerificationScalarWhereWithAggregatesInput | VerificationScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"Verification"> | string
    identifier?: StringWithAggregatesFilter<"Verification"> | string
    value?: StringWithAggregatesFilter<"Verification"> | string
    expiresAt?: DateTimeWithAggregatesFilter<"Verification"> | Date | string
    createdAt?: DateTimeWithAggregatesFilter<"Verification"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"Verification"> | Date | string
  }

  export type DepartmentCreateInput = {
    id?: string
    name: string
    isActive?: boolean
    createdAt?: Date | string
    workItems?: WorkItemCreateNestedManyWithoutDepartmentInput
  }

  export type DepartmentUncheckedCreateInput = {
    id?: string
    name: string
    isActive?: boolean
    createdAt?: Date | string
    workItems?: WorkItemUncheckedCreateNestedManyWithoutDepartmentInput
  }

  export type DepartmentUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    workItems?: WorkItemUpdateManyWithoutDepartmentNestedInput
  }

  export type DepartmentUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    workItems?: WorkItemUncheckedUpdateManyWithoutDepartmentNestedInput
  }

  export type DepartmentCreateManyInput = {
    id?: string
    name: string
    isActive?: boolean
    createdAt?: Date | string
  }

  export type DepartmentUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type DepartmentUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CustomerCreateInput = {
    id?: string
    name: string
    isCashCustomer?: boolean
    createdAt?: Date | string
    orders?: OrderCreateNestedManyWithoutCustomerInput
  }

  export type CustomerUncheckedCreateInput = {
    id?: string
    name: string
    isCashCustomer?: boolean
    createdAt?: Date | string
    orders?: OrderUncheckedCreateNestedManyWithoutCustomerInput
  }

  export type CustomerUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    isCashCustomer?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    orders?: OrderUpdateManyWithoutCustomerNestedInput
  }

  export type CustomerUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    isCashCustomer?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    orders?: OrderUncheckedUpdateManyWithoutCustomerNestedInput
  }

  export type CustomerCreateManyInput = {
    id?: string
    name: string
    isCashCustomer?: boolean
    createdAt?: Date | string
  }

  export type CustomerUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    isCashCustomer?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CustomerUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    isCashCustomer?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type OrderCreateInput = {
    id?: string
    number: number
    channel: $Enums.OrderChannel
    priority: $Enums.OrderPriority
    mode: $Enums.OrderMode
    createdAt?: Date | string
    customer: CustomerCreateNestedOneWithoutOrdersInput
    createdBy: UserCreateNestedOneWithoutCreatedOrdersInput
    workItems?: WorkItemCreateNestedManyWithoutOrderInput
  }

  export type OrderUncheckedCreateInput = {
    id?: string
    number: number
    customerId: string
    channel: $Enums.OrderChannel
    priority: $Enums.OrderPriority
    mode: $Enums.OrderMode
    createdById: string
    createdAt?: Date | string
    workItems?: WorkItemUncheckedCreateNestedManyWithoutOrderInput
  }

  export type OrderUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    number?: IntFieldUpdateOperationsInput | number
    channel?: EnumOrderChannelFieldUpdateOperationsInput | $Enums.OrderChannel
    priority?: EnumOrderPriorityFieldUpdateOperationsInput | $Enums.OrderPriority
    mode?: EnumOrderModeFieldUpdateOperationsInput | $Enums.OrderMode
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    customer?: CustomerUpdateOneRequiredWithoutOrdersNestedInput
    createdBy?: UserUpdateOneRequiredWithoutCreatedOrdersNestedInput
    workItems?: WorkItemUpdateManyWithoutOrderNestedInput
  }

  export type OrderUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    number?: IntFieldUpdateOperationsInput | number
    customerId?: StringFieldUpdateOperationsInput | string
    channel?: EnumOrderChannelFieldUpdateOperationsInput | $Enums.OrderChannel
    priority?: EnumOrderPriorityFieldUpdateOperationsInput | $Enums.OrderPriority
    mode?: EnumOrderModeFieldUpdateOperationsInput | $Enums.OrderMode
    createdById?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    workItems?: WorkItemUncheckedUpdateManyWithoutOrderNestedInput
  }

  export type OrderCreateManyInput = {
    id?: string
    number: number
    customerId: string
    channel: $Enums.OrderChannel
    priority: $Enums.OrderPriority
    mode: $Enums.OrderMode
    createdById: string
    createdAt?: Date | string
  }

  export type OrderUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    number?: IntFieldUpdateOperationsInput | number
    channel?: EnumOrderChannelFieldUpdateOperationsInput | $Enums.OrderChannel
    priority?: EnumOrderPriorityFieldUpdateOperationsInput | $Enums.OrderPriority
    mode?: EnumOrderModeFieldUpdateOperationsInput | $Enums.OrderMode
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type OrderUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    number?: IntFieldUpdateOperationsInput | number
    customerId?: StringFieldUpdateOperationsInput | string
    channel?: EnumOrderChannelFieldUpdateOperationsInput | $Enums.OrderChannel
    priority?: EnumOrderPriorityFieldUpdateOperationsInput | $Enums.OrderPriority
    mode?: EnumOrderModeFieldUpdateOperationsInput | $Enums.OrderMode
    createdById?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type WorkItemCreateInput = {
    id?: string
    productTypeId?: string | null
    state: $Enums.WorkItemState
    requiresDesign?: boolean
    requiresReview?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    order: OrderCreateNestedOneWithoutWorkItemsInput
    department?: DepartmentCreateNestedOneWithoutWorkItemsInput
    assignee?: UserCreateNestedOneWithoutAssignedWorkItemsInput
    transitions?: WorkItemTransitionCreateNestedManyWithoutWorkItemInput
    phaseTimings?: PhaseTimingCreateNestedManyWithoutWorkItemInput
  }

  export type WorkItemUncheckedCreateInput = {
    id?: string
    orderId: string
    productTypeId?: string | null
    departmentId?: string | null
    state: $Enums.WorkItemState
    requiresDesign?: boolean
    requiresReview?: boolean
    assigneeId?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    transitions?: WorkItemTransitionUncheckedCreateNestedManyWithoutWorkItemInput
    phaseTimings?: PhaseTimingUncheckedCreateNestedManyWithoutWorkItemInput
  }

  export type WorkItemUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    productTypeId?: NullableStringFieldUpdateOperationsInput | string | null
    state?: EnumWorkItemStateFieldUpdateOperationsInput | $Enums.WorkItemState
    requiresDesign?: BoolFieldUpdateOperationsInput | boolean
    requiresReview?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    order?: OrderUpdateOneRequiredWithoutWorkItemsNestedInput
    department?: DepartmentUpdateOneWithoutWorkItemsNestedInput
    assignee?: UserUpdateOneWithoutAssignedWorkItemsNestedInput
    transitions?: WorkItemTransitionUpdateManyWithoutWorkItemNestedInput
    phaseTimings?: PhaseTimingUpdateManyWithoutWorkItemNestedInput
  }

  export type WorkItemUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    orderId?: StringFieldUpdateOperationsInput | string
    productTypeId?: NullableStringFieldUpdateOperationsInput | string | null
    departmentId?: NullableStringFieldUpdateOperationsInput | string | null
    state?: EnumWorkItemStateFieldUpdateOperationsInput | $Enums.WorkItemState
    requiresDesign?: BoolFieldUpdateOperationsInput | boolean
    requiresReview?: BoolFieldUpdateOperationsInput | boolean
    assigneeId?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    transitions?: WorkItemTransitionUncheckedUpdateManyWithoutWorkItemNestedInput
    phaseTimings?: PhaseTimingUncheckedUpdateManyWithoutWorkItemNestedInput
  }

  export type WorkItemCreateManyInput = {
    id?: string
    orderId: string
    productTypeId?: string | null
    departmentId?: string | null
    state: $Enums.WorkItemState
    requiresDesign?: boolean
    requiresReview?: boolean
    assigneeId?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type WorkItemUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    productTypeId?: NullableStringFieldUpdateOperationsInput | string | null
    state?: EnumWorkItemStateFieldUpdateOperationsInput | $Enums.WorkItemState
    requiresDesign?: BoolFieldUpdateOperationsInput | boolean
    requiresReview?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type WorkItemUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    orderId?: StringFieldUpdateOperationsInput | string
    productTypeId?: NullableStringFieldUpdateOperationsInput | string | null
    departmentId?: NullableStringFieldUpdateOperationsInput | string | null
    state?: EnumWorkItemStateFieldUpdateOperationsInput | $Enums.WorkItemState
    requiresDesign?: BoolFieldUpdateOperationsInput | boolean
    requiresReview?: BoolFieldUpdateOperationsInput | boolean
    assigneeId?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type WorkItemTransitionCreateInput = {
    id?: string
    from: $Enums.WorkItemState
    to: $Enums.WorkItemState
    at?: Date | string
    reason?: string | null
    rejectionCategory?: $Enums.RejectionCategory | null
    meta?: NullableJsonNullValueInput | InputJsonValue
    workItem: WorkItemCreateNestedOneWithoutTransitionsInput
    actor: UserCreateNestedOneWithoutWorkItemTransitionsInput
  }

  export type WorkItemTransitionUncheckedCreateInput = {
    id?: string
    workItemId: string
    from: $Enums.WorkItemState
    to: $Enums.WorkItemState
    actorId: string
    at?: Date | string
    reason?: string | null
    rejectionCategory?: $Enums.RejectionCategory | null
    meta?: NullableJsonNullValueInput | InputJsonValue
  }

  export type WorkItemTransitionUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    from?: EnumWorkItemStateFieldUpdateOperationsInput | $Enums.WorkItemState
    to?: EnumWorkItemStateFieldUpdateOperationsInput | $Enums.WorkItemState
    at?: DateTimeFieldUpdateOperationsInput | Date | string
    reason?: NullableStringFieldUpdateOperationsInput | string | null
    rejectionCategory?: NullableEnumRejectionCategoryFieldUpdateOperationsInput | $Enums.RejectionCategory | null
    meta?: NullableJsonNullValueInput | InputJsonValue
    workItem?: WorkItemUpdateOneRequiredWithoutTransitionsNestedInput
    actor?: UserUpdateOneRequiredWithoutWorkItemTransitionsNestedInput
  }

  export type WorkItemTransitionUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    workItemId?: StringFieldUpdateOperationsInput | string
    from?: EnumWorkItemStateFieldUpdateOperationsInput | $Enums.WorkItemState
    to?: EnumWorkItemStateFieldUpdateOperationsInput | $Enums.WorkItemState
    actorId?: StringFieldUpdateOperationsInput | string
    at?: DateTimeFieldUpdateOperationsInput | Date | string
    reason?: NullableStringFieldUpdateOperationsInput | string | null
    rejectionCategory?: NullableEnumRejectionCategoryFieldUpdateOperationsInput | $Enums.RejectionCategory | null
    meta?: NullableJsonNullValueInput | InputJsonValue
  }

  export type WorkItemTransitionCreateManyInput = {
    id?: string
    workItemId: string
    from: $Enums.WorkItemState
    to: $Enums.WorkItemState
    actorId: string
    at?: Date | string
    reason?: string | null
    rejectionCategory?: $Enums.RejectionCategory | null
    meta?: NullableJsonNullValueInput | InputJsonValue
  }

  export type WorkItemTransitionUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    from?: EnumWorkItemStateFieldUpdateOperationsInput | $Enums.WorkItemState
    to?: EnumWorkItemStateFieldUpdateOperationsInput | $Enums.WorkItemState
    at?: DateTimeFieldUpdateOperationsInput | Date | string
    reason?: NullableStringFieldUpdateOperationsInput | string | null
    rejectionCategory?: NullableEnumRejectionCategoryFieldUpdateOperationsInput | $Enums.RejectionCategory | null
    meta?: NullableJsonNullValueInput | InputJsonValue
  }

  export type WorkItemTransitionUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    workItemId?: StringFieldUpdateOperationsInput | string
    from?: EnumWorkItemStateFieldUpdateOperationsInput | $Enums.WorkItemState
    to?: EnumWorkItemStateFieldUpdateOperationsInput | $Enums.WorkItemState
    actorId?: StringFieldUpdateOperationsInput | string
    at?: DateTimeFieldUpdateOperationsInput | Date | string
    reason?: NullableStringFieldUpdateOperationsInput | string | null
    rejectionCategory?: NullableEnumRejectionCategoryFieldUpdateOperationsInput | $Enums.RejectionCategory | null
    meta?: NullableJsonNullValueInput | InputJsonValue
  }

  export type PhaseTimingCreateInput = {
    id?: string
    phase: $Enums.WorkItemState
    kind: $Enums.PhaseTimingKind
    startedAt: Date | string
    endedAt?: Date | string | null
    workItem: WorkItemCreateNestedOneWithoutPhaseTimingsInput
    user?: UserCreateNestedOneWithoutPhaseTimingsInput
  }

  export type PhaseTimingUncheckedCreateInput = {
    id?: string
    workItemId: string
    phase: $Enums.WorkItemState
    userId?: string | null
    kind: $Enums.PhaseTimingKind
    startedAt: Date | string
    endedAt?: Date | string | null
  }

  export type PhaseTimingUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    phase?: EnumWorkItemStateFieldUpdateOperationsInput | $Enums.WorkItemState
    kind?: EnumPhaseTimingKindFieldUpdateOperationsInput | $Enums.PhaseTimingKind
    startedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    endedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    workItem?: WorkItemUpdateOneRequiredWithoutPhaseTimingsNestedInput
    user?: UserUpdateOneWithoutPhaseTimingsNestedInput
  }

  export type PhaseTimingUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    workItemId?: StringFieldUpdateOperationsInput | string
    phase?: EnumWorkItemStateFieldUpdateOperationsInput | $Enums.WorkItemState
    userId?: NullableStringFieldUpdateOperationsInput | string | null
    kind?: EnumPhaseTimingKindFieldUpdateOperationsInput | $Enums.PhaseTimingKind
    startedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    endedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type PhaseTimingCreateManyInput = {
    id?: string
    workItemId: string
    phase: $Enums.WorkItemState
    userId?: string | null
    kind: $Enums.PhaseTimingKind
    startedAt: Date | string
    endedAt?: Date | string | null
  }

  export type PhaseTimingUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    phase?: EnumWorkItemStateFieldUpdateOperationsInput | $Enums.WorkItemState
    kind?: EnumPhaseTimingKindFieldUpdateOperationsInput | $Enums.PhaseTimingKind
    startedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    endedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type PhaseTimingUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    workItemId?: StringFieldUpdateOperationsInput | string
    phase?: EnumWorkItemStateFieldUpdateOperationsInput | $Enums.WorkItemState
    userId?: NullableStringFieldUpdateOperationsInput | string | null
    kind?: EnumPhaseTimingKindFieldUpdateOperationsInput | $Enums.PhaseTimingKind
    startedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    endedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type NotificationEventCreateInput = {
    id?: string
    type: string
    entityType: string
    entityId: string
    recipientUserIds?: NotificationEventCreaterecipientUserIdsInput | string[]
    recipientRoles?: NotificationEventCreaterecipientRolesInput | string[]
    recipientDepartmentIds?: NotificationEventCreaterecipientDepartmentIdsInput | string[]
    payload?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    deliveredAt?: Date | string | null
    deliveryStatus?: string | null
  }

  export type NotificationEventUncheckedCreateInput = {
    id?: string
    type: string
    entityType: string
    entityId: string
    recipientUserIds?: NotificationEventCreaterecipientUserIdsInput | string[]
    recipientRoles?: NotificationEventCreaterecipientRolesInput | string[]
    recipientDepartmentIds?: NotificationEventCreaterecipientDepartmentIdsInput | string[]
    payload?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    deliveredAt?: Date | string | null
    deliveryStatus?: string | null
  }

  export type NotificationEventUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    type?: StringFieldUpdateOperationsInput | string
    entityType?: StringFieldUpdateOperationsInput | string
    entityId?: StringFieldUpdateOperationsInput | string
    recipientUserIds?: NotificationEventUpdaterecipientUserIdsInput | string[]
    recipientRoles?: NotificationEventUpdaterecipientRolesInput | string[]
    recipientDepartmentIds?: NotificationEventUpdaterecipientDepartmentIdsInput | string[]
    payload?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    deliveredAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    deliveryStatus?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type NotificationEventUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    type?: StringFieldUpdateOperationsInput | string
    entityType?: StringFieldUpdateOperationsInput | string
    entityId?: StringFieldUpdateOperationsInput | string
    recipientUserIds?: NotificationEventUpdaterecipientUserIdsInput | string[]
    recipientRoles?: NotificationEventUpdaterecipientRolesInput | string[]
    recipientDepartmentIds?: NotificationEventUpdaterecipientDepartmentIdsInput | string[]
    payload?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    deliveredAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    deliveryStatus?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type NotificationEventCreateManyInput = {
    id?: string
    type: string
    entityType: string
    entityId: string
    recipientUserIds?: NotificationEventCreaterecipientUserIdsInput | string[]
    recipientRoles?: NotificationEventCreaterecipientRolesInput | string[]
    recipientDepartmentIds?: NotificationEventCreaterecipientDepartmentIdsInput | string[]
    payload?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    deliveredAt?: Date | string | null
    deliveryStatus?: string | null
  }

  export type NotificationEventUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    type?: StringFieldUpdateOperationsInput | string
    entityType?: StringFieldUpdateOperationsInput | string
    entityId?: StringFieldUpdateOperationsInput | string
    recipientUserIds?: NotificationEventUpdaterecipientUserIdsInput | string[]
    recipientRoles?: NotificationEventUpdaterecipientRolesInput | string[]
    recipientDepartmentIds?: NotificationEventUpdaterecipientDepartmentIdsInput | string[]
    payload?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    deliveredAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    deliveryStatus?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type NotificationEventUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    type?: StringFieldUpdateOperationsInput | string
    entityType?: StringFieldUpdateOperationsInput | string
    entityId?: StringFieldUpdateOperationsInput | string
    recipientUserIds?: NotificationEventUpdaterecipientUserIdsInput | string[]
    recipientRoles?: NotificationEventUpdaterecipientRolesInput | string[]
    recipientDepartmentIds?: NotificationEventUpdaterecipientDepartmentIdsInput | string[]
    payload?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    deliveredAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    deliveryStatus?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type UserCreateInput = {
    id: string
    name: string
    email: string
    emailVerified?: boolean
    image?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    sessions?: SessionCreateNestedManyWithoutUserInput
    accounts?: AccountCreateNestedManyWithoutUserInput
    createdOrders?: OrderCreateNestedManyWithoutCreatedByInput
    assignedWorkItems?: WorkItemCreateNestedManyWithoutAssigneeInput
    workItemTransitions?: WorkItemTransitionCreateNestedManyWithoutActorInput
    phaseTimings?: PhaseTimingCreateNestedManyWithoutUserInput
  }

  export type UserUncheckedCreateInput = {
    id: string
    name: string
    email: string
    emailVerified?: boolean
    image?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    sessions?: SessionUncheckedCreateNestedManyWithoutUserInput
    accounts?: AccountUncheckedCreateNestedManyWithoutUserInput
    createdOrders?: OrderUncheckedCreateNestedManyWithoutCreatedByInput
    assignedWorkItems?: WorkItemUncheckedCreateNestedManyWithoutAssigneeInput
    workItemTransitions?: WorkItemTransitionUncheckedCreateNestedManyWithoutActorInput
    phaseTimings?: PhaseTimingUncheckedCreateNestedManyWithoutUserInput
  }

  export type UserUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    emailVerified?: BoolFieldUpdateOperationsInput | boolean
    image?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    sessions?: SessionUpdateManyWithoutUserNestedInput
    accounts?: AccountUpdateManyWithoutUserNestedInput
    createdOrders?: OrderUpdateManyWithoutCreatedByNestedInput
    assignedWorkItems?: WorkItemUpdateManyWithoutAssigneeNestedInput
    workItemTransitions?: WorkItemTransitionUpdateManyWithoutActorNestedInput
    phaseTimings?: PhaseTimingUpdateManyWithoutUserNestedInput
  }

  export type UserUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    emailVerified?: BoolFieldUpdateOperationsInput | boolean
    image?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    sessions?: SessionUncheckedUpdateManyWithoutUserNestedInput
    accounts?: AccountUncheckedUpdateManyWithoutUserNestedInput
    createdOrders?: OrderUncheckedUpdateManyWithoutCreatedByNestedInput
    assignedWorkItems?: WorkItemUncheckedUpdateManyWithoutAssigneeNestedInput
    workItemTransitions?: WorkItemTransitionUncheckedUpdateManyWithoutActorNestedInput
    phaseTimings?: PhaseTimingUncheckedUpdateManyWithoutUserNestedInput
  }

  export type UserCreateManyInput = {
    id: string
    name: string
    email: string
    emailVerified?: boolean
    image?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type UserUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    emailVerified?: BoolFieldUpdateOperationsInput | boolean
    image?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UserUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    emailVerified?: BoolFieldUpdateOperationsInput | boolean
    image?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type SessionCreateInput = {
    id: string
    expiresAt: Date | string
    token: string
    createdAt?: Date | string
    updatedAt?: Date | string
    ipAddress?: string | null
    userAgent?: string | null
    user: UserCreateNestedOneWithoutSessionsInput
  }

  export type SessionUncheckedCreateInput = {
    id: string
    expiresAt: Date | string
    token: string
    createdAt?: Date | string
    updatedAt?: Date | string
    ipAddress?: string | null
    userAgent?: string | null
    userId: string
  }

  export type SessionUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
    token?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    ipAddress?: NullableStringFieldUpdateOperationsInput | string | null
    userAgent?: NullableStringFieldUpdateOperationsInput | string | null
    user?: UserUpdateOneRequiredWithoutSessionsNestedInput
  }

  export type SessionUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
    token?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    ipAddress?: NullableStringFieldUpdateOperationsInput | string | null
    userAgent?: NullableStringFieldUpdateOperationsInput | string | null
    userId?: StringFieldUpdateOperationsInput | string
  }

  export type SessionCreateManyInput = {
    id: string
    expiresAt: Date | string
    token: string
    createdAt?: Date | string
    updatedAt?: Date | string
    ipAddress?: string | null
    userAgent?: string | null
    userId: string
  }

  export type SessionUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
    token?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    ipAddress?: NullableStringFieldUpdateOperationsInput | string | null
    userAgent?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type SessionUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
    token?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    ipAddress?: NullableStringFieldUpdateOperationsInput | string | null
    userAgent?: NullableStringFieldUpdateOperationsInput | string | null
    userId?: StringFieldUpdateOperationsInput | string
  }

  export type AccountCreateInput = {
    id: string
    accountId: string
    providerId: string
    accessToken?: string | null
    refreshToken?: string | null
    idToken?: string | null
    accessTokenExpiresAt?: Date | string | null
    refreshTokenExpiresAt?: Date | string | null
    scope?: string | null
    password?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    user: UserCreateNestedOneWithoutAccountsInput
  }

  export type AccountUncheckedCreateInput = {
    id: string
    accountId: string
    providerId: string
    userId: string
    accessToken?: string | null
    refreshToken?: string | null
    idToken?: string | null
    accessTokenExpiresAt?: Date | string | null
    refreshTokenExpiresAt?: Date | string | null
    scope?: string | null
    password?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type AccountUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    accountId?: StringFieldUpdateOperationsInput | string
    providerId?: StringFieldUpdateOperationsInput | string
    accessToken?: NullableStringFieldUpdateOperationsInput | string | null
    refreshToken?: NullableStringFieldUpdateOperationsInput | string | null
    idToken?: NullableStringFieldUpdateOperationsInput | string | null
    accessTokenExpiresAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    refreshTokenExpiresAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    scope?: NullableStringFieldUpdateOperationsInput | string | null
    password?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    user?: UserUpdateOneRequiredWithoutAccountsNestedInput
  }

  export type AccountUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    accountId?: StringFieldUpdateOperationsInput | string
    providerId?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    accessToken?: NullableStringFieldUpdateOperationsInput | string | null
    refreshToken?: NullableStringFieldUpdateOperationsInput | string | null
    idToken?: NullableStringFieldUpdateOperationsInput | string | null
    accessTokenExpiresAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    refreshTokenExpiresAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    scope?: NullableStringFieldUpdateOperationsInput | string | null
    password?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AccountCreateManyInput = {
    id: string
    accountId: string
    providerId: string
    userId: string
    accessToken?: string | null
    refreshToken?: string | null
    idToken?: string | null
    accessTokenExpiresAt?: Date | string | null
    refreshTokenExpiresAt?: Date | string | null
    scope?: string | null
    password?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type AccountUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    accountId?: StringFieldUpdateOperationsInput | string
    providerId?: StringFieldUpdateOperationsInput | string
    accessToken?: NullableStringFieldUpdateOperationsInput | string | null
    refreshToken?: NullableStringFieldUpdateOperationsInput | string | null
    idToken?: NullableStringFieldUpdateOperationsInput | string | null
    accessTokenExpiresAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    refreshTokenExpiresAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    scope?: NullableStringFieldUpdateOperationsInput | string | null
    password?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AccountUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    accountId?: StringFieldUpdateOperationsInput | string
    providerId?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    accessToken?: NullableStringFieldUpdateOperationsInput | string | null
    refreshToken?: NullableStringFieldUpdateOperationsInput | string | null
    idToken?: NullableStringFieldUpdateOperationsInput | string | null
    accessTokenExpiresAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    refreshTokenExpiresAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    scope?: NullableStringFieldUpdateOperationsInput | string | null
    password?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type VerificationCreateInput = {
    id: string
    identifier: string
    value: string
    expiresAt: Date | string
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type VerificationUncheckedCreateInput = {
    id: string
    identifier: string
    value: string
    expiresAt: Date | string
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type VerificationUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    identifier?: StringFieldUpdateOperationsInput | string
    value?: StringFieldUpdateOperationsInput | string
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type VerificationUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    identifier?: StringFieldUpdateOperationsInput | string
    value?: StringFieldUpdateOperationsInput | string
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type VerificationCreateManyInput = {
    id: string
    identifier: string
    value: string
    expiresAt: Date | string
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type VerificationUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    identifier?: StringFieldUpdateOperationsInput | string
    value?: StringFieldUpdateOperationsInput | string
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type VerificationUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    identifier?: StringFieldUpdateOperationsInput | string
    value?: StringFieldUpdateOperationsInput | string
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type StringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type BoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolFilter<$PrismaModel> | boolean
  }

  export type DateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type WorkItemListRelationFilter = {
    every?: WorkItemWhereInput
    some?: WorkItemWhereInput
    none?: WorkItemWhereInput
  }

  export type WorkItemOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type DepartmentCountOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
  }

  export type DepartmentMaxOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
  }

  export type DepartmentMinOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
  }

  export type StringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type BoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedBoolFilter<$PrismaModel>
    _max?: NestedBoolFilter<$PrismaModel>
  }

  export type DateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type OrderListRelationFilter = {
    every?: OrderWhereInput
    some?: OrderWhereInput
    none?: OrderWhereInput
  }

  export type OrderOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type CustomerCountOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    isCashCustomer?: SortOrder
    createdAt?: SortOrder
  }

  export type CustomerMaxOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    isCashCustomer?: SortOrder
    createdAt?: SortOrder
  }

  export type CustomerMinOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    isCashCustomer?: SortOrder
    createdAt?: SortOrder
  }

  export type IntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type EnumOrderChannelFilter<$PrismaModel = never> = {
    equals?: $Enums.OrderChannel | EnumOrderChannelFieldRefInput<$PrismaModel>
    in?: $Enums.OrderChannel[] | ListEnumOrderChannelFieldRefInput<$PrismaModel>
    notIn?: $Enums.OrderChannel[] | ListEnumOrderChannelFieldRefInput<$PrismaModel>
    not?: NestedEnumOrderChannelFilter<$PrismaModel> | $Enums.OrderChannel
  }

  export type EnumOrderPriorityFilter<$PrismaModel = never> = {
    equals?: $Enums.OrderPriority | EnumOrderPriorityFieldRefInput<$PrismaModel>
    in?: $Enums.OrderPriority[] | ListEnumOrderPriorityFieldRefInput<$PrismaModel>
    notIn?: $Enums.OrderPriority[] | ListEnumOrderPriorityFieldRefInput<$PrismaModel>
    not?: NestedEnumOrderPriorityFilter<$PrismaModel> | $Enums.OrderPriority
  }

  export type EnumOrderModeFilter<$PrismaModel = never> = {
    equals?: $Enums.OrderMode | EnumOrderModeFieldRefInput<$PrismaModel>
    in?: $Enums.OrderMode[] | ListEnumOrderModeFieldRefInput<$PrismaModel>
    notIn?: $Enums.OrderMode[] | ListEnumOrderModeFieldRefInput<$PrismaModel>
    not?: NestedEnumOrderModeFilter<$PrismaModel> | $Enums.OrderMode
  }

  export type CustomerScalarRelationFilter = {
    is?: CustomerWhereInput
    isNot?: CustomerWhereInput
  }

  export type UserScalarRelationFilter = {
    is?: UserWhereInput
    isNot?: UserWhereInput
  }

  export type OrderCountOrderByAggregateInput = {
    id?: SortOrder
    number?: SortOrder
    customerId?: SortOrder
    channel?: SortOrder
    priority?: SortOrder
    mode?: SortOrder
    createdById?: SortOrder
    createdAt?: SortOrder
  }

  export type OrderAvgOrderByAggregateInput = {
    number?: SortOrder
  }

  export type OrderMaxOrderByAggregateInput = {
    id?: SortOrder
    number?: SortOrder
    customerId?: SortOrder
    channel?: SortOrder
    priority?: SortOrder
    mode?: SortOrder
    createdById?: SortOrder
    createdAt?: SortOrder
  }

  export type OrderMinOrderByAggregateInput = {
    id?: SortOrder
    number?: SortOrder
    customerId?: SortOrder
    channel?: SortOrder
    priority?: SortOrder
    mode?: SortOrder
    createdById?: SortOrder
    createdAt?: SortOrder
  }

  export type OrderSumOrderByAggregateInput = {
    number?: SortOrder
  }

  export type IntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }

  export type EnumOrderChannelWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.OrderChannel | EnumOrderChannelFieldRefInput<$PrismaModel>
    in?: $Enums.OrderChannel[] | ListEnumOrderChannelFieldRefInput<$PrismaModel>
    notIn?: $Enums.OrderChannel[] | ListEnumOrderChannelFieldRefInput<$PrismaModel>
    not?: NestedEnumOrderChannelWithAggregatesFilter<$PrismaModel> | $Enums.OrderChannel
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumOrderChannelFilter<$PrismaModel>
    _max?: NestedEnumOrderChannelFilter<$PrismaModel>
  }

  export type EnumOrderPriorityWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.OrderPriority | EnumOrderPriorityFieldRefInput<$PrismaModel>
    in?: $Enums.OrderPriority[] | ListEnumOrderPriorityFieldRefInput<$PrismaModel>
    notIn?: $Enums.OrderPriority[] | ListEnumOrderPriorityFieldRefInput<$PrismaModel>
    not?: NestedEnumOrderPriorityWithAggregatesFilter<$PrismaModel> | $Enums.OrderPriority
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumOrderPriorityFilter<$PrismaModel>
    _max?: NestedEnumOrderPriorityFilter<$PrismaModel>
  }

  export type EnumOrderModeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.OrderMode | EnumOrderModeFieldRefInput<$PrismaModel>
    in?: $Enums.OrderMode[] | ListEnumOrderModeFieldRefInput<$PrismaModel>
    notIn?: $Enums.OrderMode[] | ListEnumOrderModeFieldRefInput<$PrismaModel>
    not?: NestedEnumOrderModeWithAggregatesFilter<$PrismaModel> | $Enums.OrderMode
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumOrderModeFilter<$PrismaModel>
    _max?: NestedEnumOrderModeFilter<$PrismaModel>
  }

  export type StringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type EnumWorkItemStateFilter<$PrismaModel = never> = {
    equals?: $Enums.WorkItemState | EnumWorkItemStateFieldRefInput<$PrismaModel>
    in?: $Enums.WorkItemState[] | ListEnumWorkItemStateFieldRefInput<$PrismaModel>
    notIn?: $Enums.WorkItemState[] | ListEnumWorkItemStateFieldRefInput<$PrismaModel>
    not?: NestedEnumWorkItemStateFilter<$PrismaModel> | $Enums.WorkItemState
  }

  export type OrderScalarRelationFilter = {
    is?: OrderWhereInput
    isNot?: OrderWhereInput
  }

  export type DepartmentNullableScalarRelationFilter = {
    is?: DepartmentWhereInput | null
    isNot?: DepartmentWhereInput | null
  }

  export type UserNullableScalarRelationFilter = {
    is?: UserWhereInput | null
    isNot?: UserWhereInput | null
  }

  export type WorkItemTransitionListRelationFilter = {
    every?: WorkItemTransitionWhereInput
    some?: WorkItemTransitionWhereInput
    none?: WorkItemTransitionWhereInput
  }

  export type PhaseTimingListRelationFilter = {
    every?: PhaseTimingWhereInput
    some?: PhaseTimingWhereInput
    none?: PhaseTimingWhereInput
  }

  export type SortOrderInput = {
    sort: SortOrder
    nulls?: NullsOrder
  }

  export type WorkItemTransitionOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type PhaseTimingOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type WorkItemCountOrderByAggregateInput = {
    id?: SortOrder
    orderId?: SortOrder
    productTypeId?: SortOrder
    departmentId?: SortOrder
    state?: SortOrder
    requiresDesign?: SortOrder
    requiresReview?: SortOrder
    assigneeId?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type WorkItemMaxOrderByAggregateInput = {
    id?: SortOrder
    orderId?: SortOrder
    productTypeId?: SortOrder
    departmentId?: SortOrder
    state?: SortOrder
    requiresDesign?: SortOrder
    requiresReview?: SortOrder
    assigneeId?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type WorkItemMinOrderByAggregateInput = {
    id?: SortOrder
    orderId?: SortOrder
    productTypeId?: SortOrder
    departmentId?: SortOrder
    state?: SortOrder
    requiresDesign?: SortOrder
    requiresReview?: SortOrder
    assigneeId?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type StringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type EnumWorkItemStateWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.WorkItemState | EnumWorkItemStateFieldRefInput<$PrismaModel>
    in?: $Enums.WorkItemState[] | ListEnumWorkItemStateFieldRefInput<$PrismaModel>
    notIn?: $Enums.WorkItemState[] | ListEnumWorkItemStateFieldRefInput<$PrismaModel>
    not?: NestedEnumWorkItemStateWithAggregatesFilter<$PrismaModel> | $Enums.WorkItemState
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumWorkItemStateFilter<$PrismaModel>
    _max?: NestedEnumWorkItemStateFilter<$PrismaModel>
  }

  export type EnumRejectionCategoryNullableFilter<$PrismaModel = never> = {
    equals?: $Enums.RejectionCategory | EnumRejectionCategoryFieldRefInput<$PrismaModel> | null
    in?: $Enums.RejectionCategory[] | ListEnumRejectionCategoryFieldRefInput<$PrismaModel> | null
    notIn?: $Enums.RejectionCategory[] | ListEnumRejectionCategoryFieldRefInput<$PrismaModel> | null
    not?: NestedEnumRejectionCategoryNullableFilter<$PrismaModel> | $Enums.RejectionCategory | null
  }
  export type JsonNullableFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<JsonNullableFilterBase<$PrismaModel>>, Exclude<keyof Required<JsonNullableFilterBase<$PrismaModel>>, 'path'>>,
        Required<JsonNullableFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<JsonNullableFilterBase<$PrismaModel>>, 'path'>>

  export type JsonNullableFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
  }

  export type WorkItemScalarRelationFilter = {
    is?: WorkItemWhereInput
    isNot?: WorkItemWhereInput
  }

  export type WorkItemTransitionCountOrderByAggregateInput = {
    id?: SortOrder
    workItemId?: SortOrder
    from?: SortOrder
    to?: SortOrder
    actorId?: SortOrder
    at?: SortOrder
    reason?: SortOrder
    rejectionCategory?: SortOrder
    meta?: SortOrder
  }

  export type WorkItemTransitionMaxOrderByAggregateInput = {
    id?: SortOrder
    workItemId?: SortOrder
    from?: SortOrder
    to?: SortOrder
    actorId?: SortOrder
    at?: SortOrder
    reason?: SortOrder
    rejectionCategory?: SortOrder
  }

  export type WorkItemTransitionMinOrderByAggregateInput = {
    id?: SortOrder
    workItemId?: SortOrder
    from?: SortOrder
    to?: SortOrder
    actorId?: SortOrder
    at?: SortOrder
    reason?: SortOrder
    rejectionCategory?: SortOrder
  }

  export type EnumRejectionCategoryNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.RejectionCategory | EnumRejectionCategoryFieldRefInput<$PrismaModel> | null
    in?: $Enums.RejectionCategory[] | ListEnumRejectionCategoryFieldRefInput<$PrismaModel> | null
    notIn?: $Enums.RejectionCategory[] | ListEnumRejectionCategoryFieldRefInput<$PrismaModel> | null
    not?: NestedEnumRejectionCategoryNullableWithAggregatesFilter<$PrismaModel> | $Enums.RejectionCategory | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedEnumRejectionCategoryNullableFilter<$PrismaModel>
    _max?: NestedEnumRejectionCategoryNullableFilter<$PrismaModel>
  }
  export type JsonNullableWithAggregatesFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>, Exclude<keyof Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>, 'path'>>,
        Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>, 'path'>>

  export type JsonNullableWithAggregatesFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedJsonNullableFilter<$PrismaModel>
    _max?: NestedJsonNullableFilter<$PrismaModel>
  }

  export type EnumPhaseTimingKindFilter<$PrismaModel = never> = {
    equals?: $Enums.PhaseTimingKind | EnumPhaseTimingKindFieldRefInput<$PrismaModel>
    in?: $Enums.PhaseTimingKind[] | ListEnumPhaseTimingKindFieldRefInput<$PrismaModel>
    notIn?: $Enums.PhaseTimingKind[] | ListEnumPhaseTimingKindFieldRefInput<$PrismaModel>
    not?: NestedEnumPhaseTimingKindFilter<$PrismaModel> | $Enums.PhaseTimingKind
  }

  export type DateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null
  }

  export type PhaseTimingCountOrderByAggregateInput = {
    id?: SortOrder
    workItemId?: SortOrder
    phase?: SortOrder
    userId?: SortOrder
    kind?: SortOrder
    startedAt?: SortOrder
    endedAt?: SortOrder
  }

  export type PhaseTimingMaxOrderByAggregateInput = {
    id?: SortOrder
    workItemId?: SortOrder
    phase?: SortOrder
    userId?: SortOrder
    kind?: SortOrder
    startedAt?: SortOrder
    endedAt?: SortOrder
  }

  export type PhaseTimingMinOrderByAggregateInput = {
    id?: SortOrder
    workItemId?: SortOrder
    phase?: SortOrder
    userId?: SortOrder
    kind?: SortOrder
    startedAt?: SortOrder
    endedAt?: SortOrder
  }

  export type EnumPhaseTimingKindWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.PhaseTimingKind | EnumPhaseTimingKindFieldRefInput<$PrismaModel>
    in?: $Enums.PhaseTimingKind[] | ListEnumPhaseTimingKindFieldRefInput<$PrismaModel>
    notIn?: $Enums.PhaseTimingKind[] | ListEnumPhaseTimingKindFieldRefInput<$PrismaModel>
    not?: NestedEnumPhaseTimingKindWithAggregatesFilter<$PrismaModel> | $Enums.PhaseTimingKind
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumPhaseTimingKindFilter<$PrismaModel>
    _max?: NestedEnumPhaseTimingKindFilter<$PrismaModel>
  }

  export type DateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedDateTimeNullableFilter<$PrismaModel>
    _max?: NestedDateTimeNullableFilter<$PrismaModel>
  }

  export type StringNullableListFilter<$PrismaModel = never> = {
    equals?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    has?: string | StringFieldRefInput<$PrismaModel> | null
    hasEvery?: string[] | ListStringFieldRefInput<$PrismaModel>
    hasSome?: string[] | ListStringFieldRefInput<$PrismaModel>
    isEmpty?: boolean
  }

  export type NotificationEventCountOrderByAggregateInput = {
    id?: SortOrder
    type?: SortOrder
    entityType?: SortOrder
    entityId?: SortOrder
    recipientUserIds?: SortOrder
    recipientRoles?: SortOrder
    recipientDepartmentIds?: SortOrder
    payload?: SortOrder
    createdAt?: SortOrder
    deliveredAt?: SortOrder
    deliveryStatus?: SortOrder
  }

  export type NotificationEventMaxOrderByAggregateInput = {
    id?: SortOrder
    type?: SortOrder
    entityType?: SortOrder
    entityId?: SortOrder
    createdAt?: SortOrder
    deliveredAt?: SortOrder
    deliveryStatus?: SortOrder
  }

  export type NotificationEventMinOrderByAggregateInput = {
    id?: SortOrder
    type?: SortOrder
    entityType?: SortOrder
    entityId?: SortOrder
    createdAt?: SortOrder
    deliveredAt?: SortOrder
    deliveryStatus?: SortOrder
  }

  export type SessionListRelationFilter = {
    every?: SessionWhereInput
    some?: SessionWhereInput
    none?: SessionWhereInput
  }

  export type AccountListRelationFilter = {
    every?: AccountWhereInput
    some?: AccountWhereInput
    none?: AccountWhereInput
  }

  export type SessionOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type AccountOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type UserCountOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    email?: SortOrder
    emailVerified?: SortOrder
    image?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type UserMaxOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    email?: SortOrder
    emailVerified?: SortOrder
    image?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type UserMinOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    email?: SortOrder
    emailVerified?: SortOrder
    image?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type SessionCountOrderByAggregateInput = {
    id?: SortOrder
    expiresAt?: SortOrder
    token?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    ipAddress?: SortOrder
    userAgent?: SortOrder
    userId?: SortOrder
  }

  export type SessionMaxOrderByAggregateInput = {
    id?: SortOrder
    expiresAt?: SortOrder
    token?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    ipAddress?: SortOrder
    userAgent?: SortOrder
    userId?: SortOrder
  }

  export type SessionMinOrderByAggregateInput = {
    id?: SortOrder
    expiresAt?: SortOrder
    token?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    ipAddress?: SortOrder
    userAgent?: SortOrder
    userId?: SortOrder
  }

  export type AccountCountOrderByAggregateInput = {
    id?: SortOrder
    accountId?: SortOrder
    providerId?: SortOrder
    userId?: SortOrder
    accessToken?: SortOrder
    refreshToken?: SortOrder
    idToken?: SortOrder
    accessTokenExpiresAt?: SortOrder
    refreshTokenExpiresAt?: SortOrder
    scope?: SortOrder
    password?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type AccountMaxOrderByAggregateInput = {
    id?: SortOrder
    accountId?: SortOrder
    providerId?: SortOrder
    userId?: SortOrder
    accessToken?: SortOrder
    refreshToken?: SortOrder
    idToken?: SortOrder
    accessTokenExpiresAt?: SortOrder
    refreshTokenExpiresAt?: SortOrder
    scope?: SortOrder
    password?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type AccountMinOrderByAggregateInput = {
    id?: SortOrder
    accountId?: SortOrder
    providerId?: SortOrder
    userId?: SortOrder
    accessToken?: SortOrder
    refreshToken?: SortOrder
    idToken?: SortOrder
    accessTokenExpiresAt?: SortOrder
    refreshTokenExpiresAt?: SortOrder
    scope?: SortOrder
    password?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type VerificationCountOrderByAggregateInput = {
    id?: SortOrder
    identifier?: SortOrder
    value?: SortOrder
    expiresAt?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type VerificationMaxOrderByAggregateInput = {
    id?: SortOrder
    identifier?: SortOrder
    value?: SortOrder
    expiresAt?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type VerificationMinOrderByAggregateInput = {
    id?: SortOrder
    identifier?: SortOrder
    value?: SortOrder
    expiresAt?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type WorkItemCreateNestedManyWithoutDepartmentInput = {
    create?: XOR<WorkItemCreateWithoutDepartmentInput, WorkItemUncheckedCreateWithoutDepartmentInput> | WorkItemCreateWithoutDepartmentInput[] | WorkItemUncheckedCreateWithoutDepartmentInput[]
    connectOrCreate?: WorkItemCreateOrConnectWithoutDepartmentInput | WorkItemCreateOrConnectWithoutDepartmentInput[]
    createMany?: WorkItemCreateManyDepartmentInputEnvelope
    connect?: WorkItemWhereUniqueInput | WorkItemWhereUniqueInput[]
  }

  export type WorkItemUncheckedCreateNestedManyWithoutDepartmentInput = {
    create?: XOR<WorkItemCreateWithoutDepartmentInput, WorkItemUncheckedCreateWithoutDepartmentInput> | WorkItemCreateWithoutDepartmentInput[] | WorkItemUncheckedCreateWithoutDepartmentInput[]
    connectOrCreate?: WorkItemCreateOrConnectWithoutDepartmentInput | WorkItemCreateOrConnectWithoutDepartmentInput[]
    createMany?: WorkItemCreateManyDepartmentInputEnvelope
    connect?: WorkItemWhereUniqueInput | WorkItemWhereUniqueInput[]
  }

  export type StringFieldUpdateOperationsInput = {
    set?: string
  }

  export type BoolFieldUpdateOperationsInput = {
    set?: boolean
  }

  export type DateTimeFieldUpdateOperationsInput = {
    set?: Date | string
  }

  export type WorkItemUpdateManyWithoutDepartmentNestedInput = {
    create?: XOR<WorkItemCreateWithoutDepartmentInput, WorkItemUncheckedCreateWithoutDepartmentInput> | WorkItemCreateWithoutDepartmentInput[] | WorkItemUncheckedCreateWithoutDepartmentInput[]
    connectOrCreate?: WorkItemCreateOrConnectWithoutDepartmentInput | WorkItemCreateOrConnectWithoutDepartmentInput[]
    upsert?: WorkItemUpsertWithWhereUniqueWithoutDepartmentInput | WorkItemUpsertWithWhereUniqueWithoutDepartmentInput[]
    createMany?: WorkItemCreateManyDepartmentInputEnvelope
    set?: WorkItemWhereUniqueInput | WorkItemWhereUniqueInput[]
    disconnect?: WorkItemWhereUniqueInput | WorkItemWhereUniqueInput[]
    delete?: WorkItemWhereUniqueInput | WorkItemWhereUniqueInput[]
    connect?: WorkItemWhereUniqueInput | WorkItemWhereUniqueInput[]
    update?: WorkItemUpdateWithWhereUniqueWithoutDepartmentInput | WorkItemUpdateWithWhereUniqueWithoutDepartmentInput[]
    updateMany?: WorkItemUpdateManyWithWhereWithoutDepartmentInput | WorkItemUpdateManyWithWhereWithoutDepartmentInput[]
    deleteMany?: WorkItemScalarWhereInput | WorkItemScalarWhereInput[]
  }

  export type WorkItemUncheckedUpdateManyWithoutDepartmentNestedInput = {
    create?: XOR<WorkItemCreateWithoutDepartmentInput, WorkItemUncheckedCreateWithoutDepartmentInput> | WorkItemCreateWithoutDepartmentInput[] | WorkItemUncheckedCreateWithoutDepartmentInput[]
    connectOrCreate?: WorkItemCreateOrConnectWithoutDepartmentInput | WorkItemCreateOrConnectWithoutDepartmentInput[]
    upsert?: WorkItemUpsertWithWhereUniqueWithoutDepartmentInput | WorkItemUpsertWithWhereUniqueWithoutDepartmentInput[]
    createMany?: WorkItemCreateManyDepartmentInputEnvelope
    set?: WorkItemWhereUniqueInput | WorkItemWhereUniqueInput[]
    disconnect?: WorkItemWhereUniqueInput | WorkItemWhereUniqueInput[]
    delete?: WorkItemWhereUniqueInput | WorkItemWhereUniqueInput[]
    connect?: WorkItemWhereUniqueInput | WorkItemWhereUniqueInput[]
    update?: WorkItemUpdateWithWhereUniqueWithoutDepartmentInput | WorkItemUpdateWithWhereUniqueWithoutDepartmentInput[]
    updateMany?: WorkItemUpdateManyWithWhereWithoutDepartmentInput | WorkItemUpdateManyWithWhereWithoutDepartmentInput[]
    deleteMany?: WorkItemScalarWhereInput | WorkItemScalarWhereInput[]
  }

  export type OrderCreateNestedManyWithoutCustomerInput = {
    create?: XOR<OrderCreateWithoutCustomerInput, OrderUncheckedCreateWithoutCustomerInput> | OrderCreateWithoutCustomerInput[] | OrderUncheckedCreateWithoutCustomerInput[]
    connectOrCreate?: OrderCreateOrConnectWithoutCustomerInput | OrderCreateOrConnectWithoutCustomerInput[]
    createMany?: OrderCreateManyCustomerInputEnvelope
    connect?: OrderWhereUniqueInput | OrderWhereUniqueInput[]
  }

  export type OrderUncheckedCreateNestedManyWithoutCustomerInput = {
    create?: XOR<OrderCreateWithoutCustomerInput, OrderUncheckedCreateWithoutCustomerInput> | OrderCreateWithoutCustomerInput[] | OrderUncheckedCreateWithoutCustomerInput[]
    connectOrCreate?: OrderCreateOrConnectWithoutCustomerInput | OrderCreateOrConnectWithoutCustomerInput[]
    createMany?: OrderCreateManyCustomerInputEnvelope
    connect?: OrderWhereUniqueInput | OrderWhereUniqueInput[]
  }

  export type OrderUpdateManyWithoutCustomerNestedInput = {
    create?: XOR<OrderCreateWithoutCustomerInput, OrderUncheckedCreateWithoutCustomerInput> | OrderCreateWithoutCustomerInput[] | OrderUncheckedCreateWithoutCustomerInput[]
    connectOrCreate?: OrderCreateOrConnectWithoutCustomerInput | OrderCreateOrConnectWithoutCustomerInput[]
    upsert?: OrderUpsertWithWhereUniqueWithoutCustomerInput | OrderUpsertWithWhereUniqueWithoutCustomerInput[]
    createMany?: OrderCreateManyCustomerInputEnvelope
    set?: OrderWhereUniqueInput | OrderWhereUniqueInput[]
    disconnect?: OrderWhereUniqueInput | OrderWhereUniqueInput[]
    delete?: OrderWhereUniqueInput | OrderWhereUniqueInput[]
    connect?: OrderWhereUniqueInput | OrderWhereUniqueInput[]
    update?: OrderUpdateWithWhereUniqueWithoutCustomerInput | OrderUpdateWithWhereUniqueWithoutCustomerInput[]
    updateMany?: OrderUpdateManyWithWhereWithoutCustomerInput | OrderUpdateManyWithWhereWithoutCustomerInput[]
    deleteMany?: OrderScalarWhereInput | OrderScalarWhereInput[]
  }

  export type OrderUncheckedUpdateManyWithoutCustomerNestedInput = {
    create?: XOR<OrderCreateWithoutCustomerInput, OrderUncheckedCreateWithoutCustomerInput> | OrderCreateWithoutCustomerInput[] | OrderUncheckedCreateWithoutCustomerInput[]
    connectOrCreate?: OrderCreateOrConnectWithoutCustomerInput | OrderCreateOrConnectWithoutCustomerInput[]
    upsert?: OrderUpsertWithWhereUniqueWithoutCustomerInput | OrderUpsertWithWhereUniqueWithoutCustomerInput[]
    createMany?: OrderCreateManyCustomerInputEnvelope
    set?: OrderWhereUniqueInput | OrderWhereUniqueInput[]
    disconnect?: OrderWhereUniqueInput | OrderWhereUniqueInput[]
    delete?: OrderWhereUniqueInput | OrderWhereUniqueInput[]
    connect?: OrderWhereUniqueInput | OrderWhereUniqueInput[]
    update?: OrderUpdateWithWhereUniqueWithoutCustomerInput | OrderUpdateWithWhereUniqueWithoutCustomerInput[]
    updateMany?: OrderUpdateManyWithWhereWithoutCustomerInput | OrderUpdateManyWithWhereWithoutCustomerInput[]
    deleteMany?: OrderScalarWhereInput | OrderScalarWhereInput[]
  }

  export type CustomerCreateNestedOneWithoutOrdersInput = {
    create?: XOR<CustomerCreateWithoutOrdersInput, CustomerUncheckedCreateWithoutOrdersInput>
    connectOrCreate?: CustomerCreateOrConnectWithoutOrdersInput
    connect?: CustomerWhereUniqueInput
  }

  export type UserCreateNestedOneWithoutCreatedOrdersInput = {
    create?: XOR<UserCreateWithoutCreatedOrdersInput, UserUncheckedCreateWithoutCreatedOrdersInput>
    connectOrCreate?: UserCreateOrConnectWithoutCreatedOrdersInput
    connect?: UserWhereUniqueInput
  }

  export type WorkItemCreateNestedManyWithoutOrderInput = {
    create?: XOR<WorkItemCreateWithoutOrderInput, WorkItemUncheckedCreateWithoutOrderInput> | WorkItemCreateWithoutOrderInput[] | WorkItemUncheckedCreateWithoutOrderInput[]
    connectOrCreate?: WorkItemCreateOrConnectWithoutOrderInput | WorkItemCreateOrConnectWithoutOrderInput[]
    createMany?: WorkItemCreateManyOrderInputEnvelope
    connect?: WorkItemWhereUniqueInput | WorkItemWhereUniqueInput[]
  }

  export type WorkItemUncheckedCreateNestedManyWithoutOrderInput = {
    create?: XOR<WorkItemCreateWithoutOrderInput, WorkItemUncheckedCreateWithoutOrderInput> | WorkItemCreateWithoutOrderInput[] | WorkItemUncheckedCreateWithoutOrderInput[]
    connectOrCreate?: WorkItemCreateOrConnectWithoutOrderInput | WorkItemCreateOrConnectWithoutOrderInput[]
    createMany?: WorkItemCreateManyOrderInputEnvelope
    connect?: WorkItemWhereUniqueInput | WorkItemWhereUniqueInput[]
  }

  export type IntFieldUpdateOperationsInput = {
    set?: number
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type EnumOrderChannelFieldUpdateOperationsInput = {
    set?: $Enums.OrderChannel
  }

  export type EnumOrderPriorityFieldUpdateOperationsInput = {
    set?: $Enums.OrderPriority
  }

  export type EnumOrderModeFieldUpdateOperationsInput = {
    set?: $Enums.OrderMode
  }

  export type CustomerUpdateOneRequiredWithoutOrdersNestedInput = {
    create?: XOR<CustomerCreateWithoutOrdersInput, CustomerUncheckedCreateWithoutOrdersInput>
    connectOrCreate?: CustomerCreateOrConnectWithoutOrdersInput
    upsert?: CustomerUpsertWithoutOrdersInput
    connect?: CustomerWhereUniqueInput
    update?: XOR<XOR<CustomerUpdateToOneWithWhereWithoutOrdersInput, CustomerUpdateWithoutOrdersInput>, CustomerUncheckedUpdateWithoutOrdersInput>
  }

  export type UserUpdateOneRequiredWithoutCreatedOrdersNestedInput = {
    create?: XOR<UserCreateWithoutCreatedOrdersInput, UserUncheckedCreateWithoutCreatedOrdersInput>
    connectOrCreate?: UserCreateOrConnectWithoutCreatedOrdersInput
    upsert?: UserUpsertWithoutCreatedOrdersInput
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutCreatedOrdersInput, UserUpdateWithoutCreatedOrdersInput>, UserUncheckedUpdateWithoutCreatedOrdersInput>
  }

  export type WorkItemUpdateManyWithoutOrderNestedInput = {
    create?: XOR<WorkItemCreateWithoutOrderInput, WorkItemUncheckedCreateWithoutOrderInput> | WorkItemCreateWithoutOrderInput[] | WorkItemUncheckedCreateWithoutOrderInput[]
    connectOrCreate?: WorkItemCreateOrConnectWithoutOrderInput | WorkItemCreateOrConnectWithoutOrderInput[]
    upsert?: WorkItemUpsertWithWhereUniqueWithoutOrderInput | WorkItemUpsertWithWhereUniqueWithoutOrderInput[]
    createMany?: WorkItemCreateManyOrderInputEnvelope
    set?: WorkItemWhereUniqueInput | WorkItemWhereUniqueInput[]
    disconnect?: WorkItemWhereUniqueInput | WorkItemWhereUniqueInput[]
    delete?: WorkItemWhereUniqueInput | WorkItemWhereUniqueInput[]
    connect?: WorkItemWhereUniqueInput | WorkItemWhereUniqueInput[]
    update?: WorkItemUpdateWithWhereUniqueWithoutOrderInput | WorkItemUpdateWithWhereUniqueWithoutOrderInput[]
    updateMany?: WorkItemUpdateManyWithWhereWithoutOrderInput | WorkItemUpdateManyWithWhereWithoutOrderInput[]
    deleteMany?: WorkItemScalarWhereInput | WorkItemScalarWhereInput[]
  }

  export type WorkItemUncheckedUpdateManyWithoutOrderNestedInput = {
    create?: XOR<WorkItemCreateWithoutOrderInput, WorkItemUncheckedCreateWithoutOrderInput> | WorkItemCreateWithoutOrderInput[] | WorkItemUncheckedCreateWithoutOrderInput[]
    connectOrCreate?: WorkItemCreateOrConnectWithoutOrderInput | WorkItemCreateOrConnectWithoutOrderInput[]
    upsert?: WorkItemUpsertWithWhereUniqueWithoutOrderInput | WorkItemUpsertWithWhereUniqueWithoutOrderInput[]
    createMany?: WorkItemCreateManyOrderInputEnvelope
    set?: WorkItemWhereUniqueInput | WorkItemWhereUniqueInput[]
    disconnect?: WorkItemWhereUniqueInput | WorkItemWhereUniqueInput[]
    delete?: WorkItemWhereUniqueInput | WorkItemWhereUniqueInput[]
    connect?: WorkItemWhereUniqueInput | WorkItemWhereUniqueInput[]
    update?: WorkItemUpdateWithWhereUniqueWithoutOrderInput | WorkItemUpdateWithWhereUniqueWithoutOrderInput[]
    updateMany?: WorkItemUpdateManyWithWhereWithoutOrderInput | WorkItemUpdateManyWithWhereWithoutOrderInput[]
    deleteMany?: WorkItemScalarWhereInput | WorkItemScalarWhereInput[]
  }

  export type OrderCreateNestedOneWithoutWorkItemsInput = {
    create?: XOR<OrderCreateWithoutWorkItemsInput, OrderUncheckedCreateWithoutWorkItemsInput>
    connectOrCreate?: OrderCreateOrConnectWithoutWorkItemsInput
    connect?: OrderWhereUniqueInput
  }

  export type DepartmentCreateNestedOneWithoutWorkItemsInput = {
    create?: XOR<DepartmentCreateWithoutWorkItemsInput, DepartmentUncheckedCreateWithoutWorkItemsInput>
    connectOrCreate?: DepartmentCreateOrConnectWithoutWorkItemsInput
    connect?: DepartmentWhereUniqueInput
  }

  export type UserCreateNestedOneWithoutAssignedWorkItemsInput = {
    create?: XOR<UserCreateWithoutAssignedWorkItemsInput, UserUncheckedCreateWithoutAssignedWorkItemsInput>
    connectOrCreate?: UserCreateOrConnectWithoutAssignedWorkItemsInput
    connect?: UserWhereUniqueInput
  }

  export type WorkItemTransitionCreateNestedManyWithoutWorkItemInput = {
    create?: XOR<WorkItemTransitionCreateWithoutWorkItemInput, WorkItemTransitionUncheckedCreateWithoutWorkItemInput> | WorkItemTransitionCreateWithoutWorkItemInput[] | WorkItemTransitionUncheckedCreateWithoutWorkItemInput[]
    connectOrCreate?: WorkItemTransitionCreateOrConnectWithoutWorkItemInput | WorkItemTransitionCreateOrConnectWithoutWorkItemInput[]
    createMany?: WorkItemTransitionCreateManyWorkItemInputEnvelope
    connect?: WorkItemTransitionWhereUniqueInput | WorkItemTransitionWhereUniqueInput[]
  }

  export type PhaseTimingCreateNestedManyWithoutWorkItemInput = {
    create?: XOR<PhaseTimingCreateWithoutWorkItemInput, PhaseTimingUncheckedCreateWithoutWorkItemInput> | PhaseTimingCreateWithoutWorkItemInput[] | PhaseTimingUncheckedCreateWithoutWorkItemInput[]
    connectOrCreate?: PhaseTimingCreateOrConnectWithoutWorkItemInput | PhaseTimingCreateOrConnectWithoutWorkItemInput[]
    createMany?: PhaseTimingCreateManyWorkItemInputEnvelope
    connect?: PhaseTimingWhereUniqueInput | PhaseTimingWhereUniqueInput[]
  }

  export type WorkItemTransitionUncheckedCreateNestedManyWithoutWorkItemInput = {
    create?: XOR<WorkItemTransitionCreateWithoutWorkItemInput, WorkItemTransitionUncheckedCreateWithoutWorkItemInput> | WorkItemTransitionCreateWithoutWorkItemInput[] | WorkItemTransitionUncheckedCreateWithoutWorkItemInput[]
    connectOrCreate?: WorkItemTransitionCreateOrConnectWithoutWorkItemInput | WorkItemTransitionCreateOrConnectWithoutWorkItemInput[]
    createMany?: WorkItemTransitionCreateManyWorkItemInputEnvelope
    connect?: WorkItemTransitionWhereUniqueInput | WorkItemTransitionWhereUniqueInput[]
  }

  export type PhaseTimingUncheckedCreateNestedManyWithoutWorkItemInput = {
    create?: XOR<PhaseTimingCreateWithoutWorkItemInput, PhaseTimingUncheckedCreateWithoutWorkItemInput> | PhaseTimingCreateWithoutWorkItemInput[] | PhaseTimingUncheckedCreateWithoutWorkItemInput[]
    connectOrCreate?: PhaseTimingCreateOrConnectWithoutWorkItemInput | PhaseTimingCreateOrConnectWithoutWorkItemInput[]
    createMany?: PhaseTimingCreateManyWorkItemInputEnvelope
    connect?: PhaseTimingWhereUniqueInput | PhaseTimingWhereUniqueInput[]
  }

  export type NullableStringFieldUpdateOperationsInput = {
    set?: string | null
  }

  export type EnumWorkItemStateFieldUpdateOperationsInput = {
    set?: $Enums.WorkItemState
  }

  export type OrderUpdateOneRequiredWithoutWorkItemsNestedInput = {
    create?: XOR<OrderCreateWithoutWorkItemsInput, OrderUncheckedCreateWithoutWorkItemsInput>
    connectOrCreate?: OrderCreateOrConnectWithoutWorkItemsInput
    upsert?: OrderUpsertWithoutWorkItemsInput
    connect?: OrderWhereUniqueInput
    update?: XOR<XOR<OrderUpdateToOneWithWhereWithoutWorkItemsInput, OrderUpdateWithoutWorkItemsInput>, OrderUncheckedUpdateWithoutWorkItemsInput>
  }

  export type DepartmentUpdateOneWithoutWorkItemsNestedInput = {
    create?: XOR<DepartmentCreateWithoutWorkItemsInput, DepartmentUncheckedCreateWithoutWorkItemsInput>
    connectOrCreate?: DepartmentCreateOrConnectWithoutWorkItemsInput
    upsert?: DepartmentUpsertWithoutWorkItemsInput
    disconnect?: DepartmentWhereInput | boolean
    delete?: DepartmentWhereInput | boolean
    connect?: DepartmentWhereUniqueInput
    update?: XOR<XOR<DepartmentUpdateToOneWithWhereWithoutWorkItemsInput, DepartmentUpdateWithoutWorkItemsInput>, DepartmentUncheckedUpdateWithoutWorkItemsInput>
  }

  export type UserUpdateOneWithoutAssignedWorkItemsNestedInput = {
    create?: XOR<UserCreateWithoutAssignedWorkItemsInput, UserUncheckedCreateWithoutAssignedWorkItemsInput>
    connectOrCreate?: UserCreateOrConnectWithoutAssignedWorkItemsInput
    upsert?: UserUpsertWithoutAssignedWorkItemsInput
    disconnect?: UserWhereInput | boolean
    delete?: UserWhereInput | boolean
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutAssignedWorkItemsInput, UserUpdateWithoutAssignedWorkItemsInput>, UserUncheckedUpdateWithoutAssignedWorkItemsInput>
  }

  export type WorkItemTransitionUpdateManyWithoutWorkItemNestedInput = {
    create?: XOR<WorkItemTransitionCreateWithoutWorkItemInput, WorkItemTransitionUncheckedCreateWithoutWorkItemInput> | WorkItemTransitionCreateWithoutWorkItemInput[] | WorkItemTransitionUncheckedCreateWithoutWorkItemInput[]
    connectOrCreate?: WorkItemTransitionCreateOrConnectWithoutWorkItemInput | WorkItemTransitionCreateOrConnectWithoutWorkItemInput[]
    upsert?: WorkItemTransitionUpsertWithWhereUniqueWithoutWorkItemInput | WorkItemTransitionUpsertWithWhereUniqueWithoutWorkItemInput[]
    createMany?: WorkItemTransitionCreateManyWorkItemInputEnvelope
    set?: WorkItemTransitionWhereUniqueInput | WorkItemTransitionWhereUniqueInput[]
    disconnect?: WorkItemTransitionWhereUniqueInput | WorkItemTransitionWhereUniqueInput[]
    delete?: WorkItemTransitionWhereUniqueInput | WorkItemTransitionWhereUniqueInput[]
    connect?: WorkItemTransitionWhereUniqueInput | WorkItemTransitionWhereUniqueInput[]
    update?: WorkItemTransitionUpdateWithWhereUniqueWithoutWorkItemInput | WorkItemTransitionUpdateWithWhereUniqueWithoutWorkItemInput[]
    updateMany?: WorkItemTransitionUpdateManyWithWhereWithoutWorkItemInput | WorkItemTransitionUpdateManyWithWhereWithoutWorkItemInput[]
    deleteMany?: WorkItemTransitionScalarWhereInput | WorkItemTransitionScalarWhereInput[]
  }

  export type PhaseTimingUpdateManyWithoutWorkItemNestedInput = {
    create?: XOR<PhaseTimingCreateWithoutWorkItemInput, PhaseTimingUncheckedCreateWithoutWorkItemInput> | PhaseTimingCreateWithoutWorkItemInput[] | PhaseTimingUncheckedCreateWithoutWorkItemInput[]
    connectOrCreate?: PhaseTimingCreateOrConnectWithoutWorkItemInput | PhaseTimingCreateOrConnectWithoutWorkItemInput[]
    upsert?: PhaseTimingUpsertWithWhereUniqueWithoutWorkItemInput | PhaseTimingUpsertWithWhereUniqueWithoutWorkItemInput[]
    createMany?: PhaseTimingCreateManyWorkItemInputEnvelope
    set?: PhaseTimingWhereUniqueInput | PhaseTimingWhereUniqueInput[]
    disconnect?: PhaseTimingWhereUniqueInput | PhaseTimingWhereUniqueInput[]
    delete?: PhaseTimingWhereUniqueInput | PhaseTimingWhereUniqueInput[]
    connect?: PhaseTimingWhereUniqueInput | PhaseTimingWhereUniqueInput[]
    update?: PhaseTimingUpdateWithWhereUniqueWithoutWorkItemInput | PhaseTimingUpdateWithWhereUniqueWithoutWorkItemInput[]
    updateMany?: PhaseTimingUpdateManyWithWhereWithoutWorkItemInput | PhaseTimingUpdateManyWithWhereWithoutWorkItemInput[]
    deleteMany?: PhaseTimingScalarWhereInput | PhaseTimingScalarWhereInput[]
  }

  export type WorkItemTransitionUncheckedUpdateManyWithoutWorkItemNestedInput = {
    create?: XOR<WorkItemTransitionCreateWithoutWorkItemInput, WorkItemTransitionUncheckedCreateWithoutWorkItemInput> | WorkItemTransitionCreateWithoutWorkItemInput[] | WorkItemTransitionUncheckedCreateWithoutWorkItemInput[]
    connectOrCreate?: WorkItemTransitionCreateOrConnectWithoutWorkItemInput | WorkItemTransitionCreateOrConnectWithoutWorkItemInput[]
    upsert?: WorkItemTransitionUpsertWithWhereUniqueWithoutWorkItemInput | WorkItemTransitionUpsertWithWhereUniqueWithoutWorkItemInput[]
    createMany?: WorkItemTransitionCreateManyWorkItemInputEnvelope
    set?: WorkItemTransitionWhereUniqueInput | WorkItemTransitionWhereUniqueInput[]
    disconnect?: WorkItemTransitionWhereUniqueInput | WorkItemTransitionWhereUniqueInput[]
    delete?: WorkItemTransitionWhereUniqueInput | WorkItemTransitionWhereUniqueInput[]
    connect?: WorkItemTransitionWhereUniqueInput | WorkItemTransitionWhereUniqueInput[]
    update?: WorkItemTransitionUpdateWithWhereUniqueWithoutWorkItemInput | WorkItemTransitionUpdateWithWhereUniqueWithoutWorkItemInput[]
    updateMany?: WorkItemTransitionUpdateManyWithWhereWithoutWorkItemInput | WorkItemTransitionUpdateManyWithWhereWithoutWorkItemInput[]
    deleteMany?: WorkItemTransitionScalarWhereInput | WorkItemTransitionScalarWhereInput[]
  }

  export type PhaseTimingUncheckedUpdateManyWithoutWorkItemNestedInput = {
    create?: XOR<PhaseTimingCreateWithoutWorkItemInput, PhaseTimingUncheckedCreateWithoutWorkItemInput> | PhaseTimingCreateWithoutWorkItemInput[] | PhaseTimingUncheckedCreateWithoutWorkItemInput[]
    connectOrCreate?: PhaseTimingCreateOrConnectWithoutWorkItemInput | PhaseTimingCreateOrConnectWithoutWorkItemInput[]
    upsert?: PhaseTimingUpsertWithWhereUniqueWithoutWorkItemInput | PhaseTimingUpsertWithWhereUniqueWithoutWorkItemInput[]
    createMany?: PhaseTimingCreateManyWorkItemInputEnvelope
    set?: PhaseTimingWhereUniqueInput | PhaseTimingWhereUniqueInput[]
    disconnect?: PhaseTimingWhereUniqueInput | PhaseTimingWhereUniqueInput[]
    delete?: PhaseTimingWhereUniqueInput | PhaseTimingWhereUniqueInput[]
    connect?: PhaseTimingWhereUniqueInput | PhaseTimingWhereUniqueInput[]
    update?: PhaseTimingUpdateWithWhereUniqueWithoutWorkItemInput | PhaseTimingUpdateWithWhereUniqueWithoutWorkItemInput[]
    updateMany?: PhaseTimingUpdateManyWithWhereWithoutWorkItemInput | PhaseTimingUpdateManyWithWhereWithoutWorkItemInput[]
    deleteMany?: PhaseTimingScalarWhereInput | PhaseTimingScalarWhereInput[]
  }

  export type WorkItemCreateNestedOneWithoutTransitionsInput = {
    create?: XOR<WorkItemCreateWithoutTransitionsInput, WorkItemUncheckedCreateWithoutTransitionsInput>
    connectOrCreate?: WorkItemCreateOrConnectWithoutTransitionsInput
    connect?: WorkItemWhereUniqueInput
  }

  export type UserCreateNestedOneWithoutWorkItemTransitionsInput = {
    create?: XOR<UserCreateWithoutWorkItemTransitionsInput, UserUncheckedCreateWithoutWorkItemTransitionsInput>
    connectOrCreate?: UserCreateOrConnectWithoutWorkItemTransitionsInput
    connect?: UserWhereUniqueInput
  }

  export type NullableEnumRejectionCategoryFieldUpdateOperationsInput = {
    set?: $Enums.RejectionCategory | null
  }

  export type WorkItemUpdateOneRequiredWithoutTransitionsNestedInput = {
    create?: XOR<WorkItemCreateWithoutTransitionsInput, WorkItemUncheckedCreateWithoutTransitionsInput>
    connectOrCreate?: WorkItemCreateOrConnectWithoutTransitionsInput
    upsert?: WorkItemUpsertWithoutTransitionsInput
    connect?: WorkItemWhereUniqueInput
    update?: XOR<XOR<WorkItemUpdateToOneWithWhereWithoutTransitionsInput, WorkItemUpdateWithoutTransitionsInput>, WorkItemUncheckedUpdateWithoutTransitionsInput>
  }

  export type UserUpdateOneRequiredWithoutWorkItemTransitionsNestedInput = {
    create?: XOR<UserCreateWithoutWorkItemTransitionsInput, UserUncheckedCreateWithoutWorkItemTransitionsInput>
    connectOrCreate?: UserCreateOrConnectWithoutWorkItemTransitionsInput
    upsert?: UserUpsertWithoutWorkItemTransitionsInput
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutWorkItemTransitionsInput, UserUpdateWithoutWorkItemTransitionsInput>, UserUncheckedUpdateWithoutWorkItemTransitionsInput>
  }

  export type WorkItemCreateNestedOneWithoutPhaseTimingsInput = {
    create?: XOR<WorkItemCreateWithoutPhaseTimingsInput, WorkItemUncheckedCreateWithoutPhaseTimingsInput>
    connectOrCreate?: WorkItemCreateOrConnectWithoutPhaseTimingsInput
    connect?: WorkItemWhereUniqueInput
  }

  export type UserCreateNestedOneWithoutPhaseTimingsInput = {
    create?: XOR<UserCreateWithoutPhaseTimingsInput, UserUncheckedCreateWithoutPhaseTimingsInput>
    connectOrCreate?: UserCreateOrConnectWithoutPhaseTimingsInput
    connect?: UserWhereUniqueInput
  }

  export type EnumPhaseTimingKindFieldUpdateOperationsInput = {
    set?: $Enums.PhaseTimingKind
  }

  export type NullableDateTimeFieldUpdateOperationsInput = {
    set?: Date | string | null
  }

  export type WorkItemUpdateOneRequiredWithoutPhaseTimingsNestedInput = {
    create?: XOR<WorkItemCreateWithoutPhaseTimingsInput, WorkItemUncheckedCreateWithoutPhaseTimingsInput>
    connectOrCreate?: WorkItemCreateOrConnectWithoutPhaseTimingsInput
    upsert?: WorkItemUpsertWithoutPhaseTimingsInput
    connect?: WorkItemWhereUniqueInput
    update?: XOR<XOR<WorkItemUpdateToOneWithWhereWithoutPhaseTimingsInput, WorkItemUpdateWithoutPhaseTimingsInput>, WorkItemUncheckedUpdateWithoutPhaseTimingsInput>
  }

  export type UserUpdateOneWithoutPhaseTimingsNestedInput = {
    create?: XOR<UserCreateWithoutPhaseTimingsInput, UserUncheckedCreateWithoutPhaseTimingsInput>
    connectOrCreate?: UserCreateOrConnectWithoutPhaseTimingsInput
    upsert?: UserUpsertWithoutPhaseTimingsInput
    disconnect?: UserWhereInput | boolean
    delete?: UserWhereInput | boolean
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutPhaseTimingsInput, UserUpdateWithoutPhaseTimingsInput>, UserUncheckedUpdateWithoutPhaseTimingsInput>
  }

  export type NotificationEventCreaterecipientUserIdsInput = {
    set: string[]
  }

  export type NotificationEventCreaterecipientRolesInput = {
    set: string[]
  }

  export type NotificationEventCreaterecipientDepartmentIdsInput = {
    set: string[]
  }

  export type NotificationEventUpdaterecipientUserIdsInput = {
    set?: string[]
    push?: string | string[]
  }

  export type NotificationEventUpdaterecipientRolesInput = {
    set?: string[]
    push?: string | string[]
  }

  export type NotificationEventUpdaterecipientDepartmentIdsInput = {
    set?: string[]
    push?: string | string[]
  }

  export type SessionCreateNestedManyWithoutUserInput = {
    create?: XOR<SessionCreateWithoutUserInput, SessionUncheckedCreateWithoutUserInput> | SessionCreateWithoutUserInput[] | SessionUncheckedCreateWithoutUserInput[]
    connectOrCreate?: SessionCreateOrConnectWithoutUserInput | SessionCreateOrConnectWithoutUserInput[]
    createMany?: SessionCreateManyUserInputEnvelope
    connect?: SessionWhereUniqueInput | SessionWhereUniqueInput[]
  }

  export type AccountCreateNestedManyWithoutUserInput = {
    create?: XOR<AccountCreateWithoutUserInput, AccountUncheckedCreateWithoutUserInput> | AccountCreateWithoutUserInput[] | AccountUncheckedCreateWithoutUserInput[]
    connectOrCreate?: AccountCreateOrConnectWithoutUserInput | AccountCreateOrConnectWithoutUserInput[]
    createMany?: AccountCreateManyUserInputEnvelope
    connect?: AccountWhereUniqueInput | AccountWhereUniqueInput[]
  }

  export type OrderCreateNestedManyWithoutCreatedByInput = {
    create?: XOR<OrderCreateWithoutCreatedByInput, OrderUncheckedCreateWithoutCreatedByInput> | OrderCreateWithoutCreatedByInput[] | OrderUncheckedCreateWithoutCreatedByInput[]
    connectOrCreate?: OrderCreateOrConnectWithoutCreatedByInput | OrderCreateOrConnectWithoutCreatedByInput[]
    createMany?: OrderCreateManyCreatedByInputEnvelope
    connect?: OrderWhereUniqueInput | OrderWhereUniqueInput[]
  }

  export type WorkItemCreateNestedManyWithoutAssigneeInput = {
    create?: XOR<WorkItemCreateWithoutAssigneeInput, WorkItemUncheckedCreateWithoutAssigneeInput> | WorkItemCreateWithoutAssigneeInput[] | WorkItemUncheckedCreateWithoutAssigneeInput[]
    connectOrCreate?: WorkItemCreateOrConnectWithoutAssigneeInput | WorkItemCreateOrConnectWithoutAssigneeInput[]
    createMany?: WorkItemCreateManyAssigneeInputEnvelope
    connect?: WorkItemWhereUniqueInput | WorkItemWhereUniqueInput[]
  }

  export type WorkItemTransitionCreateNestedManyWithoutActorInput = {
    create?: XOR<WorkItemTransitionCreateWithoutActorInput, WorkItemTransitionUncheckedCreateWithoutActorInput> | WorkItemTransitionCreateWithoutActorInput[] | WorkItemTransitionUncheckedCreateWithoutActorInput[]
    connectOrCreate?: WorkItemTransitionCreateOrConnectWithoutActorInput | WorkItemTransitionCreateOrConnectWithoutActorInput[]
    createMany?: WorkItemTransitionCreateManyActorInputEnvelope
    connect?: WorkItemTransitionWhereUniqueInput | WorkItemTransitionWhereUniqueInput[]
  }

  export type PhaseTimingCreateNestedManyWithoutUserInput = {
    create?: XOR<PhaseTimingCreateWithoutUserInput, PhaseTimingUncheckedCreateWithoutUserInput> | PhaseTimingCreateWithoutUserInput[] | PhaseTimingUncheckedCreateWithoutUserInput[]
    connectOrCreate?: PhaseTimingCreateOrConnectWithoutUserInput | PhaseTimingCreateOrConnectWithoutUserInput[]
    createMany?: PhaseTimingCreateManyUserInputEnvelope
    connect?: PhaseTimingWhereUniqueInput | PhaseTimingWhereUniqueInput[]
  }

  export type SessionUncheckedCreateNestedManyWithoutUserInput = {
    create?: XOR<SessionCreateWithoutUserInput, SessionUncheckedCreateWithoutUserInput> | SessionCreateWithoutUserInput[] | SessionUncheckedCreateWithoutUserInput[]
    connectOrCreate?: SessionCreateOrConnectWithoutUserInput | SessionCreateOrConnectWithoutUserInput[]
    createMany?: SessionCreateManyUserInputEnvelope
    connect?: SessionWhereUniqueInput | SessionWhereUniqueInput[]
  }

  export type AccountUncheckedCreateNestedManyWithoutUserInput = {
    create?: XOR<AccountCreateWithoutUserInput, AccountUncheckedCreateWithoutUserInput> | AccountCreateWithoutUserInput[] | AccountUncheckedCreateWithoutUserInput[]
    connectOrCreate?: AccountCreateOrConnectWithoutUserInput | AccountCreateOrConnectWithoutUserInput[]
    createMany?: AccountCreateManyUserInputEnvelope
    connect?: AccountWhereUniqueInput | AccountWhereUniqueInput[]
  }

  export type OrderUncheckedCreateNestedManyWithoutCreatedByInput = {
    create?: XOR<OrderCreateWithoutCreatedByInput, OrderUncheckedCreateWithoutCreatedByInput> | OrderCreateWithoutCreatedByInput[] | OrderUncheckedCreateWithoutCreatedByInput[]
    connectOrCreate?: OrderCreateOrConnectWithoutCreatedByInput | OrderCreateOrConnectWithoutCreatedByInput[]
    createMany?: OrderCreateManyCreatedByInputEnvelope
    connect?: OrderWhereUniqueInput | OrderWhereUniqueInput[]
  }

  export type WorkItemUncheckedCreateNestedManyWithoutAssigneeInput = {
    create?: XOR<WorkItemCreateWithoutAssigneeInput, WorkItemUncheckedCreateWithoutAssigneeInput> | WorkItemCreateWithoutAssigneeInput[] | WorkItemUncheckedCreateWithoutAssigneeInput[]
    connectOrCreate?: WorkItemCreateOrConnectWithoutAssigneeInput | WorkItemCreateOrConnectWithoutAssigneeInput[]
    createMany?: WorkItemCreateManyAssigneeInputEnvelope
    connect?: WorkItemWhereUniqueInput | WorkItemWhereUniqueInput[]
  }

  export type WorkItemTransitionUncheckedCreateNestedManyWithoutActorInput = {
    create?: XOR<WorkItemTransitionCreateWithoutActorInput, WorkItemTransitionUncheckedCreateWithoutActorInput> | WorkItemTransitionCreateWithoutActorInput[] | WorkItemTransitionUncheckedCreateWithoutActorInput[]
    connectOrCreate?: WorkItemTransitionCreateOrConnectWithoutActorInput | WorkItemTransitionCreateOrConnectWithoutActorInput[]
    createMany?: WorkItemTransitionCreateManyActorInputEnvelope
    connect?: WorkItemTransitionWhereUniqueInput | WorkItemTransitionWhereUniqueInput[]
  }

  export type PhaseTimingUncheckedCreateNestedManyWithoutUserInput = {
    create?: XOR<PhaseTimingCreateWithoutUserInput, PhaseTimingUncheckedCreateWithoutUserInput> | PhaseTimingCreateWithoutUserInput[] | PhaseTimingUncheckedCreateWithoutUserInput[]
    connectOrCreate?: PhaseTimingCreateOrConnectWithoutUserInput | PhaseTimingCreateOrConnectWithoutUserInput[]
    createMany?: PhaseTimingCreateManyUserInputEnvelope
    connect?: PhaseTimingWhereUniqueInput | PhaseTimingWhereUniqueInput[]
  }

  export type SessionUpdateManyWithoutUserNestedInput = {
    create?: XOR<SessionCreateWithoutUserInput, SessionUncheckedCreateWithoutUserInput> | SessionCreateWithoutUserInput[] | SessionUncheckedCreateWithoutUserInput[]
    connectOrCreate?: SessionCreateOrConnectWithoutUserInput | SessionCreateOrConnectWithoutUserInput[]
    upsert?: SessionUpsertWithWhereUniqueWithoutUserInput | SessionUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: SessionCreateManyUserInputEnvelope
    set?: SessionWhereUniqueInput | SessionWhereUniqueInput[]
    disconnect?: SessionWhereUniqueInput | SessionWhereUniqueInput[]
    delete?: SessionWhereUniqueInput | SessionWhereUniqueInput[]
    connect?: SessionWhereUniqueInput | SessionWhereUniqueInput[]
    update?: SessionUpdateWithWhereUniqueWithoutUserInput | SessionUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: SessionUpdateManyWithWhereWithoutUserInput | SessionUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: SessionScalarWhereInput | SessionScalarWhereInput[]
  }

  export type AccountUpdateManyWithoutUserNestedInput = {
    create?: XOR<AccountCreateWithoutUserInput, AccountUncheckedCreateWithoutUserInput> | AccountCreateWithoutUserInput[] | AccountUncheckedCreateWithoutUserInput[]
    connectOrCreate?: AccountCreateOrConnectWithoutUserInput | AccountCreateOrConnectWithoutUserInput[]
    upsert?: AccountUpsertWithWhereUniqueWithoutUserInput | AccountUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: AccountCreateManyUserInputEnvelope
    set?: AccountWhereUniqueInput | AccountWhereUniqueInput[]
    disconnect?: AccountWhereUniqueInput | AccountWhereUniqueInput[]
    delete?: AccountWhereUniqueInput | AccountWhereUniqueInput[]
    connect?: AccountWhereUniqueInput | AccountWhereUniqueInput[]
    update?: AccountUpdateWithWhereUniqueWithoutUserInput | AccountUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: AccountUpdateManyWithWhereWithoutUserInput | AccountUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: AccountScalarWhereInput | AccountScalarWhereInput[]
  }

  export type OrderUpdateManyWithoutCreatedByNestedInput = {
    create?: XOR<OrderCreateWithoutCreatedByInput, OrderUncheckedCreateWithoutCreatedByInput> | OrderCreateWithoutCreatedByInput[] | OrderUncheckedCreateWithoutCreatedByInput[]
    connectOrCreate?: OrderCreateOrConnectWithoutCreatedByInput | OrderCreateOrConnectWithoutCreatedByInput[]
    upsert?: OrderUpsertWithWhereUniqueWithoutCreatedByInput | OrderUpsertWithWhereUniqueWithoutCreatedByInput[]
    createMany?: OrderCreateManyCreatedByInputEnvelope
    set?: OrderWhereUniqueInput | OrderWhereUniqueInput[]
    disconnect?: OrderWhereUniqueInput | OrderWhereUniqueInput[]
    delete?: OrderWhereUniqueInput | OrderWhereUniqueInput[]
    connect?: OrderWhereUniqueInput | OrderWhereUniqueInput[]
    update?: OrderUpdateWithWhereUniqueWithoutCreatedByInput | OrderUpdateWithWhereUniqueWithoutCreatedByInput[]
    updateMany?: OrderUpdateManyWithWhereWithoutCreatedByInput | OrderUpdateManyWithWhereWithoutCreatedByInput[]
    deleteMany?: OrderScalarWhereInput | OrderScalarWhereInput[]
  }

  export type WorkItemUpdateManyWithoutAssigneeNestedInput = {
    create?: XOR<WorkItemCreateWithoutAssigneeInput, WorkItemUncheckedCreateWithoutAssigneeInput> | WorkItemCreateWithoutAssigneeInput[] | WorkItemUncheckedCreateWithoutAssigneeInput[]
    connectOrCreate?: WorkItemCreateOrConnectWithoutAssigneeInput | WorkItemCreateOrConnectWithoutAssigneeInput[]
    upsert?: WorkItemUpsertWithWhereUniqueWithoutAssigneeInput | WorkItemUpsertWithWhereUniqueWithoutAssigneeInput[]
    createMany?: WorkItemCreateManyAssigneeInputEnvelope
    set?: WorkItemWhereUniqueInput | WorkItemWhereUniqueInput[]
    disconnect?: WorkItemWhereUniqueInput | WorkItemWhereUniqueInput[]
    delete?: WorkItemWhereUniqueInput | WorkItemWhereUniqueInput[]
    connect?: WorkItemWhereUniqueInput | WorkItemWhereUniqueInput[]
    update?: WorkItemUpdateWithWhereUniqueWithoutAssigneeInput | WorkItemUpdateWithWhereUniqueWithoutAssigneeInput[]
    updateMany?: WorkItemUpdateManyWithWhereWithoutAssigneeInput | WorkItemUpdateManyWithWhereWithoutAssigneeInput[]
    deleteMany?: WorkItemScalarWhereInput | WorkItemScalarWhereInput[]
  }

  export type WorkItemTransitionUpdateManyWithoutActorNestedInput = {
    create?: XOR<WorkItemTransitionCreateWithoutActorInput, WorkItemTransitionUncheckedCreateWithoutActorInput> | WorkItemTransitionCreateWithoutActorInput[] | WorkItemTransitionUncheckedCreateWithoutActorInput[]
    connectOrCreate?: WorkItemTransitionCreateOrConnectWithoutActorInput | WorkItemTransitionCreateOrConnectWithoutActorInput[]
    upsert?: WorkItemTransitionUpsertWithWhereUniqueWithoutActorInput | WorkItemTransitionUpsertWithWhereUniqueWithoutActorInput[]
    createMany?: WorkItemTransitionCreateManyActorInputEnvelope
    set?: WorkItemTransitionWhereUniqueInput | WorkItemTransitionWhereUniqueInput[]
    disconnect?: WorkItemTransitionWhereUniqueInput | WorkItemTransitionWhereUniqueInput[]
    delete?: WorkItemTransitionWhereUniqueInput | WorkItemTransitionWhereUniqueInput[]
    connect?: WorkItemTransitionWhereUniqueInput | WorkItemTransitionWhereUniqueInput[]
    update?: WorkItemTransitionUpdateWithWhereUniqueWithoutActorInput | WorkItemTransitionUpdateWithWhereUniqueWithoutActorInput[]
    updateMany?: WorkItemTransitionUpdateManyWithWhereWithoutActorInput | WorkItemTransitionUpdateManyWithWhereWithoutActorInput[]
    deleteMany?: WorkItemTransitionScalarWhereInput | WorkItemTransitionScalarWhereInput[]
  }

  export type PhaseTimingUpdateManyWithoutUserNestedInput = {
    create?: XOR<PhaseTimingCreateWithoutUserInput, PhaseTimingUncheckedCreateWithoutUserInput> | PhaseTimingCreateWithoutUserInput[] | PhaseTimingUncheckedCreateWithoutUserInput[]
    connectOrCreate?: PhaseTimingCreateOrConnectWithoutUserInput | PhaseTimingCreateOrConnectWithoutUserInput[]
    upsert?: PhaseTimingUpsertWithWhereUniqueWithoutUserInput | PhaseTimingUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: PhaseTimingCreateManyUserInputEnvelope
    set?: PhaseTimingWhereUniqueInput | PhaseTimingWhereUniqueInput[]
    disconnect?: PhaseTimingWhereUniqueInput | PhaseTimingWhereUniqueInput[]
    delete?: PhaseTimingWhereUniqueInput | PhaseTimingWhereUniqueInput[]
    connect?: PhaseTimingWhereUniqueInput | PhaseTimingWhereUniqueInput[]
    update?: PhaseTimingUpdateWithWhereUniqueWithoutUserInput | PhaseTimingUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: PhaseTimingUpdateManyWithWhereWithoutUserInput | PhaseTimingUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: PhaseTimingScalarWhereInput | PhaseTimingScalarWhereInput[]
  }

  export type SessionUncheckedUpdateManyWithoutUserNestedInput = {
    create?: XOR<SessionCreateWithoutUserInput, SessionUncheckedCreateWithoutUserInput> | SessionCreateWithoutUserInput[] | SessionUncheckedCreateWithoutUserInput[]
    connectOrCreate?: SessionCreateOrConnectWithoutUserInput | SessionCreateOrConnectWithoutUserInput[]
    upsert?: SessionUpsertWithWhereUniqueWithoutUserInput | SessionUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: SessionCreateManyUserInputEnvelope
    set?: SessionWhereUniqueInput | SessionWhereUniqueInput[]
    disconnect?: SessionWhereUniqueInput | SessionWhereUniqueInput[]
    delete?: SessionWhereUniqueInput | SessionWhereUniqueInput[]
    connect?: SessionWhereUniqueInput | SessionWhereUniqueInput[]
    update?: SessionUpdateWithWhereUniqueWithoutUserInput | SessionUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: SessionUpdateManyWithWhereWithoutUserInput | SessionUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: SessionScalarWhereInput | SessionScalarWhereInput[]
  }

  export type AccountUncheckedUpdateManyWithoutUserNestedInput = {
    create?: XOR<AccountCreateWithoutUserInput, AccountUncheckedCreateWithoutUserInput> | AccountCreateWithoutUserInput[] | AccountUncheckedCreateWithoutUserInput[]
    connectOrCreate?: AccountCreateOrConnectWithoutUserInput | AccountCreateOrConnectWithoutUserInput[]
    upsert?: AccountUpsertWithWhereUniqueWithoutUserInput | AccountUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: AccountCreateManyUserInputEnvelope
    set?: AccountWhereUniqueInput | AccountWhereUniqueInput[]
    disconnect?: AccountWhereUniqueInput | AccountWhereUniqueInput[]
    delete?: AccountWhereUniqueInput | AccountWhereUniqueInput[]
    connect?: AccountWhereUniqueInput | AccountWhereUniqueInput[]
    update?: AccountUpdateWithWhereUniqueWithoutUserInput | AccountUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: AccountUpdateManyWithWhereWithoutUserInput | AccountUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: AccountScalarWhereInput | AccountScalarWhereInput[]
  }

  export type OrderUncheckedUpdateManyWithoutCreatedByNestedInput = {
    create?: XOR<OrderCreateWithoutCreatedByInput, OrderUncheckedCreateWithoutCreatedByInput> | OrderCreateWithoutCreatedByInput[] | OrderUncheckedCreateWithoutCreatedByInput[]
    connectOrCreate?: OrderCreateOrConnectWithoutCreatedByInput | OrderCreateOrConnectWithoutCreatedByInput[]
    upsert?: OrderUpsertWithWhereUniqueWithoutCreatedByInput | OrderUpsertWithWhereUniqueWithoutCreatedByInput[]
    createMany?: OrderCreateManyCreatedByInputEnvelope
    set?: OrderWhereUniqueInput | OrderWhereUniqueInput[]
    disconnect?: OrderWhereUniqueInput | OrderWhereUniqueInput[]
    delete?: OrderWhereUniqueInput | OrderWhereUniqueInput[]
    connect?: OrderWhereUniqueInput | OrderWhereUniqueInput[]
    update?: OrderUpdateWithWhereUniqueWithoutCreatedByInput | OrderUpdateWithWhereUniqueWithoutCreatedByInput[]
    updateMany?: OrderUpdateManyWithWhereWithoutCreatedByInput | OrderUpdateManyWithWhereWithoutCreatedByInput[]
    deleteMany?: OrderScalarWhereInput | OrderScalarWhereInput[]
  }

  export type WorkItemUncheckedUpdateManyWithoutAssigneeNestedInput = {
    create?: XOR<WorkItemCreateWithoutAssigneeInput, WorkItemUncheckedCreateWithoutAssigneeInput> | WorkItemCreateWithoutAssigneeInput[] | WorkItemUncheckedCreateWithoutAssigneeInput[]
    connectOrCreate?: WorkItemCreateOrConnectWithoutAssigneeInput | WorkItemCreateOrConnectWithoutAssigneeInput[]
    upsert?: WorkItemUpsertWithWhereUniqueWithoutAssigneeInput | WorkItemUpsertWithWhereUniqueWithoutAssigneeInput[]
    createMany?: WorkItemCreateManyAssigneeInputEnvelope
    set?: WorkItemWhereUniqueInput | WorkItemWhereUniqueInput[]
    disconnect?: WorkItemWhereUniqueInput | WorkItemWhereUniqueInput[]
    delete?: WorkItemWhereUniqueInput | WorkItemWhereUniqueInput[]
    connect?: WorkItemWhereUniqueInput | WorkItemWhereUniqueInput[]
    update?: WorkItemUpdateWithWhereUniqueWithoutAssigneeInput | WorkItemUpdateWithWhereUniqueWithoutAssigneeInput[]
    updateMany?: WorkItemUpdateManyWithWhereWithoutAssigneeInput | WorkItemUpdateManyWithWhereWithoutAssigneeInput[]
    deleteMany?: WorkItemScalarWhereInput | WorkItemScalarWhereInput[]
  }

  export type WorkItemTransitionUncheckedUpdateManyWithoutActorNestedInput = {
    create?: XOR<WorkItemTransitionCreateWithoutActorInput, WorkItemTransitionUncheckedCreateWithoutActorInput> | WorkItemTransitionCreateWithoutActorInput[] | WorkItemTransitionUncheckedCreateWithoutActorInput[]
    connectOrCreate?: WorkItemTransitionCreateOrConnectWithoutActorInput | WorkItemTransitionCreateOrConnectWithoutActorInput[]
    upsert?: WorkItemTransitionUpsertWithWhereUniqueWithoutActorInput | WorkItemTransitionUpsertWithWhereUniqueWithoutActorInput[]
    createMany?: WorkItemTransitionCreateManyActorInputEnvelope
    set?: WorkItemTransitionWhereUniqueInput | WorkItemTransitionWhereUniqueInput[]
    disconnect?: WorkItemTransitionWhereUniqueInput | WorkItemTransitionWhereUniqueInput[]
    delete?: WorkItemTransitionWhereUniqueInput | WorkItemTransitionWhereUniqueInput[]
    connect?: WorkItemTransitionWhereUniqueInput | WorkItemTransitionWhereUniqueInput[]
    update?: WorkItemTransitionUpdateWithWhereUniqueWithoutActorInput | WorkItemTransitionUpdateWithWhereUniqueWithoutActorInput[]
    updateMany?: WorkItemTransitionUpdateManyWithWhereWithoutActorInput | WorkItemTransitionUpdateManyWithWhereWithoutActorInput[]
    deleteMany?: WorkItemTransitionScalarWhereInput | WorkItemTransitionScalarWhereInput[]
  }

  export type PhaseTimingUncheckedUpdateManyWithoutUserNestedInput = {
    create?: XOR<PhaseTimingCreateWithoutUserInput, PhaseTimingUncheckedCreateWithoutUserInput> | PhaseTimingCreateWithoutUserInput[] | PhaseTimingUncheckedCreateWithoutUserInput[]
    connectOrCreate?: PhaseTimingCreateOrConnectWithoutUserInput | PhaseTimingCreateOrConnectWithoutUserInput[]
    upsert?: PhaseTimingUpsertWithWhereUniqueWithoutUserInput | PhaseTimingUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: PhaseTimingCreateManyUserInputEnvelope
    set?: PhaseTimingWhereUniqueInput | PhaseTimingWhereUniqueInput[]
    disconnect?: PhaseTimingWhereUniqueInput | PhaseTimingWhereUniqueInput[]
    delete?: PhaseTimingWhereUniqueInput | PhaseTimingWhereUniqueInput[]
    connect?: PhaseTimingWhereUniqueInput | PhaseTimingWhereUniqueInput[]
    update?: PhaseTimingUpdateWithWhereUniqueWithoutUserInput | PhaseTimingUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: PhaseTimingUpdateManyWithWhereWithoutUserInput | PhaseTimingUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: PhaseTimingScalarWhereInput | PhaseTimingScalarWhereInput[]
  }

  export type UserCreateNestedOneWithoutSessionsInput = {
    create?: XOR<UserCreateWithoutSessionsInput, UserUncheckedCreateWithoutSessionsInput>
    connectOrCreate?: UserCreateOrConnectWithoutSessionsInput
    connect?: UserWhereUniqueInput
  }

  export type UserUpdateOneRequiredWithoutSessionsNestedInput = {
    create?: XOR<UserCreateWithoutSessionsInput, UserUncheckedCreateWithoutSessionsInput>
    connectOrCreate?: UserCreateOrConnectWithoutSessionsInput
    upsert?: UserUpsertWithoutSessionsInput
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutSessionsInput, UserUpdateWithoutSessionsInput>, UserUncheckedUpdateWithoutSessionsInput>
  }

  export type UserCreateNestedOneWithoutAccountsInput = {
    create?: XOR<UserCreateWithoutAccountsInput, UserUncheckedCreateWithoutAccountsInput>
    connectOrCreate?: UserCreateOrConnectWithoutAccountsInput
    connect?: UserWhereUniqueInput
  }

  export type UserUpdateOneRequiredWithoutAccountsNestedInput = {
    create?: XOR<UserCreateWithoutAccountsInput, UserUncheckedCreateWithoutAccountsInput>
    connectOrCreate?: UserCreateOrConnectWithoutAccountsInput
    upsert?: UserUpsertWithoutAccountsInput
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutAccountsInput, UserUpdateWithoutAccountsInput>, UserUncheckedUpdateWithoutAccountsInput>
  }

  export type NestedStringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type NestedBoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolFilter<$PrismaModel> | boolean
  }

  export type NestedDateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type NestedStringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type NestedIntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type NestedBoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedBoolFilter<$PrismaModel>
    _max?: NestedBoolFilter<$PrismaModel>
  }

  export type NestedDateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type NestedEnumOrderChannelFilter<$PrismaModel = never> = {
    equals?: $Enums.OrderChannel | EnumOrderChannelFieldRefInput<$PrismaModel>
    in?: $Enums.OrderChannel[] | ListEnumOrderChannelFieldRefInput<$PrismaModel>
    notIn?: $Enums.OrderChannel[] | ListEnumOrderChannelFieldRefInput<$PrismaModel>
    not?: NestedEnumOrderChannelFilter<$PrismaModel> | $Enums.OrderChannel
  }

  export type NestedEnumOrderPriorityFilter<$PrismaModel = never> = {
    equals?: $Enums.OrderPriority | EnumOrderPriorityFieldRefInput<$PrismaModel>
    in?: $Enums.OrderPriority[] | ListEnumOrderPriorityFieldRefInput<$PrismaModel>
    notIn?: $Enums.OrderPriority[] | ListEnumOrderPriorityFieldRefInput<$PrismaModel>
    not?: NestedEnumOrderPriorityFilter<$PrismaModel> | $Enums.OrderPriority
  }

  export type NestedEnumOrderModeFilter<$PrismaModel = never> = {
    equals?: $Enums.OrderMode | EnumOrderModeFieldRefInput<$PrismaModel>
    in?: $Enums.OrderMode[] | ListEnumOrderModeFieldRefInput<$PrismaModel>
    notIn?: $Enums.OrderMode[] | ListEnumOrderModeFieldRefInput<$PrismaModel>
    not?: NestedEnumOrderModeFilter<$PrismaModel> | $Enums.OrderMode
  }

  export type NestedIntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }

  export type NestedFloatFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatFilter<$PrismaModel> | number
  }

  export type NestedEnumOrderChannelWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.OrderChannel | EnumOrderChannelFieldRefInput<$PrismaModel>
    in?: $Enums.OrderChannel[] | ListEnumOrderChannelFieldRefInput<$PrismaModel>
    notIn?: $Enums.OrderChannel[] | ListEnumOrderChannelFieldRefInput<$PrismaModel>
    not?: NestedEnumOrderChannelWithAggregatesFilter<$PrismaModel> | $Enums.OrderChannel
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumOrderChannelFilter<$PrismaModel>
    _max?: NestedEnumOrderChannelFilter<$PrismaModel>
  }

  export type NestedEnumOrderPriorityWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.OrderPriority | EnumOrderPriorityFieldRefInput<$PrismaModel>
    in?: $Enums.OrderPriority[] | ListEnumOrderPriorityFieldRefInput<$PrismaModel>
    notIn?: $Enums.OrderPriority[] | ListEnumOrderPriorityFieldRefInput<$PrismaModel>
    not?: NestedEnumOrderPriorityWithAggregatesFilter<$PrismaModel> | $Enums.OrderPriority
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumOrderPriorityFilter<$PrismaModel>
    _max?: NestedEnumOrderPriorityFilter<$PrismaModel>
  }

  export type NestedEnumOrderModeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.OrderMode | EnumOrderModeFieldRefInput<$PrismaModel>
    in?: $Enums.OrderMode[] | ListEnumOrderModeFieldRefInput<$PrismaModel>
    notIn?: $Enums.OrderMode[] | ListEnumOrderModeFieldRefInput<$PrismaModel>
    not?: NestedEnumOrderModeWithAggregatesFilter<$PrismaModel> | $Enums.OrderMode
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumOrderModeFilter<$PrismaModel>
    _max?: NestedEnumOrderModeFilter<$PrismaModel>
  }

  export type NestedStringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type NestedEnumWorkItemStateFilter<$PrismaModel = never> = {
    equals?: $Enums.WorkItemState | EnumWorkItemStateFieldRefInput<$PrismaModel>
    in?: $Enums.WorkItemState[] | ListEnumWorkItemStateFieldRefInput<$PrismaModel>
    notIn?: $Enums.WorkItemState[] | ListEnumWorkItemStateFieldRefInput<$PrismaModel>
    not?: NestedEnumWorkItemStateFilter<$PrismaModel> | $Enums.WorkItemState
  }

  export type NestedStringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type NestedIntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableFilter<$PrismaModel> | number | null
  }

  export type NestedEnumWorkItemStateWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.WorkItemState | EnumWorkItemStateFieldRefInput<$PrismaModel>
    in?: $Enums.WorkItemState[] | ListEnumWorkItemStateFieldRefInput<$PrismaModel>
    notIn?: $Enums.WorkItemState[] | ListEnumWorkItemStateFieldRefInput<$PrismaModel>
    not?: NestedEnumWorkItemStateWithAggregatesFilter<$PrismaModel> | $Enums.WorkItemState
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumWorkItemStateFilter<$PrismaModel>
    _max?: NestedEnumWorkItemStateFilter<$PrismaModel>
  }

  export type NestedEnumRejectionCategoryNullableFilter<$PrismaModel = never> = {
    equals?: $Enums.RejectionCategory | EnumRejectionCategoryFieldRefInput<$PrismaModel> | null
    in?: $Enums.RejectionCategory[] | ListEnumRejectionCategoryFieldRefInput<$PrismaModel> | null
    notIn?: $Enums.RejectionCategory[] | ListEnumRejectionCategoryFieldRefInput<$PrismaModel> | null
    not?: NestedEnumRejectionCategoryNullableFilter<$PrismaModel> | $Enums.RejectionCategory | null
  }

  export type NestedEnumRejectionCategoryNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.RejectionCategory | EnumRejectionCategoryFieldRefInput<$PrismaModel> | null
    in?: $Enums.RejectionCategory[] | ListEnumRejectionCategoryFieldRefInput<$PrismaModel> | null
    notIn?: $Enums.RejectionCategory[] | ListEnumRejectionCategoryFieldRefInput<$PrismaModel> | null
    not?: NestedEnumRejectionCategoryNullableWithAggregatesFilter<$PrismaModel> | $Enums.RejectionCategory | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedEnumRejectionCategoryNullableFilter<$PrismaModel>
    _max?: NestedEnumRejectionCategoryNullableFilter<$PrismaModel>
  }
  export type NestedJsonNullableFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<NestedJsonNullableFilterBase<$PrismaModel>>, Exclude<keyof Required<NestedJsonNullableFilterBase<$PrismaModel>>, 'path'>>,
        Required<NestedJsonNullableFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<NestedJsonNullableFilterBase<$PrismaModel>>, 'path'>>

  export type NestedJsonNullableFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
  }

  export type NestedEnumPhaseTimingKindFilter<$PrismaModel = never> = {
    equals?: $Enums.PhaseTimingKind | EnumPhaseTimingKindFieldRefInput<$PrismaModel>
    in?: $Enums.PhaseTimingKind[] | ListEnumPhaseTimingKindFieldRefInput<$PrismaModel>
    notIn?: $Enums.PhaseTimingKind[] | ListEnumPhaseTimingKindFieldRefInput<$PrismaModel>
    not?: NestedEnumPhaseTimingKindFilter<$PrismaModel> | $Enums.PhaseTimingKind
  }

  export type NestedDateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null
  }

  export type NestedEnumPhaseTimingKindWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.PhaseTimingKind | EnumPhaseTimingKindFieldRefInput<$PrismaModel>
    in?: $Enums.PhaseTimingKind[] | ListEnumPhaseTimingKindFieldRefInput<$PrismaModel>
    notIn?: $Enums.PhaseTimingKind[] | ListEnumPhaseTimingKindFieldRefInput<$PrismaModel>
    not?: NestedEnumPhaseTimingKindWithAggregatesFilter<$PrismaModel> | $Enums.PhaseTimingKind
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumPhaseTimingKindFilter<$PrismaModel>
    _max?: NestedEnumPhaseTimingKindFilter<$PrismaModel>
  }

  export type NestedDateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedDateTimeNullableFilter<$PrismaModel>
    _max?: NestedDateTimeNullableFilter<$PrismaModel>
  }

  export type WorkItemCreateWithoutDepartmentInput = {
    id?: string
    productTypeId?: string | null
    state: $Enums.WorkItemState
    requiresDesign?: boolean
    requiresReview?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    order: OrderCreateNestedOneWithoutWorkItemsInput
    assignee?: UserCreateNestedOneWithoutAssignedWorkItemsInput
    transitions?: WorkItemTransitionCreateNestedManyWithoutWorkItemInput
    phaseTimings?: PhaseTimingCreateNestedManyWithoutWorkItemInput
  }

  export type WorkItemUncheckedCreateWithoutDepartmentInput = {
    id?: string
    orderId: string
    productTypeId?: string | null
    state: $Enums.WorkItemState
    requiresDesign?: boolean
    requiresReview?: boolean
    assigneeId?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    transitions?: WorkItemTransitionUncheckedCreateNestedManyWithoutWorkItemInput
    phaseTimings?: PhaseTimingUncheckedCreateNestedManyWithoutWorkItemInput
  }

  export type WorkItemCreateOrConnectWithoutDepartmentInput = {
    where: WorkItemWhereUniqueInput
    create: XOR<WorkItemCreateWithoutDepartmentInput, WorkItemUncheckedCreateWithoutDepartmentInput>
  }

  export type WorkItemCreateManyDepartmentInputEnvelope = {
    data: WorkItemCreateManyDepartmentInput | WorkItemCreateManyDepartmentInput[]
    skipDuplicates?: boolean
  }

  export type WorkItemUpsertWithWhereUniqueWithoutDepartmentInput = {
    where: WorkItemWhereUniqueInput
    update: XOR<WorkItemUpdateWithoutDepartmentInput, WorkItemUncheckedUpdateWithoutDepartmentInput>
    create: XOR<WorkItemCreateWithoutDepartmentInput, WorkItemUncheckedCreateWithoutDepartmentInput>
  }

  export type WorkItemUpdateWithWhereUniqueWithoutDepartmentInput = {
    where: WorkItemWhereUniqueInput
    data: XOR<WorkItemUpdateWithoutDepartmentInput, WorkItemUncheckedUpdateWithoutDepartmentInput>
  }

  export type WorkItemUpdateManyWithWhereWithoutDepartmentInput = {
    where: WorkItemScalarWhereInput
    data: XOR<WorkItemUpdateManyMutationInput, WorkItemUncheckedUpdateManyWithoutDepartmentInput>
  }

  export type WorkItemScalarWhereInput = {
    AND?: WorkItemScalarWhereInput | WorkItemScalarWhereInput[]
    OR?: WorkItemScalarWhereInput[]
    NOT?: WorkItemScalarWhereInput | WorkItemScalarWhereInput[]
    id?: StringFilter<"WorkItem"> | string
    orderId?: StringFilter<"WorkItem"> | string
    productTypeId?: StringNullableFilter<"WorkItem"> | string | null
    departmentId?: StringNullableFilter<"WorkItem"> | string | null
    state?: EnumWorkItemStateFilter<"WorkItem"> | $Enums.WorkItemState
    requiresDesign?: BoolFilter<"WorkItem"> | boolean
    requiresReview?: BoolFilter<"WorkItem"> | boolean
    assigneeId?: StringNullableFilter<"WorkItem"> | string | null
    createdAt?: DateTimeFilter<"WorkItem"> | Date | string
    updatedAt?: DateTimeFilter<"WorkItem"> | Date | string
  }

  export type OrderCreateWithoutCustomerInput = {
    id?: string
    number: number
    channel: $Enums.OrderChannel
    priority: $Enums.OrderPriority
    mode: $Enums.OrderMode
    createdAt?: Date | string
    createdBy: UserCreateNestedOneWithoutCreatedOrdersInput
    workItems?: WorkItemCreateNestedManyWithoutOrderInput
  }

  export type OrderUncheckedCreateWithoutCustomerInput = {
    id?: string
    number: number
    channel: $Enums.OrderChannel
    priority: $Enums.OrderPriority
    mode: $Enums.OrderMode
    createdById: string
    createdAt?: Date | string
    workItems?: WorkItemUncheckedCreateNestedManyWithoutOrderInput
  }

  export type OrderCreateOrConnectWithoutCustomerInput = {
    where: OrderWhereUniqueInput
    create: XOR<OrderCreateWithoutCustomerInput, OrderUncheckedCreateWithoutCustomerInput>
  }

  export type OrderCreateManyCustomerInputEnvelope = {
    data: OrderCreateManyCustomerInput | OrderCreateManyCustomerInput[]
    skipDuplicates?: boolean
  }

  export type OrderUpsertWithWhereUniqueWithoutCustomerInput = {
    where: OrderWhereUniqueInput
    update: XOR<OrderUpdateWithoutCustomerInput, OrderUncheckedUpdateWithoutCustomerInput>
    create: XOR<OrderCreateWithoutCustomerInput, OrderUncheckedCreateWithoutCustomerInput>
  }

  export type OrderUpdateWithWhereUniqueWithoutCustomerInput = {
    where: OrderWhereUniqueInput
    data: XOR<OrderUpdateWithoutCustomerInput, OrderUncheckedUpdateWithoutCustomerInput>
  }

  export type OrderUpdateManyWithWhereWithoutCustomerInput = {
    where: OrderScalarWhereInput
    data: XOR<OrderUpdateManyMutationInput, OrderUncheckedUpdateManyWithoutCustomerInput>
  }

  export type OrderScalarWhereInput = {
    AND?: OrderScalarWhereInput | OrderScalarWhereInput[]
    OR?: OrderScalarWhereInput[]
    NOT?: OrderScalarWhereInput | OrderScalarWhereInput[]
    id?: StringFilter<"Order"> | string
    number?: IntFilter<"Order"> | number
    customerId?: StringFilter<"Order"> | string
    channel?: EnumOrderChannelFilter<"Order"> | $Enums.OrderChannel
    priority?: EnumOrderPriorityFilter<"Order"> | $Enums.OrderPriority
    mode?: EnumOrderModeFilter<"Order"> | $Enums.OrderMode
    createdById?: StringFilter<"Order"> | string
    createdAt?: DateTimeFilter<"Order"> | Date | string
  }

  export type CustomerCreateWithoutOrdersInput = {
    id?: string
    name: string
    isCashCustomer?: boolean
    createdAt?: Date | string
  }

  export type CustomerUncheckedCreateWithoutOrdersInput = {
    id?: string
    name: string
    isCashCustomer?: boolean
    createdAt?: Date | string
  }

  export type CustomerCreateOrConnectWithoutOrdersInput = {
    where: CustomerWhereUniqueInput
    create: XOR<CustomerCreateWithoutOrdersInput, CustomerUncheckedCreateWithoutOrdersInput>
  }

  export type UserCreateWithoutCreatedOrdersInput = {
    id: string
    name: string
    email: string
    emailVerified?: boolean
    image?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    sessions?: SessionCreateNestedManyWithoutUserInput
    accounts?: AccountCreateNestedManyWithoutUserInput
    assignedWorkItems?: WorkItemCreateNestedManyWithoutAssigneeInput
    workItemTransitions?: WorkItemTransitionCreateNestedManyWithoutActorInput
    phaseTimings?: PhaseTimingCreateNestedManyWithoutUserInput
  }

  export type UserUncheckedCreateWithoutCreatedOrdersInput = {
    id: string
    name: string
    email: string
    emailVerified?: boolean
    image?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    sessions?: SessionUncheckedCreateNestedManyWithoutUserInput
    accounts?: AccountUncheckedCreateNestedManyWithoutUserInput
    assignedWorkItems?: WorkItemUncheckedCreateNestedManyWithoutAssigneeInput
    workItemTransitions?: WorkItemTransitionUncheckedCreateNestedManyWithoutActorInput
    phaseTimings?: PhaseTimingUncheckedCreateNestedManyWithoutUserInput
  }

  export type UserCreateOrConnectWithoutCreatedOrdersInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutCreatedOrdersInput, UserUncheckedCreateWithoutCreatedOrdersInput>
  }

  export type WorkItemCreateWithoutOrderInput = {
    id?: string
    productTypeId?: string | null
    state: $Enums.WorkItemState
    requiresDesign?: boolean
    requiresReview?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    department?: DepartmentCreateNestedOneWithoutWorkItemsInput
    assignee?: UserCreateNestedOneWithoutAssignedWorkItemsInput
    transitions?: WorkItemTransitionCreateNestedManyWithoutWorkItemInput
    phaseTimings?: PhaseTimingCreateNestedManyWithoutWorkItemInput
  }

  export type WorkItemUncheckedCreateWithoutOrderInput = {
    id?: string
    productTypeId?: string | null
    departmentId?: string | null
    state: $Enums.WorkItemState
    requiresDesign?: boolean
    requiresReview?: boolean
    assigneeId?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    transitions?: WorkItemTransitionUncheckedCreateNestedManyWithoutWorkItemInput
    phaseTimings?: PhaseTimingUncheckedCreateNestedManyWithoutWorkItemInput
  }

  export type WorkItemCreateOrConnectWithoutOrderInput = {
    where: WorkItemWhereUniqueInput
    create: XOR<WorkItemCreateWithoutOrderInput, WorkItemUncheckedCreateWithoutOrderInput>
  }

  export type WorkItemCreateManyOrderInputEnvelope = {
    data: WorkItemCreateManyOrderInput | WorkItemCreateManyOrderInput[]
    skipDuplicates?: boolean
  }

  export type CustomerUpsertWithoutOrdersInput = {
    update: XOR<CustomerUpdateWithoutOrdersInput, CustomerUncheckedUpdateWithoutOrdersInput>
    create: XOR<CustomerCreateWithoutOrdersInput, CustomerUncheckedCreateWithoutOrdersInput>
    where?: CustomerWhereInput
  }

  export type CustomerUpdateToOneWithWhereWithoutOrdersInput = {
    where?: CustomerWhereInput
    data: XOR<CustomerUpdateWithoutOrdersInput, CustomerUncheckedUpdateWithoutOrdersInput>
  }

  export type CustomerUpdateWithoutOrdersInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    isCashCustomer?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CustomerUncheckedUpdateWithoutOrdersInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    isCashCustomer?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UserUpsertWithoutCreatedOrdersInput = {
    update: XOR<UserUpdateWithoutCreatedOrdersInput, UserUncheckedUpdateWithoutCreatedOrdersInput>
    create: XOR<UserCreateWithoutCreatedOrdersInput, UserUncheckedCreateWithoutCreatedOrdersInput>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutCreatedOrdersInput = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutCreatedOrdersInput, UserUncheckedUpdateWithoutCreatedOrdersInput>
  }

  export type UserUpdateWithoutCreatedOrdersInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    emailVerified?: BoolFieldUpdateOperationsInput | boolean
    image?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    sessions?: SessionUpdateManyWithoutUserNestedInput
    accounts?: AccountUpdateManyWithoutUserNestedInput
    assignedWorkItems?: WorkItemUpdateManyWithoutAssigneeNestedInput
    workItemTransitions?: WorkItemTransitionUpdateManyWithoutActorNestedInput
    phaseTimings?: PhaseTimingUpdateManyWithoutUserNestedInput
  }

  export type UserUncheckedUpdateWithoutCreatedOrdersInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    emailVerified?: BoolFieldUpdateOperationsInput | boolean
    image?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    sessions?: SessionUncheckedUpdateManyWithoutUserNestedInput
    accounts?: AccountUncheckedUpdateManyWithoutUserNestedInput
    assignedWorkItems?: WorkItemUncheckedUpdateManyWithoutAssigneeNestedInput
    workItemTransitions?: WorkItemTransitionUncheckedUpdateManyWithoutActorNestedInput
    phaseTimings?: PhaseTimingUncheckedUpdateManyWithoutUserNestedInput
  }

  export type WorkItemUpsertWithWhereUniqueWithoutOrderInput = {
    where: WorkItemWhereUniqueInput
    update: XOR<WorkItemUpdateWithoutOrderInput, WorkItemUncheckedUpdateWithoutOrderInput>
    create: XOR<WorkItemCreateWithoutOrderInput, WorkItemUncheckedCreateWithoutOrderInput>
  }

  export type WorkItemUpdateWithWhereUniqueWithoutOrderInput = {
    where: WorkItemWhereUniqueInput
    data: XOR<WorkItemUpdateWithoutOrderInput, WorkItemUncheckedUpdateWithoutOrderInput>
  }

  export type WorkItemUpdateManyWithWhereWithoutOrderInput = {
    where: WorkItemScalarWhereInput
    data: XOR<WorkItemUpdateManyMutationInput, WorkItemUncheckedUpdateManyWithoutOrderInput>
  }

  export type OrderCreateWithoutWorkItemsInput = {
    id?: string
    number: number
    channel: $Enums.OrderChannel
    priority: $Enums.OrderPriority
    mode: $Enums.OrderMode
    createdAt?: Date | string
    customer: CustomerCreateNestedOneWithoutOrdersInput
    createdBy: UserCreateNestedOneWithoutCreatedOrdersInput
  }

  export type OrderUncheckedCreateWithoutWorkItemsInput = {
    id?: string
    number: number
    customerId: string
    channel: $Enums.OrderChannel
    priority: $Enums.OrderPriority
    mode: $Enums.OrderMode
    createdById: string
    createdAt?: Date | string
  }

  export type OrderCreateOrConnectWithoutWorkItemsInput = {
    where: OrderWhereUniqueInput
    create: XOR<OrderCreateWithoutWorkItemsInput, OrderUncheckedCreateWithoutWorkItemsInput>
  }

  export type DepartmentCreateWithoutWorkItemsInput = {
    id?: string
    name: string
    isActive?: boolean
    createdAt?: Date | string
  }

  export type DepartmentUncheckedCreateWithoutWorkItemsInput = {
    id?: string
    name: string
    isActive?: boolean
    createdAt?: Date | string
  }

  export type DepartmentCreateOrConnectWithoutWorkItemsInput = {
    where: DepartmentWhereUniqueInput
    create: XOR<DepartmentCreateWithoutWorkItemsInput, DepartmentUncheckedCreateWithoutWorkItemsInput>
  }

  export type UserCreateWithoutAssignedWorkItemsInput = {
    id: string
    name: string
    email: string
    emailVerified?: boolean
    image?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    sessions?: SessionCreateNestedManyWithoutUserInput
    accounts?: AccountCreateNestedManyWithoutUserInput
    createdOrders?: OrderCreateNestedManyWithoutCreatedByInput
    workItemTransitions?: WorkItemTransitionCreateNestedManyWithoutActorInput
    phaseTimings?: PhaseTimingCreateNestedManyWithoutUserInput
  }

  export type UserUncheckedCreateWithoutAssignedWorkItemsInput = {
    id: string
    name: string
    email: string
    emailVerified?: boolean
    image?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    sessions?: SessionUncheckedCreateNestedManyWithoutUserInput
    accounts?: AccountUncheckedCreateNestedManyWithoutUserInput
    createdOrders?: OrderUncheckedCreateNestedManyWithoutCreatedByInput
    workItemTransitions?: WorkItemTransitionUncheckedCreateNestedManyWithoutActorInput
    phaseTimings?: PhaseTimingUncheckedCreateNestedManyWithoutUserInput
  }

  export type UserCreateOrConnectWithoutAssignedWorkItemsInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutAssignedWorkItemsInput, UserUncheckedCreateWithoutAssignedWorkItemsInput>
  }

  export type WorkItemTransitionCreateWithoutWorkItemInput = {
    id?: string
    from: $Enums.WorkItemState
    to: $Enums.WorkItemState
    at?: Date | string
    reason?: string | null
    rejectionCategory?: $Enums.RejectionCategory | null
    meta?: NullableJsonNullValueInput | InputJsonValue
    actor: UserCreateNestedOneWithoutWorkItemTransitionsInput
  }

  export type WorkItemTransitionUncheckedCreateWithoutWorkItemInput = {
    id?: string
    from: $Enums.WorkItemState
    to: $Enums.WorkItemState
    actorId: string
    at?: Date | string
    reason?: string | null
    rejectionCategory?: $Enums.RejectionCategory | null
    meta?: NullableJsonNullValueInput | InputJsonValue
  }

  export type WorkItemTransitionCreateOrConnectWithoutWorkItemInput = {
    where: WorkItemTransitionWhereUniqueInput
    create: XOR<WorkItemTransitionCreateWithoutWorkItemInput, WorkItemTransitionUncheckedCreateWithoutWorkItemInput>
  }

  export type WorkItemTransitionCreateManyWorkItemInputEnvelope = {
    data: WorkItemTransitionCreateManyWorkItemInput | WorkItemTransitionCreateManyWorkItemInput[]
    skipDuplicates?: boolean
  }

  export type PhaseTimingCreateWithoutWorkItemInput = {
    id?: string
    phase: $Enums.WorkItemState
    kind: $Enums.PhaseTimingKind
    startedAt: Date | string
    endedAt?: Date | string | null
    user?: UserCreateNestedOneWithoutPhaseTimingsInput
  }

  export type PhaseTimingUncheckedCreateWithoutWorkItemInput = {
    id?: string
    phase: $Enums.WorkItemState
    userId?: string | null
    kind: $Enums.PhaseTimingKind
    startedAt: Date | string
    endedAt?: Date | string | null
  }

  export type PhaseTimingCreateOrConnectWithoutWorkItemInput = {
    where: PhaseTimingWhereUniqueInput
    create: XOR<PhaseTimingCreateWithoutWorkItemInput, PhaseTimingUncheckedCreateWithoutWorkItemInput>
  }

  export type PhaseTimingCreateManyWorkItemInputEnvelope = {
    data: PhaseTimingCreateManyWorkItemInput | PhaseTimingCreateManyWorkItemInput[]
    skipDuplicates?: boolean
  }

  export type OrderUpsertWithoutWorkItemsInput = {
    update: XOR<OrderUpdateWithoutWorkItemsInput, OrderUncheckedUpdateWithoutWorkItemsInput>
    create: XOR<OrderCreateWithoutWorkItemsInput, OrderUncheckedCreateWithoutWorkItemsInput>
    where?: OrderWhereInput
  }

  export type OrderUpdateToOneWithWhereWithoutWorkItemsInput = {
    where?: OrderWhereInput
    data: XOR<OrderUpdateWithoutWorkItemsInput, OrderUncheckedUpdateWithoutWorkItemsInput>
  }

  export type OrderUpdateWithoutWorkItemsInput = {
    id?: StringFieldUpdateOperationsInput | string
    number?: IntFieldUpdateOperationsInput | number
    channel?: EnumOrderChannelFieldUpdateOperationsInput | $Enums.OrderChannel
    priority?: EnumOrderPriorityFieldUpdateOperationsInput | $Enums.OrderPriority
    mode?: EnumOrderModeFieldUpdateOperationsInput | $Enums.OrderMode
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    customer?: CustomerUpdateOneRequiredWithoutOrdersNestedInput
    createdBy?: UserUpdateOneRequiredWithoutCreatedOrdersNestedInput
  }

  export type OrderUncheckedUpdateWithoutWorkItemsInput = {
    id?: StringFieldUpdateOperationsInput | string
    number?: IntFieldUpdateOperationsInput | number
    customerId?: StringFieldUpdateOperationsInput | string
    channel?: EnumOrderChannelFieldUpdateOperationsInput | $Enums.OrderChannel
    priority?: EnumOrderPriorityFieldUpdateOperationsInput | $Enums.OrderPriority
    mode?: EnumOrderModeFieldUpdateOperationsInput | $Enums.OrderMode
    createdById?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type DepartmentUpsertWithoutWorkItemsInput = {
    update: XOR<DepartmentUpdateWithoutWorkItemsInput, DepartmentUncheckedUpdateWithoutWorkItemsInput>
    create: XOR<DepartmentCreateWithoutWorkItemsInput, DepartmentUncheckedCreateWithoutWorkItemsInput>
    where?: DepartmentWhereInput
  }

  export type DepartmentUpdateToOneWithWhereWithoutWorkItemsInput = {
    where?: DepartmentWhereInput
    data: XOR<DepartmentUpdateWithoutWorkItemsInput, DepartmentUncheckedUpdateWithoutWorkItemsInput>
  }

  export type DepartmentUpdateWithoutWorkItemsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type DepartmentUncheckedUpdateWithoutWorkItemsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UserUpsertWithoutAssignedWorkItemsInput = {
    update: XOR<UserUpdateWithoutAssignedWorkItemsInput, UserUncheckedUpdateWithoutAssignedWorkItemsInput>
    create: XOR<UserCreateWithoutAssignedWorkItemsInput, UserUncheckedCreateWithoutAssignedWorkItemsInput>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutAssignedWorkItemsInput = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutAssignedWorkItemsInput, UserUncheckedUpdateWithoutAssignedWorkItemsInput>
  }

  export type UserUpdateWithoutAssignedWorkItemsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    emailVerified?: BoolFieldUpdateOperationsInput | boolean
    image?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    sessions?: SessionUpdateManyWithoutUserNestedInput
    accounts?: AccountUpdateManyWithoutUserNestedInput
    createdOrders?: OrderUpdateManyWithoutCreatedByNestedInput
    workItemTransitions?: WorkItemTransitionUpdateManyWithoutActorNestedInput
    phaseTimings?: PhaseTimingUpdateManyWithoutUserNestedInput
  }

  export type UserUncheckedUpdateWithoutAssignedWorkItemsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    emailVerified?: BoolFieldUpdateOperationsInput | boolean
    image?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    sessions?: SessionUncheckedUpdateManyWithoutUserNestedInput
    accounts?: AccountUncheckedUpdateManyWithoutUserNestedInput
    createdOrders?: OrderUncheckedUpdateManyWithoutCreatedByNestedInput
    workItemTransitions?: WorkItemTransitionUncheckedUpdateManyWithoutActorNestedInput
    phaseTimings?: PhaseTimingUncheckedUpdateManyWithoutUserNestedInput
  }

  export type WorkItemTransitionUpsertWithWhereUniqueWithoutWorkItemInput = {
    where: WorkItemTransitionWhereUniqueInput
    update: XOR<WorkItemTransitionUpdateWithoutWorkItemInput, WorkItemTransitionUncheckedUpdateWithoutWorkItemInput>
    create: XOR<WorkItemTransitionCreateWithoutWorkItemInput, WorkItemTransitionUncheckedCreateWithoutWorkItemInput>
  }

  export type WorkItemTransitionUpdateWithWhereUniqueWithoutWorkItemInput = {
    where: WorkItemTransitionWhereUniqueInput
    data: XOR<WorkItemTransitionUpdateWithoutWorkItemInput, WorkItemTransitionUncheckedUpdateWithoutWorkItemInput>
  }

  export type WorkItemTransitionUpdateManyWithWhereWithoutWorkItemInput = {
    where: WorkItemTransitionScalarWhereInput
    data: XOR<WorkItemTransitionUpdateManyMutationInput, WorkItemTransitionUncheckedUpdateManyWithoutWorkItemInput>
  }

  export type WorkItemTransitionScalarWhereInput = {
    AND?: WorkItemTransitionScalarWhereInput | WorkItemTransitionScalarWhereInput[]
    OR?: WorkItemTransitionScalarWhereInput[]
    NOT?: WorkItemTransitionScalarWhereInput | WorkItemTransitionScalarWhereInput[]
    id?: StringFilter<"WorkItemTransition"> | string
    workItemId?: StringFilter<"WorkItemTransition"> | string
    from?: EnumWorkItemStateFilter<"WorkItemTransition"> | $Enums.WorkItemState
    to?: EnumWorkItemStateFilter<"WorkItemTransition"> | $Enums.WorkItemState
    actorId?: StringFilter<"WorkItemTransition"> | string
    at?: DateTimeFilter<"WorkItemTransition"> | Date | string
    reason?: StringNullableFilter<"WorkItemTransition"> | string | null
    rejectionCategory?: EnumRejectionCategoryNullableFilter<"WorkItemTransition"> | $Enums.RejectionCategory | null
    meta?: JsonNullableFilter<"WorkItemTransition">
  }

  export type PhaseTimingUpsertWithWhereUniqueWithoutWorkItemInput = {
    where: PhaseTimingWhereUniqueInput
    update: XOR<PhaseTimingUpdateWithoutWorkItemInput, PhaseTimingUncheckedUpdateWithoutWorkItemInput>
    create: XOR<PhaseTimingCreateWithoutWorkItemInput, PhaseTimingUncheckedCreateWithoutWorkItemInput>
  }

  export type PhaseTimingUpdateWithWhereUniqueWithoutWorkItemInput = {
    where: PhaseTimingWhereUniqueInput
    data: XOR<PhaseTimingUpdateWithoutWorkItemInput, PhaseTimingUncheckedUpdateWithoutWorkItemInput>
  }

  export type PhaseTimingUpdateManyWithWhereWithoutWorkItemInput = {
    where: PhaseTimingScalarWhereInput
    data: XOR<PhaseTimingUpdateManyMutationInput, PhaseTimingUncheckedUpdateManyWithoutWorkItemInput>
  }

  export type PhaseTimingScalarWhereInput = {
    AND?: PhaseTimingScalarWhereInput | PhaseTimingScalarWhereInput[]
    OR?: PhaseTimingScalarWhereInput[]
    NOT?: PhaseTimingScalarWhereInput | PhaseTimingScalarWhereInput[]
    id?: StringFilter<"PhaseTiming"> | string
    workItemId?: StringFilter<"PhaseTiming"> | string
    phase?: EnumWorkItemStateFilter<"PhaseTiming"> | $Enums.WorkItemState
    userId?: StringNullableFilter<"PhaseTiming"> | string | null
    kind?: EnumPhaseTimingKindFilter<"PhaseTiming"> | $Enums.PhaseTimingKind
    startedAt?: DateTimeFilter<"PhaseTiming"> | Date | string
    endedAt?: DateTimeNullableFilter<"PhaseTiming"> | Date | string | null
  }

  export type WorkItemCreateWithoutTransitionsInput = {
    id?: string
    productTypeId?: string | null
    state: $Enums.WorkItemState
    requiresDesign?: boolean
    requiresReview?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    order: OrderCreateNestedOneWithoutWorkItemsInput
    department?: DepartmentCreateNestedOneWithoutWorkItemsInput
    assignee?: UserCreateNestedOneWithoutAssignedWorkItemsInput
    phaseTimings?: PhaseTimingCreateNestedManyWithoutWorkItemInput
  }

  export type WorkItemUncheckedCreateWithoutTransitionsInput = {
    id?: string
    orderId: string
    productTypeId?: string | null
    departmentId?: string | null
    state: $Enums.WorkItemState
    requiresDesign?: boolean
    requiresReview?: boolean
    assigneeId?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    phaseTimings?: PhaseTimingUncheckedCreateNestedManyWithoutWorkItemInput
  }

  export type WorkItemCreateOrConnectWithoutTransitionsInput = {
    where: WorkItemWhereUniqueInput
    create: XOR<WorkItemCreateWithoutTransitionsInput, WorkItemUncheckedCreateWithoutTransitionsInput>
  }

  export type UserCreateWithoutWorkItemTransitionsInput = {
    id: string
    name: string
    email: string
    emailVerified?: boolean
    image?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    sessions?: SessionCreateNestedManyWithoutUserInput
    accounts?: AccountCreateNestedManyWithoutUserInput
    createdOrders?: OrderCreateNestedManyWithoutCreatedByInput
    assignedWorkItems?: WorkItemCreateNestedManyWithoutAssigneeInput
    phaseTimings?: PhaseTimingCreateNestedManyWithoutUserInput
  }

  export type UserUncheckedCreateWithoutWorkItemTransitionsInput = {
    id: string
    name: string
    email: string
    emailVerified?: boolean
    image?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    sessions?: SessionUncheckedCreateNestedManyWithoutUserInput
    accounts?: AccountUncheckedCreateNestedManyWithoutUserInput
    createdOrders?: OrderUncheckedCreateNestedManyWithoutCreatedByInput
    assignedWorkItems?: WorkItemUncheckedCreateNestedManyWithoutAssigneeInput
    phaseTimings?: PhaseTimingUncheckedCreateNestedManyWithoutUserInput
  }

  export type UserCreateOrConnectWithoutWorkItemTransitionsInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutWorkItemTransitionsInput, UserUncheckedCreateWithoutWorkItemTransitionsInput>
  }

  export type WorkItemUpsertWithoutTransitionsInput = {
    update: XOR<WorkItemUpdateWithoutTransitionsInput, WorkItemUncheckedUpdateWithoutTransitionsInput>
    create: XOR<WorkItemCreateWithoutTransitionsInput, WorkItemUncheckedCreateWithoutTransitionsInput>
    where?: WorkItemWhereInput
  }

  export type WorkItemUpdateToOneWithWhereWithoutTransitionsInput = {
    where?: WorkItemWhereInput
    data: XOR<WorkItemUpdateWithoutTransitionsInput, WorkItemUncheckedUpdateWithoutTransitionsInput>
  }

  export type WorkItemUpdateWithoutTransitionsInput = {
    id?: StringFieldUpdateOperationsInput | string
    productTypeId?: NullableStringFieldUpdateOperationsInput | string | null
    state?: EnumWorkItemStateFieldUpdateOperationsInput | $Enums.WorkItemState
    requiresDesign?: BoolFieldUpdateOperationsInput | boolean
    requiresReview?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    order?: OrderUpdateOneRequiredWithoutWorkItemsNestedInput
    department?: DepartmentUpdateOneWithoutWorkItemsNestedInput
    assignee?: UserUpdateOneWithoutAssignedWorkItemsNestedInput
    phaseTimings?: PhaseTimingUpdateManyWithoutWorkItemNestedInput
  }

  export type WorkItemUncheckedUpdateWithoutTransitionsInput = {
    id?: StringFieldUpdateOperationsInput | string
    orderId?: StringFieldUpdateOperationsInput | string
    productTypeId?: NullableStringFieldUpdateOperationsInput | string | null
    departmentId?: NullableStringFieldUpdateOperationsInput | string | null
    state?: EnumWorkItemStateFieldUpdateOperationsInput | $Enums.WorkItemState
    requiresDesign?: BoolFieldUpdateOperationsInput | boolean
    requiresReview?: BoolFieldUpdateOperationsInput | boolean
    assigneeId?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    phaseTimings?: PhaseTimingUncheckedUpdateManyWithoutWorkItemNestedInput
  }

  export type UserUpsertWithoutWorkItemTransitionsInput = {
    update: XOR<UserUpdateWithoutWorkItemTransitionsInput, UserUncheckedUpdateWithoutWorkItemTransitionsInput>
    create: XOR<UserCreateWithoutWorkItemTransitionsInput, UserUncheckedCreateWithoutWorkItemTransitionsInput>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutWorkItemTransitionsInput = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutWorkItemTransitionsInput, UserUncheckedUpdateWithoutWorkItemTransitionsInput>
  }

  export type UserUpdateWithoutWorkItemTransitionsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    emailVerified?: BoolFieldUpdateOperationsInput | boolean
    image?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    sessions?: SessionUpdateManyWithoutUserNestedInput
    accounts?: AccountUpdateManyWithoutUserNestedInput
    createdOrders?: OrderUpdateManyWithoutCreatedByNestedInput
    assignedWorkItems?: WorkItemUpdateManyWithoutAssigneeNestedInput
    phaseTimings?: PhaseTimingUpdateManyWithoutUserNestedInput
  }

  export type UserUncheckedUpdateWithoutWorkItemTransitionsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    emailVerified?: BoolFieldUpdateOperationsInput | boolean
    image?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    sessions?: SessionUncheckedUpdateManyWithoutUserNestedInput
    accounts?: AccountUncheckedUpdateManyWithoutUserNestedInput
    createdOrders?: OrderUncheckedUpdateManyWithoutCreatedByNestedInput
    assignedWorkItems?: WorkItemUncheckedUpdateManyWithoutAssigneeNestedInput
    phaseTimings?: PhaseTimingUncheckedUpdateManyWithoutUserNestedInput
  }

  export type WorkItemCreateWithoutPhaseTimingsInput = {
    id?: string
    productTypeId?: string | null
    state: $Enums.WorkItemState
    requiresDesign?: boolean
    requiresReview?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    order: OrderCreateNestedOneWithoutWorkItemsInput
    department?: DepartmentCreateNestedOneWithoutWorkItemsInput
    assignee?: UserCreateNestedOneWithoutAssignedWorkItemsInput
    transitions?: WorkItemTransitionCreateNestedManyWithoutWorkItemInput
  }

  export type WorkItemUncheckedCreateWithoutPhaseTimingsInput = {
    id?: string
    orderId: string
    productTypeId?: string | null
    departmentId?: string | null
    state: $Enums.WorkItemState
    requiresDesign?: boolean
    requiresReview?: boolean
    assigneeId?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    transitions?: WorkItemTransitionUncheckedCreateNestedManyWithoutWorkItemInput
  }

  export type WorkItemCreateOrConnectWithoutPhaseTimingsInput = {
    where: WorkItemWhereUniqueInput
    create: XOR<WorkItemCreateWithoutPhaseTimingsInput, WorkItemUncheckedCreateWithoutPhaseTimingsInput>
  }

  export type UserCreateWithoutPhaseTimingsInput = {
    id: string
    name: string
    email: string
    emailVerified?: boolean
    image?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    sessions?: SessionCreateNestedManyWithoutUserInput
    accounts?: AccountCreateNestedManyWithoutUserInput
    createdOrders?: OrderCreateNestedManyWithoutCreatedByInput
    assignedWorkItems?: WorkItemCreateNestedManyWithoutAssigneeInput
    workItemTransitions?: WorkItemTransitionCreateNestedManyWithoutActorInput
  }

  export type UserUncheckedCreateWithoutPhaseTimingsInput = {
    id: string
    name: string
    email: string
    emailVerified?: boolean
    image?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    sessions?: SessionUncheckedCreateNestedManyWithoutUserInput
    accounts?: AccountUncheckedCreateNestedManyWithoutUserInput
    createdOrders?: OrderUncheckedCreateNestedManyWithoutCreatedByInput
    assignedWorkItems?: WorkItemUncheckedCreateNestedManyWithoutAssigneeInput
    workItemTransitions?: WorkItemTransitionUncheckedCreateNestedManyWithoutActorInput
  }

  export type UserCreateOrConnectWithoutPhaseTimingsInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutPhaseTimingsInput, UserUncheckedCreateWithoutPhaseTimingsInput>
  }

  export type WorkItemUpsertWithoutPhaseTimingsInput = {
    update: XOR<WorkItemUpdateWithoutPhaseTimingsInput, WorkItemUncheckedUpdateWithoutPhaseTimingsInput>
    create: XOR<WorkItemCreateWithoutPhaseTimingsInput, WorkItemUncheckedCreateWithoutPhaseTimingsInput>
    where?: WorkItemWhereInput
  }

  export type WorkItemUpdateToOneWithWhereWithoutPhaseTimingsInput = {
    where?: WorkItemWhereInput
    data: XOR<WorkItemUpdateWithoutPhaseTimingsInput, WorkItemUncheckedUpdateWithoutPhaseTimingsInput>
  }

  export type WorkItemUpdateWithoutPhaseTimingsInput = {
    id?: StringFieldUpdateOperationsInput | string
    productTypeId?: NullableStringFieldUpdateOperationsInput | string | null
    state?: EnumWorkItemStateFieldUpdateOperationsInput | $Enums.WorkItemState
    requiresDesign?: BoolFieldUpdateOperationsInput | boolean
    requiresReview?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    order?: OrderUpdateOneRequiredWithoutWorkItemsNestedInput
    department?: DepartmentUpdateOneWithoutWorkItemsNestedInput
    assignee?: UserUpdateOneWithoutAssignedWorkItemsNestedInput
    transitions?: WorkItemTransitionUpdateManyWithoutWorkItemNestedInput
  }

  export type WorkItemUncheckedUpdateWithoutPhaseTimingsInput = {
    id?: StringFieldUpdateOperationsInput | string
    orderId?: StringFieldUpdateOperationsInput | string
    productTypeId?: NullableStringFieldUpdateOperationsInput | string | null
    departmentId?: NullableStringFieldUpdateOperationsInput | string | null
    state?: EnumWorkItemStateFieldUpdateOperationsInput | $Enums.WorkItemState
    requiresDesign?: BoolFieldUpdateOperationsInput | boolean
    requiresReview?: BoolFieldUpdateOperationsInput | boolean
    assigneeId?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    transitions?: WorkItemTransitionUncheckedUpdateManyWithoutWorkItemNestedInput
  }

  export type UserUpsertWithoutPhaseTimingsInput = {
    update: XOR<UserUpdateWithoutPhaseTimingsInput, UserUncheckedUpdateWithoutPhaseTimingsInput>
    create: XOR<UserCreateWithoutPhaseTimingsInput, UserUncheckedCreateWithoutPhaseTimingsInput>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutPhaseTimingsInput = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutPhaseTimingsInput, UserUncheckedUpdateWithoutPhaseTimingsInput>
  }

  export type UserUpdateWithoutPhaseTimingsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    emailVerified?: BoolFieldUpdateOperationsInput | boolean
    image?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    sessions?: SessionUpdateManyWithoutUserNestedInput
    accounts?: AccountUpdateManyWithoutUserNestedInput
    createdOrders?: OrderUpdateManyWithoutCreatedByNestedInput
    assignedWorkItems?: WorkItemUpdateManyWithoutAssigneeNestedInput
    workItemTransitions?: WorkItemTransitionUpdateManyWithoutActorNestedInput
  }

  export type UserUncheckedUpdateWithoutPhaseTimingsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    emailVerified?: BoolFieldUpdateOperationsInput | boolean
    image?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    sessions?: SessionUncheckedUpdateManyWithoutUserNestedInput
    accounts?: AccountUncheckedUpdateManyWithoutUserNestedInput
    createdOrders?: OrderUncheckedUpdateManyWithoutCreatedByNestedInput
    assignedWorkItems?: WorkItemUncheckedUpdateManyWithoutAssigneeNestedInput
    workItemTransitions?: WorkItemTransitionUncheckedUpdateManyWithoutActorNestedInput
  }

  export type SessionCreateWithoutUserInput = {
    id: string
    expiresAt: Date | string
    token: string
    createdAt?: Date | string
    updatedAt?: Date | string
    ipAddress?: string | null
    userAgent?: string | null
  }

  export type SessionUncheckedCreateWithoutUserInput = {
    id: string
    expiresAt: Date | string
    token: string
    createdAt?: Date | string
    updatedAt?: Date | string
    ipAddress?: string | null
    userAgent?: string | null
  }

  export type SessionCreateOrConnectWithoutUserInput = {
    where: SessionWhereUniqueInput
    create: XOR<SessionCreateWithoutUserInput, SessionUncheckedCreateWithoutUserInput>
  }

  export type SessionCreateManyUserInputEnvelope = {
    data: SessionCreateManyUserInput | SessionCreateManyUserInput[]
    skipDuplicates?: boolean
  }

  export type AccountCreateWithoutUserInput = {
    id: string
    accountId: string
    providerId: string
    accessToken?: string | null
    refreshToken?: string | null
    idToken?: string | null
    accessTokenExpiresAt?: Date | string | null
    refreshTokenExpiresAt?: Date | string | null
    scope?: string | null
    password?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type AccountUncheckedCreateWithoutUserInput = {
    id: string
    accountId: string
    providerId: string
    accessToken?: string | null
    refreshToken?: string | null
    idToken?: string | null
    accessTokenExpiresAt?: Date | string | null
    refreshTokenExpiresAt?: Date | string | null
    scope?: string | null
    password?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type AccountCreateOrConnectWithoutUserInput = {
    where: AccountWhereUniqueInput
    create: XOR<AccountCreateWithoutUserInput, AccountUncheckedCreateWithoutUserInput>
  }

  export type AccountCreateManyUserInputEnvelope = {
    data: AccountCreateManyUserInput | AccountCreateManyUserInput[]
    skipDuplicates?: boolean
  }

  export type OrderCreateWithoutCreatedByInput = {
    id?: string
    number: number
    channel: $Enums.OrderChannel
    priority: $Enums.OrderPriority
    mode: $Enums.OrderMode
    createdAt?: Date | string
    customer: CustomerCreateNestedOneWithoutOrdersInput
    workItems?: WorkItemCreateNestedManyWithoutOrderInput
  }

  export type OrderUncheckedCreateWithoutCreatedByInput = {
    id?: string
    number: number
    customerId: string
    channel: $Enums.OrderChannel
    priority: $Enums.OrderPriority
    mode: $Enums.OrderMode
    createdAt?: Date | string
    workItems?: WorkItemUncheckedCreateNestedManyWithoutOrderInput
  }

  export type OrderCreateOrConnectWithoutCreatedByInput = {
    where: OrderWhereUniqueInput
    create: XOR<OrderCreateWithoutCreatedByInput, OrderUncheckedCreateWithoutCreatedByInput>
  }

  export type OrderCreateManyCreatedByInputEnvelope = {
    data: OrderCreateManyCreatedByInput | OrderCreateManyCreatedByInput[]
    skipDuplicates?: boolean
  }

  export type WorkItemCreateWithoutAssigneeInput = {
    id?: string
    productTypeId?: string | null
    state: $Enums.WorkItemState
    requiresDesign?: boolean
    requiresReview?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    order: OrderCreateNestedOneWithoutWorkItemsInput
    department?: DepartmentCreateNestedOneWithoutWorkItemsInput
    transitions?: WorkItemTransitionCreateNestedManyWithoutWorkItemInput
    phaseTimings?: PhaseTimingCreateNestedManyWithoutWorkItemInput
  }

  export type WorkItemUncheckedCreateWithoutAssigneeInput = {
    id?: string
    orderId: string
    productTypeId?: string | null
    departmentId?: string | null
    state: $Enums.WorkItemState
    requiresDesign?: boolean
    requiresReview?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    transitions?: WorkItemTransitionUncheckedCreateNestedManyWithoutWorkItemInput
    phaseTimings?: PhaseTimingUncheckedCreateNestedManyWithoutWorkItemInput
  }

  export type WorkItemCreateOrConnectWithoutAssigneeInput = {
    where: WorkItemWhereUniqueInput
    create: XOR<WorkItemCreateWithoutAssigneeInput, WorkItemUncheckedCreateWithoutAssigneeInput>
  }

  export type WorkItemCreateManyAssigneeInputEnvelope = {
    data: WorkItemCreateManyAssigneeInput | WorkItemCreateManyAssigneeInput[]
    skipDuplicates?: boolean
  }

  export type WorkItemTransitionCreateWithoutActorInput = {
    id?: string
    from: $Enums.WorkItemState
    to: $Enums.WorkItemState
    at?: Date | string
    reason?: string | null
    rejectionCategory?: $Enums.RejectionCategory | null
    meta?: NullableJsonNullValueInput | InputJsonValue
    workItem: WorkItemCreateNestedOneWithoutTransitionsInput
  }

  export type WorkItemTransitionUncheckedCreateWithoutActorInput = {
    id?: string
    workItemId: string
    from: $Enums.WorkItemState
    to: $Enums.WorkItemState
    at?: Date | string
    reason?: string | null
    rejectionCategory?: $Enums.RejectionCategory | null
    meta?: NullableJsonNullValueInput | InputJsonValue
  }

  export type WorkItemTransitionCreateOrConnectWithoutActorInput = {
    where: WorkItemTransitionWhereUniqueInput
    create: XOR<WorkItemTransitionCreateWithoutActorInput, WorkItemTransitionUncheckedCreateWithoutActorInput>
  }

  export type WorkItemTransitionCreateManyActorInputEnvelope = {
    data: WorkItemTransitionCreateManyActorInput | WorkItemTransitionCreateManyActorInput[]
    skipDuplicates?: boolean
  }

  export type PhaseTimingCreateWithoutUserInput = {
    id?: string
    phase: $Enums.WorkItemState
    kind: $Enums.PhaseTimingKind
    startedAt: Date | string
    endedAt?: Date | string | null
    workItem: WorkItemCreateNestedOneWithoutPhaseTimingsInput
  }

  export type PhaseTimingUncheckedCreateWithoutUserInput = {
    id?: string
    workItemId: string
    phase: $Enums.WorkItemState
    kind: $Enums.PhaseTimingKind
    startedAt: Date | string
    endedAt?: Date | string | null
  }

  export type PhaseTimingCreateOrConnectWithoutUserInput = {
    where: PhaseTimingWhereUniqueInput
    create: XOR<PhaseTimingCreateWithoutUserInput, PhaseTimingUncheckedCreateWithoutUserInput>
  }

  export type PhaseTimingCreateManyUserInputEnvelope = {
    data: PhaseTimingCreateManyUserInput | PhaseTimingCreateManyUserInput[]
    skipDuplicates?: boolean
  }

  export type SessionUpsertWithWhereUniqueWithoutUserInput = {
    where: SessionWhereUniqueInput
    update: XOR<SessionUpdateWithoutUserInput, SessionUncheckedUpdateWithoutUserInput>
    create: XOR<SessionCreateWithoutUserInput, SessionUncheckedCreateWithoutUserInput>
  }

  export type SessionUpdateWithWhereUniqueWithoutUserInput = {
    where: SessionWhereUniqueInput
    data: XOR<SessionUpdateWithoutUserInput, SessionUncheckedUpdateWithoutUserInput>
  }

  export type SessionUpdateManyWithWhereWithoutUserInput = {
    where: SessionScalarWhereInput
    data: XOR<SessionUpdateManyMutationInput, SessionUncheckedUpdateManyWithoutUserInput>
  }

  export type SessionScalarWhereInput = {
    AND?: SessionScalarWhereInput | SessionScalarWhereInput[]
    OR?: SessionScalarWhereInput[]
    NOT?: SessionScalarWhereInput | SessionScalarWhereInput[]
    id?: StringFilter<"Session"> | string
    expiresAt?: DateTimeFilter<"Session"> | Date | string
    token?: StringFilter<"Session"> | string
    createdAt?: DateTimeFilter<"Session"> | Date | string
    updatedAt?: DateTimeFilter<"Session"> | Date | string
    ipAddress?: StringNullableFilter<"Session"> | string | null
    userAgent?: StringNullableFilter<"Session"> | string | null
    userId?: StringFilter<"Session"> | string
  }

  export type AccountUpsertWithWhereUniqueWithoutUserInput = {
    where: AccountWhereUniqueInput
    update: XOR<AccountUpdateWithoutUserInput, AccountUncheckedUpdateWithoutUserInput>
    create: XOR<AccountCreateWithoutUserInput, AccountUncheckedCreateWithoutUserInput>
  }

  export type AccountUpdateWithWhereUniqueWithoutUserInput = {
    where: AccountWhereUniqueInput
    data: XOR<AccountUpdateWithoutUserInput, AccountUncheckedUpdateWithoutUserInput>
  }

  export type AccountUpdateManyWithWhereWithoutUserInput = {
    where: AccountScalarWhereInput
    data: XOR<AccountUpdateManyMutationInput, AccountUncheckedUpdateManyWithoutUserInput>
  }

  export type AccountScalarWhereInput = {
    AND?: AccountScalarWhereInput | AccountScalarWhereInput[]
    OR?: AccountScalarWhereInput[]
    NOT?: AccountScalarWhereInput | AccountScalarWhereInput[]
    id?: StringFilter<"Account"> | string
    accountId?: StringFilter<"Account"> | string
    providerId?: StringFilter<"Account"> | string
    userId?: StringFilter<"Account"> | string
    accessToken?: StringNullableFilter<"Account"> | string | null
    refreshToken?: StringNullableFilter<"Account"> | string | null
    idToken?: StringNullableFilter<"Account"> | string | null
    accessTokenExpiresAt?: DateTimeNullableFilter<"Account"> | Date | string | null
    refreshTokenExpiresAt?: DateTimeNullableFilter<"Account"> | Date | string | null
    scope?: StringNullableFilter<"Account"> | string | null
    password?: StringNullableFilter<"Account"> | string | null
    createdAt?: DateTimeFilter<"Account"> | Date | string
    updatedAt?: DateTimeFilter<"Account"> | Date | string
  }

  export type OrderUpsertWithWhereUniqueWithoutCreatedByInput = {
    where: OrderWhereUniqueInput
    update: XOR<OrderUpdateWithoutCreatedByInput, OrderUncheckedUpdateWithoutCreatedByInput>
    create: XOR<OrderCreateWithoutCreatedByInput, OrderUncheckedCreateWithoutCreatedByInput>
  }

  export type OrderUpdateWithWhereUniqueWithoutCreatedByInput = {
    where: OrderWhereUniqueInput
    data: XOR<OrderUpdateWithoutCreatedByInput, OrderUncheckedUpdateWithoutCreatedByInput>
  }

  export type OrderUpdateManyWithWhereWithoutCreatedByInput = {
    where: OrderScalarWhereInput
    data: XOR<OrderUpdateManyMutationInput, OrderUncheckedUpdateManyWithoutCreatedByInput>
  }

  export type WorkItemUpsertWithWhereUniqueWithoutAssigneeInput = {
    where: WorkItemWhereUniqueInput
    update: XOR<WorkItemUpdateWithoutAssigneeInput, WorkItemUncheckedUpdateWithoutAssigneeInput>
    create: XOR<WorkItemCreateWithoutAssigneeInput, WorkItemUncheckedCreateWithoutAssigneeInput>
  }

  export type WorkItemUpdateWithWhereUniqueWithoutAssigneeInput = {
    where: WorkItemWhereUniqueInput
    data: XOR<WorkItemUpdateWithoutAssigneeInput, WorkItemUncheckedUpdateWithoutAssigneeInput>
  }

  export type WorkItemUpdateManyWithWhereWithoutAssigneeInput = {
    where: WorkItemScalarWhereInput
    data: XOR<WorkItemUpdateManyMutationInput, WorkItemUncheckedUpdateManyWithoutAssigneeInput>
  }

  export type WorkItemTransitionUpsertWithWhereUniqueWithoutActorInput = {
    where: WorkItemTransitionWhereUniqueInput
    update: XOR<WorkItemTransitionUpdateWithoutActorInput, WorkItemTransitionUncheckedUpdateWithoutActorInput>
    create: XOR<WorkItemTransitionCreateWithoutActorInput, WorkItemTransitionUncheckedCreateWithoutActorInput>
  }

  export type WorkItemTransitionUpdateWithWhereUniqueWithoutActorInput = {
    where: WorkItemTransitionWhereUniqueInput
    data: XOR<WorkItemTransitionUpdateWithoutActorInput, WorkItemTransitionUncheckedUpdateWithoutActorInput>
  }

  export type WorkItemTransitionUpdateManyWithWhereWithoutActorInput = {
    where: WorkItemTransitionScalarWhereInput
    data: XOR<WorkItemTransitionUpdateManyMutationInput, WorkItemTransitionUncheckedUpdateManyWithoutActorInput>
  }

  export type PhaseTimingUpsertWithWhereUniqueWithoutUserInput = {
    where: PhaseTimingWhereUniqueInput
    update: XOR<PhaseTimingUpdateWithoutUserInput, PhaseTimingUncheckedUpdateWithoutUserInput>
    create: XOR<PhaseTimingCreateWithoutUserInput, PhaseTimingUncheckedCreateWithoutUserInput>
  }

  export type PhaseTimingUpdateWithWhereUniqueWithoutUserInput = {
    where: PhaseTimingWhereUniqueInput
    data: XOR<PhaseTimingUpdateWithoutUserInput, PhaseTimingUncheckedUpdateWithoutUserInput>
  }

  export type PhaseTimingUpdateManyWithWhereWithoutUserInput = {
    where: PhaseTimingScalarWhereInput
    data: XOR<PhaseTimingUpdateManyMutationInput, PhaseTimingUncheckedUpdateManyWithoutUserInput>
  }

  export type UserCreateWithoutSessionsInput = {
    id: string
    name: string
    email: string
    emailVerified?: boolean
    image?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    accounts?: AccountCreateNestedManyWithoutUserInput
    createdOrders?: OrderCreateNestedManyWithoutCreatedByInput
    assignedWorkItems?: WorkItemCreateNestedManyWithoutAssigneeInput
    workItemTransitions?: WorkItemTransitionCreateNestedManyWithoutActorInput
    phaseTimings?: PhaseTimingCreateNestedManyWithoutUserInput
  }

  export type UserUncheckedCreateWithoutSessionsInput = {
    id: string
    name: string
    email: string
    emailVerified?: boolean
    image?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    accounts?: AccountUncheckedCreateNestedManyWithoutUserInput
    createdOrders?: OrderUncheckedCreateNestedManyWithoutCreatedByInput
    assignedWorkItems?: WorkItemUncheckedCreateNestedManyWithoutAssigneeInput
    workItemTransitions?: WorkItemTransitionUncheckedCreateNestedManyWithoutActorInput
    phaseTimings?: PhaseTimingUncheckedCreateNestedManyWithoutUserInput
  }

  export type UserCreateOrConnectWithoutSessionsInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutSessionsInput, UserUncheckedCreateWithoutSessionsInput>
  }

  export type UserUpsertWithoutSessionsInput = {
    update: XOR<UserUpdateWithoutSessionsInput, UserUncheckedUpdateWithoutSessionsInput>
    create: XOR<UserCreateWithoutSessionsInput, UserUncheckedCreateWithoutSessionsInput>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutSessionsInput = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutSessionsInput, UserUncheckedUpdateWithoutSessionsInput>
  }

  export type UserUpdateWithoutSessionsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    emailVerified?: BoolFieldUpdateOperationsInput | boolean
    image?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    accounts?: AccountUpdateManyWithoutUserNestedInput
    createdOrders?: OrderUpdateManyWithoutCreatedByNestedInput
    assignedWorkItems?: WorkItemUpdateManyWithoutAssigneeNestedInput
    workItemTransitions?: WorkItemTransitionUpdateManyWithoutActorNestedInput
    phaseTimings?: PhaseTimingUpdateManyWithoutUserNestedInput
  }

  export type UserUncheckedUpdateWithoutSessionsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    emailVerified?: BoolFieldUpdateOperationsInput | boolean
    image?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    accounts?: AccountUncheckedUpdateManyWithoutUserNestedInput
    createdOrders?: OrderUncheckedUpdateManyWithoutCreatedByNestedInput
    assignedWorkItems?: WorkItemUncheckedUpdateManyWithoutAssigneeNestedInput
    workItemTransitions?: WorkItemTransitionUncheckedUpdateManyWithoutActorNestedInput
    phaseTimings?: PhaseTimingUncheckedUpdateManyWithoutUserNestedInput
  }

  export type UserCreateWithoutAccountsInput = {
    id: string
    name: string
    email: string
    emailVerified?: boolean
    image?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    sessions?: SessionCreateNestedManyWithoutUserInput
    createdOrders?: OrderCreateNestedManyWithoutCreatedByInput
    assignedWorkItems?: WorkItemCreateNestedManyWithoutAssigneeInput
    workItemTransitions?: WorkItemTransitionCreateNestedManyWithoutActorInput
    phaseTimings?: PhaseTimingCreateNestedManyWithoutUserInput
  }

  export type UserUncheckedCreateWithoutAccountsInput = {
    id: string
    name: string
    email: string
    emailVerified?: boolean
    image?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    sessions?: SessionUncheckedCreateNestedManyWithoutUserInput
    createdOrders?: OrderUncheckedCreateNestedManyWithoutCreatedByInput
    assignedWorkItems?: WorkItemUncheckedCreateNestedManyWithoutAssigneeInput
    workItemTransitions?: WorkItemTransitionUncheckedCreateNestedManyWithoutActorInput
    phaseTimings?: PhaseTimingUncheckedCreateNestedManyWithoutUserInput
  }

  export type UserCreateOrConnectWithoutAccountsInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutAccountsInput, UserUncheckedCreateWithoutAccountsInput>
  }

  export type UserUpsertWithoutAccountsInput = {
    update: XOR<UserUpdateWithoutAccountsInput, UserUncheckedUpdateWithoutAccountsInput>
    create: XOR<UserCreateWithoutAccountsInput, UserUncheckedCreateWithoutAccountsInput>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutAccountsInput = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutAccountsInput, UserUncheckedUpdateWithoutAccountsInput>
  }

  export type UserUpdateWithoutAccountsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    emailVerified?: BoolFieldUpdateOperationsInput | boolean
    image?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    sessions?: SessionUpdateManyWithoutUserNestedInput
    createdOrders?: OrderUpdateManyWithoutCreatedByNestedInput
    assignedWorkItems?: WorkItemUpdateManyWithoutAssigneeNestedInput
    workItemTransitions?: WorkItemTransitionUpdateManyWithoutActorNestedInput
    phaseTimings?: PhaseTimingUpdateManyWithoutUserNestedInput
  }

  export type UserUncheckedUpdateWithoutAccountsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    emailVerified?: BoolFieldUpdateOperationsInput | boolean
    image?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    sessions?: SessionUncheckedUpdateManyWithoutUserNestedInput
    createdOrders?: OrderUncheckedUpdateManyWithoutCreatedByNestedInput
    assignedWorkItems?: WorkItemUncheckedUpdateManyWithoutAssigneeNestedInput
    workItemTransitions?: WorkItemTransitionUncheckedUpdateManyWithoutActorNestedInput
    phaseTimings?: PhaseTimingUncheckedUpdateManyWithoutUserNestedInput
  }

  export type WorkItemCreateManyDepartmentInput = {
    id?: string
    orderId: string
    productTypeId?: string | null
    state: $Enums.WorkItemState
    requiresDesign?: boolean
    requiresReview?: boolean
    assigneeId?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type WorkItemUpdateWithoutDepartmentInput = {
    id?: StringFieldUpdateOperationsInput | string
    productTypeId?: NullableStringFieldUpdateOperationsInput | string | null
    state?: EnumWorkItemStateFieldUpdateOperationsInput | $Enums.WorkItemState
    requiresDesign?: BoolFieldUpdateOperationsInput | boolean
    requiresReview?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    order?: OrderUpdateOneRequiredWithoutWorkItemsNestedInput
    assignee?: UserUpdateOneWithoutAssignedWorkItemsNestedInput
    transitions?: WorkItemTransitionUpdateManyWithoutWorkItemNestedInput
    phaseTimings?: PhaseTimingUpdateManyWithoutWorkItemNestedInput
  }

  export type WorkItemUncheckedUpdateWithoutDepartmentInput = {
    id?: StringFieldUpdateOperationsInput | string
    orderId?: StringFieldUpdateOperationsInput | string
    productTypeId?: NullableStringFieldUpdateOperationsInput | string | null
    state?: EnumWorkItemStateFieldUpdateOperationsInput | $Enums.WorkItemState
    requiresDesign?: BoolFieldUpdateOperationsInput | boolean
    requiresReview?: BoolFieldUpdateOperationsInput | boolean
    assigneeId?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    transitions?: WorkItemTransitionUncheckedUpdateManyWithoutWorkItemNestedInput
    phaseTimings?: PhaseTimingUncheckedUpdateManyWithoutWorkItemNestedInput
  }

  export type WorkItemUncheckedUpdateManyWithoutDepartmentInput = {
    id?: StringFieldUpdateOperationsInput | string
    orderId?: StringFieldUpdateOperationsInput | string
    productTypeId?: NullableStringFieldUpdateOperationsInput | string | null
    state?: EnumWorkItemStateFieldUpdateOperationsInput | $Enums.WorkItemState
    requiresDesign?: BoolFieldUpdateOperationsInput | boolean
    requiresReview?: BoolFieldUpdateOperationsInput | boolean
    assigneeId?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type OrderCreateManyCustomerInput = {
    id?: string
    number: number
    channel: $Enums.OrderChannel
    priority: $Enums.OrderPriority
    mode: $Enums.OrderMode
    createdById: string
    createdAt?: Date | string
  }

  export type OrderUpdateWithoutCustomerInput = {
    id?: StringFieldUpdateOperationsInput | string
    number?: IntFieldUpdateOperationsInput | number
    channel?: EnumOrderChannelFieldUpdateOperationsInput | $Enums.OrderChannel
    priority?: EnumOrderPriorityFieldUpdateOperationsInput | $Enums.OrderPriority
    mode?: EnumOrderModeFieldUpdateOperationsInput | $Enums.OrderMode
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    createdBy?: UserUpdateOneRequiredWithoutCreatedOrdersNestedInput
    workItems?: WorkItemUpdateManyWithoutOrderNestedInput
  }

  export type OrderUncheckedUpdateWithoutCustomerInput = {
    id?: StringFieldUpdateOperationsInput | string
    number?: IntFieldUpdateOperationsInput | number
    channel?: EnumOrderChannelFieldUpdateOperationsInput | $Enums.OrderChannel
    priority?: EnumOrderPriorityFieldUpdateOperationsInput | $Enums.OrderPriority
    mode?: EnumOrderModeFieldUpdateOperationsInput | $Enums.OrderMode
    createdById?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    workItems?: WorkItemUncheckedUpdateManyWithoutOrderNestedInput
  }

  export type OrderUncheckedUpdateManyWithoutCustomerInput = {
    id?: StringFieldUpdateOperationsInput | string
    number?: IntFieldUpdateOperationsInput | number
    channel?: EnumOrderChannelFieldUpdateOperationsInput | $Enums.OrderChannel
    priority?: EnumOrderPriorityFieldUpdateOperationsInput | $Enums.OrderPriority
    mode?: EnumOrderModeFieldUpdateOperationsInput | $Enums.OrderMode
    createdById?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type WorkItemCreateManyOrderInput = {
    id?: string
    productTypeId?: string | null
    departmentId?: string | null
    state: $Enums.WorkItemState
    requiresDesign?: boolean
    requiresReview?: boolean
    assigneeId?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type WorkItemUpdateWithoutOrderInput = {
    id?: StringFieldUpdateOperationsInput | string
    productTypeId?: NullableStringFieldUpdateOperationsInput | string | null
    state?: EnumWorkItemStateFieldUpdateOperationsInput | $Enums.WorkItemState
    requiresDesign?: BoolFieldUpdateOperationsInput | boolean
    requiresReview?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    department?: DepartmentUpdateOneWithoutWorkItemsNestedInput
    assignee?: UserUpdateOneWithoutAssignedWorkItemsNestedInput
    transitions?: WorkItemTransitionUpdateManyWithoutWorkItemNestedInput
    phaseTimings?: PhaseTimingUpdateManyWithoutWorkItemNestedInput
  }

  export type WorkItemUncheckedUpdateWithoutOrderInput = {
    id?: StringFieldUpdateOperationsInput | string
    productTypeId?: NullableStringFieldUpdateOperationsInput | string | null
    departmentId?: NullableStringFieldUpdateOperationsInput | string | null
    state?: EnumWorkItemStateFieldUpdateOperationsInput | $Enums.WorkItemState
    requiresDesign?: BoolFieldUpdateOperationsInput | boolean
    requiresReview?: BoolFieldUpdateOperationsInput | boolean
    assigneeId?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    transitions?: WorkItemTransitionUncheckedUpdateManyWithoutWorkItemNestedInput
    phaseTimings?: PhaseTimingUncheckedUpdateManyWithoutWorkItemNestedInput
  }

  export type WorkItemUncheckedUpdateManyWithoutOrderInput = {
    id?: StringFieldUpdateOperationsInput | string
    productTypeId?: NullableStringFieldUpdateOperationsInput | string | null
    departmentId?: NullableStringFieldUpdateOperationsInput | string | null
    state?: EnumWorkItemStateFieldUpdateOperationsInput | $Enums.WorkItemState
    requiresDesign?: BoolFieldUpdateOperationsInput | boolean
    requiresReview?: BoolFieldUpdateOperationsInput | boolean
    assigneeId?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type WorkItemTransitionCreateManyWorkItemInput = {
    id?: string
    from: $Enums.WorkItemState
    to: $Enums.WorkItemState
    actorId: string
    at?: Date | string
    reason?: string | null
    rejectionCategory?: $Enums.RejectionCategory | null
    meta?: NullableJsonNullValueInput | InputJsonValue
  }

  export type PhaseTimingCreateManyWorkItemInput = {
    id?: string
    phase: $Enums.WorkItemState
    userId?: string | null
    kind: $Enums.PhaseTimingKind
    startedAt: Date | string
    endedAt?: Date | string | null
  }

  export type WorkItemTransitionUpdateWithoutWorkItemInput = {
    id?: StringFieldUpdateOperationsInput | string
    from?: EnumWorkItemStateFieldUpdateOperationsInput | $Enums.WorkItemState
    to?: EnumWorkItemStateFieldUpdateOperationsInput | $Enums.WorkItemState
    at?: DateTimeFieldUpdateOperationsInput | Date | string
    reason?: NullableStringFieldUpdateOperationsInput | string | null
    rejectionCategory?: NullableEnumRejectionCategoryFieldUpdateOperationsInput | $Enums.RejectionCategory | null
    meta?: NullableJsonNullValueInput | InputJsonValue
    actor?: UserUpdateOneRequiredWithoutWorkItemTransitionsNestedInput
  }

  export type WorkItemTransitionUncheckedUpdateWithoutWorkItemInput = {
    id?: StringFieldUpdateOperationsInput | string
    from?: EnumWorkItemStateFieldUpdateOperationsInput | $Enums.WorkItemState
    to?: EnumWorkItemStateFieldUpdateOperationsInput | $Enums.WorkItemState
    actorId?: StringFieldUpdateOperationsInput | string
    at?: DateTimeFieldUpdateOperationsInput | Date | string
    reason?: NullableStringFieldUpdateOperationsInput | string | null
    rejectionCategory?: NullableEnumRejectionCategoryFieldUpdateOperationsInput | $Enums.RejectionCategory | null
    meta?: NullableJsonNullValueInput | InputJsonValue
  }

  export type WorkItemTransitionUncheckedUpdateManyWithoutWorkItemInput = {
    id?: StringFieldUpdateOperationsInput | string
    from?: EnumWorkItemStateFieldUpdateOperationsInput | $Enums.WorkItemState
    to?: EnumWorkItemStateFieldUpdateOperationsInput | $Enums.WorkItemState
    actorId?: StringFieldUpdateOperationsInput | string
    at?: DateTimeFieldUpdateOperationsInput | Date | string
    reason?: NullableStringFieldUpdateOperationsInput | string | null
    rejectionCategory?: NullableEnumRejectionCategoryFieldUpdateOperationsInput | $Enums.RejectionCategory | null
    meta?: NullableJsonNullValueInput | InputJsonValue
  }

  export type PhaseTimingUpdateWithoutWorkItemInput = {
    id?: StringFieldUpdateOperationsInput | string
    phase?: EnumWorkItemStateFieldUpdateOperationsInput | $Enums.WorkItemState
    kind?: EnumPhaseTimingKindFieldUpdateOperationsInput | $Enums.PhaseTimingKind
    startedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    endedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    user?: UserUpdateOneWithoutPhaseTimingsNestedInput
  }

  export type PhaseTimingUncheckedUpdateWithoutWorkItemInput = {
    id?: StringFieldUpdateOperationsInput | string
    phase?: EnumWorkItemStateFieldUpdateOperationsInput | $Enums.WorkItemState
    userId?: NullableStringFieldUpdateOperationsInput | string | null
    kind?: EnumPhaseTimingKindFieldUpdateOperationsInput | $Enums.PhaseTimingKind
    startedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    endedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type PhaseTimingUncheckedUpdateManyWithoutWorkItemInput = {
    id?: StringFieldUpdateOperationsInput | string
    phase?: EnumWorkItemStateFieldUpdateOperationsInput | $Enums.WorkItemState
    userId?: NullableStringFieldUpdateOperationsInput | string | null
    kind?: EnumPhaseTimingKindFieldUpdateOperationsInput | $Enums.PhaseTimingKind
    startedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    endedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type SessionCreateManyUserInput = {
    id: string
    expiresAt: Date | string
    token: string
    createdAt?: Date | string
    updatedAt?: Date | string
    ipAddress?: string | null
    userAgent?: string | null
  }

  export type AccountCreateManyUserInput = {
    id: string
    accountId: string
    providerId: string
    accessToken?: string | null
    refreshToken?: string | null
    idToken?: string | null
    accessTokenExpiresAt?: Date | string | null
    refreshTokenExpiresAt?: Date | string | null
    scope?: string | null
    password?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type OrderCreateManyCreatedByInput = {
    id?: string
    number: number
    customerId: string
    channel: $Enums.OrderChannel
    priority: $Enums.OrderPriority
    mode: $Enums.OrderMode
    createdAt?: Date | string
  }

  export type WorkItemCreateManyAssigneeInput = {
    id?: string
    orderId: string
    productTypeId?: string | null
    departmentId?: string | null
    state: $Enums.WorkItemState
    requiresDesign?: boolean
    requiresReview?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type WorkItemTransitionCreateManyActorInput = {
    id?: string
    workItemId: string
    from: $Enums.WorkItemState
    to: $Enums.WorkItemState
    at?: Date | string
    reason?: string | null
    rejectionCategory?: $Enums.RejectionCategory | null
    meta?: NullableJsonNullValueInput | InputJsonValue
  }

  export type PhaseTimingCreateManyUserInput = {
    id?: string
    workItemId: string
    phase: $Enums.WorkItemState
    kind: $Enums.PhaseTimingKind
    startedAt: Date | string
    endedAt?: Date | string | null
  }

  export type SessionUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
    token?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    ipAddress?: NullableStringFieldUpdateOperationsInput | string | null
    userAgent?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type SessionUncheckedUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
    token?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    ipAddress?: NullableStringFieldUpdateOperationsInput | string | null
    userAgent?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type SessionUncheckedUpdateManyWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
    token?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    ipAddress?: NullableStringFieldUpdateOperationsInput | string | null
    userAgent?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type AccountUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    accountId?: StringFieldUpdateOperationsInput | string
    providerId?: StringFieldUpdateOperationsInput | string
    accessToken?: NullableStringFieldUpdateOperationsInput | string | null
    refreshToken?: NullableStringFieldUpdateOperationsInput | string | null
    idToken?: NullableStringFieldUpdateOperationsInput | string | null
    accessTokenExpiresAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    refreshTokenExpiresAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    scope?: NullableStringFieldUpdateOperationsInput | string | null
    password?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AccountUncheckedUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    accountId?: StringFieldUpdateOperationsInput | string
    providerId?: StringFieldUpdateOperationsInput | string
    accessToken?: NullableStringFieldUpdateOperationsInput | string | null
    refreshToken?: NullableStringFieldUpdateOperationsInput | string | null
    idToken?: NullableStringFieldUpdateOperationsInput | string | null
    accessTokenExpiresAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    refreshTokenExpiresAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    scope?: NullableStringFieldUpdateOperationsInput | string | null
    password?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AccountUncheckedUpdateManyWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    accountId?: StringFieldUpdateOperationsInput | string
    providerId?: StringFieldUpdateOperationsInput | string
    accessToken?: NullableStringFieldUpdateOperationsInput | string | null
    refreshToken?: NullableStringFieldUpdateOperationsInput | string | null
    idToken?: NullableStringFieldUpdateOperationsInput | string | null
    accessTokenExpiresAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    refreshTokenExpiresAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    scope?: NullableStringFieldUpdateOperationsInput | string | null
    password?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type OrderUpdateWithoutCreatedByInput = {
    id?: StringFieldUpdateOperationsInput | string
    number?: IntFieldUpdateOperationsInput | number
    channel?: EnumOrderChannelFieldUpdateOperationsInput | $Enums.OrderChannel
    priority?: EnumOrderPriorityFieldUpdateOperationsInput | $Enums.OrderPriority
    mode?: EnumOrderModeFieldUpdateOperationsInput | $Enums.OrderMode
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    customer?: CustomerUpdateOneRequiredWithoutOrdersNestedInput
    workItems?: WorkItemUpdateManyWithoutOrderNestedInput
  }

  export type OrderUncheckedUpdateWithoutCreatedByInput = {
    id?: StringFieldUpdateOperationsInput | string
    number?: IntFieldUpdateOperationsInput | number
    customerId?: StringFieldUpdateOperationsInput | string
    channel?: EnumOrderChannelFieldUpdateOperationsInput | $Enums.OrderChannel
    priority?: EnumOrderPriorityFieldUpdateOperationsInput | $Enums.OrderPriority
    mode?: EnumOrderModeFieldUpdateOperationsInput | $Enums.OrderMode
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    workItems?: WorkItemUncheckedUpdateManyWithoutOrderNestedInput
  }

  export type OrderUncheckedUpdateManyWithoutCreatedByInput = {
    id?: StringFieldUpdateOperationsInput | string
    number?: IntFieldUpdateOperationsInput | number
    customerId?: StringFieldUpdateOperationsInput | string
    channel?: EnumOrderChannelFieldUpdateOperationsInput | $Enums.OrderChannel
    priority?: EnumOrderPriorityFieldUpdateOperationsInput | $Enums.OrderPriority
    mode?: EnumOrderModeFieldUpdateOperationsInput | $Enums.OrderMode
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type WorkItemUpdateWithoutAssigneeInput = {
    id?: StringFieldUpdateOperationsInput | string
    productTypeId?: NullableStringFieldUpdateOperationsInput | string | null
    state?: EnumWorkItemStateFieldUpdateOperationsInput | $Enums.WorkItemState
    requiresDesign?: BoolFieldUpdateOperationsInput | boolean
    requiresReview?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    order?: OrderUpdateOneRequiredWithoutWorkItemsNestedInput
    department?: DepartmentUpdateOneWithoutWorkItemsNestedInput
    transitions?: WorkItemTransitionUpdateManyWithoutWorkItemNestedInput
    phaseTimings?: PhaseTimingUpdateManyWithoutWorkItemNestedInput
  }

  export type WorkItemUncheckedUpdateWithoutAssigneeInput = {
    id?: StringFieldUpdateOperationsInput | string
    orderId?: StringFieldUpdateOperationsInput | string
    productTypeId?: NullableStringFieldUpdateOperationsInput | string | null
    departmentId?: NullableStringFieldUpdateOperationsInput | string | null
    state?: EnumWorkItemStateFieldUpdateOperationsInput | $Enums.WorkItemState
    requiresDesign?: BoolFieldUpdateOperationsInput | boolean
    requiresReview?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    transitions?: WorkItemTransitionUncheckedUpdateManyWithoutWorkItemNestedInput
    phaseTimings?: PhaseTimingUncheckedUpdateManyWithoutWorkItemNestedInput
  }

  export type WorkItemUncheckedUpdateManyWithoutAssigneeInput = {
    id?: StringFieldUpdateOperationsInput | string
    orderId?: StringFieldUpdateOperationsInput | string
    productTypeId?: NullableStringFieldUpdateOperationsInput | string | null
    departmentId?: NullableStringFieldUpdateOperationsInput | string | null
    state?: EnumWorkItemStateFieldUpdateOperationsInput | $Enums.WorkItemState
    requiresDesign?: BoolFieldUpdateOperationsInput | boolean
    requiresReview?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type WorkItemTransitionUpdateWithoutActorInput = {
    id?: StringFieldUpdateOperationsInput | string
    from?: EnumWorkItemStateFieldUpdateOperationsInput | $Enums.WorkItemState
    to?: EnumWorkItemStateFieldUpdateOperationsInput | $Enums.WorkItemState
    at?: DateTimeFieldUpdateOperationsInput | Date | string
    reason?: NullableStringFieldUpdateOperationsInput | string | null
    rejectionCategory?: NullableEnumRejectionCategoryFieldUpdateOperationsInput | $Enums.RejectionCategory | null
    meta?: NullableJsonNullValueInput | InputJsonValue
    workItem?: WorkItemUpdateOneRequiredWithoutTransitionsNestedInput
  }

  export type WorkItemTransitionUncheckedUpdateWithoutActorInput = {
    id?: StringFieldUpdateOperationsInput | string
    workItemId?: StringFieldUpdateOperationsInput | string
    from?: EnumWorkItemStateFieldUpdateOperationsInput | $Enums.WorkItemState
    to?: EnumWorkItemStateFieldUpdateOperationsInput | $Enums.WorkItemState
    at?: DateTimeFieldUpdateOperationsInput | Date | string
    reason?: NullableStringFieldUpdateOperationsInput | string | null
    rejectionCategory?: NullableEnumRejectionCategoryFieldUpdateOperationsInput | $Enums.RejectionCategory | null
    meta?: NullableJsonNullValueInput | InputJsonValue
  }

  export type WorkItemTransitionUncheckedUpdateManyWithoutActorInput = {
    id?: StringFieldUpdateOperationsInput | string
    workItemId?: StringFieldUpdateOperationsInput | string
    from?: EnumWorkItemStateFieldUpdateOperationsInput | $Enums.WorkItemState
    to?: EnumWorkItemStateFieldUpdateOperationsInput | $Enums.WorkItemState
    at?: DateTimeFieldUpdateOperationsInput | Date | string
    reason?: NullableStringFieldUpdateOperationsInput | string | null
    rejectionCategory?: NullableEnumRejectionCategoryFieldUpdateOperationsInput | $Enums.RejectionCategory | null
    meta?: NullableJsonNullValueInput | InputJsonValue
  }

  export type PhaseTimingUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    phase?: EnumWorkItemStateFieldUpdateOperationsInput | $Enums.WorkItemState
    kind?: EnumPhaseTimingKindFieldUpdateOperationsInput | $Enums.PhaseTimingKind
    startedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    endedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    workItem?: WorkItemUpdateOneRequiredWithoutPhaseTimingsNestedInput
  }

  export type PhaseTimingUncheckedUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    workItemId?: StringFieldUpdateOperationsInput | string
    phase?: EnumWorkItemStateFieldUpdateOperationsInput | $Enums.WorkItemState
    kind?: EnumPhaseTimingKindFieldUpdateOperationsInput | $Enums.PhaseTimingKind
    startedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    endedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type PhaseTimingUncheckedUpdateManyWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    workItemId?: StringFieldUpdateOperationsInput | string
    phase?: EnumWorkItemStateFieldUpdateOperationsInput | $Enums.WorkItemState
    kind?: EnumPhaseTimingKindFieldUpdateOperationsInput | $Enums.PhaseTimingKind
    startedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    endedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }



  /**
   * Batch Payload for updateMany & deleteMany & createMany
   */

  export type BatchPayload = {
    count: number
  }

  /**
   * DMMF
   */
  export const dmmf: runtime.BaseDMMF
}