// Cartivo frontend for Play! (BSD-2-Clause, https://github.com/jpd002/Play-),
// linked statically with its core. Original Cartivo code, licensed like the
// other bridges (ADR-014); the JIT registration list follows upstream's own
// web frontend (Source/ui_js/Ps2VmJs.cpp).
//
// PlayStation 2 with the core's own HLE: Play! emulates the IOP modules and
// the EE kernel without Sony's BIOS. The disc stays in the player's files:
// under Emscripten Play! reads its image through Module.discImageDevice
// (Js_DiscImageDeviceStream.cpp), which the host provides; the path only
// tells the format by its extension. An .elf is read from the filesystem.
//
// Why not Play!'s libretro frontend: it boots, resets and (un)serialises
// from the caller's thread. With the WebAssembly JIT every thread has its
// own function table, so anything that creates or drops compiled blocks
// must run on the VM thread, as upstream's web frontend does.
//
// Threads:
// - The VM (EE, IOP, SPU) runs on a pthread and is never touched from here
//   except through its mailbox (on_vm).
// - The GS has no thread of its own: its calls are queued and run on the
//   thread that calls cartivo_frames, which owns the WebGL2 context. The
//   host creates that context on the game canvas and makes it current
//   before cartivo_create; the GS presents on it (ADR-017).
// - The VM stops by itself two frames ahead of the GS (MAX_INFLIGHT_FRAMES),
//   so the host's clock paces the game and nothing runs while it is paused.
//
// Memory cards are files of Play!'s own (in-memory) filesystem and are not
// exported yet: Cartivo PS2 keeps progress with save states (Partidas).
#include <algorithm>
#include <atomic>
#include <chrono>
#include <cstdint>
#include <cstdlib>
#include <cstring>
#include <functional>
#include <memory>
#include <mutex>
#include <string>
#include <thread>
#include <vector>

#include "AppConfig.h"
#include "BasicBlock.h"
#include "DefaultAppConfig.h" // defines CAppConfig::GetBasePath for this frontend
#include "Jitter_CodeGen_Wasm.h"
#include "MemStream.h"
#include "MemoryUtils.h"
#include "PS2VM.h"
#include "PS2VM_Preferences.h"
#include "PadHandler.h"
#include "PtrStream.h"
#include "gs/GSH_OpenGL/GSH_OpenGL.h"
#include "sound/SoundHandler.h"
#include "zip/ZipArchiveReader.h"
#include "zip/ZipArchiveWriter.h"

extern "C" uint32 LWL_Proxy(uint32, uint32, CMIPS *);
extern "C" uint32 LWR_Proxy(uint32, uint32, CMIPS *);
extern "C" uint64 LDL_Proxy(uint32, uint64, CMIPS *);
extern "C" uint64 LDR_Proxy(uint32, uint64, CMIPS *);
extern "C" void SWL_Proxy(uint32, uint32, CMIPS *);
extern "C" void SWR_Proxy(uint32, uint32, CMIPS *);
extern "C" void SDL_Proxy(uint32, uint64, CMIPS *);
extern "C" void SDR_Proxy(uint32, uint64, CMIPS *);

