// Cartivo bridge to Snes9x (non-commercial licence, see LICENSE upstream:
// https://github.com/snes9xgit/snes9x) through Snes9x's own libretro
// frontend, linked statically. Original Cartivo code, licensed MIT like the
// SameBoy and mGBA bridges (ADR-013).
// Emulation only: ROM, battery RAM and snapshots enter and leave as bytes.
// No file system, threads, BIOS files or host frame pacing. Snes9x keeps its
// state in globals, so each WebAssembly instance runs one game (BridgeCore
// creates an instance per game).
#include <stdarg.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include "libretro.h"

#define WIDTH 256
#define HEIGHT 224
#define IN_RATE 32040
#define OUT_RATE 48000
#define MAX_SAMPLES OUT_RATE

struct cartivo_t {
    uint32_t pixels[WIDTH * HEIGHT];
    float audio[MAX_SAMPLES];
    unsigned samples;
    /* Linear resampler 32040 → 48000 Hz (mono). */
    double position;
    float previous;
    unsigned bits;
    uint8_t *rom;
    /* The game's own frame rate: 50 Hz PAL, ~60.1 Hz NTSC (from the header). */
    double fps;
};

static cartivo_t *current;

static void quiet(enum retro_log_level level, const char *format, ...)
{
    (void)level;
    (void)format;
}

static bool environment(unsigned cmd, void *data)
{
    switch (cmd) {
    case RETRO_ENVIRONMENT_SET_PIXEL_FORMAT:
        return *(const enum retro_pixel_format *)data == RETRO_PIXEL_FORMAT_RGB565;
    case RETRO_ENVIRONMENT_GET_LOG_INTERFACE:
        /* Snes9x calls the logger without checking it: always provide one. */
        ((struct retro_log_callback *)data)->log = quiet;
        return true;
    default:
        /* No variables, directories, messages or rumble: defaults apply. */
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

/* Normalises every SNES mode to 256×224: hi-res columns are averaged in
 * pairs, interlaced fields keep every other line. */
static void video(const void *data, unsigned width, unsigned height, size_t pitch)
{
    if (!data || !current) return; /* frame skipped */
    const unsigned xs = width >= 512 ? 2 : 1, ys = height >= 448 ? 2 : 1;
    const unsigned rows = height / ys < HEIGHT ? height / ys : HEIGHT;
    for (unsigned y = 0; y < HEIGHT; y++) {
        uint32_t *out = current->pixels + y * WIDTH;
        if (y >= rows) {
            for (unsigned x = 0; x < WIDTH; x++) out[x] = 0xFF000000u;
            continue;
        }
        const uint16_t *in = (const uint16_t *)((const uint8_t *)data + y * ys * pitch);
        for (unsigned x = 0; x < WIDTH; x++) {
            if (xs == 1) {
                out[x] = to_rgba(in[x]);
                continue;
            }
            unsigned a = to_rgba(in[x * 2]), b = to_rgba(in[x * 2 + 1]);
            out[x] = 0xFF000000u | ((((a & 0xFEFEFE) >> 1) + ((b & 0xFEFEFE) >> 1)) & 0xFFFFFF);
        }
    }
}

static size_t audio_batch(const int16_t *data, size_t frames)
{
    if (!current) return frames;
    const double step = (double)IN_RATE / OUT_RATE;
    for (size_t i = 0; i < frames; i++) {
        const float sample = ((float)data[i * 2] + (float)data[i * 2 + 1]) / 65536.0f;
        while (current->position <= 1.0 && current->samples < MAX_SAMPLES) {
            const float t = (float)current->position;
            current->audio[current->samples++] = current->previous + (sample - current->previous) * t;
            current->position += step;
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
 * (RETRO_DEVICE_ID_JOYPAD_* order). */
static int16_t input_state(unsigned port, unsigned device, unsigned index, unsigned id)
{
    (void)index;
    if (!current || port != 0 || device != RETRO_DEVICE_JOYPAD || id > 11) return 0;
    return (current->bits >> id) & 1;
}

extern "C" {

cartivo_t *cartivo_create(const uint8_t *rom, size_t rom_len)
{
    if (current) return NULL; /* one game per instance */
    cartivo_t *c = (cartivo_t *)calloc(1, sizeof(cartivo_t));
    if (!c) return NULL;
    c->rom = (uint8_t *)malloc(rom_len);
    if (!c->rom) {
        free(c);
        return NULL;
    }
    memcpy(c->rom, rom, rom_len);
    current = c;
    retro_set_environment(environment);
    retro_set_video_refresh(video);
    retro_set_audio_sample(audio_sample);
    retro_set_audio_sample_batch(audio_batch);
    retro_set_input_poll(input_poll);
    retro_set_input_state(input_state);
    retro_init();
    struct retro_game_info info = {};
    info.data = c->rom;
    info.size = rom_len;
    if (!retro_load_game(&info)) {
        retro_deinit();
        current = NULL;
        free(c->rom);
        free(c);
        return NULL;
    }
    retro_set_controller_port_device(0, RETRO_DEVICE_JOYPAD);
    struct retro_system_av_info av;
    retro_get_system_av_info(&av);
    c->fps = av.timing.fps;
    return c;
}

/* Frames per second of the loaded game, so the host paces PAL at 50 Hz. */
double cartivo_frame_rate(cartivo_t *c) { return c->fps; }

int cartivo_save_size(cartivo_t *c)
{
    (void)c;
    return (int)retro_get_memory_size(RETRO_MEMORY_SAVE_RAM);
}

/* Before the first frame: battery RAM of exactly cartivo_save_size bytes. */
void cartivo_load_save(cartivo_t *c, const uint8_t *data, size_t len)
{
    (void)c;
    uint8_t *ram = (uint8_t *)retro_get_memory_data(RETRO_MEMORY_SAVE_RAM);
    size_t size = retro_get_memory_size(RETRO_MEMORY_SAVE_RAM);
    if (ram) memcpy(ram, data, len < size ? len : size);
}

void cartivo_save(cartivo_t *c, uint8_t *out)
{
    (void)c;
    const uint8_t *ram = (const uint8_t *)retro_get_memory_data(RETRO_MEMORY_SAVE_RAM);
    if (ram) memcpy(out, ram, retro_get_memory_size(RETRO_MEMORY_SAVE_RAM));
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

} /* extern "C" */
