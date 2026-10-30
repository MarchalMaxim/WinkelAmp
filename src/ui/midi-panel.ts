/** The MIDI section of the Look panel: status, learn buttons, sound toggle. */
import { sourceLabel, type MidiController, type MidiTarget } from '../control/midi';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export class MidiPanel {
  constructor(private midi: MidiController, private targets: MidiTarget[]) {
    $('midi-connect').addEventListener('click', () => void midi.connect());
    $('midi-reset').addEventListener('click', () => midi.resetBindings());
    $('midi-targets').addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-learn]');
      if (b) midi.arm(b.dataset.learn!);
      const u = (e.target as HTMLElement).closest<HTMLElement>('[data-unbind]');
      if (u) midi.unbind(u.dataset.unbind!);
    });
    // Opening the section is a good moment to ask for access.
    $('midi-section').addEventListener('toggle', () => {
      if (($('midi-section') as HTMLDetailsElement).open && midi.status === 'idle') void midi.connect();
    });
    this.render();
  }

  get soundOn() {
    return $<HTMLInputElement>('midi-sound').checked;
  }

  render() {
    const { midi } = this;
    const status = $('midi-status');
    const connect = $<HTMLButtonElement>('midi-connect');
    if (midi.status === 'unsupported') {
      status.textContent = 'This browser has no MIDI (try Chrome or Edge)';
      connect.disabled = true;
    } else if (midi.status === 'denied') {
      status.textContent = 'MIDI access was blocked — allow it in the address bar';
    } else if (midi.status === 'ready') {
      status.innerHTML = midi.devices.length
        ? `<span class="midi-dot"></span>${escape(midi.devices.join(', '))}`
        : 'Ready — plug in a controller';
      connect.hidden = true;
    } else {
      status.textContent = 'Plug in a controller and play';
    }

    const armed = midi.bindings.armedTarget;
    $('midi-targets').innerHTML = this.targets
      .map((t) => {
        const src = midi.bindings.sourceOf(t.id);
        const learning = armed === t.id;
        const badge = learning ? 'move a knob…' : src ? sourceLabel(src) : '—';
        return `<div class="midi-target">
          <span>${t.label}</span>
          <span class="midi-badge ${src ? 'bound' : ''}" ${src && !learning ? `data-unbind="${t.id}" title="Click to unbind" role="button"` : ''}>${badge}</span>
          <button class="midi-learn" data-learn="${t.id}" aria-pressed="${learning}">${learning ? 'Cancel' : 'Learn'}</button>
        </div>`;
      })
      .join('');
  }
}

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
