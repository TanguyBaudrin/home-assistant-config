# About EDF Tempo Energy Tracking

## Background

The house is billed on the French **EDF Tempo** tariff. Tempo splits every day into one of three colors — **Bleu**, **Blanc**, **Rouge** — and within each day the price differs between **Heures Creuses** (HC, off-peak) and **Heures Pleines** (HP, peak). That gives six tariff periods:

| Color | HC | HP |
| ----- | -- | -- |
| Bleu  | bleu_hc | bleu_hp |
| Blanc | blanc_hc | blanc_hp |
| Rouge | rouge_hc | rouge_hp |

Rouge days are dramatically more expensive (HP can reach ~0.66 €/kWh), so knowing *which tariff period each watt is consumed in* matters for understanding the electricity bill.

## How the system is built

Three pieces cooperate to produce per-device cost tracking:

1. **Utility meters** ([`utility_meters.yaml`](../../utility_meters.yaml)) — every monitored device has a `*_energy` utility meter with `cycle: daily` and exactly those six tariffs. Each meter splits the device's consumption sensor into six tariff bins.

2. **Prices as inputs** ([`input_numbers.yaml`](../../input_numbers.yaml)) — the six prices live in `input_number.tarif_edf_tempo_*` helpers (plus `tarif_edf_*` for the legacy Base options). Keeping prices in helpers means they can be adjusted from the UI or an automation without touching YAML logic.

3. **Tariff selection** ([`automations/energy/select_tariffs.yaml`](../../automations/energy/select_tariffs.yaml)) — a `select` entity exists per meter. An automation watches `sensor.rte_tempo_couleur_actuelle` and `binary_sensor.rte_tempo_heures_creuses` (from the RTE integration) and sets the matching tariff option on every meter's select (`{color}_{hc|hp}`) whenever the color or the HC/HP window changes, including on Home Assistant startup.

## The daily cost calculation

Template sensors in [`templates.yaml`](../../templates.yaml) compute the cost: for each device, they multiply the energy recorded in each of the six bins by the corresponding price and sum the result, e.g. for the oven:

```jinja
{% set bh = states('sensor.four_energy_bleu_hc') | float(0) * states('input_number.tarif_edf_tempo_bleu_hc') | float(0) %}
{# ... bhp, blh, blhp, rh, rhp ... #}
{{ (bh + bhp + blh + blhp + rh + rhp) | round(2) }}
```

## Design rationale

- **Per-device granularity** — each smart plug and meter is tracked separately, so the cost of the oven, the freezer, or the servers can be compared and optimized.
- **Daily cycle** — meters reset daily, matching how the Tempo color changes each day at midnight.
- **Prices separated from logic** — the multiplication is pure templating; the numbers live in helpers, so tariff changes require only updating `input_numbers`.

## Trade-offs

- Redundant `select` tariffs are set by one automation for *all* meters at once, which keeps the tariff source of truth in a single place but adds a small delay when the color changes.
- The Legacy "EDF Base" prices (`tarif_edf_base*`) are kept alongside Tempo ones for historical reasons; current tracking runs on Tempo.

## Further reading

- [Utility meter reference](../reference/integration-patterns.md) for the meter/tariff structure
- [How to add a new device meter](../how-to/automation-best-practices.md)
