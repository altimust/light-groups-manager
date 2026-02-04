// Light Groups Manager Module for Foundry VTT v12
const MODULE_ID = 'light-groups-manager';

Hooks.once('init', () => {
  console.log('Light Groups Manager | Initializing');
  
  // Register module settings
  game.settings.register(MODULE_ID, 'groups', {
    name: 'Light Groups',
    scope: 'world',
    config: false,
    type: Object,
    default: {}
  });
});

// Add group field to light configuration
Hooks.on('renderAmbientLightConfig', (app, html, data) => {
  // Get the light document properly in v12
  const lightDoc = app.document;
  if (!lightDoc) return;
  
  const currentGroup = lightDoc.getFlag(MODULE_ID, 'group') || '';
  
  // Wrap html in jQuery if needed
  const $html = html instanceof jQuery ? html : $(html);
  
  // Find the form groups container
  const formGroup = $html.find('input[name="config.dim"]').closest('.form-group');
  
  if (formGroup.length === 0) {
    // If dim input not found, try to find any form-group and append after it
    const anyFormGroup = $html.find('.form-group').last();
    if (anyFormGroup.length === 0) return;
    
    const groupField = `
      <div class="form-group">
        <label>Light Group</label>
        <input type="text" name="flags.${MODULE_ID}.group" value="${currentGroup}" 
               placeholder="e.g., torches, streetlights">
        <p class="hint">Assign this light to a group for batch control</p>
      </div>
    `;
    anyFormGroup.after(groupField);
  } else {
    // Create the group input field
    const groupField = `
      <div class="form-group">
        <label>Light Group</label>
        <input type="text" name="flags.${MODULE_ID}.group" value="${currentGroup}" 
               placeholder="e.g., torches, streetlights">
        <p class="hint">Assign this light to a group for batch control</p>
      </div>
    `;
    
    formGroup.after(groupField);
  }
});

// Add scene control button for group management
Hooks.on('getSceneControlButtons', (controls) => {
  console.log('Light Groups Manager | getSceneControlButtons called');
  
  if (!game.user.isGM) return;
  
  // In Foundry v12, controls is an object with keys like 'lighting', 'tokens', etc.
  const lightingControls = controls.lighting;
  console.log('Lighting controls found:', lightingControls);
  console.log('Lighting controls.tools:', lightingControls?.tools);
  console.log('Is tools an array?', Array.isArray(lightingControls?.tools));
  
  if (!lightingControls) return;
  
  // Check if tools is an object (v12 might use objects instead of arrays)
  if (!lightingControls.tools) {
    lightingControls.tools = {};
  }
  
  // Add the tool - if tools is an object, use key-based assignment
  const openManager = () => {
    console.log('Light Groups button clicked!');
    new LightGroupsManager().render(true);
  };

  const toolDefinition = {
    name: 'light-groups',
    title: 'Manage Light Groups',
    icon: 'fas fa-layer-group',
    button: true
  };

  // v13+ uses onChange, v12 uses onClick.
  if ((game.release?.generation ?? 12) >= 13) toolDefinition.onChange = openManager;
  else toolDefinition.onClick = openManager;
  
  if (Array.isArray(lightingControls.tools)) {
    lightingControls.tools.push(toolDefinition);
  } else {
    lightingControls.tools['light-groups'] = toolDefinition;
  }
  
  console.log('Light Groups Manager | Button added to lighting controls');
  console.log('Updated tools:', lightingControls.tools);
});

