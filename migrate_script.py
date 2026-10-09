#!/usr/bin/env python3
import yaml

# Read original
with open('automations/to_split.yaml', 'r') as f:
    data = yaml.safe_load(f)

# Find the automation with the target ID
target_id = '1736019595242'
automation = None
for item in data:
    if item.get('id') == target_id:
        automation = item
        break

if automation is None:
    print('Automation not found')
    exit(1)

# Remove metadata: {} from all actions recursively
def remove_metadata(obj):
    if isinstance(obj, dict):
        if 'metadata' in obj and obj['metadata'] == {}:
            del obj['metadata']
        for v in obj.values():
            remove_metadata(v)
    elif isinstance(obj, list):
        for item in obj:
            remove_metadata(item)

remove_metadata(automation)

# Rename keys (triggers->trigger, conditions->condition, actions->action)
if 'triggers' in automation:
    automation['trigger'] = automation.pop('triggers')
if 'conditions' in automation:
    automation['condition'] = automation.pop('conditions')
if 'actions' in automation:
    automation['action'] = automation.pop('actions')

# Update alias and description and id
automation['alias'] = 'Chambre des parents - Smart button - Actions sur appui sur le bouton Hue'
automation['description'] = ('Cette automatisation gère les appuis sur le bouton Hue intelligent de la chambre '
                             'des parents. Elle normalise les événements selon l\'intégration (ZHA, deCONZ, '
                             'zigbee2mqtt), détecte le type d\'appui (court, long, double, relâchement) avec '
                             'logique de temporisation, et dispatche des événements ahb_controller_event ou '
                             'déclenche d\'autres automatisations (ex: allumage Apple TV). (Migré le 2026-10-09)')
automation['id'] = 'auto_chambre_des_parents_smart_button_hue_actions'

# Reorder keys
ordered = {}
for key in ['id', 'alias', 'description', 'trigger', 'condition', 'action', 'variables', 'mode', 'max_exceeded']:
    if key in automation:
        ordered[key] = automation[key]

# Custom representer to keep templates readable
class CustomDumper(yaml.SafeDumper):
    pass

def str_representer(dumper, data):
    # For multiline strings, use block style
    if '\n' in data and len(data) > 80:
        return dumper.represent_scalar('tag:yaml.org,2002:str', data, style='|')
    return dumper.represent_scalar('tag:yaml.org,2002:str', data)

CustomDumper.add_representer(str, str_representer)

with open('automations/chambre_des_parents/misc.yaml', 'w') as f:
    yaml.dump([ordered], f, Dumper=CustomDumper, default_flow_style=False, allow_unicode=True, width=200)

print('Migration done')
