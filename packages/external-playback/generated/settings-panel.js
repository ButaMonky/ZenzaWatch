"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.openExternalSettings = openExternalSettings;
const settings_1 = require("./settings");
function openExternalSettings(d, values, save) {
    d.querySelector('[data-zenza-external-settings]')?.remove();
    const host = d.createElement('div');
    host.dataset.zenzaExternalSettings = '';
    host.style.cssText = 'all:initial!important;position:fixed!important;inset:24px!important;z-index:2147483647!important;display:block!important;';
    const shadow = host.attachShadow({ mode: 'closed' }), style = d.createElement('style');
    style.textContent = `
 section{font:14px/1.5 sans-serif;color:#eee;background:#17212d;border:1px solid #6c8296;border-radius:10px;padding:18px;max-width:680px;max-height:80vh;overflow:auto;margin:auto;color-scheme:dark}
 h2{font-size:19px;margin:0 0 14px}.row{padding:10px 0;border-bottom:1px solid #344353}.field-label{display:block;font-weight:600;margin-bottom:5px}.child-group{margin-left:12px;padding-left:16px;border-left:2px solid #405064}.row[data-disabled=true]>.field{opacity:.48}
 input:not([type=checkbox]):not([type=radio]),select,textarea{width:100%;box-sizing:border-box;padding:6px 8px;background:#101a25;color:#eee;border:1px solid #65778a;border-radius:4px}textarea{resize:vertical;min-height:62px}input{accent-color:#7acabc}input[type=checkbox]{margin-right:8px}.choices{display:flex;gap:6px 18px;flex-wrap:wrap}.choices label{display:flex;gap:5px;align-items:center}small,details{display:block;color:#bbc6d0;font-size:12px;margin-top:4px}summary{cursor:pointer;width:fit-content}.reason{color:#c8d3dd}.reason:empty{display:none}button{padding:6px 12px;background:#243c47;color:#eee;border:1px solid #7acabc;border-radius:4px;cursor:pointer}button:disabled{opacity:.45;cursor:default}.add-site{margin-top:6px}.actions{display:flex;gap:8px;margin-top:16px;flex-wrap:wrap}.actions button:first-child{margin-right:auto}button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible,summary:focus-visible{outline:2px solid #a2e4d7;outline-offset:2px}
 `;
    const section = d.createElement('section');
    section.setAttribute('role', 'dialog');
    section.setAttribute('aria-modal', 'true');
    section.setAttribute('aria-label', '外部サイトからの再生');
    section.addEventListener('keydown', e => { if (e.key === 'Escape') {
        e.stopPropagation();
        host.remove();
    } });
    const heading = d.createElement('h2');
    heading.textContent = '外部サイトからの再生';
    section.append(heading);
    const current = (0, settings_1.sanitizeExternal)(values), inputs = new Map(), rows = new Map(), reasons = new Map(), addButtons = new Map(), groups = new Map();
    const read = (key) => { const controls = inputs.get(key); const input = controls[0]; return input.type === 'checkbox' ? input.checked : input.type === 'radio' ? (controls.find(c => c.checked)?.value || '') : input.value; };
    let currentHost = '';
    try {
        const url = new URL(d.URL);
        if (url.protocol === 'https:')
            currentHost = url.hostname;
    }
    catch { }
    for (const descriptor of settings_1.externalDescriptors) {
        const row = d.createElement('div');
        row.className = 'row';
        row.dataset.setting = descriptor.id;
        rows.set(descriptor.id, row);
        const field = d.createElement('div');
        field.className = 'field';
        row.append(field);
        const label = d.createElement('label');
        label.className = 'field-label';
        label.textContent = descriptor.label;
        field.append(label);
        const controls = [];
        const configure = (input, value) => { input.dataset.key = descriptor.id; input.id = descriptor.id + (value ? '-' + value : ''); input.setAttribute('aria-describedby', descriptor.id + '-help ' + descriptor.id + '-reason'); controls.push(input); };
        if (descriptor.inputPresentation === 'radio' && descriptor.options) {
            const choices = d.createElement('div');
            choices.className = 'choices';
            choices.setAttribute('role', 'radiogroup');
            choices.setAttribute('aria-label', descriptor.label);
            for (const option of descriptor.options) {
                const item = d.createElement('label'), input = d.createElement('input');
                input.type = 'radio';
                input.name = descriptor.id;
                input.value = option.value;
                input.checked = current[descriptor.id] === option.value;
                configure(input, option.value);
                item.append(input, option.label);
                choices.append(item);
            }
            field.append(choices);
        }
        else {
            const input = descriptor.options ? d.createElement('select') : descriptor.type === 'textarea' ? d.createElement('textarea') : d.createElement('input');
            if (input.tagName === 'SELECT')
                for (const option of descriptor.options || []) {
                    const el = d.createElement('option');
                    el.value = option.value;
                    el.textContent = option.label;
                    input.append(el);
                }
            else if (input.tagName === 'INPUT')
                input.type = descriptor.type === 'boolean' ? 'checkbox' : 'text';
            if (input.type === 'checkbox')
                input.checked = current[descriptor.id] === true;
            else
                input.value = String(current[descriptor.id]);
            if (input.tagName === 'TEXTAREA')
                input.rows = descriptor.id === 'externalLinks.prefixes' ? 4 : 3;
            configure(input);
            label.htmlFor = input.id;
            if (input.type === 'checkbox')
                label.prepend(input);
            else
                field.append(input);
        }
        inputs.set(descriptor.id, controls);
        if (descriptor.description) {
            const small = d.createElement('small');
            small.id = descriptor.id + '-help';
            small.textContent = descriptor.description;
            field.append(small);
        }
        if (descriptor.descriptionDetails) {
            const details = d.createElement('details'), summary = d.createElement('summary'), body = d.createElement('div');
            summary.textContent = '詳しい説明';
            body.textContent = descriptor.descriptionDetails;
            details.append(summary, body);
            field.append(details);
        }
        if (descriptor.addCurrentSite) {
            const button = d.createElement('button');
            button.type = 'button';
            button.className = 'add-site';
            button.textContent = '現在のサイトを追加';
            button.onclick = () => { if (button.disabled || !currentHost)
                return; const input = controls[0]; if (!input.value.split(/\r?\n/).some(line => line.trim().toLowerCase() === currentHost.toLowerCase()))
                input.value += (input.value && !input.value.endsWith('\n') ? '\n' : '') + currentHost; };
            field.append(button);
            addButtons.set(descriptor.id, button);
        }
        const reason = d.createElement('small');
        reason.id = descriptor.id + '-reason';
        reason.className = 'reason';
        row.append(reason);
        reasons.set(descriptor.id, reason);
        if (descriptor.dependsOn) {
            let group = groups.get(descriptor.dependsOn);
            if (!group) {
                group = d.createElement('div');
                group.className = 'child-group';
                (rows.get(descriptor.dependsOn) || section).append(group);
                groups.set(descriptor.dependsOn, group);
            }
            group.append(row);
        }
        else
            section.append(row);
    }
    const disabledReason = (key) => {
        const descriptor = settings_1.externalDescriptors.find(item => item.id === key);
        if (!descriptor.dependsOn)
            return '';
        const parent = descriptor.dependsOn, ancestor = disabledReason(parent);
        if (ancestor)
            return ancestor;
        if (descriptor.dependsOnValue !== undefined)
            return read(parent) === descriptor.dependsOnValue ? '' : descriptor.disabledReason || '親の設定を変更すると編集できます。';
        return read(parent) === true ? '' : '外部サイトでZenボタンを使うをONにすると編集できます。';
    };
    const update = () => { for (const [key, controls] of inputs) {
        const reason = disabledReason(key);
        controls.forEach(input => input.disabled = !!reason);
        rows.get(key).dataset.disabled = String(!!reason);
        const button = addButtons.get(key);
        if (button)
            button.disabled = !!reason || !currentHost;
        reasons.get(key).textContent = reason || (button && !currentHost ? 'HTTPSページで現在のサイトを追加できます。' : '');
    } };
    for (const controls of inputs.values())
        controls.forEach(input => input.addEventListener('change', update));
    update();
    const actions = d.createElement('div');
    actions.className = 'actions';
    const reset = d.createElement('button');
    reset.textContent = '初期値に戻す';
    reset.onclick = () => { for (const [key, controls] of inputs)
        for (const input of controls) {
            if (input.type === 'checkbox')
                input.checked = settings_1.externalDefaults[key] === true;
            else if (input.type === 'radio')
                input.checked = input.value === settings_1.externalDefaults[key];
            else
                input.value = String(settings_1.externalDefaults[key]);
        } update(); };
    const commit = d.createElement('button');
    commit.textContent = '保存';
    commit.onclick = () => { const next = { ...current }; for (const key of inputs.keys())
        next[key] = read(key); save((0, settings_1.sanitizeExternal)(next)); host.remove(); };
    const cancel = d.createElement('button');
    cancel.textContent = 'キャンセル';
    cancel.onclick = () => host.remove();
    actions.append(reset, commit, cancel);
    section.append(actions);
    shadow.append(style, section);
    d.documentElement.append(host);
    inputs.get('externalLinks.enabled')[0].focus();
}
