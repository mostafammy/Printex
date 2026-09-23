# Customer Profile Slot Contract

## Core tabs

The profile renders these owned tabs:

- **Overview**: name, phones, classification, addresses, archive state, and customer metadata.
- **Orders**: active and completed orders; Cash Customer orders remain individually identifiable.
- **Notes**: customer-owned operational notes.

## Extension slots

The profile exposes stable empty slots without implementing their contents:

```ts
type CustomerProfileSlot = {
  slot: "payments-balance" | "special-pricing" | "messages";
  customerId: string;
  children?: React.ReactNode;
};
```

- `payments-balance` is owned by 052.
- `special-pricing` is owned by 051.
- `messages` is owned by 054.

Extensions must receive `customerId`, preserve profile authorization, and must not replace the core tabs or customer identity.