// Light Groups Manager Dialog
class LightGroupsManager extends Application {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: 'light-groups-manager',
      title: 'Light Groups Manager',
      template: 'modules/light-groups-manager/templates/group-manager.html',
      width: 600,
      height: 'auto',
      classes: ['sheet', 'ambient-light-config', 'light-groups-manager'],
      resizable: true
    });
  }

  getData() {
    const groups = this._getGroups();
    for (const group of groups) {
      group.animationOptions = this._getAnimationOptions(group.isDarknessSource).map(option => ({
        ...option,
        selected: option.value === group.animationType
      }));
    }

    return {
      hasGroups: groups.length > 0,
      groups,
      labels: this._getLabels()
    };
  }

  _getLabels() {
    return {
      enabled: this._label('LIGHT.Enabled', 'Enabled'),
      enabledHint: this._label('LIGHT.EnabledHint', 'Enable or disable all lights in this group.'),
      color: this._label('LIGHT.Color', 'Color'),
      colorHint: this._label('LIGHT.ColorHint', 'Set a common light color for every source in the group.'),
      intensity: this._label('LIGHT.ColorIntensity', 'Intensity'),
      intensityHint: this._label('LIGHT.ColorIntensityHint', 'Modify the intensity of color emitted by this light source.'),
      animationType: this._label('LIGHT.AnimationType', 'Light Animation Type'),
      animationTypeHint: this._label('LIGHT.AnimationTypeHint', 'Choose an animation shader effect for all lights in this group.'),
      animationSpeed: this._label('LIGHT.AnimationSpeed', 'Animation Speed'),
      animationSpeedHint: this._label('LIGHT.AnimationSpeedHint', 'How quickly the selected animation plays.'),
      animationReverse: this._label('LIGHT.AnimationReverse', 'Reverse Direction'),
      animationReverseHint: this._label('LIGHT.AnimationReverseHint', 'Reverse the animation movement direction.'),
      animationIntensity: this._label('LIGHT.AnimationIntensity', 'Animation Intensity'),
      animationIntensityHint: this._label('LIGHT.AnimationIntensityHint', 'Controls the visual strength of the animation effect.'),
      darknessSource: this._label('LIGHT.DarknessSource', 'Is Darkness Source'),
      darknessSourceHint: this._label('LIGHT.DarknessSourceHint', 'A darkness source blocks light and vision and suppresses lights or vision sources inside its area of effect.'),
      providesVision: this._label('LIGHT.Vision', 'Provides Visibility'),
      providesVisionHint: this._label('LIGHT.VisionHint', 'When enabled, this light allows tokens to see from its position.'),
      apply: this._label('SETTINGS.Save', 'Apply Group Settings'),
      empty: this._label('LIGHTGROUPS.NoGroups', 'No light groups found. Add lights to groups by editing their configuration.')
    };
  }

  _label(key, fallback) {
    return game.i18n.has(key) ? game.i18n.localize(key) : fallback;
  }

  _getAnimationOptions(isDarknessSource = false) {
    const animations = isDarknessSource
      ? (CONFIG.Canvas?.darknessAnimations ?? CONFIG.Canvas?.lightAnimations ?? {})
      : (CONFIG.Canvas?.lightAnimations ?? {});
    const options = [{
      value: '',
      label: 'None'
    }];

    for (const [value, animation] of Object.entries(animations)) {
      const labelKey = animation?.label;
      const label = labelKey && game.i18n.has(labelKey) ? game.i18n.localize(labelKey) : value;
      options.push({ value, label });
    }

    return options;
  }

  _getGroups() {
    const scene = canvas.scene;
    if (!scene) return [];
    
    const groupsMap = new Map();
    
    scene.lights.forEach(light => {
      const lightDoc = light?.document ?? light;
      if (!lightDoc?.getFlag) return;

      const group = String(lightDoc.getFlag(MODULE_ID, 'group') ?? '').trim();
      if (!group) return;

      if (!groupsMap.has(group)) groupsMap.set(group, []);
      groupsMap.get(group).push(lightDoc);
    });

    return [...groupsMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, lights]) => {
        const leadLight = lights[0];
        const animation = leadLight.config?.animation ?? {};

        return {
          groupId: encodeURIComponent(name),
          name,
          lights,
          lightCount: lights.length,
          enabled: !leadLight.hidden,
          color: leadLight.config?.color ?? '#ffffff',
          colorIntensity: Number(leadLight.config?.alpha ?? 0.5),
          animationType: animation.type ?? '',
          animationSpeed: Number(animation.speed ?? 5),
          animationReverse: Boolean(animation.reverse),
          animationIntensity: Number(animation.intensity ?? 5),
          isDarknessSource: Boolean(leadLight.config?.isDarkness ?? leadLight.config?.negative),
          providesVision: Boolean(leadLight.config?.vision)
        };
      });
  }

  activateListeners(html) {
    super.activateListeners(html);
    
    html.find('.group-enabled').on('change', this._onToggleGroup.bind(this));
    html.find('.group-is-darkness-source').on('change', this._onDarknessSourceToggle.bind(this));
    html.find('.apply-group-settings').on('click', this._onApplyGroupSettings.bind(this));
  }

  _onDarknessSourceToggle(event) {
    const root = $(event.currentTarget).closest('.group-control');
    const isDarknessSource = event.currentTarget.checked;
    const select = root.find('.group-animation-type');
    if (!select.length) return;

    const currentValue = String(select.val() ?? '');
    const options = this._getAnimationOptions(isDarknessSource);

    select.empty();
    for (const option of options) {
      const optionEl = $('<option></option>').val(option.value).text(option.label);
      select.append(optionEl);
    }

    const hasCurrent = options.some(option => option.value === currentValue);
    select.val(hasCurrent ? currentValue : '');
    select.trigger('change');
  }

  async _onToggleGroup(event) {
    const root = $(event.currentTarget).closest('.group-control');
    const groupName = decodeURIComponent(root.data('groupId'));
    const enabled = event.currentTarget.checked;

    const group = this._findGroup(groupName);
    if (!group) return;

    const updates = group.lights.map(light => ({
      _id: light.id,
      hidden: !enabled
    }));
    
    await canvas.scene.updateEmbeddedDocuments('AmbientLight', updates);
    ui.notifications.info(`${groupName}: ${enabled ? 'enabled' : 'disabled'}`);
  }

  _findGroup(groupName) {
    return this._getGroups().find(group => group.name === groupName);
  }

  async _onApplyGroupSettings(event) {
    event.preventDefault();

    const root = $(event.currentTarget).closest('.group-control');
    const groupName = decodeURIComponent(root.data('groupId'));
    const group = this._findGroup(groupName);
    if (!group) return;

    const animationType = root.find('.group-animation-type').val() || '';
    const animationSpeed = this._clamp(this._getRangePickerValue(root.find('.group-animation-speed').get(0)), 1, 10);
    const animationIntensity = this._clamp(this._getRangePickerValue(root.find('.group-animation-intensity').get(0)), 1, 10);
    const animationReverse = root.find('.group-animation-reverse').prop('checked');

    const updates = group.lights.map(light => ({
      _id: light.id,
      hidden: !root.find('.group-enabled').prop('checked'),
      'config.color': this._getColorValue(root),
      'config.alpha': this._clamp(this._getRangePickerValue(root.find('.group-color-intensity').get(0)), 0, 1),
      'config.isDarkness': root.find('.group-is-darkness-source').prop('checked'),
      'config.negative': root.find('.group-is-darkness-source').prop('checked'),
      'config.vision': root.find('.group-provides-vision').prop('checked'),
      'config.animation.type': animationType || null,
      'config.animation.speed': animationSpeed,
      'config.animation.reverse': animationReverse,
      'config.animation.intensity': animationIntensity
    }));
    
    await canvas.scene.updateEmbeddedDocuments('AmbientLight', updates);

    // Force source reinitialization so animation changes become visible immediately.
    for (const lightDoc of group.lights) {
      const placeable = canvas.lighting?.placeables?.find(l => l.id === lightDoc.id);
      placeable?.initializeLightSource?.();
    }
    canvas.perception?.update?.({
      initializeLighting: true,
      refreshLighting: true,
      refreshVision: true
    }, true);
    ui.notifications.info(`${groupName}: settings updated`);
    this.render();
  }

  _clamp(value, min, max) {
    if (Number.isNaN(value)) return min;
    return Math.min(max, Math.max(min, value));
  }

  _getColorValue(root) {
    const picker = root.find('.group-color').get(0);
    const value = picker?.value ?? root.find('.group-color input[type="text"]').val();
    const normalized = String(value ?? '').trim();
    return /^#[0-9a-f]{6}$/i.test(normalized) ? normalized : '#ffffff';
  }

  _getRangePickerValue(rangePickerEl) {
    if (!rangePickerEl) return 0;
    if (typeof rangePickerEl.value !== 'undefined') return Number(rangePickerEl.value);

    const numberInput = rangePickerEl.querySelector?.('input[type="number"]');
    if (numberInput) return Number(numberInput.value);

    const rangeInput = rangePickerEl.querySelector?.('input[type="range"]');
    return Number(rangeInput?.value ?? 0);
  }
}
