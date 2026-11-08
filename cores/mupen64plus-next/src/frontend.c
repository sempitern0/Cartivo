/* Experimental libretro frontend for the N64 laboratory (not Cartivo's
 * production host). Original Cartivo code. Linked with Mupen64Plus-Next built
 * as a static archive; the libco it expects comes from cooperative.c (fibers/Asyncify).
 *
 * The page's Worker owns an OffscreenCanvas and makes a WebGL2 context
 * current (Emscripten's GL library) before n64_load(); the core then draws
 * straight into the default framebuffer: no RGBA readback per frame.
 * Single thread, single game per module instance. */
#include <emscripten.h>
#include <emscripten/html5_webgl.h>
#include <stdarg.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include <errno.h>
#include <semaphore.h>

#include "libretro.h"

/* GLideN64's threaded renderer (opengl_Wrapper) is linked but never started
 * (mupen64plus-ThreadedRenderer=False); Emscripten without pthreads has no
 * sem_timedwait. Failing loudly beats a silent wait. */
int sem_timedwait(sem_t *sem, const struct timespec *timeout) {
  (void)sem, (void)timeout;
  errno = ENOSYS;
  return -1;
}

#define MAX_AUDIO_FRAMES 8192

static struct retro_hw_render_callback hw;
static bool hw_ready;
static struct retro_system_av_info av;
static int16_t audio[MAX_AUDIO_FRAMES * 2];
static unsigned audio_frames;
static unsigned frames_presented, frames_duped;
static uint16_t buttons;
static int16_t axes[4]; /* left x, left y, right x, right y */

/* The core's own option table (SET_CORE_OPTIONS_V2): every option it does
 * not find falls back to the default it declares, as in RetroArch. Without
 * it the core keeps its C zero-initialisers, which are not valid settings:
 * MaxTxCacheSize = 0 made GLideN64 evict a texture on every insertion and
 * pop an empty list, corrupting the heap (the SM64 crash). */
static const struct retro_core_option_v2_definition *declared;

/* Fixed laboratory overrides: GLideN64 with HLE RSP, the cached interpreter
 * (no JIT in WebAssembly) and no threaded renderer. WebGL2 has neither
 * glMapBufferRange for reading nor program binaries, so the colour and depth
 * copies to RDRAM and the shader storage stay off (their defaults are on). */
static const char *option(const char *key) {
  static const char *const options[][2] = {
      {"mupen64plus-rdp-plugin", "gliden64"},
      {"mupen64plus-rsp-plugin", "hle"},
      {"mupen64plus-cpucore", "cached_interpreter"},
      {"mupen64plus-ThreadedRenderer", "False"},
      {"mupen64plus-43screensize", "640x480"},
      {"mupen64plus-pak1", "memory"},
      {"mupen64plus-EnableFBEmulation", "True"},
      {"mupen64plus-EnableCopyColorToRDRAM", "Off"},
      {"mupen64plus-EnableCopyDepthToRDRAM", "Off"},
      {"mupen64plus-EnableShadersStorage", "False"},
  };
  for (size_t i = 0; i < sizeof(options) / sizeof(options[0]); i++)
    if (!strcmp(key, options[i][0])) return options[i][1];
  for (const struct retro_core_option_v2_definition *d = declared; d && d->key;
       d++)
    if (!strcmp(key, d->key))
      return d->default_value ? d->default_value : d->values[0].value;
  return NULL;
}

static void log_message(enum retro_log_level level, const char *fmt, ...) {
  va_list args;
  va_start(args, fmt);
  fprintf(stderr, "[n64 %d] ", (int)level);
  vfprintf(stderr, fmt, args);
  va_end(args);
}

static uintptr_t current_framebuffer(void) { return 0; } /* the canvas */

static retro_proc_address_t proc_address(const char *sym) {
  return (retro_proc_address_t)emscripten_webgl_get_proc_address(sym);
}

static bool environment(unsigned cmd, void *data) {
  switch (cmd) {
  case RETRO_ENVIRONMENT_SET_HW_RENDER: {
    struct retro_hw_render_callback *cb = data;
    if (cb->context_type != RETRO_HW_CONTEXT_OPENGLES3 &&
        cb->context_type != RETRO_HW_CONTEXT_OPENGLES2)
      return false;
    cb->get_current_framebuffer = current_framebuffer;
    cb->get_proc_address = proc_address;
    hw = *cb;
    return true;
  }
  case RETRO_ENVIRONMENT_GET_CORE_OPTIONS_VERSION:
    *(unsigned *)data = 2;
    return true;
  case RETRO_ENVIRONMENT_SET_CORE_OPTIONS_V2:
    declared = ((const struct retro_core_options_v2 *)data)->definitions;
    return true;
  case RETRO_ENVIRONMENT_SET_CORE_OPTIONS_V2_INTL:
    declared =
        ((const struct retro_core_options_v2_intl *)data)->us->definitions;
    return true;
  case RETRO_ENVIRONMENT_GET_VARIABLE: {
    struct retro_variable *var = data;
    var->value = var->key ? option(var->key) : NULL;
    return var->value != NULL;
  }
  case RETRO_ENVIRONMENT_GET_SYSTEM_DIRECTORY:
    *(const char **)data = "/n64/system";
    return true;
  case RETRO_ENVIRONMENT_GET_SAVE_DIRECTORY:
    *(const char **)data = "/n64/save";
    return true;
  case RETRO_ENVIRONMENT_GET_LOG_INTERFACE:
    ((struct retro_log_callback *)data)->log = log_message;
    return true;
  case RETRO_ENVIRONMENT_SET_PIXEL_FORMAT:
    return true;
  case RETRO_ENVIRONMENT_GET_CAN_DUPE:
    *(bool *)data = true;
    return true;
  case RETRO_ENVIRONMENT_GET_INPUT_BITMASKS:
    return true;
  case RETRO_ENVIRONMENT_SET_SYSTEM_AV_INFO:
    av = *(const struct retro_system_av_info *)data;
    return true;
  case RETRO_ENVIRONMENT_SET_GEOMETRY:
    av.geometry = *(const struct retro_game_geometry *)data;
    return true;
  default:
    return false;
  }
}