namespace
{

constexpr int OUT_RATE = 48000;
constexpr unsigned MAX_SAMPLES = OUT_RATE; // one second of output
// The picture the GS presents, whatever the game's video mode (the canvas).
constexpr unsigned WIDTH = 640;
constexpr unsigned HEIGHT = 448;
// The GS draws at this many times the console's resolution, on a canvas of
// WIDTH × HEIGHT times it (the host sizes the canvas). Fixed per game.
constexpr unsigned MAX_SCALE = 4;
unsigned render_scale = 1;
// A frame that takes longer than this means the VM is not running. Generous:
// while a game loads, one frame can take seconds of disc reads and JIT.
constexpr auto FRAME_TIMEOUT = std::chrono::seconds(20);
// The same for a call on the VM thread (boot, save state) and for stopping it.
constexpr auto VM_TIMEOUT = std::chrono::seconds(30);
// SPU blocks (45 samples each, about 1 ms) per write to the sound handler:
// small, so sound reaches the host every frame instead of in long bursts.
constexpr int SPU_BLOCKS = 4;

// --- VM ---------------------------------------------------------------------

class Vm : public CPS2VM
{
public:
	// On the VM thread: the functions JIT blocks import, registered in the
	// table of the thread that will compile them.
	void CreateVM() override
	{
		using Jitter::CWasmFunctionRegistry;
		const auto add = [](auto function, const char *name, const char *signature) {
			CWasmFunctionRegistry::RegisterFunction(reinterpret_cast<uintptr_t>(function), name, signature);
		};
		add(&EmptyBlockHandler, "_EmptyBlockHandler", "vi");
		add(&MemoryUtils_GetByteProxy, "_MemoryUtils_GetByteProxy", "iii");
		add(&MemoryUtils_GetHalfProxy, "_MemoryUtils_GetHalfProxy", "iii");
		add(&MemoryUtils_GetWordProxy, "_MemoryUtils_GetWordProxy", "iii");
		add(&MemoryUtils_GetDoubleProxy, "_MemoryUtils_GetDoubleProxy", "jii");
		add(&MemoryUtils_SetByteProxy, "_MemoryUtils_SetByteProxy", "viii");
		add(&MemoryUtils_SetHalfProxy, "_MemoryUtils_SetHalfProxy", "viii");
		add(&MemoryUtils_SetWordProxy, "_MemoryUtils_SetWordProxy", "viii");
		add(&MemoryUtils_SetDoubleProxy, "_MemoryUtils_SetDoubleProxy", "viji");
		add(&LWL_Proxy, "_LWL_Proxy", "iiii");
		add(&LWR_Proxy, "_LWR_Proxy", "iiii");
		add(&LDL_Proxy, "_LDL_Proxy", "jiji");
		add(&LDR_Proxy, "_LDR_Proxy", "jiji");
		add(&SWL_Proxy, "_SWL_Proxy", "viii");
		add(&SWR_Proxy, "_SWR_Proxy", "viii");
		add(&SDL_Proxy, "_SDL_Proxy", "viji");
		add(&SDR_Proxy, "_SDR_Proxy", "viji");
		CPS2VM::CreateVM();
	}

	/** Queues `call` for the VM thread. */
	void post(CMailBox::FunctionType call) { m_mailBox.SendCall(std::move(call)); }

	using CPS2VM::ResumeImpl;
};

// --- GS: OpenGL ES 3 on the caller's context --------------------------------

class Gs : public CGSH_OpenGL
{
public:
	Gs()
	    : CGSH_OpenGL(false)
	{
		// Present every frame, also when the game left the display registers
		// alone: one step of the host is always one frame of the console.
		m_frame = OnNewFrame.Connect([this](uint32) { m_regsDirty = true; });
	}

	static FactoryFunction factory()
	{
		return []() { return new Gs(); };
	}

	/**
	 * Runs the GS calls of one frame of the console, up to its flip. False if
	 * the VM produced none in time (it stopped or aborted).
	 */
	bool frame()
	{
		const auto deadline = std::chrono::steady_clock::now() + FRAME_TIMEOUT;
		m_presented = false;
		m_stopAtFlip = true;
		while(!m_presented)
		{
			pump();
			if(m_presented) break;
			if(std::chrono::steady_clock::now() > deadline) break;
			std::this_thread::sleep_for(std::chrono::microseconds(200));
		}
		m_stopAtFlip = false;
		return m_presented;
	}

	/**
	 * Runs the GS calls queued so far, without waiting for more (inside
	 * frame(), only up to the frame's flip: the VM may be a frame ahead).
	 * ProcessSingleFrame returns at a flip; a marker call counts as one, so
	 * it never blocks on an empty queue. Only the newest marker does: one
	 * left behind by a flip must not stop a later pump early.
	 */
	void pump()
	{
		SendGSCall([this, marker = ++m_marker]() {
			if(marker == m_marker) m_flipped = true;
		});
		ProcessSingleFrame();
	}

	/** Brings the GS memory up to date with what is drawn (for a state). */
	void sync()
	{
		pump();
		SyncMemoryCache();
	}

	/** Frees the GL objects, on the thread that owns the context. */
	void release()
	{
		pump();
		CGSH_OpenGL::ReleaseImpl();
	}

protected:
	void InitializeImpl() override
	{
		PRESENTATION_PARAMS params;
		params.mode = PRESENTATION_MODE_FILL;
		params.windowWidth = WIDTH * render_scale;
		params.windowHeight = HEIGHT * render_scale;
		SetPresentationParams(params);
		CGSH_OpenGL::InitializeImpl();
	}

	void FlipImpl(const DISPLAY_INFO &info) override
	{
		CGSH_OpenGL::FlipImpl(info); // leaves m_flipped set
		m_presented = true;
		// Outside frame(), carry on to the end of the queue.
		if(!m_stopAtFlip) m_flipped = false;
	}

