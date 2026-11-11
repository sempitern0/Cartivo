# Cartivo build wrapper for Play! (PS2): links Play!'s core and OpenGL GS
# with Cartivo's own frontend (src/cartivo.cpp) into one Emscripten module
# (play.js + play.wasm).
#
# Unlike the standalone-WASM cores (NES–PS1), Play! needs pthreads (VM thread)
# and WebGL2 (GS hardware renderer), so Emscripten's JS glue is required.
# Since Emscripten 3.1.58 there is no separate play.worker.js: play.js itself
# is loaded as the pthread worker.
#
# Mirrors upstream's web frontend (Source/ui_js): the same static libraries
# and link flags, with cartivo_* exports instead of its UI bindings. Play!'s
# libretro frontend is not used: it drives the VM from the caller's thread,
# which the WebAssembly JIT does not allow (see src/cartivo.cpp).
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
project(CartivoPlayPS2)

# After project(): the Emscripten toolchain file, which sets EMSCRIPTEN, is
# only read by project(). Header.cmake then picks TARGET_PLATFORM_JS (GLES, no
# GLEW, no -msse, HAVE_UNISTD_H for zlib) and adds -fexceptions -pthread.
# Upstream's top-level CMakeLists.txt uses the same order.
include(Header)

# Upstream's top level derives PLAY_VERSION from `git describe`; here it is
# the pinned commit.
add_definitions(-DPLAY_VERSION="${PLAY_VERSION}")
if(NOT TARGET_PLATFORM_JS)
	message(FATAL_ERROR "Configure with emcmake: Header.cmake did not detect Emscripten")
endif()

# --- Play! static libraries (as Source/ui_js) --------------------------------
if(NOT TARGET PlayCore)
	add_subdirectory(${PLAY_UPSTREAM}/Source ${CMAKE_CURRENT_BINARY_DIR}/Source EXCLUDE_FROM_ALL)
endif()
if(NOT TARGET gsh_opengl)
	add_subdirectory(${PLAY_UPSTREAM}/Source/gs/GSH_OpenGL ${CMAKE_CURRENT_BINARY_DIR}/gs/GSH_OpenGL EXCLUDE_FROM_ALL)
endif()

# --- Module -------------------------------------------------------------------
add_executable(play src/cartivo.cpp)
target_include_directories(play PRIVATE ${PLAY_UPSTREAM}/Source)
target_link_libraries(play PRIVATE gsh_opengl PlayCore)

target_link_options(play PRIVATE
	# ES module, imported by the game Worker (Emscripten's main thread).
	"-sMODULARIZE=1"
	"-sEXPORT_ES6=1"
	"-sEXPORT_NAME=PlayModule"
	"-sENVIRONMENT=worker"
	# Memory: EE 32 MiB + IOP + GS + JIT blocks; grows on demand.
	"-sINITIAL_MEMORY=256MB"
	"-sALLOW_MEMORY_GROWTH=1"
	"-sSTACK_SIZE=2MB"
	# Pthreads: the VM thread, with spares so that starting one never has to
	# wait for the Worker to return to its event loop.
	"-sPTHREAD_POOL_SIZE=4"
	# WebGL2 on the game canvas: the host creates the context (GL) and the GS
	# draws on the default framebuffer from the Worker's own thread.
	"-sMIN_WEBGL_VERSION=2"
	"-sMAX_WEBGL_VERSION=2"
	# CodeGen_Wasm instantiates JIT blocks that call back through the table;
	# its MemoryFunction uses emscripten::val (upstream links with --bind).
	"-sWASM_BIGINT"
	"-sALLOW_TABLE_GROWTH"
	"-lembind"
	# FS: the host writes an .elf to boot into the module's filesystem (a
	# disc is read through Module.discImageDevice instead). wasmMemory: it
	# reads audio and save states from the current buffer, which is shared
	# and may grow. PThread: to stop the pool on exit.
	"-sFORCE_FILESYSTEM"
	"-sEXPORTED_RUNTIME_METHODS=FS,GL,PThread,wasmMemory,stringToNewUTF8"
	# Cartivo API plus the JIT proxies that generated code imports by name
	# (same list as Source/ui_js/CMakeLists.txt, minus _main/_initVm).
	"-sEXPORTED_FUNCTIONS=['_malloc','_free',\
'_cartivo_create','_cartivo_free',\
'_cartivo_set_input','_cartivo_set_analog',\
'_cartivo_frames','_cartivo_audio','_cartivo_frame_rate',\
'_cartivo_snapshot','_cartivo_snapshot_data','_cartivo_restore',\
'_EmptyBlockHandler',\
'_MemoryUtils_GetByteProxy','_MemoryUtils_GetHalfProxy',\
'_MemoryUtils_GetWordProxy','_MemoryUtils_GetDoubleProxy',\
'_MemoryUtils_SetByteProxy','_MemoryUtils_SetHalfProxy',\
'_MemoryUtils_SetWordProxy','_MemoryUtils_SetDoubleProxy',\
'_LWL_Proxy','_LWR_Proxy','_LDL_Proxy','_LDR_Proxy',\
'_SWL_Proxy','_SWR_Proxy','_SDL_Proxy','_SDR_Proxy']"
)
