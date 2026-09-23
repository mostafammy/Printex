# `<CustomerPicker>` Contract

Consumer: order-entry feature 011.

## Props

```ts
type CustomerPickerProps = {
  value?: string | null;
  onSelect: (customerId: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
};
```

The picker owns interaction state only. Customer validation, authorization, duplicate protection, and persistence remain server-side customer-service concerns.

## Required behavior

1. Render an Arabic-first, RTL search box with an accessible label.
2. Search as the user types through `findCustomers`.
3. Show bounded results with display name, useful phone suffix, classification when available, and archived/Cash status where relevant.
4. Support ArrowUp/ArrowDown, Enter to select, Escape to close results, and Tab without trapping focus.
5. Invoke `onSelect(customerId)` exactly once for a confirmed result.
6. Provide an inline “create new” action when no suitable result exists.
7. Inline creation requires name and one phone, invokes `createCustomer`, then calls `onSelect` with the returned ID.
8. On duplicate phone, show the existing customer and block creation; do not silently create another record.
9. Expose loading, empty, validation-error, unauthorized, and server-error states.
10. Do not expose payments/balances, special pricing, messages, or order-creation logic.

## Accessibility and localization

- Keyboard operation must cover the complete selection path.
- Results use a listbox/option interaction model with an announced active option.
- Directional styling uses logical start/end properties.
- User-visible strings are Arabic-first and localizable.
