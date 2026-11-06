// Cartivo bridge to PCSX-ReARMed (GPL-2.0, https://github.com/libretro/pcsx_rearmed)
// through its own libretro frontend, linked statically. Original Cartivo
// code, licensed like the other bridges (ADR-014, ADR-015).
// PlayStation discs and executables with the core's own HLE BIOS: Sony's
// BIOS is never looked for (no system directory is offered). The disc stays
// in the player's files: the core opens it through libretro's VFS, which is
// forwarded to the host's cartivo_vfs_* imports, and only the sectors it asks
// for are read. Nothing is ever written (memory card and states live in
// memory and are handed to the host).
// PCSX-ReARMed keeps its state in globals, so each WebAssembly instance runs
// one game (BridgeCore creates an instance per game).
#include <stdbool.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include "libretro.h"

#define OUT_RATE 48000
#define MAX_SAMPLES OUT_RATE
/* Every PlayStation mode (256–640 × 240/480, PAL 256/512 lines) is shown at
 * 4:3, so frames are scaled to one fixed size that keeps hi-res detail. */
#define WIDTH 640
#define HEIGHT 480

/* Host imports (packages/adapters/src/disc.ts). Offsets and sizes travel as
 * doubles so discs past 2 GiB never wrap. */
#define HOST(name) __attribute__((import_module("env"), import_name(#name)))
HOST(cartivo_vfs_open) int cartivo_vfs_open(const char *path, size_t length);
HOST(cartivo_vfs_size) double cartivo_vfs_size(int handle);
HOST(cartivo_vfs_read) double cartivo_vfs_read(int handle, double offset, void *out, size_t length);
HOST(cartivo_vfs_close) int cartivo_vfs_close(int handle);

typedef struct {
    uint32_t pixels[WIDTH * HEIGHT];
    float audio[MAX_SAMPLES];
    unsigned samples;
    /* Linear resampler from the core's rate to 48000 Hz (mono). */
    double step, position;
    float previous;
    unsigned bits;
    double fps;
} cartivo_t;

static cartivo_t *current;

/* --- libretro VFS over the host's files (read-only) --- */

struct retro_vfs_file_handle {
    int host;
    int64_t size, position;
    char *path;
};

static const char *vfs_get_path(struct retro_vfs_file_handle *f) { return f->path; }

static struct retro_vfs_file_handle *vfs_open(const char *path, unsigned mode, unsigned hints)
{
    (void)hints;
    if (!path || (mode & RETRO_VFS_FILE_ACCESS_WRITE)) return NULL;
    const int host = cartivo_vfs_open(path, strlen(path));
    if (!host) return NULL;
    struct retro_vfs_file_handle *f = calloc(1, sizeof(*f));
    char *copy = strdup(path);
    if (!f || !copy) {
        free(f);
        free(copy);
        cartivo_vfs_close(host);
        return NULL;
    }
    f->host = host;
    f->size = (int64_t)cartivo_vfs_size(host);
    f->path = copy;
    return f;
}

static int vfs_close(struct retro_vfs_file_handle *f)
{
    if (!f) return -1;
    cartivo_vfs_close(f->host);
    free(f->path);
    free(f);
    return 0;
}

static int64_t vfs_size(struct retro_vfs_file_handle *f) { return f ? f->size : -1; }
static int64_t vfs_tell(struct retro_vfs_file_handle *f) { return f ? f->position : -1; }

static int64_t vfs_seek(struct retro_vfs_file_handle *f, int64_t offset, int whence)
{
    if (!f) return -1;
    const int64_t base = whence == RETRO_VFS_SEEK_POSITION_CURRENT ? f->position
                       : whence == RETRO_VFS_SEEK_POSITION_END     ? f->size
                                                                   : 0;
    if (base + offset < 0) return -1;
    f->position = base + offset;
    return f->position;
}

static int64_t vfs_read(struct retro_vfs_file_handle *f, void *out, uint64_t length)
{
    if (!f) return -1;
    const double read = cartivo_vfs_read(f->host, (double)f->position, out, (size_t)length);
    if (read < 0) return -1;
    f->position += (int64_t)read;
    return (int64_t)read;
}

