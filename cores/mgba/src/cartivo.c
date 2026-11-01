// Cartivo bridge to mGBA (MPL-2.0, https://github.com/mgba-emu/mgba), GBA only.
// Original Cartivo code, licensed MIT like the SameBoy bridge (ADR-011).
// Emulation only: ROM, battery save and snapshots enter and leave as bytes.
// No file system, threads, BIOS file or host frame pacing; mGBA's own HLE
// BIOS runs and the cartridge starts directly.
#include <stdbool.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <mgba/core/blip_buf.h>
#include <mgba/core/core.h>
#include <mgba/core/log.h>
#include <mgba/gba/core.h>
#include <mgba-util/vfs.h>

#define WIDTH 240
#define HEIGHT 160
#define SAMPLE_RATE 48000
#define MAX_SAMPLES SAMPLE_RATE
/* Largest GBA save (Flash 1M). mGBA maps the part its detected type needs,
 * as the libretro port does, so the stored size never changes. */
#define SAVE_BYTES 0x20000

typedef struct {
    struct mCore *core;
    uint8_t *rom;
    uint8_t save[SAVE_BYTES];
    uint32_t pixels[WIDTH * HEIGHT];
    float audio[MAX_SAMPLES];
    unsigned samples;
} cartivo_t;

static void silent(struct mLogger *logger, int category, enum mLogLevel level, const char *format, va_list args)
{
    (void)logger;
    (void)category;
    (void)level;
    (void)format;
    (void)args;
}
static struct mLogger quiet = {.log = silent};

cartivo_t *cartivo_create(const uint8_t *rom, size_t rom_len)
{
    mLogSetDefaultLogger(&quiet);
    cartivo_t *c = calloc(1, sizeof(cartivo_t));
    if (!c) return NULL;
    c->rom = malloc(rom_len);
    c->core = GBACoreCreate();
    if (!c->rom || !c->core || !c->core->init(c->core)) {
        free(c->rom);
        free(c);
        return NULL;
    }
    memcpy(c->rom, rom, rom_len);
    memset(c->save, 0xFF, SAVE_BYTES);
    mCoreInitConfig(c->core, NULL);
    c->core->opts.skipBios = true;
    c->core->opts.useBios = false;
    c->core->setVideoBuffer(c->core, (color_t *)c->pixels, WIDTH);
    c->core->setAudioBufferSize(c->core, 0x4000);
    blip_set_rates(c->core->getAudioChannel(c->core, 0), c->core->frequency(c->core), SAMPLE_RATE);
    blip_set_rates(c->core->getAudioChannel(c->core, 1), c->core->frequency(c->core), SAMPLE_RATE);
    if (!c->core->loadROM(c->core, VFileFromMemory(c->rom, rom_len))) {
        c->core->deinit(c->core);
        free(c->rom);
        free(c);
        return NULL;
    }
    c->core->loadSave(c->core, VFileFromMemory(c->save, SAVE_BYTES));
    c->core->reset(c->core);
    return c;
}

int cartivo_save_size(cartivo_t *c)
{
    (void)c;
    return SAVE_BYTES;
}

/* Before the first frame: the buffer is the cartridge memory mGBA maps. */
void cartivo_load_save(cartivo_t *c, const uint8_t *data, size_t len)
{
    memcpy(c->save, data, len < SAVE_BYTES ? len : SAVE_BYTES);
}

void cartivo_save(cartivo_t *c, uint8_t *out)
{
    memcpy(out, c->save, SAVE_BYTES);
}

/* Bits: A, B, select, start, right, left, up, down, R, L (GBAKey order). */
void cartivo_set_input(cartivo_t *c, unsigned bits)
{
    c->core->setKeys(c->core, bits & 0x3FF);
}

static void drain_audio(cartivo_t *c)
{
    blip_t *left = c->core->getAudioChannel(c->core, 0);
    blip_t *right = c->core->getAudioChannel(c->core, 1);
    short stereo[2048 * 2];
    int available;
    while ((available = blip_samples_avail(left)) > 0) {
        if (available > 2048) available = 2048;
        blip_read_samples(left, stereo, available, true);
        blip_read_samples(right, stereo + 1, available, true);
        for (int i = 0; i < available && c->samples < MAX_SAMPLES; i++) {
            c->audio[c->samples++] = ((float)stereo[i * 2] + (float)stereo[i * 2 + 1]) / 65536.0f;
        }
    }
}

/* Runs `count` frames; returns the number of audio samples produced. */
unsigned cartivo_frames(cartivo_t *c, unsigned count)
{
    c->samples = 0;
    for (unsigned i = 0; i < count; i++) {
        c->core->runFrame(c->core);
        drain_audio(c);
    }
    for (unsigned i = 0; i < WIDTH * HEIGHT; i++) {
        c->pixels[i] |= 0xFF000000u; /* XBGR8 → opaque RGBA in memory order */
    }
    return c->samples;
}

uint32_t *cartivo_pixels(cartivo_t *c) { return c->pixels; }
float *cartivo_audio(cartivo_t *c) { return c->audio; }

size_t cartivo_state_size(cartivo_t *c)
{
    return c->core->stateSize(c->core);
}

void cartivo_save_state(cartivo_t *c, uint8_t *out)
{
    c->core->saveState(c->core, out);
}

/* 0 on success; anything but a state of exactly this size is refused. */
int cartivo_load_state(cartivo_t *c, const uint8_t *data, size_t len)
{
    if (len != c->core->stateSize(c->core)) return 1;
    return c->core->loadState(c->core, data) ? 0 : 2;
}

void cartivo_reset(cartivo_t *c)
{
    c->core->reset(c->core);
}

void cartivo_free(cartivo_t *c)
{
    if (!c) return;
    c->core->deinit(c->core);
    free(c->rom);
    free(c);
}
