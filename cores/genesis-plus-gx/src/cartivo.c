// Cartivo bridge to Genesis Plus GX (non-commercial licence, see LICENSE.txt
// upstream: https://github.com/ekeeke/Genesis-Plus-GX) through its own
// libretro frontend, linked statically. Original Cartivo code, licensed MIT
// like the SameBoy, mGBA and Snes9x bridges (ADR-014).
// Master System and Mega Drive cartridges only. The ROM is handed over in
// memory (GET_GAME_INFO_EXT), so no file is ever opened; no BIOS is loaded.
// Genesis Plus GX keeps its state in globals, so each WebAssembly instance
// runs one game (BridgeCore creates an instance per game).
#include <stdarg.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include "libretro.h"
#include "shared.h"

#define OUT_RATE 48000
#define MAX_SAMPLES OUT_RATE
#define MAX_WIDTH 320
#define MAX_HEIGHT 224
/* Fixed battery buffer: Genesis Plus GX maps cartridge RAM inside it. */
#define SAVE_BYTES 0x10000

enum { CARTIVO_MD = 0, CARTIVO_SMS = 1 };

typedef struct {
    uint32_t pixels[MAX_WIDTH * MAX_HEIGHT];
    float audio[MAX_SAMPLES];
    unsigned samples;
    unsigned width, height;
    /* Linear resampler from the core's rate to 48000 Hz (mono). */
    double step, position;
    float previous;
    unsigned bits;
    uint8_t *rom;
    struct retro_game_info_ext info;
    /* The game's own frame rate: 50 Hz PAL, ~59.9 Hz NTSC (from the header). */
    double fps;
} cartivo_t;

static cartivo_t *current;

static bool environment(unsigned cmd, void *data)
{
    switch (cmd) {
    case RETRO_ENVIRONMENT_SET_PIXEL_FORMAT:
        return *(const enum retro_pixel_format *)data == RETRO_PIXEL_FORMAT_RGB565;
    case RETRO_ENVIRONMENT_GET_GAME_INFO_EXT:
        if (!current) return false;
        *(const struct retro_game_info_ext **)data = &current->info;
        return true;
    default:
        /* No variables, directories, VFS, messages or rumble: defaults. */
        return false;
    }
}

static unsigned to_rgba(uint16_t p)
{
    unsigned r = (p >> 11) & 31, g = (p >> 5) & 63, b = p & 31;
    r = (r << 3) | (r >> 2);
    g = (g << 2) | (g >> 4);
    b = (b << 3) | (b >> 2);
    return 0xFF000000u | (b << 16) | (g << 8) | r; /* RGBA in memory order */
}

/* Normalises every video mode to the system's fixed size: Mega Drive H32
 * (256 px) is stretched to 320, extra lines (PAL, extended SMS modes) are
 * cropped around the centre. */
static void video(const void *data, unsigned width, unsigned height, size_t pitch)
{
    if (!data || !current || !width || !height) return; /* frame skipped */
    const unsigned w = current->width, h = current->height;
    const unsigned top = height > h ? (height - h) / 2 : 0;
    for (unsigned y = 0; y < h; y++) {
        uint32_t *out = current->pixels + y * w;
        if (y + top >= height) {
            for (unsigned x = 0; x < w; x++) out[x] = 0xFF000000u;
            continue;
        }
        const uint16_t *in = (const uint16_t *)((const uint8_t *)data + (y + top) * pitch);
        for (unsigned x = 0; x < w; x++) out[x] = to_rgba(in[x * width / w]);
    }
}

static size_t audio_batch(const int16_t *data, size_t frames)
{
    if (!current) return frames;
    for (size_t i = 0; i < frames; i++) {
        const float sample = ((float)data[i * 2] + (float)data[i * 2 + 1]) / 65536.0f;
        while (current->position <= 1.0 && current->samples < MAX_SAMPLES) {
            const float t = (float)current->position;
            current->audio[current->samples++] = current->previous + (sample - current->previous) * t;
            current->position += current->step;
        }
        current->position -= 1.0;
        current->previous = sample;
    }
    return frames;
}

static void audio_sample(int16_t left, int16_t right)
{
    const int16_t frame[2] = {left, right};
    audio_batch(frame, 1);
}

static void input_poll(void) {}

/* Bits: B, Y, select, start, up, down, left, right, A, X, L, R
 * (RETRO_DEVICE_ID_JOYPAD_* order; the frontend maps them to each pad). */