static int64_t vfs_write(struct retro_vfs_file_handle *f, const void *data, uint64_t length)
{
    (void)f, (void)data, (void)length;
    return -1;
}

static int vfs_flush(struct retro_vfs_file_handle *f) { return f ? 0 : -1; }
static int vfs_remove(const char *path) { (void)path; return -1; }
static int vfs_rename(const char *from, const char *to) { (void)from, (void)to; return -1; }
static int64_t vfs_truncate(struct retro_vfs_file_handle *f, int64_t length) { (void)f, (void)length; return -1; }

/* Only the player's files exist: no directories, nothing to list. */
static int vfs_stat(const char *path, int32_t *size)
{
    struct retro_vfs_file_handle *f = vfs_open(path, RETRO_VFS_FILE_ACCESS_READ, 0);
    if (!f) return 0;
    if (size) *size = (int32_t)f->size;
    vfs_close(f);
    return RETRO_VFS_STAT_IS_VALID;
}

static int vfs_mkdir(const char *dir) { (void)dir; return -1; }
static struct retro_vfs_dir_handle *vfs_opendir(const char *dir, bool hidden) { (void)dir, (void)hidden; return NULL; }
static bool vfs_readdir(struct retro_vfs_dir_handle *d) { (void)d; return false; }
static const char *vfs_dirent_name(struct retro_vfs_dir_handle *d) { (void)d; return NULL; }
static bool vfs_dirent_is_dir(struct retro_vfs_dir_handle *d) { (void)d; return false; }
static int vfs_closedir(struct retro_vfs_dir_handle *d) { (void)d; return -1; }

static struct retro_vfs_interface vfs = {
    .get_path = vfs_get_path, .open = vfs_open, .close = vfs_close,
    .size = vfs_size, .tell = vfs_tell, .seek = vfs_seek, .read = vfs_read,
    .write = vfs_write, .flush = vfs_flush, .remove = vfs_remove,
    .rename = vfs_rename, .truncate = vfs_truncate, .stat = vfs_stat,
    .mkdir = vfs_mkdir, .opendir = vfs_opendir, .readdir = vfs_readdir,
    .dirent_get_name = vfs_dirent_name, .dirent_is_dir = vfs_dirent_is_dir,
    .closedir = vfs_closedir,
};

/* --- frontend --- */

/* Fixed options: the HLE BIOS, 32-bit frames, the interpreter (no dynarec
 * in WebAssembly) and memory card 1 in memory, saved by the host. */
static const char *option(const char *key)
{
    static const char *const options[][2] = {
        {"pcsx_rearmed_bios", "HLE"},
        {"pcsx_rearmed_rgb32_output", "enabled"},
        {"pcsx_rearmed_drc", "disabled"},
        {"pcsx_rearmed_memcard1", "libretro"},
        {"pcsx_rearmed_memcard2", "none"},
    };
    for (size_t i = 0; i < sizeof(options) / sizeof(options[0]); i++)
        if (!strcmp(key, options[i][0])) return options[i][1];
    return NULL; /* the core's default */
}

static void set_timing(const struct retro_system_timing *timing)
{
    current->step = timing->sample_rate / OUT_RATE;
    current->fps = timing->fps;
}

static bool environment(unsigned cmd, void *data)
{
    switch (cmd) {
    case RETRO_ENVIRONMENT_SET_PIXEL_FORMAT:
        return *(const enum retro_pixel_format *)data == RETRO_PIXEL_FORMAT_XRGB8888;
    case RETRO_ENVIRONMENT_GET_VARIABLE: {
        struct retro_variable *var = data;
        var->value = var->key ? option(var->key) : NULL;
        return var->value != NULL;
    }
    case RETRO_ENVIRONMENT_GET_VFS_INTERFACE: {
        struct retro_vfs_interface_info *info = data;
        if (info->required_interface_version > 3) return false;
        info->iface = &vfs;
        return true;
    }
    case RETRO_ENVIRONMENT_GET_CAN_DUPE:
        *(bool *)data = true;
        return true;
    case RETRO_ENVIRONMENT_GET_INPUT_BITMASKS:
        return true;
    case RETRO_ENVIRONMENT_SET_SYSTEM_AV_INFO:
        /* A game switching between PAL and NTSC timing. */
        if (current) set_timing(&((const struct retro_system_av_info *)data)->timing);
        return true;
    default:
        /* No system or save directory (no BIOS, no files), log, rumble or
         * disc control: the core's defaults. */
        return false;
    }
}

