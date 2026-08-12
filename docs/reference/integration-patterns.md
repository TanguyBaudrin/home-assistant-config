# Integration Patterns Reference

## RFLink (RF433 MHz devices)

- Serial port: `/dev/serial/by-id/usb-Arduino_...`
- Device types: Chacon plugs (`newkaku_*`), RTS covers, RF switches
- See [`configuration.yaml`](../../configuration.yaml) for the light platform configuration

## ZHA (Zigbee)

- Device-specific configs with MAC addresses for buttons, switches, lights
- See [`configuration.yaml`](../../configuration.yaml) for `device_config` examples

## Arlo cameras

- Separate config file: [`aarlo.yaml`](../../aarlo.yaml)
- Uses the SSE backend

## Utility meters (EDF Tempo energy tracking)

- All meters use the same 6 tariffs: `bleu_hc`, `bleu_hp`, `blanc_hc`, `blanc_hp`, `rouge_hc`, `rouge_hp`
- Consistent structure in [`utility_meters.yaml`](../../utility_meters.yaml)
- Input helpers for prices in [`input_numbers.yaml`](../../input_numbers.yaml)
- Tariff selection automated via `automations/energy/select_tariffs.yaml`

See [About EDF Tempo energy tracking](../explanation/tempo-energy-tracking.md) for the full design.

## Related

- [YAML & style guide](yaml-style-guide.md)
- [Tooling reference](tooling.md)
