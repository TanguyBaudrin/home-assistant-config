# Tutorial: Add Your First Automation

In this tutorial, we will add an automation that turns the kitchen light on when motion is detected, using the built-in `motion_light` blueprint. When you finish, you will have a working, validated automation and you will know the edit → validate → reload loop used for every change in this repository.

## Before you begin

- [ ] `mise` is installed and `mise install` has been run (see [Tooling reference](../reference/tooling.md)).
- [ ] A motion sensor and a light exist in the kitchen area of your Home Assistant instance.

## Step 1: Understand the layout

Automations live in `automations/`, split by room. The kitchen automations are in `automations/kitchen/lights.yaml`, which already uses the motion-light pattern.

Open that file and notice how each automation has the same shape: `id`, `alias`, `description`, `trigger`, `action`, and `mode`.

The output should look something like:

```yaml
- id: '1699796906579'
  alias: Cuisine - Lumières - Allumage automatique
  description: Cette automatisation allume la lumière...
  use_blueprint:
    path: homeassistant/motion_light.yaml
    ...
```

## Step 2: Add a new automation

Append a second automation to the same file, reusing the blueprint:

```yaml
- id: 'motion_light_exemple'
  alias: Cuisine - Lumières - Allumage sur mouvement (exemple)
  description: Allume la lumière de la cuisine sur détection de mouvement.
  use_blueprint:
    path: homeassistant/motion_light.yaml
    input:
      motion_entity: binary_sensor.motion_sensor_motion_detection
      light_target:
        area_id: cuisine
      no_motion_wait: 900
  mode: single
```

Notice that the blueprint does most of the work — we only supply the sensor, the target, and how long to wait after motion stops.

## Step 3: Validate the YAML

Run the strict syntax check:

```bash
mise run validate
```

If yamllint reports errors, fix them before continuing.

## Step 4: Check the Home Assistant configuration

Run the configuration check (this uses Docker, so it does not touch your running instance):

```bash
mise run ha-check
```

In a non-interactive shell, drop the `-it` flag from the underlying Docker command. The check should end with `Successful config`.

## Step 5: Reload and watch the logs

Reload automations so the running instance picks up the change:

```bash
ha core reload
```

Then trigger your motion sensor and confirm the light turns on. Stream the logs to catch errors:

```bash
mise run ha-logs
```

## What you've built

You have added a reusable, blueprint-based automation and completed the full edit → validate → reload loop. You now know how to extend any room file in this repository safely.

## Next steps

- [How to write automations](../how-to/automation-best-practices.md) — the required fields and modes
- [How to validate, lint, and test](../how-to/validate-and-test.md) — the full toolchain
- [YAML & style guide reference](../reference/yaml-style-guide.md) — naming and formatting rules