/* XRGB8888 scaled (nearest) to the fixed 640 × 480, as RGBA in memory. */
static void video(const void *data, unsigned width, unsigned height, size_t pitch)
{
    if (!data || !current || !width || !height) return; /* frame duplicated */
    for (unsigned y = 0; y < HEIGHT; y++) {
        const uint32_t *in = (const uint32_t *)((const uint8_t *)data + (y * height / HEIGHT) * pitch);
        uint32_t *out = current->pixels + y * WIDTH;
        for (unsigned x = 0; x < WIDTH; x++) {
            const uint32_t p = in[x * width / WIDTH];
            out[x] = 0xFF000000u | ((p & 0xFF) << 16) | (p & 0xFF00) | ((p >> 16) & 0xFF);
        }
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

/* Bits: B, Y, select, start, up, down, left, right, A, X, L, R, L2, R2
 * (RETRO_DEVICE_ID_JOYPAD_* order; Cross is B, Circle A, Square Y,
 * Triangle X). Digital pad on port 1 only. */
static int16_t input_state(unsigned port, unsigned device, unsigned index, unsigned id)
{
    (void)index;
    if (!current || port != 0 || (device & RETRO_DEVICE_MASK) != RETRO_DEVICE_JOYPAD) return 0;
    if (id == RETRO_DEVICE_ID_JOYPAD_MASK) return (int16_t)current->bits;
    return id < 14 ? (current->bits >> id) & 1 : 0;
}

/* `path` names the file to boot (.cue, .iso, .bin, .exe…); every file is
 * read through the host. Returns NULL if the core refuses it. */
cartivo_t *cartivo_create(const char *path, size_t length)
{
    if (current) return NULL; /* one game per instance */
    cartivo_t *c = calloc(1, sizeof(cartivo_t));
    char *name = malloc(length + 1);
    if (!c || !name) {
        free(c);
        free(name);
        return NULL;
    }
    memcpy(name, path, length);
    name[length] = 0;
    current = c;
    retro_set_environment(environment);
    retro_set_video_refresh(video);
    retro_set_audio_sample(audio_sample);
    retro_set_audio_sample_batch(audio_batch);
    retro_set_input_poll(input_poll);
    retro_set_input_state(input_state);
    retro_init();
    const struct retro_game_info game = {name, NULL, 0, NULL};
    const bool loaded = retro_load_game(&game);
    free(name);
    if (!loaded) {
        retro_deinit();
        current = NULL;
        free(c);
        return NULL;
    }
    retro_set_controller_port_device(0, RETRO_DEVICE_JOYPAD);
    struct retro_system_av_info av;
    retro_get_system_av_info(&av);
    set_timing(&av.timing);
    return c;
}

/* Frames per second of the loaded game, so the host paces PAL at 50 Hz. */
double cartivo_frame_rate(cartivo_t *c) { return c->fps; }

/* Memory card 1 (128 KiB), always present. */
int cartivo_save_size(cartivo_t *c)
{
    (void)c;
    return (int)retro_get_memory_size(RETRO_MEMORY_SAVE_RAM);
}

/* Before the first frame: the buffer is the memory card the core uses. */
void cartivo_load_save(cartivo_t *c, const uint8_t *data, size_t len)
{
    (void)c;
    const size_t size = retro_get_memory_size(RETRO_MEMORY_SAVE_RAM);
    uint8_t *card = retro_get_memory_data(RETRO_MEMORY_SAVE_RAM);
    if (card) memcpy(card, data, len < size ? len : size);
}

void cartivo_save(cartivo_t *c, uint8_t *out)
{
    (void)c;
    const uint8_t *card = retro_get_memory_data(RETRO_MEMORY_SAVE_RAM);
    if (card) memcpy(out, card, retro_get_memory_size(RETRO_MEMORY_SAVE_RAM));
}

void cartivo_set_input(cartivo_t *c, unsigned bits)
{
    c->bits = bits & 0x3FFF;
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
    free(c);
}
