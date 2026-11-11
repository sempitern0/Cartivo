// Cartivo bridge to Play! (BSD-2-Clause, https://github.com/jpd002/Play-)
// through its libretro frontend, linked statically. Original Cartivo code,
// licensed like the other bridges (ADR-014, ADR-015).
//
// PlayStation 2 discs with the core's own HLE: Play! emulates the IOP
// modules (IopBios) and the EE kernel without Sony's BIOS. The disc stays in
// the player's files: the host mounts it with WORKERFS and passes its path.
//
// Differences from the standalone-WASM bridges (NES–PS1):
// - Play! runs the VM on a pthread; the GS runs on the thread that calls
//   retro_run (this one), so the GL context lives here too.
// - The GS renders with WebGL2 (libretro HW render). The bridge creates the
//   context on the host's OffscreenCanvas ("#cartivo-canvas", registered in
//   specialHTMLTargets) and reads each frame back with glReadPixels into a
//   fixed 640×448 RGBA buffer, the same contract as the PS1 bridge.
// - Memory cards are not exposed through RETRO_MEMORY_SAVE_RAM: Play! keeps
//   them in its own (in-memory) filesystem. Cartivo PS2 uses save states
//   (Partidas) only; they are ~40 MiB before compression.
#include <cstdint>
#include <cstdlib>
#include <cstring>

#include <emscripten/html5.h>
#include <GLES3/gl3.h>

#include "ext/libretro.h"

static constexpr const char *CANVAS = "#cartivo-canvas";
static constexpr int OUT_RATE = 48000;
static constexpr int MAX_SAMPLES = OUT_RATE;
// Output frame, as in retro_get_system_av_info's base geometry.
static constexpr unsigned WIDTH = 640;
static constexpr unsigned HEIGHT = 448;
// Largest frame the GS presents at 1x (PAL interlaced is 640×512).
static constexpr unsigned READ_WIDTH = 640;
static constexpr unsigned READ_HEIGHT = 512;

struct cartivo_t {
    uint32_t pixels[WIDTH * HEIGHT];
    uint32_t readback[READ_WIDTH * READ_HEIGHT];
    float audio[MAX_SAMPLES];
    unsigned samples;
    // Linear resampler from the core's rate to 48 kHz (mono).
    double step, position;
    float previous;
    unsigned bits;
    int16_t analog[4]; // left x, left y, right x, right y
    double fps;
    EMSCRIPTEN_WEBGL_CONTEXT_HANDLE gl;
    retro_hw_context_reset_t context_reset, context_destroy;
};

static cartivo_t *current;

// --- libretro frontend callbacks ------------------------------------------

static uintptr_t current_framebuffer() { return 0; } // the canvas itself

static retro_proc_address_t proc_address(const char *symbol)
{
    return reinterpret_cast<retro_proc_address_t>(emscripten_webgl_get_proc_address(symbol));
}

static void set_timing(const struct retro_system_timing *timing)
{
    current->step = timing->sample_rate / static_cast<double>(OUT_RATE);
    current->fps = timing->fps;
}

static bool environment(unsigned cmd, void *data)
{
    switch (cmd) {
    case RETRO_ENVIRONMENT_SET_PIXEL_FORMAT:
        return *static_cast<const retro_pixel_format *>(data) == RETRO_PIXEL_FORMAT_XRGB8888;
    case RETRO_ENVIRONMENT_SET_HW_RENDER: {
        // `data` is the core's own g_hw_render: fill in the frontend side.
        auto *hw = static_cast<retro_hw_render_callback *>(data);
        if (hw->context_type != RETRO_HW_CONTEXT_OPENGLES3) return false;
        hw->get_current_framebuffer = current_framebuffer;
        hw->get_proc_address = proc_address;
        current->context_reset = hw->context_reset;
        current->context_destroy = hw->context_destroy;
        return true;
    }
    case RETRO_ENVIRONMENT_GET_VARIABLE: {
        // Original resolution and presentation (fidelity by default).
        auto *var = static_cast<retro_variable *>(data);
        static const char *const values[][2] = {
            {"play_res_multi", "1x"},
            {"play_presentation_mode", "Fit Screen"},
            {"play_bilinear_filtering", "false"},
        };
        for (const auto &v : values)
            if (!strcmp(var->key, v[0])) { var->value = v[1]; return true; }
        var->value = nullptr;
        return false;
    }
    case RETRO_ENVIRONMENT_GET_VARIABLE_UPDATE:
        *static_cast<bool *>(data) = false;
        return true;
    case RETRO_ENVIRONMENT_GET_INPUT_BITMASKS:
    case RETRO_ENVIRONMENT_SET_HW_SHARED_CONTEXT:
    case RETRO_ENVIRONMENT_SET_VARIABLES:
        return true;
    default:
        return false;
    }
}

// The GS presented a frame of `width`×`height` into the canvas, bottom-up
// (bottom_left_origin). Read it back and scale it to WIDTH×HEIGHT top-down.
static void video(const void *data, unsigned width, unsigned height, size_t)
{
    if (data != RETRO_HW_FRAME_BUFFER_VALID || !current || !width || !height) return;
    const unsigned w = width < READ_WIDTH ? width : READ_WIDTH;
    const unsigned h = height < READ_HEIGHT ? height : READ_HEIGHT;
    glPixelStorei(GL_PACK_ROW_LENGTH, READ_WIDTH);
    glReadPixels(0, 0, w, h, GL_RGBA, GL_UNSIGNED_BYTE, current->readback);
    for (unsigned y = 0; y < HEIGHT; y++) {
        const uint32_t *in = current->readback + (h - 1 - y * h / HEIGHT) * READ_WIDTH;
        uint32_t *out = current->pixels + y * WIDTH;
        for (unsigned x = 0; x < WIDTH; x++) out[x] = in[x * w / WIDTH] | 0xFF000000u;
    }
}

