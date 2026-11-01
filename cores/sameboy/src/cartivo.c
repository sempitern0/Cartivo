// Cartivo bridge to SameBoy (Expat, https://github.com/LIJI32/SameBoy).
// Original Cartivo code, licensed MIT like SameBoy so the core artefact
// carries a single licence (same precedent as cores/tetanes, ADR-010).
// Emulation only: ROM, battery RAM and snapshots enter and leave as bytes.
// No file system, threads or host frame pacing (the page drives the clock).
#include <stdbool.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include "Core/gb.h"
#include "boot_roms.h" /* generated from the BootROMs sources of SameBoy */

#define WIDTH 160
#define HEIGHT 144
#define SAMPLE_RATE 48000
#define MAX_SAMPLES SAMPLE_RATE

typedef struct {
    GB_gameboy_t *gb;
    uint32_t pixels[WIDTH * HEIGHT];
    float audio[MAX_SAMPLES];
    unsigned samples;
} cartivo_t;

/* RGBA in memory order (little-endian wasm and x86). */
static uint32_t rgb_encode(GB_gameboy_t *gb, uint8_t r, uint8_t g, uint8_t b)
{
    (void)gb;
    return 0xFF000000u | ((uint32_t)b << 16) | ((uint32_t)g << 8) | r;
}

static void on_sample(GB_gameboy_t *gb, GB_sample_t *sample)
{
    cartivo_t *c = GB_get_user_data(gb);
    if (c->samples < MAX_SAMPLES) {
        c->audio[c->samples++] = ((float)sample->left + (float)sample->right) / 65536.0f;
    }
}

/* SameBoy's console log is not useful to players; errors return codes. */
static void on_log(GB_gameboy_t *gb, const char *text, GB_log_attributes_t attributes)
{
    (void)gb;
    (void)text;
    (void)attributes;
}

static void on_boot_rom(GB_gameboy_t *gb, GB_boot_rom_t type)
{
    switch (type) {
        case GB_BOOT_ROM_CGB_0:
        case GB_BOOT_ROM_CGB:
        case GB_BOOT_ROM_CGB_E:
        case GB_BOOT_ROM_AGB_0:
        case GB_BOOT_ROM_AGB:
            GB_load_boot_rom_from_buffer(gb, cgb_boot, sizeof(cgb_boot));
            break;
        default:
            GB_load_boot_rom_from_buffer(gb, dmg_boot, sizeof(dmg_boot));
            break;
    }
}

/* `cgb` selects Game Boy Color hardware (from the cartridge header). */
cartivo_t *cartivo_create(const uint8_t *rom, size_t rom_len, int cgb)
{
    cartivo_t *c = calloc(1, sizeof(cartivo_t));
    if (!c) return NULL;
    /* Reproducible power-on RAM patterns; only used at reset. */
    GB_random_seed(0x43415254);
    c->gb = GB_init(GB_alloc(), cgb ? GB_MODEL_CGB_E : GB_MODEL_DMG_B);
    if (!c->gb) {
        free(c);
        return NULL;
    }
    GB_set_user_data(c->gb, c);
    GB_set_log_callback(c->gb, on_log);
    GB_set_boot_rom_load_callback(c->gb, on_boot_rom);
    GB_set_pixels_output(c->gb, c->pixels);
    GB_set_rgb_encode_callback(c->gb, rgb_encode);
    GB_set_color_correction_mode(c->gb, GB_COLOR_CORRECTION_MODERN_BALANCED);
    GB_set_highpass_filter_mode(c->gb, GB_HIGHPASS_ACCURATE);
    GB_set_sample_rate(c->gb, SAMPLE_RATE);
    GB_apu_set_sample_callback(c->gb, on_sample);
    GB_load_rom_from_buffer(c->gb, rom, rom_len);
    GB_reset(c->gb); /* requests the boot ROM through on_boot_rom */
    return c;
}

int cartivo_save_size(cartivo_t *c)
{
    return GB_save_battery_size(c->gb);
}

void cartivo_load_save(cartivo_t *c, const uint8_t *data, size_t len)
{
    GB_load_battery_from_buffer(c->gb, data, len);
}

void cartivo_save(cartivo_t *c, uint8_t *out)
{
    GB_save_battery_to_buffer(c->gb, out, GB_save_battery_size(c->gb));
}

/* Bits: right, left, up, down, A, B, select, start (GB_key_t order). */
void cartivo_set_input(cartivo_t *c, unsigned bits)
{
    for (unsigned key = 0; key < GB_KEY_MAX; key++) {
        GB_set_key_state(c->gb, (GB_key_t)key, (bits >> key) & 1);
    }
}

/* Runs `count` frames; returns the number of audio samples produced. */
unsigned cartivo_frames(cartivo_t *c, unsigned count)
{
    c->samples = 0;
    for (unsigned i = 0; i < count; i++) {
        GB_run_frame(c->gb);
    }
    return c->samples;
}

uint32_t *cartivo_pixels(cartivo_t *c) { return c->pixels; }
float *cartivo_audio(cartivo_t *c) { return c->audio; }

size_t cartivo_state_size(cartivo_t *c)
{
    return GB_get_save_state_size(c->gb);
}

void cartivo_save_state(cartivo_t *c, uint8_t *out)
{
    GB_save_state_to_buffer(c->gb, out);
}

/* 0 on success; SameBoy leaves the machine untouched on failure. */
int cartivo_load_state(cartivo_t *c, const uint8_t *data, size_t len)
{
    return GB_load_state_from_buffer(c->gb, data, len);
}

void cartivo_reset(cartivo_t *c)
{
    GB_reset(c->gb);
}

void cartivo_free(cartivo_t *c)
{
    if (!c) return;
    GB_free(c->gb);
    GB_dealloc(c->gb);
    free(c);
}
