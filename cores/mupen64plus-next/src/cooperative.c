/* Single-thread libco ABI over Emscripten fibers (Asyncify), for the N64
 * core (cores/mupen64plus-next). Original Cartivo code. */
#include "cooperative.h"
#include <emscripten/fiber.h>
#include <stdint.h>
#include <stdlib.h>

/* Each fiber's Asyncify buffer holds the locals of every frame on its stack
 * when it yields. 64 KiB sufficed with LLVM 21; the LLVM 24 build of the
 * core overran it on the first frame (corrupted locals: musl's stderr write
 * looped forever), so 1 MiB, as the main stack's -sASYNCIFY_STACK_SIZE. */
enum {
  ASYNC_STACK_BYTES = 1024 * 1024,
  MAX_C_STACK_BYTES = 64 * 1024 * 1024
};
typedef struct {
  emscripten_fiber_t fiber;
  void *stack;
  void *async_stack;
  void (*entry)(void);
} context;
static context primary;
static _Alignas(16) unsigned char primary_async[ASYNC_STACK_BYTES];
static context *current;

cothread_t co_active(void) {
  if (!current) {
    emscripten_fiber_init_from_current_context(&primary.fiber, primary_async,
                                              sizeof(primary_async));
    current = &primary;
  }
  return current;
}

static void enter(void *argument) {
  context *self = argument;
  self->entry();
  /* A libco entry must yield, not return into an absent caller. */
  abort();
}

cothread_t co_create(unsigned int stack_size, void (*entry)(void)) {
  if (!entry || stack_size < 1024 || stack_size > MAX_C_STACK_BYTES) return NULL;
  co_active();
  context *next = calloc(1, sizeof(*next));
  if (!next) return NULL;
  stack_size = (stack_size + 15u) & ~15u;
  next->stack = malloc(stack_size);
  next->async_stack = malloc(ASYNC_STACK_BYTES);
  if (!next->stack || !next->async_stack) {
    free(next->stack);
    free(next->async_stack);
    free(next);
    return NULL;
  }
  next->entry = entry;
  emscripten_fiber_init(&next->fiber, enter, next, next->stack, stack_size,
                       next->async_stack, ASYNC_STACK_BYTES);
  return next;
}

void co_switch(cothread_t target) {
  context *previous = co_active();
  if (!target) abort();
  if (target == previous) return;
  current = target;
  emscripten_fiber_swap(&previous->fiber, &current->fiber);
}

void co_delete(cothread_t target) {
  if (!target) return;
  if (target == &primary || target == current) abort();
  context *deleted = target;
  free(deleted->stack);
  free(deleted->async_stack);
  free(deleted);
}