static size_t audio_batch(const int16_t *data, size_t frames)
{
    if (!current) return frames;
    for (size_t i = 0; i < frames; i++) {
        const float sample = (data[i * 2] + data[i * 2 + 1]) / 65536.0f;
        while (current->position <= 1.0 && current->samples < MAX_SAMPLES) {
            const float t = static_cast<float>(current->position);
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

static void input_poll() {}

// DualShock 2 in libretro's joypad order (B=Cross, Y=Square, A=Circle,
// X=Triangle, then L1, R1, L2, R2, L3, R3) plus both sticks.
static int16_t input_state(unsigned port, unsigned device, unsigned index, unsigned id)
{
    if (!current || port != 0) return 0;
    switch (device & RETRO_DEVICE_MASK) {
    case RETRO_DEVICE_JOYPAD:
        if (id == RETRO_DEVICE_ID_JOYPAD_MASK) return static_cast<int16_t>(current->bits);
        return id < 16 ? (current->bits >> id) & 1 : 0;
    case RETRO_DEVICE_ANALOG:
        if (index > RETRO_DEVICE_INDEX_ANALOG_RIGHT || id > RETRO_DEVICE_ID_ANALOG_Y) return 0;
        return current->analog[index * 2 + id];
    default:
        return 0;
    }
}

// WebGL2 context on the host's canvas, current on this thread.
static EMSCRIPTEN_WEBGL_CONTEXT_HANDLE create_context()
{
    EmscriptenWebGLContextAttributes attributes;
    emscripten_webgl_init_context_attributes(&attributes);
    attributes.majorVersion = 2;
    attributes.alpha = false;
    attributes.depth = true;
    attributes.antialias = false;
    attributes.preserveDrawingBuffer = true; // read back after presenting
    const auto gl = emscripten_webgl_create_context(CANVAS, &attributes);
    if (gl <= 0) return 0;
    emscripten_set_canvas_element_size(CANVAS, READ_WIDTH, READ_HEIGHT);
    emscripten_webgl_make_context_current(gl);
    return gl;
}

static void release(cartivo_t *c, bool loaded)
{
    if (c->gl && c->context_destroy) c->context_destroy();
    if (loaded) retro_unload_game();
    retro_deinit();
    if (c->gl) emscripten_webgl_destroy_context(c->gl);
    current = nullptr;
    free(c);
}

// --- Cartivo public API (exported to the host) ----------------------------

extern "C" {

// `path` names the file to boot (.iso, .chd, .cue, .cso, .isz, .elf) in the
// Emscripten FS. Returns NULL if the core refuses it or WebGL2 is missing.
cartivo_t *cartivo_create(const char *path, size_t length)
{
    if (current) return nullptr; // one game per module
    auto *c = static_cast<cartivo_t *>(calloc(1, sizeof(cartivo_t)));
    auto *name = static_cast<char *>(malloc(length + 1));
    if (!c || !name) {
        free(c);
        free(name);
        return nullptr;
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

    const retro_game_info game = {name, nullptr, 0, nullptr};
    const bool loaded = retro_load_game(&game);
    free(name);
    if (loaded) c->gl = create_context();
    if (!loaded || !c->gl || !c->context_reset) {
        release(c, loaded);
        return nullptr;
    }
    c->context_reset(); // creates the GS handler on this context
    retro_system_av_info av;
    retro_get_system_av_info(&av);
    set_timing(&av.timing);
    return c;
}

double cartivo_frame_rate(cartivo_t *c) { return c->fps; }

size_t cartivo_state_size(cartivo_t *) { return retro_serialize_size(); }

int cartivo_save_state(cartivo_t *, uint8_t *out, size_t length)
{
    return retro_serialize(out, length) ? 0 : 1;
}

int cartivo_load_state(cartivo_t *, const uint8_t *data, size_t length)
{
    return retro_unserialize(data, length) ? 0 : 1;
}

void cartivo_set_input(cartivo_t *c, unsigned bits) { c->bits = bits & 0xFFFF; }

void cartivo_set_analog(cartivo_t *c, int lx, int ly, int rx, int ry)
{
    c->analog[0] = static_cast<int16_t>(lx);
    c->analog[1] = static_cast<int16_t>(ly);
    c->analog[2] = static_cast<int16_t>(rx);
    c->analog[3] = static_cast<int16_t>(ry);
}

unsigned cartivo_frames(cartivo_t *c, unsigned count)
{
    c->samples = 0;
    for (unsigned i = 0; i < count; i++) retro_run();
    return c->samples;
}

uint32_t *cartivo_pixels(cartivo_t *c) { return c->pixels; }
float *cartivo_audio(cartivo_t *c) { return c->audio; }

void cartivo_reset(cartivo_t *) { retro_reset(); }

void cartivo_free(cartivo_t *c)
{
    if (c) release(c, true);
}

} // extern "C"
