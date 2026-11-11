# Cartivo build wrapper for Play! (PS2): links Play!'s libretro frontend and
# the Cartivo bridge into one Emscripten module (play.js + play.wasm).
#
# Unlike the standalone-WASM cores (NES–PS1), Play! needs pthreads (VM thread)
# and WebGL2 (GS hardware renderer), so Emscripten's JS glue is required.
# Since Emscripten 3.1.58 there is no separate play.worker.js: play.js itself
# is loaded as the pthread worker.
#
# Mirrors upstream's own frontends (Source/ui_js, Source/ui_libretro): the
# same static libraries, and ui_js's link flags with cartivo_* exports
# instead of the web UI bindings.
#
# Usage (from tools/build-play.mjs):
#   emcmake cmake -S cores/play -B <build> -DPLAY_UPSTREAM=<clone> -DPLAY_VERSION=<sha>
#   cmake --build <build> --target play
cmake_minimum_required(VERSION 3.18)

if(NOT PLAY_UPSTREAM)
	message(FATAL_ERROR "PLAY_UPSTREAM must point to the Play! checkout")
endif()

set(CMAKE_MODULE_PATH
	${PLAY_UPSTREAM}/deps/Dependencies/cmake-modules
	${CMAKE_MODULE_PATH}
)
# Header.cmake detects EMSCRIPTEN → TARGET_PLATFORM_JS (GLES, no GLEW) and
# adds -fexceptions -pthread to the compile and link flags.
include(Header)

project(CartivoPlayPS2)

# main_libretro.cpp reports PLAY_VERSION as library_version; upstream's top
# level derives it from `git describe`, here it is the pinned commit.
add_definitions(-DPLAY_VERSION="${PLAY_VERSION}")
# Play-Dependencies' zlib ships the generic zconf.h, which only includes
# <unistd.h> (lseek, off_t) when HAVE_UNISTD_H is set; Emscripten has it.
add_compile_definitions(HAVE_UNISTD_H=1)

# --- Play! static libraries (same targets as Source/ui_libretro) -----------
if(NOT TARGET PlayCore)
	add_subdirectory(${PLAY_UPSTREAM}/Source ${CMAKE_CURRENT_BINARY_DIR}/Source EXCLUDE_FROM_ALL)
endif()
if(NOT TARGET ui_shared)
	add_subdirectory(${PLAY_UPSTREAM}/Source/ui_shared ${CMAKE_CURRENT_BINARY_DIR}/ui_shared EXCLUDE_FROM_ALL)
endif()
if(NOT TARGET gsh_opengl)
	add_subdirectory(${PLAY_UPSTREAM}/Source/gs/GSH_OpenGL ${CMAKE_CURRENT_BINARY_DIR}/gs/GSH_OpenGL EXCLUDE_FROM_ALL)
endif()

# --- Module: libretro frontend + Cartivo bridge -----------------------------
set(LIBRETRO ${PLAY_UPSTREAM}/Source/ui_libretro)
add_executable(play
	src/cartivo.cpp
	${LIBRETRO}/main_libretro.cpp
	${LIBRETRO}/GSH_OpenGL_Libretro.cpp
	${LIBRETRO}/PH_Libretro_Input.cpp
	${LIBRETRO}/SH_LibreAudio.cpp
)
target_include_directories(play PRIVATE ${LIBRETRO})
target_link_libraries(play PRIVATE gsh_opengl ui_shared PlayCore)

target_link_options(play PRIVATE
	# ES module, imported by the game Worker (Emscripten's main thread).
	"-sMODULARIZE=1"
	"-sEXPORT_ES6=1"
	"-sEXPORT_NAME=PlayModule"
	"-sENVIRONMENT=web,worker"
	# Memory: EE 32 MiB + IOP + GS + JIT blocks; grows on demand.
	"-sINITIAL_MEMORY=256MB"
	"-sALLOW_MEMORY_GROWTH=1"
	"-sSTACK_SIZE=2MB"
	# Pthreads (upstream ui_js uses a pool of 2).
	"-sPTHREAD_POOL_SIZE=2"
	# WebGL2 for the GS; the host registers its OffscreenCanvas in
	# specialHTMLTargets under "#cartivo-canvas" before cartivo_create.
	"-sUSE_WEBGL2=1"
	"-sOFFSCREEN_FRAMEBUFFER=1"
	# CodeGen_Wasm instantiates JIT blocks that call back through the table.
	"-sWASM_BIGINT"
	"-sALLOW_TABLE_GROWTH"
	# The core opens discs by path (need_fullpath): the host mounts the
	# player's File with WORKERFS, read on demand like the other disc cores.
	"-sFORCE_FILESYSTEM"
	"-lworkerfs.js"
	"-sEXPORTED_RUNTIME_METHODS=['FS','WORKERFS','specialHTMLTargets']"
	# Cartivo API plus the JIT proxies that generated code imports by name
	# (same list as Source/ui_js/CMakeLists.txt, minus _main/_initVm).
	"-sEXPORTED_FUNCTIONS=['_malloc','_free',\
'_cartivo_create','_cartivo_free','_cartivo_reset',\
'_cartivo_set_input','_cartivo_set_analog',\
'_cartivo_frames','_cartivo_pixels','_cartivo_audio',\
'_cartivo_state_size','_cartivo_save_state','_cartivo_load_state',\
'_cartivo_frame_rate',\
'_EmptyBlockHandler',\
'_MemoryUtils_GetByteProxy','_MemoryUtils_GetHalfProxy',\
'_MemoryUtils_GetWordProxy','_MemoryUtils_GetDoubleProxy',\
'_MemoryUtils_SetByteProxy','_MemoryUtils_SetHalfProxy',\
'_MemoryUtils_SetWordProxy','_MemoryUtils_SetDoubleProxy',\
'_LWL_Proxy','_LWR_Proxy','_LDL_Proxy','_LDR_Proxy',\
'_SWL_Proxy','_SWR_Proxy','_SDL_Proxy','_SDR_Proxy']"
)
