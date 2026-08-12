# About the Canicule Cover Strategy

## Background

During a heatwave, the goal is **passive cooling**: keep the heat out while the sun is up, and let the house cool down when the outside air is cooler. The house faces this problem with two template binary sensors and a set of sun-tracking cover automations.

## The canicule mode

[`binary_sensor.mode_canicule`](../../templates.yaml) is ON when *any* of the following holds:

- the manual override `input_boolean.canicule_forcee` is ON, or
- the outdoor temperature is ≥ 30 °C, or
- the indoor average temperature (`sensor.temperature_moyenne_de_la_maison`) is ≥ 26 °C.

The manual override exists because the weather forecast does not always reflect what the house actually experiences. It is reset every night when [`binary_sensor.mode_jour`](../../templates.yaml) turns off, so a forced canicule only ever applies to the day it was set.

The day mode `binary_sensor.mode_jour` is ON between the house wake-up time and `min(next_dusk, 22:00)`. The cover automations only run while both modes are active.

## Why sun azimuth and elevation

Rather than a fixed clock schedule, the automations in [`automations/global/heatwave.yaml`](../../automations/global/heatwave.yaml) use the sun's **azimuth** (compass direction) and **elevation** to decide which cover to close. Each facade is protected only while the sun actually shines on it:

| Facade | Azimuth window | Action |
| ------ | -------------- | ------ |
| East (volets + velux) | 60° – 190° | Close / set position 10% |
| West (volets + velux) | 230° – 310° | Close / set position 10% |
| South | 140° – 220°, elevation > 20° | Close fully |

The reuse logic reopens the covers once the sun has moved off the facade (azimuth beyond the window) **and** the outdoor temperature is below 34 °C, restoring them to ~60 % position for a little light without full exposure.

## Design rationale

- **Heat in, not light out** — the strategy trades light for cool. Covers drop to 10 % instead of fully closing to keep rooms usable.
- **No hardcoded clock** — sun angles adapt automatically to the season, unlike a fixed afternoon schedule.
- **Safety margins** — elevation gates (e.g. elevation > 10) avoid closing covers at sunrise/sunset when the sun is weak.

## Trade-offs

- Sun-angle thresholds were tuned by observation (see the git history of `heatwave.yaml`); they are approximations of when the sun actually hits each window.
- Forcing canicule manually lasts only one day by design — it must be re-armed each morning, which is intentional to prevent it from being forgotten on.

## Further reading

- [How to validate the configuration](../how-to/validate-and-test.md)
- [The override helper reference](../reference/yaml-style-guide.md)
