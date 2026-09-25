# Spark Lab — Kids Circuit Studio

Spark Lab is a frontend-only, interactive electronics learning app for children. It includes a drag-and-drop circuit board, terminal-to-terminal wiring, animated current flow, working outputs, measurement instruments, adjustable resistance, capacitor charging, fourteen guided lessons, a free-build sandbox, and local progress saving.

## Run locally

Requirements: Node.js 22 or newer.

```bash
npm install
npm run dev
```

Open the local address printed in the terminal.

## Production build

```bash
npm run build
```

## How to use the app

1. Drag a component from the parts tray onto the workbench, or click it to add it.
2. Click one component terminal and then another terminal to connect a wire.
3. Use **Run / Pause** to control the simulation.
4. Click **Close** on a switch to complete its path.
5. Select a component or wire and use the trash button to remove it.

Progress is stored only in the browser using `localStorage`. The project has no backend, account system, analytics, or external services.

## Phase 1 foundation

- Battery, switch, 220 Ω resistor, LED, lamp, and motor
- Click-to-add and drag-to-place components
- Movable components with attached wires
- Live closed-circuit detection
- Animated current flow, LED/lamp glow, and motor rotation
- Open-switch and LED-polarity behavior
- Unsafe LED warning when no resistor is in the powered path
- Five progressive lessons and a sandbox mode
- Responsive desktop/tablet/mobile layout
- Keyboard focus styles and reduced-motion support

## Phase 2 upgrades

- Branch-aware simulation for series and parallel circuits
- Short-circuit detection with automatic safety shutdown
- Per-branch LED polarity and resistor protection checks
- Selectable, deletable and visually separated wire routes
- 3V, 6V and 9V controls with a simplified current meter
- Animated buzzer component
- Four new lessons covering series, parallel, shorts and sound
- Contextual hints for all nine lessons

## Phase 3 measurement lab

- Ammeter readings for current flowing through a series branch
- Voltmeter readings based on calculated voltage drop
- Variable resistor values that immediately change circuit current
- Capacitor charging and discharging animation
- Per-component current and voltage calculations
- Five new lessons covering current, voltage, resistance, stored charge and combined measurement
- Phase-specific progress and achievement feedback

## Important note

The simulator intentionally uses a simplified educational model. It is suitable for teaching concepts but should not be used for engineering calculations or real electrical safety decisions.
