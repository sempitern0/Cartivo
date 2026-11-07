#ifndef CARTIVO_N64_COOPERATIVE_H
#define CARTIVO_N64_COOPERATIVE_H
/* The four libco entry points consumed by the pinned N64 frontend. */
typedef void *cothread_t;
cothread_t co_active(void);
cothread_t co_create(unsigned int stack_size, void (*entry)(void));
void co_switch(cothread_t target);
void co_delete(cothread_t target);
#endif
