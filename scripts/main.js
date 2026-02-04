// Light Groups Manager Module for Foundry VTT v12

Hooks.once('init', () => {
  console.log('Light Groups Manager | Initializing');
  
  // Register module settings
  game.settings.register('light-groups-manager', 'groups', {
    name: 'Light Groups',
    scope: 'world',
    config: false,
    type: Object,
    default: {}
  });
});

// Add group field to light configuration
Hooks.on('renderAmbientLightConfig', (app, html, data) => {
  const light = app.object;
  const currentGroup = light.document.getFlag('light-groups-manager', 'group') || '';
  
  // Find the form groups container
  const formGroup = html.find('input[name="config.dim"]').closest('.form-group');
  
  // Create the group input field
  const groupField = `
    <div class="form-group">
      <label>Light Group</label>
      <input type="text" name="flags.light-groups-manager.group" value="${currentGroup}" 
             placeholder="Enter group name (e.g., torches, streetlights)">
      <p class="notes">Assign this light to a group for batch control</p>
    </div>
  `;
  
  formGroup.after(groupField);
});

// Add scene control button for group management
Hooks.on('getSceneControlButtons', (controls) => {
  if (!game.user.isGM) return;
  
  const lightingControls = controls.find(c => c.name === 'lighting');
  if (!lightingControls) return;
  
  lightingControls.tools.push({
    name: 'light-groups',
    title: 'Manage Light Groups',
    icon: 'fas fa-layer-group',
    button: true,
    onClick: () => {
      new LightGroupsManager().render(true);
    }
  });
});

// Light Groups Manager Dialog
class LightGroupsManager extends FormApplication {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: 'light-groups-manager',
      title: 'Light Groups Manager',
      template: 'modules/light-groups-manager/templates/group-manager.html',
      width: 600,
      height: 'auto',
      classes: ['light-groups-manager']
    });
  }

  getData() {
    const groups = this._getGroups();
    return { groups };
  }

  _getGroups() {
    const scene = canvas.scene;
    if (!scene) return {};
    
    const groups = {};
    
    scene.lights.forEach(light => {
      const group = light.document.getFlag('light-groups-manager', 'group');
      if (group) {
        if (!groups[group]) {
          groups[group] = {
            name: group,
            lights: [],
            enabled: true
          };
        }
        groups[group].lights.push(light);
      }
    });
    
    return groups;
  }

  activateListeners(html) {
    super.activateListeners(html);
    
    html.find('.toggle-group').click(this._onToggleGroup.bind(this));
    html.find('.adjust-brightness').change(this._onAdjustBrightness.bind(this));
    html.find('.adjust-radius').change(this._onAdjustRadius.bind(this));
    html.find('.adjust-color').change(this._onAdjustColor.bind(this));
  }

  async _onToggleGroup(event) {
    event.preventDefault();
    const groupName = $(event.currentTarget).data('group');
    const groups = this._getGroups();
    const group = groups[groupName];
    
    if (!group) return;
    
    const newHidden = !group.lights[0].document.hidden;
    
    const updates = group.lights.map(light => ({
      _id: light.id,
      hidden: newHidden
    }));
    
    await canvas.scene.updateEmbeddedDocuments('AmbientLight', updates);
    ui.notifications.info(`${groupName}: ${newHidden ? 'disabled' : 'enabled'}`);
  }

  async _onAdjustBrightness(event) {
    const groupName = $(event.currentTarget).data('group');
    const multiplier = parseFloat(event.target.value);
    const groups = this._getGroups();
    const group = groups[groupName];
    
    if (!group) return;
    
    const updates = group.lights.map(light => {
      const currentBright = light.document.config.bright;
      return {
        _id: light.id,
        'config.bright': Math.max(0, currentBright * multiplier)
      };
    });
    
    await canvas.scene.updateEmbeddedDocuments('AmbientLight', updates);
    ui.notifications.info(`${groupName}: brightness adjusted`);
  }

  async _onAdjustRadius(event) {
    const groupName = $(event.currentTarget).data('group');
    const multiplier = parseFloat(event.target.value);
    const groups = this._getGroups();
    const group = groups[groupName];
    
    if (!group) return;
    
    const updates = group.lights.map(light => {
      const currentDim = light.document.config.dim;
      return {
        _id: light.id,
        'config.dim': Math.max(0, currentDim * multiplier)
      };
    });
    
    await canvas.scene.updateEmbeddedDocuments('AmbientLight', updates);
    ui.notifications.info(`${groupName}: radius adjusted`);
  }

  async _onAdjustColor(event) {
    const groupName = $(event.currentTarget).data('group');
    const color = event.target.value;
    const groups = this._getGroups();
    const group = groups[groupName];
    
    if (!group) return;
    
    const updates = group.lights.map(light => ({
      _id: light.id,
      'config.color': color
    }));
    
    await canvas.scene.updateEmbeddedDocuments('AmbientLight', updates);
    ui.notifications.info(`${groupName}: color changed`);
  }
}

// Make template available without file
Hooks.once('ready', () => {
  // Override template path to use inline HTML
  const originalGet = foundry.utils.getTemplate;
  foundry.utils.getTemplate = async function(path) {
    if (path === 'modules/light-groups-manager/templates/group-manager.html') {
      return Handlebars.compile(`
        <div class="light-groups-manager-content">
          {{#if groups}}
            {{#each groups}}
            <div class="group-control">
              <h3>{{this.name}} <span class="light-count">({{this.lights.length}} lights)</span></h3>
              
              <div class="control-row">
                <button type="button" class="toggle-group" data-group="{{this.name}}">
                  <i class="fas fa-power-off"></i> Toggle On/Off
                </button>
                
                <label>Brightness:
                  <input type="range" class="adjust-brightness" data-group="{{this.name}}" 
                         min="0.5" max="2" step="0.1" value="1">
                </label>
                
                <label>Radius:
                  <input type="range" class="adjust-radius" data-group="{{this.name}}" 
                         min="0.5" max="2" step="0.1" value="1">
                </label>
                
                <label>Color:
                  <input type="color" class="adjust-color" data-group="{{this.name}}">
                </label>
              </div>
            </div>
            {{/each}}
          {{else}}
            <p class="no-groups">No light groups found. Add lights to groups by editing their configuration.</p>
          {{/if}}
        </div>
      `);
    }
    return originalGet.call(this, path);
  };
});