	void PresentBackbuffer() override
	{
		// The browser presents the canvas when the Worker yields.
	}

private:
	NewFrameEvent::Connection m_frame;
	uint32_t m_marker = 0;
	bool m_presented = false;
	bool m_stopAtFlip = false;
};

// --- Sound: SPU blocks from the VM thread -----------------------------------

class Sound : public CSoundHandler
{
public:
	void Reset() override
	{
		std::lock_guard lock(m_mutex);
		m_stereo.clear();
	}

	void Write(int16 *samples, unsigned int count, unsigned int rate) override
	{
		std::lock_guard lock(m_mutex);
		m_rate = rate;
		// Never more than a second: a paused host must not grow this.
		if(m_stereo.size() + count > static_cast<size_t>(rate) * 2) m_stereo.clear();
		m_stereo.insert(m_stereo.end(), samples, samples + count);
	}

	bool HasFreeBuffers() override { return true; }
	void RecycleBuffers() override {}

	/** Moves what the VM wrote since the last call into `out`. */
	unsigned take(std::vector<int16> &out)
	{
		std::lock_guard lock(m_mutex);
		out.swap(m_stereo);
		m_stereo.clear();
		return m_rate;
	}

private:
	std::mutex m_mutex;
	std::vector<int16> m_stereo;
	unsigned m_rate = 48000;
};

// --- Pad: player 1's DualShock 2 --------------------------------------------

struct Pad_state
{
	std::atomic<uint32_t> bits{0};
	std::atomic<uint8_t> axes[4]; // left x, left y, right x, right y
	Pad_state()
	{
		for(auto &axis : axes) axis = 0x7F;
	}
};

class Pad : public CPadHandler
{
public:
	explicit Pad(const Pad_state &state)
	    : m_state(state)
	{
	}

	// On the VM thread, once per frame.
	void Update(uint8 *ram) override
	{
		using Info = PS2::CControllerInfo;
		// Bit of each button in the host's order (libretro's joypad).
		static const struct
		{
			Info::BUTTON button;
			unsigned bit;
		} buttons[] = {
		    {Info::CROSS, 0}, {Info::SQUARE, 1}, {Info::SELECT, 2}, {Info::START, 3},
		    {Info::DPAD_UP, 4}, {Info::DPAD_DOWN, 5}, {Info::DPAD_LEFT, 6}, {Info::DPAD_RIGHT, 7},
		    {Info::CIRCLE, 8}, {Info::TRIANGLE, 9}, {Info::L1, 10}, {Info::R1, 11},
		    {Info::L2, 12}, {Info::R2, 13}, {Info::L3, 14}, {Info::R3, 15},
		};
		static const Info::BUTTON axes[] = {
		    Info::ANALOG_LEFT_X, Info::ANALOG_LEFT_Y, Info::ANALOG_RIGHT_X, Info::ANALOG_RIGHT_Y};
		const uint32_t bits = m_state.bits;
		for(auto *listener : m_interfaces)
		{
			for(const auto &entry : buttons)
				listener->SetButtonState(0, entry.button, (bits >> entry.bit) & 1, ram);
			for(unsigned i = 0; i < 4; i++)
				listener->SetAxisState(0, axes[i], m_state.axes[i], ram);
		}
	}

private:
	const Pad_state &m_state;
};

} // namespace

// --- The game ---------------------------------------------------------------

struct cartivo_t
{
	Vm vm;
	Gs *gs = nullptr;
	Sound *sound = nullptr;
	Pad_state pad;
	std::string path;
	bool disc = false;
	bool pal = false;
	// Mono output at 48 kHz, resampled from the SPU's rate.
	float audio[MAX_SAMPLES];
	unsigned samples = 0;
	double position = 0;
	float previous = 0;
	std::vector<int16> stereo;
	// Written on the VM thread, read by the host once the call has finished.
	std::shared_ptr<std::vector<uint8_t>> state = std::make_shared<std::vector<uint8_t>>();
};