static int16_t input_state(unsigned port, unsigned device, unsigned index, unsigned id)
{
    (void)index;
    if (!current || port != 0 || device != RETRO_DEVICE_JOYPAD) return 0;
    if (id == RETRO_DEVICE_ID_JOYPAD_MASK) return (int16_t)current->bits;
    return id < 12 ? (current->bits >> id) & 1 : 0;
}

cartivo_t *cartivo_create(const uint8_t *rom, size_t rom_len, unsigned system)
{
    if (current || system > CARTIVO_SMS) return NULL; /* one game per instance */
    cartivo_t *c = calloc(1, sizeof(cartivo_t));
    if (!c) return NULL;
    c->rom = malloc(rom_len);
    if (!c->rom) {
        free(c);
        return NULL;
    }
    memcpy(c->rom, rom, rom_len);
    const bool sms = system == CARTIVO_SMS;
    /* The extension picks the hardware; the path is never opened. */
    c->info.full_path = sms ? "cartivo.sms" : "cartivo.md";
    c->info.dir = "";
    c->info.name = "cartivo";
    c->info.ext = sms ? "sms" : "md";
    c->info.data = c->rom;
    c->info.size = rom_len;
    c->width = sms ? 256 : 320;
    c->height = sms ? 192 : 224;
    current = c;
    retro_set_environment(environment);
    retro_set_video_refresh(video);
    retro_set_audio_sample(audio_sample);
    retro_set_audio_sample_batch(audio_batch);
    retro_set_input_poll(input_poll);
    retro_set_input_state(input_state);
    retro_init();
    struct retro_game_info game = {c->info.full_path, c->rom, rom_len, NULL};
    /* Refuse anything the extension did not ask for (CD images, Game Gear,
     * SG-1000): only these two cartridge systems are offered. */
    if (!retro_load_game(&game) ||
        (sms ? system_hw != SYSTEM_SMS && system_hw != SYSTEM_SMS2
             : system_hw != SYSTEM_MD)) {
        retro_deinit();
        current = NULL;
        free(c->rom);
        free(c);
        return NULL;
    }
    struct retro_system_av_info av;
    retro_get_system_av_info(&av);
    c->step = av.timing.sample_rate / OUT_RATE;
    c->fps = av.timing.fps;
    return c;
}

/* Frames per second of the loaded game, so the host paces PAL at 50 Hz. */
double cartivo_frame_rate(cartivo_t *c) { return c->fps; }

int cartivo_save_size(cartivo_t *c)
{
    (void)c;
    return sram.on ? SAVE_BYTES : 0;
}

/* Before the first frame: the buffer is the cartridge RAM the core maps. */
void cartivo_load_save(cartivo_t *c, const uint8_t *data, size_t len)
{
    (void)c;
    if (sram.on) memcpy(sram.sram, data, len < SAVE_BYTES ? len : SAVE_BYTES);
}

void cartivo_save(cartivo_t *c, uint8_t *out)
{
    (void)c;
    if (sram.on) memcpy(out, sram.sram, SAVE_BYTES);
}

void cartivo_set_input(cartivo_t *c, unsigned bits)
{
    c->bits = bits & 0xFFF;
}

/* Runs `count` frames; returns the number of audio samples produced. */
unsigned cartivo_frames(cartivo_t *c, unsigned count)
{
    c->samples = 0;
    for (unsigned i = 0; i < count; i++) retro_run();
    return c->samples;
}

uint32_t *cartivo_pixels(cartivo_t *c) { return c->pixels; }
float *cartivo_audio(cartivo_t *c) { return c->audio; }

size_t cartivo_state_size(cartivo_t *c)
{
    (void)c;
    return retro_serialize_size();
}

void cartivo_save_state(cartivo_t *c, uint8_t *out)
{
    (void)c;
    retro_serialize(out, retro_serialize_size());
}

/* 0 on success; anything but a state of exactly this size is refused. */
int cartivo_load_state(cartivo_t *c, const uint8_t *data, size_t len)
{
    (void)c;
    if (len != retro_serialize_size()) return 1;
    return retro_unserialize(data, len) ? 0 : 2;
}

void cartivo_reset(cartivo_t *c)
{
    (void)c;
    retro_reset();
}

void cartivo_free(cartivo_t *c)
{
    if (!c) return;
    retro_unload_game();
    retro_deinit();
    current = NULL;
    free(c->rom);
    free(c);
}
