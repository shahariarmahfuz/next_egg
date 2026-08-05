# Known System Limitations

## Technical & Architectural Scope Boundary

1. **Multi-Currency Support**:
   - The current version operates strictly in USD currency format (`$`).
2. **Third-Party Payment Gateway Integrations**:
   - Direct Stripe / PayPal API integrations are not embedded; transactions are recorded as manual vouchers (`cash`, `bank_transfer`, `cheque`, `card`, `mobile_wallet`).
3. **Real-time WebSockets**:
   - Updates utilize TanStack Query invalidation and HTTP polling instead of real-time WebSocket streams.
