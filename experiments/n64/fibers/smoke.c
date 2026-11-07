#include "cooperative.h"
#include <assert.h>
#include <stdio.h>
#include <stdint.h>
#include <emscripten/heap.h>

static cothread_t host, game;
static unsigned observed;
static void game_loop(void) {
  unsigned local = 0;
  while (1) {
    observed = ++local;
    assert(co_active() == game);
    co_switch(host);
    assert(local == observed);
  }
}
int main(void) {
  host = co_active();
  co_switch(host);
  co_delete(NULL);
  assert(!co_create(0, game_loop));
  assert(!co_create(4096, NULL));
  assert(!co_create(UINT32_MAX, game_loop));
  size_t warm_heap = 0;
  for (unsigned session = 0; session < 100; ++session) {
    observed = 0;
    game = co_create(4 * 1024 * 1024, game_loop);
    assert(game);
    for (unsigned step = 1; step <= 100; ++step) {
      co_switch(game);
      assert(co_active() == host);
      assert(observed == step);
    }
    co_delete(game);
    if (session == 0) warm_heap = emscripten_get_heap_size();
    assert(emscripten_get_heap_size() == warm_heap);
  }
  puts("PASS: 100 sessions, 10000 yields, local stack restored, bounded WASM heap");
  return 0;
}