static void video(const void *data, unsigned width, unsigned height,
                  size_t pitch) {
  (void)width, (void)height, (void)pitch;
  if (data == RETRO_HW_FRAME_BUFFER_VALID) frames_presented++;
  else frames_duped++;
}

static size_t audio_batch(const int16_t *data, size_t frames) {
  size_t room = MAX_AUDIO_FRAMES - audio_frames;
  size_t taken = frames < room ? frames : room;
  memcpy(audio + audio_frames * 2, data, taken * 2 * sizeof(int16_t));
  audio_frames += taken;
  return frames;
}

static void audio_sample(int16_t left, int16_t right) {
  const int16_t frame[2] = {left, right};
  audio_batch(frame, 1);
}

static void input_poll(void) {}

static int16_t input_state(unsigned port, unsigned device, unsigned index,
                           unsigned id) {
  if (port != 0) return 0;
  switch (device & RETRO_DEVICE_MASK) {
  case RETRO_DEVICE_JOYPAD:
    if (id == RETRO_DEVICE_ID_JOYPAD_MASK) return (int16_t)buttons;
    return id < 16 ? (buttons >> id) & 1 : 0;
  case RETRO_DEVICE_ANALOG:
    if (index > RETRO_DEVICE_INDEX_ANALOG_RIGHT || id > 1) return 0;
    return axes[index * 2 + id];
  default:
    return 0;
  }
}

EMSCRIPTEN_KEEPALIVE int n64_init(void) {
  retro_set_environment(environment);
  retro_set_video_refresh(video);
  retro_set_audio_sample(audio_sample);
  retro_set_audio_sample_batch(audio_batch);
  retro_set_input_poll(input_poll);
  retro_set_input_state(input_state);
  retro_init();
  return 0;
}

/* `path` is in Emscripten's in-memory FS. A WebGL2 context must already be
 * current. Returns 0, or a negative step that failed. */
EMSCRIPTEN_KEEPALIVE int n64_load(const char *path) {
  /* The core asks for the data, not the path (need_fullpath = false); it
   * keeps its own copy. */
  FILE *file = fopen(path, "rb");
  if (!file) return -3;
  fseek(file, 0, SEEK_END);
  const long size = ftell(file);
  fseek(file, 0, SEEK_SET);
  void *data = size > 0 ? malloc((size_t)size) : NULL;
  const bool read = data && fread(data, 1, (size_t)size, file) == (size_t)size;
  fclose(file);
  if (!read) {
    free(data);
    return -4;
  }
  const struct retro_game_info game = {path, data, (size_t)size, NULL};
  const bool loaded = retro_load_game(&game);
  free(data);
  if (!loaded) return -1;
  if (!hw.context_reset) return -2;
  hw.context_reset();
  hw_ready = true;
  retro_get_system_av_info(&av);
  retro_set_controller_port_device(0, RETRO_DEVICE_JOYPAD);
  return 0;
}

/* One emulated frame. Its audio is read afterwards with n64_audio_frames():
 * retro_run() switches fibers, and an export whose stack Asyncify unwinds and
 * rewinds loses its return value. */
EMSCRIPTEN_KEEPALIVE void n64_run(void) {
  audio_frames = 0;
  retro_run();
}

/* Stereo frames of audio the last n64_run() produced (at n64_audio()). */
EMSCRIPTEN_KEEPALIVE unsigned n64_audio_frames(void) { return audio_frames; }

EMSCRIPTEN_KEEPALIVE int16_t *n64_audio(void) { return audio; }
EMSCRIPTEN_KEEPALIVE double n64_fps(void) { return av.timing.fps; }
EMSCRIPTEN_KEEPALIVE double n64_sample_rate(void) { return av.timing.sample_rate; }
EMSCRIPTEN_KEEPALIVE unsigned n64_presented(void) { return frames_presented; }
EMSCRIPTEN_KEEPALIVE unsigned n64_duped(void) { return frames_duped; }

/* Buttons in RETRO_DEVICE_ID_JOYPAD_* bit order; axes −32768…32767, y down. */
EMSCRIPTEN_KEEPALIVE void n64_input(unsigned bits, int lx, int ly, int rx,
                                    int ry) {
  buttons = (uint16_t)bits;
  axes[0] = (int16_t)lx, axes[1] = (int16_t)ly;
  axes[2] = (int16_t)rx, axes[3] = (int16_t)ry;
}

EMSCRIPTEN_KEEPALIVE void n64_unload(void) {
  if (hw_ready && hw.context_destroy) hw.context_destroy();
  hw_ready = false;
  retro_unload_game();
  retro_deinit();
}