namespace
{

cartivo_t *current;

/**
 * Runs `call` on the VM thread and waits for it, running the GS meanwhile:
 * the VM may be blocked on a GS call, and would never get to its mailbox.
 * False if `call` threw or the VM did not get to it in time. A late VM may
 * still run it after this returns: `call` must own everything it uses.
 */
bool on_vm(cartivo_t *c, std::function<void()> call)
{
	struct Result
	{
		std::atomic<bool> done{false};
		std::atomic<bool> ok{false};
	};
	auto result = std::make_shared<Result>();
	c->vm.post([call = std::move(call), result]() {
		try
		{
			call();
			result->ok = true;
		}
		catch(...)
		{
		}
		result->done = true;
	});
	const auto deadline = std::chrono::steady_clock::now() + VM_TIMEOUT;
	while(!result->done)
	{
		if(std::chrono::steady_clock::now() > deadline) return false;
		if(c->gs) c->gs->pump();
		std::this_thread::sleep_for(std::chrono::microseconds(500));
	}
	return result->ok;
}

/** Stops the VM, running the GS calls it may be waiting on; false if it does not stop. */
bool pause(cartivo_t *c)
{
	const auto deadline = std::chrono::steady_clock::now() + VM_TIMEOUT;
	c->vm.PauseAsync();
	while(c->vm.GetStatus() != CVirtualMachine::PAUSED)
	{
		if(std::chrono::steady_clock::now() > deadline) return false;
		c->gs->pump();
		std::this_thread::sleep_for(std::chrono::milliseconds(1));
	}
	return true;
}

/** Boots the game from the start; false if Play! refuses the file. */
bool boot(cartivo_t *c)
{
	return on_vm(c, [c]() {
		if(c->disc) CAppConfig::GetInstance().SetPreferencePath(PREF_PS2_CDROM0_PATH, c->path);
		c->vm.Reset();
		if(c->disc)
			c->vm.m_ee->m_os->BootFromCDROM();
		else
			c->vm.m_ee->m_os->BootFromFile(c->path);
		// European releases (SLES, SCES, SLED, SCED) are PAL.
		const std::string id = c->vm.m_ee->m_os->GetExecutableName();
		c->pal = c->disc && (id.rfind("SLE", 0) == 0 || id.rfind("SCE", 0) == 0);
		c->vm.ResumeImpl();
	});
}

void resample(cartivo_t *c, unsigned rate)
{
	const double step = static_cast<double>(rate) / OUT_RATE;
	const size_t frames = c->stereo.size() / 2;
	for(size_t i = 0; i < frames; i++)
	{
		const float sample = (c->stereo[i * 2] + c->stereo[i * 2 + 1]) / 65536.0f;
		while(c->position <= 1.0 && c->samples < MAX_SAMPLES)
		{
			const float t = static_cast<float>(c->position);
			c->audio[c->samples++] = c->previous + (sample - c->previous) * t;
			c->position += step;
		}
		c->position -= 1.0;
		c->previous = sample;
	}
}

bool ends_with(const std::string &text, const char *suffix)
{
	const size_t n = strlen(suffix);
	if(text.size() < n) return false;
	for(size_t i = 0; i < n; i++)
		if(tolower(static_cast<unsigned char>(text[text.size() - n + i])) != suffix[i]) return false;
	return true;
}

} // namespace

// --- Cartivo public API (exported to the host) ------------------------------

