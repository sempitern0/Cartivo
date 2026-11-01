//! Cartivo NES core: a minimal wasm-bindgen surface over `tetanes-core`.
//!
//! The host (a Web Worker) owns timing, storage and presentation. This crate
//! only emulates: no filesystem, no `localStorage`, no threads. Battery RAM
//! goes in and out as bytes so Cartivo's own SRAM store stays the single
//! writer.

use tetanes_core::{
    common::{NesRegion, ResetKind},
    control_deck::{Config, ControlDeck},
    input::{JoypadBtn, Player},
    memory::RamState,
    video::VideoFilter,
};
use wasm_bindgen::prelude::*;

/// Button bit order shared with `packages/adapters/src/tetanes.ts`.
const BUTTONS: [JoypadBtn; 8] = [
    JoypadBtn::Up,
    JoypadBtn::Down,
    JoypadBtn::Left,
    JoypadBtn::Right,
    JoypadBtn::A,
    JoypadBtn::B,
    JoypadBtn::Select,
    JoypadBtn::Start,
];

#[wasm_bindgen]
pub struct Core {
    deck: ControlDeck,
    battery: bool,
    pixels: Vec<u8>,
    audio: Vec<f32>,
}

#[wasm_bindgen]
impl Core {
    /// Loads an iNES image. Cartivo validates the header before calling this.
    #[wasm_bindgen(constructor)]
    pub fn new(rom: &[u8], sample_rate: f32) -> Result<Core, JsError> {
        let config = Config::default()
            // One RGBA pixel per PPU pixel: the original look. The NTSC
            // composite filter would alter fidelity and is not enabled.
            .with_filter(VideoFilter::Pixellate)
            .with_region(NesRegion::Ntsc)
            .with_ram_state(RamState::AllZeros)
            .with_sram_dir(None);
        let mut deck = ControlDeck::with_config(config);
        deck.set_sample_rate(sample_rate);
        let loaded = deck
            .load_rom("cartivo", &mut &rom[..])
            .map_err(|err| JsError::new(&err.to_string()))?;
        Ok(Core {
            deck,
            battery: loaded.battery_backed,
            pixels: Vec::new(),
            audio: Vec::new(),
        })
    }

    /// Whether the cartridge has battery-backed RAM.
    #[wasm_bindgen(getter)]
    pub fn battery(&self) -> bool {
        self.battery
    }

    /// Battery RAM as raw bytes (empty without a battery).
    pub fn sram(&mut self) -> Vec<u8> {
        self.deck.sram().to_vec()
    }

    /// Restores battery RAM from raw bytes. No-op without a battery.
    pub fn set_sram(&mut self, data: &[u8]) {
        self.deck.set_sram(data);
    }

    /// Sets player 1 buttons from a bit mask in `BUTTONS` order.
    pub fn set_input(&mut self, bits: u8) {
        let pad = self.deck.joypad_mut(Player::One);
        for (i, button) in BUTTONS.iter().enumerate() {
            pad.set_button(*button, bits & (1 << i) != 0);
        }
    }

    /// Emulates `count` frames (1-3), keeping the last picture and all audio.
    pub fn frames(&mut self, count: u32) -> Result<(), JsError> {
        if !(1..=3).contains(&count) {
            return Err(JsError::new("Lote de frames inválido"));
        }
        self.audio.clear();
        for _ in 0..count {
            let _clocked = self
                .deck
                .clock_frame()
                .map_err(|err| JsError::new(&err.to_string()))?;
            self.audio.extend_from_slice(self.deck.audio_samples());
        }
        self.pixels.clear();
        self.pixels.extend_from_slice(self.deck.frame_buffer());
        Ok(())
    }

    /// RGBA 256x240 of the last emulated frame.
    pub fn pixels(&self) -> Vec<u8> {
        self.pixels.clone()
    }

    /// Mono samples produced by the last `frames` call.
    pub fn audio(&self) -> Vec<f32> {
        self.audio.clone()
    }

    /// Power-cycles the console, keeping the cartridge and its battery RAM.
    pub fn reset(&mut self) {
        let saved = self.sram();
        self.deck.reset(ResetKind::Hard);
        self.set_sram(&saved);
    }
}