extern "C" {

void cartivo_free(cartivo_t *c);

// `path` names the file to boot in the module's filesystem: an .elf, or a
// single-file disc image (.iso, .chd, .cso, .isz) served by the host's
// Module.discImageDevice. The WebGL2 context of the game canvas must be
// current on this thread, on a canvas of 640 × 448 times `scale` (1 to 4,
// the resolution the GS draws at). Returns NULL if Play! refuses it.
cartivo_t *cartivo_create(const char *path, size_t length, unsigned scale)
{
	if(current) return nullptr; // one game per module, ever
	render_scale = std::clamp(scale, 1u, MAX_SCALE);
	// Before the VM exists: its constructor registers its own default (100
	// blocks, a tenth of a second per write) and reads the value.
	auto &config = CAppConfig::GetInstance();
	config.RegisterPreferenceInteger(PREF_AUDIO_SPUBLOCKCOUNT, SPU_BLOCKS);
	config.SetPreferenceInteger(PREF_AUDIO_SPUBLOCKCOUNT, SPU_BLOCKS);
	// Before the GS exists: it reads the factor when it is initialised.
	config.RegisterPreferenceInteger(PREF_CGSH_OPENGL_RESOLUTION_FACTOR, render_scale);
	config.SetPreferenceInteger(PREF_CGSH_OPENGL_RESOLUTION_FACTOR, render_scale);
	auto *c = new cartivo_t();
	c->path.assign(path, length);
	c->disc = !ends_with(c->path, ".elf");

	// The host's clock paces the game (see the header): no limiter of Play!'s
	// own. Set before the VM thread exists, which reads it when it starts.
	config.SetPreferenceBoolean(PREF_PS2_LIMIT_FRAMERATE, false);
	c->vm.ReloadFrameRateLimit();
	c->vm.Initialize();

	c->vm.CreateGSHandler(Gs::factory());
	c->gs = static_cast<Gs *>(c->vm.GetGSHandler());
	c->vm.CreatePadHandler([c]() { return new Pad(c->pad); });
	c->vm.CreateSoundHandler([c]() { return c->sound = new Sound(); });
	c->gs->pump(); // InitializeImpl, on this thread's context

	current = c;
	if(!boot(c))
	{
		cartivo_free(c);
		return nullptr;
	}
	return c;
}

// The rate the host must pace the game at: PAL discs run at 50 Hz. Known
// from the disc's region as soon as it boots, before the game sets its mode.
double cartivo_frame_rate(cartivo_t *c)
{
	return c->pal ? 50.0 : 59.94;
}

// Runs `count` frames; returns the audio samples produced, or -1 if the VM
// stopped answering (the game cannot continue).
int cartivo_frames(cartivo_t *c, unsigned count)
{
	c->samples = 0;
	for(unsigned i = 0; i < count; i++)
		if(!c->gs->frame()) return -1;
	resample(c, c->sound->take(c->stereo));
	return static_cast<int>(c->samples);
}

float *cartivo_audio(cartivo_t *c)
{
	return c->audio;
}

// Buttons in libretro's joypad order (B=Cross, Y=Square, Select, Start, Up,
// Down, Left, Right, A=Circle, X=Triangle, L1, R1, L2, R2, L3, R3).
void cartivo_set_input(cartivo_t *c, unsigned bits)
{
	c->pad.bits = bits & 0xFFFF;
}

// Sticks as signed 16-bit, as the host normalises them.
void cartivo_set_analog(cartivo_t *c, int lx, int ly, int rx, int ry)
{
	const int values[4] = {lx, ly, rx, ry};
	for(unsigned i = 0; i < 4; i++)
	{
		const int clamped = values[i] < -32768 ? -32768 : values[i] > 32767 ? 32767 : values[i];
		c->pad.axes[i] = static_cast<uint8_t>((clamped + 32768) >> 8);
	}
}

// Save states (Partidas): a zip of the EE, IOP and GS, written on the VM
// thread. cartivo_snapshot returns its size (0 on failure) and
// cartivo_snapshot_data the bytes, valid until the next snapshot.
size_t cartivo_snapshot(cartivo_t *c)
{
	// A new buffer each time: a VM that answers late writes to its own.
	auto state = std::make_shared<std::vector<uint8_t>>();
	c->state = state;
	c->gs->sync();
	const bool saved = on_vm(c, [c, state]() {
		Framework::CMemStream stream;
		Framework::CZipArchiveWriter archive;
		c->vm.m_ee->SaveState(archive);
		c->vm.m_iop->SaveState(archive);
		c->vm.m_ee->m_gs->SaveState(archive);
		archive.Write(stream);
		state->assign(stream.GetBuffer(), stream.GetBuffer() + stream.GetSize());
	});
	return saved ? state->size() : 0;
}

const uint8_t *cartivo_snapshot_data(cartivo_t *c)
{
	return c->state->data();
}

// 0 if the state was restored; the game is unusable after a failure half-way.
int cartivo_restore(cartivo_t *c, const uint8_t *data, size_t length)
{
	// A copy the call owns: the host frees `data` when this returns.
	auto bytes = std::make_shared<std::vector<uint8_t>>(data, data + length);
	const bool restored = on_vm(c, [c, bytes]() {
		Framework::CPtrStream stream(bytes->data(), bytes->size());
		Framework::CZipArchiveReader archive(stream);
		c->vm.m_ee->LoadState(archive);
		c->vm.m_iop->LoadState(archive);
		c->vm.m_ee->m_gs->LoadState(archive);
	});
	if(restored) c->vm.OnMachineStateChange();
	return restored ? 0 : 1;
}

// Stops the console and frees its GL objects; the canvas's context outlives
// the game. The VM itself is not torn down: destroying it from this thread
// would drop its JIT blocks in the wrong function table, and the module is
// single-use (a game is a new instance; the host then ends its threads and
// drops it, memory included). The host resets by starting a new instance.
void cartivo_free(cartivo_t *c)
{
	if(!c) return;
	// A VM that does not stop is left as it is: the host ends its threads.
	if(pause(c)) c->gs->release();
}

} // extern "C"
